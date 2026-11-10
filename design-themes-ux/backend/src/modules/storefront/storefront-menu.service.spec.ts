import { StorefrontMenuService, buildTree, isSafeHref } from './storefront-menu.service';
import { ResolvedMenuItem } from './storefront-menu.types';

const STORE_A = 'store_a';
const STORE_B = 'store_b';

function makeMenuItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'item_1', menuId: 'menu_1', parentId: null, label: 'Sarees', url: '/jewellery/sarees',
    type: 'LINK', sortOrder: 0, isActive: true, linkType: null,
    categoryId: null, productId: null, brandId: null, cmsPageId: null, collectionId: null,
    megaMenu: null,
    ...overrides,
  };
}

function makeDeps() {
  const prisma = {
    menu: { findFirst: jest.fn() },
    menuItem: { findMany: jest.fn() },
    category: { findMany: jest.fn().mockResolvedValue([]) },
    product: { findMany: jest.fn().mockResolvedValue([]) },
    brand: { findMany: jest.fn().mockResolvedValue([]) },
    cmsPage: { findMany: jest.fn().mockResolvedValue([]) },
    collection: { findMany: jest.fn().mockResolvedValue([]) },
  } as any;
  const cache = { get: jest.fn().mockResolvedValue(null), set: jest.fn(), del: jest.fn() } as any;
  const headerConfig = { getPublished: jest.fn() } as any;
  return { prisma, cache, headerConfig };
}

function makeService(deps: ReturnType<typeof makeDeps>) {
  return new StorefrontMenuService(deps.prisma, deps.cache, deps.headerConfig);
}

describe('StorefrontMenuService — getMenuByHandle', () => {
  it('returns the cached tree without hitting the database when present', async () => {
    const deps = makeDeps();
    const cached = { id: 'm1', handle: 'main-menu', name: 'Main', items: [] };
    deps.cache.get.mockResolvedValue(cached);
    const service = makeService(deps);

    const result = await service.getMenuByHandle(STORE_A, 'main-menu');

    expect(result).toBe(cached);
    expect(deps.prisma.menu.findFirst).not.toHaveBeenCalled();
  });

  it('returns null (not an error) when no menu with that handle exists in this store', async () => {
    const deps = makeDeps();
    deps.prisma.menu.findFirst.mockResolvedValue(null);
    const service = makeService(deps);

    const result = await service.getMenuByHandle(STORE_A, 'nonexistent');

    expect(result).toBeNull();
  });

  it('scopes the menu lookup to (storeId, handle) — never resolves another store\'s menu of the same handle', async () => {
    const deps = makeDeps();
    deps.prisma.menu.findFirst.mockResolvedValue({ id: 'm1', storeId: STORE_A, handle: 'main-menu', name: 'Main' });
    deps.prisma.menuItem.findMany.mockResolvedValue([]);
    const service = makeService(deps);

    await service.getMenuByHandle(STORE_A, 'main-menu');

    expect(deps.prisma.menu.findFirst).toHaveBeenCalledWith({ where: { storeId: STORE_A, handle: 'main-menu' } });
  });

  it('builds a nested tree from a flat item list and caches the result with the MENU ttl', async () => {
    const deps = makeDeps();
    deps.prisma.menu.findFirst.mockResolvedValue({ id: 'm1', storeId: STORE_A, handle: 'main-menu', name: 'Main' });
    deps.prisma.menuItem.findMany.mockResolvedValue([
      makeMenuItem({ id: 'top_1', label: 'Sarees', sortOrder: 0 }),
      makeMenuItem({ id: 'child_1', parentId: 'top_1', label: 'Silk Sarees', sortOrder: 0 }),
      makeMenuItem({ id: 'grandchild_1', parentId: 'child_1', label: 'Kanjivaram', sortOrder: 0 }),
    ]);
    const service = makeService(deps);

    const result = await service.getMenuByHandle(STORE_A, 'main-menu');

    expect(result!.items).toHaveLength(1);
    expect(result!.items[0].label).toBe('Sarees');
    expect(result!.items[0].children).toHaveLength(1);
    expect(result!.items[0].children[0].label).toBe('Silk Sarees');
    expect(result!.items[0].children[0].children[0].label).toBe('Kanjivaram');
    expect(deps.cache.set).toHaveBeenCalledWith(expect.stringContaining(STORE_A), result, 300);
  });

  it('excludes inactive items at the query level (isActive: true filter)', async () => {
    const deps = makeDeps();
    deps.prisma.menu.findFirst.mockResolvedValue({ id: 'm1', storeId: STORE_A, handle: 'main-menu', name: 'Main' });
    deps.prisma.menuItem.findMany.mockResolvedValue([]);
    const service = makeService(deps);

    await service.getMenuByHandle(STORE_A, 'main-menu');

    expect(deps.prisma.menuItem.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ isActive: true }),
    }));
  });
});

