import { PaymentTxStatus } from '@prisma/client';
import { GatewayVerificationException } from '../../exceptions/payment.exceptions';

/**
 * Maps Razorpay payment.status strings to internal PaymentTxStatus.
 *
 * Razorpay payment statuses:
 *   created    — order created, customer has not yet paid
 *   authorized — payment received by Razorpay, awaiting merchant capture
 *   captured   — merchant has captured the payment; funds settled
 *   refunded   — payment fully refunded (amount_refunded === amount)
 *   failed     — payment attempt failed
 *
 * Razorpay has no native 'cancelled' or 'expired' concept for payments;
 * expired authorizations are surfaced as 'failed' with a specific error_code.
 * Partial refunds keep the payment in 'captured' state while amount_refunded > 0.
 */
export const RAZORPAY_PAYMENT_STATUS_MAP: Readonly<Record<string, PaymentTxStatus>> = {
  created:    PaymentTxStatus.GATEWAY_CREATED,
  authorized: PaymentTxStatus.AUTHORIZED,
  captured:   PaymentTxStatus.CAPTURED,
  refunded:   PaymentTxStatus.REFUNDED,
  failed:     PaymentTxStatus.FAILED,
};

export function mapRazorpayPaymentStatus(razorpayStatus: string): PaymentTxStatus {
  const mapped = RAZORPAY_PAYMENT_STATUS_MAP[razorpayStatus];
  if (mapped === undefined) {
    throw new GatewayVerificationException(
      'razorpay',
      `Unknown payment status: '${razorpayStatus}'`,
    );
  }
  return mapped;
}

/**
 * Resolves partial-refund state from raw Razorpay payment object.
 * Razorpay reports amount_refunded on captured payments; we promote
 * CAPTURED to PARTIALLY_REFUNDED when 0 < amount_refunded < amount.
 */
export function resolveRazorpayRefundStatus(payment: {
  status: string;
  amount: number;
  amount_refunded: number;
}): PaymentTxStatus {
  const base = mapRazorpayPaymentStatus(payment.status);

  if (
    base === PaymentTxStatus.CAPTURED &&
    payment.amount_refunded > 0 &&
    payment.amount_refunded < payment.amount
  ) {
    return PaymentTxStatus.PARTIALLY_REFUNDED;
  }

  return base;
}
