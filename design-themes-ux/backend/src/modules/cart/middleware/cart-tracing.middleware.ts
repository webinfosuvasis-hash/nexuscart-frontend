import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomBytes } from 'crypto';

@Injectable()
export class CartTracingMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    req.traceId       = this.parseTraceparent(req.headers['traceparent'] as string | undefined)
                         ?? randomBytes(16).toString('hex');
    req.spanId        = randomBytes(8).toString('hex');
    req.correlationId = (req.headers['x-correlation-id'] as string | undefined) ?? req.traceId;
    req.requestId     = (req.headers['x-request-id'] as string | undefined)     ?? randomBytes(8).toString('hex');
    next();
  }

  private parseTraceparent(header: string | undefined): string | null {
    if (!header) return null;
    // W3C traceparent: 00-{traceId32hex}-{spanId16hex}-{flags}
    const parts = header.split('-');
    if (parts.length >= 2 && /^[0-9a-f]{32}$/i.test(parts[1])) {
      return parts[1].toLowerCase();
    }
    return null;
  }
}
