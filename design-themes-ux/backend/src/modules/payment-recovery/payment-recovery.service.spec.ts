import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PaymentRecoveryService } from './payment-recovery.service';
import { PaymentService } from '../payment/payment.service';
import { PaymentOrchestratorService } from '../payment-orchestrator/payment-orchestrator.service';
import { PrismaService } from '../../prisma/prisma.service';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

const makePrisma = () => ({
  paymentTransaction: {
    findMany: jest.fn().mockResolvedValue([]),
    update:   jest.fn().mockResolvedValue({}),
    count:    jest.fn().mockResolvedValue(0),
  },
  webhookLog: {
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
  },
  paymentActivity: {
    create: jest.fn().mockResolvedValue({}),
  },
});

const makeConfig = () => ({
  get: jest.fn((key: string, defaultVal?: unknown) => {
    const vals: Record<string, unknown> = {
      RECOVERY_CAPTURED_MIN_AGE_SECONDS:   120,
      RECOVERY_AUTHORIZED_TIMEOUT_MINUTES: 30,
      RECOVERY_MAX_RETRIES:                5,
    };
    return key in vals ? vals[key] : defaultVal;
  }),
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PaymentRecoveryService', () => {
  let service:     PaymentRecoveryService;
  let prisma:      ReturnType<typeof makePrisma>;
  let paymentSvc:  { capturePayment: jest.Mock };
  let orchestrator: { completePayment: jest.Mock };

  beforeEach(async () => {
    prisma       = makePrisma();
    paymentSvc   = { capturePayment: jest.fn().mockResolvedValue({}) };
    orchestrator = {
      completePayment: jest.fn().mockResolvedValue({
        orderId: 'ord-1', orderNumber: 'ORD-2026-000001', recovered: false,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentRecoveryService,
        { provide: PrismaService,             useValue: prisma },
        { provide: ConfigService,             useValue: makeConfig() },
        { provide: PaymentService,            useValue: paymentSvc },
        { provide: PaymentOrchestratorService, useValue: orchestrator },
      ],
    }).compile();

    service = module.get(PaymentRecoveryService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── recoverCapturedWithoutOrders ─────────────────────────────────────────

  describe('recoverCapturedWithoutOrders', () => {
    it('calls completePayment for each stale CAPTURED tx without orderId', async () => {
      prisma.paymentTransaction.findMany.mockResolvedValueOnce([
        { id: 'tx-1', storeId: 'store-1', retryCount: 0 },
        { id: 'tx-2', storeId: 'store-1', retryCount: 1 },
      ]);

      await service.recoverCapturedWithoutOrders();

      expect(orchestrator.completePayment).toHaveBeenCalledTimes(2);
      expect(orchestrator.completePayment).toHaveBeenCalledWith('tx-1', 'store-1');
      expect(orchestrator.completePayment).toHaveBeenCalledWith('tx-2', 'store-1');
    });

    it('increments retryCount, sets nextRetryAt, and records activity when completePayment throws', async () => {
      prisma.paymentTransaction.findMany.mockResolvedValueOnce([
        { id: 'tx-1', storeId: 'store-1', retryCount: 0 },
      ]);
      orchestrator.completePayment.mockRejectedValueOnce(new Error('DB timeout'));

      await service.recoverCapturedWithoutOrders();

      expect(prisma.paymentTransaction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'tx-1' },
          data:  expect.objectContaining({
            retryCount:  { increment: 1 },
            nextRetryAt: expect.any(Date),
          }),
        }),
      );
      expect(prisma.paymentActivity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ activityType: 'RECOVERY_ATTEMPTED' }),
        }),
      );
    });

    it('sets nextRetryAt using exponential backoff based on capturedMinAgeSeconds and retryCount', async () => {
      prisma.paymentTransaction.findMany.mockResolvedValueOnce([
        { id: 'tx-1', storeId: 'store-1', retryCount: 1 },
      ]);
      orchestrator.completePayment.mockRejectedValueOnce(new Error('timeout'));
      const before = Date.now();

      await service.recoverCapturedWithoutOrders();

      const call = prisma.paymentTransaction.update.mock.calls[0][0];
      const nextRetryAt: Date = call.data.nextRetryAt;
      // retryCount=1: backoff = 120s * 2^1 = 240s = 240_000 ms
      const expectedBackoffMs = 120 * 1000 * Math.pow(2, 1);
      expect(nextRetryAt.getTime()).toBeGreaterThanOrEqual(before + expectedBackoffMs - 100);
      expect(nextRetryAt.getTime()).toBeLessThanOrEqual(Date.now() + expectedBackoffMs + 100);
    });

    it('continues processing remaining transactions when one fails', async () => {
      prisma.paymentTransaction.findMany.mockResolvedValueOnce([
        { id: 'tx-fail', storeId: 'store-1', retryCount: 0 },
        { id: 'tx-ok',   storeId: 'store-1', retryCount: 0 },
      ]);
      orchestrator.completePayment
        .mockRejectedValueOnce(new Error('timeout'))
        .mockResolvedValueOnce({ orderId: 'ord-2' });

      await service.recoverCapturedWithoutOrders();

      expect(orchestrator.completePayment).toHaveBeenCalledTimes(2);
    });

    it('does not call completePayment when no stale transactions exist', async () => {
      prisma.paymentTransaction.findMany.mockResolvedValueOnce([]);

      await service.recoverCapturedWithoutOrders();

      expect(orchestrator.completePayment).not.toHaveBeenCalled();
    });

    it('logs ALERT when exhausted transactions (retryCount >= max) exist', async () => {
      prisma.paymentTransaction.findMany.mockResolvedValueOnce([]);
      prisma.paymentTransaction.count.mockResolvedValueOnce(3);
      const errorSpy = jest.spyOn((service as any).logger, 'error').mockImplementation(() => {});

      await service.recoverCapturedWithoutOrders();

      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('ALERT'));
    });
  });

  // ─── recoverStuckAuthorized ───────────────────────────────────────────────

  describe('recoverStuckAuthorized', () => {
    it('calls capturePayment with stable idempotency key for stale AUTHORIZED tx', async () => {
      prisma.paymentTransaction.findMany.mockResolvedValueOnce([
        { id: 'tx-auth', storeId: 'store-1', retryCount: 0, gatewayCode: 'razorpay' },
      ]);

      await service.recoverStuckAuthorized();

      expect(paymentSvc.capturePayment).toHaveBeenCalledWith({
        transactionId:  'tx-auth',
        storeId:        'store-1',
        idempotencyKey: 'recovery:capture:tx-auth',
      });
    });

    it('logs a single COUNT-based ALERT when exhausted AUTHORIZED transactions exist', async () => {
      // findMany returns empty (exhausted txs are now filtered by WHERE retryCount < max)
      prisma.paymentTransaction.findMany.mockResolvedValueOnce([]);
      // count query returns 2 exhausted txs
      prisma.paymentTransaction.count.mockResolvedValueOnce(2);
      const errorSpy = jest.spyOn((service as any).logger, 'error').mockImplementation(() => {});

      await service.recoverStuckAuthorized();

      expect(paymentSvc.capturePayment).not.toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('ALERT'));
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('2'));
      // ALERT fires exactly once — not once per exhausted tx
      expect(errorSpy).toHaveBeenCalledTimes(1);
    });

    it('does not emit any ALERT when no exhausted AUTHORIZED transactions exist', async () => {
      prisma.paymentTransaction.findMany.mockResolvedValueOnce([]);
      prisma.paymentTransaction.count.mockResolvedValueOnce(0);
      const errorSpy = jest.spyOn((service as any).logger, 'error').mockImplementation(() => {});

      await service.recoverStuckAuthorized();

      expect(errorSpy).not.toHaveBeenCalled();
    });

    it('increments retryCount and sets nextRetryAt when capturePayment throws', async () => {
      prisma.paymentTransaction.findMany.mockResolvedValueOnce([
        { id: 'tx-auth', storeId: 'store-1', retryCount: 1, gatewayCode: 'razorpay' },
      ]);
      paymentSvc.capturePayment.mockRejectedValueOnce(new Error('gateway down'));

      await service.recoverStuckAuthorized();

      expect(prisma.paymentTransaction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'tx-auth' },
          data:  expect.objectContaining({
            retryCount:  { increment: 1 },
            nextRetryAt: expect.any(Date),
          }),
        }),
      );
    });
  });

  // ─── resolveStaleWebhookLogs ──────────────────────────────────────────────

  describe('resolveStaleWebhookLogs', () => {
    it('marks stale PENDING webhook logs as FAILED', async () => {
      prisma.webhookLog.updateMany.mockResolvedValueOnce({ count: 2 });
      const warnSpy = jest.spyOn((service as any).logger, 'warn').mockImplementation(() => {});

      await service.resolveStaleWebhookLogs();

      expect(prisma.webhookLog.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'PENDING' }),
          data:  expect.objectContaining({ status: 'FAILED' }),
        }),
      );
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('2'));
    });

    it('does not warn when no stale logs are found', async () => {
      prisma.webhookLog.updateMany.mockResolvedValueOnce({ count: 0 });
      const warnSpy = jest.spyOn((service as any).logger, 'warn').mockImplementation(() => {});

      await service.resolveStaleWebhookLogs();

      expect(warnSpy).not.toHaveBeenCalled();
    });
  });
});
