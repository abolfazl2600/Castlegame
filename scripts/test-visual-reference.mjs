import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
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

const baseline = await readFile(new URL('./visual-baseline.mjs', import.meta.url), 'utf8');
const report = await readFile(new URL('./visual-baseline-report.mjs', import.meta.url), 'utf8');
const workflow = await readFile(new URL('../.github/workflows/visual-baseline.yml', import.meta.url), 'utf8');

for (const capture of [
  'reference-normal-desktop',
  'reference-normal-mobile',
  'dense-normal-desktop',
]) {
  assert.ok(baseline.includes(capture), `Visual baseline must capture ${capture}`);
}
assert.ok(
  baseline.includes('reference-${view}-desktop') && baseline.includes("Object.entries(REFERENCE_CAMERA)"),
  'Visual baseline must capture the fixed near/far desktop camera entries.',
);
for (const field of ['frameMedianMs', 'frameP95Ms', 'drawCallsMedian', 'triangles', 'sceneGeometries',
  'sceneMaterials', 'gpuGeometries', 'gpuTextures', 'redrawMs', 'heapBytes', 'drawingBuffer', 'gpu']) {
  assert.ok(baseline.includes(field), `Visual baseline must record ${field}`);
}
assert.ok(report.includes('Normal desktop performance'));
assert.ok(report.includes('WebGL renderer'));
assert.ok(workflow.includes('workflow_dispatch:'));
assert.ok(workflow.includes('npx playwright install --with-deps chromium'));
assert.ok(workflow.includes('actions/upload-artifact@v4'));
assert.ok(!workflow.includes('pull_request:'), 'Visual baseline workflow must stay manual while PR workflows are disabled');

console.log('Visual reference scene, capture contract and manual baseline workflow are stable.');
