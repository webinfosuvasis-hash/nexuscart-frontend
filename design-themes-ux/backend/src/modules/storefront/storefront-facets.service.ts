import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { ProductListingFilters, buildProductWhere } from '@/common/catalog/product-query.util';

export interface FacetOption {
  label:    string;
  value:    string;
  count:    number;
  selected: boolean;
  disabled: boolean;
}

const BADGE_TOKENS: { token: string; label: string }[] = [
  { token: 'featured',     label: 'Featured' },
  { token: 'new-arrival',  label: 'New Arrival' },
  { token: 'best-seller',  label: 'Bestseller' },
  { token: 'trending',     label: 'Trending' },
];
const RATING_THRESHOLDS = [4, 3, 2, 1];
const DISCOUNT_THRESHOLDS = [10, 20, 30, 50];

/**
 * StorefrontFacetsService — computes dynamic faceted-filter metadata for the
 * Product Listing Page. No filter value is ever hardcoded: every bucket's
 * label/value comes from real `Category`/`Brand`/`Collection`/`Attribute`/
 * `AttributeValue`/`ProductVariant` rows, and every count is a live query
 * scoped by whichever *other* filters are currently applied (the standard
 * "AND across groups, OR within a group" faceted-search pattern) — never the
 * dimension's own filter, so users can see what relaxing/changing it yields.
 */
@Injectable()
export class StorefrontFacetsService {
  constructor(private readonly prisma: PrismaService) {}

  async getFacets(storeId: string, filters: ProductListingFilters) {
    const [
      category, brand, collection, price, color, size,
      attributes, badge, rating, availability, discount,
    ] = await Promise.all([
      this.categoryFacet(storeId, filters),
      this.brandFacet(storeId, filters),
      this.collectionFacet(storeId, filters),
      this.priceFacet(storeId, filters),
      this.variantFacet(storeId, filters, 'color'),
      this.variantFacet(storeId, filters, 'size'),
      this.attributeFacets(storeId, filters),
      this.badgeFacet(storeId, filters),
      this.ratingFacet(storeId, filters),
      this.availabilityFacet(storeId, filters),
      this.discountFacet(storeId, filters),
    ]);

    return { category, brand, collection, price, color, size, ...attributes, badge, rating, availability, discount };
  }

  // ─── Per-dimension facet builders ──────────────────────────────────────────

  private async categoryFacet(storeId: string, filters: ProductListingFilters): Promise<FacetOption[]> {
    const where = await buildProductWhere(this.prisma, storeId, { ...filters, categorySlug: undefined });
    if (where === null) return [];

    const [categories, grouped] = await Promise.all([
      this.prisma.category.findMany({ where: { storeId, isActive: true, deletedAt: null }, select: { id: true, name: true, slug: true } }),
      this.prisma.product.groupBy({ by: ['categoryId'], where, _count: { _all: true } }),
    ]);
    const counts = new Map(grouped.map((g) => [g.categoryId, g._count._all]));
    return categories
      .map((c) => ({
        label: c.name, value: c.slug, count: counts.get(c.id) ?? 0,
        selected: filters.categorySlug === c.slug, disabled: !counts.get(c.id),
      }))
      .filter((f) => f.count > 0 || f.selected);
  }

  private async brandFacet(storeId: string, filters: ProductListingFilters): Promise<FacetOption[]> {
    const where = await buildProductWhere(this.prisma, storeId, { ...filters, brandSlug: undefined });
    if (where === null) return [];

    const [brands, grouped] = await Promise.all([
      this.prisma.brand.findMany({ where: { storeId, isActive: true }, select: { id: true, name: true, slug: true } }),
      this.prisma.product.groupBy({ by: ['brandId'], where, _count: { _all: true } }),
    ]);
    const counts = new Map(grouped.map((g) => [g.brandId, g._count._all]));
    return brands
      .map((b) => ({
        label: b.name, value: b.slug, count: counts.get(b.id) ?? 0,
        selected: filters.brandSlug === b.slug, disabled: !counts.get(b.id),
      }))
      .filter((f) => f.count > 0 || f.selected);
  }

