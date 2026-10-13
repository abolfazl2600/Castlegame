import { expect, test, type Page } from '@playwright/test';

async function setTouchPreferences(page: Page, language: 'en' | 'fa' = 'en'): Promise<void> {
  await page.addInitScript((locale) => {
    localStorage.setItem('castle-role.settings.v2', JSON.stringify({
      schemaVersion: 2,
      gameplay: { controlScheme: 'touch', tutorialCompleted: true },
      graphics: { quality: 'low', performanceMode: 'performance', effectsEnabled: false, shadowsEnabled: false },
      audio: { muted: true, musicEnabled: false, sfxEnabled: false },
      interface: { uiScale: 1, language: locale, reducedMotion: true },
    }));
  }, language);
}

test.describe('Mobile UI readability', () => {
  test.use({ hasTouch: true, isMobile: true });

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 915, height: 412 },
  ]) {
    test(`build labels and Settings descriptions stay readable at ${viewport.width}×${viewport.height}`, async ({ page }) => {
      test.setTimeout(120_000);
      await page.setViewportSize(viewport);
      await setTouchPreferences(page);
      await page.goto('/Castlegame/', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('html')).toHaveClass(/mobile-ui-active/);
      await expect(page.locator('#toolbar .tool-copy small').first()).toBeAttached({ timeout: 60_000 });

      const buildSizes = await page.locator('#toolbar').evaluate((toolbar) => {
        const name = toolbar.querySelector('.tool-copy strong');
        const description = toolbar.querySelector('.tool-copy small');
        if (!name || !description) throw new Error('Build labels were not mounted');
        return {
          label: parseFloat(getComputedStyle(name).fontSize),
          description: parseFloat(getComputedStyle(description).fontSize),
        };
      });
      expect(buildSizes.label).toBeGreaterThanOrEqual(14);
      expect(buildSizes.description).toBeGreaterThanOrEqual(12);

      await page.locator('.mobile-header [data-mobile-proxy="settings-button"]').click();
      await expect(page.locator('#settings-modal')).toBeVisible();
      await page.locator('[data-settings-nav="general"]').click();
      const settingsSizes = await page.locator('#settings-modal').evaluate((modal) => {
        const name = modal.querySelector('.settings-control-copy strong');
        const description = modal.querySelector('.settings-control-copy small');
        if (!name || !description) throw new Error('Settings control labels were not mounted');
        return {
          label: parseFloat(getComputedStyle(name).fontSize),
          description: parseFloat(getComputedStyle(description).fontSize),
        };
      });
      expect(settingsSizes.label).toBeGreaterThanOrEqual(14);
      expect(settingsSizes.description).toBeGreaterThanOrEqual(12);

      const bounds = await page.locator('#settings-modal').evaluate((modal) => {
        const box = modal.getBoundingClientRect();
        return { left: box.left, right: box.right, top: box.top, bottom: box.bottom,
          vw: innerWidth, vh: innerHeight };
      });
      expect(bounds.left).toBeGreaterThanOrEqual(-2);
      expect(bounds.top).toBeGreaterThanOrEqual(-2);
      expect(bounds.right).toBeLessThanOrEqual(bounds.vw + 2);
      expect(bounds.bottom).toBeLessThanOrEqual(bounds.vh + 2);
    });
  }

  test('a failed 3D import shows Persian recovery content and Retry reloads', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setTouchPreferences(page, 'fa');
    // The 3D runtime is loaded dynamically by Vite into its own named chunk.
    await page.route(/\/assets\/ThreeGame[^/]*\.js(?:\?.*)?$/, async (route) => route.abort());
    await page.goto('/Castlegame/', { waitUntil: 'domcontentloaded' });

    const alert = page.locator('#game-startup-error');
    await expect(alert).toBeVisible({ timeout: 30_000 });
    await expect(alert).toHaveAttribute('role', 'alert');
    await expect(alert.locator('h2')).toHaveText('بازی راه‌اندازی نشد');
    const retry = alert.locator('[data-startup-retry]');
    await expect(retry).toHaveText('تلاش مجدد');
    await expect(retry).toBeInViewport();

    const reloaded = page.waitForEvent('framenavigated');
    await retry.click();
    await reloaded;
    await expect(alert).toBeVisible({ timeout: 30_000 });
  });
});
