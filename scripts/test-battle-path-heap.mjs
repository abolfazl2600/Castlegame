import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PathOpenHeap } from '../src/battle/PathOpenHeap.ts';

const heap = new PathOpenHeap();
const inputs = [
  { key: 'A', priority: 5, order: 0 },
  { key: 'B', priority: 1, order: 1 },
  { key: 'C', priority: 5, order: 2 },
  { key: 'D', priority: 2, order: 3 },
];
for (const input of inputs) heap.push({ ...input, node: input.key });
assert.equal(heap.size, 4);
assert.deepEqual([heap.pop()?.key, heap.pop()?.key, heap.pop()?.key, heap.pop()?.key],
  ['B', 'D', 'A', 'C'], 'Heap must preserve priority and stable tie order');
assert.equal(heap.pop(), undefined);

const frontier = new PathOpenHeap();
const old = { id: 'old' };
const improved = { id: 'improved' };
frontier.push({ key: 'node', node: old, priority: 10, order: 0 });
frontier.push({ key: 'node', node: improved, priority: 2, order: 0 });
assert.equal(frontier.pop()?.node, improved, 'Decreased priority must be expanded first');

const large = new PathOpenHeap();
for (let i = 0; i < 5000; i += 1) {
  large.push({ key: String(i), node: i, priority: 5000 - i, order: i });
}
let previous = Number.NEGATIVE_INFINITY;
while (large.size > 0) {
  const entry = large.pop();
  assert.ok(entry.priority >= previous);
  previous = entry.priority;
}

const navigation = await readFile(new URL('../src/battle/BattleNavigation.ts', import.meta.url), 'utf8');
assert.match(navigation, /new PathOpenHeap<SearchNode>\(\)/);
assert.match(navigation, /open\.get\(entry\.key\)\?\.node !== entry\.node/);
assert.doesNotMatch(navigation, /for \(const \[key, candidate\] of open\)/);

console.log('Stable heap frontier, improvement ordering, and navigation integration passed.');
