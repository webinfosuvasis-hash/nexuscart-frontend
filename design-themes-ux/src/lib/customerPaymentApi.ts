/**
 * customerPaymentApi.ts — Customer Payment API client for the Aurus storefront.
 *
 * Talks to the customer-payment module (`/checkout/:id/pay`, `/payments/*`).
 * Those routes require a logged-in customer — reuses `authenticatedFetch`
 * from customerAuthApi.ts for the token-attach + refresh-and-retry behavior;
 * no authentication logic is duplicated here.
 *
 * Guests pay through `/guest-checkout/*` instead: no token, ownership is the
 * httpOnly cart-session cookie, so those calls must send credentials exactly
 * like cartApi.ts/checkoutApi.ts do.
 */

import { authenticatedFetch, CustomerAuthApiError } from './customerAuthApi';
import { API_BASE_URL, STORE_ID } from './env';

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
  /** Customer-facing order number — show this, never `orderId`. */
  orderNumber?: string | null;
}

export interface PaymentStatusResult {
  id: string;
  status: PaymentStatus;
  orderId: string | null;
  orderNumber?: string | null;
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

// Sends the cart cookie: the backend only lets a signed-in customer claim a
// checkout from the cart session that started it.
export const initiatePayment = (checkoutId: string, gatewayCode?: string): Promise<PaymentInitiationResult> =>
  authenticatedFetch<PaymentInitiationResult>(`/checkout/${encodeURIComponent(checkoutId)}/pay`, {
    method: 'POST',
    credentials: 'include',
    body: JSON.stringify(gatewayCode ? { gatewayCode } : {}),
  });

export const getPaymentStatus = (paymentId: string): Promise<PaymentStatusResult> =>
  authenticatedFetch<PaymentStatusResult>(`/payments/${encodeURIComponent(paymentId)}/status`, { method: 'GET' });

export const retryPayment = (paymentId: string): Promise<PaymentInitiationResult> =>
  authenticatedFetch<PaymentInitiationResult>(`/payments/${encodeURIComponent(paymentId)}/retry`, { method: 'POST' });

export const getPaymentDetails = (paymentId: string): Promise<PaymentDetails> =>
  authenticatedFetch<PaymentDetails>(`/payments/${encodeURIComponent(paymentId)}`, { method: 'GET' });

// ─── Guest checkout ───────────────────────────────────────────────────────

async function guestFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}/guest-checkout${path}`, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'X-Store-Id': STORE_ID || 'default' },
  });
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json() as { message?: string | string[] };
      message = Array.isArray(body.message) ? body.message.join(', ') : (body.message ?? message);
    } catch {
      // non-JSON error body — fall back to statusText
    }
    // Same error type as the authenticated calls so callers handle both alike.
    throw new CustomerAuthApiError(res.status, message);
  }
  const body = await res.json() as { data: T };
  return body.data;
}

export const initiateGuestPayment = (checkoutId: string, gatewayCode?: string): Promise<PaymentInitiationResult> =>
  guestFetch<PaymentInitiationResult>(`/${encodeURIComponent(checkoutId)}/pay`, {
    method: 'POST',
    body: JSON.stringify(gatewayCode ? { gatewayCode } : {}),
  });

export const getGuestPaymentStatus = (paymentId: string): Promise<PaymentStatusResult> =>
  guestFetch<PaymentStatusResult>(`/payments/${encodeURIComponent(paymentId)}/status`, { method: 'GET' });

export const retryGuestPayment = (paymentId: string): Promise<PaymentInitiationResult> =>
  guestFetch<PaymentInitiationResult>(`/payments/${encodeURIComponent(paymentId)}/retry`, { method: 'POST' });

export { CustomerAuthApiError };