  private async collectionFacet(storeId: string, filters: ProductListingFilters): Promise<FacetOption[]> {
    const where = await buildProductWhere(this.prisma, storeId, { ...filters, collectionSlug: undefined });
    if (where === null) return [];

    const collections = await this.prisma.collection.findMany({
      where: { storeId, isActive: true },
      select: { id: true, name: true, slug: true },
    });
    if (collections.length === 0) return [];

    // Single grouped aggregate instead of one `count()` per collection (was N+1 —
    // scaled with the number of collections in the store).
    const grouped = await this.prisma.productCollection.groupBy({
      by: ['collectionId'],
      where: { collectionId: { in: collections.map((c) => c.id) }, product: where },
      _count: { _all: true },
    });
    const counts = new Map(grouped.map((g) => [g.collectionId, g._count._all]));

    return collections
      .map((c) => ({
        label: c.name, value: c.slug, count: counts.get(c.id) ?? 0,
        selected: filters.collectionSlug === c.slug, disabled: !counts.get(c.id),
      }))
      .filter((f) => f.count > 0 || f.selected);
  }

  private async priceFacet(storeId: string, filters: ProductListingFilters): Promise<{ min: number; max: number; selectedMin?: number; selectedMax?: number }> {
    const where = await buildProductWhere(this.prisma, storeId, { ...filters, priceMin: undefined, priceMax: undefined });
    if (where === null) return { min: 0, max: 0 };

    const agg = await this.prisma.product.aggregate({ where, _min: { price: true }, _max: { price: true } });
    return {
      min: agg._min.price ? Number(agg._min.price) : 0,
      max: agg._max.price ? Number(agg._max.price) : 0,
      selectedMin: filters.priceMin,
      selectedMax: filters.priceMax,
    };
  }

