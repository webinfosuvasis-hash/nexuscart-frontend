/**
 * Feature Flag — Step 4 tests
 *
 * Tests the pure / extractable logic from FeatureFlagService:
 *
 *   flagKey()          — key format contract
 *   auditKey()         — audit key format contract
 *   validateFlag()     — unknown flag rejection
 *   get() default      — absent key = false (core safety guarantee)
 *   enable/disable     — state transitions
 *   audit              — entry shape and cap
 *   dual-path routing  — CONTENT_NODE_ENABLED routes correctly
 *   no-store-change    — existing stores unaffected by default
 *   frontend contract  — nodeTree presence drives path selection
 *
 * FeatureFlagService depends on CacheService (Redis) which we cannot
 * instantiate in backend unit tests without a running Redis server.
 * These tests use the inline logic port — same approach as the registry
 * and binding tests.
 */

import { BadRequestException } from '@nestjs/common';
import { KNOWN_FLAGS } from '../feature-flag.service';
import type { FeatureFlag, FlagAuditEntry } from '../feature-flag.service';

// ─── Inline pure logic ────────────────────────────────────────────────────────

const FLAG_PREFIX  = 'feature';
const AUDIT_PREFIX = 'feature:audit';
const AUDIT_CAP    = 100;

function flagKey(storeId: string, flag: FeatureFlag): string {
  return `${FLAG_PREFIX}:${flag.toLowerCase()}:${storeId}`;
}

function auditKey(storeId: string): string {
  return `${AUDIT_PREFIX}:${storeId}`;
}

function validateFlag(flag: string): asserts flag is FeatureFlag {
  if (!(KNOWN_FLAGS as readonly string[]).includes(flag)) {
    throw new BadRequestException(
      `Unknown feature flag: "${flag}". Valid flags: ${KNOWN_FLAGS.join(', ')}`,
    );
  }
}

// In-memory cache mock
function createFlagStore() {
  const store = new Map<string, unknown>();
  const audit = new Map<string, FlagAuditEntry[]>();

  async function get(storeId: string, flag: FeatureFlag): Promise<boolean> {
    return store.get(flagKey(storeId, flag)) === true;
  }

  async function enable(storeId: string, flag: FeatureFlag, actorId = 'system'): Promise<void> {
    validateFlag(flag);
    store.set(flagKey(storeId, flag), true);
    const entry: FlagAuditEntry = {
      flag, action: 'ENABLE', storeId, actorId,
      timestamp: new Date().toISOString(),
    };
    const existing = audit.get(storeId) ?? [];
    audit.set(storeId, [entry, ...existing].slice(0, AUDIT_CAP));
  }

  async function disable(storeId: string, flag: FeatureFlag, actorId = 'system'): Promise<void> {
    validateFlag(flag);
    store.set(flagKey(storeId, flag), false);
    const entry: FlagAuditEntry = {
      flag, action: 'DISABLE', storeId, actorId,
      timestamp: new Date().toISOString(),
    };
    const existing = audit.get(storeId) ?? [];
    audit.set(storeId, [entry, ...existing].slice(0, AUDIT_CAP));
  }

  async function getAll(storeId: string): Promise<Record<FeatureFlag, boolean>> {
    const values = await Promise.all(KNOWN_FLAGS.map((f) => get(storeId, f)));
    return Object.fromEntries(KNOWN_FLAGS.map((f, i) => [f, values[i]])) as Record<FeatureFlag, boolean>;
  }

  function getAudit(storeId: string): FlagAuditEntry[] {
    return audit.get(storeId) ?? [];
  }

  function reset() { store.clear(); audit.clear(); }

  return { get, enable, disable, getAll, getAudit, reset, _store: store };
}

// ─── Dual-path routing simulation ────────────────────────────────────────────

function routePath(nodeTree: unknown): 'content-node' | 'legacy' {
  return nodeTree != null ? 'content-node' : 'legacy';
}

