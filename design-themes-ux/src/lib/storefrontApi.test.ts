import { describe, it, expect } from 'vitest';
import { fetchCategories, fetchProductListing, ApiError } from './storefrontApi';
import { fetchCmsPage } from './storefrontCmsApi';
import { fetchDefaultMenu, fetchMenuByHandle } from './storefrontMenuApi';
import { mockFetch, ok, fail } from '@/test/utils';

describe('storefrontApi core fetch', () => {
  it('sends X-Store-Id and unwraps the { success, data } envelope', async () => {
    const spy = mockFetch(() => ok({ categories: [{ id: 'c1', name: 'Sarees', slug: 'sarees', img: '' }] }));

    const res = await fetchCategories(5);

    expect(res.categories[0].slug).toBe('sarees');
    const [url, init] = spy.mock.calls[0];
    expect(String(url)).toBe('http://api.test/api/v1/storefront/categories?limit=5');
    expect((init!.headers as Record<string, string>)['X-Store-Id']).toBe('store_test');
  });

  it('throws ApiError carrying the real HTTP status (404 vs 500 are distinguishable)', async () => {
    mockFetch(() => fail(404, 'Not Found'));
    await expect(fetchCategories()).rejects.toMatchObject({ name: 'ApiError', status: 404 });

    mockFetch(() => fail(500, 'Server Error'));
    const err = await fetchCategories().catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(500);
  });

  it('builds listing query strings from scope + filters', async () => {
    const spy = mockFetch(() => ok({ products: [], pagination: { total: 0 } }));
    await fetchProductListing({ categorySlug: 'sarees', q: 'silk', sortBy: 'price_asc', page: 2 });
    const url = new URL(String(spy.mock.calls[0][0]));
    expect(url.pathname).toBe('/api/v1/storefront/products');
    expect(url.searchParams.get('categorySlug')).toBe('sarees');
    expect(url.searchParams.get('q')).toBe('silk');
    expect(url.searchParams.get('sortBy')).toBe('price_asc');
  });
});

describe('CMS + menu clients', () => {
  it('fetchCmsPage hits /storefront/pages/:slug and URL-encodes the slug', async () => {
    const spy = mockFetch(() => ok({ id: 'p1', slug: 'about-us', title: 'About', sections: [] }));
    await fetchCmsPage('about us/../x');
    expect(String(spy.mock.calls[0][0])).toBe('http://api.test/api/v1/storefront/pages/about%20us%2F..%2Fx');
  });

  it('menu clients hit the default and by-handle endpoints', async () => {
    const spy = mockFetch(() => ok(null));
    await expect(fetchDefaultMenu()).resolves.toBeNull();
    await fetchMenuByHandle('footer-menu');
    expect(String(spy.mock.calls[0][0])).toMatch(/\/storefront\/menu$/);
    expect(String(spy.mock.calls[1][0])).toMatch(/\/storefront\/menus\/footer-menu$/);
  });
});
