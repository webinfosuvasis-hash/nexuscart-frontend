import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CacheService }  from '@/shared/cache/cache.service';
import { CACHE_KEYS, CACHE_TTL } from '@/shared/cache/cache.constants';
import { ConfigStatus } from '@prisma/client';
import { UpdateThemeDraftDto } from './dto/update-theme-draft.dto';

// ─── Defaults ────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG = {
  colors: {
    primary:    '#4f46e5',
    secondary:  '#f5f5f5',
    accent:     '#f59e0b',
    background: '#ffffff',
    text:       '#1a1a1a',
    surface:    '#f9fafb',
  },
  typography: {
    headingFont: 'Inter',
    bodyFont:    'Inter',
    baseSizeRem: 1.0,
    lineHeight:  1.6,
  },
  layout: {
    stickyHeader:  true,
    sidebarCart:   false,
    megaMenu:      true,
    backToTop:     true,
    cookieConsent: false,
  },
};

@Injectable()
export class ThemeConfigService {
  private readonly logger = new Logger(ThemeConfigService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache:  CacheService,
  ) {}

  // ── Helpers ──────────────────────────────────────────────────────────────────

  /**
   * Resolves the active themeId for a store.
   * Used as a fallback when callers don't provide an explicit themeId.
   */
  async resolveActiveThemeId(storeId: string): Promise<string> {
    const cacheKey = CACHE_KEYS.activeTheme(storeId);
    const cached   = await this.cache.get<string>(cacheKey);
    if (cached) return cached;

    // 1. Prefer the installed theme marked isActive
    const activeTheme = await this.prisma.storeTheme.findFirst({
      where:  { storeId, isActive: true },
      select: { themeId: true },
    });
    if (activeTheme?.themeId) {
      await this.cache.set(cacheKey, activeTheme.themeId, CACHE_TTL.ACTIVE_THEME);
      return activeTheme.themeId;
    }

    // 2. Fall back: use whatever themeId already exists in theme_configs for this store
    //    (handles the case where a theme was configured before StoreTheme.isActive was set)
    const existingConfig = await this.prisma.themeConfig.findFirst({
      where:   { storeId },
      select:  { themeId: true },
      orderBy: { updatedAt: 'desc' },
    });
    if (existingConfig?.themeId) {
      await this.cache.set(cacheKey, existingConfig.themeId, CACHE_TTL.ACTIVE_THEME);
      return existingConfig.themeId;
    }

    // 3. Final fallback: use any installed theme
    const anyTheme = await this.prisma.storeTheme.findFirst({
      where:  { storeId },
      select: { themeId: true },
      orderBy: { installedAt: 'desc' },
    });
    const themeId = anyTheme?.themeId ?? 'default';
    await this.cache.set(cacheKey, themeId, CACHE_TTL.ACTIVE_THEME);
    return themeId;
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  async getConfigs(storeId: string, themeId: string) {
    const [draft, published] = await Promise.all([
      this.getDraft(storeId, themeId),
      this.getPublished(storeId, themeId),
    ]);
    return { draft, published, themeId };
  }

  /**
   * Load the DRAFT config for a specific store+theme.
   * Cache-first → MySQL fallback → seed from published (or defaults).
   */
  async getDraft(storeId: string, themeId: string) {
    const cacheKey = CACHE_KEYS.themeConfig(storeId, themeId, 'draft');
    const cached   = await this.cache.get<any>(cacheKey);
    if (cached) return cached;

    let row = await this.prisma.themeConfig.findUnique({
      where: { storeId_themeId_status: { storeId, themeId, status: ConfigStatus.DRAFT } },
    });

    if (!row) {
      // Seed draft from published, or fall back to defaults
      const published = await this.prisma.themeConfig.findUnique({
        where: { storeId_themeId_status: { storeId, themeId, status: ConfigStatus.PUBLISHED } },
      });

      row = await this.prisma.themeConfig.create({
        data: {
          storeId,
          themeId,
          status:  ConfigStatus.DRAFT,
          config:  (published?.config as object) ?? DEFAULT_CONFIG,
          version: 0,
        },
      });
    }

    await this.cache.set(cacheKey, row, CACHE_TTL.THEME_CONFIG);
    return row;
  }

  /**
   * Load the PUBLISHED config. Returns null when nothing has been published yet.
   */
  async getPublished(storeId: string, themeId: string) {
    const cacheKey = CACHE_KEYS.themeConfig(storeId, themeId, 'published');
    const cached   = await this.cache.get<any>(cacheKey);
    if (cached) return cached;

    const row = await this.prisma.themeConfig.findUnique({
      where: { storeId_themeId_status: { storeId, themeId, status: ConfigStatus.PUBLISHED } },
    });

    if (row) await this.cache.set(cacheKey, row, CACHE_TTL.THEME_CONFIG);
    return row;
  }

  /**
   * Merge-patch the draft config.
   * Incoming DTO fields are shallow-merged per section (colors, typography, layout).
   */
  async updateDraft(storeId: string, themeId: string, dto: UpdateThemeDraftDto) {
    const current  = await this.getDraft(storeId, themeId);
    const existing = current.config as Record<string, any>;

    const merged = {
      colors:     { ...existing.colors,     ...(dto.colors     ?? {}) },
      typography: { ...existing.typography, ...(dto.typography ?? {}) },
      layout:     { ...existing.layout,     ...(dto.layout     ?? {}) },
    };

    const updated = await this.prisma.themeConfig.update({
      where: { storeId_themeId_status: { storeId, themeId, status: ConfigStatus.DRAFT } },
      data:  { config: merged },
    });

    await this.cache.del(CACHE_KEYS.themeConfig(storeId, themeId, 'draft'));
    return updated;
  }

  /**
   * Seed initial ThemeConfig rows (DRAFT + PUBLISHED) when a theme is installed
   * or activated. Called from ThemesService.
   */
  async seedForStore(storeId: string, themeId: string, baseConfig?: object) {
    const config = baseConfig ?? DEFAULT_CONFIG;

    await this.prisma.themeConfig.upsert({
      where:  { storeId_themeId_status: { storeId, themeId, status: ConfigStatus.DRAFT } },
      create: { storeId, themeId, status: ConfigStatus.DRAFT,     config, version: 0 },
      update: { themeId, config },
    });

    await this.prisma.themeConfig.upsert({
      where:  { storeId_themeId_status: { storeId, themeId, status: ConfigStatus.PUBLISHED } },
      create: { storeId, themeId, status: ConfigStatus.PUBLISHED, config, version: 1 },
      update: { themeId, config },
    });

    await Promise.all([
      this.cache.del(CACHE_KEYS.themeConfig(storeId, themeId, 'draft')),
      this.cache.del(CACHE_KEYS.themeConfig(storeId, themeId, 'published')),
    ]);
  }
}
