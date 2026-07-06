/**
 * customerOrdersApi.ts — Customer Order History/Details API client for the
 * Aurus storefront. Talks to the Phase 5 CustomerOrdersController
 * (`/customer/orders`). Reuses `authenticatedFetch` from customerAuthApi.ts
 * for the token-attach + refresh-and-retry behavior — no authentication
 * logic is duplicated here.
 */

import { authenticatedFetch } from './customerAuthApi';

export type OrderStatus = 'PENDING' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'RETURNED' | 'REFUNDED';
export type PaymentStatus = 'PENDING' | 'AUTHORIZED' | 'PAID' | 'CAPTURED' | 'FAILED' | 'CANCELLED' | 'REFUNDED' | 'PARTIAL' | 'PARTIALLY_REFUNDED';

// Customer-facing filter vocabulary — matches ListCustomerOrdersDto exactly.
export type OrderStatusFilter = 'PENDING' | 'PAID' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
export type OrderSortField = 'createdAt' | 'total' | 'orderNumber';

export interface OrderListItem {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  total: number;
  itemCount: number;
  thumbnail: string | null;
  createdAt: string;
}

export interface OrderListResponse {
  items: OrderListItem[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface ListOrdersParams {
  page?: number;
  limit?: number;
  status?: OrderStatusFilter;
  search?: string;
  sortBy?: OrderSortField;
  sortOrder?: 'asc' | 'desc';
}

export interface OrderAddress {
  firstName: string;
  lastName: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string | null;
  email: string | null;
}

export interface OrderItemDetail {
  id: string;
  productId: string;
  variantId: string | null;
  productName: string;
  variantName: string | null;
  sku: string;
  quantity: number;
  unitPrice: number;
  total: number;
  thumbnail: string | null;
  variantOptions: Record<string, string> | null;
  comparePrice: number | null;
  lineDiscount: number;
  taxAmount: number;
}

export interface OrderTransaction {
  id: string;
  gatewayCode: string;
  status: string;
  amountInPaise: number;
  currency: string;
  gatewayPaymentId: string | null;
  capturedAt: string | null;
}

export interface OrderShipment {
  id: string;
  trackingNumber: string | null;
  carrier: string | null;
  carrierUrl: string | null;
  status: string;
  shippedAt: string | null;
  deliveredAt: string | null;
  expectedDelivery: string | null;
}

export interface OrderStatusHistoryEntry {
  id: string;
  status: OrderStatus;
  note: string | null;
  createdAt: string;
}

export interface OrderTotals {
  subtotal: number;
  discount: number;
  tax: number;
  shippingCost: number;
  total: number;
  refundedAmount: number;
  couponCode: string | null;
}

export interface OrderDetail {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  createdAt: string;
  confirmedAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  items: OrderItemDetail[];
  totals: OrderTotals;
  shippingAddress: OrderAddress | null;
  billingAddress: OrderAddress | null;
  statusHistory: OrderStatusHistoryEntry[];
  transaction: OrderTransaction | null;
  paymentMethod: string | null;
  shipments: OrderShipment[];
}

function buildQueryString(params: ListOrdersParams): string {
  const search = new URLSearchParams();
  if (params.page) search.set('page', String(params.page));
  if (params.limit) search.set('limit', String(params.limit));
  if (params.status) search.set('status', params.status);
  if (params.search) search.set('search', params.search);
  if (params.sortBy) search.set('sortBy', params.sortBy);
  if (params.sortOrder) search.set('sortOrder', params.sortOrder);
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export const listOrders = (params: ListOrdersParams = {}): Promise<OrderListResponse> =>
  authenticatedFetch<OrderListResponse>(`/customer/orders${buildQueryString(params)}`, { method: 'GET' });

export const getOrderDetails = (orderId: string): Promise<OrderDetail> =>
  authenticatedFetch<OrderDetail>(`/customer/orders/${encodeURIComponent(orderId)}`, { method: 'GET' });

export { CustomerAuthApiError } from './customerAuthApi';
