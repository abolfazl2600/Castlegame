import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const outFlag = process.argv.indexOf('--out');
const output = outFlag === -1 ? 'visual-baselines/issue-59' : process.argv[outFlag + 1];
if (!output) throw new Error('Pass an output folder after --out');

const constants = await readFile(new URL('../src/core/constants.ts', import.meta.url), 'utf8');
const saveVersion = Number(constants.match(/export const SAVE_VERSION = (\d+)/)?.[1]);
if (!Number.isInteger(saveVersion)) throw new Error('Could not read SAVE_VERSION');

const url = process.env.VISUAL_BASE_URL ?? 'http://127.0.0.1:4173/Castlegame/';
const local = !process.env.VISUAL_BASE_URL;
let server;

function createSeedRecord() {
  const now = Date.now();
  return {
    metadata: {
      id: 'crac-des-chevaliers-visual-qa',
      slot: 'autosave',
      name: 'Crac visual QA',
      createdAt: now,
      updatedAt: now,
      schemaVersion: saveVersion,
      gameMode: 'unified',
      summary: { buildings: 0, keeps: 0, terrainChanges: 0, elevations: 0 },
    },
    data: {
      version: saveVersion,
      gameMode: 'unified',
      mapLayoutId: 'island',
      worldSeed: 0,
      updatedAt: now,
      cells: [],
      keeps: [],
      stoneStyle: 'limestone',
      towerBridges: [],
      terrain: [],
      elevations: [],
      worldSeeded: true,
    },
  };
}

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // preview is still starting
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Preview did not become ready at ${url}`);
}

function findCell(record, x, y) {
  return record.data.cells.find((cell) => cell.x === x && cell.y === y);
}

function validateCrac(record) {
  const problems = [];
  if (record.data.mapLayoutId !== 'mainland') problems.push('map layout is not mainland');
  if (record.data.worldSeed !== 5901) problems.push('world seed is not 5901');
  if (record.data.stoneStyle !== 'limestone') problems.push('stone style is not limestone');

  for (const [x, y, label, level] of [
    [19, 9, 'outer east gate', 2],
    [17, 9, 'inner east gate', 4],
  ]) {
    const cell = findCell(record, x, y);
    if (cell?.kind !== 'gate') problems.push(`${label} is missing at ${x},${y}`);
    if (cell?.level !== level) problems.push(`${label} has level ${cell?.level ?? 'missing'}, expected ${level}`);
  }

  const chapel = findCell(record, 12, 8);
  if (chapel?.kind !== 'basilica') problems.push('upper-ward chapel landmark is missing');
  if (!record.data.keeps?.some((keep) =>
    keep.x === 10 && keep.y === 12 && keep.width === 3 && keep.depth === 3 && keep.floors === 5
  )) {
    problems.push('south-west five-floor Keep footprint is missing');
  }

  const towerCount = record.data.cells.filter((cell) => cell.kind === 'tower').length;
  if (towerCount < 24) problems.push(`tower rhythm is too sparse: ${towerCount}`);
  const cisternCount = (record.data.terrain ?? []).filter((cell) => cell.kind === 'river' && cell.y === 17).length;
  if (cisternCount < 5) problems.push(`southern cistern is incomplete: ${cisternCount} water cells`);
  const roadCount = record.data.cells.filter((cell) => cell.kind === 'stoneRoad').length;
  if (roadCount < 8) problems.push(`authored access route is too short: ${roadCount} stone-road cells`);

  if (problems.length > 0) throw new Error(`Crac state validation failed:\n- ${problems.join('\n- ')}`);
  return { towerCount, cisternCount, roadCount };
}

async function setCamera(page, position) {
  await page.evaluate((next) => {
    window.__castleVisualCamera(next);
  }, position);
  await page.waitForTimeout(280);
}

async function captureCanvas(page, filename) {
  // Locator screenshots wait for an element's bounding box to be stable across
  // animation frames. Under CI software WebGL those frames can stall while a
  // dense castle redraws. A clipped page screenshot captures the same real
  // canvas pixels without requiring that expensive element-stability check.
  const clip = await page.evaluate(() => {
    const canvas = document.querySelector('#game-canvas');
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error('Crac WebGL canvas is missing');
    const bounds = canvas.getBoundingClientRect();
    const left = Math.max(0, Math.ceil(bounds.left));
    const top = Math.max(0, Math.ceil(bounds.top));
    const right = Math.min(window.innerWidth, Math.floor(bounds.right));
    const bottom = Math.min(window.innerHeight, Math.floor(bounds.bottom));
    if (right <= left || bottom <= top) {
      throw new Error('Crac canvas is outside the visible viewport');
    }
    return {
      x: left + window.scrollX,
      y: top + window.scrollY,
      width: right - left,
      height: bottom - top,
    };
  });
  await page.screenshot({
    path: `${output}/${filename}`,
    type: 'png',
    clip,
    animations: 'disabled',
    // Hide gameplay chrome without shifting layout or changing the WebGL scene.
    style: 'header.topbar, #game-shell > :not(#game) { visibility: hidden !important; }',
    timeout: 120_000,
  });
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
    args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--js-flags=--max-old-space-size=2048'],
  });

  try {
    const context = await browser.newContext({
      viewport: { width: 1365, height: 900 },
      deviceScaleFactor: 1,
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    page.setDefaultTimeout(30_000);

    await page.addInitScript(({ record }) => {
      localStorage.setItem('castle-role.saves.v1.has-save', '1');
      localStorage.setItem('castle-role.saves.v1.autosave', JSON.stringify(record));
      localStorage.setItem('castle-role.settings.v2', JSON.stringify({
        schemaVersion: 2,
        gameplay: {
          controlScheme: 'standard',
          tutorialCompleted: true,
          cameraSensitivity: 1,
          combatFeedback: true,
        },
        graphics: {
          quality: 'high',
          performanceMode: 'balanced',
          environmentDetail: 'high',
          shadowsEnabled: true,
          effectsEnabled: true,
        },
        interface: {
          uiScale: 1,
          language: 'en',
          reducedMotion: true,
          highContrast: false,
          confirmDestructiveActions: false,
          showHelp: false,
        },
        audio: {
          masterVolume: 0,
          musicVolume: 0,
          sfxVolume: 0,
          muted: true,
        },
      }));
    }, { record: createSeedRecord() });

    await page.goto(new URL('?visualBaseline=1', url).href, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#toolbar [data-build-none]', { timeout: 30_000 });
    await page.waitForFunction(() => typeof window.__castleVisualCamera === 'function');

    await page.locator('[data-template="crac-des-chevaliers"]').evaluate((button) => button.click());
    await page.waitForFunction(() => {
      const raw = localStorage.getItem('castle-role.saves.v1.autosave');
      if (!raw) return false;
      return JSON.parse(raw).data?.worldSeed === 5901;
    });

    const record = await page.evaluate(() => JSON.parse(localStorage.getItem('castle-role.saves.v1.autosave')));
    const stateSummary = validateCrac(record);

    await page.locator('#view-2d-button').evaluate((button) => button.click());
    await page.waitForTimeout(300);
    await captureCanvas(page, 'crac-des-chevaliers-plan-top.png');

    await page.locator('#view-3d-button').evaluate((button) => button.click());

    await setCamera(page, {
      x: 56, y: 56, z: 64,
      targetX: 0, targetY: 2, targetZ: 0,
    });
    await captureCanvas(page, 'crac-des-chevaliers-normal-oblique.png');

    await setCamera(page, {
      x: 90, y: 36, z: 2,
      targetX: 0, targetY: 3, targetZ: 0,
    });
    await captureCanvas(page, 'crac-des-chevaliers-east-approach.png');

    await setCamera(page, {
      x: -52, y: 42, z: 88,
      targetX: 0, targetY: 3, targetZ: 4,
    });
    await captureCanvas(page, 'crac-des-chevaliers-south-southwest.png');

    const resources = await page.evaluate(() => window.__castleVisualMetrics());
    const metrics = {
      schemaVersion: 1,
      issue: 59,
      capturedAt: new Date().toISOString(),
      source: {
        gitSha: process.env.GITHUB_SHA ?? null,
        gitRef: process.env.GITHUB_REF ?? null,
        runId: process.env.GITHUB_RUN_ID ?? null,
      },
      referenceState: 'Mid-13th-century Hospitaller final construction phase, before the 1271 Mamluk conquest',
      stateSummary,
      captures: [
        'crac-des-chevaliers-plan-top.png',
        'crac-des-chevaliers-normal-oblique.png',
        'crac-des-chevaliers-east-approach.png',
        'crac-des-chevaliers-south-southwest.png',
      ],
      resources,
    };
    await writeFile(`${output}/metrics.json`, JSON.stringify(metrics, null, 2) + '\n');

    const summary = `# Issue #59 · Crac des Chevaliers matched-view evidence pack

