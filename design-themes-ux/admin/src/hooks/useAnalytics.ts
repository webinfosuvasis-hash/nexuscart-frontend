import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

const fetch = (path: string, params?: Record<string, any>) =>
  api.get(path, { params }).then((r: any) => r?.data ?? r);

export function useDashboardSummary(period = '30d') {
  return useQuery({
    queryKey: ['analytics', 'summary', period],
    queryFn: () => fetch('/analytics/summary', { period }),
    staleTime: 60_000,
  });
}

export function useRevenueTrend(period = '30d') {
  return useQuery({
    queryKey: ['analytics', 'revenue-trend', period],
    queryFn: () => fetch('/analytics/revenue-trend', { period }),
    staleTime: 60_000,
  });
}

export function useTopProducts(limit = 5) {
  return useQuery({
    queryKey: ['analytics', 'top-products', limit],
    queryFn: () => fetch('/analytics/top-products', { limit }),
    staleTime: 60_000,
  });
}

export function useConversionFunnel(period = '30d') {
  return useQuery({
    queryKey: ['analytics', 'conversion-funnel', period],
    queryFn: () => fetch('/analytics/conversion-funnel', { period }),
    staleTime: 60_000,
  });
}

export function useTrafficSources(period = '30d') {
  return useQuery({
    queryKey: ['analytics', 'traffic-sources', period],
    queryFn: () => fetch('/analytics/traffic-sources', { period }),
    staleTime: 60_000,
  });
}
