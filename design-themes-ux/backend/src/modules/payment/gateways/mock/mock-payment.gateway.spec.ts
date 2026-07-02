import { ConfigService } from '@nestjs/config';
import { PaymentTxStatus } from '@prisma/client';

import { GatewayInitializationException } from '../../exceptions/payment.exceptions';
import { GatewayCapability, InitiatePaymentInput, CaptureInput, RefundInput } from '../../types/payment.types';
import { GatewayStatusQueryContext } from '../../types/gateway-status-query.context';
import { MockPaymentGateway } from './mock-payment.gateway';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfigService(behavior = 'success', delayMs = 0): ConfigService {
  return {
    get: jest.fn((key: string, defaultVal?: any) => {
      if (key === 'payment.mock.behavior') return behavior;
      if (key === 'payment.mock.delayMs')  return delayMs;
      return defaultVal;
    }),
  } as any;
}

function makeInitiateInput(overrides: Partial<InitiatePaymentInput> = {}): InitiatePaymentInput {
  return {
    transactionId:    'tx_test_001',
    checkoutSessionId: 'cs_001',
    storeId:          'store_001',
    amountInPaise:    50000,
    currency:         'INR',
    idempotencyKey:   'idem_001',
    ...overrides,
  };
}

function makeCaptureInput(overrides: Partial<CaptureInput> = {}): CaptureInput {
  return {
    transactionId:   'tx_test_001',
    storeId:         'store_001',
    amountInPaise:   50000,
    gatewayOrderId:  'mock_order_abc',
    gatewayPaymentId: 'mock_pay_abc',
    idempotencyKey:  'idem_002',
    ...overrides,
  };
}

function makeRefundInput(overrides: Partial<RefundInput> = {}): RefundInput {
  return {
    transactionId:   'tx_test_001',
    storeId:         'store_001',
    amountInPaise:   50000,
    gatewayPaymentId: 'mock_pay_abc',
    idempotencyKey:  'idem_003',
    ...overrides,
  };
}

