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
});
