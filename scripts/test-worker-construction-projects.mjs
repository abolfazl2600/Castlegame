import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ConstructionProjectSystem } from '../src/systems/ConstructionProjectSystem.ts';
import { ConstructionAnimationSystem } from '../src/rendering/ConstructionAnimationSystem.ts';

const projects = new ConstructionProjectSystem();
assert.equal(projects.count, 0, 'legacy saves without projects treat all existing structures as finished');
projects.begin('cell:4,5', 'farm', 4, 5, 6000);
projects.begin('keep:9', 'keep', 12, 13, 12000);
projects.begin('bridge:3', 'towerBridge', 8, 11, 9000);
assert.equal(projects.count, 3);
assert.equal(projects.progress('cell:4,5'), 0);
assert.equal(projects.work('cell:4,5', 1000), false);
assert.equal(projects.work('cell:4,5', Number.NaN), false);
assert.equal(projects.work('cell:4,5', -200), false);
assert.equal(projects.progress('cell:4,5'), 1 / 6);
const saved = projects.snapshot();
saved[0].workMs = 0;
assert.equal(projects.progress('cell:4,5'), 1 / 6, 'snapshot must not leak mutable work objects');

const restore = new ConstructionProjectSystem();
restore.restore(projects.snapshot());
assert.equal(restore.progress('cell:4,5'), 1 / 6, 'save/load resumes incomplete projects');
assert.equal(restore.work('cell:4,5', 6000), false, 'frame-delta clamp prevents accidental instant completion');
for (let i = 0; i < 3; i += 1) restore.work('cell:4,5', 1000);
assert.equal(restore.work('cell:4,5', 1000), true, 'construction completes after delivered labor');
assert.equal(restore.work('cell:4,5', 1000), false, 'completed work order cannot trigger twice');
assert.equal(restore.has('cell:4,5'), false);
assert.equal(restore.progress('cell:4,5'), 1);
restore.cancel('keep:9');
assert.equal(restore.has('keep:9'), false, 'demolition cancels an unfinished site');
restore.reconcile((project) => project.key === 'cell:4,5');
assert.equal(restore.count, 0, 'stale projects after world changes are removed');
restore.restore(undefined);
assert.equal(restore.count, 0);

restore.restore([{ key: 'cell:99,101', kind: 'market', x: 99, y: 101, workMs: 200, requiredMs: 6000 }]);
assert.equal(restore.count, 1);
restore.restore([{ key: 'cell:1,1', kind: 'hut', x: 1, y: 1, workMs: 9000, requiredMs: 3000 }]);
assert.equal(restore.count, 0, 'invalid/finished imported projects must be rejected');
restore.restore([{ key: 'cell:1,1', kind: 'hut', x: 1, y: 1, workMs: 0, requiredMs: Infinity }]);
assert.equal(restore.count, 0, 'malformed saves cannot inject infinite work orders');

function building() {
  const root = new THREE.Group();
  for (const y of [0, 3, 6]) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    mesh.position.y = y;
    root.add(mesh);
  }
  return root;
}
const animation = new ConstructionAnimationSystem();
const root = building();
animation.start('cell:4,5', root, 0, 6000, true, 0.1);
assert.equal(animation.count, 1);
assert.equal(root.children[2].visible, false, 'unfinished roof must remain hidden');
assert.deepEqual(animation.update(100_000, true), [], 'reduced motion does not finish real work');
assert.equal(animation.count, 1);
animation.setProgress('cell:4,5', 0.9, true);
assert.equal(root.children[2].visible, true, 'later stages become visible as workers progress');
const redrawn = building();
animation.rebind(() => redrawn);
assert.equal(redrawn.children[2].visible, true, 'redraw keeps the current stage');
animation.setProgress('cell:4,5', 0.25);
assert.equal(redrawn.children[2].visible, false, 'redraw must still support earlier stages');
animation.cancel('cell:4,5');
assert.equal(animation.count, 0);
assert.equal(redrawn.children.every((mesh) => mesh.visible), true, 'finished or removed worksite restores meshes');

console.log('Worker construction work orders, persistence, cancellation, timing and staged visuals: ok');
