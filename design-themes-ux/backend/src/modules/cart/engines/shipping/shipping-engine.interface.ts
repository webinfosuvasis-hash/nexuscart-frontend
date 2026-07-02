import { Money } from '@/common/money/money';
import { ENGINE_METADATA, EngineMetadata } from '../engine-metadata';

export interface ShippingItem {
  productId: string;
  variantId?: string;
  quantity: number;
  weight?: number;
}

export interface ShippingDestination {
  pincode?: string;
  city?: string;
  state?: string;
  country?: string;
}

export interface ShippingMethod {
  id: string;
  name: string;
  cost: Money;
  estimatedDays: string;
}

export interface ShippingEstimateInput {
  items: ShippingItem[];
  destination?: ShippingDestination;
  subtotal: Money;
}

export interface ShippingEstimate {
  available: boolean;
  methods: ShippingMethod[];
  cheapestCost: Money;
}

export interface IShippingEngine {
  readonly [ENGINE_METADATA]: EngineMetadata;
  estimate(storeId: string, input: ShippingEstimateInput): Promise<ShippingEstimate>;
}
