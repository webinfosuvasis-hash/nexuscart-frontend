/**
 * Theme Migration Registry
 *
 * Migrations are pure functions that transform a PageDoc from one theme
 * version to another.  They are registered here and executed in order by
 * upgradeTheme().
 *
 * ── Migration contract ────────────────────────────────────────────────────────
 *
 *   1. Idempotent — applying twice = applying once.
 *   2. Non-destructive — never delete sections the merchant has customised.
 *   3. Pure — no I/O, no side effects.
 *   4. Safe — return the original doc unchanged when the expected structure
 *      is absent (defensive programming for edge cases).
 *
 * ── Chain execution ───────────────────────────────────────────────────────────
 *
 *   upgradeTheme('kaveri', { fromVersion: '1.0.0', toVersion: '1.1.0' })
 *     → migrationRegistry.findChain('kaveri', '1.0.0', '1.1.0')
 *     → [migration_1_0_to_1_1]
 *     → applyChain(doc, chain, targetDefinition)
 *     → PageDoc (mutated by each migration in sequence)
 *
 * ── Future multi-hop chains ───────────────────────────────────────────────────
 *
 *   1.0.0 → 1.1.0 → 2.0.0
 *   findChain('kaveri', '1.0.0', '2.0.0') = [migration_1_0_to_1_1, migration_1_1_to_2_0]
 */

import type { ThemeMigration, ThemeDefinition }    from './types';
import type { PageDoc }                             from '@/admin/editor/types';
import { semverGt, semverEq }                       from './themeVersion';

// ─── MigrationRegistry class ──────────────────────────────────────────────────

class MigrationRegistry {
  private readonly migrations: ThemeMigration[] = [];

  /** Register a migration. Duplicate (themeId + fromVersion + toVersion) silently no-ops. */
  register(migration: ThemeMigration): void {
    const exists = this.migrations.some(
      (m) =>
        m.themeId     === migration.themeId     &&
        m.fromVersion === migration.fromVersion &&
        m.toVersion   === migration.toVersion,
    );
    if (!exists) this.migrations.push(migration);
  }

  /**
   * Find the ordered chain of migrations to apply to go from `fromVersion`
   * to `toVersion` for `themeId`.
   *
   * Returns an empty array when no path exists (no migration needed / possible).
   * The chain is sorted so earlier migrations run first.
   */
  findChain(
    themeId:     string,
    fromVersion: string,
    toVersion:   string,
  ): ThemeMigration[] {
    if (semverEq(fromVersion, toVersion)) return [];

    // Collect migrations for this theme that fall in (fromVersion, toVersion]
    const candidates = this.migrations.filter(
      (m) =>
        m.themeId === themeId &&
        semverGt(m.toVersion, fromVersion) &&
        !semverGt(m.toVersion, toVersion),
    );

    // Sort by toVersion ascending so the chain executes in order
    return candidates.sort((a, b) => {
      if (semverGt(a.toVersion, b.toVersion)) return 1;
      if (semverGt(b.toVersion, a.toVersion)) return -1;
      return 0;
    });
  }

  /**
   * Apply a chain of migrations to a PageDoc in order.
   * Returns the original doc if the chain is empty.
   */
  applyChain(
    doc:        PageDoc,
    chain:      ThemeMigration[],
    definition: ThemeDefinition,
  ): PageDoc {
    return chain.reduce((current, migration) => {
      try {
        return migration.migrate(current, definition);
      } catch (err) {
        console.error(
          `[MigrationRegistry] Migration ${migration.themeId} ` +
          `${migration.fromVersion}→${migration.toVersion} failed:`, err,
        );
        return current;   // safe fallback: skip failed migration
      }
    }, doc);
  }

  /** All registered migrations (read-only). */
  list(): Readonly<ThemeMigration[]> {
    return this.migrations;
  }

  /** Used in tests to reset state. */
  _reset(): void {
    this.migrations.length = 0;
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const migrationRegistry = new MigrationRegistry();
