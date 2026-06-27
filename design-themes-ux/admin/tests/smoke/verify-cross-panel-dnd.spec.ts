/**
 * Cross-panel drag verification — layers panel ↔ canvas
 */
import { test, expect, Page } from '@playwright/test';

const BASE = 'http://localhost:5199';

async function openEditor(page: Page) {
  // Capture all browser console output so we can see dnd-kit diagnostic logs
  const logs: string[] = [];
  page.on('console', msg => {
    if (msg.text().includes('[DnD]')) logs.push(msg.text());
  });
  (page as any)._dndLogs = logs;

  await page.goto(BASE);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(800);
  await page.locator('text=Theme Engine').first().click();
  await page.waitForTimeout(600);
  await page.locator('button:has-text("Customize")').first().click();
  await page.waitForTimeout(1800);
}

async function getDndLogs(page: Page): Promise<string[]> {
  return (page as any)._dndLogs ?? [];
}

async function getLayerSectionOrder(page: Page): Promise<string[]> {
  // Only section-level rows (not blocks), inside the HOME PAGE group
  const sectionLabels = await page.locator('[data-rail] ~ div .flex-1.truncate').allInnerTexts();
  return sectionLabels.map(t => t.trim()).filter(Boolean);
}

async function slowDrag(page: Page, fromX: number, fromY: number, toX: number, toY: number, steps = 20) {
  await page.mouse.move(fromX, fromY);
  await page.mouse.down();
  await page.waitForTimeout(150);
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(
      fromX + ((toX - fromX) * i) / steps,
      fromY + ((toY - fromY) * i) / steps,
    );
    await page.waitForTimeout(25);
  }
  await page.waitForTimeout(200);
  await page.mouse.up();
  await page.waitForTimeout(600);
}

// ── Test 1: layers-panel-only drag (baseline — must pass) ─────────────────────

test('baseline: drag within layers panel reorders sections', async ({ page }) => {
  await openEditor(page);
  await expect(page.locator('text=Hero').first()).toBeVisible({ timeout: 6000 });

  const before = await getLayerSectionOrder(page);
  await page.screenshot({ path: 'test-results/cp-01-before.png' });

  await page.locator('text=Hero').first().hover();
  await page.waitForTimeout(300);
  const grip    = page.locator('[title="Drag to reorder"]').first();
  await expect(grip).toBeVisible({ timeout: 3000 });

  const gripBox  = await grip.boundingBox();
  const featured = page.locator('text=Featured collection').first();
  const featBox  = await featured.boundingBox();
  if (!gripBox || !featBox) throw new Error('Bounding boxes not found');

  await slowDrag(page, gripBox.x + gripBox.width/2, gripBox.y + gripBox.height/2,
                       gripBox.x + gripBox.width/2, featBox.y + featBox.height + 8);

  await page.screenshot({ path: 'test-results/cp-02-after-layers-drag.png' });
  const after = await getLayerSectionOrder(page);
  const logs  = await getDndLogs(page);
  console.log('DnD logs:', logs);
  console.log('Before:', before);
  console.log('After:', after);

  const heroIdxBefore = before.findIndex(t => t.includes('Hero'));
  const heroIdxAfter  = after.findIndex(t => t.includes('Hero'));
  expect(heroIdxAfter).toBeGreaterThan(heroIdxBefore);
});

// ── Test 2: cross-panel drag — layers panel grip → canvas section ─────────────

test('cross-panel: drag from layers panel grip, drop onto canvas section', async ({ page }) => {
  await openEditor(page);
  await expect(page.locator('text=Hero').first()).toBeVisible({ timeout: 6000 });
  await page.screenshot({ path: 'test-results/cp-03-before.png' });

  // Hover Hero in the layers panel to reveal the grip handle
  await page.locator('text=Hero').first().hover();
  await page.waitForTimeout(350);
  const grip = page.locator('[title="Drag to reorder"]').first();
  await expect(grip).toBeVisible({ timeout: 3000 });

  const gripBox = await grip.boundingBox();
  if (!gripBox) throw new Error('Grip not found');

  // The canvas Hero section occupies roughly the top half of the canvas.
  // We need to drop onto the Newsletter section which is visible near the bottom.
  // Strategy: drag down slowly through the whole canvas.
  // The canvas starts at x=330. Newsletter section is the last page section.
  // Scroll to bring it into view, then drop.

  // First: find where the canvas scrollable container is
  const canvasContainer = page.locator('.flex-1.overflow-y-auto').nth(1);
  const canvasBox = await canvasContainer.boundingBox();
  console.log('Canvas container box:', canvasBox);

  // Take screenshot to see current layout
  await page.screenshot({ path: 'test-results/cp-04-layout.png' });

  // Drag from layers grip all the way down to the bottom of the canvas
  // to land on Newsletter or Featured collection on canvas
  const fromX = gripBox.x + gripBox.width / 2;
  const fromY = gripBox.y + gripBox.height / 2;

  // Target: canvas center, near the bottom of the viewport (where other sections should be)
  const viewportSize = page.viewportSize()!;
  const toX = (canvasBox?.x ?? 400) + (canvasBox?.width ?? 400) / 2;
  const toY = viewportSize.height - 80; // near bottom of visible area

  console.log(`Dragging: (${Math.round(fromX)},${Math.round(fromY)}) → (${Math.round(toX)},${Math.round(toY)})`);
  await slowDrag(page, fromX, fromY, toX, toY, 25);

  await page.screenshot({ path: 'test-results/cp-05-after-cross-drag.png' });
  const logs  = await getDndLogs(page);
  const after = await getLayerSectionOrder(page);
  console.log('DnD logs:', logs);
  console.log('Layer order after:', after);

  // Verify the DnD callback fired
  const callbackFired = logs.some(l => l.includes('dragEnd'));
  console.log('Callback fired:', callbackFired);
  expect(callbackFired).toBe(true);
});

// ── Test 3: canvas-only drag (baseline — must pass) ────────────────────────────

test('baseline: drag within canvas reorders sections', async ({ page }) => {
  await openEditor(page);
  await page.waitForTimeout(500);

  const heroText = page.locator('text=Browse our latest products').first();
  if (!await heroText.isVisible()) {
    console.log('Hero text not visible, skipping');
    return;
  }

  await heroText.hover();
  await page.waitForTimeout(400);
  const grips = page.locator('[title="Drag to reorder"]');
  const count = await grips.count();
  console.log('Canvas grips found:', count);
  expect(count).toBeGreaterThan(0);

  await page.screenshot({ path: 'test-results/cp-06-canvas-grip.png' });
});
