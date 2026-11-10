import { test, expect, type Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/**
 * Storefront crawl — visits seed pages, then every internal link found on
 * them (header menu, mega menu, footer, product cards…), and records:
 *   - uncaught JS exceptions / console errors
 *   - failed API calls (≥ 400)
 *   - pages showing a 404 / "not found" / error state
 *   - mojibake (double-encoded UTF-8) in visible text
 * Writes e2e/crawl-report.json and fails if anything was found.
 */

const SEEDS = [
  '/', '/jewellery', '/search?q=saree', '/cart', '/checkout', '/login', '/register',
  '/forgot-password', '/account', '/registry', '/pages/about-us', '/pages/faq',
];
const MAX_PAGES = Number(process.env.E2E_MAX_PAGES ?? 80);
// Statuses a healthy page may legitimately trigger (anonymous cart/session probes etc.)
const IGNORED_API = [
  /\/customer-auth\/(me|refresh)/, /\/customer\/(profile|me)/,
  /\/storefront\/pages\//, // 404 = unpublished CMS page; CmsPage falls back to built-in content
];

const ERROR_TEXT = /\b404\b|page not found|category not found|not found:|something went wrong|failed to load|couldn't load|couldn't find/i;
const MOJIBAKE = /Ã.|â€|â‚¹|ðŸ|âœ|Â·/;

interface Issue { url: string; kind: string; detail: string }

async function visit(page: Page, url: string, issues: Issue[]): Promise<string[]> {
  const local: Issue[] = [];
  const onErr = (e: Error) => local.push({ url, kind: 'pageerror', detail: e.message.slice(0, 300) });
  const onConsole = (m: import('@playwright/test').ConsoleMessage) => {
    const src = m.location()?.url ?? '';
    if (m.type() === 'error' && !/Download the React DevTools|favicon/i.test(m.text()) && !IGNORED_API.some((re) => re.test(src))) {
      local.push({ url, kind: 'console.error', detail: m.text().slice(0, 300) });
    }
  };
  const onResp = (r: import('@playwright/test').Response) => {
    const u = r.url();
    if (u.includes('/api/') && r.status() >= 400 && !IGNORED_API.some((re) => re.test(u))) {
      local.push({ url, kind: `api ${r.status()}`, detail: `${r.request().method()} ${u.replace(/^https?:\/\/[^/]+/, '')}` });
    }
  };
  page.on('pageerror', onErr);
  page.on('console', onConsole);
  page.on('response', onResp);

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    // Not 'networkidle' — some pages poll, so it never settles. Wait for the app to render instead.
    await page.locator('header, main, footer').first().waitFor({ timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(1_500);

    // page.evaluate, not locator.innerText(): a locator auto-waits forever when a page has no <main>.
    await page.waitForFunction(() => !/Loading…/.test(document.body.innerText), null, { timeout: 8_000 }).catch(() => {});
    const main = await page.evaluate(() => (document.querySelector('main') ?? document.body).innerText);
    const errLine = main.split('\n').find((l) => ERROR_TEXT.test(l) && l.length < 160);
    if (errLine) local.push({ url, kind: 'error-state', detail: errLine.trim() });
    const body = await page.evaluate(() => document.body.innerText);
    const moji = body.match(MOJIBAKE);
    if (moji) local.push({ url, kind: 'mojibake', detail: body.slice(Math.max(0, moji.index! - 30), moji.index! + 30) });
    const dead = await page.locator('a[href="#"]:visible').count();
    if (dead) local.push({ url, kind: 'dead-link', detail: `${dead} visible <a href="#">` });

    const hrefs = await page.$$eval('a[href]', (as) => as.map((a) => (a as HTMLAnchorElement).getAttribute('href') || ''));
    return hrefs.filter((h) => h.startsWith('/') && !h.startsWith('//'));
  } catch (e) {
    local.push({ url, kind: 'navigation', detail: (e as Error).message.slice(0, 200) });
    return [];
  } finally {
    page.off('pageerror', onErr);
    page.off('console', onConsole);
    page.off('response', onResp);
    issues.push(...local);
  }
}

const writeReport = (visited: string[], issues: Issue[]) =>
  fs.writeFileSync(path.join(HERE, 'crawl-report.json'), JSON.stringify({ visited, issues }, null, 2));

/** Collapse per-entity URLs so we sample, not exhaust, e.g. 50 product pages. */
const bucket = (u: string) => u.replace(/\/products\/[^/?#]+/, '/products/:id').replace(/\?.*$/, '');

test('crawl storefront for broken pages and errors', async ({ page }) => {
  const issues: Issue[] = [];
  const queue = [...SEEDS];
  const seen = new Set<string>();
  const perBucket = new Map<string, number>();

  while (queue.length && seen.size < MAX_PAGES) {
    const url = queue.shift()!;
    if (seen.has(url)) continue;
    const b = bucket(url);
    if ((perBucket.get(b) ?? 0) >= (b.includes(':id') ? 6 : 2)) continue;
    perBucket.set(b, (perBucket.get(b) ?? 0) + 1);
    seen.add(url);

    const links = await visit(page, url, issues);
    for (const l of links) if (!seen.has(l)) queue.push(l);
    writeReport([...seen], issues);
  }

  // Expected: unknown URLs must show the 404 page, not crash.
  const expected404 = ['/this-page-does-not-exist', '/pages/no-such-page'];
  for (const u of expected404) {
    await page.goto(u);
    await expect(page.getByText(/page not found/i).first()).toBeVisible();
  }

  writeReport([...seen], issues);
  console.log(`Visited ${seen.size} pages, ${issues.length} issues`);
  for (const i of issues) console.log(`  [${i.kind}] ${i.url} — ${i.detail}`);
  expect(issues, 'see e2e/crawl-report.json').toEqual([]);
});
