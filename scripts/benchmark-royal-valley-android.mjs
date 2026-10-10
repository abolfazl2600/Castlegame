/**
 * Issue #306: reproducible large-map browser performance assessment.
 * This is Chrome / SwiftShader with mobile viewport and CPU throttling;
 * it is NOT evidence from a physical low-end Android SoC.
 */
import { spawn } from 'node:child_process';
import os from 'node:os';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const out = process.env.BENCHMARK_OUTPUT ?? 'artifacts/royal-valley-306';
const origin = process.env.BENCHMARK_URL ?? 'http://127.0.0.1:4173/Castlegame/';
const throttling = Number(process.env.BENCHMARK_CPU_THROTTLE ?? 2);
const saveVersion = Number((await readFile(new URL('../src/core/constants.ts', import.meta.url), 'utf8'))
  .match(/export const SAVE_VERSION = (\d+)/)?.[1]);
if (!Number.isInteger(saveVersion)) throw new Error('Missing SAVE_VERSION');
if (!Number.isFinite(throttling) || throttling < 1) throw new Error('Invalid CPU throttle');

function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return Number(sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)].toFixed(2));
}

function fixture(large) {
  const [cols, rows] = large ? [50, 89] : [23, 23];
  const layout = large ? 'royal-valley-50x89' : 'mainland';
  const centerX = Math.floor(cols / 2);
  const centerY = Math.floor(rows / 2);
  const terrain = [];
  // Make a known, unobstructed 9×9 build/edit district at the camera focus.
  for (let y = centerY - 4; y <= centerY + 4; y++) {
    for (let x = centerX - 4; x <= centerX + 4; x++) {
      terrain.push({ x, y, kind: 'plains' });
    }
  }
  // A repeatable developed settlement, away from interactive build tiles.
  const cells = [];
  const types = ['house', 'cottage', 'farm', 'hut', 'stoneRoad'];
  for (let y = large ? 18 : 2; y < (large ? 31 : 8); y++) {
    for (let x = large ? 9 : 2; x < (large ? 21 : 10); x++) {
      if ((x + y) % 3 === 0) continue;
      cells.push({ x, y, kind: types[(x + 2 * y) % types.length], level: 1 });
      terrain.push({ x, y, kind: 'plains' });
    }
  }
  const now = 1700000000000;
  return {
    centerX, centerY, layout, cells,
    record: {
      metadata: {
        id: 'issue-306-' + layout,
        slot: 'autosave', name: 'Issue 306 performance fixture',
        createdAt: now, updatedAt: now, schemaVersion: saveVersion,
        gameMode: 'unified',
        summary: { buildings: cells.length, keeps: 0, terrainChanges: terrain.length, elevations: 0 },
      },
      data: {
        version: saveVersion, gameMode: 'unified', mapLayoutId: layout,
        updatedAt: now, worldSeed: 306, worldSeeded: true, cells,
        keeps: [], stoneStyle: 'limestone', towerBridges: [], terrain,
        elevations: [], militaryTier: 1,
        economy: { logs: 100, wood: 500, stone: 500, grain: 100, flour: 50, food: 100 },
      },
    },
  };
}

