import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config — Phase 10B (visual parity harness)
 *
 * Two test projects:
 *   parity  — screenshot diffs between legacy renderer and NodeRenderer.
 *             Run with: PARITY_STORE_IDS=<id> PARITY_AUTH_TOKEN=<tok> \
 *                       npx playwright test --project=parity
 *
 *   smoke   — basic page load + navigation checks.
 *
 * Environment variables for parity:
 *   TEST_BASE_URL         Preview base URL     (default: http://localhost:8080)
 *   API_BASE_URL          Backend API base     (default: http://localhost:3000/api/v1)
 *   PARITY_STORE_IDS      Comma-separated store IDs (required to run parity)
 *   PARITY_AUTH_TOKEN     Bearer token for flag API (required to run parity)
 *   PARITY_PAGES          Pages to test        (default: home,product,collection)
 *   PARITY_PREVIEW_TOKEN  Preview JWT token    (if preview route is token-gated)
 */
export default defineConfig({
  testDir:   './tests',
  timeout:   30_000,
  retries:   1,
  reporter:  [
    ['html',  { outputFolder: 'playwright-report', open: 'never' }],
    ['line'],
  ],
  outputDir: 'playwright-results',

  use: {
    baseURL:     process.env.TEST_BASE_URL ?? 'http://localhost:8080',
    screenshot:  'only-on-failure',
    trace:       'on-first-retry',
  },

  projects: [
    {
      name:      'parity',
      testMatch: '**/visual-parity/*.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        // 1440×900 viewport mirrors the editor's "desktop" breakpoint
        viewport:  { width: 1440, height: 900 },
        screenshot: 'on',     // always capture for diffs
      },
      timeout:   60_000,
      retries:   0,           // parity failures should be investigated, not retried
    },
    {
      name:      'smoke',
      testMatch: '**/smoke/*.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
