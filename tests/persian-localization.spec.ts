import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { SAVE_AUTOSAVE_KEY, SAVE_KEY, SAVE_VERSION } from '../src/core/constants';

// Stable small sandbox world: UI/RTL checks should not depend on heavyweight rendering.
async function openLocalizedGame(page: Page, width: number, height: number): Promise<void> {
  await page.setViewportSize({ width, height });
  await page.addInitScript(({ markerKey, autosaveKey, version }) => {
    const now = Date.now();
    localStorage.setItem(markerKey, '1');
    localStorage.setItem(autosaveKey, JSON.stringify({
      metadata: { id: 'fa-rtl-e2e', slot: 'autosave', name: 'Persian QA',
        createdAt: now, updatedAt: now, schemaVersion: version, gameMode: 'sandbox',
        summary: { buildings: 0, keeps: 0, terrainChanges: 0, elevations: 0 } },
      data: { version, gameMode: 'sandbox', updatedAt: now, worldSeeded: true,
        cells: [], keeps: [], towerBridges: [], terrain: [], elevations: [], stoneStyle: 'limestone' },
    }));
    if (!localStorage.getItem('castle-role.settings.v2')) localStorage.setItem('castle-role.settings.v2', JSON.stringify({
      schemaVersion: 2,
      graphics: { quality: 'low', performanceMode: 'performance', environmentDetail: 'low',
        shadowsEnabled: false, effectsEnabled: false, debugMode: false },
      audio: { muted: true, musicEnabled: false, sfxEnabled: false, masterVolume: 0 },
      gameplay: { tutorialCompleted: true, controlScheme: 'standard' },
      interface: { language: 'fa', reducedMotion: true, showHelp: false },
    }));
  }, { markerKey: SAVE_KEY, autosaveKey: SAVE_AUTOSAVE_KEY, version: SAVE_VERSION });
  await page.goto('/Castlegame/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#toolbar [data-build-none]')).toHaveCount(1, { timeout: 30_000 });
  await expect(page.locator('html')).toHaveAttribute('lang', 'fa');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
}

async function openSettings(page: Page, mobile = false): Promise<void> {
  const button = mobile
    ? page.locator('.mobile-header [data-mobile-proxy="settings-button"]')
    : page.locator('#settings-button');
  await button.click();
  await expect(page.locator('#settings-modal')).toBeVisible();
}

async function assertVisibleDialogInsideViewport(page: Page, selector: string): Promise<void> {
  const result = await page.locator(selector).evaluate(element => {
    const box = element.getBoundingClientRect();
    return {
      left: box.left, top: box.top, right: box.right, bottom: box.bottom,
      width: window.innerWidth, height: window.innerHeight,
    };
  });
  expect(result.left).toBeGreaterThanOrEqual(-1);
  expect(result.top).toBeGreaterThanOrEqual(-1);
  expect(result.right).toBeLessThanOrEqual(result.width + 1);
  expect(result.bottom).toBeLessThanOrEqual(result.height + 1);
}

async function captureEvidence(page: Page, testInfo: TestInfo, filename: string): Promise<void> {
  const path = testInfo.outputPath(filename);
  await page.screenshot({ path, animations: 'disabled', fullPage: false });
  await testInfo.attach(filename, { path, contentType: 'image/png' });
}

test('Persian is selected, switch to English and back persists across reload', async ({ page }, testInfo) => {
  await openLocalizedGame(page, 1280, 800);
  await openSettings(page);
  await expect(page.locator('#settings-title')).toHaveText('تنظیمات');
  await page.locator('[data-settings-nav="general"]').click();
  const language = page.locator('[data-setting="language"]');
  await expect(language).toHaveValue('fa');
  await captureEvidence(page, testInfo, 'desktop-settings-fa.png');

  await language.selectOption('en');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('#settings-title')).toHaveText('Settings');
  await expect(language).toHaveValue('en');

  await language.selectOption('fa');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('#settings-title')).toHaveText('تنظیمات');
  await expect(language).toHaveValue('fa');
  await expect.poll(() => page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('castle-role.settings.v2') || '{}');
    return data.interface?.language;
  })).toBe('fa');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('#settings-title')).toHaveText('تنظیمات');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
});

