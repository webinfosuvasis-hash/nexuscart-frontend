import { NotFoundException } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

export interface Breadcrumb { label: string; url: string }

/**
 * Shared product filter/sort/pagination building blocks for the storefront
 * Product Listing API (`/storefront/products`) and the keyword Search API
 * (`/search`) — both filter the same `Product` table and should not
 * duplicate this logic.
 *
 * Two-phase query strategy:
 *   Phase 1 — every criterion that maps to an indexed/relational Prisma
 *     `where` clause (category, brand, collection, price, stock, keyword,
 *     badges, variant color/size, attribute facets) is applied directly in
 *     SQL via Prisma's fluent API. Cheap, scales to large catalogs.
 *   Phase 2 — criteria that need a *computed* value (discount %, average
 *     rating) are evaluated in application code, but only over the
 *     candidate set Phase 1 already narrowed down to — never the whole
 *     catalog. Final paging/sorting happens after Phase 2 when those
 *     criteria are involved; otherwise Prisma does paging/sorting natively
 *     (the common, fast path).
 */

export type SortOption =
  | 'featured' | 'newest' | 'price_asc' | 'price_desc'
  | 'popularity' | 'discount' | 'alphabetical';

export interface ProductListingFilters {
  categorySlug?: string;
  brandSlug?: string;
  collectionSlug?: string;
  ids?: string;
  tag?: string;
  featured?: boolean;
  q?: string;
  priceMin?: number;
  priceMax?: number;
  color?: string[];
  size?: string[];
  /** Attribute slug → selected value labels, e.g. { fabric: ['Silk','Cotton'] } */
  attr?: Record<string, string[]>;
  /** Badge tokens: featured | new-arrival | best-seller | trending */
  badge?: string[];
  inStock?: boolean;
  discountMin?: number;
  rating?: number;
  sortBy?: SortOption;
  page?: number;
  limit?: number;
}

const BADGE_LABELS: Record<string, string> = {
  'featured':     'Featured',
  'new-arrival':  'New Arrival',
  'best-seller':  'Bestseller',
  'trending':     'Trending',
};

/** Needs computed values (discount %, avg rating) not expressible as a single Prisma where clause. */
export function needsComputedPass(filters: ProductListingFilters): boolean {
  return Boolean(filters.discountMin) || Boolean(filters.rating) ||
    filters.sortBy === 'discount' || filters.sortBy === 'popularity';
}

/**
 * Resolves slug-based scoping (category/brand/collection) to IDs and builds
 * the Phase 1 Prisma `where` clause.
 *
 * Throws `NotFoundException` when a category/brand/collection *slug itself*
 * doesn't resolve to a real record — a bad/typo'd URL segment is a 404, not
 * an empty result set. Returns `null` only for the narrower case of a valid
 * scope whose *filter values* (e.g. an `attr` selection) match zero
 * products — that's a legitimate empty-result case, not a routing error.
 */
