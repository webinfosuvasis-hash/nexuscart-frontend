import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiParam } from '@nestjs/swagger';
import { StorefrontProductsService } from './storefront-products.service';
import { StorefrontFacetsService } from './storefront-facets.service';
import { StorefrontProductDetailService } from './storefront-product-detail.service';
import { StorefrontReviewsService } from './storefront-reviews.service';
import { CurrentStore } from '@/common/decorators/current-store.decorator';
import { Public } from '@/common/decorators/public.decorator';
import { SortOption, parseCsv } from '@/common/catalog/product-query.util';

/**
 * StorefrontProductsController — public product, category, brand and
 * collection data for the storefront.
 *
 * Routes (all under /storefront prefix from module):
 *   GET /api/v1/storefront/products             — listing + homepage sections
 *   GET /api/v1/storefront/products/facets      — faceted filter metadata (Phase P1)
 *   GET /api/v1/storefront/products/:id         — full product detail (Phase P2)
 *   GET /api/v1/storefront/products/:id/reviews — paginated reviews (Phase P2)
 *   GET /api/v1/storefront/categories
 *   GET /api/v1/storefront/brands               (Phase P1)
 *   GET /api/v1/storefront/collections          (Phase P1)
 *
 * No authentication required — all data is store-scoped public catalog.
 * Store isolation is enforced via X-Store-Id header (StoreContextMiddleware).
 */
@ApiTags('Storefront — Products')
@Public()
@Controller('storefront')
export class StorefrontProductsController {
  constructor(
    private readonly service:       StorefrontProductsService,
    private readonly facetsService: StorefrontFacetsService,
    private readonly detailService: StorefrontProductDetailService,
    private readonly reviewsService: StorefrontReviewsService,
  ) {}

  /**
   * GET /api/v1/storefront/products
   *
   * Serves both the lightweight homepage-section use case (tag /
   * categorySlug / ids / featured / limit) and the full Product Listing
   * Page use case (brand/collection/price/color/size/attributes/rating/
   * discount/search/sort/pagination) — response is additive, so existing
   * callers reading only `data.products` are unaffected.
   */
  @Get('products')
  @ApiOperation({ summary: 'Fetch products — homepage sections or full listing page (public)' })
  @ApiQuery({ name: 'tag',          required: false })
  @ApiQuery({ name: 'categorySlug', required: false })
  @ApiQuery({ name: 'brandSlug',    required: false })
  @ApiQuery({ name: 'collectionSlug', required: false })
  @ApiQuery({ name: 'ids',          required: false })
  @ApiQuery({ name: 'q',            required: false })
  @ApiQuery({ name: 'featured',     required: false, type: Boolean })
  @ApiQuery({ name: 'priceMin',     required: false, type: Number })
  @ApiQuery({ name: 'priceMax',     required: false, type: Number })
  @ApiQuery({ name: 'color',        required: false, description: 'Comma-separated colors' })
  @ApiQuery({ name: 'size',         required: false, description: 'Comma-separated sizes' })
  @ApiQuery({ name: 'badge',        required: false, description: 'Comma-separated: featured,new-arrival,best-seller,trending' })
  @ApiQuery({ name: 'inStock',      required: false, type: Boolean })
  @ApiQuery({ name: 'discountMin',  required: false, type: Number })
  @ApiQuery({ name: 'rating',       required: false, type: Number })
  @ApiQuery({ name: 'sortBy',       required: false })
  @ApiQuery({ name: 'page',         required: false, type: Number })
  @ApiQuery({ name: 'limit',        required: false, type: Number })
  getProducts(
    @CurrentStore(false) storeId: string,
    @Query() query: Record<string, any>,
  ) {
    return this.service.getProducts(storeId, {
      tag:            query.tag,
      categorySlug:   query.categorySlug,
      brandSlug:      query.brandSlug,
      collectionSlug: query.collectionSlug,
      ids:            query.ids,
      q:              query.q,
      featured:       query.featured === 'true',
      priceMin:       query.priceMin ? Number(query.priceMin) : undefined,
      priceMax:       query.priceMax ? Number(query.priceMax) : undefined,
      color:          parseCsv(query.color),
      size:           parseCsv(query.size),
      attr:           this.parseAttrParam(query),
      badge:          parseCsv(query.badge),
      inStock:        query.inStock === 'true',
      discountMin:    query.discountMin ? Number(query.discountMin) : undefined,
      rating:         query.rating ? Number(query.rating) : undefined,
      sortBy:         query.sortBy as SortOption | undefined,
      page:           query.page ? Number(query.page) : 1,
      limit:          query.limit ? Math.min(Number(query.limit), 60) : 12,
    });
  }