describe('StorefrontMenuService — structured link resolution', () => {
  it('resolves a CATEGORY link to /category/:slug when the category exists, is active, and belongs to this store', async () => {
    const deps = makeDeps();
    deps.prisma.menu.findFirst.mockResolvedValue({ id: 'm1', storeId: STORE_A, handle: 'main-menu', name: 'Main' });
    deps.prisma.menuItem.findMany.mockResolvedValue([
      makeMenuItem({ id: 'item_1', linkType: 'CATEGORY', categoryId: 'cat_1', url: null }),
    ]);
    deps.prisma.category.findMany.mockResolvedValue([{ id: 'cat_1', slug: 'sarees' }]);
    const service = makeService(deps);

    const result = await service.getMenuByHandle(STORE_A, 'main-menu');

    expect(result!.items[0].url).toBe('/category/sarees');
    expect(result!.items[0].linkType).toBe('CATEGORY');
    expect(deps.prisma.category.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ storeId: STORE_A, isActive: true }),
    }));
  });

  it('drops the item entirely (never a dead link) when the linked category does not exist in this store', async () => {
    const deps = makeDeps();
    deps.prisma.menu.findFirst.mockResolvedValue({ id: 'm1', storeId: STORE_A, handle: 'main-menu', name: 'Main' });
    deps.prisma.menuItem.findMany.mockResolvedValue([
      makeMenuItem({ id: 'item_1', linkType: 'CATEGORY', categoryId: 'cat_missing', url: null }),
    ]);
    deps.prisma.category.findMany.mockResolvedValue([]); // not found / wrong store / inactive
    const service = makeService(deps);

    const result = await service.getMenuByHandle(STORE_A, 'main-menu');

    expect(result!.items).toHaveLength(0);
  });

  it('cannot resolve a menu item in store A against a category that only exists in store B (cross-tenant leak check)', async () => {
    const deps = makeDeps();
    deps.prisma.menu.findFirst.mockResolvedValue({ id: 'm1', storeId: STORE_A, handle: 'main-menu', name: 'Main' });
    deps.prisma.menuItem.findMany.mockResolvedValue([
      makeMenuItem({ id: 'item_1', linkType: 'CATEGORY', categoryId: 'cat_in_store_b', url: null }),
    ]);
    // The category lookup is itself scoped to storeId: STORE_A, so a category
    // that only exists under store B is correctly never returned by Prisma —
    // simulated here by the mock returning nothing for STORE_A's query.
    deps.prisma.category.findMany.mockImplementation(({ where }: any) =>
      Promise.resolve(where.storeId === STORE_B ? [{ id: 'cat_in_store_b', slug: 'leaked' }] : []));
    const service = makeService(deps);

    const result = await service.getMenuByHandle(STORE_A, 'main-menu');

    expect(result!.items).toHaveLength(0);
  });

  it('resolves PRODUCT/BRAND/COLLECTION/CMS_PAGE link types to their expected URL shapes', async () => {
    const deps = makeDeps();
    deps.prisma.menu.findFirst.mockResolvedValue({ id: 'm1', storeId: STORE_A, handle: 'main-menu', name: 'Main' });
    deps.prisma.menuItem.findMany.mockResolvedValue([
      makeMenuItem({ id: 'p', linkType: 'PRODUCT', productId: 'prod_1', url: null }),
      makeMenuItem({ id: 'b', linkType: 'BRAND', brandId: 'brand_1', url: null }),
      makeMenuItem({ id: 'c', linkType: 'COLLECTION', collectionId: 'col_1', url: null }),
      makeMenuItem({ id: 'g', linkType: 'CMS_PAGE', cmsPageId: 'page_1', url: null }),
    ]);
    deps.prisma.product.findMany.mockResolvedValue([{ id: 'prod_1', slug: 'silk-saree' }]);
    deps.prisma.brand.findMany.mockResolvedValue([{ id: 'brand_1', slug: 'fabindia' }]);
    deps.prisma.collection.findMany.mockResolvedValue([{ id: 'col_1', slug: 'festive-edit' }]);
    deps.prisma.cmsPage.findMany.mockResolvedValue([{ id: 'page_1', slug: 'about-us' }]);
    const service = makeService(deps);

    const result = await service.getMenuByHandle(STORE_A, 'main-menu');
    const byId = Object.fromEntries(result!.items.map((i) => [i.id, i.url]));

    expect(byId.p).toBe('/products/prod_1');
    expect(byId.b).toBe('/brand/fabindia');
    expect(byId.c).toBe('/collection/festive-edit');
    expect(byId.g).toBe('/pages/about-us');
  });

  it('only resolves a CMS_PAGE link when the page is PUBLISHED', async () => {
    const deps = makeDeps();
    deps.prisma.menu.findFirst.mockResolvedValue({ id: 'm1', storeId: STORE_A, handle: 'main-menu', name: 'Main' });
    deps.prisma.menuItem.findMany.mockResolvedValue([
      makeMenuItem({ id: 'g', linkType: 'CMS_PAGE', cmsPageId: 'draft_page', url: null }),
    ]);
    const service = makeService(deps);

    await service.getMenuByHandle(STORE_A, 'main-menu');

    expect(deps.prisma.cmsPage.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: 'PUBLISHED' }),
    }));
  });

  it('passes a plain EXTERNAL_URL (or legacy null linkType) straight through unchanged', async () => {
    const deps = makeDeps();
    deps.prisma.menu.findFirst.mockResolvedValue({ id: 'm1', storeId: STORE_A, handle: 'main-menu', name: 'Main' });
    deps.prisma.menuItem.findMany.mockResolvedValue([
      makeMenuItem({ id: 'legacy', linkType: null, url: '/jewellery/rings' }),
      makeMenuItem({ id: 'external', linkType: 'EXTERNAL_URL', url: 'https://example.com/lookbook' }),
    ]);
    const service = makeService(deps);

    const result = await service.getMenuByHandle(STORE_A, 'main-menu');
    const byId = Object.fromEntries(result!.items.map((i) => [i.id, i.url]));

    expect(byId.legacy).toBe('/jewellery/rings');
    expect(byId.external).toBe('https://example.com/lookbook');
  });

  it('drops an EXTERNAL_URL item with an unsafe scheme (javascript:) rather than serving it', async () => {
    const deps = makeDeps();
    deps.prisma.menu.findFirst.mockResolvedValue({ id: 'm1', storeId: STORE_A, handle: 'main-menu', name: 'Main' });
    deps.prisma.menuItem.findMany.mockResolvedValue([
      makeMenuItem({ id: 'xss', linkType: 'EXTERNAL_URL', url: 'javascript:alert(1)' }),
    ]);
    const service = makeService(deps);

    const result = await service.getMenuByHandle(STORE_A, 'main-menu');

    expect(result!.items).toHaveLength(0);
  });
});

