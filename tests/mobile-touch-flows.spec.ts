import { expect, test } from '@playwright/test';
import { SAVE_AUTOSAVE_KEY, SAVE_KEY, SAVE_VERSION } from '../src/core/constants';

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 360 });
  await page.addInitScript(({ autosaveKey, markerKey, version }) => {
    const now = Date.now();
    localStorage.setItem(markerKey, '1');
    // Keep baseline interaction assertions in English; Persian UI has its own RTL suite.
    localStorage.setItem('castle-role.settings.v2', JSON.stringify({ schemaVersion: 2, interface: { language: 'en' } }));
    localStorage.setItem(autosaveKey, JSON.stringify({
      metadata: { id: 'mobile-touch', slot: 'autosave', name: 'Mobile touch', createdAt: now, updatedAt: now,
        schemaVersion: version, gameMode: 'unified', summary: { buildings: 0, keeps: 0, terrainChanges: 0, elevations: 0 } },
      data: { version, gameMode: 'unified', updatedAt: now, cells: [], keeps: [], stoneStyle: 'limestone',
        towerBridges: [], terrain: [], elevations: [], worldSeeded: true },
    }));
  }, { autosaveKey: SAVE_AUTOSAVE_KEY, markerKey: SAVE_KEY, version: SAVE_VERSION });
  await page.goto('/Castlegame/');
  await expect(page.locator('#toolbar [data-build-none]')).toHaveCount(1, { timeout: 20_000 });
});

test('touch controls reach management, templates, and save/load without stacked panels', async ({ page }) => {
  const mobile = page.locator('.mobile-header');
  await expect(mobile.locator('[data-mobile-proxy="god-mode-button"]')).toBeVisible();
  await mobile.locator('[data-mobile-proxy="battle-button"]').click();
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


test('phone header exposes Build while omitting redundant 3D and desktop-only actions', async ({ page }) => {
  await expect(page.locator('html')).toHaveClass(/mobile-ui-active/);
  await expect(page.locator('.mobile-bottom-dock')).toHaveCount(0);
  await expect(page.locator('.mobile-header [data-mobile-proxy="toolbar-open"]')).toBeVisible();
  await expect(page.locator('[data-mobile-proxy="view-3d-button"]')).toHaveCount(0);
  await expect(page.locator('.mobile-bottom-dock [data-mobile-proxy="settings-button"]')).toHaveCount(0);
  await expect(page.locator('.mobile-header [data-mobile-proxy="settings-button"]')).toBeVisible();

  await page.locator('.mobile-header [data-mobile-proxy="settings-button"]').click();
  await expect(page.locator('#settings-modal')).toBeVisible();
  await page.locator('#settings-close').click();
  await expect(page.locator('#settings-modal')).toBeHidden();

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

  test('landscape touch header keeps Build and hides four desktop-only controls', async ({ page }) => {
    await page.setViewportSize({ width: 915, height: 412 });
    await expect(page.locator('html')).toHaveClass(/mobile-ui-active/);
    await expect(page.locator('.mobile-bottom-dock')).toHaveCount(0);
    await expect(page.locator('.mobile-header [data-mobile-proxy="toolbar-open"]')).toBeVisible();
    for (const id of ['view-2d-button', 'camera-45-button', 'camera-top-button', 'fullscreen-button']) {
      await expect(page.locator(`#${id}`)).toBeHidden();
      await expect(page.locator(`[data-mobile-proxy="${id}"]`)).toHaveCount(0);
    }
  });

  test('active battle panel stays dismissible and compact in landscape', async ({ page }) => {
    await page.setViewportSize({ width: 915, height: 412 });

    const panel = page.locator('#battle-panel');
    await page.locator('.mobile-header [data-mobile-proxy="battle-button"]').click();
    await expect(panel).toBeVisible();

    const panelBox = await panel.boundingBox();
    expect(panelBox).not.toBeNull();
    expect(panelBox!.width).toBeLessThan(420);

    await page.locator('#battle-start').click();
    await expect(panel).toHaveAttribute('data-battle-phase', /running|paused|finished/);
    await expect(panel.locator('.battle-armies')).toBeHidden();

    await page.locator('#battle-close').click();
    await expect(panel).toBeHidden();

    // Battle status callbacks continue while combat is active; they must not reopen the panel.
    await page.waitForTimeout(250);
    await expect(panel).toBeHidden();
  });
});
