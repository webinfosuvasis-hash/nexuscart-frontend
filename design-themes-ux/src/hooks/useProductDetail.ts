/**
 * useProductDetail — React Query hook for the Product Detail Page's full
 * product payload (gallery, variants, attributes, related/similar products,
 * breadcrumbs, SEO). Same conventions as useProductListing: store-ID gating,
 * staleTime/gcTime, retry-skip-on-404 (renders a Not Found state instead of
 * retrying a dead id), exponential backoff on transient failures.
 */
import { useQuery } from '@tanstack/react-query';
import { fetchProductDetail, ApiError, type ProductDetailResponse } from '@/lib/storefrontApi';

const STORE_ID = import.meta.env.VITE_STORE_ID ?? '';

export const PRODUCT_DETAIL_QUERY_KEY = ['storefront', 'product-detail'] as const;

interface UseProductDetailResult {
  data:      ProductDetailResponse | undefined;
  isLoading: boolean;
  isError:   boolean;
  error:     Error | null;
  refetch:   () => void;
}

export function useProductDetail(id: string | undefined): UseProductDetailResult {
  const hasStoreId = Boolean(STORE_ID) && Boolean(id);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey:  [...PRODUCT_DETAIL_QUERY_KEY, id],
    queryFn:   () => fetchProductDetail(id as string),
    enabled:   hasStoreId,
    staleTime: 60_000,
    gcTime:    600_000,
    retry:     (failureCount, err) => !(err instanceof ApiError && err.status === 404) && failureCount < 2,
    retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 10_000),
  });

  return { data, isLoading: hasStoreId && isLoading, isError, error: error as Error | null, refetch: () => { void refetch(); } };
}
