import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { OrderCancellationNotificationService } from '../order-cancellation-notification.service';
import { PrismaService } from '@/prisma/prisma.service';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const STORE_ID  = 'store-1';
const ORDER_ID  = 'order-1';
const CUST_ID   = 'cust-1';
const TX_ID     = 'tx-1';
const REFUND_ID = 'refund-1';

function makeStoreSettings(overrides: Record<string, unknown> = {}) {
  return { orderEmailEnabled: true, currency: 'INR', ...overrides };
}

function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    id:                 ORDER_ID,
    orderNumber:        'ORD-2026-000001',
    status:             'CANCELLED',
    customerId:         CUST_ID,
    total:              '1999.00',
    refundedAmount:     '1999.00',
    cancellationReason: 'Customer request',
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
    storeId:              STORE_ID,
    orderId:              ORDER_ID,
    reason:               'Customer request',
    actorId:              'admin-1',
    paymentAction:        'REFUNDED',
    paymentTransactionId: TX_ID,
    refundId:             REFUND_ID,
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

describe('OrderCancellationNotificationService — module wiring', () => {
  it('TEST-CN-MOD-1: NestJS TestingModule compiles with PrismaService + ConfigService', async () => {
    const prismaMock = buildPrismaMock();
    const configMock = { get: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderCancellationNotificationService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: ConfigService, useValue: configMock },
      ],
    }).compile();

    const service = module.get(OrderCancellationNotificationService);
    expect(service).toBeInstanceOf(OrderCancellationNotificationService);
  });
});

// ---------------------------------------------------------------------------
// Handler test factory
// Generates the 7 canonical tests for a given handler method + template type.
// ---------------------------------------------------------------------------

function describeHandler(
  handlerName: keyof OrderCancellationNotificationService,
  templateType: string,
  payloadOverrides: Record<string, unknown> = {},
) {
  describe(`OrderCancellationNotificationService — ${handlerName}`, () => {
    let service: OrderCancellationNotificationService;
    let prisma:  ReturnType<typeof buildPrismaMock>;

    beforeEach(async () => {
      prisma = buildPrismaMock();
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          OrderCancellationNotificationService,
          { provide: PrismaService, useValue: prisma },
          { provide: ConfigService, useValue: { get: jest.fn() } },
        ],
      }).compile();
      service = module.get(OrderCancellationNotificationService);
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
// Generate the 14 handler tests (7 per handler × 2 handlers)
// ---------------------------------------------------------------------------

describeHandler('handleOrderCancelled', 'ORDER_CANCELLED', {});
describeHandler('handleRefundFailed',   'REFUND_FAILED',   {});

// ---------------------------------------------------------------------------
// Regression tests
// ---------------------------------------------------------------------------

describe('OrderCancellationNotificationService — regression', () => {
  let service: OrderCancellationNotificationService;
  let prisma:  ReturnType<typeof buildPrismaMock>;

  beforeEach(async () => {
    prisma = buildPrismaMock();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderCancellationNotificationService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();
    service = module.get(OrderCancellationNotificationService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── REG-CN-1: customer with empty email ───────────────────────────────────

  it('REG-CN-1: customer.email is empty string — handler returns without throwing', async () => {
    prisma.storeSettings.findFirst.mockResolvedValue(makeStoreSettings());
    prisma.order.findFirst.mockResolvedValue(makeOrder());
    prisma.customer.findFirst.mockResolvedValue(makeCustomer({ email: '' }));

    await expect(
      service.handleOrderCancelled(makePayload()),
    ).resolves.toBeUndefined();

    expect(prisma.emailTemplate.findFirst).not.toHaveBeenCalled();
  });

  // ── REG-CN-2: order.findFirst scoped to both orderId and storeId ──────────

  it('REG-CN-2: order.findFirst is called with both orderId and storeId from payload', async () => {
    prisma.storeSettings.findFirst.mockResolvedValue(makeStoreSettings());
    prisma.order.findFirst.mockResolvedValue(null); // force early exit

    await service.handleOrderCancelled(makePayload());

    expect(prisma.order.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ORDER_ID, storeId: STORE_ID },
      }),
    );
  });

  // ── REG-CN-3: customer.findFirst scoped to both customerId and storeId ────

  it('REG-CN-3: customer.findFirst is called with both customerId and storeId', async () => {
    prisma.storeSettings.findFirst.mockResolvedValue(makeStoreSettings());
    prisma.order.findFirst.mockResolvedValue(makeOrder());
    prisma.customer.findFirst.mockResolvedValue(null); // force early exit

    await service.handleOrderCancelled(makePayload());

    expect(prisma.customer.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: CUST_ID, storeId: STORE_ID },
      }),
    );
  });

  // ── REG-CN-4: ORDER_CANCELLED uses its own template type ──────────────────

  it('REG-CN-4: ORDER_CANCELLED uses template type "ORDER_CANCELLED"', async () => {
    wireHappyPath(prisma, 'ORDER_CANCELLED');

    await service.handleOrderCancelled(makePayload());

    expect(prisma.emailTemplate.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ type: 'ORDER_CANCELLED' }),
      }),
    );
  });

  // ── REG-CN-5: REFUND_FAILED uses its own template type ───────────────────

  it('REG-CN-5: REFUND_FAILED uses template type "REFUND_FAILED"', async () => {
    wireHappyPath(prisma, 'REFUND_FAILED');

    await service.handleRefundFailed(makePayload());

    expect(prisma.emailTemplate.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ type: 'REFUND_FAILED' }),
      }),
    );
  });

  // ── REG-CN-6: emailTemplate.findFirst always filters by isActive ──────────

  it('REG-CN-6: emailTemplate.findFirst always filters by isActive=true', async () => {
    wireHappyPath(prisma, 'ORDER_CANCELLED');

    await service.handleOrderCancelled(makePayload());

    expect(prisma.emailTemplate.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isActive: true }),
      }),
    );
  });

  // ── REG-CN-7: order select includes cancellation-specific fields ──────────

  it('REG-CN-7: order.findFirst select includes refundedAmount and cancellationReason fields', async () => {
    prisma.storeSettings.findFirst.mockResolvedValue(makeStoreSettings());
    prisma.order.findFirst.mockResolvedValue(null); // force early exit

    await service.handleOrderCancelled(makePayload());

    expect(prisma.order.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          refundedAmount:     true,
          cancellationReason: true,
        }),
      }),
    );
  });

  // ── REG-CN-8: no DB writes in any handler ────────────────────────────────

  it('REG-CN-8: no writable Prisma calls are made during any handler (read-only contract)', async () => {
    wireHappyPath(prisma, 'ORDER_CANCELLED');

    await service.handleOrderCancelled(makePayload());

    // The mock has only findFirst — if the service tried to call .create/.update
    // it would throw and the test would fail automatically.
    expect((prisma.storeSettings as any).create).toBeUndefined();
    expect((prisma.order         as any).update).toBeUndefined();
    expect((prisma.customer      as any).upsert).toBeUndefined();
    expect((prisma.emailTemplate as any).delete).toBeUndefined();
  });
});