Reference state: **mid-13th-century Hospitaller final construction phase, before the 1271 Mamluk conquest**.

## Captures

| Review view | Game capture | Authoritative comparison source |
| --- | --- | --- |
| Top / plan | \`crac-des-chevaliers-plan-top.png\` | Rey plan: https://commons.wikimedia.org/wiki/File:Krak_des_chevaliers_-_plan.jpg and UNESCO maps: https://whc.unesco.org/en/list/1229/maps/ |
| Normal gameplay | \`crac-des-chevaliers-normal-oblique.png\` | UNESCO site documentation: https://whc.unesco.org/en/list/1229 and French Ministry overview: https://archeologie.culture.gouv.fr/crac-chevaliers/en/about-castle |
| East approach | \`crac-des-chevaliers-east-approach.png\` | French Ministry fortification study: https://archeologie.culture.gouv.fr/crac-chevaliers/en/strengthening-fortifications-13th-century |
| South / south-west | \`crac-des-chevaliers-south-southwest.png\` | French Ministry final construction phase: https://archeologie.culture.gouv.fr/crac-chevaliers/en/final-construction-phase |

## Automated checks

- Deterministic template seed: 5901.
- Mainland authored layout and limestone visual family.
- Two-stage eastern gate system preserved at levels 2 and 4.
- Upper-ward chapel landmark and five-floor south-west Keep preserved.
- Tower density: ${stateSummary.towerCount}.
- Southern cistern water cells: ${stateSummary.cisternCount}.
- Authored stone-road cells: ${stateSummary.roadCount}.
- Browser edit/save/reload and gate interaction are covered by \`tests/crac-des-chevaliers.spec.ts\`.
- Renderer/resource metrics are recorded in \`metrics.json\` for dense-scene review.

The screenshots are generated from the live WebGL build. Final historical fidelity approval remains a matched-view review against the authoritative sources above.
`;
    await writeFile(`${output}/summary.md`, summary);

    console.log(`Crac QA captured ${metrics.captures.length} matched views.`);
    await context.close();
  } finally {
    await browser.close();
  }
} finally {
  server?.kill();
}
