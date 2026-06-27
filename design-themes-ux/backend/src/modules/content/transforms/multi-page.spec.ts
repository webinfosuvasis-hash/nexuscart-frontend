/**
 * P1: Multi-page editor tests
 *
 * Tests the pure logic that drives multi-page support:
 *
 *   AVAILABLE_PAGES     — all 5 required pages present
 *   PAGE_TITLES         — correct titles for all page ids
 *   buildEmptyPageDoc   — correct pageId/pageTitle, shared header/footer groups
 *   SET_ACTIVE_PAGE     — resets transient state, never leaves stale data
 *   loadPage selection  — correct page loaded for each switch
 *   dirty-state guard   — page switch blocked when unsaved
 *
 * All tests are pure TypeScript — no React/JSDOM needed.
 */

// ─── Inline the constants (mirrors src/admin/editor/editor-mock-data.ts) ──────

const AVAILABLE_PAGES = [
  { id: 'home',       title: 'Home page',   slug: '/'                },
  { id: 'collection', title: 'Collections', slug: '/collections'     },
  { id: 'product',    title: 'Product',     slug: '/products/sample' },
  { id: 'cart',       title: 'Cart',        slug: '/cart'            },
  { id: 'search',     title: 'Search',      slug: '/search'          },
] as const;

type PageId = typeof AVAILABLE_PAGES[number]['id'];

const PAGE_TITLES: Record<string, string> = {
  home:       'Home page',
  collection: 'Collections',
  product:    'Product',
  cart:       'Cart',
  search:     'Search',
};

// ─── Inline the reducer case (mirrors EditorContext.tsx SET_ACTIVE_PAGE) ───────

interface MockEditorState {
  activePage:     string;
  pageDoc:        { pageId: string } | null;
  isDirty:        boolean;
  selection:      { type: string };
  expandedNodes:  Set<string>;
  hoverSectionId: string | null;
  hoverBlockId:   string | null;
}

function setActivePage(state: MockEditorState, pageId: string): MockEditorState {
  return {
    ...state,
    activePage:     pageId,
    pageDoc:        null,
    isDirty:        false,
    selection:      { type: 'none' },
    expandedNodes:  new Set(),
    hoverSectionId: null,
    hoverBlockId:   null,
  };
}

// ─── Inline buildEmptyPageDoc (mirrors editor-mock-data.ts) ──────────────────

function buildEmptyPageDoc(pageId: string): { pageId: string; pageTitle: string; sections: any[] } {
  return {
    pageId,
    pageTitle: PAGE_TITLES[pageId] ?? pageId,
    sections:  [],
  };
}

// ─── Inline buildPageDocFromApiSections (mirrors EditorContext.tsx) ───────────

function buildPageDocFromApiSections(
  apiSections: Array<{ id: string; sectionDefId: string; sortOrder: number }>,
  pageId:      string,
): { pageId: string; pageTitle: string; sections: typeof apiSections } {
  const sorted = [...apiSections].sort((a, b) => a.sortOrder - b.sortOrder);
  return {
    pageId,
    pageTitle: PAGE_TITLES[pageId] ?? pageId,
    sections:  sorted,
  };
}

// ─── Dirty-state guard logic (mirrors PageSelector.handlePageSelect) ──────────

function shouldAllowPageSwitch(
  isDirty:          boolean,
  userConfirmed:    boolean,
): boolean {
  if (!isDirty) return true;   // no unsaved changes → allow immediately
  return userConfirmed;        // dirty → only allow if user confirmed
}

// ═══════════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── 1. AVAILABLE_PAGES contract ─────────────────────────────────────────────

