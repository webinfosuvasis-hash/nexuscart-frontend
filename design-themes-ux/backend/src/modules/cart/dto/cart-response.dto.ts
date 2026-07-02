import { CartStatus } from '@prisma/client';
import { ValidationIssue } from '../validation/cart-validation.types';

export interface CartItemResponseDto {
  id:               string;
  productId:        string;
  variantId:        string | null;
  quantity:         number;
  sku:              string;
  name:             string;
  brand:            string | null;
  slug:             string;
  image:            string;
  unitPrice:        number;
  comparePrice:     number | null;
  lineDiscount:     number;
  lineTotal:        number;
  taxCategory:      string | null;
  variantOptions:   Record<string, string> | null;
  warehouseId:      string | null;
  appliedPromotions: string[] | null;
}

export interface CartTotalsDto {
  subtotal:         number;
  totalDiscount:    number;
  shippingCost:     number;
  taxAmount:        number;
  grandTotal:       number;
  currencyCode:     string;
}

export interface CartShippingEstimateDto {
  available: boolean;
  methods:   Array<{ id: string; name: string; cost: number; estimatedDays: string | null }>;
}

export interface CartDebugDto {
  engineSet:        Record<string, { id: string; name: string; version: string }>;
  computedAt:       string;
  pipelineDurationMs: number;
  validationIssues: ValidationIssue[];
}

export interface CartResponseDto {
  id:               string;
  storeId:          string;
  sessionId:        string;
  customerId:       string | null;
  status:           CartStatus;
  version:          number;
  currencyCode:     string;
  locale:           string;
  couponCode:       string | null;
  items:            CartItemResponseDto[];
  totals:           CartTotalsDto;
  shipping:         CartShippingEstimateDto;
  itemCount:        number;
  uniqueItemCount:  number;
  lockedUntil:      string | null;
  lastActivityAt:   string;
  createdAt:        string;
  updatedAt:        string;
  _debug?:          CartDebugDto;
}

export interface CartActivityResponseDto {
  id:           string;
  activityType: string;
  actorType:    string;
  actorId:      string | null;
  payload:      Record<string, unknown>;
  createdAt:    string;
}
