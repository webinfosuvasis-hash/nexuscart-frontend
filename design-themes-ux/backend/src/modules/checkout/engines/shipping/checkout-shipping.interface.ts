export interface CheckoutShippingItem {
  productId: string;
  variantId?: string;
  quantity:  number;
  weight?:   number;
}

export interface CheckoutShippingAddress {
  postalCode?: string;
  city?:       string;
  state?:      string;
  country?:    string;
}

export interface CheckoutShippingMethod {
  id:            string;
  name:          string;
  description?:  string;
  cost:          number;
  estimatedDays: string;
  isFree:        boolean;
}

export interface CheckoutShippingInput {
  items:       CheckoutShippingItem[];
  address?:    CheckoutShippingAddress;
  subtotal:    number;
  currency:    string;
  freeShippingThreshold: number;
}

export interface CheckoutShippingResult {
  available:       boolean;
  methods:         CheckoutShippingMethod[];
  selectedMethodId?: string;
}

export interface ICheckoutShippingEngine {
  listMethods(storeId: string, input: CheckoutShippingInput): Promise<CheckoutShippingResult>;
  calculate(storeId: string, methodId: string, input: CheckoutShippingInput): Promise<CheckoutShippingMethod | null>;
  estimate(storeId: string, input: CheckoutShippingInput): Promise<CheckoutShippingMethod>;
}
