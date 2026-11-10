import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PaymentOrchestratorNotificationService } from '../payment-orchestrator-notification.service';
import { PrismaService } from '@/prisma/prisma.service';
import { EmailService } from '@/shared/email/email.service';
import { OrderConfirmationEmailService } from '../order-confirmation-email.service';
import { VendorOrderNotificationService } from '../../vendors/vendor-order-notification.service';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const STORE_ID   = 'store-1';
const ORDER_ID   = 'order-1';
const CUST_ID    = 'cust-1';
const TX_ID      = 'tx-1';
const SESSION_ID = 'checkout-session-1';

function makeStoreSettings(overrides: Record<string, unknown> = {}) {
  return { orderEmailEnabled: true, currency: 'INR', ...overrides };
}

function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    id:            ORDER_ID,
    orderNumber:   'ORD-2026-000001',
    status:        'PENDING',
    paymentStatus: 'PAID',
    total:         '1999.00',
    paymentMethod: 'razorpay',
    customerId:    CUST_ID,
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
    orderNumber:          'ORD-2026-000001',
    paymentTransactionId: TX_ID,
    amountInPaise:        199900,
    checkoutSessionId:    SESSION_ID,
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
    // ORDER_CREATED's only write: the order-confirmation dedupe claim.
    idempotencyRecord: { create: jest.fn().mockResolvedValue({}), deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
  };
}

// SMTP itself is mocked; OrderConfirmationEmailService has its own spec.
// Vendor emails have their own spec (vendor-order-notification.service.spec.ts).
const vendorNotificationsMock = () => ({ fanOut: jest.fn().mockResolvedValue([]) });

const emailMock = () => ({ send: jest.fn().mockResolvedValue({ status: 'not_configured' }), isConfigured: jest.fn() });

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

describe('PaymentOrchestratorNotificationService — module wiring', () => {
  it('TEST-PO-MOD-1: NestJS TestingModule compiles with PrismaService + ConfigService', async () => {
    const prismaMock = buildPrismaMock();
    const configMock = { get: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentOrchestratorNotificationService,
        OrderConfirmationEmailService,
        { provide: VendorOrderNotificationService, useValue: vendorNotificationsMock() },
        { provide: PrismaService, useValue: prismaMock },
        { provide: ConfigService, useValue: configMock },
        { provide: EmailService, useValue: emailMock() },
      ],
    }).compile();

    const service = module.get(PaymentOrchestratorNotificationService);
    expect(service).toBeInstanceOf(PaymentOrchestratorNotificationService);
  });
});

// ---------------------------------------------------------------------------
// Handler test factory
// Generates the 7 canonical tests for a given handler method + template type.
// ---------------------------------------------------------------------------

