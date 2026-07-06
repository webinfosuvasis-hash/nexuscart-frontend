import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { OrderStatus }         from '@prisma/client';
import { PrismaService }       from '@/prisma/prisma.service';
import { OutboxHelperService } from '@/shared/outbox/outbox-helper.service';
import { CacheService }        from '@/shared/cache/cache.service';
import { FulfillmentService }  from '../fulfillment.service';
import type {
  CreateShipmentInput,
  MarkDeliveredInput,
  UpdateShipmentInput,
} from '../types/fulfillment.types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORE_ID    = 'store-1';
const ORDER_ID    = 'order-1';
const SHIPMENT_ID = 'ship-1';
const PROD_1      = 'prod-1';
const PROD_2      = 'prod-2';
const ACTOR_ID    = 'actor-1';

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

const makeOrderItem = (productId = PROD_1, quantity = 3, variantId: string | null = null) => ({
  id:          `oi-${productId}`,
  orderId:     ORDER_ID,
  productId,
  variantId,
  productName: 'Product',
  variantName: null,
  sku:         `SKU-${productId}`,
  quantity,
  unitPrice:   { toNumber: () => 100 } as any,
  total:       { toNumber: () => 300 } as any,
  brandName:   null,
  brandSlug:   null,
  thumbnail:   null,
  variantOptions: null,
  comparePrice:   null,
  lineDiscount:   { toNumber: () => 0 } as any,
  taxRate:        { toNumber: () => 0 } as any,
  taxAmount:      { toNumber: () => 0 } as any,
  taxClass:    null,
  hsn:         null,
});

const makeOrder = (status: OrderStatus = OrderStatus.PROCESSING, itemCount = 1) => ({
  id:      ORDER_ID,
  storeId: STORE_ID,
  status,
  items:   Array.from({ length: itemCount }, (_, i) => makeOrderItem(i === 0 ? PROD_1 : PROD_2)),
});

const makeShipmentItem = (productId = PROD_1) => ({
  id:         `si-${productId}`,
  shipmentId: SHIPMENT_ID,
  orderId:    ORDER_ID,
  productId,
  variantId:  null,
  quantity:   2,
});

const makeShipment = (overrides: Record<string, unknown> = {}) => ({
  id:             SHIPMENT_ID,
  orderId:        ORDER_ID,
  trackingNumber: 'TRK-123',
  carrier:        'DHL',
  status:         'SHIPPED',
  shippedAt:      new Date('2026-07-04T00:00:00Z'),
  deliveredAt:    null,
  createdAt:      new Date('2026-07-04T00:00:00Z'),
  items:          [makeShipmentItem()],
  ...overrides,
});

const BASE_INPUT: CreateShipmentInput = {
  orderId: ORDER_ID,
  storeId: STORE_ID,
  actorId: ACTOR_ID,
};

// ---------------------------------------------------------------------------
// Mock builder
// ---------------------------------------------------------------------------

