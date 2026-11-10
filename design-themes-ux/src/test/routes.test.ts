import { describe, it, expect } from 'vitest';
import { matchPath } from 'react-router-dom';
import fs from 'fs';
import path from 'path';
import { NAV_LINKS } from '@/themes/aurus/constants';
import { HELP_LINKS, COMPANY_LINKS } from '@/themes/aurus/AurusFooter';
import { DEFAULT_CMS_PAGES } from '@/data/defaultCmsPages';
import { LEGACY_REDIRECTS } from '@/lib/legacyRedirects';

/**
 * Route integrity — every URL the storefront can link to must match a real
 * route in App.tsx (not the `*` NotFound catch-all). This is the class of
 * bug behind "About Us → 404": the menu resolver emitted /pages/:slug but
 * no such route existed.
 */
const appSource = fs.readFileSync(path.resolve(__dirname, '../App.tsx'), 'utf-8');
const ROUTES = [...appSource.matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => m[1]).filter((p) => p !== '*');

const matches = (patterns: string[], url: string) => {
  const pathname = url.split(/[?#]/)[0];
  return patterns.some((pattern) => matchPath({ path: pattern, end: true }, pathname));
};
const isRoutable = (url: string) => matches(ROUTES, url);
/** Routable directly, or via a legacy redirect that itself lands on a real route. */
const resolves = (url: string) => isRoutable(url) || matches(Object.keys(LEGACY_REDIRECTS), url);

/** Every hardcoded internal link target in the storefront source. */
function sourceLinks(): Array<[string, string]> {
  const root = path.resolve(__dirname, '..');
  // AurusHome.tsx is the retired V1 homepage (VITE_DATA_DRIVEN_HOME=true everywhere) — dead code.
  const skip = /\.test\.|[\\/]test[\\/]|AurusHome\.tsx$|(Craft|Jewel|Fashion|Market)(Home|Product)\.tsx$/;
  const out: Array<[string, string]> = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const f = path.join(dir, e.name);
      if (e.isDirectory()) walk(f);
      else if (/\.(tsx?|ts)$/.test(e.name) && !skip.test(f)) {
        const src = fs.readFileSync(f, 'utf-8');
        const re = /(?:\bto=|\bhref=|navigate\(|[A-Za-z]+(?:Url|Link|link|url|href)\s*:\s*)\{?\s*['"`](\/[A-Za-z0-9\-_/?=&.%]*)['"`]/g;
        for (const m of src.matchAll(re)) out.push([path.relative(root, f), m[1]]);
      }
    }
  };
  walk(root);
  return out;
}

describe('route integrity', () => {
  it('parsed the route table', () => {
    expect(ROUTES).toEqual(expect.arrayContaining(['/', '/products/:id', '/category/:categorySlug', '/pages/:slug']));
  });

  // Mirrors StorefrontMenuService.resolveUrls (backend) — one URL shape per link type.
  it.each([
    ['CATEGORY', '/category/women-0'],
    ['PRODUCT', '/products/cmr0ak3q90038n8xa33fajbc1'],
    ['BRAND', '/brand/aurus'],
    ['CMS_PAGE', '/pages/about-us'],
    ['COLLECTION', '/collection/wedding-collection'],
  ])('menu link type %s (%s) has a route', (_type, url) => {
    expect(isRoutable(url)).toBe(true);
  });

  it.each(Object.entries(NAV_LINKS))('header fallback "%s" → %s has a route', (_label, url) => {
    expect(isRoutable(url)).toBe(true);
  });

  it.each([...HELP_LINKS, ...COMPANY_LINKS].map((l) => [l.label, l.to]))('footer "%s" → %s has a route', (_label, url) => {
    expect(isRoutable(url)).toBe(true);
  });

  it('every footer /pages/* link has built-in content, so a fresh store never 404s', () => {
    for (const { to } of [...HELP_LINKS, ...COMPANY_LINKS]) {
      if (to.startsWith('/pages/')) expect(DEFAULT_CMS_PAGES[to.slice('/pages/'.length)], to).toBeDefined();
    }
  });

  it('account pages linked from the storefront are routable', () => {
    for (const url of ['/account', '/account/addresses', '/account/orders', '/account/orders/o1',
      '/account/orders/o1/tracking', '/account/orders/o1/cancel', '/account/orders/o1/invoice',
      '/login', '/register', '/forgot-password', '/reset-password', '/verify-email', '/cart', '/checkout', '/search']) {
      expect(isRoutable(url), url).toBe(true);
    }
  });

  it.each(Object.entries(LEGACY_REDIRECTS))('legacy redirect %s → %s lands on a real route', (_from, to) => {
    expect(isRoutable(to)).toBe(true);
  });

  it('every hardcoded link in the storefront source resolves (no 404 links)', () => {
    const links = sourceLinks();
    expect(links.length).toBeGreaterThan(30); // sanity: the scan actually found links
    const broken = links.filter(([, url]) => !resolves(url)).map(([file, url]) => `${file}: ${url}`);
    expect(broken).toEqual([]);
  });

  it('unknown URLs fall through to NotFound', () => {
    expect(isRoutable('/about-us')).toBe(false);
    expect(appSource).toMatch(/<Route path="\*" element={<NotFound \/>} \/>/);
  });
});
