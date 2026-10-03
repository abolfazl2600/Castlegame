import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { registerHooks, stripTypeScriptTypes } from 'node:module';

// Execute the actual TypeScript modules while supporting the project's extensionless bundler imports.
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

const { WORLD_COLS, WORLD_ROWS } = await import('../src/core/constants.ts');
const { worldGridForLayout } = await import('../src/world/WorldGrid.ts');
const {
  ROYAL_VALLEY_LAND_WIDTH,
  ROYAL_VALLEY_LAND_DEPTH,
  royalValleyLandBounds,
  terrainForMapLayout,
  normalizeMapLayoutId,
} = await import('../src/world/MapLayouts.ts');

const threeGame = await readFile(new URL('../src/ThreeGame.ts', import.meta.url), 'utf8');
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

assert.equal(WORLD_COLS, 23, 'Legacy/default worlds must remain 23 columns.');
assert.equal(WORLD_ROWS, 23, 'Legacy/default worlds must remain 23 rows.');
assert.equal(ROYAL_VALLEY_LAND_WIDTH, 50);
assert.equal(ROYAL_VALLEY_LAND_DEPTH, 89);
assert.equal(normalizeMapLayoutId('royal-valley-50x89'), 'royal-valley-50x89');

const royalGrid = worldGridForLayout('royal-valley-50x89');
assert.deepEqual(
  { cols: royalGrid.cols, rows: royalGrid.rows },
  { cols: 50, rows: 89 },
  'Royal Valley must use a true 50×89 tile runtime grid.',
);
assert.equal(royalGrid.chunkSize, 12, 'Royal Valley terrain must use the shared 12-tile chunk budget.');

const bounds = royalValleyLandBounds(royalGrid);
assert.equal(bounds.cols, 50);
assert.equal(bounds.rows, 89);
assert.equal(bounds.minX, 0);
assert.equal(bounds.minY, 0);

const counts = new Map();
for (let y = 0; y < royalGrid.rows; y += 1) {
  for (let x = 0; x < royalGrid.cols; x += 1) {
    const terrain = terrainForMapLayout('royal-valley-50x89', x, y, royalGrid);
    counts.set(terrain, (counts.get(terrain) ?? 0) + 1);
    const inside =
      x >= bounds.minX && x <= bounds.maxX &&
      y >= bounds.minY && y <= bounds.maxY;
    if (!inside) assert.equal(terrain, 'water', 'Cells outside the 50×89 authored ground must remain ocean.');
  }
}

for (const kind of ['plains', 'shore', 'river', 'forest', 'mountain', 'water']) {
  assert.ok((counts.get(kind) ?? 0) > 0, `Royal Valley must contain ${kind} terrain.`);
}
assert.ok((counts.get('plains') ?? 0) > 1800, 'The 50×89 map needs substantial contiguous buildable plains.');
assert.ok((counts.get('river') ?? 0) >= 120, 'The north-south river must be visually and strategically meaningful.');
assert.ok((counts.get('water') ?? 0) >= 200, 'The eastern ocean margin must provide real maritime water cells.');

assert.equal(html.split('data-template="royal-valley-50x89"').length - 1, 1, 'Royal Valley must appear once as a prepared starting world.');
assert.match(html, /Royal Valley 50×89/);
assert.match(
  threeGame,
  /'royal-valley-50x89': \{ layoutId: 'royal-valley-50x89', seed: 5089 \}/,
  'The prepared world must select the Royal Valley layout with a deterministic seed.',
);

const requiredFeatures = [
  "'wall2'",
  "'gate'",
  "'tower'",
  'placeKeepTemplate',
  "'stoneRoad'",
  "'cottage'",
  "'manor'",
  "'market'",
  "'mosque'",
  "'basilica'",
  "'carpenter'",
  "'farm'",
  "'cowBarn'",
  "'windmill'",
  "'mine'",
  "'armyCamp'",
  'addTemplateBridge',
  'placeHarborTemplate',
];
const royalBranchStart = threeGame.indexOf("template === 'royal-valley-50x89'");
const nextBranch = threeGame.indexOf("} else if (template === 'mainland-frontier')", royalBranchStart);
assert.ok(royalBranchStart >= 0 && nextBranch > royalBranchStart, 'Royal Valley authored branch is missing.');
const royalBranch = threeGame.slice(royalBranchStart, nextBranch);
for (const feature of requiredFeatures) {
  assert.ok(royalBranch.includes(feature), `Royal Valley prepared world is missing feature contract: ${feature}`);
}

assert.match(threeGame, /TerrainChunkRenderer/, 'ThreeGame must render large terrain through the chunk renderer.');
assert.doesNotMatch(threeGame, /const SIZE =/, 'ThreeGame must not regress to a single square SIZE constant.');

console.log('Royal Valley 50×89 tile + chunked-world contract checks passed.');
