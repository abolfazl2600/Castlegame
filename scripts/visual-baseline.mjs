/** Capture comparable screenshots and render metrics after `npm run build`.
 * Phase-5 audit includes representative dense settlement, combat, mobile UI,
 * graphics-quality, effects-disabled, and reduced-motion scenarios.
 */
import { spawn } from 'node:child_process';
import os from 'node:os';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { createVisualScene, REFERENCE_CAMERA, REFERENCE_SEED } from './visual-reference-scene.mjs';

const outFlag = process.argv.indexOf('--out');
const output = outFlag === -1 ? 'visual-baselines/current' : process.argv[outFlag + 1];
if (!output) throw new Error('Pass an output folder after --out');
const url = process.env.VISUAL_BASE_URL ?? 'http://127.0.0.1:4173/Castlegame/';
const local = !process.env.VISUAL_BASE_URL;
let server;

const BATTLE_SETUP = {
  attackerSwordsmen: 12,
  attackerArchers: 8,
  attackerSpearmen: 8,
  attackerCrossbowmen: 4,
  attackerModernSoldiers: 0,
  defenderSwordsmen: 10,
  defenderArchers: 8,
  defenderSpearmen: 8,
  defenderCrossbowmen: 4,
  defenderModernSoldiers: 0,
};

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
          const getMetrics = window.__castleVisualFrame;
          samples.push({ frameMs: now - previous, ...getMetrics() });
        }
        previous = now;
        if (samples.length < 120) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });
    return {
      samples,
      resources: window.__castleVisualMetrics(),
      heapBytes: performance.memory?.usedJSHeapSize ?? null,
      runtime: {
        userAgent: navigator.userAgent,
        hardwareConcurrency: navigator.hardwareConcurrency ?? null,
        deviceMemoryGb: navigator.deviceMemory ?? null,
      },
    };
  });
}

async function startRepresentativeBattle(page) {
  await page.evaluate(() => document.querySelector('#battle-button')?.click());
  for (const [field, value] of Object.entries(BATTLE_SETUP)) {
    const input = page.locator(`[data-battle-input="${field}"]`);
    await input.fill(String(value));
    await input.dispatchEvent('change');
  }
  await page.evaluate(() => document.querySelector('#battle-start')?.click());
  await page.waitForFunction(() => document.querySelector('#battle-mode-status')?.textContent?.includes('BATTLE IN PROGRESS'));
  await page.evaluate(() => document.querySelector('#battle-close')?.click());
  // Let both factions leave their spawn points so silhouettes, projectiles and impacts are represented.
  await page.waitForTimeout(1800);
}

