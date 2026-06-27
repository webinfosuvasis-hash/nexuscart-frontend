import {
  Injectable, Logger, NotFoundException,
  BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CacheService }  from '@/shared/cache/cache.service';
import { CACHE_KEYS, CACHE_TTL } from '@/shared/cache/cache.constants';
import { SectionCategory, SectionTier } from '@prisma/client';
import { AddPageSectionDto }     from './dto/add-page-section.dto';
import { UpdatePageSectionDto }  from './dto/update-page-section.dto';
import { UpsertPageSectionsDto } from './dto/upsert-page-sections.dto';
import { AddBlockDto }            from './dto/add-block.dto';
import { UpdateBlockDto }         from './dto/update-block.dto';
import { ReorderBlocksDto }       from './dto/reorder-blocks.dto';
import { BlockSettingsSanitizer } from './block-settings-sanitizer';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DefaultBlock {
  type:      string;
  settings:  Record<string, any>;
  sortOrder: number;
}

@Injectable()
export class SectionsService {
  private readonly logger = new Logger(SectionsService.name);

  constructor(
    private readonly prisma:     PrismaService,
    private readonly cache:      CacheService,
    private readonly sanitizer:  BlockSettingsSanitizer,
  ) {}

  // ════════════════════════════════════════════════════════════════════════════
  // Section Definition Catalogue
  // ════════════════════════════════════════════════════════════════════════════

  async listSections(
    storeId: string,
    filters: { category?: SectionCategory; tier?: SectionTier; search?: string } = {},
  ) {
    const builtInKey = CACHE_KEYS.sectionDefs();
    const customKey  = CACHE_KEYS.sectionDefsCustom(storeId);

    let [builtIn, custom] = await Promise.all([
      this.cache.get<any[]>(builtInKey),
      this.cache.get<any[]>(customKey),
    ]);

    if (!builtIn) {
      builtIn = await this.prisma.sectionDefinition.findMany({
        where:   { storeId: null, isActive: true },
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
      });
      await this.cache.set(builtInKey, builtIn, CACHE_TTL.PAGE_SECTIONS);
    }

    if (!custom) {
      custom = await this.prisma.sectionDefinition.findMany({
        where:   { storeId, isActive: true },
        orderBy: { createdAt: 'desc' },
      });
      await this.cache.set(customKey, custom, CACHE_TTL.PAGE_SECTIONS);
    }

    let sections = [...builtIn, ...custom];
    if (filters.category) sections = sections.filter((s) => s.category === filters.category);
    if (filters.tier)     sections = sections.filter((s) => s.tier     === filters.tier);
    if (filters.search) {
      const q = filters.search.toLowerCase();
      sections = sections.filter(
        (s) => s.name.toLowerCase().includes(q) || s.description?.toLowerCase().includes(q),
      );
    }
    return sections;
  }

  async getSectionDefinition(id: string) {
    const def = await this.prisma.sectionDefinition.findUnique({ where: { id } });
    if (!def || !def.isActive) throw new NotFoundException('Section definition not found');
    return def;
  }

  async registerCustomSection(
    storeId: string,
    data: { handle: string; name: string; description?: string; settingsSchema: unknown[]; previewImage?: string },
  ) {
    const existing = await this.prisma.sectionDefinition.findMany({
      where:   { storeId, id: { startsWith: `custom:${data.handle}` } },
      orderBy: { createdAt: 'desc' },
      take: 1,
    });

    const version = existing.length > 0 ? this.bumpVersion(existing[0].version) : '1.0.0';
    const id      = `custom:${data.handle}@v${version.split('.')[0]}`;

    const def = await this.prisma.sectionDefinition.create({
      data: {
        id,
        storeId,
        name:              data.name,
        description:       data.description,
        category:          SectionCategory.CUSTOM,
        tier:              SectionTier.CUSTOM,
        compatibleThemes:  ['*'],
        settingsSchema:    data.settingsSchema as any,
        previewImage:      data.previewImage,
        version,
        isBuiltIn:         false,
        isActive:          true,
        allowedBlockTypes: ['*'],
        defaultBlocks:     [],
      },
    });

    await this.cache.del(CACHE_KEYS.sectionDefsCustom(storeId));
    this.logger.log(`Registered custom section "${id}" for store ${storeId}`);
    return def;
  }