// ═══════════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Key contracts ───────────────────────────────────────────────────────────

describe('key contracts', () => {
  it('flagKey produces expected format', () => {
    expect(flagKey('store-abc', 'CONTENT_NODE_ENABLED'))
      .toBe('feature:content_node_enabled:store-abc');
  });

  it('flagKey lowercases the flag name', () => {
    const key = flagKey('s1', 'CONTENT_NODE_ENABLED');
    expect(key).toBe('feature:content_node_enabled:s1');
    expect(key).not.toContain('CONTENT');
  });

  it('auditKey produces expected format', () => {
    expect(auditKey('store-xyz')).toBe('feature:audit:store-xyz');
  });

  it('different storeIds produce different keys for the same flag', () => {
    expect(flagKey('store-a', 'CONTENT_NODE_ENABLED'))
      .not.toBe(flagKey('store-b', 'CONTENT_NODE_ENABLED'));
  });

  it('KNOWN_FLAGS contains CONTENT_NODE_ENABLED', () => {
    expect(KNOWN_FLAGS).toContain('CONTENT_NODE_ENABLED');
  });
});

// ─── Flag validation ─────────────────────────────────────────────────────────

describe('validateFlag()', () => {
  it('accepts known flag CONTENT_NODE_ENABLED', () => {
    expect(() => validateFlag('CONTENT_NODE_ENABLED')).not.toThrow();
  });

  it('throws BadRequestException for unknown flag', () => {
    expect(() => validateFlag('BANANA')).toThrow(BadRequestException);
  });

  it('throws for empty string', () => {
    expect(() => validateFlag('')).toThrow(BadRequestException);
  });

  it('throws for lowercase known flag (case-sensitive)', () => {
    expect(() => validateFlag('content_node_enabled')).toThrow(BadRequestException);
  });

  it('throws for partial match', () => {
    expect(() => validateFlag('CONTENT_NODE')).toThrow(BadRequestException);
  });

  it('error message names the invalid flag', () => {
    try {
      validateFlag('FAKE_FLAG');
    } catch (e) {
      expect((e as BadRequestException).message).toContain('FAKE_FLAG');
      expect((e as BadRequestException).message).toContain('CONTENT_NODE_ENABLED');
    }
  });
});

// ─── Default-false guarantee ──────────────────────────────────────────────────
//
// CRITICAL: Every existing store must default to false without any set().
// This is the core safety guarantee that prevents accidental migration.

describe('default-false guarantee (no existing store changes behaviour)', () => {
  let flags: ReturnType<typeof createFlagStore>;
  beforeEach(() => { flags = createFlagStore(); });

  it('returns false for a store that has never had the flag set', async () => {
    expect(await flags.get('brand-new-store', 'CONTENT_NODE_ENABLED')).toBe(false);
  });

  it('getAll returns false for all flags on a new store', async () => {
    const all = await flags.getAll('new-store-xyz');
    expect(all.CONTENT_NODE_ENABLED).toBe(false);
    Object.values(all).forEach((v) => expect(v).toBe(false));
  });

  it('1000 fresh storeIds all default to false', async () => {
    const results = await Promise.all(
      Array.from({ length: 1000 }, (_, i) =>
        flags.get(`store-${i}`, 'CONTENT_NODE_ENABLED'),
      ),
    );
    expect(results.every((r) => r === false)).toBe(true);
  });

  it('enabling for store-A does not affect store-B', async () => {
    await flags.enable('store-a', 'CONTENT_NODE_ENABLED');
    expect(await flags.get('store-a', 'CONTENT_NODE_ENABLED')).toBe(true);
    expect(await flags.get('store-b', 'CONTENT_NODE_ENABLED')).toBe(false);
  });

  it('disabling restores false for that store only', async () => {
    await flags.enable('store-a', 'CONTENT_NODE_ENABLED');
    await flags.enable('store-b', 'CONTENT_NODE_ENABLED');
    await flags.disable('store-a', 'CONTENT_NODE_ENABLED');
    expect(await flags.get('store-a', 'CONTENT_NODE_ENABLED')).toBe(false);
    expect(await flags.get('store-b', 'CONTENT_NODE_ENABLED')).toBe(true);
  });
});

