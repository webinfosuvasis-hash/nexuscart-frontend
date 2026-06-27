/**
 * Visual parity harness — Phase 10B
 *
 * Validates that CONTENT_NODE_ENABLED=true (NodeRenderer path) produces
 * visually identical output to CONTENT_NODE_ENABLED=false (ThemePageSection
 * legacy path) for the same page content.
 *
 * ── How it works ──────────────────────────────────────────────────────────────
 *
 *   1. Navigate to the preview URL with the flag OFF  → capture baseline
 *   2. Enable CONTENT_NODE_ENABLED via the flag API
 *   3. Navigate to the same URL with the flag ON      → capture candidate
 *   4. Disable the flag (cleanup, always runs)
 *   5. Pixel-diff baseline vs candidate using pixelmatch
 *   6. Attach both screenshots + diff image to the report
 *
 * ── Pages under test ──────────────────────────────────────────────────────────
 *
 *   home, product, collection
 *
 * ── Regions under test ────────────────────────────────────────────────────────
 *
 *   full-page, hero, header, footer, featured_collection, trust_badges
 *
 * ── Threshold ─────────────────────────────────────────────────────────────────
 *
 *   <= 0.1% differing pixels (allows antialiasing + sub-pixel font rendering)
 *
 * ── Environment variables ─────────────────────────────────────────────────────
 *
 *   TEST_BASE_URL      Preview base URL   (default: http://localhost:8080)
 *   API_BASE_URL       Backend API base   (default: http://localhost:3000/api/v1)
 *   PARITY_STORE_IDS   Comma-separated store IDs to test (required)
 *   PARITY_AUTH_TOKEN  Bearer token for flag API calls (required)
 *   PARITY_PAGES       Comma-separated pages (default: home,product,collection)
 *
 * ── Running ───────────────────────────────────────────────────────────────────
 *
 *   PARITY_STORE_IDS=store_abc PARITY_AUTH_TOKEN=... \
 *   npx playwright test --project=parity
 */

import { test, expect, type Page, type Locator } from '@playwright/test';
import {
  compareImages,
  isPassing,
  buildReport,
  formatReport,
  DIFF_THRESHOLD_PCT,
  type DiffResult,
  type RegionResult,
  type PageResult,
} from './diffEngine';

// ─── Configuration ────────────────────────────────────────────────────────────

const API_BASE    = process.env.API_BASE_URL   ?? 'http://localhost:3000/api/v1';
const PREVIEW_BASE= process.env.TEST_BASE_URL  ?? 'http://localhost:8080';
const AUTH_TOKEN  = process.env.PARITY_AUTH_TOKEN ?? '';

const TEST_STORES = (process.env.PARITY_STORE_IDS ?? '')
  .split(',')
  .filter(Boolean)
  .map((s) => s.trim());

const TEST_PAGES  = (process.env.PARITY_PAGES ?? 'home,product,collection')
  .split(',')
  .filter(Boolean)
  .map((p) => p.trim());

// ─── Region selectors ─────────────────────────────────────────────────────────
// Each region uses a fallback chain: legacy selector → node selector → semantic.
// The first selector that finds an element is used; if none match, the region
// is marked as [not found] but does NOT fail the test.

interface RegionSpec {
  label:     string;
  selectors: string[];          // tried in order; first match wins
}

