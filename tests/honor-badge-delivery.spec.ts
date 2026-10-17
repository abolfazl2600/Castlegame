import { createHash } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';

const root = 'https://raw.githubusercontent.com/abolfazl2600/Castlegame/main/honor-badges/';
const catalogUrl = root + 'catalog.v1.json';
const imageUrl = root + 'assets/royal-architect.png';
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO9oNs8AAAAASUVORK5CYII=',
  'base64',
);
const checksum = createHash('sha256').update(png).digest('hex');
const example = {
  id: 'royal-architect',
  name: { en: 'Royal Architect', fa: 'معمار سلطنتی' },
  description: { en: 'Test only', fa: 'فقط آزمایش' },
  assetPath: 'assets/royal-architect.png',
  mimeType: 'image/png',
  sha256: checksum,
};
const manifest = { schemaVersion: 1, badges: [example] };

async function begin(page: Page): Promise<void> {
  await page.goto('/Castlegame/', { waitUntil: 'domcontentloaded' });
}

async function interceptCatalog(page: Page, payload: unknown = manifest): Promise<void> {
  await page.route(catalogUrl, async route => {
    await route.fulfill({
      status: 200, body: JSON.stringify(payload),
      headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
    });
  });
}

async function interceptImage(page: Page, payload: Buffer = png): Promise<void> {
  await page.route(imageUrl, async route => {
    await route.fulfill({
      status: 200, body: payload,
      headers: { 'content-type': 'image/png', 'access-control-allow-origin': '*' },
    });
  });
}

test('requires GitHub for first artwork, then persists the verified file offline', async ({ page }) => {
  await interceptCatalog(page);
  await interceptImage(page);
  await begin(page);
  const result = await page.evaluate(async () => {
    const path = '/Castlegame/src/honors/HonorBadgeRepository.ts';
    const { HonorBadgeRepository } = await import(/* @vite-ignore */ path);
    const repository = new HonorBadgeRepository();
    const initial = await repository.getDownloaded('royal-architect');
    const remote = await repository.loadCatalog();
    const installed = await repository.download('royal-architect');
    const reused = await repository.download('royal-architect');
    return {
      initiallyAbsent: initial === null,
      catalogSource: remote.source,
      downloaded: installed.status,
      cached: reused.status,
      size: installed.badge.image.size,
    };
  });
  expect(result).toMatchObject({
    initiallyAbsent: true, catalogSource: 'network',
    downloaded: 'downloaded', cached: 'cached', size: png.byteLength,
  });

  await page.unroute(catalogUrl);
  await page.unroute(imageUrl);
  await page.context().setOffline(true);
  const offline = await page.evaluate(async () => {
    const path = '/Castlegame/src/honors/HonorBadgeRepository.ts';
    const { HonorBadgeRepository } = await import(/* @vite-ignore */ path);
    const afterRestart = new HonorBadgeRepository();
    const manifest = await afterRestart.loadCatalog();
    const badge = await afterRestart.getDownloaded('royal-architect');
    const listing = await afterRestart.listDownloaded();
    return { source: manifest.source, imageBytes: badge?.image.size, number: listing.length, id: badge?.id };
  });
  expect(offline).toEqual({
    source: 'cached', imageBytes: png.byteLength, number: 1, id: 'royal-architect',
  });
});

test('never presents artwork to a first-time offline user', async ({ page }) => {
  await begin(page);
  // Load the app code while online, then switch the network off. A native APK
  // already bundles executable JS; only honor artwork must require internet.
  await page.evaluate(async () => {
    const path = '/Castlegame/src/honors/HonorBadgeRepository.ts';
    await import(/* @vite-ignore */ path);
  });
  await page.context().setOffline(true);
  const result = await page.evaluate(async () => {
    const path = '/Castlegame/src/honors/HonorBadgeRepository.ts';
    const { HonorBadgeRepository } = await import(/* @vite-ignore */ path);
    const repo = new HonorBadgeRepository();
    const c = await repo.loadCatalog();
    const local = await repo.getDownloaded('royal-architect');
    let code: string | undefined;
    try { await repo.download('royal-architect'); }
    catch (error) { code = (error as { code?: string }).code; }
    return { source: c.source, catalog: c.catalog, local, code };
  });
  expect(result).toEqual({
    source: 'unavailable', catalog: null, local: null, code: 'catalog_unavailable',
  });
});

