import {
  Injectable,
  Inject,
  Logger,
  OnModuleDestroy,
} from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from './cache.constants';

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
}
