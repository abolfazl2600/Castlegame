import { expect, test, type CDPSession, type Page } from '@playwright/test';
import { SAVE_AUTOSAVE_KEY, SAVE_KEY, SAVE_VERSION } from '../src/core/constants';

test.use({ hasTouch: true, isMobile: true, viewport: { width: 915, height: 412 } });
interface QA {
  camera: number[]; target: number[]; distance: number; minDistance: number; maxDistance: number;
  cells: unknown[]; elevations: unknown[]; moatTasks: Array<{ x: number; y: number; progressMs: number }>; undoCount: number; pointers: number[]; dragging: boolean; preview: number;
}
const state = (page: Page): Promise<QA> => page.evaluate(() =>
  (window as unknown as { __castleTouchQA: () => QA }).__castleTouchQA());
const finger = (id: number, x: number, y = 245) => ({ id, x, y, radiusX: 2, radiusY: 2, force: 1 });
const dispatch = (cdp: CDPSession, type: string, touchPoints: ReturnType<typeof finger>[]) =>
  cdp.send('Input.dispatchTouchEvent', { type, touchPoints });
async function chooseTool(page: Page, tool: string): Promise<void> {
  // This suite tests world pointer ownership, not category layout. Use the same
  // delegated tool buttons while avoiding viewport-dependent category scrolling.
  await page.locator(`[data-tool="${tool}"]`).evaluate((node) => (node as HTMLButtonElement).click());
  await page.locator('#toolbar-close').evaluate((node) => (node as HTMLButtonElement).click());
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(({ markerKey, autosaveKey, version }) => {
    const now = Date.now(); localStorage.setItem(markerKey, '1');
    localStorage.setItem('castle-role.settings.v2', JSON.stringify({ schemaVersion: 2,
      gameplay: { controlScheme: 'touch', tutorialCompleted: true },
      graphics: { quality: 'low', effectsEnabled: false, shadowsEnabled: false, performanceMode: 'performance', environmentDetail: 'low' },
      audio: { muted: true }, interface: { language: 'en', reducedMotion: true } }));
    localStorage.setItem(autosaveKey, JSON.stringify({ metadata: { id: 'touch-112', slot: 'autosave', name: 'Touch QA',
      createdAt: now, updatedAt: now, schemaVersion: version, gameMode: 'unified',
      summary: { buildings: 0, keeps: 0, terrainChanges: 0, elevations: 0 } },
      data: { version, gameMode: 'unified', updatedAt: now, worldSeeded: true, cells: [], keeps: [],
        towerBridges: [], terrain: [], elevations: [], stoneStyle: 'limestone' } }));
  }, { markerKey: SAVE_KEY, autosaveKey: SAVE_AUTOSAVE_KEY, version: SAVE_VERSION });
  await page.goto('/Castlegame/?touchQA', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#toolbar [data-build-none]')).toHaveCount(1, { timeout: 30_000 });
  await page.waitForFunction(() => typeof (window as unknown as { __castleTouchQA?: unknown }).__castleTouchQA === 'function');
});

for (const tool of ['wall1', 'road', 'raise', 'moat']) {
  test(`${tool}: native touch drag → pinch → remaining finger never commits`, async ({ page }, info) => {
    await chooseTool(page, tool);
    const before = await state(page);
    const cdp = await page.context().newCDPSession(page);
    await dispatch(cdp, 'touchStart', [finger(1, 470)]);
    await dispatch(cdp, 'touchMove', [finger(1, 485)]);
    if (tool === 'raise') expect((await state(page)).elevations.length).toBeGreaterThan(before.elevations.length);
    await dispatch(cdp, 'touchStart', [finger(1, 485), finger(2, 685)]);
    const joined = await state(page);
    expect(joined.elevations).toEqual(before.elevations);
    expect(joined.distance).toBeCloseTo(before.distance, 5); // Finger addition itself must not jump.
    await dispatch(cdp, 'touchMove', [finger(1, 450), finger(2, 720)]);
    expect((await state(page)).distance).toBeLessThan(joined.distance);
    const zoomed = await state(page);
    await dispatch(cdp, 'touchEnd', [finger(1, 450)]);
    expect((await state(page)).distance).toBeCloseTo(zoomed.distance, 5);
    await dispatch(cdp, 'touchMove', [finger(1, 470)]);
    await dispatch(cdp, 'touchEnd', []);
    const after = await state(page);
    expect(after.cells).toEqual(before.cells); expect(after.elevations).toEqual(before.elevations);
    expect(after.undoCount).toBe(before.undoCount); expect(after.pointers).toEqual([]);
    expect(after.dragging).toBe(false); expect(after.preview).toBe(0);
    await info.attach('touch-result.json', { body: JSON.stringify({ before, after }), contentType: 'application/json' });
    // A genuinely new single-finger stroke still works after multi-touch.
    if (tool === 'raise') {
      await dispatch(cdp, 'touchStart', [finger(3, 470)]); await dispatch(cdp, 'touchEnd', []);
      expect((await state(page)).undoCount).toBe(before.undoCount + 1);
    }
  });
}

