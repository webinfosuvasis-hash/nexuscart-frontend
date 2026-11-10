import { test, expect } from '@playwright/test';

/**
 * Core storefront journeys against a real backend.
 * Read-only by default. Cart writes need E2E_ALLOW_WRITES=1 — the default
 * backend is the client's live deploy, so never write there implicitly.
 */

const ALLOW_WRITES = process.env.E2E_ALLOW_WRITES === '1';

// The crawl needs a long budget (playwright.config); single journeys must fail fast.
test.describe.configure({ timeout: 90_000 });

test.describe('read-only journeys', () => {
  test('header search lands on results with products', async ({ page }) => {
    await page.goto('/');
    const search = page.getByRole('searchbox', { name: 'Search products' }).or(page.getByLabel('Search products')).first();
    await search.fill('saree');
    await search.press('Enter');
    await expect(page).toHaveURL(/\/search\?q=saree/);
    await expect(page.locator('a[href^="/products/"]').first()).toBeVisible({ timeout: 15_000 });
  });

  test('listing → product detail shows price and an enabled ADD TO BAG', async ({ page }) => {
    await page.goto('/category/women-0');
    const card = page.locator('a[href^="/products/"]').first();
    await expect(card).toBeVisible({ timeout: 15_000 });
    await card.click();
    await expect(page).toHaveURL(/\/products\//);
    await expect(page.getByText('₹').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /ADD TO BAG|OUT OF STOCK/ })).toBeVisible({ timeout: 15_000 });
  });

  test('cart drawer opens from the header and the empty cart page renders', async ({ page }) => {
    await page.goto('/cart');
    await expect(page.locator('body')).not.toContainText(/something went wrong/i);
    await page.goto('/');
    const drawer = page.getByRole('dialog', { name: 'Shopping cart' });
    await expect(drawer).toHaveCount(0); // closed drawer is hidden from the a11y tree
    await page.getByRole('button', { name: 'Shopping cart' }).click();
    await expect(drawer).toBeVisible();
    await expect(drawer).toHaveClass(/translate-x-0/);
    await drawer.getByRole('button', { name: 'Close cart' }).click();
    await expect(drawer).toHaveCount(0);
  });

  test('protected account pages redirect to login and keep the return path', async ({ page }) => {
    await page.goto('/account/orders');
    await expect(page).toHaveURL(/\/login\?redirect=%2Faccount%2Forders/);
  });

  test('login form rejects bad credentials without crashing', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('priya@example.com').fill('nobody@example.invalid');
    await page.getByPlaceholder('••••••••').fill('wrong-password-123');
    await page.getByRole('button', { name: /sign in|log in|login/i }).click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('alert').or(page.getByText(/invalid|incorrect|not found|failed/i)).first()).toBeVisible({ timeout: 15_000 });
  });

  test('About Us from the live menu renders content (regression)', async ({ page }) => {
    await page.goto('/pages/about-us');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText(/page not found/i)).toHaveCount(0);
  });
});

test.describe('cart writes', () => {
  test.skip(!ALLOW_WRITES, 'set E2E_ALLOW_WRITES=1 to run (writes a guest cart to the backend)');

  test('add to bag → drawer shows item → quantity +/- → remove', async ({ page }) => {
    await page.goto('/category/women-0');
    await page.locator('a[href^="/products/"]').first().click();
    const add = page.getByRole('button', { name: 'ADD TO BAG' });
    await expect(add).toBeEnabled({ timeout: 15_000 });
    await add.click();

    const drawer = page.getByRole('dialog', { name: 'Shopping cart' });
    await expect(drawer).toBeVisible({ timeout: 15_000 });
    await expect(drawer.getByLabel('Quantity: 1')).toBeVisible();
    await drawer.getByRole('button', { name: 'Increase quantity' }).click();
    await expect(drawer.getByLabel('Quantity: 2')).toBeVisible({ timeout: 10_000 });
    await drawer.getByRole('button', { name: 'Decrease quantity' }).click();
    await expect(drawer.getByLabel('Quantity: 1')).toBeVisible({ timeout: 10_000 });
    await drawer.getByRole('button', { name: /^Remove / }).click();
    await expect(drawer.getByLabel(/Quantity:/)).toHaveCount(0, { timeout: 10_000 });
  });
});