test('rejects a tampered download without persisting or rendering it', async ({ page }) => {
  await interceptCatalog(page);
  const changed = Buffer.from(png);
  changed[changed.length - 8] ^= 0x01;
  await interceptImage(page, changed);
  await begin(page);
  const result = await page.evaluate(async () => {
    const path = '/Castlegame/src/honors/HonorBadgeRepository.ts';
    const { HonorBadgeRepository } = await import(/* @vite-ignore */ path);
    const repo = new HonorBadgeRepository();
    let code: string | undefined;
    try { await repo.download('royal-architect'); }
    catch (error) { code = (error as { code?: string }).code; }
    return { code, saved: await repo.getDownloaded('royal-architect') };
  });
  expect(result).toEqual({ code: 'integrity_failed', saved: null });
});

test('rejects unsafe relative paths and external artwork URLs', async ({ page }) => {
  await interceptCatalog(page, { schemaVersion: 1, badges: [{ ...example, assetPath: '../../other-image.png' }] });
  await begin(page);
  const result = await page.evaluate(async () => {
    const path = '/Castlegame/src/honors/HonorBadgeRepository.ts';
    const { HonorBadgeRepository } = await import(/* @vite-ignore */ path);
    const repository = new HonorBadgeRepository();
    return await repository.loadCatalog();
  });
  expect(result).toEqual({ source: 'unavailable', catalog: null });
});

test('offline catalog metadata alone does not award or cache the image', async ({ page }) => {
  await interceptCatalog(page);
  await begin(page);
  const online = await page.evaluate(async () => {
    const path = '/Castlegame/src/honors/HonorBadgeRepository.ts';
    const { HonorBadgeRepository } = await import(/* @vite-ignore */ path);
    return new HonorBadgeRepository().loadCatalog();
  });
  expect(online.source).toBe('network');
  await page.unroute(catalogUrl);
  await page.context().setOffline(true);
  const state = await page.evaluate(async () => {
    const path = '/Castlegame/src/honors/HonorBadgeRepository.ts';
    const { HonorBadgeRepository } = await import(/* @vite-ignore */ path);
    const repo = new HonorBadgeRepository();
    const catalog = await repo.loadCatalog();
    const cached = await repo.getDownloaded('royal-architect');
    let code: string | undefined;
    try { await repo.download('royal-architect'); }
    catch (error) { code = (error as { code?: string }).code; }
    return { catalog: catalog.source, count: catalog.catalog?.badges.length, cached, code };
  });
  expect(state).toEqual({ catalog: 'cached', count: 1, cached: null, code: 'download_unavailable' });
});

