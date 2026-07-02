import { Money } from '@/common/money/money';
import { ENGINE_METADATA, EngineMetadata } from '../engine-metadata';

export interface EvalCartItem {
  id: string;
  productId: string;
  variantId?: string;
  sku: string;
  name: string;
  brand?: string;
  slug: string;
  seoUrl?: string;
  image: string;
  quantity: number;
  unitPrice: Money;
  comparePrice?: Money;
  lineTotal: Money;
  taxCategory?: string;
  hsn?: string;
  warehouseId?: string;
  inventorySource: string;
  variantOptions?: Record<string, string>;
}

export interface EvalCart {
  items: EvalCartItem[];
  subtotal: Money;
  currency: string;
  couponCode?: string;
  customerId?: string;
}

export type PromotionType = 'COUPON' | 'AUTO' | 'FLASH_SALE' | 'BOGO' | 'BUNDLE' | 'LOYALTY';

export interface AppliedPromotion {
  id: string;
  type: PromotionType;
  code?: string;
  label: string;
  discountAmount: number;
}

export interface PromotionResult {
  appliedPromotions: AppliedPromotion[];
  lineDiscounts: Record<string, number>;
  cartDiscount: number;
  totalDiscount: number;
}

export interface IPromotionEngine {
  readonly [ENGINE_METADATA]: EngineMetadata;
  evaluate(storeId: string, cart: EvalCart): Promise<PromotionResult>;
}
