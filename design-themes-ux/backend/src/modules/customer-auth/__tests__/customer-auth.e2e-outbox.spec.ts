import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OutboxEventStatus } from '@prisma/client';
import { CustomerAuthService } from '../customer-auth.service';
import { CustomerAuthNotificationService } from '../customer-auth-notification.service';
import { OutboxHelperService } from '@/shared/outbox/outbox-helper.service';
import { OutboxProcessorService } from '@/modules/outbox/outbox-processor.service';
import { PrismaService } from '@/prisma/prisma.service';

// ---------------------------------------------------------------------------
// FI-1 IM-8 — proves the full chain end-to-end, not just each link in
// isolation:
//
//   CustomerAuthService.register()/forgotPassword()
//     → OutboxHelperService.upsertOutboxEvent()   (real implementation)
//     → OutboxEvent row persisted (status PENDING)
//     → OutboxProcessorService.processBatch()     (real implementation)
//     → EventEmitter2.emitAsync(eventType, payload)   (real @nestjs/event-emitter)
//     → CustomerAuthNotificationService's @OnEvent handler   (real implementation)
//
// PrismaService is mocked (matching the existing convention used by every
// notification-service spec and the outbox-processor's own spec in this
// codebase — see outbox-processor.service.spec.ts); everything else in the
// chain — module wiring, event-emitter dispatch, decorator registration — is
// real, which is the part this test actually needs to prove.
// ---------------------------------------------------------------------------

const STORE_ID = 'store-1';

function buildSharedPrismaMock() {
  // One object standing in for the single PrismaService every layer shares
  // in the real app.
  const outboxRows: any[] = [];

  const txClient = {
    customer: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'cust-1', storeId: STORE_ID, email: 'priya@example.com', name: 'Priya Sharma' }),
    },
    customerCredential: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
    },
    customerVerificationToken: {
      create: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    outboxEvent: {
      // CUSTOMER_REGISTERED uses default dedup — findFirst must return null
      // so upsertOutboxEvent proceeds to create().
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(({ data }: any) => {
        const row = {
          id: `evt-${outboxRows.length + 1}`,
          storeId: data.storeId,
          eventType: data.eventType,
          eventVersion: 1,
          aggregateId: data.aggregateId,
          aggregateType: data.aggregateType,
          payload: data.payload,
          status: data.status,
          attempts: 0,
          maxAttempts: 5,
          nextRetryAt: new Date(),
          processedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        outboxRows.push(row);
        return Promise.resolve(row);
      }),
    },
  };

  return {
    outboxRows,
    prisma: {
      $transaction: jest.fn().mockImplementation(async (cb: any) => cb(txClient)),
      customer: { findFirst: jest.fn(), findUnique: jest.fn() },
      customerCredential: { update: jest.fn() },
      customerRefreshToken: { create: jest.fn().mockResolvedValue({}), updateMany: jest.fn() },
      // OutboxProcessorService's own top-level queries:
      outboxEvent: {
        findMany: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn(),
      },
      $queryRaw: jest.fn(),
      // CustomerAuthNotificationService's own reads:
      storeSettings: { findFirst: jest.fn() },
      emailTemplate: { findFirst: jest.fn() },
    },
  };
}

function makeJwt() {
  return {
    signAsync: jest.fn((_payload: any, options: any) => (
      options.secret === 'refresh-secret'
        ? Promise.resolve('refresh.token.value')
        : Promise.resolve('access.token.value')
    )),
  } as any;
}

function makeConfig() {
  return {
    get: jest.fn((key: string, defaultVal?: unknown) => {
      const vals: Record<string, unknown> = {
        CUSTOMER_JWT_SECRET: 'access-secret',
        CUSTOMER_JWT_EXPIRES_IN: '15m',
        CUSTOMER_JWT_REFRESH_SECRET: 'refresh-secret',
        CUSTOMER_JWT_REFRESH_EXPIRES_DAYS: '30',
        CUSTOMER_PASSWORD_RESET_EXPIRES_MINUTES: '30',
        CUSTOMER_EMAIL_VERIFICATION_EXPIRES_HOURS: '48',
        OUTBOX_BATCH_SIZE: 50,
        OUTBOX_MAX_BACKOFF_MINUTES: 60,
      };
      return key in vals ? vals[key] : defaultVal;
    }),
  } as any;
}

