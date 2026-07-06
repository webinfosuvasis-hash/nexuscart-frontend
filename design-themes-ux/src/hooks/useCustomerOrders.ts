import { useQuery } from '@tanstack/react-query';
import * as api from '@/lib/customerOrdersApi';
import { CustomerAuthApiError } from '@/lib/customerAuthApi';

// A 404 here is definitive (order doesn't exist / isn't this customer's) —
// matches useCart.ts's convention of not retrying non-retryable statuses.
function noRetryOn404(count: number, err: unknown): boolean {
  if (err instanceof CustomerAuthApiError && err.status === 404) return false;
  return count < 2;
}

export function useOrders(params: api.ListOrdersParams, enabled: boolean) {
  return useQuery({
    queryKey: ['customer-orders', params],
    queryFn: () => api.listOrders(params),
    enabled,
    staleTime: 30_000,
    gcTime: 300_000,
    retry: noRetryOn404,
  });
}

export function useOrderDetails(orderId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['customer-order', orderId],
    queryFn: () => api.getOrderDetails(orderId!),
    enabled: enabled && !!orderId,
    staleTime: 30_000,
    gcTime: 300_000,
    retry: noRetryOn404,
  });
}
