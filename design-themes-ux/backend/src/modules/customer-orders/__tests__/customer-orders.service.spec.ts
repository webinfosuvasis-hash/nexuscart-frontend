import { NotFoundException } from '@nestjs/common';
import { OrderStatus, PaymentStatus, PaymentTxStatus } from '@prisma/client';
import { CustomerOrdersService } from '../customer-orders.service';
import { CustomerOrderStatusFilter } from '../dto/list-customer-orders.dto';

const STORE_ID = 'store_1';
const CUSTOMER_ID = 'cust_1';
const ORDER_ID = 'order_1';

function makeAddressJson(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    firstName: 'Priya', lastName: 'Sharma', line1: '221B Test St', line2: null,
    city: 'Mumbai', state: 'MH', postalCode: '400001', country: 'IN', phone: '9876543210', email: 'priya@example.com',
    ...overrides,
  });
}

function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: ORDER_ID,
    storeId: STORE_ID,
    customerId: CUSTOMER_ID,
    orderNumber: 'ORD-1001',
    status: OrderStatus.PROCESSING,
    paymentStatus: PaymentStatus.PAID,
    paymentMethod: 'razorpay',
    subtotal: 1000, discount: 50, tax: 90, shippingCost: 0, total: 1040, refundedAmount: 0,
    couponCode: 'SAVE10',
    shippingAddress: makeAddressJson(),
    billingAddress: makeAddressJson(),
    paymentTransactionId: 'pay_1',
    confirmedAt: new Date('2026-01-01'),
    cancelledAt: null,
    cancellationReason: null,
    createdAt: new Date('2026-01-01'),
    items: [
      {
        id: 'item_1', productId: 'prod_1', variantId: null, productName: 'Ring', variantName: null,
        sku: 'SKU-1', quantity: 1, unitPrice: 1000, total: 1000, thumbnail: 'https://img/1.jpg',
        variantOptions: null, comparePrice: null, lineDiscount: 50, taxAmount: 90,
      },
    ],
    statusHistory: [
      { id: 'hist_1', status: OrderStatus.PENDING, note: null, createdAt: new Date('2026-01-01') },
      { id: 'hist_2', status: OrderStatus.PROCESSING, note: 'Payment captured', createdAt: new Date('2026-01-02') },
    ],
    shipments: [],
    refunds: [],
    ...overrides,
  } as any;
}

function makeTx(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pay_1', storeId: STORE_ID, gatewayCode: 'razorpay', status: PaymentTxStatus.CAPTURED,
    amountInPaise: 104000, currency: 'INR', gatewayPaymentId: 'rzp_pay_1', capturedAt: new Date('2026-01-01'),
    ...overrides,
  } as any;
}

function makeDeps() {
  const prisma = {
    order: { findMany: jest.fn(), count: jest.fn() },
  } as any;
  const ordersService = { findOne: jest.fn() } as any;
  const paymentService = { getPayment: jest.fn() } as any;
  return { prisma, ordersService, paymentService };
}

function makeService(deps: ReturnType<typeof makeDeps>) {
  return new CustomerOrdersService(deps.prisma, deps.ordersService, deps.paymentService);
}

