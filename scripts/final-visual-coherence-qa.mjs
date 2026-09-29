import { spawn } from 'node:child_process';
import os from 'node:os';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import {
  createVisualScene,
  FINAL_QA_SCENES,
  REFERENCE_CAMERA,
  REFERENCE_SEED,
} from './visual-reference-scene.mjs';

const outFlag = process.argv.indexOf('--out');
const output = outFlag === -1 ? 'visual-baselines/final-qa' : process.argv[outFlag + 1];
if (!output) throw new Error('Pass an output folder after --out');

const url = process.env.VISUAL_BASE_URL ?? 'http://127.0.0.1:4173/Castlegame/';
const local = !process.env.VISUAL_BASE_URL;
let server;

export const FINAL_QA_BUDGETS = {
  desktopNormal: {
    maxFrameP95Ms: 220,
    maxDrawCalls: 1800,
    maxTriangles: 1_200_000,
    maxSceneMaterials: 260,
    maxRedrawMs: 1800,
    maxUiCoverage: 0.32,
  },
  mobileLandscape: {
    maxFrameP95Ms: 260,
    maxDrawCalls: 1800,
    maxTriangles: 1_200_000,
    maxSceneMaterials: 260,
    maxRedrawMs: 2100,
    maxUiCoverage: 0.44,
  },
};

const BATTLE_SETUP = {
  attackerSwordsmen: 16,
  attackerArchers: 10,
  attackerSpearmen: 10,
  attackerCrossbowmen: 6,
  attackerModernSoldiers: 0,
  defenderSwordsmen: 14,
  defenderArchers: 10,
  defenderSpearmen: 10,
  defenderCrossbowmen: 6,
  defenderModernSoldiers: 0,
};

async function waitForServer() {
  for (let tries = 0; tries < 50; tries += 1) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // preview is still starting
    }
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
    let previous = performance.now();
    for (let index = 0; index < 12; index += 1) {
      const now = await new Promise((resolve) => {
        let settled = false;
        const timer = setTimeout(() => {
          if (settled) return;
          settled = true;
          resolve(performance.now());
        }, 250);
        requestAnimationFrame((timestamp) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve(timestamp);
        });
      });
      const metrics = window.__castleVisualFrame();
      samples.push({ frameMs: Math.max(0.01, now - previous), ...metrics });
      previous = now;
    }

    const uiCoverage = (() => {
      const cols = 48;
      const rows = 28;
      let covered = 0;
      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
          const x = ((col + 0.5) / cols) * window.innerWidth;
          const y = ((row + 0.5) / rows) * window.innerHeight;
          let element = document.elementFromPoint(x, y);
          let fixed = false;
          while (element && element !== document.body) {
            const style = getComputedStyle(element);
            if (
              (style.position === 'fixed' || style.position === 'sticky') &&
              style.visibility !== 'hidden' &&
              style.display !== 'none' &&
              Number(style.opacity || '1') > 0.05
            ) {
              fixed = true;
              break;
            }
            element = element.parentElement;
          }
          if (fixed) covered += 1;
        }
      }
      return covered / (cols * rows);
    })();

    return {
      samples,
      resources: window.__castleVisualMetrics(),
      uiCoverage,
      heapBytes: performance.memory?.usedJSHeapSize ?? null,
    };
  });
}