  /**
   * GET /api/v1/storefront/products/facets
   *
   * Returns dynamic facet buckets (category, brand, price, color, size,
   * fabric, material, occasion, collection, badge, rating, availability,
   * discount) computed from the current catalog + currently-applied
   * filters — never hardcoded.
   */
  @Get('products/facets')
  @ApiOperation({ summary: 'Fetch faceted filter metadata for the listing page (public)' })
  getFacets(
    @CurrentStore(false) storeId: string,
    @Query() query: Record<string, any>,
  ) {
    return this.facetsService.getFacets(storeId, {
      categorySlug:   query.categorySlug,
      brandSlug:      query.brandSlug,
      collectionSlug: query.collectionSlug,
      q:              query.q,
      priceMin:       query.priceMin ? Number(query.priceMin) : undefined,
      priceMax:       query.priceMax ? Number(query.priceMax) : undefined,
      color:          parseCsv(query.color),
      size:           parseCsv(query.size),
      attr:           this.parseAttrParam(query),
      badge:          parseCsv(query.badge),
      inStock:        query.inStock === 'true',
      rating:         query.rating ? Number(query.rating) : undefined,
    });
  }

  /**
   * GET /api/v1/storefront/products/:id
   *
   * Full Product Detail Page payload — description, images, variants,
   * attributes, related/similar products, breadcrumbs, SEO. 404s if the id
   * doesn't resolve to an active, non-deleted product in this store.
   *
   * Declared after `products/facets` so that static path isn't shadowed by
   * this `:id` wildcard.
   */
  @Get('products/:id')
  @ApiOperation({ summary: 'Fetch full product detail for the Product Detail Page (public)' })
  @ApiParam({ name: 'id', description: 'Product id (cuid)' })
  getProductDetail(
    @CurrentStore(false) storeId: string,
    @Param('id') id: string,
  ) {
    return this.detailService.getProductDetail(storeId, id);
  }

  /** GET /api/v1/storefront/products/:id/reviews — paginated, read-only review list + rating histogram (public). */
  @Get('products/:id/reviews')
  @ApiOperation({ summary: 'Fetch paginated reviews + rating breakdown for a product (public)' })
  @ApiParam({ name: 'id', description: 'Product id (cuid)' })
  @ApiQuery({ name: 'page',   required: false, type: Number })
  @ApiQuery({ name: 'limit',  required: false, type: Number })
  @ApiQuery({ name: 'rating', required: false, type: Number })
  getProductReviews(
    @CurrentStore(false) storeId: string,
    @Param('id') id: string,
    @Query() query: Record<string, any>,
  ) {
    return this.reviewsService.getReviews(storeId, id, {
      page:   query.page ? Number(query.page) : 1,
      limit:  query.limit ? Number(query.limit) : 6,
      rating: query.rating ? Number(query.rating) : undefined,
    });
  }

  /**
   * GET /api/v1/storefront/categories
   *
   * Returns active categories for storefront section rendering.
   * Used by the Collections section and future category-icon sections.
   *
   * Query params:
   *   limit  Max categories to return (default 10, max 30)
   */
  @Get('categories')
  @ApiOperation({ summary: 'Fetch categories for storefront section rendering (public)' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getCategories(
    @CurrentStore(false) storeId: string,
    @Query('limit')      limit?:  string,
  ) {
    return this.service.getCategories(
      storeId,
      limit ? Math.min(Number(limit), 30) : 10,
    );
  }

  /** GET /api/v1/storefront/brands — active brands (public). */
  @Get('brands')
  @ApiOperation({ summary: 'Fetch active brands for the storefront (public)' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getBrands(
    @CurrentStore(false) storeId: string,
    @Query('limit')      limit?:  string,
  ) {
    return this.service.getBrands(storeId, limit ? Number(limit) : 30);
  }

  /** GET /api/v1/storefront/collections — active collections (public). */
  @Get('collections')
  @ApiOperation({ summary: 'Fetch active collections for the storefront (public)' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getCollectionsList(
    @CurrentStore(false) storeId: string,
    @Query('limit')      limit?:  string,
  ) {
    return this.service.getCollectionsList(storeId, limit ? Number(limit) : 30);
  }

  /**
   * Parses bracket-notation attribute filters out of the flat query object.
   * Express's default query parser here does not nest `attr[fabric]=Silk`
   * into `{ attr: { fabric: 'Silk' } }` — it arrives as a single literal key
   * `"attr[fabric]"` — so this scans all query keys for that pattern
   * directly rather than relying on parser-level nesting.
   */
  private parseAttrParam(query: Record<string, any>): Record<string, string[]> | undefined {
    const result: Record<string, string[]> = {};
    for (const [key, value] of Object.entries(query)) {
      const match = /^attr\[(.+)\]$/.exec(key);
      if (!match) continue;
      const values = parseCsv(typeof value === 'string' ? value : undefined);
      if (values?.length) result[match[1]] = values;
    }
    return Object.keys(result).length ? result : undefined;
  }
}
