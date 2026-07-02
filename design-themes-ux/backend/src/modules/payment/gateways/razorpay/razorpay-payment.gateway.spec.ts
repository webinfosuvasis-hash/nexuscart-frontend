import { ConfigService } from '@nestjs/config';
import { PaymentTxStatus } from '@prisma/client';

import {
  GatewayVerificationException,
} from '../../exceptions/payment.exceptions';
import { GatewayCapability, InitiatePaymentInput, CaptureInput, RefundInput } from '../../types/payment.types';
import { GatewayStatusQueryContext } from '../../types/gateway-status-query.context';
import { RazorpayPaymentGateway } from './razorpay-payment.gateway';

// ---------------------------------------------------------------------------
// Mock Razorpay client factory
// ---------------------------------------------------------------------------

function makeRazorpayClient(overrides: Partial<{
  orderCreate: any;
  paymentsFetch: any;
  paymentsCapture: any;
  paymentsRefund: any;
  orderFetchPayments: any;
}> = {}) {
  return {
    orders: {
      create: jest.fn().mockResolvedValue(
        overrides.orderCreate ?? {
          id: 'order_test_001',
          amount: 50000,
          currency: 'INR',
          receipt: 'tx_001',
          status: 'created',
        },
      ),
      fetchPayments: jest.fn().mockResolvedValue(
        overrides.orderFetchPayments ?? {
          items: [
            {
              id: 'pay_test_001',
              order_id: 'order_test_001',
              status: 'authorized',
              amount: 50000,
              amount_refunded: 0,
              created_at: 1700000000,
            },
          ],
        },
      ),
    },
    payments: {
      fetch: jest.fn().mockResolvedValue(
        overrides.paymentsFetch ?? {
          id: 'pay_test_001',
          order_id: 'order_test_001',
          status: 'authorized',
          amount: 50000,
          amount_refunded: 0,
          created_at: 1700000000,
        },
      ),
      capture: jest.fn().mockResolvedValue(
        overrides.paymentsCapture ?? {
          id: 'pay_test_001',
          order_id: 'order_test_001',
          status: 'captured',
          amount: 50000,
          created_at: 1700000001,
        },
      ),
      refund: jest.fn().mockResolvedValue(
        overrides.paymentsRefund ?? {
          id: 'rfnd_test_001',
          payment_id: 'pay_test_001',
          amount: 20000,
          created_at: 1700000002,
        },
      ),
    },
  };
}

// ---------------------------------------------------------------------------
// Testable subclass — injects mock client without calling Razorpay SDK
// ---------------------------------------------------------------------------

class TestableRazorpayGateway extends RazorpayPaymentGateway {
  private mockClient: any;

  setMockClient(client: any) { this.mockClient = client; }

  protected createClient(_keyId: string, _keySecret: string): any {
    return this.mockClient;
  }
}

function makeGateway(mockClient: any, keySecret = 'test_secret'): TestableRazorpayGateway {
  const configService = {
    get: jest.fn((key: string, def?: any) => {
      if (key === 'payment.razorpay.keyId')     return 'rzp_test_key';
      if (key === 'payment.razorpay.keySecret')  return keySecret;
      if (key === 'payment.razorpay.webhookSecret') return 'whsec_test';
      return def;
    }),
  } as any;

  const gw = new TestableRazorpayGateway(configService as ConfigService);
  gw.setMockClient(mockClient);
  gw.onModuleInit();
  return gw;
}

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

function makeInitiateInput(overrides: Partial<InitiatePaymentInput> = {}): InitiatePaymentInput {
  return {
    transactionId:     'tx_001',
    checkoutSessionId: 'cs_001',
    storeId:           'store_001',
    amountInPaise:     50000,
    currency:          'INR',
    orderId:           'ord_tentative_001',
    idempotencyKey:    'idem_001',
    ...overrides,
  };
}

const captureInput: CaptureInput = {
  transactionId:    'tx_001',
  storeId:          'store_001',
  amountInPaise:    50000,
  gatewayPaymentId: 'pay_test_001',
  gatewayOrderId:   'order_test_001',
  idempotencyKey:   'idem_002',
};

const refundInput: RefundInput = {
  transactionId:    'tx_001',
  storeId:          'store_001',
  amountInPaise:    20000,
  gatewayPaymentId: 'pay_test_001',
  reason:           'Customer request',
  idempotencyKey:   'idem_003',
};

