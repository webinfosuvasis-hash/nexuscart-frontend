/**
 * useProductReviews — React Query hook for the PDP reviews section
 * (paginated review list + rating histogram). `keepPreviousData` so paging
 * through reviews doesn't flash an empty list between pages.
 */
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { fetchProductReviews, ApiError, type FetchProductReviewsParams, type ProductReviewsResponse } from '@/lib/storefrontApi';

const STORE_ID = import.meta.env.VITE_STORE_ID ?? '';

export const PRODUCT_REVIEWS_QUERY_KEY = ['storefront', 'product-reviews'] as const;

interface UseProductReviewsResult {
  data:      ProductReviewsResponse | undefined;
  isLoading: boolean;
  isError:   boolean;
}

export function useProductReviews(id: string | undefined, params: FetchProductReviewsParams = {}): UseProductReviewsResult {
  const hasStoreId = Boolean(STORE_ID) && Boolean(id);

  const { data, isLoading, isError } = useQuery({
    queryKey:  [...PRODUCT_REVIEWS_QUERY_KEY, id, params],
    queryFn:   () => fetchProductReviews(id as string, params),
    enabled:   hasStoreId,
    staleTime: 60_000,
    gcTime:    600_000,
    retry:     (failureCount, err) => !(err instanceof ApiError && err.status === 404) && failureCount < 2,
    placeholderData: keepPreviousData,
  });

  return { data, isLoading: hasStoreId && isLoading, isError };
}
