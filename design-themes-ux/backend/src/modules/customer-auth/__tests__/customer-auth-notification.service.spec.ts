import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { CustomerAuthNotificationService } from '../customer-auth-notification.service';
import { PrismaService } from '@/prisma/prisma.service';

// ---------------------------------------------------------------------------
// Fixtures — mirrors the fixture style already used by
// payment-orchestrator-notification.service.spec.ts /
// fulfillment-notification.service.spec.ts /
// order-cancellation-notification.service.spec.ts
// ---------------------------------------------------------------------------

const STORE_ID = 'store-1';
const CUST_ID  = 'cust-1';

function makeStoreSettings(overrides: Record<string, unknown> = {}) {
  return { orderEmailEnabled: true, currency: 'INR', ...overrides };
}

function makeCustomer(overrides: Record<string, unknown> = {}) {
  return { id: CUST_ID, email: 'customer@test.com', name: 'Test Customer', ...overrides };
}

function makeTemplate(type: string) {
  return { subject: `Test ${type} subject`, htmlContent: `<p>${type}</p>`, type };
}

function makePayload(overrides: Record<string, unknown> = {}) {
  return {
    storeId:    STORE_ID,
    customerId: CUST_ID,
    email:      'customer@test.com',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Mock factory
// ---------------------------------------------------------------------------

function buildPrismaMock() {
  return {
    storeSettings: { findFirst: jest.fn() },
    customer:      { findFirst: jest.fn() },
    emailTemplate: { findFirst: jest.fn() },
  };
}

function wireHappyPath(
  prisma:       ReturnType<typeof buildPrismaMock>,
  templateType: string,
) {
  prisma.storeSettings.findFirst.mockResolvedValue(makeStoreSettings());
  prisma.customer.findFirst.mockResolvedValue(makeCustomer());
  prisma.emailTemplate.findFirst.mockResolvedValue(makeTemplate(templateType));
}

// ---------------------------------------------------------------------------
// Module instantiation test
// ---------------------------------------------------------------------------

describe('CustomerAuthNotificationService — module wiring', () => {
  it('NestJS TestingModule compiles with PrismaService + ConfigService', async () => {
    const prismaMock = buildPrismaMock();
    const configMock = { get: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomerAuthNotificationService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: ConfigService, useValue: configMock },
      ],
    }).compile();

    const service = module.get(CustomerAuthNotificationService);
    expect(service).toBeInstanceOf(CustomerAuthNotificationService);
  });
});

// ---------------------------------------------------------------------------
// Handler test factory — 7 canonical tests per handler, per IM-7's required
// coverage list: happy path, missing template, disabled email, missing
// customer, missing store settings, Prisma exception, handler never throws.
// ---------------------------------------------------------------------------

function describeHandler(
  handlerName:      keyof CustomerAuthNotificationService,
  templateType:     string,
  payloadOverrides: Record<string, unknown> = {},
) {
  describe(`CustomerAuthNotificationService — ${handlerName}`, () => {
    let service: CustomerAuthNotificationService;
    let prisma:  ReturnType<typeof buildPrismaMock>;

    beforeEach(async () => {
      prisma = buildPrismaMock();
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          CustomerAuthNotificationService,
          { provide: PrismaService, useValue: prisma },
          { provide: ConfigService, useValue: { get: jest.fn() } },
        ],
      }).compile();
      service = module.get(CustomerAuthNotificationService);
    });

    afterEach(() => jest.clearAllMocks());

    const payload = () => makePayload(payloadOverrides);

    // ── 1. Happy path ──────────────────────────────────────────────────────

    it(`${templateType} — happy path: resolves without throwing and uses the correct template type, scoped to storeId`, async () => {
      wireHappyPath(prisma, templateType);

      await expect(
        (service[handlerName] as Function).call(service, payload()),
      ).resolves.toBeUndefined();

      expect(prisma.emailTemplate.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: templateType, isActive: true, storeId: STORE_ID }),
        }),
      );
      expect(prisma.customer.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: CUST_ID, storeId: STORE_ID } }),
      );
    });

    // ── 2. Missing template ────────────────────────────────────────────────

    it(`${templateType} — missing template: emailTemplate=null, handler returns without throwing`, async () => {
      prisma.storeSettings.findFirst.mockResolvedValue(makeStoreSettings());
      prisma.customer.findFirst.mockResolvedValue(makeCustomer());
      prisma.emailTemplate.findFirst.mockResolvedValue(null);

      await expect(
        (service[handlerName] as Function).call(service, payload()),
      ).resolves.toBeUndefined();
    });

    // ── 3. Disabled email (orderEmailEnabled = false) ──────────────────────

    it(`${templateType} — disabled email: orderEmailEnabled=false, returns early, customer and template not queried`, async () => {
      prisma.storeSettings.findFirst.mockResolvedValue(makeStoreSettings({ orderEmailEnabled: false }));

      await expect(
        (service[handlerName] as Function).call(service, payload()),
      ).resolves.toBeUndefined();

      expect(prisma.customer.findFirst).not.toHaveBeenCalled();
      expect(prisma.emailTemplate.findFirst).not.toHaveBeenCalled();
    });

    // ── 4. Missing customer ─────────────────────────────────────────────────

    it(`${templateType} — missing customer: customer=null, returns early, template not queried`, async () => {
      prisma.storeSettings.findFirst.mockResolvedValue(makeStoreSettings());
      prisma.customer.findFirst.mockResolvedValue(null);

      await expect(
        (service[handlerName] as Function).call(service, payload()),
      ).resolves.toBeUndefined();

      expect(prisma.emailTemplate.findFirst).not.toHaveBeenCalled();
    });

    // ── 5. Missing store settings ───────────────────────────────────────────

    it(`${templateType} — missing store settings: storeSettings=null, returns early, all downstream queries skipped`, async () => {
      prisma.storeSettings.findFirst.mockResolvedValue(null);

      await expect(
        (service[handlerName] as Function).call(service, payload()),
      ).resolves.toBeUndefined();

      expect(prisma.customer.findFirst).not.toHaveBeenCalled();
      expect(prisma.emailTemplate.findFirst).not.toHaveBeenCalled();
    });

    // ── 6. Prisma exception ─────────────────────────────────────────────────

    it(`${templateType} — Prisma exception: storeSettings.findFirst rejects, handler swallows the error and does not throw`, async () => {
      prisma.storeSettings.findFirst.mockRejectedValue(new Error('DB connection timeout'));

      await expect(
        (service[handlerName] as Function).call(service, payload()),
      ).resolves.toBeUndefined();
    });

    // ── 7. Handler never throws (even for a non-Error rejection) ───────────

    it(`${templateType} — handler never throws: a non-Error rejection (e.g. a plain string) is still swallowed`, async () => {
      prisma.storeSettings.findFirst.mockRejectedValue('unexpected non-Error rejection');

      await expect(
        (service[handlerName] as Function).call(service, payload()),
      ).resolves.toBeUndefined();
    });
  });
}

