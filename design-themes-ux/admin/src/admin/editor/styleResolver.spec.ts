import { resolveStyle } from './styleResolver';

// ─── Background ───────────────────────────────────────────────────────────────

describe('background', () => {
  it('maps bg → backgroundColor', () => {
    expect(resolveStyle({ bg: '#ff0000' }).backgroundColor).toBe('#ff0000');
  });
  it('maps bgImage → backgroundImage url()', () => {
    expect(resolveStyle({ bgImage: 'https://x.com/a.jpg' }).backgroundImage)
      .toBe('url(https://x.com/a.jpg)');
  });
  it('maps bgSize → backgroundSize', () => {
    expect(resolveStyle({ bgSize: 'cover' }).backgroundSize).toBe('cover');
  });
  it('maps bgPos → backgroundPosition', () => {
    expect(resolveStyle({ bgPos: 'center top' }).backgroundPosition).toBe('center top');
  });
  it('omits backgroundColor when bg not set', () => {
    expect(resolveStyle({}).backgroundColor).toBeUndefined();
  });
});

// ─── Typography ───────────────────────────────────────────────────────────────

describe('typography', () => {
  it('maps color → color', () => {
    expect(resolveStyle({ color: '#111827' }).color).toBe('#111827');
  });
  it('maps fontSize → fontSize with px unit', () => {
    expect(resolveStyle({ fontSize: 24 }).fontSize).toBe('24px');
  });
  it('maps fontWeight → fontWeight number', () => {
    expect(resolveStyle({ fontWeight: 700 }).fontWeight).toBe(700);
  });
  it('maps lineHeight → lineHeight unitless', () => {
    expect(resolveStyle({ lineHeight: 1.6 }).lineHeight).toBe(1.6);
  });
  it('maps textAlign → textAlign', () => {
    expect(resolveStyle({ textAlign: 'center' }).textAlign).toBe('center');
  });
  it('maps letterSpacing → letterSpacing with px unit', () => {
    expect(resolveStyle({ letterSpacing: 2 }).letterSpacing).toBe('2px');
  });
});

// ─── Padding ─────────────────────────────────────────────────────────────────

describe('padding', () => {
  it('produces padding shorthand from pt/pr/pb/pl', () => {
    expect(resolveStyle({ pt: 16, pr: 32, pb: 16, pl: 32 }).padding)
      .toBe('16px 32px 16px 32px');
  });
  it('defaults missing sides to 0', () => {
    expect(resolveStyle({ pt: 24 }).padding).toBe('24px 0px 0px 0px');
  });
  it('omits padding when none set', () => {
    expect(resolveStyle({}).padding).toBeUndefined();
  });
  it('handles partial padding (pb only)', () => {
    expect(resolveStyle({ pb: 48 }).padding).toBe('0px 0px 48px 0px');
  });
});

// ─── Margin ──────────────────────────────────────────────────────────────────

describe('margin', () => {
  it('produces margin shorthand', () => {
    expect(resolveStyle({ mt: 8, mb: 8 }).margin).toBe('8px 0px 8px 0px');
  });
  it('omits margin when none set', () => {
    expect(resolveStyle({}).margin).toBeUndefined();
  });
});

// ─── Border ──────────────────────────────────────────────────────────────────

describe('border', () => {
  it('maps bw/bs/bc → border properties', () => {
    const s = resolveStyle({ bw: 2, bs: 'dashed', bc: '#e5e7eb' });
    expect(s.borderWidth).toBe('2px');
    expect(s.borderStyle).toBe('dashed');
    expect(s.borderColor).toBe('#e5e7eb');
  });
  it('defaults borderStyle to solid when bc is set', () => {
    expect(resolveStyle({ bc: '#000' }).borderStyle).toBe('solid');
  });
  it('maps br → borderRadius', () => {
    expect(resolveStyle({ br: 12 }).borderRadius).toBe('12px');
  });
  it('omits border when nothing set', () => {
    const s = resolveStyle({});
    expect(s.borderWidth).toBeUndefined();
    expect(s.borderRadius).toBeUndefined();
  });
});

// ─── Effects ─────────────────────────────────────────────────────────────────

describe('effects', () => {
  it('converts opacity 0-100 → 0-1', () => {
    expect(resolveStyle({ opacity: 50 }).opacity).toBe(0.5);
    expect(resolveStyle({ opacity: 100 }).opacity).toBe(1);
    expect(resolveStyle({ opacity: 0 }).opacity).toBe(0);
  });
  it('maps zIndex → zIndex', () => {
    expect(resolveStyle({ zIndex: 10 }).zIndex).toBe(10);
  });
  it('maps overflow → overflow', () => {
    expect(resolveStyle({ overflow: 'hidden' }).overflow).toBe('hidden');
  });
  it('maps shadow preset key → boxShadow string', () => {
    expect(resolveStyle({ shadow: 'md' }).boxShadow).toBe('0 4px 12px rgba(0,0,0,0.12)');
  });
  it('maps shadow:none → no boxShadow', () => {
    expect(resolveStyle({ shadow: 'none' }).boxShadow).toBeUndefined();
  });
  it('passes through custom shadow value', () => {
    const custom = '0 2px 4px red';
    expect(resolveStyle({ shadow: custom }).boxShadow).toBe(custom);
  });
  it('omits opacity when not set', () => {
    expect(resolveStyle({}).opacity).toBeUndefined();
  });
});

// ─── Dimensions ──────────────────────────────────────────────────────────────

