/**
 * AurusTheme.ts — registers the Aurus theme in the global ThemeRegistry.
 *
 * This file must be imported exactly once at app startup.
 * Import it in src/themes/AurusHomeV2.tsx or src/App.tsx.
 *
 * After import, ThemeRegistry.getTheme('aurus') returns the Aurus theme
 * with its full SectionRegistry.
 */

import { ThemeRegistry } from '@/themes/registry/ThemeRegistry';
import { aurusSectionRegistry } from './aurus-registry';

ThemeRegistry.register({
  themeId:         'aurus',
  themeName:       'Aurus Fine Jewellery',
  sectionRegistry: aurusSectionRegistry,
});

// This side-effect import pattern is intentional.
// The registration happens once when this module is first imported.
// Subsequent imports are no-ops (ES module singleton).
