/**
 * SectionRegistry — per-theme registry mapping sectionType → entry.
 *
 * Each theme (Aurus, Classic, Luxury, ...) creates its own SectionRegistry
 * and populates it with its section implementations.
 *
 * The SectionRenderer queries this registry to find the correct component
 * for each sectionType string returned by the Page Builder API.
 * If a sectionType is not registered, the section is silently skipped —
 * no crash, no fallback, no visible output.
 */

import type { SectionRegistryEntry } from './types';

export class SectionRegistry {
  private readonly entries = new Map<string, SectionRegistryEntry<any, any>>();

  /** Register a section type in this theme's registry. */
  register<TConfig extends object, TData extends object>(
    entry: SectionRegistryEntry<TConfig, TData>,
  ): this {
    if (this.entries.has(entry.sectionType)) {
      console.warn(
        `[SectionRegistry] Duplicate registration for sectionType "${entry.sectionType}". ` +
        'The previous entry will be overwritten.',
      );
    }
    this.entries.set(entry.sectionType, entry);
    return this;
  }

  /**
   * Look up a section type.
   * Returns null (not throws) for unknown types — the renderer skips them.
   */
  get(sectionType: string): SectionRegistryEntry<any, any> | null {
    return this.entries.get(sectionType) ?? null;
  }

  /** Check whether a section type is registered. */
  has(sectionType: string): boolean {
    return this.entries.has(sectionType);
  }

  /** All registered section types in this theme (for tooling). */
  getAll(): SectionRegistryEntry<any, any>[] {
    return Array.from(this.entries.values());
  }

  /** Total number of registered section types. */
  get size(): number {
    return this.entries.size;
  }
}
