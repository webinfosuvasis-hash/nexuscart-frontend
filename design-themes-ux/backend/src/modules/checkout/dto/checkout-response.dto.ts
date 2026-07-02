import { CheckoutStatus, AddressType } from '@prisma/client';

export interface CheckoutAddressDto {
  id:             string;
  type:           AddressType;
  firstName:      string;
  lastName:       string;
  line1:          string;
  line2:          string | null;
  city:           string;
  state:          string;
  postalCode:     string;
  country:        string;
  phone:          string;
  email:          string | null;
  isGuestAddress: boolean;
}

export interface CheckoutItemDto {
  id:           string;
  productId:    string;
  variantId:    string | null;
  sku:          string;
  name:         string;
  brand:        string | null;
  image:        string;
  quantity:     number;
  unitPrice:    number;
  lineDiscount: number;
  lineTotal:    number;
  taxAmount:    number;
  taxCategory:  string | null;
  variantOptions: Record<string, string> | null;
  hasStockWarning: boolean;
  hasPriceWarning: boolean;
}

export interface CheckoutShippingMethodDto {
  id:            string;
  name:          string;
  description:   string | null;
  cost:          number;
  estimatedDays: string;
  isFree:        boolean;
  isSelected:    boolean;
}

export interface CheckoutTaxBreakdownDto {
  label:  string;
  type:   string;
  rate:   number;
  amount: number;
}

export interface CheckoutTotalsDto {
  subtotal:          number;
  totalDiscount:     number;
  promotionDiscount: number;
  shippingCost:      number;
  taxAmount:         number;
  grandTotal:        number;
  currencyCode:      string;
}

export interface CheckoutPromoSummaryDto {
  code:           string;
  label:          string;
  discountAmount: number;
  discountType:   string;
}

export interface CheckoutValidationResultDto {
  isValid:    boolean;
  hasBlockers: boolean;
  issues:     Array<{ code: string; severity: string; message: string; itemId?: string }>;
}

export interface CheckoutDebugDto {
  pipelineDurationMs: number;
  computedAt:         string;
  storeState:         string;
  deliveryState:      string | null;
  taxType:            string | null;
}

export interface CheckoutSessionResponseDto {
  id:                     string;
  storeId:                string;
  cartId:                 string;
  cartVersion:            number;
  sessionId:              string;
  customerId:             string | null;
  status:                 CheckoutStatus;
  addresses:              CheckoutAddressDto[];
  selectedShippingMethod: CheckoutShippingMethodDto | null;
  availableShippingMethods: CheckoutShippingMethodDto[];
  items:                  CheckoutItemDto[];
  totals:                 CheckoutTotalsDto;
  taxBreakdown:           CheckoutTaxBreakdownDto[];
  appliedPromotion:       CheckoutPromoSummaryDto | null;
  validation:             CheckoutValidationResultDto;
  warnings:               string[];
  isValid:                boolean;
  expiresAt:              string;
  createdAt:              string;
  updatedAt:              string;
  _debug?:                CheckoutDebugDto;
}