// ─── Enable / disable ────────────────────────────────────────────────────────

describe('enable() and disable()', () => {
  let flags: ReturnType<typeof createFlagStore>;
  beforeEach(() => { flags = createFlagStore(); });

  it('enable sets flag to true', async () => {
    await flags.enable('s1', 'CONTENT_NODE_ENABLED');
    expect(await flags.get('s1', 'CONTENT_NODE_ENABLED')).toBe(true);
  });

  it('disable sets flag to false', async () => {
    await flags.enable('s1', 'CONTENT_NODE_ENABLED');
    await flags.disable('s1', 'CONTENT_NODE_ENABLED');
    expect(await flags.get('s1', 'CONTENT_NODE_ENABLED')).toBe(false);
  });

  it('enable is idempotent — second enable keeps true', async () => {
    await flags.enable('s1', 'CONTENT_NODE_ENABLED');
    await flags.enable('s1', 'CONTENT_NODE_ENABLED');
    expect(await flags.get('s1', 'CONTENT_NODE_ENABLED')).toBe(true);
  });

  it('disable is idempotent — second disable keeps false', async () => {
    await flags.disable('s1', 'CONTENT_NODE_ENABLED');
    await flags.disable('s1', 'CONTENT_NODE_ENABLED');
    expect(await flags.get('s1', 'CONTENT_NODE_ENABLED')).toBe(false);
  });

  it('rejects unknown flag on enable', async () => {
    await expect(flags.enable('s1', 'BAD_FLAG' as FeatureFlag)).rejects.toThrow(BadRequestException);
  });

  it('rejects unknown flag on disable', async () => {
    await expect(flags.disable('s1', 'BAD_FLAG' as FeatureFlag)).rejects.toThrow(BadRequestException);
  });
});

// ─── Audit log ───────────────────────────────────────────────────────────────

describe('audit log', () => {
  let flags: ReturnType<typeof createFlagStore>;
  beforeEach(() => { flags = createFlagStore(); });

  it('audit log is empty for a new store', () => {
    expect(flags.getAudit('s1')).toHaveLength(0);
  });

  it('enable writes an ENABLE entry', async () => {
    await flags.enable('s1', 'CONTENT_NODE_ENABLED', 'admin-user');
    const log = flags.getAudit('s1');
    expect(log).toHaveLength(1);
    expect(log[0].action).toBe('ENABLE');
    expect(log[0].flag).toBe('CONTENT_NODE_ENABLED');
    expect(log[0].storeId).toBe('s1');
    expect(log[0].actorId).toBe('admin-user');
  });

  it('disable writes a DISABLE entry', async () => {
    await flags.enable('s1', 'CONTENT_NODE_ENABLED');
    await flags.disable('s1', 'CONTENT_NODE_ENABLED', 'rollback-script');
    const log = flags.getAudit('s1');
    expect(log[0].action).toBe('DISABLE');
    expect(log[0].actorId).toBe('rollback-script');
  });

  it('entries are prepended (most recent first)', async () => {
    await flags.enable('s1', 'CONTENT_NODE_ENABLED');
    await flags.disable('s1', 'CONTENT_NODE_ENABLED');
    const log = flags.getAudit('s1');
    expect(log[0].action).toBe('DISABLE');
    expect(log[1].action).toBe('ENABLE');
  });

  it('audit log is capped at AUDIT_CAP entries', async () => {
    for (let i = 0; i < AUDIT_CAP + 10; i++) {
      await flags.enable('s1', 'CONTENT_NODE_ENABLED');
    }
    expect(flags.getAudit('s1').length).toBeLessThanOrEqual(AUDIT_CAP);
  });

  it('audit entry has ISO timestamp', async () => {
    await flags.enable('s1', 'CONTENT_NODE_ENABLED');
    const ts = flags.getAudit('s1')[0].timestamp;
    expect(() => new Date(ts)).not.toThrow();
    expect(new Date(ts).toISOString()).toBe(ts);
  });

  it('audit logs are per-store — store-A log does not appear in store-B', async () => {
    await flags.enable('store-a', 'CONTENT_NODE_ENABLED');
    expect(flags.getAudit('store-b')).toHaveLength(0);
  });

  it('actorId defaults to system when not provided', async () => {
    await flags.enable('s1', 'CONTENT_NODE_ENABLED');
    expect(flags.getAudit('s1')[0].actorId).toBe('system');
  });
});