test('Privacy panel and native Save prompt are localized; values remain separate', async ({ page }) => {
  await openLocalizedGame(page, 1280, 800);
  await openSettings(page);
  await page.locator('[data-settings-nav="data"]').click();
  await expect(page.locator('#settings-privacy-legal')).toBeAttached({ timeout: 20_000 });
  await expect(page.locator('#privacy-policy h4')).toHaveText('سیاست حریم خصوصی');
  await expect(page.locator('#privacy-policy code').first()).toContainText('castle-role');

  await page.locator('[data-settings-nav="overview"]').click();
  await page.locator('[data-system-action="save"]').click();
  await expect(page.locator('#settings-modal')).toBeHidden();
  await expect(page.locator('.save-load-backdrop')).toBeVisible();
  await expect(page.locator('#save-load-title')).toHaveText('ذخیره بازی');
  await expect(page.locator('.save-load-backdrop .template-card').first()).toContainText('جایگاه ذخیره ۱');

  const dialogText: string[] = [];
  page.once('dialog', async dialog => {
    dialogText.push(dialog.message());
    await dialog.dismiss();
  });
  await page.locator('[data-save-action="save-slot"][data-save-target="1"]').click();
  expect(dialogText).toEqual(['نام ذخیره']);
});

test('Dynamic status and accessibility labels follow live locale changes', async ({ page }) => {
  await openLocalizedGame(page, 1280, 800);
  await page.evaluate(() => {
    const status = document.querySelector('#save-status');
    if (!status) throw new Error('Save status is missing');
    status.textContent = 'Battle duration: 12.5s';
  });
  await expect(page.locator('#save-status')).toHaveText('مدت نبرد: ۱۲.۵ ثانیه');
  await openSettings(page);
  await expect(page.locator('#settings-close')).toHaveAttribute('aria-label', 'بستن تنظیمات');
  await page.locator('[data-settings-nav="general"]').click();
  await page.locator('[data-setting="language"]').selectOption('en');
  await expect(page.locator('#save-status')).toHaveText('Battle duration: 12.5s');
  await expect(page.locator('#settings-close')).toHaveAttribute('aria-label', 'Close settings');
  await page.locator('[data-setting="language"]').selectOption('fa');
  await expect(page.locator('#save-status')).toHaveText('مدت نبرد: ۱۲.۵ ثانیه');
});

test('Persian portrait touch layout keeps controls and Settings on-screen', async ({ page }, testInfo) => {
  await openLocalizedGame(page, 390, 844);
  await expect(page.locator('html')).toHaveClass(/mobile-ui-active/);
  await expect(page.locator('.mobile-bottom-dock')).toHaveCount(0);
  await expect(page.locator('.mobile-header [data-mobile-proxy="toolbar-open"]')).toBeVisible();
  await expect(page.locator('.mobile-header [data-mobile-proxy="settings-button"]')).toBeVisible();
  await openSettings(page, true);
  await assertVisibleDialogInsideViewport(page, '#settings-modal');
  await page.locator('[data-settings-nav="general"]').click();
  await expect(page.locator('[data-setting="language"]')).toBeVisible();
  await captureEvidence(page, testInfo, 'mobile-portrait-settings-fa.png');
  const rootWidth = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }));
  expect(rootWidth.scroll).toBeLessThanOrEqual(rootWidth.viewport + 2);

  await page.locator('#settings-close').click();
  await page.locator('.mobile-header [data-mobile-action="load"]').click();
  await expect(page.locator('#save-load-title')).toHaveText('بارگذاری بازی');
  await assertVisibleDialogInsideViewport(page, '.save-load-backdrop .help-modal');
  await captureEvidence(page, testInfo, 'mobile-portrait-load-fa.png');
});

test.describe('Persian Android landscape', () => {
  test.use({ hasTouch: true, isMobile: true });

  test('RTL tool panel docks to right and Settings remains accessible', async ({ page }, testInfo) => {
    await openLocalizedGame(page, 915, 412);
    await expect(page.locator('html')).toHaveClass(/mobile-ui-active/);
    if (await page.locator('#toolbar').evaluate(el => el.classList.contains('is-collapsed'))) {
      await page.locator('.mobile-header [data-mobile-proxy="toolbar-open"]').click();
    }
    await expect(page.locator('#toolbar')).not.toHaveClass(/is-collapsed/);
    const position = await page.locator('#toolbar').evaluate(element => {
      const box = element.getBoundingClientRect();
      return { left: box.left, right: box.right, width: window.innerWidth };
    });
    expect(position.left).toBeGreaterThanOrEqual(-1);
    expect(position.right).toBeLessThanOrEqual(position.width + 1);
    expect(position.right).toBeGreaterThan(position.width * 0.72);
    await captureEvidence(page, testInfo, 'mobile-landscape-tools-fa.png');

    await page.locator('.mobile-header [data-mobile-proxy="settings-button"]').click();
    await expect(page.locator('#settings-modal')).toBeVisible();
    await assertVisibleDialogInsideViewport(page, '#settings-modal');
    await page.locator('[data-settings-nav="general"]').click();
    await expect(page.locator('[data-setting="language"]')).toHaveValue('fa');
    await captureEvidence(page, testInfo, 'mobile-landscape-settings-fa.png');
  });
});
