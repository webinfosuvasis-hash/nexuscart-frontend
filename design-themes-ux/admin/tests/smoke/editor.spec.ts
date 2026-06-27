/**
 * Smoke tests — Sprint 10
 * Basic editor health checks before each parity gate.
 */

import { test, expect } from '@playwright/test';

const BASE = process.env.TEST_BASE_URL ?? 'http://localhost:8080';

test.describe('Editor smoke', () => {
  test('editor page loads without crash', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });

    // Basic presence checks
    await expect(page.locator('body')).toBeVisible();
    expect(errors.filter((e) => !e.includes('ResizeObserver'))).toHaveLength(0);
  });
});
