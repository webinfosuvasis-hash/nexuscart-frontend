/**
 * customerCancellationApi.ts — Customer Cancellation & Refund Status API
 * client for the Aurus storefront. Talks to the Phase 7
 * CustomerCancellationController (`/customer/orders/:orderId/{cancel,cancellation,refund}`).
 * Reuses `authenticatedFetch` from customerAuthApi.ts — no authentication
 * logic is duplicated here.
 */

import { authenticatedFetch, CustomerAuthApiError } from './customerAuthApi';
import { OrderStatus } from './customerOrdersApi';

export interface CancellationTimelineEntry {
  id: string;
  status: OrderStatus;
  note: string | null;
  createdAt: string;
}

export interface CancellationStatus {
  orderId: string;
  orderNumber: string;
  orderStatus: OrderStatus;
  canCancel: boolean;
  isCancelled: boolean;
  cancelledAt: string | null;
  cancellationReason: string | null;
  paymentAction?: string | null;
  timeline: CancellationTimelineEntry[];
}

export interface Refund {
  amount: number;
  status: string;
  reason: string | null;
  gatewayRefundId: string | null;
  createdAt: string;
}

export interface RefundStatus {
  orderId: string;
  orderNumber: string;
  hasRefund: boolean;
  refund: Refund | null;
}

export const cancelOrder = (orderId: string, reason: string): Promise<CancellationStatus> =>
  authenticatedFetch<CancellationStatus>(`/customer/orders/${encodeURIComponent(orderId)}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });

export const getCancellationStatus = (orderId: string): Promise<CancellationStatus> =>
  authenticatedFetch<CancellationStatus>(`/customer/orders/${encodeURIComponent(orderId)}/cancellation`, { method: 'GET' });

export const getRefundStatus = (orderId: string): Promise<RefundStatus> =>
  authenticatedFetch<RefundStatus>(`/customer/orders/${encodeURIComponent(orderId)}/refund`, { method: 'GET' });

export { CustomerAuthApiError };
