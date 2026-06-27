import {
  Controller, Get, Param, Req, UseGuards,
  HttpCode, HttpStatus, Header,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { Request }           from 'express';
import { StorefrontService } from './storefront.service';
import { StorefrontGuard }   from './storefront.guard';
import { Public }            from '@/common/decorators/public.decorator';

/**
 * StorefrontController — Sprint 5
 *
 * All routes are @Public() (bypasses JwtAuthGuard) and protected
 * by StorefrontGuard (validates preview JWT token) instead.
 *
 * Response headers on every endpoint:
 *   Cache-Control: no-store, no-cache, must-revalidate
 *   X-Robots-Tag: noindex, nofollow
 *   X-Preview-Mode: true
 */
@ApiTags('Storefront Preview')
@Public()
@UseGuards(StorefrontGuard)
@Controller('storefront')
export class StorefrontController {
  constructor(private readonly storefront: StorefrontService) {}

  @Get(':storeId/draft/:pageId')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control',  'no-store, no-cache, must-revalidate')
  @Header('Pragma',         'no-cache')
  @Header('X-Robots-Tag',   'noindex, nofollow')
  @Header('X-Preview-Mode', 'true')
  @ApiOperation({
    summary:     'Return all draft data for storefront preview rendering',
    description:
      'Authenticated by preview JWT (not admin session). ' +
      'Returns DraftPageData: themeConfig, headerConfig, footerConfig, sections with blocks. ' +
      'Never uses CDN or published data.',
  })
  @ApiParam({ name: 'storeId', description: 'Store ID (must match token.storeId)' })
  @ApiParam({ name: 'pageId',  description: 'Page ID (e.g., "home", "collection", "cms:about")' })
  async getDraftPageData(
    @Param('storeId') storeId: string,
    @Param('pageId')  pageId:  string,
    @Req() req: Request & { previewToken: { storeId: string; themeId?: string; pageId: string } },
  ) {
    // themeId comes from the preview token — if pre-Sprint-4.5 token, fall back to storeId lookup
    const themeId = req.previewToken.themeId ?? 'default';
    return this.storefront.buildDraftPageData(storeId, themeId, pageId);
  }
}
