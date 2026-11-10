import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CacheService } from '@/shared/cache/cache.service';
import { CACHE_KEYS, CACHE_TTL } from '@/shared/cache/cache.constants';
import { HeaderConfigService } from '@/modules/theme-engine/header-config/header-config.service';
import {
  MegaMenuFeaturedCategory, MegaMenuFeaturedProduct, MegaMenuInput,
  MenuLinkType, ResolvedMegaMenu, ResolvedMenu, ResolvedMenuItem,
} from './storefront-menu.types';

interface RawMenuItem {
  id: string;
  parentId: string | null;
  label: string;
  url: string | null;
  linkType: string | null;
  categoryId: string | null;
  productId: string | null;
  brandId: string | null;
  cmsPageId: string | null;
  collectionId: string | null;
  megaMenu: unknown;
  sortOrder: number;
}

/**
 * Phase 9 — Dynamic Storefront Navigation Integration.
 *
 * Resolves the EXISTING Menu/MenuItem model (unmodified CRUD — see
 * CmsService) into a fully render-ready, publicly-servable tree: nested to
 * unlimited depth, structured links (CATEGORY/PRODUCT/BRAND/CMS_PAGE/
 * COLLECTION) resolved to real URLs against the same catalog entities the
 * rest of the storefront already reuses, and mega-menu featured items
 * expanded from bare ids. No order/payment/catalog business logic is
 * duplicated here — every resolution is a plain, store-scoped read of an
 * existing table.
 *
 * Deliberately separate from StorefrontService's own inline menu lookups
 * (used only for the admin's draft-preview iframe, which needs nothing more
 * than a flat top-level list) — this is the fuller resolver the *live*
 * public site needs, reusing the same PrismaService/CacheService/
 * HeaderConfigService dependencies rather than a second menu system.
 */
@Injectable()
export class StorefrontMenuService {
  private readonly logger = new Logger(StorefrontMenuService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly headerConfig: HeaderConfigService,
  ) {}

  /** GET /storefront/menus/:handle — resolve one menu by its handle. */
  async getMenuByHandle(storeId: string, handle: string): Promise<ResolvedMenu | null> {
    const cacheKey = CACHE_KEYS.menu(storeId, handle);
    const cached = await this.cache.get<ResolvedMenu>(cacheKey);
    if (cached) return cached;

    const menu = await this.prisma.menu.findFirst({ where: { storeId, handle } });
    if (!menu) return null;

    const resolved = await this.resolveMenu(storeId, menu.id, menu.handle, menu.name);
    await this.cache.set(cacheKey, resolved, CACHE_TTL.MENU);
    return resolved;
  }

  /**
   * GET /storefront/menu — HeaderConfig integration: resolves whichever menu
   * the store's PUBLISHED header actually references (its `navigation`
   * zone component's `menuHandle` setting), so the frontend never needs to
   * know or hardcode a specific handle. Never reads draft config — no
   * preview leakage onto the public path.
   */
  async getDefaultMenu(storeId: string): Promise<ResolvedMenu | null> {
    const published = await this.headerConfig.getPublished(storeId);
    const handle = this.findNavigationMenuHandle(published);
    if (!handle) return null;
    return this.getMenuByHandle(storeId, handle);
  }

