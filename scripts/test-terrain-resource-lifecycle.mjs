import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { TerrainChunkRenderer } from '../src/rendering/TerrainChunkRenderer.ts';

const soilMaterial = new THREE.MeshStandardMaterial({ color: 0x786b50 });
const grassMaterial = new THREE.MeshStandardMaterial({ color: 0x83a35f });
const shoreMaterial = new THREE.MeshStandardMaterial({ color: 0xb8a878 });
const sharedMaterials = [soilMaterial, grassMaterial, shoreMaterial];
let materialDisposals = 0;
for (const material of sharedMaterials) {
  material.addEventListener('dispose', () => { materialDisposals += 1; });
}

const chunks = new TerrainChunkRenderer(4);
let grid = { cols: 5, rows: 4, chunkSize: 2 };
let layout = 'mixed';
const context = {
  get grid() { return grid; },
  terrainAt(x, y) {
    if (layout === 'water') return 'water';
    if (layout === 'coast') return x === 0 ? 'shore' : 'plains';
    if (x === 0 && y === 0) return 'river';
    if (x === 4 && y === 3) return 'water';
    if (x === 1 && y === 2) return 'shore';
    return 'plains';
  },
  gridToWorld: (x, y) => ({ x: x * 4, z: y * 4 }),
  soilMaterial, grassMaterial, shoreMaterial,
};

const observedGeometries = new Map();
const registerGeometries = () => {
  for (const mesh of chunks.layer.children) {
    assert.ok(mesh instanceof THREE.InstancedMesh, 'each chunk draw object must remain instanced');
    if (!observedGeometries.has(mesh.geometry)) {
      observedGeometries.set(mesh.geometry, 0);
      mesh.geometry.addEventListener('dispose', () => {
        observedGeometries.set(mesh.geometry, observedGeometries.get(mesh.geometry) + 1);
      });
    }
    assert.ok(sharedMaterials.includes(mesh.material), 'chunk materials must remain shared');
    assert.equal(mesh.receiveShadow, true);
    assert.equal(mesh.frustumCulled, true);
    assert.ok(Number.isFinite(mesh.boundingSphere?.radius), 'chunk bounds must be computed');
  }
};

const renderSnapshot = () => chunks.layer.children.map((mesh) => ({
  name: mesh.name,
  count: mesh.count,
  material: sharedMaterials.indexOf(mesh.material),
  chunk: mesh.userData.terrainChunk,
  matrix: Array.from(mesh.instanceMatrix.array),
}));

const rebuildAndVerifyRelease = () => {
  const previous = [...chunks.layer.children];
  let released = 0;
  previous.forEach((mesh) => mesh.addEventListener('dispose', () => { released += 1; }));
  chunks.rebuild(context);
  assert.equal(released, previous.length, 'every replaced instanced mesh must release its GPU buffers');
  assert.equal(materialDisposals, 0, 'rebuilding must not dispose shared materials');
  assert.ok([...observedGeometries.values()].every((count) => count === 0),
    'rebuilding must not dispose the three shared chunk geometries');
  registerGeometries();
};

chunks.rebuild(context);
registerGeometries();
const initial = renderSnapshot();
assert.equal(chunks.layer.children.length, 13, 'mixed 5x4 map must have 13 chunk meshes');
assert.deepEqual(chunks.stats(), { chunks: 6, instances: 36 });
assert.equal(observedGeometries.size, 3, 'soil, grass and shore use only three reusable geometries');

rebuildAndVerifyRelease();
assert.deepEqual(renderSnapshot(), initial, 'identical rebuilds must preserve exact placement and materials');

for (let iteration = 0; iteration < 30; iteration += 1) {
  layout = iteration % 3 === 0 ? 'coast' : iteration % 3 === 1 ? 'water' : 'mixed';
  grid = iteration % 4 === 0
    ? { cols: 3, rows: 3, chunkSize: 2 }
    : { cols: 5, rows: 4, chunkSize: 2 };
  rebuildAndVerifyRelease();
  if (layout === 'water') {
    assert.equal(chunks.layer.children.length, 0, 'water-only map should have no land draw objects');
    assert.deepEqual(chunks.stats(), { chunks: 0, instances: 0 });
  } else {
    assert.ok(chunks.layer.children.length <= 13, 'old map meshes must not accumulate');
  }
}

layout = 'mixed';
grid = { cols: 5, rows: 4, chunkSize: 2 };
rebuildAndVerifyRelease();
assert.deepEqual(renderSnapshot(), initial, 'returning to an earlier map must reproduce the original render layout');

const finalMeshes = [...chunks.layer.children];
let finalMeshDisposals = 0;
finalMeshes.forEach((mesh) => mesh.addEventListener('dispose', () => { finalMeshDisposals += 1; }));
chunks.dispose();
assert.equal(finalMeshDisposals, finalMeshes.length, 'renderer teardown must dispose remaining instance buffers');
assert.equal(chunks.layer.children.length, 0, 'renderer teardown must release scene references');
assert.deepEqual(chunks.stats(), { chunks: 0, instances: 0 });
assert.deepEqual([...observedGeometries.values()], [1, 1, 1], 'owned geometries dispose exactly once on teardown');
assert.equal(materialDisposals, 0, 'caller-owned shared materials remain valid on renderer teardown');

// Game redraws also create instanced castle geometry, so the common group
// clearing path must release per-object instance buffers before clearing.
const gameSource = readFileSync(new URL('../src/ThreeGame.ts', import.meta.url), 'utf8');
const groupDisposal = gameSource.match(/private clearGroup\(group: THREE.Group\): void \{([\s\S]*?)\n  \}/)?.[1];
assert.ok(groupDisposal, 'ThreeGame.clearGroup should remain available');
assert.match(groupDisposal, /if \(object instanceof THREE\.InstancedMesh\) object\.dispose\(\)/);
assert.match(gameSource, /if \(signature === this\.worldLayoutSurfaceSignature\) return;/,
  'unchanged world surfaces must avoid redundant rebuilds');

for (const material of sharedMaterials) material.dispose();
console.log('Terrain GPU resource lifecycle and repeated-rebuild regression: ok');
