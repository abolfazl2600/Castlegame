import { expect, test, type Page } from '@playwright/test';

const APP_PATH = '/Castlegame/';

async function loadGame(page: Page): Promise<void> {
  await page.goto(APP_PATH, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#economy-hud')).toHaveCount(1, { timeout: 30_000 });
  await expect(page.locator('#toolbar [data-build-none]')).toHaveCount(1);

  const chooser = page.locator('#templates-modal');
  if (await chooser.isVisible()) {
    await page.locator('#starting-map-layout-grid [data-map-layout]').first().click();
    await expect(chooser).toBeHidden();
  }
}

const overlaps = (
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean => a.x < b.x + b.width && a.x + a.width > b.x
  && a.y < b.y + b.height && a.y + a.height > b.y;

test.describe('desktop build and economy HUD', () => {
  test.use({ viewport: { width: 1366, height: 900 } });

  test('builder, minimap, and economy are non-overlapping at laptop and desktop sizes', async ({ page }) => {
    await loadGame(page);

    for (const size of [
      { width: 1366, height: 900 },
      { width: 1024, height: 768 },
      { width: 820, height: 720 },
    ]) {
      await page.setViewportSize(size);
      await expect(page.locator('html')).not.toHaveClass(/mobile-ui-active/);
      const build = await page.locator('#toolbar').boundingBox();
      const map = await page.locator('#minimap').boundingBox();
      const economy = await page.locator('#economy-hud').boundingBox();
      expect(build).not.toBeNull();
      expect(map).not.toBeNull();
      expect(economy).not.toBeNull();
      expect(overlaps(build!, map!), 'Build must not cover minimap').toBe(false);
      expect(overlaps(build!, economy!), 'Build must not cover economy').toBe(false);
      expect(overlaps(map!, economy!), 'Minimap must not cover economy').toBe(false);
      expect(economy!.y + economy!.height).toBeLessThanOrEqual(size.height + 0.5);
    }

    const typeSizes = await page.evaluate(() => {
      const px = (selector: string): number => {
        const node = document.querySelector(selector);
        if (!node) return 0;
        return Number.parseFloat(getComputedStyle(node).fontSize);
      };
      return {
        tool: px('.tool-copy strong'),
        toolDescription: px('.tool-copy small'),
        category: px('.build-category-tab strong'),
        resource: px('.economy-hud .build-resource-stat b'),
      };
    });
    expect(typeSizes.tool).toBeGreaterThanOrEqual(13);
    expect(typeSizes.toolDescription).toBeGreaterThanOrEqual(11);
    expect(typeSizes.category).toBeGreaterThanOrEqual(12);
    expect(typeSizes.resource).toBeGreaterThanOrEqual(12);
  });

  test('economy stays visible when Build closes and shares live counters with touch layout', async ({ page }) => {
    await loadGame(page);
    for (const id of ['city-population', 'military-population', 'economy-wood', 'economy-food']) {
      await expect(page.locator('#' + id)).toHaveCount(1);
    }

    await page.locator('#toolbar-close').click();
    await expect(page.locator('#toolbar')).toHaveClass(/is-collapsed/);
    await expect(page.locator('#economy-hud')).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('html')).toHaveClass(/mobile-ui-active/);
    await expect.poll(async () => page.locator('#economy-hud').evaluate((node) =>
      node.closest('#toolbar') !== null)).toBe(true);
    await expect(page.locator('.economy-hud-workforce')).toHaveAttribute('open', '');

    await page.setViewportSize({ width: 1366, height: 900 });
    await expect(page.locator('html')).not.toHaveClass(/mobile-ui-active/);
    await expect.poll(async () => page.locator('#economy-hud').evaluate((node) =>
      node.parentElement?.id === 'game-shell')).toBe(true);
    await expect(page.locator('#economy-hud')).toBeVisible();
  });
});
