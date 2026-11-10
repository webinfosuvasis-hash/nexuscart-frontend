import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

/**
 * StorefrontCmsService — public, read-only view of CMS pages (About Us,
 * Contact, policies…).
 *
 * The menu resolver already emits `/pages/:slug` for CMS_PAGE links
 * (StorefrontMenuService); this is the endpoint that URL resolves against.
 * Only PUBLISHED pages are ever returned — a DRAFT/ARCHIVED page is
 * indistinguishable from a missing one, so unpublished content never leaks.
 */
@Injectable()
export class StorefrontCmsService {
  constructor(private readonly prisma: PrismaService) {}

  async getPublishedPage(storeId: string, slug: string) {
    const page = await this.prisma.cmsPage.findFirst({
      where: { storeId, slug, status: 'PUBLISHED' },
      select: {
        id:          true,
        title:       true,
        slug:        true,
        seoTitle:    true,
        seoDesc:     true,
        ogImage:     true,
        publishedAt: true,
        sections: {
          select:  { id: true, type: true, name: true, settings: true, order: true },
          orderBy: { order: 'asc' },
        },
      },
    });
    if (!page) throw new NotFoundException(`Page not found: ${slug}`);
    return page;
  }
}
