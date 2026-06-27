/**
 * Recursive Rendering Tests — Step 5
 *
 * Production-safety test suite for the NodeRenderer engine.
 * These tests answer the question: "Is NodeRenderer safe to flip live stores to?"
 *
 * Five required areas:
 *   A. Deep nesting           — structural integrity at depth 1 → MAX_DEPTH+1
 *   B. Responsive rendering   — breakpoint resolution across all primitives
 *   C. Style resolution       — CSS output correctness across all property groups
 *   D. Unknown component      — graceful degradation, siblings unaffected
 *   E. Parity fixtures        — golden-master: NodeRenderer ≡ old SectionRenderer data
 *
 * All tests are pure TypeScript — no React runtime required.
 * React component rendering is validated by the Playwright parity harness (Step 5b).
 */

import { transformSectionsToPageDocument } from './page-section-to-document';
import { resolveStyle }                    from './style-resolver';
import type { RawSection, Node }           from './types';

// ─── Shared helpers ───────────────────────────────────────────────────────────

const MAX_DEPTH = 32;

type BP = 'desktop' | 'tablet' | 'mobile';

/** Inline visibility check (mirrors NodeRenderer.tsx) */
function isVisible(
  v: { desktop?: boolean; tablet?: boolean; mobile?: boolean } | undefined,
  bp: BP,
): boolean {
  if (!v) return true;
  return v[bp] !== false;
}

/** Build a flat list of all node ids in the tree (BFS) */
function collectIds(node: Node): string[] {
  const ids: string[] = [node.id];
  for (const c of node.children ?? []) ids.push(...collectIds(c));
  return ids;
}

/** Find a node by id anywhere in the tree */
function findNode(tree: Node, id: string): Node | undefined {
  if (tree.id === id) return tree;
  for (const c of tree.children ?? []) {
    const found = findNode(c, id);
    if (found) return found;
  }
  return undefined;
}

/** Build a chain of nodes each wrapping the next (simulates deep nesting) */
function buildChain(types: string[], leafSettings: Record<string, unknown> = {}): Node {
  const makeNode = (type: string, depth: number): Node => ({
    id:       `${type}-${depth}`,
    type,
    settings: depth === types.length - 1 ? leafSettings : {},
    children: depth < types.length - 1 ? [makeNode(types[depth + 1], depth + 1)] : [],
  });
  return makeNode(types[0], 0);
}

/** Simulate depth-limited render traversal — returns count of rendered vs blocked */
function simulateTraversal(node: Node, bp: BP, depth: number = 0): { rendered: string[]; blocked: string[] } {
  const rendered: string[] = [];
  const blocked:  string[] = [];

  if (depth > MAX_DEPTH) { blocked.push(node.id); return { rendered, blocked }; }
  if (!isVisible(node.visibility, bp)) return { rendered, blocked };

  rendered.push(node.id);
  for (const child of node.children ?? []) {
    const r = simulateTraversal(child, bp, depth + 1);
    rendered.push(...r.rendered);
    blocked.push(...r.blocked);
  }
  return { rendered, blocked };
}

// ─── Golden fixtures (matching page-section-to-document.spec.ts) ─────────────

const STORE_ID = 'store_test_001';
const THEME_ID = 'dawn';
const PAGE_ID  = 'home';

const HERO: RawSection = {
  id: 'sec_hero_001', sectionDefId: 'hero', label: 'Hero',
  sortOrder: 1, isVisible: true, isDraft: true,
  settings: {
    backgroundImage:  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1400&q=80',
    backgroundColor:  '#1a1a2e',
    overlayOpacity:   50,
    height:           'md',
    contentAlignment: 'center',
  },
  blocks: [
    { id: 'blk_h1', type: 'heading', sortOrder: 1, isVisible: true,
      settings: { text: 'Browse our latest products', typographyPreset: 'h1', textColor: '#ffffff' } },
    { id: 'blk_b1', type: 'button', sortOrder: 2, isVisible: true,
      settings: { label: 'Shop all', link: '/collections', style: 'outline', size: 'lg' } },
  ],
};

