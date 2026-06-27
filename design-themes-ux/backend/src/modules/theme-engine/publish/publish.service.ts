import {
  Injectable, Logger, BadRequestException, NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CacheService }  from '@/shared/cache/cache.service';
import { CdnService }    from '@/shared/cdn/cdn.service';
import { CACHE_KEYS }    from '@/shared/cache/cache.constants';
import { ConfigStatus }  from '@prisma/client';

export interface PublishResult {
  version:     number;
  publishedAt: string;
  snapshotId:  string | null;
  themeId:     string;
}

@Injectable()
export class PublishService {
  private readonly logger = new Logger(PublishService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache:  CacheService,
    private readonly cdn:    CdnService,
  ) {}

  /**
   * Atomic publish pipeline — now themeId-scoped.
   *
   * Steps:
   *   1. Load draft configs for (storeId, themeId).
   *   2. Validate drafts are complete.
   *   3. Transaction:
   *      a. Auto-snapshot current published state.
   *      b. Upsert PUBLISHED ThemeConfig, HeaderConfig, FooterConfig.
   *      c. Promote draft ThemePageSections → published for this themeId.
   *   4. Invalidate Redis for (storeId, themeId).
   *   5. CDN purge (async, non-blocking).
   */
  async publish(storeId: string, themeId: string): Promise<PublishResult> {
    // ── 1. Load drafts ────────────────────────────────────────────────────────
    let [draftTheme, draftHeader, draftFooter] = await Promise.all([
      // Primary: exact (storeId, themeId) match
      this.prisma.themeConfig.findUnique({
        where: { storeId_themeId_status: { storeId, themeId, status: ConfigStatus.DRAFT } },
      }),
      this.prisma.headerConfig.findUnique({
        where: { storeId_status: { storeId, status: ConfigStatus.DRAFT } },
      }),
      this.prisma.footerConfig.findUnique({
        where: { storeId_status: { storeId, status: ConfigStatus.DRAFT } },
      }),
    ]);

    // Fallback: if no draft found for the resolved themeId, look for ANY draft for this store.
    // This handles the common case where the theme config was created with a different themeId
    // before StoreTheme.isActive was set (e.g., themeId='dawn' but resolver returned 'default').
    if (!draftTheme) {
      draftTheme = await this.prisma.themeConfig.findFirst({
        where:   { storeId, status: ConfigStatus.DRAFT },
        orderBy: { updatedAt: 'desc' },
      });
      if (draftTheme) {
        // Align themeId to what's actually in the DB
        this.logger.warn(
          `PublishService: resolved themeId "${themeId}" had no draft; ` +
          `falling back to existing draft with themeId "${draftTheme.themeId}".`,
        );
      }
    }

    if (!draftTheme) {
      throw new BadRequestException(
        'No draft theme config found. Open Theme Settings and save at least once before publishing.',
      );
    }

    // Use the actual themeId from the found draft row (may differ from the resolved one)
    const effectiveThemeId = (draftTheme as any).themeId ?? themeId;

    // ── 2. Validate ───────────────────────────────────────────────────────────
    this.validateThemeDraft(draftTheme.config as Record<string, any>);
    if (draftHeader) this.validateHeaderDraft(draftHeader.zones as any[]);
    if (draftFooter) this.validateFooterDraft(draftFooter.columns as any[]);

    // ── 3. Transaction ────────────────────────────────────────────────────────
    let snapshotId: string | null = null;
    let newVersion = 1;

    // Use effectiveThemeId (from the actual DB row) for all subsequent operations
    const tid = effectiveThemeId;

    const result = await this.prisma.$transaction(async (tx) => {
      // a. Auto-snapshot current published state
      const [pubTheme, pubHeader, pubFooter] = await Promise.all([
        tx.themeConfig.findUnique({
          where: { storeId_themeId_status: { storeId, themeId: tid, status: ConfigStatus.PUBLISHED } },
        }),
        tx.headerConfig.findUnique({
          where: { storeId_status: { storeId, status: ConfigStatus.PUBLISHED } },
        }),
        tx.footerConfig.findUnique({
          where: { storeId_status: { storeId, status: ConfigStatus.PUBLISHED } },
        }),
      ]);

      if (pubTheme) {
        newVersion = pubTheme.version + 1;

        const themeRow = await tx.theme.findUnique({
          where:  { id: tid },
          select: { version: true },
        });

        const snapshot = await tx.themePreset.create({
          data: {
            storeId,
            themeId:      tid,
            name:         `Auto-snapshot v${pubTheme.version}`,
            type:         'AUTO_SNAPSHOT',
            config:       { theme: pubTheme.config, header: pubHeader?.zones ?? null, footer: pubFooter?.columns ?? null, themeId: tid },
            themeVersion: themeRow?.version ?? '1.0.0',
            expiresAt:    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        });
        snapshotId = snapshot.id;
      }

      // b. Upsert PUBLISHED ThemeConfig
      await tx.themeConfig.upsert({
        where:  { storeId_themeId_status: { storeId, themeId: tid, status: ConfigStatus.PUBLISHED } },
        create: { storeId, themeId: tid, status: ConfigStatus.PUBLISHED, config: draftTheme.config, version: newVersion },
        update: { config: draftTheme.config, version: newVersion },
      });

      if (draftHeader) {
        await tx.headerConfig.upsert({
          where:  { storeId_status: { storeId, status: ConfigStatus.PUBLISHED } },
          create: { storeId, status: ConfigStatus.PUBLISHED, zones: draftHeader.zones, behavior: draftHeader.behavior },
          update: { zones: draftHeader.zones, behavior: draftHeader.behavior },
        });
      }

      if (draftFooter) {
        await tx.footerConfig.upsert({
          where:  { storeId_status: { storeId, status: ConfigStatus.PUBLISHED } },
          create: { storeId, status: ConfigStatus.PUBLISHED, columns: draftFooter.columns, bottomBar: draftFooter.bottomBar, settings: draftFooter.settings },
          update: { columns: draftFooter.columns, bottomBar: draftFooter.bottomBar, settings: draftFooter.settings },
        });
      }

      // c. Promote draft ThemePageSections — match tid OR null (seed-script rows use 'default')
      const draftSections = await tx.themePageSection.findMany({
        where: { storeId, isDraft: true, OR: [{ themeId: tid }, { themeId: null }, { themeId: 'default' }] },
      });

      if (draftSections.length > 0) {
        const affectedPageIds = [...new Set(draftSections.map((s) => s.pageId))];
        await tx.themePageSection.deleteMany({
          where: { storeId, pageId: { in: affectedPageIds }, isDraft: false },
        });
        await tx.themePageSection.createMany({
          data: draftSections.map(({ id: _id, isDraft: _d, createdAt: _c, updatedAt: _u, ...rest }) => ({
            ...rest, isDraft: false,
          })),
        });
      }

      // d. Promote draft ThemePageBlocks
      const draftBlocks = await tx.themePageBlock.findMany({
        where: { storeId, isDraft: true, OR: [{ themeId: tid }, { themeId: null }, { themeId: 'default' }] },
        select: { id: true, sectionId: true },
      });

      if (draftBlocks.length > 0) {
        const affectedSectionIds = [...new Set(draftBlocks.map((b) => b.sectionId))];
        await tx.themePageBlock.deleteMany({
          where: { sectionId: { in: affectedSectionIds }, storeId, isDraft: false },
        });
        const fullDraftBlocks = await tx.themePageBlock.findMany({
          where: { id: { in: draftBlocks.map((b) => b.id) } },
        });
        await tx.themePageBlock.createMany({
          data: fullDraftBlocks.map(({ id: _id, isDraft: _d, createdAt: _c, updatedAt: _u, ...rest }) => ({
            ...rest, isDraft: false,
          })),
        });
      }

      return { version: newVersion };
    });

    // ── 4. Invalidate Redis ───────────────────────────────────────────────────
    await Promise.all([
      this.cache.invalidatePattern(CACHE_KEYS.storeThemePattern(storeId, tid)),
      this.cache.invalidatePattern(`header:${storeId}:*`),
      this.cache.invalidatePattern(`footer:${storeId}:*`),
      this.cache.del(CACHE_KEYS.presetList(storeId)),
    ]);

    // ── 5. CDN purge ─────────────────────────────────────────────────────────
    this.cdn.purge(storeId).catch((err) =>
      this.logger.error(`CDN purge failed for store ${storeId}: ${err.message}`),
    );

    this.logger.log(
      `Published theme ${tid} for store ${storeId} — version ${result.version}` +
      (snapshotId ? ` (snapshot: ${snapshotId})` : ''),
    );

    return {
      version:     result.version,
      publishedAt: new Date().toISOString(),
      snapshotId,
      themeId:     tid,
    };
  }

  /**
   * Discard draft — reset to last published state for (storeId, themeId).
   */
  async discardDraft(storeId: string, themeId: string): Promise<void> {
    const [pubTheme, pubHeader, pubFooter] = await Promise.all([
      this.prisma.themeConfig.findUnique({
        where: { storeId_themeId_status: { storeId, themeId, status: ConfigStatus.PUBLISHED } },
      }),
      this.prisma.headerConfig.findUnique({
        where: { storeId_status: { storeId, status: ConfigStatus.PUBLISHED } },
      }),
      this.prisma.footerConfig.findUnique({
        where: { storeId_status: { storeId, status: ConfigStatus.PUBLISHED } },
      }),
    ]);

    if (!pubTheme) {
      throw new NotFoundException(
        'No published baseline found. Publish at least once before discarding a draft.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      // Reset ThemeConfig draft
      await tx.themeConfig.upsert({
        where:  { storeId_themeId_status: { storeId, themeId, status: ConfigStatus.DRAFT } },
        create: { storeId, themeId, status: ConfigStatus.DRAFT, config: pubTheme.config, version: 0 },
        update: { config: pubTheme.config },
      });

      if (pubHeader) {
        await tx.headerConfig.upsert({
          where:  { storeId_status: { storeId, status: ConfigStatus.DRAFT } },
          create: { storeId, status: ConfigStatus.DRAFT, zones: pubHeader.zones, behavior: pubHeader.behavior },
          update: { zones: pubHeader.zones, behavior: pubHeader.behavior },
        });
      }

      if (pubFooter) {
        await tx.footerConfig.upsert({
          where:  { storeId_status: { storeId, status: ConfigStatus.DRAFT } },
          create: { storeId, status: ConfigStatus.DRAFT, columns: pubFooter.columns, bottomBar: pubFooter.bottomBar, settings: pubFooter.settings },
          update: { columns: pubFooter.columns, bottomBar: pubFooter.bottomBar, settings: pubFooter.settings },
        });
      }

      // Delete draft sections (cascade FK deletes their blocks automatically)
      await tx.themePageSection.deleteMany({ where: { storeId, themeId, isDraft: true } });

      // Also explicitly delete orphaned draft blocks (blocks whose section may have themeId: null)
      await tx.themePageBlock.deleteMany({
        where: {
          storeId,
          isDraft: true,
          OR: [{ themeId }, { themeId: null }],
        },
      });
    });

    // Invalidate draft cache keys
    await Promise.all([
      this.cache.del(CACHE_KEYS.themeConfig(storeId, themeId, 'draft')),
      this.cache.del(CACHE_KEYS.headerConfig(storeId, 'draft')),
      this.cache.del(CACHE_KEYS.footerConfig(storeId, 'draft')),
      this.cache.invalidatePattern(`page:${storeId}:${themeId}:*:sections:draft`),
      this.cache.invalidatePattern(`section:*:blocks:draft`),   // all block caches
    ]);

    this.logger.log(`Discarded draft for store ${storeId} theme ${themeId}`);
  }

  // ── Private validators ─────────────────────────────────────────────────────

  private validateThemeDraft(config: Record<string, any>): void {
    const required = ['colors', 'typography', 'layout'];
    const missing  = required.filter((k) => !config[k]);
    if (missing.length) {
      throw new BadRequestException(
        `Draft is incomplete — missing required config sections: ${missing.join(', ')}`,
      );
    }
  }

  private validateHeaderDraft(zones: any[]): void {
    if (!Array.isArray(zones)) return;
    const zone2 = zones.find((z) => z.id === 'zone2');
    if (zone2 && (!zone2.components || zone2.components.length === 0)) {
      throw new BadRequestException(
        'Header Zone 2 (main row) must have at least one component before publishing.',
      );
    }
  }

  private validateFooterDraft(columns: any[]): void {
    if (!Array.isArray(columns) || columns.length === 0) return;
    const total = columns.reduce((sum, col) => sum + (col.widthPercent ?? 0), 0);
    if (total !== 100) {
      throw new BadRequestException(
        `Footer column widths must sum to 100% (currently ${total}%).`,
      );
    }
  }
}
