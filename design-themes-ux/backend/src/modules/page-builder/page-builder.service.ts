import {
  Injectable, NotFoundException, ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { BuilderEventsService } from './page-builder-events.service';
import { UpdateSectionDto } from './dto/update-section.dto';
import { ReorderSectionsDto } from './dto/reorder-sections.dto';

// ─── Aurus homepage seed data ─────────────────────────────────────────────────
// Mirrors AURUS_HOMEPAGE_SECTIONS in admin/src/admin/HomepageBuilder/SectionRegistry.ts.
// Any structural change here must be kept in sync with the frontend registry.

const AURUS_DEFAULT_SECTIONS: Array<{
  sectionType: string;
  label: string;
  sortOrder: number;
  isEnabled: boolean;
  isLocked: boolean;
}> = [
  { sectionType: 'hero_banner',        label: 'Hero Banner Carousel',   sortOrder: 1,  isEnabled: true,  isLocked: false },
  { sectionType: 'featured_products',  label: 'Featured Products',      sortOrder: 2,  isEnabled: true,  isLocked: false },
  { sectionType: 'campaign_grid',      label: 'Campaign Grid',          sortOrder: 3,  isEnabled: true,  isLocked: false },
  { sectionType: 'category_discovery', label: 'Category Discovery',     sortOrder: 4,  isEnabled: true,  isLocked: false },
  { sectionType: 'category_icons',     label: 'Category Icons',         sortOrder: 5,  isEnabled: true,  isLocked: false },
  { sectionType: 'trust_badges',       label: 'Trust Badge Bar',        sortOrder: 6,  isEnabled: true,  isLocked: true  },
  { sectionType: 'collections',        label: 'Collections',            sortOrder: 7,  isEnabled: true,  isLocked: false },
  { sectionType: 'bridal_section',     label: 'Bridal Section',         sortOrder: 8,  isEnabled: true,  isLocked: false },
  { sectionType: 'editorial_banners',  label: 'Editorial Banners',      sortOrder: 9,  isEnabled: true,  isLocked: false },
  { sectionType: 'store_locator',      label: 'Store Locator',          sortOrder: 10, isEnabled: true,  isLocked: false },
  { sectionType: 'try_at_home',        label: 'Try at Home',            sortOrder: 11, isEnabled: true,  isLocked: false },
  { sectionType: 'video_call',         label: 'Video Call',             sortOrder: 12, isEnabled: true,  isLocked: false },
  { sectionType: 'gift_registry',      label: 'Gift Registry',          sortOrder: 13, isEnabled: true,  isLocked: false },
  { sectionType: 'promotional_cards',  label: 'Promotional Cards',      sortOrder: 14, isEnabled: true,  isLocked: false },
  { sectionType: 'expert_help',        label: 'Expert Help',            sortOrder: 15, isEnabled: true,  isLocked: false },
  { sectionType: 'social_ugc',         label: 'Social / UGC',           sortOrder: 16, isEnabled: true,  isLocked: false },
  { sectionType: 'newsletter',         label: 'Newsletter',             sortOrder: 17, isEnabled: true,  isLocked: false },
];

// ─── Select shapes ────────────────────────────────────────────────────────────

const SECTION_SELECT = {
  id:          true,
  sectionType: true,
  label:       true,
  sortOrder:   true,
  isEnabled:   true,
  isLocked:    true,
  status:      true,
  config:      true,
  goLiveAt:    true,
  expireAt:    true,
  updatedBy:   true,
  createdAt:   true,
  updatedAt:   true,
} as const;

const PAGE_WITH_SECTIONS = {
  id:          true,
  pageType:    true,
  slug:        true,
  name:        true,
  status:      true,
  version:     true,
  publishedAt: true,
  createdAt:   true,
  updatedAt:   true,
  sections: {
    select:  SECTION_SELECT,
    orderBy: { sortOrder: 'asc' as const },
  },
} as const;

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class PageBuilderService {
  constructor(
    private readonly prisma:  PrismaService,
    private readonly events:  BuilderEventsService,
  ) {}

  // ── Homepage ────────────────────────────────────────────────────────────────

  /**
   * Returns the store's homepage + sections in sortOrder.
   * Auto-seeds with Aurus defaults on first call (idempotent).
   */
  async getHomepage(storeId: string) {
    const existing = await this.prisma.builderPage.findUnique({
      where: { storeId_pageType_slug: { storeId, pageType: 'home', slug: 'home' } },
      select: PAGE_WITH_SECTIONS,
    });
    return existing ?? this.seedHomepage(storeId);
  }

  /**
   * Idempotent seed: creates the page + 17 default Aurus sections.
   * Safe to call repeatedly — skips section creation if rows already exist.
   */
  async seedHomepage(storeId: string) {
    const page = await this.prisma.builderPage.upsert({
      where: { storeId_pageType_slug: { storeId, pageType: 'home', slug: 'home' } },
      update: {},
      create: { storeId, pageType: 'home', slug: 'home', name: 'Homepage', status: 'LIVE' },
    });

    const existingCount = await this.prisma.builderSection.count({
      where: { pageId: page.id, storeId },
    });

    if (existingCount === 0) {
      await this.prisma.builderSection.createMany({
        data: AURUS_DEFAULT_SECTIONS.map(s => ({
          storeId,
          pageId:      page.id,
          sectionType: s.sectionType,
          label:       s.label,
          sortOrder:   s.sortOrder,
          isEnabled:   s.isEnabled,
          isLocked:    s.isLocked,
          status:      'LIVE',
          config:      {}, // Populated per section in Phase 2+
        })),
      });

      this.events.onPageSeeded({
        storeId,
        pageId:       page.id,
        pageType:     'home',
        sectionCount: AURUS_DEFAULT_SECTIONS.length,
      });
    }

    return this.prisma.builderPage.findUniqueOrThrow({
      where:  { id: page.id },
      select: PAGE_WITH_SECTIONS,
    });
  }

  // ── Generic page operations ──────────────────────────────────────────────────

  async listPages(storeId: string) {
    return this.prisma.builderPage.findMany({
      where:   { storeId },
      select:  {
        id: true, pageType: true, slug: true, name: true,
        status: true, version: true, publishedAt: true, updatedAt: true,
        _count: { select: { sections: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getPage(storeId: string, pageType: string, slug: string) {
    const page = await this.prisma.builderPage.findUnique({
      where:  { storeId_pageType_slug: { storeId, pageType, slug } },
      select: PAGE_WITH_SECTIONS,
    });
    if (!page) throw new NotFoundException(`Page "${pageType}/${slug}" not found for this store`);
    return page;
  }

  // ── Section read ─────────────────────────────────────────────────────────────

  /**
   * Get a single section by ID — used by section editors to load current config.
   */
  async getSection(storeId: string, sectionId: string) {
    const section = await this.prisma.builderSection.findFirst({
      where:  { id: sectionId, storeId },
      select: SECTION_SELECT,
    });
    if (!section) throw new NotFoundException(`Section not found`);
    return section;
  }

  // ── Section mutations ────────────────────────────────────────────────────────

  /**
   * Update a section's label, status, config, goLiveAt, or expireAt.
   * Records the userId of the modifier in `updatedBy`.
   * Emits a builder event for future caching/webhook hooks.
   */
  async updateSection(
    storeId:   string,
    sectionId: string,
    dto:       UpdateSectionDto,
    userId?:   string,
  ) {
    await this.assertSectionOwnership(storeId, sectionId);

    const updated = await this.prisma.builderSection.update({
      where: { id: sectionId },
      data:  {
        ...(dto.label     !== undefined && { label: dto.label }),
        ...(dto.status    !== undefined && { status: dto.status }),
        ...(dto.isEnabled !== undefined && { isEnabled: dto.isEnabled }),
        ...(dto.config    !== undefined && { config: dto.config as object }),
        ...(dto.goLiveAt  !== undefined && { goLiveAt: dto.goLiveAt  ? new Date(dto.goLiveAt)  : null }),
        ...(dto.expireAt  !== undefined && { expireAt: dto.expireAt  ? new Date(dto.expireAt)  : null }),
        ...(userId && { updatedBy: userId }),
      },
      select: SECTION_SELECT,
    });

    // Determine which field changed for the event payload
    const field = dto.config    !== undefined ? 'config'    :
                  dto.status    !== undefined ? 'status'    :
                  dto.isEnabled !== undefined ? 'isEnabled' :
                  dto.label     !== undefined ? 'label'     : 'config';

    this.events.onSectionUpdated({
      storeId,
      pageId:      updated.id, // section carries pageId via relation; use section.id for now
      sectionId,
      sectionType: updated.sectionType,
      field,
      userId,
    });

    return updated;
  }

  /** Toggle isEnabled for a section (visibility on/off). */
  async toggleSection(storeId: string, sectionId: string, userId?: string) {
    const section = await this.assertSectionOwnership(storeId, sectionId);

    const updated = await this.prisma.builderSection.update({
      where:  { id: sectionId },
      data:   {
        isEnabled: !section.isEnabled,
        ...(userId && { updatedBy: userId }),
      },
      select: SECTION_SELECT,
    });

    this.events.onSectionUpdated({
      storeId,
      pageId:      sectionId,
      sectionId,
      sectionType: updated.sectionType,
      field:       'isEnabled',
      userId,
    });

    return updated;
  }

  /**
   * Bulk reorder sections — atomic transaction.
   * Verifies all IDs belong to this store before writing.
   */
  async reorderSections(
    storeId: string,
    dto:     ReorderSectionsDto,
    userId?: string,
  ) {
    const ids = dto.sections.map(s => s.id);

    const owned = await this.prisma.builderSection.count({
      where: { id: { in: ids }, storeId },
    });
    if (owned !== ids.length) {
      throw new ForbiddenException('One or more sections do not belong to this store');
    }

    await this.prisma.$transaction(
      dto.sections.map(({ id, sortOrder }) =>
        this.prisma.builderSection.update({
          where: { id },
          data:  { sortOrder, ...(userId && { updatedBy: userId }) },
        }),
      ),
    );

    // Get the pageId from one of the moved sections for the event
    const sample = await this.prisma.builderSection.findFirst({
      where:  { id: ids[0] },
      select: { pageId: true },
    });

    this.events.onSectionsReordered({
      storeId,
      pageId: sample?.pageId ?? '',
      sectionCount: ids.length,
      userId,
    });

    return { message: 'Sections reordered successfully', count: ids.length };
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  private async assertSectionOwnership(storeId: string, sectionId: string) {
    const section = await this.prisma.builderSection.findFirst({
      where:  { id: sectionId, storeId },
      select: { id: true, isEnabled: true, isLocked: true, sectionType: true },
    });
    if (!section) throw new NotFoundException(`Section not found`);
    return section;
  }
}
