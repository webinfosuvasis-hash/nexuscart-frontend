import { NotFoundException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { CustomerJwtStrategy } from '@/modules/customer-auth/strategies/customer-jwt.strategy';
import { CustomerShipmentController } from '../customer-shipment.controller';
import { CustomerShipmentService } from '../customer-shipment.service';

// ---------------------------------------------------------------------------
// Integration test — proves cross-customer/cross-tenant isolation through the
// REAL chain: CustomerJwtStrategy.validate() → CustomerShipmentController
// (real) → CustomerShipmentService (real). OrdersService/PrismaService are
// test doubles standing in for three customers: two in the same store (the
// subtler boundary) and one in a different store entirely.
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
    id, storeId, customerId, orderNumber: `ORD-${id}`, status: OrderStatus.SHIPPED,
    items: [{ productId: 'prod_1', variantId: null, productName: 'Ring', variantName: null, sku: 'SKU-1', thumbnail: null }],
    statusHistory: [{ id: `hist_${id}`, status: OrderStatus.SHIPPED, note: null, createdAt: new Date('2026-01-01') }],
    shipments: [{
      id: `ship_${id}`, orderId: id, trackingNumber: `TRK-${id}`, carrier: 'FedEx', status: 'SHIPPED',
      shippedAt: new Date('2026-01-01'), deliveredAt: null,
    }],
  };
}

function buildHarness() {
  const customersById = { cust_a: CUSTOMER_A, cust_a2: CUSTOMER_A2, cust_b: CUSTOMER_B };
  const orders: Record<string, any> = {
    [ORDER_A]: makeOrderRow(ORDER_A, STORE_A, 'cust_a'),
    [ORDER_A2]: makeOrderRow(ORDER_A2, STORE_A, 'cust_a2'),
    [ORDER_B]: makeOrderRow(ORDER_B, STORE_B, 'cust_b'),
  };

  const prisma = { shipmentItem: { findMany: jest.fn().mockResolvedValue([]) } } as any;

  // Mirrors the real OrdersService.findOne contract: scoped by (id, storeId)
  // ONLY — CustomerShipmentService's own ownership check is what's under test.
  const ordersService = {
    findOne: jest.fn().mockImplementation((storeId: string, id: string) => {
      const order = orders[id];
      if (!order || order.storeId !== storeId) throw new NotFoundException('Order not found');
      return Promise.resolve(order);
    }),
  } as any;

  const service = new CustomerShipmentService(prisma, ordersService);
  const controller = new CustomerShipmentController(service);

  return { controller, customersById };
}

describe('Customer Shipment Tracking — cross-customer isolation (integration)', () => {
  it('customer A can view their own shipment and tracking', async () => {
    const h = buildHarness();
    const principalA = await resolvePrincipal(h.customersById, 'cust_a', STORE_A);

    const shipment = await h.controller.getShipment(principalA, ORDER_A);
    const tracking = await h.controller.getTracking(principalA, ORDER_A);

    expect(shipment.orderId).toBe(ORDER_A);
    expect(tracking.orderId).toBe(ORDER_A);
  });

  it('customer A cannot view A2\'s shipment/tracking, even though they share a store (404, not a leak)', async () => {
    const h = buildHarness();
    const principalA = await resolvePrincipal(h.customersById, 'cust_a', STORE_A);

    await expect(h.controller.getShipment(principalA, ORDER_A2)).rejects.toBeInstanceOf(NotFoundException);
    await expect(h.controller.getTracking(principalA, ORDER_A2)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('customer A cannot view B\'s shipment/tracking (different store)', async () => {
    const h = buildHarness();
    const principalA = await resolvePrincipal(h.customersById, 'cust_a', STORE_A);

    await expect(h.controller.getShipment(principalA, ORDER_B)).rejects.toBeInstanceOf(NotFoundException);
    await expect(h.controller.getTracking(principalA, ORDER_B)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('a forged principal (A\'s id under B\'s storeId) cannot reach A\'s shipment either', async () => {
    const h = buildHarness();
    const forged = { ...CUSTOMER_A, storeId: STORE_B };

    await expect(h.controller.getShipment(forged, ORDER_A)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('customer A2 sees only their own shipment, not A\'s, despite sharing a store', async () => {
    const h = buildHarness();
    const principalA2 = await resolvePrincipal(h.customersById, 'cust_a2', STORE_A);

    const shipment = await h.controller.getShipment(principalA2, ORDER_A2);

    expect(shipment.orderId).toBe(ORDER_A2);
    expect(shipment.shipments[0].trackingNumber).toBe(`TRK-${ORDER_A2}`);
  });
});
