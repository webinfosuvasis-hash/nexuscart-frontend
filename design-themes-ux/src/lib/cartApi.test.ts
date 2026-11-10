import { describe, it, expect } from 'vitest';
import { getCart, addToCart, updateCartItem, removeCartItem, applyPromotion, rotateCartSession, CartApiError } from './cartApi';
import { mockFetch, ok } from '@/test/utils';

const headersOf = (init?: RequestInit) => init!.headers as Record<string, string>;

describe('cartApi', () => {
  it('GET sends the session cookie + store id and no idempotency key', async () => {
    const spy = mockFetch(() => ok({ id: 'c1', items: [] }));
    await getCart();
    const [url, init] = spy.mock.calls[0];
    expect(String(url)).toBe('http://api.test/api/v1/cart');
    expect(init!.credentials).toBe('include');
    expect(headersOf(init)['X-Store-Id']).toBe('store_test');
    expect(headersOf(init)['Idempotency-Key']).toBeUndefined();
  });

  it('every mutation carries a fresh Idempotency-Key (safe to retry, never double-adds)', async () => {
    const spy = mockFetch(() => ok({ id: 'c1', items: [] }));
    await addToCart({ productId: 'p1', quantity: 1 });
    await addToCart({ productId: 'p1', quantity: 1 });
    const k1 = headersOf(spy.mock.calls[0][1])['Idempotency-Key'];
    const k2 = headersOf(spy.mock.calls[1][1])['Idempotency-Key'];
    expect(k1).toMatch(/^[0-9a-f-]{36}$/);
    expect(k1).not.toBe(k2);
    expect(spy.mock.calls[0][1]!.method).toBe('POST');
    expect(JSON.parse(spy.mock.calls[0][1]!.body as string)).toEqual({ productId: 'p1', quantity: 1 });
  });

  it('item and promotion ids are URL-encoded', async () => {
    const spy = mockFetch(() => ok({}));
    await updateCartItem('a/b', 3);
    await removeCartItem('x y');
    await applyPromotion('SAVE10');
    expect(String(spy.mock.calls[0][0])).toMatch(/\/cart\/items\/a%2Fb$/);
    expect(spy.mock.calls[0][1]!.method).toBe('PATCH');
    expect(String(spy.mock.calls[1][0])).toMatch(/\/cart\/items\/x%20y$/);
    expect(spy.mock.calls[1][1]!.method).toBe('DELETE');
    expect(String(spy.mock.calls[2][0])).toMatch(/\/cart\/promotions$/);
  });

  it('surfaces the backend errorCode and message (e.g. out of stock)', async () => {
    mockFetch(() => new Response(JSON.stringify({ errorCode: 'INSUFFICIENT_STOCK', message: 'Only 2 left' }), { status: 409 }));
    const err = await addToCart({ productId: 'p1', quantity: 5 }).catch((e) => e);
    expect(err).toBeInstanceOf(CartApiError);
    expect(err).toMatchObject({ status: 409, errorCode: 'INSUFFICIENT_STOCK', message: 'Only 2 left' });
  });

  it('copes with a non-JSON error body', async () => {
    mockFetch(() => new Response('<html>Bad Gateway</html>', { status: 502, statusText: 'Bad Gateway' }));
    await expect(getCart()).rejects.toMatchObject({ status: 502, errorCode: null, message: 'Bad Gateway' });
  });
});

describe('cartApi — rotateCartSession (logout)', () => {
  it('asks the backend for a fresh cart session cookie, with credentials, and tolerates the empty 204 body', async () => {
    const spy = mockFetch(() => new Response(null, { status: 204 }));

    await expect(rotateCartSession()).resolves.toBeUndefined();

    const [url, init] = spy.mock.calls[0];
    expect(String(url)).toBe('http://api.test/api/v1/cart/session/rotate');
    expect(init!.method).toBe('POST');
    expect(init!.credentials).toBe('include');
  });

  it('surfaces a failure so the caller can decide (logout treats it as best-effort)', async () => {
    mockFetch(() => new Response(null, { status: 500, statusText: 'boom' }));
    await expect(rotateCartSession()).rejects.toBeInstanceOf(CartApiError);
  });
});
