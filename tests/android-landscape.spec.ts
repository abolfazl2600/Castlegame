import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';
import { SAVE_AUTOSAVE_KEY, SAVE_KEY, SAVE_VERSION } from '../src/core/constants';

const VIEWPORTS = [
  { name: 'narrow-phone', width: 915, height: 412 },
  { name: 'small-landscape', width: 960, height: 540 },
  { name: '720p-landscape', width: 1280, height: 720 },
  { name: 'tablet-landscape', width: 1280, height: 800 },
] as const;

async function openLandscapeGame(page: Page, width: number, height: number): Promise<void> {
  await page.setViewportSize({ width, height });
  await page.addInitScript(({ markerKey, autosaveKey, version }) => {
    const now = Date.now();
    localStorage.setItem(markerKey, '1');
    localStorage.setItem('castle-role.settings.v2', JSON.stringify({
      schemaVersion: 2,
      gameplay: { controlScheme: 'touch', tutorialCompleted: true, cameraSensitivity: 1, combatFeedback: true },
      graphics: { quality: 'low', effectsEnabled: false, shadowsEnabled: false, performanceMode: 'performance', environmentDetail: 'low', debugMode: false },
      audio: { masterVolume: 0, musicEnabled: false, musicVolume: 0, sfxEnabled: false, sfxVolume: 0, muted: true },
      interface: { uiScale: 1, language: 'en', reducedMotion: true, highContrast: false, confirmDestructiveActions: true, showHelp: true },
    }));
    localStorage.setItem(autosaveKey, JSON.stringify({
      metadata: {
        id: 'issue-109-landscape',
        slot: 'autosave',
        name: 'Android landscape QA',
        createdAt: now,
        updatedAt: now,
        schemaVersion: version,
        gameMode: 'sandbox',
        summary: { buildings: 0, keeps: 0, terrainChanges: 0, elevations: 0 },
      },
      data: {
        version,
        gameMode: 'sandbox',
        updatedAt: now,
        worldSeeded: true,
        cells: [],
        keeps: [],
        towerBridges: [],
        terrain: [],
        elevations: [],
        stoneStyle: 'limestone',
      },
    }));
  }, { markerKey: SAVE_KEY, autosaveKey: SAVE_AUTOSAVE_KEY, version: SAVE_VERSION });

  await page.goto('/Castlegame/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#toolbar [data-build-none]')).toHaveCount(1, { timeout: 30_000 });
  await expect(page.locator('html')).toHaveClass(/mobile-ui-active/);
}

async function assertInsideViewport(locator: Locator): Promise<void> {
  const geometry = await locator.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return {
      left: box.left,
      top: box.top,
      right: box.right,
      bottom: box.bottom,
      width: window.innerWidth,
      height: window.innerHeight,
    };
  });
  expect(geometry.left).toBeGreaterThanOrEqual(-2);
  expect(geometry.top).toBeGreaterThanOrEqual(-2);
  expect(geometry.right).toBeLessThanOrEqual(geometry.width + 2);
  expect(geometry.bottom).toBeLessThanOrEqual(geometry.height + 2);
}

async function assertNoHorizontalPageOverflow(page: Page): Promise<void> {
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    html: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(dimensions.html).toBeLessThanOrEqual(dimensions.viewport + 2);
  expect(dimensions.body).toBeLessThanOrEqual(dimensions.viewport + 2);
}

async function assertScrollableWhenNeeded(locator: Locator): Promise<void> {
  const state = await locator.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      scrollHeight: element.scrollHeight,
      clientHeight: element.clientHeight,
      overflowY: style.overflowY,
    };
  });
  if (state.scrollHeight > state.clientHeight + 2) {
    expect(['auto', 'scroll', 'overlay']).toContain(state.overflowY);
  }
}

async function capture(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  const path = testInfo.outputPath(name + '.png');
  await page.screenshot({ path, animations: 'disabled', fullPage: false });
  await testInfo.attach(name + '.png', { path, contentType: 'image/png' });
}

async function openBuild(page: Page): Promise<Locator> {
  const toolbar = page.locator('#toolbar');
  const collapsed = await toolbar.evaluate((element) => element.classList.contains('is-collapsed'));
  if (collapsed) await page.locator('.mobile-header [data-mobile-proxy="toolbar-open"]').click();
  await expect(toolbar).not.toHaveClass(/is-collapsed/);
  await assertInsideViewport(toolbar);
  return toolbar;
}