describe('CustomerOrdersService — listOrders', () => {
  it('scopes the query by (storeId, customerId) together', async () => {
    const deps = makeDeps();
    deps.prisma.order.findMany.mockResolvedValue([]);
    deps.prisma.order.count.mockResolvedValue(0);
    const service = makeService(deps);

    await service.listOrders(CUSTOMER_ID, STORE_ID, {});

    expect(deps.prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { storeId: STORE_ID, customerId: CUSTOMER_ID } }),
    );
    expect(deps.prisma.order.count).toHaveBeenCalledWith({ where: { storeId: STORE_ID, customerId: CUSTOMER_ID } });
  });

  it('maps the "PAID" filter to paymentStatus, not status', async () => {
    const deps = makeDeps();
    deps.prisma.order.findMany.mockResolvedValue([]);
    deps.prisma.order.count.mockResolvedValue(0);
    const service = makeService(deps);

    await service.listOrders(CUSTOMER_ID, STORE_ID, { status: CustomerOrderStatusFilter.PAID });

    const call = deps.prisma.order.findMany.mock.calls[0][0];
    expect(call.where).toEqual({ storeId: STORE_ID, customerId: CUSTOMER_ID, paymentStatus: PaymentStatus.PAID });
  });

  it.each([
    CustomerOrderStatusFilter.PENDING,
    CustomerOrderStatusFilter.SHIPPED,
    CustomerOrderStatusFilter.DELIVERED,
    CustomerOrderStatusFilter.CANCELLED,
  ])('maps the "%s" filter to Order.status', async (status) => {
    const deps = makeDeps();
    deps.prisma.order.findMany.mockResolvedValue([]);
    deps.prisma.order.count.mockResolvedValue(0);
    const service = makeService(deps);

    await service.listOrders(CUSTOMER_ID, STORE_ID, { status });

    const call = deps.prisma.order.findMany.mock.calls[0][0];
    expect(call.where).toEqual({ storeId: STORE_ID, customerId: CUSTOMER_ID, status });
  });

  it('filters by search as a partial orderNumber match', async () => {
    const deps = makeDeps();
    deps.prisma.order.findMany.mockResolvedValue([]);
    deps.prisma.order.count.mockResolvedValue(0);
    const service = makeService(deps);

    await service.listOrders(CUSTOMER_ID, STORE_ID, { search: 'ORD-100' });

    const call = deps.prisma.order.findMany.mock.calls[0][0];
    expect(call.where.orderNumber).toEqual({ contains: 'ORD-100' });
  });

  it('applies sortBy/sortOrder to the query', async () => {
    const deps = makeDeps();
    deps.prisma.order.findMany.mockResolvedValue([]);
    deps.prisma.order.count.mockResolvedValue(0);
    const service = makeService(deps);

    await service.listOrders(CUSTOMER_ID, STORE_ID, { sortBy: 'total' as any, sortOrder: 'asc' });

    const call = deps.prisma.order.findMany.mock.calls[0][0];
    expect(call.orderBy).toEqual({ total: 'asc' });
  });

  it('clamps limit to a maximum of 50 even if a larger value is requested', async () => {
    const deps = makeDeps();
    deps.prisma.order.findMany.mockResolvedValue([]);
    deps.prisma.order.count.mockResolvedValue(0);
    const service = makeService(deps);

    const result = await service.listOrders(CUSTOMER_ID, STORE_ID, { limit: 500 as any });

    const call = deps.prisma.order.findMany.mock.calls[0][0];
    expect(call.take).toBe(50);
    expect(result.pagination.limit).toBe(50);
  });

  it('computes correct pagination skip/take and totalPages', async () => {
    const deps = makeDeps();
    deps.prisma.order.findMany.mockResolvedValue([]);
    deps.prisma.order.count.mockResolvedValue(45);
    const service = makeService(deps);

    const result = await service.listOrders(CUSTOMER_ID, STORE_ID, { page: 2, limit: 20 });

    const call = deps.prisma.order.findMany.mock.calls[0][0];
    expect(call.skip).toBe(20);
    expect(call.take).toBe(20);
    expect(result.pagination).toEqual({ page: 2, limit: 20, total: 45, totalPages: 3 });
  });

  it('maps each order to a summary with itemCount and first-item thumbnail, never the full item list', async () => {
    const deps = makeDeps();
    deps.prisma.order.findMany.mockResolvedValue([
      {
        id: ORDER_ID, orderNumber: 'ORD-1001', status: OrderStatus.PROCESSING, paymentStatus: PaymentStatus.PAID,
        total: 1040, createdAt: new Date('2026-01-01'),
        items: [{ thumbnail: 'https://img/1.jpg' }],
        _count: { items: 3 },
      },
    ]);
    deps.prisma.order.count.mockResolvedValue(1);
    const service = makeService(deps);

    const result = await service.listOrders(CUSTOMER_ID, STORE_ID, {});

    expect(result.items).toEqual([{
      id: ORDER_ID, orderNumber: 'ORD-1001', status: OrderStatus.PROCESSING, paymentStatus: PaymentStatus.PAID,
      total: 1040, itemCount: 3, thumbnail: 'https://img/1.jpg', createdAt: '2026-01-01T00:00:00.000Z',
    }]);
  });
});

