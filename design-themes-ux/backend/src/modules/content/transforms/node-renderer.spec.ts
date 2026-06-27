/**
 * NodeRenderer logic tests — Sprint 10
 *
 * Tests the pure functions that drive the renderer:
 *   - resolveStyle (already tested, 57 tests)
 *   - bindingResolver (resolveFieldBinding, resolveSettings)
 *   - symbolExpander (expandSymbols)
 *   - visibility check
 *   - registry (register, resolve, isRegistered)
 *
 * React component rendering tests live in the frontend (Vitest/RTL).
 * These backend tests cover the data transformation layer only.
 */

// ─── Import pure logic (no React) ────────────────────────────────────────────
// We use the backend style-resolver (identical logic to frontend version)
import { resolveStyle } from './style-resolver';

// ─── Inline the binding and visibility logic for backend testing ──────────────
// (Mirrors src/components/node-renderer/bindingResolver.ts)

const BINDING_RE = /\{\{\s*([\w.]+)\s*\}\}/g;

function getPath(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc == null || typeof acc !== 'object') return undefined;
    return (acc as Record<string, unknown>)[key];
  }, obj);
}

function resolveFieldBinding(value: unknown, ctx: Record<string, unknown>): unknown {
  if (typeof value !== 'string') return value;
  if (!value.includes('{{')) return value;
  return value.replace(BINDING_RE, (match, path: string) => {
    const resolved = getPath(ctx, path);
    return resolved !== undefined ? String(resolved) : match;
  });
}

// ─── Inline visibility check (mirrors NodeRenderer.tsx) ──────────────────────

function isVisible(
  visibility: { desktop?: boolean; tablet?: boolean; mobile?: boolean } | undefined,
  breakpoint: 'desktop' | 'tablet' | 'mobile',
): boolean {
  if (!visibility) return true;
  return visibility[breakpoint] !== false;
}

// ─── Inline symbol expander (mirrors symbolExpander.ts) ──────────────────────

interface NodeLike {
  id:         string;
  type:       string;
  settings:   Record<string, unknown>;
  symbolRef?: { handle: string; overrides: Record<string, unknown> };
  children?:  NodeLike[];
}

function expandSymbols(node: NodeLike, symbols: Map<string, NodeLike>): NodeLike {
  if (node.type === 'symbol' && node.symbolRef) {
    const tree = symbols.get(node.symbolRef.handle);
    if (!tree) return { ...node, type: 'unknown_symbol', children: [] };
    return {
      ...tree,
      id:       node.id,
      settings: { ...tree.settings, ...node.symbolRef.overrides },
      children: (tree.children ?? []).map((c) => expandSymbols(c, symbols)),
    };
  }
  if (!node.children) return node;
  const expanded = node.children.map((c) => expandSymbols(c, symbols));
  const changed  = expanded.some((c, i) => c !== node.children![i]);
  return changed ? { ...node, children: expanded } : node;
}

// ─── Registry logic (mirrors registry.ts) ────────────────────────────────────

const registry = new Map<string, string>();  // type → 'registered' (no React here)
const regRegister = (type: string) => registry.set(type, 'registered');
const regResolve  = (type: string) => registry.get(type) ?? 'unknown';
const regHas      = (type: string) => registry.has(type);

// ═══════════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── resolveFieldBinding ──────────────────────────────────────────────────────