  private findNavigationMenuHandle(headerConfig: { zones?: unknown } | null): string | null {
    const zones = (headerConfig?.zones as any[]) ?? [];
    for (const zone of zones) {
      const nav = (zone.components ?? []).find((c: any) => c.type === 'navigation');
      if (nav?.settings?.menuHandle) return String(nav.settings.menuHandle);
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Resolution pipeline
  // ---------------------------------------------------------------------------

  private async resolveMenu(storeId: string, menuId: string, handle: string, name: string): Promise<ResolvedMenu> {
    const items: RawMenuItem[] = await this.prisma.menuItem.findMany({
      where: { menuId, isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    const [urlById, megaMenuById] = await Promise.all([
      this.resolveUrls(storeId, items),
      this.resolveMegaMenus(storeId, items),
    ]);

    const nodesById = new Map<string, ResolvedMenuItem>();
    const parentByChildId = new Map<string, string | null>();

    for (const item of items) {
      const resolution = urlById.get(item.id);
      // A structured link whose target no longer exists/isn't published in
      // this store is dropped entirely rather than served as a dead link.
      if (!resolution) continue;

      nodesById.set(item.id, {
        id: item.id,
        label: item.label,
        url: resolution.url,
        linkType: resolution.linkType,
        megaMenu: megaMenuById.get(item.id) ?? null,
        children: [],
      });
      parentByChildId.set(item.id, item.parentId);
    }

    const tree = buildTree(nodesById, parentByChildId);
    return { id: menuId, handle, name, items: tree };
  }

  /** Resolves every item's linkType into a real, safe URL. Batches one query per entity type — no N+1. */
  private async resolveUrls(
    storeId: string,
    items: RawMenuItem[],
  ): Promise<Map<string, { url: string; linkType: MenuLinkType }>> {
    const result = new Map<string, { url: string; linkType: MenuLinkType }>();

    const byCategory = items.filter((i) => i.linkType === 'CATEGORY' && i.categoryId);
    const byProduct = items.filter((i) => i.linkType === 'PRODUCT' && i.productId);
    const byBrand = items.filter((i) => i.linkType === 'BRAND' && i.brandId);
    const byCmsPage = items.filter((i) => i.linkType === 'CMS_PAGE' && i.cmsPageId);
    const byCollection = items.filter((i) => i.linkType === 'COLLECTION' && i.collectionId);
    const byExternal = items.filter((i) => !i.linkType || i.linkType === 'EXTERNAL_URL');

    // `in: []` short-circuits to an empty result set in Prisma — no need to
    // skip the query, which keeps every branch's inferred type identical
    // (a bare ternary-to-`[]` fallback here would widen these to `any[]`).
    const [categories, products, brands, pages, collections] = await Promise.all([
      this.prisma.category.findMany({
        where: { id: { in: byCategory.map((i) => i.categoryId!) }, storeId, isActive: true },
        select: { id: true, slug: true },
      }),
      this.prisma.product.findMany({
        where: { id: { in: byProduct.map((i) => i.productId!) }, storeId, status: 'ACTIVE' },
        select: { id: true, slug: true },
      }),
      this.prisma.brand.findMany({
        where: { id: { in: byBrand.map((i) => i.brandId!) }, storeId, isActive: true },
        select: { id: true, slug: true },
      }),
      this.prisma.cmsPage.findMany({
        where: { id: { in: byCmsPage.map((i) => i.cmsPageId!) }, storeId, status: 'PUBLISHED' },
        select: { id: true, slug: true },
      }),
      this.prisma.collection.findMany({
        where: { id: { in: byCollection.map((i) => i.collectionId!) }, storeId, isActive: true },
        select: { id: true, slug: true },
      }),
    ]);

    const categoryById = new Map(categories.map((c) => [c.id, c]));
    const productById = new Map(products.map((p) => [p.id, p]));
    const brandById = new Map(brands.map((b) => [b.id, b]));
    const pageById = new Map(pages.map((p) => [p.id, p]));
    const collectionById = new Map(collections.map((c) => [c.id, c]));

    for (const item of byCategory) {
      const cat = categoryById.get(item.categoryId!);
      if (cat) result.set(item.id, { url: `/category/${cat.slug}`, linkType: 'CATEGORY' });
    }
    for (const item of byProduct) {
      const prod = productById.get(item.productId!);
      if (prod) result.set(item.id, { url: `/products/${prod.id}`, linkType: 'PRODUCT' });
    }
    for (const item of byBrand) {
      const brand = brandById.get(item.brandId!);
      if (brand) result.set(item.id, { url: `/brand/${brand.slug}`, linkType: 'BRAND' });
    }
    for (const item of byCmsPage) {
      const page = pageById.get(item.cmsPageId!);
      if (page) result.set(item.id, { url: `/pages/${page.slug}`, linkType: 'CMS_PAGE' });
    }
    for (const item of byCollection) {
      const col = collectionById.get(item.collectionId!);
      if (col) result.set(item.id, { url: `/collection/${col.slug}`, linkType: 'COLLECTION' });
    }
    for (const item of byExternal) {
      // Never fetched server-side (no SSRF surface) — only sanitized for the
      // schemes a plain <a href> should ever carry, so a crafted
      // `javascript:`/`data:` URL can't be planted through the menu editor.
      const url = item.url ?? '';
      if (isSafeHref(url)) result.set(item.id, { url, linkType: 'EXTERNAL_URL' });
    }

    return result;
  }

  /** Expands each item's megaMenu JSON (bare ids) into real product/category summaries. Batched, no N+1. */
  private async resolveMegaMenus(storeId: string, items: RawMenuItem[]): Promise<Map<string, ResolvedMegaMenu>> {
    const result = new Map<string, ResolvedMegaMenu>();
    const inputs = new Map<string, MegaMenuInput>();
    for (const item of items) {
      if (item.megaMenu && typeof item.megaMenu === 'object') {
        inputs.set(item.id, item.megaMenu as MegaMenuInput);
      }
    }
    if (inputs.size === 0) return result;

    const allProductIds = new Set<string>();
    const allCategoryIds = new Set<string>();
    for (const input of inputs.values()) {
      (input.featuredProductIds ?? []).forEach((id) => allProductIds.add(id));
      (input.featuredCategoryIds ?? []).forEach((id) => allCategoryIds.add(id));
    }

    const [products, categories] = await Promise.all([
      this.prisma.product.findMany({
        where: { id: { in: [...allProductIds] }, storeId, status: 'ACTIVE' },
        select: { id: true, name: true, slug: true, thumbnail: true, price: true, comparePrice: true },
      }),
      this.prisma.category.findMany({
        where: { id: { in: [...allCategoryIds] }, storeId, isActive: true },
        select: { id: true, name: true, slug: true, image: true },
      }),
    ]);
    const productById = new Map(products.map((p) => [p.id, p]));
    const categoryById = new Map(categories.map((c) => [c.id, c]));

    for (const [itemId, input] of inputs.entries()) {
      const featuredProducts: MegaMenuFeaturedProduct[] = (input.featuredProductIds ?? [])
        .map((id) => productById.get(id))
        .filter((p): p is NonNullable<typeof p> => !!p)
        .map((p) => ({
          id: p.id, name: p.name, slug: p.slug, thumbnail: p.thumbnail ?? null,
          price: Number(p.price), comparePrice: p.comparePrice ? Number(p.comparePrice) : null,
        }));
      const featuredCategories: MegaMenuFeaturedCategory[] = (input.featuredCategoryIds ?? [])
        .map((id) => categoryById.get(id))
        .filter((c): c is NonNullable<typeof c> => !!c)
        .map((c) => ({ id: c.id, name: c.name, slug: c.slug, image: c.image ?? null }));

      result.set(itemId, {
        image: input.image ?? null,
        icon: input.icon ?? null,
        banner: input.banner
          ? { image: input.banner.image ?? null, link: input.banner.link ?? null, text: input.banner.text ?? null }
          : null,
        badge: input.badge ?? null,
        featuredProducts,
        featuredCategories,
      });
    }
    return result;
  }
}

/** Only allows the schemes a menu link can legitimately need — rejects javascript:/data:/vbscript: etc. */
export function isSafeHref(url: string): boolean {
  if (!url) return true; // empty href renders as a no-op link, never dangerous
  const trimmed = url.trim();
  if (trimmed.startsWith('/') || trimmed.startsWith('#') || trimmed.startsWith('?')) return true;
  return /^https?:\/\//i.test(trimmed) || /^mailto:/i.test(trimmed) || /^tel:/i.test(trimmed);
}

/**
 * Builds a nested tree from a flat map of clean nodes + a parallel
 * id→parentId map, via a single pass — supports unlimited depth in one
 * shot, no recursive queries. Each node is a plain ResolvedMenuItem with no
 * internal bookkeeping fields leaking into the response.
 */
export function buildTree(
  nodesById: Map<string, ResolvedMenuItem>,
  parentByChildId: Map<string, string | null>,
): ResolvedMenuItem[] {
  const roots: ResolvedMenuItem[] = [];

  for (const [id, node] of nodesById.entries()) {
    const parentId = parentByChildId.get(id) ?? null;
    // A parentId pointing at an item that was dropped (dead link) or never
    // existed is treated as top-level, rather than silently disappearing.
    if (parentId && nodesById.has(parentId)) {
      nodesById.get(parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}