test('gallery silently loads all badges, dims locked ones, and shows earned honor without technical copy', async ({ page }) => {
  const examples = [
    { id: 'royal-architect', assetPath: 'assets/royal-architect.png' },
    { id: 'harvest-steward', assetPath: 'assets/harvest-steward.png' },
    { id: 'stone-bastion', assetPath: 'assets/stone-bastion.png' },
    { id: 'prosperous-realm', assetPath: 'assets/prosperous-realm.png' },
  ];
  await interceptCatalog(page, { schemaVersion: 1, badges: examples.map(b => ({ ...example, ...b })) });
  const requests: string[] = [];
  for (const badge of examples) {
    await page.route(root + badge.assetPath, async route => {
      requests.push(route.request().url());
      await route.fulfill({
        status: 200, body: png,
        headers: { 'content-type': 'image/png', 'access-control-allow-origin': '*' },
      });
    });
  }
  await begin(page);
  await page.evaluate(async () => {
    const path = '/Castlegame/src/honors/HonorGalleryUI.ts';
    const { HonorGalleryUI } = await import(/* @vite-ignore */ path);
    const gallery = new HonorGalleryUI();
    const host = document.createElement('section');
    host.id = 'honor-fixture';
    document.body.appendChild(host);
    gallery.mount(host);
    const state = window as typeof window & { __honorGallery?: InstanceType<typeof HonorGalleryUI> };
    state.__honorGallery = gallery;
    gallery.render({ completed: [], active: [], locked: [] } as never);
    gallery.open();
  });
  const host = page.locator('#honor-fixture');
  await expect(host.locator('.honor-card.is-locked')).toHaveCount(4);
  await expect(host.locator('.honor-card img')).toHaveCount(4);
  await expect(host.locator('.honor-card__lock')).toHaveCount(4);
  expect(new Set(requests).size).toBe(4);
  const source = await host.locator('.honor-card img').evaluateAll(imgs =>
    imgs.map(el => ({ src: (el as HTMLImageElement).src, filter: getComputedStyle(el).filter })));
  for (const image of source) {
    expect(image.src).toMatch(/^blob:/);
    expect(image.filter).toContain('grayscale(1)');
  }
  await expect(host).not.toContainText(/دانلود|آفلاین|اینترنت|GitHub|download|offline|internet/i);
  await expect(host.locator('button')).toHaveCount(0);

  await page.evaluate(() => {
    const state = window as typeof window & { __honorGallery: { render(view: unknown): void } };
    state.__honorGallery.render({
      completed: [{ definition: { id: 'growth-ten-homes', description: 'Build ten houses' } }],
      active: [], locked: [],
    });
  });
  await expect(host.locator('.honor-card--featured.is-earned')).toHaveCount(1);
  await expect(host.locator('.honor-card.is-locked')).toHaveCount(3);
  await expect(host.locator('.honor-card--featured img')).toHaveAttribute('src', /^blob:/);
  const featuredFilter = await host.locator('.honor-card--featured img')
    .evaluate(el => getComputedStyle(el).filter);
  expect(featuredFilter).toBe('none');
  expect(requests).toHaveLength(4);

  // The same four images remain visible on a fresh gallery instance offline.
  await page.context().setOffline(true);
  await page.evaluate(async () => {
    const path = '/Castlegame/src/honors/HonorGalleryUI.ts';
    const { HonorGalleryUI } = await import(/* @vite-ignore */ path);
    const state = window as typeof window & { __honorGallery?: InstanceType<typeof HonorGalleryUI> };
    state.__honorGallery?.dispose();
    document.getElementById('honor-fixture')?.remove();
    const host = document.createElement('section');
    host.id = 'honor-fixture';
    document.body.appendChild(host);
    const fresh = new HonorGalleryUI();
    fresh.mount(host);
    fresh.render({
      completed: [{ definition: { id: 'growth-ten-homes', description: 'Build ten houses' } }],
      active: [], locked: [],
    } as never);
    state.__honorGallery = fresh;
    fresh.open();
  });
  await expect(page.locator('#honor-fixture .honor-card img')).toHaveCount(4);
  await expect(page.locator('#honor-fixture .honor-card--featured img')).toHaveAttribute('src', /^blob:/);
  expect(requests).toHaveLength(4);
});

test('first-time offline gallery keeps all four award cards visible but never invents artwork', async ({ page }) => {
  await begin(page);
  await page.evaluate(async () => {
    const path = '/Castlegame/src/honors/HonorGalleryUI.ts';
    await import(/* @vite-ignore */ path);
  });
  await page.context().setOffline(true);
  await page.evaluate(async () => {
    const path = '/Castlegame/src/honors/HonorGalleryUI.ts';
    const { HonorGalleryUI } = await import(/* @vite-ignore */ path);
    const gallery = new HonorGalleryUI();
    const host = document.createElement('section');
    host.id = 'honor-fixture';
    document.body.appendChild(host);
    gallery.mount(host);
    gallery.render({ completed: [], active: [], locked: [] } as never);
    gallery.open();
  });
  const host = page.locator('#honor-fixture');
  await expect(host.locator('.honor-card')).toHaveCount(4);
  await expect(host.locator('.honor-card img')).toHaveCount(0);
  await expect(host.locator('.honor-card__placeholder')).toHaveCount(4);
  await expect(host).not.toContainText(/دانلود|آفلاین|اینترنت|GitHub|download|offline|internet/i);
});
