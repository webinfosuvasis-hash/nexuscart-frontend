/**
 * storefrontApi.ts — Public API client for the Aurus storefront.
 *
 * Uses native fetch (no axios dependency in the storefront bundle).
 * All requests include the X-Store-Id header derived from VITE_STORE_ID.
 *
 * This client calls only PUBLIC endpoints (no JWT).
 * Admin API calls use a separate authenticated client (not this file).
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1';
const STORE_ID = import.meta.env.VITE_STORE_ID ?? '';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Raw section as returned by the storefront API */
export interface ApiStorefrontSection {
  id:          string;
  sectionType: string;
  sortOrder:   number;
  config:      Record<string, unknown>;
  /** Only present in preview mode (Phase S4) */
  status?:     string;
}

/** Full homepage response from GET /storefront/page-builder/homepage */
export interface ApiHomepageResponse {
  themeId:     string;
  pageType:    string;
  slug:        string;
  version:     number;
  publishedAt: string | null;
  sections:    ApiStorefrontSection[];
  /** True when the store has never been seeded via the Homepage Builder admin */
  _unseeded?:  boolean;
}

/** Wraps the NestJS TransformInterceptor shape */
interface NestResponse<T> {
  success:   boolean;
  data:      T;
  timestamp: string;
}

// ─── Core fetch wrapper ───────────────────────────────────────────────────────

/** Thrown on a non-2xx response. Carries the real HTTP status so callers can
 *  distinguish "not found" (404 — bad slug, render a not-found state) from
 *  other failures (500/network — render a retry-able error state) instead of
 *  treating every failure as an empty result set. */
export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  if (!STORE_ID) {
    throw new Error(
      '[storefrontApi] VITE_STORE_ID is not set. ' +
      'Add your store ID to .env.development.local to use the data-driven storefront.',
    );
  }

  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Store-Id':   STORE_ID,
      ...(options?.headers ?? {}),
    },
  });

  if (!res.ok) {
    throw new ApiError(res.status, `[storefrontApi] ${res.status} ${res.statusText} — ${url}`);
  }

  const body: NestResponse<T> = await res.json();
  return body.data;
}

// ─── Endpoints ────────────────────────────────────────────────────────────────

/**
 * GET /storefront/page-builder/homepage
 *
 * Returns the homepage structure + all LIVE enabled sections.
 * Cached by React Query (staleTime: 60s).
 */
export async function fetchHomepage(): Promise<ApiHomepageResponse> {
  return apiFetch<ApiHomepageResponse>('/storefront/page-builder/homepage');
}

/**
 * GET /storefront/page-builder/homepage?preview=true&token=<jwt>
 *
 * Returns LIVE + DRAFT sections for merchant preview.
 * Phase S4 implementation.
 */
export async function fetchHomepagePreview(token: string): Promise<ApiHomepageResponse> {
  return apiFetch<ApiHomepageResponse>(
    `/storefront/page-builder/homepage?preview=true&token=${encodeURIComponent(token)}`,
  );
}

// ─── Product + Category types ─────────────────────────────────────────────────

/** Minimal product shape returned by the public storefront products endpoint */
export interface StorefrontProduct {
  id:     string;
  name:   string;
  price:  number;
  mrp:    number;
  image:  string;
  badge?: string;
}

/** Minimal category shape returned by the public storefront categories endpoint */
export interface StorefrontCategory {
  id:   string;
  name: string;
  slug: string;
  img:  string;
}

export interface StorefrontProductsResponse {
  products: StorefrontProduct[];
}

export interface StorefrontCategoriesResponse {
  categories: StorefrontCategory[];
}

// ─── Product / Category endpoints ────────────────────────────────────────────

/** Query parameters for the /storefront/products endpoint */
export interface FetchProductsParams {
  tag?:          string;
  categorySlug?: string;
  ids?:          string;
  featured?:     boolean;
  limit?:        number;
}

/**
 * GET /storefront/products
 *
 * Fetches products for section rendering (Featured Products, Campaign Grid, etc.).
 * All params are optional; without any filter, returns newest products.
 *
 * Uses the shared resolver context so duplicate fetches across sections
 * can be short-circuited by the sharedCache.
 */
export async function fetchProducts(params: FetchProductsParams = {}): Promise<StorefrontProductsResponse> {
  const qs = new URLSearchParams();
  if (params.tag)          qs.set('tag',          params.tag);
  if (params.categorySlug) qs.set('categorySlug', params.categorySlug);
  if (params.ids)          qs.set('ids',          params.ids);
  if (params.featured)     qs.set('featured',     'true');
  if (params.limit)        qs.set('limit',        String(params.limit));
  const query = qs.toString();
  return apiFetch<StorefrontProductsResponse>(`/storefront/products${query ? `?${query}` : ''}`);
}

