import { PaymentTxStatus } from '@prisma/client';

export const TERMINAL_STATES: ReadonlySet<PaymentTxStatus> = new Set([
  PaymentTxStatus.FAILED,
  PaymentTxStatus.CANCELLED,
  PaymentTxStatus.EXPIRED,
  PaymentTxStatus.REFUNDED,
]);

/**
 * Complete forward-only state machine for PaymentTransaction.
 *
 * GATEWAY_CREATED → CAPTURED is valid for direct-capture gateways (UPI, COD)
 * that skip the separate authorization step.
 * PARTIALLY_REFUNDED is non-terminal: it transitions to REFUNDED on full refund.
 */
export const ALLOWED_TRANSITIONS: ReadonlyMap<
  PaymentTxStatus,
  ReadonlySet<PaymentTxStatus>
> = new Map([
  [
    PaymentTxStatus.PENDING,
    new Set([
      PaymentTxStatus.GATEWAY_CREATED,
      PaymentTxStatus.FAILED,
      PaymentTxStatus.CANCELLED,
    ]),
  ],
  [
    PaymentTxStatus.GATEWAY_CREATED,
    new Set([
      PaymentTxStatus.AUTHORIZED,
      PaymentTxStatus.CAPTURED,
      PaymentTxStatus.FAILED,
      PaymentTxStatus.CANCELLED,
      PaymentTxStatus.EXPIRED,
    ]),
  ],
  [
    PaymentTxStatus.AUTHORIZED,
    new Set([
      PaymentTxStatus.CAPTURED,
      PaymentTxStatus.FAILED,
      PaymentTxStatus.CANCELLED,
    ]),
  ],
  [
    PaymentTxStatus.CAPTURED,
    new Set([
      PaymentTxStatus.REFUNDED,
      PaymentTxStatus.PARTIALLY_REFUNDED,
    ]),
  ],
  [
    PaymentTxStatus.PARTIALLY_REFUNDED,
    new Set([PaymentTxStatus.REFUNDED]),
  ],
  [PaymentTxStatus.FAILED,    new Set<PaymentTxStatus>()],
  [PaymentTxStatus.CANCELLED, new Set<PaymentTxStatus>()],
  [PaymentTxStatus.EXPIRED,   new Set<PaymentTxStatus>()],
  [PaymentTxStatus.REFUNDED,  new Set<PaymentTxStatus>()],
]);

export function isTerminal(status: PaymentTxStatus): boolean {
  return TERMINAL_STATES.has(status);
}

export function canTransition(
  from: PaymentTxStatus,
  to: PaymentTxStatus,
): boolean {
  return ALLOWED_TRANSITIONS.get(from)?.has(to) ?? false;
}

export function getAllowedTransitions(
  from: PaymentTxStatus,
): PaymentTxStatus[] {
  return Array.from(ALLOWED_TRANSITIONS.get(from) ?? []);
}
