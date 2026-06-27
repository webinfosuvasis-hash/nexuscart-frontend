/**
 * useCanvasProducts — P2: Real product data in canvas
 *
 * Fetches real store products for the editor canvas.
 * Used by FeaturedCollectionSection (and future ProductGrid sections)
 * so merchants see their actual catalog while designing.
 *
 * Data flow:
 *   section.settings.collection (collection picker value)
 *     → if real cuid ID → GET /products?collectionId=xxx&limit=N&status=ACTIVE
 *     → otherwise       → GET /products?limit=N&status=ACTIVE  (all active products)
 *   → NestJS TransformInterceptor: { success, data: Product[], meta }
 *   → unwrap: res?.data ?? res
 *   → return CanvasProduct[]
 *
 * Caching: 30-second stale time — editor doesn't need real-time updates,
 * but changes in the admin panel should be reflected after a short delay.
 */

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

// ─── Shape ────────────────────────────────────────────────────────────────────

export interface CanvasProduct {
  id:            string;
  name:          string;
  price:         number;
  comparePrice?: number;
  image?:        string;   // primary image URL (may be null for new products)
  images?:       string[];
  rating?:       number;
  reviewCount?:  number;
  slug?:         string;
  status?:       string;
}

export interface UseCanvasProductsOptions {
  /** Collection binding: section.settings.collection */
  collectionId?: unknown;
  /** Category binding: section.settings.category */
  categoryId?:   unknown;
  /** Product binding: section.settings.product — shows one featured product */
  productId?:    unknown;
  /** Maximum number of products to show. Default: 4. */
  limit?:        number;
}

export interface UseCanvasProductsResult {
  products:  CanvasProduct[];
  isLoading: boolean;
  /** True when fetch is complete but the store has no products matching the criteria. */
  isEmpty:   boolean;
  /** True when the API call failed — canvas shows a degraded state, not a crash. */
  isError:   boolean;
}

// ─── ID guard ─────────────────────────────────────────────────────────────────
// cuid() values are ≥ 25 chars (e.g. clxxxxxxxxxxxxxxxxxxxxxxx).
// Mock collection slugs ('all', 'summer-sale') are ≤ 15 chars.
// This distinguishes real IDs from demo values without a regex.

export function isRealCollectionId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length >= 20;
}

// ─── Price formatter ──────────────────────────────────────────────────────────
// Default to INR (store default in StoreSettings). P4 will thread store
// currency through RenderContext; for now INR is the safe fallback.

export function formatCanvasPrice(price: number, currency = 'INR'): string {
  try {
    return new Intl.NumberFormat('en-IN', {
      style:                 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(price);
  } catch {
    return `₹${price}`;
  }
}

// ─── API unwrapper ────────────────────────────────────────────────────────────
// NestJS TransformInterceptor: { success: true, data: T, meta?: ... }
// api.ts interceptor returns res.data (the HTTP body), so callers receive
// the wrapper object. We need the inner data array.

export function unwrapProducts(res: unknown): CanvasProduct[] {
  if (!res) return [];

  const maybeWrapped = res as Record<string, unknown>;

  // Wrapped: { success, data: Product[] }
  if (Array.isArray(maybeWrapped.data)) return maybeWrapped.data as CanvasProduct[];

  // Already an array (direct response)
  if (Array.isArray(res)) return res as CanvasProduct[];

  // Paginated: { items: Product[] } or { products: Product[] }
  if (Array.isArray(maybeWrapped.items))    return maybeWrapped.items    as CanvasProduct[];
  if (Array.isArray(maybeWrapped.products)) return maybeWrapped.products as CanvasProduct[];

  return [];
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

// Determine if a value is a real persisted cuid (vs mock slug or undefined)
function isRealId(value: unknown): value is string {
  return isRealCollectionId(value);   // reuse the same ≥20-char check
}

export function useCanvasProducts({
  collectionId,
  categoryId,
  productId,
  limit = 4,
}: UseCanvasProductsOptions = {}): UseCanvasProductsResult {

  // Single-product fetch: GET /products/{id}
  // Only fires when productId is set (enabled flag).
  const singleProductQuery = useQuery({
    queryKey:  ['canvas-product-single', productId],
    queryFn:   async (): Promise<CanvasProduct[]> => {
      const res = await api.get(`/products/${productId}`);
      // Single product endpoint returns the product directly (not an array)
      const item = (res as any)?.data ?? res;
      return item && typeof item === 'object' ? [item as CanvasProduct] : [];
    },
    enabled:   isRealId(productId),
    staleTime: 30_000,
    retry:     1,
  });

  // List fetch: GET /products?status=ACTIVE[&collectionId=X][&categoryId=Y]
  const params: Record<string, unknown> = {
    limit,
    status: 'ACTIVE',
  };
  if (isRealId(collectionId)) params.collectionId = collectionId;
  if (isRealId(categoryId))   params.categoryId   = categoryId;

  const listQuery = useQuery({
    queryKey:  ['canvas-products', params],
    queryFn:   async (): Promise<CanvasProduct[]> => {
      const res = await api.get('/products', { params });
      return unwrapProducts(res).slice(0, limit);
    },
    enabled:   !isRealId(productId),   // list query only when not in single-product mode
    staleTime: 30_000,
    retry:     1,
  });

  // Resolve which query to surface
  const activeQuery = isRealId(productId) ? singleProductQuery : listQuery;
  const products    = activeQuery.data ?? [];

  return {
    products,
    isLoading: activeQuery.isLoading,
    isEmpty:   !activeQuery.isLoading && !activeQuery.isError && products.length === 0,
    isError:   activeQuery.isError && !activeQuery.isLoading,
  };
}
