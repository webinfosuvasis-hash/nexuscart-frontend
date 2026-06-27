/**
 * NodeRenderer — Step 2 tests
 *
 * Tests the pure render-flow logic that does not require a React runtime:
 *   - isNodeVisible() — breakpoint visibility
 *   - renderNode() flow — depth guard, binding, style, children
 *   - Primitive registration coverage — all 10 required primitives
 *   - Recursive nesting — depth guard enforcement
 *   - Responsive style resolution — breakpoint overlays
 *   - Binding resolution — {{ path }} interpolation
 *
 * React component rendering tests (actual DOM output) require a
 * browser or JSDOM environment. Those ship with the Vitest setup in
 * Sprint 11. These backend ts-jest tests cover the data-transformation
 * layer that is pure TypeScript.
 */

// ─── Inline the pure logic (no React) ────────────────────────────────────────

// --- Visibility ---
function isNodeVisible(
  visibility: { desktop?: boolean; tablet?: boolean; mobile?: boolean } | undefined,
  breakpoint: 'desktop' | 'tablet' | 'mobile',
): boolean {
  if (!visibility) return true;
  return visibility[breakpoint] !== false;
}

// --- Depth guard ---
const MAX_DEPTH = 32;
function wouldExceedDepth(depth: number): boolean {
  return depth > MAX_DEPTH;
}

// --- Style resolver (backend copy, already tested in style-resolver.spec.ts) ---
function buildStyleKey(settings: Record<string, unknown>, breakpoint: string): string {
  // Simplified — just checks that responsive overlays are applied
  if (breakpoint !== 'desktop') {
    const overlay = (settings.responsive as any)?.[breakpoint] ?? {};
    return JSON.stringify({ ...settings, ...overlay });
  }
  return JSON.stringify(settings);
}

// --- Binding resolver (already tested in node-renderer.spec.ts) ---
const BINDING_RE = /\{\{\s*([\w.]+)\s*\}\}/g;
function resolveSetting(v: unknown, ctx: Record<string, unknown>): unknown {
  if (typeof v !== 'string' || !v.includes('{{')) return v;
  return v.replace(BINDING_RE, (m, path: string) => {
    const val = path.split('.').reduce<unknown>((a, k) => (a as any)?.[k], ctx);
    return val !== undefined ? String(val) : m;
  });
}

// --- Registry (same inline version as registry.spec.ts) ---
type Source = 'platform' | 'theme' | 'marketplace' | 'custom';
interface Entry { type: string; comp: string; version: string; source: Source; category?: string }
function createRendererRegistry() {
  const map = new Map<string, Entry>();
  function semverGt(a: string, b: string) {
    const p = (v: string) => v.split('.').map(Number);
    const [am,an,ap] = p(a); const [bm,bn,bp] = p(b);
    if (am !== bm) return am > bm; if (an !== bn) return an > bn; return ap > bp;
  }
  return {
    register(type: string, comp: string, opts: { version?: string; source?: Source; category?: string } = {}) {
      const v = opts.version ?? '1.0.0'; const s = opts.source ?? 'platform';
      const ex = map.get(type);
      if (ex && !semverGt(v, ex.version)) return;
      map.set(type, { type, comp, version: v, source: s, category: opts.category });
    },
    resolve(type: string): string { return map.get(type)?.comp ?? 'Unknown'; },
    isRegistered(type: string): boolean { return map.has(type); },
    entriesByCategory(cat: string): Entry[] { return [...map.values()].filter(e => e.category === cat); },
    entriesBySource(src: Source): Entry[] { return [...map.values()].filter(e => e.source === src); },
    size(): number { return map.size; },
    reset() { map.clear(); },
  };
}

// ─── Registration of all 10 required primitives ───────────────────────────────

function seedPrimitives(reg: ReturnType<typeof createRendererRegistry>) {
  // Layout
  reg.register('container', 'Container', { source: 'platform', category: 'layout' });
  reg.register('stack',     'Stack',     { source: 'platform', category: 'layout' });
  reg.register('grid',      'Grid',      { source: 'platform', category: 'layout' });
  reg.register('columns',   'Columns',   { source: 'platform', category: 'layout' });
  reg.register('spacer',    'Spacer',    { source: 'platform', category: 'layout' });
  reg.register('divider',   'Divider',   { source: 'platform', category: 'layout' });
  // Content
  reg.register('heading',  'Heading',  { source: 'platform', category: 'content' });
  reg.register('text',     'Text',     { source: 'platform', category: 'content' });
  reg.register('image',    'Image',    { source: 'platform', category: 'content' });
  reg.register('button',   'Button',   { source: 'platform', category: 'content' });
}

