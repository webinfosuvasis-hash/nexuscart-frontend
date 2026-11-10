import { describe, it, expect } from 'vitest';
import { initiateGuestPayment, retryGuestPayment, getGuestPaymentStatus, initiatePayment, CustomerAuthApiError } from './customerPaymentApi';
import { mockFetch, ok, fail } from '@/test/utils';

describe('customerPaymentApi — guest checkout', () => {
  it('pays through the guest route with the cart-session cookie and no bearer token', async () => {
    const spy = mockFetch(() => ok({ paymentId: 'pay_1', status: 'CAPTURED', orderId: 'order_1' }));

    const result = await initiateGuestPayment('chk_1', 'cod');

    const [url, init] = spy.mock.calls[0];
    expect(String(url)).toBe('http://api.test/api/v1/guest-checkout/chk_1/pay');
    expect(init?.method).toBe('POST');
    expect(init?.credentials).toBe('include');
    expect(init?.body).toBe(JSON.stringify({ gatewayCode: 'cod' }));
    expect(init?.headers).toMatchObject({ 'X-Store-Id': 'store_test' });
    expect(init?.headers).not.toHaveProperty('Authorization');
    expect(result.orderId).toBe('order_1');
  });

  it('uses the guest status and retry routes', async () => {
    const spy = mockFetch(() => ok({ id: 'pay_1', status: 'FAILED', orderId: null }));

    await getGuestPaymentStatus('pay_1');
    await retryGuestPayment('pay_1');

    expect(String(spy.mock.calls[0][0])).toBe('http://api.test/api/v1/guest-checkout/payments/pay_1/status');
    expect(String(spy.mock.calls[1][0])).toBe('http://api.test/api/v1/guest-checkout/payments/pay_1/retry');
  });

  it('surfaces the backend message as a CustomerAuthApiError', async () => {
    mockFetch(() => fail(400, 'An email address is required to check out as a guest'));

    const err = await initiateGuestPayment('chk_1').catch((e) => e);
    expect(err).toBeInstanceOf(CustomerAuthApiError);
    expect(err.message).toBe('An email address is required to check out as a guest');
  });
});

describe('customerPaymentApi — signed-in payment', () => {
  it('sends the cart cookie, so the backend can check the checkout belongs to this cart session', async () => {
    const spy = mockFetch(() => ok({ paymentId: 'pay_1', status: 'CAPTURED', orderId: 'order_1', orderNumber: 'ORD-2026-000001' }));

    const result = await initiatePayment('chk_1', 'cod');

    const [url, init] = spy.mock.calls[0];
    expect(String(url)).toBe('http://api.test/api/v1/checkout/chk_1/pay');
    expect(init?.credentials).toBe('include');
    expect(result.orderNumber).toBe('ORD-2026-000001');
  });
});