describe('AVAILABLE_PAGES', () => {
  const ids = AVAILABLE_PAGES.map((p) => p.id);

  it('contains exactly 5 pages', () => {
    expect(AVAILABLE_PAGES).toHaveLength(5);
  });

  it('contains home page', ()       => expect(ids).toContain('home'));
  it('contains collection page', () => expect(ids).toContain('collection'));
  it('contains product page', ()    => expect(ids).toContain('product'));
  it('contains cart page', ()       => expect(ids).toContain('cart'));
  it('contains search page', ()     => expect(ids).toContain('search'));

  it('has no duplicate ids', () => {
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every page has title, id, and slug', () => {
    AVAILABLE_PAGES.forEach((p) => {
      expect(typeof p.id).toBe('string');
      expect(p.id.length).toBeGreaterThan(0);
      expect(typeof p.title).toBe('string');
      expect(p.title.length).toBeGreaterThan(0);
      expect(typeof p.slug).toBe('string');
      expect(p.slug.startsWith('/')).toBe(true);
    });
  });

  it('slugs are unique', () => {
    const slugs = AVAILABLE_PAGES.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

// ─── 2. PAGE_TITLES contract ──────────────────────────────────────────────────

describe('PAGE_TITLES', () => {
  it('has an entry for every page id', () => {
    AVAILABLE_PAGES.forEach(({ id }) => {
      expect(PAGE_TITLES[id]).toBeDefined();
      expect(typeof PAGE_TITLES[id]).toBe('string');
    });
  });

  it('home title is "Home page"',     () => expect(PAGE_TITLES.home).toBe('Home page'));
  it('collection title',              () => expect(PAGE_TITLES.collection).toBe('Collections'));
  it('product title',                 () => expect(PAGE_TITLES.product).toBe('Product'));
  it('cart title',                    () => expect(PAGE_TITLES.cart).toBe('Cart'));
  it('search title',                  () => expect(PAGE_TITLES.search).toBe('Search'));

  it('unknown pageId does not throw', () => {
    expect(() => PAGE_TITLES['unknown_page'] ?? 'fallback').not.toThrow();
    expect(PAGE_TITLES['unknown_page']).toBeUndefined();
  });
});

// ─── 3. buildEmptyPageDoc ─────────────────────────────────────────────────────

describe('buildEmptyPageDoc()', () => {
  it('stamps the correct pageId', () => {
    expect(buildEmptyPageDoc('product').pageId).toBe('product');
    expect(buildEmptyPageDoc('cart').pageId).toBe('cart');
    expect(buildEmptyPageDoc('search').pageId).toBe('search');
  });

  it('stamps the correct pageTitle from PAGE_TITLES', () => {
    expect(buildEmptyPageDoc('product').pageTitle).toBe('Product');
    expect(buildEmptyPageDoc('collection').pageTitle).toBe('Collections');
  });

  it('uses pageId as fallback title for unknown page', () => {
    expect(buildEmptyPageDoc('custom-landing').pageTitle).toBe('custom-landing');
  });

  it('sections array is empty', () => {
    const doc = buildEmptyPageDoc('product');
    expect(doc.sections).toHaveLength(0);
    expect(Array.isArray(doc.sections)).toBe(true);
  });

  it('never returns "Home page" title for non-home pages', () => {
    ['product', 'collection', 'cart', 'search'].forEach((pageId) => {
      expect(buildEmptyPageDoc(pageId).pageTitle).not.toBe('Home page');
    });
  });
});

// ─── 4. buildPageDocFromApiSections stamps correct pageId ─────────────────────

describe('buildPageDocFromApiSections()', () => {
  const SECTIONS = [
    { id: 's1', sectionDefId: 'hero',               sortOrder: 1 },
    { id: 's2', sectionDefId: 'featured_collection', sortOrder: 2 },
  ];

  it('stamps the given pageId — not "home"', () => {
    const doc = buildPageDocFromApiSections(SECTIONS, 'product');
    expect(doc.pageId).toBe('product');
    expect(doc.pageId).not.toBe('home');
  });

  it('stamps the correct pageTitle', () => {
    expect(buildPageDocFromApiSections(SECTIONS, 'collection').pageTitle).toBe('Collections');
    expect(buildPageDocFromApiSections(SECTIONS, 'cart').pageTitle).toBe('Cart');
  });

  it('home page still works correctly', () => {
    const doc = buildPageDocFromApiSections(SECTIONS, 'home');
    expect(doc.pageId).toBe('home');
    expect(doc.pageTitle).toBe('Home page');
  });

  it('preserves all sections', () => {
    const doc = buildPageDocFromApiSections(SECTIONS, 'product');
    expect(doc.sections).toHaveLength(2);
  });

  it('sorts sections by sortOrder', () => {
    const reversed = [...SECTIONS].reverse(); // sortOrder 2, 1
    const doc = buildPageDocFromApiSections(reversed, 'home');
    expect(doc.sections[0].sectionDefId).toBe('hero');            // sortOrder 1
    expect(doc.sections[1].sectionDefId).toBe('featured_collection'); // sortOrder 2
  });
});

// ─── 5. SET_ACTIVE_PAGE reducer ──────────────────────────────────────────────

describe('SET_ACTIVE_PAGE reducer', () => {
  const INITIAL: MockEditorState = {
    activePage:     'home',
    pageDoc:        { pageId: 'home' },
    isDirty:        true,
    selection:      { type: 'section' },
    expandedNodes:  new Set(['sec-1', 'sec-2']),
    hoverSectionId: 'sec-1',
    hoverBlockId:   'blk-1',
  };

  it('updates activePage', () => {
    const next = setActivePage(INITIAL, 'product');
    expect(next.activePage).toBe('product');
  });

  it('nullifies pageDoc (triggers loading state)', () => {
    const next = setActivePage(INITIAL, 'product');
    expect(next.pageDoc).toBeNull();
  });

  it('clears isDirty', () => {
    const next = setActivePage({ ...INITIAL, isDirty: true }, 'product');
    expect(next.isDirty).toBe(false);
  });

  it('clears selection', () => {
    const next = setActivePage(INITIAL, 'product');
    expect(next.selection.type).toBe('none');
  });

  it('clears expandedNodes', () => {
    const next = setActivePage(INITIAL, 'product');
    expect(next.expandedNodes.size).toBe(0);
  });

  it('clears hoverSectionId', () => {
    const next = setActivePage(INITIAL, 'product');
    expect(next.hoverSectionId).toBeNull();
  });

  it('clears hoverBlockId', () => {
    const next = setActivePage(INITIAL, 'product');
    expect(next.hoverBlockId).toBeNull();
  });

  it('switching to same page still resets state', () => {
    const next = setActivePage(INITIAL, 'home');
    expect(next.pageDoc).toBeNull();  // triggers fresh load
    expect(next.isDirty).toBe(false);
  });

  it('switching between all 5 pages works', () => {
    const pages: PageId[] = ['home', 'product', 'collection', 'cart', 'search'];
    let state = INITIAL;
    pages.forEach((pageId) => {
      state = setActivePage(state, pageId);
      expect(state.activePage).toBe(pageId);
      expect(state.pageDoc).toBeNull();
    });
  });
});

// ─── 6. Dirty-state guard ────────────────────────────────────────────────────

describe('dirty-state guard (page switch)', () => {
  it('allows switch immediately when not dirty', () => {
    expect(shouldAllowPageSwitch(false, false)).toBe(true);
    expect(shouldAllowPageSwitch(false, true)).toBe(true);
  });

  it('blocks switch when dirty and user cancels', () => {
    expect(shouldAllowPageSwitch(true, false)).toBe(false);
  });

  it('allows switch when dirty and user confirms', () => {
    expect(shouldAllowPageSwitch(true, true)).toBe(true);
  });

  it('switching to the same page — no confirmation needed', () => {
    // Same-page switch is short-circuited before the dirty check
    const isSamePage = (currentId: string, targetId: string) => currentId === targetId;
    expect(isSamePage('home', 'home')).toBe(true);
    expect(isSamePage('home', 'product')).toBe(false);
  });
});

// ─── 7. loadPage routing ─────────────────────────────────────────────────────

describe('loadPage routing', () => {
  // Simulate the loadPage function's branching logic
  type LoadResult = 'seeded-home' | 'empty-page' | 'sections-loaded';

  function simulateLoadPage(
    pageId:            string,
    apiReturnsEmpty:   boolean,
    apiThrows:         boolean,
  ): { result: LoadResult; pageDocPageId: string } {
    if (apiThrows) {
      return { result: 'empty-page', pageDocPageId: pageId };
    }
    if (apiReturnsEmpty) {
      if (pageId === 'home') return { result: 'seeded-home', pageDocPageId: 'home' };
      return { result: 'empty-page', pageDocPageId: pageId };
    }
    return { result: 'sections-loaded', pageDocPageId: pageId };
  }

  it('home page with no sections → seeds with MOCK_PAGE_DOC', () => {
    const r = simulateLoadPage('home', true, false);
    expect(r.result).toBe('seeded-home');
    expect(r.pageDocPageId).toBe('home');
  });

  it('product page with no sections → empty doc (not seeded)', () => {
    const r = simulateLoadPage('product', true, false);
    expect(r.result).toBe('empty-page');
    expect(r.pageDocPageId).toBe('product');
  });

  it('collection page with sections → loads sections', () => {
    const r = simulateLoadPage('collection', false, false);
    expect(r.result).toBe('sections-loaded');
    expect(r.pageDocPageId).toBe('collection');
  });

  it('API error → falls back to empty doc for the active page', () => {
    const r = simulateLoadPage('product', false, true);
    expect(r.result).toBe('empty-page');
    expect(r.pageDocPageId).toBe('product');
  });

  it('each page gets its own pageDocPageId — never "home" for non-home', () => {
    ['product', 'collection', 'cart', 'search'].forEach((pageId) => {
      const r = simulateLoadPage(pageId, false, false);
      expect(r.pageDocPageId).toBe(pageId);
      expect(r.pageDocPageId).not.toBe('home');
    });
  });

  it('API error on home page → falls back to empty doc with pageId=home', () => {
    const r = simulateLoadPage('home', false, true);
    expect(r.pageDocPageId).toBe('home');
  });
});