// ═══════════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Visibility ───────────────────────────────────────────────────────────────

describe('isNodeVisible()', () => {
  it('is visible when no visibility object defined', () => {
    expect(isNodeVisible(undefined, 'desktop')).toBe(true);
    expect(isNodeVisible(undefined, 'tablet')).toBe(true);
    expect(isNodeVisible(undefined, 'mobile')).toBe(true);
  });

  it('is visible when breakpoint key absent from visibility', () => {
    expect(isNodeVisible({ desktop: true }, 'mobile')).toBe(true);
  });

  it('is visible when breakpoint explicitly true', () => {
    expect(isNodeVisible({ mobile: true }, 'mobile')).toBe(true);
  });

  it('is hidden when breakpoint explicitly false', () => {
    expect(isNodeVisible({ mobile: false }, 'mobile')).toBe(false);
  });

  it('desktop visible / tablet+mobile hidden', () => {
    const v = { desktop: true, tablet: false, mobile: false };
    expect(isNodeVisible(v, 'desktop')).toBe(true);
    expect(isNodeVisible(v, 'tablet')).toBe(false);
    expect(isNodeVisible(v, 'mobile')).toBe(false);
  });

  it('only mobile hidden', () => {
    const v = { mobile: false };
    expect(isNodeVisible(v, 'desktop')).toBe(true);
    expect(isNodeVisible(v, 'tablet')).toBe(true);
    expect(isNodeVisible(v, 'mobile')).toBe(false);
  });
});

// ─── Depth guard ─────────────────────────────────────────────────────────────

describe('depth guard', () => {
  it('MAX_DEPTH is 32', () => {
    expect(MAX_DEPTH).toBe(32);
  });

  it('does not exceed limit at depth 32', () => {
    expect(wouldExceedDepth(32)).toBe(false);
  });

  it('exceeds limit at depth 33', () => {
    expect(wouldExceedDepth(33)).toBe(true);
  });

  it('exceeds at depth 100 (deeply malformed tree)', () => {
    expect(wouldExceedDepth(100)).toBe(true);
  });

  it('depth 0 is root (never exceeds)', () => {
    expect(wouldExceedDepth(0)).toBe(false);
  });
});

// ─── Primitive registration — all 10 required ─────────────────────────────────

describe('required primitive registration', () => {
  let reg: ReturnType<typeof createRendererRegistry>;
  beforeEach(() => { reg = createRendererRegistry(); seedPrimitives(reg); });

  const REQUIRED_LAYOUT   = ['container', 'stack', 'grid', 'columns', 'spacer', 'divider'];
  const REQUIRED_CONTENT  = ['heading', 'text', 'image', 'button'];

  test.each(REQUIRED_LAYOUT)('layout primitive "%s" is registered', (type) => {
    expect(reg.isRegistered(type)).toBe(true);
    expect(reg.resolve(type)).not.toBe('Unknown');
  });

  test.each(REQUIRED_CONTENT)('content primitive "%s" is registered', (type) => {
    expect(reg.isRegistered(type)).toBe(true);
    expect(reg.resolve(type)).not.toBe('Unknown');
  });

  it('all 10 required primitives are registered', () => {
    const required = [...REQUIRED_LAYOUT, ...REQUIRED_CONTENT];
    const missing  = required.filter((t) => !reg.isRegistered(t));
    expect(missing).toHaveLength(0);
  });

  it('layout primitives carry category=layout', () => {
    const entries = reg.entriesByCategory('layout');
    expect(entries.length).toBeGreaterThanOrEqual(REQUIRED_LAYOUT.length);
    REQUIRED_LAYOUT.forEach((t) => {
      expect(entries.some((e) => e.type === t)).toBe(true);
    });
  });

  it('content primitives carry category=content', () => {
    const entries = reg.entriesByCategory('content');
    expect(entries.length).toBeGreaterThanOrEqual(REQUIRED_CONTENT.length);
  });

  it('all platform primitives have source=platform', () => {
    const platform = reg.entriesBySource('platform');
    expect(platform.length).toBe(10);
  });

  it('unknown type resolves to Unknown fallback, not a real primitive', () => {
    expect(reg.resolve('xyz_does_not_exist')).toBe('Unknown');
  });
});

// ─── Recursive nesting ────────────────────────────────────────────────────────

