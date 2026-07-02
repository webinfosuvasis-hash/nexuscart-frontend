import { Injectable } from '@nestjs/common';
import { Money } from '@/common/money/money';
import { ENGINE_METADATA, EngineMetadata } from '../engine-metadata';
import { ITaxEngine, TaxComputeInput, TaxResult } from './tax-engine.interface';

@Injectable()
export class PlaceholderTaxEngine implements ITaxEngine {
  readonly [ENGINE_METADATA]: EngineMetadata = {
    id:           'placeholder-tax-v1',
    name:         'Placeholder Tax Engine (P3)',
    version:      '1.0.0',
    capabilities: [],
  };

  async compute(_storeId: string, input: TaxComputeInput): Promise<TaxResult> {
    const lineTaxes: Record<string, number> = {};
    for (const item of input.items) {
      lineTaxes[item.id] = 0;
    }
    return {
      totalTax:     Money.ZERO(input.currency),
      taxBreakdown: [],
      lineTaxes,
    };
  }
}
