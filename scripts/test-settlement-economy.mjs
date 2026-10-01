import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const gameSource = await readFile(new URL('../src/ThreeGame.ts', import.meta.url), 'utf8');
const saveSource = await readFile(new URL('../src/core/SaveSystem.ts', import.meta.url), 'utf8');
const servicesSource = await readFile(new URL('../src/core/GameDomainServices.ts', import.meta.url), 'utf8');
const typesSource = await readFile(new URL('../src/core/types.ts', import.meta.url), 'utf8');

const { EconomySystem } = await import(
  new URL('../src/systems/EconomySystem.ts', import.meta.url),
);

const economy = new EconomySystem();
const defaults = economy.getState();
assert.ok(defaults.wood > 0 && defaults.stone > 0, 'legacy/new worlds need starter construction materials');

const productionCells = [
  { x: 1, y: 1, kind: 'farm', level: 2 },
  { x: 2, y: 1, kind: 'appleOrchard', level: 2 },
  { x: 3, y: 1, kind: 'cowBarn', level: 2 },
  { x: 4, y: 1, kind: 'windmill', level: 1 },
  { x: 5, y: 1, kind: 'market', level: 1 },
  { x: 6, y: 1, kind: 'mine', level: 1 },
  { x: 7, y: 1, kind: 'hut', level: 1 },
  { x: 8, y: 1, kind: 'tree', level: 1 },
];

const before = economy.getState();
const tick = economy.tick(1000, productionCells, 12, 1);
const after = economy.getState();
assert.equal(tick.updated, true);
assert.ok(after.wood > before.wood, 'hut/tree production should add wood');
assert.ok(after.stone > before.stone, 'mine production should add stone');
assert.ok(after.apples > before.apples, 'orchards should add apples');
assert.ok(after.food !== before.food, 'cow barn/market production and population consumption should affect food');
assert.ok(economy.snapshot(productionCells, 12, 1).rates.grainPerSecond !== 0);
assert.ok(economy.snapshot(productionCells, 12, 1).storageCapacity > 220);

const conversion = new EconomySystem();
conversion.setState({ wood: 0, stone: 0, grain: 10, apples: 0, flour: 0, food: 0 });
conversion.tick(
  1000,
  [
    { x: 1, y: 1, kind: 'windmill', level: 1 },
    { x: 2, y: 1, kind: 'market', level: 1 },
  ],
  0,
  0,
);
const converted = conversion.getState();
assert.ok(converted.grain < 10, 'windmills must consume grain');
assert.ok(converted.flour > 0 || converted.food > 0, 'grain must become processed goods');

const shortage = new EconomySystem();
shortage.setState({ wood: 0, stone: 0, grain: 0, apples: 0, flour: 0, food: 0 });
const shortageTick = shortage.tick(1000, [], 100, 0);
assert.equal(shortageTick.shortage, true, 'population without food must trigger shortage');
assert.equal(shortage.snapshot([], 100, 0).foodShortage, true);

const saved = economy.getState();
const restored = new EconomySystem();
restored.setState(saved);
assert.deepEqual(restored.getState(), saved, 'economy resources must round-trip through serialized state');

const wallCost = restored.constructionCost('wall1', 3);
assert.equal(wallCost.stone, 6);
restored.setState({ wood: 5, stone: 5, grain: 0, apples: 0, flour: 0, food: 0 });
assert.equal(restored.canAfford(wallCost), false);
assert.equal(restored.missing(wallCost).stone, 1);

assert.match(servicesSource, /readonly economySystem: EconomySystem/);
assert.match(servicesSource, /economySystem: new EconomySystem\(\)/);
assert.match(typesSource, /export interface EconomyResourceState/);
assert.match(typesSource, /economy\?: EconomyResourceState/);
assert.match(saveSource, /economy: this\.host\.getEconomyState\?\.\(\)/);
assert.match(saveSource, /this\.host\.setEconomyState\?\.\(data\.economy\)/);
assert.match(gameSource, /return !this\.freeBuildEnabled/);
assert.doesNotMatch(gameSource, /this\.gameMode === 'sandbox'[^\n]*ensureConstructionAffordable/);
assert.match(gameSource, /private updateEconomy\(deltaMs: number\): void/);
assert.match(gameSource, /id="economy-wood"/);
assert.match(gameSource, /Food shortage · build Farms, Orchards, Windmills, Cow Barns, or Markets/);

console.log('Settlement economy production, conversion, consumption, persistence, construction costs, and HUD contracts passed.');
