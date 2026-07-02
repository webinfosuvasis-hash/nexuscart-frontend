import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomBytes } from 'crypto';

const COOKIE_NAME = 'aurus_cart_sid';
const COOKIE_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;

@Injectable()
export class CartSessionMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const fromCookie = (req.cookies as Record<string, string> | undefined)?.[COOKIE_NAME];
    const fromHeader = req.headers['x-session-id'] as string | undefined;
    const existing   = fromCookie ?? fromHeader;

    const sessionId  = existing && this.isValid(existing) ? existing : randomBytes(16).toString('hex');

    if (!existing || existing !== sessionId) {
      res.cookie(COOKIE_NAME, sessionId, {
        httpOnly: true,
        secure:   process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge:   COOKIE_MAX_AGE_MS,
        path:     '/',
      });
    }

    req.cartSessionId = sessionId;
    req.storeId       = this.resolveStoreId(req);
    next();
  }

  private resolveStoreId(req: Request): string {
    return (
      (req.headers['x-store-id'] as string | undefined) ??
      (req.hostname.split('.')[0]) ??
      'default'
    );
  }

  private isValid(sid: string): boolean {
    return /^[0-9a-f]{32}$/i.test(sid);
  }
}
