/**
 * useStorefrontMenu — Phase 9 (Dynamic Storefront Navigation).
 *
 * Fetches the store's live, published navigation tree via the new public
 * StorefrontMenuController. Mirrors useStorefrontHomepage's conventions
 * (staleTime matched to the backend's own cache TTL, gcTime, retry/backoff,
 * graceful no-store-id skip) — no new fetching pattern introduced.
 */

import { useQuery } from '@tanstack/react-query';
import { fetchDefaultMenu, fetchMenuByHandle, type ResolvedMenu } from '@/lib/storefrontMenuApi';

const STORE_ID = import.meta.env.VITE_STORE_ID ?? '';

interface UseStorefrontMenuResult {
  menu: ResolvedMenu | null;
  isLoading: boolean;
  isError: boolean;
}

/** The store's default navigation menu (resolved server-side via HeaderConfig). */
export function useStorefrontMenu(): UseStorefrontMenuResult {
  const hasStoreId = Boolean(STORE_ID);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['storefront', 'menu', 'default'],
    queryFn: fetchDefaultMenu,
    enabled: hasStoreId,
    staleTime: 300_000, // matches CACHE_TTL.MENU on the backend
    gcTime: 600_000,
    retry: 1,
    retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 10_000),
  });

  return { menu: data ?? null, isLoading: hasStoreId && isLoading, isError };
}

/** A specific menu by handle (e.g. a footer menu) — same caching/backoff conventions. */
export function useStorefrontMenuByHandle(handle: string | undefined): UseStorefrontMenuResult {
  const hasStoreId = Boolean(STORE_ID) && !!handle;

  const { data, isLoading, isError } = useQuery({
    queryKey: ['storefront', 'menu', handle],
    queryFn: () => fetchMenuByHandle(handle!),
    enabled: hasStoreId,
    staleTime: 300_000,
    gcTime: 600_000,
    retry: 1,
    retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 10_000),
  });

  return { menu: data ?? null, isLoading: hasStoreId && isLoading, isError };
}