describe('CustomerOrdersService — getOrderDetails', () => {
  it('reuses OrdersService.findOne and returns a fully mapped detail response', async () => {
    const deps = makeDeps();
    deps.ordersService.findOne.mockResolvedValue(makeOrder());
    deps.paymentService.getPayment.mockResolvedValue(makeTx());
    const service = makeService(deps);

    const result = await service.getOrderDetails(ORDER_ID, CUSTOMER_ID, STORE_ID);

    expect(deps.ordersService.findOne).toHaveBeenCalledWith(STORE_ID, ORDER_ID);
    expect(result.id).toBe(ORDER_ID);
    expect(result.totals).toEqual({
      subtotal: 1000, discount: 50, tax: 90, shippingCost: 0, total: 1040, refundedAmount: 0, couponCode: 'SAVE10',
    });
    expect(result.shippingAddress).toEqual(expect.objectContaining({ city: 'Mumbai', state: 'MH' }));
    expect(result.statusHistory).toHaveLength(2);
    expect(result.transaction).toEqual({
      id: 'pay_1', gatewayCode: 'razorpay', status: PaymentTxStatus.CAPTURED, amountInPaise: 104000,
      currency: 'INR', gatewayPaymentId: 'rzp_pay_1', capturedAt: '2026-01-01T00:00:00.000Z',
    });
  });

  it('throws NotFoundException (never leaking the order) when it belongs to a different customer', async () => {
    const deps = makeDeps();
    deps.ordersService.findOne.mockResolvedValue(makeOrder({ customerId: 'someone_else' }));
    const service = makeService(deps);

    await expect(service.getOrderDetails(ORDER_ID, CUSTOMER_ID, STORE_ID)).rejects.toBeInstanceOf(NotFoundException);
    expect(deps.paymentService.getPayment).not.toHaveBeenCalled();
  });

  it('propagates NotFoundException from OrdersService.findOne when the order does not exist in this store', async () => {
    const deps = makeDeps();
    deps.ordersService.findOne.mockRejectedValue(new NotFoundException('Order not found'));
    const service = makeService(deps);

    await expect(service.getOrderDetails(ORDER_ID, CUSTOMER_ID, STORE_ID)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('never includes OrderNote (staff-internal) in the response shape', async () => {
    const deps = makeDeps();
    deps.ordersService.findOne.mockResolvedValue(makeOrder({ notes: [{ id: 'note_1', content: 'internal staff note' }] }));
    deps.paymentService.getPayment.mockResolvedValue(makeTx());
    const service = makeService(deps);

    const result: any = await service.getOrderDetails(ORDER_ID, CUSTOMER_ID, STORE_ID);

    expect(result).not.toHaveProperty('notes');
    expect(JSON.stringify(result)).not.toContain('internal staff note');
  });

  it('returns null addresses when the stored JSON is malformed, without throwing', async () => {
    const deps = makeDeps();
    deps.ordersService.findOne.mockResolvedValue(makeOrder({ shippingAddress: '{not valid json', billingAddress: null }));
    deps.paymentService.getPayment.mockResolvedValue(makeTx());
    const service = makeService(deps);

    const result = await service.getOrderDetails(ORDER_ID, CUSTOMER_ID, STORE_ID);

    expect(result.shippingAddress).toBeNull();
    expect(result.billingAddress).toBeNull();
  });

  it('returns a null transaction when the order has no linked paymentTransactionId', async () => {
    const deps = makeDeps();
    deps.ordersService.findOne.mockResolvedValue(makeOrder({ paymentTransactionId: null }));
    const service = makeService(deps);

    const result = await service.getOrderDetails(ORDER_ID, CUSTOMER_ID, STORE_ID);

    expect(result.transaction).toBeNull();
    expect(deps.paymentService.getPayment).not.toHaveBeenCalled();
  });

  it('returns a null transaction (not a 500) when PaymentService.getPayment throws for a dangling id', async () => {
    const deps = makeDeps();
    deps.ordersService.findOne.mockResolvedValue(makeOrder());
    deps.paymentService.getPayment.mockRejectedValue(new NotFoundException('PaymentTransaction not found'));
    const service = makeService(deps);

    const result = await service.getOrderDetails(ORDER_ID, CUSTOMER_ID, STORE_ID);

    expect(result.transaction).toBeNull();
  });

  it('always reports carrierUrl and expectedDelivery as null (not persisted anywhere retrievable)', async () => {
    const deps = makeDeps();
    deps.ordersService.findOne.mockResolvedValue(makeOrder({
      shipments: [{
        id: 'ship_1', trackingNumber: 'TRK123', carrier: 'FedEx', status: 'SHIPPED',
        shippedAt: new Date('2026-01-03'), deliveredAt: null,
      }],
    }));
    deps.paymentService.getPayment.mockResolvedValue(makeTx());
    const service = makeService(deps);

    const result = await service.getOrderDetails(ORDER_ID, CUSTOMER_ID, STORE_ID);

    expect(result.shipments).toEqual([{
      id: 'ship_1', trackingNumber: 'TRK123', carrier: 'FedEx', carrierUrl: null,
      status: 'SHIPPED', shippedAt: '2026-01-03T00:00:00.000Z', deliveredAt: null, expectedDelivery: null,
    }]);
  });
});