/**
 * GET /storefront/categories
 *
 * Fetches categories for section rendering (Collections, Category Icons, etc.).
 */
export async function fetchCategories(limit = 10): Promise<StorefrontCategoriesResponse> {
  return apiFetch<StorefrontCategoriesResponse>(`/storefront/categories?limit=${limit}`);
}

/**
 * Generic storefront fetcher — used by the Data Resolver layer.
 * Resolvers receive this as `context.fetchStorefront<T>(path)`.
 * The path is relative to the API base URL.
 */
export async function fetchStorefrontPath<T>(path: string): Promise<T> {
  return apiFetch<T>(path);
}

// ─── Product Listing Page (Phase P1) ──────────────────────────────────────────

export type SortOption =
  | 'featured' | 'newest' | 'price_asc' | 'price_desc'
  | 'popularity' | 'discount' | 'alphabetical';

/** Rich product shape returned by the listing endpoint — superset of StorefrontProduct. */
export interface ListingProduct {
  id:           string;
  name:         string;
  slug:         string;
  price:        number;
  mrp:          number;
  image:        string;
  hoverImage?:  string;
  badge?:       string;
  badges:       string[];
  discount:     number;
  rating:       number;
  reviewCount:  number;
  stock:        number;
  brand?:       { id: string; name: string; slug: string } | null;
  category?:    { id: string; name: string; slug: string } | null;
}

export interface Breadcrumb { label: string; url: string }

export interface ProductListingResponse {
  products:    ListingProduct[];
  pagination:  { page: number; limit: number; total: number; totalPages: number };
  breadcrumbs: Breadcrumb[];
  category:    { id: string; name: string; slug: string; description: string | null; seo: { title?: string; description?: string } } | null;
  sortOptions: { value: SortOption; label: string }[];
}

export interface FacetOption {
  label:    string;
  value:    string;
  count:    number;
  selected: boolean;
  disabled: boolean;
}

export interface PriceFacet { min: number; max: number; selectedMin?: number; selectedMax?: number }

export interface ProductFacets {
  category:     FacetOption[];
  brand:        FacetOption[];
  collection:   FacetOption[];
  price:        PriceFacet;
  color:        FacetOption[];
  size:         FacetOption[];
  badge:        FacetOption[];
  rating:       FacetOption[];
  availability: FacetOption[];
  discount:     FacetOption[];
  /** Dynamic attribute groups keyed by attribute slug — fabric, pattern, occasion, season, fit, ... */
  [attributeSlug: string]: FacetOption[] | PriceFacet;
}

/** Query parameters shared by the listing and facets endpoints. */
export interface ListingQueryParams {
  categorySlug?:   string;
  brandSlug?:      string;
  collectionSlug?: string;
  /** Comma-separated product ids — short-circuits all other filters (used for related/recently-viewed lookups). */
  ids?:            string;
  q?:              string;
  priceMin?:       number;
  priceMax?:       number;
  color?:          string[];
  size?:           string[];
  /** Attribute slug → selected value labels, e.g. { fabric: ['Silk'] } */
  attr?:           Record<string, string[]>;
  badge?:          string[];
  inStock?:        boolean;
  discountMin?:    number;
  rating?:         number;
  sortBy?:         SortOption;
  page?:           number;
  limit?:          number;
}

function buildListingQueryString(params: ListingQueryParams): string {
  const qs = new URLSearchParams();
  if (params.categorySlug)   qs.set('categorySlug', params.categorySlug);
  if (params.brandSlug)      qs.set('brandSlug', params.brandSlug);
  if (params.collectionSlug) qs.set('collectionSlug', params.collectionSlug);
  if (params.ids)            qs.set('ids', params.ids);
  if (params.q)               qs.set('q', params.q);
  if (params.priceMin !== undefined) qs.set('priceMin', String(params.priceMin));
  if (params.priceMax !== undefined) qs.set('priceMax', String(params.priceMax));
  if (params.color?.length)  qs.set('color', params.color.join(','));
  if (params.size?.length)   qs.set('size', params.size.join(','));
  if (params.badge?.length)  qs.set('badge', params.badge.join(','));
  if (params.inStock)        qs.set('inStock', 'true');
  if (params.discountMin !== undefined) qs.set('discountMin', String(params.discountMin));
  if (params.rating !== undefined)      qs.set('rating', String(params.rating));
  if (params.sortBy)         qs.set('sortBy', params.sortBy);
  if (params.page)           qs.set('page', String(params.page));
  if (params.limit)          qs.set('limit', String(params.limit));
  if (params.attr) {
    for (const [slug, values] of Object.entries(params.attr)) {
      if (values?.length) qs.set(`attr[${slug}]`, values.join(','));
    }
  }
  return qs.toString();
}

