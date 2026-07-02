import { PaymentTxStatus } from '@prisma/client';

import { GatewayCapability, InitiatePaymentInput, CaptureInput, RefundInput } from '../../types/payment.types';
import { GatewayStatusQueryContext } from '../../types/gateway-status-query.context';
import { CodPaymentGateway } from './cod-payment.gateway';

function makeInput(): InitiatePaymentInput {
  return {
    transactionId:     'tx_cod_001',
    checkoutSessionId: 'cs_001',
    storeId:           'store_001',
    amountInPaise:     25000,
    currency:          'INR',
    idempotencyKey:    'idem_cod_001',
  };
}

const captureInput: CaptureInput = {
  transactionId:  'tx_cod_001',
  storeId:        'store_001',
  amountInPaise:  25000,
  gatewayOrderId: 'cod_tx_cod_001',
  idempotencyKey: 'idem_cod_002',
};

const refundInput: RefundInput = {
  transactionId:  'tx_cod_001',
  storeId:        'store_001',
  amountInPaise:  25000,
  idempotencyKey: 'idem_cod_003',
};

const queryCtx: GatewayStatusQueryContext = {
  gatewayOrderId: 'cod_tx_cod_001',
  amountInPaise:  25000,
  storeId:        'store_001',
};

describe('CodPaymentGateway', () => {

  let gw: CodPaymentGateway;

  beforeEach(() => { gw = new CodPaymentGateway(); });

  // -------------------------------------------------------------------------
  // Capabilities
  // -------------------------------------------------------------------------

  describe('capabilities', () => {
    it('gatewayCode is "cod"', () => {
      expect(gw.capabilities.gatewayCode).toBe('cod');
    });

    it('isLiveCapable is true', () => {
      expect(gw.capabilities.isLiveCapable).toBe(true);
    });

    it('requiresWebhook is false', () => {
      expect(gw.capabilities.requiresWebhook).toBe(false);
    });

    it('supports DIRECT_CAPTURE, CANCEL, REFUND', () => {
      const { supports } = gw.capabilities;
      expect(supports.has(GatewayCapability.DIRECT_CAPTURE)).toBe(true);
      expect(supports.has(GatewayCapability.CANCEL)).toBe(true);
      expect(supports.has(GatewayCapability.REFUND)).toBe(true);
    });

    it('does NOT support AUTHORIZE_THEN_CAPTURE or WEBHOOK', () => {
      const { supports } = gw.capabilities;
      expect(supports.has(GatewayCapability.AUTHORIZE_THEN_CAPTURE)).toBe(false);
      expect(supports.has(GatewayCapability.WEBHOOK)).toBe(false);
    });

    it('does NOT support STATUS_QUERY (no external API)', () => {
      expect(gw.capabilities.supports.has(GatewayCapability.STATUS_QUERY)).toBe(false);
    });

    it('does NOT support PARTIAL_REFUND (COD refunds are full bank transfers)', () => {
      expect(gw.capabilities.supports.has(GatewayCapability.PARTIAL_REFUND)).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // initiatePayment
  // -------------------------------------------------------------------------

  describe('initiatePayment', () => {
    it('returns success immediately without any external call', async () => {
      const result = await gw.initiatePayment(makeInput());
      expect(result.success).toBe(true);
      expect(result.gatewayCode).toBe('cod');
    });

    it('gatewayOrderId encodes transactionId', async () => {
      const result = await gw.initiatePayment(makeInput());
      expect(result.gatewayOrderId).toBe('cod_tx_cod_001');
    });

    it('has no error on success', async () => {
      const result = await gw.initiatePayment(makeInput());
      expect(result.error).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // capturePayment
  // -------------------------------------------------------------------------

  describe('capturePayment', () => {
    it('returns success with exact captured amount', async () => {
      const result = await gw.capturePayment(captureInput);
      expect(result.success).toBe(true);
      expect(result.capturedPaise).toBe(25000);
    });

    it('capturedAt is a Date', async () => {
      const result = await gw.capturePayment(captureInput);
      expect(result.capturedAt).toBeInstanceOf(Date);
    });
  });

  // -------------------------------------------------------------------------
  // refundPayment
  // -------------------------------------------------------------------------

  describe('refundPayment', () => {
    it('returns success with refund ID and amount', async () => {
      const result = await gw.refundPayment(refundInput);
      expect(result.success).toBe(true);
      expect(result.refundedPaise).toBe(25000);
      expect(result.gatewayRefundId).toContain('cod_refund');
    });

    it('refundedAt is a Date', async () => {
      const result = await gw.refundPayment(refundInput);
      expect(result.refundedAt).toBeInstanceOf(Date);
    });
  });

  // -------------------------------------------------------------------------
  // verifyPayment
  // -------------------------------------------------------------------------

  describe('verifyPayment', () => {
    it('resolves to GATEWAY_CREATED (no real status query)', async () => {
      const result = await gw.verifyPayment(queryCtx);
      expect(result.success).toBe(true);
      expect(result.resolvedStatus).toBe(PaymentTxStatus.GATEWAY_CREATED);
      expect(result.rawGatewayStatus).toBe('cod_pending_delivery');
    });

    it('passes gatewayOrderId through', async () => {
      const result = await gw.verifyPayment(queryCtx);
      expect(result.gatewayOrderId).toBe('cod_tx_cod_001');
    });
  });

  // -------------------------------------------------------------------------
  // cancelPayment
  // -------------------------------------------------------------------------

  describe('cancelPayment', () => {
    it('returns success immediately', async () => {
      const result = await gw.cancelPayment(queryCtx);
      expect(result.success).toBe(true);
      expect(result.gatewayCode).toBe('cod');
    });
  });
});
