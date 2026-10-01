import assert from 'node:assert/strict';
import { EconomySystem } from '../src/systems/EconomySystem.ts';
import { PopulationSystem } from '../src/systems/PopulationSystem.ts';
import { isBuildingAvailable, isToolAvailable } from '../src/core/GameMode.ts';
import { CarpenterWorkshopRenderer } from '../src/rendering/CarpenterWorkshopRenderer.ts';

const emptyState = {
  logs: 10,
  wood: 0,
  stone: 0,
  grain: 0,
  apples: 0,
  flour: 0,
  food: 0,
};

const level1 = new EconomySystem();
level1.setState(emptyState);
level1.tick(1000, [{ x: 1, y: 1, kind: 'carpenter', level: 1 }], 0, 0);
const l1 = level1.getState();
assert.ok(l1.logs < 10, 'Level 1 Carpenter should consume Logs');
assert.ok(l1.wood > 0, 'Level 1 Carpenter should produce Wood');

const level3 = new EconomySystem();
level3.setState(emptyState);
level3.tick(1000, [{ x: 1, y: 1, kind: 'carpenter', level: 3 }], 0, 0);
const l3 = level3.getState();
assert.ok(l3.wood > l1.wood, 'Level 3 should produce more Wood than Level 1');
assert.ok(l3.logs < l1.logs, 'Level 3 should process more Logs than Level 1');

const forestry = new EconomySystem();
forestry.setState(emptyState);
forestry.tick(1000, [{ x: 0, y: 0, kind: 'hut', level: 1 }], 0, 0);
const forestState = forestry.getState();
assert.ok(forestState.logs > 10, 'Hut should produce raw Logs');
assert.equal(forestState.wood, 0, 'Raw Logs should not become Wood without a Carpenter Workshop');

const cost = level1.constructionCost('carpenter');
assert.equal(cost.wood, 6);
assert.equal(cost.stone, 2);

assert.equal(isToolAvailable('medieval', 'carpenter'), true);
assert.equal(isBuildingAvailable('medieval', 'carpenter'), true);
assert.equal(isToolAvailable('survival', 'carpenter'), true);
assert.equal(isToolAvailable('sandbox', 'carpenter'), true);

const population = new PopulationSystem();
population.reconcile([
  { x: 0, y: 0, kind: 'house' },
  { x: 1, y: 0, kind: 'carpenter', level: 2 },
]);
assert.equal(population.snapshot().productionWorkers, 4, 'Level 2 Carpenter should employ four workers');

const renderer = new CarpenterWorkshopRenderer();
const visual1 = renderer.render(1, 1);
const visual2 = renderer.render(2, 1);
const visual3 = renderer.render(3, 1);
assert.equal(visual1.userData.carpenterLevel, 1);
assert.equal(visual2.userData.carpenterLevel, 2);
assert.equal(visual3.userData.carpenterLevel, 3);
assert.ok(visual2.children.length > visual1.children.length, 'Level 2 must be visually richer than Level 1');
assert.ok(visual3.children.length > visual2.children.length, 'Level 3 must be visually richer than Level 2');

console.log('Carpenter Workshop economy, staffing, availability, and visual progression checks passed.');
