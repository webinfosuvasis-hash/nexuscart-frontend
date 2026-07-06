import type { Shipment, ShipmentItem } from '@prisma/client';

export const SHIPMENT_STATUS = {
  PENDING:   'PENDING',
  SHIPPED:   'SHIPPED',
  DELIVERED: 'DELIVERED',
} as const;

export type ShipmentStatus = typeof SHIPMENT_STATUS[keyof typeof SHIPMENT_STATUS];

// Shipment record with eagerly-loaded items — the shape returned by all service methods
export type ShipmentWithItems = Shipment & { items: ShipmentItem[] };

export interface ShipmentItemInput {
  productId:  string;
  variantId?: string;
  quantity:   number;
}

export interface CreateShipmentInput {
  orderId:         string;
  storeId:         string;
  actorId:         string;
  trackingNumber?: string;
  carrier?:        string;
  carrierUrl?:     string;
  note?:           string;
  items?:          ShipmentItemInput[];
}

export interface UpdateShipmentInput {
  shipmentId:      string;
  orderId:         string;
  storeId:         string;
  trackingNumber?: string;
  carrier?:        string;
  carrierUrl?:     string;
  note?:           string;
}

export interface MarkDeliveredInput {
  shipmentId:   string;
  orderId:      string;
  storeId:      string;
  actorId:      string;
  deliveredAt?: Date;
}

// Re-export for convenience across the module
export type { Shipment, ShipmentItem };
