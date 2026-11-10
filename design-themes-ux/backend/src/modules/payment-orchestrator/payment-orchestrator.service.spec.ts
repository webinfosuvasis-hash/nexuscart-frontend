import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import {
  CartStatus,
  CheckoutStatus,
  CouponType,
  InventoryReservationStatus,
  OrderStatus,
  OutboxEventStatus,
  PaymentStatus,
  PaymentTxStatus,
} from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

import { PrismaService } from '../../prisma/prisma.service';
import { InventoryReservationService } from '../../shared/inventory/inventory-reservation.service';
import { PaymentOrchestratorService } from './payment-orchestrator.service';

// ---------------------------------------------------------------------------
// Test factories
// ---------------------------------------------------------------------------

const STORE_ID    = 'store-1';
const TX_ID       = 'tx-1';
const ORDER_ID    = 'order-1';
const CHECKOUT_ID = 'checkout-1';
const CART_ID     = 'cart-1';
const RESERVATION_ID = 'res-1';

function makeTx(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id:               TX_ID,
    storeId:          STORE_ID,
    checkoutSessionId: CHECKOUT_ID,
    status:           PaymentTxStatus.CAPTURED,
    amountInPaise:    118000,   // ₹1,180.00 (₹1,000 + 18% GST)
    orderId:          null,
    checkoutSnapshot: null,
    gatewayCode:      'mock',
    capturedPaise:    118000,
    currency:         'INR',
    attemptNumber:    1,
    createdAt:        new Date('2026-07-01T00:00:00Z'),
    updatedAt:        new Date('2026-07-01T00:00:00Z'),
    ...overrides,
  };
}

function makeCheckout() {
  return {
    id:                       CHECKOUT_ID,
    storeId:                  STORE_ID,
    cartId:                   CART_ID,
    cartVersion:              1,
    sessionId:                'sess-1',
    customerId:               null,
    status:                   CheckoutStatus.PAYMENT_INITIATED,
    selectedShippingMethodId: 'standard',
    isValid:                  true,
    expiresAt:                new Date(Date.now() + 3_600_000),
    completedAt:              null,
    cancelledAt:              null,
    createdAt:                new Date(),
    updatedAt:                new Date(),
    addresses: [
      {
        id:             'addr-1',
        checkoutId:     CHECKOUT_ID,
        type:           'SHIPPING',
        firstName:      'Test',
        lastName:       'User',
        line1:          '123 Main St',
        line2:          null,
        city:           'Bangalore',
        state:          'Karnataka',
        postalCode:     '560001',
        country:        'IN',
        phone:          '9876543210',
        email:          'test@example.com',
        isGuestAddress: true,
        sourceAddressId: null,
        createdAt:      new Date(),
        updatedAt:      new Date(),
      },
    ],
  };
}

function makeCart() {
  return {
    id:               CART_ID,
    storeId:          STORE_ID,
    sessionId:        'sess-1',
    customerId:       null,
    status:           CartStatus.LOCKED,
    version:          1,
    currencyCode:     'INR',
    couponCode:       null,
    lockedAt:         new Date(),
    lockedUntil:      new Date(Date.now() + 3_600_000),
    convertedAt:      null,
    createdAt:        new Date(),
    updatedAt:        new Date(),
    items: [
      {
        id:           'item-1',
        cartId:       CART_ID,
        storeId:      STORE_ID,
        productId:    'prod-1',
        variantId:    null,
        quantity:     1,
        sku:          'SKU-001',
        name:         'Test Product',
        brand:        'Test Brand',
        slug:         'test-product',
        image:        'https://example.com/image.jpg',
        unitPrice:    { toString: () => '1000.0000' },
        comparePrice: null,
        lineDiscount: { toString: () => '0.0000' },
        taxCategory:  'gst_18',
        gstClass:     null,
        hsn:          null,
        variantOptions: null,
        warehouseId:  null,
        createdAt:    new Date(),
        updatedAt:    new Date(),
      },
    ],
  };
}

function makeReservation(status: InventoryReservationStatus = InventoryReservationStatus.RESERVED) {
  return {
    id:                   RESERVATION_ID,
    storeId:              STORE_ID,
    paymentTransactionId: TX_ID,
    tentativeOrderId:     'tentative-order-1',
    status,
    expiresAt:            new Date(Date.now() + 3_600_000),
    reservedAt:           new Date(),
    releasedAt:           null,
    createdAt:            new Date(),
    updatedAt:            new Date(),
    items: [
      {
        id:            'res-item-1',
        reservationId: RESERVATION_ID,
        storeId:       STORE_ID,
        productId:     'prod-1',
        variantId:     null,
        warehouseId:   null,
        quantity:      1,
      },
    ],
  };
}

function makeOrder() {
  return {
    id:          ORDER_ID,
    orderNumber: 'ORD-2026-000001',
  };
}

