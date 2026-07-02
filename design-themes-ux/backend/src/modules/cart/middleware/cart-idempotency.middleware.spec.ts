import { CartIdempotencyMiddleware } from './cart-idempotency.middleware';
import type { CacheService } from '../../../shared/cache/cache.service';

const mockCache = () => ({
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
});

function buildReq(overrides: Partial<{
  method: string; path: string; headers: Record<string, string>;
  body: unknown; storeId: string; cartSessionId: string;
}> = {}) {
  return {
    method:        overrides.method        ?? 'POST',
    path:          overrides.path          ?? '/api/v1/cart/items',
    headers:       overrides.headers       ?? { 'idempotency-key': 'key-123' },
    body:          overrides.body          ?? { productId: 'p1', quantity: 1 },
    storeId:       overrides.storeId       ?? 'store-1',
    cartSessionId: overrides.cartSessionId ?? 'sess-1',
  } as any;
}

function buildRes() {
  const res: any = { statusCode: 200 };
  res.status  = jest.fn().mockReturnValue(res);
  res.json    = jest.fn().mockReturnValue(res);
  return res;
}

describe('CartIdempotencyMiddleware', () => {
  let middleware: CartIdempotencyMiddleware;
  let cache: ReturnType<typeof mockCache>;

  beforeEach(() => {
    cache = mockCache();
    middleware = new CartIdempotencyMiddleware(cache as unknown as CacheService);
  });

  describe('safe methods', () => {
    it('passes through GET without checking cache', async () => {
      const next = jest.fn();
      const req  = buildReq({ method: 'GET' });
      await middleware.use(req, buildRes(), next);
      expect(next).toHaveBeenCalled();
      expect(cache.get).not.toHaveBeenCalled();
    });
  });

  describe('no idempotency key', () => {
    it('passes through POST without Idempotency-Key header', async () => {
      const next = jest.fn();
      const req  = buildReq({ headers: {} });
      await middleware.use(req, buildRes(), next);
      expect(next).toHaveBeenCalled();
      expect(cache.get).not.toHaveBeenCalled();
    });
  });

  describe('PROCESSING state', () => {
    it('returns 409 IDEMPOTENCY_PROCESSING when another request is in flight', async () => {
      cache.get.mockResolvedValue({ state: 'PROCESSING', bodyHash: 'any', statusCode: 0, body: null, createdAt: Date.now() });
      const res  = buildRes();
      const next = jest.fn();
      await middleware.use(buildReq(), res, next);
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ errorCode: 'IDEMPOTENCY_PROCESSING' }));
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('COMPLETED state', () => {
    it('replays cached response without calling next', async () => {
      const cachedBody = { success: true, data: { id: 'cart-1' } };
      // Build the same bodyHash the middleware would compute
      const req = buildReq();
      // First call to get returns the record matching the body hash
      // We rely on the middleware computing the same hash both times
      const mw2 = new CartIdempotencyMiddleware(cache as unknown as CacheService);
      // Capture the hash by intercepting the first write
      let capturedRecord: any;
      cache.set.mockImplementationOnce(async (_k: string, v: any) => { capturedRecord = v; });
      const next = jest.fn();
      const res1 = buildRes();
      await mw2.use(req, res1, next);
      // Now set cache to return COMPLETED with the recorded bodyHash
      cache.get.mockResolvedValue({
        state: 'COMPLETED',
        bodyHash: capturedRecord.bodyHash,
        statusCode: 200,
        body: cachedBody,
        createdAt: Date.now(),
      });
      const res2 = buildRes();
      const next2 = jest.fn();
      await mw2.use(buildReq(), res2, next2);
      expect(res2.status).toHaveBeenCalledWith(200);
      expect(res2.json).toHaveBeenCalledWith(cachedBody);
      expect(next2).not.toHaveBeenCalled();
    });
  });

  describe('payload mismatch', () => {
    it('returns 409 IDEMPOTENCY_PAYLOAD_MISMATCH when body hash differs', async () => {
      cache.get.mockResolvedValue({
        state: 'COMPLETED', bodyHash: 'different-hash',
        statusCode: 200, body: {}, createdAt: Date.now(),
      });
      const res  = buildRes();
      const next = jest.fn();
      await middleware.use(buildReq(), res, next);
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ errorCode: 'IDEMPOTENCY_PAYLOAD_MISMATCH' }));
    });
  });

  describe('first request', () => {
    it('writes PROCESSING record and calls next', async () => {
      const next = jest.fn();
      await middleware.use(buildReq(), buildRes(), next);
      expect(cache.set).toHaveBeenCalledWith(
        expect.stringMatching(/^idempotency:store-1:sess-1:/),
        expect.objectContaining({ state: 'PROCESSING' }),
        expect.any(Number),
      );
      expect(next).toHaveBeenCalled();
    });
  });
});
