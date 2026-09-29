import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const populationSource = await readFile(
  new URL('../src/systems/PopulationSystem.ts', import.meta.url),
  'utf8',
);
const gameSource = await readFile(new URL('../src/ThreeGame.ts', import.meta.url), 'utf8');
const saveSource = await readFile(new URL('../src/core/SaveSystem.ts', import.meta.url), 'utf8');
const battleSource = await readFile(new URL('../src/battle/BattleSystem.ts', import.meta.url), 'utf8');
const typesSource = await readFile(new URL('../src/core/types.ts', import.meta.url), 'utf8');

// TypeScript 7 no longer exposes the legacy runtime enum objects used by
// older tests. transpileModule still accepts the compiler enum numeric values.
// ESNext is 99 for both ModuleKind and ScriptTarget.
const transpiled = ts.transpileModule(populationSource, {
  compilerOptions: {
    module: 99,
    target: 99,
  },
}).outputText;

const moduleUrl = 'data:text/javascript;base64,' + Buffer.from(transpiled).toString('base64');
const { PopulationSystem } = await import(moduleUrl);

const population = new PopulationSystem();
const cells = [
  { x: 1, y: 1, kind: 'cottage', level: 1 },
  { x: 2, y: 1, kind: 'house', level: 1 },
  { x: 4, y: 4, kind: 'farm', level: 1 },
  { x: 5, y: 4, kind: 'mine', level: 1 },
  { x: 6, y: 4, kind: 'market', level: 1 },
  { x: 8, y: 8, kind: 'armyCamp', level: 2 },
];

let groups = population.calculate(cells, 999);
assert.equal(groups.civilians, 48, 'civilian population must come from persistent homes, not battle counters');
assert.equal(groups.farmers, 8);
assert.equal(groups.miners, 5);
assert.equal(groups.merchants, 20);
assert.equal(groups.builders, 3);
assert.equal(groups.available, 12);
assert.equal(groups.military, 0, 'legacy military argument must not create free soldiers');

const militia = population.setMilitiaComposition({
  swordsman: 12,
  archer: 8,
  spearman: 0,
  crossbowman: 0,
});
assert.deepEqual(militia, {
  swordsman: 12,
  archer: 8,
  spearman: 0,
  crossbowman: 0,
});
groups = population.calculate(cells, 0);
assert.equal(groups.civilians, 48, 'militia remain the same civilian identities');
assert.equal(groups.militia, 20);
assert.equal(groups.available, 0, 'mobilizing militia must consume available civilian labor');
assert.ok(
  groups.builders < 3 || groups.merchants < 20 || groups.miners < 5 || groups.farmers < 8,
  'large militia assignments must reduce some civilian work capacity',
);

const professionals = population.setProfessionalArmyCount(20, cells);
assert.equal(professionals, 12, 'Level 2 Army Camp must cap professional recruitment at 12');
groups = population.calculate(cells, 0);
assert.equal(groups.professionalArmy, 12);
assert.equal(groups.civilians, 48, 'professional soldiers must not be counted as civilians');
assert.equal(groups.military, 32);

assert.equal(population.applyMilitiaCasualties({ swordsman: 3 }), 3);
assert.equal(population.applyProfessionalCasualties(2), 2);
groups = population.calculate(cells, 0);
assert.equal(groups.civilians, 45, 'militia deaths must permanently reduce civilian population');
assert.equal(groups.militia, 17);
assert.equal(groups.professionalArmy, 10);

population.reconcile(cells);
assert.equal(
  population.snapshot().totalPopulation,
  45,
  'casualties must not be auto-refilled simply because the same housing remains',
);

const expandedCells = [...cells, { x: 3, y: 1, kind: 'villa', level: 1 }];
population.reconcile(expandedCells);
assert.equal(
  population.snapshot().totalPopulation,
  81,
  'new housing capacity may introduce new persistent citizens without resurrecting casualties',
);

const saved = population.getState();
const restored = new PopulationSystem();
restored.setState(saved);
restored.reconcile(expandedCells);
assert.deepEqual(restored.getState(), saved, 'population identities and military pools must survive save/load round trips');

const noCampCells = expandedCells.filter((cell) => cell.kind !== 'armyCamp');
restored.reconcile(noCampCells);
assert.equal(
  restored.snapshot().professionalArmy,
  0,
  'professional troops must depend on surviving Army Camp capacity rather than free battle spawns',
);

const visible = restored.visibleCivilianRoster(8, 5);
assert.ok(visible.length <= 13, 'render caps must limit visuals only');
assert.ok(
  restored.snapshot().totalPopulation > visible.length,
  'simulation population must remain larger than the visible render subset',
);
assert.ok(visible.every((agent) => agent.role === 'citizen' || agent.role === 'farmer' || agent.role === 'worker'));

assert.match(typesSource, /population\?: PopulationSimulationState/);
assert.match(saveSource, /population: this\.host\.getPopulationState\?\.\(\)/);
assert.match(saveSource, /this\.host\.setPopulationState\?\.\(data\.population\)/);
assert.match(gameSource, /syncPopulationDefenseAssignments/);
assert.match(gameSource, /applyMilitiaCasualties/);
assert.match(gameSource, /applyProfessionalCasualties/);
assert.match(gameSource, /commitPopulationBattleOutcome\(preResetStatus, true\)/);
assert.match(gameSource, /visibleCivilianRoster\(40, 40\)/);
assert.match(gameSource, /id="population-available"/);
assert.match(gameSource, /id="population-professional"/);
assert.match(battleSource, /private findArmyCamps\(\): NavPoint\[\]/);
assert.match(battleSource, /defenderAliveByType/);
assert.match(
  battleSource,
  /spawnGroundUnit\('defender', 'modernSoldier', cell, 400 \+ i, false\)/,
);

console.log('Persistent living population, militia, Army Camp, casualty, rendering-cap, and save contracts passed.');
