import { DefaultCheckoutInventoryEngine } from './checkout-inventory.default';

// Units a checkout already holds were taken out of Product/Variant stock for
// it, so re-validating that same checkout (retry, page refresh) must count
// them as available — otherwise the shopper's own hold reads as "out of stock".

const input = (over: Record<string, unknown> = {}) => ({
  itemId: 'item_1', productId: 'ring', requestedQuantity: 1, inventorySource: 'PRODUCT' as any, unitPrice: 100, ...over,
});

function makeEngine(stock: { product: number; variant?: number }, held: Map<string, number>) {
  const prisma = {
    product: { findFirst: jest.fn().mockResolvedValue({ id: 'ring', stock: stock.product, price: 100, status: 'ACTIVE' }) },
    productVariant: { findFirst: jest.fn().mockResolvedValue({ id: 'ring_gold', stock: stock.variant ?? 0, price: 100 }) },
  } as any;
  const reservations = { heldByCheckout: jest.fn().mockResolvedValue(held) } as any;
  return { engine: new DefaultCheckoutInventoryEngine(prisma, reservations), reservations };
}

describe('DefaultCheckoutInventoryEngine — own stock holds', () => {
  it('counts the units this checkout holds as available to it', async () => {
    const { engine } = makeEngine({ product: 0 }, new Map([['ring:', 1]]));

    const [r] = await engine.validateBatch('store_1', [input()], 'chk_a');

    expect(r.isAvailable).toBe(true);
    expect(r.isOutOfStock).toBe(false);
  });

  it('credits variant holds against the variant line', async () => {
    const { engine } = makeEngine({ product: 9, variant: 0 }, new Map([['ring:ring_gold', 1]]));

    const [r] = await engine.validateBatch('store_1', [input({ variantId: 'ring_gold' })], 'chk_a');

    expect(r.isAvailable).toBe(true);
  });

  it('another checkout\'s holds never count — sold-out stays sold out', async () => {
    const { engine, reservations } = makeEngine({ product: 0 }, new Map());

    const [r] = await engine.validateBatch('store_1', [input()], 'chk_b');

    expect(reservations.heldByCheckout).toHaveBeenCalledWith('chk_b');
    expect(r.isOutOfStock).toBe(true);
    expect(r.issue).toBe('OUT_OF_STOCK');
  });

  it('without a checkout id (cart-level checks) nothing is credited', async () => {
    const { engine, reservations } = makeEngine({ product: 0 }, new Map([['ring:', 1]]));

    const [r] = await engine.validateBatch('store_1', [input()]);

    expect(reservations.heldByCheckout).not.toHaveBeenCalled();
    expect(r.isOutOfStock).toBe(true);
  });
});
