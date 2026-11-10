/**
 * Checkout payment methods — what the customer *chooses* — kept separate from
 * payment processing (which backend gateway charges them).
 *
 * `gatewayCode` is the backend gateway that processes the method. Only Cash on
 * Delivery has one today. The online methods are shown and selectable, but
 * have no gateway until a real integration (e.g. Razorpay Checkout) is built
 * and tested; until then an online selection can never be submitted, is never
 * converted into COD, and never creates a payment transaction.
 *
 * To go live with online payments: build the gateway's client step (for
 * Razorpay, checkout.js + signature verification via the existing webhook),
 * then set `gatewayCode: 'razorpay'` on the online methods below.
 */

export type PaymentMethodId = 'cod' | 'upi' | 'credit_card' | 'debit_card' | 'net_banking' | 'wallet';

/** Backend gateway codes the storefront may submit (mirrors the backend allowlist). */
export type GatewayCode = 'cod' | 'razorpay';

export interface PaymentMethodOption {
  id:          PaymentMethodId;
  label:       string;
  description: string;
  /** Gateway that processes this method; null = no gateway connected yet. */
  gatewayCode: GatewayCode | null;
}

export const PAYMENT_METHODS: readonly PaymentMethodOption[] = [
  { id: 'cod',         label: 'Cash on Delivery', description: 'Pay in cash at your doorstep',               gatewayCode: 'cod' },
  { id: 'upi',         label: 'UPI',              description: 'GPay · PhonePe · Paytm · BHIM',             gatewayCode: null },
  { id: 'credit_card', label: 'Credit Card',      description: 'Visa · Mastercard · RuPay · Amex',          gatewayCode: null },
  { id: 'debit_card',  label: 'Debit Card',       description: 'Visa · Mastercard · RuPay',                gatewayCode: null },
  { id: 'net_banking', label: 'Net Banking',      description: 'SBI · HDFC · ICICI · Axis & more',          gatewayCode: null },
  { id: 'wallet',      label: 'Wallets',          description: 'Paytm · PhonePe · Amazon Pay',             gatewayCode: null },
];

export const DEFAULT_PAYMENT_METHOD: PaymentMethodId = 'cod';

export function getPaymentMethod(id: PaymentMethodId): PaymentMethodOption {
  return PAYMENT_METHODS.find((m) => m.id === id) ?? PAYMENT_METHODS[0];
}

/**
 * What placing the order with this method would do. `submit` carries the
 * gateway to send to the backend; `blocked` means there is no gateway to
 * process the method, so nothing must be sent.
 */
export type PaymentSubmission =
  | { kind: 'submit'; gatewayCode: GatewayCode }
  | { kind: 'blocked' };

export function resolvePaymentSubmission(id: PaymentMethodId): PaymentSubmission {
  const method = PAYMENT_METHODS.find((m) => m.id === id);
  return method?.gatewayCode ? { kind: 'submit', gatewayCode: method.gatewayCode } : { kind: 'blocked' };
}
