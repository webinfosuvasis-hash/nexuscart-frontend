import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CacheService } from '@/shared/cache/cache.service';
import { CACHE_KEYS, CACHE_TTL } from '@/shared/cache/cache.constants';
import { ConfigStatus, PresetType } from '@prisma/client';
import { CreatePresetDto }  from './dto/create-preset.dto';
import { UpdatePresetDto }  from './dto/update-preset.dto';
import { ImportPresetDto }  from './dto/import-preset.dto';

export interface PresetDiff {
  field:  string;
  before: unknown;
  after:  unknown;
}

/** Keys in a preset config that are mutable (used for diff display) */
const COMPARABLE_PATHS = [
  'theme.colors.primary', 'theme.colors.secondary', 'theme.colors.accent',
  'theme.colors.background', 'theme.colors.text', 'theme.colors.surface',
  'theme.typography.headingFont', 'theme.typography.bodyFont',
  'theme.typography.baseSizeRem',
  'theme.layout.stickyHeader', 'theme.layout.sidebarCart',
  'theme.layout.megaMenu', 'theme.layout.backToTop',
];

@Injectable()
export class PresetsService {
  private readonly logger = new Logger(PresetsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache:  CacheService,
  ) {}

  // ── List ──────────────────────────────────────────────────────────────────────