describe('StorefrontMenuService — mega menu resolution', () => {
  it('expands featuredProductIds/featuredCategoryIds into real summaries', async () => {
    const deps = makeDeps();
    deps.prisma.menu.findFirst.mockResolvedValue({ id: 'm1', storeId: STORE_A, handle: 'main-menu', name: 'Main' });
    deps.prisma.menuItem.findMany.mockResolvedValue([
      makeMenuItem({
        id: 'item_1', megaMenu: {
          image: 'banner.jpg', icon: '💍', badge: 'NEW',
          featuredProductIds: ['prod_1'], featuredCategoryIds: ['cat_1'],
        },
      }),
    ]);
    deps.prisma.product.findMany.mockResolvedValue([
      { id: 'prod_1', name: 'Gold Ring', slug: 'gold-ring', thumbnail: 't.jpg', price: 4999, comparePrice: 5999 },
    ]);
    deps.prisma.category.findMany.mockResolvedValue([
      { id: 'cat_1', name: 'Rings', slug: 'rings', image: 'rings.jpg' },
    ]);
    const service = makeService(deps);

    const result = await service.getMenuByHandle(STORE_A, 'main-menu');

    expect(result!.items[0].megaMenu).toEqual({
      image: 'banner.jpg', icon: '💍', banner: null, badge: 'NEW',
      featuredProducts: [{ id: 'prod_1', name: 'Gold Ring', slug: 'gold-ring', thumbnail: 't.jpg', price: 4999, comparePrice: 5999 }],
      featuredCategories: [{ id: 'cat_1', name: 'Rings', slug: 'rings', image: 'rings.jpg' }],
    });
  });

  it('silently skips a featured product/category id that no longer resolves, rather than throwing', async () => {
    const deps = makeDeps();
    deps.prisma.menu.findFirst.mockResolvedValue({ id: 'm1', storeId: STORE_A, handle: 'main-menu', name: 'Main' });
    deps.prisma.menuItem.findMany.mockResolvedValue([
      makeMenuItem({ id: 'item_1', megaMenu: { featuredProductIds: ['deleted_product'] } }),
    ]);
    deps.prisma.product.findMany.mockResolvedValue([]);
    const service = makeService(deps);

    const result = await service.getMenuByHandle(STORE_A, 'main-menu');

    expect(result!.items[0].megaMenu!.featuredProducts).toEqual([]);
  });

  it('leaves megaMenu null for items with no megaMenu JSON', async () => {
    const deps = makeDeps();
    deps.prisma.menu.findFirst.mockResolvedValue({ id: 'm1', storeId: STORE_A, handle: 'main-menu', name: 'Main' });
    deps.prisma.menuItem.findMany.mockResolvedValue([makeMenuItem({ id: 'item_1', megaMenu: null })]);
    const service = makeService(deps);

    const result = await service.getMenuByHandle(STORE_A, 'main-menu');

    expect(result!.items[0].megaMenu).toBeNull();
  });
});

