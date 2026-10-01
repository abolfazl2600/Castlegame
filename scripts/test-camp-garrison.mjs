import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PopulationSystem } from '../src/systems/PopulationSystem.ts';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const endlessDefense = await readFile(new URL('../src/battle/EndlessDefense.ts', import.meta.url), 'utf8');
const game = await readFile(new URL('../src/ThreeGame.ts', import.meta.url), 'utf8');
assert.doesNotMatch(html, /battle-faction battle-defenders|data-battle-field="defender/);
assert.match(html, /battle-faction battle-attackers/);
assert.doesNotMatch(endlessDefense, /survival-hud|ensureHud|renderHud/);
assert.match(game, /professionalArmyCapacity\(cells\)/);
assert.match(game, /professionalArmyComposition\(\)/);
assert.match(game, /if \(String\(field\)\.startsWith\('defender'\)\) return;/);

const population = new PopulationSystem();
const camps = [
  { x: 1, y: 1, kind: 'armyCamp', level: 1 },
  { x: 4, y: 4, kind: 'armyCamp', level: 2 },
];
population.reconcile(camps);
assert.equal(population.professionalArmyCapacity(camps), 18);
assert.equal(population.setProfessionalArmyCount(population.professionalArmyCapacity(camps), camps), 18);
const first = population.professionalArmyComposition();
assert.equal(Object.values(first).reduce((a, b) => a + b, 0), 18);
assert.ok(first.swordsman > 0 && first.spearman > 0 && first.archer > 0 && first.crossbowman > 0);

const restored = new PopulationSystem();
restored.setState(population.getState());
restored.reconcile(camps);
assert.deepEqual(restored.professionalArmyComposition(), first, 'Loading must keep camp garrison identities');

assert.equal(restored.applyProfessionalCasualties({ swordsman: 2, archer: 1 }), 3);
assert.equal(restored.snapshot().professionalArmy, 15);
restored.reconcile(camps);
assert.equal(restored.snapshot().professionalArmy, 15, 'Reconcile must not refill casualties by itself');

const upgraded = [{ x: 4, y: 4, kind: 'armyCamp', level: 4 }];
assert.equal(restored.professionalArmyCapacity(upgraded), 32);
assert.equal(restored.setProfessionalArmyCount(32, upgraded), 32);
assert.equal(Object.values(restored.professionalArmyComposition()).reduce((a, b) => a + b, 0), 32);
restored.reconcile([]);
assert.equal(restored.snapshot().professionalArmy, 0, 'Removing camps must retire defender units');
console.log('Camp-based defender roster, casualties, save/load, and simplified Battle UI passed.');
