import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '@/prisma/prisma.service';
import { CacheService } from '@/shared/cache/cache.service';

/** Redis TTL for the active-theme lookup (5 min — invalidated on theme activation) */
const ACTIVE_THEME_TTL = 300;

/**
 * ThemeContextMiddleware
 *
 * Runs on all /api/v1/theme/* routes (registered in AppModule).
 * Resolves the active themeId for the current store and attaches it
 * to the request as `request.themeId`.
 *
 * Resolution order:
 *   1. X-Theme-Id header — used when editing a specific (non-active) installed theme
 *   2. Redis cache key active-theme:{storeId} — fast path for the active theme
 *   3. MySQL StoreTheme WHERE isActive = true — cache miss fallback
 *   4. null — if no store context or no active theme
 *
 * The resolved themeId is consumed by @CurrentTheme() decorator in controllers.
 */
@Injectable()
export class ThemeContextMiddleware implements NestMiddleware {
  private readonly logger = new Logger(ThemeContextMiddleware.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache:  CacheService,
  ) {}

  async use(
    req: Request & { storeId?: string; themeId?: string | null },
    _: Response,
    next: NextFunction,
  ) {
    // 1. Explicit override via header (editing a non-active theme)
    const explicit = req.headers['x-theme-id'] as string | undefined;
    if (explicit?.trim()) {
      req.themeId = explicit.trim();
      return next();
    }

    // 2. Resolve from active theme — only when storeId is available
    const storeId = req.storeId;
    if (!storeId) {
      req.themeId = null;
      return next();
    }

    // 3. Try Redis cache
    const cacheKey = `active-theme:${storeId}`;
    const cached   = await this.cache.get<string>(cacheKey);
    if (cached) {
      req.themeId = cached;
      return next();
    }

    // 4. MySQL fallback
    try {
      const active = await this.prisma.storeTheme.findFirst({
        where:  { storeId, isActive: true },
        select: { themeId: true },
      });
      const themeId = active?.themeId ?? null;
      req.themeId   = themeId;

      if (themeId) {
        await this.cache.set(cacheKey, themeId, ACTIVE_THEME_TTL);
      }
    } catch (err) {
      this.logger.warn(`ThemeContextMiddleware: failed to resolve themeId for store ${storeId}: ${err}`);
      req.themeId = null;
    }

    next();
  }

  /**
   * Call this whenever a theme is activated or deactivated so the cache
   * reflects the new state immediately.
   * Used by ThemesService.activateTheme().
   */
  static cacheKey(storeId: string): string {
    return `active-theme:${storeId}`;
  }
}
