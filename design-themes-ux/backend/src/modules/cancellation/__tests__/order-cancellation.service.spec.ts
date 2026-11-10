import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { InventoryReservationStatus, OrderStatus, OutboxEventStatus, Prisma } from '@prisma/client';

import { PrismaService } from '@/prisma/prisma.service';
import { PaymentService } from '@/modules/payment/payment.service';
import { OrderCancellationService } from '../order-cancellation.service';
import { InventoryReservationService } from '@/shared/inventory/inventory-reservation.service';

// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------

const STORE_ID  = 'store-1';
const ORDER_ID  = 'order-1';
const TX_ID     = 'tx-1';
const RES_ID    = 'res-1';
const ITEM_ID   = 'item-1';
const PRODUCT_ID = 'prod-1';

const makeOrder = (overrides: Record<string, unknown> = {}) => ({
  id:                   ORDER_ID,
  storeId:              STORE_ID,
  status:               OrderStatus.PENDING,
  paymentTransactionId: TX_ID,
  total:                new Prisma.Decimal('1000.00'),
  refundedAmount:       new Prisma.Decimal('0.00'),
  cancelledAt:          null,
  cancellationReason:   null,
  ...overrides,
});

const makeReservationItem = (overrides: Record<string, unknown> = {}) => ({
  id:            ITEM_ID,
  reservationId: RES_ID,
  storeId:       STORE_ID,
  productId:     PRODUCT_ID,
  variantId:     null,
  quantity:      2,
  ...overrides,
});

const makeReservation = (status: InventoryReservationStatus, overrides: Record<string, unknown> = {}) => ({
  id:                   RES_ID,
  storeId:              STORE_ID,
  paymentTransactionId: TX_ID,
  status,
  items:                [makeReservationItem()],
  ...overrides,
});

const makeTx = (status: string, overrides: Record<string, unknown> = {}) => ({
  id:            TX_ID,
  storeId:       STORE_ID,
  status,
  amountInPaise: 100000,
  capturedPaise: 100000,
  gatewayCode:   'mock',
  reservation:   null,
  ...overrides,
});

const makeRefundResult = (refundStatus: 'COMPLETED' | 'FAILED' = 'COMPLETED') => ({
  transaction: makeTx('REFUNDED'),
  refund: {
    id:              'refund-1',
    status:          refundStatus,
    amountInPaise:   100000,
    gatewayRefundId: 'gw-ref-1',
    orderId:         null,
  },
});

const DEFAULT_INPUT = {
  orderId:        ORDER_ID,
  storeId:        STORE_ID,
  reason:         'Customer requested',
  actorId:        'admin-1',
  idempotencyKey: 'idem-key-1',
};

// ---------------------------------------------------------------------------
// Mock factory
// ---------------------------------------------------------------------------

