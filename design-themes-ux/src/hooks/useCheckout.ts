import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import * as api from '@/lib/checkoutApi';

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof api.CheckoutApiError ? err.message : fallback;
}

/**
 * Starting checkout twice for the same cart (e.g. a page reload) hits the
 * backend's own CHECKOUT_ALREADY_ACTIVE conflict — resolved transparently
 * here by resuming the existing session instead of surfacing it as an error.
 */
export function useStartCheckout() {
  return useMutation({
    mutationFn: async (): Promise<api.CheckoutSession> => {
      try {
        return await api.startCheckout();
      } catch (err) {
        if (err instanceof api.CheckoutAlreadyActiveError) {
          return api.getCheckout(err.checkoutId);
        }
        throw err;
      }
    },
    onError: (err) => toast.error(errorMessage(err, 'Could not start checkout')),
  });
}

export function useUpdateCheckoutAddress() {
  return useMutation({
    mutationFn: ({ checkoutId, address, billingSameAsShipping }: {
      checkoutId: string; address: api.AddressInput; billingSameAsShipping?: boolean;
    }) => api.updateCheckoutAddress(checkoutId, address, billingSameAsShipping),
    onError: (err) => toast.error(errorMessage(err, 'Failed to save address')),
  });
}

export function useUpdateCheckoutShipping() {
  return useMutation({
    mutationFn: ({ checkoutId, shippingMethodId }: { checkoutId: string; shippingMethodId: string }) =>
      api.updateCheckoutShipping(checkoutId, shippingMethodId),
    onError: (err) => toast.error(errorMessage(err, 'Failed to update shipping method')),
  });
}

export function useValidateCheckout() {
  return useMutation({
    mutationFn: (checkoutId: string) => api.validateCheckout(checkoutId),
    onError: (err) => toast.error(errorMessage(err, 'Failed to validate checkout')),
  });
}

export function useCancelCheckout() {
  return useMutation({
    mutationFn: (checkoutId: string) => api.cancelCheckout(checkoutId),
    onError: (err) => toast.error(errorMessage(err, 'Failed to cancel checkout')),
  });
}

export { errorMessage as checkoutErrorMessage };