const queryContext: GatewayStatusQueryContext = {
  gatewayOrderId:  'mock_order_abc',
  gatewayPaymentId: 'mock_pay_abc',
  amountInPaise:   50000,
  storeId:         'store_001',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MockPaymentGateway', () => {

  // -------------------------------------------------------------------------
  // Capabilities
  // -------------------------------------------------------------------------

  describe('capabilities', () => {
    it('gatewayCode is "mock"', () => {
      const gw = new MockPaymentGateway(makeConfigService());
      expect(gw.capabilities.gatewayCode).toBe('mock');
    });

    it('isLiveCapable is false', () => {
      const gw = new MockPaymentGateway(makeConfigService());
      expect(gw.capabilities.isLiveCapable).toBe(false);
    });

    it('supports AUTHORIZE_THEN_CAPTURE and DIRECT_CAPTURE', () => {
      const gw = new MockPaymentGateway(makeConfigService());
      expect(gw.capabilities.supports.has(GatewayCapability.AUTHORIZE_THEN_CAPTURE)).toBe(true);
      expect(gw.capabilities.supports.has(GatewayCapability.DIRECT_CAPTURE)).toBe(true);
    });

    it('supports REFUND, PARTIAL_REFUND, CANCEL, STATUS_QUERY, WEBHOOK', () => {
      const gw = new MockPaymentGateway(makeConfigService());
      const { supports } = gw.capabilities;
      expect(supports.has(GatewayCapability.REFUND)).toBe(true);
      expect(supports.has(GatewayCapability.PARTIAL_REFUND)).toBe(true);
      expect(supports.has(GatewayCapability.CANCEL)).toBe(true);
      expect(supports.has(GatewayCapability.STATUS_QUERY)).toBe(true);
      expect(supports.has(GatewayCapability.WEBHOOK)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // behavior = 'success' (default)
  // -------------------------------------------------------------------------

  describe("behavior = 'success'", () => {
    let gw: MockPaymentGateway;

    beforeEach(() => { gw = new MockPaymentGateway(makeConfigService('success')); });

    it('initiatePayment returns success with both order and payment IDs', async () => {
      const result = await gw.initiatePayment(makeInitiateInput());
      expect(result.success).toBe(true);
      expect(result.gatewayCode).toBe('mock');
      expect(result.gatewayOrderId).toMatch(/^mock_order_/);
      expect(result.gatewayPaymentId).toMatch(/^mock_pay_/);
      expect(result.error).toBeUndefined();
    });

    it('capturePayment returns success with captured amount', async () => {
      const result = await gw.capturePayment(makeCaptureInput());
      expect(result.success).toBe(true);
      expect(result.capturedPaise).toBe(50000);
      expect(result.capturedAt).toBeInstanceOf(Date);
    });

    it('capturePayment generates gatewayPaymentId when not provided', async () => {
      const result = await gw.capturePayment(
        makeCaptureInput({ gatewayPaymentId: undefined }),
      );
      expect(result.gatewayPaymentId).toMatch(/^mock_pay_/);
    });

    it('refundPayment returns success with refund ID', async () => {
      const result = await gw.refundPayment(makeRefundInput());
      expect(result.success).toBe(true);
      expect(result.gatewayRefundId).toMatch(/^mock_refund_/);
      expect(result.refundedPaise).toBe(50000);
      expect(result.refundedAt).toBeInstanceOf(Date);
    });

    it('verifyPayment resolves to CAPTURED', async () => {
      const result = await gw.verifyPayment(queryContext);
      expect(result.success).toBe(true);
      expect(result.resolvedStatus).toBe(PaymentTxStatus.CAPTURED);
      expect(result.rawGatewayStatus).toBe('success');
    });

    it('cancelPayment returns success', async () => {
      const result = await gw.cancelPayment(queryContext);
      expect(result.success).toBe(true);
      expect(result.gatewayCode).toBe('mock');
    });
  });

  // -------------------------------------------------------------------------
  // behavior = 'authorize_capture'
  // -------------------------------------------------------------------------

  describe("behavior = 'authorize_capture'", () => {
    let gw: MockPaymentGateway;

    beforeEach(() => { gw = new MockPaymentGateway(makeConfigService('authorize_capture')); });

    it('initiatePayment returns order ID but no payment ID', async () => {
      const result = await gw.initiatePayment(makeInitiateInput());
      expect(result.success).toBe(true);
      expect(result.gatewayOrderId).toMatch(/^mock_order_/);
      expect(result.gatewayPaymentId).toBeUndefined();
    });

    it('verifyPayment resolves to AUTHORIZED', async () => {
      const result = await gw.verifyPayment(queryContext);
      expect(result.resolvedStatus).toBe(PaymentTxStatus.AUTHORIZED);
    });

    it('capturePayment still succeeds (gateway-level capture)', async () => {
      const result = await gw.capturePayment(makeCaptureInput());
      expect(result.success).toBe(true);
      expect(result.capturedPaise).toBe(50000);
    });
  });

  // -------------------------------------------------------------------------
  // behavior = 'fail'
  // -------------------------------------------------------------------------

  describe("behavior = 'fail'", () => {
    let gw: MockPaymentGateway;

    beforeEach(() => { gw = new MockPaymentGateway(makeConfigService('fail')); });

    it('initiatePayment returns failure result with error', async () => {
      const result = await gw.initiatePayment(makeInitiateInput());
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error.isRetryable).toBe(false);
      expect(result.error.code).toBe('MOCK_PAYMENT_FAILED');
    });

    it('capturePayment returns failure result', async () => {
      const result = await gw.capturePayment(makeCaptureInput());
      expect(result.success).toBe(false);
      expect(result.error.code).toBe('MOCK_CAPTURE_FAILED');
    });

    it('verifyPayment resolves to FAILED', async () => {
      const result = await gw.verifyPayment(queryContext);
      expect(result.resolvedStatus).toBe(PaymentTxStatus.FAILED);
    });
  });

  // -------------------------------------------------------------------------
  // behavior = 'timeout'
  // -------------------------------------------------------------------------

  describe("behavior = 'timeout'", () => {
    let gw: MockPaymentGateway;

    beforeEach(() => { gw = new MockPaymentGateway(makeConfigService('timeout')); });

    it('initiatePayment throws GatewayInitializationException', async () => {
      await expect(gw.initiatePayment(makeInitiateInput())).rejects.toThrow(
        GatewayInitializationException,
      );
    });
  });

  // -------------------------------------------------------------------------
  // Unique ID generation
  // -------------------------------------------------------------------------

  describe('ID uniqueness', () => {
    it('generates different gatewayOrderIds on successive calls', async () => {
      const gw  = new MockPaymentGateway(makeConfigService('success'));
      const r1  = await gw.initiatePayment(makeInitiateInput());
      const r2  = await gw.initiatePayment(makeInitiateInput());
      expect(r1.gatewayOrderId).not.toBe(r2.gatewayOrderId);
    });
  });

  // -------------------------------------------------------------------------
  // Simulated delay
  // -------------------------------------------------------------------------

  describe('simulate delay', () => {
    it('completes successfully when delayMs > 0', async () => {
      jest.useFakeTimers();
      const gw      = new MockPaymentGateway(makeConfigService('success', 100));
      const promise = gw.initiatePayment(makeInitiateInput());
      jest.advanceTimersByTime(200);
      const result = await promise;
      expect(result.success).toBe(true);
      jest.useRealTimers();
    });
  });
});
