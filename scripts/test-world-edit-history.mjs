import assert from 'node:assert/strict';
import { WorldEditHistory } from '../src/core/WorldEditHistory.ts';

let world = { cells: [], terrain: [] };
let notifications = 0;
const restoreReasons = [];
const history = new WorldEditHistory(
  () => structuredClone(world),
  (snapshot, reason) => { world = structuredClone(snapshot); restoreReasons.push(reason); },
  () => { notifications += 1; },
);
const commit = () => { notifications += 1; };

assert.equal(history.transact(() => {
  world.cells.push('road-a', 'road-b');
  world.terrain.push('bridge');
  return true;
}, commit), true);
assert.deepEqual(world, { cells: ['road-a', 'road-b'], terrain: ['bridge'] });
assert.equal(notifications, 1);

assert.equal(history.undo(), true);
assert.deepEqual(world, { cells: [], terrain: [] });
assert.equal(notifications, 2);

assert.equal(history.transact(() => {
  world.cells.push('rejected');
  return false;
}, commit), false);
assert.deepEqual(world, { cells: [], terrain: [] });
assert.equal(notifications, 2);
assert.equal(history.redo(), true, 'a rejected edit must not clear redo');
assert.deepEqual(world.cells, ['road-a', 'road-b']);
assert.deepEqual(restoreReasons, ['history', 'rollback', 'history']);

assert.throws(() => history.transact(() => {
  world.cells.push('partial');
  throw new Error('failed placement');
}, commit), /failed placement/);
assert.deepEqual(world.cells, ['road-a', 'road-b'], 'failed edits must roll back');
assert.equal(restoreReasons.at(-1), 'rollback');

history.clear();
assert.equal(history.undo(), false);
assert.equal(history.redo(), false);
console.log('World edit history transaction checks passed.');