describe('dimensions', () => {
  it('maps w:full → width:100%', () => {
    expect(resolveStyle({ w: 'full' }).width).toBe('100%');
  });
  it('maps numeric w → px', () => {
    expect(resolveStyle({ w: '320' }).width).toBe('320px');
  });
  it('passes through non-numeric w (e.g. "50%")', () => {
    expect(resolveStyle({ w: '50%' }).width).toBe('50%');
  });
  it('maps numeric h → px', () => {
    expect(resolveStyle({ h: '480' }).height).toBe('480px');
  });
  it('maps maxW → maxWidth in px', () => {
    expect(resolveStyle({ maxW: 1280 }).maxWidth).toBe('1280px');
  });
  it('maps minH → minHeight in px', () => {
    expect(resolveStyle({ minH: 400 }).minHeight).toBe('400px');
  });
});

// ─── Flex ─────────────────────────────────────────────────────────────────────

describe('flex', () => {
  it('maps display → display', () => {
    expect(resolveStyle({ display: 'flex' }).display).toBe('flex');
    expect(resolveStyle({ display: 'grid' }).display).toBe('grid');
  });
  it('maps flexDir → flexDirection', () => {
    expect(resolveStyle({ flexDir: 'row' }).flexDirection).toBe('row');
    expect(resolveStyle({ flexDir: 'column' }).flexDirection).toBe('column');
  });
  it('maps justify:between → justifyContent:space-between', () => {
    expect(resolveStyle({ justify: 'between' }).justifyContent).toBe('space-between');
  });
  it('maps justify:start → justifyContent:flex-start', () => {
    expect(resolveStyle({ justify: 'start' }).justifyContent).toBe('flex-start');
  });
  it('maps justify:center → justifyContent:center (passthrough)', () => {
    expect(resolveStyle({ justify: 'center' }).justifyContent).toBe('center');
  });
  it('maps align:start → alignItems:flex-start', () => {
    expect(resolveStyle({ align: 'start' }).alignItems).toBe('flex-start');
  });
  it('maps align:stretch → alignItems:stretch', () => {
    expect(resolveStyle({ align: 'stretch' }).alignItems).toBe('stretch');
  });
  it('maps wrap:true → flexWrap:wrap', () => {
    expect(resolveStyle({ wrap: true }).flexWrap).toBe('wrap');
  });
  it('does not set flexWrap when wrap is false', () => {
    expect(resolveStyle({ wrap: false }).flexWrap).toBeUndefined();
  });
  it('maps gap → gap with px', () => {
    expect(resolveStyle({ gap: 24 }).gap).toBe('24px');
  });
  it('maps colGap → columnGap', () => {
    expect(resolveStyle({ colGap: 16 }).columnGap).toBe('16px');
  });
  it('maps rowGap → rowGap', () => {
    expect(resolveStyle({ rowGap: 32 }).rowGap).toBe('32px');
  });
});

// ─── Grid ─────────────────────────────────────────────────────────────────────

describe('grid', () => {
  it('maps integer gridCols → repeat(n, 1fr)', () => {
    expect(resolveStyle({ gridCols: 4 }).gridTemplateColumns).toBe('repeat(4, 1fr)');
  });
  it('maps string gridCols → passthrough', () => {
    expect(resolveStyle({ gridCols: '200px 1fr 200px' }).gridTemplateColumns)
      .toBe('200px 1fr 200px');
  });
  it('maps autoFit → auto-fit with minmax', () => {
    expect(resolveStyle({ gridCols: 3, autoFit: true, minColW: 250 }).gridTemplateColumns)
      .toBe('repeat(auto-fit, minmax(250px, 1fr))');
  });
  it('defaults minColW to 200 when autoFit and minColW not set', () => {
    expect(resolveStyle({ gridCols: 3, autoFit: true }).gridTemplateColumns)
      .toBe('repeat(auto-fit, minmax(200px, 1fr))');
  });
  it('maps integer gridRows → repeat(n, 1fr)', () => {
    expect(resolveStyle({ gridRows: 2 }).gridTemplateRows).toBe('repeat(2, 1fr)');
  });
  it('omits gridTemplateColumns when gridCols not set', () => {
    expect(resolveStyle({}).gridTemplateColumns).toBeUndefined();
  });
});

// ─── Responsive overlay ───────────────────────────────────────────────────────

describe('responsive overlay', () => {
  const base = {
    fontSize: 48,
    gridCols: 4,
    gap: 24,
    responsive: {
      mobile: { fontSize: 24, gridCols: 1, gap: 12 },
      tablet: { gridCols: 2 },
    },
  };

  it('desktop: uses base values', () => {
    const s = resolveStyle(base, 'desktop');
    expect(s.fontSize).toBe('48px');
    expect(s.gridTemplateColumns).toBe('repeat(4, 1fr)');
    expect(s.gap).toBe('24px');
  });

  it('mobile: overrides with mobile values', () => {
    const s = resolveStyle(base, 'mobile');
    expect(s.fontSize).toBe('24px');
    expect(s.gridTemplateColumns).toBe('repeat(1, 1fr)');
    expect(s.gap).toBe('12px');
  });

  it('tablet: overrides only overridden keys', () => {
    const s = resolveStyle(base, 'tablet');
    expect(s.fontSize).toBe('48px');           // inherited from base
    expect(s.gridTemplateColumns).toBe('repeat(2, 1fr)');  // overridden
    expect(s.gap).toBe('24px');                // inherited from base
  });

  it('empty settings → empty CSSProperties (no crash)', () => {
    expect(() => resolveStyle({})).not.toThrow();
    expect(resolveStyle({})).toEqual({});
  });

  it('null/undefined values are skipped gracefully', () => {
    expect(() => resolveStyle({ bg: null as any, fontSize: undefined })).not.toThrow();
  });
});