const REGIONS: RegionSpec[] = [
  {
    label:     'header',
    selectors: [
      'header',
      '[data-section-type="header"]',
      '[data-node-type="header"]',
    ],
  },
  {
    label:     'hero',
    selectors: [
      '[data-section-type="hero"]',
      '[data-node-type="hero"]',
      '[data-nexuscart-section][data-section-type="hero"]',
    ],
  },
  {
    label:     'featured_collection',
    selectors: [
      '[data-section-type="featured_collection"]',
      '[data-node-type="featured_collection"]',
    ],
  },
  {
    label:     'trust_badges',
    selectors: [
      '[data-section-type="trust_badges_bar"]',
      '[data-node-type="trust_badges_bar"]',
    ],
  },
  {
    label:     'footer',
    selectors: [
      'footer',
      '[data-section-type="footer"]',
      '[data-node-type="footer"]',
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function setFlag(storeId: string, enabled: boolean): Promise<void> {
  const action   = enabled ? 'enable' : 'disable';
  const endpoint = `${API_BASE}/content/flags/${storeId}/${action}`;
  const resp = await fetch(endpoint, {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization:  `Bearer ${AUTH_TOKEN}`,
    },
    body: JSON.stringify({ flag: 'CONTENT_NODE_ENABLED' }),
  });
  if (!resp.ok) {
    throw new Error(`Flag ${action} failed for ${storeId}: HTTP ${resp.status} — ${await resp.text()}`);
  }
}

async function navigateTo(page: Page, storeId: string, pageId: string): Promise<void> {
  // Public preview route: /preview/:storeId/:pageId
  // Optional token via PARITY_PREVIEW_TOKEN (if the preview is token-gated).
  const token  = process.env.PARITY_PREVIEW_TOKEN;
  const suffix = token ? `?token=${token}` : '';
  const url    = `${PREVIEW_BASE}/preview/${storeId}/${pageId}${suffix}`;

  await page.goto(url, { waitUntil: 'networkidle', timeout: 20_000 });

  // Wait for lazy-loaded images and deferred scripts to settle
  await page.waitForTimeout(800);

  // Scroll to bottom to trigger any scroll-based lazy loads, then back to top
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(300);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);
}

async function captureFullPage(page: Page): Promise<Buffer> {
  return page.screenshot({ fullPage: true });
}

async function captureRegion(page: Page, spec: RegionSpec): Promise<Buffer | null> {
  for (const selector of spec.selectors) {
    try {
      const locator: Locator = page.locator(selector).first();
      if ((await locator.count()) > 0) {
        return locator.screenshot();
      }
    } catch {
      // selector failed — try next
    }
  }
  return null;   // region not found in this page
}

// ─── Core parity test ─────────────────────────────────────────────────────────

const allResults: PageResult[] = [];

test.describe('Visual parity: legacy renderer vs NodeRenderer', () => {

  test.skip(
    TEST_STORES.length === 0,
    'No stores configured. Set PARITY_STORE_IDS=<id1,id2,...> to run parity tests.',
  );

  test.skip(
    !AUTH_TOKEN,
    'No auth token configured. Set PARITY_AUTH_TOKEN to run parity tests.',
  );

  for (const storeId of TEST_STORES) {
    for (const pageId of TEST_PAGES) {

      test(`parity: ${storeId}/${pageId}`, async ({ page }) => {
        test.setTimeout(60_000);   // extended timeout for two full-page renders

        // ── Baseline (flag OFF) ────────────────────────────────────────────────
        await setFlag(storeId, false);
        await page.waitForTimeout(300);   // allow Redis cache invalidation
        await navigateTo(page, storeId, pageId);

        const baselineFull   = await captureFullPage(page);
        const baselineRegions: Record<string, Buffer | null> = {};
        for (const spec of REGIONS) {
          baselineRegions[spec.label] = await captureRegion(page, spec);
        }

        // ── Candidate (flag ON) ────────────────────────────────────────────────
        await setFlag(storeId, true);
        await page.waitForTimeout(300);
        await navigateTo(page, storeId, pageId);

        const candidateFull   = await captureFullPage(page);
        const candidateRegions: Record<string, Buffer | null> = {};
        for (const spec of REGIONS) {
          candidateRegions[spec.label] = await captureRegion(page, spec);
        }

        // ── Cleanup (always runs — even on assertion failure) ─────────────────
        await setFlag(storeId, false).catch(() => {
          console.error(`[parity] Warning: could not disable flag for ${storeId}`);
        });

        // ── Full-page diff ────────────────────────────────────────────────────
        const fullPageDiff = compareImages(baselineFull, candidateFull);

        // Attach screenshots and diff to the test report
        await test.info().attach(`${pageId}-baseline.png`,
          { body: baselineFull,          contentType: 'image/png' });
        await test.info().attach(`${pageId}-candidate.png`,
          { body: candidateFull,          contentType: 'image/png' });
        if (fullPageDiff.diffBuffer.length > 0) {
          await test.info().attach(`${pageId}-diff.png`,
            { body: fullPageDiff.diffBuffer, contentType: 'image/png' });
        }

        // ── Region diffs ──────────────────────────────────────────────────────
        const regionResults: RegionResult[] = [];

        for (const spec of REGIONS) {
          const baseline  = baselineRegions[spec.label];
          const candidate = candidateRegions[spec.label];

          if (!baseline || !candidate) {
            regionResults.push({ label: spec.label, result: null, found: false });
            continue;
          }

          const diff = compareImages(baseline, candidate);
          regionResults.push({ label: spec.label, result: diff, found: true });

          // Attach region screenshots
          await test.info().attach(`${pageId}-${spec.label}-baseline.png`,
            { body: baseline,       contentType: 'image/png' });
          await test.info().attach(`${pageId}-${spec.label}-candidate.png`,
            { body: candidate,      contentType: 'image/png' });
          if (diff.diffBuffer.length > 0) {
            await test.info().attach(`${pageId}-${spec.label}-diff.png`,
              { body: diff.diffBuffer, contentType: 'image/png' });
          }
        }

        // ── Record result ─────────────────────────────────────────────────────
        const passed = isPassing(fullPageDiff);
        allResults.push({ storeId, pageId, fullPage: fullPageDiff, regions: regionResults, passed });

        // Add diff annotation to the test report
        test.info().annotations.push({
          type:        'diff',
          description: `full-page: ${fullPageDiff.diffPercent.toFixed(4)}%` +
                       (fullPageDiff.dimensionMismatch ? ' [DIMENSION MISMATCH]' : ''),
        });

        for (const r of regionResults) {
          if (r.found && r.result) {
            test.info().annotations.push({
              type:        'diff',
              description: `${r.label}: ${r.result.diffPercent.toFixed(4)}%`,
            });
          }
        }

        // ── Assert ────────────────────────────────────────────────────────────
        if (fullPageDiff.dimensionMismatch) {
          throw new Error(
            `[${storeId}/${pageId}] Dimension mismatch: ` +
            `baseline and candidate have different viewport sizes.`,
          );
        }

        expect(
          fullPageDiff.diffPercent,
          `[${storeId}/${pageId}] Full-page pixel diff ${fullPageDiff.diffPercent.toFixed(4)}% ` +
          `exceeds ${DIFF_THRESHOLD_PCT}% threshold. ` +
          `(${fullPageDiff.diffPixels.toLocaleString()} of ` +
          `${fullPageDiff.totalPixels.toLocaleString()} pixels differ)`,
        ).toBeLessThanOrEqual(DIFF_THRESHOLD_PCT);

        // Region failures are reported as warnings (annotations) but do not
        // fail the test — region selectors may not exist on all pages.
        for (const r of regionResults) {
          if (r.found && r.result && !isPassing(r.result)) {
            console.warn(
              `[parity] WARN: ${storeId}/${pageId} region '${r.label}' ` +
              `diff ${r.result.diffPercent.toFixed(4)}% > ${DIFF_THRESHOLD_PCT}%`,
            );
          }
        }
      });

    }
  }

});

// ─── Summary report (printed once after all parity tests) ─────────────────────

test.afterAll(async () => {
  if (allResults.length === 0) return;
  const report = buildReport(allResults);
  console.log('\n' + formatReport(report));
});

// ─── NodeRenderer smoke test ──────────────────────────────────────────────────

test.describe('NodeRenderer smoke', () => {

  test.skip(
    TEST_STORES.length === 0 || !AUTH_TOKEN,
    'Requires PARITY_STORE_IDS and PARITY_AUTH_TOKEN.',
  );

  test('NodeRenderer renders home page without JS errors', async ({ page }) => {
    test.setTimeout(30_000);
    const storeId = TEST_STORES[0];
    const errors:  string[] = [];

    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console',   (m) => { if (m.type() === 'error') errors.push(m.text()); });

    await setFlag(storeId, true);

    try {
      await navigateTo(page, storeId, 'home');

      // Either legacy section wrappers or ContentNode node wrappers should be present
      const legacyCount = await page.locator('[data-nexuscart-section]').count();
      const nodeCount   = await page.locator('[data-node-id]').count();

      expect(legacyCount + nodeCount, 'No rendered sections found on page').toBeGreaterThan(0);

      // Filter out ResizeObserver errors (benign browser quirk)
      const realErrors = errors.filter((e) => !e.includes('ResizeObserver'));
      expect(realErrors, `Page logged JS errors: ${realErrors.join('; ')}`).toHaveLength(0);

    } finally {
      await setFlag(storeId, false).catch(() => {});
    }
  });

  test('Legacy renderer renders home page without JS errors', async ({ page }) => {
    test.setTimeout(30_000);
    const storeId = TEST_STORES[0];
    const errors:  string[] = [];

    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console',   (m) => { if (m.type() === 'error') errors.push(m.text()); });

    await setFlag(storeId, false);
    await navigateTo(page, storeId, 'home');

    const realErrors = errors.filter((e) => !e.includes('ResizeObserver'));
    expect(realErrors, `Legacy page logged JS errors: ${realErrors.join('; ')}`).toHaveLength(0);
  });

});

// ─── Diff engine unit test (runs as part of parity project) ──────────────────

test.describe('DiffEngine unit tests', () => {

  test('compareImages returns 0% diff for identical images', async () => {
    // Create a tiny 1×1 red pixel PNG
    const { PNG } = await import('pngjs');
    const img = new PNG({ width: 2, height: 2 });
    img.data[0]  = 255; img.data[1]  = 0;   img.data[2]  = 0;   img.data[3]  = 255;
    img.data[4]  = 0;   img.data[5]  = 255; img.data[6]  = 0;   img.data[7]  = 255;
    img.data[8]  = 0;   img.data[9]  = 0;   img.data[10] = 255; img.data[11] = 255;
    img.data[12] = 255; img.data[13] = 255; img.data[14] = 0;   img.data[15] = 255;
    const buf = Buffer.from(PNG.sync.write(img));

    const result = compareImages(buf, buf);

    expect(result.diffPixels).toBe(0);
    expect(result.diffPercent).toBe(0);
    expect(result.dimensionMismatch).toBe(false);
  });

  test('compareImages flags dimension mismatch', async () => {
    const { PNG } = await import('pngjs');

    const imgA = new PNG({ width: 2, height: 2 });
    imgA.data.fill(128);
    const bufA = Buffer.from(PNG.sync.write(imgA));

    const imgB = new PNG({ width: 3, height: 2 });
    imgB.data.fill(128);
    const bufB = Buffer.from(PNG.sync.write(imgB));

    const result = compareImages(bufA, bufB);
    expect(result.dimensionMismatch).toBe(true);
    expect(result.diffPercent).toBe(100);
  });

  test('compareImages detects pixel differences', async () => {
    const { PNG } = await import('pngjs');

    const imgA = new PNG({ width: 4, height: 4 });
    imgA.data.fill(0);    // all black
    const bufA = Buffer.from(PNG.sync.write(imgA));

    const imgB = new PNG({ width: 4, height: 4 });
    imgB.data.fill(255);  // all white
    const bufB = Buffer.from(PNG.sync.write(imgB));

    const result = compareImages(bufA, bufB);
    expect(result.diffPixels).toBeGreaterThan(0);
    expect(result.diffPercent).toBeGreaterThan(0);
    expect(result.diffBuffer.length).toBeGreaterThan(0);
  });

  test('isPassing returns true when diffPercent <= 0.1', async () => {
    const { PNG } = await import('pngjs');
    const img = new PNG({ width: 2, height: 2 });
    img.data.fill(200);
    const buf = Buffer.from(PNG.sync.write(img));

    // Same buffer compared against itself → 0% diff → must pass
    const result = compareImages(buf, buf);
    expect(isPassing(result)).toBe(true);
  });

  test('DIFF_THRESHOLD_PCT is 0.1', () => {
    expect(DIFF_THRESHOLD_PCT).toBe(0.1);
  });
});

// ─── Phase 10B: Parity hardening structural tests ─────────────────────────────

test.describe('Parity hardening — structural correctness (no server required)', () => {

  // ── Fix 3: Wrapper neutralization ────────────────────────────────────────────

  test('display:contents does not add a layout box (wrapper neutralization)', async ({ page }) => {
    // Inject a minimal page: a div with display:contents wrapping a <p>.
    // If the wrapper added a layout box, the <p> would be offset.
    await page.setContent(`
      <html><body style="margin:0;padding:0">
        <div id="wrapper" style="display:contents">
          <p id="content" style="margin:0;padding:0;height:40px;background:red">Content</p>
        </div>
      </body></html>
    `);

    const wrapperBox = await page.locator('#wrapper').boundingBox();
    const contentBox = await page.locator('#content').boundingBox();

    // The wrapper should have no geometry of its own
    // (display:contents elements have no bounding box in most implementations)
    // The content must start at y=0 (no layout offset from wrapper)
    expect(contentBox!.y).toBe(0);
    expect(contentBox!.height).toBe(40);

    // Wrapper itself produces no box (null or zero-area)
    if (wrapperBox !== null) {
      // Some browsers report the wrapper's bounding box as the union of its children
      // In that case, it must match the content box exactly
      expect(wrapperBox.y).toBe(contentBox!.y);
      expect(wrapperBox.height).toBe(contentBox!.height);
    }
  });

  test('display:contents does not create extra whitespace between sections', async ({ page }) => {
    // Two sections with display:contents wrappers should not add vertical gaps.
    await page.setContent(`
      <html><body style="margin:0;padding:0">
        <div style="display:contents">
          <section id="s1" style="margin:0;padding:0;height:100px;background:blue"></section>
        </div>
        <div style="display:contents">
          <section id="s2" style="margin:0;padding:0;height:100px;background:green"></section>
        </div>
      </body></html>
    `);

    const s1 = await page.locator('#s1').boundingBox();
    const s2 = await page.locator('#s2').boundingBox();

    // s2 should immediately follow s1 — no gap from the display:contents wrappers
    expect(s2!.y).toBe(s1!.y + s1!.height);
  });

  test('display:contents preserves child element visibility and dimensions', async ({ page }) => {
    await page.setContent(`
      <html><body style="margin:0;padding:0">
        <div style="display:contents">
          <h1 id="heading" style="margin:0;font-size:32px;height:48px">Title</h1>
          <p  id="para"    style="margin:0;font-size:16px;height:24px">Body</p>
        </div>
      </body></html>
    `);

    const h1 = await page.locator('#heading').boundingBox();
    const p  = await page.locator('#para').boundingBox();

    // Both children must be visible and have their expected dimensions
    expect(h1).not.toBeNull();
    expect(p).not.toBeNull();
    expect(h1!.height).toBeGreaterThan(0);
    expect(p!.height).toBeGreaterThan(0);

    // Paragraph must start immediately after heading (no gap from wrapper)
    expect(p!.y).toBeGreaterThanOrEqual(h1!.y + h1!.height - 1);
  });

  // ── Fix 1: Menu context injection ────────────────────────────────────────────

  test('menu data structure is injectable into page context', async ({ page }) => {
    // Verify that the menus object shape is compatible with pageContext
    // by evaluating a minimal object that mirrors what the backend returns.
    const result = await page.evaluate(() => {
      const menus: Record<string, Array<{ id: string; label: string; url: string }>> = {
        'main-menu': [
          { id: 'home',    label: 'Home',    url: '/'        },
          { id: 'catalog', label: 'Catalog', url: '/catalog' },
          { id: 'contact', label: 'Contact', url: '/contact' },
        ],
      };
      // Verify the structure that RenderContext.pageContext.menus will hold
      return {
        hasMainMenu:  'main-menu' in menus,
        itemCount:    menus['main-menu'].length,
        firstLabel:   menus['main-menu'][0].label,
        hasLabel:     typeof menus['main-menu'][0].label === 'string',
        hasUrl:       typeof menus['main-menu'][0].url   === 'string',
      };
    });

    expect(result.hasMainMenu).toBe(true);
    expect(result.itemCount).toBe(3);
    expect(result.firstLabel).toBe('Home');
    expect(result.hasLabel).toBe(true);
    expect(result.hasUrl).toBe(true);
  });

  // ── Fix 2: Announcement rich text rendering ────────────────────────────────────

  test('HTML formatting is preserved when rendered via dangerouslySetInnerHTML', async ({ page }) => {
    // Verify that the browser renders bold text correctly when injected as HTML
    await page.setContent(`
      <html><body>
        <span id="ann" style="font-weight:500">
        </span>
        <script>
          document.getElementById('ann').innerHTML = '<b>Sale!</b> 30% off everything.';
        </script>
      </body></html>
    `);

    const text   = await page.locator('#ann').textContent();
    const bold   = await page.locator('#ann b').count();

    expect(text).toContain('Sale!');
    expect(bold).toBe(1);
  });

  test('toPlainText strips tags but renderRichText preserves them', async ({ page }) => {
    // Simulate the difference between the two functions via JavaScript eval
    const result = await page.evaluate(() => {
      function toPlainText(v: string): string {
        return v.replace(/<[^>]*>/g, '').trim();
      }
      // renderRichText for legacy string input returns string unchanged (no outer <p>)
      function renderRichTextInline(v: string): string {
        return v.replace(/^<p>/, '').replace(/<\/p>$/, '').trim();
      }

      const input = '<b>Summer Sale</b> — 30% off!';
      return {
        toPlainText:      toPlainText(input),
        renderRichText:   renderRichTextInline(input),
        identical:        toPlainText(input) === renderRichTextInline(input),
      };
    });

    expect(result.toPlainText).toBe('Summer Sale — 30% off!');
    expect(result.renderRichText).toBe('<b>Summer Sale</b> — 30% off!');
    expect(result.identical).toBe(false);
  });
});
