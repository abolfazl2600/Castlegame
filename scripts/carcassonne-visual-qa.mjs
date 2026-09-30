import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const outFlag = process.argv.indexOf('--out');
const output = outFlag === -1 ? 'visual-baselines/issue-56' : process.argv[outFlag + 1];
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
      id: 'carcassonne-visual-qa',
      slot: 'autosave',
      name: 'Carcassonne visual QA',
      createdAt: now,
      updatedAt: now,
      schemaVersion: saveVersion,
      gameMode: 'medieval',
      summary: { buildings: 0, keeps: 0, terrainChanges: 0, elevations: 0 },
    },
    data: {
      version: saveVersion,
      gameMode: 'medieval',
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

function validateCarcassonne(record) {
  const problems = [];
  if (record.data.mapLayoutId !== 'mainland') problems.push('map layout is not mainland');
  if (record.data.worldSeed !== 5601) problems.push('world seed is not 5601');
  if (record.data.stoneStyle !== 'limestone') problems.push('stone style is not limestone');

  for (const [x, y, label] of [
    [19, 9, 'outer Narbonnaise gate'],
    [17, 9, 'inner Narbonnaise gate'],
    [3, 13, 'outer Aude gate'],
    [6, 13, 'inner Aude gate'],
  ]) {
    if (findCell(record, x, y)?.kind !== 'gate') problems.push(`${label} is missing at ${x},${y}`);
  }

  const basilica = findCell(record, 13, 12);
  if (basilica?.kind !== 'basilica') problems.push('Saint-Nazaire basilica landmark is missing');
  if (!record.data.keeps?.some((keep) => keep.x === 8 && keep.y === 10 && keep.width === 3 && keep.depth === 3)) {
    problems.push('Château Comtal keep footprint is missing');
  }

  const towerCount = record.data.cells.filter((cell) => cell.kind === 'tower').length;
  if (towerCount < 24) problems.push(`tower rhythm is too sparse: ${towerCount}`);
  const riverCount = (record.data.terrain ?? []).filter((cell) => cell.kind === 'river').length;
  if (riverCount < 22) problems.push(`Aude river channel is too short: ${riverCount}`);

  if (problems.length > 0) throw new Error(`Carcassonne state validation failed:\n- ${problems.join('\n- ')}`);
  return { towerCount, riverCount };
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
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error('Carcassonne WebGL canvas is missing');
    const bounds = canvas.getBoundingClientRect();
    const left = Math.max(0, Math.ceil(bounds.left));
    const top = Math.max(0, Math.ceil(bounds.top));
    const right = Math.min(window.innerWidth, Math.floor(bounds.right));
    const bottom = Math.min(window.innerHeight, Math.floor(bounds.bottom));
    if (right <= left || bottom <= top) {
      throw new Error('Carcassonne canvas is outside the visible viewport');
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

    await page.locator('[data-template="carcassonne"]').evaluate((button) => button.click());
    await page.waitForFunction(() => {
      const raw = localStorage.getItem('castle-role.saves.v1.autosave');
      if (!raw) return false;
      return JSON.parse(raw).data?.worldSeed === 5601;
    });

    const record = await page.evaluate(() => JSON.parse(localStorage.getItem('castle-role.saves.v1.autosave')));
    const stateSummary = validateCarcassonne(record);

    await page.locator('#view-2d-button').evaluate((button) => button.click());
    await page.waitForTimeout(300);
    await captureCanvas(page, 'carcassonne-plan-top.png');

    await page.locator('#view-3d-button').evaluate((button) => button.click());

    await setCamera(page, {
      x: 56, y: 56, z: 64,
      targetX: 0, targetY: 2, targetZ: 0,
    });
    await captureCanvas(page, 'carcassonne-normal-oblique.png');

    await setCamera(page, {
      x: 90, y: 36, z: 2,
      targetX: 0, targetY: 3, targetZ: 0,
    });
    await captureCanvas(page, 'carcassonne-east-narbonnaise.png');

    await setCamera(page, {
      x: -90, y: 34, z: 8,
      targetX: 0, targetY: 3, targetZ: 0,
    });
    await captureCanvas(page, 'carcassonne-west-aude.png');

    const resources = await page.evaluate(() => window.__castleVisualMetrics());
    const metrics = {
      schemaVersion: 1,
      issue: 56,
      capturedAt: new Date().toISOString(),
      source: {
        gitSha: process.env.GITHUB_SHA ?? null,
        gitRef: process.env.GITHUB_REF ?? null,
        runId: process.env.GITHUB_RUN_ID ?? null,
      },
      referenceState: 'Present-day fortified city as documented in 2025',
      stateSummary,
      captures: [
        'carcassonne-plan-top.png',
        'carcassonne-normal-oblique.png',
        'carcassonne-east-narbonnaise.png',
        'carcassonne-west-aude.png',
      ],
      resources,
    };
    await writeFile(`${output}/metrics.json`, JSON.stringify(metrics, null, 2) + '\n');

    const summary = `# Issue #56 · Carcassonne matched-view evidence pack

Reference state: **present-day fortified city as documented in 2025**.

## Captures

| Review view | Game capture | Authoritative comparison source |
| --- | --- | --- |
| Top / plan | \`carcassonne-plan-top.png\` | UNESCO property maps: https://whc.unesco.org/en/list/345/maps/ |
| Normal gameplay | \`carcassonne-normal-oblique.png\` | CMN iconic silhouette: https://www.remparts-carcassonne.fr/en/discover/an-iconic-silhouette |
| East / Porte Narbonnaise | \`carcassonne-east-narbonnaise.png\` | CMN monument material: https://www.remparts-carcassonne.fr/en/discover/an-iconic-silhouette |
| West / Aude approach | \`carcassonne-west-aude.png\` | UNESCO property and site documentation: https://whc.unesco.org/en/list/345 |

## Automated checks

- Deterministic template seed: 5601.
- Mainland authored layout and limestone visual family.
- Both Narbonnaise gates and both Aude gates present at the documented game-scale positions.
- Saint-Nazaire dedicated basilica landmark present.
- Château Comtal keep footprint present.
- Tower density: ${stateSummary.towerCount}.
- Aude river cells: ${stateSummary.riverCount}.
- Browser edit/save/reload and gate interaction are covered by \`tests/carcassonne.spec.ts\`.

The screenshots are generated from the live WebGL build. Final historical fidelity approval remains a human matched-view comparison against the authoritative sources above.
`;
    await writeFile(`${output}/summary.md`, summary);

    console.log(`Carcassonne QA captured ${metrics.captures.length} matched views.`);
    await context.close();
  } finally {
    await browser.close();
  }
} finally {
  server?.kill();
}
