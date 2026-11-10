import { InventoryReservationStatus, Prisma } from '@prisma/client';
import { InsufficientStockException, InventoryReservationService } from './inventory-reservation.service';

// ─── In-memory Prisma double ────────────────────────────────────────────────
//
// Models the two database guarantees the service relies on:
//  1. a conditional UPDATE (`stock >= qty`) evaluates against committed data —
//     transactions are serialized here, as InnoDB row locks serialize writers
//     to the same row;
//  2. a transaction that throws is rolled back completely.
// Everything else is plain filtering over arrays.

interface State {
  products:     Record<string, { storeId: string; stock: number; trackInventory: boolean }>;
  variants:     Record<string, { productId: string; stock: number }>;
  reservations: Array<{
    id: string; storeId: string; paymentTransactionId: string | null; tentativeOrderId: string;
    status: InventoryReservationStatus; expiresAt: Date; reservedAt?: Date; releasedAt: Date | null;
  }>;
  items:        Array<{ id: string; reservationId: string; storeId: string; productId: string; variantId: string | null; quantity: number }>;
  movements:    Array<{ productId: string; type: string; quantity: number; reference: string; reason: string }>;
}

const STORE = 'store_1';
let seq = 0;
const id = (p: string) => `${p}_${++seq}`;

const matchStatus = (actual: string, want: any) =>
  want === undefined || (typeof want === 'object' ? want.in.includes(actual) : actual === want);

function p2002() {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' });
}

function makeDb(state: State) {
  const tick = () => new Promise((r) => setImmediate(r)); // let concurrent callers interleave

  const db: any = {
    product: {
      findMany: async ({ where }: any) => Object.entries(state.products)
        .filter(([pid, p]) => where.id.in.includes(pid) && p.storeId === where.storeId
          && (where.trackInventory === undefined || p.trackInventory === where.trackInventory))
        .map(([pid]) => ({ id: pid })),
      updateMany: async ({ where, data }: any) => {
        await tick();
        const p = state.products[where.id];
        if (!p || p.storeId !== where.storeId) return { count: 0 };
        if (where.stock?.gte !== undefined && p.stock < where.stock.gte) return { count: 0 };
        p.stock += data.stock.increment ?? -data.stock.decrement;
        return { count: 1 };
      },
    },
    productVariant: {
      updateMany: async ({ where, data }: any) => {
        await tick();
        const v = state.variants[where.id];
        if (!v || v.productId !== where.productId) return { count: 0 };
        if (where.stock?.gte !== undefined && v.stock < where.stock.gte) return { count: 0 };
        v.stock += data.stock.increment ?? -data.stock.decrement;
        return { count: 1 };
      },
    },
    inventoryReservation: {
      findUnique: async ({ where, include }: any) => {
        const r = state.reservations.find((x) => (where.id ? x.id === where.id : x.paymentTransactionId === where.paymentTransactionId));
        if (!r) return null;
        return include?.items ? { ...r, items: state.items.filter((i) => i.reservationId === r.id) } : { ...r };
      },
      findMany: async ({ where }: any) => state.reservations
        .filter((r) => r.tentativeOrderId === where.tentativeOrderId && r.storeId === where.storeId && matchStatus(r.status, where.status))
        .map((r) => ({ id: r.id })),
      create: async ({ data }: any) => {
        await tick();
        if (state.reservations.some((r) => r.paymentTransactionId === data.paymentTransactionId)) throw p2002();
        const r = { status: InventoryReservationStatus.RESERVED, releasedAt: null, ...data, id: id('res') };
        state.reservations.push(r);
        return { id: r.id };
      },
      updateMany: async ({ where, data }: any) => {
        await tick();
        const hits = state.reservations.filter((r) =>
          (where.id === undefined || r.id === where.id)
          && (where.paymentTransactionId === undefined || r.paymentTransactionId === where.paymentTransactionId)
          && matchStatus(r.status, where.status));
        hits.forEach((r) => Object.assign(r, data));
        return { count: hits.length };
      },
    },
    inventoryReservationItem: {
      deleteMany: async ({ where }: any) => { state.items = state.items.filter((i) => i.reservationId !== where.reservationId); },
      createMany: async ({ data }: any) => { data.forEach((d: any) => state.items.push({ id: id('item'), ...d })); },
      findMany: async ({ where }: any) => {
        const live = new Set(state.reservations
          .filter((r) => r.tentativeOrderId === where.reservation.tentativeOrderId && r.status === where.reservation.status)
          .map((r) => r.id));
        return state.items.filter((i) => live.has(i.reservationId));
      },
    },
    stockMovement: {
      createMany: async ({ data }: any) => { data.forEach((d: any) => state.movements.push(d)); },
    },
  };

  // Serialized transactions with full rollback on throw.
  let queue: Promise<unknown> = Promise.resolve();
  db.$transaction = (fn: (tx: any) => Promise<unknown>) => {
    const run = queue.then(async () => {
      const snapshot = JSON.parse(JSON.stringify(state));
      try {
        return await fn(db);
      } catch (err) {
        for (const k of Object.keys(state) as (keyof State)[]) (state as any)[k] = snapshot[k];
        // JSON round-trip turns Dates into strings; good enough for these assertions.
        throw err;
      }
    });
    queue = run.catch(() => undefined);
    return run;
  };
  return db;
}

