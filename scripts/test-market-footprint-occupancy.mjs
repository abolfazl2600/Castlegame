import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks, stripTypeScriptTypes } from 'node:module';

registerHooks({
  resolve(specifier, context, next) {
    try { return next(specifier, context); }
    catch (error) {
      if (specifier.startsWith('.') && !specifier.endsWith('.ts')) {
        return next(specifier + '.ts', context);
      }
      throw error;
    }
  },
  load(url, context, next) {
    if (url.endsWith('.ts')) {
      return {
        format: 'module', shortCircuit: true,
        source: stripTypeScriptTypes(readFileSync(new URL(url), 'utf8'), { mode: 'transform' }),
      };
    }
    return next(url, context);
  },
});

const {
  getStructureFootprint,
  findStructureAnchorAt,
  isMultiCellFootprintReserved,
} = await import('../src/building/StructureFootprints.ts');
const { GameState } = await import('../src/state/GameState.ts');

const market = { x: 20, y: 30, kind: 'market', level: 1 };
const tiles = getStructureFootprint('market', market.x, market.y);
assert.equal(tiles.length, 9, 'Market must reserve its rendered 3×3 footprint');
assert.deepEqual(tiles, [
  { x: 19, y: 29 }, { x: 20, y: 29 }, { x: 21, y: 29 },
  { x: 19, y: 30 }, { x: 20, y: 30 }, { x: 21, y: 30 },
  { x: 19, y: 31 }, { x: 20, y: 31 }, { x: 21, y: 31 },
]);
assert.deepEqual(getStructureFootprint('farm', 20, 30), [{ x: 20, y: 30 }],
  'Existing single-cell buildings must remain single-cell');
assert.deepEqual(getStructureFootprint('harbor', 20, 30), [{ x: 20, y: 30 }]);

const state = new GameState();
state.setCell(20, 30, 'market');
assert.equal(state.entries().length, 1, 'A multi-cell Market must keep only one authoritative anchor');
assert.equal(state.getCell(19, 29), undefined, 'Satellite cells must not be duplicated into GameState');
assert.equal(isMultiCellFootprintReserved(state.entries(), 19, 29), true,
  'An adjacent construction must see occupied Market satellite tiles');
assert.equal(isMultiCellFootprintReserved(state.entries(), 21, 31), true);
assert.equal(isMultiCellFootprintReserved(state.entries(), 20, 30), true,
  'The Market anchor must be protected from terrain edits');
assert.equal(isMultiCellFootprintReserved(state.entries(), 18, 30), false);
assert.equal(findStructureAnchorAt(state.entries(), 19, 30)?.x, 20,
  'Clicking a satellite tile must select/demolish the same Market anchor');
assert.equal(findStructureAnchorAt(state.entries(), 21, 31)?.y, 30);
assert.equal(findStructureAnchorAt(state.entries(), 18, 30), undefined);

const saved = JSON.parse(JSON.stringify(state.entries()));
const loaded = new GameState();
loaded.replace(saved);
assert.deepEqual(loaded.entries(), saved, 'Save/load must preserve legacy Market anchor coordinates');
assert.equal(isMultiCellFootprintReserved(loaded.entries(), 19, 29), true,
  'After loading, the complete footprint must be reconstructed automatically');
loaded.removeCell(20, 30);
assert.equal(isMultiCellFootprintReserved(loaded.entries(), 19, 29), false,
  'Demolishing the Market anchor must immediately release its full footprint');

const anotherMarket = { x: 22, y: 30, kind: 'market' };
assert.equal(isMultiCellFootprintReserved([market], 21, 30, { x: 20, y: 30 }), false,
  'A moving Market may reuse any part of its own previous footprint');
assert.equal(isMultiCellFootprintReserved([market, anotherMarket], 21, 30, { x: 20, y: 30 }), true,
  'Ignoring a moving Market must not ignore adjacent Markets');
const legacyHouse = { x: 21, y: 30, kind: 'cottage' };
assert.equal(findStructureAnchorAt([market, legacyHouse], 21, 30), legacyHouse,
  'An already-existing legacy overlapping anchor takes precedence over a satellite hit');
assert.equal(findStructureAnchorAt([market, legacyHouse], 19, 30), market);

const gameSource = readFileSync(new URL('../src/ThreeGame.ts', import.meta.url), 'utf8');
const saveSource = readFileSync(new URL('../src/core/SaveSystem.ts', import.meta.url), 'utf8');
const body = (method, next) => {
  const start = gameSource.indexOf('  private ' + method + '(');
  assert.ok(start >= 0, method + ' must exist');
  const end = gameSource.indexOf('\n  private ' + next + '(', start);
  assert.ok(end >= 0, next + ' must follow ' + method);
  return gameSource.slice(start, end);
};
assert.match(body('buildPlacementFootprint', 'evaluateBuildPlacement'),
  /getStructureFootprint\('market', point\.x, point\.y\)/,
  'Market placement preview must share the canonical footprint');
assert.match(body('isStructureFootprintReserved', 'canEditTerrainAt'),
  /isMultiCellFootprintReserved\(this\.services\.state\.entries\(\), x, y, ignoreAnchor\)/,
  'Terrain protection must use the central Market footprint');
assert.match(body('canBuildMarketAt', 'canBuildOnTerrain'),
  /getStructureFootprint\('market', gx, gy\)/,
  'The full Market footprint must be validated on placement');
assert.match(body('canBuildMarketAt', 'canBuildOnTerrain'),
  /isStructureFootprintReserved\(x, y, ignoreCell\)/,
  'Relocation must ignore only the original Market anchor');
assert.match(body('evaluateRelocationTarget', 'renderRelocationPreview'),
  /isStructureFootprintReserved\(point\.x, point\.y, origin\)/,
  'Relocation must not reject a nearby position overlapping only itself');
assert.match(body('handleBuildClick', 'canBuildMarketAt'),
  /findStructureAnchorAt\(this\.services\.state\.entries\(\), gx, gy\)/,
  'Inspect/demolish must resolve Market satellite clicks');
assert.match(body('renderSelectionVisual', 'syncSelectionActionUI'),
  /getStructureFootprint\(cell\.kind, this\.selectedCell\.x, this\.selectedCell\.y\)/,
  'The selection outline must cover the complete Market');
assert.match(saveSource, /cells: this\.host\.state\.entries\(\)/);
assert.match(saveSource, /this\.host\.state\.replace\(cells\)/);

console.log('Market 3×3 placement, occupancy, satellite selection, demolition, relocation, terrain and saved-anchor regressions passed.');
