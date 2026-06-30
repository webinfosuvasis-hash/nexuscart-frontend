/**
 * useStorefrontHomepage — React Query hook for the homepage page structure.
 *
 * Fetches GET /storefront/page-builder/homepage and caches the result.
 * Stale after 60 seconds; React Query refetches in the background.
 *
 * All section resolvers and the SectionRenderer consume data from this hook
 * via the React Query cache — no additional network calls for the page structure.
 *
 * Returns null when VITE_STORE_ID is not set (dev environment, no store configured).
 */

import { useQuery } from '@tanstack/react-query';
import { fetchHomepage, type ApiHomepageResponse } from '@/lib/storefrontApi';

/** React Query key for the homepage — stable across the app */
export const STOREFRONT_HOMEPAGE_QUERY_KEY = ['storefront', 'homepage'] as const;

interface UseStorefrontHomepageResult {
  /** The full homepage response, or null if not yet loaded */
  homepage:  ApiHomepageResponse | null;
  /** True while the initial fetch is in progress */
  isLoading: boolean;
  /** True if the fetch failed */
  isError:   boolean;
  /** The fetch error, if any */
  error:     Error | null;
  /** True when VITE_STORE_ID is missing — V2 should fall back to V1 */
  isMissingStoreId: boolean;
}

const STORE_ID = import.meta.env.VITE_STORE_ID ?? '';

export function useStorefrontHomepage(): UseStorefrontHomepageResult {
  const hasStoreId = Boolean(STORE_ID);

  const {
    data,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: STOREFRONT_HOMEPAGE_QUERY_KEY,
    queryFn:  fetchHomepage,
    enabled:  hasStoreId,   // skip query entirely if store ID is missing
    staleTime: 60_000,      // 60 s — CDN TTL should match
    gcTime:    600_000,     // 10 min in memory
    retry:     2,
    retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 10_000),
  });

  return {
    homepage:         data ?? null,
    isLoading:        hasStoreId && isLoading,
    isError,
    error:            error as Error | null,
    isMissingStoreId: !hasStoreId,
  };
}