function setup(products: State['products'], variants: State['variants'] = {}) {
  const state: State = { products, variants, reservations: [], items: [], movements: [] };
  const service = new InventoryReservationService(makeDb(state) as any);
  return { state, service };
}

const inAnHour = () => new Date(Date.now() + 3600_000);
const reserve = (service: InventoryReservationService, payment: string, checkout: string, lines: any[]) =>
  service.reserveForPayment({ storeId: STORE, checkoutId: checkout, paymentTransactionId: payment, lines, expiresAt: inAnHour() });
const line = (productId: string, quantity: number, variantId: string | null = null) => ({ productId, variantId, quantity });

// ─── Concurrency ──────────────────────────────────────────────────────────

describe('InventoryReservationService — concurrent checkouts cannot oversell', () => {
  it('two shoppers racing for the last unit: exactly one wins, stock ends at 0', async () => {
    const { state, service } = setup({ ring: { storeId: STORE, stock: 1, trackInventory: true } });

    const results = await Promise.allSettled([
      reserve(service, 'pay_a', 'chk_a', [line('ring', 1)]),
      reserve(service, 'pay_b', 'chk_b', [line('ring', 1)]),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(InsufficientStockException);
    expect(state.products.ring.stock).toBe(0);
    expect(state.reservations.filter((r) => r.status === InventoryReservationStatus.RESERVED)).toHaveLength(1);
  });

  it('ten concurrent buyers for 3 units: exactly 3 holds, stock never negative', async () => {
    const { state, service } = setup({ ring: { storeId: STORE, stock: 3, trackInventory: true } });

    const results = await Promise.allSettled(
      Array.from({ length: 10 }, (_, i) => reserve(service, `pay_${i}`, `chk_${i}`, [line('ring', 1)])),
    );

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(3);
    expect(state.products.ring.stock).toBe(0);
    expect(state.reservations).toHaveLength(3); // losers' reservation rows were rolled back too
  });

  it('is all-or-nothing across lines: one short line leaves every other line untouched', async () => {
    const { state, service } = setup({
      ring:     { storeId: STORE, stock: 5, trackInventory: true },
      bracelet: { storeId: STORE, stock: 1, trackInventory: true },
    });

    await expect(reserve(service, 'pay_a', 'chk_a', [line('ring', 2), line('bracelet', 2)]))
      .rejects.toMatchObject({ productIds: ['bracelet'] });

    expect(state.products.ring.stock).toBe(5);
    expect(state.products.bracelet.stock).toBe(1);
    expect(state.reservations).toHaveLength(0);
    expect(state.movements).toHaveLength(0);
  });

  it('a double-clicked Pay (same payment attempt, concurrently) takes the stock once', async () => {
    const { state, service } = setup({ ring: { storeId: STORE, stock: 5, trackInventory: true } });

    await Promise.all([
      reserve(service, 'pay_a', 'chk_a', [line('ring', 2)]),
      reserve(service, 'pay_a', 'chk_a', [line('ring', 2)]),
    ]);
    await reserve(service, 'pay_a', 'chk_a', [line('ring', 2)]);

    expect(state.products.ring.stock).toBe(3);
    expect(state.reservations).toHaveLength(1);
  });
});

// ─── What is held ──────────────────────────────────────────────────────────

describe('InventoryReservationService — what gets held', () => {
  it('holds variant lines against the variant, plain lines against the product, and merges duplicates', async () => {
    const { state, service } = setup(
      { saree: { storeId: STORE, stock: 10, trackInventory: true } },
      { saree_red: { productId: 'saree', stock: 2 } },
    );

    await reserve(service, 'pay_a', 'chk_a', [line('saree', 1, 'saree_red'), line('saree', 1, 'saree_red'), line('saree', 3)]);

    expect(state.variants.saree_red.stock).toBe(0);
    expect(state.products.saree.stock).toBe(7);
    expect(state.items.map((i) => [i.variantId, i.quantity])).toEqual([['saree_red', 2], [null, 3]]);
    expect(state.movements.every((m) => m.type === 'OUT' && m.reference === 'pay_a')).toBe(true);
  });

  it('never holds products that do not track inventory (or belong to another store)', async () => {
    const { state, service } = setup({
      gift_card: { storeId: STORE, stock: 0, trackInventory: false },
      foreign:   { storeId: 'other_store', stock: 1, trackInventory: true },
    });

    await reserve(service, 'pay_a', 'chk_a', [line('gift_card', 4), line('foreign', 1)]);

    expect(state.products.gift_card.stock).toBe(0);
    expect(state.products.foreign.stock).toBe(1);
    expect(state.items).toHaveLength(0);
  });

  it('reports what a checkout itself holds so its own hold never reads as out of stock', async () => {
    const { service } = setup(
      { saree: { storeId: STORE, stock: 3, trackInventory: true } },
      { saree_red: { productId: 'saree', stock: 1 } },
    );
    await reserve(service, 'pay_a', 'chk_a', [line('saree', 1, 'saree_red'), line('saree', 2)]);

    const held = await service.heldByCheckout('chk_a');
    expect(held.get('saree:saree_red')).toBe(1);
    expect(held.get('saree:')).toBe(2);
    expect((await service.heldByCheckout('chk_other')).size).toBe(0);
  });
});

// ─── Lifecycle: retry, expiry, cancellation, order ─────────────────────────

describe('InventoryReservationService — hold lifecycle', () => {
  it('payment retry: the hold moves to the new attempt and is not taken twice', async () => {
    const { state, service } = setup({ ring: { storeId: STORE, stock: 2, trackInventory: true } });
    await reserve(service, 'pay_1', 'chk_a', [line('ring', 1)]);

    expect(await service.transferToPayment('pay_1', 'pay_2')).toBe(true);
    await reserve(service, 'pay_2', 'chk_a', [line('ring', 1)]); // idempotent for the new attempt

    expect(state.products.ring.stock).toBe(1);
    expect(state.reservations).toHaveLength(1);
    expect(state.reservations[0].paymentTransactionId).toBe('pay_2');
    expect(await service.transferToPayment('pay_1', 'pay_3')).toBe(false); // nothing left on the old attempt
  });

  it('expiry returns the units exactly once, even when the cleanup job and a cancel race', async () => {
    const { state, service } = setup({ ring: { storeId: STORE, stock: 2, trackInventory: true } });
    await reserve(service, 'pay_1', 'chk_a', [line('ring', 2)]);
    const resId = state.reservations[0].id;

    const [a, b] = await Promise.all([service.expire(resId), service.releaseForCheckout('chk_a', STORE)]);

    expect(Number(a) + Number(b)).toBe(1);
    expect(state.products.ring.stock).toBe(2);
    expect(state.movements.filter((m) => m.type === 'IN')).toHaveLength(1);
  });

  it('a lapsed hold is re-taken when the same attempt pays again (retry after expiry)', async () => {
    const { state, service } = setup({ ring: { storeId: STORE, stock: 1, trackInventory: true } });
    await reserve(service, 'pay_1', 'chk_a', [line('ring', 1)]);
    await service.expire(state.reservations[0].id);
    expect(state.products.ring.stock).toBe(1);

    await reserve(service, 'pay_1', 'chk_a', [line('ring', 1)]);

    expect(state.products.ring.stock).toBe(0);
    expect(state.reservations[0].status).toBe(InventoryReservationStatus.RESERVED);
  });

  it('a lapsed hold cannot be re-taken if someone else bought the unit meanwhile', async () => {
    const { state, service } = setup({ ring: { storeId: STORE, stock: 1, trackInventory: true } });
    await reserve(service, 'pay_1', 'chk_a', [line('ring', 1)]);
    await service.expire(state.reservations[0].id);
    await reserve(service, 'pay_9', 'chk_b', [line('ring', 1)]); // another shopper

    await expect(reserve(service, 'pay_1', 'chk_a', [line('ring', 1)])).rejects.toBeInstanceOf(InsufficientStockException);
    expect(state.products.ring.stock).toBe(0);
    expect(state.reservations.find((r) => r.paymentTransactionId === 'pay_1')!.status).toBe(InventoryReservationStatus.EXPIRED);
  });

  it('order creation commits a live hold without touching stock again, idempotently', async () => {
    const { state, service } = setup({ ring: { storeId: STORE, stock: 3, trackInventory: true } });
    await reserve(service, 'pay_1', 'chk_a', [line('ring', 2)]);

    const commit = () => service.commitForPayment({
      storeId: STORE, checkoutId: 'chk_a', paymentTransactionId: 'pay_1', fallbackLines: [line('ring', 2)],
    });
    await Promise.all([commit(), commit()]);
    await commit();

    expect(state.products.ring.stock).toBe(1);
    expect(state.reservations[0].status).toBe(InventoryReservationStatus.COMMITTED);
  });

  it('payment captured with no hold at all (pre-existing in-flight payment): deducts once, even if completion runs twice', async () => {
    const { state, service } = setup({ ring: { storeId: STORE, stock: 3, trackInventory: true } });

    const commit = () => service.commitForPayment({
      storeId: STORE, checkoutId: 'chk_a', paymentTransactionId: 'pay_1', fallbackLines: [line('ring', 2)],
    });
    await Promise.all([commit(), commit()]);

    expect(state.products.ring.stock).toBe(1);
    expect(state.reservations).toHaveLength(1);
    expect(state.reservations[0].status).toBe(InventoryReservationStatus.COMMITTED);
  });

  it('payment captured after its hold lapsed and the stock sold out: the order still commits, stock goes negative (oversell surfaced)', async () => {
    const { state, service } = setup({ ring: { storeId: STORE, stock: 1, trackInventory: true } });
    await reserve(service, 'pay_1', 'chk_a', [line('ring', 1)]);
    await service.expire(state.reservations[0].id);
    await reserve(service, 'pay_9', 'chk_b', [line('ring', 1)]);
    const errorSpy = jest.spyOn((service as any).logger, 'error').mockImplementation(() => undefined);

    await service.commitForPayment({
      storeId: STORE, checkoutId: 'chk_a', paymentTransactionId: 'pay_1', fallbackLines: [line('ring', 1)],
    });

    expect(state.products.ring.stock).toBe(-1);
    expect(state.reservations.find((r) => r.paymentTransactionId === 'pay_1')!.status).toBe(InventoryReservationStatus.COMMITTED);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('OVERSOLD'));
  });

  it('cancelling a committed order puts its units back on sale once', async () => {
    const { state, service } = setup({ ring: { storeId: STORE, stock: 2, trackInventory: true } });
    await reserve(service, 'pay_1', 'chk_a', [line('ring', 2)]);
    await service.commitForPayment({ storeId: STORE, checkoutId: 'chk_a', paymentTransactionId: 'pay_1', fallbackLines: [] });
    const resId = state.reservations[0].id;

    expect(await service.restockCommitted(resId)).toBe(true);
    expect(await service.restockCommitted(resId)).toBe(false);

    expect(state.products.ring.stock).toBe(2);
    expect(state.reservations[0].status).toBe(InventoryReservationStatus.RELEASED);
  });

  it('checkout cancel releases only that checkout\'s pending holds', async () => {
    const { state, service } = setup({ ring: { storeId: STORE, stock: 3, trackInventory: true } });
    await reserve(service, 'pay_1', 'chk_a', [line('ring', 1)]);
    await reserve(service, 'pay_2', 'chk_b', [line('ring', 1)]);

    expect(await service.releaseForCheckout('chk_a', STORE)).toBe(1);

    expect(state.products.ring.stock).toBe(2);
    expect(state.reservations.find((r) => r.tentativeOrderId === 'chk_b')!.status).toBe(InventoryReservationStatus.RESERVED);
  });
});