  async deleteCustomSection(storeId: string, sectionId: string) {
    const def = await this.prisma.sectionDefinition.findFirst({ where: { id: sectionId, storeId } });
    if (!def) throw new NotFoundException('Custom section not found');

    const inUse = await this.prisma.themePageSection.count({ where: { sectionDefId: sectionId, storeId } });
    if (inUse > 0) {
      const pages = await this.prisma.themePageSection.findMany({
        where: { sectionDefId: sectionId, storeId }, select: { pageId: true }, distinct: ['pageId'],
      });
      throw new ForbiddenException(
        `Cannot delete: section in use on page(s): ${pages.map((p) => p.pageId).join(', ')}`,
      );
    }

    await this.prisma.sectionDefinition.update({ where: { id: sectionId }, data: { isActive: false } });
    await this.cache.del(CACHE_KEYS.sectionDefsCustom(storeId));
    return { message: 'Section deactivated' };
  }

  // ════════════════════════════════════════════════════════════════════════════
  // Page Sections (with embedded blocks — Sprint 4.5.1)
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Returns ordered sections for a page.
   * CHANGED in Sprint 4.5.1: each section now includes its blocks ordered by sortOrder.
   * The blocks[] array matches the section's isDraft state.
   */
  async getPageSections(storeId: string, themeId: string, pageId: string, isDraft = true) {
    const cacheKey = CACHE_KEYS.pageSections(storeId, themeId, pageId, isDraft);
    const cached   = await this.cache.get<any[]>(cacheKey);
    if (cached) return cached;

    const sections = await this.prisma.themePageSection.findMany({
      where: {
        storeId,
        pageId,
        isDraft,
        OR: [{ themeId }, { themeId: null }],
      },
      include: {
        // ── NEW in Sprint 4.5.1: embed blocks ──────────────────────────────
        blocks: {
          where:   { isDraft },          // draft sections → draft blocks; published → published
          orderBy: { sortOrder: 'asc' },
        },
        definition: {
          select: {
            name:              true,
            icon:              true,
            category:          true,
            settingsSchema:    true,
            allowedBlockTypes: true,
            defaultBlocks:     true,
          },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });

    await this.cache.set(cacheKey, sections, CACHE_TTL.PAGE_SECTIONS);
    return sections;
  }

  async upsertPageSections(storeId: string, themeId: string, pageId: string, dto: UpsertPageSectionsDto) {
    const defIds = [...new Set(dto.sections.map((s) => s.sectionDefId))];
    const defs   = await this.prisma.sectionDefinition.findMany({
      where: { id: { in: defIds }, isActive: true },
    });
    const missing = defIds.filter((id) => !defs.find((d) => d.id === id));
    if (missing.length) {
      throw new BadRequestException(`Unknown section definition IDs: ${missing.join(', ')}`);
    }

    const newSectionIds: string[] = [];

    await this.prisma.$transaction(async (tx) => {
      // Delete existing draft sections (cascade deletes their blocks)
      await tx.themePageSection.deleteMany({ where: { storeId, themeId, pageId, isDraft: true } });

      if (dto.sections.length > 0) {
        for (let i = 0; i < dto.sections.length; i++) {
          const s = dto.sections[i];
          const section = await tx.themePageSection.create({
            data: {
              storeId,
              themeId,
              pageId,
              sectionDefId: s.sectionDefId,
              label:        (s as any).label ?? null,
              settings:     (s.settings ?? {}) as any,
              sortOrder:    s.sortOrder ?? (i + 1),
              isVisible:    s.isVisible ?? true,
              isDraft:      true,
            },
          });
          newSectionIds.push(section.id);
        }
      }
    });

    // Create blocks for each section — use provided blocks or fall back to definition defaults
    for (let i = 0; i < dto.sections.length; i++) {
      const s         = dto.sections[i];
      const sectionId = newSectionIds[i];
      if (!sectionId) continue;

      if (s.blocks && s.blocks.length > 0) {
        // Phase 2: use editor-provided blocks — sanitize rich text before writing
        await this.prisma.themePageBlock.createMany({
          data: s.blocks.map((b, bi) => ({
            storeId,
            themeId,
            sectionId,
            type:      b.type,
            settings:  this.sanitizer.sanitize(b.type, (b.settings ?? {}) as Record<string, unknown>) as any,
            sortOrder: b.sortOrder ?? ((bi + 1) * 1.0),
            isVisible: b.isVisible ?? true,
            isDraft:   true,
          })),
        });
      } else {
        // Fall back to seeding from SectionDefinition.defaultBlocks
        await this.seedDefaultBlocks(sectionId, s.sectionDefId, true, themeId, storeId);
      }
    }

    await this.invalidatePageSectionsCache(storeId, themeId, pageId, true);
    return this.getPageSections(storeId, themeId, pageId, true);
  }

  async addPageSection(storeId: string, themeId: string, pageId: string, dto: AddPageSectionDto) {
    await this.getSectionDefinition(dto.sectionDefId);

    const maxOrder = await this.prisma.themePageSection.aggregate({
      where: { storeId, themeId, pageId, isDraft: true },
      _max:  { sortOrder: true },
    });

    const section = await this.prisma.themePageSection.create({
      data: {
        storeId,
        themeId,
        pageId,
        sectionDefId: dto.sectionDefId,
        settings:     (dto.settings ?? {}) as any,
        sortOrder:    dto.sortOrder ?? (Number(maxOrder._max.sortOrder ?? -1) + 1.0),
        isVisible:    dto.isVisible ?? true,
        isDraft:      true,
      },
    });

    // Seed default blocks immediately so the section is not empty
    await this.seedDefaultBlocks(section.id, dto.sectionDefId, true, themeId, storeId);

    await this.invalidatePageSectionsCache(storeId, themeId, pageId, true);

    // Return with blocks included
    const withBlocks = await this.prisma.themePageSection.findUnique({
      where:   { id: section.id },
      include: {
        blocks:     { where: { isDraft: true }, orderBy: { sortOrder: 'asc' } },
        definition: { select: { name: true, icon: true, category: true, allowedBlockTypes: true } },
      },
    });
    return withBlocks;
  }

  async updatePageSection(
    storeId: string, themeId: string, pageId: string, sectionId: string, dto: UpdatePageSectionDto,
  ) {
    const existing = await this.prisma.themePageSection.findFirst({
      where: { id: sectionId, storeId, pageId },
    });
    if (!existing) throw new NotFoundException('Page section not found');

    const updated = await this.prisma.themePageSection.update({
      where: { id: sectionId },
      data: {
        ...(dto.settings  !== undefined && { settings:  dto.settings as any }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        ...(dto.isVisible !== undefined && { isVisible: dto.isVisible }),
      },
    });

    const tid = existing.themeId ?? themeId;
    await this.invalidatePageSectionsCache(storeId, tid, pageId, existing.isDraft);
    return updated;
  }

  async deletePageSection(storeId: string, themeId: string, pageId: string, sectionId: string) {
    const existing = await this.prisma.themePageSection.findFirst({
      where: { id: sectionId, storeId, pageId },
    });
    if (!existing) throw new NotFoundException('Page section not found');

    // Cascade to blocks is handled by FK ON DELETE CASCADE in schema
    await this.prisma.themePageSection.delete({ where: { id: sectionId } });

    const tid = existing.themeId ?? themeId;
    await this.invalidatePageSectionsCache(storeId, tid, pageId, existing.isDraft);
    return { message: 'Section removed from page' };
  }

  // ════════════════════════════════════════════════════════════════════════════
  // Block CRUD (Sprint 4.5.1)
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Returns all blocks for a section, ordered by sortOrder.
   * Block's isDraft must match the containing section's isDraft.
   */
  async getBlocksForSection(storeId: string, sectionId: string, isDraft: boolean) {
    const cacheKey = CACHE_KEYS.sectionBlocks(sectionId, isDraft);
    const cached   = await this.cache.get<any[]>(cacheKey);
    if (cached) return cached;

    const blocks = await this.prisma.themePageBlock.findMany({
      where:   { sectionId, storeId, isDraft },
      orderBy: { sortOrder: 'asc' },
    });

    await this.cache.set(cacheKey, blocks, CACHE_TTL.PAGE_SECTIONS);
    return blocks;
  }

  /**
   * Add a block to a section.
   * Validates the block type against:
   *   1. BlockDefinition.allowedInSections (the block is valid for this kind of section)
   *   2. SectionDefinition.allowedBlockTypes (the section accepts this block type)
   */
  async addBlock(storeId: string, themeId: string, sectionId: string, dto: AddBlockDto) {
    const section = await this.prisma.themePageSection.findFirst({
      where:   { id: sectionId, storeId },
      include: { definition: { select: { id: true, allowedBlockTypes: true } } },
    });
    if (!section) throw new NotFoundException('Section not found');

    // Validate block type is allowed in this section
    await this.validateBlockTypeForSection(dto.type, section.definition.id, section.definition.allowedBlockTypes as any);

    const maxOrder = await this.prisma.themePageBlock.aggregate({
      where: { sectionId, isDraft: section.isDraft },
      _max:  { sortOrder: true },
    });

    const block = await this.prisma.themePageBlock.create({
      data: {
        storeId,
        themeId:   section.themeId ?? themeId,
        sectionId,
        type:      dto.type,
        // Sprint 6: sanitize rich text fields before writing to database
        settings:  this.sanitizer.sanitize(dto.type, (dto.settings ?? {}) as Record<string, unknown>) as any,
        sortOrder: dto.sortOrder ?? (Number(maxOrder._max.sortOrder ?? -1) + 1.0),
        isVisible: dto.isVisible ?? true,
        isDraft:   section.isDraft,
      },
    });

    await this.invalidateBlockCaches(storeId, section.themeId ?? themeId, section.pageId, sectionId, section.isDraft);
    return block;
  }

  /**
   * Update a block's settings, sortOrder, or visibility.
   * Settings are REPLACED (not merged) — caller must send the full settings object.
   */
  async updateBlock(
    storeId: string, sectionId: string, blockId: string, dto: UpdateBlockDto,
  ) {
    const block = await this.prisma.themePageBlock.findFirst({
      where: { id: blockId, sectionId, storeId },
    });
    if (!block) throw new NotFoundException('Block not found');

    const section = await this.prisma.themePageSection.findUnique({
      where:  { id: sectionId },
      select: { pageId: true, themeId: true, isDraft: true },
    });

    const updated = await this.prisma.themePageBlock.update({
      where: { id: blockId },
      data: {
        // Sprint 6: sanitize rich text fields on every settings update
        ...(dto.settings  !== undefined && {
          settings: this.sanitizer.sanitize(block.type, dto.settings as Record<string, unknown>) as any,
        }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        ...(dto.isVisible !== undefined && { isVisible: dto.isVisible }),
      },
    });

    if (section) {
      await this.invalidateBlockCaches(storeId, section.themeId ?? block.themeId ?? '', section.pageId, sectionId, section.isDraft);
    }
    return updated;
  }

  /**
   * Delete a block. Throws ForbiddenException if the block type is marked isRequired
   * in its BlockDefinition (e.g., 'logo' in header cannot be deleted).
   */
  async deleteBlock(storeId: string, sectionId: string, blockId: string) {
    const block = await this.prisma.themePageBlock.findFirst({
      where: { id: blockId, sectionId, storeId },
    });
    if (!block) throw new NotFoundException('Block not found');

    // Check if this block type is required
    const blockDef = await (this.prisma as any).blockDefinition.findUnique({
      where:  { type: block.type },
      select: { isRequired: true },
    });
    if (blockDef?.isRequired) {
      throw new ForbiddenException(
        `Block type "${block.type}" is required in this section and cannot be deleted.`,
      );
    }

    const section = await this.prisma.themePageSection.findUnique({
      where:  { id: sectionId },
      select: { pageId: true, themeId: true, isDraft: true },
    });

    await this.prisma.themePageBlock.delete({ where: { id: blockId } });

    if (section) {
      await this.invalidateBlockCaches(storeId, section.themeId ?? block.themeId ?? '', section.pageId, sectionId, section.isDraft);
    }
    return { message: 'Block removed from section' };
  }

  /**
   * Batch reorder blocks within a section.
   * Assigns sortOrder 1.0, 2.0, 3.0... based on the submitted orderedIds array.
   * All IDs must belong to this sectionId.
   */
  async reorderBlocks(storeId: string, sectionId: string, dto: ReorderBlocksDto) {
    // Validate all IDs belong to this section
    const existing = await this.prisma.themePageBlock.findMany({
      where: { sectionId, storeId },
      select: { id: true },
    });
    const existingIds = new Set(existing.map((b) => b.id));
    const invalid     = dto.orderedIds.filter((id) => !existingIds.has(id));
    if (invalid.length) {
      throw new BadRequestException(`Block IDs not found in section: ${invalid.join(', ')}`);
    }

    // Assign fractional sortOrder in submitted order
    await this.prisma.$transaction(
      dto.orderedIds.map((blockId, index) =>
        this.prisma.themePageBlock.update({
          where: { id: blockId },
          data:  { sortOrder: (index + 1) * 1.0 },
        }),
      ),
    );

    const section = await this.prisma.themePageSection.findUnique({
      where:  { id: sectionId },
      select: { pageId: true, themeId: true, isDraft: true },
    });

    if (section) {
      await this.invalidateBlockCaches(storeId, section.themeId ?? '', section.pageId, sectionId, section.isDraft);
    }

    return this.getBlocksForSection(storeId, sectionId, section?.isDraft ?? true);
  }

  /**
   * Seed default blocks for a section from SectionDefinition.defaultBlocks.
   * Idempotent — does nothing if the section already has blocks.
   * Called automatically by addPageSection() and the backfill script.
   */
  async seedDefaultBlocks(
    sectionId:    string,
    sectionDefId: string,
    isDraft:      boolean,
    themeId:      string | null,
    storeId:      string,
  ): Promise<void> {
    // Guard: if section already has blocks, skip (idempotent)
    const existing = await this.prisma.themePageBlock.count({ where: { sectionId } });
    if (existing > 0) return;

    // Load defaultBlocks from SectionDefinition
    const def = await this.prisma.sectionDefinition.findUnique({
      where:  { id: sectionDefId },
      select: { defaultBlocks: true },
    });

    const defaultBlocks = (def?.defaultBlocks as unknown) as DefaultBlock[] | null;
    if (!defaultBlocks || defaultBlocks.length === 0) return;

    await this.prisma.themePageBlock.createMany({
      data: defaultBlocks.map((b) => ({
        storeId,
        themeId,
        sectionId,
        type:      b.type,
        settings:  (b.settings ?? {}) as any,
        sortOrder: b.sortOrder ?? 1.0,
        isVisible: true,
        isDraft,
      })),
    });

    this.logger.debug(
      `Seeded ${defaultBlocks.length} default blocks for section ${sectionId} (type: ${sectionDefId})`,
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // Private helpers
  // ════════════════════════════════════════════════════════════════════════════

  private async validateBlockTypeForSection(
    blockType:         string,
    sectionType:       string,
    allowedBlockTypes: string[] | null | undefined,
  ): Promise<void> {
    // Check SectionDefinition.allowedBlockTypes
    if (allowedBlockTypes && !allowedBlockTypes.includes('*')) {
      if (!allowedBlockTypes.includes(blockType)) {
        throw new BadRequestException(
          `Block type "${blockType}" is not allowed in section type "${sectionType}". ` +
          `Allowed: ${allowedBlockTypes.join(', ')}`,
        );
      }
    }

    // Check BlockDefinition.allowedInSections (if the block type exists in the catalogue)
    const blockDef = await (this.prisma as any).blockDefinition.findUnique({
      where:  { type: blockType },
      select: { allowedInSections: true },
    });

    if (blockDef) {
      const allowed = blockDef.allowedInSections as string[];
      if (!allowed.includes('*') && !allowed.includes(sectionType)) {
        throw new BadRequestException(
          `Block type "${blockType}" cannot be added to section type "${sectionType}".`,
        );
      }
    }
    // If BlockDefinition doesn't exist, allow the block (custom/unknown types pass through)
  }

  private async invalidateBlockCaches(
    storeId:   string,
    themeId:   string,
    pageId:    string,
    sectionId: string,
    isDraft:   boolean,
  ): Promise<void> {
    await Promise.all([
      // Invalidate embedded page sections cache (contains blocks)
      this.cache.del(CACHE_KEYS.pageSections(storeId, themeId, pageId, isDraft)),
      this.cache.del(CACHE_KEYS.pageSectionsLegacy(storeId, pageId, isDraft)),
      // Invalidate standalone block cache
      this.cache.del(CACHE_KEYS.sectionBlocks(sectionId, isDraft)),
    ]);
  }

  private async invalidatePageSectionsCache(
    storeId:  string,
    themeId:  string,
    pageId:   string,
    isDraft:  boolean,
  ): Promise<void> {
    await Promise.all([
      this.cache.del(CACHE_KEYS.pageSections(storeId, themeId, pageId, isDraft)),
      this.cache.del(CACHE_KEYS.pageSectionsLegacy(storeId, pageId, isDraft)),
    ]);
  }

  private bumpVersion(current: string): string {
    const [major = 1] = current.split('.').map(Number);
    return `${major + 1}.0.0`;
  }
}
