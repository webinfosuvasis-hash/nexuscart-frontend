import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import {
  ProductListingFilters, SortOption, Breadcrumb, ProductWhereContext,
  buildProductWhere, buildOrderBy, calcDiscountPercent, needsComputedPass,
  parseJsonArray,
} from '@/common/catalog/product-query.util';
import { buildBreadcrumbTrailFromTree, CategoryTreeNode } from '@/common/catalog/category-tree.util';
import { PerfTimer, PerfStep } from '@/common/perf-timer.util';
import { CacheService } from '@/shared/cache/cache.service';

/**
 * StorefrontProductsService — public, read-only product and category data.
 *
 * Used by:
 *   1. Section data resolvers on the Aurus storefront (Featured Products,
 *      Campaign Grid, Collections, etc.) — minimal-shape calls (tag /
 *      categorySlug / ids / featured / limit), unchanged since Phase S1A.
 *   2. The Product Listing Page (Phase P1) — full faceted listing calls
 *      (brand/collection/price/color/size/attributes/rating/discount/sort/
 *      pagination). Additive: existing minimal-shape callers are unaffected
 *      since every new field is appended, never renamed or removed.
 *
 * No authentication required — these are public storefront reads.
 * All queries are scoped by storeId for multi-tenant isolation.
 */

// ─── Public data shapes ───────────────────────────────────────────────────────

/** Product shape for storefront rendering — minimal fields are always present, rich fields added for PLP use. */
export interface StorefrontProduct {
  id:           string;
  name:         string;
  slug:         string;
  price:        number;
  mrp:          number;        // comparePrice, falls back to price if null
  image:        string;        // thumbnail or first image in the images array
  hoverImage?:  string;        // second image in the images array, if present
  badge?:       string;        // first entry from the badges JSON array (legacy single-badge field)
  badges:       string[];      // full badges array
  discount:     number;        // percent off, 0 if no discount
  rating:       number;        // average review rating, 0 if no reviews
  reviewCount:  number;
  stock:        number;
  brand?:       { id: string; name: string; slug: string } | null;
  category?:    { id: string; name: string; slug: string } | null;
}

export interface StorefrontCategory {
  id:   string;
  name: string;
  slug: string;
  img:  string;
}

export type { Breadcrumb };

export interface ProductListingResponse {
  products:    StorefrontProduct[];
  pagination:  { page: number; limit: number; total: number; totalPages: number };
  breadcrumbs: Breadcrumb[];
  category:    { id: string; name: string; slug: string; description: string | null; seo: unknown } | null;
  sortOptions: { value: SortOption; label: string }[];
  /** Perf breakdown, present only when ENABLE_PERF_DEBUG=true — never populated in normal operation. */
  _debug?: { totalMs: number; pingMs: number; steps: PerfStep[] };
}

// ─── Query parameter types ────────────────────────────────────────────────────

