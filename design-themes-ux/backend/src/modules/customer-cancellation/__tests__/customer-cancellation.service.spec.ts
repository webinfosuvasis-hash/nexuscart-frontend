import { ConflictException, NotFoundException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { CustomerCancellationService } from '../customer-cancellation.service';

const STORE_ID = 'store_1';
const CUSTOMER_ID = 'cust_1';
const ORDER_ID = 'order_1';

function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: ORDER_ID,
    storeId: STORE_ID,
    customerId: CUSTOMER_ID,
    orderNumber: 'ORD-1001',
    status: OrderStatus.PENDING,
    cancelledAt: null,
    cancellationReason: null,
    statusHistory: [
      { id: 'hist_1', status: OrderStatus.PENDING, note: null, createdAt: new Date('2026-01-01') },
    ],
    refunds: [],
    ...overrides,
  } as any;
}

function makeDeps() {
  const ordersService = { findOne: jest.fn() } as any;
  const cancellationSvc = { cancelOrder: jest.fn() } as any;
  return { ordersService, cancellationSvc };
}

function makeService(deps: ReturnType<typeof makeDeps>) {
  return new CustomerCancellationService(deps.ordersService, deps.cancellationSvc);
}

describe('CustomerCancellationService — requestCancellation', () => {
  it('verifies ownership, delegates to OrderCancellationService.cancelOrder with a deterministic idempotency key, then re-reads the order', async () => {
    const deps = makeDeps();
    deps.ordersService.findOne
      .mockResolvedValueOnce(makeOrder())
      .mockResolvedValueOnce(makeOrder({
        status: OrderStatus.CANCELLED,
        cancelledAt: new Date('2026-01-02'),
        cancellationReason: 'Changed my mind',
        statusHistory: [
          { id: 'hist_1', status: OrderStatus.PENDING, note: null, createdAt: new Date('2026-01-01') },
          { id: 'hist_2', status: OrderStatus.CANCELLED, note: 'Changed my mind', createdAt: new Date('2026-01-02') },
        ],
      }));
    deps.cancellationSvc.cancelOrder.mockResolvedValue({
      order: makeOrder({ status: OrderStatus.CANCELLED }),
      paymentAction: 'CANCELLED',
      paymentRefund: null,
      orderRefund: null,
      inventoryReleased: true,
    });
    const service = makeService(deps);

    const result = await service.requestCancellation(ORDER_ID, CUSTOMER_ID, STORE_ID, 'Changed my mind');

    expect(deps.ordersService.findOne).toHaveBeenNthCalledWith(1, STORE_ID, ORDER_ID);
    expect(deps.cancellationSvc.cancelOrder).toHaveBeenCalledWith({
      orderId: ORDER_ID,
      storeId: STORE_ID,
      reason: 'Changed my mind',
      actorId: CUSTOMER_ID,
      idempotencyKey: `customer-cancel:${ORDER_ID}`,
    });
    expect(deps.ordersService.findOne).toHaveBeenNthCalledWith(2, STORE_ID, ORDER_ID);
    expect(result.orderStatus).toBe(OrderStatus.CANCELLED);
    expect(result.isCancelled).toBe(true);
    expect(result.canCancel).toBe(false);
    expect(result.paymentAction).toBe('CANCELLED');
    expect(result.cancellationReason).toBe('Changed my mind');
    expect(result.timeline).toHaveLength(2);
  });

  it('throws NotFoundException (never calling cancelOrder) when the order belongs to a different customer', async () => {
    const deps = makeDeps();
    deps.ordersService.findOne.mockResolvedValue(makeOrder({ customerId: 'someone_else' }));
    const service = makeService(deps);

    await expect(service.requestCancellation(ORDER_ID, CUSTOMER_ID, STORE_ID, 'reason')).rejects.toBeInstanceOf(NotFoundException);
    expect(deps.cancellationSvc.cancelOrder).not.toHaveBeenCalled();
  });

  it('propagates ConflictException from OrderCancellationService for an ineligible (e.g. shipped) order', async () => {
    const deps = makeDeps();
    deps.ordersService.findOne.mockResolvedValue(makeOrder({ status: OrderStatus.SHIPPED }));
    deps.cancellationSvc.cancelOrder.mockRejectedValue(
      new ConflictException(`Order ${ORDER_ID} is in status SHIPPED and cannot be cancelled`),
    );
    const service = makeService(deps);

    await expect(service.requestCancellation(ORDER_ID, CUSTOMER_ID, STORE_ID, 'reason')).rejects.toBeInstanceOf(ConflictException);
    expect(deps.ordersService.findOne).toHaveBeenCalledTimes(1);
  });

  it('propagates NotFoundException from OrdersService.findOne when the order does not exist in this store', async () => {
    const deps = makeDeps();
    deps.ordersService.findOne.mockRejectedValue(new NotFoundException('Order not found'));
    const service = makeService(deps);

    await expect(service.requestCancellation(ORDER_ID, CUSTOMER_ID, STORE_ID, 'reason')).rejects.toBeInstanceOf(NotFoundException);
    expect(deps.cancellationSvc.cancelOrder).not.toHaveBeenCalled();
  });
});

