import { useQuery } from '@tanstack/react-query';
import * as api from '@/lib/customerShipmentApi';
import { CustomerAuthApiError } from '@/lib/customerAuthApi';

// A 404 here is definitive (order doesn't exist / isn't this customer's) —
// matches useCart.ts / useCustomerOrders.ts's convention.
function noRetryOn404(count: number, err: unknown): boolean {
  if (err instanceof CustomerAuthApiError && err.status === 404) return false;
  return count < 2;
}

export function useTracking(orderId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['customer-order-tracking', orderId],
    queryFn: () => api.getTracking(orderId!),
    enabled: enabled && !!orderId,
    staleTime: 30_000,
    gcTime: 300_000,
    retry: noRetryOn404,
  });
}

export function useShipmentDetails(orderId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['customer-order-shipment', orderId],
    queryFn: () => api.getShipmentDetails(orderId!),
    enabled: enabled && !!orderId,
    staleTime: 30_000,
    gcTime: 300_000,
    retry: noRetryOn404,
  });
}
