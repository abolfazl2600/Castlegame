import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { createVisualScene, REFERENCE_CAMERA } from './visual-reference-scene.mjs';

const outFlag = process.argv.indexOf('--out');
const output = outFlag === -1 ? 'visual-baselines/silhouette' : process.argv[outFlag + 1];
if (!output) throw new Error('Pass an output folder after --out');

const url = 'http://127.0.0.1:4173/Castlegame/';
let server;

async function waitForServer() {
  for (let tries = 0; tries < 50; tries += 1) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // Preview is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error('Preview did not become ready');
}

async function capture(browser, name, viewport) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  const save = createVisualScene('dense');
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
      interface: {
        reducedMotion: true,
        showHelp: false,
      },
    }));
  }, save);

  await page.goto(new URL('?visualBaseline=1', url).href, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#toolbar [data-build-none]', { timeout: 30000 });
  await page.evaluate((camera) => window.__castleVisualCamera(camera), REFERENCE_CAMERA.normal);
  await page.waitForTimeout(450);
  await page.screenshot({
    path: `${output}/dense-normal-${name}.png`,
    fullPage: false,
  });
  await context.close();
}

try {
  await mkdir(output, { recursive: true });
  server = spawn('npm', ['run', 'preview', '--', '--host', '127.0.0.1', '--port', '4173'], {
    stdio: 'ignore',
  });
  await waitForServer();

  const browser = await chromium.launch({
    headless: true,
    args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  try {
    await capture(browser, 'desktop', { width: 1365, height: 900 });
    await capture(browser, 'mobile', { width: 390, height: 844 });
  } finally {
    await browser.close();
  }

  console.log(`Saved dense normal-zoom desktop/mobile captures to ${output}`);
} finally {
  server?.kill();
}