export interface StorefrontProductParams extends ProductListingFilters {}

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'featured',     label: 'Featured' },
  { value: 'newest',       label: 'Newest' },
  { value: 'price_asc',    label: 'Price: Low to High' },
  { value: 'price_desc',   label: 'Price: High to Low' },
  { value: 'popularity',   label: 'Popularity' },
  // 'best_selling' intentionally omitted — no real OrderItem sales aggregation exists yet;
  // see buildOrderBy() in product-query.util.ts. Add back once backed by real data.
  { value: 'discount',     label: 'Discount' },
  { value: 'alphabetical', label: 'Alphabetical' },
];

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class StorefrontProductsService {
  private readonly logger = new Logger(StorefrontProductsService.name);
  private readonly perfDebug = process.env.ENABLE_PERF_DEBUG === 'true';

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache:  CacheService,
  ) {}

  /**
   * Fetch products for storefront rendering — homepage sections (minimal
   * params) and the Product Listing Page (full filter/sort/pagination) share
   * this single endpoint; response is always additive/backward-compatible.
   */
  async getProducts(storeId: string, params: StorefrontProductParams = {}): Promise<ProductListingResponse> {
    const page  = Math.max(1, params.page ?? 1);
    const limit = Math.min(params.limit ?? 12, 60);

    const timer = this.perfDebug ? new PerfTimer() : undefined;
    // Baseline round-trip cost (network + connection handling) for THIS request,
    // measured via a trivial query — lets every other step's duration be read as
    // "network floor + N extra round trips" instead of an opaque wall-clock number.
    // Only ever runs when perf debug is explicitly enabled (adds a real extra round trip).
    const pingMs = timer
      ? await timer.time('_pingBaseline', () => this.prisma.$queryRaw`SELECT 1`).then(() => timer.summary().steps[0].ms)
      : 0;

    const ctx: ProductWhereContext = { timer, cache: this.cache };
    const where = await buildProductWhere(this.prisma, storeId, params, ctx);

    const emptyResponse: ProductListingResponse = {
      products: [],
      pagination: { page, limit, total: 0, totalPages: 0 },
      breadcrumbs: [],
      category: null,
      sortOptions: SORT_OPTIONS,
    };
    if (where === null) return emptyResponse;

    const orderBy = buildOrderBy(params.sortBy);
    const select = {
      id: true, name: true, slug: true, price: true, comparePrice: true,
      thumbnail: true, images: true, badges: true, stock: true,
      brand:    { select: { id: true, name: true, slug: true } },
      category: { select: { id: true, name: true, slug: true } },
    } as const;

    let raw: Array<Record<string, any>>;
    let total: number;

    if (needsComputedPass(params)) {
      // Phase 1: narrow candidates via indexed where clause (no pagination yet)
      const findCandidates = () => this.prisma.product.findMany({ where, select, orderBy });
      const candidates = timer ? await timer.time('productQuery', findCandidates) : await findCandidates();

      // Phase 2: compute discount + rating only across the already-narrowed candidate set
      const ratingsByProduct = await this.getAverageRatings(candidates.map((p) => p.id), timer);
      let enriched = candidates.map((p) => ({
        ...p,
        __discount: calcDiscountPercent(Number(p.price), p.comparePrice ? Number(p.comparePrice) : null),
        __rating:   ratingsByProduct.get(p.id)?.avg ?? 0,
        __reviews:  ratingsByProduct.get(p.id)?.count ?? 0,
      }));

      if (params.discountMin) enriched = enriched.filter((p) => p.__discount >= params.discountMin!);
      if (params.rating)      enriched = enriched.filter((p) => p.__rating >= params.rating!);

      if (params.sortBy === 'discount')   enriched.sort((a, b) => b.__discount - a.__discount);
      if (params.sortBy === 'popularity') enriched.sort((a, b) => b.__reviews - a.__reviews);

      total = enriched.length;
      raw = enriched.slice((page - 1) * limit, page * limit);
    } else {
      // Both queries are kicked off in the same tick and run concurrently on
      // separate connections — timing each individually (rather than only the
      // combined Promise.all) still gives an accurate per-query duration since
      // each timer starts synchronously before its own await.
      const findMany = () => this.prisma.product.findMany({ where, select, orderBy, skip: (page - 1) * limit, take: limit });
      const count    = () => this.prisma.product.count({ where });
      [raw, total] = await Promise.all([
        timer ? timer.time('productQuery', findMany) : findMany(),
        timer ? timer.time('countQuery', count) : count(),
      ]);
      const ratingsByProduct = await this.getAverageRatings(raw.map((p) => p.id), timer);
      raw = raw.map((p) => ({
        ...p,
        __discount: calcDiscountPercent(Number(p.price), p.comparePrice ? Number(p.comparePrice) : null),
        __rating:   ratingsByProduct.get(p.id)?.avg ?? 0,
        __reviews:  ratingsByProduct.get(p.id)?.count ?? 0,
      }));
    }

    const serialize = () => raw.map((p) => {
      const images = parseJsonArray(p.images);
      const badges = parseJsonArray(p.badges ?? null);
      return {
        id:    p.id,
        name:  p.name,
        slug:  p.slug,
        price: Number(p.price),
        mrp:   p.comparePrice ? Number(p.comparePrice) : Number(p.price),
        image:      p.thumbnail || images[0] || '',
        hoverImage: images[1] || undefined,
        badge:      badges[0] || undefined,
        badges,
        discount:    p.__discount,
        rating:      Math.round(p.__rating * 10) / 10,
        reviewCount: p.__reviews,
        stock:       p.stock,
        brand:    p.brand ?? null,
        category: p.category ?? null,
      };
    });
    const t0 = timer ? performance.now() : 0;
    const products: StorefrontProduct[] = serialize();
    if (timer) timer.mark('serialization', performance.now() - t0);

    // `buildProductWhere` already resolved the category (and its whole store
    // tree) while building the `where` clause above — reused here via `ctx`
    // rather than re-querying for the same row a second time.
    const category = ctx.resolvedCategory ?? null;

    const breadcrumbs = await this.buildListingBreadcrumbs(storeId, category, ctx.tree, params);

    if (timer) {
      const { totalMs, steps } = timer.summary();
      this.logger.log(`getProducts perf: total=${totalMs}ms ping=${pingMs}ms steps=${JSON.stringify(steps)}`);
    }

    return {
      products,
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
      breadcrumbs,
      category: category
        ? { id: category.id, name: category.name, slug: category.slug, description: category.description,
            seo: { title: category.metaTitle, description: category.metaDescription } }
        : null,
      sortOptions: SORT_OPTIONS,
      ...(timer ? { _debug: { ...timer.summary(), pingMs } } : {}),
    };
  }

  /**
   * Category listings already get a real trail from `buildBreadcrumbs()`.
   * Brand/Collection/Search listings have no category, so they used to fall
   * back to a bare `[Home]` crumb even though the page's own H1 correctly
   * shows the brand/collection/search term — this fills in that gap without
   * inventing new intermediate routes (no `/brands` or `/collections` index
   * page exists in the router, so the trail stays two levels: Home > entity).
   */
  private async buildListingBreadcrumbs(
    storeId: string,
    category: CategoryTreeNode | null,
    tree: CategoryTreeNode[] | undefined,
    params: StorefrontProductParams,
  ): Promise<Breadcrumb[]> {
    // `tree` is always populated alongside `category` (both come from the same
    // buildProductWhere call), so the parent-chain walk is pure in-memory —
    // no DB round trip per ancestor level.
    if (category) return buildBreadcrumbTrailFromTree(tree ?? [], category);

    if (params.brandSlug) {
      const brand = await this.prisma.brand.findFirst({
        where: { storeId, slug: params.brandSlug },
        select: { name: true },
      });
      return [{ label: 'Home', url: '/' }, { label: brand?.name ?? params.brandSlug, url: `/brand/${params.brandSlug}` }];
    }

    if (params.collectionSlug) {
      const collection = await this.prisma.collection.findFirst({
        where: { storeId, slug: params.collectionSlug },
        select: { name: true },
      });
      return [{ label: 'Home', url: '/' }, { label: collection?.name ?? params.collectionSlug, url: `/collection/${params.collectionSlug}` }];
    }

    if (params.q) {
      return [{ label: 'Home', url: '/' }, { label: `"${params.q}"`, url: `/search?q=${encodeURIComponent(params.q)}` }];
    }

    return [{ label: 'Home', url: '/' }];
  }

  /**
   * Fetch categories for storefront section rendering (e.g. category icons strip).
   *
   * Returns categories with id, name, slug, and image.
   * Only active, non-deleted, root-level (no parent) categories are returned.
   */
  async getCategories(storeId: string, limit = 10): Promise<{ categories: StorefrontCategory[] }> {
    const raw = await this.prisma.category.findMany({
      where: {
        storeId,
        isActive:  true,
        deletedAt: null,
      },
      take:    Math.min(limit, 30),
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select:  { id: true, name: true, slug: true, image: true },
    });

    const categories: StorefrontCategory[] = raw.map(c => ({
      id:   c.id,
      name: c.name,
      slug: c.slug,
      img:  c.image ?? '',
    }));

    return { categories };
  }

  /** GET /storefront/brands — active brands for a store. */
  async getBrands(storeId: string, limit = 30) {
    const brands = await this.prisma.brand.findMany({
      where: { storeId, isActive: true },
      take: Math.min(limit, 100),
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, slug: true, logo: true, isFeatured: true },
    });
    return { brands };
  }

  /** GET /storefront/collections — active collections for a store. */
  async getCollectionsList(storeId: string, limit = 30) {
    const collections = await this.prisma.collection.findMany({
      where: { storeId, isActive: true },
      take: Math.min(limit, 100),
      orderBy: [{ name: 'asc' }],
      select: { id: true, name: true, slug: true, image: true, isFeatured: true },
    });
    return { collections };
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private async getAverageRatings(productIds: string[], timer?: PerfTimer): Promise<Map<string, { avg: number; count: number }>> {
    if (productIds.length === 0) return new Map();
    const groupRatings = () => this.prisma.productReview.groupBy({
      by: ['productId'],
      where: { productId: { in: productIds }, isVisible: true },
      _avg: { rating: true },
      _count: { _all: true },
    });
    const grouped = timer ? await timer.time('ratings', groupRatings) : await groupRatings();
    const map = new Map<string, { avg: number; count: number }>();
    for (const g of grouped) map.set(g.productId, { avg: g._avg.rating ?? 0, count: g._count._all });
    return map;
  }

}
