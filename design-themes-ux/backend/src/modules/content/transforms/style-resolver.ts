/**
 * StyleResolver — backend copy for unit testing.
 * Identical logic to src/admin/editor/styleResolver.ts.
 * Uses a plain object type instead of React.CSSProperties so it
 * can be tested without a React runtime.
 */

export type CSSLike = Record<string, string | number | undefined>;
type PreviewMode = 'desktop' | 'tablet' | 'mobile';

export const SHADOW_PRESETS: Record<string, string> = {
  none: 'none',
  sm:   '0 1px 2px rgba(0,0,0,0.05)',
  md:   '0 4px 12px rgba(0,0,0,0.12)',
  lg:   '0 8px 30px rgba(0,0,0,0.18)',
  xl:   '0 16px 48px rgba(0,0,0,0.25)',
  '2xl':'0 24px 64px rgba(0,0,0,0.35)',
};

function num(s: Record<string, unknown>, key: string): number | undefined {
  const v = s[key];
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  return isNaN(n) ? undefined : n;
}

function str(s: Record<string, unknown>, key: string): string | undefined {
  const v = s[key];
  return v !== undefined && v !== null && v !== '' ? String(v) : undefined;
}

function bool(s: Record<string, unknown>, key: string): boolean {
  return s[key] === true || s[key] === 'true';
}

function merge(base: Record<string, unknown>, bp: PreviewMode): Record<string, unknown> {
  if (bp === 'desktop') return base;
  const overlay = (base.responsive as Record<string, Record<string, unknown>> | undefined)?.[bp] ?? {};
  return { ...base, ...overlay };
}

export function resolveStyle(
  settings: Record<string, unknown>,
  bp: PreviewMode = 'desktop',
): CSSLike {
  const s = merge(settings, bp);
  const style: CSSLike = {};

  const bg = str(s, 'bg');
  if (bg) style.backgroundColor = bg;
  const bgImage = str(s, 'bgImage');
  if (bgImage) style.backgroundImage = `url(${bgImage})`;
  const bgSize = str(s, 'bgSize');
  if (bgSize) style.backgroundSize = bgSize;
  const bgPos = str(s, 'bgPos');
  if (bgPos) style.backgroundPosition = bgPos;

  const color = str(s, 'color');
  if (color) style.color = color;
  const fontSize = num(s, 'fontSize');
  if (fontSize !== undefined) style.fontSize = `${fontSize}px`;
  const fontWeight = num(s, 'fontWeight');
  if (fontWeight !== undefined) style.fontWeight = fontWeight;
  const lineHeight = num(s, 'lineHeight');
  if (lineHeight !== undefined) style.lineHeight = lineHeight;
  const textAlign = str(s, 'textAlign');
  if (textAlign) style.textAlign = textAlign;
  const letterSpacing = num(s, 'letterSpacing');
  if (letterSpacing !== undefined) style.letterSpacing = `${letterSpacing}px`;

  const pt = num(s,'pt'), pr = num(s,'pr'), pb = num(s,'pb'), pl = num(s,'pl');
  if (pt !== undefined || pr !== undefined || pb !== undefined || pl !== undefined)
    style.padding = `${pt??0}px ${pr??0}px ${pb??0}px ${pl??0}px`;

  const mt = num(s,'mt'), mr = num(s,'mr'), mb = num(s,'mb'), ml = num(s,'ml');
  if (mt !== undefined || mr !== undefined || mb !== undefined || ml !== undefined)
    style.margin = `${mt??0}px ${mr??0}px ${mb??0}px ${ml??0}px`;

  const bw = num(s,'bw'), bs = str(s,'bs'), bc = str(s,'bc');
  if (bw !== undefined || bs || bc) {
    style.borderWidth = `${bw ?? 1}px`;
    style.borderStyle = bs ?? 'solid';
    style.borderColor = bc ?? 'currentColor';
  }
  const br = num(s, 'br');
  if (br !== undefined) style.borderRadius = `${br}px`;

  const opacity = num(s, 'opacity');
  if (opacity !== undefined) style.opacity = opacity / 100;
  const zIndex = num(s, 'zIndex');
  if (zIndex !== undefined) style.zIndex = zIndex;
  const overflow = str(s, 'overflow');
  if (overflow) style.overflow = overflow;
  const shadow = str(s, 'shadow');
  if (shadow && shadow !== 'none') style.boxShadow = SHADOW_PRESETS[shadow] ?? shadow;

  const w = str(s, 'w');
  if (w) style.width = w === 'full' ? '100%' : /^\d+$/.test(w) ? `${w}px` : w;
  const h = str(s, 'h');
  if (h) style.height = /^\d+$/.test(h) ? `${h}px` : h;
  const minW = num(s, 'minW'); if (minW !== undefined) style.minWidth  = `${minW}px`;
  const maxW = num(s, 'maxW'); if (maxW !== undefined) style.maxWidth  = `${maxW}px`;
  const minH = num(s, 'minH'); if (minH !== undefined) style.minHeight = `${minH}px`;
  const maxH = num(s, 'maxH'); if (maxH !== undefined) style.maxHeight = `${maxH}px`;

  const display = str(s, 'display'); if (display) style.display = display;
  const flexDir = str(s, 'flexDir'); if (flexDir) style.flexDirection = flexDir;

  const JUSTIFY: Record<string,string> = { start:'flex-start', end:'flex-end', between:'space-between', around:'space-around', evenly:'space-evenly', center:'center' };
  const justify = str(s, 'justify'); if (justify) style.justifyContent = JUSTIFY[justify] ?? justify;

  const ALIGN: Record<string,string> = { start:'flex-start', end:'flex-end', center:'center', stretch:'stretch', baseline:'baseline' };
  const align = str(s, 'align'); if (align) style.alignItems = ALIGN[align] ?? align;

  if (bool(s, 'wrap')) style.flexWrap = 'wrap';
  const gap    = num(s, 'gap');    if (gap    !== undefined) style.gap       = `${gap}px`;
  const colGap = num(s, 'colGap'); if (colGap !== undefined) style.columnGap = `${colGap}px`;
  const rowGap = num(s, 'rowGap'); if (rowGap !== undefined) style.rowGap    = `${rowGap}px`;

  const gridCols = s['gridCols'];
  if (gridCols !== undefined && gridCols !== null && gridCols !== '') {
    if (bool(s, 'autoFit')) {
      style.gridTemplateColumns = `repeat(auto-fit, minmax(${num(s,'minColW') ?? 200}px, 1fr))`;
    } else {
      const n = Number(gridCols);
      style.gridTemplateColumns = Number.isInteger(n) && n > 0
        ? `repeat(${n}, 1fr)` : String(gridCols);
    }
  }
  const gridRows = s['gridRows'];
  if (gridRows !== undefined && gridRows !== null && gridRows !== '') {
    const n = Number(gridRows);
    style.gridTemplateRows = Number.isInteger(n) && n > 0 ? `repeat(${n}, 1fr)` : String(gridRows);
  }

  return style;
}