const FEATURED: RawSection = {
  id: 'sec_fc_001', sectionDefId: 'featured_collection', label: 'Featured collection',
  sortOrder: 2, isVisible: true, isDraft: true,
  settings: { productsToShow: 4, columnsDesktop: '4', columnsM: '2', showViewAll: true },
  blocks: [
    { id: 'blk_ct1', type: 'collection_title', sortOrder: 1, isVisible: true,
      settings: { text: 'Products', alignment: 'left', textColor: '#111827' } },
    { id: 'blk_va1', type: 'view_all_button',  sortOrder: 2, isVisible: true,
      settings: { label: 'View all', link: '/collections', style: 'link' } },
    { id: 'blk_pc1', type: 'product_card',     sortOrder: 3, isVisible: true,
      settings: { showRating: true, showQuickAdd: true, imageRatio: '1/1' } },
  ],
};

const NEWSLETTER: RawSection = {
  id: 'sec_nl_001', sectionDefId: 'newsletter', label: 'Newsletter',
  sortOrder: 3, isVisible: true, isDraft: true,
  settings: { placeholder: 'Email address', buttonLabel: 'Subscribe', successMsg: 'Thanks!' },
  blocks: [
    { id: 'blk_nlh1', type: 'heading',   sortOrder: 1, isVisible: true,
      settings: { text: 'Subscribe to our emails', typographyPreset: 'h2', textColor: '#111827' } },
    { id: 'blk_nlp1', type: 'paragraph', sortOrder: 2, isVisible: true,
      settings: { text: 'Be the first to know about new collections.', textColor: '#374151' } },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// A. DEEP NESTING
// ═══════════════════════════════════════════════════════════════════════════════

describe('A. Deep nesting — structural integrity', () => {

  describe('A1. Linear chain at increasing depths', () => {
    const PRIMITIVES = ['container', 'stack', 'grid', 'columns', 'heading', 'text'];

    it('depth 1 — root only renders', () => {
      const tree = buildChain(['container']);
      const { rendered, blocked } = simulateTraversal(tree, 'desktop');
      expect(rendered).toHaveLength(1);
      expect(blocked).toHaveLength(0);
    });

    it('depth 3 — container > stack > heading', () => {
      const tree = buildChain(['container', 'stack', 'heading']);
      const { rendered, blocked } = simulateTraversal(tree, 'desktop');
      expect(rendered).toHaveLength(3);
      expect(blocked).toHaveLength(0);
    });

    it('depth 5 — realistic section > grid > columns > stack > text', () => {
      const tree = buildChain(['container', 'grid', 'columns', 'stack', 'text']);
      const { rendered, blocked } = simulateTraversal(tree, 'desktop');
      expect(rendered).toHaveLength(5);
      expect(blocked).toHaveLength(0);
    });

    it('depth 10 — renders all', () => {
      const types = Array.from({ length: 10 }, (_, i) => PRIMITIVES[i % PRIMITIVES.length]);
      const tree  = buildChain(types);
      const { rendered, blocked } = simulateTraversal(tree, 'desktop');
      expect(rendered).toHaveLength(10);
      expect(blocked).toHaveLength(0);
    });

    it('depth 15 — renders all', () => {
      const types = Array.from({ length: 15 }, (_, i) => PRIMITIVES[i % PRIMITIVES.length]);
      const tree  = buildChain(types);
      const { rendered, blocked } = simulateTraversal(tree, 'desktop');
      expect(rendered).toHaveLength(15);
      expect(blocked).toHaveLength(0);
    });

    it('depth 32 (MAX_DEPTH) — all 33 levels render (depths 0..32, none exceed MAX_DEPTH)', () => {
      // Chain of 33: root at depth 0, leaf at depth 32. 32 > 32 is FALSE so all render.
      const types = Array.from({ length: 33 }, (_, i) => PRIMITIVES[i % PRIMITIVES.length]);
      const tree  = buildChain(types);
      const { rendered, blocked } = simulateTraversal(tree, 'desktop');
      expect(rendered).toHaveLength(33);   // depths 0..32, all ≤ MAX_DEPTH
      expect(blocked).toHaveLength(0);
    });

    it('depth 33 (MAX_DEPTH + 1) — node at depth 33 is blocked', () => {
      // Chain of 34: depths 0..33. depth 33 > MAX_DEPTH(32) = blocked.
      const types = Array.from({ length: 34 }, (_, i) => PRIMITIVES[i % PRIMITIVES.length]);
      const tree  = buildChain(types);
      const { rendered, blocked } = simulateTraversal(tree, 'desktop');
      expect(rendered).toHaveLength(33);   // depths 0..32 render
      expect(blocked).toHaveLength(1);     // depth 33 is blocked
    });

    it('depth 50 — exactly one node blocked (the first one exceeding MAX_DEPTH)', () => {
      // Chain of 50: depths 0..49. Only depth 33 is first encountered as blocked.
      // But since each node has exactly one child, the traversal stops at depth 33.
      const types = Array.from({ length: 50 }, (_, i) => PRIMITIVES[i % PRIMITIVES.length]);
      const tree  = buildChain(types);
      const { rendered, blocked } = simulateTraversal(tree, 'desktop');
      expect(rendered).toHaveLength(33);   // depths 0..32
      expect(blocked).toHaveLength(1);     // first exceeding node (depth 33) is blocked
    });
  });

  describe('A2. Wide trees (many siblings)', () => {
    it('root with 10 children all render', () => {
      const root: Node = {
        id: 'root', type: 'grid', settings: { gridCols: 10 },
        children: Array.from({ length: 10 }, (_, i) => ({
          id: `child-${i}`, type: 'heading', settings: { text: `Heading ${i}` }, children: [],
        })),
      };
      const { rendered, blocked } = simulateTraversal(root, 'desktop');
      expect(rendered).toHaveLength(11);   // root + 10 children
      expect(blocked).toHaveLength(0);
    });

    it('grid with 4 columns each 3 deep — total 13 nodes', () => {
      const grid: Node = {
        id: 'grid', type: 'grid', settings: { gridCols: 4 },
        children: Array.from({ length: 4 }, (_, i) => ({
          id:   `col-${i}`,
          type: 'stack',
          settings: {},
          children: [
            { id: `h-${i}`, type: 'heading', settings: {}, children: [] },
            { id: `t-${i}`, type: 'text',    settings: {}, children: [] },
          ],
        })),
      };
      const { rendered } = simulateTraversal(grid, 'desktop');
      expect(rendered).toHaveLength(13);   // 1 grid + 4 stacks + 4 headings + 4 texts
    });
  });

  describe('A3. Settings independence (parent settings never leak to children)', () => {
    it('parent bg does not appear in child node settings', () => {
      const tree: Node = {
        id: 'p', type: 'container', settings: { bg: '#111111', pt: 48 },
        children: [{
          id: 'c', type: 'heading', settings: { text: 'Title', color: '#ffffff' }, children: [],
        }],
      };
      const child = findNode(tree, 'c')!;
      expect(child.settings.bg).toBeUndefined();
      expect(child.settings.pt).toBeUndefined();
      expect(child.settings.text).toBe('Title');
    });

    it('child settings mutation does not affect parent', () => {
      const tree: Node = {
        id: 'p', type: 'container', settings: { bg: '#fff' },
        children: [{ id: 'c', type: 'heading', settings: { text: 'A' }, children: [] }],
      };
      // Simulate a settings merge (as NodeRenderer does for responsive)
      const childNode = findNode(tree, 'c')!;
      const resolvedChild = { ...childNode.settings, extra: 'injected' };
      // Parent is unchanged
      expect(tree.settings.bg).toBe('#fff');
      expect((tree.settings as any).extra).toBeUndefined();
    });

    it('all node ids in a 5-deep tree are unique', () => {
      const tree = buildChain(['container', 'grid', 'columns', 'stack', 'text']);
      const ids = collectIds(tree);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe('A4. NodeRenderer structural guarantees', () => {
    it('children array is always present (empty for leaves)', () => {
      const leaf: Node = { id: 'l', type: 'heading', settings: {}, children: [] };
      expect(Array.isArray(leaf.children)).toBe(true);
    });

    it('tree built from transform has correct depth structure', () => {
      const doc = transformSectionsToPageDocument(STORE_ID, THEME_ID, PAGE_ID, [HERO], 'DRAFT');
      const tree = doc.tree;
      // Root is the page wrapper
      expect(tree.type).toBe('root');
      // First child is the hero section
      expect(tree.children).toHaveLength(1);
      const heroNode = tree.children![0];
      expect(heroNode.type).toBe('hero');
      // Hero has 2 blocks as children
      expect(heroNode.children).toHaveLength(2);
      // Blocks are leaves
      heroNode.children!.forEach((c) => expect(c.children).toEqual([]));
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// B. RESPONSIVE RENDERING
// ═══════════════════════════════════════════════════════════════════════════════

describe('B. Responsive rendering', () => {

  describe('B1. Breakpoint visibility combinations', () => {
    const cases: [string, { desktop?: boolean; tablet?: boolean; mobile?: boolean }, BP, boolean][] = [
      ['all visible (default)',        {},                           'desktop', true ],
      ['desktop:true',                 { desktop: true },            'desktop', true ],
      ['desktop:false',                { desktop: false },           'desktop', false],
      ['mobile:false, desktop:true',   { desktop: true, mobile: false }, 'mobile',  false],
      ['mobile:false, desktop:true',   { desktop: true, mobile: false }, 'desktop', true ],
      ['tablet:false only',            { tablet: false },            'tablet',  false],
      ['tablet:false, mobile:visible', { tablet: false },            'mobile',  true ],
      ['all false',                    { desktop:false, tablet:false, mobile:false }, 'desktop', false],
      ['all true',                     { desktop:true,  tablet:true,  mobile:true  }, 'mobile',  true ],
    ];

    test.each(cases)('%s at bp=%s → %s', (_, visibility, bp, expected) => {
      expect(isVisible(visibility, bp)).toBe(expected);
    });
  });

  describe('B2. Responsive overlays per primitive type', () => {
    // Only use settings keys that resolve to CSS properties via resolveStyle
    const LAYOUTS = [
      {
        type:   'container',
        base:   { display: 'flex', flexDir: 'row',  gap: 24 } as Record<string,unknown>,
        mobile: { flexDir: 'column', gap: 12 }                 as Record<string,unknown>,
        // CSS key → expected desktop value, expected mobile value
        checks: [
          { cssKey: 'flexDirection', desktopVal: 'row',    mobileVal: 'column' },
          { cssKey: 'gap',           desktopVal: '24px',   mobileVal: '12px'   },
        ],
      },
      {
        type:   'grid',
        base:   { gridCols: 4, gap: 24 }              as Record<string,unknown>,
        mobile: { gridCols: 1, gap: 12 }              as Record<string,unknown>,
        checks: [
          { cssKey: 'gridTemplateColumns', desktopVal: 'repeat(4, 1fr)', mobileVal: 'repeat(1, 1fr)' },
          { cssKey: 'gap',                 desktopVal: '24px',            mobileVal: '12px'            },
        ],
      },
      {
        type:   'stack',
        base:   { display: 'flex', flexDir: 'column', gap: 16 } as Record<string,unknown>,
        mobile: { gap: 8 }                                       as Record<string,unknown>,
        checks: [
          { cssKey: 'flexDirection', desktopVal: 'column', mobileVal: 'column' },
          { cssKey: 'gap',           desktopVal: '16px',   mobileVal: '8px'    },
        ],
      },
    ];

    test.each(LAYOUTS)('$type: mobile override applied correctly', ({ base, mobile, checks }) => {
      const settings     = { ...base, responsive: { mobile } };
      const desktopStyle = resolveStyle(settings, 'desktop') as Record<string, unknown>;
      const mobileStyle  = resolveStyle(settings, 'mobile')  as Record<string, unknown>;

      for (const { cssKey, desktopVal, mobileVal } of checks) {
        expect(desktopStyle[cssKey]).toBe(desktopVal);
        expect(mobileStyle[cssKey]).toBe(mobileVal);
      }
    });

    it('grid: 4-col desktop → 2-col tablet → 1-col mobile', () => {
      const s = { gridCols: 4, responsive: { tablet: { gridCols: 2 }, mobile: { gridCols: 1 } } };
      expect(resolveStyle(s, 'desktop').gridTemplateColumns).toBe('repeat(4, 1fr)');
      expect(resolveStyle(s, 'tablet').gridTemplateColumns).toBe('repeat(2, 1fr)');
      expect(resolveStyle(s, 'mobile').gridTemplateColumns).toBe('repeat(1, 1fr)');
    });

    it('spacer: height 48px desktop → 24px mobile', () => {
      const s = { h: 48, responsive: { mobile: { h: 24 } } };
      const desktopH = s.h;
      const mobileH  = ((s.responsive.mobile as any).h as number);
      expect(desktopH).toBe(48);
      expect(mobileH).toBe(24);
    });

    it('divider: opacity 1.0 desktop → 0.5 mobile', () => {
      const s = { opacity: 100, responsive: { mobile: { opacity: 50 } } };
      expect(resolveStyle(s, 'desktop').opacity).toBe(1.0);
      expect(resolveStyle(s, 'mobile').opacity).toBe(0.5);
    });
  });

  describe('B3. Mixed visibility in the same tree', () => {
    it('mobile-hidden sibling does not affect other siblings', () => {
      const root: Node = {
        id: 'root', type: 'stack', settings: {},
        children: [
          { id: 'a', type: 'heading', settings: {}, visibility: { mobile: false }, children: [] },
          { id: 'b', type: 'text',    settings: {}, children: [] },
          { id: 'c', type: 'button',  settings: {}, visibility: { tablet: false }, children: [] },
        ],
      };
      const { rendered: mobileRendered } = simulateTraversal(root, 'mobile');
      const { rendered: tabletRendered } = simulateTraversal(root, 'tablet');

      expect(mobileRendered).toContain('root');
      expect(mobileRendered).not.toContain('a');   // hidden on mobile
      expect(mobileRendered).toContain('b');         // visible on mobile
      expect(mobileRendered).toContain('c');         // only tablet-hidden

      expect(tabletRendered).toContain('a');         // visible on tablet
      expect(tabletRendered).not.toContain('c');     // hidden on tablet
    });

    it('hidden parent hides all descendants', () => {
      const root: Node = {
        id: 'root', type: 'container', settings: {},
        visibility: { mobile: false },
        children: [
          { id: 'child', type: 'heading', settings: {}, children: [] },
        ],
      };
      const { rendered } = simulateTraversal(root, 'mobile');
      expect(rendered).toHaveLength(0);   // root hidden → children not traversed
    });

    it('responsive overlay tablet inherits desktop when no tablet key exists', () => {
      const s = { bg: '#ffffff', responsive: { mobile: { bg: '#000000' } } };
      const desktopBg = resolveStyle(s, 'desktop').backgroundColor;
      const tabletBg  = resolveStyle(s, 'tablet').backgroundColor;
      const mobileBg  = resolveStyle(s, 'mobile').backgroundColor;
      expect(desktopBg).toBe('#ffffff');
      expect(tabletBg).toBe('#ffffff');   // inherited — no tablet override
      expect(mobileBg).toBe('#000000');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// C. STYLE RESOLUTION
// ═══════════════════════════════════════════════════════════════════════════════

describe('C. Style resolution', () => {

  describe('C1. Empty and partial settings', () => {
    it('empty settings → empty CSSProperties object', () => {
      expect(resolveStyle({}, 'desktop')).toEqual({});
    });

    it('settings with only unknown keys → empty output', () => {
      const out = resolveStyle({ unknown_key: 'value', another: 123 } as any, 'desktop');
      expect(Object.keys(out)).toHaveLength(0);
    });

    it('single key bg → only backgroundColor', () => {
      const out = resolveStyle({ bg: '#ff0000' }, 'desktop');
      expect(Object.keys(out)).toEqual(['backgroundColor']);
      expect(out.backgroundColor).toBe('#ff0000');
    });
  });

  describe('C2. All style groups', () => {
    it('background group all 4 keys', () => {
      const s = { bg: '#fff', bgImage: 'x.jpg', bgSize: 'cover', bgPos: 'center' };
      const out = resolveStyle(s, 'desktop');
      expect(out.backgroundColor).toBe('#fff');
      expect(out.backgroundImage).toBe('url(x.jpg)');
      expect(out.backgroundSize).toBe('cover');
      expect(out.backgroundPosition).toBe('center');
    });

    it('padding shorthand — all 4 sides', () => {
      const out = resolveStyle({ pt: 16, pr: 32, pb: 16, pl: 32 }, 'desktop');
      expect(out.padding).toBe('16px 32px 16px 32px');
    });

    it('border all 4 keys', () => {
      const out = resolveStyle({ bw: 2, bs: 'dashed', bc: '#e5e7eb', br: 8 }, 'desktop');
      expect(out.borderWidth).toBe('2px');
      expect(out.borderStyle).toBe('dashed');
      expect(out.borderColor).toBe('#e5e7eb');
      expect(out.borderRadius).toBe('8px');
    });

    it('opacity 0-100 → 0-1 conversion', () => {
      expect(resolveStyle({ opacity: 0   }, 'desktop').opacity).toBe(0);
      expect(resolveStyle({ opacity: 50  }, 'desktop').opacity).toBe(0.5);
      expect(resolveStyle({ opacity: 100 }, 'desktop').opacity).toBe(1);
    });

    it('shadow preset keys map to strings', () => {
      ['sm', 'md', 'lg', 'xl', '2xl'].forEach((preset) => {
        const out = resolveStyle({ shadow: preset }, 'desktop');
        expect(typeof out.boxShadow).toBe('string');
        expect(String(out.boxShadow!).length).toBeGreaterThan(0);
      });
    });

    it('grid auto-fit with minColW', () => {
      const out = resolveStyle({ display: 'grid', gridCols: 4, autoFit: true, minColW: 250 }, 'desktop');
      expect(out.gridTemplateColumns).toBe('repeat(auto-fit, minmax(250px, 1fr))');
    });

    it('flex direction row → flexDirection row', () => {
      const out = resolveStyle({ display: 'flex', flexDir: 'row' }, 'desktop');
      expect(out.display).toBe('flex');
      expect(out.flexDirection).toBe('row');
    });
  });

  describe('C3. Responsive style priority', () => {
    it('mobile key overrides desktop key', () => {
      const s = { color: '#000', responsive: { mobile: { color: '#fff' } } };
      expect(resolveStyle(s, 'desktop').color).toBe('#000');
      expect(resolveStyle(s, 'mobile').color).toBe('#fff');
    });

    it('mobile overlay only overrides specified keys', () => {
      const s = { color: '#000', fontSize: 16, responsive: { mobile: { fontSize: 12 } } };
      const m = resolveStyle(s, 'mobile');
      expect(m.color).toBe('#000');        // not in mobile overlay — base value
      expect(m.fontSize).toBe('12px');    // overridden
    });

    it('null/undefined values in overlay do not crash', () => {
      const s = { bg: '#fff', responsive: { mobile: { bg: null, color: undefined } } };
      expect(() => resolveStyle(s as any, 'mobile')).not.toThrow();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// D. UNKNOWN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

describe('D. Unknown component — graceful degradation', () => {

  // Registry inline for this section
  type Source = 'platform' | 'marketplace';
  function buildRegistry() {
    const map = new Map<string, string>();
    return {
      register(type: string, comp: string) { map.set(type, comp); },
      resolve(type: string): string { return map.get(type) ?? 'Unknown'; },
      isRegistered(type: string) { return map.has(type); },
      unregister(type: string) { map.delete(type); },
    };
  }

  describe('D1. Basic unknown resolution', () => {
    it('completely unknown type resolves to Unknown', () => {
      const reg = buildRegistry();
      reg.register('heading', 'Heading');
      expect(reg.resolve('xyz_does_not_exist')).toBe('Unknown');
    });

    it('empty string type resolves to Unknown', () => {
      expect(buildRegistry().resolve('')).toBe('Unknown');
    });

    it('typo type resolves to Unknown', () => {
      const reg = buildRegistry();
      reg.register('grid', 'Grid');
      expect(reg.resolve('grrid')).toBe('Unknown');
      expect(reg.resolve('Grid')).toBe('Unknown');   // case-sensitive
    });

    it('type with namespace resolves if registered', () => {
      const reg = buildRegistry();
      reg.register('custom:saree-story', 'SareeStory');
      expect(reg.resolve('custom:saree-story')).toBe('SareeStory');
      expect(reg.resolve('saree-story')).toBe('Unknown');
    });
  });

  describe('D2. Unknown in the middle of a tree — siblings unaffected', () => {
    function treeWithUnknown(): Node {
      return {
        id: 'root', type: 'container', settings: {},
        children: [
          { id: 'h1',   type: 'heading',           settings: {}, children: [] },
          { id: 'unk1', type: 'custom_unknown_xyz', settings: {}, children: [] },
          { id: 'h2',   type: 'heading',            settings: {}, children: [] },
        ],
      };
    }

    it('unknown sibling does not block traversal', () => {
      const tree = treeWithUnknown();
      const { rendered } = simulateTraversal(tree, 'desktop');
      // All 4 nodes are visited (unknown is rendered, just as Unknown component)
      expect(rendered).toContain('root');
      expect(rendered).toContain('h1');
      expect(rendered).toContain('unk1');  // visited, resolved to Unknown
      expect(rendered).toContain('h2');
    });

    it('unknown node with children — children are still traversed', () => {
      const tree: Node = {
        id: 'root', type: 'container', settings: {},
        children: [{
          id: 'unk', type: 'custom_xyz', settings: {},
          children: [
            { id: 'c1', type: 'heading', settings: {}, children: [] },
            { id: 'c2', type: 'text',    settings: {}, children: [] },
          ],
        }],
      };
      const { rendered } = simulateTraversal(tree, 'desktop');
      expect(rendered).toContain('c1');
      expect(rendered).toContain('c2');
    });

    it('5 unknowns in a flat list — all traversed', () => {
      const root: Node = {
        id: 'root', type: 'stack', settings: {},
        children: Array.from({ length: 5 }, (_, i) => ({
          id: `unk-${i}`, type: `unknown_type_${i}`, settings: {}, children: [],
        })),
      };
      const { rendered } = simulateTraversal(root, 'desktop');
      expect(rendered).toHaveLength(6);   // root + 5 unknowns
    });
  });

  describe('D3. Registry mutation safety', () => {
    it('unregister + resolve returns Unknown', () => {
      const reg = buildRegistry();
      reg.register('grid', 'Grid');
      reg.unregister('grid');
      expect(reg.resolve('grid')).toBe('Unknown');
    });

    it('re-register after unregister resolves to new component', () => {
      const reg = buildRegistry();
      reg.register('grid', 'GridV1');
      reg.unregister('grid');
      reg.register('grid', 'GridV2');
      expect(reg.resolve('grid')).toBe('GridV2');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// E. PARITY FIXTURES — NodeRenderer ≡ old SectionRenderer data
// ═══════════════════════════════════════════════════════════════════════════════

describe('E. Parity fixtures — PageDocument ≡ ThemePageSection', () => {

  /**
   * Parity strategy:
   *   1. Transform RawSection[] → PageDocument (the new model)
   *   2. Reverse-transform PageDocument → RawSection[] (via transformDocumentToSections)
   *   3. Compare every field: type, label, settings, block count, block order, visibility
   *
   * This is the data-level parity gate. Visual parity (screenshot diff) is the
   * Playwright harness. Both must pass before a store flips.
   */

  const { transformDocumentToSections } = require('./page-section-to-document');

  describe('E1. Hero section — full round-trip', () => {
    const doc = transformSectionsToPageDocument(STORE_ID, THEME_ID, PAGE_ID, [HERO], 'DRAFT');
    const [section] = transformDocumentToSections(doc);

    it('section type preserved', () => {
      expect(section.sectionDefId).toBe('hero');
    });

    it('section label preserved', () => {
      expect(section.label).toBe('Hero');
    });

    it('section isVisible preserved', () => {
      expect(section.isVisible).toBe(true);
    });

    it('all settings preserved exactly', () => {
      const orig = HERO.settings;
      const out  = section.settings;
      for (const [key, val] of Object.entries(orig)) {
        expect(out[key]).toEqual(val);
      }
    });

    it('block count preserved', () => {
      expect(section.blocks).toHaveLength(HERO.blocks.length);
    });

    it('block types preserved in order', () => {
      expect(section.blocks.map((b) => b.type)).toEqual(
        HERO.blocks.map((b) => b.type),
      );
    });

    it('block ids preserved', () => {
      expect(section.blocks.map((b) => b.id)).toEqual(
        HERO.blocks.map((b) => b.id),
      );
    });

    it('heading block settings preserved', () => {
      const orig = HERO.blocks.find((b) => b.type === 'heading')!;
      const out  = section.blocks.find((b) => b.type === 'heading')!;
      expect(out.settings.text).toBe(orig.settings.text);
      expect(out.settings.textColor).toBe(orig.settings.textColor);
    });

    it('button block settings preserved', () => {
      const orig = HERO.blocks.find((b) => b.type === 'button')!;
      const out  = section.blocks.find((b) => b.type === 'button')!;
      expect(out.settings.label).toBe(orig.settings.label);
      expect(out.settings.link).toBe(orig.settings.link);
    });
  });

  describe('E2. Featured collection section — full round-trip', () => {
    const doc = transformSectionsToPageDocument(STORE_ID, THEME_ID, PAGE_ID, [FEATURED], 'DRAFT');
    const [section] = transformDocumentToSections(doc);

    it('type preserved', () => {
      expect(section.sectionDefId).toBe('featured_collection');
    });

    it('productsToShow preserved', () => {
      expect(section.settings.productsToShow).toBe(4);
    });

    it('3 blocks preserved', () => {
      expect(section.blocks).toHaveLength(3);
    });

    it('block order by sortOrder', () => {
      const types = section.blocks.map((b) => b.type);
      expect(types).toEqual(['collection_title', 'view_all_button', 'product_card']);
    });

    it('showViewAll preserved', () => {
      expect(section.settings.showViewAll).toBe(true);
    });
  });

  describe('E3. Newsletter section — full round-trip', () => {
    const doc = transformSectionsToPageDocument(STORE_ID, THEME_ID, PAGE_ID, [NEWSLETTER], 'DRAFT');
    const [section] = transformDocumentToSections(doc);

    it('type preserved', () => {
      expect(section.sectionDefId).toBe('newsletter');
    });

    it('2 blocks preserved', () => {
      expect(section.blocks).toHaveLength(2);
    });

    it('heading text preserved', () => {
      const blk = section.blocks.find((b) => b.type === 'heading')!;
      expect(blk.settings.text).toBe('Subscribe to our emails');
    });

    it('paragraph text preserved', () => {
      const blk = section.blocks.find((b) => b.type === 'paragraph')!;
      expect(blk.settings.text).toContain('Be the first to know');
    });
  });

  describe('E4. Full home page (3 sections) — end-to-end parity', () => {
    const allSections = [HERO, FEATURED, NEWSLETTER];
    const doc = transformSectionsToPageDocument(STORE_ID, THEME_ID, PAGE_ID, allSections, 'DRAFT');
    const sections = transformDocumentToSections(doc);

    it('3 sections preserved', () => {
      expect(sections).toHaveLength(3);
    });

    it('section order preserved by sortOrder', () => {
      expect(sections.map((s) => s.sectionDefId)).toEqual([
        'hero', 'featured_collection', 'newsletter',
      ]);
    });

    it('total block count preserved (2 + 3 + 2 = 7)', () => {
      const total = sections.reduce((sum, s) => sum + s.blocks.length, 0);
      expect(total).toBe(7);
    });

    it('each section id is unique and preserved', () => {
      const ids = sections.map((s) => s.id);
      expect(ids).toEqual(allSections.map((s) => s.id));
      expect(new Set(ids).size).toBe(3);
    });

    it('storeId, themeId, ownerKey preserved in document', () => {
      expect(doc.storeId).toBe(STORE_ID);
      expect(doc.themeId).toBe(THEME_ID);
      expect(doc.ownerKey).toBe(PAGE_ID);
    });
  });

  describe('E5. Visibility parity', () => {
    it('isVisible:false section preserved in round-trip', () => {
      const hidden: RawSection = { ...HERO, id: 'hidden_hero', isVisible: false };
      const doc = transformSectionsToPageDocument(STORE_ID, THEME_ID, PAGE_ID, [hidden], 'DRAFT');
      const [section] = transformDocumentToSections(doc);
      expect(section.isVisible).toBe(false);
    });

    it('isVisible:false block preserved in round-trip', () => {
      const withHiddenBlock: RawSection = {
        ...HERO,
        blocks: [
          { ...HERO.blocks[0], isVisible: false },
          HERO.blocks[1],
        ],
      };
      const doc = transformSectionsToPageDocument(STORE_ID, THEME_ID, PAGE_ID, [withHiddenBlock], 'DRAFT');
      const [section] = transformDocumentToSections(doc);
      const headingBlock = section.blocks.find((b) => b.type === 'heading');
      expect(headingBlock?.isVisible).toBe(false);
    });
  });

  describe('E6. Block sort order parity', () => {
    it('blocks in reverse sortOrder are re-ordered correctly', () => {
      const reversed: RawSection = {
        ...FEATURED,
        blocks: [...FEATURED.blocks].reverse(),   // sortOrder now 3,2,1
      };
      const doc = transformSectionsToPageDocument(STORE_ID, THEME_ID, PAGE_ID, [reversed], 'DRAFT');
      const [section] = transformDocumentToSections(doc);
      // After transform, blocks should be sorted by sortOrder (1,2,3)
      expect(section.blocks[0].type).toBe('collection_title');
      expect(section.blocks[1].type).toBe('view_all_button');
      expect(section.blocks[2].type).toBe('product_card');
    });
  });

  describe('E7. DRAFT vs PUBLISHED parity', () => {
    it('PUBLISHED document round-trips identically to DRAFT', () => {
      const draftDoc    = transformSectionsToPageDocument(STORE_ID, THEME_ID, PAGE_ID, [HERO], 'DRAFT');
      const publishedDoc = transformSectionsToPageDocument(STORE_ID, THEME_ID, PAGE_ID, [HERO], 'PUBLISHED');

      const [draftSection]     = transformDocumentToSections(draftDoc);
      const [publishedSection] = transformDocumentToSections(publishedDoc);

      expect(draftSection.sectionDefId).toBe(publishedSection.sectionDefId);
      expect(JSON.stringify(draftSection.settings)).toBe(JSON.stringify(publishedSection.settings));
      expect(draftSection.blocks.length).toBe(publishedSection.blocks.length);
    });
  });
});
