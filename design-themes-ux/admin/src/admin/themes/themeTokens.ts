/**
 * Theme token persistence
 *
 * When a theme is installed or upgraded, its color and typography tokens are
 * written to the store's ThemeConfig DRAFT via updateDraft().  This ensures
 * that the theme's visual identity (espresso brown, cream, terracotta…) is
 * applied immediately in the editor canvas and the public preview.
 *
 * The ThemeConfig colors flow into the preview via:
 *   themeConfig.colors → RenderContextProvider.themeTokens → CSS custom properties
 *
 * ── Separation of concerns ────────────────────────────────────────────────────
 *
 *   applyThemeTokens()   — one-shot: writes tokens at install time
 *   ThemeEngine UI       — merchants can customize further via ThemeEditor
 *
 * Tokens written here become the DEFAULTS.  Merchant customizations applied
 * afterwards override them and are preserved on upgrade (the upgrade flow
 * re-applies only if the merchant has NOT customised a given token).
 */

import { themeEngineService } from '@/services/themeEngineService';
import type { ThemeDefinition } from './types';

// ─── Default layout config (same for every theme) ────────────────────────────

const DEFAULT_LAYOUT = {
  stickyHeader:  true,
  sidebarCart:   false,
  megaMenu:      false,
  backToTop:     true,
  cookieConsent: false,
};

const DEFAULT_TYPOGRAPHY = {
  headingFont: 'Plus Jakarta Sans',
  bodyFont:    'Inter',
  baseSizeRem: 1.0,
  lineHeight:  1.6,
};

// ─── applyThemeTokens ─────────────────────────────────────────────────────────

/**
 * Write a theme's color and typography tokens to the ThemeConfig DRAFT.
 *
 * Called once per install / upgrade.  Uses updateDraft() which only affects
 * the DRAFT — tokens do not go live until the merchant publishes.
 *
 * Best-effort: callers .catch() errors — token failure must not block
 * the PageDocument save.
 *
 * @param definition    The ThemeDefinition being installed.
 * @param activeThemeId The active theme ID (X-Theme-Id header value).
 */
export async function applyThemeTokens(
  definition:    ThemeDefinition,
  activeThemeId: string,
): Promise<void> {
  const typography = {
    ...DEFAULT_TYPOGRAPHY,
    headingFont: definition.typography.headingFont,
    bodyFont:    definition.typography.bodyFont,
    baseSizeRem: definition.typography.baseSizeRem,
    lineHeight:  definition.typography.lineHeight,
  };

  await themeEngineService.updateDraft(
    {
      colors:     definition.colors,
      typography,
      layout:     DEFAULT_LAYOUT,
    },
    activeThemeId || undefined,
  );
}

// ─── Token diff (for upgrade: only update non-customised tokens) ──────────────

/**
 * Compare two color sets and return keys that have changed.
 * Used by upgradeTheme() to detect which tokens were updated by the new
 * theme version vs which were customised by the merchant.
 */
export function diffTokens(
  previous: Record<string, string>,
  next:     Record<string, string>,
): string[] {
  return Object.keys(next).filter((k) => previous[k] !== next[k]);
}
