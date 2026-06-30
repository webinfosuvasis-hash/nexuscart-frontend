/**
 * useProductListing — React Query hook for the Product Listing Page's
 * product grid + pagination + breadcrumbs + SEO metadata.
 *
 * Follows the same conventions as useStorefrontHomepage: store-ID gating,
 * staleTime/gcTime/retry. Uses `placeholderData: keepPreviousData` so
 * paginating or changing a filter doesn't flash an empty grid — the
 * previous page's products stay visible (slightly dimmed by the caller)
 * until the new page resolves.
 */
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { fetchProductListing, ApiError, type ListingQueryParams, type ProductListingResponse } from '@/lib/storefrontApi';

const STORE_ID = import.meta.env.VITE_STORE_ID ?? '';

export const PRODUCT_LISTING_QUERY_KEY = ['storefront', 'product-listing'] as const;

interface UseProductListingResult {
  data:      ProductListingResponse | undefined;
  isLoading: boolean;
  isFetching: boolean;
  isError:   boolean;
  error:     Error | null;
  refetch:   () => void;
}

export function useProductListing(params: ListingQueryParams): UseProductListingResult {
  const hasStoreId = Boolean(STORE_ID);

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey:  [...PRODUCT_LISTING_QUERY_KEY, params],
    queryFn:   () => fetchProductListing(params),
    enabled:   hasStoreId,
    staleTime: 60_000,
    gcTime:    600_000,
    retry:     (failureCount, err) => !(err instanceof ApiError && err.status === 404) && failureCount < 2,
    retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 10_000),
    placeholderData: keepPreviousData,
  });

  return { data, isLoading: hasStoreId && isLoading, isFetching, isError, error: error as Error | null, refetch: () => { void refetch(); } };
}
