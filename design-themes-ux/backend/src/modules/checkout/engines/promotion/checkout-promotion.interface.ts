export type PromotionFailureReason =
  | 'EXPIRED'
  | 'USAGE_EXCEEDED'
  | 'CART_CHANGED'
  | 'MINIMUM_NOT_MET'
  | 'NOT_FOUND'
  | 'INACTIVE';

export interface CheckoutPromoInput {
  couponCode:  string;
  cartSubtotal: number;
  currency:    string;
  customerId?: string;
  storeId:     string;
}

export interface CheckoutPromoResult {
  isValid:         boolean;
  discountAmount:  number;
  discountType:    'PERCENTAGE' | 'FIXED' | 'FREE_SHIPPING';
  label:           string;
  failureReason?:  PromotionFailureReason;
  message?:        string;
}

export interface ICheckoutPromotionEngine {
  validate(input: CheckoutPromoInput): Promise<CheckoutPromoResult>;
}
