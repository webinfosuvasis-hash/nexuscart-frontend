import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService }     from '@nestjs/jwt';
import { ConfigService }  from '@nestjs/config';

export interface PreviewToken {
  storeId:  string;
  themeId:  string;   // ADDED in Sprint 4.5 — identifies which theme to preview
  pageId:   string;
  purpose:  'preview';
  exp:      number;
}

export interface PreviewLinkResult {
  url:       string;
  expiresAt: string;
  token:     string;
  themeId:   string;
}

/**
 * Generates signed preview links (24h TTL) for draft storefront pages.
 * CHANGED in Sprint 4.5: JWT now includes `themeId` so the Storefront
 * Renderer knows which theme's draft to render.
 *
 * Env vars:
 *   PREVIEW_JWT_SECRET — dedicated secret (falls back to JWT_SECRET)
 *   STOREFRONT_BASE_URL — e.g. http://localhost:8080 (React SPA) or future SSR renderer
 */
@Injectable()
export class PreviewService {
  private readonly logger          = new Logger(PreviewService.name);
  private readonly storefrontBase: string;

  constructor(
    private readonly jwt:    JwtService,
    private readonly config: ConfigService,
  ) {
    this.storefrontBase = config.get<string>('STOREFRONT_BASE_URL', 'http://localhost:8080');
  }

  /**
   * Creates a signed JWT preview URL for a specific store+theme+page.
   * URL: {storefrontBase}/preview/{storeId}/{pageId}?token={jwt}
   */
  async generatePreviewLink(
    storeId: string,
    themeId: string,
    pageId:  string,
  ): Promise<PreviewLinkResult> {
    const ttlSeconds = 24 * 60 * 60;
    const expiresAt  = new Date(Date.now() + ttlSeconds * 1000);

    const previewSecret = this.config.get<string>('PREVIEW_JWT_SECRET');
    if (!previewSecret) throw new Error('PREVIEW_JWT_SECRET is not configured');

    const token = this.jwt.sign(
      { storeId, themeId, pageId, purpose: 'preview' },
      { secret: previewSecret, expiresIn: ttlSeconds },
    );

    const url = `${this.storefrontBase}/preview/${storeId}/${encodeURIComponent(pageId)}?token=${token}`;

    this.logger.debug(`Generated preview link store=${storeId} theme=${themeId} page=${pageId}`);

    return { url, expiresAt: expiresAt.toISOString(), token, themeId };
  }

  /**
   * Validates a preview token. Called by StorefrontController (Sprint 5-6).
   * Throws UnauthorizedException for invalid or expired tokens.
   * Also validates that the token's storeId matches the requested storeId
   * (cross-tenant protection).
   */
  verifyToken(token: string, expectedStoreId?: string): PreviewToken {
    let payload: PreviewToken;
    const previewSecret = this.config.get<string>('PREVIEW_JWT_SECRET');
    if (!previewSecret) throw new UnauthorizedException('Preview link is invalid or has expired.');
    try {
      payload = this.jwt.verify<PreviewToken>(token, { secret: previewSecret });
    } catch {
      throw new UnauthorizedException('Preview link is invalid or has expired.');
    }

    if (payload.purpose !== 'preview') {
      throw new UnauthorizedException('Token type is not valid for preview access.');
    }

    if (expectedStoreId && payload.storeId !== expectedStoreId) {
      throw new UnauthorizedException('Preview token does not match the requested store.');
    }

    // Backward compatibility: tokens without themeId (pre-Sprint 4.5)
    // are still accepted — themeId will default to 'default' at the renderer level.
    return payload;
  }
}
