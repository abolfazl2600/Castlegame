import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';

// Run the actual TypeScript runtime, including its extensionless bundler imports.
const packageUrl = new URL('../package.json', import.meta.url).href;
registerHooks({
  resolve(specifier, context, next) {
    try { return next(specifier, context); }
    catch (error) {
      if (specifier.startsWith('.') && !specifier.endsWith('.ts')) return next(specifier + '.ts', context);
      throw error;
    }
  },
  load(url, context, next) {
    if (url.endsWith('.ts')) return { format: 'module', shortCircuit: true,
      source: stripTypeScriptTypes(readFileSync(new URL(url), 'utf8'), { mode: 'transform' }) };
    if (url === packageUrl) return { format: 'module', shortCircuit: true,
      source: 'export default ' + readFileSync(new URL(url), 'utf8') };
    return next(url, context);
  },
});
const { TILE_SIZE, WORLD_COLS } = await import('../src/core/constants.ts');
const { terrainForMapLayout, normalizeMapLayoutId, urbanLandBounds } = await import('../src/world/MapLayouts.ts');
const { createUrbanCityTemplate } = await import('../src/world/UrbanCityTemplate.ts');
const bounds = urbanLandBounds(WORLD_COLS);
assert.equal(bounds.cols * TILE_SIZE, 60);
assert.equal(bounds.rows * TILE_SIZE, 80);
assert.equal(normalizeMapLayoutId('urban-60x80'), 'urban-60x80');
assert.equal(normalizeMapLayoutId('unknown'), 'island');
let land = 0;
for (let y = -1; y <= WORLD_COLS; y += 1) {
  for (let x = -1; x <= WORLD_COLS; x += 1) {
    const inside = x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY;
    assert.equal(terrainForMapLayout('urban-60x80', x, y, WORLD_COLS), inside ? 'plains' : 'water');
    if (inside) land += 1;
  }
}
assert.equal(land, 300);
const cells = createUrbanCityTemplate(WORLD_COLS);
assert.deepEqual(cells, createUrbanCityTemplate(WORLD_COLS), 'City is deterministic');
assert.throws(() => createUrbanCityTemplate(10), RangeError);
const key = (x, y) => `${x},${y}`;
assert.equal(new Set(cells.map(c => key(c.x, c.y))).size, cells.length, 'No overlapping anchors');
for (const cell of cells) assert.equal(terrainForMapLayout('urban-60x80', cell.x, cell.y, WORLD_COLS), 'plains');
const roads = new Set(cells.filter(c => c.kind === 'stoneRoad').map(c => key(c.x, c.y)));
const neighbors = (x, y) => [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]];
const visited = new Set();
const queue = [[...roads][0]];
while (queue.length) {
  const current = queue.pop();
  if (visited.has(current)) continue;
  visited.add(current);
  const [x, y] = current.split(',').map(Number);
  for (const [nx, ny] of neighbors(x, y)) if (roads.has(key(nx, ny))) queue.push(key(nx, ny));
}
assert.equal(visited.size, roads.size, 'All avenues, cross streets, and plaza are connected');
for (const cell of cells.filter(c => c.kind !== 'tree' && c.kind !== 'stoneRoad')) {
  assert.ok(neighbors(cell.x, cell.y).some(([x, y]) => roads.has(key(x, y))), `${cell.kind} has street access`);
}
for (const kind of ['house', 'cottage', 'manor', 'basilica', 'market', 'carpenter', 'farm', 'cowBarn', 'windmill', 'appleOrchard', 'tree']) {
  assert.ok(cells.some(c => c.kind === kind), `Missing city district: ${kind}`);
}
// The same normal cells survive real save serialization and loading.
const { GameState } = await import('../src/state/GameState.ts');
const { KeepSystem } = await import('../src/building/KeepSystem.ts');
const { SaveSystem } = await import('../src/core/SaveSystem.ts');
const { isBuildingAvailable } = await import('../src/core/GameMode.ts');
const state = new GameState();
for (const { x, y, kind, level, ...options } of cells) state.setCell(x, y, kind, level, options);
let layout = 'urban-60x80';
const host = {
  state, keepSystem: new KeepSystem(), terrainOverrides: new Map(), elevationOverrides: new Map(), towerBridges: new Map(),
  getGameMode: () => state.getGameMode(), getMapLayoutId: () => layout, setMapLayoutId: value => { layout = value; },
  getWorldSeed: () => 6001, setWorldSeed: () => {}, getStoneStyle: () => 'limestone', setStoneStyle: () => {},
  getWorldSeeded: () => true, setWorldSeeded: () => {}, getMilitaryTier: () => 1, setMilitaryTier: () => {},
  getEconomyState: () => undefined, getPopulationState: () => undefined,
  setLoadedSaveVersion: () => {}, migrateKind: (kind, level) => ({ kind, level }),
  isBuildingAvailable, key, syncLoadedWorldUI: () => {}, setStatus: () => {},
};
const memory = new Map();
const storage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value), removeItem: key => memory.delete(key) };
const saves = new SaveSystem(host, storage);
assert.equal(saves.autoSave(false), true);
const expected = state.entries();
state.clear(); layout = 'island';
assert.equal(saves.load(), true);
assert.equal(layout, 'urban-60x80');
const cityFields = entries => entries.map(({ x, y, kind, level, rotation }) => ({ x, y, kind, level, rotation }));
assert.deepEqual(cityFields(state.entries()), cityFields(expected));
console.log(`Urban city checks passed: 60×80 land, ${cells.length} editable cells, connected streets, and save/load.`);
