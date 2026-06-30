import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { StorefrontPageBuilderService } from './storefront-page-builder.service';
import { CurrentStore } from '@/common/decorators/current-store.decorator';
import { Public } from '@/common/decorators/public.decorator';

/**
 * StorefrontPageBuilderController — public, unauthenticated endpoints.
 *
 * These endpoints are consumed by the Aurus storefront (and future themes).
 * No JWT required: the storefront is public to all customers.
 *
 * Store isolation is maintained via the X-Store-Id header, which the
 * existing StoreContextMiddleware already extracts from every request.
 *
 * Route prefix: /storefront (from StorefrontModule controller prefix)
 * Full path:    GET /api/v1/storefront/page-builder/homepage
 */
@ApiTags('Storefront — Page Builder')
@Public()
@Controller('storefront/page-builder')
export class StorefrontPageBuilderController {
  constructor(private readonly service: StorefrontPageBuilderService) {}

  /**
   * GET /api/v1/storefront/page-builder/homepage
   *
   * Returns the homepage structure + all LIVE, enabled sections
   * for the current store. Used by the storefront to render the
   * data-driven homepage.
   *
   * Includes the active themeId so the frontend knows which
   * section renderer registry (Aurus, Classic, etc.) to use.
   *
   * Response is suitable for CDN caching (60-second TTL):
   *   Cache-Control: public, max-age=60, stale-while-revalidate=300
   *
   * Phase S4+ adds:  ?preview=true&token=<preview-jwt>
   * Phase S5+ adds:  CDN cache purge on publish event
   */
  @Get('homepage')
  @ApiOperation({ summary: 'Get homepage sections for storefront rendering (public)' })
  @ApiQuery({ name: 'preview', required: false, type: Boolean, description: 'Phase S4: include DRAFT sections (requires preview JWT)' })
  getHomepage(
    @CurrentStore(false) storeId: string,
    @Query('preview')    preview:  string,
  ) {
    // preview mode is Phase S4 — for now always false
    return this.service.getHomepage(storeId, preview === 'true');
  }
}
