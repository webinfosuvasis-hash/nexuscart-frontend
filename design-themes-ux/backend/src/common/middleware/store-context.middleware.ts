import { Injectable, NestMiddleware, BadRequestException, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '@/prisma/prisma.service';
import { CacheService } from '@/shared/cache/cache.service';
import { CACHE_KEYS, CACHE_TTL } from '@/shared/cache/cache.constants';
import { PerfTimer } from '@/common/perf-timer.util';

interface StoreContext { id: string; status: string }

/**
 * Resolves and validates `X-Store-Id` on every request. Runs ahead of every
 * route in the app, so an uncached DB round trip here taxes every single
 * endpoint — cached in Redis, ACTIVE-only (see below), invalidated on any
 * store write (StoresService, SubscriptionsService.upgrade — see those files).
 */
@Injectable()
export class StoreContextMiddleware implements NestMiddleware {
  private readonly logger = new Logger(StoreContextMiddleware.name);
  private readonly perfDebug = process.env.ENABLE_PERF_DEBUG === 'true';

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache:  CacheService,
  ) {}

  async use(req: Request & { storeId?: string }, res: Response, next: NextFunction) {
    const storeId = req.headers['x-store-id'] as string;

    if (storeId) {
      const timer = this.perfDebug ? new PerfTimer() : undefined;
      const cacheKey = CACHE_KEYS.storeContext(storeId);

      const getCached = () => this.cache.get<StoreContext>(cacheKey);
      const cached = timer ? await timer.time('redisLookup', getCached) : await getCached();

      let store: StoreContext | null;
      let outcome: 'hit' | 'miss';

      if (cached) {
        store = cached;
        outcome = 'hit';
      } else {
        outcome = 'miss';
        const findStore = () => this.prisma.store.findUnique({
          where: { id: storeId },
          select: { id: true, status: true },
        });
        store = timer ? await timer.time('dbLookup', findStore) : await findStore();

        // Only ACTIVE is cached: SUSPENDED/CANCELLED must never be served
        // stale-positive out of cache (that would let a just-suspended store
        // keep working for up to the TTL), and TRIAL is transient enough that
        // caching it buys little. Explicit write-time invalidation (see
        // StoresService, SubscriptionsService) still covers ACTIVE -> other
        // transitions immediately; this is a belt-and-suspenders default.
        if (store && store.status === 'ACTIVE') {
          await this.cache.set(cacheKey, store, CACHE_TTL.STORE_CONTEXT);
        }
      }

      if (timer) {
        const { totalMs, steps } = timer.summary();
        this.logger.log(`storeContext perf: outcome=${outcome} total=${totalMs}ms steps=${JSON.stringify(steps)}`);
      }

      if (!store) throw new BadRequestException('Store not found');
      if (store.status === 'SUSPENDED') throw new BadRequestException('Store is suspended');

      req.storeId = storeId;
    }

    next();
  }
}
