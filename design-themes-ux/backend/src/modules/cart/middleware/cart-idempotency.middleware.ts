import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { createHash } from 'crypto';
import { CacheService } from '../../../shared/cache/cache.service';

interface IdempotencyRecord {
  state:      'PROCESSING' | 'COMPLETED' | 'FAILED';
  bodyHash:   string;
  statusCode: number;
  body:       unknown;
  createdAt:  number;
  failedAt?:  number;
}

const TTL_SECONDS     = 86_400;      // 24 h
const FAILED_RETRY_MS = 5 * 60_000; // 5 min

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class CartIdempotencyMiddleware implements NestMiddleware {
  private readonly logger = new Logger(CartIdempotencyMiddleware.name);

  constructor(private readonly cache: CacheService) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (SAFE_METHODS.has(req.method)) { next(); return; }

    const idempotencyKey = req.headers['idempotency-key'] as string | undefined;
    if (!idempotencyKey) { next(); return; }

    const storeId    = req.storeId ?? 'default';
    const sessionId  = req.cartSessionId ?? 'unknown';
    const customerId = (req as Request & { customerId?: string }).customerId;
    const bodyHash   = this.hashBody(req.method, req.path, req.body as unknown, storeId, sessionId);
    const cacheKey   = customerId
      ? `idempotency:${storeId}:${customerId}:${sessionId}:${idempotencyKey}`
      : `idempotency:${storeId}:${sessionId}:${idempotencyKey}`;

    const existing = await this.cache.get<IdempotencyRecord>(cacheKey);

    if (existing) {
      if (existing.state === 'PROCESSING') {
        res.status(409).json({
          success:   false,
          errorCode: 'IDEMPOTENCY_PROCESSING',
          message:   'A request with this Idempotency-Key is already in flight',
        });
        return;
      }

      if (existing.bodyHash !== bodyHash) {
        res.status(409).json({
          success:   false,
          errorCode: 'IDEMPOTENCY_PAYLOAD_MISMATCH',
          message:   'Idempotency-Key reused with a different request body',
        });
        return;
      }

      if (existing.state === 'COMPLETED') {
        res.status(existing.statusCode).json(existing.body);
        return;
      }

      if (existing.state === 'FAILED') {
        const elapsed = Date.now() - (existing.failedAt ?? existing.createdAt);
        if (elapsed < FAILED_RETRY_MS) {
          res.status(existing.statusCode).json(existing.body);
          return;
        }
        // TTL expired on FAILED — allow retry
      }
    }

    // Mark PROCESSING
    const record: IdempotencyRecord = {
      state:      'PROCESSING',
      bodyHash,
      statusCode: 0,
      body:       null,
      createdAt:  Date.now(),
    };
    await this.cache.set(cacheKey, record, TTL_SECONDS);

    // Intercept response to capture final state
    const originalJson = res.json.bind(res);
    res.json = (body: unknown): Response => {
      const finalRecord: IdempotencyRecord = {
        state:      res.statusCode >= 400 ? 'FAILED' : 'COMPLETED',
        bodyHash,
        statusCode: res.statusCode,
        body,
        createdAt:  record.createdAt,
        failedAt:   res.statusCode >= 400 ? Date.now() : undefined,
      };
      this.cache.set(cacheKey, finalRecord, TTL_SECONDS).catch((err) => {
        this.logger.error(`Failed to update idempotency record: ${String(err)}`);
      });
      return originalJson(body);
    };

    next();
  }

  private hashBody(
    method:    string,
    path:      string,
    body:      unknown,
    storeId:   string,
    sessionId: string,
  ): string {
    const sortedBody = body && typeof body === 'object'
      ? JSON.stringify(this.sortKeys(body as Record<string, unknown>))
      : String(body ?? '');
    const input = `${method}|${path}|${sortedBody}|${storeId}|${sessionId}`;
    return createHash('sha256').update(input).digest('hex');
  }

  private sortKeys(obj: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(
      Object.keys(obj)
        .sort()
        .map((k) => [k, typeof obj[k] === 'object' && obj[k] !== null
          ? this.sortKeys(obj[k] as Record<string, unknown>)
          : obj[k]]),
    );
  }
}