describe('resolveFieldBinding', () => {
  const ctx = { product: { title: 'Silk Saree', price: 2999 }, store: { name: 'SutaStore' } };

  it('returns non-string values unchanged', () => {
    expect(resolveFieldBinding(42, ctx)).toBe(42);
    expect(resolveFieldBinding(null, ctx)).toBe(null);
    expect(resolveFieldBinding(true, ctx)).toBe(true);
  });

  it('returns strings without {{ }} unchanged', () => {
    expect(resolveFieldBinding('Hello world', ctx)).toBe('Hello world');
  });

  it('resolves single binding', () => {
    expect(resolveFieldBinding('{{ product.title }}', ctx)).toBe('Silk Saree');
  });

  it('resolves binding within surrounding text', () => {
    expect(resolveFieldBinding('Buy {{ product.title }} now', ctx)).toBe('Buy Silk Saree now');
  });

  it('resolves multiple bindings in one string', () => {
    expect(resolveFieldBinding('{{ store.name }} — {{ product.title }}', ctx))
      .toBe('SutaStore — Silk Saree');
  });

  it('returns original {{}} when path not found', () => {
    expect(resolveFieldBinding('{{ product.nonexistent }}', ctx))
      .toBe('{{ product.nonexistent }}');
  });

  it('resolves nested path', () => {
    expect(resolveFieldBinding('{{ product.price }}', ctx)).toBe('2999');
  });

  it('returns original when ctx is empty', () => {
    expect(resolveFieldBinding('{{ product.title }}', {})).toBe('{{ product.title }}');
  });

  it('handles whitespace inside {{ }}', () => {
    expect(resolveFieldBinding('{{  product.title  }}', ctx)).toBe('Silk Saree');
  });

  it('does not resolve partial path', () => {
    expect(resolveFieldBinding('{{ product }}', ctx)).toBe('[object Object]');
  });
});

// ─── Visibility ───────────────────────────────────────────────────────────────

describe('isVisible', () => {
  it('returns true when no visibility defined', () => {
    expect(isVisible(undefined, 'desktop')).toBe(true);
    expect(isVisible(undefined, 'mobile')).toBe(true);
  });
  it('returns true when breakpoint not in visibility object', () => {
    expect(isVisible({ desktop: true }, 'mobile')).toBe(true);
  });
  it('returns false when breakpoint explicitly false', () => {
    expect(isVisible({ desktop: true, mobile: false }, 'mobile')).toBe(false);
  });
  it('returns true when breakpoint explicitly true', () => {
    expect(isVisible({ mobile: true }, 'mobile')).toBe(true);
  });
  it('visible on desktop, hidden on tablet', () => {
    const v = { desktop: true, tablet: false, mobile: false };
    expect(isVisible(v, 'desktop')).toBe(true);
    expect(isVisible(v, 'tablet')).toBe(false);
    expect(isVisible(v, 'mobile')).toBe(false);
  });
});

// ─── Symbol expansion ─────────────────────────────────────────────────────────

describe('expandSymbols', () => {
  const productCardTree: NodeLike = {
    id:       'sym-root',
    type:     'container',
    settings: { bg: '#ffffff', pt: 16 },
    children: [
      { id: 'sym-heading', type: 'heading', settings: { text: '{{ product.title }}' } },
      { id: 'sym-price',   type: 'heading', settings: { text: '{{ product.price }}' } },
    ],
  };
  const symbols = new Map<string, NodeLike>([['product-card', productCardTree]]);

  it('leaves non-symbol nodes unchanged', () => {
    const node: NodeLike = { id: 'n1', type: 'container', settings: {} };
    expect(expandSymbols(node, symbols)).toBe(node);      // referential equality
  });

  it('expands symbol reference to its tree', () => {
    const instance: NodeLike = {
      id:        'inst-1',
      type:      'symbol',
      settings:  {},
      symbolRef: { handle: 'product-card', overrides: {} },
    };
    const expanded = expandSymbols(instance, symbols);
    expect(expanded.type).toBe('container');
    expect(expanded.id).toBe('inst-1');        // instance id preserved
    expect(expanded.children).toHaveLength(2);
  });

  it('merges instance overrides into symbol root settings', () => {
    const instance: NodeLike = {
      id:        'inst-2',
      type:      'symbol',
      settings:  {},
      symbolRef: { handle: 'product-card', overrides: { bg: '#f0f0f0', customKey: 'yes' } },
    };
    const expanded = expandSymbols(instance, symbols);
    expect(expanded.settings.bg).toBe('#f0f0f0');        // override wins
    expect(expanded.settings.pt).toBe(16);               // base retained
    expect(expanded.settings.customKey).toBe('yes');     // new key from override
  });

  it('returns unknown_symbol when handle not found', () => {
    const instance: NodeLike = {
      id:        'inst-3',
      type:      'symbol',
      settings:  {},
      symbolRef: { handle: 'does-not-exist', overrides: {} },
    };
    const expanded = expandSymbols(instance, symbols);
    expect(expanded.type).toBe('unknown_symbol');
    expect(expanded.children).toHaveLength(0);
  });

  it('recurses into nested children', () => {
    const node: NodeLike = {
      id:       'parent',
      type:     'container',
      settings: {},
      children: [
        {
          id:        'inst-4',
          type:      'symbol',
          settings:  {},
          symbolRef: { handle: 'product-card', overrides: {} },
        },
      ],
    };
    const expanded = expandSymbols(node, symbols);
    expect(expanded.children![0].type).toBe('container');  // symbol expanded
  });

  it('does not create new object when nothing changes', () => {
    const node: NodeLike = {
      id:       'stable',
      type:     'container',
      settings: {},
      children: [
        { id: 'c1', type: 'heading', settings: {} },
      ],
    };
    const expanded = expandSymbols(node, symbols);
    expect(expanded).toBe(node);   // same reference — no change
  });
});

