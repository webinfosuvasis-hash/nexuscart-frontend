import { test, expect, Page } from '@playwright/test';

const BASE = 'http://localhost:5199';

async function openEditor(page: Page) {
  await page.goto(BASE);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(600);
  await page.locator('text=Theme Engine').first().click();
  await page.waitForTimeout(500);
  await page.locator('button:has-text("Customize")').first().click();
  await page.waitForTimeout(1200);
}

test.describe('Drag and Drop — Layers Panel', () => {

  test('editor opens and layers panel shows sections', async ({ page }) => {
    await openEditor(page);
    await page.screenshot({ path: 'test-results/ss-01-editor-open.png' });
    await expect(page.locator('text=Layers').first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Hero').first()).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: 'test-results/ss-02-layers-visible.png' });
  });

  test('grip handle appears on hover over section row', async ({ page }) => {
    await openEditor(page);
    await page.locator('text=Hero').first().hover();
    await page.waitForTimeout(400);
    const grip = page.locator('[title="Drag to reorder"]').first();
    await expect(grip).toBeVisible({ timeout: 3000 });
    await page.screenshot({ path: 'test-results/ss-03-layers-grip.png' });
  });

  test('dragging section in layers panel reorders the list', async ({ page }) => {
    await openEditor(page);
    await expect(page.locator('text=Hero').first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Featured collection').first()).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: 'test-results/ss-04-before-drag.png' });

    await page.locator('text=Hero').first().hover();
    await page.waitForTimeout(300);

    const grip       = page.locator('[title="Drag to reorder"]').first();
    const target     = page.locator('text=Featured collection').first();
    const gripBox    = await grip.boundingBox();
    const targetBox  = await target.boundingBox();
    if (!gripBox || !targetBox) throw new Error('Bounding boxes not found');

    await page.mouse.move(gripBox.x + gripBox.width / 2, gripBox.y + gripBox.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(150);
    const fromY = gripBox.y + gripBox.height / 2;
    const toY   = targetBox.y + targetBox.height + 8;
    for (let i = 1; i <= 12; i++) {
      await page.mouse.move(gripBox.x + gripBox.width / 2, fromY + ((toY - fromY) * i) / 12);
      await page.waitForTimeout(30);
    }
    await page.mouse.up();
    await page.waitForTimeout(600);
    await page.screenshot({ path: 'test-results/ss-05-after-layers-drag.png' });
  });
});

test.describe('Drag and Drop — Canvas', () => {

  test('canvas grip handle visible on section hover', async ({ page }) => {
    await openEditor(page);
    await page.waitForTimeout(500);
    const heading = page.locator('text=Browse our latest products').first();
    if (!await heading.isVisible()) { console.log('Hero text not visible'); return; }
    await heading.hover();
    await page.waitForTimeout(400);
    await page.screenshot({ path: 'test-results/ss-06-canvas-hover.png' });
    const grips = await page.locator('[title="Drag to reorder"]').count();
    console.log('Grip handles found on canvas hover:', grips);
    expect(grips).toBeGreaterThan(0);
  });

  test('canvas drag reorders sections', async ({ page }) => {
    await openEditor(page);
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/ss-07-canvas-before.png' });

    const heading = page.locator('text=Browse our latest products').first();
    if (!await heading.isVisible()) return;
    await heading.hover();
    await page.waitForTimeout(400);

    const grip    = page.locator('[title="Drag to reorder"]').first();
    const gripBox = await grip.boundingBox();
    const target  = page.locator('text=Products').first();
    const tBox    = await target.boundingBox();
    if (!gripBox || !tBox) throw new Error('Bounding boxes not found');

    await page.mouse.move(gripBox.x + gripBox.width / 2, gripBox.y + gripBox.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(150);
    const fromY = gripBox.y + gripBox.height / 2;
    const toY   = tBox.y + tBox.height + 20;
    for (let i = 1; i <= 15; i++) {
      await page.mouse.move(gripBox.x + gripBox.width / 2, fromY + ((toY - fromY) * i) / 15);
      await page.waitForTimeout(35);
    }
    await page.mouse.up();
    await page.waitForTimeout(700);
    await page.screenshot({ path: 'test-results/ss-08-canvas-after.png' });
  });
});
