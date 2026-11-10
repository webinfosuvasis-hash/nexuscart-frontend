import { describe, it, expect } from 'vitest';
import {
  DEFAULT_PAYMENT_METHOD, PAYMENT_METHODS, getPaymentMethod, resolvePaymentSubmission,
} from './paymentMethods';

describe('payment method catalogue', () => {
  it('offers the six methods, Cash on Delivery first and selected by default', () => {
    expect(PAYMENT_METHODS.map((m) => m.label)).toEqual(['Cash on Delivery', 'UPI', 'Credit Card', 'Debit Card', 'Net Banking', 'Wallets']);
    expect(DEFAULT_PAYMENT_METHOD).toBe('cod');
  });

  it('carries no availability wording for the customer to see', () => {
    const text = PAYMENT_METHODS.map((m) => `${m.label} ${m.description}`).join(' ');
    expect(text).not.toMatch(/coming soon|unavailable|not configured|demo/i);
  });

  it('getPaymentMethod returns the matching method', () => {
    expect(getPaymentMethod('net_banking').label).toBe('Net Banking');
  });
});

describe('resolvePaymentSubmission (selection is separate from processing)', () => {
  it('submits Cash on Delivery through the cod gateway', () => {
    expect(resolvePaymentSubmission('cod')).toEqual({ kind: 'submit', gatewayCode: 'cod' });
  });

  it.each(['upi', 'credit_card', 'debit_card', 'net_banking', 'wallet'] as const)(
    'blocks %s: no gateway yet, and it is never turned into COD',
    (id) => {
      expect(resolvePaymentSubmission(id)).toEqual({ kind: 'blocked' });
    },
  );
});
