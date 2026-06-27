import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { CacheService } from '@/shared/cache/cache.service';

/**
 * FeatureFlagService — Sprint 10, Step 4
 *
 * Redis-based per-store feature flags.
 *
 * Core guarantee:
 *   Every store defaults to flag=false without any explicit set.
 *   No existing store's behaviour changes unless enable() is called explicitly.
 *
 * Flags:
 *   CONTENT_NODE_ENABLED  — route storefront to PageDocument / NodeRenderer
 *                           OFF: ThemePageSection (existing, unchanged)
 *                           ON:  PageDocument + NodeRenderer
 *
 * Audit trail:
 *   Every enable/disable writes a structured entry to Redis list
 *   feature:audit:{storeId}  — capped at last 100 entries per store
 *   Entry: { flag, action, actorId, timestamp }
 */

export const KNOWN_FLAGS = ['CONTENT_NODE_ENABLED'] as const;
export type  FeatureFlag = typeof KNOWN_FLAGS[number];

export interface FlagAuditEntry {
  flag:      FeatureFlag;
  action:    'ENABLE' | 'DISABLE' | 'BULK_ENABLE' | 'BULK_DISABLE';
  actorId?:  string;       // userId or system label ('migration-script', 'admin-api')
  storeId:   string;
  timestamp: string;       // ISO 8601
}

const FLAG_PREFIX  = 'feature';
const AUDIT_PREFIX = 'feature:audit';
const AUDIT_CAP    = 100;            // keep last N entries per store

@Injectable()
export class FeatureFlagService {
  private readonly logger = new Logger(FeatureFlagService.name);

  constructor(private readonly cache: CacheService) {}

  // ─── Key helpers ────────────────────────────────────────────────────────────

  flagKey(storeId: string, flag: FeatureFlag): string {
    return `${FLAG_PREFIX}:${flag.toLowerCase()}:${storeId}`;
  }

  auditKey(storeId: string): string {
    return `${AUDIT_PREFIX}:${storeId}`;
  }

  // ─── Validation ─────────────────────────────────────────────────────────────

  /** Throws BadRequestException if flag name is not in KNOWN_FLAGS. */
  validateFlag(flag: string): asserts flag is FeatureFlag {
    if (!(KNOWN_FLAGS as readonly string[]).includes(flag)) {
      throw new BadRequestException(
        `Unknown feature flag: "${flag}". Valid flags: ${KNOWN_FLAGS.join(', ')}`,
      );
    }
  }

  // ─── Core read/write ────────────────────────────────────────────────────────

  /**
   * Returns current flag value.
   * Defaults to FALSE when key is absent — guarantees no existing store
   * changes behaviour without an explicit enable() call.
   */
  async get(storeId: string, flag: FeatureFlag): Promise<boolean> {
    const val = await this.cache.get<boolean>(this.flagKey(storeId, flag));
    return val === true;             // absent → false; anything other than true → false
  }

  /** Enable flag for a single store. */
  async enable(storeId: string, flag: FeatureFlag, actorId?: string): Promise<void> {
    this.validateFlag(flag);
    await this.cache.set(this.flagKey(storeId, flag), true);
    await this.audit(storeId, flag, 'ENABLE', actorId);
    this.logger.log(`[${flag}] ENABLED  store=${storeId}${actorId ? ` actor=${actorId}` : ''}`);
  }

  /** Disable flag for a store. This is the rollback operation. */
  async disable(storeId: string, flag: FeatureFlag, actorId?: string): Promise<void> {
    this.validateFlag(flag);
    await this.cache.set(this.flagKey(storeId, flag), false);
    await this.audit(storeId, flag, 'DISABLE', actorId);
    this.logger.log(`[${flag}] DISABLED store=${storeId}${actorId ? ` actor=${actorId}` : ''}`);
  }

  /** Get all known flags for a store. */
  async getAll(storeId: string): Promise<Record<FeatureFlag, boolean>> {
    const values = await Promise.all(
      KNOWN_FLAGS.map((f) => this.get(storeId, f)),
    );
    return Object.fromEntries(
      KNOWN_FLAGS.map((f, i) => [f, values[i]]),
    ) as Record<FeatureFlag, boolean>;
  }

  // ─── Bulk operations (rollout phases) ────────────────────────────────────────

  /** Phase N rollout: enable for a list of stores. */
  async bulkEnable(storeIds: string[], flag: FeatureFlag, actorId?: string): Promise<void> {
    this.validateFlag(flag);
    await Promise.all(storeIds.map((id) => this.enable(id, flag, actorId)));
    this.logger.log(`[${flag}] BULK_ENABLED ${storeIds.length} stores`);
  }

  /** Emergency rollback: disable for a list of stores. */
  async bulkDisable(storeIds: string[], flag: FeatureFlag, actorId?: string): Promise<void> {
    this.validateFlag(flag);
    await Promise.all(storeIds.map((id) => this.disable(id, flag, actorId)));
    this.logger.log(`[${flag}] BULK_DISABLED ${storeIds.length} stores — rollback complete`);
  }

  // ─── Audit log ───────────────────────────────────────────────────────────────

  /** Fetch audit entries for a store (most-recent first). */
  async getAuditLog(storeId: string): Promise<FlagAuditEntry[]> {
    const raw = await this.cache.get<FlagAuditEntry[]>(this.auditKey(storeId));
    return raw ?? [];
  }

  private async audit(
    storeId:  string,
    flag:     FeatureFlag,
    action:   FlagAuditEntry['action'],
    actorId?: string,
  ): Promise<void> {
    const entry: FlagAuditEntry = {
      flag, action, storeId,
      actorId:   actorId ?? 'system',
      timestamp: new Date().toISOString(),
    };
    // Prepend to list, cap at AUDIT_CAP
    const existing = await this.getAuditLog(storeId);
    const updated  = [entry, ...existing].slice(0, AUDIT_CAP);
    await this.cache.set(this.auditKey(storeId), updated);
  }
}
