import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

/**
 * StorefrontPageBuilderService — public, read-only view of the Page Builder.
 *
 * Returns the active homepage configuration for a store, filtered to only
 * include sections that are LIVE and enabled. Used by the Aurus storefront
 * (and future themes) to render a fully data-driven homepage.
 *
 * This service is intentionally separate from PageBuilderService (admin).
 * The response shape is optimised for rendering, not for editing.
 */
@Injectable()
export class StorefrontPageBuilderService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns the store's homepage page + all renderable sections.
   *
   * Filters applied:
   *   - isEnabled = true
   *   - status = 'LIVE'
   *   - Ordered by sortOrder ASC
   *
   * Also resolves the active theme ID so the frontend knows which
   * section registry (Aurus, Classic, etc.) to use for rendering.
   *
   * @param storeId  from X-Store-Id request header
   * @param preview  when true, includes DRAFT sections (requires preview JWT — Phase S4)
   */
  async getHomepage(storeId: string, preview = false) {
    // 1. Resolve the store's active theme
    const activeTheme = await this.prisma.storeTheme.findFirst({
      where:  { storeId, isActive: true },
      select: { themeId: true },
    });

    // For Phase S1A: fall back to 'aurus' if no active theme found.
    // Phase S3+ will enforce a required active theme.
    const themeId = activeTheme?.themeId ?? 'aurus';

    // 2. Fetch the homepage page record
    const page = await this.prisma.builderPage.findUnique({
      where: { storeId_pageType_slug: { storeId, pageType: 'home', slug: 'home' } },
      select: {
        id:          true,
        pageType:    true,
        slug:        true,
        name:        true,
        status:      true,
        version:     true,
        publishedAt: true,
      },
    });

    // If the homepage has never been seeded via the admin, return a
    // minimal response so the storefront can render with default configs.
    if (!page) {
      return {
        themeId,
        pageType:    'home',
        slug:        'home',
        version:     0,
        publishedAt: null,
        sections:    [],
        _unseeded:   true,   // hint to frontend: seed via admin first
      };
    }

    // 3. Fetch renderable sections
    const statusFilter = preview
      ? { in: ['LIVE', 'DRAFT'] as string[] }
      : { equals: 'LIVE' as string };

    const sections = await this.prisma.builderSection.findMany({
      where: {
        pageId:    page.id,
        storeId,
        isEnabled: true,
        status:    statusFilter,
      },
      select: {
        id:          true,
        sectionType: true,
        sortOrder:   true,
        config:      true,
        // Include status in preview mode so the frontend can badge DRAFT sections
        ...(preview && { status: true }),
      },
      orderBy: { sortOrder: 'asc' },
    });

    return {
      themeId,
      pageType:    page.pageType,
      slug:        page.slug,
      version:     page.version,
      publishedAt: page.publishedAt,
      sections,
    };
  }
}
