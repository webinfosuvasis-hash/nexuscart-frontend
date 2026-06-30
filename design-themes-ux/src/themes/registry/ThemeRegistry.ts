/**
 * ThemeRegistry — global singleton mapping themeId → ThemeEntry.
 *
 * The Page Builder API returns a `themeId` field with every homepage response.
 * The storefront uses this registry to look up which SectionRegistry to use,
 * ensuring the correct visual implementation renders for the active theme.
 *
 * Usage:
 *   // In each theme's initializer file:
 *   ThemeRegistry.register({ themeId: 'aurus', themeName: 'Aurus', sectionRegistry });
 *
 *   // In the storefront renderer:
 *   const theme = ThemeRegistry.getTheme(apiResponse.themeId);
 *   const entry = theme.sectionRegistry.get(sectionType);
 */

import type { ThemeEntry } from './types';
import { SectionRegistry } from './SectionRegistry';

class ThemeRegistryClass {
  private readonly themes = new Map<string, ThemeEntry>();

  /** Register a theme. Call once at app startup per theme. */
  register(entry: ThemeEntry): void {
    if (this.themes.has(entry.themeId)) {
      console.warn(
        `[ThemeRegistry] Duplicate registration for themeId "${entry.themeId}". ` +
        'The previous entry will be overwritten.',
      );
    }
    this.themes.set(entry.themeId, entry);
  }

  /**
   * Look up a theme by ID.
   *
   * Returns the Aurus theme as a safe fallback if themeId is unknown.
   * This prevents a white screen when a new theme is added to the backend
   * before the frontend has been updated to register it.
   */
  getTheme(themeId: string): ThemeEntry {
    const found = this.themes.get(themeId);
    if (found) return found;

    // Fallback: try 'aurus' if requested theme not registered
    const aurus = this.themes.get('aurus');
    if (aurus) {
      console.warn(
        `[ThemeRegistry] Theme "${themeId}" is not registered. ` +
        'Falling back to "aurus". Register the theme at app startup.',
      );
      return aurus;
    }

    // Last resort: empty registry (all sections silently skipped)
    console.error(
      `[ThemeRegistry] No theme found for "${themeId}" and no "aurus" fallback exists. ` +
      'The page will render with no sections.',
    );
    return {
      themeId:         themeId,
      themeName:       'Unknown',
      sectionRegistry: new SectionRegistry(),
    };
  }

  /** Check if a theme is registered. */
  hasTheme(themeId: string): boolean {
    return this.themes.has(themeId);
  }

  /** All registered theme IDs (for tooling). */
  getThemeIds(): string[] {
    return Array.from(this.themes.keys());
  }
}

/** Global singleton — import this everywhere. */
export const ThemeRegistry = new ThemeRegistryClass();
