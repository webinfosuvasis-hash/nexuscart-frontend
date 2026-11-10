import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  PaymentActorType,
  PaymentActivityType,
  PaymentRefund,
  PaymentTransaction,
  PaymentTxStatus,
} from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

import { PrismaService } from '../../prisma/prisma.service';
import { PaymentGatewayRegistry } from './gateways/payment-gateway-registry.service';
import { PaymentStateValidatorService } from './state/payment-state-validator.service';
import {
  GatewayInitializationException,
  IdempotencyViolationException,
  InvalidPaymentTransitionException,
  PaymentAlreadyRefundedException,
} from './exceptions/payment.exceptions';
import { PaymentService } from './payment.service';
import { PaymentGateway } from './gateways/payment-gateway.interface';
import {
  CaptureResult,
  PaymentGatewayResult,
  RefundResult,
} from './types/payment.types';

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

function makeTx(overrides: Partial<PaymentTransaction> = {}): PaymentTransaction {
  return {
    id: 'tx_001',
    storeId: 'store_001',
    checkoutSessionId: 'cs_001',
    gatewayCode: 'mock',
    status: PaymentTxStatus.PENDING,
    amountInPaise: 50000,
    currency: 'INR',
    attemptNumber: 1,
    gatewayOrderId: null,
    gatewayPaymentId: null,
    gatewayIntentId: null,
    gatewayReferenceId: null,
    gatewaySignature: null,
    capturedPaise: null,
    checkoutSnapshot: null,
    orderId: null,
    supersededById: null,
    paymentMethodId: null,
    authorizedAt: null,
    capturedAt: null,
    failedAt: null,
    cancelledAt: null,
    expiredAt: null,
    refundedAt: null,
    retryCount: 0,
    nextRetryAt: null,
    traceId: null,
    spanId: null,
    correlationId: null,
    requestId: null,
    createdAt: new Date('2026-07-01T10:00:00Z'),
    updatedAt: new Date('2026-07-01T10:00:00Z'),
    ...overrides,
  };
}

