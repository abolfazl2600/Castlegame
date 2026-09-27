import { expect, test, type Page } from '@playwright/test';

const APP_PATH = '/Castlegame/';

async function loadApp(page: Page): Promise<void> {
  await page.goto(APP_PATH, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#settings-modal')).toBeAttached();
  await expect(page.locator('#settings-backdrop')).toBeAttached();
}

async function openSettings(page: Page): Promise<void> {
  await page.locator('#settings-button').click();
  await expect(page.locator('#settings-modal')).toBeVisible();
  await expect(page.locator('#settings-backdrop')).toBeVisible();
  await expect(page.locator('#settings-modal')).toHaveAttribute('aria-hidden', 'false');
  await expect(page.locator('#settings-backdrop')).toHaveAttribute('aria-hidden', 'false');
  expect(await page.locator('#settings-modal').evaluate((element) => (element as HTMLElement).hidden)).toBe(false);
  expect(await page.locator('#settings-backdrop').evaluate((element) => (element as HTMLElement).hidden)).toBe(false);
}

async function expectSettingsClosed(page: Page): Promise<void> {
  await expect(page.locator('#settings-modal')).toBeHidden();
  await expect(page.locator('#settings-backdrop')).toBeHidden();
  await expect(page.locator('#settings-modal')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('#settings-backdrop')).toHaveAttribute('aria-hidden', 'true');
}

test('desktop Settings button opens the Settings modal', async ({ page }) => {
  await loadApp(page);
  await openSettings(page);
});

test('close button closes Settings', async ({ page }) => {
  await loadApp(page);
  await openSettings(page);
  await page.locator('#settings-close').click();
  await expectSettingsClosed(page);
});

test('backdrop closes Settings', async ({ page }) => {
  await loadApp(page);
  await openSettings(page);
  await page.locator('#settings-backdrop').click({ position: { x: 8, y: 8 } });
  await expectSettingsClosed(page);
});

test('Escape closes Settings', async ({ page }) => {
  await loadApp(page);
  await openSettings(page);
  await page.keyboard.press('Escape');
  await expectSettingsClosed(page);
});

test('Settings can close and reopen without stale state', async ({ page }) => {
  await loadApp(page);
  await openSettings(page);
  await page.locator('#settings-close').click();
  await expectSettingsClosed(page);
  await openSettings(page);
});

test('mobile Settings action opens the actual Settings modal', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loadApp(page);

  const mobileSettings = page.locator('.mobile-header [data-mobile-proxy="settings-button"]');
  await expect(mobileSettings).toBeVisible();
  await mobileSettings.click();

  await expect(page.locator('#settings-modal')).toBeVisible();
  await expect(page.locator('#settings-modal')).toHaveAttribute('aria-hidden', 'false');
});

test('core Settings survives optional Privacy & Legal load failure', async ({ page }) => {
  let optionalChunkBlocked = false;
  await page.route('**/*PrivacyLegalUI*.js', async (route) => {
    optionalChunkBlocked = true;
    await route.abort();
  });

  await loadApp(page);
  await expect.poll(() => optionalChunkBlocked).toBe(true);
  await openSettings(page);
  await expect(page.locator('[data-action="open-privacy"]')).toBeDisabled();
});

test('Settings remains usable in fullscreen when browser automation supports it', async ({ page }) => {
  await loadApp(page);
  await expect(page.locator('#game canvas')).toHaveCount(1, { timeout: 20_000 });

  await page.locator('#fullscreen-button').click();
  const enteredFullscreen = await page.evaluate(() => Boolean(document.fullscreenElement));
  test.skip(!enteredFullscreen, 'Fullscreen is not available in this browser automation environment.');

  await openSettings(page);
  await page.evaluate(async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
  });
  await expect(page.locator('#settings-modal')).toBeVisible();
});
