import assert from 'node:assert/strict';
import { AmbientFaunaSystem } from '../src/rendering/AmbientFaunaSystem.ts';

const blocked = new Set(['6,6', '7,6', '8,6']);
const world = {
  size: 18, seed: 425,
  terrainAt: (x, y) => x < 4 ? 'water' : y === 3 ? 'river' : 'plains',
  elevationAt: (x, y) => x === 12 ? 5 : 0,
  blockedAt: (x, y) => blocked.has(`${x},${y}`),
  farmAt: (x, y) => x === 9 && y === 9,
  toWorld: (x, y) => ({ x, z: y }),
};
const first = new AmbientFaunaSystem();
const second = new AmbientFaunaSystem();
first.rebuild(world, 'high');
second.rebuild(world, 'high');
assert.ok(first.counts.llamas > 0 && first.counts.llamas <= 4);
assert.equal(first.counts.birds, 7);
for (const llama of first.layer.children.slice(0, first.counts.llamas)) {
  assert.deepEqual(llama.scale.toArray(), [0.65, 0.65, 0.65], 'llama geometry is uniformly 35% smaller');
}
const positions = first.layer.children.slice(0, first.counts.llamas).map((root) => `${root.position.x},${root.position.z}`);
assert.deepEqual(positions, second.layer.children.slice(0, second.counts.llamas).map((root) => `${root.position.x},${root.position.z}`));
for (const position of positions) {
  const [x, y] = position.split(',').map(Number);
  assert.equal(world.terrainAt(x, y), 'plains');
  assert.equal(world.blockedAt(x, y), false);
  assert.notEqual(x, 12, 'cliff edge is excluded');
}
first.rebuild(world, 'high');
assert.equal(first.layer.children.length, first.counts.llamas + first.counts.birds, 'redraw does not duplicate fauna');
const bird = first.layer.children[first.counts.llamas];
first.update(16, 1000, { reducedMotion: false, animationScale: 1, cameraDistance: 20, normalDistance: 50, strategicDistance: 80 });
const before = bird.position.clone();
const flap = bird.children[1].rotation.z;
first.update(16, 1500, { reducedMotion: false, animationScale: 1, cameraDistance: 20, normalDistance: 50, strategicDistance: 80 });
assert.notDeepEqual(bird.position.toArray(), before.toArray());
assert.notEqual(bird.children[1].rotation.z, flap);
first.update(16, 1700, { reducedMotion: false, animationScale: 0.25, cameraDistance: 79, normalDistance: 50, strategicDistance: 80 });
assert.equal(first.layer.visible, false, 'strategic zoom suppresses decorative draw calls');
blocked.add(positions[0]);
first.rebuild(world, 'low');
assert.ok(first.counts.llamas <= 2);
assert.equal(first.counts.birds, 4);
assert.equal(first.layer.children.slice(0, first.counts.llamas).some((root) => blocked.has(`${root.position.x},${root.position.z}`)), false);
first.clear();
assert.deepEqual(first.counts, { llamas: 0, birds: 0 });
assert.equal(first.layer.children.length, 0);
first.dispose();
second.dispose();
console.log('ambient fauna spawn, motion, deterministic redraw, and cleanup checks passed');