describe('CustomerCancellationService — getCancellationStatus', () => {
  it.each([
    [OrderStatus.PENDING, true],
    [OrderStatus.PROCESSING, true],
    [OrderStatus.SHIPPED, false],
    [OrderStatus.DELIVERED, false],
    [OrderStatus.CANCELLED, false],
    [OrderStatus.REFUNDED, false],
  ])('canCancel is %s for order status %s -> %s', async (status, expected) => {
    const deps = makeDeps();
    deps.ordersService.findOne.mockResolvedValue(makeOrder({ status }));
    const service = makeService(deps);

    const result = await service.getCancellationStatus(ORDER_ID, CUSTOMER_ID, STORE_ID);

    expect(result.canCancel).toBe(expected);
    expect(result.isCancelled).toBe(status === OrderStatus.CANCELLED);
    expect(result.paymentAction).toBeUndefined();
  });

  it('surfaces cancelledAt/cancellationReason and the real statusHistory as the timeline', async () => {
    const deps = makeDeps();
    deps.ordersService.findOne.mockResolvedValue(makeOrder({
      status: OrderStatus.CANCELLED,
      cancelledAt: new Date('2026-01-02'),
      cancellationReason: 'Out of stock',
    }));
    const service = makeService(deps);

    const result = await service.getCancellationStatus(ORDER_ID, CUSTOMER_ID, STORE_ID);

    expect(result.cancelledAt).toBe('2026-01-02T00:00:00.000Z');
    expect(result.cancellationReason).toBe('Out of stock');
    expect(result.timeline).toEqual([
      { id: 'hist_1', status: OrderStatus.PENDING, note: null, createdAt: '2026-01-01T00:00:00.000Z' },
    ]);
  });

  it('throws NotFoundException (never leaking the order) when it belongs to a different customer', async () => {
    const deps = makeDeps();
    deps.ordersService.findOne.mockResolvedValue(makeOrder({ customerId: 'someone_else' }));
    const service = makeService(deps);

    await expect(service.getCancellationStatus(ORDER_ID, CUSTOMER_ID, STORE_ID)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('CustomerCancellationService — getRefundStatus', () => {
  it('returns hasRefund=false and refund=null when there are no refunds (e.g. still pending or COD not yet cancelled)', async () => {
    const deps = makeDeps();
    deps.ordersService.findOne.mockResolvedValue(makeOrder({ refunds: [] }));
    const service = makeService(deps);

    const result = await service.getRefundStatus(ORDER_ID, CUSTOMER_ID, STORE_ID);

    expect(result).toEqual({ orderId: ORDER_ID, orderNumber: 'ORD-1001', hasRefund: false, refund: null });
  });

  it('returns the most recent refund when multiple exist, including the gateway transaction id', async () => {
    const deps = makeDeps();
    deps.ordersService.findOne.mockResolvedValue(makeOrder({
      refunds: [
        {
          id: 'refund_1', amount: 500, status: 'COMPLETED', reason: 'Old', gatewayRefundId: 'gw_old',
          createdAt: new Date('2026-01-01'),
        },
        {
          id: 'refund_2', amount: 999.5, status: 'PENDING', reason: 'Order cancellation: Changed my mind', gatewayRefundId: null,
          createdAt: new Date('2026-01-03'),
        },
      ],
    }));
    const service = makeService(deps);

    const result = await service.getRefundStatus(ORDER_ID, CUSTOMER_ID, STORE_ID);

    expect(result.hasRefund).toBe(true);
    expect(result.refund).toEqual({
      amount: 999.5,
      status: 'PENDING',
      reason: 'Order cancellation: Changed my mind',
      gatewayRefundId: null,
      createdAt: '2026-01-03T00:00:00.000Z',
    });
  });

  it('reports a COD out-of-band refund correctly as PENDING with no gateway transaction id', async () => {
    const deps = makeDeps();
    deps.ordersService.findOne.mockResolvedValue(makeOrder({
      refunds: [
        { id: 'refund_1', amount: 250, status: 'PENDING', reason: 'Order cancellation: COD', gatewayRefundId: null, createdAt: new Date('2026-01-01') },
      ],
    }));
    const service = makeService(deps);

    const result = await service.getRefundStatus(ORDER_ID, CUSTOMER_ID, STORE_ID);

    expect(result.refund).toEqual(expect.objectContaining({ status: 'PENDING', gatewayRefundId: null }));
  });

  it('throws NotFoundException (never leaking the order) when it belongs to a different customer', async () => {
    const deps = makeDeps();
    deps.ordersService.findOne.mockResolvedValue(makeOrder({ customerId: 'someone_else' }));
    const service = makeService(deps);

    await expect(service.getRefundStatus(ORDER_ID, CUSTOMER_ID, STORE_ID)).rejects.toBeInstanceOf(NotFoundException);
  });
});
