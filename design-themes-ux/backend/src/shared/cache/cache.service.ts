import {
  Injectable,
  Inject,
  Logger,
  OnModuleDestroy,
} from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from './cache.constants';

// Atomic compare-and-delete: only removes the key when the stored value
// matches the caller's token — prevents releasing another owner's lock
// after TTL expiry and re-acquisition by a different process.
const LUA_RELEASE_LOCK = `\
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
else
  return 0
end`;

@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async onModuleDestroy() {
    await this.redis.quit();
  }

  /** Returns parsed value or null on cache miss / Redis error */
  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.redis.get(key);
      if (raw === null) return null;
      return JSON.parse(raw) as T;
    } catch (err) {
      this.logger.warn(`Cache GET failed for key "${key}": ${err}`);
      return null;
    }
  }

  /** Serialises value and stores it. ttl = seconds; omit for no expiry. */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      const serialised = JSON.stringify(value);
      if (ttl) {
        await this.redis.set(key, serialised, 'EX', ttl);
      } else {
        await this.redis.set(key, serialised);
      }
    } catch (err) {
      this.logger.warn(`Cache SET failed for key "${key}": ${err}`);
    }
  }

  /** Delete a single key */
  async del(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (err) {
      this.logger.warn(`Cache DEL failed for key "${key}": ${err}`);
    }
  }

  /**
   * Delete all keys matching a glob pattern.
   * Uses SCAN to avoid blocking the Redis event loop.
   * Pattern example: `*:${storeId}:*`
   */
  async invalidatePattern(pattern: string): Promise<number> {
    try {
      let cursor = '0';
      let deleted = 0;

      do {
        const [nextCursor, keys] = await this.redis.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100,
        );
        cursor = nextCursor;

        if (keys.length > 0) {
          await this.redis.del(...keys);
          deleted += keys.length;
        }
      } while (cursor !== '0');

      this.logger.debug(
        `Invalidated ${deleted} keys matching pattern "${pattern}"`,
      );
      return deleted;
    } catch (err) {
      this.logger.warn(`Cache invalidation failed for pattern "${pattern}": ${err}`);
      return 0;
    }
  }

  /** Checks whether Redis connection is alive (used in health checks) */
  async ping(): Promise<boolean> {
    try {
      const res = await this.redis.ping();
      return res === 'PONG';
    } catch {
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Distributed lock — errors are PROPAGATED (not swallowed) so callers can
  // make explicit decisions (503, log, TTL-based cleanup, etc.).
  // ---------------------------------------------------------------------------

  /**
   * Attempt to acquire a distributed lock via Redis SET NX PX.
   *
   * Returns true only when the lock token is written.  On failure waits
   * retryIntervalMs and retries up to `retries` more times.
   * Total maximum wait = retries × retryIntervalMs ms.
   *
   * Callers should use:  retries = 30, retryIntervalMs = 200  (6 s window).
   */
  async acquireLock(
    key:             string,
    token:           string,
    ttlMs:           number,
    retries:         number,
    retryIntervalMs: number,
  ): Promise<boolean> {
    for (let attempt = 0; attempt <= retries; attempt++) {
      // set() with PX (ms TTL) + NX (only if not exists); returns 'OK' or null
      const result = await this.redis.set(key, token, 'PX', ttlMs, 'NX');
      if (result === 'OK') return true;
      if (attempt < retries) {
        await new Promise<void>((resolve) => setTimeout(resolve, retryIntervalMs));
      }
    }
    return false;
  }

  /**
   * Release a distributed lock using a Lua compare-and-delete.
   *
   * The key is deleted ONLY when the stored value equals `token`, preventing
   * a process from releasing a lock it no longer owns (e.g., after TTL expiry
   * and re-acquisition by another caller).
   *
   * Errors are propagated — wrap in try/catch in finally blocks and log at
   * WARN; the 30-second TTL ensures automatic cleanup on Redis failures.
   */
  async releaseLock(key: string, token: string): Promise<void> {
    await this.redis.eval(LUA_RELEASE_LOCK, 1, key, token);
  }
}