function buildMocks() {
  // The same object serves as PrismaService AND the Prisma txClient inside
  // $transaction — the same pattern used across the codebase (see cancellation).
  const prismaMock = {
    order: {
      findFirst:  jest.fn(),
      updateMany: jest.fn(),
    },
    orderStatusHistory: { create: jest.fn() },
    shipment: {
      create:     jest.fn(),
      findFirst:  jest.fn(),
      update:     jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn().mockImplementation(async (fn: any) => fn(prismaMock)),
  };

  const cacheMock = {
    acquireLock:  jest.fn().mockResolvedValue(true),
    releaseLock:  jest.fn().mockResolvedValue(undefined),
  };

  const outboxMock = {
    upsertOutboxEvent: jest.fn().mockResolvedValue(undefined),
  };

  return { prismaMock, cacheMock, outboxMock };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('FulfillmentService', () => {
  let service:     FulfillmentService;
  let prismaMock:  ReturnType<typeof buildMocks>['prismaMock'];
  let cacheMock:   ReturnType<typeof buildMocks>['cacheMock'];
  let outboxMock:  ReturnType<typeof buildMocks>['outboxMock'];

  beforeEach(async () => {
    ({ prismaMock, cacheMock, outboxMock } = buildMocks());

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FulfillmentService,
        { provide: PrismaService,       useValue: prismaMock },
        { provide: OutboxHelperService, useValue: outboxMock  },
        { provide: CacheService,        useValue: cacheMock   },
      ],
    }).compile();

    service = module.get(FulfillmentService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── Stub guards (unchanged from IM-3) ──────────────────────────────────────

  // TEST-FUL-2 retired: updateShipment is now fully implemented in IM-5.

  // TEST-FUL-3 retired: markDelivered is now fully implemented in IM-6.

  // ── createShipment ─────────────────────────────────────────────────────────

  describe('createShipment', () => {

    // ── TEST-CS-1: Happy path (PROCESSING order, all items) ──────────────────

    it('TEST-CS-1: happy path — PROCESSING order ships all items, returns shipment with items', async () => {
      const order    = makeOrder(OrderStatus.PROCESSING, 2);
      const shipment = makeShipment({ items: [makeShipmentItem(PROD_1), makeShipmentItem(PROD_2)] });

      prismaMock.order.findFirst.mockResolvedValue(order);
      prismaMock.order.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.orderStatusHistory.create.mockResolvedValue({});
      prismaMock.shipment.create.mockResolvedValue(shipment);

      const result = await service.createShipment({
        ...BASE_INPUT,
        trackingNumber: 'TRK-123',
        carrier: 'DHL',
      });

      expect(result).toEqual(shipment);

      // Verify optimistic lock — WHERE includes current status
      expect(prismaMock.order.updateMany).toHaveBeenCalledWith({
        where: { id: ORDER_ID, status: OrderStatus.PROCESSING },
        data:  { status: OrderStatus.SHIPPED },
      });

      // Verify both order items are in the shipment
      expect(prismaMock.shipment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            orderId:        ORDER_ID,
            trackingNumber: 'TRK-123',
            carrier:        'DHL',
            status:         'SHIPPED',
            items: {
              create: expect.arrayContaining([
                expect.objectContaining({ productId: PROD_1 }),
                expect.objectContaining({ productId: PROD_2 }),
              ]),
            },
          }),
          include: { items: true },
        }),
      );
    });

    // ── TEST-CS-2: PENDING order (COD flow) ──────────────────────────────────

    it('TEST-CS-2: PENDING order is shippable (COD flow)', async () => {
      const order    = makeOrder(OrderStatus.PENDING, 1);
      const shipment = makeShipment();

      prismaMock.order.findFirst.mockResolvedValue(order);
      prismaMock.order.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.orderStatusHistory.create.mockResolvedValue({});
      prismaMock.shipment.create.mockResolvedValue(shipment);

      const result = await service.createShipment(BASE_INPUT);

      expect(result).toEqual(shipment);
      // Locks against PENDING, not PROCESSING
      expect(prismaMock.order.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: ORDER_ID, status: OrderStatus.PENDING } }),
      );
    });

    // ── TEST-CS-3: Explicit items (partial shipment) ──────────────────────────

    it('TEST-CS-3: explicit items — only specified items included in shipment', async () => {
      const order    = makeOrder(OrderStatus.PROCESSING, 2);
      const shipment = makeShipment({ items: [makeShipmentItem(PROD_1)] });

      prismaMock.order.findFirst.mockResolvedValue(order);
      prismaMock.order.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.orderStatusHistory.create.mockResolvedValue({});
      prismaMock.shipment.create.mockResolvedValue(shipment);

      await service.createShipment({
        ...BASE_INPUT,
        items: [{ productId: PROD_1, quantity: 2 }],
      });

      const createCall = prismaMock.shipment.create.mock.calls[0][0];
      expect(createCall.data.items.create).toHaveLength(1);
      expect(createCall.data.items.create[0].productId).toBe(PROD_1);
    });

    // ── TEST-CS-4: Order not found ───────────────────────────────────────────

    it('TEST-CS-4: order not found → NotFoundException', async () => {
      prismaMock.order.findFirst.mockResolvedValue(null);

      await expect(service.createShipment(BASE_INPUT))
        .rejects.toBeInstanceOf(NotFoundException);

      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    // ── TEST-CS-5: Wrong storeId — treated as not-found ──────────────────────

    it('TEST-CS-5: wrong storeId — NotFoundException (same as not-found)', async () => {
      // findFirst with storeId in WHERE returns null for the wrong store
      prismaMock.order.findFirst.mockResolvedValue(null);

      await expect(service.createShipment({ ...BASE_INPUT, storeId: 'wrong-store' }))
        .rejects.toBeInstanceOf(NotFoundException);
    });

    // ── TEST-CS-6: CANCELLED order ───────────────────────────────────────────

    it('TEST-CS-6: CANCELLED order → ConflictException, no transaction', async () => {
      prismaMock.order.findFirst.mockResolvedValue(makeOrder(OrderStatus.CANCELLED));

      await expect(service.createShipment(BASE_INPUT))
        .rejects.toBeInstanceOf(ConflictException);

      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    // ── TEST-CS-7: DELIVERED order ───────────────────────────────────────────

    it('TEST-CS-7: DELIVERED order → ConflictException, no transaction', async () => {
      prismaMock.order.findFirst.mockResolvedValue(makeOrder(OrderStatus.DELIVERED));

      await expect(service.createShipment(BASE_INPUT))
        .rejects.toBeInstanceOf(ConflictException);

      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    // ── TEST-CS-8: RETURNED order ────────────────────────────────────────────

    it('TEST-CS-8: RETURNED order → ConflictException', async () => {
      prismaMock.order.findFirst.mockResolvedValue(makeOrder(OrderStatus.RETURNED));

      await expect(service.createShipment(BASE_INPUT))
        .rejects.toBeInstanceOf(ConflictException);
    });

    // ── TEST-CS-9: SHIPPED order — idempotent return ─────────────────────────

    it('TEST-CS-9: SHIPPED order → idempotent: returns existing shipment, no transaction', async () => {
      const existing = makeShipment();

      prismaMock.order.findFirst.mockResolvedValue(makeOrder(OrderStatus.SHIPPED));
      prismaMock.shipment.findFirst.mockResolvedValue(existing);

      const result = await service.createShipment(BASE_INPUT);

      expect(result).toEqual(existing);
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
      // findFirst scoped to orderId with items included
      expect(prismaMock.shipment.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { orderId: ORDER_ID }, include: { items: true } }),
      );
    });

    // ── TEST-CS-10: Lock acquisition failure ─────────────────────────────────

    it('TEST-CS-10: lock not acquired → ServiceUnavailableException, releaseLock not called', async () => {
      cacheMock.acquireLock.mockResolvedValue(false);

      await expect(service.createShipment(BASE_INPUT))
        .rejects.toBeInstanceOf(ServiceUnavailableException);

      expect(cacheMock.releaseLock).not.toHaveBeenCalled();
      expect(prismaMock.order.findFirst).not.toHaveBeenCalled();
    });

    // ── TEST-CS-11: Lock release failure — does NOT propagate ────────────────

    it('TEST-CS-11: releaseLock failure does not propagate — successful result returned', async () => {
      const order    = makeOrder();
      const shipment = makeShipment();

      prismaMock.order.findFirst.mockResolvedValue(order);
      prismaMock.order.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.orderStatusHistory.create.mockResolvedValue({});
      prismaMock.shipment.create.mockResolvedValue(shipment);

      // releaseLock throws — must be swallowed by finally block
      cacheMock.releaseLock.mockRejectedValue(new Error('Redis down'));

      const result = await service.createShipment(BASE_INPUT);

      // Workflow completed successfully despite lock release failure
      expect(result).toEqual(shipment);
    });

    // ── TEST-CS-12: releaseLock called on exception path ─────────────────────

    it('TEST-CS-12: releaseLock called in finally even when workflow throws', async () => {
      prismaMock.order.findFirst.mockResolvedValue(makeOrder(OrderStatus.CANCELLED));

      await expect(service.createShipment(BASE_INPUT)).rejects.toBeInstanceOf(ConflictException);

      // Lock must be released even though an exception was thrown
      expect(cacheMock.releaseLock).toHaveBeenCalledWith(
        `order-lock:${ORDER_ID}`,
        expect.any(String),
      );
    });

    // ── TEST-CS-13: Optimistic lock failure — concurrent modification ─────────

    it('TEST-CS-13: optimistic lock failure (count=0, non-SHIPPED status) → ConflictException', async () => {
      const order = makeOrder(OrderStatus.PROCESSING);

      prismaMock.order.findFirst
        .mockResolvedValueOnce(order)                                   // Step 1
        .mockResolvedValueOnce(makeOrder(OrderStatus.CANCELLED));       // re-read in txn

      prismaMock.order.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.createShipment(BASE_INPUT))
        .rejects.toBeInstanceOf(ConflictException);

      // Transaction ran but committed nothing
      expect(prismaMock.shipment.create).not.toHaveBeenCalled();
    });

    // ── TEST-CS-14: Concurrent race — optimistic lock lost to another shipper ─

    it('TEST-CS-14: concurrent race — optimistic lock lost to other createShipment → returns existing', async () => {
      const order    = makeOrder(OrderStatus.PROCESSING);
      const existing = makeShipment();

      prismaMock.order.findFirst
        .mockResolvedValueOnce(order)                            // Step 1
        .mockResolvedValueOnce(makeOrder(OrderStatus.SHIPPED));  // re-read: other caller won

      prismaMock.order.updateMany.mockResolvedValue({ count: 0 });
      prismaMock.shipment.findFirst.mockResolvedValue(existing);

      const result = await service.createShipment(BASE_INPUT);

      // Resolved idempotently — not an error
      expect(result).toEqual(existing);
      expect(prismaMock.shipment.create).not.toHaveBeenCalled();
    });

    // ── TEST-CS-15: Duplicate items in request ───────────────────────────────

    it('TEST-CS-15: duplicate productId in items → BadRequestException before transaction', async () => {
      prismaMock.order.findFirst.mockResolvedValue(makeOrder(OrderStatus.PROCESSING, 1));

      await expect(
        service.createShipment({
          ...BASE_INPUT,
          items: [
            { productId: PROD_1, quantity: 1 },
            { productId: PROD_1, quantity: 1 }, // duplicate
          ],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    // ── TEST-CS-16: Item not in order ────────────────────────────────────────

    it('TEST-CS-16: item not in order → BadRequestException', async () => {
      prismaMock.order.findFirst.mockResolvedValue(makeOrder(OrderStatus.PROCESSING, 1));

      await expect(
        service.createShipment({
          ...BASE_INPUT,
          items: [{ productId: 'unknown-product', quantity: 1 }],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    // ── TEST-CS-17: Item quantity exceeds ordered ─────────────────────────────

    it('TEST-CS-17: shipment quantity exceeds ordered quantity → BadRequestException', async () => {
      prismaMock.order.findFirst.mockResolvedValue(makeOrder(OrderStatus.PROCESSING, 1));
      // makeOrder sets quantity = 3; request asks for 99

      await expect(
        service.createShipment({
          ...BASE_INPUT,
          items: [{ productId: PROD_1, quantity: 99 }],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    // ── TEST-CS-18: Outbox events correct ────────────────────────────────────

    it('TEST-CS-18: writes SHIPMENT_CREATED and ORDER_SHIPPED outbox events inside transaction', async () => {
      const order    = makeOrder();
      const shipment = makeShipment();

      prismaMock.order.findFirst.mockResolvedValue(order);
      prismaMock.order.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.orderStatusHistory.create.mockResolvedValue({});
      prismaMock.shipment.create.mockResolvedValue(shipment);

      await service.createShipment({
        ...BASE_INPUT,
        trackingNumber: 'TRK-999',
        carrier:        'FedEx',
        carrierUrl:     'https://fedex.com/track/TRK-999',
      });

      expect(outboxMock.upsertOutboxEvent).toHaveBeenCalledTimes(2);

      // SHIPMENT_CREATED — aggregateId is the shipment id
      expect(outboxMock.upsertOutboxEvent).toHaveBeenCalledWith(
        prismaMock,            // txClient (same object in tests)
        STORE_ID,
        expect.objectContaining({
          eventType:     'SHIPMENT_CREATED',
          aggregateId:   SHIPMENT_ID,
          aggregateType: 'Shipment',
          payload:       expect.objectContaining({
            shipmentId:     SHIPMENT_ID,
            orderId:        ORDER_ID,
            storeId:        STORE_ID,
            carrier:        'FedEx',
            carrierUrl:     'https://fedex.com/track/TRK-999',
          }),
        }),
      );

      // ORDER_SHIPPED — aggregateId is the order id
      expect(outboxMock.upsertOutboxEvent).toHaveBeenCalledWith(
        prismaMock,
        STORE_ID,
        expect.objectContaining({
          eventType:     'ORDER_SHIPPED',
          aggregateId:   ORDER_ID,
          aggregateType: 'Order',
          payload:       expect.objectContaining({
            orderId:    ORDER_ID,
            shipmentId: SHIPMENT_ID,
          }),
        }),
      );
    });

    // ── TEST-CS-19: carrierUrl in outbox payload even without schema column ───

    it('TEST-CS-19: carrierUrl forwarded in SHIPMENT_CREATED payload when no Shipment schema column exists', async () => {
      const shipment = makeShipment();
      prismaMock.order.findFirst.mockResolvedValue(makeOrder());
      prismaMock.order.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.orderStatusHistory.create.mockResolvedValue({});
      prismaMock.shipment.create.mockResolvedValue(shipment);

      await service.createShipment({ ...BASE_INPUT, carrierUrl: 'https://tracking.example.com' });

      const [, , ev] = outboxMock.upsertOutboxEvent.mock.calls[0];
      expect(ev.payload).toMatchObject({ carrierUrl: 'https://tracking.example.com' });
    });

    // ── TEST-CS-20: Note stored in OrderStatusHistory ─────────────────────────

    it('TEST-CS-20: note stored in OrderStatusHistory', async () => {
      prismaMock.order.findFirst.mockResolvedValue(makeOrder());
      prismaMock.order.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.orderStatusHistory.create.mockResolvedValue({});
      prismaMock.shipment.create.mockResolvedValue(makeShipment());

      await service.createShipment({ ...BASE_INPUT, note: 'Express delivery' });

      expect(prismaMock.orderStatusHistory.create).toHaveBeenCalledWith({
        data: {
          orderId: ORDER_ID,
          status:  OrderStatus.SHIPPED,
          note:    'Express delivery',
        },
      });
    });

    // ── TEST-CS-21: Default note when none provided ───────────────────────────

    it('TEST-CS-21: default note when none provided', async () => {
      prismaMock.order.findFirst.mockResolvedValue(makeOrder());
      prismaMock.order.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.orderStatusHistory.create.mockResolvedValue({});
      prismaMock.shipment.create.mockResolvedValue(makeShipment());

      await service.createShipment(BASE_INPUT);

      expect(prismaMock.orderStatusHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ note: 'Shipment created' }) }),
      );
    });

    // ── TEST-CS-22: Transaction rollback — shipment.create throws ─────────────

    it('TEST-CS-22: transaction error rolls back — exception propagates, lock still released', async () => {
      prismaMock.order.findFirst.mockResolvedValue(makeOrder());
      prismaMock.order.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.orderStatusHistory.create.mockResolvedValue({});
      prismaMock.shipment.create.mockRejectedValue(new Error('DB write failed'));

      await expect(service.createShipment(BASE_INPUT)).rejects.toThrow('DB write failed');

      // Lock still released in finally despite transaction failure
      expect(cacheMock.releaseLock).toHaveBeenCalledTimes(1);
    });

    // ── TEST-CS-23: acquireLock called with correct parameters ────────────────

    it('TEST-CS-23: acquireLock called with correct key, TTL=30000, retries=30, interval=200', async () => {
      cacheMock.acquireLock.mockResolvedValue(false);

      await expect(service.createShipment(BASE_INPUT)).rejects.toBeInstanceOf(ServiceUnavailableException);

      expect(cacheMock.acquireLock).toHaveBeenCalledWith(
        `order-lock:${ORDER_ID}`,
        expect.any(String), // UUID token
        30_000,
        30,
        200,
      );
    });

    // ── TEST-CS-24: Lock key and token passed to releaseLock ─────────────────

    it('TEST-CS-24: releaseLock called with same key and token that was passed to acquireLock', async () => {
      prismaMock.order.findFirst.mockResolvedValue(makeOrder());
      prismaMock.order.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.orderStatusHistory.create.mockResolvedValue({});
      prismaMock.shipment.create.mockResolvedValue(makeShipment());

      await service.createShipment(BASE_INPUT);

      const acquireArgs = cacheMock.acquireLock.mock.calls[0];
      const releaseArgs = cacheMock.releaseLock.mock.calls[0];

      expect(releaseArgs[0]).toBe(acquireArgs[0]); // same key
      expect(releaseArgs[1]).toBe(acquireArgs[1]); // same token
    });

    // ── TEST-CS-25: Idempotent retry after SHIPPED — findExistingShipment path ─

    it('TEST-CS-25: idempotent retry — SHIPPED order with existing shipment returns it', async () => {
      const existing = makeShipment({ id: 'ship-existing', items: [makeShipmentItem()] });

      prismaMock.order.findFirst.mockResolvedValue(makeOrder(OrderStatus.SHIPPED));
      prismaMock.shipment.findFirst.mockResolvedValue(existing);

      const result = await service.createShipment(BASE_INPUT);

      expect(result.id).toBe('ship-existing');
      expect(outboxMock.upsertOutboxEvent).not.toHaveBeenCalled();
    });

    // ── TEST-CS-26: All items ship — no items param, shippedAt set ────────────

    it('TEST-CS-26: shippedAt is set when creating shipment', async () => {
      prismaMock.order.findFirst.mockResolvedValue(makeOrder());
      prismaMock.order.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.orderStatusHistory.create.mockResolvedValue({});
      prismaMock.shipment.create.mockResolvedValue(makeShipment());

      await service.createShipment(BASE_INPUT);

      const createArg = prismaMock.shipment.create.mock.calls[0][0];
      expect(createArg.data.shippedAt).toBeInstanceOf(Date);
      expect(createArg.data.status).toBe('SHIPPED');
    });
  });

  // ── updateShipment ─────────────────────────────────────────────────────────

  describe('updateShipment', () => {

    // Pre-update (SHIPPED status, no tracking yet)
    const makePreShipment = (overrides: Record<string, unknown> = {}) => ({
      id:             SHIPMENT_ID,
      orderId:        ORDER_ID,
      trackingNumber: null,
      carrier:        null,
      status:         'SHIPPED',
      shippedAt:      new Date('2026-07-04T00:00:00Z'),
      deliveredAt:    null,
      createdAt:      new Date('2026-07-04T00:00:00Z'),
      items:          [makeShipmentItem()],
      ...overrides,
    });

    // Post-update (tracking info applied)
    const makePostShipment = () => ({
      ...makePreShipment(),
      trackingNumber: 'TRK-UPD',
      carrier:        'FedEx',
    });

    const BASE_UPDATE: UpdateShipmentInput = {
      shipmentId:     SHIPMENT_ID,
      orderId:        ORDER_ID,
      storeId:        STORE_ID,
      trackingNumber: 'TRK-UPD',
    };

    // Helper: set up the normal happy-path mocks
    function setupHappyPath() {
      prismaMock.order.findFirst.mockResolvedValue(makeOrder(OrderStatus.PROCESSING));
      prismaMock.shipment.findFirst
        .mockResolvedValueOnce(makePreShipment())   // Step 1
        .mockResolvedValueOnce(makePostShipment()); // Step 5
      prismaMock.shipment.updateMany.mockResolvedValue({ count: 1 });
    }

    // ── TEST-US-1: Happy path (trackingNumber only) ───────────────────────────

    it('TEST-US-1: happy path — tracking number update, returns updated shipment', async () => {
      setupHappyPath();

      const result = await service.updateShipment(BASE_UPDATE);

      expect(result.trackingNumber).toBe('FedEx' in result ? result.trackingNumber : 'TRK-UPD');
      expect(prismaMock.shipment.updateMany).toHaveBeenCalledWith({
        where: { id: SHIPMENT_ID, orderId: ORDER_ID, status: 'SHIPPED' },
        data:  { trackingNumber: 'TRK-UPD' },
      });
      expect(outboxMock.upsertOutboxEvent).toHaveBeenCalledTimes(1);
    });

    // ── TEST-US-2: Happy path (carrier only) ─────────────────────────────────

    it('TEST-US-2: carrier-only update writes correct schema field', async () => {
      prismaMock.order.findFirst.mockResolvedValue(makeOrder());
      prismaMock.shipment.findFirst
        .mockResolvedValueOnce(makePreShipment())
        .mockResolvedValueOnce(makePostShipment());
      prismaMock.shipment.updateMany.mockResolvedValue({ count: 1 });

      await service.updateShipment({ shipmentId: SHIPMENT_ID, orderId: ORDER_ID, storeId: STORE_ID, carrier: 'DHL' });

      expect(prismaMock.shipment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: { carrier: 'DHL' } }),
      );
    });

    // ── TEST-US-3: All four fields — trackingNumber + carrier + carrierUrl + note

    it('TEST-US-3: all fields — schema fields updated, non-schema fields in outbox payload', async () => {
      setupHappyPath();

      await service.updateShipment({
        shipmentId:     SHIPMENT_ID,
        orderId:        ORDER_ID,
        storeId:        STORE_ID,
        trackingNumber: 'TRK-UPD',
        carrier:        'FedEx',
        carrierUrl:     'https://fedex.com/track/TRK-UPD',
        note:           'Express delivery note',
      });

      // Schema: both fields in updateMany data
      const updateCall = prismaMock.shipment.updateMany.mock.calls[0][0];
      expect(updateCall.data).toEqual({ trackingNumber: 'TRK-UPD', carrier: 'FedEx' });

      // Non-schema: carrierUrl + note appear in outbox payload
      const [, , ev] = outboxMock.upsertOutboxEvent.mock.calls[0];
      expect(ev.payload).toMatchObject({
        carrierUrl: 'https://fedex.com/track/TRK-UPD',
        note:       'Express delivery note',
      });
    });

    // ── TEST-US-4: carrierUrl-only — no updateMany, outbox still written ──────

    it('TEST-US-4: carrierUrl-only update — skips updateMany, writes outbox event', async () => {
      prismaMock.order.findFirst.mockResolvedValue(makeOrder());
      const pre = makePreShipment();
      prismaMock.shipment.findFirst
        .mockResolvedValueOnce(pre)  // Step 1
        .mockResolvedValueOnce(pre); // Step 5
      // Note: shipment.updateMany NOT expected to be called

      await service.updateShipment({
        shipmentId: SHIPMENT_ID,
        orderId:    ORDER_ID,
        storeId:    STORE_ID,
        carrierUrl: 'https://tracking.example.com',
      });

      expect(prismaMock.shipment.updateMany).not.toHaveBeenCalled();
      expect(outboxMock.upsertOutboxEvent).toHaveBeenCalledWith(
        prismaMock,
        STORE_ID,
        expect.objectContaining({ eventType: 'SHIPMENT_UPDATED', aggregateId: SHIPMENT_ID }),
        { skipDedup: true },
      );
    });

    // ── TEST-US-5: Order not found ────────────────────────────────────────────

    it('TEST-US-5: order not found → NotFoundException', async () => {
      prismaMock.order.findFirst.mockResolvedValue(null);

      await expect(service.updateShipment(BASE_UPDATE))
        .rejects.toBeInstanceOf(NotFoundException);

      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    // ── TEST-US-6: Wrong storeId ──────────────────────────────────────────────

    it('TEST-US-6: wrong storeId — NotFoundException', async () => {
      prismaMock.order.findFirst.mockResolvedValue(null); // WHERE { id, storeId } misses

      await expect(service.updateShipment({ ...BASE_UPDATE, storeId: 'wrong-store' }))
        .rejects.toBeInstanceOf(NotFoundException);
    });

    // ── TEST-US-7: CANCELLED order ────────────────────────────────────────────

    it('TEST-US-7: CANCELLED order → ConflictException, no transaction', async () => {
      prismaMock.order.findFirst.mockResolvedValue(makeOrder(OrderStatus.CANCELLED));

      await expect(service.updateShipment(BASE_UPDATE))
        .rejects.toBeInstanceOf(ConflictException);

      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    // ── TEST-US-8: DELIVERED order ────────────────────────────────────────────

    it('TEST-US-8: DELIVERED order → ConflictException, no transaction', async () => {
      prismaMock.order.findFirst.mockResolvedValue(makeOrder(OrderStatus.DELIVERED));

      await expect(service.updateShipment(BASE_UPDATE))
        .rejects.toBeInstanceOf(ConflictException);

      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    // ── TEST-US-9: Shipment not found ─────────────────────────────────────────

    it('TEST-US-9: shipment not found for order → NotFoundException', async () => {
      prismaMock.order.findFirst.mockResolvedValue(makeOrder());
      prismaMock.shipment.findFirst.mockResolvedValue(null);

      await expect(service.updateShipment(BASE_UPDATE))
        .rejects.toBeInstanceOf(NotFoundException);

      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    // ── TEST-US-10: Shipment belongs to different order ───────────────────────

    it('TEST-US-10: shipment for different order returns NotFoundException', async () => {
      prismaMock.order.findFirst.mockResolvedValue(makeOrder());
      // findFirst WHERE { id: shipmentId, orderId } returns null if orderId mismatches
      prismaMock.shipment.findFirst.mockResolvedValue(null);

      await expect(service.updateShipment({ ...BASE_UPDATE, orderId: 'other-order' }))
        .rejects.toBeInstanceOf(NotFoundException);
    });

    // ── TEST-US-11: DELIVERED shipment ────────────────────────────────────────

    it('TEST-US-11: DELIVERED shipment → ConflictException, no transaction', async () => {
      prismaMock.order.findFirst.mockResolvedValue(makeOrder());
      prismaMock.shipment.findFirst.mockResolvedValue(makePreShipment({ status: 'DELIVERED' }));

      await expect(service.updateShipment(BASE_UPDATE))
        .rejects.toBeInstanceOf(ConflictException);

      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    // ── TEST-US-12: Empty update ──────────────────────────────────────────────

    it('TEST-US-12: empty update (no fields provided) → BadRequestException', async () => {
      prismaMock.order.findFirst.mockResolvedValue(makeOrder());
      prismaMock.shipment.findFirst.mockResolvedValue(makePreShipment());

      await expect(
        service.updateShipment({ shipmentId: SHIPMENT_ID, orderId: ORDER_ID, storeId: STORE_ID }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    // ── TEST-US-13: Lock not acquired ─────────────────────────────────────────

    it('TEST-US-13: lock not acquired → ServiceUnavailableException, releaseLock not called', async () => {
      cacheMock.acquireLock.mockResolvedValue(false);

      await expect(service.updateShipment(BASE_UPDATE))
        .rejects.toBeInstanceOf(ServiceUnavailableException);

      expect(cacheMock.releaseLock).not.toHaveBeenCalled();
      expect(prismaMock.order.findFirst).not.toHaveBeenCalled();
    });

    // ── TEST-US-14: Lock release failure — does not propagate ─────────────────

    it('TEST-US-14: releaseLock failure swallowed — successful result returned', async () => {
      setupHappyPath();
      cacheMock.releaseLock.mockRejectedValue(new Error('Redis down'));

      const result = await service.updateShipment(BASE_UPDATE);

      expect(result).toBeDefined();
      expect(result.trackingNumber).toBe('TRK-UPD'); // from makePostShipment
      expect(result.carrier).toBe('FedEx');
    });

    // ── TEST-US-15: releaseLock called in finally on exception path ───────────

    it('TEST-US-15: releaseLock called in finally even when workflow throws', async () => {
      prismaMock.order.findFirst.mockResolvedValue(makeOrder(OrderStatus.CANCELLED));

      await expect(service.updateShipment(BASE_UPDATE)).rejects.toBeInstanceOf(ConflictException);

      expect(cacheMock.releaseLock).toHaveBeenCalledWith(
        `order-lock:${ORDER_ID}`,
        expect.any(String),
      );
    });

    // ── TEST-US-16: Optimistic lock failure ───────────────────────────────────

    it('TEST-US-16: optimistic lock failure (count=0) → ConflictException', async () => {
      prismaMock.order.findFirst.mockResolvedValue(makeOrder());
      prismaMock.shipment.findFirst
        .mockResolvedValueOnce(makePreShipment())                      // Step 1
        .mockResolvedValueOnce(makePreShipment({ status: 'DELIVERED' })); // re-read in txn

      prismaMock.shipment.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.updateShipment(BASE_UPDATE))
        .rejects.toBeInstanceOf(ConflictException);

      // No post-transaction fetch
      expect(prismaMock.shipment.findFirst).toHaveBeenCalledTimes(2);
    });

    // ── TEST-US-17: Concurrent update race — other caller already won ─────────

    it('TEST-US-17: concurrent update (count=0, fresh shipment gone) → NotFoundException', async () => {
      prismaMock.order.findFirst.mockResolvedValue(makeOrder());
      prismaMock.shipment.findFirst
        .mockResolvedValueOnce(makePreShipment()) // Step 1
        .mockResolvedValueOnce(null);             // re-read in txn: shipment deleted

      prismaMock.shipment.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.updateShipment(BASE_UPDATE))
        .rejects.toBeInstanceOf(NotFoundException);
    });

    // ── TEST-US-18: Transaction rollback — outbox throws ─────────────────────

    it('TEST-US-18: transaction error propagates, lock still released', async () => {
      prismaMock.order.findFirst.mockResolvedValue(makeOrder());
      prismaMock.shipment.findFirst.mockResolvedValueOnce(makePreShipment());
      prismaMock.shipment.updateMany.mockResolvedValue({ count: 1 });
      outboxMock.upsertOutboxEvent.mockRejectedValue(new Error('outbox write failed'));

      await expect(service.updateShipment(BASE_UPDATE)).rejects.toThrow('outbox write failed');

      expect(cacheMock.releaseLock).toHaveBeenCalledTimes(1);
    });

    // ── TEST-US-19: SHIPMENT_UPDATED outbox event ─────────────────────────────

    it('TEST-US-19: SHIPMENT_UPDATED outbox event has correct aggregateId and type', async () => {
      setupHappyPath();

      await service.updateShipment({
        ...BASE_UPDATE,
        carrier:    'UPS',
        carrierUrl: 'https://ups.com/track/TRK-UPD',
      });

      expect(outboxMock.upsertOutboxEvent).toHaveBeenCalledWith(
        prismaMock,
        STORE_ID,
        expect.objectContaining({
          eventType:     'SHIPMENT_UPDATED',
          aggregateId:   SHIPMENT_ID,
          aggregateType: 'Shipment',
          payload:       expect.objectContaining({
            shipmentId: SHIPMENT_ID,
            orderId:    ORDER_ID,
            storeId:    STORE_ID,
            carrier:    'UPS',
            carrierUrl: 'https://ups.com/track/TRK-UPD',
          }),
        }),
        { skipDedup: true },
      );
    });

    // ── TEST-US-20: acquireLock called with correct parameters ────────────────

    it('TEST-US-20: acquireLock called with correct key, TTL=30000, retries=30, interval=200', async () => {
      cacheMock.acquireLock.mockResolvedValue(false);

      await expect(service.updateShipment(BASE_UPDATE)).rejects.toBeInstanceOf(ServiceUnavailableException);

      expect(cacheMock.acquireLock).toHaveBeenCalledWith(
        `order-lock:${ORDER_ID}`,
        expect.any(String),
        30_000,
        30,
        200,
      );
    });

    // ── TEST-US-21: releaseLock uses same key + token as acquireLock ──────────

    it('TEST-US-21: releaseLock receives same key and token as acquireLock', async () => {
      setupHappyPath();

      await service.updateShipment(BASE_UPDATE);

      const [acquireKey, acquireToken] = cacheMock.acquireLock.mock.calls[0];
      const [releaseKey, releaseToken] = cacheMock.releaseLock.mock.calls[0];
      expect(releaseKey).toBe(acquireKey);
      expect(releaseToken).toBe(acquireToken);
    });

    // ── TEST-US-22: Post-transaction fetch returns updated shipment ────────────

    it('TEST-US-22: post-transaction findFirst returns updated shipment', async () => {
      setupHappyPath();

      const result = await service.updateShipment(BASE_UPDATE);

      // Step 5 fetch uses shipmentId + orderId scope
      const lastCall = prismaMock.shipment.findFirst.mock.calls.at(-1);
      expect(lastCall[0]).toMatchObject({
        where:   { id: SHIPMENT_ID, orderId: ORDER_ID },
        include: { items: true },
      });
      // Returns the post-update shape
      expect(result.carrier).toBe('FedEx');
    });

    // ── TEST-US-23: note appears in outbox payload, not in schema update ───────

    it('TEST-US-23: note goes to outbox payload only — not included in updateMany data', async () => {
      setupHappyPath();

      await service.updateShipment({
        shipmentId:     SHIPMENT_ID,
        orderId:        ORDER_ID,
        storeId:        STORE_ID,
        trackingNumber: 'TRK-UPD',
        note:           'Handle with care',
      });

      const updateCall = prismaMock.shipment.updateMany.mock.calls[0][0];
      expect(updateCall.data).not.toHaveProperty('note');

      const [, , ev] = outboxMock.upsertOutboxEvent.mock.calls[0];
      expect(ev.payload.note).toBe('Handle with care');
    });

    // ── TEST-US-24: Optimistic lock WHERE clause ──────────────────────────────

    it('TEST-US-24: optimistic lock WHERE includes shipmentId, orderId, and lockedStatus', async () => {
      setupHappyPath();

      await service.updateShipment(BASE_UPDATE);

      expect(prismaMock.shipment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: SHIPMENT_ID, orderId: ORDER_ID, status: 'SHIPPED' },
        }),
      );
    });

    // ── TEST-US-25: SHIPPED order is valid for update ─────────────────────────

    it('TEST-US-25: order in SHIPPED status — update allowed (tracking being corrected)', async () => {
      prismaMock.order.findFirst.mockResolvedValue(makeOrder(OrderStatus.SHIPPED));
      const pre = makePreShipment();
      prismaMock.shipment.findFirst
        .mockResolvedValueOnce(pre)
        .mockResolvedValueOnce(makePostShipment());
      prismaMock.shipment.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.updateShipment(BASE_UPDATE);

      expect(result).toBeDefined();
    });

    // ── P2-1 regression: RETURNED and REFUNDED orders block shipment updates ──

    it('TEST-US-26: RETURNED order → ConflictException, no transaction (P2-1 regression)', async () => {
      prismaMock.order.findFirst.mockResolvedValue(makeOrder(OrderStatus.RETURNED));

      await expect(service.updateShipment(BASE_UPDATE))
        .rejects.toBeInstanceOf(ConflictException);

      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('TEST-US-27: REFUNDED order → ConflictException, no transaction (P2-1 regression)', async () => {
      prismaMock.order.findFirst.mockResolvedValue(makeOrder(OrderStatus.REFUNDED));

      await expect(service.updateShipment(BASE_UPDATE))
        .rejects.toBeInstanceOf(ConflictException);

      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    // ── P1-1 regression: skipDedup ensures multiple updates each emit an event ─

    it('TEST-US-28: upsertOutboxEvent called with skipDedup=true — SHIPMENT_UPDATED bypasses lifecycle dedup (P1-1 regression)', async () => {
      setupHappyPath();

      await service.updateShipment(BASE_UPDATE);

      const [, , , options] = outboxMock.upsertOutboxEvent.mock.calls[0];
      expect(options).toEqual({ skipDedup: true });
    });

    it('TEST-US-29: two sequential updateShipment calls each invoke upsertOutboxEvent (P1-1 regression)', async () => {
      // First call
      setupHappyPath();
      await service.updateShipment(BASE_UPDATE);

      // Second call — re-setup mocks
      jest.clearAllMocks();
      cacheMock.acquireLock.mockResolvedValue(true);
      setupHappyPath();

      await service.updateShipment({ ...BASE_UPDATE, trackingNumber: 'TRK-003' });

      // Each call must invoke upsertOutboxEvent independently — skipDedup ensures
      // no in-app deduplication prevents the second event from being written.
      expect(outboxMock.upsertOutboxEvent).toHaveBeenCalledTimes(1); // 1 per call (mocks reset between)
      const [, , , opts] = outboxMock.upsertOutboxEvent.mock.calls[0];
      expect(opts).toEqual({ skipDedup: true });
    });
  });

  // ── markDelivered ──────────────────────────────────────────────────────────

  describe('markDelivered', () => {

    const BASE_MD: MarkDeliveredInput = {
      shipmentId: SHIPMENT_ID,
      orderId:    ORDER_ID,
      storeId:    STORE_ID,
      actorId:    ACTOR_ID,
    };

    const makeDeliveredShipment = (overrides: Record<string, unknown> = {}) =>
      makeShipment({ status: 'DELIVERED', deliveredAt: new Date('2026-07-04T10:00:00Z'), ...overrides });

    function setupHappyMD() {
      const pre  = makeShipment();              // status: 'SHIPPED'
      const post = makeDeliveredShipment();

      prismaMock.order.findFirst.mockResolvedValue(makeOrder(OrderStatus.SHIPPED));
      prismaMock.order.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.shipment.findFirst
        .mockResolvedValueOnce(pre)   // initial shipment load
        .mockResolvedValueOnce(post); // post-tx re-fetch
      prismaMock.shipment.update.mockResolvedValue(post);
      prismaMock.orderStatusHistory.create.mockResolvedValue({});
    }

    // ── TEST-MD-1: Happy path ─────────────────────────────────────────────────

    it('TEST-MD-1: happy path — SHIPPED order returns delivered shipment with items', async () => {
      setupHappyMD();

      const result = await service.markDelivered(BASE_MD);

      expect(result.status).toBe('DELIVERED');
      expect(result.items).toBeDefined();
    });

    // ── TEST-MD-2: explicit deliveredAt ───────────────────────────────────────

    it('TEST-MD-2: deliveredAt provided — used verbatim in shipment.update data', async () => {
      setupHappyMD();
      const explicit = new Date('2026-07-01T12:00:00Z');

      await service.markDelivered({ ...BASE_MD, deliveredAt: explicit });

      expect(prismaMock.shipment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ deliveredAt: explicit }),
        }),
      );
    });

    // ── TEST-MD-3: deliveredAt defaults to now ────────────────────────────────

    it('TEST-MD-3: deliveredAt omitted — shipment.update receives a recent Date', async () => {
      setupHappyMD();
      const before = new Date();

      await service.markDelivered(BASE_MD);

      const [arg] = prismaMock.shipment.update.mock.calls[0];
      const used: Date = arg.data.deliveredAt;
      expect(used.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(used.getTime()).toBeLessThanOrEqual(Date.now() + 100);
    });

    // ── TEST-MD-4: Both outbox events emitted ─────────────────────────────────

    it('TEST-MD-4: emits SHIPMENT_DELIVERED and ORDER_DELIVERED outbox events', async () => {
      setupHappyMD();

      await service.markDelivered(BASE_MD);

      const types = outboxMock.upsertOutboxEvent.mock.calls.map(
        ([, , ev]: [any, any, { eventType: string }]) => ev.eventType,
      );
      expect(types).toContain('SHIPMENT_DELIVERED');
      expect(types).toContain('ORDER_DELIVERED');
    });

    // ── TEST-MD-5: SHIPMENT_DELIVERED payload ─────────────────────────────────

    it('TEST-MD-5: SHIPMENT_DELIVERED payload contains required fields + ISO deliveredAt', async () => {
      setupHappyMD();

      await service.markDelivered(BASE_MD);

      const call = outboxMock.upsertOutboxEvent.mock.calls.find(
        ([, , ev]: [any, any, any]) => ev.eventType === 'SHIPMENT_DELIVERED',
      )!;
      const ev = call[2];
      expect(ev.aggregateId).toBe(SHIPMENT_ID);
      expect(ev.aggregateType).toBe('Shipment');
      expect(ev.payload).toMatchObject({
        shipmentId: SHIPMENT_ID,
        orderId:    ORDER_ID,
        storeId:    STORE_ID,
        actorId:    ACTOR_ID,
      });
      expect(typeof ev.payload.deliveredAt).toBe('string');
    });

    // ── TEST-MD-6: ORDER_DELIVERED payload ────────────────────────────────────

    it('TEST-MD-6: ORDER_DELIVERED payload contains orderId, storeId, shipmentId, actorId', async () => {
      setupHappyMD();

      await service.markDelivered(BASE_MD);

      const call = outboxMock.upsertOutboxEvent.mock.calls.find(
        ([, , ev]: [any, any, any]) => ev.eventType === 'ORDER_DELIVERED',
      )!;
      const ev = call[2];
      expect(ev.aggregateId).toBe(ORDER_ID);
      expect(ev.aggregateType).toBe('Order');
      expect(ev.payload).toMatchObject({
        orderId:    ORDER_ID,
        storeId:    STORE_ID,
        shipmentId: SHIPMENT_ID,
        actorId:    ACTOR_ID,
      });
    });

    // ── TEST-MD-7: CANCELLED order ────────────────────────────────────────────

    it('TEST-MD-7: CANCELLED order → ConflictException', async () => {
      prismaMock.order.findFirst.mockResolvedValue(makeOrder(OrderStatus.CANCELLED));

      await expect(service.markDelivered(BASE_MD)).rejects.toBeInstanceOf(ConflictException);
    });

    // ── TEST-MD-8: DELIVERED order → idempotent return ────────────────────────

    it('TEST-MD-8: DELIVERED order → idempotent — returns existing shipment, no writes', async () => {
      const delivered = makeDeliveredShipment();
      prismaMock.order.findFirst.mockResolvedValue(makeOrder(OrderStatus.DELIVERED));
      prismaMock.shipment.findFirst.mockResolvedValue(delivered);

      const result = await service.markDelivered(BASE_MD);

      expect(result).toEqual(delivered);
      expect(prismaMock.order.updateMany).not.toHaveBeenCalled();
      expect(outboxMock.upsertOutboxEvent).not.toHaveBeenCalled();
    });

    // ── TEST-MD-9: PENDING order ──────────────────────────────────────────────

    it('TEST-MD-9: PENDING order → ConflictException (must be SHIPPED to deliver)', async () => {
      prismaMock.order.findFirst.mockResolvedValue(makeOrder(OrderStatus.PENDING));

      await expect(service.markDelivered(BASE_MD)).rejects.toBeInstanceOf(ConflictException);
    });

    // ── TEST-MD-10: PROCESSING order ─────────────────────────────────────────

    it('TEST-MD-10: PROCESSING order → ConflictException (must be SHIPPED to deliver)', async () => {
      prismaMock.order.findFirst.mockResolvedValue(makeOrder(OrderStatus.PROCESSING));

      await expect(service.markDelivered(BASE_MD)).rejects.toBeInstanceOf(ConflictException);
    });

    // ── TEST-MD-11: Order not found ───────────────────────────────────────────

    it('TEST-MD-11: order not found in store → NotFoundException', async () => {
      prismaMock.order.findFirst.mockResolvedValue(null);

      await expect(service.markDelivered(BASE_MD)).rejects.toBeInstanceOf(NotFoundException);
    });

    // ── TEST-MD-12: Shipment not found ───────────────────────────────────────

    it('TEST-MD-12: shipment not found for order → NotFoundException', async () => {
      prismaMock.order.findFirst.mockResolvedValue(makeOrder(OrderStatus.SHIPPED));
      prismaMock.shipment.findFirst.mockResolvedValue(null);

      await expect(service.markDelivered(BASE_MD)).rejects.toBeInstanceOf(NotFoundException);
    });

    // ── TEST-MD-13: Shipment already DELIVERED ────────────────────────────────

    it('TEST-MD-13: shipment already DELIVERED → ConflictException', async () => {
      prismaMock.order.findFirst.mockResolvedValue(makeOrder(OrderStatus.SHIPPED));
      prismaMock.shipment.findFirst.mockResolvedValue(makeShipment({ status: 'DELIVERED' }));

      await expect(service.markDelivered(BASE_MD)).rejects.toBeInstanceOf(ConflictException);
    });

    // ── TEST-MD-14: Lock not acquired ─────────────────────────────────────────

    it('TEST-MD-14: lock not acquired → ServiceUnavailableException before any DB call', async () => {
      cacheMock.acquireLock.mockResolvedValue(false);

      await expect(service.markDelivered(BASE_MD)).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(prismaMock.order.findFirst).not.toHaveBeenCalled();
    });

    // ── TEST-MD-15: releaseLock called on success ─────────────────────────────

    it('TEST-MD-15: releaseLock called in finally on success', async () => {
      setupHappyMD();

      await service.markDelivered(BASE_MD);

      expect(cacheMock.releaseLock).toHaveBeenCalledWith(
        `order-lock:${ORDER_ID}`,
        expect.any(String),
      );
    });

    // ── TEST-MD-16: releaseLock called on exception ───────────────────────────

    it('TEST-MD-16: releaseLock called even when business logic throws', async () => {
      prismaMock.order.findFirst.mockResolvedValue(null);

      await expect(service.markDelivered(BASE_MD)).rejects.toBeInstanceOf(NotFoundException);
      expect(cacheMock.releaseLock).toHaveBeenCalled();
    });

    // ── TEST-MD-17: releaseLock failure is swallowed ──────────────────────────

    it('TEST-MD-17: releaseLock failure is swallowed — original success still returned', async () => {
      setupHappyMD();
      cacheMock.releaseLock.mockRejectedValue(new Error('Redis down'));

      const result = await service.markDelivered(BASE_MD);

      expect(result).toBeDefined();
    });

    // ── TEST-MD-18: Optimistic lock count=0 → DELIVERED → idempotent ─────────

    it('TEST-MD-18: count=0, tx re-read → DELIVERED → idempotent return, no shipment.update', async () => {
      const order      = makeOrder(OrderStatus.SHIPPED);
      const pre        = makeShipment();
      const existing   = makeDeliveredShipment();

      prismaMock.order.findFirst
        .mockResolvedValueOnce(order)                            // outer load
        .mockResolvedValueOnce(makeOrder(OrderStatus.DELIVERED)); // tx re-read
      prismaMock.order.updateMany.mockResolvedValue({ count: 0 });
      prismaMock.shipment.findFirst
        .mockResolvedValueOnce(pre)      // initial shipment load
        .mockResolvedValueOnce(existing); // findExistingShipment (idempotent path)

      const result = await service.markDelivered(BASE_MD);

      expect(result).toEqual(existing);
      expect(prismaMock.shipment.update).not.toHaveBeenCalled();
      expect(outboxMock.upsertOutboxEvent).not.toHaveBeenCalled();
    });

    // ── TEST-MD-19: Optimistic lock count=0 → non-DELIVERED → ConflictException

    it('TEST-MD-19: count=0, tx re-read → non-DELIVERED → ConflictException', async () => {
      const order = makeOrder(OrderStatus.SHIPPED);
      const pre   = makeShipment();

      prismaMock.order.findFirst
        .mockResolvedValueOnce(order)                              // outer load
        .mockResolvedValueOnce(makeOrder(OrderStatus.PROCESSING)); // tx re-read
      prismaMock.order.updateMany.mockResolvedValue({ count: 0 });
      prismaMock.shipment.findFirst.mockResolvedValueOnce(pre);

      await expect(service.markDelivered(BASE_MD)).rejects.toBeInstanceOf(ConflictException);
    });

    // ── TEST-MD-20: optimistic lock WHERE clause ──────────────────────────────

    it('TEST-MD-20: order.updateMany WHERE uses orderId and SHIPPED as lockedStatus', async () => {
      setupHappyMD();

      await service.markDelivered(BASE_MD);

      expect(prismaMock.order.updateMany).toHaveBeenCalledWith({
        where: { id: ORDER_ID, status: OrderStatus.SHIPPED },
        data:  { status: OrderStatus.DELIVERED },
      });
    });

    // ── TEST-MD-21: shipment.update WHERE + data ──────────────────────────────

    it('TEST-MD-21: shipment.update called with shipmentId, DELIVERED status, explicit deliveredAt', async () => {
      setupHappyMD();
      const explicit = new Date('2026-07-04T08:00:00Z');

      await service.markDelivered({ ...BASE_MD, deliveredAt: explicit });

      expect(prismaMock.shipment.update).toHaveBeenCalledWith({
        where: { id: SHIPMENT_ID },
        data:  { status: 'DELIVERED', deliveredAt: explicit },
      });
    });

    // ── TEST-MD-22: orderStatusHistory.create ────────────────────────────────

    it('TEST-MD-22: orderStatusHistory.create written with DELIVERED status for the order', async () => {
      setupHappyMD();

      await service.markDelivered(BASE_MD);

      expect(prismaMock.orderStatusHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            orderId: ORDER_ID,
            status:  OrderStatus.DELIVERED,
          }),
        }),
      );
    });

    // ── TEST-MD-23: Outbox event order ───────────────────────────────────────

    it('TEST-MD-23: SHIPMENT_DELIVERED outbox event emitted before ORDER_DELIVERED', async () => {
      setupHappyMD();

      await service.markDelivered(BASE_MD);

      const calls = outboxMock.upsertOutboxEvent.mock.calls;
      expect(calls).toHaveLength(2);
      expect(calls[0][2].eventType).toBe('SHIPMENT_DELIVERED');
      expect(calls[1][2].eventType).toBe('ORDER_DELIVERED');
    });

    // ── TEST-MD-24: post-tx re-fetch result returned ──────────────────────────

    it('TEST-MD-24: returns post-tx re-fetched shipment with updated status and deliveredAt', async () => {
      const explicitAt = new Date('2026-07-04T12:00:00Z');
      const post = makeDeliveredShipment({ deliveredAt: explicitAt });
      const pre  = makeShipment();

      prismaMock.order.findFirst.mockResolvedValue(makeOrder(OrderStatus.SHIPPED));
      prismaMock.order.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.shipment.findFirst
        .mockResolvedValueOnce(pre)
        .mockResolvedValueOnce(post);
      prismaMock.shipment.update.mockResolvedValue(post);
      prismaMock.orderStatusHistory.create.mockResolvedValue({});

      const result = await service.markDelivered(BASE_MD);

      expect(result.status).toBe('DELIVERED');
      expect(result.deliveredAt).toEqual(explicitAt);
    });

    // ── TEST-MD-25: post-tx re-fetch null → NotFoundException ─────────────────

    it('TEST-MD-25: post-tx re-fetch returns null → NotFoundException (data inconsistency guard)', async () => {
      const pre = makeShipment();

      prismaMock.order.findFirst.mockResolvedValue(makeOrder(OrderStatus.SHIPPED));
      prismaMock.order.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.shipment.findFirst
        .mockResolvedValueOnce(pre)   // initial load
        .mockResolvedValueOnce(null); // post-tx re-fetch — gone
      prismaMock.shipment.update.mockResolvedValue({});
      prismaMock.orderStatusHistory.create.mockResolvedValue({});

      await expect(service.markDelivered(BASE_MD)).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