function makeP2002() {
  return new PrismaClientKnownRequestError('Unique constraint failed', {
    code:          'P2002',
    clientVersion: '5.9.1',
  });
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('PaymentOrchestratorService', () => {
  let service: PaymentOrchestratorService;
  let prisma:  jest.Mocked<{
    paymentTransaction:  { findFirst: jest.Mock; update: jest.Mock };
    checkoutSession:     { findFirst: jest.Mock; findUnique: jest.Mock; updateMany: jest.Mock };
    cart:                { findFirst: jest.Mock; updateMany: jest.Mock };
    coupon:              { findFirst: jest.Mock };
    inventoryReservation:{ findUnique: jest.Mock; updateMany: jest.Mock };
    idempotencyRecord:   { create: jest.Mock };
    storeOrderCounter:   { upsert: jest.Mock; findUnique: jest.Mock };
    order:               { create: jest.Mock; findUnique: jest.Mock; findFirst: jest.Mock };
    product:             { findMany: jest.Mock };
    orderItem:           { createMany: jest.Mock };
    orderStatusHistory:  { create: jest.Mock };
    orderSnapshot:       { create: jest.Mock };
    outboxEvent:         { findFirst: jest.Mock; create: jest.Mock };
    $transaction:        jest.Mock;
  }>;

  // Stock commit is InventoryReservationService's job (own spec covers holds,
  // late deduction and idempotency); here we check the orchestrator calls it
  // with the right payment/checkout/lines, before the order is created.
  let reservations: { commitForPayment: jest.Mock };

  beforeEach(async () => {
    reservations = { commitForPayment: jest.fn().mockResolvedValue(undefined) };
    prisma = {
      paymentTransaction:   { findFirst: jest.fn(), update: jest.fn() },
      checkoutSession:      { findFirst: jest.fn(), findUnique: jest.fn(), updateMany: jest.fn() },
      cart:                 { findFirst: jest.fn(), updateMany: jest.fn() },
      coupon:               { findFirst: jest.fn() },
      inventoryReservation: { findUnique: jest.fn(), updateMany: jest.fn() },
      idempotencyRecord:    { create: jest.fn() },
      storeOrderCounter:    { upsert: jest.fn(), findUnique: jest.fn() },
      order:                { create: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn() },
      product:              { findMany: jest.fn().mockResolvedValue([]) },
      orderItem:            { createMany: jest.fn() },
      orderStatusHistory:   { create: jest.fn() },
      orderSnapshot:        { create: jest.fn() },
      outboxEvent:          { findFirst: jest.fn(), create: jest.fn() },
      $transaction:         jest.fn().mockImplementation(async (fn: any, _opts?: any) => {
        if (typeof fn === 'function') return fn(prisma);
        return Promise.all(fn as any[]);
      }),
    } as any;

    const configSvc = { get: jest.fn((key: string, def: unknown) => def) };

    const module = await Test.createTestingModule({
      providers: [
        PaymentOrchestratorService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: configSvc },
        { provide: InventoryReservationService, useValue: reservations },
      ],
    }).compile();

    service = module.get(PaymentOrchestratorService);
  });

  // ─── Status guard ────────────────────────────────────────────────────────

  it('throws BadRequestException when tx is not CAPTURED', async () => {
    prisma.paymentTransaction.findFirst.mockResolvedValue(
      makeTx({ status: PaymentTxStatus.AUTHORIZED }),
    );
    await expect(service.completePayment(TX_ID, STORE_ID)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('throws NotFoundException when tx not found', async () => {
    prisma.paymentTransaction.findFirst.mockResolvedValue(null);
    await expect(service.completePayment(TX_ID, STORE_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  // ─── Already-completed recovery ──────────────────────────────────────────

  it('returns recovered=true and skips all steps when orderId already set', async () => {
    prisma.paymentTransaction.findFirst.mockResolvedValue(
      makeTx({ orderId: ORDER_ID }),
    );
    prisma.order.findFirst.mockResolvedValue(makeOrder());
    prisma.checkoutSession.findUnique.mockResolvedValue({ cartId: CART_ID });
    prisma.checkoutSession.updateMany.mockResolvedValue({ count: 0 });
    prisma.cart.updateMany.mockResolvedValue({ count: 0 });
    prisma.outboxEvent.findFirst.mockResolvedValue({ id: 'existing-ev' }); // already present

    const result = await service.completePayment(TX_ID, STORE_ID);

    expect(result.recovered).toBe(true);
    expect(result.orderId).toBe(ORDER_ID);
    // Snapshot build and inventory commit should not have run
    expect(prisma.checkoutSession.findFirst).not.toHaveBeenCalled();
  });

  it('throws NotFoundException in recovery when linked order is missing', async () => {
    prisma.paymentTransaction.findFirst.mockResolvedValue(
      makeTx({ orderId: ORDER_ID }),
    );
    prisma.order.findFirst.mockResolvedValue(null);

    await expect(service.completePayment(TX_ID, STORE_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  // ─── Snapshot reuse ───────────────────────────────────────────────────────

  it('uses existing checkoutSnapshot without rebuilding', async () => {
    const existingSnapshot = {
      checkoutSessionId: CHECKOUT_ID,
      cartId: CART_ID,
      storeId: STORE_ID,
      customerId: null,
      sessionId: 'sess-1',
      couponCode: null,
      selectedShippingMethodId: 'standard',
      shippingAddress: null,
      billingAddress: null,
      items: [
        {
          cartItemId: 'item-1', productId: 'prod-1', variantId: null,
          sku: 'SKU-001', name: 'Test Product', brand: null, thumbnail: 'img.jpg',
          quantity: 1, unitPrice: '1000.0000', comparePrice: null,
          lineDiscount: '0.0000', lineTotal: '1000', taxCategory: null,
          gstClass: null, hsn: null, variantOptions: null, warehouseId: null,
        },
      ],
      subtotal: '1000', promotionDiscount: '0', shippingCost: '0',
      tax: '180', grandTotal: '1180', currencyCode: 'INR',
      snapshotAt: new Date().toISOString(),
    };

    prisma.paymentTransaction.findFirst.mockResolvedValue(
      makeTx({ checkoutSnapshot: existingSnapshot }),
    );
    prisma.inventoryReservation.findUnique.mockResolvedValue(null);
    prisma.idempotencyRecord.create.mockResolvedValue({});
    prisma.storeOrderCounter.upsert.mockResolvedValue({});
    prisma.storeOrderCounter.findUnique.mockResolvedValue({ storeId: STORE_ID, year: 2026, counter: 1 });
    prisma.order.create.mockResolvedValue(makeOrder());
    prisma.orderItem.createMany.mockResolvedValue({ count: 1 });
    prisma.orderStatusHistory.create.mockResolvedValue({});
    prisma.orderSnapshot.create.mockResolvedValue({});
    prisma.paymentTransaction.update.mockResolvedValue({});
    prisma.checkoutSession.findUnique.mockResolvedValue({ cartId: CART_ID });
    prisma.checkoutSession.updateMany.mockResolvedValue({ count: 1 });
    prisma.cart.updateMany.mockResolvedValue({ count: 1 });
    prisma.outboxEvent.findFirst.mockResolvedValue(null);
    prisma.outboxEvent.create.mockResolvedValue({});

    const result = await service.completePayment(TX_ID, STORE_ID);

    expect(result.recovered).toBe(false);
    // Cart lookup (buildSnapshot) should NOT have been called
    expect(prisma.cart.findFirst).not.toHaveBeenCalled();
  });

  // ─── Inventory commit ─────────────────────────────────────────────────────

  it('commits stock through the reservation service with the snapshot lines as fallback', async () => {
    prisma.paymentTransaction.findFirst.mockResolvedValue(makeTx());
    prisma.checkoutSession.findFirst.mockResolvedValue(makeCheckout());
    prisma.cart.findFirst.mockResolvedValue(makeCart());
    prisma.coupon.findFirst.mockResolvedValue(null);
    prisma.paymentTransaction.update.mockResolvedValue({});
    prisma.inventoryReservation.findUnique.mockResolvedValue(null);
    prisma.idempotencyRecord.create.mockResolvedValue({});
    prisma.storeOrderCounter.upsert.mockResolvedValue({});
    prisma.storeOrderCounter.findUnique.mockResolvedValue({ storeId: STORE_ID, year: 2026, counter: 1 });
    prisma.order.create.mockResolvedValue(makeOrder());
    prisma.orderItem.createMany.mockResolvedValue({ count: 1 });
    prisma.orderStatusHistory.create.mockResolvedValue({});
    prisma.orderSnapshot.create.mockResolvedValue({});
    prisma.checkoutSession.findUnique.mockResolvedValue({ cartId: CART_ID });
    prisma.checkoutSession.updateMany.mockResolvedValue({ count: 1 });
    prisma.cart.updateMany.mockResolvedValue({ count: 1 });
    prisma.outboxEvent.findFirst.mockResolvedValue(null);
    prisma.outboxEvent.create.mockResolvedValue({});

    const result = await service.completePayment(TX_ID, STORE_ID);

    expect(result.recovered).toBe(false);
    expect(reservations.commitForPayment).toHaveBeenCalledWith({
      storeId:              STORE_ID,
      checkoutId:           CHECKOUT_ID,
      paymentTransactionId: TX_ID,
      fallbackLines:        [{ productId: 'prod-1', variantId: null, quantity: 1 }],
    });
    // The orchestrator itself never writes stock rows.
    expect(prisma.inventoryReservation.updateMany).not.toHaveBeenCalled();
  });

  it('delegates exactly once per completion (idempotency lives in the reservation service)', async () => {
    prisma.paymentTransaction.findFirst.mockResolvedValue(makeTx());
    prisma.checkoutSession.findFirst.mockResolvedValue(makeCheckout());
    prisma.cart.findFirst.mockResolvedValue(makeCart());
    prisma.coupon.findFirst.mockResolvedValue(null);
    prisma.paymentTransaction.update.mockResolvedValue({});
    prisma.inventoryReservation.findUnique.mockResolvedValue(
      makeReservation(InventoryReservationStatus.COMMITTED),
    );
    prisma.idempotencyRecord.create.mockResolvedValue({});
    prisma.storeOrderCounter.upsert.mockResolvedValue({});
    prisma.storeOrderCounter.findUnique.mockResolvedValue({ storeId: STORE_ID, year: 2026, counter: 2 });
    prisma.order.create.mockResolvedValue(makeOrder());
    prisma.orderItem.createMany.mockResolvedValue({ count: 1 });
    prisma.orderStatusHistory.create.mockResolvedValue({});
    prisma.orderSnapshot.create.mockResolvedValue({});
    prisma.checkoutSession.findUnique.mockResolvedValue({ cartId: CART_ID });
    prisma.checkoutSession.updateMany.mockResolvedValue({ count: 1 });
    prisma.cart.updateMany.mockResolvedValue({ count: 1 });
    prisma.outboxEvent.findFirst.mockResolvedValue(null);
    prisma.outboxEvent.create.mockResolvedValue({});

    await service.completePayment(TX_ID, STORE_ID);

    expect(reservations.commitForPayment).toHaveBeenCalledTimes(1);
    expect(prisma.inventoryReservation.updateMany).not.toHaveBeenCalled();
  });

  // ─── Happy path ───────────────────────────────────────────────────────────

  it('happy path: commits inventory, creates order, persists 4 outbox events', async () => {
    prisma.paymentTransaction.findFirst.mockResolvedValue(makeTx());
    prisma.checkoutSession.findFirst.mockResolvedValue(makeCheckout());
    prisma.cart.findFirst.mockResolvedValue(makeCart());
    prisma.coupon.findFirst.mockResolvedValue(null);
    prisma.paymentTransaction.update.mockResolvedValue({});
    prisma.inventoryReservation.findUnique.mockResolvedValue(makeReservation());
    prisma.idempotencyRecord.create.mockResolvedValue({});
    prisma.storeOrderCounter.upsert.mockResolvedValue({});
    prisma.storeOrderCounter.findUnique.mockResolvedValue({ storeId: STORE_ID, year: 2026, counter: 1 });
    prisma.order.create.mockResolvedValue(makeOrder());
    prisma.orderItem.createMany.mockResolvedValue({ count: 1 });
    prisma.orderStatusHistory.create.mockResolvedValue({});
    prisma.orderSnapshot.create.mockResolvedValue({});
    prisma.checkoutSession.findUnique.mockResolvedValue({ cartId: CART_ID });
    prisma.checkoutSession.updateMany.mockResolvedValue({ count: 1 });
    prisma.cart.updateMany.mockResolvedValue({ count: 1 });
    prisma.outboxEvent.findFirst.mockResolvedValue(null);
    prisma.outboxEvent.create.mockResolvedValue({});

    const result = await service.completePayment(TX_ID, STORE_ID);

    expect(result.recovered).toBe(false);
    expect(result.orderId).toBe(ORDER_ID);
    expect(result.orderNumber).toBe('ORD-2026-000001');

    // Stock was committed before the order was written
    expect(reservations.commitForPayment).toHaveBeenCalledTimes(1);
    expect(reservations.commitForPayment.mock.invocationCallOrder[0])
      .toBeLessThan(prisma.order.create.mock.invocationCallOrder[0]);

    // Order was created with correct fields
    expect(prisma.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          storeId,
          status:        OrderStatus.PENDING,
          paymentStatus: PaymentStatus.PAID,
          paymentTransactionId: TX_ID,
        }),
      }),
    );

    // 4 outbox events were created
    expect(prisma.outboxEvent.create).toHaveBeenCalledTimes(4);
    const eventTypes = (prisma.outboxEvent.create.mock.calls as any[]).map(
      (c) => c[0].data.eventType,
    );
    expect(eventTypes).toEqual(
      expect.arrayContaining(['ORDER_CREATED', 'PAYMENT_CAPTURED', 'CHECKOUT_COMPLETED', 'INVENTORY_COMMITTED']),
    );

    // CheckoutSession and Cart transitioned
    expect(prisma.checkoutSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: CheckoutStatus.COMPLETED }) }),
    );
    expect(prisma.cart.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: CartStatus.CONVERTED }) }),
    );
  });

  // ─── Order creation idempotency ───────────────────────────────────────────

  it('returns order when concurrent create wins the IdempotencyRecord race', async () => {
    prisma.paymentTransaction.findFirst
      .mockResolvedValueOnce(makeTx())                             // initial load
      .mockResolvedValueOnce(makeTx({ orderId: ORDER_ID }));       // re-read after P2002

    prisma.checkoutSession.findFirst.mockResolvedValue(makeCheckout());
    prisma.cart.findFirst.mockResolvedValue(makeCart());
    prisma.coupon.findFirst.mockResolvedValue(null);
    prisma.paymentTransaction.update.mockResolvedValue({});
    prisma.inventoryReservation.findUnique.mockResolvedValue(null);
    prisma.idempotencyRecord.create.mockRejectedValue(makeP2002());
    prisma.order.findFirst.mockResolvedValue(makeOrder());

    const result = await service.completePayment(TX_ID, STORE_ID);

    expect(result.orderId).toBe(ORDER_ID);
  });

  it('throws ConflictException when concurrent create wins but orderId not yet visible', async () => {
    prisma.paymentTransaction.findFirst
      .mockResolvedValueOnce(makeTx())
      .mockResolvedValueOnce(makeTx({ orderId: null })); // orderId still null after race

    prisma.checkoutSession.findFirst.mockResolvedValue(makeCheckout());
    prisma.cart.findFirst.mockResolvedValue(makeCart());
    prisma.coupon.findFirst.mockResolvedValue(null);
    prisma.paymentTransaction.update.mockResolvedValue({});
    prisma.inventoryReservation.findUnique.mockResolvedValue(null);
    prisma.idempotencyRecord.create.mockRejectedValue(makeP2002());

    await expect(service.completePayment(TX_ID, STORE_ID)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  // ─── Outbox deduplication ─────────────────────────────────────────────────

  it('does not duplicate outbox events that already exist', async () => {
    prisma.paymentTransaction.findFirst.mockResolvedValue(
      makeTx({ orderId: ORDER_ID }),
    );
    prisma.order.findFirst.mockResolvedValue(makeOrder());
    prisma.checkoutSession.findUnique.mockResolvedValue({ cartId: CART_ID });
    prisma.checkoutSession.updateMany.mockResolvedValue({ count: 0 });
    prisma.cart.updateMany.mockResolvedValue({ count: 0 });
    // All 4 outbox events already present
    prisma.outboxEvent.findFirst.mockResolvedValue({ id: 'existing-ev' });

    await service.completePayment(TX_ID, STORE_ID);

    expect(prisma.outboxEvent.create).not.toHaveBeenCalled();
  });

  // ─── Coupon promotion discount ────────────────────────────────────────────

  it('applies PERCENTAGE coupon in snapshot', async () => {
    const cartWithCoupon = {
      ...makeCart(),
      couponCode: 'SAVE10',
    };
    prisma.paymentTransaction.findFirst.mockResolvedValue(makeTx());
    prisma.checkoutSession.findFirst.mockResolvedValue(makeCheckout());
    prisma.cart.findFirst.mockResolvedValue(cartWithCoupon);
    prisma.coupon.findFirst.mockResolvedValue({
      code:         'SAVE10',
      type:         CouponType.PERCENTAGE,
      value:        { toString: () => '10' },
      maxDiscount:  null,
      expiresAt:    null,
      isActive:     true,
      usageLimit:   null,
      usedCount:    0,
      minOrderAmount: null,
    });
    prisma.paymentTransaction.update.mockResolvedValue({});
    prisma.inventoryReservation.findUnique.mockResolvedValue(null);
    prisma.idempotencyRecord.create.mockResolvedValue({});
    prisma.storeOrderCounter.upsert.mockResolvedValue({});
    prisma.storeOrderCounter.findUnique.mockResolvedValue({ storeId: STORE_ID, year: 2026, counter: 1 });
    prisma.order.create.mockResolvedValue(makeOrder());
    prisma.orderItem.createMany.mockResolvedValue({ count: 1 });
    prisma.orderStatusHistory.create.mockResolvedValue({});
    prisma.orderSnapshot.create.mockResolvedValue({});
    prisma.checkoutSession.findUnique.mockResolvedValue({ cartId: CART_ID });
    prisma.checkoutSession.updateMany.mockResolvedValue({ count: 1 });
    prisma.cart.updateMany.mockResolvedValue({ count: 1 });
    prisma.outboxEvent.findFirst.mockResolvedValue(null);
    prisma.outboxEvent.create.mockResolvedValue({});

    await service.completePayment(TX_ID, STORE_ID);

    // Verify order was created with promotion discount applied
    const orderCreateCall = prisma.order.create.mock.calls[0][0];
    // promotionDiscount = 10% of ₹1,000 = ₹100
    expect(orderCreateCall.data.discount.toString()).toBe('100');
  });
  // ─── Regression: P0-1 — idempotency record inside transaction ────────────

  it('P0-1: transient createOrder failure does not permanently block retries', async () => {
    // Inventory already committed so commitInventory skips its $transaction.
    // Only createOrder and completeCheckoutAndEmitEvents call $transaction.
    prisma.paymentTransaction.findFirst.mockResolvedValue(makeTx());
    prisma.checkoutSession.findFirst.mockResolvedValue(makeCheckout());
    prisma.cart.findFirst.mockResolvedValue(makeCart());
    prisma.coupon.findFirst.mockResolvedValue(null);
    prisma.paymentTransaction.update.mockResolvedValue({});
    prisma.inventoryReservation.findUnique.mockResolvedValue(
      makeReservation(InventoryReservationStatus.COMMITTED),
    );

    // First $transaction call (createOrder) throws — simulates a transient DB error.
    // Because idempotencyRecord.create is INSIDE the $transaction, it is NOT committed.
    prisma.$transaction.mockImplementationOnce(async () => {
      throw new Error('Simulated DB timeout');
    });

    await expect(service.completePayment(TX_ID, STORE_ID)).rejects.toThrow('Simulated DB timeout');

    // Restore default $transaction and set up mocks for the retry.
    prisma.$transaction.mockImplementation(async (fn: any, _opts?: any) => {
      if (typeof fn === 'function') return fn(prisma);
      return Promise.all(fn as any[]);
    });
    prisma.idempotencyRecord.create.mockResolvedValue({});
    prisma.storeOrderCounter.upsert.mockResolvedValue({});
    prisma.storeOrderCounter.findUnique.mockResolvedValue({ storeId: STORE_ID, year: 2026, counter: 1 });
    prisma.order.create.mockResolvedValue(makeOrder());
    prisma.orderItem.createMany.mockResolvedValue({ count: 1 });
    prisma.orderStatusHistory.create.mockResolvedValue({});
    prisma.orderSnapshot.create.mockResolvedValue({});
    prisma.checkoutSession.findUnique.mockResolvedValue({ cartId: CART_ID });
    prisma.checkoutSession.updateMany.mockResolvedValue({ count: 1 });
    prisma.cart.updateMany.mockResolvedValue({ count: 1 });
    prisma.outboxEvent.findFirst.mockResolvedValue(null);
    prisma.outboxEvent.create.mockResolvedValue({});

    // Retry must succeed — no permanent ConflictException, because the idempotency
    // record was rolled back with the failed transaction (P0-1 fix).
    const result = await service.completePayment(TX_ID, STORE_ID);
    expect(result.recovered).toBe(false);
    expect(result.orderId).toBe(ORDER_ID);
  });

  // ─── Regression: P1-1 — storeId scoping ──────────────────────────────────

  it('P1-1: handleAlreadyCompleted passes storeId to order lookup', async () => {
    prisma.paymentTransaction.findFirst.mockResolvedValue(makeTx({ orderId: ORDER_ID }));
    prisma.order.findFirst.mockResolvedValue(makeOrder());
    prisma.checkoutSession.findUnique.mockResolvedValue({ cartId: CART_ID });
    prisma.checkoutSession.updateMany.mockResolvedValue({ count: 0 });
    prisma.cart.updateMany.mockResolvedValue({ count: 0 });
    prisma.outboxEvent.findFirst.mockResolvedValue({ id: 'ev-1' });

    await service.completePayment(TX_ID, STORE_ID);

    expect(prisma.order.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ storeId: STORE_ID }),
      }),
    );
  });

  // ─── Regression: P1-2 — deactivated coupon still applied ─────────────────

  it('P1-2: applies coupon discount even when coupon is deactivated or expired after checkout', async () => {
    const cartWithCoupon = { ...makeCart(), couponCode: 'SAVE10' };
    prisma.paymentTransaction.findFirst.mockResolvedValue(makeTx());
    prisma.checkoutSession.findFirst.mockResolvedValue(makeCheckout());
    prisma.cart.findFirst.mockResolvedValue(cartWithCoupon);
    // Coupon is expired AND inactive — was valid at checkout time
    prisma.coupon.findFirst.mockResolvedValue({
      code:           'SAVE10',
      type:           CouponType.PERCENTAGE,
      value:          { toString: () => '10' },
      maxDiscount:    null,
      expiresAt:      new Date(Date.now() - 1_000),  // expired
      isActive:       false,                           // deactivated
      usageLimit:     null,
      usedCount:      5,
      minOrderAmount: null,
    });
    prisma.paymentTransaction.update.mockResolvedValue({});
    prisma.inventoryReservation.findUnique.mockResolvedValue(null);
    prisma.idempotencyRecord.create.mockResolvedValue({});
    prisma.storeOrderCounter.upsert.mockResolvedValue({});
    prisma.storeOrderCounter.findUnique.mockResolvedValue({ storeId: STORE_ID, year: 2026, counter: 1 });
    prisma.order.create.mockResolvedValue(makeOrder());
    prisma.orderItem.createMany.mockResolvedValue({ count: 1 });
    prisma.orderStatusHistory.create.mockResolvedValue({});
    prisma.orderSnapshot.create.mockResolvedValue({});
    prisma.checkoutSession.findUnique.mockResolvedValue({ cartId: CART_ID });
    prisma.checkoutSession.updateMany.mockResolvedValue({ count: 1 });
    prisma.cart.updateMany.mockResolvedValue({ count: 1 });
    prisma.outboxEvent.findFirst.mockResolvedValue(null);
    prisma.outboxEvent.create.mockResolvedValue({});

    await service.completePayment(TX_ID, STORE_ID);

    // Snapshot coupon query must NOT filter by isActive
    expect(prisma.coupon.findFirst).not.toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isActive: true }),
      }),
    );

    // Order must record the 10% discount (₹100 on ₹1,000 subtotal)
    const orderArg = prisma.order.create.mock.calls[0][0];
    expect(orderArg.data.discount.toString()).toBe('100');
  });

  // ─── Stock commit failure ────────────────────────────────────────────────

  it.each([
    ['cod',      PaymentStatus.PENDING],
    ['razorpay', PaymentStatus.PAID],
  ])('a %s order is created with payment status %s (COD is collected on delivery)', async (gatewayCode, expected) => {
    prisma.paymentTransaction.findFirst.mockResolvedValue(makeTx({ gatewayCode }));
    prisma.checkoutSession.findFirst.mockResolvedValue(makeCheckout());
    prisma.cart.findFirst.mockResolvedValue(makeCart());
    prisma.coupon.findFirst.mockResolvedValue(null);
    prisma.paymentTransaction.update.mockResolvedValue({});
    prisma.idempotencyRecord.create.mockResolvedValue({});
    prisma.storeOrderCounter.upsert.mockResolvedValue({});
    prisma.storeOrderCounter.findUnique.mockResolvedValue({ storeId: STORE_ID, year: 2026, counter: 1 });
    prisma.order.create.mockResolvedValue(makeOrder());
    prisma.orderItem.createMany.mockResolvedValue({ count: 1 });
    prisma.orderStatusHistory.create.mockResolvedValue({});
    prisma.orderSnapshot.create.mockResolvedValue({});
    prisma.checkoutSession.findUnique.mockResolvedValue({ cartId: CART_ID });
    prisma.checkoutSession.updateMany.mockResolvedValue({ count: 1 });
    prisma.cart.updateMany.mockResolvedValue({ count: 1 });
    prisma.outboxEvent.findFirst.mockResolvedValue(null);
    prisma.outboxEvent.create.mockResolvedValue({});

    await service.completePayment(TX_ID, STORE_ID);

    expect(prisma.order.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ paymentStatus: expected, paymentMethod: gatewayCode }),
    }));
  });

  it('creates no order when the stock commit fails — the error propagates for payment recovery to retry', async () => {
    prisma.paymentTransaction.findFirst.mockResolvedValue(makeTx());
    prisma.checkoutSession.findFirst.mockResolvedValue(makeCheckout());
    prisma.cart.findFirst.mockResolvedValue(makeCart());
    prisma.coupon.findFirst.mockResolvedValue(null);
    prisma.paymentTransaction.update.mockResolvedValue({});
    reservations.commitForPayment.mockRejectedValue(new Error('deadlock'));

    await expect(service.completePayment(TX_ID, STORE_ID)).rejects.toThrow('deadlock');
    expect(prisma.order.create).not.toHaveBeenCalled();
  });

  // ─── Vendor ownership snapshot on order lines ───────────────────────────

  describe('vendor snapshot', () => {
    const cartItem = (id: string, productId: string) => ({ ...makeCart().items[0], id, productId, sku: `SKU-${id}` });

    function wireCompletion(gatewayCode: string, items = [cartItem('item-1', 'prod-1')]) {
      prisma.paymentTransaction.findFirst.mockResolvedValue(makeTx({ gatewayCode }));
      prisma.checkoutSession.findFirst.mockResolvedValue(makeCheckout());
      prisma.cart.findFirst.mockResolvedValue({ ...makeCart(), items });
      prisma.coupon.findFirst.mockResolvedValue(null);
      prisma.paymentTransaction.update.mockResolvedValue({});
      prisma.idempotencyRecord.create.mockResolvedValue({});
      prisma.storeOrderCounter.upsert.mockResolvedValue({});
      prisma.storeOrderCounter.findUnique.mockResolvedValue({ storeId: STORE_ID, year: 2026, counter: 1 });
      prisma.order.create.mockResolvedValue(makeOrder());
      prisma.orderItem.createMany.mockResolvedValue({ count: items.length });
      prisma.orderStatusHistory.create.mockResolvedValue({});
      prisma.orderSnapshot.create.mockResolvedValue({});
      prisma.checkoutSession.findUnique.mockResolvedValue({ cartId: CART_ID });
      prisma.checkoutSession.updateMany.mockResolvedValue({ count: 1 });
      prisma.cart.updateMany.mockResolvedValue({ count: 1 });
      prisma.outboxEvent.findFirst.mockResolvedValue(null);
      prisma.outboxEvent.create.mockResolvedValue({});
    }
    const writtenLines = () => prisma.orderItem.createMany.mock.calls[0][0].data as Array<Record<string, unknown>>;

    it('freezes each line\'s vendor from the store-scoped product rows — mixed vendors and unassigned in one order', async () => {
      wireCompletion('razorpay', [cartItem('i1', 'prod-a'), cartItem('i2', 'prod-b'), cartItem('i3', 'prod-own')]);
      prisma.product.findMany.mockResolvedValue([
        { id: 'prod-a', vendorId: 'vendor-1' },
        { id: 'prod-b', vendorId: 'vendor-2' },
        { id: 'prod-own', vendorId: null },
      ]);

      await service.completePayment(TX_ID, STORE_ID);

      expect(prisma.product.findMany).toHaveBeenCalledWith({
        where:  { id: { in: ['prod-a', 'prod-b', 'prod-own'] }, storeId: STORE_ID },
        select: { id: true, vendorId: true },
      });
      expect(writtenLines().map((l) => [l.productId, l.vendorId])).toEqual([
        ['prod-a', 'vendor-1'], ['prod-b', 'vendor-2'], ['prod-own', null],
      ]);
    });

    it('a product not found in this store gets no vendor (never trusts anything but the store\'s own rows)', async () => {
      wireCompletion('razorpay');
      prisma.product.findMany.mockResolvedValue([]); // e.g. product belongs to another store

      await service.completePayment(TX_ID, STORE_ID);
      expect(writtenLines()[0].vendorId).toBeNull();
    });

    it('reads vendor ownership inside the order-creation transaction', async () => {
      wireCompletion('razorpay');
      prisma.product.findMany.mockResolvedValue([{ id: 'prod-1', vendorId: 'vendor-1' }]);

      await service.completePayment(TX_ID, STORE_ID);

      const [txStart] = prisma.idempotencyRecord.create.mock.invocationCallOrder;
      const [read]    = prisma.product.findMany.mock.invocationCallOrder;
      const [write]   = prisma.orderItem.createMany.mock.invocationCallOrder;
      expect(txStart).toBeLessThan(read);
      expect(read).toBeLessThan(write);
    });

    it.each([
      ['cod',      PaymentStatus.PENDING],
      ['razorpay', PaymentStatus.PAID],
    ])('%s: snapshots the vendor and emits the canonical ORDER_CREATED event', async (gatewayCode, paymentStatus) => {
      wireCompletion(gatewayCode);
      prisma.product.findMany.mockResolvedValue([{ id: 'prod-1', vendorId: 'vendor-1' }]);

      await service.completePayment(TX_ID, STORE_ID);

      expect(writtenLines()[0].vendorId).toBe('vendor-1');
      expect(prisma.order.create.mock.calls[0][0].data.paymentStatus).toBe(paymentStatus);
      const created = (prisma.outboxEvent.create.mock.calls as any[]).find((c) => c[0].data.eventType === 'ORDER_CREATED');
      expect(created[0].data.payload).toEqual(expect.objectContaining({ orderId: ORDER_ID, storeId: STORE_ID }));
    });

    it('payment recovery of an existing order re-ensures ORDER_CREATED but never rewrites the vendor snapshot', async () => {
      prisma.paymentTransaction.findFirst.mockResolvedValue(makeTx({ orderId: ORDER_ID }));
      prisma.order.findFirst.mockResolvedValue(makeOrder());
      prisma.checkoutSession.findUnique.mockResolvedValue({ cartId: CART_ID });
      prisma.checkoutSession.updateMany.mockResolvedValue({ count: 0 });
      prisma.cart.updateMany.mockResolvedValue({ count: 0 });
      prisma.outboxEvent.findFirst.mockResolvedValue(null); // event lost before — recovery writes it
      prisma.outboxEvent.create.mockResolvedValue({});

      await service.completePayment(TX_ID, STORE_ID);

      expect(prisma.product.findMany).not.toHaveBeenCalled();
      expect(prisma.orderItem.createMany).not.toHaveBeenCalled();
      const types = (prisma.outboxEvent.create.mock.calls as any[]).map((c) => c[0].data.eventType);
      expect(types).toContain('ORDER_CREATED');
    });
  });
});

// suppress linter about unused const
const storeId = STORE_ID;
void storeId;
