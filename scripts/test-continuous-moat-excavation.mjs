import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extendMoatRoute, assessMoatRoute, restoreMoatTasks, computeMoatFlooding } from '../src/systems/MoatRouteSystem.ts';

const p = (x, y) => ({ x, y });
const key = ({ x, y }) => `${x},${y}`;
let route = extendMoatRoute([], p(2, 2), p(2, 7));
assert.deepEqual(route, [p(2, 2), p(2, 3), p(2, 4), p(2, 5), p(2, 6), p(2, 7)],
  'fast pointer movement interpolates every missed tile');
route = extendMoatRoute(route, p(2, 7), p(6, 7));
assert.deepEqual(route.at(-1), p(6, 7));
assert.equal(route.length, 10, 'turning a corner forms a continuous orthogonal route');
for (let i = 1; i < route.length; i++) {
  assert.equal(Math.abs(route[i].x - route[i - 1].x) + Math.abs(route[i].y - route[i - 1].y), 1,
    'each segment must connect at a side, not a diagonal');
}
const reverse = extendMoatRoute(route, p(6, 7), p(2, 7));
assert.equal(assessMoatRoute(reverse, () => 'new').newCount, route.length, 'retrace is not double queued');
assert.equal(extendMoatRoute([], p(1, 1), p(3, 4)).length, 6);
assert.equal(extendMoatRoute([], p(1, 1), p(3, 4), 3).length, 3, 'stroke length stays bounded');

const blocked = new Set(['2,5']);
const existing = new Set(['2,3', '2,4']);
const classifier = (point) => blocked.has(key(point)) ? 'blocked' : existing.has(key(point)) ? 'existing' : 'new';
const invalid = assessMoatRoute(route, classifier);
assert.equal(invalid.blockedCount, 1);
assert.equal(invalid.existingCount, 2);
assert.equal(invalid.valid, false, 'a blocked middle segment rejects the full stroke without gaps');
blocked.clear();
const compatible = assessMoatRoute(route, classifier);
assert.equal(compatible.valid, true);
assert.equal(compatible.existingCount, 2, 'completed or already queued tiles are safe corridor links');
assert.equal(compatible.newCount, route.length - 2);
assert.equal(assessMoatRoute([p(1, 1), p(2, 2)], () => 'new').valid, false,
  'diagonally touching disconnected sections are rejected');
assert.equal(assessMoatRoute([], () => 'new').valid, false);
assert.equal(assessMoatRoute([p(1, 1)], () => 'existing').valid, false,
  'an already finished route cannot add duplicate tasks');

const loaded = restoreMoatTasks([
  { x: 3, y: 4, progressMs: 750, workerId: 9 },
  { x: 3, y: 4, progressMs: 0 },
  { x: 4, y: 4, progressMs: 0 },
  { x: 5, y: 4, progressMs: 1800 },
  { x: 6, y: 4, progressMs: -1 },
  { x: 7.5, y: 4, progressMs: 0 },
  { x: 8, y: 4, progressMs: Infinity },
], point => point.x < 4);
assert.deepEqual(loaded, [{ x: 3, y: 4, progressMs: 750 }],
  'pending progress survives save/load, invalid/stale tasks are removed, worker IDs are transient');
assert.deepEqual(restoreMoatTasks(undefined, () => true), [], 'legacy saves have no pending tasks');
assert.deepEqual(restoreMoatTasks(null, () => true), []);
assert.equal(restoreMoatTasks([{ x: 1, y: 2, progressMs: 0 }, { x: 2, y: 2, progressMs: 0 }],
  () => true, 1).length, 1, 'untrusted save input is bounded');

const moats = [p(1, 1), p(2, 1), p(3, 1), p(5, 1), p(2, 2), p(7, 7)];
let water = new Set(['0,1']);
const terrain = (x, y) => water.has(`${x},${y}`) ? 'river' : 'plains';
assert.deepEqual([...computeMoatFlooding(moats, terrain)].sort(), ['1,1', '2,1', '2,2', '3,1'],
  'water flows orthogonally across completed moats but not disconnected branches');
water = new Set(['6,7']);
const seaTerrain = (x, y) => water.has(`${x},${y}`) ? 'water' : 'plains';
assert.deepEqual([...computeMoatFlooding(moats, seaTerrain)], ['7,7'],
  'coastal sea water also floods adjacent excavated moats');
const diagonalMoats = [p(2, 2)];
assert.equal(computeMoatFlooding(diagonalMoats,
  (x, y) => x === 1 && y === 1 ? 'river' : 'plains').size, 0,
  'diagonal water does not flood moats');
assert.equal(computeMoatFlooding(moats, () => 'plains').size, 0, 'dry isolated ditches remain dry');

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const game = read('src/ThreeGame.ts');
const save = read('src/core/SaveSystem.ts');
const types = read('src/core/types.ts');
const history = game.match(/private captureSnapshot\([\s\S]*?private syncHistoryActions\(/)?.[0] ?? '';
const restore = game.match(/private restoreSnapshot\([\s\S]*?private undo\(/)?.[0] ?? '';
const workers = game.match(/private updateWorkers\([\s\S]*?private renderConstructionProgress\(/)?.[0] ?? '';
const build = game.match(/private buildMoatStroke\([\s\S]*?private captureSnapshot\(/)?.[0] ?? '';
assert.match(game, /this\.selectedTool === 'moat'\) \{\s*if \(!cell\) return;/,
  'moat has its own stroke pointer-down handler');
assert.match(game, /this\.selectedTool === 'moat'\);/, 'touch moat uses the stroke gesture owner');
assert.match(game, /if \(this\.moatDragLast\) \{/, 'pointer move and release support moat strokes');
assert.match(game, /restorePendingMoatTasks\(snapshot\.moatTasks\)/, 'undo/redo restores queued excavation');
assert.match(history, /moatTasks: this\.pendingMoatTasks\(\)/);
assert.match(restore, /restorePendingMoatTasks\(snapshot\.moatTasks\)/);
assert.match(build, /this\.recordHistory\(\)/);
assert.match(build, /if \(!assessment\.valid\)/);
assert.match(build, /this\.scheduleSave\(\)/);
assert.doesNotMatch(workers.slice(workers.indexOf('if (task.progressMs >= 1800)')),
  /this\.recordHistory\(\)/, 'worker completions do not split route Undo');
assert.match(workers, /this\.services\.state\.setCell\(task\.x, task\.y, 'moat'/);
assert.match(save, /moatTasks: this\.host\.getMoatTasks\?\.\(\)/);
assert.match(save, /setMoatTasks\?\.\(data\.moatTasks\)/);
assert.match(save, /moatTasks: raw\.moatTasks/);
assert.match(types, /moatTasks\?: PendingMoatTask\[\]/);
assert.match(game, /if \(this\.moatTasks\.has\(this\.key\(x, y\)\)\) return true;/,
  'unfinished moats reserve cells against other construction');

console.log('Moat route interpolation, connectivity, atomic validation, flood propagation, persistence, touch, worker and undo contracts passed.');
