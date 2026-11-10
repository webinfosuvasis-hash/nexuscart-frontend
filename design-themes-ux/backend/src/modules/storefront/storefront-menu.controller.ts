import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { CurrentStore } from '@/common/decorators/current-store.decorator';
import { Public } from '@/common/decorators/public.decorator';
import { StorefrontMenuService } from './storefront-menu.service';
import { ResolvedMenu } from './storefront-menu.types';

/**
 * StorefrontMenuController — Phase 9 (Dynamic Storefront Navigation).
 *
 * Public, cached, store-scoped navigation data for the LIVE storefront —
 * distinct from StorefrontController (preview-JWT gated, admin-only iframe).
 * Store isolation is enforced via X-Store-Id header (StoreContextMiddleware),
 * matching StorefrontProductsController's own convention exactly.
 */
@ApiTags('Storefront — Menu')
@Public()
@Controller('storefront')
export class StorefrontMenuController {
  constructor(private readonly menus: StorefrontMenuService) {}

  /**
   * GET /api/v1/storefront/menu
   *
   * HeaderConfig integration: resolves whichever menu the store's published
   * header's navigation component actually references. Returns `null` when
   * no header/navigation/menu is configured yet — never an error, so a
   * fresh store with no menu set up still renders (the frontend falls back
   * to its own default navigation in that case).
   */
  @Get('menu')
  @ApiOperation({ summary: "Resolve the store's default navigation menu (via HeaderConfig), fully nested (public)" })
  getDefaultMenu(@CurrentStore() storeId: string): Promise<ResolvedMenu | null> {
    return this.menus.getDefaultMenu(storeId);
  }

  /**
   * GET /api/v1/storefront/menus/:handle
   *
   * Resolve a specific menu by handle (e.g. a footer menu, or any menu not
   * wired into the header) — same resolution/caching as the default above.
   */
  @Get('menus/:handle')
  @ApiOperation({ summary: 'Resolve a specific navigation menu by handle, fully nested (public)' })
  @ApiParam({ name: 'handle', description: 'Menu handle, e.g. "main-menu" or "footer-menu"' })
  getMenuByHandle(
    @CurrentStore() storeId: string,
    @Param('handle') handle: string,
  ): Promise<ResolvedMenu | null> {
    return this.menus.getMenuByHandle(storeId, handle);
  }
}