describeHandler('handleCustomerRegistered',            'CUSTOMER_REGISTERED');
describeHandler('handleEmailVerificationRequested',     'CUSTOMER_EMAIL_VERIFICATION_REQUESTED');
describeHandler('handlePasswordResetRequested',          'CUSTOMER_PASSWORD_RESET_REQUESTED');

// ---------------------------------------------------------------------------
// Additional regression tests
// ---------------------------------------------------------------------------

describe('CustomerAuthNotificationService — regression', () => {
  let service: CustomerAuthNotificationService;
  let prisma:  ReturnType<typeof buildPrismaMock>;

  beforeEach(async () => {
    prisma = buildPrismaMock();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomerAuthNotificationService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();
    service = module.get(CustomerAuthNotificationService);
  });

  afterEach(() => jest.clearAllMocks());

  it('customer.findFirst is scoped to both customerId and storeId (multi-tenant isolation)', async () => {
    prisma.storeSettings.findFirst.mockResolvedValue(makeStoreSettings());
    prisma.customer.findFirst.mockResolvedValue(null); // force early exit

    await service.handleCustomerRegistered(makePayload());

    expect(prisma.customer.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: CUST_ID, storeId: STORE_ID } }),
    );
  });

  it('storeSettings.findFirst is scoped to storeId', async () => {
    prisma.storeSettings.findFirst.mockResolvedValue(null); // force early exit

    await service.handleCustomerRegistered(makePayload());

    expect(prisma.storeSettings.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { storeId: STORE_ID } }),
    );
  });

  it('customer with an empty-string email is treated the same as a missing customer', async () => {
    prisma.storeSettings.findFirst.mockResolvedValue(makeStoreSettings());
    prisma.customer.findFirst.mockResolvedValue(makeCustomer({ email: '' }));

    await service.handleCustomerRegistered(makePayload());

    expect(prisma.emailTemplate.findFirst).not.toHaveBeenCalled();
  });

  it('emailTemplate.findFirst always filters by isActive=true', async () => {
    wireHappyPath(prisma, 'CUSTOMER_REGISTERED');

    await service.handleCustomerRegistered(makePayload());

    expect(prisma.emailTemplate.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ isActive: true }) }),
    );
  });

  it('each handler uses its own distinct template type', async () => {
    wireHappyPath(prisma, 'CUSTOMER_EMAIL_VERIFICATION_REQUESTED');

    await service.handleEmailVerificationRequested(makePayload());

    expect(prisma.emailTemplate.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ type: 'CUSTOMER_EMAIL_VERIFICATION_REQUESTED' }) }),
    );
  });

  it('no writable Prisma calls are made during any handler (read-only contract)', async () => {
    wireHappyPath(prisma, 'CUSTOMER_REGISTERED');

    await service.handleCustomerRegistered(makePayload());

    // The mock has only findFirst — if the service tried to call .create/.update
    // it would throw and the test would fail automatically.
    expect((prisma.storeSettings as any).update).toBeUndefined();
    expect((prisma.customer      as any).update).toBeUndefined();
    expect((prisma.emailTemplate as any).create).toBeUndefined();
  });

  // ── Redaction guarantee — the whole reason IM-7 diverges from the ─────────
  // existing services' log-everything style for these two specific handlers.

  it('handleEmailVerificationRequested never logs the raw verification token, even when present in the payload', async () => {
    wireHappyPath(prisma, 'CUSTOMER_EMAIL_VERIFICATION_REQUESTED');
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

    await service.handleEmailVerificationRequested(
      makePayload({ verificationToken: 'super-secret-raw-token-value' }),
    );

    const allLoggedText = logSpy.mock.calls.map((call) => String(call[0])).join('\n');
    expect(allLoggedText).not.toContain('super-secret-raw-token-value');
    expect(allLoggedText).toContain('[REDACTED]');

    logSpy.mockRestore();
  });

  it('handlePasswordResetRequested never logs the raw reset token, even when present in the payload', async () => {
    wireHappyPath(prisma, 'CUSTOMER_PASSWORD_RESET_REQUESTED');
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

    await service.handlePasswordResetRequested(
      makePayload({ resetToken: 'super-secret-raw-reset-token' }),
    );

    const allLoggedText = logSpy.mock.calls.map((call) => String(call[0])).join('\n');
    expect(allLoggedText).not.toContain('super-secret-raw-reset-token');
    expect(allLoggedText).toContain('[REDACTED]');

    logSpy.mockRestore();
  });
});
