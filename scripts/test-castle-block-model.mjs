import assert from 'node:assert/strict';
import { CastleBlockSystem } from '../src/building/CastleBlockSystem.ts';

const system = new CastleBlockSystem();
const snapshot = system.build([
  { x: 1, y: 1, kind: 'wall1', level: 2, wallLinks: ['E', 'S'], walkway: true },
  { x: 2, y: 1, kind: 'gate', level: 2, wallLinks: ['W', 'E'] },
  { x: 3, y: 1, kind: 'tower', level: 3, wallLinks: ['W'], towerShape: 'round', towerTop: 'openBattlement' },
  { x: 1, y: 2, kind: 'wall2', level: 1, wallLinks: ['N'], damage: 0.4 },
], 'limestone');

assert.equal(snapshot.structures.length, 1, 'connected castle cells must form one structure');
assert.equal(snapshot.blocks.length, 4);
assert.equal(snapshot.blocks.find((b) => b.x === 1 && b.y === 1)?.corner, true);
assert.equal(snapshot.blocks.find((b) => b.kind === 'gate')?.traversal.isCrossing, true);
assert.equal(snapshot.blocks.find((b) => b.kind === 'tower')?.height, 3);
assert.equal(snapshot.blocks.find((b) => b.x === 1 && b.y === 2)?.damage, 0.4);

const second = system.build([
  { x: 1, y: 1, kind: 'wall1', level: 2, wallLinks: ['E', 'S'], walkway: true },
  { x: 2, y: 1, kind: 'gate', level: 2, wallLinks: ['W', 'E'] },
  { x: 3, y: 1, kind: 'tower', level: 3, wallLinks: ['W'] },
  { x: 1, y: 2, kind: 'wall2', level: 1, wallLinks: ['N'] },
], 'limestone');
assert.deepEqual(second.structures, snapshot.structures, 'structure identities must be deterministic');

const inferred = system.build([
  { x: 5, y: 5, kind: 'wall1', level: 1 },
  { x: 6, y: 5, kind: 'wall1', level: 1 },
], 'darkStone');
assert.equal(inferred.structures.length, 1, 'legacy cells without wallLinks should infer connectivity');
assert.ok(inferred.blocks[0].links.length > 0);

const at = (snapshot, x, y) => snapshot.blocks.find((block) => block.x === x && block.y === y);
const line = system.build([1, 2, 3].map((x) => ({ x, y: 4, kind: 'wall1' })), 'limestone');
assert.equal(at(line, 2, 4).topology, 'straight');
assert.equal(at(line, 1, 4).topology, 'end');
assert.equal(at(system.build([1, 3].map((x) => ({ x, y: 4, kind: 'wall1' })), 'limestone'), 1, 4).topology, 'isolated');
const junction = system.build([
  { x: 2, y: 2, kind: 'wall1' },
  ...[[2, 1], [3, 2], [2, 3], [1, 2]].map(([x, y]) => ({ x, y, kind: 'wall1' })),
], 'limestone');
assert.equal(at(junction, 2, 2).topology, '4-way');
assert.equal(at(system.build(junction.blocks.filter((block) => block.x !== 1).map(({ x, y }) => ({ x, y, kind: 'wall1' })), 'limestone'), 2, 2).topology, 't-junction');
assert.deepEqual(system.build([...line.blocks].reverse().map(({ x, y }) => ({ x, y, kind: 'wall1' })), 'limestone').blocks, line.blocks);

console.log('castle block model regression checks passed');
