import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ConstructionAnimationSystem } from '../src/rendering/ConstructionAnimationSystem.ts';

function building() {
  const group = new THREE.Group();
  for (const [y, size] of [[0, 1], [3, 2], [6, 1], [5, 0.1]]) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), new THREE.MeshBasicMaterial());
    mesh.position.y = y;
    group.add(mesh);
  }
  return group;
}

const system = new ConstructionAnimationSystem();
const first = building();
const second = building();
system.start('first', first, 0, 1000);
system.start('second', second, 100, 1000);
assert.equal(system.count, 2, 'rapid placements remain independent');
assert.equal(first.children[0].visible, true);
assert.equal(first.children[2].visible, false, 'roof is hidden while foundation is first revealed');
system.update(400, false);
assert.equal(first.children[1].visible, true);
assert.equal(first.children[2].visible, false);
const rebuilt = building();
system.rebind((key) => key === 'first' ? rebuilt : second);
system.update(750, false);
assert.equal(rebuilt.children[2].visible, true, 'redraw resumes the current stage');
system.cancel('second');
assert.equal(second.children.every((child) => child.visible), true, 'removal restores object visibility');
system.update(1100, false);
assert.equal(system.count, 0);
assert.equal(rebuilt.children.every((child) => child.visible && child.position.y >= 0), true);
system.start('reduced', building(), 0, 1000);
system.update(120, true);
assert.equal(system.count, 0, 'reduced motion completes promptly');
console.log('construction animation lifecycle checks passed');