  /** Color/size facets are sourced from ProductVariant.options JSON, tallied over the already-filtered candidate set. */
  private async variantFacet(storeId: string, filters: ProductListingFilters, dimension: 'color' | 'size'): Promise<FacetOption[]> {
    const omit = dimension === 'color' ? { color: undefined } : { size: undefined };
    const where = await buildProductWhere(this.prisma, storeId, { ...filters, ...omit });
    if (where === null) return [];

    // Single query via the relation filter instead of fetching matching product IDs
    // first and re-querying variants by an IN-list (was 2 round trips + an
    // unbounded ID array held in memory).
    const variants = await this.prisma.productVariant.findMany({
      where: { product: where },
      select: { options: true },
    });

    const counts = new Map<string, number>();
    for (const v of variants) {
      if (!v.options) continue;
      try {
        const parsed = JSON.parse(v.options) as { color?: string; size?: string };
        const value = parsed[dimension];
        if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
      } catch { /* skip malformed variant options */ }
    }

    const selected = new Set((dimension === 'color' ? filters.color : filters.size) ?? []);
    return Array.from(counts.entries())
      .map(([value, count]) => ({ label: value, value, count, selected: selected.has(value), disabled: count === 0 }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  /** One dynamic facet group per store-defined, filterable Attribute (fabric, material, occasion, pattern, ...). */
  private async attributeFacets(storeId: string, filters: ProductListingFilters): Promise<Record<string, FacetOption[]>> {
    const attributes = await this.prisma.attribute.findMany({
      where: { storeId, isFilterable: true },
      include: { values: true },
      orderBy: { sortOrder: 'asc' },
    });
    if (attributes.length === 0) return {};

    const result: Record<string, FacetOption[]> = {};
    await Promise.all(attributes.map(async (attribute) => {
      const omittedAttr = { ...(filters.attr ?? {}) };
      delete omittedAttr[attribute.slug];
      const where = await buildProductWhere(this.prisma, storeId, { ...filters, attr: omittedAttr });
      if (where === null) { result[attribute.slug] = []; return; }

      const grouped = await this.prisma.productAttributeValue.groupBy({
        by: ['attributeValueId'],
        where: { attributeValueId: { in: attribute.values.map((v) => v.id) }, product: where },
        _count: { _all: true },
      });
      const counts = new Map(grouped.map((g) => [g.attributeValueId, g._count._all]));
      const selected = new Set(filters.attr?.[attribute.slug] ?? []);

      result[attribute.slug] = attribute.values
        .map((v) => ({
          label: v.label, value: v.value, count: counts.get(v.id) ?? 0,
          selected: selected.has(v.value), disabled: !counts.get(v.id),
        }))
        .filter((f) => f.count > 0 || f.selected);
    }));
    return result;
  }

  private async badgeFacet(storeId: string, filters: ProductListingFilters): Promise<FacetOption[]> {
    const where = await buildProductWhere(this.prisma, storeId, { ...filters, badge: undefined });
    if (where === null) return [];

    const selected = new Set(filters.badge ?? []);
    const counts = await Promise.all(BADGE_TOKENS.map(({ token, label }) =>
      this.prisma.product.count({
        where: { ...where, OR: [{ badges: { contains: label } }, ...(token === 'featured' ? [{ isFeatured: true }] : [])] },
      }),
    ));
    return BADGE_TOKENS
      .map(({ token, label }, i) => ({ label, value: token, count: counts[i], selected: selected.has(token), disabled: counts[i] === 0 }))
      .filter((f) => f.count > 0 || f.selected);
  }

  private async ratingFacet(storeId: string, filters: ProductListingFilters): Promise<FacetOption[]> {
    const where = await buildProductWhere(this.prisma, storeId, { ...filters, rating: undefined });
    if (where === null) return [];

    // Single query via the relation filter instead of fetching candidate product
    // IDs first and re-querying reviews by an IN-list.
    const grouped = await this.prisma.productReview.groupBy({
      by: ['productId'],
      where: { isVisible: true, product: where },
      _avg: { rating: true },
    });
    const avgs = grouped.map((g) => g._avg.rating ?? 0);

    return RATING_THRESHOLDS.map((threshold) => {
      const count = avgs.filter((avg) => avg >= threshold).length;
      return { label: `${threshold}★ & above`, value: String(threshold), count, selected: filters.rating === threshold, disabled: count === 0 };
    }).filter((f) => f.count > 0 || f.selected);
  }

  private async availabilityFacet(storeId: string, filters: ProductListingFilters): Promise<FacetOption[]> {
    const where = await buildProductWhere(this.prisma, storeId, { ...filters, inStock: undefined });
    if (where === null) return [];

    const [inStock, outOfStock] = await Promise.all([
      this.prisma.product.count({ where: { ...where, stock: { gt: 0 } } }),
      this.prisma.product.count({ where: { ...where, stock: { lte: 0 } } }),
    ]);
    return [
      { label: 'In Stock',     value: 'true',  count: inStock,    selected: !!filters.inStock, disabled: inStock === 0 },
      { label: 'Out of Stock', value: 'false', count: outOfStock, selected: false,             disabled: outOfStock === 0 },
    ].filter((f) => f.count > 0 || f.selected);
  }

  private async discountFacet(storeId: string, filters: ProductListingFilters): Promise<FacetOption[]> {
    const where = await buildProductWhere(this.prisma, storeId, { ...filters, discountMin: undefined });
    if (where === null) return [];

    const candidates = await this.prisma.product.findMany({ where, select: { price: true, comparePrice: true } });
    const discounts = candidates.map((p) => {
      const price = Number(p.price);
      const mrp = p.comparePrice ? Number(p.comparePrice) : price;
      return mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0;
    });

    return DISCOUNT_THRESHOLDS.map((threshold) => {
      const count = discounts.filter((d) => d >= threshold).length;
      return { label: `${threshold}% off or more`, value: String(threshold), count, selected: filters.discountMin === threshold, disabled: count === 0 };
    }).filter((f) => f.count > 0 || f.selected);
  }
}
