/**
 * Theme Registry
 *
 * A synchronous Map-based registry for theme definitions.
 * All themes must be registered before applyTheme() can reference them.
 *
 * Usage:
 *   import { themeRegistry } from '@/admin/themes/registry';
 *   themeRegistry.register(kaveriDefinition);
 *   const entry = themeRegistry.get('kaveri');
 */

import type { ThemeDefinition, ThemeRegistryEntry, ThemeMeta, ThemeCategory } from './types';

// ─── Registry class ───────────────────────────────────────────────────────────

class ThemeRegistry {
  private readonly map = new Map<string, ThemeRegistryEntry>();

  /**
   * Register a theme definition.  Safe to call multiple times with the same
   * theme — later registration replaces earlier (allows version bumps).
   */
  register(definition: ThemeDefinition): void {
    this.map.set(definition.meta.id, {
      meta:         definition.meta,
      definition,
      registeredAt: new Date().toISOString(),
    });
  }

  /**
   * Retrieve a registered theme.
   * @throws  Error if the theme is not found.
   */
  get(themeId: string): ThemeRegistryEntry {
    const entry = this.map.get(themeId);
    if (!entry) {
      throw new Error(
        `ThemeRegistry: theme "${themeId}" is not registered. ` +
        `Available: ${this.list().map((m) => m.id).join(', ') || '(none)'}`,
      );
    }
    return entry;
  }

  /** Returns true when the theme is registered. */
  has(themeId: string): boolean {
    return this.map.has(themeId);
  }

  /** List metadata for all registered themes. */
  list(): ThemeMeta[] {
    return Array.from(this.map.values()).map((e) => e.meta);
  }

  /** Filter themes by category. */
  byCategory(category: ThemeCategory): ThemeMeta[] {
    return this.list().filter((m) => m.category === category);
  }

  /** Number of registered themes. */
  size(): number {
    return this.map.size;
  }

  /**
   * Remove all registrations.
   * Used in unit tests to reset state between runs.
   */
  _reset(): void {
    this.map.clear();
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const themeRegistry = new ThemeRegistry();

// Re-export the class type so themeVersion.ts can reference it in parameter types
export type { ThemeRegistry };
