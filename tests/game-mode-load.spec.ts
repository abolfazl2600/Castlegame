import { expect, test, type Page } from '@playwright/test';
import {
  SAVE_AUTOSAVE_KEY,
  SAVE_KEY,
  SAVE_VERSION,
} from '../src/core/constants';

type TestGameMode = 'medieval' | 'modern' | 'sandbox';

async function loadApplication(page: Page): Promise<void> {
  await page.goto('/Castlegame/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#toolbar [data-tool="wall1"]')).toHaveCount(1, { timeout: 20_000 });
  await expect(page.locator('#game-mode-label')).toHaveText('Medieval Castle');
}

async function writeAutosave(page: Page, mode: TestGameMode): Promise<void> {
  await page.evaluate(
    ({ autosaveKey, markerKey, version, gameMode }) => {
      const now = Date.now() + 1000;
      const record = {
        metadata: {
          id: `test-${gameMode}-${now}`,
          slot: 'autosave',
          name: `Test ${gameMode} save`,
          createdAt: now,
          updatedAt: now,
          schemaVersion: version,
          gameMode,
          summary: {
            buildings: 0,
            keeps: 0,
            terrainChanges: 0,
            elevations: 0,
          },
        },
        data: {
          version,
          gameMode,
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

      localStorage.setItem(autosaveKey, JSON.stringify(record));
      localStorage.setItem(markerKey, '1');
    },
    {
      autosaveKey: SAVE_AUTOSAVE_KEY,
      markerKey: SAVE_KEY,
      version: SAVE_VERSION,
      gameMode: mode,
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

test('cross-mode runtime save loads rebuild the toolbar and clear stale tool selection', async ({ page }) => {
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

  const modernCategoryCount = await page.locator('#toolbar .tool-category').count();
  await writeAutosave(page, 'modern');
  await invokeRuntimeLoadWithoutReload(page);
  await expect(page.locator('#toolbar .tool-category')).toHaveCount(modernCategoryCount);

  await selectToolProgrammatically(page, 'futuristicCastle');
  await writeAutosave(page, 'medieval');
  await invokeRuntimeLoadWithoutReload(page);

  await expect(page.locator('#game-mode-label')).toHaveText('Medieval Castle');
  await expect(page.locator('#battle-button')).toBeVisible();
  await expect(page.locator('#toolbar [data-tool="wall1"]')).toHaveCount(1);
  await expect(page.locator('#toolbar [data-tool="futuristicCastle"]')).toHaveCount(0);
  await expect(page.locator('#toolbar [data-build-none]')).toHaveClass(/is-selected/);

  await writeAutosave(page, 'sandbox');
  await invokeRuntimeLoadWithoutReload(page);

  await expect(page.locator('#game-mode-label')).toHaveText('Sandbox');
  await expect(page.locator('#toolbar [data-tool="wall1"]')).toHaveCount(1);
  await expect(page.locator('#toolbar [data-tool="futuristicCastle"]')).toHaveCount(1);
  await expect(page.locator('#toolbar [data-tool="river"]')).toHaveCount(1);
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
