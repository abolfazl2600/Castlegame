import { expect, test, type Page } from '@playwright/test';
import * as THREE from 'three';
import { SAVE_AUTOSAVE_KEY, SAVE_KEY, SAVE_VERSION } from '../src/core/constants';
import { createTajMahalLandmark } from '../src/rendering/TajMahalLandmark';
import { normalizeMapLayoutId, terrainForMapLayout } from '../src/world/MapLayouts';
import { worldGridForLayout } from '../src/world/WorldGrid';

async function openGame(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.addInitScript(({ marker, autosave, version }) => {
    const now = Date.now();
    localStorage.setItem(marker, '1');
    localStorage.setItem(autosave, JSON.stringify({
      metadata: {
        id: 'taj-mahal-qa', slot: 'autosave', name: 'Taj Mahal QA',
        createdAt: now, updatedAt: now, schemaVersion: version, gameMode: 'unified',
        summary: { buildings: 0, keeps: 0, terrainChanges: 0, elevations: 0 },
      },
      data: {
        version, gameMode: 'unified', mapLayoutId: 'island', worldSeed: 0,
        updatedAt: now, worldSeeded: true, cells: [], keeps: [], towerBridges: [],
        terrain: [], elevations: [], stoneStyle: 'limestone',
      },
    }));
    localStorage.setItem('castle-role.settings.v2', JSON.stringify({
      schemaVersion: 2,
      gameplay: { tutorialCompleted: true, controlScheme: 'standard' },
      graphics: { quality: 'low', performanceMode: 'performance', environmentDetail: 'low',
        shadowsEnabled: false, effectsEnabled: false, debugMode: false },
      interface: { language: 'en', reducedMotion: true, showHelp: false },
      audio: { muted: true, masterVolume: 0, musicEnabled: false, sfxEnabled: false },
    }));
  }, { marker: SAVE_KEY, autosave: SAVE_AUTOSAVE_KEY, version: SAVE_VERSION });

  await page.goto('/Castlegame/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#toolbar [data-build-none]')).toHaveCount(1, { timeout: 45_000 });
}

test('Taj Mahal layout is registered as a persistent symmetric riverfront world', () => {
  const grid = worldGridForLayout('taj-mahal');
  expect(grid.cols).toBe(25);
  expect(grid.rows).toBe(25);
  expect(normalizeMapLayoutId('taj-mahal')).toBe('taj-mahal');
  for (let x = 0; x < grid.cols; x++) {
    expect(terrainForMapLayout('taj-mahal', x, 0, grid)).toBe('river');
    expect(terrainForMapLayout('taj-mahal', x, 2, grid)).toBe('river');
    expect(terrainForMapLayout('taj-mahal', x, 3, grid)).toBe('shore');
  }
  for (let y = 4; y < grid.rows - 1; y++) {
    for (let x = 1; x < grid.cols - 1; x++) {
      expect(terrainForMapLayout('taj-mahal', x, y, grid)).toBe('plains');
    }
  }
});

test('authored 3D architecture includes domes and a complete garden footprint', () => {
  const landmark = createTajMahalLandmark();
  expect(landmark.userData.historicLandmark).toBe('taj-mahal');
  expect(landmark.children.length).toBeGreaterThan(120);
  const domes = landmark.children.filter(child =>
    child instanceof THREE.Mesh && child.geometry instanceof THREE.LatheGeometry);
  expect(domes.length).toBeGreaterThanOrEqual(11);
  const bounds = new THREE.Box3().setFromObject(landmark);
  expect(bounds.min.x).toBeLessThan(-40);
  expect(bounds.max.x).toBeGreaterThan(40);
  expect(bounds.min.z).toBeLessThan(-39);
  expect(bounds.max.z).toBeGreaterThan(39);
  expect(bounds.max.y).toBeGreaterThan(24);
});

test('new Taj Mahal prepared world loads, persists, and reopens after reload', async ({ page }, info) => {
  test.setTimeout(120_000);
  await openGame(page);
  // This is a hidden bridge used by Settings > Game Actions.
  // Invoke its registered action, as the existing urban-city browser test does.
  await page.locator('#templates-button').evaluate(
    element => (element as HTMLButtonElement).click(),
  );
  await expect(page.locator('#templates-modal')).toBeVisible();
  const card = page.locator('[data-template="taj-mahal"]');
  await expect(card).toBeVisible();
  await card.click();
  const read = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)!).data, SAVE_AUTOSAVE_KEY);
  await expect.poll(async () => (await read()).mapLayoutId).toBe('taj-mahal');
  const state = await read();
  expect(state.worldSeed).toBe(1632);
  expect(state.stoneStyle).toBe('whitePlaster');
  expect(state.cells).toEqual(expect.arrayContaining([
    expect.objectContaining({ x: 5, y: 20, kind: 'stoneRoad' }),
    expect.objectContaining({ x: 19, y: 22, kind: 'stoneRoad' }),
  ]));
  await expect(page.locator('#templates-modal')).toBeHidden();
  await expect(page.locator('#game-canvas')).toBeVisible();
  await page.screenshot({ path: info.outputPath('taj-mahal-world.png'), fullPage: false });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('#game-canvas')).toBeVisible({ timeout: 45_000 });
  const restored = await read();
  expect(restored.mapLayoutId).toBe('taj-mahal');
  expect(restored.worldSeed).toBe(1632);
  expect(restored.cells.length).toBe(state.cells.length);
});