test('moat: native single-finger drag queues an atomic connected route and Undo removes it', async ({ page }) => {
  await chooseTool(page, 'moat');
  const before = await state(page);
  const locations = await page.evaluate(() => {
    const probe = (window as unknown as {
      __castleMoatProbe: (x: number, y: number) => { x: number; y: number; status: string } | null;
    }).__castleMoatProbe;
    const byGrid = new Map<string, { screenX: number; screenY: number; gridX: number; gridY: number }>();
    for (let y = 160; y <= 320; y += 10) {
      for (let x = 230; x <= 760; x += 10) {
        const tile = probe(x, y);
        if (!tile || tile.status !== 'new') continue;
        const key = `${tile.x},${tile.y}`;
        if (!byGrid.has(key)) byGrid.set(key, { screenX: x, screenY: y, gridX: tile.x, gridY: tile.y });
      }
    }
    for (const first of byGrid.values()) {
      for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
        const second = byGrid.get(`${first.gridX + dx},${first.gridY + dy}`);
        if (!second) continue;
        const distance = Math.hypot(first.screenX - second.screenX, first.screenY - second.screenY);
        if (distance >= 12 && distance <= 100) return { first, second };
      }
    }
    return null;
  });
  expect(locations, 'a world terrain pair suitable for one continuous moat stroke must exist').not.toBeNull();
  const { first, second } = locations!;
  const cdp = await page.context().newCDPSession(page);
  await dispatch(cdp, 'touchStart', [finger(1, first.screenX, first.screenY)]);
  await dispatch(cdp, 'touchMove', [finger(1, second.screenX, second.screenY)]);
  const preview = await state(page);
  expect(preview.dragging).toBe(true);
  expect(preview.preview).toBeGreaterThan(0);
  expect(preview.moatTasks).toEqual(before.moatTasks);
  await dispatch(cdp, 'touchEnd', []);
  const queued = await state(page);
  expect(queued.dragging).toBe(false);
  expect(queued.preview).toBe(0);
  expect(queued.moatTasks.length).toBeGreaterThan(before.moatTasks.length);
  expect(queued.undoCount).toBe(before.undoCount + 1);
  const tileKeys = new Set(queued.moatTasks.map(({ x, y }) => `${x},${y}`));
  expect(tileKeys.size).toBe(queued.moatTasks.length, 'a dragged path must not double schedule tiles');

  await page.locator('#header-undo-button').evaluate((element) => (element as HTMLButtonElement).click());
  const undone = await state(page);
  expect(undone.moatTasks).toEqual(before.moatTasks);
  expect(undone.cells).toEqual(before.cells);
});

test('native pointer cancellation rolls terrain back; the next stroke commits once', async ({ page }) => {
  await chooseTool(page, 'raise'); const before = await state(page);
  const cdp = await page.context().newCDPSession(page);
  await dispatch(cdp, 'touchStart', [finger(1, 470)]);
  expect((await state(page)).elevations.length).toBeGreaterThan(before.elevations.length);
  await dispatch(cdp, 'touchCancel', []);
  const cancelled = await state(page);
  expect(cancelled.elevations).toEqual(before.elevations); expect(cancelled.undoCount).toBe(before.undoCount);
  expect(cancelled.pointers).toEqual([]); expect(cancelled.dragging).toBe(false);
  await dispatch(cdp, 'touchStart', [finger(2, 470)]); await dispatch(cdp, 'touchEnd', []);
  expect((await state(page)).undoCount).toBe(before.undoCount + 1);
});

test('tap → pan → original position cannot become a build tap', async ({ page }) => {
  await chooseTool(page, 'tower'); const before = await state(page);
  const cdp = await page.context().newCDPSession(page);
  await dispatch(cdp, 'touchStart', [finger(1, 470)]);
  await dispatch(cdp, 'touchMove', [finger(1, 560)]);
  expect((await state(page)).camera).not.toEqual(before.camera);
  await dispatch(cdp, 'touchMove', [finger(1, 470)]); await dispatch(cdp, 'touchEnd', []);
  expect((await state(page)).cells).toEqual(before.cells);
  expect((await state(page)).undoCount).toBe(before.undoCount);
});

test('pinch zoom remains within release bounds during repeated extreme gestures', async ({ page }) => {
  await page.locator('#toolbar-close').evaluate((node) => (node as HTMLButtonElement).click());
  const cdp = await page.context().newCDPSession(page);
  for (const spread of [true, false, true, false]) {
    const start = spread ? [finger(1, 480), finger(2, 490)] : [finger(1, 330), finger(2, 860)];
    const end = spread ? [finger(1, 330), finger(2, 860)] : [finger(1, 480), finger(2, 490)];
    await dispatch(cdp, 'touchStart', start); await dispatch(cdp, 'touchMove', end); await dispatch(cdp, 'touchEnd', []);
    const current = await state(page);
    expect(current.distance).toBeGreaterThanOrEqual(current.minDistance - 0.001);
    expect(current.distance).toBeLessThanOrEqual(current.maxDistance + 0.001);
    expect(current.camera.every(Number.isFinite)).toBe(true);
    expect(current.pointers).toEqual([]);
  }
});

test('touches starting on UI do not enter world camera/build input', async ({ page }) => {
  await chooseTool(page, 'wall1'); const before = await state(page);
  await page.locator('.mobile-header [data-mobile-proxy="settings-button"]').tap();
  await expect(page.locator('#settings-modal')).toBeVisible();
  const after = await state(page);
  expect(after.camera).toEqual(before.camera); expect(after.cells).toEqual(before.cells);
  expect(after.pointers).toEqual([]);
});
