import { expect, test, type Page } from '@playwright/test';
import { SAVE_KEY, SAVE_AUTOSAVE_KEY, SAVE_VERSION } from '../src/core/constants';

test.use({ viewport: { width: 1280, height: 720 } });
type Point = { x: number; y: number };
const keepCenter: Point = { x: 11, y: 11 };
const keepCorner: Point = { x: 10, y: 9 }; // rotated 4x2 keep => 2x4 footprint
const cottage: Point = { x: 14, y: 11 };
const marketSatellite: Point = { x: 16, y: 15 };
const marketAnchor: Point = { x: 17, y: 15 };
const free: Point = { x: 13, y: 11 };
const freed: Point = { x: 10, y: 10 };

async function openGame(page: Page) {
  const now = 1700000000000;
  await page.addInitScript(({marker, autosave, version, when}) => {
    localStorage.setItem(marker, '1');
    localStorage.setItem('castle-role.settings.v2', JSON.stringify({
      schemaVersion: 2, gameplay: {controlScheme:'standard',tutorialCompleted:true},
      graphics: {quality:'low',performanceMode:'performance',environmentDetail:'low',
        effectsEnabled:false,shadowsEnabled:false},
      interface: {language:'en',showHelp:false,reducedMotion:true},
      audio: {muted:true,masterVolume:0}
    }));
    if (localStorage.getItem(autosave)) return;
    const terrain: Array<{x:number;y:number;kind:string}> = [];
    for (let y=7; y<=18; y++) for (let x=7; x<=19; x++)
      terrain.push({x,y,kind:'plains'});
    localStorage.setItem(autosave, JSON.stringify({
      metadata:{id:'foundation-309',slot:'autosave',name:'Foundation protection QA',
        createdAt:when,updatedAt:when,schemaVersion:version,gameMode:'unified',
        summary:{buildings:2,keeps:1,terrainChanges:terrain.length,elevations:0}},
      data:{version,gameMode:'unified',mapLayoutId:'mainland',updatedAt:when,
        worldSeed:309,worldSeeded:true,
        cells:[{x:14,y:11,kind:'cottage',level:1},{x:17,y:15,kind:'market',level:1}],
        keeps:[{id:1,seed:1309,x:11,y:11,width:4,depth:2,rotation:1,
          floors:2,cornerTowers:true,roof:'sloped',battlements:true}],
        terrain,elevations:[],towerBridges:[],stoneStyle:'limestone'}
    }));
  }, {marker:SAVE_KEY,autosave:SAVE_AUTOSAVE_KEY,version:SAVE_VERSION,when:now});
  await page.goto('/Castlegame/?visualBaseline=1&touchQA=1',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#toolbar [data-build-none]')).toHaveCount(1,{timeout:65000});
  await page.waitForFunction(()=>typeof (window as any).__castleTouchQA==='function'
    && typeof (window as any).__castleVisualGridPoint==='function');
  // Default brush spans neighboring cells. Use exactly one cell when testing
  // protection and history; a wider brush is allowed to edit adjacent free land.
  await page.locator('#brush-size').evaluate(el => {
    const select = el as HTMLSelectElement;
    select.value = '1';
    select.dispatchEvent(new Event('change',{bubbles:true}));
  });
  await page.evaluate(() => (window as any).__castleVisualCamera({
    x:63,y:83,z:65,targetX:0,targetY:0,targetZ:0,
  }));
}
async function snapshot(page:Page) {
  return page.evaluate(() => {
    const s = (window as any).__castleTouchQA();
    return {
      elevations: Object.fromEntries(s.elevations as Array<[string,number]>),
      cells: s.cells, undo: s.undoCount,
    };
  });
}
async function clickTool(page:Page,tool:string,point:Point) {
  await page.locator('[data-tool="'+tool+'"]').evaluate(el => (el as HTMLButtonElement).click());
  const screen = await page.evaluate(({x,y})=>(window as any).__castleVisualGridPoint(x,y),point);
  expect(screen.x,'target inside viewport').toBeGreaterThan(15);
  expect(screen.x,'target inside viewport').toBeLessThan(1265);
  expect(screen.y,'target inside viewport').toBeGreaterThan(15);
  expect(screen.y,'target inside viewport').toBeLessThan(705);
  await page.mouse.click(screen.x,screen.y);
}
const elevation = (s:Awaited<ReturnType<typeof snapshot>>,p:Point) => s.elevations[p.x+','+p.y];

test('terrain strokes protect rotated Keep, cottage, Market satellite and allow adjacent empty land',async ({page})=>{
  test.setTimeout(150000);
  await openGame(page);
  const before=await snapshot(page);
  expect(before.cells.length).toBeGreaterThanOrEqual(2);
  expect(Object.keys(before.elevations)).toHaveLength(0);

  for (const point of [keepCenter,keepCorner,cottage,marketAnchor,marketSatellite]) {
    await clickTool(page,'raise',point);
    const result=await snapshot(page);
    expect(elevation(result,point),`protected tile ${point.x},${point.y}`).toBeUndefined();
    expect(result.undo,'a rejected edit cannot add a history transaction').toBe(before.undo);
  }
  await clickTool(page,'raise',free);
  const raised=await snapshot(page);
  expect(elevation(raised,free)).toBeGreaterThan(0);
  expect(raised.undo).toBe(before.undo+1);
  for(const protectedCell of [keepCenter,keepCorner,cottage,marketAnchor,marketSatellite])
    expect(elevation(raised,protectedCell)).toBeUndefined();

  await page.keyboard.press('Control+z');
  const undone=await snapshot(page);
  expect(elevation(undone,free)).toBeUndefined();
  expect(undone.undo).toBe(before.undo);

  await page.keyboard.press('Control+y');
  const redone=await snapshot(page);
  expect(elevation(redone,free)).toBeCloseTo(elevation(raised,free));
  expect(redone.cells).toEqual(before.cells);

  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof (window as any).__castleTouchQA==='function');
  const saved=await snapshot(page);
  expect(elevation(saved,free)).toBeCloseTo(elevation(raised,free));
  expect(saved.cells).toEqual(before.cells);
  for(const protectedCell of [keepCenter,keepCorner,cottage,marketAnchor,marketSatellite])
    expect(elevation(saved,protectedCell)).toBeUndefined();
});

test('erasing a Keep releases its rotated foundation for subsequent terrain editing',async ({page})=>{
  test.setTimeout(150000);
  await openGame(page);
  const initial=await snapshot(page);
  await clickTool(page,'lower',freed);
  expect(elevation(await snapshot(page),freed)).toBeUndefined();

  await clickTool(page,'erase',keepCenter);
  const removed=await snapshot(page);
  expect(removed.undo).toBe(initial.undo+1);
  await clickTool(page,'lower',freed);
  const lowered=await snapshot(page);
  expect(elevation(lowered,freed)).toBeLessThan(0);
  expect(lowered.undo).toBe(initial.undo+2);

  await page.keyboard.press('Control+z');
  expect(elevation(await snapshot(page),freed)).toBeUndefined();
  await page.keyboard.press('Control+z');
  const restored=await snapshot(page);
  expect(elevation(restored,freed)).toBeUndefined();
  await clickTool(page,'raise',freed);
  expect(elevation(await snapshot(page),freed),'restored Keep blocks later edits').toBeUndefined();
});
