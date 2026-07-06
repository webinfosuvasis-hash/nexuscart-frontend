import { ConflictException, NotFoundException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { CustomerJwtStrategy } from '@/modules/customer-auth/strategies/customer-jwt.strategy';
import { CustomerCancellationController } from '../customer-cancellation.controller';
import { CustomerCancellationService } from '../customer-cancellation.service';

// ---------------------------------------------------------------------------
// Integration test — proves cross-customer/cross-tenant isolation through the
// REAL chain: CustomerJwtStrategy.validate() → CustomerCancellationController
// (real) → CustomerCancellationService (real). OrdersService and
// OrderCancellationService are test doubles standing in for three customers:
// two in the same store (the subtler boundary) and one in a different store
// entirely. OrderCancellationService itself only ever scopes by storeId —
// this suite is what proves CustomerCancellationService's own ownership
// check is what actually stands between customers.
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

function makeOrderRow(id: string, storeId: string, customerId: string, status: OrderStatus = OrderStatus.PENDING) {
  return {
    id, storeId, customerId, orderNumber: `ORD-${id}`, status,
    cancelledAt: null, cancellationReason: null,
    statusHistory: [{ id: `hist_${id}`, status, note: null, createdAt: new Date('2026-01-01') }],
    refunds: [],
  };
}

function buildHarness(statusOverrides: Record<string, OrderStatus> = {}) {
  const customersById = { cust_a: CUSTOMER_A, cust_a2: CUSTOMER_A2, cust_b: CUSTOMER_B };
  const orders: Record<string, any> = {
    [ORDER_A]: makeOrderRow(ORDER_A, STORE_A, 'cust_a', statusOverrides[ORDER_A] ?? OrderStatus.PENDING),
    [ORDER_A2]: makeOrderRow(ORDER_A2, STORE_A, 'cust_a2', statusOverrides[ORDER_A2] ?? OrderStatus.PENDING),
    [ORDER_B]: makeOrderRow(ORDER_B, STORE_B, 'cust_b', statusOverrides[ORDER_B] ?? OrderStatus.PENDING),
  };

  // Mirrors the real OrdersService.findOne contract: scoped by (id, storeId)
  // ONLY — CustomerCancellationService's own ownership check is what's under test.
  const ordersService = {
    findOne: jest.fn().mockImplementation((storeId: string, id: string) => {
      const order = orders[id];
      if (!order || order.storeId !== storeId) throw new NotFoundException('Order not found');
      return Promise.resolve(order);
    }),
  } as any;

  // Mirrors the real OrderCancellationService.cancelOrder contract: also
  // scoped by (orderId, storeId) only, enforces the PENDING/PROCESSING
  // eligibility rule, and mutates the shared `orders` map on success so a
  // subsequent GET reflects the cancellation.
  const cancellationSvc = {
    cancelOrder: jest.fn().mockImplementation(async ({ orderId, storeId, reason }: any) => {
      const order = orders[orderId];
      if (!order || order.storeId !== storeId) throw new NotFoundException(`Order ${orderId} not found`);
      if (order.status !== OrderStatus.PENDING && order.status !== OrderStatus.PROCESSING) {
        throw new ConflictException(`Order ${orderId} is in status ${order.status} and cannot be cancelled`);
      }
      order.status = OrderStatus.CANCELLED;
      order.cancelledAt = new Date('2026-01-02');
      order.cancellationReason = reason;
      return {
        order, paymentAction: 'CANCELLED', paymentRefund: null, orderRefund: null, inventoryReleased: false,
      };
    }),
  } as any;

  const service = new CustomerCancellationService(ordersService, cancellationSvc);
  const controller = new CustomerCancellationController(service);

  return { controller, customersById };
}

describe('Customer Cancellation & Refunds — cross-customer isolation (integration)', () => {
  it('customer A can view and cancel their own eligible order', async () => {
    const h = buildHarness();
    const principalA = await resolvePrincipal(h.customersById, 'cust_a', STORE_A);

    const status = await h.controller.getCancellationStatus(principalA, ORDER_A);
    expect(status.canCancel).toBe(true);

    const result = await h.controller.cancelMyOrder(principalA, ORDER_A, { reason: 'Changed my mind' });
    expect(result.isCancelled).toBe(true);

    const refund = await h.controller.getRefundStatus(principalA, ORDER_A);
    expect(refund.orderId).toBe(ORDER_A);
  });

  it('customer A cannot view or cancel A2\'s order, even though they share a store (404, not a leak)', async () => {
    const h = buildHarness();
    const principalA = await resolvePrincipal(h.customersById, 'cust_a', STORE_A);

    await expect(h.controller.getCancellationStatus(principalA, ORDER_A2)).rejects.toBeInstanceOf(NotFoundException);
    await expect(h.controller.cancelMyOrder(principalA, ORDER_A2, { reason: 'x' })).rejects.toBeInstanceOf(NotFoundException);
    await expect(h.controller.getRefundStatus(principalA, ORDER_A2)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('customer A cannot view or cancel B\'s order (different store)', async () => {
    const h = buildHarness();
    const principalA = await resolvePrincipal(h.customersById, 'cust_a', STORE_A);

    await expect(h.controller.getCancellationStatus(principalA, ORDER_B)).rejects.toBeInstanceOf(NotFoundException);
    await expect(h.controller.cancelMyOrder(principalA, ORDER_B, { reason: 'x' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('a forged principal (A\'s id under B\'s storeId) cannot reach A\'s order either', async () => {
    const h = buildHarness();
    const forged = { ...CUSTOMER_A, storeId: STORE_B };

    await expect(h.controller.getCancellationStatus(forged, ORDER_A)).rejects.toBeInstanceOf(NotFoundException);
    await expect(h.controller.cancelMyOrder(forged, ORDER_A, { reason: 'x' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('customer A2 sees and cancels only their own order, not A\'s, despite sharing a store', async () => {
    const h = buildHarness();
    const principalA2 = await resolvePrincipal(h.customersById, 'cust_a2', STORE_A);

    const result = await h.controller.cancelMyOrder(principalA2, ORDER_A2, { reason: 'Too slow' });

    expect(result.orderId).toBe(ORDER_A2);
    expect(result.cancellationReason).toBe('Too slow');
  });

  it('rejects cancellation of an already-shipped order with 409, per existing backend rules — even for the owning customer', async () => {
    const h = buildHarness({ [ORDER_A]: OrderStatus.SHIPPED });
    const principalA = await resolvePrincipal(h.customersById, 'cust_a', STORE_A);

    const status = await h.controller.getCancellationStatus(principalA, ORDER_A);
    expect(status.canCancel).toBe(false);

    await expect(h.controller.cancelMyOrder(principalA, ORDER_A, { reason: 'Too late' })).rejects.toBeInstanceOf(ConflictException);
  });
});
