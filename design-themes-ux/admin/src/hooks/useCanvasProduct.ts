/**
 * useCanvasProduct — P6
 *
 * Fetches a single product for the editor canvas when on the product page.
 * Priority:
 *   1. section.settings.product (if a specific product is bound)
 *   2. First active product in the store
 */

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import type { Product } from '@/types';

function unwrap(r: unknown): Product | null {
  if (!r) return null;
  const w = r as Record<string, unknown>;
  return (w.data ?? r) as Product;
}

export function useCanvasProduct(productId?: string | null): {
  product:   Product | null;
  isLoading: boolean;
} {
  // If a specific productId is set (from binding), fetch that product
  const singleQuery = useQuery({
    queryKey:  ['canvas-product', productId],
    queryFn:   () => api.get(`/products/${productId}`).then(unwrap),
    enabled:   !!productId && productId.length >= 20,
    staleTime: 30_000,
    retry:     1,
  });

  // Otherwise fetch the first active product
  const listQuery = useQuery({
    queryKey:  ['canvas-product-first'],
    queryFn:   () =>
      api.get('/products', { params: { limit: 1, status: 'ACTIVE' } })
        .then((r: any) => {
          const items = r?.data ?? r ?? [];
          return Array.isArray(items) && items.length > 0 ? items[0] as Product : null;
        }),
    enabled:   !productId || productId.length < 20,
    staleTime: 60_000,
    retry:     1,
  });

  if (productId && productId.length >= 20) {
    return { product: singleQuery.data ?? null, isLoading: singleQuery.isLoading };
  }
  return { product: listQuery.data ?? null, isLoading: listQuery.isLoading };
}
