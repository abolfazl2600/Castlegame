import { expect, test, type Page } from '@playwright/test';
import {
  SAVE_AUTOSAVE_KEY,
  SAVE_KEY,
  SAVE_VERSION,
} from '../src/core/constants';

type LegacyGameMode = 'medieval' | 'survival' | 'sandbox';

function createSaveRecord(mode: LegacyGameMode) {
  const now = Date.now() + 1000;
  return {
    metadata: {
      id: `test-${mode}-${now}`,
      slot: 'autosave',
      name: `Legacy ${mode} save`,
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

async function seedAutosaveBeforeNavigation(page: Page, mode: LegacyGameMode): Promise<void> {
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

test('new games skip mode selection and open map layout directly', async ({ page }) => {
  await page.goto('/Castlegame/', { waitUntil: 'domcontentloaded' });

  await expect(page.locator('#game-mode-modal')).toHaveCount(0);
  await expect(page.locator('#game-mode-button')).toHaveCount(0);
  await expect(page.locator('#map-layout-modal')).toBeVisible();
});

for (const legacyMode of ['medieval', 'survival', 'sandbox'] as const) {
  test(`legacy ${legacyMode} saves load into the unified game`, async ({ page }) => {
    await seedAutosaveBeforeNavigation(page, legacyMode);
    await page.goto('/Castlegame/', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('#toolbar [data-build-none]')).toHaveCount(1, { timeout: 20_000 });
    await expect(page.locator('#game-mode-button')).toHaveCount(0);
    await expect(page.locator('#god-mode-button')).toBeVisible();
    await expect(page.locator('#battle-endless')).toHaveCount(1);
    await expect(page.locator('#toolbar [data-tool="wall1"]')).toHaveCount(1);
    await expect(page.locator('#toolbar [data-tool="river"]')).toHaveCount(1);
    await expect(page.locator('#toolbar [data-tool="cowBarn"]')).toHaveCount(1);
    await expect(page.locator('#toolbar [data-tool="carpenter"]')).toHaveCount(1);
  });
}

test('mobile unified build toolbar remains usable after loading a legacy save', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedAutosaveBeforeNavigation(page, 'sandbox');
  await page.goto('/Castlegame/', { waitUntil: 'domcontentloaded' });

  await page.locator('#toolbar-open').evaluate((element) => {
    (element as HTMLButtonElement).click();
  });
  await expect(page.locator('#toolbar-open')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#toolbar')).not.toHaveClass(/is-collapsed/);
  await expect(page.locator('[data-mobile-proxy="god-mode-button"]')).toBeVisible();
});


test('Templates modal closes when its backdrop is clicked', async ({ page }) => {
  await seedAutosaveBeforeNavigation(page, 'medieval');
  await page.goto('/Castlegame/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#toolbar [data-build-none]')).toHaveCount(1, { timeout: 20_000 });

  await page.locator('#templates-button').evaluate((element) => {
    (element as HTMLButtonElement).click();
  });

  const modal = page.locator('#templates-modal');
  await expect(modal).toBeVisible();
  await modal.click({ position: { x: 4, y: 4 } });
  await expect(modal).toBeHidden();
});


test('Free Build is an accessible capability that survives closing God Mode', async ({ page }) => {
  await seedAutosaveBeforeNavigation(page, 'medieval');
  await page.goto('/Castlegame/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#toolbar [data-build-none]')).toHaveCount(1, { timeout: 20_000 });
  await page.locator('#god-mode-button').click();
  const toggle = page.locator('#god-mode-free-build');
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#god-mode-close').click();
  await page.locator('#god-mode-button').click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
});

test('Endless Defense starts, pauses, and resumes through Battle controls', async ({ page }) => {
  await seedAutosaveBeforeNavigation(page, 'survival');
  await page.goto('/Castlegame/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#toolbar [data-build-none]')).toHaveCount(1, { timeout: 20_000 });
  await page.locator('#battle-button').click();
  await page.locator('#battle-endless').click();
  const panel = page.locator('#battle-panel');
  await expect(panel).toHaveAttribute('data-battle-phase', 'running');
  await page.locator('#battle-stop').click();
  await expect(panel).toHaveAttribute('data-battle-phase', 'paused');
  await page.locator('#battle-start').click();
  await expect(panel).toHaveAttribute('data-battle-phase', 'running');
  await expect(page.locator('#battle-endless')).toBeDisabled();
  await page.locator('#battle-reset').click();
  await expect(panel).toHaveAttribute('data-battle-phase', 'idle');
  await expect(page.locator('#battle-endless')).toBeEnabled();
});
