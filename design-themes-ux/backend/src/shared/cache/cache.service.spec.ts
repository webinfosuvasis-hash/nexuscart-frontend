import { Test, TestingModule } from '@nestjs/testing';
import { CacheService } from './cache.service';
import { REDIS_CLIENT } from './cache.constants';

const mockRedis = {
  get:    jest.fn(),
  set:    jest.fn(),
  del:    jest.fn(),
  scan:   jest.fn(),
  ping:   jest.fn(),
  quit:   jest.fn(),
  eval:   jest.fn(),
};

describe('CacheService', () => {
  let service: CacheService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheService,
        { provide: REDIS_CLIENT, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<CacheService>(CacheService);
  });

  // ── get ─────────────────────────────────────────────────────────────────────

  describe('get', () => {
    it('returns parsed JSON on cache hit', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({ foo: 'bar' }));
      const result = await service.get<{ foo: string }>('some:key');
      expect(result).toEqual({ foo: 'bar' });
      expect(mockRedis.get).toHaveBeenCalledWith('some:key');
    });

    it('returns null on cache miss (Redis returns null)', async () => {
      mockRedis.get.mockResolvedValue(null);
      const result = await service.get('some:key');
      expect(result).toBeNull();
    });

    it('returns null and does NOT throw when Redis errors', async () => {
      mockRedis.get.mockRejectedValue(new Error('ECONNREFUSED'));
      await expect(service.get('some:key')).resolves.toBeNull();
    });
  });

  // ── set ─────────────────────────────────────────────────────────────────────

  describe('set', () => {
    it('calls Redis SET EX when ttl is provided', async () => {
      mockRedis.set.mockResolvedValue('OK');
      await service.set('k', { a: 1 }, 300);
      expect(mockRedis.set).toHaveBeenCalledWith('k', JSON.stringify({ a: 1 }), 'EX', 300);
    });

    it('calls Redis SET without EX when no ttl', async () => {
      mockRedis.set.mockResolvedValue('OK');
      await service.set('k', 'val');
      expect(mockRedis.set).toHaveBeenCalledWith('k', '"val"');
    });

    it('does NOT throw when Redis errors', async () => {
      mockRedis.set.mockRejectedValue(new Error('connection lost'));
      await expect(service.set('k', 'v', 60)).resolves.toBeUndefined();
    });
  });

  // ── del ─────────────────────────────────────────────────────────────────────

  describe('del', () => {
    it('calls Redis DEL with the key', async () => {
      mockRedis.del.mockResolvedValue(1);
      await service.del('my:key');
      expect(mockRedis.del).toHaveBeenCalledWith('my:key');
    });
  });

  // ── invalidatePattern ────────────────────────────────────────────────────────

  describe('invalidatePattern', () => {
    it('scans pages and deletes all matching keys', async () => {
      // First SCAN call returns cursor '42' + two keys
      mockRedis.scan
        .mockResolvedValueOnce(['42', ['theme:store1:draft', 'theme:store1:published']])
        // Second SCAN call returns cursor '0' (done) + one more key
        .mockResolvedValueOnce(['0', ['page:store1:home:sections:draft']]);
      mockRedis.del.mockResolvedValue(2);

      const count = await service.invalidatePattern('*:store1:*');

      expect(count).toBe(3);
      expect(mockRedis.scan).toHaveBeenCalledTimes(2);
      // DEL called twice — once per SCAN page
      expect(mockRedis.del).toHaveBeenCalledTimes(2);
    });

    it('returns 0 and does NOT throw when Redis errors', async () => {
      mockRedis.scan.mockRejectedValue(new Error('Redis down'));
      const count = await service.invalidatePattern('*:store1:*');
      expect(count).toBe(0);
    });

    it('returns 0 when no keys match pattern', async () => {
      mockRedis.scan.mockResolvedValue(['0', []]);
      const count = await service.invalidatePattern('*:nonexistent:*');
      expect(count).toBe(0);
      expect(mockRedis.del).not.toHaveBeenCalled();
    });
  });

  // ── ping ─────────────────────────────────────────────────────────────────────

  describe('ping', () => {
    it('returns true when Redis responds PONG', async () => {
      mockRedis.ping.mockResolvedValue('PONG');
      expect(await service.ping()).toBe(true);
    });

    it('returns false when Redis is down', async () => {
      mockRedis.ping.mockRejectedValue(new Error('ECONNREFUSED'));
      expect(await service.ping()).toBe(false);
    });
  });

  // ── acquireLock ───────────────────────────────────────────────────────────

  describe('acquireLock', () => {
    it('TEST-LOCK-1: returns true immediately when Redis SET NX succeeds', async () => {
      mockRedis.set.mockResolvedValue('OK');

      const result = await service.acquireLock('nexuscart:order-lock:order-1', 'uuid-token', 30_000, 30, 0);

      expect(result).toBe(true);
      expect(mockRedis.set).toHaveBeenCalledTimes(1);
      expect(mockRedis.set).toHaveBeenCalledWith(
        'nexuscart:order-lock:order-1',
        'uuid-token',
        'PX',
        30_000,
        'NX',
      );
    });

    it('TEST-LOCK-2: retries after null response and returns true when lock eventually acquired', async () => {
      // First two attempts fail (key exists); third succeeds
      mockRedis.set
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce('OK');

      const result = await service.acquireLock('k', 't', 30_000, 30, 0);

      expect(result).toBe(true);
      expect(mockRedis.set).toHaveBeenCalledTimes(3);
    });

    it('TEST-LOCK-3: returns false when all retries exhausted (retries=2 → 3 total SET calls)', async () => {
      mockRedis.set.mockResolvedValue(null);

      const result = await service.acquireLock('k', 't', 30_000, 2, 0);

      expect(result).toBe(false);
      // initial attempt + 2 retries = 3 total SET calls
      expect(mockRedis.set).toHaveBeenCalledTimes(3);
    });

    it('TEST-LOCK-4: propagates Redis errors — does not swallow or return false', async () => {
      mockRedis.set.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(
        service.acquireLock('k', 't', 30_000, 30, 0),
      ).rejects.toThrow('ECONNREFUSED');
    });

    it('TEST-LOCK-5: with retries=30 and retryIntervalMs=0 makes exactly 31 SET calls before returning false', async () => {
      mockRedis.set.mockResolvedValue(null);

      const result = await service.acquireLock('k', 't', 30_000, 30, 0);

      expect(result).toBe(false);
      // 1 initial + 30 retries = 31 SET calls; 30 sleeps at 0 ms each
      expect(mockRedis.set).toHaveBeenCalledTimes(31);
    });
  });

  // ── releaseLock ───────────────────────────────────────────────────────────

  describe('releaseLock', () => {
    it('TEST-LOCK-6: executes Lua script with exact KEYS[1]=key and ARGV[1]=token', async () => {
      mockRedis.eval.mockResolvedValue(1);

      await service.releaseLock('nexuscart:order-lock:order-1', 'my-uuid-token');

      expect(mockRedis.eval).toHaveBeenCalledTimes(1);
      const [script, numkeys, keyArg, tokenArg] = mockRedis.eval.mock.calls[0];
      expect(numkeys).toBe(1);
      expect(keyArg).toBe('nexuscart:order-lock:order-1');
      expect(tokenArg).toBe('my-uuid-token');
      // Script must reference KEYS[1] and ARGV[1]
      expect(script).toContain('KEYS[1]');
      expect(script).toContain('ARGV[1]');
    });

    it('TEST-LOCK-7: resolves without error when Lua returns 1 (lock deleted)', async () => {
      mockRedis.eval.mockResolvedValue(1);

      await expect(
        service.releaseLock('k', 'correct-token'),
      ).resolves.toBeUndefined();
    });

    it('TEST-LOCK-8: resolves without error when Lua returns 0 (token mismatch — foreign lock not touched)', async () => {
      mockRedis.eval.mockResolvedValue(0);

      await expect(
        service.releaseLock('k', 'wrong-token'),
      ).resolves.toBeUndefined();
    });

    it('TEST-LOCK-9: propagates Redis errors — does not swallow', async () => {
      mockRedis.eval.mockRejectedValue(new Error('Redis down'));

      await expect(
        service.releaseLock('k', 't'),
      ).rejects.toThrow('Redis down');
    });
  });
});