/** Wires claimBatch()'s raw-SQL candidate query + compare-and-swap update to hand back exactly the given rows. */
function wireProcessorToClaim(prisma: ReturnType<typeof buildSharedPrismaMock>['prisma'], rows: any[]) {
  (prisma.$queryRaw as jest.Mock).mockResolvedValue(rows.map((r) => ({ id: r.id })));
  (prisma.outboxEvent.updateMany as jest.Mock).mockResolvedValue({ count: rows.length });
  (prisma.outboxEvent.findMany as jest.Mock).mockResolvedValue(rows);
}

async function buildModule(prisma: ReturnType<typeof buildSharedPrismaMock>['prisma']) {
  const module: TestingModule = await Test.createTestingModule({
    imports: [EventEmitterModule.forRoot({ wildcard: true, global: true })],
    providers: [
      CustomerAuthService,
      CustomerAuthNotificationService,
      OutboxHelperService,
      OutboxProcessorService,
      { provide: PrismaService, useValue: prisma },
      { provide: JwtService, useValue: makeJwt() },
      { provide: ConfigService, useValue: makeConfig() },
    ],
  }).compile();

  // EventEmitterModule registers @OnEvent listeners during its own
  // onModuleInit (via DiscoveryService) — TestingModule.compile() alone does
  // NOT run lifecycle hooks, so without this the event-emitter dispatch in
  // this test would silently have no listeners at all.
  await module.init();

  return {
    customerAuth: module.get(CustomerAuthService),
    notifications: module.get(CustomerAuthNotificationService),
    processor: module.get(OutboxProcessorService),
  };
}

describe('FI-1 E2E — register() → Outbox → OutboxProcessor → notification handler', () => {
  it('a registered customer\'s CUSTOMER_REGISTERED event reaches the real notification handler after the processor dispatches it', async () => {
    const { prisma, outboxRows } = buildSharedPrismaMock();
    prisma.storeSettings.findFirst.mockResolvedValue({ orderEmailEnabled: true, currency: 'INR' });
    prisma.customer.findFirst.mockResolvedValue({ id: 'cust-1', email: 'priya@example.com', name: 'Priya Sharma' });
    prisma.emailTemplate.findFirst.mockResolvedValue({
      subject: 'Welcome!', htmlContent: '<p>Welcome</p>', type: 'CUSTOMER_REGISTERED',
    });

    const { customerAuth, notifications, processor } = await buildModule(prisma);
    const handlerSpy = jest.spyOn(notifications, 'handleCustomerRegistered');

    // 1. register() runs — should persist two PENDING outbox events via the
    //    real OutboxHelperService.
    await customerAuth.register(
      { name: 'Priya Sharma', email: 'priya@example.com', password: 'StrongPass123!' } as any,
      STORE_ID,
    );

    expect(outboxRows).toHaveLength(2);
    const registeredRow = outboxRows.find((r) => r.eventType === 'CUSTOMER_REGISTERED');
    expect(registeredRow).toBeDefined();
    expect(registeredRow.status).toBe(OutboxEventStatus.PENDING);

    // 2. OutboxProcessorService claims and dispatches exactly that row.
    wireProcessorToClaim(prisma, [registeredRow]);
    await processor.processBatch();

    // 3. The real @OnEvent listener actually ran — not just "something in
    //    the payload matched", but the concrete handler method was invoked
    //    with the exact payload the outbox row carried, and it went on to
    //    resolve its own notification context via Prisma.
    expect(handlerSpy).toHaveBeenCalledWith(registeredRow.payload);
    expect(prisma.customer.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'cust-1', storeId: STORE_ID } }),
    );
    expect(prisma.outboxEvent.update).toHaveBeenCalledWith({
      where: { id: registeredRow.id },
      data: { status: OutboxEventStatus.SENT, processedAt: expect.any(Date) },
    });
  });

  it('CUSTOMER_EMAIL_VERIFICATION_REQUESTED (also emitted by register()) reaches its own handler', async () => {
    const { prisma, outboxRows } = buildSharedPrismaMock();
    prisma.storeSettings.findFirst.mockResolvedValue({ orderEmailEnabled: true, currency: 'INR' });
    prisma.customer.findFirst.mockResolvedValue({ id: 'cust-1', email: 'priya@example.com', name: 'Priya Sharma' });
    prisma.emailTemplate.findFirst.mockResolvedValue({
      subject: 'Verify your email', htmlContent: '<p>Verify</p>', type: 'CUSTOMER_EMAIL_VERIFICATION_REQUESTED',
    });

    const { customerAuth, notifications, processor } = await buildModule(prisma);
    const handlerSpy = jest.spyOn(notifications, 'handleEmailVerificationRequested');

    await customerAuth.register(
      { name: 'Priya Sharma', email: 'priya@example.com', password: 'StrongPass123!' } as any,
      STORE_ID,
    );

    const verificationRow = outboxRows.find((r) => r.eventType === 'CUSTOMER_EMAIL_VERIFICATION_REQUESTED');
    expect(verificationRow).toBeDefined();
    // The raw token travels in the outbox payload — never in the DB's own hash column.
    expect(typeof verificationRow.payload.verificationToken).toBe('string');

    wireProcessorToClaim(prisma, [verificationRow]);
    await processor.processBatch();

    expect(handlerSpy).toHaveBeenCalledWith(verificationRow.payload);
  });
});