async function loadScene(browser, {
  sceneName,
  quality,
  viewport,
  camera,
  screenshotName = null,
  reducedMotion = false,
  effectsEnabled = true,
  battle = false,
  showBattlePanel = false,
}) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    reducedMotion: reducedMotion ? 'reduce' : 'no-preference',
  });
  const page = await context.newPage();
  const record = createVisualScene(sceneName);
  await page.addInitScript(({ save, graphicsQuality, reduceMotion, effects }) => {
    localStorage.setItem('castle-role.saves.v1.has-save', '1');
    localStorage.setItem('castle-role.saves.v1.autosave', JSON.stringify(save));
    localStorage.setItem('castle-role.settings.v2', JSON.stringify({
      schemaVersion: 2,
      graphics: { quality: graphicsQuality, performanceMode: 'balanced', environmentDetail: graphicsQuality,
        shadowsEnabled: true, effectsEnabled: effects },
      interface: { reducedMotion: reduceMotion, showHelp: false },
    }));
  }, { save: record, graphicsQuality: quality, reduceMotion: reducedMotion, effects: effectsEnabled });
  await page.goto(new URL('?visualBaseline=1', url).href, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#toolbar [data-build-none]', { timeout: 30000 });
  await page.evaluate((position) => window.__castleVisualCamera(position), camera);

  if (battle) await startRepresentativeBattle(page);
  if (showBattlePanel) {
    await page.evaluate(() => document.querySelector('#battle-button')?.click());
    await page.waitForSelector('#battle-panel:not([hidden])');
  }

  await page.waitForTimeout(600);
  const { samples, resources, heapBytes, runtime } = await sample(page);
  if (screenshotName) await page.screenshot({ path: `${output}/${screenshotName}.png` });

  const battleState = battle ? await page.evaluate(() => ({
    mode: document.querySelector('#battle-mode-status')?.textContent ?? null,
    attackersAlive: Number(document.querySelector('#battle-attacker-alive')?.textContent ?? 0),
    defendersAlive: Number(document.querySelector('#battle-defender-alive')?.textContent ?? 0),
  })) : null;

  await context.close();
  const frames = samples.map((value) => value.frameMs);
  const draws = samples.map((value) => value.drawCalls);
  const latest = samples.at(-1);
  return {
    scenario: battle ? 'combat' : sceneName,
    scene: sceneName,
    quality,
    effectsEnabled,
    reducedMotion,
    viewport,
    camera,
    battleState,
    screenshot: screenshotName ? `${screenshotName}.png` : null,
    frameMedianMs: percentile(frames, .5),
    frameP95Ms: percentile(frames, .95),
    estimatedFps: Number((1000 / percentile(frames, .5)).toFixed(1)),
    drawCallsMedian: percentile(draws, .5),
    triangles: latest.triangles,
    sceneGeometries: resources.sceneGeometries,
    sceneMaterials: resources.sceneMaterials,
    gpuGeometries: resources.gpuGeometries,
    gpuTextures: resources.gpuTextures,
    redrawMs: Number(resources.lastRedrawMs.toFixed(2)),
    heapBytes,
    pixelRatio: resources.pixelRatio,
    drawingBuffer: resources.drawingBuffer,
    gpu: resources.gpu,
    runtime,
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
      for (const sceneName of ['empty', 'reference', 'dense']) {
        let screenshotName = null;
        if (quality === 'high' && sceneName === 'reference') screenshotName = 'reference-normal-desktop';
        if (quality === 'high' && sceneName === 'dense') screenshotName = 'dense-normal-desktop';
        results.push(await loadScene(browser, {
          sceneName,
          quality,
          viewport: desktop,
          camera: REFERENCE_CAMERA.normal,
          screenshotName,
        }));
      }
    }

    for (const [view, camera] of Object.entries(REFERENCE_CAMERA)) {
      if (view === 'normal') continue;
      results.push(await loadScene(browser, {
        sceneName: 'reference',
        quality: 'high',
        viewport: desktop,
        camera,
        screenshotName: `reference-${view}-desktop`,
      }));
    }

    results.push(await loadScene(browser, {
      sceneName: 'reference',
      quality: 'high',
      viewport: mobile,
      camera: REFERENCE_CAMERA.normal,
      screenshotName: 'reference-normal-mobile',
    }));

    for (const quality of ['low', 'medium', 'high']) {
      results.push(await loadScene(browser, {
        sceneName: 'reference',
        quality,
        viewport: desktop,
        camera: REFERENCE_CAMERA.near,
        screenshotName: quality === 'high' ? 'combat-normal-desktop' : null,
        battle: true,
      }));
    }

    results.push(await loadScene(browser, {
      sceneName: 'reference',
      quality: 'high',
      viewport: desktop,
      camera: REFERENCE_CAMERA.near,
      screenshotName: 'combat-reduced-motion-desktop',
      battle: true,
      reducedMotion: true,
    }));

    results.push(await loadScene(browser, {
      sceneName: 'reference',
      quality: 'high',
      viewport: desktop,
      camera: REFERENCE_CAMERA.near,
      battle: true,
      effectsEnabled: false,
    }));

    results.push(await loadScene(browser, {
      sceneName: 'reference',
      quality: 'high',
      viewport: mobile,
      camera: REFERENCE_CAMERA.near,
      screenshotName: 'combat-panel-mobile',
      battle: true,
      showBattlePanel: true,
    }));

    const first = results[0];
    const report = {
      schemaVersion: 2,
      seed: REFERENCE_SEED,
      url,
      capturedAt: new Date().toISOString(),
      source: {
        gitSha: process.env.GITHUB_SHA ?? null,
        gitRef: process.env.GITHUB_REF ?? null,
        runId: process.env.GITHUB_RUN_ID ?? null,
      },
      host: {
        platform: process.platform,
        arch: process.arch,
        node: process.version,
        cpus: os.cpus().length,
        cpuModel: os.cpus()[0]?.model ?? null,
        totalMemoryBytes: os.totalmem(),
      },
      browser: {
        version: browser.version(),
        userAgent: first?.runtime?.userAgent ?? null,
        hardwareConcurrency: first?.runtime?.hardwareConcurrency ?? null,
        deviceMemoryGb: first?.runtime?.deviceMemoryGb ?? null,
      },
      gpu: first?.gpu ?? null,
      captures: results.filter((result) => result.screenshot).map((result) => result.screenshot),
      battleSetup: BATTLE_SETUP,
      results,
    };
    await writeFile(`${output}/metrics.json`, JSON.stringify(report, null, 2) + '\n');
    console.log(`Saved ${results.length} measurements and ${report.captures.length} captures to ${output}`);
  } finally { await browser.close(); }
} finally { server?.kill(); }
