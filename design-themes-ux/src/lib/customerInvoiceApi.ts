/**
 * customerInvoiceApi.ts — Customer Invoice API client for the Aurus
 * storefront. Talks to the Phase 8 CustomerInvoiceController
 * (`/customer/orders/:orderId/invoice{,/data}`). Reuses `authenticatedFetch`/
 * `authenticatedFetchBlob` from customerAuthApi.ts — no authentication logic
 * is duplicated here.
 */

import { authenticatedFetch, authenticatedFetchBlob, CustomerAuthApiError } from './customerAuthApi';
import { OrderStatus } from './customerOrdersApi';

export interface InvoiceAddress {
  firstName: string;
  lastName: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string | null;
}

export interface InvoiceSellerAddress {
  line1: string | null;
  line2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
}

export interface InvoiceSeller {
  storeName: string;
  logo: string | null;
  legalBusinessName: string | null;
  gstin: string | null;
  address: InvoiceSellerAddress | null;
  phone: string | null;
  email: string | null;
}

export interface InvoiceBuyer {
  name: string;
  email: string | null;
  phone: string | null;
  billingAddress: InvoiceAddress | null;
  shippingAddress: InvoiceAddress | null;
}

export interface InvoiceLineItem {
  productName: string;
  variantName: string | null;
  sku: string;
  hsn: string | null;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
  taxAmount: number;
  total: number;
}

export type InvoiceTaxType = 'INTRA_STATE' | 'INTER_STATE' | 'UNKNOWN';

export interface InvoiceTaxBreakdown {
  taxType: InvoiceTaxType;
  cgst: number | null;
  sgst: number | null;
  igst: number | null;
  totalTax: number;
}

export interface InvoiceTotals {
  subtotal: number;
  discount: number;
  tax: number;
  shippingCost: number;
  total: number;
  refundedAmount: number;
  couponCode: string | null;
}

export interface InvoicePayment {
  status: string;
  gatewayCode: string;
  transactionId: string | null;
  paidAt: string | null;
}

export interface InvoiceShipment {
  trackingNumber: string | null;
  carrier: string | null;
  deliveredAt: string | null;
}

export interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  order: {
    id: string;
    orderNumber: string;
    status: OrderStatus;
    paymentStatus: string;
    createdAt: string;
  };
  seller: InvoiceSeller;
  buyer: InvoiceBuyer;
  items: InvoiceLineItem[];
  taxBreakdown: InvoiceTaxBreakdown;
  totals: InvoiceTotals;
  payment: InvoicePayment | null;
  shipment: InvoiceShipment | null;
}

export const getInvoiceData = (orderId: string): Promise<InvoiceData> =>
  authenticatedFetch<InvoiceData>(`/customer/orders/${encodeURIComponent(orderId)}/invoice/data`, { method: 'GET' });

export const getInvoicePdfBlob = (orderId: string): Promise<Blob> =>
  authenticatedFetchBlob(`/customer/orders/${encodeURIComponent(orderId)}/invoice`, { method: 'GET' });

export { CustomerAuthApiError };