async function startBattle(page) {
  await page.evaluate(() => document.querySelector('#battle-button')?.click());
  await page.waitForSelector('#battle-panel:not([hidden])', { timeout: 30000 });
  await page.evaluate((setup) => {
    for (const [field, value] of Object.entries(setup)) {
      const input = document.querySelector(`[data-battle-input="${field}"]`);
      if (!(input instanceof HTMLInputElement)) throw new Error(`Missing battle input: ${field}`);
      input.value = String(value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    const start = document.querySelector('#battle-start');
    if (!(start instanceof HTMLButtonElement)) throw new Error('Missing battle start button');
    start.click();
  }, BATTLE_SETUP);
  try {
    await page.waitForFunction(
      () => document.querySelector('#battle-mode-status')?.textContent?.includes('BATTLE IN PROGRESS'),
      undefined,
      { timeout: 10000 },
    );
  } catch (error) {
    const diagnostic = await page.evaluate(() => ({
      mode: document.querySelector('#battle-mode-status')?.textContent ?? null,
      status: document.querySelector('#status')?.textContent ?? null,
      startDisabled: document.querySelector('#battle-start')?.disabled ?? null,
    }));
    throw new Error(`Battle QA fixture failed to enter running state: ${JSON.stringify(diagnostic)} · ${String(error)}`);
  }
  await page.evaluate(() => document.querySelector('#battle-close')?.click());
  await page.waitForTimeout(1600);
}

async function captureScenario(browser, {
  scene,
  viewport,
  camera,
  name,
  battle = false,
  touch = false,
  quality = 'high',
}) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    reducedMotion: 'no-preference',
    hasTouch: touch,
    isMobile: touch,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(20000);
  const save = createVisualScene(scene);
  console.log(`Starting final QA capture: ${name}`);

  await page.addInitScript(({ record, graphicsQuality, touchMode }) => {
    localStorage.setItem('castle-role.saves.v1.has-save', '1');
    localStorage.setItem('castle-role.saves.v1.autosave', JSON.stringify(record));
    localStorage.setItem('castle-role.settings.v2', JSON.stringify({
      schemaVersion: 2,
      gameplay: {
        controlScheme: touchMode ? 'touch' : 'standard',
        tutorialCompleted: true,
        cameraSensitivity: 1,
        combatFeedback: true,
      },
      graphics: {
        quality: graphicsQuality,
        performanceMode: 'balanced',
        environmentDetail: graphicsQuality,
        shadowsEnabled: true,
        effectsEnabled: true,
      },
      interface: {
        uiScale: 1,
        language: 'en',
        reducedMotion: false,
        highContrast: false,
        confirmDestructiveActions: true,
        showHelp: false,
      },
      audio: {
        masterVolume: 0,
        musicVolume: 0,
        sfxVolume: 0,
        muted: true,
      },
    }));
  }, { record: save, graphicsQuality: quality, touchMode: touch });

  await page.goto(new URL('?visualBaseline=1', url).href, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#toolbar [data-build-none]', { timeout: 30000 });
  await page.evaluate((position) => window.__castleVisualCamera(position), camera);

  if (battle) await startBattle(page);

  await page.waitForTimeout(650);
  const { samples, resources, uiCoverage, heapBytes } = await sample(page);

  // Screenshot encoding is substantially slower on CI SwiftShader for dense scenes.
  // Keep interaction waits strict, but allow the final evidence capture enough time to encode.
  page.setDefaultTimeout(45000);
  const screenshot = `${name}.jpg`;

  const frameTimes = samples.map((entry) => entry.frameMs);
  const drawCalls = samples.map((entry) => entry.drawCalls);
  const latest = samples.at(-1);
  const result = {
    scene,
    battle,
    touch,
    viewport,
    camera,
    screenshot,
    frameMedianMs: percentile(frameTimes, 0.5),
    frameP95Ms: percentile(frameTimes, 0.95),
    estimatedFps: Number((1000 / Math.max(0.01, percentile(frameTimes, 0.5))).toFixed(1)),
    drawCallsMedian: percentile(drawCalls, 0.5),
    triangles: latest?.triangles ?? 0,
    sceneGeometries: resources.sceneGeometries,
    sceneMaterials: resources.sceneMaterials,
    gpuGeometries: resources.gpuGeometries,
    gpuTextures: resources.gpuTextures,
    redrawMs: Number(resources.lastRedrawMs.toFixed(2)),
    uiCoverage: Number(uiCoverage.toFixed(4)),
    heapBytes,
  };

  console.log(
    `Measured ${name}: P95=${result.frameP95Ms}ms draws=${result.drawCallsMedian} triangles=${result.triangles} materials=${result.sceneMaterials} redraw=${result.redrawMs}ms UI=${(result.uiCoverage * 100).toFixed(1)}%`,
  );

  await page.screenshot({
    path: `${output}/${screenshot}`,
    type: 'jpeg',
    quality: 88,
    fullPage: false,
    animations: 'disabled',
  });

  await context.close();
  return result;
}

function budgetViolations(result, budget) {
  const violations = [];
  if (result.frameP95Ms > budget.maxFrameP95Ms) violations.push(`frame P95 ${result.frameP95Ms}ms > ${budget.maxFrameP95Ms}ms`);
  if (result.drawCallsMedian > budget.maxDrawCalls) violations.push(`draw calls ${result.drawCallsMedian} > ${budget.maxDrawCalls}`);
  if (result.triangles > budget.maxTriangles) violations.push(`triangles ${result.triangles} > ${budget.maxTriangles}`);
  if (result.sceneMaterials > budget.maxSceneMaterials) violations.push(`materials ${result.sceneMaterials} > ${budget.maxSceneMaterials}`);
  if (result.redrawMs > budget.maxRedrawMs) violations.push(`redraw ${result.redrawMs}ms > ${budget.maxRedrawMs}ms`);
  if (result.uiCoverage > budget.maxUiCoverage) violations.push(`UI coverage ${(result.uiCoverage * 100).toFixed(1)}% > ${(budget.maxUiCoverage * 100).toFixed(1)}%`);
  return violations;
}

try {
  await mkdir(output, { recursive: true });

  if (local) {
    server = spawn('npm', ['run', 'preview', '--', '--host', '127.0.0.1', '--port', '4173'], {
      stdio: 'ignore',
    });
    await waitForServer();
  }

  const browser = await chromium.launch({
    headless: true,
    args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader'],
  });

  try {
    const desktop = { width: 1365, height: 900 };
    const mobileLandscape = { width: 740, height: 390 };
    const results = [];

    for (const scene of FINAL_QA_SCENES) {
      results.push(await captureScenario(browser, {
        scene,
        viewport: desktop,
        camera: REFERENCE_CAMERA.normal,
        name: `${scene}-normal-desktop`,
      }));
    }

    results.push(await captureScenario(browser, {
      scene: 'dense',
      viewport: desktop,
      camera: REFERENCE_CAMERA.far,
      name: 'dense-strategic-desktop',
    }));

    results.push(await captureScenario(browser, {
      scene: 'castle',
      viewport: desktop,
      camera: REFERENCE_CAMERA.normal,
      name: 'castle-battle-normal-desktop',
      battle: true,
    }));

    results.push(await captureScenario(browser, {
      scene: 'starter',
      viewport: mobileLandscape,
      camera: REFERENCE_CAMERA.normal,
      name: 'starter-normal-mobile-landscape',
      touch: true,
    }));

    const checks = [];
    for (const result of results) {
      const budget = result.touch ? FINAL_QA_BUDGETS.mobileLandscape : FINAL_QA_BUDGETS.desktopNormal;
      const violations = budgetViolations(result, budget);
      const hardViolations = result.uiCoverage > budget.maxUiCoverage
        ? [`UI coverage ${(result.uiCoverage * 100).toFixed(1)}% > ${(budget.maxUiCoverage * 100).toFixed(1)}%`]
        : [];
      checks.push({
        screenshot: result.screenshot,
        passed: hardViolations.length === 0,
        hardViolations,
        performanceFollowupRequired: violations.filter((entry) => !entry.startsWith('UI coverage ')),
        productionBudgetPassed: violations.length === 0,
      });
    }

    const report = {
      schemaVersion: 1,
      issue: 137,
      seed: REFERENCE_SEED,
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
        cpuModel: os.cpus()[0]?.model ?? null,
        cpus: os.cpus().length,
        totalMemoryBytes: os.totalmem(),
      },
      budgets: FINAL_QA_BUDGETS,
      knownFocusedFollowups: [135, 136],
      battleSetup: BATTLE_SETUP,
      captures: results.map((entry) => entry.screenshot),
      checks,
      results,
    };

    await writeFile(`${output}/metrics.json`, JSON.stringify(report, null, 2) + '\n');

    const failures = checks.filter((check) => !check.passed);
    if (failures.length > 0) {
      const details = failures
        .map((failure) => `${failure.screenshot}: ${failure.hardViolations.join('; ')}`)
        .join('\n');
      throw new Error(`Final visual QA integration checks failed:\n${details}`);
    }

    const productionBudgetFailures = checks.filter((check) => !check.productionBudgetPassed).length;
    console.log(
      `Final visual QA captured ${results.length} scenarios across ${FINAL_QA_SCENES.length} core scenes. ` +
      `${productionBudgetFailures} scenario(s) remain above #136 production performance targets.`,
    );
  } finally {
    await browser.close();
  }
} finally {
  server?.kill();
}
