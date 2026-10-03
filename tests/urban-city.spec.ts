import { expect, test, type Page } from '@playwright/test';
import { SAVE_AUTOSAVE_KEY, SAVE_KEY, SAVE_VERSION } from '../src/core/constants';

type SavedCell = {
  x: number;
  y: number;
  kind: string;
  level?: number;
  rotation?: number;
  gateOpen?: boolean;
};

type SavedRecord = {
  data: {
    mapLayoutId?: string;
    worldSeed?: number;
    stoneStyle?: string;
    cells: SavedCell[];
    keeps?: Array<{ x: number; y: number; width: number; depth: number; floors: number }>;
    terrain?: Array<{ x: number; y: number; kind: string }>;
  };
};

function emptyAutosave(): unknown {
  const now = Date.now();
  return {
    metadata: {
      id: 'urban-city-browser-qa',
      slot: 'autosave',
      name: 'Urban city browser QA',
      createdAt: now,
      updatedAt: now,
      schemaVersion: SAVE_VERSION,
      gameMode: 'unified',
      summary: { buildings: 0, keeps: 0, terrainChanges: 0, elevations: 0 },
    },
    data: {
      version: SAVE_VERSION,
      gameMode: 'unified',
      mapLayoutId: 'island',
      worldSeed: 0,
      updatedAt: now,
      cells: [],
      keeps: [],
      stoneStyle: 'limestone',
      towerBridges: [],
      terrain: [],
      elevations: [],
      worldSeeded: true,
    },
  };
}

async function loadQaRuntime(page: Page): Promise<void> {
  const record = emptyAutosave();
  await page.addInitScript(({ markerKey, autosaveKey, seededRecord }) => {
    localStorage.setItem(markerKey, '1');
    // Use the normal high-quality profile so the city screenshot shows its buildings and full land silhouette.
    localStorage.setItem('castle-role.settings.v2', JSON.stringify({
      schemaVersion: 2,
      gameplay: { controlScheme: 'standard', tutorialCompleted: true, cameraSensitivity: 1, combatFeedback: true },
      graphics: {
        quality: 'high', performanceMode: 'quality', environmentDetail: 'high',
        shadowsEnabled: false, effectsEnabled: false, debugMode: false,
      },
      interface: {
        uiScale: 1, language: 'en', reducedMotion: true, highContrast: false,
        confirmDestructiveActions: false, showHelp: false,
      },
      audio: {
        masterVolume: 0, musicEnabled: false, musicVolume: 0,
        sfxEnabled: false, sfxVolume: 0, muted: true,
      },
    }));
    if (!localStorage.getItem(autosaveKey)) {
      localStorage.setItem(autosaveKey, JSON.stringify(seededRecord));
    }
  }, { markerKey: SAVE_KEY, autosaveKey: SAVE_AUTOSAVE_KEY, seededRecord: record });

  await page.goto('/Castlegame/?visualBaseline=1', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#toolbar [data-build-none]')).toHaveCount(1, { timeout: 30_000 });
  await expect(page.locator('#game-canvas')).toHaveCount(1, { timeout: 30_000 });
  await expect(page.locator('#rotate-selected')).toHaveCount(1, { timeout: 30_000 });
  await expect(page.locator('#selected-gate-toggle')).toHaveCount(1, { timeout: 30_000 });
  await page.waitForFunction(() => {
    const qa = window as unknown as { __castleVisualGridPoint?: unknown };
    return typeof qa.__castleVisualGridPoint === 'function';
  });
}

test('Urban city loads from the picker, supports undo/redo, and survives reload', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await loadQaRuntime(page);
  await page.locator('#templates-button').evaluate(button => (button as HTMLButtonElement).click());
  const card = page.locator('[data-template="urban-city-60x80"]');
  await expect(card).toBeEnabled();
  await card.click();
  const saved = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)!).data, SAVE_AUTOSAVE_KEY);
  await expect.poll(async () => (await saved()).mapLayoutId).toBe('urban-60x80');
  const before = await saved();
  expect(before.worldSeed).toBe(6001);
  const residences = before.cells.filter((cell: SavedCell) => cell.kind === 'cottage');
  expect(residences).toHaveLength(32);
  expect(residences.filter((cell: SavedCell) => cell.level === 1)).toHaveLength(20);
  expect(residences.filter((cell: SavedCell) => cell.level === 2)).toHaveLength(10);
  expect(residences.filter((cell: SavedCell) => cell.level === 3)).toHaveLength(2);
  expect(before.cells.some((cell: SavedCell) => cell.kind === 'house' || cell.kind === 'manor')).toBe(false);
  for (const cell of before.cells as SavedCell[]) {
    expect(cell.x).toBeGreaterThanOrEqual(3);
    expect(cell.x).toBeLessThanOrEqual(17);
    expect(cell.y).toBeGreaterThanOrEqual(1);
    expect(cell.y).toBeLessThanOrEqual(20);
  }
  await expect(page.locator('#undo-button')).toHaveCount(0);
  await expect(page.locator('#redo-button')).toHaveCount(0);
  await page.locator('#header-undo-button').evaluate(button => (button as HTMLButtonElement).click());
  await expect.poll(async () => (await saved()).mapLayoutId).toBe('island');
  await page.keyboard.press('Control+Y');
  await expect.poll(async () => (await saved()).mapLayoutId).toBe('urban-60x80');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('#game-canvas')).toHaveCount(1, { timeout: 30_000 });
  await page.waitForFunction(() => typeof (window as unknown as { __castleVisualCamera?: unknown }).__castleVisualCamera === 'function');
  const after = await saved();
  expect(after.mapLayoutId).toBe('urban-60x80');
  expect(after.cells).toHaveLength(before.cells.length);
  await page.locator('#view-3d-button').evaluate(button => (button as HTMLButtonElement).click());
  await page.evaluate(() => {
    const qa = window as unknown as { __castleVisualCamera: (camera: object) => void };
    qa.__castleVisualCamera({ x: 44, y: 55, z: 66, targetX: -2, targetY: 0, targetZ: 0 });
  });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: testInfo.outputPath('urban-city-60x80.png'), fullPage: true });
});