// ─── Dual-path routing ────────────────────────────────────────────────────────

describe('dual-path routing (nodeTree presence)', () => {
  it('nodeTree present → content-node path', () => {
    expect(routePath({ id: 'root', type: 'container', settings: {}, children: [] }))
      .toBe('content-node');
  });

  it('nodeTree null → legacy path', () => {
    expect(routePath(null)).toBe('legacy');
  });

  it('nodeTree undefined → legacy path', () => {
    expect(routePath(undefined)).toBe('legacy');
  });

  it('empty nodeTree object → content-node path (truthy)', () => {
    expect(routePath({})).toBe('content-node');
  });

  it('data-renderer attribute reflects path', () => {
    const legacyAttr  = routePath(null)        === 'legacy'       ? 'legacy'       : 'content-node';
    const newAttr     = routePath({ id: 'r' }) === 'content-node' ? 'content-node' : 'legacy';
    expect(legacyAttr).toBe('legacy');
    expect(newAttr).toBe('content-node');
  });
});

// ─── Rollout phase simulation ─────────────────────────────────────────────────

describe('rollout phase simulation', () => {
  let flags: ReturnType<typeof createFlagStore>;

  beforeEach(() => { flags = createFlagStore(); });

  it('Phase 1: internal only — all other stores unaffected', async () => {
    await flags.enable('internal-test', 'CONTENT_NODE_ENABLED', 'migration-script');
    expect(await flags.get('internal-test', 'CONTENT_NODE_ENABLED')).toBe(true);
    expect(await flags.get('production-store-1', 'CONTENT_NODE_ENABLED')).toBe(false);
    expect(await flags.get('production-store-2', 'CONTENT_NODE_ENABLED')).toBe(false);
  });

  it('Phase 2: store-1 enabled, store-2 still off', async () => {
    await flags.enable('store-1', 'CONTENT_NODE_ENABLED');
    expect(await flags.get('store-1', 'CONTENT_NODE_ENABLED')).toBe(true);
    expect(await flags.get('store-2', 'CONTENT_NODE_ENABLED')).toBe(false);
  });

  it('Phase 4: all stores enabled', async () => {
    const storeIds = ['s1', 's2', 's3', 's4', 's5'];
    await Promise.all(storeIds.map((id) => flags.enable(id, 'CONTENT_NODE_ENABLED')));
    const results = await Promise.all(storeIds.map((id) => flags.get(id, 'CONTENT_NODE_ENABLED')));
    expect(results.every((r) => r === true)).toBe(true);
  });

  it('Emergency rollback: all stores disabled', async () => {
    const storeIds = ['s1', 's2', 's3'];
    await Promise.all(storeIds.map((id) => flags.enable(id, 'CONTENT_NODE_ENABLED')));
    await Promise.all(storeIds.map((id) => flags.disable(id, 'CONTENT_NODE_ENABLED', 'emergency-rollback')));
    const results = await Promise.all(storeIds.map((id) => flags.get(id, 'CONTENT_NODE_ENABLED')));
    expect(results.every((r) => r === false)).toBe(true);
    // Audit shows rollback
    const log = flags.getAudit('s1');
    expect(log[0].actorId).toBe('emergency-rollback');
    expect(log[0].action).toBe('DISABLE');
  });
});
