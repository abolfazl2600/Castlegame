import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as THREE from 'three';
// Node 22 strips type-only syntax from .ts modules for direct runtime tests.
import { instanceStaticCastleBoxes } from '../src/rendering/StaticCastleBoxInstancing.ts';

const root = new THREE.Group();
const wall = new THREE.Group();
wall.position.set(12, 5, -9);
wall.rotation.y = Math.PI / 5;
root.add(wall);

const stone = new THREE.MeshStandardMaterial({ color: 0xaaa59a });
const reference = [];
for (let i = 0; i < 4; i++) {
  const width = 0.4 + i * 0.15;
  const height = 0.8 + i * 0.2;
  const depth = 0.65 + i * 0.1;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), stone);
  mesh.position.set(i * 0.8, i * 0.25, -i * 0.2);
  mesh.rotation.y = i * 0.17;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  wall.add(mesh);
  reference.push({ mesh, width, height, depth });
}

const animatedFlag = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), stone);
animatedFlag.userData.castleFlag = { phase: 0 };
wall.add(animatedFlag);
const translucent = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.5 }));
wall.add(translucent);

root.updateMatrixWorld(true);
const expected = reference.map(({ mesh, width, height, depth }) =>
  mesh.matrixWorld.clone().multiply(new THREE.Matrix4().makeScale(width, height, depth)));
const stats = instanceStaticCastleBoxes(root);

assert.equal(stats.batches, 1, 'four compatible boxes become one batch');
assert.equal(stats.instances, 4);
assert.equal(stats.estimatedDrawCallsSaved, 3);
assert.ok(wall.children.includes(animatedFlag), 'flag state must remain attached');
assert.ok(wall.children.includes(translucent), 'transparent geometry must stay independent');
for (const { mesh } of reference) {
  assert.ok(!wall.children.includes(mesh), 'original static boxes must be replaced');
}

const batch = wall.children.find((item) => item instanceof THREE.InstancedMesh);
assert.ok(batch);
assert.equal(batch.count, 4);
assert.equal(batch.castShadow, true);
assert.equal(batch.receiveShadow, true);
root.updateMatrixWorld(true);
for (let index = 0; index < batch.count; index++) {
  const local = new THREE.Matrix4();
  batch.getMatrixAt(index, local);
  const actual = wall.matrixWorld.clone().multiply(local);
  const e = expected[index].elements;
  const a = actual.elements;
  for (let j = 0; j < 16; j++) assert.ok(Math.abs(a[j] - e[j]) < 1e-5,
    `world transform mismatch for box ${index} element ${j}`);
}

const secondPass = instanceStaticCastleBoxes(root);
assert.equal(secondPass.instances, 0, 'batching must be idempotent');

const game = fs.readFileSync(new URL('../src/ThreeGame.ts', import.meta.url), 'utf8');
const overlay = fs.readFileSync(new URL('../src/debug/PerformanceDebugOverlay.ts', import.meta.url), 'utf8');
assert.match(game, /castleBlock\?\.kind === 'wall'\) instanceStaticCastleBoxes\(building\)/);
assert.match(game, /instanceStaticCastleBoxes\(renderedKeep\)/);
assert.match(game, /nextBlocks\.get\(key\)\?\.kind === 'wall'/);
assert.match(game, /performanceDebug\.beginGpuFrame\(\)/);
assert.match(game, /performanceDebug\.endGpuFrame\(\)/);
assert.match(game, /performanceDebug\.mobileBudgetEmulation/);
assert.match(overlay, /CPU game update/);
assert.match(overlay, /GPU frame time/);
assert.match(overlay, /Scene hot spots/);
assert.match(overlay, /does not emulate phone hardware/);
const lod = fs.readFileSync(new URL('../src/rendering/DistanceDetailBudget.ts', import.meta.url), 'utf8');
assert.match(lod, /object instanceof THREE.InstancedMesh\) \{/,
  'LOD must protect entire instanced batches from suppression');
assert.match(lod, /mesh\.boundingSphere\?\.radius/,
  'LOD bounds must account for all instances, not only a unit cube');

console.log('mobile render diagnostics and castle box instancing: ok');
