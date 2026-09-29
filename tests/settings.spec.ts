import { expect, test, type Page } from '@playwright/test';

const APP_PATH = '/Castlegame/';

async function loadApp(page: Page): Promise<void> {
  await page.goto(APP_PATH, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#settings-modal')).toBeAttached();
  await expect(page.locator('#settings-backdrop')).toBeAttached();
  await expect(page.locator('#game canvas')).toHaveCount(1, { timeout: 20_000 });
}

async function openSettings(page: Page): Promise<void> {
  await page.locator('#settings-button').click();
  await expect(page.locator('#settings-modal')).toBeVisible();
  await expect(page.locator('#settings-modal')).toHaveAttribute('aria-hidden', 'false');
  await expect(page.locator('#settings-backdrop')).toHaveAttribute('aria-hidden', 'false');
  expect(await page.locator('#settings-modal').evaluate((element) => (element as HTMLElement).hidden)).toBe(false);
  expect(await page.locator('#settings-backdrop').evaluate((element) => (element as HTMLElement).hidden)).toBe(false);
}

async function expectSettingsClosed(page: Page): Promise<void> {
  await expect(page.locator('#settings-modal')).toBeHidden();
  await expect(page.locator('#settings-modal')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('#settings-backdrop')).toHaveAttribute('aria-hidden', 'true');
  expect(await page.locator('#settings-modal').evaluate((element) => (element as HTMLElement).hidden)).toBe(true);
  expect(await page.locator('#settings-backdrop').evaluate((element) => (element as HTMLElement).hidden)).toBe(true);
}

test('desktop header Settings remains clickable after game runtime initialization', async ({ page }) => {
  await loadApp(page);

  const settingsButton = page.locator('#settings-button');
  await expect(settingsButton).toBeVisible();

  const box = await settingsButton.boundingBox();
  expect(box).not.toBeNull();

  const point = {
    x: box!.x + box!.width / 2,
    y: box!.y + box!.height / 2,
  };

  const hitTarget = await page.evaluate(({ x, y }) => {
    const hit = document.elementFromPoint(x, y);
    return hit?.closest('#settings-button')?.id ?? null;
  }, point);
  expect(hitTarget).toBe('settings-button');

  await page.mouse.click(point.x, point.y);

  const modal = page.locator('#settings-modal');
  const backdrop = page.locator('#settings-backdrop');

  await expect(modal).toBeVisible();
  await expect(modal).toBeInViewport();
  await expect(modal).toHaveAttribute('aria-hidden', 'false');
  await expect(backdrop).toHaveAttribute('aria-hidden', 'false');

  const layout = await modal.evaluate((element) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return {
      position: style.position,
      zIndex: Number(style.zIndex),
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      viewportWidth: innerWidth,
      viewportHeight: innerHeight,
    };
  });

  expect(layout.position).toBe('fixed');
  expect(layout.zIndex).toBeGreaterThan(100);
  expect(layout.left).toBeGreaterThanOrEqual(0);
  expect(layout.top).toBeGreaterThanOrEqual(0);
  expect(layout.right).toBeLessThanOrEqual(layout.viewportWidth);
  expect(layout.bottom).toBeLessThanOrEqual(layout.viewportHeight);
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
  await page.locator('#settings-backdrop').evaluate((element) => {
    (element as HTMLElement).click();
  });
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


test('Settings Save action opens the dedicated storage dialog above Settings', async ({ page }) => {
  await loadApp(page);
  await openSettings(page);

  await page.locator('[data-system-action="save"]').click();
  await expect(page.locator('#settings-modal')).toBeHidden();
  await expect(page.locator('.save-load-backdrop')).toBeVisible();
  await expect(page.locator('#save-load-title')).toHaveText('Save Game');

  const saveLayer = await page.locator('.save-load-backdrop').evaluate((element) => Number(getComputedStyle(element).zIndex));
  expect(saveLayer).toBeGreaterThan(9999);

  await page.locator('[data-save-action="close"]').click();
  await expect(page.locator('.save-load-backdrop')).toBeHidden();
});

test('Settings Load action opens the dedicated storage dialog above Settings', async ({ page }) => {
  await loadApp(page);
  await openSettings(page);

  await page.locator('[data-system-action="load"]').click();
  await expect(page.locator('#settings-modal')).toBeHidden();
  await expect(page.locator('.save-load-backdrop')).toBeVisible();
  await expect(page.locator('#save-load-title')).toHaveText('Load Game');

  const loadLayer = await page.locator('.save-load-backdrop').evaluate((element) => Number(getComputedStyle(element).zIndex));
  expect(loadLayer).toBeGreaterThan(9999);
});

test('Audio pane is navigable and unlocks the procedural audio engine', async ({ page }) => {
  await loadApp(page);
  await openSettings(page);

  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.audioEngine ?? '')).toBe('ready');

  await page.locator('[data-settings-nav="audio"]').click();
  const audioPane = page.locator('[data-settings-pane="audio"]');
  await expect(audioPane).toBeVisible();

  const master = audioPane.locator('[data-setting="masterVolume"]');
  await master.evaluate((element) => {
    const input = element as HTMLInputElement;
    input.value = '0.42';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(audioPane.locator('[data-setting-output="masterVolume"]')).toHaveText('42%');
});


test('Touch / Mobile preference forces the touch layout at desktop widths', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await loadApp(page);

  const root = page.locator('html');
  await expect(root).not.toHaveClass(/mobile-ui-active/);
  await expect(page.locator('.mobile-ui')).toBeHidden();

  await openSettings(page);
  await page.locator('[data-settings-nav="gameplay"]').click();
  await page.locator('[data-setting="controlScheme"]').selectOption('touch');

  await expect(root).toHaveClass(/mobile-ui-active/);
  await expect(root).toHaveClass(/touch-ui-forced/);
  await expect(root).toHaveAttribute('data-input-mode', 'touch');
  await expect(page.locator('.mobile-ui')).toBeVisible();
  await expect(page.locator('.topbar')).toBeHidden();

  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(root).toHaveClass(/mobile-ui-active/);
  await expect(page.locator('.mobile-ui')).toBeVisible();

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('#game canvas')).toHaveCount(1, { timeout: 20_000 });
  await expect(root).toHaveClass(/mobile-ui-active/);
  await expect(root).toHaveClass(/touch-ui-forced/);
  await expect(page.locator('.mobile-ui')).toBeVisible();

  await page.locator('.mobile-header [data-mobile-proxy="settings-button"]').click();
  await page.locator('[data-settings-nav="gameplay"]').click();
  await page.locator('[data-setting="controlScheme"]').selectOption('standard');

  await expect(root).not.toHaveClass(/touch-ui-forced/);
  await expect(root).not.toHaveClass(/mobile-ui-active/);
  await expect(root).toHaveAttribute('data-input-mode', 'standard');
  await expect(page.locator('.topbar')).toBeVisible();
});


