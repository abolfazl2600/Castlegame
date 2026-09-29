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
const elbow = system.build([
  { x: 4, y: 4, kind: 'wall1' }, { x: 5, y: 4, kind: 'wall1' }, { x: 5, y: 5, kind: 'wall1' },
], 'limestone');
assert.equal(at(elbow, 5, 4).topology, 'corner');
assert.equal(at(elbow, 5, 4).orientation, 180);
assert.deepEqual(elbow.blocks.map((block) => block.topology),
  system.build([{ x: 5, y: 5, kind: 'wall1' }, { x: 4, y: 4, kind: 'wall1' }, { x: 5, y: 4, kind: 'wall1' }], 'darkStone').blocks.map((block) => block.topology));
const attachments = system.build([
  { x: 0, y: 0, kind: 'wall1', wallLinks: ['E'] },
  { x: 1, y: 0, kind: 'gate', wallLinks: ['W', 'E'] },
  { x: 2, y: 0, kind: 'tower', wallLinks: ['W'] },
], 'limestone');
assert.deepEqual(attachments.blocks.map((block) => block.topology), ['end', 'straight', 'end']);
const removedGate = system.build([
  { x: 0, y: 0, kind: 'wall1', wallLinks: ['E'] },
  { x: 2, y: 0, kind: 'tower', wallLinks: ['W'] },
], 'limestone');
assert.deepEqual(removedGate.blocks.map((block) => block.topology), ['isolated', 'isolated']);
const elevated = system.build([
  { x: 0, y: 0, kind: 'wall1', level: 3 },
  { x: 1, y: 0, kind: 'wall1', level: 1 },
], 'limestone', (x) => x === 0 ? 2 : 0);
assert.deepEqual(at(elevated, 0, 0).stack.map((floor) => floor.index), [1, 2, 3]);
assert.equal(at(elevated, 0, 0).topWorld - at(elevated, 0, 0).topLocal, 2);
assert.equal(at(elevated, 1, 0).topWorld - at(elevated, 1, 0).topLocal, 0);
assert.ok(at(elevated, 0, 0).topLocal > at(elevated, 1, 0).topLocal);
assert.equal(at(elevated, 0, 0).neighborTopDelta.E, -at(elevated, 1, 0).neighborTopDelta.W);
assert.deepEqual(system.build(JSON.parse(JSON.stringify([
  { x: 0, y: 0, kind: 'wall1', level: 3 }, { x: 1, y: 0, kind: 'wall1', level: 1 },
])), 'limestone', (x) => x === 0 ? 2 : 0), elevated);
assert.equal(system.build([{ x: 0, y: 0, kind: 'wall1', level: 999 }], 'limestone').blocks[0].stack.length, 12);
const closedGate = system.build([
  { x: 0, y: 0, kind: 'wall1' },
  { x: 1, y: 0, kind: 'gate', gateOpen: false },
  { x: 2, y: 0, kind: 'wall1' },
], 'limestone');
assert.equal(at(closedGate, 1, 0).topology, 'straight');
assert.equal(at(closedGate, 1, 0).traversal.passable, false);
assert.equal(at(closedGate, 1, 0).traversal.blocksGround, true);
assert.equal(at(system.build([{ x: 1, y: 0, kind: 'gate', gateOpen: true }], 'limestone'), 1, 0).traversal.passable, true);

console.log('castle block model regression checks passed');
