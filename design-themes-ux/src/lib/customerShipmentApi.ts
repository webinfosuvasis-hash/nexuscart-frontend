/**
 * customerShipmentApi.ts — Customer Shipment Tracking API client for the
 * Aurus storefront. Talks to the Phase 6 CustomerShipmentController
 * (`/customer/orders/:orderId/{shipment,tracking}`). Reuses
 * `authenticatedFetch` from customerAuthApi.ts — no authentication logic is
 * duplicated here.
 */

import { authenticatedFetch, CustomerAuthApiError } from './customerAuthApi';
import { OrderStatus } from './customerOrdersApi';

export interface ShipmentItem {
  productId: string;
  variantId: string | null;
  productName: string | null;
  variantName: string | null;
  thumbnail: string | null;
  sku: string | null;
  quantity: number;
}

export interface Shipment {
  id: string;
  status: string;
  trackingNumber: string | null;
  carrier: string | null;
  carrierUrl: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  expectedDelivery: string | null;
}

export interface ShipmentWithItems extends Shipment {
  items: ShipmentItem[];
}

export interface ShipmentDetailResponse {
  orderId: string;
  orderNumber: string;
  shipments: ShipmentWithItems[];
}

export interface TimelineEntry {
  id: string;
  status: OrderStatus;
  note: string | null;
  createdAt: string;
}

export interface TrackingResponse {
  orderId: string;
  orderNumber: string;
  orderStatus: OrderStatus;
  timeline: TimelineEntry[];
  shipments: Shipment[];
}

export const getShipmentDetails = (orderId: string): Promise<ShipmentDetailResponse> =>
  authenticatedFetch<ShipmentDetailResponse>(`/customer/orders/${encodeURIComponent(orderId)}/shipment`, { method: 'GET' });

export const getTracking = (orderId: string): Promise<TrackingResponse> =>
  authenticatedFetch<TrackingResponse>(`/customer/orders/${encodeURIComponent(orderId)}/tracking`, { method: 'GET' });

export { CustomerAuthApiError };
