import { NotFoundException } from '@nestjs/common';
import { OrderStatus, PaymentStatus } from '@prisma/client';
import { CustomerJwtStrategy } from '@/modules/customer-auth/strategies/customer-jwt.strategy';
import { CustomerOrdersController } from '../customer-orders.controller';
import { CustomerOrdersService } from '../customer-orders.service';

// ---------------------------------------------------------------------------
// Integration test — proves cross-customer/cross-tenant isolation through the
// REAL chain: CustomerJwtStrategy.validate() (resolves the principal attached
// to the request by CustomerJwtAuthGuard) → CustomerOrdersController (real)
// → CustomerOrdersService (real). OrdersService/PaymentService/PrismaService
// are test doubles standing in for three customers: two in the same store
// (the subtler boundary — storeId alone doesn't separate them) and one in a
// different store entirely.
// ---------------------------------------------------------------------------

const STORE_A = 'store_a';
const STORE_B = 'store_b';

const CUSTOMER_A = { id: 'cust_a', storeId: STORE_A, email: 'alice@example.com', name: 'Alice', isActive: true };
const CUSTOMER_A2 = { id: 'cust_a2', storeId: STORE_A, email: 'amit@example.com', name: 'Amit', isActive: true };
const CUSTOMER_B = { id: 'cust_b', storeId: STORE_B, email: 'bob@example.com', name: 'Bob', isActive: true };

const ORDER_A = 'order_a';
const ORDER_A2 = 'order_a2';
const ORDER_B = 'order_b';

function makeConfig() {
  return { get: jest.fn().mockReturnValue('test-customer-secret') } as any;
}

async function resolvePrincipal(customersById: Record<string, any>, customerId: string, storeId: string) {
  const prisma = {
    customer: {
      findFirst: jest.fn().mockImplementation(({ where }: any) => {
        const row = customersById[where.id];
        if (!row || row.storeId !== where.storeId) return Promise.resolve(null);
        return Promise.resolve(row);
      }),
    },
  } as any;
  const strategy = new CustomerJwtStrategy(makeConfig(), prisma);
  return strategy.validate({ sub: customerId, storeId, email: 'irrelevant@example.com', type: 'customer' });
}

function makeOrderRow(id: string, storeId: string, customerId: string) {
  return {
    id, storeId, customerId, orderNumber: `ORD-${id}`, status: OrderStatus.PROCESSING, paymentStatus: PaymentStatus.PAID,
    paymentMethod: 'cod', subtotal: 100, discount: 0, tax: 0, shippingCost: 0, total: 100, refundedAmount: 0,
    couponCode: null, shippingAddress: null, billingAddress: null, paymentTransactionId: null,
    confirmedAt: null, cancelledAt: null, cancellationReason: null, createdAt: new Date('2026-01-01'),
    // `items`/`_count` here serve the listOrders() path (prisma.order.findMany);
    // getOrderDetails() goes through the separate ordersService.findOne mock
    // below and uses these same rows too, but only reads statusHistory/shipments/refunds.
    items: [], _count: { items: 0 }, statusHistory: [], shipments: [], refunds: [],
  };
}

function buildHarness() {
  const customersById = { cust_a: CUSTOMER_A, cust_a2: CUSTOMER_A2, cust_b: CUSTOMER_B };
  const orders: Record<string, any> = {
    [ORDER_A]: makeOrderRow(ORDER_A, STORE_A, 'cust_a'),
    [ORDER_A2]: makeOrderRow(ORDER_A2, STORE_A, 'cust_a2'),
    [ORDER_B]: makeOrderRow(ORDER_B, STORE_B, 'cust_b'),
  };

  const prisma = {
    order: {
      findMany: jest.fn().mockImplementation(({ where }: any) => Promise.resolve(
        Object.values(orders).filter((o: any) => o.storeId === where.storeId && o.customerId === where.customerId),
      )),
      count: jest.fn().mockImplementation(({ where }: any) => Promise.resolve(
        Object.values(orders).filter((o: any) => o.storeId === where.storeId && o.customerId === where.customerId).length,
      )),
    },
  } as any;

  // Mirrors the real OrdersService.findOne contract exactly: scoped by
  // (id, storeId) ONLY — it deliberately does not know about customerId.
  // CustomerOrdersService's own ownership check is what's under test here.
  const ordersService = {
    findOne: jest.fn().mockImplementation((storeId: string, id: string) => {
      const order = orders[id];
      if (!order || order.storeId !== storeId) throw new NotFoundException('Order not found');
      return Promise.resolve(order);
    }),
  } as any;

  const paymentService = { getPayment: jest.fn() } as any;

  const service = new CustomerOrdersService(prisma, ordersService, paymentService);
  const controller = new CustomerOrdersController(service);

  return {
    controller, ordersService, customersById,
  };
}

describe('Customer Orders — cross-customer isolation (integration)', () => {
  it('customer A\'s order list never includes A2\'s or B\'s orders', async () => {
    const h = buildHarness();
    const principalA = await resolvePrincipal(h.customersById, 'cust_a', STORE_A);

    const result = await h.controller.list(principalA, {} as any);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe(ORDER_A);
  });

  it('customer A can view their own order', async () => {
    const h = buildHarness();
    const principalA = await resolvePrincipal(h.customersById, 'cust_a', STORE_A);

    const result = await h.controller.getOne(principalA, ORDER_A);

    expect(result.id).toBe(ORDER_A);
  });

  it('customer A cannot view A2\'s order, even though they share a store (404, not a leak)', async () => {
    const h = buildHarness();
    const principalA = await resolvePrincipal(h.customersById, 'cust_a', STORE_A);

    await expect(h.controller.getOne(principalA, ORDER_A2)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('customer A cannot view B\'s order (different store)', async () => {
    const h = buildHarness();
    const principalA = await resolvePrincipal(h.customersById, 'cust_a', STORE_A);

    await expect(h.controller.getOne(principalA, ORDER_B)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('a forged principal (A\'s id under B\'s storeId) cannot reach A\'s order either', async () => {
    const h = buildHarness();
    const forged = { ...CUSTOMER_A, storeId: STORE_B };

    // OrdersService.findOne itself 404s here — order_a lives in STORE_A, not STORE_B.
    await expect(h.controller.getOne(forged, ORDER_A)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('customer A2 sees only their own order, not A\'s, despite sharing a store', async () => {
    const h = buildHarness();
    const principalA2 = await resolvePrincipal(h.customersById, 'cust_a2', STORE_A);

    const result = await h.controller.list(principalA2, {} as any);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe(ORDER_A2);
  });

  it('customer B\'s list never includes any store_a orders', async () => {
    const h = buildHarness();
    const principalB = await resolvePrincipal(h.customersById, 'cust_b', STORE_B);

    const result = await h.controller.list(principalB, {} as any);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe(ORDER_B);
  });
});
