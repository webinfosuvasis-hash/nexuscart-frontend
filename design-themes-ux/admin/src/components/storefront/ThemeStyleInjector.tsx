import React, { useLayoutEffect } from 'react';

interface ThemeConfig {
  colors:     Record<string, string>;
  typography: Record<string, any>;
  layout:     Record<string, any>;
}

// Fonts confirmed available on Google Fonts — prevents CSS injection via font name
const SAFE_GOOGLE_FONTS = new Set([
  'Inter', 'Playfair Display', 'Space Grotesk', 'Merriweather', 'Nunito',
  'Cormorant Garamond', 'DM Sans', 'Josefin Sans', 'Lato', 'Open Sans',
  'Roboto', 'Source Sans Pro', 'Poppins', 'Montserrat',
]);

function buildCssVars(config: ThemeConfig): string {
  const { colors, typography } = config;
  const lines: string[] = [':root {'];

  // Color tokens
  const colorMap: Record<string, string> = {
    primary:    '--nx-color-primary',
    secondary:  '--nx-color-secondary',
    accent:     '--nx-color-accent',
    background: '--nx-color-background',
    text:       '--nx-color-text',
    surface:    '--nx-color-surface',
  };
  for (const [key, cssVar] of Object.entries(colorMap)) {
    if (colors[key]) lines.push(`  ${cssVar}: ${colors[key]};`);
  }

  // Typography tokens
  const hFont = SAFE_GOOGLE_FONTS.has(typography.headingFont) ? typography.headingFont : 'Inter';
  const bFont = SAFE_GOOGLE_FONTS.has(typography.bodyFont)    ? typography.bodyFont    : 'Inter';
  lines.push(`  --nx-font-heading: '${hFont}', sans-serif;`);
  lines.push(`  --nx-font-body:    '${bFont}', sans-serif;`);
  lines.push(`  --nx-font-size-base: ${typography.baseSizeRem ?? 1}rem;`);
  lines.push(`  --nx-line-height: ${typography.lineHeight ?? 1.6};`);
  lines.push('}');

  return lines.join('\n');
}

function loadGoogleFont(family: string): void {
  if (!SAFE_GOOGLE_FONTS.has(family)) return;
  const id = `gf-${family.replace(/\s+/g, '-').toLowerCase()}`;
  if (document.getElementById(id)) return;
  const link        = document.createElement('link');
  link.id           = id;
  link.rel          = 'stylesheet';
  link.href         = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@400;500;600;700&display=swap`;
  document.head.appendChild(link);
}

interface Props { themeConfig: ThemeConfig }

// ─── Rich text CSS (Sprint 6) ─────────────────────────────────────────────────
// Scoped to [data-nexuscart-block] so it doesn't leak into admin UI styles.

const RICH_TEXT_CSS = `
[data-nexuscart-block] h1,
[data-nexuscart-block] h2,
[data-nexuscart-block] h3 {
  margin: 0.5em 0 0.25em;
  line-height: 1.25;
  font-family: var(--nx-font-heading, Inter, sans-serif);
}
[data-nexuscart-block] p {
  margin: 0 0 0.75em;
  line-height: 1.7;
}
[data-nexuscart-block] ul,
[data-nexuscart-block] ol {
  margin: 0 0 0.75em 1.5em;
  padding: 0;
  line-height: 1.7;
}
[data-nexuscart-block] li { margin-bottom: 0.25em; }
[data-nexuscart-block] strong, [data-nexuscart-block] b { font-weight: 700; }
[data-nexuscart-block] em,   [data-nexuscart-block] i  { font-style: italic; }
[data-nexuscart-block] u  { text-decoration: underline; }
[data-nexuscart-block] a  { color: var(--nx-color-primary, #4f46e5); text-decoration: underline; }
[data-nexuscart-block] a:hover { opacity: 0.8; }
`.trim();

/**
 * ThemeStyleInjector — Sprint 5 + 6
 *
 * Injects CSS custom properties, Google Fonts, and rich text prose styles
 * into document.head before first paint (useLayoutEffect → no FOUC).
 *
 * nx-theme-vars  — CSS custom properties (color tokens, font tokens)
 * nx-rich-text   — prose reset for [data-nexuscart-block] rich content
 */
const ThemeStyleInjector: React.FC<Props> = ({ themeConfig }) => {
  useLayoutEffect(() => {
    // 1. CSS custom properties
    let style = document.getElementById('nx-theme-vars') as HTMLStyleElement | null;
    if (!style) {
      style     = document.createElement('style');
      style.id  = 'nx-theme-vars';
      document.head.insertBefore(style, document.head.firstChild);
    }
    style.textContent = buildCssVars(themeConfig);

    // 2. Rich text prose reset (idempotent — only injected once)
    if (!document.getElementById('nx-rich-text')) {
      const rtStyle       = document.createElement('style');
      rtStyle.id          = 'nx-rich-text';
      rtStyle.textContent = RICH_TEXT_CSS;
      document.head.appendChild(rtStyle);
    }

    // 3. Google Fonts
    const { headingFont, bodyFont } = themeConfig.typography;
    loadGoogleFont(headingFont);
    if (bodyFont !== headingFont) loadGoogleFont(bodyFont);
  }, [themeConfig]);

  return null;
};

export { buildCssVars };
export default ThemeStyleInjector;