async function closeBuild(page: Page): Promise<void> {
  const toolbar = page.locator('#toolbar');
  if (!(await toolbar.evaluate((element) => element.classList.contains('is-collapsed')))) {
    await page.locator('#toolbar-close').click();
  }
  await expect(toolbar).toHaveClass(/is-collapsed/);
}

for (const viewport of VIEWPORTS) {
  test.describe(`Android landscape: ${viewport.name}`, () => {
    test.use({ hasTouch: true, isMobile: true });

    test('major panels remain reachable, dismissible and inside the viewport', async ({ page }, testInfo) => {
      test.setTimeout(120_000);
      await openLandscapeGame(page, viewport.width, viewport.height);

      await expect(page.locator('.topbar')).toBeHidden();
      await expect(page.locator('.mobile-header')).toBeVisible();
      await assertInsideViewport(page.locator('.mobile-header'));
      await expect(page.locator('#minimap')).toBeVisible();
      await assertInsideViewport(page.locator('#minimap'));
      await assertNoHorizontalPageOverflow(page);
      await capture(page, testInfo, viewport.name + '-world');

      const toolbar = await openBuild(page);
      await expect(toolbar.locator('#city-population')).toBeVisible();
      await expect(toolbar.locator('#military-population')).toBeVisible();
      await assertScrollableWhenNeeded(toolbar);

      await page.evaluate(() => {
        const card = document.getElementById('army-camp-upgrade-card');
        if (card) card.removeAttribute('hidden');
      });
      const upgradeButton = page.locator('#army-camp-upgrade-button');
      await upgradeButton.scrollIntoViewIfNeeded();
      await expect(upgradeButton).toBeVisible();
      await assertInsideViewport(upgradeButton);
      await capture(page, testInfo, viewport.name + '-build');
      await closeBuild(page);

      await page.locator('.mobile-header [data-mobile-proxy="settings-button"]').click();
      const settings = page.locator('#settings-modal');
      await expect(settings).toBeVisible();
      await assertInsideViewport(settings);
      await assertScrollableWhenNeeded(page.locator('.settings-scroll'));
      await capture(page, testInfo, viewport.name + '-settings');
      await page.locator('#settings-close').click();
      await expect(settings).toBeHidden();

      await page.locator('.mobile-header [data-mobile-proxy="battle-button"]').click();
      const battle = page.locator('#battle-panel');
      await expect(battle).toBeVisible();
      await assertInsideViewport(battle);
      await assertScrollableWhenNeeded(battle);
      await capture(page, testInfo, viewport.name + '-battle');
      await page.locator('#battle-close').click();
      await expect(battle).toBeHidden();

      const godProxy = page.locator('.mobile-header [data-mobile-proxy="god-mode-button"]');
      await expect(godProxy).toBeVisible();
      await godProxy.click();
      const godMode = page.locator('#god-mode-panel');
      await expect(godMode).toBeVisible();
      await assertInsideViewport(godMode);
      await assertScrollableWhenNeeded(godMode);
      await page.locator('#god-mode-close').click();
      await expect(godMode).toBeHidden();

      await page.locator('.mobile-header [data-mobile-action="templates"]').click();
      const templates = page.locator('#templates-modal');
      await expect(templates).toBeVisible();
      await assertInsideViewport(templates.locator('.template-modal'));
      await assertScrollableWhenNeeded(templates.locator('.template-modal'));
      await capture(page, testInfo, viewport.name + '-templates');
      await page.locator('#templates-close-button').click();
      await expect(templates).toBeHidden();

      await page.locator('.mobile-header [data-mobile-proxy="settings-button"]').click();
      const dialogPromise = page.waitForEvent('dialog');
      const resetClick = page.locator('[data-action="reset-world"]').click();
      const dialog = await dialogPromise;
      expect(dialog.type()).toBe('confirm');
      await dialog.dismiss();
      await resetClick;
      await expect(page.locator('#game-mode-modal')).toBeHidden();

      await assertNoHorizontalPageOverflow(page);
    });
  });
}

test.describe('Desktop regression', () => {
  test('desktop layout remains available after landscape-first Android rules', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/Castlegame/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.topbar')).toBeVisible();
    await expect(page.locator('.mobile-header')).toBeHidden();
    await assertNoHorizontalPageOverflow(page);
  });
});
