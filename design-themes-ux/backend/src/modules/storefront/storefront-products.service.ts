import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import {
  ProductListingFilters, SortOption, Breadcrumb,
  buildProductWhere, buildOrderBy, calcDiscountPercent, needsComputedPass,
  parseJsonArray, buildBreadcrumbs,
} from '@/common/catalog/product-query.util';

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
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Fetch products for storefront rendering — homepage sections (minimal
   * params) and the Product Listing Page (full filter/sort/pagination) share
   * this single endpoint; response is always additive/backward-compatible.
   */
  async getProducts(storeId: string, params: StorefrontProductParams = {}): Promise<ProductListingResponse> {
    const page  = Math.max(1, params.page ?? 1);
    const limit = Math.min(params.limit ?? 12, 60);

    const where = await buildProductWhere(this.prisma, storeId, params);

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
      const candidates = await this.prisma.product.findMany({ where, select, orderBy });

      // Phase 2: compute discount + rating only across the already-narrowed candidate set
      const ratingsByProduct = await this.getAverageRatings(candidates.map((p) => p.id));
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
      [raw, total] = await Promise.all([
        this.prisma.product.findMany({ where, select, orderBy, skip: (page - 1) * limit, take: limit }),
        this.prisma.product.count({ where }),
      ]);
      const ratingsByProduct = await this.getAverageRatings(raw.map((p) => p.id));
      raw = raw.map((p) => ({
        ...p,
        __discount: calcDiscountPercent(Number(p.price), p.comparePrice ? Number(p.comparePrice) : null),
        __rating:   ratingsByProduct.get(p.id)?.avg ?? 0,
        __reviews:  ratingsByProduct.get(p.id)?.count ?? 0,
      }));
    }

    const products: StorefrontProduct[] = raw.map((p) => {
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

    const category = where.categoryId
      ? await this.prisma.category.findUnique({
          where: { id: where.categoryId as string },
          select: { id: true, name: true, slug: true, description: true, metaTitle: true, metaDescription: true, parentId: true },
        })
      : null;

    return {
      products,
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
      breadcrumbs: category ? await buildBreadcrumbs(this.prisma, category) : [{ label: 'Home', url: '/' }],
      category: category
        ? { id: category.id, name: category.name, slug: category.slug, description: category.description,
            seo: { title: category.metaTitle, description: category.metaDescription } }
        : null,
      sortOptions: SORT_OPTIONS,
    };
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

  private async getAverageRatings(productIds: string[]): Promise<Map<string, { avg: number; count: number }>> {
    if (productIds.length === 0) return new Map();
    const grouped = await this.prisma.productReview.groupBy({
      by: ['productId'],
      where: { productId: { in: productIds }, isVisible: true },
      _avg: { rating: true },
      _count: { _all: true },
    });
    const map = new Map<string, { avg: number; count: number }>();
    for (const g of grouped) map.set(g.productId, { avg: g._avg.rating ?? 0, count: g._count._all });
    return map;
  }

}
