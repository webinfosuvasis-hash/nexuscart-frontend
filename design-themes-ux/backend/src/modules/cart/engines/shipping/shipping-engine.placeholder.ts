import { Injectable } from '@nestjs/common';
import { Money } from '@/common/money/money';
import { ENGINE_METADATA, EngineMetadata } from '../engine-metadata';
import { IShippingEngine, ShippingEstimate, ShippingEstimateInput } from './shipping-engine.interface';

@Injectable()
export class PlaceholderShippingEngine implements IShippingEngine {
  readonly [ENGINE_METADATA]: EngineMetadata = {
    id:           'placeholder-shipping-v1',
    name:         'Placeholder Shipping Engine (P3)',
    version:      '1.0.0',
    capabilities: [],
  };

  async estimate(_storeId: string, input: ShippingEstimateInput): Promise<ShippingEstimate> {
    return {
      available:    false,
      methods:      [],
      cheapestCost: Money.ZERO(input.subtotal.currency),
    };
  }
}
