import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

/**
 * The current store's currency code (StoreSettings.currency). Falls back to
 * INR — the platform default — while loading or when the signed-in role
 * can't read store settings.
 */
export function useStoreCurrency(): string {
  const { data } = useQuery({
    queryKey: ['store-settings'],
    queryFn: () => api.get('/stores/settings').then((r: { data?: unknown }) => r?.data ?? r),
    staleTime: 5 * 60_000,
    retry: false,
  });
  return (data as { currency?: string } | undefined)?.currency || 'INR';
}
