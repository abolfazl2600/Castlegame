import { expect, test } from '@playwright/test';
import { SAVE_AUTOSAVE_KEY, SAVE_KEY, SAVE_VERSION } from '../src/core/constants';

// A saved empty world skips the first-launch mode modal and exercises the live renderer.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(({ autosaveKey, markerKey, version }) => {
    const now = Date.now();
    localStorage.setItem(markerKey, '1');
    localStorage.setItem(autosaveKey, JSON.stringify({
      metadata: { id: 'visual-test', slot: 'autosave', name: 'Visual test', createdAt: now, updatedAt: now,
        schemaVersion: version, gameMode: 'medieval', summary: { buildings: 0, keeps: 0, terrainChanges: 0, elevations: 0 } },
      data: { version, gameMode: 'medieval', updatedAt: now, cells: [], keeps: [], stoneStyle: 'limestone',
        towerBridges: [], terrain: [], elevations: [], worldSeeded: true },
    }));
  }, { autosaveKey: SAVE_AUTOSAVE_KEY, markerKey: SAVE_KEY, version: SAVE_VERSION });
});

test('world map renders terrain and moves camera on click', async ({ page }) => {
  await page.goto('/Castlegame/');
  await expect(page.locator('#toolbar [data-build-none]')).toHaveCount(1);
  const map = page.locator('#minimap-canvas');
  await expect(map).toBeVisible();
  const distinctColors = await map.evaluate((canvas) => {
    const context = (canvas as HTMLCanvasElement).getContext('2d');
    if (!context) return 0;
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    const colors = new Set<string>();
    for (let i = 0; i < data.length; i += 4) colors.add(`${data[i]},${data[i + 1]},${data[i + 2]}`);
    return colors.size;
  });
  expect(distinctColors).toBeGreaterThan(2);
  await map.click({ position: { x: 32, y: 32 } });
  await expect(page.locator('.minimap-hint')).toContainText('Viewing sector');
});

test('keyboard moves the map cursor and Enter navigates to that sector', async ({ page }) => {
  await page.goto('/Castlegame/');
  await expect(page.locator('#toolbar [data-build-none]')).toHaveCount(1);
  const map = page.locator('#minimap');
  await map.focus();
  await map.press('ArrowRight');
  await expect(map).toHaveAttribute('aria-label', /Map sector 13, 12; press Enter/);
  await map.press('Enter');
  await expect(page.locator('.minimap-hint')).toHaveText('Viewing sector 13, 12');
});

test('mobile map stays available with touch-sized build controls', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/Castlegame/');
  await expect(page.locator('#minimap')).toBeVisible();
  await page.locator('[data-mobile-proxy="toolbar-open"]').click();
  await expect(page.locator('#toolbar')).not.toHaveClass(/is-collapsed/);
  const close = page.locator('#toolbar-close');
  const box = await close.boundingBox();
  expect(box?.height).toBeGreaterThanOrEqual(44);
});

for (const viewport of [{ width: 640, height: 360 }, { width: 390, height: 844 }]) {
  test(`Build keeps the map visible at ${viewport.width}×${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/Castlegame/');
    await expect(page.locator('#toolbar [data-build-none]')).toHaveCount(1);

    const opener = page.locator('[data-mobile-proxy="toolbar-open"]');
    await opener.click();
    await expect(opener).toHaveAttribute('aria-expanded', 'true');
    const panel = await page.locator('#toolbar').boundingBox();
    expect(panel).not.toBeNull();
    if (viewport.width > viewport.height) {
      expect(panel!.x + panel!.width).toBeLessThan(viewport.width * 0.55);
      expect(panel!.height).toBeLessThan(viewport.height - 90);
    } else {
      expect(panel!.y).toBeGreaterThan(viewport.height * 0.5);
      expect(panel!.height).toBeLessThan(viewport.height * 0.45);
    }

    const tabs = page.locator('#toolbar .build-category-tabs');
    const stats = page.locator('#toolbar .build-world-summary');
    expect(await tabs.evaluate((element) => Number(getComputedStyle(element).order) || 0))
      .toBeLessThan(await stats.evaluate((element) => Number(getComputedStyle(element).order)));

    await page.locator('#toolbar [data-tool]:visible').first().click();
    await expect(page.locator('#toolbar')).toHaveClass(/is-collapsed/);
    await expect(opener).toHaveAttribute('aria-expanded', 'false');
  });
}
