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

const { TILE_SIZE, WORLD_COLS, WORLD_ROWS } = await import('../src/core/constants.ts');
const {
  ROYAL_VALLEY_LAND_WIDTH,
  ROYAL_VALLEY_LAND_DEPTH,
  royalValleyLandBounds,
  terrainForMapLayout,
  normalizeMapLayoutId,
} = await import('../src/world/MapLayouts.ts');

const threeGame = await readFile(new URL('../src/ThreeGame.ts', import.meta.url), 'utf8');
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

assert.equal(WORLD_COLS, 23, 'The world grid must provide the 23 columns required by authored 89–90 unit maps.');
assert.equal(WORLD_ROWS, 23, 'The world grid must provide the 23 rows required by authored 89–90 unit maps.');
assert.equal(ROYAL_VALLEY_LAND_WIDTH, 50);
assert.equal(ROYAL_VALLEY_LAND_DEPTH, 89);
assert.equal(normalizeMapLayoutId('royal-valley-50x89'), 'royal-valley-50x89');

const bounds = royalValleyLandBounds(WORLD_COLS);
assert.equal(bounds.cols, Math.ceil(ROYAL_VALLEY_LAND_WIDTH / TILE_SIZE));
assert.equal(bounds.rows, Math.ceil(ROYAL_VALLEY_LAND_DEPTH / TILE_SIZE));
assert.equal(bounds.cols, 13, '50 world units must rasterize to a 13-cell playable width.');
assert.equal(bounds.rows, 23, '89 world units must rasterize to a 23-cell playable depth.');
assert.equal(bounds.minY, 0, 'Royal Valley should use the full north-south depth without clipping.');

const counts = new Map();
for (let y = 0; y < WORLD_ROWS; y += 1) {
  for (let x = 0; x < WORLD_COLS; x += 1) {
    const terrain = terrainForMapLayout('royal-valley-50x89', x, y, WORLD_COLS);
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
assert.ok((counts.get('plains') ?? 0) > 80, 'The map needs substantial contiguous buildable plains.');
assert.ok((counts.get('river') ?? 0) >= 10, 'The north-south river must be visually and strategically meaningful.');

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

console.log('Royal Valley 50×89 map contract checks passed.');