test('Debug mode shows performance diagnostics and persists across reloads', async ({ page }) => {
  await loadApp(page);

  const overlay = page.locator('#debug-performance-overlay');
  await expect(overlay).toBeAttached();
  await expect(overlay).toBeHidden();

  await openSettings(page);
  await page.locator('[data-settings-nav="graphics"]').click();
  const debugToggle = page.locator('[data-setting="debugMode"]');
  await expect(debugToggle).not.toBeChecked();
  await debugToggle.check();

  await expect(overlay).toBeVisible();
  await expect(overlay).toContainText('DEBUG PERFORMANCE');
  await expect(overlay).toContainText('Draw calls');
  await expect(overlay).toContainText('JS heap used');
  await expect(overlay).toContainText('Memory pressure');
  await expect(overlay).toContainText('Detail suppression');
  await expect(overlay).toContainText('GPU');

  const persisted = await page.evaluate(() => {
    const raw = localStorage.getItem('castle-role.settings.v2');
    if (!raw) return null;
    return JSON.parse(raw)?.graphics?.debugMode ?? null;
  });
  expect(persisted).toBe(true);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('#game canvas')).toHaveCount(1, { timeout: 20_000 });
  await expect(page.locator('#debug-performance-overlay')).toBeVisible();

  await page.locator('#settings-button').click();
  await page.locator('[data-settings-nav="graphics"]').click();
  await page.locator('[data-setting="debugMode"]').uncheck();
  await expect(page.locator('#debug-performance-overlay')).toBeHidden();
});