const queryCtxWithPaymentId: GatewayStatusQueryContext = {
  gatewayPaymentId: 'pay_test_001',
  gatewayOrderId:   'order_test_001',
  amountInPaise:    50000,
  storeId:          'store_001',
};

const queryCtxOrderOnly: GatewayStatusQueryContext = {
  gatewayOrderId: 'order_test_001',
  amountInPaise:  50000,
  storeId:        'store_001',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RazorpayPaymentGateway', () => {

  // -------------------------------------------------------------------------
  // Capabilities
  // -------------------------------------------------------------------------

  describe('capabilities', () => {
    it('gatewayCode is "razorpay"', () => {
      const gw = makeGateway(makeRazorpayClient());
      expect(gw.capabilities.gatewayCode).toBe('razorpay');
    });

    it('isLiveCapable is true', () => {
      const gw = makeGateway(makeRazorpayClient());
      expect(gw.capabilities.isLiveCapable).toBe(true);
    });

    it('requiresWebhook is true', () => {
      const gw = makeGateway(makeRazorpayClient());
      expect(gw.capabilities.requiresWebhook).toBe(true);
    });

    it('webhookSignatureAlgorithm is HMAC-SHA256', () => {
      const gw = makeGateway(makeRazorpayClient());
      expect(gw.capabilities.webhookSignatureAlgorithm).toBe('HMAC-SHA256');
    });

    it('supports ORDER_BASED, AUTHORIZE_THEN_CAPTURE, REFUND, PARTIAL_REFUND, WEBHOOK, STATUS_QUERY, CANCEL, REDIRECT_FLOW', () => {
      const gw  = makeGateway(makeRazorpayClient());
      const { supports } = gw.capabilities;
      [
        GatewayCapability.ORDER_BASED,
        GatewayCapability.AUTHORIZE_THEN_CAPTURE,
        GatewayCapability.REFUND,
        GatewayCapability.PARTIAL_REFUND,
        GatewayCapability.WEBHOOK,
        GatewayCapability.STATUS_QUERY,
        GatewayCapability.CANCEL,
        GatewayCapability.REDIRECT_FLOW,
      ].forEach((cap) => expect(supports.has(cap)).toBe(true));
    });

    it('does NOT support DIRECT_CAPTURE or INTENT_BASED', () => {
      const gw = makeGateway(makeRazorpayClient());
      expect(gw.capabilities.supports.has(GatewayCapability.DIRECT_CAPTURE)).toBe(false);
      expect(gw.capabilities.supports.has(GatewayCapability.INTENT_BASED)).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // initiatePayment
  // -------------------------------------------------------------------------

  describe('initiatePayment', () => {
    it('creates a Razorpay order and returns gatewayOrderId', async () => {
      const client = makeRazorpayClient();
      const gw     = makeGateway(client);

      const result = await gw.initiatePayment(makeInitiateInput());

      expect(result.success).toBe(true);
      expect(result.gatewayCode).toBe('razorpay');
      expect(result.gatewayOrderId).toBe('order_test_001');
      expect(client.orders.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount:          50000,
          currency:        'INR',
          payment_capture: 0,
        }),
      );
    });

    it('uses orderId as receipt when provided', async () => {
      const client = makeRazorpayClient();
      const gw     = makeGateway(client);

      await gw.initiatePayment(makeInitiateInput({ orderId: 'ord_001' }));

      expect(client.orders.create).toHaveBeenCalledWith(
        expect.objectContaining({ receipt: 'ord_001' }),
      );
    });

    it('falls back to transactionId as receipt when orderId absent', async () => {
      const client = makeRazorpayClient();
      const gw     = makeGateway(client);

      await gw.initiatePayment(makeInitiateInput({ orderId: undefined }));

      expect(client.orders.create).toHaveBeenCalledWith(
        expect.objectContaining({ receipt: 'tx_001' }),
      );
    });

    it('returns failure result when SDK throws', async () => {
      const client = makeRazorpayClient();
      client.orders.create.mockRejectedValue({
        statusCode: 400,
        error: { code: 'BAD_REQUEST_ERROR', description: 'Invalid key' },
      });
      const gw = makeGateway(client);

      const result = await gw.initiatePayment(makeInitiateInput());

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error.code).toBe('BAD_REQUEST_ERROR');
      expect(result.error.isRetryable).toBe(false);
    });

    it('marks 500-class SDK errors as retryable', async () => {
      const client = makeRazorpayClient();
      client.orders.create.mockRejectedValue({
        statusCode: 500,
        error: { code: 'SERVER_ERROR', description: 'Internal error' },
      });
      const gw = makeGateway(client);

      const result = await gw.initiatePayment(makeInitiateInput());

      expect(result.error.isRetryable).toBe(true);
    });

    it('marks 429 rate-limit errors as retryable', async () => {
      const client = makeRazorpayClient();
      client.orders.create.mockRejectedValue({
        statusCode: 429,
        error: { code: 'RATE_LIMIT_EXCEEDED', description: 'Too many requests' },
      });
      const gw     = makeGateway(client);
      const result = await gw.initiatePayment(makeInitiateInput());
      expect(result.error.isRetryable).toBe(true);
    });

    it('uses transactionId in gateway notes', async () => {
      const client = makeRazorpayClient();
      const gw     = makeGateway(client);

      await gw.initiatePayment(makeInitiateInput());

      expect(client.orders.create).toHaveBeenCalledWith(
        expect.objectContaining({
          notes: expect.objectContaining({ transactionId: 'tx_001' }),
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // capturePayment
  // -------------------------------------------------------------------------

  describe('capturePayment', () => {
    it('calls payments.capture with correct args', async () => {
      const client = makeRazorpayClient();
      const gw     = makeGateway(client);

      const result = await gw.capturePayment(captureInput);

      expect(result.success).toBe(true);
      expect(result.capturedPaise).toBe(50000);
      expect(result.capturedAt).toBeInstanceOf(Date);
      expect(client.payments.capture).toHaveBeenCalledWith('pay_test_001', 50000, 'INR');
    });

    it('returns failure result when SDK throws', async () => {
      const client = makeRazorpayClient();
      client.payments.capture.mockRejectedValue({
        statusCode: 400,
        error: { code: 'BAD_REQUEST_ERROR', description: 'Already captured' },
      });
      const gw = makeGateway(client);

      const result = await gw.capturePayment(captureInput);

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('BAD_REQUEST_ERROR');
    });
  });

  // -------------------------------------------------------------------------
  // refundPayment
  // -------------------------------------------------------------------------

  describe('refundPayment', () => {
    it('calls payments.refund with correct amount and reason', async () => {
      const client = makeRazorpayClient();
      const gw     = makeGateway(client);

      const result = await gw.refundPayment(refundInput);

      expect(result.success).toBe(true);
      expect(result.gatewayRefundId).toBe('rfnd_test_001');
      expect(result.refundedPaise).toBe(20000);
      expect(result.refundedAt).toBeInstanceOf(Date);
      expect(client.payments.refund).toHaveBeenCalledWith(
        'pay_test_001',
        expect.objectContaining({ amount: 20000 }),
      );
    });

    it('uses default reason when none provided', async () => {
      const client = makeRazorpayClient();
      const gw     = makeGateway(client);

      await gw.refundPayment({ ...refundInput, reason: undefined });

      expect(client.payments.refund).toHaveBeenCalledWith(
        'pay_test_001',
        expect.objectContaining({ notes: { reason: 'Refund' } }),
      );
    });

    it('returns failure result when SDK throws', async () => {
      const client = makeRazorpayClient();
      client.payments.refund.mockRejectedValue({
        statusCode: 400,
        error: { code: 'BAD_REQUEST_ERROR', description: 'Refund not allowed' },
      });
      const gw = makeGateway(client);

      const result = await gw.refundPayment(refundInput);

      expect(result.success).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // verifyPayment
  // -------------------------------------------------------------------------

  describe('verifyPayment', () => {
    it('fetches by gatewayPaymentId when available', async () => {
      const client = makeRazorpayClient({
        paymentsFetch: {
          id: 'pay_test_001',
          order_id: 'order_test_001',
          status: 'authorized',
          amount: 50000,
          amount_refunded: 0,
          created_at: 1700000000,
        },
      });
      const gw = makeGateway(client);

      const result = await gw.verifyPayment(queryCtxWithPaymentId);

      expect(result.success).toBe(true);
      expect(result.resolvedStatus).toBe(PaymentTxStatus.AUTHORIZED);
      expect(client.payments.fetch).toHaveBeenCalledWith('pay_test_001');
    });

    it('fetches via orderId when no paymentId provided', async () => {
      const client = makeRazorpayClient();
      const gw     = makeGateway(client);

      const result = await gw.verifyPayment(queryCtxOrderOnly);

      expect(result.success).toBe(true);
      expect(client.orders.fetchPayments).toHaveBeenCalledWith('order_test_001');
    });

    it('resolves to CAPTURED for captured payment', async () => {
      const client = makeRazorpayClient({
        paymentsFetch: {
          id: 'pay_test_001',
          order_id: 'order_test_001',
          status: 'captured',
          amount: 50000,
          amount_refunded: 0,
          created_at: 1700000000,
        },
      });
      const gw = makeGateway(client);

      const result = await gw.verifyPayment(queryCtxWithPaymentId);
      expect(result.resolvedStatus).toBe(PaymentTxStatus.CAPTURED);
    });

    it('resolves to PARTIALLY_REFUNDED when partial refund issued', async () => {
      const client = makeRazorpayClient({
        paymentsFetch: {
          id: 'pay_test_001',
          order_id: 'order_test_001',
          status: 'captured',
          amount: 50000,
          amount_refunded: 20000,
          created_at: 1700000000,
        },
      });
      const gw = makeGateway(client);

      const result = await gw.verifyPayment(queryCtxWithPaymentId);
      expect(result.resolvedStatus).toBe(PaymentTxStatus.PARTIALLY_REFUNDED);
    });

    it('throws GatewayVerificationException when no identifier provided', async () => {
      const gw = makeGateway(makeRazorpayClient());

      await expect(
        gw.verifyPayment({ amountInPaise: 50000, storeId: 'store_001' }),
      ).rejects.toThrow(GatewayVerificationException);
    });

    it('throws GatewayVerificationException when order has no payments', async () => {
      const client = makeRazorpayClient({
        orderFetchPayments: { items: [] },
      });
      const gw = makeGateway(client);

      await expect(gw.verifyPayment(queryCtxOrderOnly)).rejects.toThrow(
        GatewayVerificationException,
      );
    });

    it('returns failure result when SDK throws non-verification error', async () => {
      const client = makeRazorpayClient();
      client.payments.fetch.mockRejectedValue({
        statusCode: 500,
        error: { code: 'SERVER_ERROR', description: 'Timeout' },
      });
      const gw = makeGateway(client);

      const result = await gw.verifyPayment(queryCtxWithPaymentId);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // cancelPayment
  // -------------------------------------------------------------------------

  describe('cancelPayment', () => {
    it('returns success without calling SDK (Razorpay has no cancel API)', async () => {
      const client = makeRazorpayClient();
      const gw     = makeGateway(client);

      const result = await gw.cancelPayment(queryCtxWithPaymentId);

      expect(result.success).toBe(true);
      expect(result.gatewayCode).toBe('razorpay');
      expect(client.orders.create).not.toHaveBeenCalled();
      expect(client.payments.capture).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Signature verification
  // -------------------------------------------------------------------------

  describe('verifyPaymentSignature', () => {
    it('returns true for a valid signature', () => {
      const { createHmac } = require('crypto');
      const secret    = 'test_secret_key';
      const orderId   = 'order_abc';
      const paymentId = 'pay_xyz';
      const signature = createHmac('sha256', secret)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

      const gw = makeGateway(makeRazorpayClient(), secret);
      expect(gw.verifyPaymentSignature(orderId, paymentId, signature)).toBe(true);
    });

    it('returns false for a tampered signature', () => {
      const gw = makeGateway(makeRazorpayClient(), 'test_secret_key');
      expect(
        gw.verifyPaymentSignature('order_abc', 'pay_xyz', 'tampered_signature'),
      ).toBe(false);
    });

    it('returns false when order or payment ID differs', () => {
      const { createHmac } = require('crypto');
      const secret    = 'test_secret_key';
      const signature = createHmac('sha256', secret)
        .update('order_abc|pay_xyz')
        .digest('hex');

      const gw = makeGateway(makeRazorpayClient(), secret);
      expect(gw.verifyPaymentSignature('order_WRONG', 'pay_xyz', signature)).toBe(false);
    });
  });

  describe('verifyWebhookSignature', () => {
    it('returns true for valid webhook signature', () => {
      const { createHmac } = require('crypto');
      const secret  = 'whsec_test_123';
      const rawBody = '{"event":"payment.captured"}';
      const sig     = createHmac('sha256', secret).update(rawBody).digest('hex');

      const gw = makeGateway(makeRazorpayClient());
      expect(gw.verifyWebhookSignature(rawBody, sig, secret)).toBe(true);
    });

    it('returns false for invalid webhook signature', () => {
      const gw = makeGateway(makeRazorpayClient());
      expect(
        gw.verifyWebhookSignature('{"event":"payment.captured"}', 'wrong', 'secret'),
      ).toBe(false);
    });
  });
});
