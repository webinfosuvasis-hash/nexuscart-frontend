/**
 * Readable text on a merchant-configured background.
 *
 * Section backgrounds come from page-builder config, so a section designed
 * for a dark card can be given a pale one (live: #fdf2f8 / #eff6ff), which
 * turned its white text invisible. These helpers pick light or dark text by
 * whichever has the higher WCAG contrast against the configured colour.
 */

const DARK_TEXT = '#1f2937';
const LIGHT_TEXT = '#ffffff';

function parseColor(css: string | undefined): [number, number, number] | null {
  if (!css) return null;
  const v = css.trim();
  const hex = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].split('').map((c) => c + c).join('') : hex[1];
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
  }
  const rgb = v.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  return rgb ? [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])] : null;
}

function luminance([r, g, b]: [number, number, number]): number {
  const lin = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

/**
 * True when dark text reads better than white on `background`. Unparseable
 * values (gradients, images, named colours) keep the section's original light
 * text — those sections were designed for dark artwork.
 */
export function prefersDarkText(background: string | undefined): boolean {
  const rgb = parseColor(background);
  if (!rgb) return false;
  const bg = luminance(rgb);
  return contrast(bg, luminance(parseColor(DARK_TEXT)!)) > contrast(bg, 1);
}

/** Text colour (light or dark) with the better contrast on `background`. */
export function readableTextOn(background: string | undefined): string {
  return prefersDarkText(background) ? DARK_TEXT : LIGHT_TEXT;
}
