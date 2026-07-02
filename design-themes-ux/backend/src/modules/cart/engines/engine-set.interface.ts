import { IInventoryEngine } from './inventory/inventory-engine.interface';
import { IPricingEngine }   from './pricing/pricing-engine.interface';
import { IPromotionEngine } from './promotion/promotion-engine.interface';
import { IShippingEngine }  from './shipping/shipping-engine.interface';
import { ITaxEngine }       from './tax/tax-engine.interface';

export interface EngineSet {
  inventory: IInventoryEngine;
  pricing:   IPricingEngine;
  promotion: IPromotionEngine;
  shipping:  IShippingEngine;
  tax:       ITaxEngine;
}
