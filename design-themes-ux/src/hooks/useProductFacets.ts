/**
 * useProductFacets — React Query hook for dynamic faceted filter metadata
 * (category, brand, collection, price, color, size, fabric, occasion,
 * pattern, season, fit, badge, rating, availability, discount).
 *
 * Longer staleTime than the product list itself — facet counts only need
 * to react to filter changes, not to be as fresh as the product grid.
 */
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { fetchProductFacets, ApiError, type ListingQueryParams, type ProductFacets } from '@/lib/storefrontApi';

const STORE_ID = import.meta.env.VITE_STORE_ID ?? '';

export const PRODUCT_FACETS_QUERY_KEY = ['storefront', 'product-facets'] as const;

interface UseProductFacetsResult {
  data:      ProductFacets | undefined;
  isLoading: boolean;
  isError:   boolean;
}

export function useProductFacets(params: ListingQueryParams): UseProductFacetsResult {
  const hasStoreId = Boolean(STORE_ID);

  const { data, isLoading, isError } = useQuery({
    queryKey:  [...PRODUCT_FACETS_QUERY_KEY, params],
    queryFn:   () => fetchProductFacets(params),
    enabled:   hasStoreId,
    staleTime: 120_000,
    gcTime:    600_000,
    retry:     (failureCount, err) => !(err instanceof ApiError && err.status === 404) && failureCount < 2,
    placeholderData: keepPreviousData,
  });

  return { data, isLoading: hasStoreId && isLoading, isError };
}