describe('StorefrontMenuService — getDefaultMenu (HeaderConfig integration)', () => {
  it('resolves the menu referenced by the PUBLISHED header\'s navigation component', async () => {
    const deps = makeDeps();
    deps.headerConfig.getPublished.mockResolvedValue({
      zones: [{ id: 'zone2', components: [{ type: 'navigation', settings: { menuHandle: 'main-menu' } }] }],
    });
    deps.prisma.menu.findFirst.mockResolvedValue({ id: 'm1', storeId: STORE_A, handle: 'main-menu', name: 'Main' });
    deps.prisma.menuItem.findMany.mockResolvedValue([]);
    const service = makeService(deps);

    const result = await service.getDefaultMenu(STORE_A);

    expect(deps.headerConfig.getPublished).toHaveBeenCalledWith(STORE_A);
    expect(deps.prisma.menu.findFirst).toHaveBeenCalledWith({ where: { storeId: STORE_A, handle: 'main-menu' } });
    expect(result).not.toBeNull();
  });

  it('never reads draft header config — no preview leakage onto the public path', async () => {
    const deps = makeDeps();
    deps.headerConfig.getPublished.mockResolvedValue(null);
    const service = makeService(deps);

    await service.getDefaultMenu(STORE_A);

    expect(deps.headerConfig.getPublished).toHaveBeenCalled();
    expect(deps.prisma.menu.findFirst).not.toHaveBeenCalled();
  });

  it('returns null gracefully when there is no published header config at all', async () => {
    const deps = makeDeps();
    deps.headerConfig.getPublished.mockResolvedValue(null);
    const service = makeService(deps);

    const result = await service.getDefaultMenu(STORE_A);

    expect(result).toBeNull();
  });

  it('returns null gracefully when the header has no navigation component configured', async () => {
    const deps = makeDeps();
    deps.headerConfig.getPublished.mockResolvedValue({ zones: [{ id: 'zone2', components: [{ type: 'logo' }] }] });
    const service = makeService(deps);

    const result = await service.getDefaultMenu(STORE_A);

    expect(result).toBeNull();
    expect(deps.prisma.menu.findFirst).not.toHaveBeenCalled();
  });
});

describe('isSafeHref (pure)', () => {
  it.each([
    ['/category/sarees', true],
    ['#section', true],
    ['?query=1', true],
    ['https://example.com', true],
    ['http://example.com', true],
    ['mailto:hello@example.com', true],
    ['tel:+911234567890', true],
    ['', true],
    ['javascript:alert(1)', false],
    ['data:text/html,<script>alert(1)</script>', false],
    ['vbscript:msgbox(1)', false],
  ])('isSafeHref(%s) === %s', (url, expected) => {
    expect(isSafeHref(url)).toBe(expected);
  });
});

describe('buildTree (pure)', () => {
  function node(id: string): ResolvedMenuItem {
    return { id, label: id, url: '/x', linkType: 'EXTERNAL_URL', megaMenu: null, children: [] };
  }

  it('nests items to unlimited depth from a flat parentId map', () => {
    const nodesById = new Map([
      ['a', node('a')], ['b', node('b')], ['c', node('c')], ['d', node('d')],
    ]);
    const parentByChildId = new Map<string, string | null>([
      ['a', null], ['b', 'a'], ['c', 'b'], ['d', 'c'],
    ]);

    const roots = buildTree(nodesById, parentByChildId);

    expect(roots).toHaveLength(1);
    expect(roots[0].children[0].children[0].children[0].id).toBe('d');
  });

  it('treats an item whose parent was dropped (dead link) as top-level rather than losing it', () => {
    const nodesById = new Map([['orphan', node('orphan')]]);
    const parentByChildId = new Map<string, string | null>([['orphan', 'deleted_parent']]);

    const roots = buildTree(nodesById, parentByChildId);

    expect(roots).toHaveLength(1);
    expect(roots[0].id).toBe('orphan');
  });
});
