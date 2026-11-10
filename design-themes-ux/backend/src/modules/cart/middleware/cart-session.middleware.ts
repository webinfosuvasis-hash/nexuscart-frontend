import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomBytes } from 'crypto';

const COOKIE_NAME = 'aurus_cart_sid';
// The cart session is the only proof of ownership for a guest cart and
// checkout, so it is not kept indefinitely: 30 days, renewed whenever a new
// id is issued.
const COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class CartSessionMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    // Several modules bind this middleware to overlapping paths (e.g.
    // checkout/:id/pay) — the first run decides the session for the request.
    if (req.cartSessionId) {
      next();
      return;
    }

    // Cookie only. An `X-Session-Id` header is deliberately NOT accepted: the
    // session id is a bearer credential, and taking it from a header would
    // let anyone who learned the value act as that cart's owner, bypassing
    // the cookie's HttpOnly protection.
    const existing  = (req.cookies as Record<string, string> | undefined)?.[COOKIE_NAME];
    const sessionId = existing && CartSessionMiddleware.isValid(existing) ? existing : CartSessionMiddleware.newId();

    if (existing !== sessionId) {
      CartSessionMiddleware.setCookie(req, res, sessionId);
    }

    req.cartSessionId = sessionId;
    req.storeId       = this.resolveStoreId(req);
    next();
  }

  /**
   * Starts a fresh, empty cart session for this browser (logout). The old
   * session's cart and any checkout on it stay behind, unreachable from here;
   * held stock is returned when that checkout's hold expires.
   */
  static rotate(req: Request, res: Response): string {
    const sessionId = CartSessionMiddleware.newId();
    CartSessionMiddleware.setCookie(req, res, sessionId);
    req.cartSessionId = sessionId;
    return sessionId;
  }

  private static setCookie(req: Request, res: Response, sessionId: string): void {
    // SameSite=None is required for the frontend/backend split deployed on
    // separate Railway domains (cross-origin fetch) — but None is rejected
    // by browsers unless Secure is also set, so fall back to Lax whenever
    // the request isn't HTTPS (e.g. the same-origin-over-HTTP EC2 setup,
    // where Lax already works and req.secure is always false).
    res.cookie(COOKIE_NAME, sessionId, {
      httpOnly: true,
      secure:   req.secure,
      sameSite: req.secure ? 'none' : 'lax',
      maxAge:   COOKIE_MAX_AGE_MS,
      path:     '/',
    });
  }

  private static newId(): string {
    return randomBytes(16).toString('hex');
  }

  private resolveStoreId(req: Request): string {
    return (
      (req.headers['x-store-id'] as string | undefined) ??
      (req.hostname.split('.')[0]) ??
      'default'
    );
  }

  private static isValid(sid: string): boolean {
    return /^[0-9a-f]{32}$/i.test(sid);
  }
}
