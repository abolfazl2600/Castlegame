import { expect, test, type Page } from '@playwright/test';

const APP_PATH = '/Castlegame/';

async function loadTouchApp(page: Page): Promise<void> {
  await page.addInitScript(() => localStorage.setItem('castle-role.settings.v2', JSON.stringify({
    schemaVersion: 2,
    interface: { language: 'en' },
    gameplay: { controlScheme: 'touch' },
  })));
  await page.goto(APP_PATH, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#game canvas')).toHaveCount(1, { timeout: 20_000 });
  await expect(page.locator('html')).toHaveClass(/mobile-ui-active/);
}

async function applyInsets(
  page: Page,
  insets: { top: number; right: number; bottom: number; left: number },
): Promise<void> {
  await page.evaluate((value) => {
    const root = document.documentElement;
    root.style.setProperty('--safe-area-top', String(value.top) + 'px');
    root.style.setProperty('--safe-area-right', String(value.right) + 'px');
    root.style.setProperty('--safe-area-bottom', String(value.bottom) + 'px');
    root.style.setProperty('--safe-area-left', String(value.left) + 'px');
  }, insets);
}

async function expectEdgeUiInsideSafeArea(
  page: Page,
  insets: { top: number; right: number; bottom: number; left: number },
): Promise<void> {
  const values = await page.locator('.mobile-header').evaluate((header) => {
    const style = getComputedStyle(header);
    const minimap = document.querySelector<HTMLElement>('.minimap');
    const mini = minimap?.getBoundingClientRect();
    return {
      paddingTop: Number.parseFloat(style.paddingTop),
      paddingRight: Number.parseFloat(style.paddingRight),
      paddingLeft: Number.parseFloat(style.paddingLeft),
      minimapLeft: mini?.left ?? 0,
      viewportWidth: innerWidth,
      minimapRight: mini?.right ?? 0,
    };
  });

  expect(values.paddingTop).toBeGreaterThanOrEqual(insets.top);
  expect(values.paddingLeft).toBeGreaterThanOrEqual(Math.max(8, insets.left));
  expect(values.paddingRight).toBeGreaterThanOrEqual(Math.max(8, insets.right));
  expect(values.minimapLeft).toBeGreaterThanOrEqual(insets.left);
  expect(values.minimapRight).toBeLessThanOrEqual(values.viewportWidth - insets.right + 0.5);
}

test.describe('Android safe-area layout', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 915, height: 412 } });

  test('left landscape notch keeps edge UI reachable', async ({ page }) => {
    await loadTouchApp(page);
    const safe = { top: 0, right: 0, bottom: 24, left: 52 };
    await applyInsets(page, safe);
    await expectEdgeUiInsideSafeArea(page, safe);

    await page.locator('[data-mobile-proxy="toolbar-open"]').click();
    const toolbar = await page.locator('.toolbar').boundingBox();
    expect(toolbar).not.toBeNull();
    expect(toolbar!.x).toBeGreaterThanOrEqual(safe.left);
    expect(toolbar!.y + toolbar!.height).toBeLessThanOrEqual(412 - safe.bottom + 0.5);
  });

  test('right landscape notch keeps battle controls inside the tappable region', async ({ page }) => {
    await loadTouchApp(page);
    const safe = { top: 0, right: 52, bottom: 24, left: 0 };
    await applyInsets(page, safe);
    await expectEdgeUiInsideSafeArea(page, safe);

    await page.locator('[data-mobile-proxy="battle-button"]').click();
    const panel = page.locator('.battle-panel:not([hidden])');
    await expect(panel).toBeVisible();
    const box = await panel.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x + box!.width).toBeLessThanOrEqual(915 - safe.right + 0.5);
    expect(box!.y + box!.height).toBeLessThanOrEqual(412 - safe.bottom + 0.5);
  });

  test('centered cutout and bottom gesture inset keep Settings close reachable', async ({ page }) => {
    await loadTouchApp(page);
    const safe = { top: 34, right: 0, bottom: 28, left: 0 };
    await applyInsets(page, safe);
    await expectEdgeUiInsideSafeArea(page, safe);

    await page.locator('[data-mobile-proxy="settings-button"]').click();
    const close = page.locator('#settings-close');
    await expect(close).toBeVisible();
    const closeBox = await close.boundingBox();
    expect(closeBox).not.toBeNull();
    expect(closeBox!.y).toBeGreaterThanOrEqual(safe.top);
  });
});
