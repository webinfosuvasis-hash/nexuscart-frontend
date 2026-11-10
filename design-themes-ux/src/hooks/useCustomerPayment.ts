import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import * as api from '@/lib/customerPaymentApi';

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof api.CustomerAuthApiError ? err.message : fallback;
}

/**
 * `asGuest` routes the call through the cookie-owned guest endpoints instead
 * of the customer-token ones — the result shape is identical either way.
 */
export function useInitiatePayment() {
  return useMutation({
    mutationFn: ({ checkoutId, gatewayCode, asGuest }: { checkoutId: string; gatewayCode?: string; asGuest?: boolean }) =>
      asGuest ? api.initiateGuestPayment(checkoutId, gatewayCode) : api.initiatePayment(checkoutId, gatewayCode),
    onError: (err) => toast.error(errorMessage(err, 'Failed to start payment')),
  });
}

export function useRetryPayment() {
  return useMutation({
    mutationFn: ({ paymentId, asGuest }: { paymentId: string; asGuest?: boolean }) =>
      asGuest ? api.retryGuestPayment(paymentId) : api.retryPayment(paymentId),
    onError: (err) => toast.error(errorMessage(err, 'Failed to retry payment')),
  });
}

export { errorMessage as paymentErrorMessage };
