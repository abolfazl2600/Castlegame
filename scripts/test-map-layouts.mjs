import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const mapLayouts = await readFile(
  new URL('../src/world/MapLayouts.ts', import.meta.url),
  'utf8',
);
const types = await readFile(
  new URL('../src/core/types.ts', import.meta.url),
  'utf8',
);
const saveSystem = await readFile(
  new URL('../src/core/SaveSystem.ts', import.meta.url),
  'utf8',
);
const threeGame = await readFile(
  new URL('../src/ThreeGame.ts', import.meta.url),
  'utf8',
);
const html = await readFile(
  new URL('../index.html', import.meta.url),
  'utf8',
);

function between(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `Missing start marker: ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `Missing end marker: ${endMarker}`);
  return source.slice(start, end);
}

assert.match(
  types,
  /export type MapLayoutId = 'island' \| 'mainland' \| 'peninsula' \| 'twin-isles' \| 'urban-60x80';/,
  'Map layouts must have a persisted finite ID type.',
);

for (const id of ['island', 'mainland', 'peninsula', 'twin-isles', 'urban-60x80']) {
  assert.match(
    mapLayouts,
    new RegExp(`id: '${id}'`),
    `Missing map layout registry entry: ${id}`,
  );
}

assert.match(
  mapLayouts,
  /export function terrainForMapLayout\(/,
  'Whole-map terrain must come from a single registered layout generator.',
);
assert.match(
  mapLayouts,
  /if \(layout === 'mainland'\) return mainlandScore/,
  'Mainland must have its own coastline function.',
);
assert.match(
  mapLayouts,
  /if \(layout === 'peninsula'\) return peninsulaScore/,
  'Peninsula must have its own coastline function.',
);
assert.match(
  mapLayouts,
  /if \(layout === 'twin-isles'\) return twinIslesScore/,
  'Twin Isles must have its own coastline function.',
);
assert.match(
  mapLayouts,
  /return isMapLayoutId\(value\) \? value : 'island';/,
  'Unknown/legacy layout IDs must fall back to Classic Island.',
);

const baseTerrain = between(
  threeGame,
  'private baseTerrainAt(x: number, y: number): TerrainKind {',
  'private terrainAt(',
);
assert.match(
  baseTerrain,
  /terrainForMapLayout\(this\.mapLayoutId, x, y, SIZE\)/,
  'Tile terrain must delegate to the selected whole-map layout.',
);

assert.match(
  threeGame,
  /private readonly worldLayoutLayer = new THREE\.Group\(\)/,
  'World silhouette rendering must have a replaceable layout layer.',
);
assert.match(
  threeGame,
  /private rebuildWorldLayoutSurface\(\): void \{[\s\S]*?this\.baseTerrainAt\(x, y\)/,
  'Rendered land must be rebuilt from the same tile-level terrain source.',
);
assert.doesNotMatch(
  threeGame,
  /createIrregularIslandGeometry/,
  'The fixed circular island mesh must no longer be authoritative.',
);

const newGameFlow = between(
  threeGame,
  'private openMapLayoutSelector(',
  'private resetWorld(',
);
assert.match(
  threeGame,
  /if \(!hadSave\) this\.openMapLayoutSelector\(\)/,
  'A new game must open map selection directly.',
);
assert.match(
  newGameFlow,
  /MAP_LAYOUTS\.map/,
  'Map layout choices must be rendered from the registry.',
);
assert.match(
  newGameFlow,
  /this\.setMapLayoutId\(layoutId\);[\s\S]*?this\.startNewGame\(\);/,
  'Selecting a map layout must apply it before starting the new game.',
);

assert.match(
  html,
  /id="map-layout-modal"/,
  'New-game UI must expose a map-layout modal.',
);
assert.match(
  html,
  /id="map-layout-grid"/,
  'Map-layout modal needs a rendered selection grid.',
);

assert.match(
  saveSystem,
  /getMapLayoutId\(\): MapLayoutId;/,
  'Save host must expose the active layout.',
);
assert.match(
  saveSystem,
  /mapLayoutId: this\.host\.getMapLayoutId\(\)/,
  'Save data must persist the active map layout.',
);
assert.match(
  saveSystem,
  /setMapLayoutId\(validMapLayoutId\(data\.mapLayoutId\) \? data\.mapLayoutId : 'island'\)/,
  'Loading must restore layout and default old saves to Classic Island.',
);

const templateCompatibility = between(
  threeGame,
  'private applyTemplate(template: string): void {',
  'private applyTerrainTemplate(',
);
assert.match(
  templateCompatibility,
  /this\.mapLayoutId !== 'island' && template !== 'empty-land'/,
  'Complete legacy templates must be explicitly restricted when a non-island layout is active.',
);

const snapshot = between(
  threeGame,
  'private captureSnapshot(): HistorySnapshot {',
  'private restoreSnapshot(',
);
assert.match(
  snapshot,
  /mapLayoutId: this\.mapLayoutId/,
  'Undo snapshots must preserve map layout identity.',
);

console.log('Map layout regression checks passed.');
