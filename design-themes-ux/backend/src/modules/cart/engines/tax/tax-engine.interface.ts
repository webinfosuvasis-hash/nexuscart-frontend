import { Money } from '@/common/money/money';
import { ENGINE_METADATA, EngineMetadata } from '../engine-metadata';

export interface TaxLineItem {
  id: string;
  lineTotal: Money;
  taxCategory?: string;
  hsn?: string;
}

export interface TaxBreakdown {
  label: string;
  rate: number;
  amount: Money;
}

export interface TaxComputeInput {
  items: TaxLineItem[];
  subtotalAfterDiscount: Money;
  shippingCost: Money;
  currency: string;
}

export interface TaxResult {
  totalTax: Money;
  taxBreakdown: TaxBreakdown[];
  lineTaxes: Record<string, number>;
}

export interface ITaxEngine {
  readonly [ENGINE_METADATA]: EngineMetadata;
  compute(storeId: string, input: TaxComputeInput): Promise<TaxResult>;
}