describe('FI-1 E2E — forgotPassword() → Outbox → OutboxProcessor → notification handler', () => {
  it('a password-reset request reaches the real notification handler after the processor dispatches it', async () => {
    const { prisma, outboxRows } = buildSharedPrismaMock();
    prisma.customer.findFirst.mockResolvedValue({
      id: 'cust-1', email: 'priya@example.com', name: 'Priya Sharma', credential: { id: 'cred-1' },
    });
    prisma.storeSettings.findFirst.mockResolvedValue({ orderEmailEnabled: true, currency: 'INR' });
    prisma.emailTemplate.findFirst.mockResolvedValue({
      subject: 'Reset your password', htmlContent: '<p>Reset</p>', type: 'CUSTOMER_PASSWORD_RESET_REQUESTED',
    });

    const { customerAuth, notifications, processor } = await buildModule(prisma);
    const handlerSpy = jest.spyOn(notifications, 'handlePasswordResetRequested');

    await customerAuth.forgotPassword('priya@example.com', STORE_ID);

    expect(outboxRows).toHaveLength(1);
    const resetRow = outboxRows[0];
    expect(resetRow.eventType).toBe('CUSTOMER_PASSWORD_RESET_REQUESTED');
    expect(resetRow.status).toBe(OutboxEventStatus.PENDING);
    expect(typeof resetRow.payload.resetToken).toBe('string');

    wireProcessorToClaim(prisma, [resetRow]);
    await processor.processBatch();

    expect(handlerSpy).toHaveBeenCalledWith(resetRow.payload);
    expect(prisma.outboxEvent.update).toHaveBeenCalledWith({
      where: { id: resetRow.id },
      data: { status: OutboxEventStatus.SENT, processedAt: expect.any(Date) },
    });
  });

  it('an unknown email never creates an outbox event, so the processor and handler are never invoked', async () => {
    const { prisma, outboxRows } = buildSharedPrismaMock();
    prisma.customer.findFirst.mockResolvedValue(null);

    const { customerAuth, notifications, processor } = await buildModule(prisma);
    const handlerSpy = jest.spyOn(notifications, 'handlePasswordResetRequested');

    await customerAuth.forgotPassword('nobody@example.com', STORE_ID);

    expect(outboxRows).toHaveLength(0);

    wireProcessorToClaim(prisma, []);
    await processor.processBatch();

    expect(handlerSpy).not.toHaveBeenCalled();
  });
});
