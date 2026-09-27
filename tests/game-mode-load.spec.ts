import { expect, test, type Page } from '@playwright/test';
import {
  SAVE_AUTOSAVE_KEY,
  SAVE_KEY,
  SAVE_VERSION,
} from '../src/core/constants';

type TestGameMode = 'medieval' | 'modern' | 'sandbox';

function createSaveRecord(mode: TestGameMode) {
  const now = Date.now() + 1000;
  return {
    metadata: {
      id: `test-${mode}-${now}`,
      slot: 'autosave',
      name: `Test ${mode} save`,
      createdAt: now,
      updatedAt: now,
      schemaVersion: SAVE_VERSION,
      gameMode: mode,
      summary: {
        buildings: 0,
        keeps: 0,
        terrainChanges: 0,
        elevations: 0,
      },
    },
    data: {
      version: SAVE_VERSION,
      gameMode: mode,
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

async function seedAutosaveBeforeNavigation(page: Page, mode: TestGameMode): Promise<void> {
  const record = createSaveRecord(mode);
  await page.addInitScript(
    ({ autosaveKey, markerKey, saveRecord }) => {
      localStorage.setItem(autosaveKey, JSON.stringify(saveRecord));
      localStorage.setItem(markerKey, '1');
    },
    {
      autosaveKey: SAVE_AUTOSAVE_KEY,
      markerKey: SAVE_KEY,
      saveRecord: record,
    },
  );
}

async function loadApplication(page: Page, expectedLabel = 'Medieval Castle'): Promise<void> {
  await page.goto('/Castlegame/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#toolbar [data-build-none]')).toHaveCount(1, { timeout: 20_000 });
  await expect(page.locator('#game-mode-label')).toHaveText(expectedLabel);
}

async function writeAutosave(page: Page, mode: TestGameMode): Promise<void> {
  const record = createSaveRecord(mode);
  await page.evaluate(
    ({ autosaveKey, markerKey, saveRecord }) => {
      localStorage.setItem(autosaveKey, JSON.stringify(saveRecord));
      localStorage.setItem(markerKey, '1');
    },
    {
      autosaveKey: SAVE_AUTOSAVE_KEY,
      markerKey: SAVE_KEY,
      saveRecord: record,
    },
  );
}

async function invokeRuntimeLoadWithoutReload(page: Page): Promise<void> {
  await page.evaluate(() => {
    const loadButton = document.getElementById('load-button') as HTMLButtonElement | null;
    if (!loadButton?.onclick) throw new Error('Runtime load handler is not bound');
    loadButton.onclick.call(loadButton, new MouseEvent('click'));
  });
}

async function selectToolProgrammatically(page: Page, tool: string): Promise<void> {
  await page.locator(`#toolbar [data-tool="${tool}"]`).evaluate((element) => {
    (element as HTMLButtonElement).click();
  });
}

test('Medieval to Modern runtime load rebuilds toolbar and clears stale selection', async ({ page }) => {
  await loadApplication(page);

  await selectToolProgrammatically(page, 'wall1');
  await expect(page.locator('#toolbar [data-tool="wall1"]')).toHaveClass(/is-selected/);

  await writeAutosave(page, 'modern');
  await invokeRuntimeLoadWithoutReload(page);

  await expect(page.locator('#game-mode-label')).toHaveText('Modern Fortress');
  await expect(page.locator('#battle-button')).toBeHidden();
  await expect(page.locator('#toolbar [data-tool="futuristicCastle"]')).toHaveCount(1);
  await expect(page.locator('#toolbar [data-tool="wall1"]')).toHaveCount(0);
  await expect(page.locator('#toolbar [data-build-none]')).toHaveClass(/is-selected/);
  await expect(page.locator('#toolbar [data-build-none]')).toHaveAttribute('aria-pressed', 'true');
});

test('Modern to Medieval runtime load restores Medieval toolbar', async ({ page }) => {
  await seedAutosaveBeforeNavigation(page, 'modern');
  await loadApplication(page, 'Modern Fortress');

  await expect(page.locator('#toolbar [data-tool="futuristicCastle"]')).toHaveCount(1);
  await selectToolProgrammatically(page, 'futuristicCastle');

  await writeAutosave(page, 'medieval');
  await invokeRuntimeLoadWithoutReload(page);

  await expect(page.locator('#game-mode-label')).toHaveText('Medieval Castle');
  await expect(page.locator('#battle-button')).toBeVisible();
  await expect(page.locator('#toolbar [data-tool="wall1"]')).toHaveCount(1);
  await expect(page.locator('#toolbar [data-tool="futuristicCastle"]')).toHaveCount(0);
  await expect(page.locator('#toolbar [data-build-none]')).toHaveClass(/is-selected/);
});

test('Sandbox runtime load exposes both medieval and modern tools', async ({ page }) => {
  await loadApplication(page);

  await writeAutosave(page, 'sandbox');
  await invokeRuntimeLoadWithoutReload(page);

  await expect(page.locator('#game-mode-label')).toHaveText('Sandbox');
  await expect(page.locator('#toolbar [data-tool="wall1"]')).toHaveCount(1);
  await expect(page.locator('#toolbar [data-tool="futuristicCastle"]')).toHaveCount(1);
  await expect(page.locator('#toolbar [data-tool="river"]')).toHaveCount(1);
});

test('farm extension reinstalls its tool after a mode-specific toolbar rebuild', async ({ page }) => {
  await loadApplication(page);
  await expect(page.locator('#toolbar [data-cow-barn]')).toHaveCount(1);

  await writeAutosave(page, 'modern');
  await invokeRuntimeLoadWithoutReload(page);
  await expect(page.locator('#toolbar [data-cow-barn]')).toHaveCount(0);

  await writeAutosave(page, 'medieval');
  await invokeRuntimeLoadWithoutReload(page);
  await expect(page.locator('#toolbar [data-cow-barn]')).toHaveCount(1);
});

test('same-mode runtime load replaces categories without duplicates', async ({ page }) => {
  await loadApplication(page);
  await selectToolProgrammatically(page, 'wall1');

  const categoryCount = await page.locator('#toolbar .tool-category').count();
  await writeAutosave(page, 'medieval');
  await invokeRuntimeLoadWithoutReload(page);

  await expect(page.locator('#toolbar .tool-category')).toHaveCount(categoryCount);
  await expect(page.locator('#toolbar [data-tool="wall1"]')).toHaveCount(1);
  await expect(page.locator('#toolbar [data-tool="wall1"]')).toHaveClass(/is-selected/);
});

test('mobile build toolbar remains usable after a cross-mode runtime load', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loadApplication(page);

  await writeAutosave(page, 'modern');
  await invokeRuntimeLoadWithoutReload(page);

  await expect(page.locator('#game-mode-label')).toHaveText('Modern Fortress');
  await expect(page.locator('#toolbar [data-tool="futuristicCastle"]')).toHaveCount(1);
  await expect(page.locator('#toolbar [data-tool="wall1"]')).toHaveCount(0);

  await page.locator('#toolbar-open').evaluate((element) => {
    (element as HTMLButtonElement).click();
  });
  await expect(page.locator('#toolbar-open')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#toolbar')).not.toHaveClass(/is-collapsed/);
});
