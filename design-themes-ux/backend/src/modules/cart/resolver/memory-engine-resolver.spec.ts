import { MemoryEngineResolver } from './memory-engine-resolver';
import { ENGINE_METADATA } from '../engines/engine-metadata';
import { IInventoryEngine } from '../engines/inventory/inventory-engine.interface';
import { IPricingEngine } from '../engines/pricing/pricing-engine.interface';
import { IPromotionEngine } from '../engines/promotion/promotion-engine.interface';
import { IShippingEngine } from '../engines/shipping/shipping-engine.interface';
import { ITaxEngine } from '../engines/tax/tax-engine.interface';

const makeMockEngine = (id: string, slot: string) => ({
  [ENGINE_METADATA]: { id, name: `${slot}-engine`, version: '1.0.0', capabilities: [] },
});

const defaults = {
  inventory: makeMockEngine('inv-default', 'inventory') as unknown as IInventoryEngine,
  pricing:   makeMockEngine('pri-default', 'pricing')   as unknown as IPricingEngine,
  promotion: makeMockEngine('pro-default', 'promotion') as unknown as IPromotionEngine,
  shipping:  makeMockEngine('shi-default', 'shipping')  as unknown as IShippingEngine,
  tax:       makeMockEngine('tax-default', 'tax')       as unknown as ITaxEngine,
};

function makeResolver(): MemoryEngineResolver {
  return new MemoryEngineResolver(
    defaults.inventory,
    defaults.pricing,
    defaults.promotion,
    defaults.shipping,
    defaults.tax,
  );
}

describe('MemoryEngineResolver', () => {
  describe('resolve', () => {
    it('returns defaults for unknown storeId', () => {
      const resolver = makeResolver();
      const set = resolver.resolve('store-unknown');
      expect(set.inventory).toBe(defaults.inventory);
      expect(set.pricing).toBe(defaults.pricing);
      expect(set.promotion).toBe(defaults.promotion);
      expect(set.shipping).toBe(defaults.shipping);
      expect(set.tax).toBe(defaults.tax);
    });

    it('merges per-store overrides with defaults', () => {
      const resolver = makeResolver();
      const customInventory = makeMockEngine('inv-custom', 'inventory') as unknown as IInventoryEngine;
      resolver.register('store-a', { inventory: customInventory });

      const set = resolver.resolve('store-a');
      expect(set.inventory).toBe(customInventory);
      expect(set.pricing).toBe(defaults.pricing);   // unchanged
    });

    it('different stores get independent engine sets', () => {
      const resolver = makeResolver();
      const customTax = makeMockEngine('tax-custom', 'tax') as unknown as ITaxEngine;
      resolver.register('store-a', { tax: customTax });

      expect(resolver.resolve('store-a').tax).toBe(customTax);
      expect(resolver.resolve('store-b').tax).toBe(defaults.tax);
    });
  });

  describe('register', () => {
    it('merges multiple calls for same store', () => {
      const resolver = makeResolver();
      const customInv = makeMockEngine('inv-c', 'inventory') as unknown as IInventoryEngine;
      const customPri = makeMockEngine('pri-c', 'pricing')   as unknown as IPricingEngine;

      resolver.register('store-a', { inventory: customInv });
      resolver.register('store-a', { pricing:   customPri });

      const set = resolver.resolve('store-a');
      expect(set.inventory).toBe(customInv);
      expect(set.pricing).toBe(customPri);
    });
  });

  describe('deregister', () => {
    it('removes a single engine slot back to default', () => {
      const resolver = makeResolver();
      const customInv = makeMockEngine('inv-c', 'inventory') as unknown as IInventoryEngine;
      resolver.register('store-a', { inventory: customInv });
      resolver.deregister('store-a', 'inventory');

      expect(resolver.resolve('store-a').inventory).toBe(defaults.inventory);
    });

    it('removes all overrides for a store', () => {
      const resolver = makeResolver();
      const customInv = makeMockEngine('inv-c', 'inventory') as unknown as IInventoryEngine;
      resolver.register('store-a', { inventory: customInv });
      resolver.deregister('store-a');

      const set = resolver.resolve('store-a');
      expect(set.inventory).toBe(defaults.inventory);
      expect(set.pricing).toBe(defaults.pricing);
    });

    it('does nothing for unknown storeId', () => {
      const resolver = makeResolver();
      expect(() => resolver.deregister('nonexistent')).not.toThrow();
    });
  });

  describe('inspect', () => {
    it('marks overridden slots correctly', () => {
      const resolver = makeResolver();
      const customTax = makeMockEngine('tax-custom', 'tax') as unknown as ITaxEngine;
      resolver.register('store-a', { tax: customTax });

      const result = resolver.inspect('store-a');
      expect(result.storeId).toBe('store-a');
      expect(result.resolvedBy).toBe('MemoryEngineResolver');
      expect(result.engines.tax.overridden).toBe(true);
      expect(result.engines.pricing.overridden).toBe(false);
    });

    it('includes engine metadata in inspect output', () => {
      const resolver = makeResolver();
      const result = resolver.inspect('any-store');
      expect(result.engines.inventory.id).toBe('inv-default');
    });
  });
});
