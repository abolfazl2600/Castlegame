/** Capture comparable screenshots and render metrics after `npm run build`. */
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { createVisualScene, REFERENCE_CAMERA, REFERENCE_SEED } from './visual-reference-scene.mjs';

const outFlag = process.argv.indexOf('--out');
const output = outFlag === -1 ? 'visual-baselines/current' : process.argv[outFlag + 1];
if (!output) throw new Error('Pass an output folder after --out');
const url = process.env.VISUAL_BASE_URL ?? 'http://127.0.0.1:4173/Castlegame/';
const local = !process.env.VISUAL_BASE_URL;
let server;

async function waitForServer() {
  for (let tries = 0; tries < 40; tries += 1) {
    try { if ((await fetch(url)).ok) return; } catch { /* server starting */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Preview did not become ready at ${url}`);
}

function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  return Number((sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0).toFixed(2));
}

async function sample(page) {
  return page.evaluate(async () => {
    const samples = [];
    let previous;
    await new Promise((resolve) => {
      const step = (now) => {
        if (previous !== undefined) {
          const getMetrics = window.__castleVisualMetrics;
          samples.push({ frameMs: now - previous, ...getMetrics() });
        }
        previous = now;
        if (samples.length < 120) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });
    return { samples, heapBytes: performance.memory?.usedJSHeapSize ?? null };
  });
}

async function loadScene(browser, sceneName, quality, viewport, camera, screenshotName) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const record = createVisualScene(sceneName);
  await page.addInitScript(({ save, graphicsQuality }) => {
    localStorage.setItem('castle-role.saves.v1.has-save', '1');
    localStorage.setItem('castle-role.saves.v1.autosave', JSON.stringify(save));
    localStorage.setItem('castle-role.settings.v2', JSON.stringify({
      schemaVersion: 2,
      graphics: { quality: graphicsQuality, performanceMode: 'balanced', environmentDetail: graphicsQuality,
        shadowsEnabled: true, effectsEnabled: true },
      interface: { reducedMotion: true, showHelp: false },
    }));
  }, { save: record, graphicsQuality: quality });
  await page.goto(new URL('?visualBaseline=1', url).href, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#toolbar [data-build-none]', { timeout: 30000 });
  await page.evaluate((position) => window.__castleVisualCamera(position), camera);
  await page.waitForTimeout(600);
  const { samples, heapBytes } = await sample(page);
  if (screenshotName) await page.screenshot({ path: `${output}/${screenshotName}.png` });
  await context.close();
  const frames = samples.map((value) => value.frameMs);
  const draws = samples.map((value) => value.drawCalls);
  const latest = samples.at(-1);
  return {
    scene: sceneName, quality, viewport, camera,
    frameMedianMs: percentile(frames, .5), frameP95Ms: percentile(frames, .95),
    estimatedFps: Number((1000 / percentile(frames, .5)).toFixed(1)),
    drawCallsMedian: percentile(draws, .5), triangles: latest.triangles,
    sceneGeometries: latest.sceneGeometries, sceneMaterials: latest.sceneMaterials,
    gpuGeometries: latest.gpuGeometries, gpuTextures: latest.gpuTextures,
    redrawMs: Number(latest.lastRedrawMs.toFixed(2)), heapBytes,
  };
}

try {
  await mkdir(output, { recursive: true });
  if (local) {
    server = spawn('npm', ['run', 'preview', '--', '--host', '127.0.0.1', '--port', '4173'], { stdio: 'ignore' });
    await waitForServer();
  }
  const browser = await chromium.launch({ headless: true, args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader'] });
  try {
    const desktop = { width: 1365, height: 900 };
    const mobile = { width: 390, height: 844 };
    const results = [];
    for (const quality of ['low', 'medium', 'high']) {
      for (const scene of ['empty', 'reference', 'dense']) {
        const capture = scene === 'reference' && quality === 'high' ? 'reference-normal-desktop' : null;
        results.push(await loadScene(browser, scene, quality, desktop, REFERENCE_CAMERA.normal, capture));
      }
    }
    for (const [view, camera] of Object.entries(REFERENCE_CAMERA)) {
      if (view === 'normal') continue;
      results.push(await loadScene(browser, 'reference', 'high', desktop, camera, `reference-${view}-desktop`));
    }
    results.push(await loadScene(browser, 'reference', 'high', mobile, REFERENCE_CAMERA.normal, 'reference-normal-mobile'));
    const report = { seed: REFERENCE_SEED, url, capturedAt: new Date().toISOString(), browser: browser.version(), results };
    await writeFile(`${output}/metrics.json`, JSON.stringify(report, null, 2) + '\n');
    console.log(`Saved ${results.length} measurements and four captures to ${output}`);
  } finally { await browser.close(); }
} finally { server?.kill(); }
