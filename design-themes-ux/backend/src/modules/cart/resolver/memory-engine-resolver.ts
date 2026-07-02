import { Injectable, Inject } from '@nestjs/common';
import { ENGINE_METADATA }   from '../engines/engine-metadata';
import { EngineSet }         from '../engines/engine-set.interface';
import { INVENTORY_ENGINE, PRICING_ENGINE, PROMOTION_ENGINE, SHIPPING_ENGINE, TAX_ENGINE } from '../engines/engine-tokens';
import { IInventoryEngine }  from '../engines/inventory/inventory-engine.interface';
import { IPricingEngine }    from '../engines/pricing/pricing-engine.interface';
import { IPromotionEngine }  from '../engines/promotion/promotion-engine.interface';
import { IShippingEngine }   from '../engines/shipping/shipping-engine.interface';
import { ITaxEngine }        from '../engines/tax/tax-engine.interface';
import { EngineInspectResult, IEngineResolver } from './engine-resolver.interface';

@Injectable()
export class MemoryEngineResolver implements IEngineResolver {
  private readonly overrides = new Map<string, Partial<EngineSet>>();
  private readonly defaults:  EngineSet;

  constructor(
    @Inject(INVENTORY_ENGINE) defaultInventory: IInventoryEngine,
    @Inject(PRICING_ENGINE)   defaultPricing:   IPricingEngine,
    @Inject(PROMOTION_ENGINE) defaultPromotion: IPromotionEngine,
    @Inject(SHIPPING_ENGINE)  defaultShipping:  IShippingEngine,
    @Inject(TAX_ENGINE)       defaultTax:       ITaxEngine,
  ) {
    this.defaults = {
      inventory: defaultInventory,
      pricing:   defaultPricing,
      promotion: defaultPromotion,
      shipping:  defaultShipping,
      tax:       defaultTax,
    };
  }

  resolve(storeId: string): EngineSet {
    const o = this.overrides.get(storeId) ?? {};
    return {
      inventory: o.inventory ?? this.defaults.inventory,
      pricing:   o.pricing   ?? this.defaults.pricing,
      promotion: o.promotion ?? this.defaults.promotion,
      shipping:  o.shipping  ?? this.defaults.shipping,
      tax:       o.tax       ?? this.defaults.tax,
    };
  }

  register(storeId: string, overrides: Partial<EngineSet>): void {
    this.overrides.set(storeId, { ...(this.overrides.get(storeId) ?? {}), ...overrides });
  }

  deregister(storeId: string, engine?: keyof EngineSet): void {
    if (!engine) {
      this.overrides.delete(storeId);
      return;
    }
    const cur = this.overrides.get(storeId);
    if (cur) {
      delete cur[engine];
      if (Object.keys(cur).length === 0) this.overrides.delete(storeId);
    }
  }

  inspect(storeId: string): EngineInspectResult {
    const o   = this.overrides.get(storeId) ?? {};
    const set = this.resolve(storeId);
    return {
      storeId,
      resolvedBy: 'MemoryEngineResolver',
      engines: {
        inventory: { ...set.inventory[ENGINE_METADATA], overridden: 'inventory' in o },
        pricing:   { ...set.pricing[ENGINE_METADATA],   overridden: 'pricing'   in o },
        promotion: { ...set.promotion[ENGINE_METADATA], overridden: 'promotion' in o },
        shipping:  { ...set.shipping[ENGINE_METADATA],  overridden: 'shipping'  in o },
        tax:       { ...set.tax[ENGINE_METADATA],       overridden: 'tax'       in o },
      },
    };
  }
}
