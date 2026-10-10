import { expect, test, type Page } from '@playwright/test';
import { SAVE_AUTOSAVE_KEY, SAVE_KEY, SAVE_VERSION } from '../src/core/constants';

const elevatedNaturalRiver = { x: 34, y: 44 };
const land = { x: 25, y: 44 };
const legacyCarvedRiver = { x: 24, y: 44 };
const authoredHighRiver = { x: 34, y: 45 };

test.use({ viewport: { width: 1280, height: 720 } });

async function openFixture(page: Page): Promise<void> {
  const now = 1700000000000;
  await page.addInitScript(({ markerKey, autosaveKey, version, when }) => {
    localStorage.setItem(markerKey, '1');
    localStorage.setItem('castle-role.settings.v2', JSON.stringify({
      schemaVersion: 2,
      gameplay: { controlScheme: 'standard', tutorialCompleted: true },
      graphics: { quality: 'low', performanceMode: 'performance',
        environmentDetail: 'low', effectsEnabled: false, shadowsEnabled: false },
      interface: { language: 'en', showHelp: false, reducedMotion: true },
      audio: { muted: true, masterVolume: 0 },
    }));
    if (!localStorage.getItem(autosaveKey)) localStorage.setItem(autosaveKey, JSON.stringify({
      metadata: {
        id: 'river-307', slot: 'autosave', name: 'River elevation QA',
        createdAt: when, updatedAt: when, schemaVersion: version, gameMode: 'unified',
        summary: { buildings: 0, keeps: 0, terrainChanges: 2, elevations: 3 },
      },
      data: {
        version, gameMode: 'unified', mapLayoutId: 'royal-valley-50x89',
        worldSeed: 307, worldSeeded: true, updatedAt: when,
        cells: [], keeps: [], towerBridges: [], stoneStyle: 'limestone',
        terrain: [
          { x: 34, y: 44, kind: 'plains' },
          { x: 24, y: 44, kind: 'river' },
        ],
        elevations: [
          { x: 34, y: 44, value: 1.6 },
          { x: 24, y: 44, value: -1.1 },
          { x: 34, y: 45, value: 0.85 },
        ],
      },
    }));
  }, { markerKey: SAVE_KEY, autosaveKey: SAVE_AUTOSAVE_KEY,
    version: SAVE_VERSION, when: now });
  await page.goto('/Castlegame/?visualBaseline=1&touchQA=1', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#toolbar [data-build-none]')).toHaveCount(1, { timeout: 60_000 });
  await page.waitForFunction(() =>
    typeof (window as any).__castleTouchQA === 'function' &&
    typeof (window as any).__castleVisualGridPoint === 'function',
  );
  await page.evaluate(() => (window as any).__castleVisualCamera({
    x: 90, y: 117, z: 103, targetX: 0, targetY: 0, targetZ: 0,
  }));
}

async function readTerrain(page: Page, pos: { x: number; y: number }) {
  return page.evaluate(({ x, y }) => {
    const qa = (window as any).__castleTouchQA();
    const point = (window as any).__castleVisualGridPoint(x, y);
    const probe = (window as any).__castleMoatProbe(point.x, point.y);
    const raw = qa.elevations.find((entry: [string, number]) => entry[0] === x + ',' + y);
    return {
      elevation: raw ? raw[1] : null,
      status: probe?.status ?? null,
      point,
      undoCount: qa.undoCount,
    };
  }, pos);
}

async function useToolAt(page: Page, tool: string, pos: { x: number; y: number }): Promise<void> {
  await page.locator('[data-tool="' + tool + '"]').evaluate((el) => (el as HTMLButtonElement).click());
  const pt = await page.evaluate(({ x, y }) => (window as any).__castleVisualGridPoint(x, y), pos);
  expect(pt.x).toBeGreaterThan(8);
  expect(pt.y).toBeGreaterThan(8);
  expect(pt.x).toBeLessThan(1272);
  expect(pt.y).toBeLessThan(712);
  await page.mouse.click(pt.x, pt.y);
}

test('restoring naturally occurring river removes raised land height, undo/redo and reload stay consistent', async ({ page }) => {
  test.setTimeout(150_000);
  await openFixture(page);

  // Legacy negative river elevation is normalized on load, while positive
  // intentionally authored elevated river must remain intact.
  expect((await readTerrain(page, legacyCarvedRiver)).elevation).toBeNull();
  expect((await readTerrain(page, authoredHighRiver)).elevation).toBeCloseTo(0.85);
  const before = await readTerrain(page, elevatedNaturalRiver);
  expect(before.elevation).toBeCloseTo(1.6);

  await useToolAt(page, 'erase', elevatedNaturalRiver);
  const erased = await readTerrain(page, elevatedNaturalRiver);
  expect(erased.elevation, 'erasing a filled river must also restore natural river water elevation').toBeNull();
  expect(erased.status, 'restored natural river must block new moat excavation').toBe('blocked');

  await page.keyboard.press('Control+z');
  const undone = await readTerrain(page, elevatedNaturalRiver);
  expect(undone.elevation).toBeCloseTo(1.6);
  expect(undone.undoCount).toBe(before.undoCount);
  expect(undone.status).not.toBe('blocked');

  await page.keyboard.press('Control+y');
  const redone = await readTerrain(page, elevatedNaturalRiver);
  expect(redone.elevation).toBeNull();
  expect(redone.status).toBe('blocked');
  expect((await readTerrain(page, authoredHighRiver)).elevation).toBeCloseTo(0.85);

  // Undo/redo invokes a save; verify persistent state survives reload.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof (window as any).__castleTouchQA === 'function');
  await page.evaluate(() => (window as any).__castleVisualCamera({
    x: 90, y: 117, z: 103, targetX: 0, targetY: 0, targetZ: 0,
  }));
  const restored = await readTerrain(page, elevatedNaturalRiver);
  expect(restored.elevation).toBeNull();
  expect(restored.status).toBe('blocked');
  expect((await readTerrain(page, authoredHighRiver)).elevation).toBeCloseTo(0.85);
});

test('lower -> carve river -> undo/redo preserves terrain and clears submerged height', async ({ page }) => {
  test.setTimeout(150_000);
  await openFixture(page);
  const before = await readTerrain(page, land);
  expect(before.elevation).toBeNull();
  await useToolAt(page, 'lower', land);
  const lowered = await readTerrain(page, land);
  expect(lowered.elevation).not.toBeNull();
  expect(lowered.elevation!).toBeLessThan(0);

  await useToolAt(page, 'river', land);
  const carved = await readTerrain(page, land);
  expect(carved.elevation).toBeNull();
  expect(carved.status).toBe('blocked');
  await page.keyboard.press('Control+z');
  const undo = await readTerrain(page, land);
  expect(undo.elevation).toBeCloseTo(lowered.elevation!);
  expect(undo.status).not.toBe('blocked');
  await page.keyboard.press('Control+y');
  const redo = await readTerrain(page, land);
  expect(redo.elevation).toBeNull();
  expect(redo.status).toBe('blocked');
});
