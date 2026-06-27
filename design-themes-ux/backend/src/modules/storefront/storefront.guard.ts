import {
  CanActivate, ExecutionContext, Injectable,
  UnauthorizedException, ForbiddenException,
} from '@nestjs/common';
import { Request }       from 'express';
import { PreviewService } from '@/modules/theme-engine/preview/preview.service';

/**
 * StorefrontGuard — Sprint 5
 *
 * Validates the preview JWT on all /storefront/* endpoints.
 * The route must be marked @Public() so JwtAuthGuard skips it.
 * This guard then enforces preview-token authentication instead.
 *
 * Validation order:
 *   1. Extract Bearer token from Authorization header
 *   2. PreviewService.verifyToken(token) — validates signature, expiry, purpose
 *   3. token.storeId === path param :storeId — cross-tenant protection
 *   4. Attach validated token payload to request.previewToken
 */
@Injectable()
export class StorefrontGuard implements CanActivate {
  constructor(private readonly preview: PreviewService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request & { previewToken?: any }>();

    // Extract Bearer token
    const authHeader = req.headers['authorization'];
    const token      = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      throw new UnauthorizedException(
        'Preview token required. Include Authorization: Bearer <token> header.',
      );
    }

    // Validate and decode
    const storeId = req.params['storeId'] as string;
    const payload = this.preview.verifyToken(token, storeId);

    // Attach to request so controller can access themeId, pageId, etc.
    req.previewToken = payload;
    return true;
  }
}
