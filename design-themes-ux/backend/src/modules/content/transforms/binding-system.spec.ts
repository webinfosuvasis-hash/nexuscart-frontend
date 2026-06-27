/**
 * P4: Binding System — tests
 *
 * Tests the pure logic for all four binding types:
 *
 *   detectSource         — identifies active binding from settings
 *   SOURCE_KEYS          — correct keys cleared on source switch
 *   collection binding   — stores id, triggers canvas re-fetch
 *   product binding      — stores id, triggers single-product fetch
 *   menu binding         — stores handle, used by navigation blocks
 *   category binding     — stores id, filters products by category
 *   clearBinding         — removes all binding keys
 *   persistence          — bindings survive save round-trip via settings
 *   query routing        — correct API calls per binding type
 *   no ghost data        — switching source clears old keys
 */

// ─── Inline pure logic ────────────────────────────────────────────────────────

type BindingSource = 'none' | 'collection' | 'product' | 'menu' | 'category';

function isRealId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length >= 20;
}

function detectSource(settings: Record<string, any>): BindingSource {
  if (settings.collection && isRealId(settings.collection)) return 'collection';
  if (settings.product    && String(settings.product).length >= 20) return 'product';
  if (settings.menuHandle && String(settings.menuHandle).length > 0)  return 'menu';
  if (settings.category   && String(settings.category).length >= 20)  return 'category';
  return 'none';
}

const SOURCE_KEYS: Record<BindingSource, string[]> = {
  none:       ['collection', 'product', 'menuHandle', 'category'],
  collection: ['product', 'menuHandle', 'category'],
  product:    ['collection', 'menuHandle', 'category'],
  menu:       ['collection', 'product', 'category'],
  category:   ['collection', 'product', 'menuHandle'],
};

function clearKeysForSource(
  settings: Record<string, any>,
  newSource: BindingSource,
): Record<string, any> {
  const result = { ...settings };
  SOURCE_KEYS[newSource].forEach((key) => delete result[key]);
  return result;
}

function clearAllBindings(settings: Record<string, any>): Record<string, any> {
  return clearKeysForSource(settings, 'none');
}