function buildPrismaMock() {
  const mock = {
    order: {
      findFirst:  jest.fn(),
      updateMany: jest.fn(),
    },
    orderStatusHistory: { create: jest.fn() },
    refund: {
      findFirst: jest.fn(),
      create:    jest.fn(),
    },
    paymentRefund: {
      findMany: jest.fn(),
      update:   jest.fn(),
    },
    paymentTransaction: { findFirst: jest.fn() },
    inventoryReservation: { updateMany: jest.fn() },
    outboxEvent: {
      findFirst: jest.fn(),
      create:    jest.fn(),
    },
    $transaction: jest.fn(),
  };

  // Default: interactive $transaction executes callback with mock as txClient
  mock.$transaction.mockImplementation(async (callbackOrArray: any) => {
    if (typeof callbackOrArray === 'function') return callbackOrArray(mock);
    return Promise.all(callbackOrArray);
  });

  return mock;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('OrderCancellationService', () => {
  let service:     OrderCancellationService;
  let prisma:      ReturnType<typeof buildPrismaMock>;
  let paymentSvc:  { cancelPayment: jest.Mock; refundPayment: jest.Mock };
  // Stock return is InventoryReservationService's job (atomic + status-guarded,
  // covered in its own spec); this spec checks which release is chosen and
  // that a failure aborts the cancellation.
  let reservations: { expire: jest.Mock; restockCommitted: jest.Mock };

  beforeEach(async () => {
    prisma = buildPrismaMock();
    paymentSvc = {
      cancelPayment: jest.fn(),
      refundPayment: jest.fn(),
    };
    reservations = {
      expire:           jest.fn().mockResolvedValue(true),
      restockCommitted: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderCancellationService,
        { provide: PrismaService,  useValue: prisma },
        { provide: PaymentService, useValue: paymentSvc },
        { provide: InventoryReservationService, useValue: reservations },
      ],
    }).compile();

    service = module.get(OrderCancellationService);
  });

  afterEach(() => jest.clearAllMocks());

  // -------------------------------------------------------------------------
  // TEST-1: Branch A — pre-capture (PENDING tx)
  // -------------------------------------------------------------------------
  it('TEST-1: Branch A cancels pre-capture payment and sets order CANCELLED', async () => {
    const order = makeOrder({ status: OrderStatus.PENDING });
    const tx    = makeTx('PENDING', { reservation: makeReservation(InventoryReservationStatus.RESERVED) });

    prisma.order.findFirst.mockResolvedValueOnce(order)  // Step 0
      .mockResolvedValueOnce({ ...order, status: OrderStatus.CANCELLED }); // final load
    prisma.paymentTransaction.findFirst.mockResolvedValue(tx);
    prisma.inventoryReservation.updateMany.mockResolvedValue({ count: 1 });
    prisma.order.updateMany.mockResolvedValue({ count: 1 });
    prisma.orderStatusHistory.create.mockResolvedValue({});
    prisma.outboxEvent.findFirst.mockResolvedValue(null);
    prisma.outboxEvent.create.mockResolvedValue({});
    prisma.refund.findFirst.mockResolvedValue(null);

    paymentSvc.cancelPayment.mockResolvedValue({ id: TX_ID, status: 'CANCELLED' });

    const result = await service.cancelOrder(DEFAULT_INPUT);

    expect(paymentSvc.cancelPayment).toHaveBeenCalledWith(TX_ID, STORE_ID);
    expect(paymentSvc.refundPayment).not.toHaveBeenCalled();
    expect(prisma.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: ORDER_ID, status: OrderStatus.PENDING } }),
    );
    expect(result.paymentAction).toBe('CANCELLED');
    expect(result.orderRefund).toBeNull();
  });

  // -------------------------------------------------------------------------
  // TEST-2: Branch B — full refund (CAPTURED tx)
  // -------------------------------------------------------------------------
  it('TEST-2: Branch B issues full refund with deterministic idempotency key', async () => {
    const order = makeOrder({ status: OrderStatus.PROCESSING });
    const tx    = makeTx('CAPTURED', {
      capturedPaise: 100000,
      reservation:   makeReservation(InventoryReservationStatus.COMMITTED),
    });
    const refundRes = makeRefundResult('COMPLETED');

    prisma.order.findFirst.mockResolvedValueOnce(order)
      .mockResolvedValueOnce({ ...order, status: OrderStatus.CANCELLED });
    prisma.paymentTransaction.findFirst.mockResolvedValue(tx);
    prisma.paymentRefund.findMany.mockResolvedValue([]);     // no prior refunds
    prisma.inventoryReservation.updateMany.mockResolvedValue({ count: 1 });
    prisma.order.updateMany.mockResolvedValue({ count: 1 });
    prisma.orderStatusHistory.create.mockResolvedValue({});
    prisma.refund.create.mockResolvedValue({ id: 'refund-db-1', status: 'COMPLETED' });
    prisma.paymentRefund.update.mockResolvedValue({});
    prisma.outboxEvent.findFirst.mockResolvedValue(null);
    prisma.outboxEvent.create.mockResolvedValue({});
    prisma.refund.findFirst.mockResolvedValue(null);

    paymentSvc.refundPayment.mockResolvedValue(refundRes);

    const result = await service.cancelOrder(DEFAULT_INPUT);

    // Deterministic key (P0-3)
    expect(paymentSvc.refundPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: `cancellation:refund:${ORDER_ID}`,
        amountInPaise:  100000,
      }),
    );

    // PaymentRefund.orderId back-fill (P2-2)
    expect(prisma.paymentRefund.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { orderId: ORDER_ID } }),
    );

    // Refund record created
    expect(prisma.refund.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orderId:       ORDER_ID,
          amountInPaise: 100000,
          status:        'COMPLETED',
        }),
      }),
    );

    expect(result.paymentAction).toBe('REFUNDED');
    expect(result.inventoryReleased).toBe(true);
  });

  // -------------------------------------------------------------------------
  // TEST-3: Branch B — partial refund (PARTIALLY_REFUNDED tx)
  // -------------------------------------------------------------------------
  it('TEST-3: Branch B computes remainingPaise = capturedAmount - alreadyRefunded', async () => {
    const order = makeOrder({ status: OrderStatus.PROCESSING });
    const tx    = makeTx('PARTIALLY_REFUNDED', {
      capturedPaise: 100000,
      reservation:   null,
    });

    prisma.order.findFirst.mockResolvedValueOnce(order)
      .mockResolvedValueOnce({ ...order, status: OrderStatus.CANCELLED });
    prisma.paymentTransaction.findFirst.mockResolvedValue(tx);
    // ₹50 already refunded
    prisma.paymentRefund.findMany.mockResolvedValue([{ amountInPaise: 50000 }]);
    prisma.order.updateMany.mockResolvedValue({ count: 1 });
    prisma.orderStatusHistory.create.mockResolvedValue({});
    prisma.refund.create.mockResolvedValue({ id: 'r1', status: 'COMPLETED' });
    prisma.paymentRefund.update.mockResolvedValue({});
    prisma.outboxEvent.findFirst.mockResolvedValue(null);
    prisma.outboxEvent.create.mockResolvedValue({});
    prisma.refund.findFirst.mockResolvedValue(null);

    paymentSvc.refundPayment.mockResolvedValue(makeRefundResult('COMPLETED'));

    await service.cancelOrder(DEFAULT_INPUT);

    // Should refund only remaining 50000 paise (₹500)
    expect(paymentSvc.refundPayment).toHaveBeenCalledWith(
      expect.objectContaining({ amountInPaise: 50000 }),
    );
  });

  // -------------------------------------------------------------------------
  // TEST-4: Branch B — already fully refunded
  // -------------------------------------------------------------------------
  it('TEST-4: Branch B skips gateway call when remainingPaise <= 0', async () => {
    const order = makeOrder({ status: OrderStatus.PROCESSING });
    const tx    = makeTx('PARTIALLY_REFUNDED', { capturedPaise: 100000, reservation: null });

    prisma.order.findFirst.mockResolvedValueOnce(order)
      .mockResolvedValueOnce({ ...order, status: OrderStatus.CANCELLED });
    prisma.paymentTransaction.findFirst.mockResolvedValue(tx);
    // Already fully refunded
    prisma.paymentRefund.findMany.mockResolvedValue([{ amountInPaise: 100000 }]);
    prisma.order.updateMany.mockResolvedValue({ count: 1 });
    prisma.orderStatusHistory.create.mockResolvedValue({});
    prisma.outboxEvent.findFirst.mockResolvedValue(null);
    prisma.outboxEvent.create.mockResolvedValue({});
    prisma.refund.findFirst.mockResolvedValue(null);

    const result = await service.cancelOrder(DEFAULT_INPUT);

    expect(paymentSvc.refundPayment).not.toHaveBeenCalled();
    expect(result.paymentAction).toBe('ALREADY_REFUNDED');
  });

  // -------------------------------------------------------------------------
  // TEST-5: Branch B — refund FAILED
  // -------------------------------------------------------------------------
  it('TEST-5: Branch B REFUND_FAILED still cancels order and emits REFUND_FAILED outbox event', async () => {
    const order = makeOrder({ status: OrderStatus.PROCESSING });
    const tx    = makeTx('CAPTURED', { capturedPaise: 100000, reservation: null });

    prisma.order.findFirst.mockResolvedValueOnce(order)
      .mockResolvedValueOnce({ ...order, status: OrderStatus.CANCELLED });
    prisma.paymentTransaction.findFirst.mockResolvedValue(tx);
    prisma.paymentRefund.findMany.mockResolvedValue([]);
    prisma.order.updateMany.mockResolvedValue({ count: 1 });
    prisma.orderStatusHistory.create.mockResolvedValue({});
    prisma.outboxEvent.findFirst.mockResolvedValue(null);
    prisma.outboxEvent.create.mockResolvedValue({});
    prisma.refund.findFirst.mockResolvedValue(null);

    paymentSvc.refundPayment.mockResolvedValue(makeRefundResult('FAILED'));

    const result = await service.cancelOrder(DEFAULT_INPUT);

    expect(result.paymentAction).toBe('REFUND_FAILED');
    expect(prisma.order.updateMany).toHaveBeenCalled();

    // REFUND_FAILED outbox event must be created
    const outboxCalls: any[] = prisma.outboxEvent.create.mock.calls;
    const refundFailedEvent = outboxCalls.find(
      (call) => call[0].data?.eventType === 'REFUND_FAILED',
    );
    expect(refundFailedEvent).toBeDefined();
  });

  // -------------------------------------------------------------------------
  // TEST-6: Branch C — terminal tx (CANCELLED)
  // -------------------------------------------------------------------------
  it('TEST-6: Branch C skips payment call for terminal tx status', async () => {
    const order = makeOrder({ status: OrderStatus.PENDING });
    const tx    = makeTx('CANCELLED', { reservation: null });

    prisma.order.findFirst.mockResolvedValueOnce(order)
      .mockResolvedValueOnce({ ...order, status: OrderStatus.CANCELLED });
    prisma.paymentTransaction.findFirst.mockResolvedValue(tx);
    prisma.order.updateMany.mockResolvedValue({ count: 1 });
    prisma.orderStatusHistory.create.mockResolvedValue({});
    prisma.outboxEvent.findFirst.mockResolvedValue(null);
    prisma.outboxEvent.create.mockResolvedValue({});
    prisma.refund.findFirst.mockResolvedValue(null);

    const result = await service.cancelOrder(DEFAULT_INPUT);

    expect(paymentSvc.cancelPayment).not.toHaveBeenCalled();
    expect(paymentSvc.refundPayment).not.toHaveBeenCalled();
    expect(result.paymentAction).toBe('SKIPPED');
  });

  // -------------------------------------------------------------------------
  // TEST-7: Branch D — no payment transaction
  // -------------------------------------------------------------------------
  it('TEST-7: Branch D — no paymentTransactionId sets paymentAction = NO_PAYMENT', async () => {
    const order = makeOrder({ status: OrderStatus.PENDING, paymentTransactionId: null });

    prisma.order.findFirst.mockResolvedValueOnce(order)
      .mockResolvedValueOnce({ ...order, status: OrderStatus.CANCELLED });
    prisma.order.updateMany.mockResolvedValue({ count: 1 });
    prisma.orderStatusHistory.create.mockResolvedValue({});
    prisma.outboxEvent.findFirst.mockResolvedValue(null);
    prisma.outboxEvent.create.mockResolvedValue({});
    prisma.refund.findFirst.mockResolvedValue(null);

    const result = await service.cancelOrder(DEFAULT_INPUT);

    expect(paymentSvc.cancelPayment).not.toHaveBeenCalled();
    expect(paymentSvc.refundPayment).not.toHaveBeenCalled();
    expect(result.paymentAction).toBe('NO_PAYMENT');
    expect(result.inventoryReleased).toBe(false);
  });

  // -------------------------------------------------------------------------
  // TEST-8: COD cancellation — Refund.status = PENDING
  // -------------------------------------------------------------------------
  it('TEST-8: COD cancellation creates Refund with status PENDING', async () => {
    const order = makeOrder({ status: OrderStatus.PROCESSING });
    const tx    = makeTx('CAPTURED', { gatewayCode: 'cod', capturedPaise: 100000, reservation: null });

    prisma.order.findFirst.mockResolvedValueOnce(order)
      .mockResolvedValueOnce({ ...order, status: OrderStatus.CANCELLED });
    prisma.paymentTransaction.findFirst.mockResolvedValue(tx);
    prisma.paymentRefund.findMany.mockResolvedValue([]);
    prisma.order.updateMany.mockResolvedValue({ count: 1 });
    prisma.orderStatusHistory.create.mockResolvedValue({});
    prisma.refund.create.mockResolvedValue({ id: 'r1', status: 'PENDING' });
    prisma.paymentRefund.update.mockResolvedValue({});
    prisma.outboxEvent.findFirst.mockResolvedValue(null);
    prisma.outboxEvent.create.mockResolvedValue({});
    prisma.refund.findFirst.mockResolvedValue(null);

    paymentSvc.refundPayment.mockResolvedValue(makeRefundResult('COMPLETED'));

    await service.cancelOrder(DEFAULT_INPUT);

    expect(prisma.refund.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'PENDING' }),
      }),
    );
  });

  // -------------------------------------------------------------------------
  // TEST-9: Idempotency — order already CANCELLED returns early
  // -------------------------------------------------------------------------
  it('TEST-9: Returns early (idempotent) when order is already CANCELLED', async () => {
    const cancelledOrder = makeOrder({ status: OrderStatus.CANCELLED });

    prisma.order.findFirst.mockResolvedValueOnce(cancelledOrder)   // Step 0 load
      .mockResolvedValueOnce(cancelledOrder);                       // buildIdempotentResult
    prisma.refund.findFirst.mockResolvedValue(null);

    const result = await service.cancelOrder(DEFAULT_INPUT);

    expect(prisma.order.updateMany).not.toHaveBeenCalled();
    expect(paymentSvc.cancelPayment).not.toHaveBeenCalled();
    expect(paymentSvc.refundPayment).not.toHaveBeenCalled();
    expect(result.paymentAction).toBe('SKIPPED');
  });

  // -------------------------------------------------------------------------
  // TEST-10: Concurrency — Step 4 lock returns count=0, order already CANCELLED
  // -------------------------------------------------------------------------
  it('TEST-10: Returns idempotent result when concurrent call already committed', async () => {
    const order = makeOrder({ status: OrderStatus.PENDING });

    prisma.order.findFirst
      .mockResolvedValueOnce(order)                                       // Step 0
      .mockResolvedValueOnce({ ...order, status: OrderStatus.CANCELLED }) // re-load inside txn (count=0 path)
      .mockResolvedValueOnce({ ...order, status: OrderStatus.CANCELLED }) // buildIdempotentResult
      .mockResolvedValueOnce({ ...order, status: OrderStatus.CANCELLED }); // final load
    prisma.paymentTransaction.findFirst.mockResolvedValue(makeTx('CANCELLED', { reservation: null }));
    prisma.order.updateMany.mockResolvedValue({ count: 0 }); // concurrent write won
    prisma.refund.findFirst.mockResolvedValue(null);

    const result = await service.cancelOrder(DEFAULT_INPUT);

    expect(result.paymentAction).toBe('SKIPPED');
  });

  // -------------------------------------------------------------------------
  // TEST-11: Guard — SHIPPED order throws ConflictException
  // -------------------------------------------------------------------------
  it('TEST-11: Throws ConflictException for non-cancellable order status', async () => {
    prisma.order.findFirst.mockResolvedValue(makeOrder({ status: OrderStatus.SHIPPED }));

    await expect(service.cancelOrder(DEFAULT_INPUT)).rejects.toThrow(ConflictException);

    expect(prisma.order.updateMany).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // TEST-12: COMMITTED → RELEASED — both onHand increment and committed decrement
  // -------------------------------------------------------------------------
  it("TEST-12: COMMITTED reservation puts the order's units back on sale", async () => {
    const order = makeOrder({ status: OrderStatus.PROCESSING });
    const tx    = makeTx('CAPTURED', {
      capturedPaise: 100000,
      reservation:   makeReservation(InventoryReservationStatus.COMMITTED),
    });

    prisma.order.findFirst.mockResolvedValueOnce(order)
      .mockResolvedValueOnce({ ...order, status: OrderStatus.CANCELLED });
    prisma.paymentTransaction.findFirst.mockResolvedValue(tx);
    prisma.paymentRefund.findMany.mockResolvedValue([]);
    prisma.inventoryReservation.updateMany.mockResolvedValue({ count: 1 });
    prisma.order.updateMany.mockResolvedValue({ count: 1 });
    prisma.orderStatusHistory.create.mockResolvedValue({});
    prisma.refund.create.mockResolvedValue({ id: 'r1', status: 'COMPLETED' });
    prisma.paymentRefund.update.mockResolvedValue({});
    prisma.outboxEvent.findFirst.mockResolvedValue(null);
    prisma.outboxEvent.create.mockResolvedValue({});
    prisma.refund.findFirst.mockResolvedValue(null);

    paymentSvc.refundPayment.mockResolvedValue(makeRefundResult('COMPLETED'));

    await service.cancelOrder(DEFAULT_INPUT);

    expect(reservations.restockCommitted).toHaveBeenCalledWith(RES_ID);
    expect(reservations.expire).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // TEST-13: RESERVED → EXPIRED — only reserved decrement, no onHand change
  // -------------------------------------------------------------------------
  it('TEST-13: RESERVED (never committed) hold is expired, returning its units', async () => {
    const order = makeOrder({ status: OrderStatus.PENDING });
    const tx    = makeTx('PENDING', {
      reservation: makeReservation(InventoryReservationStatus.RESERVED),
    });

    prisma.order.findFirst.mockResolvedValueOnce(order)
      .mockResolvedValueOnce({ ...order, status: OrderStatus.CANCELLED });
    prisma.paymentTransaction.findFirst.mockResolvedValue(tx);
    prisma.inventoryReservation.updateMany.mockResolvedValue({ count: 1 });
    prisma.order.updateMany.mockResolvedValue({ count: 1 });
    prisma.orderStatusHistory.create.mockResolvedValue({});
    prisma.outboxEvent.findFirst.mockResolvedValue(null);
    prisma.outboxEvent.create.mockResolvedValue({});
    prisma.refund.findFirst.mockResolvedValue(null);

    paymentSvc.cancelPayment.mockResolvedValue({ id: TX_ID, status: 'CANCELLED' });

    await service.cancelOrder(DEFAULT_INPUT);

    expect(reservations.expire).toHaveBeenCalledWith(RES_ID);
    expect(reservations.restockCommitted).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // TEST-14: Lower-bound guard failure → transaction rolls back, Step 4 not called
  // -------------------------------------------------------------------------
  it('TEST-14: A stock-return failure propagates and aborts Step 4', async () => {
    const order = makeOrder({ status: OrderStatus.PROCESSING });
    const tx    = makeTx('CAPTURED', {
      capturedPaise: 100000,
      reservation:   makeReservation(InventoryReservationStatus.COMMITTED),
    });

    prisma.order.findFirst.mockResolvedValueOnce(order);
    prisma.paymentTransaction.findFirst.mockResolvedValue(tx);
    prisma.paymentRefund.findMany.mockResolvedValue([]);
    reservations.restockCommitted.mockRejectedValue(new Error('Lock wait timeout exceeded'));

    paymentSvc.refundPayment.mockResolvedValue(makeRefundResult('COMPLETED'));

    await expect(service.cancelOrder(DEFAULT_INPUT)).rejects.toThrow('Lock wait timeout exceeded');

    // Step 4 (order.updateMany) must NOT have been called
    expect(prisma.order.updateMany).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // TEST-15: Concurrent inventory release — count=0 is a no-op
  // -------------------------------------------------------------------------
  it('TEST-15: Concurrent reservation release (count=0) is idempotent', async () => {
    const order = makeOrder({ status: OrderStatus.PROCESSING });
    const tx    = makeTx('CAPTURED', {
      capturedPaise: 100000,
      reservation:   makeReservation(InventoryReservationStatus.COMMITTED),
    });

    prisma.order.findFirst.mockResolvedValueOnce(order)
      .mockResolvedValueOnce({ ...order, status: OrderStatus.CANCELLED });
    prisma.paymentTransaction.findFirst.mockResolvedValue(tx);
    prisma.paymentRefund.findMany.mockResolvedValue([]);
    // false — a concurrent call already returned these units
    reservations.restockCommitted.mockResolvedValue(false);
    prisma.order.updateMany.mockResolvedValue({ count: 1 });
    prisma.orderStatusHistory.create.mockResolvedValue({});
    prisma.refund.create.mockResolvedValue({ id: 'r1', status: 'COMPLETED' });
    prisma.paymentRefund.update.mockResolvedValue({});
    prisma.outboxEvent.findFirst.mockResolvedValue(null);
    prisma.outboxEvent.create.mockResolvedValue({});
    prisma.refund.findFirst.mockResolvedValue(null);

    paymentSvc.refundPayment.mockResolvedValue(makeRefundResult('COMPLETED'));

    // Must not throw
    const result = await service.cancelOrder(DEFAULT_INPUT);

    expect(reservations.restockCommitted).toHaveBeenCalledTimes(1);
    expect(result.inventoryReleased).toBe(true);
  });

  // -------------------------------------------------------------------------
  // TEST-16: Outbox events use UPPER_SNAKE_CASE
  // -------------------------------------------------------------------------
  it('TEST-16: Outbox events are emitted with UPPER_SNAKE_CASE eventTypes', async () => {
    const order = makeOrder({ status: OrderStatus.PENDING });
    const tx    = makeTx('CAPTURED', {
      capturedPaise: 100000,
      reservation:   makeReservation(InventoryReservationStatus.COMMITTED),
    });

    prisma.order.findFirst.mockResolvedValueOnce(order)
      .mockResolvedValueOnce({ ...order, status: OrderStatus.CANCELLED });
    prisma.paymentTransaction.findFirst.mockResolvedValue(tx);
    prisma.paymentRefund.findMany.mockResolvedValue([]);
    prisma.inventoryReservation.updateMany.mockResolvedValue({ count: 1 });
    prisma.order.updateMany.mockResolvedValue({ count: 1 });
    prisma.orderStatusHistory.create.mockResolvedValue({});
    prisma.refund.create.mockResolvedValue({ id: 'r1', status: 'COMPLETED' });
    prisma.paymentRefund.update.mockResolvedValue({});
    prisma.outboxEvent.findFirst.mockResolvedValue(null);
    prisma.outboxEvent.create.mockResolvedValue({});
    prisma.refund.findFirst.mockResolvedValue(null);

    paymentSvc.refundPayment.mockResolvedValue(makeRefundResult('COMPLETED'));

    await service.cancelOrder(DEFAULT_INPUT);

    const createdEventTypes = (prisma.outboxEvent.create.mock.calls as any[]).map(
      (call) => call[0].data?.eventType,
    );
    expect(createdEventTypes).toContain('ORDER_CANCELLED');
    expect(createdEventTypes).toContain('INVENTORY_RELEASED');
    // Verify UPPER_SNAKE_CASE (no dots, no lowercase)
    for (const et of createdEventTypes) {
      expect(et).toMatch(/^[A-Z][A-Z0-9_]+$/);
    }
  });

  // -------------------------------------------------------------------------
  // TEST-20: Decimal precision — F2 guarantee
  // -------------------------------------------------------------------------
  it('TEST-20: Decimal amounts are exact for non-round paise values (F2)', async () => {
    const order = makeOrder({ status: OrderStatus.PROCESSING });
    const tx    = makeTx('CAPTURED', {
      capturedPaise: 10001, // ₹100.01
      reservation:   null,
    });

    prisma.order.findFirst.mockResolvedValueOnce(order)
      .mockResolvedValueOnce({ ...order, status: OrderStatus.CANCELLED });
    prisma.paymentTransaction.findFirst.mockResolvedValue(tx);
    prisma.paymentRefund.findMany.mockResolvedValue([]);
    prisma.order.updateMany.mockResolvedValue({ count: 1 });
    prisma.orderStatusHistory.create.mockResolvedValue({});
    prisma.refund.create.mockResolvedValue({ id: 'r1', status: 'COMPLETED' });
    prisma.paymentRefund.update.mockResolvedValue({});
    prisma.outboxEvent.findFirst.mockResolvedValue(null);
    prisma.outboxEvent.create.mockResolvedValue({});
    prisma.refund.findFirst.mockResolvedValue(null);

    paymentSvc.refundPayment.mockResolvedValue({
      ...makeRefundResult('COMPLETED'),
      refund: { ...makeRefundResult('COMPLETED').refund, amountInPaise: 10001 },
    });

    await service.cancelOrder(DEFAULT_INPUT);

    const refundCreateCall = prisma.refund.create.mock.calls[0][0];
    const amount: Prisma.Decimal = refundCreateCall.data.amount;
    // Must be exactly 100.01 via Decimal arithmetic, not floating-point drift
    expect(amount.toString()).toBe('100.01');

    const orderUpdateCall = prisma.order.updateMany.mock.calls[0][0];
    const increment: Prisma.Decimal = orderUpdateCall.data.refundedAmount?.increment;
    expect(increment.toString()).toBe('100.01');
  });

  // -------------------------------------------------------------------------
  // TEST-21: Step 3 error propagation — F1 guarantee
  // -------------------------------------------------------------------------
  it('TEST-21: Step 3 error propagates and leaves Order.status unchanged', async () => {
    const order = makeOrder({ status: OrderStatus.PROCESSING });
    const tx    = makeTx('CAPTURED', {
      capturedPaise: 100000,
      reservation:   makeReservation(InventoryReservationStatus.COMMITTED),
    });

    prisma.order.findFirst.mockResolvedValueOnce(order);
    prisma.paymentTransaction.findFirst.mockResolvedValue(tx);
    prisma.paymentRefund.findMany.mockResolvedValue([]);

    reservations.restockCommitted.mockRejectedValue(new Error('Inventory release failed'));

    paymentSvc.refundPayment.mockResolvedValue(makeRefundResult('COMPLETED'));

    await expect(service.cancelOrder(DEFAULT_INPUT)).rejects.toThrow(/Inventory release failed/);

    // Step 4 must not have run — order.updateMany never called with CANCELLED
    const cancellationCalls = prisma.order.updateMany.mock.calls.filter(
      (call: any) => call[0]?.data?.status === OrderStatus.CANCELLED,
    );
    expect(cancellationCalls).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // TEST-guard: NotFoundException for unknown order
  // -------------------------------------------------------------------------
  it('throws NotFoundException when order is not found', async () => {
    prisma.order.findFirst.mockResolvedValue(null);
    await expect(service.cancelOrder(DEFAULT_INPUT)).rejects.toThrow(NotFoundException);
  });
});
