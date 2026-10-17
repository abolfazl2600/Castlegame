import { expect, test } from '@playwright/test';
import { SAVE_AUTOSAVE_KEY, SAVE_KEY, SAVE_VERSION } from '../src/core/constants';

async function boot(page: import('@playwright/test').Page, existing = false) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.addInitScript(({ marker, autosave, version, existing }) => {
    localStorage.setItem('castle-role.settings.v2', JSON.stringify({
      schemaVersion: 2,
      graphics: { quality: 'low', performanceMode: 'performance', environmentDetail: 'low',
        shadowsEnabled: false, effectsEnabled: false, debugMode: false },
      gameplay: { tutorialCompleted: true, controlScheme: 'standard' },
      interface: { language: 'fa', reducedMotion: true, showHelp: false },
      audio: { muted: true, masterVolume: 0, musicEnabled: false, sfxEnabled: false },
    }));
    if (existing) {
      const now = Date.now();
      localStorage.setItem(marker, '1');
      localStorage.setItem(autosave, JSON.stringify({
        metadata: { id: 'gov-legacy-test', slot: 'autosave', name: 'Legacy',
          createdAt: now, updatedAt: now, schemaVersion: version, gameMode: 'unified',
          summary: { buildings: 0, keeps: 0, terrainChanges: 0, elevations: 0 } },
        data: { version, gameMode: 'unified', updatedAt: now, mapLayoutId: 'island',
          worldSeed: 0, worldSeeded: true, cells: [], keeps: [], terrain: [],
          elevations: [], stoneStyle: 'limestone' },
      }));
    }
  }, { marker: SAVE_KEY, autosave: SAVE_AUTOSAVE_KEY, version: SAVE_VERSION, existing });
  await page.goto('/Castlegame/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#government-hud')).toHaveCount(1, { timeout: 45_000 });
}

test('map selection leads to government choice, persisted on reload', async ({ page }) => {
  test.setTimeout(120_000);
  await boot(page);
  await expect(page.locator('#templates-modal')).toBeVisible();
  await page.locator('#starting-map-layout-grid [data-map-layout]').first().click();
  await expect(page.locator('#government-modal')).toBeVisible();
  await expect(page.locator('#templates-modal')).toBeHidden();
  await page.locator('#government-modal input[value="sultanate"]').check();
  await page.locator('#government-realm-name').fill('قلعه من');
  await page.locator('[data-government-confirm]').click();
  await expect(page.locator('#government-modal')).toBeHidden();
  await expect(page.locator('#government-hud')).toContainText('قلعه من');
  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).data.government,
    SAVE_AUTOSAVE_KEY);
  expect(saved).toEqual({ version: 1, kind: 'sultanate', realmName: 'قلعه من' });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('#government-hud')).toContainText('قلعه من', { timeout: 45_000 });
});

test('back from government selection returns to maps without overwriting legacy save', async ({ page }) => {
  test.setTimeout(90_000);
  await boot(page, true);
  const original = await page.evaluate((key) => localStorage.getItem(key), SAVE_AUTOSAVE_KEY);
  await expect(page.locator('#government-hud')).toContainText('پادشاهی');
  await page.locator('#templates-button').evaluate((button) => (button as HTMLButtonElement).click());
  // The regular Templates action edits the current world, not the new-game wizard.
  await expect(page.locator('#templates-modal')).toBeVisible();
  await page.locator('#templates-close-button').click();
  expect(await page.evaluate((key) => localStorage.getItem(key), SAVE_AUTOSAVE_KEY)).toBe(original);
});

test('prepared starting world also asks for government before replacing the map', async ({ page }) => {
  test.setTimeout(120_000);
  await boot(page);
  await expect(page.locator('#templates-modal')).toBeVisible();
  await page.locator('[data-template="royal-valley-50x89"]').evaluate(
    (button) => (button as HTMLButtonElement).click(),
  );
  await expect(page.locator('#government-modal')).toBeVisible();
  await page.locator('[data-government-back]').click();
  await expect(page.locator('#templates-modal')).toBeVisible();
  await page.locator('[data-template="royal-valley-50x89"]').evaluate(
    (button) => (button as HTMLButtonElement).click(),
  );
  await page.locator('#government-modal input[value="military"]').check();
  await page.locator('[data-government-confirm]').click();
  await expect.poll(async () => page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const data = JSON.parse(raw).data;
    return data?.government?.kind === 'military' && (data.keeps?.length ?? 0) > 0;
  }, SAVE_AUTOSAVE_KEY), { timeout: 45_000 }).toBe(true);
});
