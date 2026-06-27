import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface CdnPurgeResult {
  success: boolean;
  statusCode?: number;
  error?: string;
}

/**
 * Fires a webhook to the configured CDN provider to purge cached pages.
 * Non-blocking by design — callers should fire-and-forget with .catch().
 *
 * Env vars:
 *   CDN_PURGE_URL   — webhook endpoint (e.g. Cloudflare zone purge URL)
 *   CDN_PURGE_TOKEN — Bearer token or API key
 *
 * If CDN_PURGE_URL is not configured the method is a no-op.
 */
@Injectable()
export class CdnService {
  private readonly logger = new Logger(CdnService.name);
  private readonly purgeUrl: string | undefined;
  private readonly purgeToken: string | undefined;

  constructor(private readonly config: ConfigService) {
    this.purgeUrl   = config.get<string>('CDN_PURGE_URL');
    this.purgeToken = config.get<string>('CDN_PURGE_TOKEN');
  }

  /**
   * Purge all cached pages for a store.
   * @param storeId  Used to build tag/prefix filter sent to the CDN.
   * @param paths    Optional explicit paths; if omitted the CDN is asked to
   *                 purge everything tagged with the store's domain prefix.
   */
  async purge(storeId: string, paths?: string[]): Promise<CdnPurgeResult> {
    if (!this.purgeUrl) {
      this.logger.debug('CDN_PURGE_URL not configured — skipping purge');
      return { success: true };
    }

    const payload = paths?.length
      ? { files: paths }
      : { tags: [`store-${storeId}`] };

    try {
      const response = await fetch(this.purgeUrl, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          Authorization:   `Bearer ${this.purgeToken ?? ''}`,
          'X-Store-Id':    storeId,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        this.logger.warn(
          `CDN purge returned ${response.status} for store ${storeId}: ${body}`,
        );
        return { success: false, statusCode: response.status, error: body };
      }

      this.logger.log(`CDN purge triggered for store ${storeId}`);
      return { success: true, statusCode: response.status };
    } catch (err: any) {
      this.logger.error(`CDN purge request failed for store ${storeId}: ${err.message}`);
      return { success: false, error: err.message };
    }
  }
}
