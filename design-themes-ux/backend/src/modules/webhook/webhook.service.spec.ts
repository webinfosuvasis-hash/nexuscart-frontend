import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { WebhookService } from './webhook.service';
import { WebhookSignatureService } from './webhook-signature.service';
import { WebhookController } from './webhook.controller';
import { PaymentService } from '../payment/payment.service';
import { PaymentOrchestratorService } from '../payment-orchestrator/payment-orchestrator.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  InvalidPaymentTransitionException,
  PaymentInTerminalStateException,
} from '../payment/exceptions/payment.exceptions';
import { PaymentTxStatus } from '@prisma/client';

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

const RAZORPAY_SECRET = 'test-razorpay-secret';
const STRIPE_SECRET   = 'whsec_test_stripe_secret';
const TX_ID           = 'tx_test_001';
const STORE_ID        = 'store_test_001';
const PAYMENT_ID      = 'pay_test_001';
const ORDER_ID        = 'order_test_001';
const LOG_ID          = 'log_test_001';

function makeRazorpayPayload(event: string, extra?: object) {
  return {
    entity:     'event',
    account_id: 'acc_test',
    event,
    contains:   ['payment'],
    payload: {
      payment: {
        entity: {
          id:               PAYMENT_ID,
          entity:           'payment',
          amount:           5000,
          currency:         'INR',
          status:           'captured',
          order_id:         ORDER_ID,
          amount_refunded:  0,
          captured:         true,
          email:            null,
          contact:          null,
          notes:            {},
          error_code:       null,
          error_description: null,
          created_at:       Math.floor(Date.now() / 1000),
          ...extra,
        },
      },
    },
    created_at: Math.floor(Date.now() / 1000),
  };
}

function razorpaySignature(body: Buffer, secret: string): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}

function makeStripeSignature(body: Buffer, secret: string, timestamp?: number): string {
  const ts = timestamp ?? Math.floor(Date.now() / 1000);
  const signed = Buffer.concat([Buffer.from(`${ts}.`, 'utf8'), body]);
  const sig = createHmac('sha256', secret).update(signed).digest('hex');
  return `t=${ts},v1=${sig}`;
}

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const makePrisma = () => ({
  webhookLog: {
    create:    jest.fn().mockResolvedValue({ id: LOG_ID }),
    update:    jest.fn().mockResolvedValue({ id: LOG_ID }),
    findFirst: jest.fn().mockResolvedValue(null),
  },
  paymentTransaction: {
    findFirst: jest.fn().mockResolvedValue({
      id:      TX_ID,
      storeId: STORE_ID,
      status:  'GATEWAY_CREATED',
    }),
  },
});

const makePaymentSvc = () => ({
  authorizePayment:     jest.fn().mockResolvedValue({ id: TX_ID, status: 'AUTHORIZED' }),
  recordGatewayCapture: jest.fn().mockResolvedValue({ id: TX_ID, status: 'CAPTURED' }),
  recordGatewayFailure: jest.fn().mockResolvedValue({ id: TX_ID, status: 'FAILED' }),
});

const makeOrchestrator = () => ({
  completePayment: jest.fn().mockResolvedValue({ recovered: false, orderId: 'order_001' }),
});

const makeConfig = () => ({
  get: jest.fn((key: string, fallback: string) => {
    if (key === 'payment.razorpay.webhookSecret') return RAZORPAY_SECRET;
    if (key === 'payment.stripe.webhookSecret')   return STRIPE_SECRET;
    return fallback ?? '';
  }),
});

// ---------------------------------------------------------------------------
// WebhookSignatureService unit tests
// ---------------------------------------------------------------------------