export async function buildProductWhere(
  prisma: PrismaClient,
  storeId: string,
  filters: ProductListingFilters,
): Promise<Prisma.ProductWhereInput | null> {
  const where: Prisma.ProductWhereInput = {
    storeId,
    status: 'ACTIVE',
    deletedAt: null,
  };

  if (filters.ids?.trim()) {
    where.id = { in: filters.ids.split(',').map((s) => s.trim()).filter(Boolean) };
    return where; // manual selection short-circuits all other filters
  }

  if (filters.categorySlug?.trim()) {
    const category = await prisma.category.findFirst({
      where: { storeId, slug: filters.categorySlug.trim(), deletedAt: null },
      select: { id: true },
    });
    if (!category) throw new NotFoundException(`Category not found: ${filters.categorySlug.trim()}`);
    where.categoryId = category.id;
  }

  if (filters.brandSlug?.trim()) {
    const brand = await prisma.brand.findFirst({
      where: { storeId, slug: filters.brandSlug.trim() },
      select: { id: true },
    });
    if (!brand) throw new NotFoundException(`Brand not found: ${filters.brandSlug.trim()}`);
    where.brandId = brand.id;
  }

  if (filters.collectionSlug?.trim()) {
    const collection = await prisma.collection.findFirst({
      where: { storeId, slug: filters.collectionSlug.trim() },
      select: { id: true },
    });
    if (!collection) throw new NotFoundException(`Collection not found: ${filters.collectionSlug.trim()}`);
    where.collections = { some: { collectionId: collection.id } };
  }

  // Independent OR-groups accumulate here, each AND-ed together at the end —
  // keeps `tag`, `q`, and `badge` (all OR-internally) from clobbering each
  // other if used together, unlike directly overwriting `where.OR`.
  const andGroups: Prisma.ProductWhereInput[] = [];

  if (filters.tag?.trim()) {
    andGroups.push({ OR: [
      { tags:   { contains: filters.tag.trim() } },
      { badges: { contains: filters.tag.trim() } },
    ] });
  }

  if (filters.q?.trim()) {
    const q = filters.q.trim();
    andGroups.push({ OR: [
      { name:        { contains: q } },
      { description: { contains: q } },
      { tags:        { contains: q } },
    ] });
  }

  if (filters.featured) where.isFeatured = true;

  if (filters.priceMin !== undefined || filters.priceMax !== undefined) {
    where.price = {
      ...(filters.priceMin !== undefined ? { gte: filters.priceMin } : {}),
      ...(filters.priceMax !== undefined ? { lte: filters.priceMax } : {}),
    };
  }

  if (filters.inStock) where.stock = { gt: 0 };

  if (filters.badge?.length) {
    const badgeLabels = filters.badge.map((b) => BADGE_LABELS[b] ?? b);
    andGroups.push({ OR: [
      ...badgeLabels.map((label) => ({ badges: { contains: label } })),
      ...(filters.badge.includes('featured') ? [{ isFeatured: true }] : []),
    ] });
  }

  // Color and size are independent dimensions: (Color1 OR Color2) AND (Size1 OR Size2).
  // Each gets its own `some` clause pushed into andGroups — combining them into a single
  // shared OR array (as a prior version of this code did) would mean "has a variant
  // matching color OR size", which is satisfied by nearly every product once any size
  // filter is active, silently defeating both filters when used together.
  if (filters.color?.length) {
    andGroups.push({ variants: { some: { OR: filters.color.map((c) => ({ options: { contains: `"color":"${c}"` } })) } } });
  }
  if (filters.size?.length) {
    andGroups.push({ variants: { some: { OR: filters.size.map((s) => ({ options: { contains: `"size":"${s}"` } })) } } });
  }

  if (filters.attr && Object.keys(filters.attr).length) {
    const attrEntries = Object.entries(filters.attr).filter(([, values]) => values?.length);
    if (attrEntries.length) {
      const attributeValueIds = await prisma.attributeValue.findMany({
        where: {
          attribute: { storeId, slug: { in: attrEntries.map(([slug]) => slug) } },
          OR: attrEntries.flatMap(([, values]) => values.map((v) => ({ value: v }))),
        },
        select: { id: true, attributeId: true },
      });
      if (attrEntries.length && attributeValueIds.length === 0) return null;

      // AND across attribute groups (fabric AND occasion), OR within a group's values
      const byAttribute = new Map<string, string[]>();
      for (const av of attributeValueIds) {
        const list = byAttribute.get(av.attributeId) ?? [];
        list.push(av.id);
        byAttribute.set(av.attributeId, list);
      }
      for (const ids of byAttribute.values()) {
        andGroups.push({ attributeValues: { some: { attributeValueId: { in: ids } } } });
      }
    }
  }

  if (andGroups.length) where.AND = andGroups;

  return where;
}

export function buildOrderBy(sortBy?: SortOption): Prisma.ProductOrderByWithRelationInput {
  switch (sortBy) {
    case 'price_asc':    return { price: 'asc' };
    case 'price_desc':   return { price: 'desc' };
    case 'alphabetical': return { name: 'asc' };
    case 'newest':       return { createdAt: 'desc' };
    // 'best_selling' intentionally has no case here — there is no OrderItem-based sales
    // aggregation yet, so this sort is hidden from SORT_OPTIONS (storefront-products.service.ts)
    // rather than faked via a stock/recency proxy. Add a real case here once that data exists.
    case 'featured':
    default:              return { createdAt: 'desc' };
  }
}

export function calcDiscountPercent(price: number, comparePrice: number | null): number {
  if (!comparePrice || comparePrice <= price) return 0;
  return Math.round(((comparePrice - price) / comparePrice) * 100);
}

export function parseCsv(value?: string): string[] | undefined {
  if (!value?.trim()) return undefined;
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}

/**
 * Parse a JSON string array, handling both single-encoded `["a","b"]` and
 * double-encoded `"[\"a\",\"b\"]"` formats (legacy data may be double-stringified).
 */
export function parseJsonArray(jsonString: string | null | undefined): string[] {
  if (!jsonString?.trim()) return [];
  try {
    const p1 = JSON.parse(jsonString.trim());
    if (Array.isArray(p1)) return p1.map(String);
    if (typeof p1 === 'string' && p1.trim()) {
      try {
        const p2 = JSON.parse(p1);
        if (Array.isArray(p2)) return p2.map(String);
      } catch { /* not double-encoded */ }
    }
    return [];
  } catch {
    return jsonString.trim() ? [jsonString.trim()] : [];
  }
}

/** Builds a Home → ... → category breadcrumb trail by walking up `parentId`. */
export async function buildBreadcrumbs(
  prisma: PrismaClient,
  category: { id: string; name: string; slug: string; parentId: string | null },
): Promise<Breadcrumb[]> {
  const trail: Breadcrumb[] = [{ label: category.name, url: `/category/${category.slug}` }];
  let parentId = category.parentId;
  let depth = 0;
  while (parentId && depth < 5) {
    const parent = await prisma.category.findUnique({
      where: { id: parentId },
      select: { id: true, name: true, slug: true, parentId: true },
    });
    if (!parent) break;
    trail.unshift({ label: parent.name, url: `/category/${parent.slug}` });
    parentId = parent.parentId;
    depth++;
  }
  return [{ label: 'Home', url: '/' }, ...trail];
}