// ─── Registry ─────────────────────────────────────────────────────────────────

describe('registry', () => {
  it('registers and resolves a type', () => {
    regRegister('container');
    expect(regHas('container')).toBe(true);
    expect(regResolve('container')).toBe('registered');
  });
  it('returns unknown fallback for unregistered types', () => {
    expect(regResolve('xyz_unknown_type_99')).toBe('unknown');
  });
  it('is idempotent — re-registering same type is safe', () => {
    regRegister('heading');
    regRegister('heading');
    expect(regHas('heading')).toBe(true);
  });
});

// ─── Recursive nesting (data integrity) ──────────────────────────────────────

describe('recursive nesting', () => {
  it('handles 5-level deep tree without mutation', () => {
    const deep: NodeLike = {
      id: 'l1', type: 'container', settings: {},
      children: [{
        id: 'l2', type: 'grid', settings: {},
        children: [{
          id: 'l3', type: 'columns', settings: {},
          children: [{
            id: 'l4', type: 'stack', settings: {},
            children: [{
              id: 'l5', type: 'heading', settings: { text: 'Deep heading' },
            }],
          }],
        }],
      }],
    };
    const expanded = expandSymbols(deep, new Map());
    // No symbols → should return the same reference (no mutation)
    expect(expanded).toBe(deep);
  });

  it('handles empty children array', () => {
    const node: NodeLike = { id: 'n', type: 'container', settings: {}, children: [] };
    expect(expandSymbols(node, new Map())).toBe(node);
  });

  it('handles node with undefined children', () => {
    const node: NodeLike = { id: 'n', type: 'heading', settings: {} };
    expect(expandSymbols(node, new Map())).toBe(node);
  });
});

// ─── Responsive overlay (via resolveStyle) ────────────────────────────────────

describe('responsive rendering', () => {
  const base = {
    display:  'grid',
    gridCols: 4,
    gap:      24,
    responsive: {
      mobile: { gridCols: 1, gap: 12 },
      tablet: { gridCols: 2 },
    },
  };

  it('desktop uses base values', () => {
    const s = resolveStyle(base, 'desktop');
    expect(s.gridTemplateColumns).toBe('repeat(4, 1fr)');
    expect(s.gap).toBe('24px');
  });

  it('mobile applies mobile overrides', () => {
    const s = resolveStyle(base, 'mobile');
    expect(s.gridTemplateColumns).toBe('repeat(1, 1fr)');
    expect(s.gap).toBe('12px');
  });

  it('tablet applies tablet overrides, inherits rest', () => {
    const s = resolveStyle(base, 'tablet');
    expect(s.gridTemplateColumns).toBe('repeat(2, 1fr)');
    expect(s.gap).toBe('24px');   // no tablet override → desktop value
  });
});
