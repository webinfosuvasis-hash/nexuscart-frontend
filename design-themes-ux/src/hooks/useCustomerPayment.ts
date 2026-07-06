import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import * as api from '@/lib/customerPaymentApi';

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof api.CustomerAuthApiError ? err.message : fallback;
}

export function useInitiatePayment() {
  return useMutation({
    mutationFn: ({ checkoutId, gatewayCode }: { checkoutId: string; gatewayCode?: string }) =>
      api.initiatePayment(checkoutId, gatewayCode),
    onError: (err) => toast.error(errorMessage(err, 'Failed to start payment')),
  });
}

export function useRetryPayment() {
  return useMutation({
    mutationFn: (paymentId: string) => api.retryPayment(paymentId),
    onError: (err) => toast.error(errorMessage(err, 'Failed to retry payment')),
  });
}

export { errorMessage as paymentErrorMessage };
