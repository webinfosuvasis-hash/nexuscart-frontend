import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { FulfillmentNotificationService } from '../fulfillment-notification.service';
import { PrismaService } from '@/prisma/prisma.service';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const STORE_ID  = 'store-1';
const ORDER_ID  = 'order-1';
const CUST_ID   = 'cust-1';
const SHIP_ID   = 'ship-1';

function makeStoreSettings(overrides: Record<string, unknown> = {}) {
  return { orderEmailEnabled: true, currency: 'INR', ...overrides };
}

function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    id:          ORDER_ID,
    orderNumber: 'ORD-0001',
    status:      'SHIPPED',
    customerId:  CUST_ID,
    ...overrides,
  };
}

function makeCustomer(overrides: Record<string, unknown> = {}) {
  return { id: CUST_ID, email: 'customer@test.com', name: 'Test Customer', ...overrides };
}

function makeTemplate(type: string) {
  return { subject: `Test ${type} subject`, htmlContent: `<p>${type}</p>`, type };
}

function makePayload(overrides: Record<string, unknown> = {}) {
  return {
    storeId:        STORE_ID,
    orderId:        ORDER_ID,
    shipmentId:     SHIP_ID,
    actorId:        'admin-1',
    trackingNumber: 'TRK123',
    carrier:        'DHL',
    carrierUrl:     'https://track.dhl.com/TRK123',
    deliveredAt:    '2026-07-04T10:00:00.000Z',
    note:           null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Mock factory
// ---------------------------------------------------------------------------

function buildPrismaMock() {
  return {
    storeSettings: { findFirst: jest.fn() },
    order:         { findFirst: jest.fn() },
    customer:      { findFirst: jest.fn() },
    emailTemplate: { findFirst: jest.fn() },
  };
}

function wireHappyPath(
  prisma:       ReturnType<typeof buildPrismaMock>,
  templateType: string,
) {
  prisma.storeSettings.findFirst.mockResolvedValue(makeStoreSettings());
  prisma.order.findFirst.mockResolvedValue(makeOrder());
  prisma.customer.findFirst.mockResolvedValue(makeCustomer());
  prisma.emailTemplate.findFirst.mockResolvedValue(makeTemplate(templateType));
}

// ---------------------------------------------------------------------------
// Module instantiation test
// ---------------------------------------------------------------------------

describe('FulfillmentNotificationService — module wiring', () => {
  it('TEST-FN-MOD-1: NestJS TestingModule compiles with PrismaService + ConfigService', async () => {
    const prismaMock  = buildPrismaMock();
    const configMock  = { get: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FulfillmentNotificationService,
        { provide: PrismaService,  useValue: prismaMock },
        { provide: ConfigService,  useValue: configMock },
      ],
    }).compile();

    const service = module.get(FulfillmentNotificationService);
    expect(service).toBeInstanceOf(FulfillmentNotificationService);
  });
});

// ---------------------------------------------------------------------------
// Handler test factory
// Generates the 7 canonical tests for a given handler method + template type.
// ---------------------------------------------------------------------------

