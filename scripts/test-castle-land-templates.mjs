import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { registerHooks, stripTypeScriptTypes } from 'node:module';

registerHooks({
  resolve(specifier, context, next) {
    try { return next(specifier, context); }
    catch (error) {
      if (specifier.startsWith('.') && !specifier.endsWith('.ts')) return next(specifier + '.ts', context);
      throw error;
    }
  },
  load(url, context, next) {
    if (url.endsWith('.ts')) return {
      format: 'module',
      shortCircuit: true,
      source: stripTypeScriptTypes(readFileSync(new URL(url), 'utf8'), { mode: 'transform' }),
    };
    return next(url, context);
  },
});

const { TILE_SIZE } = await import('../src/core/constants.ts');
const { KeepSystem } = await import('../src/building/KeepSystem.ts');
const { worldGridForLayout } = await import('../src/world/WorldGrid.ts');
const { terrainForMapLayout, isMapLayoutId } = await import('../src/world/MapLayouts.ts');
const { createCastleLandTemplate } = await import('../src/world/CastleLandTemplates.ts');

const [gameSource, saveSource, pickerSource, persianSource] = await Promise.all([
  readFile(new URL('../src/ThreeGame.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/core/SaveSystem.ts', import.meta.url), 'utf8'),
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../src/i18n/faTemplates.ts', import.meta.url), 'utf8'),
]);
const scenarios = [
  ['highland-crown-100x100', 6201, 'Highland Crown 100×100', 'dark-stone mountain citadel'],
  ['sunset-lagoon-100x100', 6301, 'Sunset Lagoon 100×100', 'sandstone coastal castle'],
];
const terrains = new Map();

for (const [layout, seed, label, description] of scenarios) {
  assert.equal(isMapLayoutId(layout), true, `${layout} must survive layout normalization`);
  const grid = worldGridForLayout(layout);
  assert.deepEqual([grid.cols, grid.rows], [25, 25]);
  assert.deepEqual([grid.cols * TILE_SIZE, grid.rows * TILE_SIZE], [100, 100]);
  const counts = new Map();
  for (let y = 0; y < grid.rows; y += 1) {
    for (let x = 0; x < grid.cols; x += 1) {
      const kind = terrainForMapLayout(layout, x, y, grid);
      counts.set(kind, (counts.get(kind) ?? 0) + 1);
      assert.equal(terrainForMapLayout(layout, x, y, grid), kind, 'Terrain must be deterministic');
    }
  }
  terrains.set(layout, counts);
  for (const [kind, minimum] of [['plains', 250], ['mountain', 10], ['forest', 10], ['shore', 20], ['water', 20]]) {
    assert.ok((counts.get(kind) ?? 0) >= minimum, `${layout} requires at least ${minimum} ${kind} cells`);
  }

  const template = createCastleLandTemplate(layout);
  const repeat = createCastleLandTemplate(layout);
  assert.deepEqual(template, repeat, 'Prepared castles must be deterministic');
  assert.equal(template.keeps.length, 1, 'Each starting world needs a working keep');
  assert.ok(template.cells.length >= 65, 'Castle and settlement should be substantial');
  const placed = new Map(template.cells.map(cell => [`${cell.x},${cell.y}`, cell]));
  assert.equal(placed.size, template.cells.length, 'No duplicate cell coordinates');
  for (const cell of template.cells) {
    assert.ok(cell.x >= 0 && cell.y >= 0 && cell.x < grid.cols && cell.y < grid.rows);
    assert.ok(!['water', 'shore', 'river'].includes(terrainForMapLayout(layout, cell.x, cell.y, grid)),
      `${layout}: ${cell.kind} at ${cell.x},${cell.y} must not occupy water`);
  }
  for (const [kind, minimum] of [['wall1', 30], ['gate', 2], ['tower', 4], ['farm', 1], ['mine', 1], ['armyCamp', 1], ['stoneRoad', 4]]) {
    assert.ok(template.cells.filter(cell => cell.kind === kind).length >= minimum,
      `${layout} must provide ${kind} as editable game cells`);
  }
  const keepSystem = new KeepSystem();
  keepSystem.replace(template.keeps);
  for (const keep of template.keeps) {
    assert.ok(keep.floors >= 4, 'Castle keeps must have a defensible silhouette');
    for (const { x, y } of keepSystem.footprint(keep)) {
      assert.ok(!placed.has(`${x},${y}`), 'Keep footprint must be clear of structure cells');
      assert.equal(terrainForMapLayout(layout, x, y, grid), 'plains', 'Keep requires solid foundation');
    }
  }

  assert.equal(pickerSource.split(`data-template="${layout}"`).length - 1, 1, 'One picker card per world');
  assert.ok(pickerSource.includes(label) && pickerSource.includes(description));
  assert.ok(gameSource.includes(`'${layout}': { layoutId: '${layout}', seed: ${seed} }`));
  assert.ok(gameSource.includes("createCastleLandTemplate(template)"));
  assert.ok(saveSource.includes(`value === '${layout}'`), 'Saved layout ID must reload unchanged');
  assert.ok(persianSource.includes(`"${label}":`), 'Map label must translate to Persian');
}
assert.ok(gameSource.includes("placeHarborTemplate(3, 'tradingBoat', 20, 17)"),
  'Lagoon must offer a playable trading harbor');

assert.notDeepEqual(terrains.get(scenarios[0][0]), terrains.get(scenarios[1][0]),
  'Two new maps must have genuinely different terrain compositions');
console.log('Highland Crown + Sunset Lagoon editable castle world checks passed.');
