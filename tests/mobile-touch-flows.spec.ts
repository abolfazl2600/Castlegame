import { expect, test } from '@playwright/test';
import { SAVE_AUTOSAVE_KEY, SAVE_KEY, SAVE_VERSION } from '../src/core/constants';

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 360 });
  await page.addInitScript(({ autosaveKey, markerKey, version }) => {
    const now = Date.now();
    localStorage.setItem(markerKey, '1');
    localStorage.setItem(autosaveKey, JSON.stringify({
      metadata: { id: 'mobile-touch', slot: 'autosave', name: 'Mobile touch', createdAt: now, updatedAt: now,
        schemaVersion: version, gameMode: 'sandbox', summary: { buildings: 0, keeps: 0, terrainChanges: 0, elevations: 0 } },
      data: { version, gameMode: 'sandbox', updatedAt: now, cells: [], keeps: [], stoneStyle: 'limestone',
        towerBridges: [], terrain: [], elevations: [], worldSeeded: true },
    }));
  }, { autosaveKey: SAVE_AUTOSAVE_KEY, markerKey: SAVE_KEY, version: SAVE_VERSION });
  await page.goto('/Castlegame/');
  await expect(page.locator('#toolbar [data-build-none]')).toHaveCount(1, { timeout: 20_000 });
});

test('touch controls reach management, templates, and save/load without stacked panels', async ({ page }) => {
  const mobile = page.locator('.mobile-header');
  await expect(mobile.locator('[data-mobile-proxy="god-mode-button"]')).toBeVisible();
  await mobile.locator('[data-mobile-proxy="military-button"]').click();
  await expect(page.locator('#battle-panel')).toBeVisible();

  await mobile.locator('[data-mobile-proxy="god-mode-button"]').click();
  await expect(page.locator('#battle-panel')).toBeHidden();
  await expect(page.locator('#god-mode-panel')).toBeVisible();

  await mobile.locator('[data-mobile-proxy="battle-button"]').click();
  await expect(page.locator('#god-mode-panel')).toBeHidden();
  await expect(page.locator('#battle-panel')).toBeVisible();
  await page.locator('#battle-close').click();

  await mobile.locator('[data-mobile-action="templates"]').click();
  await expect(page.locator('#templates-modal')).toBeVisible();
  await page.locator('#templates-close-button').click();
  await mobile.locator('[data-mobile-action="save"]').click();
  await expect(page.locator('.save-load-backdrop')).toBeVisible();
  await expect(page.locator('#save-load-title')).toHaveText('Save Game');
  await page.locator('.save-load-backdrop [data-save-action="close"]').click();
  await mobile.locator('[data-mobile-action="load"]').click();
  await expect(page.locator('#save-load-title')).toHaveText('Load Game');
});


test('phone layout keeps 3D but omits Plan, 45°, Top and Fullscreen actions', async ({ page }) => {
  await expect(page.locator('html')).toHaveClass(/mobile-ui-active/);
  const dock = page.locator('.mobile-bottom-dock');
  await expect(dock.locator('button')).toHaveCount(3);
  await expect(dock.locator('[data-mobile-proxy="toolbar-open"]')).toBeVisible();
  await expect(dock.locator('[data-mobile-proxy="view-3d-button"]')).toBeVisible();
  await expect(dock.locator('[data-mobile-proxy="settings-button"]')).toBeVisible();

  for (const id of ['view-2d-button', 'camera-45-button', 'camera-top-button', 'fullscreen-button']) {
    await expect(page.locator(`[data-mobile-proxy="${id}"]`)).toHaveCount(0);
    await expect(page.locator(`#${id}`)).toBeHidden();
  }
});

test('desktop retains its original camera and fullscreen controls', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.locator('html')).not.toHaveClass(/mobile-ui-active/);
  await expect(page.locator('#view-2d-button')).toBeVisible();
  await expect(page.locator('#view-3d-button')).toBeVisible();
  await expect(page.locator('#camera-45-button')).toBeVisible();
  await expect(page.locator('#camera-top-button')).toBeVisible();
  await expect(page.locator('#fullscreen-button')).toBeVisible();
});

test.describe('Android landscape', () => {
  test.use({ hasTouch: true, isMobile: true });

  test('wide short touch screen hides four desktop-only controls', async ({ page }) => {
    await page.setViewportSize({ width: 915, height: 412 });
    await expect(page.locator('html')).toHaveClass(/mobile-ui-active/);
    await expect(page.locator('.mobile-bottom-dock button')).toHaveCount(3);
    await expect(page.locator('.mobile-bottom-dock [data-mobile-proxy="view-3d-button"]')).toBeVisible();
    for (const id of ['view-2d-button', 'camera-45-button', 'camera-top-button', 'fullscreen-button']) {
      await expect(page.locator(`#${id}`)).toBeHidden();
      await expect(page.locator(`[data-mobile-proxy="${id}"]`)).toHaveCount(0);
    }
  });
});
