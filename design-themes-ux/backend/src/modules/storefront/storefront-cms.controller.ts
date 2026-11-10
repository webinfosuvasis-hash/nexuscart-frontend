import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { CurrentStore } from '@/common/decorators/current-store.decorator';
import { Public } from '@/common/decorators/public.decorator';
import { StorefrontCmsService } from './storefront-cms.service';

/**
 * StorefrontCmsController — public CMS pages for the LIVE storefront.
 * Store isolation via X-Store-Id (StoreContextMiddleware), matching
 * StorefrontMenuController's convention.
 */
@ApiTags('Storefront — CMS Pages')
@Public()
@Controller('storefront')
export class StorefrontCmsController {
  constructor(private readonly cms: StorefrontCmsService) {}

  /** GET /api/v1/storefront/pages/:slug — a PUBLISHED CMS page with its sections, else 404. */
  @Get('pages/:slug')
  @ApiOperation({ summary: 'Get a published CMS page by slug (public)' })
  @ApiParam({ name: 'slug', description: 'Page slug, e.g. "about-us"' })
  getPage(@CurrentStore() storeId: string, @Param('slug') slug: string) {
    return this.cms.getPublishedPage(storeId, slug);
  }
}