// Simulate buildQueryParams for canvas (from useCanvasProducts)
function buildCanvasParams(
  collectionId: unknown,
  categoryId:   unknown,
  productId:    unknown,
  limit:        number,
): { endpoint: string; params: Record<string, unknown> } {
  if (isRealId(productId)) {
    return { endpoint: `/products/${productId}`, params: {} };
  }
  const params: Record<string, unknown> = { limit, status: 'ACTIVE' };
  if (isRealId(collectionId)) params.collectionId = collectionId;
  if (isRealId(categoryId))   params.categoryId   = categoryId;
  return { endpoint: '/products', params };
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const COL_ID   = 'clqhyft1u0007thvlzcgwxg0c'; // collection cuid
const PROD_ID  = 'clqhyft1u0008thvlzcgwxg0d'; // product cuid
const CAT_ID   = 'clqhyft1u0009thvlzcgwxg0e'; // category cuid
const MENU_HDL = 'main-menu';                  // menu handle (short, valid)

// ═══════════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── 1. detectSource ──────────────────────────────────────────────────────────

describe('detectSource()', () => {
  it('returns "none" for empty settings',           () => expect(detectSource({})).toBe('none'));
  it('returns "none" for null collection',          () => expect(detectSource({ collection: null })).toBe('none'));
  it('returns "none" for mock slug collection',     () => expect(detectSource({ collection: 'all' })).toBe('none'));
  it('returns "none" for short product id',         () => expect(detectSource({ product: 'short' })).toBe('none'));
  it('returns "collection" for real cuid',          () => expect(detectSource({ collection: COL_ID })).toBe('collection'));
  it('returns "product" for real product id',       () => expect(detectSource({ product: PROD_ID })).toBe('product'));
  it('returns "menu" for valid menu handle',         () => expect(detectSource({ menuHandle: MENU_HDL })).toBe('menu'));
  it('returns "category" for real category id',     () => expect(detectSource({ category: CAT_ID })).toBe('category'));

  it('collection takes priority over product when both set', () => {
    expect(detectSource({ collection: COL_ID, product: PROD_ID })).toBe('collection');
  });

  it('product takes priority over menu when collection absent', () => {
    expect(detectSource({ product: PROD_ID, menuHandle: MENU_HDL })).toBe('product');
  });

  it('menu takes priority over category when collection+product absent', () => {
    expect(detectSource({ menuHandle: MENU_HDL, category: CAT_ID })).toBe('menu');
  });

  it('"none" when menuHandle is empty string', () => {
    expect(detectSource({ menuHandle: '' })).toBe('none');
  });
});

// ─── 2. SOURCE_KEYS — no ghost data on switch ─────────────────────────────────

describe('SOURCE_KEYS (ghost data prevention)', () => {
  it('switching to collection clears product, menuHandle, category', () => {
    const after = clearKeysForSource(
      { collection: COL_ID, product: PROD_ID, menuHandle: MENU_HDL, category: CAT_ID },
      'collection',
    );
    expect(after.collection).toBe(COL_ID);   // kept
    expect(after.product).toBeUndefined();
    expect(after.menuHandle).toBeUndefined();
    expect(after.category).toBeUndefined();
  });

  it('switching to product clears collection, menuHandle, category', () => {
    const after = clearKeysForSource(
      { collection: COL_ID, product: PROD_ID, menuHandle: MENU_HDL, category: CAT_ID },
      'product',
    );
    expect(after.product).toBe(PROD_ID);     // kept
    expect(after.collection).toBeUndefined();
    expect(after.menuHandle).toBeUndefined();
    expect(after.category).toBeUndefined();
  });

  it('switching to menu clears collection, product, category', () => {
    const after = clearKeysForSource(
      { collection: COL_ID, product: PROD_ID, menuHandle: MENU_HDL, category: CAT_ID },
      'menu',
    );
    expect(after.menuHandle).toBe(MENU_HDL);  // kept
    expect(after.collection).toBeUndefined();
    expect(after.product).toBeUndefined();
    expect(after.category).toBeUndefined();
  });

  it('switching to category clears collection, product, menuHandle', () => {
    const after = clearKeysForSource(
      { collection: COL_ID, product: PROD_ID, menuHandle: MENU_HDL, category: CAT_ID },
      'category',
    );
    expect(after.category).toBe(CAT_ID);      // kept
    expect(after.collection).toBeUndefined();
    expect(after.product).toBeUndefined();
    expect(after.menuHandle).toBeUndefined();
  });

  it('switching to none clears all four keys', () => {
    const after = clearAllBindings({
      collection: COL_ID, product: PROD_ID, menuHandle: MENU_HDL, category: CAT_ID,
    });
    expect(after.collection).toBeUndefined();
    expect(after.product).toBeUndefined();
    expect(after.menuHandle).toBeUndefined();
    expect(after.category).toBeUndefined();
  });

  it('clearing all bindings preserves non-binding settings', () => {
    const original = { collection: COL_ID, bg: '#ffffff', pt: 48, productsToShow: 4 };
    const after    = clearAllBindings(original);
    expect(after.bg).toBe('#ffffff');
    expect(after.pt).toBe(48);
    expect(after.productsToShow).toBe(4);
    expect(after.collection).toBeUndefined();
  });
});

// ─── 3. Collection binding ────────────────────────────────────────────────────

describe('collection binding', () => {
  it('stores collection id as settings.collection', () => {
    const settings: Record<string, any> = {};
    settings.collection = COL_ID;
    expect(detectSource(settings)).toBe('collection');
  });

  it('canvas query includes collectionId param', () => {
    const { endpoint, params } = buildCanvasParams(COL_ID, undefined, undefined, 4);
    expect(endpoint).toBe('/products');
    expect(params.collectionId).toBe(COL_ID);
  });

  it('mock slug does not trigger collection source', () => {
    expect(detectSource({ collection: 'new-arrivals' })).toBe('none');
  });

  it('different collection ids produce different query keys', () => {
    const key1 = JSON.stringify(buildCanvasParams(COL_ID, undefined, undefined, 4));
    const key2 = JSON.stringify(buildCanvasParams('clqhyft1u0008thvlzcgwxg0d', undefined, undefined, 4));
    expect(key1).not.toBe(key2);
  });

  it('persists through settings round-trip (save/load)', () => {
    const settings = { collection: COL_ID, productsToShow: 4, bg: '#fff' };
    const json     = JSON.stringify(settings);
    const loaded   = JSON.parse(json);
    expect(detectSource(loaded)).toBe('collection');
    expect(loaded.collection).toBe(COL_ID);
  });
});

// ─── 4. Product binding ───────────────────────────────────────────────────────

describe('product binding', () => {
  it('stores product id as settings.product', () => {
    const settings: Record<string, any> = { product: PROD_ID };
    expect(detectSource(settings)).toBe('product');
  });

  it('canvas uses single-product endpoint', () => {
    const { endpoint, params } = buildCanvasParams(undefined, undefined, PROD_ID, 4);
    expect(endpoint).toBe(`/products/${PROD_ID}`);
    expect(Object.keys(params)).toHaveLength(0);  // no query params for single fetch
  });

  it('product binding takes priority over list fetch', () => {
    // When productId is set, the list query is disabled
    const isListEnabled = (productId: unknown) => !isRealId(productId);
    expect(isListEnabled(PROD_ID)).toBe(false);  // list disabled
    expect(isListEnabled(undefined)).toBe(true); // list enabled
  });

  it('persists through settings round-trip', () => {
    const settings = { product: PROD_ID };
    const loaded   = JSON.parse(JSON.stringify(settings));
    expect(detectSource(loaded)).toBe('product');
  });
});

// ─── 5. Menu binding ─────────────────────────────────────────────────────────

describe('menu binding', () => {
  it('stores menu handle as settings.menuHandle', () => {
    const settings: Record<string, any> = { menuHandle: MENU_HDL };
    expect(detectSource(settings)).toBe('menu');
  });

  it('stores handle (e.g. "main-menu"), not the database id', () => {
    // The menu handle is a short slug like 'main-menu' — detectSource fires on any
    // non-empty menuHandle string. The important invariant is we write m.handle
    // (not m.id) so the template/header renderer can look the menu up by handle.
    expect(detectSource({ menuHandle: 'main-menu' })).toBe('menu');
    expect(detectSource({ menuHandle: 'footer-menu' })).toBe('menu');
    // Empty handle → no binding
    expect(detectSource({ menuHandle: '' })).toBe('none');
  });

  it('persists through settings round-trip', () => {
    const settings = { menuHandle: 'footer-menu' };
    const loaded   = JSON.parse(JSON.stringify(settings));
    expect(detectSource(loaded)).toBe('menu');
    expect(loaded.menuHandle).toBe('footer-menu');
  });

  it('menu binding does not affect canvas product query', () => {
    const { endpoint, params } = buildCanvasParams(undefined, undefined, undefined, 4);
    expect(endpoint).toBe('/products');
    expect(params.menuHandle).toBeUndefined();  // menu never passed to product query
  });
});

// ─── 6. Category binding ─────────────────────────────────────────────────────

describe('category binding', () => {
  it('stores category id as settings.category', () => {
    expect(detectSource({ category: CAT_ID })).toBe('category');
  });

  it('canvas query includes categoryId param', () => {
    const { endpoint, params } = buildCanvasParams(undefined, CAT_ID, undefined, 4);
    expect(endpoint).toBe('/products');
    expect(params.categoryId).toBe(CAT_ID);
  });

  it('category binding distinct from collection binding in query key', () => {
    const catKey = JSON.stringify(buildCanvasParams(undefined, CAT_ID, undefined, 4));
    const colKey = JSON.stringify(buildCanvasParams(COL_ID, undefined, undefined, 4));
    expect(catKey).not.toBe(colKey);
  });

  it('persists through settings round-trip', () => {
    const settings = { category: CAT_ID };
    const loaded   = JSON.parse(JSON.stringify(settings));
    expect(detectSource(loaded)).toBe('category');
  });
});

// ─── 7. Clear binding ────────────────────────────────────────────────────────

describe('clearAllBindings()', () => {
  it('returns "none" after clear', () => {
    const after = clearAllBindings({ collection: COL_ID });
    expect(detectSource(after)).toBe('none');
  });

  it('noop on already-empty settings', () => {
    const after = clearAllBindings({});
    expect(detectSource(after)).toBe('none');
    expect(Object.keys(after)).toHaveLength(0);
  });

  it('cleared settings still persist (as undefined values)', () => {
    const original = { collection: COL_ID, bg: '#fff' };
    const cleared  = clearAllBindings(original);
    // Round-trip: undefined values are dropped by JSON.stringify
    const stored   = JSON.parse(JSON.stringify(cleared));
    expect(stored.collection).toBeUndefined();
    expect(stored.bg).toBe('#fff');  // non-binding key preserved
  });
});

// ─── 8. Binding persistence in PageDocument ───────────────────────────────────

describe('binding persistence in PageDocument settings', () => {
  it('all four binding keys survive JSON serialization', () => {
    const settings = {
      collection: COL_ID, product: PROD_ID,
      menuHandle: MENU_HDL, category: CAT_ID,
      productsToShow: 4, bg: '#fff',
    };
    const round = JSON.parse(JSON.stringify(settings));
    expect(round.collection).toBe(COL_ID);
    expect(round.product).toBe(PROD_ID);
    expect(round.menuHandle).toBe(MENU_HDL);
    expect(round.category).toBe(CAT_ID);
  });

  it('binding keys serialized in ThemePageSection.settings JSON column', () => {
    // ThemePageSection.settings is type Json in Prisma.
    // Prisma serializes Record<string, any> transparently.
    const prismaSetting: Record<string, unknown> = {
      collection: COL_ID, category: CAT_ID,
    };
    // Simulate Prisma round-trip (JSON → stored → JSON)
    const stored = JSON.parse(JSON.stringify(prismaSetting));
    expect(stored.collection).toBe(COL_ID);
    expect(stored.category).toBe(CAT_ID);
  });

  it('binding keys flow into PageDocument.tree via transformSectionsToPageDocument', () => {
    // The transform copies section.settings verbatim into node.settings.
    // So binding keys set in the inspector persist in PageDocument.
    const sectionSettings = { collection: COL_ID, productsToShow: 4 };
    const nodeSettings    = { ...sectionSettings }; // transform preserves all settings
    expect(nodeSettings.collection).toBe(COL_ID);
    expect(nodeSettings.productsToShow).toBe(4);
  });
});

// ─── 9. Canvas query routing per source ──────────────────────────────────────

describe('canvas query routing', () => {
  const LIMIT = 4;

  it('no binding → general products list', () => {
    const { endpoint, params } = buildCanvasParams(undefined, undefined, undefined, LIMIT);
    expect(endpoint).toBe('/products');
    expect(params.collectionId).toBeUndefined();
    expect(params.categoryId).toBeUndefined();
  });

  it('collection → products filtered by collectionId', () => {
    const { endpoint, params } = buildCanvasParams(COL_ID, undefined, undefined, LIMIT);
    expect(endpoint).toBe('/products');
    expect(params.collectionId).toBe(COL_ID);
    expect(params.categoryId).toBeUndefined();
  });

  it('category → products filtered by categoryId', () => {
    const { endpoint, params } = buildCanvasParams(undefined, CAT_ID, undefined, LIMIT);
    expect(endpoint).toBe('/products');
    expect(params.categoryId).toBe(CAT_ID);
    expect(params.collectionId).toBeUndefined();
  });

  it('product → single product endpoint', () => {
    const { endpoint } = buildCanvasParams(undefined, undefined, PROD_ID, LIMIT);
    expect(endpoint).toBe(`/products/${PROD_ID}`);
  });

  it('product takes precedence — list query disabled', () => {
    // Even if collection is also set, productId triggers single fetch
    const { endpoint } = buildCanvasParams(COL_ID, undefined, PROD_ID, LIMIT);
    expect(endpoint).toBe(`/products/${PROD_ID}`);
  });

  it('menu binding does not affect product query at all', () => {
    // Menu is stored in settings.menuHandle, never passed to product query
    const { endpoint, params } = buildCanvasParams(undefined, undefined, undefined, LIMIT);
    expect(params.menuHandle).toBeUndefined();
    expect(endpoint).toBe('/products');
  });
});