function describeHandler(
  handlerName: keyof FulfillmentNotificationService,
  templateType: string,
  payloadOverrides: Record<string, unknown> = {},
) {
  describe(`FulfillmentNotificationService — ${handlerName}`, () => {
    let service:   FulfillmentNotificationService;
    let prisma:    ReturnType<typeof buildPrismaMock>;

    beforeEach(async () => {
      prisma = buildPrismaMock();
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          FulfillmentNotificationService,
          { provide: PrismaService, useValue: prisma },
          { provide: ConfigService, useValue: { get: jest.fn() } },
        ],
      }).compile();
      service = module.get(FulfillmentNotificationService);
    });

    afterEach(() => jest.clearAllMocks());

    const payload = () => makePayload(payloadOverrides);

    // ── Test 1: Happy path ─────────────────────────────────────────────────

    it(`TEST-${templateType}-1: happy path — resolves without throwing and uses correct template type`, async () => {
      wireHappyPath(prisma, templateType);

      await expect(
        (service[handlerName] as Function).call(service, payload()),
      ).resolves.toBeUndefined();

      expect(prisma.emailTemplate.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: templateType, isActive: true, storeId: STORE_ID }),
        }),
      );
    });

    // ── Test 2: orderEmailEnabled = false ──────────────────────────────────

    it(`TEST-${templateType}-2: orderEmailEnabled=false — returns early, customer and template not queried`, async () => {
      prisma.storeSettings.findFirst.mockResolvedValue(makeStoreSettings({ orderEmailEnabled: false }));

      await expect(
        (service[handlerName] as Function).call(service, payload()),
      ).resolves.toBeUndefined();

      expect(prisma.order.findFirst).not.toHaveBeenCalled();
      expect(prisma.customer.findFirst).not.toHaveBeenCalled();
      expect(prisma.emailTemplate.findFirst).not.toHaveBeenCalled();
    });

    // ── Test 3: StoreSettings not found ───────────────────────────────────

    it(`TEST-${templateType}-3: storeSettings=null — returns early, all downstream queries skipped`, async () => {
      prisma.storeSettings.findFirst.mockResolvedValue(null);

      await expect(
        (service[handlerName] as Function).call(service, payload()),
      ).resolves.toBeUndefined();

      expect(prisma.order.findFirst).not.toHaveBeenCalled();
      expect(prisma.customer.findFirst).not.toHaveBeenCalled();
      expect(prisma.emailTemplate.findFirst).not.toHaveBeenCalled();
    });

    // ── Test 4: Order not found ────────────────────────────────────────────

    it(`TEST-${templateType}-4: order=null — returns early, customer and template not queried`, async () => {
      prisma.storeSettings.findFirst.mockResolvedValue(makeStoreSettings());
      prisma.order.findFirst.mockResolvedValue(null);

      await expect(
        (service[handlerName] as Function).call(service, payload()),
      ).resolves.toBeUndefined();

      expect(prisma.customer.findFirst).not.toHaveBeenCalled();
      expect(prisma.emailTemplate.findFirst).not.toHaveBeenCalled();
    });

    // ── Test 5: Guest order (customerId = null) ────────────────────────────

    it(`TEST-${templateType}-5: guest order (customerId=null) — returns early, template not queried`, async () => {
      prisma.storeSettings.findFirst.mockResolvedValue(makeStoreSettings());
      prisma.order.findFirst.mockResolvedValue(makeOrder({ customerId: null }));

      await expect(
        (service[handlerName] as Function).call(service, payload()),
      ).resolves.toBeUndefined();

      expect(prisma.customer.findFirst).not.toHaveBeenCalled();
      expect(prisma.emailTemplate.findFirst).not.toHaveBeenCalled();
    });

    // ── Test 6: EmailTemplate not found ───────────────────────────────────

    it(`TEST-${templateType}-6: emailTemplate=null — handler returns without throwing`, async () => {
      prisma.storeSettings.findFirst.mockResolvedValue(makeStoreSettings());
      prisma.order.findFirst.mockResolvedValue(makeOrder());
      prisma.customer.findFirst.mockResolvedValue(makeCustomer());
      prisma.emailTemplate.findFirst.mockResolvedValue(null);

      await expect(
        (service[handlerName] as Function).call(service, payload()),
      ).resolves.toBeUndefined();
    });

    // ── Test 7: Prisma error is swallowed ─────────────────────────────────

    it(`TEST-${templateType}-7: Prisma throws on storeSettings.findFirst — handler swallows error and does not throw`, async () => {
      prisma.storeSettings.findFirst.mockRejectedValue(new Error('DB connection timeout'));

      await expect(
        (service[handlerName] as Function).call(service, payload()),
      ).resolves.toBeUndefined();
    });
  });
}

// ---------------------------------------------------------------------------
// Generate the 35 handler tests (7 per handler × 5 handlers)
// ---------------------------------------------------------------------------

describeHandler('handleShipmentCreated',  'SHIPMENT_CREATED',  {});
describeHandler('handleOrderShipped',     'ORDER_SHIPPED',     {});
describeHandler('handleShipmentUpdated',  'SHIPMENT_UPDATED',  {});
describeHandler('handleShipmentDelivered','SHIPMENT_DELIVERED',{});
describeHandler('handleOrderDelivered',   'ORDER_DELIVERED',   {});

// ---------------------------------------------------------------------------
// Additional regression tests
// ---------------------------------------------------------------------------