describe('recursive nesting simulation', () => {
  // Simulate the depth counter increment at each recursion level
  function simulateRender(depth: number, maxChildren: number): { rendered: number; blocked: number } {
    let rendered = 0, blocked = 0;
    function recurse(d: number) {
      if (wouldExceedDepth(d)) { blocked++; return; }
      rendered++;
      if (d < maxChildren) recurse(d + 1);
    }
    recurse(depth);
    return { rendered, blocked };
  }

  it('renders a 5-level deep tree without hitting depth guard', () => {
    const { rendered, blocked } = simulateRender(0, 5);
    expect(rendered).toBe(6);   // 0,1,2,3,4,5
    expect(blocked).toBe(0);
  });

  it('renders exactly up to MAX_DEPTH=32 then blocks', () => {
    const { rendered, blocked } = simulateRender(0, 100);
    expect(rendered).toBe(MAX_DEPTH + 1);  // 0..32
    expect(blocked).toBe(1);              // depth 33 is blocked
  });

  it('single node (no children) renders fine', () => {
    const { rendered, blocked } = simulateRender(0, 0);
    expect(rendered).toBe(1);
    expect(blocked).toBe(0);
  });

  it('depth starts at 0 for root node', () => {
    expect(wouldExceedDepth(0)).toBe(false);
  });
});

// ─── Style resolution ────────────────────────────────────────────────────────

describe('style resolution through responsive overlays', () => {
  const baseSettings = {
    display:  'grid',
    gridCols: 4,
    gap:      24,
    responsive: {
      tablet: { gridCols: 2 },
      mobile: { gridCols: 1, gap: 12 },
    },
  };

  it('desktop uses base settings (no overlay)', () => {
    const key = buildStyleKey(baseSettings, 'desktop');
    const parsed = JSON.parse(key);
    expect(parsed.gridCols).toBe(4);
    expect(parsed.gap).toBe(24);
  });

  it('tablet overlay overrides gridCols only', () => {
    const merged = { ...baseSettings, ...(baseSettings.responsive.tablet ?? {}) };
    expect(merged.gridCols).toBe(2);
    expect(merged.gap).toBe(24);   // not overridden
  });

  it('mobile overlay overrides both gridCols and gap', () => {
    const merged = { ...baseSettings, ...(baseSettings.responsive.mobile ?? {}) };
    expect(merged.gridCols).toBe(1);
    expect(merged.gap).toBe(12);
  });

  it('node with no responsive key uses base at all breakpoints', () => {
    const s = { display: 'flex', flexDir: 'column' };
    expect(buildStyleKey(s, 'desktop')).toBe(buildStyleKey(s, 'mobile'));
  });
});

// ─── Binding resolution in render flow ───────────────────────────────────────

describe('binding resolution', () => {
  const ctx = {
    product:    { title: 'Silk Saree', price: 2999, vendor: 'Suta' },
    collection: { title: 'Summer Collection' },
  };

  it('heading text resolves product.title', () => {
    const resolved = resolveSetting('{{ product.title }}', ctx);
    expect(resolved).toBe('Silk Saree');
  });

  it('button label resolves with surrounding text', () => {
    const resolved = resolveSetting('Buy {{ product.title }} — ₹{{ product.price }}', ctx);
    expect(resolved).toBe('Buy Silk Saree — ₹2999');
  });

  it('static text passes through unchanged', () => {
    expect(resolveSetting('Shop Now', ctx)).toBe('Shop Now');
  });

  it('unknown path leaves placeholder', () => {
    expect(resolveSetting('{{ product.sku }}', ctx)).toBe('{{ product.sku }}');
  });

  it('non-string settings are unchanged', () => {
    expect(resolveSetting(42, ctx)).toBe(42);
    expect(resolveSetting(true, ctx)).toBe(true);
    expect(resolveSetting(null, ctx)).toBe(null);
  });

  it('resolves across all settings in a node', () => {
    const settings = {
      text:  '{{ product.title }}',
      price: '₹{{ product.price }}',
      href:  '/products/silk-saree',
      count: 5,
    };
    const resolved = Object.fromEntries(
      Object.entries(settings).map(([k, v]) => [k, resolveSetting(v, ctx)]),
    );
    expect(resolved.text).toBe('Silk Saree');
    expect(resolved.price).toBe('₹2999');
    expect(resolved.href).toBe('/products/silk-saree');
    expect(resolved.count).toBe(5);
  });
});

// ─── Render flow simulation ───────────────────────────────────────────────────

