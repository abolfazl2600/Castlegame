import assert from 'node:assert/strict';
import { createVisualScene, REFERENCE_CAMERA } from './visual-reference-scene.mjs';

const empty = createVisualScene('empty');
const reference = createVisualScene('reference');
const dense = createVisualScene('dense');
assert.equal(empty.data.cells.length, 0);
assert.ok(dense.data.cells.length > reference.data.cells.length * 3);
assert.deepEqual(createVisualScene('reference'), reference, 'Reference scene must be reproducible');
assert.deepEqual(createVisualScene('dense'), dense, 'Dense scene must be reproducible');
const kinds = new Set(reference.data.cells.map((cell) => cell.kind));
for (const kind of ['cottage', 'house', 'manor', 'villa', 'farm', 'appleOrchard', 'cowBarn',
  'market', 'windmill', 'stoneRoad', 'road', 'wall1', 'gate', 'tower', 'tree']) {
  assert.ok(kinds.has(kind), `Reference scene is missing ${kind}`);
}
for (const scene of [reference, dense]) {
  const keys = scene.data.cells.map((cell) => `${cell.x},${cell.y}`);
  assert.equal(new Set(keys).size, keys.length, 'Two assets occupy the same cell');
  assert.ok(scene.data.cells.every(({ x, y }) => x >= 0 && x < 22 && y >= 0 && y < 22));
  assert.equal(scene.metadata.schemaVersion, scene.data.version);
  assert.equal(scene.data.keeps[0].seed, 6001);
}
assert.ok(REFERENCE_CAMERA.near.y < REFERENCE_CAMERA.normal.y);
assert.ok(REFERENCE_CAMERA.normal.y < REFERENCE_CAMERA.far.y);
console.log('Visual reference scene is stable and includes all required families.');
