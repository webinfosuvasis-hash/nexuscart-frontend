import { CartSessionMiddleware } from './cart-session.middleware';

const VALID = 'a'.repeat(32);

function run(req: any) {
  const res = { cookie: jest.fn() } as any;
  const next = jest.fn();
  new CartSessionMiddleware().use(req, res, next);
  return { req, res, next };
}

const baseReq = (over: Record<string, unknown> = {}) =>
  ({ cookies: {}, headers: { 'x-store-id': 'store_1' }, hostname: 'shop.example', secure: true, ...over }) as any;

describe('CartSessionMiddleware', () => {
  it('uses a valid cart cookie as the session and does not re-issue it', () => {
    const { req, res, next } = run(baseReq({ cookies: { aurus_cart_sid: VALID } }));

    expect(req.cartSessionId).toBe(VALID);
    expect(res.cookie).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it('ignores an X-Session-Id header — the session id is never taken from a header', () => {
    const victim = 'b'.repeat(32);
    const { req, res } = run(baseReq({ headers: { 'x-session-id': victim, 'x-store-id': 'store_1' } }));

    expect(req.cartSessionId).not.toBe(victim);
    expect(req.cartSessionId).toMatch(/^[0-9a-f]{32}$/);
    expect(res.cookie).toHaveBeenCalledTimes(1);
  });

  it('replaces a malformed cookie with a fresh session', () => {
    const { req, res } = run(baseReq({ cookies: { aurus_cart_sid: 'not-a-session' } }));

    expect(req.cartSessionId).toMatch(/^[0-9a-f]{32}$/);
    expect(res.cookie).toHaveBeenCalledWith('aurus_cart_sid', req.cartSessionId, expect.anything());
  });

  it('issues an HttpOnly, Secure/SameSite=None (over HTTPS), 30-day, site-wide cookie', () => {
    const { res } = run(baseReq());

    expect(res.cookie.mock.calls[0][2]).toEqual({
      httpOnly: true, secure: true, sameSite: 'none', maxAge: 30 * 24 * 60 * 60 * 1000, path: '/',
    });
  });

  it('falls back to SameSite=Lax without Secure over plain HTTP', () => {
    const { res } = run(baseReq({ secure: false }));

    expect(res.cookie.mock.calls[0][2]).toMatchObject({ secure: false, sameSite: 'lax' });
  });

  it('is a no-op when another binding already resolved the session for this request', () => {
    const req = baseReq({ cartSessionId: VALID });
    const { res, next } = run(req);

    expect(req.cartSessionId).toBe(VALID);
    expect(res.cookie).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it('rotate() (logout) issues a brand-new session cookie and switches the request to it', () => {
    const req = baseReq({ cookies: { aurus_cart_sid: VALID }, cartSessionId: VALID });
    const res = { cookie: jest.fn() } as any;

    const fresh = CartSessionMiddleware.rotate(req, res);

    expect(fresh).toMatch(/^[0-9a-f]{32}$/);
    expect(fresh).not.toBe(VALID);
    expect(req.cartSessionId).toBe(fresh);
    expect(res.cookie).toHaveBeenCalledWith('aurus_cart_sid', fresh, expect.objectContaining({ httpOnly: true }));
  });
});
