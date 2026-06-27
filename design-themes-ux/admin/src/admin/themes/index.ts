/**
 * Theme Installer — public API
 *
 * Single import point.  Importing this module:
 *   1. Registers all bundled themes (Kaveri 1.0, Kaveri 1.1, …)
 *   2. Registers all migrations (Kaveri 1.0→1.1, …)
 *   3. Exports the public installer API
 */

// Side-effect: registers all bundled themes + migrations
import './definitions';

// ─── Public API ───────────────────────────────────────────────────────────────

export { applyTheme, upgradeTheme }    from './installer';
export { themeRegistry }               from './registry';
export { migrationRegistry }           from './migrations';

export { buildPageDocFromTheme, buildSectionFromSeed } from './themePageDocBuilder';

// Version utilities (UI can call canUpgrade, getInstalledThemeInfo)
export {
  getInstalledThemeInfo,
  canUpgrade,
  availableUpgrade,
  semverGt,
  semverEq,
  THEME_INSTALL_KEY,
  buildInstallRecord,
}                                      from './themeVersion';

// Token utilities
export { applyThemeTokens, diffTokens } from './themeTokens';

// Types
export type {
  ThemeMeta,
  ThemeDefinition,
  ThemePage,
  ThemeSectionSeed,
  ThemeBlockSeed,
  ThemeColors,
  ThemeTypography,
  ThemeCategory,
  ThemeRegistryEntry,
  ThemeInstallRecord,
  ThemeMigration,
  ApplyThemeResult,
  ApplyThemeContext,
  ThemeUpgradeResult,
} from './types';
