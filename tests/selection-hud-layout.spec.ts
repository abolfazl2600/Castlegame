import { expect, test, type Page } from '@playwright/test';
import { translate } from '../src/i18n/localization';
import { SAVE_AUTOSAVE_KEY, SAVE_KEY, SAVE_VERSION } from '../src/core/constants';

// The actual game owns contextual visibility. Fixture elements exercise the
// same CSS without requiring a fragile pointer hit-test against WebGL.
async function openHudScene(page: Page, language: 'en' | 'fa'): Promise<void> {
  await page.addInitScript(({ markerKey, autosaveKey, version, locale }) => {
    const now = Date.now();
    localStorage.setItem(markerKey, '1');
    localStorage.setItem(autosaveKey, JSON.stringify({
      metadata: {
        id: 'selection-hud-qa', slot: 'autosave', name: 'HUD QA',
        createdAt: now, updatedAt: now, schemaVersion: version,
        gameMode: 'unified', summary: { buildings: 0, keeps: 0, terrainChanges: 0, elevations: 0 },
      },
      data: {
        version, gameMode: 'unified', updatedAt: now, worldSeeded: true,
        cells: [], keeps: [], towerBridges: [], terrain: [], elevations: [],
        stoneStyle: 'limestone',
      },
    }));
    localStorage.setItem('castle-role.settings.v2', JSON.stringify({
      schemaVersion: 2,
      interface: { language: locale, uiScale: 1, reducedMotion: true },
      gameplay: { controlScheme: 'standard', tutorialCompleted: true },
      graphics: { quality: 'low', performanceMode: 'performance', effectsEnabled: false, shadowsEnabled: false },
      audio: { muted: true, musicEnabled: false, sfxEnabled: false },
    }));
  }, { markerKey: SAVE_KEY, autosaveKey: SAVE_AUTOSAVE_KEY, version: SAVE_VERSION, locale: language });

  await page.goto('/Castlegame/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#world-selection-panel')).toBeAttached({ timeout: 30_000 });
  await expect(page.locator('html')).toHaveAttribute('lang', language);

  await page.evaluate(() => {
    const shell = document.getElementById('game-shell');
    if (!shell) throw new Error('game shell missing');
    const selection = document.createElement('section');
    selection.id = 'selection-hud-fixture';
    selection.className = 'world-selection-panel';
    selection.setAttribute('role', 'group');
    selection.setAttribute('aria-label', 'Selected building actions');
    selection.innerHTML = [
      '<div class="world-selection-summary"><span class="eyebrow">SELECTED</span>',
      '<strong>Windmill</strong><small>Level 2</small></div>',
      '<div class="world-selection-actions">',
      '<button type="button">Upgrade</button><button type="button">Move</button>',
      '<button type="button" class="is-danger">Demolish</button>',
      '<button type="button">Deselect</button></div>',
    ].join('');
    shell.appendChild(selection);

    const progress = document.createElement('aside');
    progress.id = 'construction-hud-fixture';
    progress.className = 'construction-progress-panel';
    progress.setAttribute('role', 'status');
    progress.innerHTML = [
      '<div class="construction-progress__heading"><strong>Construction sites: 3</strong>',
      '<span>Workers: 1</span></div>',
      '<div class="construction-progress__details"><span>Stone Wall</span>',
      '<b dir="ltr">57%</b></div>',
      '<div class="construction-progress__track" role="progressbar" aria-valuemin="0"',
      ' aria-valuemax="100" aria-valuenow="57" aria-label="Construction progress">',
      '<span style="width:57%"></span></div>',
    ].join('');
    shell.appendChild(progress);
  });
}

const overlapping = (
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean => a.x < b.x + b.width && a.x + a.width > b.x
  && a.y < b.y + b.height && a.y + a.height > b.y;

async function expectHudToFit(page: Page, viewport: { width: number; height: number }): Promise<void> {
  await page.setViewportSize(viewport);
  const selection = page.locator('#selection-hud-fixture');
  const progress = page.locator('#construction-hud-fixture');
  await expect(selection).toBeVisible();
  await expect(progress).toBeVisible();
  const selectionBox = await selection.boundingBox();
  const progressBox = await progress.boundingBox();
  expect(selectionBox).not.toBeNull();
  expect(progressBox).not.toBeNull();

  for (const rect of [selectionBox!, progressBox!]) {
    expect(rect.x).toBeGreaterThanOrEqual(-1);
    expect(rect.y).toBeGreaterThanOrEqual(-1);
    expect(rect.x + rect.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(rect.y + rect.height).toBeLessThanOrEqual(viewport.height + 1);
  }
  expect(overlapping(selectionBox!, progressBox!), 'context actions and construction progress overlap').toBe(false);
  expect(selectionBox!.height).toBeLessThanOrEqual(viewport.height * .45 + 3);
  const actionHeights = await selection.locator('button').evaluateAll(buttons =>
    buttons.map(button => button.getBoundingClientRect().height));
  expect(actionHeights).toHaveLength(4);
  for (const height of actionHeights) expect(height).toBeGreaterThanOrEqual(43);
  await expect(progress.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '57');
}

test('desktop context actions preserve the world and do not cover construction progress', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1366, height: 900 });
  await openHudScene(page, 'en');
  for (const viewport of [
    { width: 1366, height: 900 },
    { width: 1024, height: 768 },
    { width: 820, height: 720 },
    { width: 2048, height: 335 },
  ]) {
    await expect(page.locator('html')).not.toHaveClass(/mobile-ui-active/);
    await expectHudToFit(page, viewport);
  }
});

test.describe('touch HUD', () => {
  test.use({ hasTouch: true, isMobile: true });

  test('Persian is readable in portrait and short landscape without overlapping panels', async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await openHudScene(page, 'fa');
    const panel = page.locator('#selection-hud-fixture');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(panel.locator('strong')).toHaveText(translate('Windmill', 'fa'));
    await expect(page.locator('#construction-hud-fixture')).toContainText(translate('Workers', 'fa'));

    for (const viewport of [
      { width: 390, height: 844 },
      { width: 640, height: 360 },
      { width: 915, height: 412 },
    ]) {
      await expect(page.locator('html')).toHaveClass(/mobile-ui-active/);
      await expectHudToFit(page, viewport);
    }
  });
});
