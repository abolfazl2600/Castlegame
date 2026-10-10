import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { TerrainChunkRenderer } from '../src/rendering/TerrainChunkRenderer.ts';

const grid = { cols: 50, rows: 89, chunkSize: 12 };
const soils = new THREE.MeshStandardMaterial({ color: 0x786b50 });
const grasses = new THREE.MeshStandardMaterial({ color: 0x83a35f });
const shores = new THREE.MeshStandardMaterial({ color: 0xb8a878 });
const materials = [soils, grasses, shores];
const terrain = new Map();
let base = 'plains';
const terrainAt = (x, y) => terrain.get(x + ',' + y) ?? base;
const chunks = new TerrainChunkRenderer(4);
const context = {
  grid,
  terrainAt,
  gridToWorld: (x, y) => ({ x: x * 4 - grid.cols * 2, z: y * 4 - grid.rows * 2 }),
  soilMaterial: soils,
  grassMaterial: grasses,
  shoreMaterial: shores,
};
const chunkKey = (mesh) => mesh.userData.terrainChunk.chunkX + ',' + mesh.userData.terrainChunk.chunkY;
const meshesByChunk = () => {
  const map = new Map();
  for (const mesh of chunks.layer.children) {
    const key = chunkKey(mesh);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(mesh);
  }
  return map;
};
const watchDisposal = (meshes) => {
  const disposed = [];
  for (const mesh of meshes) mesh.addEventListener('dispose', () => disposed.push(mesh));
  return disposed;
};
const snapshot = () => chunks.layer.children.map((mesh) => ({
  chunk: mesh.userData.terrainChunk,
  name: mesh.name,
  count: mesh.count,
  material: materials.indexOf(mesh.material),
  receivesShadow: mesh.receiveShadow,
  culled: mesh.frustumCulled,
  matrices: Array.from(mesh.instanceMatrix.array),
}));

chunks.update(context); // first update must behave as a full initial build
const totalChunks = Math.ceil(grid.cols / grid.chunkSize) * Math.ceil(grid.rows / grid.chunkSize);
assert.equal(totalChunks, 40);
assert.equal(chunks.stats().chunks, totalChunks);
assert.equal(chunks.layer.children.length, totalChunks * 2);
assert.equal(chunks.stats().instances, grid.cols * grid.rows * 2);

const initially = [...chunks.layer.children];
const initiallyDisposed = watchDisposal(initially);
const initialSnapshot = snapshot();
chunks.update(context);
assert.equal(initiallyDisposed.length, 0, 'no-op update must retain all GPU objects');
assert.deepEqual(chunks.layer.children, initially, 'no-op update must preserve draw order and references');
assert.deepEqual(snapshot(), initialSnapshot);

// A non-shape-changing edit has no reason to regenerate the grass surface.
terrain.set('13,13', 'forest');
chunks.update(context);
assert.equal(initiallyDisposed.length, 0, 'grass and forest have the same rendered surface');
terrain.set('13,13', 'shore');
const oldByChunk = meshesByChunk();
chunks.update(context);
assert.equal(initiallyDisposed.length, 2, 'only the changed chunk must release its two existing meshes');
assert.deepEqual(new Set(initiallyDisposed.map(chunkKey)), new Set(['12,12']));
for (const [key, meshes] of oldByChunk) {
  if (key === '12,12') {
    assert.ok(meshes.every((mesh) => !chunks.layer.children.includes(mesh)));
  } else {
    assert.ok(meshes.every((mesh) => chunks.layer.children.includes(mesh)),
      'unchanged neighboring chunks must retain GPU buffers and mesh identity');
  }
}
assert.equal(chunks.stats().chunks, totalChunks);
assert.equal(chunks.stats().instances, grid.cols * grid.rows * 2);
assert.equal(chunks.layer.children.length, totalChunks * 2 + 1,
  'shore chunk must contain soil, grass and shore meshes');
assert.equal(chunks.layer.children.filter((mesh) => chunkKey(mesh) === '12,12').length, 3);

const shoreSnapshot = snapshot();
chunks.rebuild(context);
assert.deepEqual(snapshot(), shoreSnapshot,
  'incremental and full rebuild must produce identical matrices, materials and ordering');

const previous = [...chunks.layer.children];
const released = watchDisposal(previous);
terrain.set('11,11', 'water');
terrain.set('12,12', 'river');
chunks.update(context);
assert.equal(released.length, 5, 'two changed chunks must replace only their outgoing meshes');
assert.deepEqual(new Set(released.map(chunkKey)), new Set(['0,0', '12,12']));
assert.equal(chunks.stats().instances, (grid.cols * grid.rows - 2) * 2);
const mixedSnapshot = snapshot();
chunks.rebuild(context);
assert.deepEqual(snapshot(), mixedSnapshot, 'partial removals must match a full terrain rebuild');

// River and water both have zero surface instances: no rebuild is necessary.
const beforeEquivalent = [...chunks.layer.children];
const equivalentDisposed = watchDisposal(beforeEquivalent);
terrain.set('12,12', 'water');
chunks.update(context);
assert.deepEqual(chunks.layer.children, beforeEquivalent);
assert.equal(equivalentDisposed.length, 0);

// Entirely submerged maps need no chunks; newly exposed land adds them again.
terrain.clear();
base = 'water';
chunks.update(context);
assert.deepEqual(chunks.stats(), { chunks: 0, instances: 0 });
assert.equal(chunks.layer.children.length, 0);
terrain.set('49,88', 'shore');
chunks.update(context);
assert.deepEqual(chunks.stats(), { chunks: 1, instances: 2 });
assert.equal(chunks.layer.children.length, 2);
const waterSnapshot = snapshot();
chunks.rebuild(context);
assert.deepEqual(snapshot(), waterSnapshot);

// Grid resize changes all world coordinates, forcing a full rebuild.
grid.cols = 5;
grid.rows = 4;
base = 'plains';
terrain.clear();
const beforeResize = [...chunks.layer.children];
const resizeDisposed = watchDisposal(beforeResize);
chunks.update(context);
assert.equal(resizeDisposed.length, beforeResize.length);
assert.deepEqual(chunks.stats(), { chunks: 1, instances: 40 });

// Material ownership change must also rebind even if terrain classes did not change.
const freshSoil = new THREE.MeshStandardMaterial({ color: 0x786b50 });
const beforeMaterials = [...chunks.layer.children];
const materialsDisposed = watchDisposal(beforeMaterials);
const changedContext = { ...context, soilMaterial: freshSoil };
chunks.update(changedContext);
assert.equal(materialsDisposed.length, beforeMaterials.length);
assert.ok(chunks.layer.children.some((mesh) => mesh.material === freshSoil));

// Verify wiring and the unchanged-map signature optimization in gameplay.
const game = readFileSync(new URL('../src/ThreeGame.ts', import.meta.url), 'utf8');
assert.match(game, /if \(signature === this\.worldLayoutSurfaceSignature\) return;/);
assert.match(game, /this\.terrainChunks\.update\(\{/);
assert.match(game, /this\.rebuildWorldLayoutSurface\(\);/);

chunks.dispose();
for (const material of [...materials, freshSoil]) material.dispose();
console.log('Localized terrain chunk test: 1 of 40 chunks rebuilt for one tile; full rebuild equivalence OK.');