async function ready(url) {
  for (let i = 0; i < 90; i++) {
    try { if ((await fetch(url)).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Preview server not ready: ' + url);
}

async function collect(page, label) {
  const data = await page.evaluate(async () => {
    const deltas = [];
    const start = performance.now();
    let prior;
    await new Promise((resolve) => {
      const endAt = performance.now() + 10000;
      const frame = (now) => {
        if (prior !== undefined) deltas.push(now - prior);
        prior = now;
        if (deltas.length >= 35 || performance.now() >= endAt) resolve();
        else requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
    const metrics = window.__castleVisualMetrics();
    return {
      intervals: deltas,
      resources: metrics,
      heapUsedBytes: performance.memory?.usedJSHeapSize ?? null,
      elapsedMs: performance.now() - start,
    };
  });
  const { intervals, resources, heapUsedBytes, elapsedMs } = data;
  if (intervals.length < 5) throw new Error('Insufficient animation samples: ' + label);
  const result = {
    label, samples: intervals.length, elapsedMs: Math.round(elapsedMs),
    medianFrameMs: percentile(intervals, 0.5),
    p95FrameMs: percentile(intervals, 0.95),
    over50Ms: intervals.filter(v => v > 50).length,
    over100Ms: intervals.filter(v => v > 100).length,
    drawCalls: resources.drawCalls, triangles: resources.triangles,
    gpuGeometries: resources.gpuGeometries, gpuTextures: resources.gpuTextures,
    sceneGeometries: resources.sceneGeometries,
    lastRedrawMs: Math.round(resources.lastRedrawMs * 100) / 100,
    heapUsedBytes, renderProfile: resources.visualBudget?.renderProfile ?? null,
    memoryPressure: resources.visualBudget?.memoryPressure ?? null,
    gpu: resources.gpu,
  };
  console.log(JSON.stringify({ phase: 'sample', ...result }));
  return result;
}

let server;
await mkdir(out, { recursive: true });
if (!process.env.BENCHMARK_URL) {
  server = spawn('npm', ['run', 'preview', '--', '--host', '127.0.0.1', '--port', '4173'], { stdio: 'ignore' });
  await ready(origin);
}
const browser = await chromium.launch({
  headless: true,
  args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--js-flags=--max-old-space-size=2048'],
});
const errors = [];
const results = [];
const runInfo = {
  issue: 306,
  measuredAt: new Date().toISOString(),
  gitSha: process.env.GITHUB_SHA ?? null,
  execution: 'Chromium headless Linux, SwiftShader software GPU, mobile emulated viewport; NOT a real Android device',
  device: { android: false, model: null, gpu: 'SwiftShader', temperature: null },
  host: { node: process.version, cpus: os.cpus().length, model: os.cpus()[0]?.model, memoryBytes: os.totalmem() },
  browser: browser.version(), cpuThrottle: throttling,
  viewport: { width: 915, height: 412 }, deviceScaleFactor: 1,
};
try {
  for (const large of [false, true]) {
    const input = fixture(large);
    const context = await browser.newContext({
      viewport: { width: 915, height: 412 },
      deviceScaleFactor: 1, hasTouch: true, isMobile: true,
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    page.setDefaultTimeout(35000);
    page.on('pageerror', err => errors.push({ layout: input.layout, error: String(err) }));
    page.on('console', entry => {
      if (entry.type() === 'error') errors.push({ layout: input.layout, error: entry.text() });
    });
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttling });
    await page.addInitScript(({ save }) => {
      localStorage.setItem('castle-role.saves.v1.has-save', '1');
      localStorage.setItem('castle-role.saves.v1.autosave', JSON.stringify(save));
      localStorage.setItem('castle-role.settings.v2', JSON.stringify({
        schemaVersion: 2,
        gameplay: { controlScheme: 'touch', tutorialCompleted: true, cameraSensitivity: 1, combatFeedback: true },
        graphics: { quality: 'low', performanceMode: 'performance', environmentDetail: 'low',
          shadowsEnabled: false, effectsEnabled: false, debugMode: false },
        interface: { language: 'en', showHelp: false, reducedMotion: true },
        audio: { masterVolume: 0, musicVolume: 0, sfxVolume: 0, muted: true },
      }));
    }, { save: input.record });
    try {
      await page.goto(new URL('?visualBaseline=1&touchQA=1', origin).href, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForSelector('#toolbar [data-build-none]', { timeout: 65000 });
      await page.waitForFunction(() => typeof window.__castleVisualMetrics === 'function' &&
        typeof window.__castleTouchQA === 'function', { timeout: 60000 });
      const layout = await page.evaluate(() => ({
        mobileUI: document.documentElement.classList.contains('mobile-ui-active'),
        stateCellCount: window.__castleTouchQA().cells.length,
      }));
      if (!layout.mobileUI) throw new Error('Expected mobile landscape input layout');
      if (layout.stateCellCount < input.cells.length * 0.75) {
        throw new Error('Large-map saved settlement failed to load: ' + JSON.stringify(layout));
      }
      await page.evaluate(({ x, y }) => {
        const m = window.__castleVisualMetrics();
        const distance = 105;
        window.__castleVisualCamera({
          x: distance * 0.52, y: distance * 0.75, z: distance * 0.55,
          targetX: (x + 0.5) * 4 - (m ? (window.__castleTouchQA ? 0 : 0) : 0),
          targetY: 0, targetZ: 0,
        });
      }, { x: input.centerX, y: input.centerY });
      // Reset to stable origin-centered camera and warm up the renderer.
      await page.evaluate(() => window.__castleVisualCamera({
        x: 63, y: 83, z: 65, targetX: 0, targetY: 0, targetZ: 0,
      }));
      await page.waitForTimeout(1200);
      const phases = [];
      phases.push(await collect(page, 'idle'));
      // Camera rotation/zoom uses the actual OrbitControls pointer input.
      const canvas = page.locator('#game-canvas');
      const box = await canvas.boundingBox();
      if (!box) throw new Error('Missing WebGL canvas');
      const x = box.x + box.width * .53;
      const y = box.y + box.height * .48;
      await page.evaluate(() => document.querySelector('[data-build-none]')?.click());
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + 110, y + 35, { steps: 8 });
      await page.mouse.up();
      await page.mouse.wheel(0, -280);
      phases.push(await collect(page, 'camera_input'));

      // Recenter before selecting a known plains tile for user-level edits.
      await page.evaluate(() => window.__castleVisualCamera({
        x: 63, y: 83, z: 65, targetX: 0, targetY: 0, targetZ: 0,
      }));
      const placeTile = async (tool, dx, dy) => {
        await page.evaluate((selected) => {
          const control = document.querySelector('[data-tool="' + selected + '"]');
          if (!(control instanceof HTMLButtonElement)) throw new Error('Missing build tool: ' + selected);
          control.click();
        }, tool);
        const point = await page.evaluate(({ tx, ty }) => window.__castleVisualGridPoint(tx, ty), {
          tx: input.centerX + dx, ty: input.centerY + dy,
        });
        await page.mouse.click(point.x, point.y);
        return { point, status: await page.locator('#save-status').textContent() };
      };
      const beforeCells = (await page.evaluate(() => window.__castleTouchQA().cells.length));
      const construction = await placeTile('house', 0, 0);
      const afterCells = (await page.evaluate(() => window.__castleTouchQA().cells.length));
      if (afterCells <= beforeCells) throw new Error('House construction did not complete: ' + JSON.stringify(construction));
      phases.push(await collect(page, 'after_construction'));

      const terrainEdit = await placeTile('river', 2, 0);
      if (!terrainEdit.status?.includes('River water created')) throw new Error('River terrain edit did not complete: ' + JSON.stringify(terrainEdit));
      phases.push(await collect(page, 'after_terrain_edit'));
      const endState = await page.evaluate(() => ({
        cells: window.__castleTouchQA().cells.length,
        elevations: window.__castleTouchQA().elevations.length,
      }));
      results.push({ layout: input.layout, grid: large ? [50,89] : [23,23], inputCellCount: input.cells.length,
        endState, phases });
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
  server?.kill();
  await writeFile(out + '/metrics.json', JSON.stringify({ ...runInfo, results, errors }, null, 2) + '\n');
}
if (errors.length) console.warn('Browser console/runtime errors:', JSON.stringify(errors.slice(0, 15)));
if (results.length !== 2) throw new Error('Both map sizes must complete');
console.log('Issue 306: recorded live mobile-viewport camera, construction, terrain-edit evidence; physical Android validation remains unverified.');
