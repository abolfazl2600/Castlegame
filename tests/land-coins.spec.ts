import { expect, test, type Page } from '@playwright/test';
import { SAVE_KEY, SAVE_AUTOSAVE_KEY, SAVE_VERSION } from '../src/core/constants';

async function startGame(page: Page, saved?: { coins: number; ownedParcels: string[] }) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.addInitScript(({ marker, autosave, version, land }) => {
    const now = Date.now();
    localStorage.setItem(marker, '1');
    localStorage.setItem(autosave, JSON.stringify({
      metadata: {
        id: 'land-economy-browser', slot: 'autosave', name: 'Land Economy QA',
        createdAt: now, updatedAt: now, schemaVersion: version, gameMode: 'unified',
        summary: { buildings: 0, keeps: 0, terrainChanges: 0, elevations: 0 },
      },
      data: {
        version, gameMode: 'unified', mapLayoutId: 'mainland', worldSeed: 32,
        updatedAt: now, worldSeeded: true, cells: [], keeps: [], terrain: [], elevations: [],
        stoneStyle: 'limestone', ...(land ? { landEconomy: {
          version: 1, coins: land.coins, playedMsRemainder: 0, ownedParcels: land.ownedParcels,
        }} : {}),
      },
    }));
    localStorage.setItem('castle-role.settings.v2', JSON.stringify({
      schemaVersion: 2,
      gameplay: { tutorialCompleted: true, controlScheme: 'standard' },
      graphics: { quality: 'low', performanceMode: 'performance', environmentDetail: 'low',
        shadowsEnabled: false, effectsEnabled: false, debugMode: false },
      interface: { language: 'fa', reducedMotion: true, showHelp: false },
      audio: { muted: true, masterVolume: 0, musicEnabled: false, sfxEnabled: false },
    }));
  }, { marker: SAVE_KEY, autosave: SAVE_AUTOSAVE_KEY, version: SAVE_VERSION, land: saved });
  await page.goto('/Castlegame/?touchQA=1', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#toolbar [data-build-none]')).toHaveCount(1, { timeout: 45_000 });
  await expect(page.locator('#land-coin-hud')).toBeVisible();
}

test('legacy save starts with zero coins and half-map ownership', async ({ page }) => {
  test.setTimeout(90_000);
  await startGame(page);
  const state = await page.evaluate(() => {
    const qa = window as typeof window & { __castleTouchQA: () => {
      land: { coins: number; split: number; plots: { id: string; owned: boolean }[] }
    }};
    return qa.__castleTouchQA().land;
  });
  expect(state.coins).toBe(0);
  expect(state.split).toBe(12);
  expect(state.plots.length).toBeGreaterThan(0);
  expect(state.plots.every(plot => !plot.owned)).toBe(true);
  await page.locator('#land-coin-hud').click();
  await expect(page.locator('#land-parcel-dialog')).toBeVisible();
  await expect(page.locator('#land-parcel-dialog')).toContainText('۳۰');
  await page.locator('[data-land-parcel-close]').click();
  await expect(page.locator('#land-parcel-dialog')).toBeHidden();
});

test('purchased land and coins survive a save load; locked plot offers a confirmation', async ({ page }) => {
  test.setTimeout(90_000);
  await startGame(page, { coins: 20, ownedParcels: ['12,0'] });
  const initial = await page.evaluate(() => {
    const qa = window as typeof window & { __castleTouchQA: () => {
      land: { coins: number; plots: { id: string; owned: boolean }[] }
    }};
    return qa.__castleTouchQA().land;
  });
  expect(initial.coins).toBe(20);
  expect(initial.plots.some(plot => plot.id === '12,0' && plot.owned)).toBe(true);
  const target = await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('canvas');
    const probe = (window as typeof window & {
      __castleMoatProbe: (x: number, y: number) => { x: number; y: number } | null
    }).__castleMoatProbe;
    if (!canvas || !probe) return null;
    const r = canvas.getBoundingClientRect();
    for (let y = r.top + 65; y < r.bottom - 60; y += 22) {
      for (let x = r.left + 50; x < r.right - 50; x += 22) {
        const cell = probe(x, y);
        if (cell?.x !== undefined && cell.x >= 16 && cell.x < 23 && cell.y >= 4) {
          return { x, y, cell };
        }
      }
    }
    return null;
  });
  expect(target, 'A locked tile must be pickable from the visible map').not.toBeNull();
  if (!target) return;
  await page.evaluate(({ x, y }) => {
    const canvas = document.querySelector('canvas')!;
    canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 1, clientX: x, clientY: y }));
    canvas.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, pointerId: 1, clientX: x, clientY: y }));
  }, target);
  await expect(page.locator('#land-parcel-dialog')).toBeVisible();
  await expect(page.locator('[data-land-parcel-buy]')).toBeEnabled();
  await page.locator('[data-land-parcel-buy]').click();
  await expect(page.locator('#land-parcel-dialog')).toBeHidden();
  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).data.landEconomy,
    SAVE_AUTOSAVE_KEY);
  expect(saved.coins).toBe(10);
  expect(saved.ownedParcels.length).toBe(2);
  expect(saved.ownedParcels).toContain('12,0');
  const owned = await page.evaluate(() => {
    const qa = window as typeof window & { __castleTouchQA: () => {
      land: { coins: number; plots: { id: string; owned: boolean }[] }
    }};
    return qa.__castleTouchQA().land;
  });
  expect(owned.coins).toBe(10);
  expect(owned.plots.filter(plot => plot.owned)).toHaveLength(2);
});