describe('WebhookSignatureService', () => {
  let svc: WebhookSignatureService;

  beforeEach(() => {
    svc = new WebhookSignatureService();
  });

  describe('verifyRazorpay', () => {
    it('returns valid=true for correct signature', () => {
      const body = Buffer.from(JSON.stringify({ event: 'payment.captured' }));
      const sig  = razorpaySignature(body, RAZORPAY_SECRET);
      expect(svc.verifyRazorpay(body, sig, RAZORPAY_SECRET)).toEqual({ valid: true });
    });

    it('returns valid=false for tampered signature', () => {
      const body = Buffer.from('body');
      const result = svc.verifyRazorpay(body, 'deadbeef', RAZORPAY_SECRET);
      expect(result.valid).toBe(false);
      expect(result.reason).toBeTruthy();
    });

    it('returns valid=false when secret is empty', () => {
      const body = Buffer.from('body');
      const result = svc.verifyRazorpay(body, 'sig', '');
      expect(result.valid).toBe(false);
    });

    it('returns valid=false when signature is missing', () => {
      const body = Buffer.from('body');
      const result = svc.verifyRazorpay(body, '', RAZORPAY_SECRET);
      expect(result.valid).toBe(false);
    });
  });

  describe('verifyStripe', () => {
    it('returns valid=true for correct signature', () => {
      const body   = Buffer.from(JSON.stringify({ type: 'payment_intent.succeeded' }));
      const header = makeStripeSignature(body, STRIPE_SECRET);
      expect(svc.verifyStripe(body, header, STRIPE_SECRET)).toEqual({ valid: true });
    });

    it('returns valid=false for expired timestamp', () => {
      const body   = Buffer.from('body');
      const oldTs  = Math.floor(Date.now() / 1000) - 400;
      const header = makeStripeSignature(body, STRIPE_SECRET, oldTs);
      const result = svc.verifyStripe(body, header, STRIPE_SECRET, 300);
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/tolerance/);
    });

    it('returns valid=false for wrong signature', () => {
      const body   = Buffer.from('body');
      const ts     = Math.floor(Date.now() / 1000);
      const header = `t=${ts},v1=badc0de`;
      const result = svc.verifyStripe(body, header, STRIPE_SECRET);
      expect(result.valid).toBe(false);
    });

    it('returns valid=false when secret is empty', () => {
      const body   = Buffer.from('body');
      const header = makeStripeSignature(body, STRIPE_SECRET);
      const result = svc.verifyStripe(body, header, '');
      expect(result.valid).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// WebhookService integration-style unit tests
// ---------------------------------------------------------------------------

describe('WebhookService', () => {
  let service:     WebhookService;
  let prisma:      ReturnType<typeof makePrisma>;
  let paymentSvc:  ReturnType<typeof makePaymentSvc>;
  let orchestrator: ReturnType<typeof makeOrchestrator>;
  let config:      ReturnType<typeof makeConfig>;

  beforeEach(async () => {
    prisma       = makePrisma();
    paymentSvc   = makePaymentSvc();
    orchestrator = makeOrchestrator();
    config       = makeConfig();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookService,
        WebhookSignatureService,
        { provide: PrismaService,              useValue: prisma },
        { provide: ConfigService,              useValue: config },
        { provide: PaymentService,             useValue: paymentSvc },
        { provide: PaymentOrchestratorService, useValue: orchestrator },
      ],
    }).compile();

    service = module.get(WebhookService);
  });

  // ── Helper to build a valid Razorpay request ──────────────────────────────

  function razorpayRequest(event: string, extra?: object) {
    const body = Buffer.from(JSON.stringify(makeRazorpayPayload(event, extra)));
    const sig  = razorpaySignature(body, RAZORPAY_SECRET);
    return { body, sig };
  }

  // ── Razorpay ──────────────────────────────────────────────────────────────

  it('marks log FAILED and returns {received:true} when Razorpay signature is invalid', async () => {
    const body = Buffer.from('{"event":"payment.captured"}');
    const result = await service.handleRazorpay(body, 'invalid-sig');

    expect(result).toEqual({ received: true });
    expect(prisma.webhookLog.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) }),
    );
    expect(paymentSvc.recordGatewayCapture).not.toHaveBeenCalled();
  });

  it('marks log DUPLICATE and skips processing for repeated Razorpay event', async () => {
    prisma.webhookLog.findFirst.mockResolvedValueOnce({ id: 'existing-log' });
    const { body, sig } = razorpayRequest('payment.captured');

    const result = await service.handleRazorpay(body, sig);

    expect(result).toEqual({ received: true });
    expect(prisma.webhookLog.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'DUPLICATE' }) }),
    );
    expect(paymentSvc.recordGatewayCapture).not.toHaveBeenCalled();
  });

  it('calls authorizePayment for payment.authorized event', async () => {
    const { body, sig } = razorpayRequest('payment.authorized');
    await service.handleRazorpay(body, sig);

    expect(paymentSvc.authorizePayment).toHaveBeenCalledWith(
      expect.objectContaining({
        transactionId:    TX_ID,
        storeId:          STORE_ID,
        gatewayPaymentId: PAYMENT_ID,
      }),
    );
  });

  it('calls recordGatewayCapture + orchestrator for payment.captured event', async () => {
    const { body, sig } = razorpayRequest('payment.captured');
    await service.handleRazorpay(body, sig);

    expect(paymentSvc.recordGatewayCapture).toHaveBeenCalledWith(
      expect.objectContaining({
        transactionId:    TX_ID,
        storeId:          STORE_ID,
        capturedPaise:    5000,
        gatewayPaymentId: PAYMENT_ID,
      }),
    );
    expect(orchestrator.completePayment).toHaveBeenCalledWith(TX_ID, STORE_ID);
  });

  it('P1-1: marks log FAILED when orchestrator throws, enabling gateway retry', async () => {
    orchestrator.completePayment.mockRejectedValueOnce(new Error('DB timeout'));
    const { body, sig } = razorpayRequest('payment.captured');
    const result = await service.handleRazorpay(body, sig);

    expect(result).toEqual({ received: true });
    // Log is FAILED so the next gateway retry will reprocess (no SUCCESS to DUPLICATE against)
    expect(prisma.webhookLog.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) }),
    );
    // recordGatewayCapture was already called — capture is durable regardless
    expect(paymentSvc.recordGatewayCapture).toHaveBeenCalledTimes(1);
  });

  it('calls recordGatewayFailure for payment.failed event', async () => {
    const { body, sig } = razorpayRequest('payment.failed');
    await service.handleRazorpay(body, sig);

    expect(paymentSvc.recordGatewayFailure).toHaveBeenCalledWith(
      TX_ID,
      STORE_ID,
      expect.stringContaining(PAYMENT_ID),
    );
  });

  it('marks log SKIPPED when PaymentTransaction is not found', async () => {
    prisma.paymentTransaction.findFirst.mockResolvedValueOnce(null);
    const { body, sig } = razorpayRequest('payment.captured');
    await service.handleRazorpay(body, sig);

    expect(prisma.webhookLog.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'SKIPPED' }) }),
    );
    expect(paymentSvc.recordGatewayCapture).not.toHaveBeenCalled();
  });

  it('treats out-of-order payment.authorized for CAPTURED tx as no-op and marks SUCCESS', async () => {
    paymentSvc.authorizePayment.mockRejectedValueOnce(
      new PaymentInTerminalStateException(TX_ID, PaymentTxStatus.CAPTURED),
    );
    const { body, sig } = razorpayRequest('payment.authorized');
    const result = await service.handleRazorpay(body, sig);

    expect(result).toEqual({ received: true });
    expect(prisma.webhookLog.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'SUCCESS' }) }),
    );
  });

  it('marks log SUCCESS when recordGatewayCapture is already CAPTURED (idempotent)', async () => {
    // PaymentService.recordGatewayCapture is idempotent — returns existing tx when already captured
    paymentSvc.recordGatewayCapture.mockResolvedValueOnce({ id: TX_ID, status: 'CAPTURED' });
    const { body, sig } = razorpayRequest('payment.captured');
    const result = await service.handleRazorpay(body, sig);

    expect(result).toEqual({ received: true });
    expect(prisma.webhookLog.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'SUCCESS' }) }),
    );
  });

  it('treats out-of-order InvalidPaymentTransitionException as no-op and marks SUCCESS', async () => {
    paymentSvc.recordGatewayCapture.mockRejectedValueOnce(
      new InvalidPaymentTransitionException(
        PaymentTxStatus.PENDING,
        PaymentTxStatus.CAPTURED,
        TX_ID,
      ),
    );
    const { body, sig } = razorpayRequest('payment.captured');
    const result = await service.handleRazorpay(body, sig);

    expect(result).toEqual({ received: true });
    expect(prisma.webhookLog.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'SUCCESS' }) }),
    );
  });

  // ── Stripe ────────────────────────────────────────────────────────────────

  function stripeRequest(eventType: string, intentId = 'pi_test_001', amount_received = 5000) {
    const payload = {
      id:       `evt_${Date.now()}`,
      object:   'event',
      type:     eventType,
      created:  Math.floor(Date.now() / 1000),
      livemode: false,
      data: {
        object: {
          id:              intentId,
          amount_received,
          status:          'succeeded',
        },
      },
    };
    const body = Buffer.from(JSON.stringify(payload));
    const sig  = makeStripeSignature(body, STRIPE_SECRET);
    return { body, sig };
  }

  beforeEach(() => {
    // Default Stripe tx lookup returns a tx with gatewayIntentId
    prisma.paymentTransaction.findFirst.mockResolvedValue({
      id:      TX_ID,
      storeId: STORE_ID,
      status:  'GATEWAY_CREATED',
    });
  });

  it('marks Stripe log FAILED when signature is invalid', async () => {
    const body = Buffer.from('{"type":"payment_intent.succeeded"}');
    const result = await service.handleStripe(body, 'bad-sig');

    expect(result).toEqual({ received: true });
    expect(prisma.webhookLog.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) }),
    );
  });

  it('calls recordGatewayCapture + orchestrator for payment_intent.succeeded', async () => {
    const { body, sig } = stripeRequest('payment_intent.succeeded', 'pi_test_001', 10000);
    await service.handleStripe(body, sig);

    expect(paymentSvc.recordGatewayCapture).toHaveBeenCalledWith(
      expect.objectContaining({
        transactionId: TX_ID,
        storeId:       STORE_ID,
        capturedPaise: 10000,
      }),
    );
    expect(orchestrator.completePayment).toHaveBeenCalledWith(TX_ID, STORE_ID);
  });

  it('calls recordGatewayFailure for payment_intent.payment_failed', async () => {
    const { body, sig } = stripeRequest('payment_intent.payment_failed');
    await service.handleStripe(body, sig);

    expect(paymentSvc.recordGatewayFailure).toHaveBeenCalledWith(
      TX_ID,
      STORE_ID,
      expect.stringContaining('pi_test_001'),
    );
  });

  it('marks Stripe log DUPLICATE for repeated event', async () => {
    prisma.webhookLog.findFirst.mockResolvedValueOnce({ id: 'existing-log' });
    const { body, sig } = stripeRequest('payment_intent.succeeded');
    await service.handleStripe(body, sig);

    expect(prisma.webhookLog.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'DUPLICATE' }) }),
    );
    expect(paymentSvc.recordGatewayCapture).not.toHaveBeenCalled();
  });

  // ── Regression: P1-1 orchestrator recovery ────────────────────────────────

  it('P1-1: gateway retry after completePayment failure re-invokes orchestrator', async () => {
    orchestrator.completePayment.mockRejectedValueOnce(new Error('DB timeout'));
    const { body, sig } = razorpayRequest('payment.captured');

    // First attempt — orchestrator fails → log FAILED
    const first = await service.handleRazorpay(body, sig);
    expect(first).toEqual({ received: true });
    expect(orchestrator.completePayment).toHaveBeenCalledTimes(1);

    // Second attempt (gateway retry) — orchestrator now succeeds → log SUCCESS
    const second = await service.handleRazorpay(body, sig);
    expect(second).toEqual({ received: true });
    expect(orchestrator.completePayment).toHaveBeenCalledTimes(2);
    expect(prisma.webhookLog.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'SUCCESS' }) }),
    );
  });

  // ── Regression: P1-2 Stripe payload validation ────────────────────────────

  it('P1-2: marks log FAILED and returns {received:true} when payload.data.object is missing', async () => {
    const payloadObj = {
      id:       `evt_${Date.now()}`,
      object:   'event',
      type:     'payment_intent.succeeded',
      created:  Math.floor(Date.now() / 1000),
      livemode: false,
      data:     {},   // ← no object field
    };
    const body = Buffer.from(JSON.stringify(payloadObj));
    const sig  = makeStripeSignature(body, STRIPE_SECRET);

    const result = await service.handleStripe(body, sig);

    expect(result).toEqual({ received: true });
    expect(prisma.webhookLog.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) }),
    );
    expect(paymentSvc.recordGatewayCapture).not.toHaveBeenCalled();
  });

  it('P1-2: marks log FAILED when data.object.id is not a string', async () => {
    const payloadObj = {
      id:       `evt_${Date.now()}`,
      object:   'event',
      type:     'payment_intent.succeeded',
      created:  Math.floor(Date.now() / 1000),
      livemode: false,
      data:     { object: { id: 42, amount_received: 5000 } },  // id is number, not string
    };
    const body = Buffer.from(JSON.stringify(payloadObj));
    const sig  = makeStripeSignature(body, STRIPE_SECRET);

    const result = await service.handleStripe(body, sig);

    expect(result).toEqual({ received: true });
    expect(prisma.webhookLog.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) }),
    );
    expect(paymentSvc.recordGatewayCapture).not.toHaveBeenCalled();
  });

  // ── Regression: P1-3 event ID validation ─────────────────────────────────

  it('P1-3: marks log SKIPPED when Razorpay payload.event is missing', async () => {
    const payloadObj = {
      entity:     'event',
      account_id: 'acc_test',
      // event field deliberately absent
      contains:   ['payment'],
      payload: {
        payment: {
          entity: {
            id: PAYMENT_ID, entity: 'payment', amount: 5000, currency: 'INR',
            status: 'captured', order_id: ORDER_ID, amount_refunded: 0, captured: true,
            email: null, contact: null, notes: {}, error_code: null, error_description: null,
            created_at: Math.floor(Date.now() / 1000),
          },
        },
      },
      created_at: Math.floor(Date.now() / 1000),
    };
    const body = Buffer.from(JSON.stringify(payloadObj));
    const sig  = razorpaySignature(body, RAZORPAY_SECRET);

    await service.handleRazorpay(body, sig);

    expect(prisma.webhookLog.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'SKIPPED' }) }),
    );
    expect(paymentSvc.recordGatewayCapture).not.toHaveBeenCalled();
    // dedup query must NOT have fired (would be the first findFirst call if it had)
    expect(prisma.webhookLog.findFirst).not.toHaveBeenCalled();
  });

  it('P1-3: marks log SKIPPED when Stripe payload.id is missing', async () => {
    const payloadObj = {
      // id field deliberately absent
      object:   'event',
      type:     'payment_intent.succeeded',
      created:  Math.floor(Date.now() / 1000),
      livemode: false,
      data: { object: { id: 'pi_test_001', amount_received: 5000, status: 'succeeded' } },
    };
    const body = Buffer.from(JSON.stringify(payloadObj));
    const sig  = makeStripeSignature(body, STRIPE_SECRET);

    await service.handleStripe(body, sig);

    expect(prisma.webhookLog.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'SKIPPED' }) }),
    );
    expect(paymentSvc.recordGatewayCapture).not.toHaveBeenCalled();
    expect(prisma.webhookLog.findFirst).not.toHaveBeenCalled();
  });

  it('P1-3: marks log SKIPPED when Stripe payload.id is empty string', async () => {
    const payloadObj = {
      id:       '',   // empty string — falsy gatewayEventId
      object:   'event',
      type:     'payment_intent.succeeded',
      created:  Math.floor(Date.now() / 1000),
      livemode: false,
      data: { object: { id: 'pi_test_001', amount_received: 5000, status: 'succeeded' } },
    };
    const body = Buffer.from(JSON.stringify(payloadObj));
    const sig  = makeStripeSignature(body, STRIPE_SECRET);

    await service.handleStripe(body, sig);

    expect(prisma.webhookLog.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'SKIPPED' }) }),
    );
    expect(prisma.webhookLog.findFirst).not.toHaveBeenCalled();
  });

  // ── Regression: P2-3 amount_received validation ───────────────────────────

  it('P2-3: marks log FAILED and never calls recordGatewayCapture when amount_received is 0', async () => {
    const { body, sig } = stripeRequest('payment_intent.succeeded', 'pi_test_001', 0);

    const result = await service.handleStripe(body, sig);

    expect(result).toEqual({ received: true });
    expect(prisma.webhookLog.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) }),
    );
    expect(paymentSvc.recordGatewayCapture).not.toHaveBeenCalled();
    expect(orchestrator.completePayment).not.toHaveBeenCalled();
  });

  it('P2-3: marks log FAILED when amount_received is negative', async () => {
    const { body, sig } = stripeRequest('payment_intent.succeeded', 'pi_test_001', -100);

    const result = await service.handleStripe(body, sig);

    expect(result).toEqual({ received: true });
    expect(prisma.webhookLog.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) }),
    );
    expect(paymentSvc.recordGatewayCapture).not.toHaveBeenCalled();
  });

  // ── Regression: P2-2 secret misconfiguration ──────────────────────────────

  it('P2-2: marks log FAILED when RAZORPAY_WEBHOOK_SECRET is empty (misconfigured)', async () => {
    config.get.mockImplementation((key: string, fb: string) =>
      key === 'payment.razorpay.webhookSecret' ? '' : (fb ?? ''),
    );
    const body = Buffer.from(JSON.stringify(makeRazorpayPayload('payment.captured')));
    const sig  = razorpaySignature(body, RAZORPAY_SECRET);

    const result = await service.handleRazorpay(body, sig);

    expect(result).toEqual({ received: true });
    expect(prisma.webhookLog.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) }),
    );
    expect(paymentSvc.recordGatewayCapture).not.toHaveBeenCalled();
  });

  it('P2-2: marks log FAILED when STRIPE_WEBHOOK_SECRET is empty (misconfigured)', async () => {
    config.get.mockImplementation((key: string, fb: string) =>
      key === 'payment.stripe.webhookSecret' ? '' : (fb ?? ''),
    );
    const { body, sig } = stripeRequest('payment_intent.succeeded');

    const result = await service.handleStripe(body, sig);

    expect(result).toEqual({ received: true });
    expect(prisma.webhookLog.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) }),
    );
    expect(paymentSvc.recordGatewayCapture).not.toHaveBeenCalled();
  });

  // ── Regression: P2-1 throttle bypass ─────────────────────────────────────

  it('P2-1: WebhookController has @SkipThrottle metadata to bypass ThrottlerGuard', () => {
    // @SkipThrottle() sets a THROTTLER:SKIP* key via SetMetadata; the exact suffix depends
    // on the throttler name (defaults to 'THROTTLER:SKIPdefault').
    const metadataKeys = Reflect.getMetadataKeys(WebhookController) as string[];
    const hasSkipThrottle = metadataKeys.some(k => k.startsWith('THROTTLER:SKIP'));
    expect(hasSkipThrottle).toBe(true);
  });
});