/**
 * GET /storefront/products — full Product Listing Page query (category/
 * brand/collection scoping, price/color/size/attribute/badge/rating/
 * discount/availability filters, keyword search, sort, pagination).
 */
export async function fetchProductListing(params: ListingQueryParams = {}): Promise<ProductListingResponse> {
  const query = buildListingQueryString(params);
  return apiFetch<ProductListingResponse>(`/storefront/products${query ? `?${query}` : ''}`);
}

/** GET /storefront/products/facets — dynamic faceted filter metadata for the current filter context. */
export async function fetchProductFacets(params: ListingQueryParams = {}): Promise<ProductFacets> {
  const query = buildListingQueryString(params);
  return apiFetch<ProductFacets>(`/storefront/products/facets${query ? `?${query}` : ''}`);
}

export interface StorefrontBrand { id: string; name: string; slug: string; logo: string | null; isFeatured: boolean }
export interface StorefrontCollectionListItem { id: string; name: string; slug: string; image: string | null; isFeatured: boolean }

/** GET /storefront/brands — active brands for the store. */
export async function fetchBrands(limit = 30): Promise<{ brands: StorefrontBrand[] }> {
  return apiFetch<{ brands: StorefrontBrand[] }>(`/storefront/brands?limit=${limit}`);
}

/** GET /storefront/collections — active collections for the store. */
export async function fetchCollectionsList(limit = 30): Promise<{ collections: StorefrontCollectionListItem[] }> {
  return apiFetch<{ collections: StorefrontCollectionListItem[] }>(`/storefront/collections?limit=${limit}`);
}

// ─── Product Detail Page (Phase P2) ───────────────────────────────────────────

export interface ProductVariant {
  id:      string;
  sku:     string;
  price:   number;
  mrp:     number;
  stock:   number;
  image?:  string;
  options: Record<string, string>;
}

export interface ProductAttributeGroup {
  slug:   string;
  name:   string;
  values: { value: string; label: string }[];
}

export interface ProductDetailResponse {
  id:               string;
  name:             string;
  slug:             string;
  sku:              string;
  description:      string | null;
  shortDescription: string | null;
  price:            number;
  mrp:              number;
  discount:         number;
  images:           string[];
  badges:           string[];
  stock:            number;
  rating:           number;
  reviewCount:      number;
  brand:            { id: string; name: string; slug: string } | null;
  category:         { id: string; name: string; slug: string } | null;
  variants:         ProductVariant[];
  attributes:       ProductAttributeGroup[];
  seo:              { title?: string; description?: string } | null;
  breadcrumbs:      Breadcrumb[];
  relatedProducts:  ListingProduct[];
  similarProducts:  ListingProduct[];
}

/** GET /storefront/products/:id — full Product Detail Page payload. */
export async function fetchProductDetail(id: string): Promise<ProductDetailResponse> {
  return apiFetch<ProductDetailResponse>(`/storefront/products/${encodeURIComponent(id)}`);
}

export interface ProductReview {
  id:         string;
  rating:     number;
  title:      string | null;
  body:       string | null;
  isVerified: boolean;
  createdAt:  string;
  author:     string;
}

export interface ProductReviewsResponse {
  reviews:         ProductReview[];
  pagination:      { page: number; limit: number; total: number; totalPages: number };
  average:         number;
  total:           number;
  ratingBreakdown: Record<'5' | '4' | '3' | '2' | '1', number>;
}

export interface FetchProductReviewsParams {
  page?:   number;
  limit?:  number;
  rating?: number;
}

/** GET /storefront/products/:id/reviews — paginated, read-only reviews + rating histogram. */
export async function fetchProductReviews(
  id: string,
  params: FetchProductReviewsParams = {},
): Promise<ProductReviewsResponse> {
  const qs = new URLSearchParams();
  if (params.page)   qs.set('page', String(params.page));
  if (params.limit)  qs.set('limit', String(params.limit));
  if (params.rating) qs.set('rating', String(params.rating));
  const query = qs.toString();
  return apiFetch<ProductReviewsResponse>(`/storefront/products/${encodeURIComponent(id)}/reviews${query ? `?${query}` : ''}`);
}
