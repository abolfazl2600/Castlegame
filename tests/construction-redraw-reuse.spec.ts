import { expect, test, type Page } from '@playwright/test';
import { SAVE_AUTOSAVE_KEY, SAVE_KEY, SAVE_VERSION } from '../src/core/constants';

// A developed Royal Valley village has hundreds of visually expensive meshes.
// The central one-cell road gap makes connectivity-dependent invalidation testable.
const gap = { x: 25, y: 44 };
const neighboringRoad = { x: 24, y: 44 };
const distantRoad = { x: 16, y: 37 };
const distantCottage = { x: 15, y: 38 };
const upgradeTower = { x: 20, y: 40 };
const movedCottage = { x: 17, y: 38 };
const moveTarget = { x: 17, y: 39 };

test.use({ viewport: { width: 1280, height: 720 } });

async function start(page: Page) {
  await page.addInitScript(({ autosave, marker, version }) => {
    localStorage.setItem(marker, '1');
    localStorage.setItem('castle-role.settings.v2', JSON.stringify({
      schemaVersion: 2,
      gameplay: { controlScheme: 'standard', tutorialCompleted: true },
      graphics: { quality: 'low', performanceMode: 'performance',
        environmentDetail: 'low', shadowsEnabled: false, effectsEnabled: false },
      interface: { language: 'en', showHelp: false, reducedMotion: true },
      audio: { masterVolume: 0, muted: true },
    }));
    if (localStorage.getItem(autosave)) return;
    const cells: Array<{x:number;y:number;kind:string;level:number}> = [];
    const terrain: Array<{x:number;y:number;kind:'plains'}> = [];
    for (let y = 32; y <= 56; y++)
      for (let x = 12; x <= 38; x++)
        terrain.push({ x, y, kind: 'plains' });
    for (const y of [37, 41, 44, 47, 51]) {
      for (let x = 14; x <= 36; x++) {
        if (x === 25 && y === 44) continue;
        cells.push({ x, y, kind: 'stoneRoad', level: 1 });
      }
    }
    for (const y of [38, 42, 46, 50]) {
      for (let x = 15; x <= 35; x += 2) {
        if (x === 17 && y === 39) continue;
        cells.push({ x, y, kind: 'cottage', level: 1 });
      }
    }
    cells.push({ x: 20, y: 40, kind: 'tower', level: 1 });
    const now = 1700000000000;
    localStorage.setItem(autosave, JSON.stringify({
      metadata: { id: 'construction-310', name: 'Construction 310 QA', slot: 'autosave',
        schemaVersion: version, gameMode: 'unified', createdAt: now, updatedAt: now,
        summary: { buildings: cells.length, keeps: 0, terrainChanges: terrain.length, elevations: 0 } },
      data: { version, gameMode: 'unified', mapLayoutId: 'royal-valley-50x89',
        updatedAt: now, worldSeed: 310, worldSeeded: true, cells, terrain,
        elevations: [], keeps: [], towerBridges: [], stoneStyle: 'limestone',
        economy: { logs: 10000, wood: 10000, stone: 10000, grain: 10000, flour: 1000, food: 10000 } },
    }));
  }, { marker: SAVE_KEY, autosave: SAVE_AUTOSAVE_KEY, version: SAVE_VERSION });
  await page.goto('/Castlegame/?visualBaseline=1&touchQA=1', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#toolbar [data-build-none]')).toHaveCount(1, { timeout: 70000 });
  await page.waitForFunction(() => typeof (window as any).__castleTouchQA === 'function' &&
    typeof (window as any).__castleVisualRebuildConstruction === 'function' &&
    typeof (window as any).__castleVisualGridPoint === 'function');
  await page.evaluate(() => (window as any).__castleVisualCamera({
    x: 76, y: 102, z: 78, targetX: 0, targetY: 0, targetZ: 0,
  }));
}

async function snap(page: Page) {
  return page.evaluate(() => {
    const qa = (window as any).__castleTouchQA();
    const visual = (window as any).__castleVisualMetrics();
    return {
      ids: Object.fromEntries(qa.buildObjectIds as Array<[string, string]>) as Record<string,string>,
      cells: qa.cells as Array<{ x: number; y: number; kind: string; level: number }>,
      stats: qa.constructionRedraw as { reusedBuildings: number; rebuiltBuildings: number },
      redrawMs: visual.lastRedrawMs as number,
      gpuGeometries: visual.gpuGeometries as number,
      sceneGeometries: visual.sceneGeometries as number,
      drawCalls: visual.drawCalls as number,
    };
  });
}
const id = (s:Awaited<ReturnType<typeof snap>>, pos:{x:number;y:number})=>s.ids[pos.x+','+pos.y];

async function clickGrid(page: Page, point: {x:number;y:number}) {
  const p = await page.evaluate(({x,y})=>(window as any).__castleVisualGridPoint(x,y),point);
  expect(p.x).toBeGreaterThan(5); expect(p.x).toBeLessThan(1275);
  expect(p.y).toBeGreaterThan(5); expect(p.y).toBeLessThan(715);
  await page.mouse.click(p.x,p.y);
}

test('road placement reuses unrelated meshes and rebuilds only road connection neighbors', async ({ page }) => {
  test.setTimeout(180000);
  await start(page);
  const before = await snap(page);
  expect(before.cells.length).toBeGreaterThan(140);
  expect(id(before,gap)).toBeUndefined();
  for (const pos of [neighboringRoad,distantRoad,distantCottage])
    expect(id(before,pos)).toBeDefined();
  await page.locator('[data-tool="stoneRoad"]').evaluate(el=>(el as HTMLButtonElement).click());
  await clickGrid(page,gap);
  const after = await snap(page);
  expect(after.cells.some(c=>c.x===gap.x && c.y===gap.y && c.kind==='stoneRoad')).toBeTruthy();
  expect(after.stats.reusedBuildings).toBeGreaterThan(110);
  expect(after.stats.rebuiltBuildings).toBeLessThan(12);
  expect(id(after,distantRoad)).toBe(id(before,distantRoad));
  expect(id(after,distantCottage)).toBe(id(before,distantCottage));
  expect(id(after,neighboringRoad)).not.toBe(id(before,neighboringRoad));
  expect(id(after,gap)).toBeDefined();
  console.log(JSON.stringify({ phase:'road', reused:after.stats.reusedBuildings,
    rebuilt:after.stats.rebuiltBuildings, redrawMs:after.redrawMs }));

  // A/B: identical completed scene, differing only in geometry reconstruction.
  await page.evaluate(()=>(window as any).__castleVisualRebuildConstruction(false));
  const full = await snap(page);
  expect(full.stats.reusedBuildings).toBe(0);
  expect(id(full,distantRoad)).not.toBe(id(after,distantRoad));
  await page.evaluate(()=>(window as any).__castleVisualRebuildConstruction(true));
  const reused = await snap(page);
  expect(reused.stats.reusedBuildings).toBeGreaterThan(110);
  expect(reused.stats.rebuiltBuildings).toBeLessThan(10);
  expect(id(reused,distantRoad)).toBe(id(full,distantRoad));
  expect(id(reused,distantCottage)).toBe(id(full,distantCottage));
  expect(Object.keys(reused.ids).sort()).toEqual(Object.keys(full.ids).sort());
  expect(reused.sceneGeometries).toBe(full.sceneGeometries);
  console.log(JSON.stringify({
    phase:'A/B-identical-scene', fullRedrawMs:full.redrawMs,
    reusedRedrawMs:reused.redrawMs, reusedBuildings:reused.stats.reusedBuildings,
    rebuiltBuildings:reused.stats.rebuiltBuildings,
    sceneGeometries:reused.sceneGeometries,
  }));
});

test('fortification upgrade and cottage relocation preserve unrelated road meshes; undo/reload remain correct', async ({ page }) => {
  test.setTimeout(180000);
  await start(page);
  const before = await snap(page);
  await page.locator('[data-build-none]').first().evaluate(el=>(el as HTMLButtonElement).click());
  await clickGrid(page,upgradeTower);
  await expect(page.locator('#fortification-upgrade-button')).toBeEnabled();
  await page.locator('#fortification-upgrade-button').evaluate(el=>(el as HTMLButtonElement).click());
  const upgraded = await snap(page);
  expect(upgraded.cells.find(c=>c.x===upgradeTower.x && c.y===upgradeTower.y)?.level).toBe(2);
  expect(id(upgraded,distantRoad)).toBe(id(before,distantRoad));
  expect(upgraded.stats.reusedBuildings).toBeGreaterThan(100);
  console.log(JSON.stringify({phase:'tower-upgrade',reused:upgraded.stats.reusedBuildings,
    rebuilt:upgraded.stats.rebuiltBuildings,redrawMs:upgraded.redrawMs}));

  await clickGrid(page,movedCottage);
  await page.locator('#world-selection-move').evaluate(el=>(el as HTMLButtonElement).click());
  await clickGrid(page,moveTarget);
  const moved=await snap(page);
  expect(moved.cells.some(c=>c.x===moveTarget.x && c.y===moveTarget.y && c.kind==='cottage')).toBeTruthy();
  expect(moved.cells.some(c=>c.x===movedCottage.x && c.y===movedCottage.y)).toBeFalsy();
  expect(id(moved,distantRoad)).toBe(id(upgraded,distantRoad));
  expect(moved.stats.reusedBuildings).toBeGreaterThan(100);
  await page.keyboard.press('Control+z');
  const undone=await snap(page);
  expect(undone.cells.some(c=>c.x===movedCottage.x && c.y===movedCottage.y)).toBeTruthy();
  await page.keyboard.press('Control+y');
  const redone=await snap(page);
  expect(redone.cells.some(c=>c.x===moveTarget.x && c.y===moveTarget.y && c.kind==='cottage')).toBeTruthy();
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof (window as any).__castleTouchQA==='function');
  const loaded=await snap(page);
  expect(loaded.cells.find(c=>c.x===upgradeTower.x&&c.y===upgradeTower.y)?.level).toBe(2);
  expect(loaded.cells.some(c=>c.x===moveTarget.x&&c.y===moveTarget.y&&c.kind==='cottage')).toBeTruthy();
  console.log(JSON.stringify({phase:'relocation',reused:moved.stats.reusedBuildings,
    rebuilt:moved.stats.rebuiltBuildings,redrawMs:moved.redrawMs}));
});
