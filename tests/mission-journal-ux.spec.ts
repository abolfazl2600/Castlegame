import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { SAVE_AUTOSAVE_KEY, SAVE_KEY, SAVE_VERSION } from '../src/core/constants';

async function openJournal(page: Page, size: { width: number; height: number }, locale: 'fa' | 'en'): Promise<void> {
  await page.setViewportSize(size);
  await page.addInitScript(({ autosave, marker, version, language }) => {
    const now = Date.now();
    localStorage.setItem(marker, '1');
    localStorage.setItem(autosave, JSON.stringify({
      metadata: {
        id: 'mission-layout-qa', slot: 'autosave', name: 'Mission Layout',
        createdAt: now, updatedAt: now, schemaVersion: version, gameMode: 'unified',
        summary: { buildings: 0, keeps: 0, terrainChanges: 0, elevations: 0 },
      },
      data: {
        version, gameMode: 'unified', mapLayoutId: 'island', updatedAt: now, worldSeeded: true,
        cells: [], keeps: [], towerBridges: [], terrain: [], elevations: [], stoneStyle: 'limestone',
      },
    }));
    localStorage.setItem('castle-role.settings.v2', JSON.stringify({
      schemaVersion: 2,
      graphics: {
        quality: 'low', performanceMode: 'performance', environmentDetail: 'low',
        shadowsEnabled: false, effectsEnabled: false, debugMode: false,
      },
      gameplay: { tutorialCompleted: true, controlScheme: 'standard' },
      interface: { language, reducedMotion: true, showHelp: false },
      audio: { muted: true, masterVolume: 0, musicEnabled: false, sfxEnabled: false },
    }));
  }, { autosave: SAVE_AUTOSAVE_KEY, marker: SAVE_KEY, version: SAVE_VERSION, language: locale });

  await page.goto('/Castlegame/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#toolbar [data-build-none]')).toHaveCount(1, { timeout: 35_000 });
  await expect(page.locator('#mission-journal')).toHaveCount(1);
  await page.locator('#missions-button').evaluate((button) => (button as HTMLButtonElement).click());
  await expect(page.locator('#mission-journal')).toBeVisible();
  await expect(page.locator('.mission-journal__grid [data-mission-action="pin"]')).not.toHaveCount(0);
}

async function expectContained(page: Page): Promise<void> {
  const geometry = await page.locator('.mission-journal').evaluate((panel) => {
    const r = panel.getBoundingClientRect();
    return {
      x: r.x, y: r.y, right: r.right, bottom: r.bottom,
      screenW: window.innerWidth, screenH: window.innerHeight,
      contentWidth: panel.querySelector('.mission-journal__body')?.scrollWidth ?? 0,
      clientWidth: panel.querySelector('.mission-journal__body')?.clientWidth ?? 0,
      innerScroll: panel.querySelector('.mission-journal__body')?.scrollHeight ?? 0,
      innerViewport: panel.querySelector('.mission-journal__body')?.clientHeight ?? 0,
    };
  });
  expect(geometry.x).toBeGreaterThanOrEqual(-2);
  expect(geometry.y).toBeGreaterThanOrEqual(-2);
  expect(geometry.right).toBeLessThanOrEqual(geometry.screenW + 2);
  expect(geometry.bottom).toBeLessThanOrEqual(geometry.screenH + 2);
  expect(geometry.contentWidth).toBeLessThanOrEqual(geometry.clientWidth + 3);
  expect(geometry.innerViewport).toBeGreaterThan(40);
}

/**
 * Read actual computed styles (rather than searching for CSS declarations).
 * The hierarchy must remain legible in Persian and English on narrow screens.
 */
