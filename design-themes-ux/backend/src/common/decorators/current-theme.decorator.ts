import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Extracts the resolved themeId from the request.
 * Populated by ThemeContextMiddleware which runs on all /theme/* routes.
 *
 * Resolution order:
 *   1. X-Theme-Id header (explicit — for editing non-active themes)
 *   2. Active StoreTheme for the request's storeId (fallback)
 *   3. null if no store context is available
 */
export const CurrentTheme = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | null => {
    const request = ctx.switchToHttp().getRequest();
    return (request.themeId ?? null) as string | null;
  },
);
