import { Money } from '@/common/money/money';
import { ENGINE_METADATA, EngineMetadata } from '../engine-metadata';

export interface PriceResolutionInput {
  productId: string;
  variantId?: string;
  quantity: number;
  customerId?: string;
}

export interface PriceResolutionResult {
  productId: string;
  variantId?: string;
  unitPrice: Money;
  comparePrice?: Money;
  wasAdjusted: boolean;
}

export interface IPricingEngine {
  readonly [ENGINE_METADATA]: EngineMetadata;
  resolveOne(storeId: string, input: PriceResolutionInput, currency: string): Promise<PriceResolutionResult>;
  resolveBatch(storeId: string, inputs: PriceResolutionInput[], currency: string): Promise<PriceResolutionResult[]>;
}
