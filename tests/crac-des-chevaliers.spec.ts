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
    elevations?: Array<{ x: number; y: number; height: number }>;
  };
};

function emptyAutosave(): unknown {
  const now = Date.now();
  return {
    metadata: {
      id: 'crac-des-chevaliers-browser-qa',
      slot: 'autosave',
      name: 'Crac des Chevaliers browser QA',
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
    localStorage.setItem('castle-role.settings.v2', JSON.stringify({
      schemaVersion: 2,
      gameplay: { controlScheme: 'standard', tutorialCompleted: true, cameraSensitivity: 1, combatFeedback: true },
      graphics: {
        quality: 'low', performanceMode: 'performance', environmentDetail: 'low',
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

async function applyCrac(page: Page): Promise<void> {
  await page.locator('[data-template="crac-des-chevaliers"]').evaluate((button) => {
    (button as HTMLButtonElement).click();
  });
  await expect.poll(async () => {
    return page.evaluate((key) => {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const record = JSON.parse(raw) as SavedRecord;
      return record.data.worldSeed ?? null;
    }, SAVE_AUTOSAVE_KEY);
  }, { timeout: 15_000 }).toBe(5901);
}

async function readAutosave(page: Page): Promise<SavedRecord> {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    if (!raw) throw new Error('Crac des Chevaliers autosave is missing');
    return JSON.parse(raw) as SavedRecord;
  }, SAVE_AUTOSAVE_KEY);
}

async function setTopQaCamera(page: Page): Promise<void> {
  await page.locator('#view-3d-button').evaluate((button) => (button as HTMLButtonElement).click());
  await page.evaluate(() => {
    const qa = window as unknown as {
      __castleVisualCamera: (position: {
        x: number; y: number; z: number;
        targetX: number; targetY: number; targetZ: number;
      }) => void;
    };
    qa.__castleVisualCamera({
      x: 0, y: 82, z: 0.01,
      targetX: 0, targetY: 0, targetZ: 0,
    });
  });
  await page.waitForTimeout(150);
}

async function clickGridCell(page: Page, x: number, y: number): Promise<void> {
  await page.evaluate(({ gx, gy }) => {
    const qa = window as unknown as {
      __castleVisualGridPoint: (x: number, y: number) => { x: number; y: number };
    };
    const canvas = document.getElementById('game-canvas');
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error('Game WebGL canvas is not available');

    const point = qa.__castleVisualGridPoint(gx, gy);
    const rect = canvas.getBoundingClientRect();
    const clientX = rect.left + point.x;
    const clientY = rect.top + point.y;
    const common: PointerEventInit = {
      bubbles: true, cancelable: true, composed: true,
      clientX, clientY, button: 0, pointerId: 1, pointerType: 'mouse', isPrimary: true,
    };
    canvas.dispatchEvent(new PointerEvent('pointerdown', { ...common, buttons: 1 }));
    canvas.dispatchEvent(new PointerEvent('pointerup', { ...common, buttons: 0 }));
  }, { gx: x, gy: y });
}

function cellAt(record: SavedRecord, x: number, y: number): SavedCell | undefined {
  return record.data.cells.find((cell) => cell.x === x && cell.y === y);
}

test('Crac des Chevaliers serializes its documented defensive hierarchy', async ({ page }) => {
  await loadQaRuntime(page);
  await applyCrac(page);

  const record = await readAutosave(page);
  expect(record.data.mapLayoutId).toBe('mainland');
  expect(record.data.worldSeed).toBe(5901);
  expect(record.data.stoneStyle).toBe('limestone');

  expect(cellAt(record, 20, 10)).toMatchObject({ kind: 'gate', level: 2 });
  expect(cellAt(record, 18, 10)).toMatchObject({ kind: 'gate', level: 4 });
  expect(cellAt(record, 12, 8)).toMatchObject({ kind: 'basilica', rotation: 1 });
  expect(record.data.keeps).toEqual(expect.arrayContaining([
    expect.objectContaining({ x: 8, y: 12, width: 2, depth: 3, floors: 5 }),
  ]));

  const towerCount = record.data.cells.filter((cell) => cell.kind === 'tower').length;
  const cisternCount = (record.data.terrain ?? []).filter((cell) => cell.kind === 'river' && cell.y === 15).length;
  const roadCount = record.data.cells.filter((cell) => cell.kind === 'stoneRoad').length;
  expect(towerCount).toBeGreaterThanOrEqual(24);
  expect(cisternCount).toBeGreaterThanOrEqual(5);
  expect(roadCount).toBeGreaterThanOrEqual(8);
  expect(record.data.elevations?.length ?? 0).toBeGreaterThan(400);
});

test('Crac remains editable and gate state survives autosave/reload', async ({ page }) => {
  test.setTimeout(180_000);
  await loadQaRuntime(page);
  await applyCrac(page);
  await setTopQaCamera(page);

  await clickGridCell(page, 12, 8);
  await page.locator('#rotate-selected').evaluate((button) => (button as HTMLButtonElement).click());
  await expect.poll(async () => {
    const record = await readAutosave(page);
    return cellAt(record, 12, 8)?.rotation ?? null;
  }, { timeout: 10_000 }).toBe(2);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('#game-canvas')).toHaveCount(1, { timeout: 30_000 });
  let record = await readAutosave(page);
  expect(cellAt(record, 12, 8)?.rotation).toBe(2);

  await page.waitForFunction(() => {
    const qa = window as unknown as { __castleVisualGridPoint?: unknown };
    return typeof qa.__castleVisualGridPoint === 'function';
  });
  await setTopQaCamera(page);
  await clickGridCell(page, 20, 10);

  await expect(page.locator('#selected-gate-toggle')).toHaveText(/Close Gate/i);
  await page.locator('#selected-gate-toggle').evaluate((button) => (button as HTMLButtonElement).click());
  await expect.poll(async () => {
    const next = await readAutosave(page);
    return cellAt(next, 20, 10)?.gateOpen ?? null;
  }, { timeout: 10_000 }).toBe(false);

  await page.locator('#selected-gate-toggle').evaluate((button) => (button as HTMLButtonElement).click());
  await expect.poll(async () => {
    const next = await readAutosave(page);
    return cellAt(next, 20, 10)?.gateOpen ?? null;
  }, { timeout: 10_000 }).toBe(true);

  record = await readAutosave(page);
  expect(cellAt(record, 18, 10)).toMatchObject({ kind: 'gate', level: 4 });
  expect(record.data.keeps).toEqual(expect.arrayContaining([
    expect.objectContaining({ x: 8, y: 12, floors: 5 }),
  ]));
});