  async listPresets(storeId: string) {
    const cacheKey = CACHE_KEYS.presetList(storeId);
    const cached   = await this.cache.get<any>(cacheKey);
    if (cached) return cached;

    const [systemPresets, tenantPresets] = await Promise.all([
      // System presets: storeId is null, shared across all tenants
      this.prisma.themePreset.findMany({
        where:   { storeId: null, type: 'SYSTEM' },
        orderBy: { name: 'asc' },
        select:  { id: true, name: true, description: true, thumbnailUrl: true,
                   type: true, tag: true, themeId: true, themeVersion: true, createdAt: true },
      }),
      // Tenant custom + auto-snapshots
      this.prisma.themePreset.findMany({
        where: {
          storeId,
          type:  { not: 'SYSTEM' },
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } },
          ],
        },
        orderBy: [{ type: 'asc' }, { createdAt: 'desc' }],
        select:  { id: true, name: true, description: true, thumbnailUrl: true,
                   type: true, tag: true, themeId: true, themeVersion: true,
                   isActive: true, expiresAt: true, createdAt: true },
      }),
    ]);

    const result = { system: systemPresets, custom: tenantPresets };
    await this.cache.set(cacheKey, result, CACHE_TTL.PRESET_LIST);
    return result;
  }

  // ── Get single ────────────────────────────────────────────────────────────────

  async getPreset(storeId: string, presetId: string) {
    const preset = await this.prisma.themePreset.findFirst({
      where: {
        id: presetId,
        OR: [{ storeId }, { storeId: null }],
      },
    });
    if (!preset) throw new NotFoundException('Preset not found');
    return preset;
  }

  // ── Create (snapshot current draft) ──────────────────────────────────────────

  async createPreset(storeId: string, dto: CreatePresetDto) {
    const activeThemeForQuery = await this.prisma.storeTheme.findFirst({
      where: { storeId, isActive: true }, select: { themeId: true },
    });
    const resolvedThemeId = activeThemeForQuery?.themeId ?? 'default';

    const [draftTheme, draftHeader, draftFooter, activeTheme] = await Promise.all([
      this.prisma.themeConfig.findUnique({
        where: { storeId_themeId_status: { storeId, themeId: resolvedThemeId, status: ConfigStatus.DRAFT } },
      }),
      this.prisma.headerConfig.findUnique({
        where: { storeId_status: { storeId, status: ConfigStatus.DRAFT } },
      }),
      this.prisma.footerConfig.findUnique({
        where: { storeId_status: { storeId, status: ConfigStatus.DRAFT } },
      }),
      this.prisma.storeTheme.findFirst({
        where: { storeId, isActive: true },
        include: { theme: { select: { id: true, version: true } } },
      }),
    ]);

    // resolvedThemeId already computed above (pre-query)

    if (!draftTheme) {
      throw new BadRequestException('No theme config found. Configure the theme before saving a preset.');
    }

    const config = {
      theme:   draftTheme.config,
      header:  draftHeader ? { zones: draftHeader.zones, behavior: draftHeader.behavior } : null,
      footer:  draftFooter ? { columns: draftFooter.columns, bottomBar: draftFooter.bottomBar, settings: draftFooter.settings } : null,
    };

    const preset = await this.prisma.themePreset.create({
      data: {
        storeId,
        themeId:      activeTheme?.themeId ?? draftTheme.themeId,
        name:         dto.name,
        description:  dto.description,
        tag:          dto.tag,
        type:         PresetType.CUSTOM,
        config,
        themeVersion: activeTheme?.theme?.version ?? '1.0.0',
      },
    });

    await this.cache.del(CACHE_KEYS.presetList(storeId));
    return preset;
  }

  // ── Update ────────────────────────────────────────────────────────────────────

  async updatePreset(storeId: string, presetId: string, dto: UpdatePresetDto) {
    const preset = await this.getPreset(storeId, presetId);
    this.requireMutable(preset);

    const updated = await this.prisma.themePreset.update({
      where: { id: presetId },
      data: {
        ...(dto.name        && { name: dto.name }),
        ...(dto.description && { description: dto.description }),
        ...(dto.tag         && { tag: dto.tag }),
      },
    });

    await this.cache.del(CACHE_KEYS.presetList(storeId));
    return updated;
  }

  // ── Delete ────────────────────────────────────────────────────────────────────

  async deletePreset(storeId: string, presetId: string) {
    const preset = await this.getPreset(storeId, presetId);
    this.requireMutable(preset);

    if (preset.isActive) {
      throw new ForbiddenException(
        'Cannot delete the active preset. Apply a different preset first.',
      );
    }

    await this.prisma.themePreset.delete({ where: { id: presetId } });
    await this.cache.del(CACHE_KEYS.presetList(storeId));
    return { message: 'Preset deleted' };
  }

  // ── Apply ────────────────────────────────────────────────────────────────────

  async applyPreset(storeId: string, presetId: string) {
    const preset      = await this.getPreset(storeId, presetId);
    const config      = preset.config as any;
    const activeTheme = await this.prisma.storeTheme.findFirst({
      where: { storeId, isActive: true },
      include: { theme: { select: { version: true } } },
    });

    // Version compatibility check — warn but don't block
    if (
      activeTheme?.theme.version &&
      preset.themeVersion &&
      this.majorVersion(activeTheme.theme.version) !== this.majorVersion(preset.themeVersion)
    ) {
      this.logger.warn(
        `Applying preset "${preset.name}" (v${preset.themeVersion}) ` +
        `to theme v${activeTheme.theme.version} — minor incompatibility possible.`,
      );
    }

    // Write preset config to draft
    await this.prisma.$transaction(async (tx) => {
      const applyThemeId = preset.themeId;
      if (config.theme) {
        await tx.themeConfig.upsert({
          where: { storeId_themeId_status: { storeId, themeId: applyThemeId, status: ConfigStatus.DRAFT } },
          create: { storeId, themeId: applyThemeId, status: ConfigStatus.DRAFT, config: config.theme, version: 0 },
          update: { config: config.theme },
        });
      }

      if (config.header) {
        await tx.headerConfig.upsert({
          where: { storeId_status: { storeId, status: ConfigStatus.DRAFT } },
          create: { storeId, status: ConfigStatus.DRAFT,
                    zones: config.header.zones ?? [], behavior: config.header.behavior ?? {} },
          update: { zones: config.header.zones, behavior: config.header.behavior },
        });
      }

      if (config.footer) {
        await tx.footerConfig.upsert({
          where: { storeId_status: { storeId, status: ConfigStatus.DRAFT } },
          create: { storeId, status: ConfigStatus.DRAFT,
                    columns: config.footer.columns ?? [], bottomBar: config.footer.bottomBar ?? {},
                    settings: config.footer.settings ?? {} },
          update: { columns: config.footer.columns, bottomBar: config.footer.bottomBar,
                    settings: config.footer.settings },
        });
      }
    });

    // Invalidate all draft cache keys
    const applyThemeIdForCache = preset.themeId;
    await Promise.all([
      this.cache.del(CACHE_KEYS.themeConfig(storeId, applyThemeIdForCache, 'draft')),
      this.cache.del(CACHE_KEYS.headerConfig(storeId, 'draft')),
      this.cache.del(CACHE_KEYS.footerConfig(storeId, 'draft')),
      this.cache.del(CACHE_KEYS.presetList(storeId)),
    ]);

    return { message: 'Preset applied to draft. Review changes and publish when ready.' };
  }

  // ── Duplicate ────────────────────────────────────────────────────────────────

  async duplicatePreset(storeId: string, presetId: string) {
    const preset = await this.getPreset(storeId, presetId);

    const copy = await this.prisma.themePreset.create({
      data: {
        storeId,
        themeId:      preset.themeId,
        name:         `${preset.name} (Copy)`,
        description:  preset.description ?? undefined,
        type:         PresetType.CUSTOM,
        config:       preset.config as any,
        themeVersion: preset.themeVersion,
        tag:          preset.tag ?? undefined,
      },
    });

    await this.cache.del(CACHE_KEYS.presetList(storeId));
    return copy;
  }

  // ── Export ────────────────────────────────────────────────────────────────────

  async exportPreset(storeId: string, presetId: string) {
    const preset = await this.getPreset(storeId, presetId);
    return {
      _nexuscart:   true,
      _version:     '2.0',
      _exportedAt:  new Date().toISOString(),
      themeId:      preset.themeId,
      themeVersion: preset.themeVersion,
      name:         preset.name,
      description:  preset.description,
      tag:          preset.tag,
      config:       preset.config,
    };
  }

  // ── Import ────────────────────────────────────────────────────────────────────

  async importPreset(storeId: string, dto: ImportPresetDto) {
    const data = dto.data;

    // Schema validation
    if (!data._nexuscart || data._version !== '2.0') {
      throw new BadRequestException(
        'Invalid preset file. Only NexusCart v2.0 preset exports are accepted.',
      );
    }
    if (!data.config || typeof data.config !== 'object') {
      throw new BadRequestException('Preset file is missing a valid config object.');
    }

    const activeTheme = await this.prisma.storeTheme.findFirst({
      where: { storeId, isActive: true },
      include: { theme: { select: { id: true } } },
    });

    if (activeTheme && data.themeId && activeTheme.themeId !== data.themeId) {
      throw new BadRequestException(
        `This preset was built for theme "${data.themeId}". ` +
        `Your active theme is "${activeTheme.themeId}". Import not allowed.`,
      );
    }

    const preset = await this.prisma.themePreset.create({
      data: {
        storeId,
        themeId:      (data.themeId as string) ?? activeTheme?.themeId ?? 'default',
        name:         dto.name ?? (data.name as string) ?? 'Imported Preset',
        description:  data.description as string | undefined,
        tag:          data.tag as string | undefined,
        type:         PresetType.CUSTOM,
        config:       data.config as any,
        themeVersion: (data.themeVersion as string) ?? '1.0.0',
      },
    });

    await this.cache.del(CACHE_KEYS.presetList(storeId));
    return preset;
  }

  // ── Compare ───────────────────────────────────────────────────────────────────

  async comparePresets(
    storeId:   string,
    presetIdA: string,
    presetIdB: string,
  ): Promise<PresetDiff[]> {
    const [presetA, presetB] = await Promise.all([
      this.getPreset(storeId, presetIdA),
      this.getPreset(storeId, presetIdB),
    ]);

    return this.deepDiff(
      presetA.config as Record<string, unknown>,
      presetB.config as Record<string, unknown>,
    );
  }

  // ── Private helpers ───────────────────────────────────────────────────────────

  private requireMutable(preset: { type: PresetType; storeId: string | null }) {
    if (preset.type === PresetType.SYSTEM || preset.type === PresetType.MARKETPLACE) {
      throw new ForbiddenException('System and Marketplace presets cannot be modified or deleted.');
    }
    if (!preset.storeId) {
      throw new ForbiddenException('Cannot modify a global preset.');
    }
  }

  private majorVersion(version: string): number {
    return parseInt(version.split('.')[0] ?? '0', 10);
  }

  /** Recursive flat diff — returns array of { field, before, after } for every changed leaf. */
  private deepDiff(
    a: Record<string, unknown>,
    b: Record<string, unknown>,
    prefix = '',
  ): PresetDiff[] {
    const diffs: PresetDiff[] = [];
    const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);

    for (const key of allKeys) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      const valA    = a[key];
      const valB    = b[key];

      if (
        valA !== null && typeof valA === 'object' && !Array.isArray(valA) &&
        valB !== null && typeof valB === 'object' && !Array.isArray(valB)
      ) {
        diffs.push(
          ...this.deepDiff(
            valA as Record<string, unknown>,
            valB as Record<string, unknown>,
            fullKey,
          ),
        );
      } else if (JSON.stringify(valA) !== JSON.stringify(valB)) {
        diffs.push({ field: fullKey, before: valA, after: valB });
      }
    }

    return diffs;
  }
}