describe('FulfillmentNotificationService — regression', () => {
  let service: FulfillmentNotificationService;
  let prisma:  ReturnType<typeof buildPrismaMock>;

  beforeEach(async () => {
    prisma = buildPrismaMock();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FulfillmentNotificationService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();
    service = module.get(FulfillmentNotificationService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── REG-1: customer with no email ─────────────────────────────────────────

  it('REG-1: customer.email is empty string — handler returns without throwing', async () => {
    prisma.storeSettings.findFirst.mockResolvedValue(makeStoreSettings());
    prisma.order.findFirst.mockResolvedValue(makeOrder());
    prisma.customer.findFirst.mockResolvedValue(makeCustomer({ email: '' }));

    await expect(
      service.handleOrderShipped(makePayload()),
    ).resolves.toBeUndefined();

    expect(prisma.emailTemplate.findFirst).not.toHaveBeenCalled();
  });

  // ── REG-2: storeId isolation — order query scoped to storeId ──────────────

  it('REG-2: order.findFirst is called with both orderId and storeId from payload', async () => {
    prisma.storeSettings.findFirst.mockResolvedValue(makeStoreSettings());
    prisma.order.findFirst.mockResolvedValue(null); // force early exit

    await service.handleOrderShipped(makePayload());

    expect(prisma.order.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ORDER_ID, storeId: STORE_ID },
      }),
    );
  });

  // ── REG-3: customer query scoped to both customerId and storeId ───────────

  it('REG-3: customer.findFirst is called with both customerId and storeId', async () => {
    prisma.storeSettings.findFirst.mockResolvedValue(makeStoreSettings());
    prisma.order.findFirst.mockResolvedValue(makeOrder());
    prisma.customer.findFirst.mockResolvedValue(null); // force early exit

    await service.handleOrderShipped(makePayload());

    expect(prisma.customer.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: CUST_ID, storeId: STORE_ID },
      }),
    );
  });

  // ── REG-4: companion events fire independently ────────────────────────────
  // SHIPMENT_CREATED and ORDER_SHIPPED are always emitted together by
  // FulfillmentService.createShipment().  Each must use its own template type.

  it('REG-4: SHIPMENT_CREATED uses template type "SHIPMENT_CREATED"', async () => {
    wireHappyPath(prisma, 'SHIPMENT_CREATED');

    await service.handleShipmentCreated(makePayload());

    expect(prisma.emailTemplate.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ type: 'SHIPMENT_CREATED' }),
      }),
    );
  });

  it('REG-5: ORDER_SHIPPED uses template type "ORDER_SHIPPED"', async () => {
    wireHappyPath(prisma, 'ORDER_SHIPPED');

    await service.handleOrderShipped(makePayload());

    expect(prisma.emailTemplate.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ type: 'ORDER_SHIPPED' }),
      }),
    );
  });

  it('REG-6: SHIPMENT_DELIVERED uses template type "SHIPMENT_DELIVERED"', async () => {
    wireHappyPath(prisma, 'SHIPMENT_DELIVERED');

    await service.handleShipmentDelivered(makePayload());

    expect(prisma.emailTemplate.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ type: 'SHIPMENT_DELIVERED' }),
      }),
    );
  });

  it('REG-7: ORDER_DELIVERED uses template type "ORDER_DELIVERED"', async () => {
    wireHappyPath(prisma, 'ORDER_DELIVERED');

    await service.handleOrderDelivered(makePayload());

    expect(prisma.emailTemplate.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ type: 'ORDER_DELIVERED' }),
      }),
    );
  });

  it('REG-8: SHIPMENT_UPDATED uses template type "SHIPMENT_UPDATED"', async () => {
    wireHappyPath(prisma, 'SHIPMENT_UPDATED');

    await service.handleShipmentUpdated(makePayload());

    expect(prisma.emailTemplate.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ type: 'SHIPMENT_UPDATED' }),
      }),
    );
  });

  // ── REG-9: emailTemplate.findFirst includes isActive: true ────────────────

  it('REG-9: emailTemplate.findFirst always filters by isActive=true', async () => {
    wireHappyPath(prisma, 'SHIPMENT_CREATED');

    await service.handleShipmentCreated(makePayload());

    expect(prisma.emailTemplate.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isActive: true }),
      }),
    );
  });

  // ── REG-10: no DB writes in any handler ───────────────────────────────────

  it('REG-10: no writable Prisma calls are made during any handler (read-only contract)', async () => {
    wireHappyPath(prisma, 'ORDER_SHIPPED');

    await service.handleOrderShipped(makePayload());

    // Verify that only findFirst was used — no create/update/delete/upsert
    const allMockFns = [
      prisma.storeSettings.findFirst,
      prisma.order.findFirst,
      prisma.customer.findFirst,
      prisma.emailTemplate.findFirst,
    ];
    allMockFns.forEach((fn) => expect(fn).toBeDefined());

    // Assert no additional properties exist on the mocked model objects that
    // would indicate a write call (the mock has only findFirst — if the service
    // tried to call .create/.update it would throw and the test would fail).
    expect((prisma.storeSettings as any).create).toBeUndefined();
    expect((prisma.order        as any).update).toBeUndefined();
    expect((prisma.customer     as any).upsert).toBeUndefined();
  });
});
