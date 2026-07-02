import { Injectable } from '@nestjs/common';
import { ENGINE_METADATA, EngineMetadata } from '../engine-metadata';
import { EvalCart, IPromotionEngine, PromotionResult } from './promotion-engine.interface';

@Injectable()
export class NullPromotionEngine implements IPromotionEngine {
  readonly [ENGINE_METADATA]: EngineMetadata = {
    id:           'null-promotion-v1',
    name:         'Null Promotion Engine (P3 Placeholder)',
    version:      '1.0.0',
    capabilities: [],
  };

  async evaluate(_storeId: string, _cart: EvalCart): Promise<PromotionResult> {
    return {
      appliedPromotions: [],
      lineDiscounts:     {},
      cartDiscount:      0,
      totalDiscount:     0,
    };
  }
}
