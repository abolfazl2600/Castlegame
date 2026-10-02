import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { REFERENCE_CAMERA } from './visual-reference-scene.mjs';

const outFlag = process.argv.indexOf('--out');
const output = outFlag === -1 ? 'docs/visual-audits/issue-132' : process.argv[outFlag + 1];
const nameFlag = process.argv.indexOf('--name');
const name = nameFlag === -1 ? 'settlement-level-strip' : process.argv[nameFlag + 1];
if (!output || !name) throw new Error('Pass valid --out and --name values.');

const constants = readFileSync(new URL('../src/core/constants.ts', import.meta.url), 'utf8');
const saveVersion = Number(constants.match(/export const SAVE_VERSION = (\d+)/)?.[1]);
if (!Number.isInteger(saveVersion)) throw new Error('Could not read SAVE_VERSION');

const port = process.env.VISUAL_PORT ?? '4173';
const url = `http://127.0.0.1:${port}/Castlegame/`;
let server;

const now = 1_700_000_000_000;
const cells = [];
const add = (x, y, kind, level = 1) => cells.push({ x, y, kind, level });

for (let level = 1; level <= 4; level += 1) {
  add(7 + (level - 1) * 3, 5, 'cottage', level);
}
for (let level = 1; level <= 4; level += 1) {
  const x = 7 + (level - 1) * 3;
  add(x, 8, 'farm', level);
  add(x, 11, 'cowBarn', level);
  add(x, 14, 'appleOrchard', level);
  add(x, 17, 'armyCamp', level);
  add(x, 20, 'harbor', level);
}
add(4, 11, 'market', 1);
add(4, 14, 'windmill', 1);
add(4, 17, 'basilica', 1);

const terrain = cells.map(({ x, y }) => ({ x, y, kind: 'plains' }));
const save = {
  metadata: {
    id: 'visual-issue-132',
    slot: 'autosave',
    name: 'Issue 132 visual strip',
    createdAt: now,
    updatedAt: now,
    schemaVersion: saveVersion,
    gameMode: 'medieval',
    summary: { buildings: cells.length, keeps: 0, terrainChanges: terrain.length, elevations: 0 },
  },
  data: {
    version: saveVersion,
    gameMode: 'medieval',
    mapLayoutId: 'mainland',
    updatedAt: now,
    cells,
    keeps: [],
    stoneStyle: 'limestone',
    towerBridges: [],
    terrain,
    elevations: [],
    worldSeeded: true,
  },
};

async function waitForServer() {
  for (let tries = 0; tries < 50; tries += 1) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // preview is still starting
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error('Preview did not become ready');
}

try {
  await mkdir(output, { recursive: true });
  server = spawn('npm', ['run', 'preview', '--', '--host', '127.0.0.1', '--port', port], { stdio: 'ignore' });
  await waitForServer();

  const browser = await chromium.launch({
    headless: true,
    args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  try {
    const context = await browser.newContext({
      viewport: { width: 1600, height: 1000 },
      deviceScaleFactor: 1,
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    await page.addInitScript((record) => {
      localStorage.setItem('castle-role.saves.v1.has-save', '1');
      localStorage.setItem('castle-role.saves.v1.autosave', JSON.stringify(record));
      localStorage.setItem('castle-role.settings.v2', JSON.stringify({
        schemaVersion: 2,
        graphics: {
          quality: 'high',
          performanceMode: 'balanced',
          environmentDetail: 'high',
          shadowsEnabled: true,
          effectsEnabled: true,
        },
        interface: { reducedMotion: true, showHelp: false },
      }));
    }, save);

    await page.goto(new URL('?visualBaseline=1', url).href, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#toolbar [data-build-none]', { timeout: 30000 });
    await page.evaluate((camera) => window.__castleVisualCamera(camera), REFERENCE_CAMERA.normal);
    await page.evaluate(() => {
      const legend = document.createElement('div');
      legend.id = 'issue-132-legend';
      legend.textContent = 'Top: Residential District Level 1→4   |   Rows: Farm · Cattle · Orchard · Army · Harbor   |   Left landmarks: Market · Windmill · Basilica';
      Object.assign(legend.style, {
        position: 'fixed',
        left: '16px',
        top: '16px',
        zIndex: '9999',
        padding: '8px 12px',
        background: 'rgba(9, 19, 28, 0.88)',
        color: '#fff',
        font: '14px system-ui, sans-serif',
        borderRadius: '8px',
        pointerEvents: 'none',
      });
      document.body.appendChild(legend);
    });
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${output}/${name}.png`, fullPage: false });
    await context.close();
  } finally {
    await browser.close();
  }

  console.log(`Saved issue 132 normal-zoom level strip to ${output}/${name}.png`);
} finally {
  server?.kill();
}
