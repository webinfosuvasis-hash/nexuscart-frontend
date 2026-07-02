export type GSTType = 'CGST' | 'SGST' | 'IGST';

export interface CheckoutTaxItem {
  itemId:      string;
  lineTotal:   number;
  taxCategory?: string;
  hsn?:        string;
}

export interface TaxComponent {
  type:   GSTType;
  rate:   number;
  amount: number;
}

export interface CheckoutTaxLineResult {
  itemId:     string;
  taxAmount:  number;
  components: TaxComponent[];
  effectiveRate: number;
}

export interface CheckoutTaxInput {
  items:          CheckoutTaxItem[];
  shippingCost:   number;
  currency:       string;
  deliveryState?: string;
  storeState:     string;
}

export interface CheckoutTaxBreakdown {
  label:  string;
  type:   GSTType;
  rate:   number;
  amount: number;
}

export interface CheckoutTaxResult {
  totalTax:     number;
  breakdown:    CheckoutTaxBreakdown[];
  lineTaxes:    Record<string, number>;
  taxType:      'INTRA_STATE' | 'INTER_STATE';
}

export interface ICheckoutTaxEngine {
  compute(storeId: string, input: CheckoutTaxInput): Promise<CheckoutTaxResult>;
}