async function expectReadableMissionTypography(page: Page): Promise<void> {
  const metrics = await page.locator('.mission-journal').evaluate((dialog) => {
    const firstCard = dialog.querySelector<HTMLElement>('[data-mission-available] .mission-card');
    if (!firstCard) throw new Error('No active mission card to measure');
    const px = (selector: string): number => {
      const node = dialog.querySelector<HTMLElement>(selector);
      if (!node) throw new Error('Missing typography element: ' + selector);
      return Number.parseFloat(getComputedStyle(node).fontSize);
    };
    const box = (selector: string): DOMRect => {
      const node = firstCard.querySelector<HTMLElement>(selector);
      if (!node) throw new Error('Missing mission card element: ' + selector);
      return node.getBoundingClientRect();
    };
    const card = firstCard.getBoundingClientRect();
    const header = box('.mission-card__header');
    const description = box('.mission-card__description');
    const progress = box('.mission-card__progress-copy');
    const footer = box('.mission-card__footer');
    const descElement = firstCard.querySelector<HTMLElement>('.mission-card__description');
    return {
      hero: px('#mission-journal-title'),
      intro: px('.mission-journal__intro'),
      section: px('#mission-available-title'),
      helper: px('.mission-journal__section-heading p'),
      category: px('.mission-card__header small'),
      cardHeading: px('.mission-card__header h4'),
      description: px('.mission-card__description'),
      progressLabel: px('.mission-card__progress-copy'),
      progressValue: px('.mission-card__progress-copy strong'),
      pin: px('.mission-card__pin'),
      card: { x: card.x, right: card.right, top: card.top, bottom: card.bottom },
      children: [header, description, progress, footer].map(r => ({
        x: r.x, right: r.right, top: r.top, bottom: r.bottom,
      })),
      descriptionClipped: Boolean(descElement && descElement.scrollHeight > descElement.clientHeight + 3),
    };
  });

  expect(metrics.hero).toBeGreaterThanOrEqual(23);
  expect(metrics.intro).toBeGreaterThanOrEqual(14);
  expect(metrics.section).toBeGreaterThanOrEqual(18);
  expect(metrics.helper).toBeGreaterThanOrEqual(13);
  expect(metrics.category).toBeGreaterThanOrEqual(11);
  expect(metrics.cardHeading).toBeGreaterThanOrEqual(17);
  expect(metrics.description).toBeGreaterThanOrEqual(14);
  expect(metrics.progressLabel).toBeGreaterThanOrEqual(13);
  expect(metrics.progressValue).toBeGreaterThanOrEqual(14);
  expect(metrics.pin).toBeGreaterThanOrEqual(14);
  expect(metrics.section).toBeGreaterThan(metrics.cardHeading);
  expect(metrics.cardHeading).toBeGreaterThan(metrics.description);
  expect(metrics.description).toBeGreaterThan(metrics.category);
  expect(metrics.descriptionClipped).toBe(false);
  for (const [index, rect] of metrics.children.entries()) {
    expect(rect.x, `Card content ${index} left edge`).toBeGreaterThanOrEqual(metrics.card.x - 2);
    expect(rect.right, `Card content ${index} right edge`).toBeLessThanOrEqual(metrics.card.right + 2);
    expect(rect.top, `Card content ${index} top edge`).toBeGreaterThanOrEqual(metrics.card.top - 2);
    expect(rect.bottom, `Card content ${index} bottom edge`).toBeLessThanOrEqual(metrics.card.bottom + 2);
    if (index > 0) {
      expect(rect.top, `Card content ${index} should follow previous content`).toBeGreaterThanOrEqual(
        metrics.children[index - 1].bottom - 2,
      );
    }
  }
}

async function attachScreenshot(page: Page, info: TestInfo, filename: string): Promise<void> {
  const path = info.outputPath(filename);
  await page.screenshot({ path, animations: 'disabled' });
  await info.attach(filename, { path, contentType: 'image/png' });
}

test('Mission Journal desktop RTL: spacing, disclosure, keyboard and pin focus', async ({ page }, info) => {
  test.setTimeout(90_000);
  await openJournal(page, { width: 1280, height: 800 }, 'fa');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('#mission-journal-title')).toHaveText('دفتر مأموریت‌ها');
  await expect(page.locator('.mission-journal__disclosure')).toHaveCount(2);
  await expect(page.locator('.mission-journal__disclosure[open]')).toHaveCount(0);
  await expect(page.locator('.mission-journal__count')).toHaveCount(3);
  await expectContained(page);
  await expectReadableMissionTypography(page);

  const pin = page.locator('.mission-card__pin').first();
  const pinHeight = await pin.evaluate((el) => el.getBoundingClientRect().height);
  expect(pinHeight).toBeGreaterThanOrEqual(39);
  await attachScreenshot(page, info, 'mission-rtl-desktop.png');

  const details = page.locator('.mission-journal__disclosure').first();
  await details.locator('summary').click();
  await expect(details).toHaveAttribute('open', '');
  await attachScreenshot(page, info, 'mission-rtl-completed-expanded.png');

  await page.keyboard.press('Escape');
  await expect(page.locator('#mission-journal')).toBeHidden();
  await page.locator('#missions-button').evaluate((button) => (button as HTMLButtonElement).click());
  await expect(page.locator('#mission-journal')).toBeVisible();
  await page.locator('.mission-card__pin').first().click();
  await expect(page.locator('#mission-journal')).toBeHidden();
  await expect(page.locator('#missions-button')).toHaveAttribute('aria-expanded', 'false');
});

for (const viewport of [
  { width: 390, height: 844, name: 'portrait' },
  { width: 844, height: 390, name: 'landscape' },
  { width: 320, height: 568, name: 'narrow' },
]) {
  test(`Mission Journal RTL ${viewport.name}: bounded panel and readable touch targets`, async ({ page }, info) => {
    test.setTimeout(90_000);
    await openJournal(page, viewport, 'fa');
    await expectContained(page);
  await expectReadableMissionTypography(page);
    const closeHeight = await page.locator('.mission-journal__close').evaluate((el) => el.getBoundingClientRect().height);
    expect(closeHeight).toBeGreaterThanOrEqual(44);
    await attachScreenshot(page, info, `mission-rtl-${viewport.name}.png`);
    await page.locator('.mission-journal__disclosure').last().locator('summary').click();
    await expect(page.locator('.mission-journal__disclosure').last()).toHaveAttribute('open', '');
    await expectContained(page);
  await expectReadableMissionTypography(page);
  });
}

test('Mission Journal English: headings, progress labels and keyboard expansion', async ({ page }, info) => {
  test.setTimeout(90_000);
  await openJournal(page, { width: 1280, height: 800 }, 'en');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(page.locator('#mission-journal-title')).toHaveText('Mission Journal');
  await expect(page.locator('.mission-journal__summary-progress')).toHaveAttribute('aria-label', 'Overall mission progress');
  await expectContained(page);
  await expectReadableMissionTypography(page);
  await page.locator('.mission-journal__disclosure').last().locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.mission-journal__disclosure').last()).toHaveAttribute('open', '');
  await attachScreenshot(page, info, 'mission-english-locked-expanded.png');
});
