/**
 * customerPaymentApi.ts — Customer Payment API client for the Aurus storefront.
 *
 * Talks to the customer-payment module (`/checkout/:id/pay`, `/payments/*`).
 * Every route requires a logged-in customer — reuses `authenticatedFetch`
 * from customerAuthApi.ts for the token-attach + refresh-and-retry behavior;
 * no authentication logic is duplicated here.
 */

import { authenticatedFetch, CustomerAuthApiError } from './customerAuthApi';

export type PaymentStatus =
  | 'PENDING' | 'GATEWAY_CREATED' | 'AUTHORIZED' | 'CAPTURED'
  | 'FAILED' | 'CANCELLED' | 'EXPIRED' | 'REFUNDED' | 'PARTIALLY_REFUNDED';

export interface PaymentInitiationResult {
  paymentId: string;
  status: PaymentStatus;
  gatewayCode: string;
  amountInPaise: number;
  currency: string;
  redirectUrl?: string;
  clientSecret?: string;
  gatewayOrderId?: string;
  orderId: string | null;
}

export interface PaymentStatusResult {
  id: string;
  status: PaymentStatus;
  orderId: string | null;
}

export interface PaymentDetails {
  id: string;
  status: PaymentStatus;
  gatewayCode: string;
  amountInPaise: number;
  currency: string;
  attemptNumber: number;
  orderId: string | null;
  createdAt: string;
  authorizedAt: string | null;
  capturedAt: string | null;
  failedAt: string | null;
  cancelledAt: string | null;
  refundedAt: string | null;
}

export const initiatePayment = (checkoutId: string, gatewayCode?: string): Promise<PaymentInitiationResult> =>
  authenticatedFetch<PaymentInitiationResult>(`/checkout/${encodeURIComponent(checkoutId)}/pay`, {
    method: 'POST',
    body: JSON.stringify(gatewayCode ? { gatewayCode } : {}),
  });

export const getPaymentStatus = (paymentId: string): Promise<PaymentStatusResult> =>
  authenticatedFetch<PaymentStatusResult>(`/payments/${encodeURIComponent(paymentId)}/status`, { method: 'GET' });

export const retryPayment = (paymentId: string): Promise<PaymentInitiationResult> =>
  authenticatedFetch<PaymentInitiationResult>(`/payments/${encodeURIComponent(paymentId)}/retry`, { method: 'POST' });

export const getPaymentDetails = (paymentId: string): Promise<PaymentDetails> =>
  authenticatedFetch<PaymentDetails>(`/payments/${encodeURIComponent(paymentId)}`, { method: 'GET' });

export { CustomerAuthApiError };
