import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { SAVE_AUTOSAVE_KEY, SAVE_KEY, SAVE_VERSION } from '../src/core/constants';
import { translate } from '../src/i18n/localization';

// Stable small unified world: UI/RTL checks should not depend on heavyweight rendering.
async function openLocalizedGame(page: Page, width: number, height: number): Promise<void> {
  await page.setViewportSize({ width, height });
  await page.addInitScript(({ markerKey, autosaveKey, version }) => {
    const now = Date.now();
    localStorage.setItem(markerKey, '1');
    localStorage.setItem(autosaveKey, JSON.stringify({
      metadata: { id: 'fa-rtl-e2e', slot: 'autosave', name: 'Persian QA',
        createdAt: now, updatedAt: now, schemaVersion: version, gameMode: 'unified',
        summary: { buildings: 0, keeps: 0, terrainChanges: 0, elevations: 0 } },
      data: { version, gameMode: 'unified', updatedAt: now, worldSeeded: true,
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

test('Composed Harbor upgrade descriptions are fully localized in Persian', () => {
  expect(translate(
    'A substantial port with a stone quay, twin docking arms, roofed harbor buildings, cranes, lantern posts, and trading vessel facilities. Maximum harbor level reached.',
    'fa',
  )).toBe(
    'بندری بزرگ با بارانداز سنگی، دو بازوی پهلوگیری، ساختمان‌های سقف‌دار بندری، جرثقیل‌ها، چراغ‌های ساحلی و تجهیزات کشتی‌های بازرگانی. بندر به بالاترین سطح رسیده است.',
  );

  expect(translate(
    'A compact timber landing with simple mooring posts, basic cargo, and a fishing boat. Next: Fishing Wharf.',
    'fa',
  )).toBe(
    'اسکله کوچک چوبی با تیرک‌های ساده پهلوگیری، بار اولیه و قایق ماهیگیری. مرحله بعد: اسکله ماهیگیری.',
  );
});

test('bundled Persian font stays legible and available offline across language and viewport changes', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await openLocalizedGame(page, 1280, 800);

  const font = await page.evaluate(async () => {
    await document.fonts.load('600 18px "Castle Vazirmatn"', 'آسیاب بادی و کارگران ۱۲۳');
    await document.fonts.ready;
    const faces = Array.from(document.fonts).filter(face => face.family.replaceAll('"', '') === 'Castle Vazirmatn');
    const htmlFamily = getComputedStyle(document.documentElement).fontFamily;
    const buttonFamily = getComputedStyle(document.getElementById('settings-button')!).fontFamily;
    const detailsFamily = getComputedStyle(document.getElementById('world-selection-panel')!).fontFamily;
    return { faces: faces.length, loaded: faces.some(face => face.status === 'loaded'),
      htmlFamily, buttonFamily, detailsFamily,
      lineHeight: getComputedStyle(document.documentElement).lineHeight };
  });
  expect(font.faces).toBeGreaterThan(0);
  expect(font.loaded).toBe(true);
  for (const family of [font.htmlFamily, font.buttonFamily, font.detailsFamily]) {
    expect(family).toContain('Castle Vazirmatn');
  }
  expect(parseFloat(font.lineHeight)).toBeGreaterThan(1.4);

  await openSettings(page);
  await page.locator('[data-settings-nav="general"]').click();
  const language = page.locator('[data-setting="language"]');
  await language.selectOption('en');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  expect(await page.locator('html').evaluate(el => getComputedStyle(el).fontFamily)).not.toContain('Castle Vazirmatn');
  await language.selectOption('fa');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  expect(await page.locator('html').evaluate(el => getComputedStyle(el).fontFamily)).toContain('Castle Vazirmatn');
  await page.locator('#settings-close').click();
  for (const viewport of [{ width: 390, height: 844 }, { width: 915, height: 412 }]) {
    await page.setViewportSize(viewport);
    // Changing a desktop browser viewport is not equivalent to changing input
    // device capabilities. Touch layout is tested in a separate mobile context.
    await expect(page.locator('html')).toHaveAttribute('lang', 'fa');
    const computed = await page.locator('html').evaluate(el => ({
      family: getComputedStyle(el).fontFamily,
      eyebrowSpacing: getComputedStyle(document.querySelector('.eyebrow')!).letterSpacing,
    }));
    expect(computed.family).toContain('Castle Vazirmatn');
    expect(computed.eyebrowSpacing).toBe('normal');
    await captureEvidence(page, testInfo, `persian-font-${viewport.width}x${viewport.height}.png`);
  }
});

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

test('Settings overview, gameplay, graphics and data are fully Persian and right-aligned', async ({ page }) => {
  await openLocalizedGame(page, 1280, 800);
  await openSettings(page);

  const overview = page.locator('[data-settings-pane="overview"]');
  const resetWorld = overview.locator('[data-action="reset-world"]');
  await expect(resetWorld.locator('strong')).toHaveText('بازنشانی جهان');
  await expect(resetWorld.locator('small')).toHaveText('یک جهان تازه آغاز کنید و چیدمان نقشه را انتخاب کنید');
  expect(await resetWorld.evaluate(element => getComputedStyle(element).textAlign)).toBe('right');

  if (await page.locator('[data-settings-more]').getAttribute('aria-expanded') !== 'true') {
    await page.locator('[data-settings-more]').click();
  }
  await page.locator('[data-settings-nav="gameplay"]').click();
  const gameplay = page.locator('[data-settings-pane="gameplay"]');
  const controlRow = gameplay.locator('[data-setting="controlScheme"]').locator('xpath=..');
  await expect(controlRow.locator('.settings-control-copy small')).toHaveText(
    'فقط کنترل‌ها و چیدمان را تغییر می‌دهد؛ کیفیت گرافیک جداگانه تنظیم می‌شود.',
  );
  expect(await controlRow.locator('.settings-control-copy').evaluate(element => getComputedStyle(element).textAlign)).toBe('right');

  await page.locator('[data-settings-nav="graphics"]').click();
  const renderProfile = page.locator('[data-setting="performanceMode"]').locator('xpath=..');
  await expect(renderProfile.locator('.settings-control-copy strong')).toHaveText('پروفایل رندر');
  await expect(renderProfile.locator('.settings-control-copy small')).toHaveText(
    'حالت خودکار بر اساس نرخ فریم پایدار تنظیم می‌شود؛ حالت‌های دستی به کنترل لمسی وابسته نیستند.',
  );
  await expect(page.locator('[data-setting="performanceMode"] option[value="auto"]')).toHaveText('خودکار (تطبیقی)');

  if (await page.locator('[data-settings-more]').getAttribute('aria-expanded') !== 'true') {
    await page.locator('[data-settings-more]').click();
  }
  await page.locator('[data-settings-nav="data"]').click();
  const dataAction = page.locator('.settings-data-actions [data-action="open-privacy"]');
  await expect(dataAction.locator('span')).toHaveText('داده‌ها و حریم خصوصی');
  expect(await dataAction.evaluate(element => getComputedStyle(element).textAlign)).toBe('right');
});

test('Privacy panel and native Save prompt are localized; values remain separate', async ({ page }) => {
  await openLocalizedGame(page, 1280, 800);
  await openSettings(page);
  if (await page.locator('[data-settings-more]').getAttribute('aria-expanded') !== 'true') {
    await page.locator('[data-settings-more]').click();
  }
  await page.locator('[data-settings-nav="data"]').click();
  await expect(page.locator('#settings-privacy-legal')).toBeAttached({ timeout: 20_000 });
  await expect(page.locator('#privacy-policy h4')).toHaveText('سیاست حریم خصوصی');
  await expect(page.locator('#privacy-policy')).toContainText(
    translate('This information is stored locally on your device. It is not sent to a Castle Role server.', 'fa'),
  );
  await expect(page.locator('#data-storage .privacy-data-card').first().locator('strong'))
    .toHaveText(translate('Game saves', 'fa'));
  await expect(page.locator('#data-storage .privacy-data-card').first().locator('span'))
    .toHaveText(translate('Stored only on this device', 'fa'));

  await page.locator('[data-settings-nav="overview"]').click();
  await page.locator('[data-system-action="save"]').click();
  await expect(page.locator('#settings-modal')).toBeHidden();
  await expect(page.locator('.save-load-backdrop')).toBeVisible();
  await expect(page.locator('#save-load-title')).toHaveText('ذخیره بازی');
  await expect(page.locator('.save-load-backdrop .save-load-card').first()).toContainText('جایگاه ذخیره ۱');

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

test('Issue #320: dynamic build costs, selected levels and accessibility metadata survive live language switches', async ({ page }) => {
  // Full WebGL boot and multiple live locale transitions can take >45s on CI.
  test.setTimeout(90_000);
  await openLocalizedGame(page, 1280, 800);
  await expect(page.locator('#toolbar [data-build-none]')).toHaveCount(1);

  // Insert runtime-shaped controls after installLocalization has already run.
  await page.evaluate(() => {
    const toolbar = document.getElementById('toolbar');
    if (!toolbar) throw new Error('Build toolbar is unavailable');
    const probe = document.createElement('section');
    probe.id = 'issue-320-runtime-probe';
    probe.innerHTML = [
      '<button id="issue-320-upgrade" type="button" title="Upgrade Tower to Level 2 · Reinforced Tower · 12 wood + 8 stone" aria-label="Map sector 4, 7; press Enter to move camera">Upgrade to Level 2 · Improved Mosque · 12 wood + 8 stone</button>',
      '<span id="issue-320-selection">Level 3</span>',
      '<span id="issue-320-resources">Not enough resources to upgrade · need 12 wood + 8 stone</span>',
      '<span id="issue-320-storage">Storage cap 200 per resource</span>',
      '<input id="issue-320-search" aria-label="Search build tools" placeholder="Search tools…" />',
    ].join('');
    toolbar.appendChild(probe);
  });

  const button = page.locator('#issue-320-upgrade');
  await expect(button).toHaveText('ارتقا به سطح ۲ · مسجد بهبودیافته · ۱۲ چوب + ۸ سنگ');
  await expect(button).toHaveAttribute('title', 'ارتقای برج به سطح ۲ · برج مستحکم · ۱۲ چوب + ۸ سنگ');
  await expect(button).toHaveAttribute('aria-label', 'بخش نقشه ۴، ۷؛ برای جابه‌جایی دوربین Enter را بزنید');
  await expect(page.locator('#issue-320-selection')).toHaveText('سطح ۳');
  await expect(page.locator('#issue-320-resources')).toHaveText('منابع برای ارتقا کافی نیست · نیاز به ۱۲ چوب + ۸ سنگ');
  await expect(page.locator('#issue-320-storage')).toHaveText('ظرفیت انبار ۲۰۰ برای هر منبع');
  await expect(page.locator('#issue-320-search')).toHaveAttribute('placeholder', 'جست‌وجوی ابزارها…');

  await openSettings(page);
  await page.locator('[data-settings-nav="general"]').click();
  await page.locator('[data-setting="language"]').selectOption('en');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(button).toHaveText('Upgrade to Level 2 · Improved Mosque · 12 wood + 8 stone');
  await expect(button).toHaveAttribute('title', 'Upgrade Tower to Level 2 · Reinforced Tower · 12 wood + 8 stone');
  await expect(button).toHaveAttribute('aria-label', 'Map sector 4, 7; press Enter to move camera');
  await expect(page.locator('#issue-320-selection')).toHaveText('Level 3');
  await expect(page.locator('#issue-320-storage')).toHaveText('Storage cap 200 per resource');

  await page.locator('[data-setting="language"]').selectOption('fa');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(button).toHaveText('ارتقا به سطح ۲ · مسجد بهبودیافته · ۱۲ چوب + ۸ سنگ');
  await expect(button).toHaveAttribute('title', 'ارتقای برج به سطح ۲ · برج مستحکم · ۱۲ چوب + ۸ سنگ');
  await expect(page.locator('#issue-320-resources')).toHaveText('منابع برای ارتقا کافی نیست · نیاز به ۱۲ چوب + ۸ سنگ');

  // Repeat an attribute update while Persian is active: the observer must
  // preserve the new English source string for a later reverse switch.
  await button.evaluate(element => element.setAttribute('title', 'Storage cap 250 per resource'));
  await expect(button).toHaveAttribute('title', 'ظرفیت انبار ۲۵۰ برای هر منبع');
  await page.locator('[data-setting="language"]').selectOption('en');
  await expect(button).toHaveAttribute('title', 'Storage cap 250 per resource');

  await page.locator('#settings-close').click();
  await page.locator('#toolbar-close').click();
  await page.locator('#toolbar-open').click();
  await expect(page.locator('#toolbar')).not.toHaveClass(/is-collapsed/);
  // Synthetic probes are not owned by gameplay. Verify real Build controls after
  // reopening rather than requiring a particular lifetime for test-only nodes.
  await expect(page.locator('#build-search')).toHaveAttribute('placeholder', 'Search tools…');
  await expect(page.locator('#toolbar [data-build-none]')).toHaveCount(1);
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
  await expect(page.locator('.mobile-header [data-mobile-proxy="settings-button"]')).toBeVisible();

  // Save/Load/Templates are intentionally owned by Settings on the current mobile UI.
  // Reopen Settings and exercise the canonical Load action instead of a removed mobile-header proxy.
  await page.locator('.mobile-header [data-mobile-proxy="settings-button"]').click();
  await expect(page.locator('#settings-modal')).toBeVisible();
  await page.locator('[data-settings-nav="overview"]').click();
  await expect(page.locator('[data-system-action="load"]')).toBeVisible();
  await page.locator('[data-system-action="load"]').click();
  await expect(page.locator('#save-load-title')).toHaveText('بارگذاری بازی');
  await assertVisibleDialogInsideViewport(page, '.save-load-backdrop .help-modal');
  await captureEvidence(page, testInfo, 'mobile-portrait-load-fa.png');
});

test.describe('Persian Android landscape', () => {
  test.use({ hasTouch: true, isMobile: true });

  test('Build cards use local Persian font with compact labels and wrapping in portrait/landscape', async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    await openLocalizedGame(page, 390, 844);
    for (const viewport of [{ width: 390, height: 844 }, { width: 915, height: 412 }]) {
      await page.setViewportSize(viewport);
      await expect(page.locator('html')).toHaveClass(/mobile-ui-active/);
      if (await page.locator('#toolbar').evaluate(el => el.classList.contains('is-collapsed'))) {
        await page.locator('.mobile-header [data-mobile-proxy="toolbar-open"]').click();
      }
      const card = page.locator('#toolbar .tool-button:visible').first();
      await expect(card).toBeVisible();
      const copy = await card.evaluate(button => {
        const title = button.querySelector<HTMLElement>('.tool-copy strong');
        const description = button.querySelector<HTMLElement>('.tool-copy small');
        if (!title || !description) throw new Error('Build card title/description missing');
        const titleStyle = getComputedStyle(title);
        const captionStyle = getComputedStyle(description);
        const cardRect = button.getBoundingClientRect();
        return {
          titleSize: parseFloat(titleStyle.fontSize),
          captionSize: parseFloat(captionStyle.fontSize),
          titleFont: titleStyle.fontFamily,
          captionFont: captionStyle.fontFamily,
          titleWrap: titleStyle.whiteSpace,
          captionWrap: captionStyle.whiteSpace,
          captionClamp: captionStyle.webkitLineClamp,
          cardWidth: cardRect.width,
          viewportWidth: window.innerWidth,
        };
      });
      expect(copy.titleFont).toContain('Castle Vazirmatn');
      expect(copy.captionFont).toContain('Castle Vazirmatn');
      expect(copy.titleSize).toBeGreaterThanOrEqual(12);
      expect(copy.titleSize).toBeLessThanOrEqual(15.1);
      expect(copy.captionSize).toBeGreaterThanOrEqual(10);
      expect(copy.captionSize).toBeLessThanOrEqual(13.1);
      expect(copy.titleWrap).toBe('normal');
      expect(copy.captionWrap).toBe('normal');
      expect(copy.captionClamp).toBe('2');
      expect(copy.cardWidth).toBeLessThan(copy.viewportWidth);
      await captureEvidence(page, testInfo, `persian-build-font-${viewport.width}x${viewport.height}.png`);
    }
  });

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


test('Mission Journal translates cached cards, static labels and numerals on live language changes', async ({ page }) => {
  // This existing long-form scene and locale regression regularly approaches
  // the default 45s CI timeout before its final card-reuse check.
  test.setTimeout(90_000);
  await openLocalizedGame(page, 1280, 800);

  const journal = page.locator('#mission-journal');
  await expect(journal).toBeAttached();
  await page.locator('#missions-button').click();
  await expect(journal).toBeVisible();
  await expect(journal.locator('#mission-journal-title')).toHaveText('دفتر مأموریت‌ها');
  await expect(journal.locator('.mission-journal__intro')).toHaveText(translate(
    'Choose a focus, watch progress update in real time, and unlock the next layer of challenges as your settlement grows.',
    'fa',
  ));
  await expect(journal.locator('[data-mission-action="close"]')).toHaveAttribute('aria-label', translate('Close', 'fa'));
  await expect(journal.locator('[data-mission-i18n="Available objectives"]').first()).toHaveText('اهداف در دسترس');
  // Locate missions by their headings; priority changes can reorder the cards.
  await expect(journal.getByRole('heading', { name: translate('A Growing Settlement', 'fa'), exact: true })).toBeVisible();
  await expect(journal.getByRole('heading', { name: translate('First Homes', 'fa'), exact: true })).toBeVisible();
  await expect(journal.locator('.mission-journal__credits')).toContainText(translate('Royal Credits earned', 'fa'));
  await expect(journal.locator('.mission-journal__credits strong')).toHaveText('۰');
  await expect(journal.locator('.mission-card.is-pinned .mission-card__reward')).toContainText('پاداش: +۶۰ اعتبار سلطنتی');
  await expect(journal.locator('.mission-card__progress-copy strong').first()).toHaveText(/[۰-۹]+ \/ [۰-۹]+/);
  await expect(journal.locator('.mission-card__primary').first()).toContainText('هدف اصلی');

  // Change through real Settings controls, then reopen without changing mission progress.
  await journal.locator('[data-mission-action="close"]').click();
  await openSettings(page);
  await page.locator('[data-settings-nav="general"]').click();
  await page.locator('[data-setting="language"]').selectOption('en');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.locator('#settings-close').click();
  await page.locator('#missions-button').click();
  await expect(journal).toBeVisible();
  await expect(journal.locator('#mission-journal-title')).toHaveText('Mission Journal');
  await expect(journal.locator('.mission-journal__intro')).toHaveText(
    'Choose a focus, watch progress update in real time, and unlock the next layer of challenges as your settlement grows.',
  );
  await expect(journal.locator('[data-mission-action="close"]')).toHaveAttribute('aria-label', 'Close');
  await expect(journal.locator('[data-mission-i18n="Available objectives"]').first()).toHaveText('Available objectives');
  await expect(journal.getByRole('heading', { name: 'A Growing Settlement', exact: true })).toBeVisible();
  await expect(journal.getByRole('heading', { name: 'First Homes', exact: true })).toBeVisible();
  await expect(journal.locator('.mission-journal__credits')).toContainText('Royal Credits earned');
  await expect(journal.locator('.mission-journal__credits strong')).toHaveText('0');
  await expect(journal.locator('.mission-card.is-pinned .mission-card__reward')).toContainText('Reward: +60 Royal Credits');
  await expect(journal.locator('.mission-card__progress-copy strong').first()).toHaveText(/[0-9]+ \/ [0-9]+/);
  await expect(journal.locator('.mission-card__primary').first()).toContainText('Primary objective');

  // Exercise the same Settings change event with the journal still open.
  // This covers visible content, even if the game render loop is paused.
  await page.locator('[data-setting="language"]').evaluate((input) => {
    if (!(input instanceof HTMLSelectElement)) throw new Error('Language select is missing');
    input.value = 'fa';
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect(page.locator('html')).toHaveAttribute('lang', 'fa');
  await expect(journal.locator('#mission-journal-title')).toHaveText('دفتر مأموریت‌ها');
  await expect(journal.locator('[data-mission-i18n="Available objectives"]').first()).toHaveText('اهداف در دسترس');
  await expect(journal.getByRole('heading', { name: translate('A Growing Settlement', 'fa'), exact: true })).toBeVisible();
  await expect(journal.getByRole('heading', { name: translate('First Homes', 'fa'), exact: true })).toBeVisible();
  await expect(journal.locator('.mission-journal__credits')).toContainText(translate('Royal Credits earned', 'fa'));
  await expect(journal.locator('.mission-card.is-pinned .mission-card__reward')).toContainText('پاداش: +۶۰ اعتبار سلطنتی');
  await expect(journal.locator('.mission-card__progress-copy strong').first()).toHaveText(/[۰-۹]+ \/ [۰-۹]+/);
  await expect(journal.locator('.mission-card__primary').first()).toContainText('هدف اصلی');
  await expect(journal.locator('[data-mission-action="close"]')).toHaveAttribute('aria-label', translate('Close', 'fa'));

  // Unchanged view/state should still reuse the rendered cards between routine ticks.
  await journal.locator('.mission-card').first().evaluate((card) => card.setAttribute('data-render-probe', 'retained'));
  await page.waitForTimeout(700);
  await expect(journal.locator('.mission-card').first()).toHaveAttribute('data-render-probe', 'retained');
});
