/**
 * Color Schemes — Sprint Release Blocker Fix
 *
 * Three preset color palettes that sections can select via the colorScheme control.
 * The selected scheme overrides section-level background, text, and surface colors.
 * Theme global colors remain unchanged; the scheme applies only to the section.
 */

export interface SchemeColors {
  bg:      string;
  text:    string;
  surface: string;
  accent:  string;
}

export const COLOR_SCHEMES: Record<string, SchemeColors> = {
  'scheme-1': { bg: '#ffffff', text: '#1a1a1a', surface: '#f9fafb', accent: '#4f46e5' },
  'scheme-2': { bg: '#1a1a2e', text: '#ffffff', surface: '#16213e', accent: '#6366f1' },
  'scheme-3': { bg: '#f0fdf4', text: '#166534', surface: '#dcfce7', accent: '#16a34a' },
};

/**
 * Returns scheme colors or falls back to theme colors when no scheme is set
 * or an unknown scheme ID is provided.
 */
export function resolveColorScheme(
  scheme:      string | undefined,
  themeColors: Record<string, string>,
): SchemeColors {
  const s = scheme ? COLOR_SCHEMES[scheme] : undefined;
  if (s) return s;
  return {
    bg:      themeColors.background ?? '#ffffff',
    text:    themeColors.text       ?? '#1a1a1a',
    surface: themeColors.surface    ?? '#f9fafb',
    accent:  themeColors.primary    ?? '#4f46e5',
  };
}
