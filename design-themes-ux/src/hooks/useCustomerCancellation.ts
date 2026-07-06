import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import * as api from '@/lib/customerCancellationApi';
import { CustomerAuthApiError } from '@/lib/customerAuthApi';

// A 404 here is definitive (order doesn't exist / isn't this customer's) —
// matches useCart.ts / useCustomerOrders.ts / useCustomerShipment.ts's convention.
function noRetryOn404(count: number, err: unknown): boolean {
  if (err instanceof CustomerAuthApiError && err.status === 404) return false;
  return count < 2;
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof api.CustomerAuthApiError ? err.message : fallback;
}

export function useCancellationStatus(orderId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['customer-order-cancellation', orderId],
    queryFn: () => api.getCancellationStatus(orderId!),
    enabled: enabled && !!orderId,
    staleTime: 30_000,
    gcTime: 300_000,
    retry: noRetryOn404,
  });
}

export function useRefundStatus(orderId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['customer-order-refund', orderId],
    queryFn: () => api.getRefundStatus(orderId!),
    enabled: enabled && !!orderId,
    staleTime: 30_000,
    gcTime: 300_000,
    retry: noRetryOn404,
  });
}

export function useCancelOrder(orderId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reason: string) => api.cancelOrder(orderId!, reason),
    onSuccess: (result) => {
      queryClient.setQueryData(['customer-order-cancellation', orderId], result);
      queryClient.invalidateQueries({ queryKey: ['customer-order-refund', orderId] });
      queryClient.invalidateQueries({ queryKey: ['customer-order', orderId] });
      queryClient.invalidateQueries({ queryKey: ['customer-orders'] });
      toast.success('Order cancelled');
    },
    onError: (err) => toast.error(errorMessage(err, 'Failed to cancel order')),
  });
}

export { errorMessage as cancellationErrorMessage };
