import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
const { worldGridForLayout } = await import('../src/world/WorldGrid.ts');
const {
  TRIPLE_ISLES_MAP_WIDTH,
  TRIPLE_ISLES_MAP_DEPTH,
  terrainForMapLayout,
  normalizeMapLayoutId,
} = await import('../src/world/MapLayouts.ts');

const grid = worldGridForLayout('triple-isles-100x100');
assert.equal(grid.cols * TILE_SIZE, 100, 'Three Isles width must support the requested 100 world units.');
assert.equal(grid.rows * TILE_SIZE, 100, 'Three Isles depth must support the requested 100 world units.');
assert.equal(TRIPLE_ISLES_MAP_WIDTH, 100);
assert.equal(TRIPLE_ISLES_MAP_DEPTH, 100);
assert.equal(normalizeMapLayoutId('triple-isles-100x100'), 'triple-isles-100x100');

const terrain = Array.from({ length: grid.rows }, (_, y) =>
  Array.from({ length: grid.cols }, (_, x) =>
    terrainForMapLayout('triple-isles-100x100', x, y, grid),
  ),
);

const visited = new Set();
const components = [];
const key = (x, y) => `${x},${y}`;
for (let y = 0; y < grid.rows; y += 1) {
  for (let x = 0; x < grid.cols; x += 1) {
    if (terrain[y][x] === 'water' || visited.has(key(x, y))) continue;
    const queue = [[x, y]];
    const cells = [];
    visited.add(key(x, y));
    while (queue.length > 0) {
      const [cx, cy] = queue.shift();
      cells.push([cx, cy]);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= grid.cols || ny >= grid.rows) continue;
        if (terrain[ny][nx] === 'water' || visited.has(key(nx, ny))) continue;
        visited.add(key(nx, ny));
        queue.push([nx, ny]);
      }
    }
    components.push(cells);
  }
}

assert.equal(components.length, 3, 'Three Isles must contain exactly three separated land masses.');
for (const cells of components) {
  assert.ok(cells.length >= 55, 'Every island must be large enough for meaningful settlement gameplay.');
}

const profile = (cells) => {
  const counts = new Map();
  let sumX = 0;
  let sumY = 0;
  for (const [x, y] of cells) {
    const kind = terrain[y][x];
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
    sumX += x;
    sumY += y;
  }
  return {
    counts,
    centerX: sumX / cells.length,
    centerY: sumY / cells.length,
  };
};

const profiles = components.map(profile);
const western = [...profiles].sort((a, b) => a.centerX - b.centerX)[0];
const rocky = [...profiles].sort((a, b) => b.centerX - a.centerX)[0];
const southern = [...profiles].sort((a, b) => b.centerY - a.centerY)[0];

assert.ok((western.counts.get('forest') ?? 0) >= 12, 'Western island must have a strong forest identity.');
assert.ok((western.counts.get('plains') ?? 0) >= 28, 'Western island must retain broad buildable plains.');
assert.ok((rocky.counts.get('mountain') ?? 0) >= 20, 'Northern/eastern island must have a strong rocky identity.');
assert.ok((southern.counts.get('plains') ?? 0) >= 30, 'Southern island must remain open and buildable.');
assert.ok((southern.counts.get('shore') ?? 0) >= 25, 'Southern island must have a broad beach/shore identity.');

console.log('Three Isles 100×100 map checks passed.');
