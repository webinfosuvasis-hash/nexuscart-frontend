import { PaymentTxStatus } from '@prisma/client';
import { GatewayVerificationException } from '../../exceptions/payment.exceptions';
import {
  RAZORPAY_PAYMENT_STATUS_MAP,
  mapRazorpayPaymentStatus,
  resolveRazorpayRefundStatus,
} from './razorpay-status.mapper';

describe('Razorpay status mapper', () => {
  // -------------------------------------------------------------------------
  // mapRazorpayPaymentStatus
  // -------------------------------------------------------------------------

  describe('mapRazorpayPaymentStatus', () => {
    const cases: [string, PaymentTxStatus][] = [
      ['created',    PaymentTxStatus.GATEWAY_CREATED],
      ['authorized', PaymentTxStatus.AUTHORIZED],
      ['captured',   PaymentTxStatus.CAPTURED],
      ['refunded',   PaymentTxStatus.REFUNDED],
      ['failed',     PaymentTxStatus.FAILED],
    ];

    test.each(cases)("'%s' → %s", (razorpayStatus, expected) => {
      expect(mapRazorpayPaymentStatus(razorpayStatus)).toBe(expected);
    });

    it('throws GatewayVerificationException for unknown status', () => {
      expect(() => mapRazorpayPaymentStatus('pending')).toThrow(
        GatewayVerificationException,
      );
    });

    it('GatewayVerificationException includes the unknown status in message', () => {
      let caught: GatewayVerificationException;
      try {
        mapRazorpayPaymentStatus('unknown_xyz');
      } catch (e) {
        caught = e as GatewayVerificationException;
      }
      expect(caught.message).toContain('unknown_xyz');
      expect(caught.gatewayCode).toBe('razorpay');
    });

    it('throws for empty string', () => {
      expect(() => mapRazorpayPaymentStatus('')).toThrow(GatewayVerificationException);
    });

    it('throws for null-ish string input', () => {
      expect(() => mapRazorpayPaymentStatus('null')).toThrow(GatewayVerificationException);
    });

    it('RAZORPAY_PAYMENT_STATUS_MAP covers all 5 known statuses', () => {
      expect(Object.keys(RAZORPAY_PAYMENT_STATUS_MAP)).toHaveLength(5);
    });
  });

  // -------------------------------------------------------------------------
  // resolveRazorpayRefundStatus
  // -------------------------------------------------------------------------

  describe('resolveRazorpayRefundStatus', () => {
    it('returns CAPTURED when no refund has been issued', () => {
      expect(
        resolveRazorpayRefundStatus({ status: 'captured', amount: 10000, amount_refunded: 0 }),
      ).toBe(PaymentTxStatus.CAPTURED);
    });

    it('returns PARTIALLY_REFUNDED when partial refund issued', () => {
      expect(
        resolveRazorpayRefundStatus({ status: 'captured', amount: 10000, amount_refunded: 5000 }),
      ).toBe(PaymentTxStatus.PARTIALLY_REFUNDED);
    });

    it('returns REFUNDED when full refund is issued and status is refunded', () => {
      expect(
        resolveRazorpayRefundStatus({ status: 'refunded', amount: 10000, amount_refunded: 10000 }),
      ).toBe(PaymentTxStatus.REFUNDED);
    });

    it('returns CAPTURED when amount_refunded equals amount but status is still captured (edge case)', () => {
      // Razorpay eventually flips status to 'refunded'; during transition status=captured
      expect(
        resolveRazorpayRefundStatus({ status: 'captured', amount: 10000, amount_refunded: 10000 }),
      ).toBe(PaymentTxStatus.CAPTURED);
    });

    it('passes through non-captured statuses unchanged', () => {
      expect(
        resolveRazorpayRefundStatus({ status: 'authorized', amount: 10000, amount_refunded: 0 }),
      ).toBe(PaymentTxStatus.AUTHORIZED);

      expect(
        resolveRazorpayRefundStatus({ status: 'failed', amount: 10000, amount_refunded: 0 }),
      ).toBe(PaymentTxStatus.FAILED);
    });

    it('throws GatewayVerificationException for unknown base status', () => {
      expect(() =>
        resolveRazorpayRefundStatus({ status: 'pending', amount: 10000, amount_refunded: 0 }),
      ).toThrow(GatewayVerificationException);
    });
  });
});