function makeRefund(overrides: Partial<PaymentRefund> = {}): PaymentRefund {
  return {
    id: 'refund_001',
    paymentTransactionId: 'tx_001',
    orderId: null,
    storeId: 'store_001',
    amountInPaise: 50000,
    reason: null,
    gatewayRefundId: 'gw_refund_001',
    status: 'COMPLETED',
    initiatedById: null,
    processedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeGatewayResult(overrides: Partial<PaymentGatewayResult> = {}): PaymentGatewayResult {
  return {
    success: true,
    gatewayCode: 'mock',
    gatewayOrderId: 'mock_order_001',
    gatewayPaymentId: 'mock_pay_001',
    ...overrides,
  };
}

function makeCaptureResult(overrides: Partial<CaptureResult> = {}): CaptureResult {
  return {
    success: true,
    gatewayCode: 'mock',
    capturedPaise: 50000,
    capturedAt: new Date(),
    gatewayPaymentId: 'mock_pay_001',
    ...overrides,
  };
}

function makeRefundResult(overrides: Partial<RefundResult> = {}): RefundResult {
  return {
    success: true,
    gatewayCode: 'mock',
    gatewayRefundId: 'gw_refund_001',
    refundedPaise: 50000,
    refundedAt: new Date(),
    ...overrides,
  };
}

function makeP2002(): PrismaClientKnownRequestError {
  return new PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '5.9.1',
  });
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

describe('PaymentService', () => {
  let service: PaymentService;
  let prisma: {
    paymentTransaction: {
      create: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
      findMany: jest.Mock;
    };
    paymentActivity: { create: jest.Mock };
    paymentRefund: {
      create: jest.Mock;
      update: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
    };
    idempotencyRecord: { findUnique: jest.Mock; create: jest.Mock };
    $transaction: jest.Mock;
  };

  let mockGateway: jest.Mocked<PaymentGateway>;
  let registry: { resolve: jest.Mock };

  beforeEach(async () => {
    mockGateway = {
      capabilities: {
        gatewayCode: 'mock',
        displayName: 'Mock',
        supports: new Set(),
        isLiveCapable: false,
        requiresWebhook: false,
      },
      initiatePayment: jest.fn(),
      capturePayment: jest.fn(),
      refundPayment: jest.fn(),
      verifyPayment: jest.fn(),
      cancelPayment: jest.fn(),
    };

    registry = { resolve: jest.fn().mockReturnValue(mockGateway) };

    prisma = {
      paymentTransaction: {
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findMany: jest.fn(),
      },
      paymentActivity: { create: jest.fn().mockResolvedValue(undefined) },
      paymentRefund: {
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
      },
      idempotencyRecord: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(undefined),
      },
      $transaction: jest.fn().mockImplementation(async (fn: any, _opts?: any) => {
        if (typeof fn === 'function') return fn(prisma);
        return Promise.all(fn as any[]);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        { provide: PrismaService, useValue: prisma },
        { provide: PaymentGatewayRegistry, useValue: registry },
        PaymentStateValidatorService,
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
  });

  afterEach(() => jest.clearAllMocks());

  // =========================================================================
  // createPaymentAttempt
  // =========================================================================

  describe('createPaymentAttempt()', () => {
    const input = {
      checkoutSessionId: 'cs_001',
      storeId: 'store_001',
      gatewayCode: 'mock',
      amountInPaise: 50000,
      idempotencyKey: 'idem_001',
    };

    it('creates a PENDING transaction, records PAYMENT_INITIATED, sets idempotency', async () => {
      const tx = makeTx();
      prisma.paymentTransaction.create.mockResolvedValue(tx);

      const result = await service.createPaymentAttempt(input);

      expect(result).toBe(tx);
      expect(prisma.paymentTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            storeId: 'store_001',
            checkoutSessionId: 'cs_001',
            gatewayCode: 'mock',
            amountInPaise: 50000,
            currency: 'INR',
          }),
        }),
      );
      expect(prisma.paymentActivity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            activityType: PaymentActivityType.PAYMENT_INITIATED,
            actorType: PaymentActorType.SYSTEM,
          }),
        }),
      );
      expect(prisma.idempotencyRecord.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            key: `payment:create:cs_001:idem_001`,
          }),
        }),
      );
    });

    it('resolves the gateway before creating the transaction (catches bad gatewayCode early)', () => {
      registry.resolve.mockImplementation(() => {
        throw new Error('unknown gateway');
      });
      return expect(service.createPaymentAttempt(input)).rejects.toThrow('unknown gateway');
    });

    it('returns the existing transaction on idempotent re-call', async () => {
      const existingTx = makeTx({ status: PaymentTxStatus.GATEWAY_CREATED });
      prisma.idempotencyRecord.findUnique.mockResolvedValue({
        key: 'payment:create:cs_001:idem_001',
        storeId: 'store_001',
        expiresAt: new Date(Date.now() + 60_000),
        id: 'idem_record_1',
        createdAt: new Date(),
      });
      prisma.paymentTransaction.findFirst.mockResolvedValue(existingTx);

      const result = await service.createPaymentAttempt(input);

      expect(result).toBe(existingTx);
      expect(prisma.paymentTransaction.create).not.toHaveBeenCalled();
    });

    it.each([PaymentTxStatus.FAILED, PaymentTxStatus.CANCELLED, PaymentTxStatus.EXPIRED])(
      'opens a new, chained attempt when the previous one is %s',
      async (status) => {
        const deadTx = makeTx({ id: 'tx_dead', status, attemptNumber: 1 });
        const freshTx = makeTx({ id: 'tx_fresh', attemptNumber: 2 });
        prisma.idempotencyRecord.findUnique.mockResolvedValue({
          key: 'payment:create:cs_001:idem_001',
          storeId: 'store_001',
          expiresAt: new Date(Date.now() + 60_000),
          id: 'idem_record_1',
          createdAt: new Date(),
        });
        prisma.paymentTransaction.findFirst.mockResolvedValue(deadTx);
        prisma.paymentTransaction.create.mockResolvedValue(freshTx);

        const result = await service.createPaymentAttempt(input);

        expect(result).toBe(freshTx);
        expect(prisma.paymentTransaction.create).toHaveBeenCalledWith(
          expect.objectContaining({ data: expect.objectContaining({ attemptNumber: 2 }) }),
        );
        expect(prisma.paymentTransaction.update).toHaveBeenCalledWith({
          where: { id: 'tx_dead' },
          data: { supersededById: 'tx_fresh' },
        });
      },
    );

    it('defaults currency to INR when not provided', async () => {
      const tx = makeTx();
      prisma.paymentTransaction.create.mockResolvedValue(tx);

      await service.createPaymentAttempt(input);

      expect(prisma.paymentTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ currency: 'INR' }),
        }),
      );
    });
  });

  // =========================================================================
  // startPayment
  // =========================================================================

  describe('startPayment()', () => {
    it('initiates payment and transitions PENDING → GATEWAY_CREATED', async () => {
      const pendingTx = makeTx({ status: PaymentTxStatus.PENDING });
      const updatedTx = makeTx({
        status: PaymentTxStatus.GATEWAY_CREATED,
        gatewayOrderId: 'mock_order_001',
      });
      prisma.paymentTransaction.findFirst
        .mockResolvedValueOnce(pendingTx)
        .mockResolvedValueOnce(updatedTx);
      mockGateway.initiatePayment.mockResolvedValue(makeGatewayResult());

      const result = await service.startPayment('tx_001', 'store_001', 'idem_start_001');

      expect(result.transaction.status).toBe(PaymentTxStatus.GATEWAY_CREATED);
      expect(result.gatewayOrderId).toBe('mock_order_001');
      expect(prisma.paymentTransaction.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: PaymentTxStatus.PENDING }),
          data: expect.objectContaining({ status: PaymentTxStatus.GATEWAY_CREATED }),
        }),
      );
      expect(prisma.paymentActivity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ activityType: PaymentActivityType.GATEWAY_ORDER_CREATED }),
        }),
      );
    });

    it('is idempotent: returns existing GATEWAY_CREATED transaction without gateway call', async () => {
      const gatewayCreatedTx = makeTx({
        status: PaymentTxStatus.GATEWAY_CREATED,
        gatewayOrderId: 'mock_order_001',
        gatewayPaymentId: 'mock_pay_001',
      });
      prisma.paymentTransaction.findFirst.mockResolvedValue(gatewayCreatedTx);

      const result = await service.startPayment('tx_001', 'store_001', 'idem_start_001');

      expect(result.transaction).toBe(gatewayCreatedTx);
      expect(mockGateway.initiatePayment).not.toHaveBeenCalled();
      expect(prisma.paymentTransaction.updateMany).not.toHaveBeenCalled();
    });

    it('transitions to FAILED and returns failed transaction when gateway rejects', async () => {
      const pendingTx = makeTx({ status: PaymentTxStatus.PENDING });
      const failedTx = makeTx({ status: PaymentTxStatus.FAILED, failedAt: new Date() });
      prisma.paymentTransaction.findFirst
        .mockResolvedValueOnce(pendingTx)
        .mockResolvedValueOnce(failedTx);
      mockGateway.initiatePayment.mockResolvedValue(
        makeGatewayResult({
          success: false,
          error: { code: 'GW_ERROR', message: 'Gateway error', isRetryable: false },
        }),
      );

      const result = await service.startPayment('tx_001', 'store_001', 'idem_start_001');

      expect(result.transaction.status).toBe(PaymentTxStatus.FAILED);
      expect(prisma.paymentTransaction.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: PaymentTxStatus.FAILED }),
        }),
      );
      expect(prisma.paymentActivity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ activityType: PaymentActivityType.PAYMENT_FAILED }),
        }),
      );
    });

    it('throws NotFoundException when transaction does not exist', async () => {
      prisma.paymentTransaction.findFirst.mockResolvedValue(null);

      await expect(service.startPayment('bad_id', 'store_001', 'idem_001')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws InvalidPaymentTransitionException for invalid state (CAPTURED → GATEWAY_CREATED)', async () => {
      const capturedTx = makeTx({ status: PaymentTxStatus.CAPTURED });
      prisma.paymentTransaction.findFirst.mockResolvedValue(capturedTx);

      await expect(service.startPayment('tx_001', 'store_001', 'idem_001')).rejects.toThrow(
        InvalidPaymentTransitionException,
      );
    });

    it('throws ConflictException when optimistic lock fails and status changed to unexpected value', async () => {
      const pendingTx = makeTx({ status: PaymentTxStatus.PENDING });
      const cancelledTx = makeTx({ status: PaymentTxStatus.CANCELLED });
      prisma.paymentTransaction.findFirst
        .mockResolvedValueOnce(pendingTx)
        .mockResolvedValueOnce(cancelledTx);
      prisma.paymentTransaction.updateMany.mockResolvedValue({ count: 0 });
      mockGateway.initiatePayment.mockResolvedValue(makeGatewayResult());

      await expect(service.startPayment('tx_001', 'store_001', 'idem_001')).rejects.toThrow(
        ConflictException,
      );
    });

    it('P1-3: transitions to FAILED and throws GatewayInitializationException when gateway throws', async () => {
      const pendingTx = makeTx({ status: PaymentTxStatus.PENDING });
      const failedTx = makeTx({ status: PaymentTxStatus.FAILED, failedAt: new Date() });
      prisma.paymentTransaction.findFirst
        .mockResolvedValueOnce(pendingTx)
        .mockResolvedValueOnce(failedTx);
      mockGateway.initiatePayment.mockRejectedValue(new Error('Network timeout'));

      await expect(service.startPayment('tx_001', 'store_001', 'idem_001')).rejects.toThrow(
        GatewayInitializationException,
      );

      expect(prisma.paymentTransaction.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: PaymentTxStatus.FAILED }),
        }),
      );
      expect(prisma.paymentActivity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ activityType: PaymentActivityType.PAYMENT_FAILED }),
        }),
      );
    });
  });

  // =========================================================================
  // authorizePayment
  // =========================================================================

  describe('authorizePayment()', () => {
    const input = {
      transactionId: 'tx_001',
      storeId: 'store_001',
      gatewayPaymentId: 'rzp_pay_001',
      gatewaySignature: 'sig_abc',
    };

    it('transitions GATEWAY_CREATED → AUTHORIZED and records activity', async () => {
      const gwTx = makeTx({
        status: PaymentTxStatus.GATEWAY_CREATED,
        gatewayOrderId: 'rzp_order_001',
      });
      const authorizedTx = makeTx({
        status: PaymentTxStatus.AUTHORIZED,
        gatewayPaymentId: 'rzp_pay_001',
        authorizedAt: new Date(),
      });
      prisma.paymentTransaction.findFirst
        .mockResolvedValueOnce(gwTx)
        .mockResolvedValueOnce(authorizedTx);

      const result = await service.authorizePayment(input);

      expect(result.status).toBe(PaymentTxStatus.AUTHORIZED);
      expect(prisma.paymentTransaction.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: PaymentTxStatus.GATEWAY_CREATED }),
          data: expect.objectContaining({ status: PaymentTxStatus.AUTHORIZED }),
        }),
      );
      expect(prisma.paymentActivity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ activityType: PaymentActivityType.PAYMENT_AUTHORIZED }),
        }),
      );
    });

    it('is idempotent: returns existing AUTHORIZED transaction without DB write', async () => {
      const authorizedTx = makeTx({ status: PaymentTxStatus.AUTHORIZED });
      prisma.paymentTransaction.findFirst.mockResolvedValue(authorizedTx);

      const result = await service.authorizePayment(input);

      expect(result).toBe(authorizedTx);
      expect(prisma.paymentTransaction.updateMany).not.toHaveBeenCalled();
    });

    it('throws InvalidPaymentTransitionException for PENDING → AUTHORIZED (invalid)', async () => {
      const pendingTx = makeTx({ status: PaymentTxStatus.PENDING });
      prisma.paymentTransaction.findFirst.mockResolvedValue(pendingTx);

      await expect(service.authorizePayment(input)).rejects.toThrow(
        InvalidPaymentTransitionException,
      );
    });
  });

  // =========================================================================
  // capturePayment
  // =========================================================================

  describe('capturePayment()', () => {
    const input = { transactionId: 'tx_001', storeId: 'store_001', idempotencyKey: 'idem_cap_001' };

    it('transitions AUTHORIZED → CAPTURED and records activity', async () => {
      const authorizedTx = makeTx({
        status: PaymentTxStatus.AUTHORIZED,
        gatewayPaymentId: 'mock_pay_001',
      });
      const capturedTx = makeTx({
        status: PaymentTxStatus.CAPTURED,
        capturedPaise: 50000,
        capturedAt: new Date(),
      });
      prisma.paymentTransaction.findFirst
        .mockResolvedValueOnce(authorizedTx)
        .mockResolvedValueOnce(capturedTx);
      mockGateway.capturePayment.mockResolvedValue(makeCaptureResult());

      const result = await service.capturePayment(input);

      expect(result.status).toBe(PaymentTxStatus.CAPTURED);
      expect(result.capturedPaise).toBe(50000);
      expect(prisma.paymentActivity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ activityType: PaymentActivityType.PAYMENT_CAPTURED }),
        }),
      );
    });

    it('is idempotent: returns already-CAPTURED transaction without gateway call', async () => {
      const capturedTx = makeTx({ status: PaymentTxStatus.CAPTURED, capturedPaise: 50000 });
      prisma.paymentTransaction.findFirst.mockResolvedValue(capturedTx);

      const result = await service.capturePayment(input);

      expect(result).toBe(capturedTx);
      expect(mockGateway.capturePayment).not.toHaveBeenCalled();
    });

    it('guards via idempotency record: returns CAPTURED tx without gateway call when idem hit', async () => {
      const authorizedTx = makeTx({ status: PaymentTxStatus.AUTHORIZED });
      const capturedTx = makeTx({ status: PaymentTxStatus.CAPTURED });
      prisma.paymentTransaction.findFirst
        .mockResolvedValueOnce(authorizedTx) // initial load
        .mockResolvedValueOnce(capturedTx);  // P0-2 fresh check after idem hit
      prisma.idempotencyRecord.findUnique.mockResolvedValue({
        id: 'rec_1',
        key: `payment:capture:tx_001:idem_cap_001`,
        storeId: 'store_001',
        expiresAt: new Date(Date.now() + 60_000),
        createdAt: new Date(),
      });

      const result = await service.capturePayment(input);

      expect(result).toBe(capturedTx);
      expect(mockGateway.capturePayment).not.toHaveBeenCalled();
    });

    it('records PAYMENT_FAILED activity when gateway capture fails, without transitioning status', async () => {
      const authorizedTx = makeTx({ status: PaymentTxStatus.AUTHORIZED });
      prisma.paymentTransaction.findFirst
        .mockResolvedValueOnce(authorizedTx)
        .mockResolvedValueOnce(authorizedTx); // re-fetch after failure
      mockGateway.capturePayment.mockResolvedValue(
        makeCaptureResult({
          success: false,
          error: { code: 'CAP_FAIL', message: 'capture failed', isRetryable: true },
        }),
      );

      const result = await service.capturePayment(input);

      expect(result.status).toBe(PaymentTxStatus.AUTHORIZED);
      expect(prisma.paymentTransaction.updateMany).not.toHaveBeenCalled();
      expect(prisma.paymentActivity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ activityType: PaymentActivityType.PAYMENT_FAILED }),
        }),
      );
    });

    it('also captures from GATEWAY_CREATED (direct capture flow)', async () => {
      const gwTx = makeTx({ status: PaymentTxStatus.GATEWAY_CREATED, gatewayPaymentId: 'p01' });
      const capturedTx = makeTx({ status: PaymentTxStatus.CAPTURED, capturedPaise: 50000 });
      prisma.paymentTransaction.findFirst
        .mockResolvedValueOnce(gwTx)
        .mockResolvedValueOnce(capturedTx);
      mockGateway.capturePayment.mockResolvedValue(makeCaptureResult());

      const result = await service.capturePayment(input);

      expect(result.status).toBe(PaymentTxStatus.CAPTURED);
    });

    it('P0-2: retries gateway call when idem record exists but tx is still AUTHORIZED', async () => {
      const authorizedTx = makeTx({ status: PaymentTxStatus.AUTHORIZED });
      const capturedTx = makeTx({ status: PaymentTxStatus.CAPTURED, capturedPaise: 50000 });
      prisma.paymentTransaction.findFirst
        .mockResolvedValueOnce(authorizedTx) // initial load
        .mockResolvedValueOnce(authorizedTx) // P0-2 fresh check — still AUTHORIZED, fall through
        .mockResolvedValueOnce(capturedTx);  // re-fetch after successful capture
      prisma.idempotencyRecord.findUnique.mockResolvedValue({
        id: 'rec_1',
        key: `payment:capture:tx_001:idem_cap_001`,
        storeId: 'store_001',
        expiresAt: new Date(Date.now() + 60_000),
        createdAt: new Date(),
      });
      mockGateway.capturePayment.mockResolvedValue(makeCaptureResult());

      const result = await service.capturePayment(input);

      expect(mockGateway.capturePayment).toHaveBeenCalledTimes(1);
      expect(result.status).toBe(PaymentTxStatus.CAPTURED);
    });

    it('P1-2: handles concurrent idem key creation (P2002) — returns CAPTURED if race winner succeeded', async () => {
      const authorizedTx = makeTx({ status: PaymentTxStatus.AUTHORIZED });
      const capturedTx = makeTx({ status: PaymentTxStatus.CAPTURED });
      prisma.paymentTransaction.findFirst
        .mockResolvedValueOnce(authorizedTx)
        .mockResolvedValueOnce(capturedTx); // re-fetch after P2002
      prisma.idempotencyRecord.create.mockRejectedValue(makeP2002());

      const result = await service.capturePayment(input);

      expect(result.status).toBe(PaymentTxStatus.CAPTURED);
      expect(mockGateway.capturePayment).not.toHaveBeenCalled();
    });

    it('P1-3: records PAYMENT_FAILED activity and rethrows when gateway.capturePayment throws', async () => {
      const authorizedTx = makeTx({ status: PaymentTxStatus.AUTHORIZED });
      prisma.paymentTransaction.findFirst.mockResolvedValue(authorizedTx);
      mockGateway.capturePayment.mockRejectedValue(new Error('Gateway unreachable'));

      await expect(service.capturePayment(input)).rejects.toThrow(GatewayInitializationException);

      expect(prisma.paymentActivity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ activityType: PaymentActivityType.PAYMENT_FAILED }),
        }),
      );
      // Stays AUTHORIZED — no status transition on gateway throw for capture
      expect(prisma.paymentTransaction.updateMany).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // cancelPayment
  // =========================================================================

  describe('cancelPayment()', () => {
    it('transitions PENDING → CANCELLED and records activity', async () => {
      const pendingTx = makeTx({ status: PaymentTxStatus.PENDING });
      const cancelledTx = makeTx({ status: PaymentTxStatus.CANCELLED, cancelledAt: new Date() });
      prisma.paymentTransaction.findFirst
        .mockResolvedValueOnce(pendingTx)
        .mockResolvedValueOnce(cancelledTx);
      mockGateway.cancelPayment.mockResolvedValue(makeGatewayResult());

      const result = await service.cancelPayment('tx_001', 'store_001');

      expect(result.status).toBe(PaymentTxStatus.CANCELLED);
      expect(prisma.paymentActivity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ activityType: PaymentActivityType.PAYMENT_CANCELLED }),
        }),
      );
    });

    it('is idempotent: returns already-CANCELLED transaction without gateway call', async () => {
      const cancelledTx = makeTx({ status: PaymentTxStatus.CANCELLED });
      prisma.paymentTransaction.findFirst.mockResolvedValue(cancelledTx);

      const result = await service.cancelPayment('tx_001', 'store_001');

      expect(result).toBe(cancelledTx);
      expect(mockGateway.cancelPayment).not.toHaveBeenCalled();
    });

    it('throws InvalidPaymentTransitionException for CAPTURED → CANCELLED (not allowed)', async () => {
      const capturedTx = makeTx({ status: PaymentTxStatus.CAPTURED });
      prisma.paymentTransaction.findFirst.mockResolvedValue(capturedTx);

      await expect(service.cancelPayment('tx_001', 'store_001')).rejects.toThrow(
        InvalidPaymentTransitionException,
      );
    });

    it('P1-3: transitions to FAILED and rethrows when gateway.cancelPayment throws', async () => {
      const pendingTx = makeTx({ status: PaymentTxStatus.PENDING });
      const failedTx = makeTx({ status: PaymentTxStatus.FAILED });
      prisma.paymentTransaction.findFirst
        .mockResolvedValueOnce(pendingTx)
        .mockResolvedValueOnce(failedTx);
      mockGateway.cancelPayment.mockRejectedValue(new Error('Gateway error'));

      await expect(service.cancelPayment('tx_001', 'store_001')).rejects.toThrow(
        GatewayInitializationException,
      );

      expect(prisma.paymentTransaction.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: PaymentTxStatus.FAILED }),
        }),
      );
    });
  });

  // =========================================================================
  // refundPayment
  // =========================================================================

  describe('refundPayment()', () => {
    const baseInput = {
      transactionId: 'tx_001',
      storeId: 'store_001',
      amountInPaise: 50000,
      reason: 'customer request',
      idempotencyKey: 'idem_refund_001',
    };

    it('processes full refund: CAPTURED → REFUNDED', async () => {
      const capturedTx = makeTx({
        status: PaymentTxStatus.CAPTURED,
        capturedPaise: 50000,
        gatewayPaymentId: 'mock_pay_001',
      });
      const refundedTx = makeTx({ status: PaymentTxStatus.REFUNDED, refundedAt: new Date() });
      const pendingRefund = makeRefund({ status: 'PENDING' });
      const completedRefund = makeRefund({ status: 'COMPLETED' });
      prisma.paymentTransaction.findFirst
        .mockResolvedValueOnce(capturedTx)
        .mockResolvedValueOnce(refundedTx);
      prisma.paymentRefund.create.mockResolvedValue(pendingRefund);
      prisma.paymentRefund.update.mockResolvedValue(completedRefund);
      mockGateway.refundPayment.mockResolvedValue(makeRefundResult());

      const result = await service.refundPayment(baseInput);

      expect(result.transaction.status).toBe(PaymentTxStatus.REFUNDED);
      expect(result.refund.status).toBe('COMPLETED');
      expect(prisma.paymentActivity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            activityType: PaymentActivityType.PAYMENT_REFUND_INITIATED,
          }),
        }),
      );
      expect(prisma.paymentActivity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            activityType: PaymentActivityType.PAYMENT_REFUND_PROCESSED,
          }),
        }),
      );
    });

    it('processes partial refund: CAPTURED → PARTIALLY_REFUNDED', async () => {
      const capturedTx = makeTx({
        status: PaymentTxStatus.CAPTURED,
        capturedPaise: 50000,
        gatewayPaymentId: 'mock_pay_001',
      });
      const partialTx = makeTx({ status: PaymentTxStatus.PARTIALLY_REFUNDED });
      const pendingRefund = makeRefund({ status: 'PENDING', amountInPaise: 20000 });
      const completedRefund = makeRefund({ amountInPaise: 20000, status: 'COMPLETED' });
      prisma.paymentTransaction.findFirst
        .mockResolvedValueOnce(capturedTx)
        .mockResolvedValueOnce(partialTx);
      prisma.paymentRefund.create.mockResolvedValue(pendingRefund);
      prisma.paymentRefund.update.mockResolvedValue(completedRefund);
      mockGateway.refundPayment.mockResolvedValue(makeRefundResult({ refundedPaise: 20000 }));

      const result = await service.refundPayment({ ...baseInput, amountInPaise: 20000 });

      expect(result.transaction.status).toBe(PaymentTxStatus.PARTIALLY_REFUNDED);
    });

    it('throws PaymentAlreadyRefundedException when requested amount exceeds remaining', async () => {
      const capturedTx = makeTx({ status: PaymentTxStatus.CAPTURED, capturedPaise: 50000 });
      prisma.paymentTransaction.findFirst.mockResolvedValue(capturedTx);
      // Already reserved 30000 (PENDING or COMPLETED)
      prisma.paymentRefund.findMany.mockResolvedValue([{ amountInPaise: 30000 }] as any);

      await expect(
        service.refundPayment({ ...baseInput, amountInPaise: 30000 }),
      ).rejects.toThrow(PaymentAlreadyRefundedException);
    });

    it('returns idempotent result on re-call with same idempotencyKey (COMPLETED refund)', async () => {
      const capturedTx = makeTx({ status: PaymentTxStatus.CAPTURED, capturedPaise: 50000 });
      const refundedTx = makeTx({ status: PaymentTxStatus.REFUNDED });
      const existingRefund = makeRefund({ status: 'COMPLETED' });
      prisma.paymentTransaction.findFirst
        .mockResolvedValueOnce(capturedTx)
        .mockResolvedValueOnce(refundedTx);
      prisma.idempotencyRecord.findUnique.mockResolvedValue({
        id: 'rec_1',
        key: 'payment:refund:tx_001:idem_refund_001',
        storeId: 'store_001',
        expiresAt: new Date(Date.now() + 60_000),
        createdAt: new Date(),
      });
      prisma.paymentRefund.findFirst.mockResolvedValue(existingRefund);

      const result = await service.refundPayment(baseInput);

      expect(result.refund).toBe(existingRefund);
      expect(mockGateway.refundPayment).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('throws InvalidPaymentTransitionException for PENDING → REFUNDED', async () => {
      const pendingTx = makeTx({ status: PaymentTxStatus.PENDING });
      prisma.paymentTransaction.findFirst.mockResolvedValue(pendingTx);

      await expect(service.refundPayment(baseInput)).rejects.toThrow(
        InvalidPaymentTransitionException,
      );
    });

    it('updates refund to FAILED and does not transition status when gateway returns !success', async () => {
      const capturedTx = makeTx({ status: PaymentTxStatus.CAPTURED, capturedPaise: 50000 });
      const pendingRefund = makeRefund({ status: 'PENDING' });
      const failedRefund = makeRefund({ status: 'FAILED', gatewayRefundId: null });
      prisma.paymentTransaction.findFirst.mockResolvedValue(capturedTx);
      prisma.paymentRefund.create.mockResolvedValue(pendingRefund);
      prisma.paymentRefund.update.mockResolvedValue(failedRefund);
      mockGateway.refundPayment.mockResolvedValue(
        makeRefundResult({
          success: false,
          error: { code: 'RF_FAIL', message: 'refund failed', isRetryable: false },
        }),
      );

      const result = await service.refundPayment(baseInput);

      expect(result.refund.status).toBe('FAILED');
      expect(prisma.paymentTransaction.updateMany).not.toHaveBeenCalled();
    });

    it('P0-1: supports multiple partial refunds (PARTIALLY_REFUNDED → PARTIALLY_REFUNDED)', async () => {
      const partialTx = makeTx({
        status: PaymentTxStatus.PARTIALLY_REFUNDED,
        capturedPaise: 50000,
        gatewayPaymentId: 'mock_pay_001',
      });
      const pendingRefund = makeRefund({ status: 'PENDING', amountInPaise: 10000 });
      const completedRefund = makeRefund({ status: 'COMPLETED', amountInPaise: 10000 });
      prisma.paymentTransaction.findFirst
        .mockResolvedValueOnce(partialTx) // findOrThrow(ptx)
        .mockResolvedValueOnce(partialTx); // findOrThrow in else branch (no transitionStatus)
      // 20000 already reserved (PENDING or COMPLETED), 10000 new → total 30000 < 50000 → PARTIALLY_REFUNDED
      prisma.paymentRefund.findMany.mockResolvedValue([{ amountInPaise: 20000 }] as any);
      prisma.paymentRefund.create.mockResolvedValue(pendingRefund);
      prisma.paymentRefund.update.mockResolvedValue(completedRefund);
      mockGateway.refundPayment.mockResolvedValue(makeRefundResult({ refundedPaise: 10000 }));

      const result = await service.refundPayment({
        transactionId: 'tx_001',
        storeId: 'store_001',
        amountInPaise: 10000,
        idempotencyKey: 'idem_refund_002',
      });

      // Status must remain PARTIALLY_REFUNDED — transitionStatus must NOT be called
      expect(result.transaction.status).toBe(PaymentTxStatus.PARTIALLY_REFUNDED);
      expect(prisma.paymentTransaction.updateMany).not.toHaveBeenCalled();
      expect(result.refund.status).toBe('COMPLETED');
    });

    it('P1-3: updates refund to FAILED and rethrows when gateway.refundPayment throws', async () => {
      const capturedTx = makeTx({ status: PaymentTxStatus.CAPTURED, capturedPaise: 50000 });
      const pendingRefund = makeRefund({ status: 'PENDING' });
      const failedRefund = makeRefund({ status: 'FAILED' });
      prisma.paymentTransaction.findFirst.mockResolvedValue(capturedTx);
      prisma.paymentRefund.create.mockResolvedValue(pendingRefund);
      prisma.paymentRefund.update.mockResolvedValue(failedRefund);
      mockGateway.refundPayment.mockRejectedValue(new Error('Network error'));

      await expect(
        service.refundPayment({ ...baseInput }),
      ).rejects.toThrow();

      expect(prisma.paymentRefund.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) }),
      );
      expect(prisma.paymentActivity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ activityType: PaymentActivityType.PAYMENT_FAILED }),
        }),
      );
    });

    it('P1-5: prevents over-refund by including PENDING refunds in remaining calculation', async () => {
      const capturedTx = makeTx({ status: PaymentTxStatus.CAPTURED, capturedPaise: 50000 });
      prisma.paymentTransaction.findFirst.mockResolvedValue(capturedTx);
      // Another concurrent request has already claimed 40000 (PENDING, not FAILED)
      prisma.paymentRefund.findMany.mockResolvedValue([{ amountInPaise: 40000 }] as any);

      // Trying to refund 20000 but only 10000 remains
      await expect(
        service.refundPayment({ ...baseInput, amountInPaise: 20000, idempotencyKey: 'idem_new' }),
      ).rejects.toThrow(PaymentAlreadyRefundedException);

      expect(mockGateway.refundPayment).not.toHaveBeenCalled();
    });

    it('P1-6: resumes gateway call when idem record exists with PENDING refund (skips Phase 1)', async () => {
      const capturedTx = makeTx({
        status: PaymentTxStatus.CAPTURED,
        capturedPaise: 50000,
        gatewayPaymentId: 'mock_pay_001',
      });
      const refundedTx = makeTx({ status: PaymentTxStatus.REFUNDED });
      const pendingRefund = makeRefund({ id: 'refund_pending', status: 'PENDING' });
      const completedRefund = makeRefund({ status: 'COMPLETED' });
      prisma.idempotencyRecord.findUnique.mockResolvedValue({
        id: 'rec_1',
        key: 'payment:refund:tx_001:idem_refund_001',
        storeId: 'store_001',
        expiresAt: new Date(Date.now() + 60_000),
        createdAt: new Date(),
      });
      prisma.paymentTransaction.findFirst
        .mockResolvedValueOnce(capturedTx)
        .mockResolvedValueOnce(refundedTx);
      prisma.paymentRefund.findFirst.mockResolvedValue(pendingRefund);
      prisma.paymentRefund.update.mockResolvedValue(completedRefund);
      mockGateway.refundPayment.mockResolvedValue(makeRefundResult());

      const result = await service.refundPayment(baseInput);

      // Phase 1 must be skipped
      expect(prisma.$transaction).not.toHaveBeenCalled();
      // Gateway must be called to complete the pending refund
      expect(mockGateway.refundPayment).toHaveBeenCalledTimes(1);
      // Refund updated to COMPLETED using the existing PENDING refund's id
      expect(prisma.paymentRefund.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'refund_pending' },
          data: expect.objectContaining({ status: 'COMPLETED' }),
        }),
      );
      expect(result.refund.status).toBe('COMPLETED');
    });
  });

  // =========================================================================
  // retryPayment
  // =========================================================================

  describe('retryPayment()', () => {
    const input = {
      transactionId: 'tx_001',
      storeId: 'store_001',
      idempotencyKey: 'idem_retry_001',
    };

    it('creates new transaction with incremented attemptNumber and marks old as superseded', async () => {
      const failedTx = makeTx({ status: PaymentTxStatus.FAILED, attemptNumber: 1 });
      const newTx = makeTx({ id: 'tx_002', status: PaymentTxStatus.PENDING, attemptNumber: 2 });
      const updatedNewTx = makeTx({
        id: 'tx_002',
        status: PaymentTxStatus.GATEWAY_CREATED,
        gatewayOrderId: 'mock_order_002',
      });
      prisma.paymentTransaction.findFirst
        .mockResolvedValueOnce(failedTx)    // retryPayment → findOrThrow(original)
        .mockResolvedValueOnce(newTx)       // startPayment → findOrThrow(newTx)
        .mockResolvedValueOnce(updatedNewTx); // transitionStatus re-fetch
      prisma.paymentTransaction.create.mockResolvedValue(newTx);
      prisma.paymentTransaction.update.mockResolvedValue({ ...failedTx, supersededById: 'tx_002' });
      mockGateway.initiatePayment.mockResolvedValue(makeGatewayResult({ gatewayOrderId: 'mock_order_002' }));

      const result = await service.retryPayment(input);

      expect(prisma.paymentTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ attemptNumber: 2, storeId: 'store_001' }),
        }),
      );
      expect(prisma.paymentTransaction.update).toHaveBeenCalledWith({
        where: { id: 'tx_001' },
        data: { supersededById: 'tx_002' },
      });
      expect(prisma.paymentActivity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ activityType: PaymentActivityType.RECOVERY_ATTEMPTED }),
        }),
      );
      expect(result.transaction.id).toBe('tx_002');
    });

    it('throws InvalidPaymentTransitionException when original transaction is not terminal', async () => {
      const activeTx = makeTx({ status: PaymentTxStatus.PENDING });
      prisma.paymentTransaction.findFirst.mockResolvedValue(activeTx);

      await expect(service.retryPayment(input)).rejects.toThrow(InvalidPaymentTransitionException);
    });

    it('allows switching gateway on retry', async () => {
      const failedTx = makeTx({ status: PaymentTxStatus.FAILED, gatewayCode: 'mock' });
      const newTx = makeTx({ id: 'tx_002', status: PaymentTxStatus.PENDING, gatewayCode: 'cod' });
      const updatedNewTx = makeTx({
        id: 'tx_002',
        status: PaymentTxStatus.GATEWAY_CREATED,
        gatewayCode: 'cod',
      });
      prisma.paymentTransaction.findFirst
        .mockResolvedValueOnce(failedTx)
        .mockResolvedValueOnce(newTx)
        .mockResolvedValueOnce(updatedNewTx);
      prisma.paymentTransaction.create.mockResolvedValue(newTx);
      prisma.paymentTransaction.update.mockResolvedValue(failedTx);
      mockGateway.initiatePayment.mockResolvedValue(makeGatewayResult());

      await service.retryPayment({ ...input, gatewayCode: 'cod' });

      expect(prisma.paymentTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ gatewayCode: 'cod' }),
        }),
      );
    });

    it('P1-4: creates new tx and marks original as superseded atomically in a single $transaction', async () => {
      const failedTx = makeTx({ status: PaymentTxStatus.FAILED, attemptNumber: 1 });
      const newTx = makeTx({ id: 'tx_002', status: PaymentTxStatus.PENDING, attemptNumber: 2 });
      const updatedNewTx = makeTx({ id: 'tx_002', status: PaymentTxStatus.GATEWAY_CREATED });
      prisma.paymentTransaction.findFirst
        .mockResolvedValueOnce(failedTx)
        .mockResolvedValueOnce(newTx)
        .mockResolvedValueOnce(updatedNewTx);
      prisma.paymentTransaction.create.mockResolvedValue(newTx);
      prisma.paymentTransaction.update.mockResolvedValue({ ...failedTx, supersededById: 'tx_002' });
      mockGateway.initiatePayment.mockResolvedValue(makeGatewayResult());

      await service.retryPayment(input);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.paymentTransaction.create).toHaveBeenCalledTimes(1);
      expect(prisma.paymentTransaction.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { supersededById: 'tx_002' } }),
      );
    });
  });

  // =========================================================================
  // getPayment
  // =========================================================================

  describe('getPayment()', () => {
    it('returns the transaction when found', async () => {
      const tx = makeTx();
      prisma.paymentTransaction.findFirst.mockResolvedValue(tx);

      const result = await service.getPayment('tx_001', 'store_001');

      expect(result).toBe(tx);
    });

    it('throws NotFoundException when not found', async () => {
      prisma.paymentTransaction.findFirst.mockResolvedValue(null);

      await expect(service.getPayment('bad_id', 'store_001')).rejects.toThrow(NotFoundException);
    });
  });

  // =========================================================================
  // getPaymentHistory
  // =========================================================================

  describe('getPaymentHistory()', () => {
    it('returns all transactions for a checkout session ordered by createdAt asc', async () => {
      const txs = [makeTx({ id: 'tx_001' }), makeTx({ id: 'tx_002', attemptNumber: 2 })];
      prisma.paymentTransaction.findMany.mockResolvedValue(txs);

      const result = await service.getPaymentHistory('cs_001', 'store_001');

      expect(result).toBe(txs);
      expect(prisma.paymentTransaction.findMany).toHaveBeenCalledWith({
        where: { checkoutSessionId: 'cs_001', storeId: 'store_001' },
        orderBy: { createdAt: 'asc' },
      });
    });

    it('returns empty array when no transactions exist', async () => {
      prisma.paymentTransaction.findMany.mockResolvedValue([]);

      const result = await service.getPaymentHistory('cs_empty', 'store_001');

      expect(result).toEqual([]);
    });
  });

  // =========================================================================
  // Internal: transitionStatus (optimistic locking)
  // =========================================================================

  describe('transitionStatus (optimistic lock)', () => {
    it('returns to the same target status if already transitioned by another process', async () => {
      const pendingTx = makeTx({ status: PaymentTxStatus.PENDING });
      const alreadyGatewayTx = makeTx({ status: PaymentTxStatus.GATEWAY_CREATED });
      prisma.paymentTransaction.findFirst
        .mockResolvedValueOnce(pendingTx)
        .mockResolvedValueOnce(alreadyGatewayTx);
      prisma.paymentTransaction.updateMany.mockResolvedValue({ count: 0 });
      mockGateway.initiatePayment.mockResolvedValue(makeGatewayResult());

      const result = await service.startPayment('tx_001', 'store_001', 'idem_001');

      expect(result.transaction.status).toBe(PaymentTxStatus.GATEWAY_CREATED);
    });
  });

  // =========================================================================
  // recordActivity: generates a unique id for each activity
  // =========================================================================

  describe('recordActivity UUID generation', () => {
    it('provides a non-empty string id to PaymentActivity.create (no Prisma default)', async () => {
      const tx = makeTx();
      prisma.paymentTransaction.create.mockResolvedValue(tx);

      await service.createPaymentAttempt({
        checkoutSessionId: 'cs_001',
        storeId: 'store_001',
        gatewayCode: 'mock',
        amountInPaise: 1000,
        idempotencyKey: 'idem_001',
      });

      const call = prisma.paymentActivity.create.mock.calls[0][0];
      expect(typeof call.data.id).toBe('string');
      expect(call.data.id.length).toBeGreaterThan(0);
    });
  });
});
