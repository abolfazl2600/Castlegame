import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PopulationSystem } from '../src/systems/PopulationSystem.ts';

const camp = { x: 2, y: 2, kind: 'armyCamp', level: 1 };
const newCamp = { x: 5, y: 5, kind: 'armyCamp', level: 1 };

const population = new PopulationSystem();
population.reconcile([camp]);
assert.equal(population.recruitForNewCampCapacity([camp]), 6);
assert.equal(population.recruitForNewCampCapacity([camp]), 6, 'Redraw must not add troops');

population.applyProfessionalCasualties(2);
assert.equal(population.snapshot().professionalArmy, 4);
population.reconcile([camp]);
assert.equal(population.recruitForNewCampCapacity([camp]), 4, 'Casualties must remain missing');

const state = population.getState();
assert.equal(state.garrisonCapacityBaseline, 6);
const loaded = new PopulationSystem();
loaded.setState(state);
loaded.reconcile([camp]);
assert.equal(loaded.recruitForNewCampCapacity([camp]), 4, 'Reload must not replenish losses');

loaded.reconcile([camp, newCamp]);
assert.equal(loaded.recruitForNewCampCapacity([camp, newCamp]), 10,
  'A new camp must add only its own new slots, without restoring casualties');

const legacy = new PopulationSystem();
legacy.setState({ ...state, garrisonCapacityBaseline: undefined });
legacy.reconcile([camp]);
assert.equal(legacy.recruitForNewCampCapacity([camp]), 4,
  'Legacy saves with an existing roster must not accidentally refill on load');

const game = await readFile(new URL('../src/ThreeGame.ts', import.meta.url), 'utf8');
assert.match(game, /recruitForNewCampCapacity\(readyCells\)/);
assert.match(game, /const readyCells = this.operationalCells\(cells\)/);
assert.doesNotMatch(game, /setProfessionalArmyCount\(capacity, cells\)/);

console.log('Garrison capacity growth, casualties, and save/load contracts passed.');