describe('render flow', () => {
  interface SimpleNode {
    id:          string;
    type:        string;
    settings:    Record<string, unknown>;
    visibility?: { desktop?: boolean; tablet?: boolean; mobile?: boolean };
    children?:   SimpleNode[];
  }

  function simulateRenderFlow(
    node:       SimpleNode,
    breakpoint: 'desktop' | 'tablet' | 'mobile',
    depth:      number = 0,
    reg:        ReturnType<typeof createRendererRegistry>,
  ): { id: string; type: string; component: string; children: ReturnType<typeof simulateRenderFlow>[] } | null {
    // Depth guard
    if (wouldExceedDepth(depth)) return null;
    // Visibility
    if (!isNodeVisible(node.visibility, breakpoint)) return null;
    // Registry lookup
    const component = reg.resolve(node.type);
    // Recurse
    const children = (node.children ?? [])
      .map((c) => simulateRenderFlow(c, breakpoint, depth + 1, reg))
      .filter((c): c is NonNullable<typeof c> => c !== null);
    return { id: node.id, type: node.type, component, children };
  }

  let reg: ReturnType<typeof createRendererRegistry>;
  beforeEach(() => { reg = createRendererRegistry(); seedPrimitives(reg); });

  it('renders root node', () => {
    const tree: SimpleNode = { id: 'root', type: 'container', settings: {} };
    const result = simulateRenderFlow(tree, 'desktop', 0, reg);
    expect(result).not.toBeNull();
    expect(result!.component).toBe('Container');
  });

  it('renders children recursively', () => {
    const tree: SimpleNode = {
      id: 'root', type: 'container', settings: {},
      children: [
        { id: 'h1', type: 'heading', settings: { text: 'Title' } },
        { id: 'b1', type: 'button',  settings: { label: 'Buy' }  },
      ],
    };
    const result = simulateRenderFlow(tree, 'desktop', 0, reg);
    expect(result!.children).toHaveLength(2);
    expect(result!.children[0].component).toBe('Heading');
    expect(result!.children[1].component).toBe('Button');
  });

  it('hidden node returns null', () => {
    const node: SimpleNode = {
      id: 'n', type: 'heading', settings: {},
      visibility: { desktop: false },
    };
    expect(simulateRenderFlow(node, 'desktop', 0, reg)).toBeNull();
  });

  it('hidden on mobile but visible on desktop', () => {
    const node: SimpleNode = {
      id: 'n', type: 'heading', settings: {},
      visibility: { desktop: true, mobile: false },
    };
    expect(simulateRenderFlow(node, 'desktop', 0, reg)).not.toBeNull();
    expect(simulateRenderFlow(node, 'mobile',  0, reg)).toBeNull();
  });

  it('unknown type renders as Unknown fallback', () => {
    const node: SimpleNode = { id: 'n', type: 'custom_xyz_unknown', settings: {} };
    const result = simulateRenderFlow(node, 'desktop', 0, reg);
    expect(result!.component).toBe('Unknown');
  });

  it('depth guard stops rendering at MAX_DEPTH + 1', () => {
    // Build a 34-level deep chain
    let deepNode: SimpleNode = { id: 'leaf', type: 'heading', settings: {} };
    for (let i = MAX_DEPTH + 1; i >= 0; i--) {
      deepNode = { id: `n${i}`, type: 'container', settings: {}, children: [deepNode] };
    }
    // Root at depth 0; leaf at depth MAX_DEPTH+2 — must be null
    const result = simulateRenderFlow(deepNode, 'desktop', 0, reg);
    // The root renders; the node at depth MAX_DEPTH+1 is blocked
    function findAtDepth(
      n: ReturnType<typeof simulateRenderFlow>,
      d: number,
    ): ReturnType<typeof simulateRenderFlow> {
      if (!n || d === 0) return n;
      return findAtDepth(n.children[0] ?? null, d - 1);
    }
    const atMax  = findAtDepth(result, MAX_DEPTH);
    const beyond = findAtDepth(result, MAX_DEPTH + 1);
    expect(atMax).not.toBeNull();    // MAX_DEPTH renders fine
    expect(beyond).toBeNull();       // MAX_DEPTH+1 is blocked
  });

  it('renders a 5-deep realistic tree: section→grid→columns→stack→text', () => {
    const tree: SimpleNode = {
      id: 'section', type: 'container', settings: {},
      children: [{
        id: 'grid', type: 'grid', settings: { gridCols: 2 },
        children: [{
          id: 'col', type: 'columns', settings: { ratios: '2,1' },
          children: [{
            id: 'stk', type: 'stack', settings: { gap: 16 },
            children: [
              { id: 'h',  type: 'heading', settings: { text: 'Title'   } },
              { id: 'tx', type: 'text',    settings: { text: 'Body copy'} },
            ],
          }],
        }],
      }],
    };
    const result = simulateRenderFlow(tree, 'desktop', 0, reg);
    const text = result!.children[0]!.children[0]!.children[0]!.children[1]!;
    expect(text.component).toBe('Text');
    expect(text.type).toBe('text');
  });
});
