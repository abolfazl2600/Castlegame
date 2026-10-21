import { expect, test, type Page } from '@playwright/test';
import { SAVE_KEY } from '../src/core/constants';

test.use({ hasTouch: true, isMobile: true });

async function load(page: Page, width: number, height: number): Promise<void> {
  await page.setViewportSize({ width, height });
  await page.addInitScript((key) => {
    localStorage.setItem(key, '1');
    localStorage.setItem('castle-role.settings.v2', JSON.stringify({
      schemaVersion: 2, interface: { language: 'en' },
      graphics: { quality: 'low', shadowsEnabled: false, effectsEnabled: false },
      audio: { muted: true, musicEnabled: false, sfxEnabled: false },
    }));
  }, SAVE_KEY);
  await page.goto('/Castlegame/?touchQA=1', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#game canvas')).toBeVisible({ timeout: 30_000 });
}

test('portrait touch screen becomes a full-screen rotated landscape canvas and HUD', async ({ page }) => {
  await load(page, 390, 844);
  await expect(page.locator('html')).toHaveAttribute('data-game-orientation', 'software-landscape');

  const geometry = await page.evaluate(() => {
    const body = document.body.getBoundingClientRect();
    const canvas = document.querySelector('#game canvas')!.getBoundingClientRect();
    const header = document.querySelector('.mobile-header')!.getBoundingClientRect();
    return {
      logicalWidth: Number.parseFloat(document.documentElement.style.getPropertyValue('--game-logical-width')),
      logicalHeight: Number.parseFloat(document.documentElement.style.getPropertyValue('--game-logical-height')),
      body: { x: body.x, y: body.y, width: body.width, height: body.height },
      canvas: { x: canvas.x, y: canvas.y, width: canvas.width, height: canvas.height },
      header: { x: header.x, y: header.y, width: header.width, height: header.height },
    };
  });
  expect(geometry.logicalWidth).toBe(844);
  expect(geometry.logicalHeight).toBe(390);
  for (const rect of [geometry.body, geometry.canvas]) {
    expect(rect.x).toBeGreaterThanOrEqual(-2);
    expect(rect.y).toBeGreaterThanOrEqual(-2);
    expect(rect.x + rect.width).toBeGreaterThanOrEqual(388);
    expect(rect.y + rect.height).toBeGreaterThanOrEqual(842);
    expect(rect.x + rect.width).toBeLessThanOrEqual(392);
    expect(rect.y + rect.height).toBeLessThanOrEqual(846);
  }
  expect(geometry.header.height).toBeGreaterThan(390);

  // In portrait, coin and minimap use a rotated body. Their physical
  // bounding boxes must still stay separated, not cover one another.
  const coin = page.locator('#land-coin-hud');
  await expect(coin).toBeVisible();
  await expect.poll(() => page.evaluate(() => {
    const map = document.getElementById('minimap')?.getBoundingClientRect();
    const token = document.getElementById('land-coin-hud')?.getBoundingClientRect();
    return map && token ? map.left - token.right : -1;
  })).toBeGreaterThanOrEqual(10);
  await page.locator('.mobile-header [data-mobile-proxy="settings-button"]').click();
  await expect(page.locator('#settings-modal')).toBeVisible();
  const modal = await page.locator('#settings-modal').boundingBox();
  expect(modal).not.toBeNull();
  expect(modal!.x).toBeGreaterThanOrEqual(-2);
  expect(modal!.y).toBeGreaterThanOrEqual(-2);
  expect(modal!.x + modal!.width).toBeLessThanOrEqual(392);
  expect(modal!.y + modal!.height).toBeLessThanOrEqual(846);
  await page.locator('#settings-close').click();
  await expect(page.locator('#settings-modal')).toBeHidden();
});

test('live device rotation swaps logical axes and restores natural landscape', async ({ page }) => {
  await load(page, 412, 915);
  await expect(page.locator('html')).toHaveAttribute('data-game-orientation', 'software-landscape');
  await page.setViewportSize({ width: 915, height: 412 });
  await expect(page.locator('html')).toHaveAttribute('data-game-orientation', 'natural-landscape');
  await expect.poll(() => page.locator('#game canvas').evaluate(el => {
    const r = el.getBoundingClientRect();
    return [Math.round(r.width), Math.round(r.height)];
  })).toEqual([915, 412]);
  await page.setViewportSize({ width: 412, height: 915 });
  await expect(page.locator('html')).toHaveAttribute('data-game-orientation', 'software-landscape');
  await expect.poll(() => page.locator('#game canvas').evaluate(el => {
    const r = el.getBoundingClientRect();
    return [Math.round(r.width), Math.round(r.height)];
  })).toEqual([412, 915]);
});