function describeHandler(
  handlerName: keyof PaymentOrchestratorNotificationService,
  templateType: string,
  payloadOverrides: Record<string, unknown> = {},
) {
  describe(`PaymentOrchestratorNotificationService — ${handlerName}`, () => {
    let service: PaymentOrchestratorNotificationService;
    let prisma:  ReturnType<typeof buildPrismaMock>;

    beforeEach(async () => {
      prisma = buildPrismaMock();
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          PaymentOrchestratorNotificationService,
          OrderConfirmationEmailService,
          { provide: VendorOrderNotificationService, useValue: vendorNotificationsMock() },
          { provide: PrismaService, useValue: prisma },
          { provide: ConfigService, useValue: { get: jest.fn() } },
          { provide: EmailService, useValue: emailMock() },
        ],
      }).compile();
      service = module.get(PaymentOrchestratorNotificationService);
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
// Generate the 28 handler tests (7 per handler × 4 handlers)
// ---------------------------------------------------------------------------

describeHandler('handleOrderCreated',       'ORDER_CREATED',       {});
describeHandler('handlePaymentCaptured',    'PAYMENT_CAPTURED',    {});
describeHandler('handleCheckoutCompleted',  'CHECKOUT_COMPLETED',  {});
describeHandler('handleInventoryCommitted', 'INVENTORY_COMMITTED', {});

// ---------------------------------------------------------------------------
// Additional regression tests
// ---------------------------------------------------------------------------

describe('PaymentOrchestratorNotificationService — regression', () => {
  let service: PaymentOrchestratorNotificationService;
  let prisma:  ReturnType<typeof buildPrismaMock>;

  beforeEach(async () => {
    prisma = buildPrismaMock();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentOrchestratorNotificationService,
        OrderConfirmationEmailService,
        { provide: VendorOrderNotificationService, useValue: vendorNotificationsMock() },
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: EmailService, useValue: emailMock() },
      ],
    }).compile();
    service = module.get(PaymentOrchestratorNotificationService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── REG-PO-1: customer with empty email ───────────────────────────────────

  it('REG-PO-1: customer.email is empty string — handler returns without throwing', async () => {
    prisma.storeSettings.findFirst.mockResolvedValue(makeStoreSettings());
    prisma.order.findFirst.mockResolvedValue(makeOrder());
    prisma.customer.findFirst.mockResolvedValue(makeCustomer({ email: '' }));

    await expect(
      service.handleOrderCreated(makePayload()),
    ).resolves.toBeUndefined();

    expect(prisma.emailTemplate.findFirst).not.toHaveBeenCalled();
  });

  // ── REG-PO-2: order.findFirst scoped to both orderId and storeId ──────────

  it('REG-PO-2: order.findFirst is called with both orderId and storeId from payload', async () => {
    prisma.storeSettings.findFirst.mockResolvedValue(makeStoreSettings());
    prisma.order.findFirst.mockResolvedValue(null); // force early exit

    await service.handleOrderCreated(makePayload());

    expect(prisma.order.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ORDER_ID, storeId: STORE_ID },
      }),
    );
  });

  // ── REG-PO-3: customer.findFirst scoped to both customerId and storeId ────

  it('REG-PO-3: customer.findFirst is called with both customerId and storeId', async () => {
    prisma.storeSettings.findFirst.mockResolvedValue(makeStoreSettings());
    prisma.order.findFirst.mockResolvedValue(makeOrder());
    prisma.customer.findFirst.mockResolvedValue(null); // force early exit

    await service.handleOrderCreated(makePayload());

    expect(prisma.customer.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: CUST_ID, storeId: STORE_ID },
      }),
    );
  });

  // ── REG-PO-4: each handler uses its own template type ────────────────────

  it('REG-PO-4: ORDER_CREATED uses template type "ORDER_CREATED"', async () => {
    wireHappyPath(prisma, 'ORDER_CREATED');

    await service.handleOrderCreated(makePayload());

    expect(prisma.emailTemplate.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ type: 'ORDER_CREATED' }),
      }),
    );
  });

  it('REG-PO-5: PAYMENT_CAPTURED uses template type "PAYMENT_CAPTURED"', async () => {
    wireHappyPath(prisma, 'PAYMENT_CAPTURED');

    await service.handlePaymentCaptured(makePayload());

    expect(prisma.emailTemplate.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ type: 'PAYMENT_CAPTURED' }),
      }),
    );
  });

  it('REG-PO-6: CHECKOUT_COMPLETED uses template type "CHECKOUT_COMPLETED"', async () => {
    wireHappyPath(prisma, 'CHECKOUT_COMPLETED');

    await service.handleCheckoutCompleted(makePayload());

    expect(prisma.emailTemplate.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ type: 'CHECKOUT_COMPLETED' }),
      }),
    );
  });

  it('REG-PO-7: INVENTORY_COMMITTED uses template type "INVENTORY_COMMITTED"', async () => {
    wireHappyPath(prisma, 'INVENTORY_COMMITTED');

    await service.handleInventoryCommitted(makePayload());

    expect(prisma.emailTemplate.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ type: 'INVENTORY_COMMITTED' }),
      }),
    );
  });

  // ── REG-PO-8: emailTemplate.findFirst always filters by isActive ──────────

  it('REG-PO-8: emailTemplate.findFirst always filters by isActive=true', async () => {
    wireHappyPath(prisma, 'ORDER_CREATED');

    await service.handleOrderCreated(makePayload());

    expect(prisma.emailTemplate.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isActive: true }),
      }),
    );
  });

  // ── REG-PO-9: order select includes paymentStatus and total ──────────────

  it('REG-PO-9: order.findFirst select includes paymentStatus and total fields', async () => {
    prisma.storeSettings.findFirst.mockResolvedValue(makeStoreSettings());
    prisma.order.findFirst.mockResolvedValue(null); // force early exit

    await service.handlePaymentCaptured(makePayload());

    expect(prisma.order.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          paymentStatus: true,
          total:         true,
        }),
      }),
    );
  });

  // ── REG-PO-10: no DB writes in the log-only handlers ──────────────────────
  // (ORDER_CREATED writes exactly one row — its dedupe claim; see
  // order-confirmation-email.service.spec.ts.)

  it('REG-PO-10: no writable Prisma calls are made by the log-only handlers (read-only contract)', async () => {
    wireHappyPath(prisma, 'PAYMENT_CAPTURED');

    await service.handlePaymentCaptured(makePayload());

    // The mock has only findFirst — if the service tried to call .create/.update
    // it would throw and the test would fail automatically.
    expect((prisma.storeSettings as any).create).toBeUndefined();
    expect((prisma.order         as any).update).toBeUndefined();
    expect((prisma.customer      as any).upsert).toBeUndefined();
    expect((prisma.emailTemplate as any).delete).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// ORDER_CREATED fan-out: customer confirmation + vendor notifications.
// COD, verified webhook capture and payment recovery all reach
// completePayment, which persists this one canonical event — so this handler is
// the single trigger point for every order path.
// ---------------------------------------------------------------------------

describe('PaymentOrchestratorNotificationService — ORDER_CREATED vendor notifications', () => {
  function build() {
    const orderConfirmation   = { send: jest.fn().mockResolvedValue('accepted') };
    const vendorNotifications = { fanOut: jest.fn().mockResolvedValue([{ vendorId: 'v1', outcome: 'queued' }]) };
    const service = new PaymentOrchestratorNotificationService(
      buildPrismaMock() as any, { get: jest.fn() } as any, orderConfirmation as any, vendorNotifications as any,
    );
    for (const level of ['log', 'warn', 'error'] as const) {
      jest.spyOn((service as any).logger, level).mockImplementation(() => undefined);
    }
    return { service, orderConfirmation, vendorNotifications };
  }

  it('sends the customer confirmation and the vendor notifications for the same order', async () => {
    const { service, orderConfirmation, vendorNotifications } = build();

    await service.handleOrderCreated(makePayload());

    expect(orderConfirmation.send).toHaveBeenCalledWith(STORE_ID, ORDER_ID);
    expect(vendorNotifications.fanOut).toHaveBeenCalledWith(STORE_ID, ORDER_ID);
  });

  it('a customer-email failure does not stop vendor notifications', async () => {
    const { service, orderConfirmation, vendorNotifications } = build();
    orderConfirmation.send.mockRejectedValue(new Error('db down'));

    await expect(service.handleOrderCreated(makePayload())).resolves.toBeUndefined();
    expect(vendorNotifications.fanOut).toHaveBeenCalledWith(STORE_ID, ORDER_ID);
  });

  it('a failure to queue vendor emails is rethrown so the outbox retries ORDER_CREATED — after the customer email ran', async () => {
    const { service, orderConfirmation, vendorNotifications } = build();
    vendorNotifications.fanOut.mockRejectedValue(new Error('deadlock'));

    await expect(service.handleOrderCreated(makePayload())).rejects.toThrow('deadlock');
    expect(orderConfirmation.send).toHaveBeenCalledTimes(1);
    expect(orderConfirmation.send.mock.invocationCallOrder[0])
      .toBeLessThan(vendorNotifications.fanOut.mock.invocationCallOrder[0]);
  });

  it('the retried ORDER_CREATED does not email the customer twice (confirmation is deduped by its own claim)', async () => {
    const { service, orderConfirmation, vendorNotifications } = build();
    vendorNotifications.fanOut.mockRejectedValueOnce(new Error('deadlock'));
    orderConfirmation.send.mockResolvedValueOnce('accepted').mockResolvedValueOnce('duplicate');

    await expect(service.handleOrderCreated(makePayload())).rejects.toThrow();
    await expect(service.handleOrderCreated(makePayload())).resolves.toBeUndefined();
    expect(await orderConfirmation.send.mock.results[1].value).toBe('duplicate');
  });

  it('only ORDER_CREATED triggers vendor emails — the log-only handlers never do', async () => {
    const { service, vendorNotifications } = build();

    await service.handlePaymentCaptured(makePayload());
    await service.handleCheckoutCompleted(makePayload());
    await service.handleInventoryCommitted(makePayload());

    expect(vendorNotifications.fanOut).not.toHaveBeenCalled();
  });
});
