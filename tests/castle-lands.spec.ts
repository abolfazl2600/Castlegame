import { expect, test, type Page } from '@playwright/test';
import { SAVE_AUTOSAVE_KEY, SAVE_KEY, SAVE_VERSION } from '../src/core/constants';

interface WorldSave {
  mapLayoutId?: string;
  worldSeed?: number;
  cells: Array<{ kind: string; x: number; y: number }>;
  keeps?: Array<{ x: number; y: number; floors: number }>;
}

async function boot(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.addInitScript(({ marker, autosave, version }) => {
    const now = Date.now();
    localStorage.setItem(marker, '1');
    if (!localStorage.getItem(autosave)) localStorage.setItem(autosave, JSON.stringify({
      metadata: {
        id: 'castle-lands-e2e', slot: 'autosave', name: 'Castle Lands QA',
        createdAt: now, updatedAt: now, schemaVersion: version, gameMode: 'unified',
        summary: { buildings: 0, keeps: 0, terrainChanges: 0, elevations: 0 },
      },
      data: {
        version, gameMode: 'unified', mapLayoutId: 'island', worldSeed: 0,
        updatedAt: now, cells: [], keeps: [], towerBridges: [],
        terrain: [], elevations: [], stoneStyle: 'limestone', worldSeeded: true,
      },
    }));
    localStorage.setItem('castle-role.settings.v2', JSON.stringify({
      schemaVersion: 2,
      graphics: {
        quality: 'low', performanceMode: 'performance', environmentDetail: 'low',
        shadowsEnabled: false, effectsEnabled: false, debugMode: false,
      },
      gameplay: { tutorialCompleted: true, controlScheme: 'standard' },
      interface: { language: 'en', reducedMotion: true, showHelp: false },
      audio: { muted: true, masterVolume: 0, musicEnabled: false, sfxEnabled: false },
    }));
  }, { marker: SAVE_KEY, autosave: SAVE_AUTOSAVE_KEY, version: SAVE_VERSION });

  await page.goto('/Castlegame/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#game-canvas')).toHaveCount(1, { timeout: 45_000 });
  await expect(page.locator('[data-template="highland-crown-100x100"]')).toHaveCount(1);
  await expect(page.locator('[data-template="sunset-lagoon-100x100"]')).toHaveCount(1);
  await expect(page.locator('#toolbar [data-build-none]')).toHaveCount(1, { timeout: 45_000 });
}

async function savedWorld(page: Page): Promise<WorldSave> {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    if (!raw) throw new Error('Missing autosave');
    return (JSON.parse(raw) as { data: WorldSave }).data;
  }, SAVE_AUTOSAVE_KEY);
}

for (const [id, seed] of [
  ['highland-crown-100x100', 6201],
  ['sunset-lagoon-100x100', 6301],
] as const) {
  test(`${id} loads a playable fortress and survives reload`, async ({ page }, info) => {
    test.setTimeout(120_000);
    await boot(page);

    // Use the actual prepared-world handler, not direct mutation of saved data.
    await page.locator(`[data-template="${id}"]`).evaluate((button) => {
      (button as HTMLButtonElement).click();
    });

    await expect.poll(async () => {
      const save = await savedWorld(page);
      return save.mapLayoutId === id && save.worldSeed === seed && (save.keeps?.length ?? 0) > 0;
    }, { timeout: 35_000 }).toBe(true);

    let saved = await savedWorld(page);
    expect(saved.keeps?.length).toBe(1);
    expect(saved.cells.filter(cell => cell.kind === 'gate').length).toBeGreaterThanOrEqual(2);
    expect(saved.cells.filter(cell => cell.kind === 'tower').length).toBeGreaterThanOrEqual(4);
    expect(saved.cells.filter(cell => cell.kind === 'armyCamp').length).toBeGreaterThanOrEqual(1);
    expect(saved.cells.filter(cell => cell.kind === 'farm').length).toBeGreaterThanOrEqual(1);
    if (id === 'sunset-lagoon-100x100') {
      expect(saved.cells.filter(cell => cell.kind === 'harbor').length).toBeGreaterThanOrEqual(1);
    }

    const screenshot = info.outputPath(`${id}.png`);
    await page.screenshot({ path: screenshot, animations: 'disabled' });
    await info.attach(`${id}.png`, { path: screenshot, contentType: 'image/png' });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('#toolbar [data-build-none]')).toHaveCount(1, { timeout: 45_000 });
    saved = await savedWorld(page);
    expect(saved.mapLayoutId).toBe(id);
    expect(saved.worldSeed).toBe(seed);
    expect(saved.keeps?.length).toBe(1);
  });
}
