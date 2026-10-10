import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { EconomySystem } from '../src/systems/EconomySystem.ts';

const economy = new EconomySystem();
const kinds = ['towerBridge', 'keep', 'tower', 'gate', 'mosque',
  'carpenter', 'harbor', 'cottage', 'farm', 'cowBarn', 'armyCamp'];
for (const kind of kinds) {
  const price2 = economy.upgradeCost(kind, 2);
  const price3 = economy.upgradeCost(kind, 3);
  const total = (cost) => (cost.wood ?? 0) + (cost.stone ?? 0);
  assert.ok(total(price2) > 0, `${kind} upgrade must cost resources`);
  assert.ok(total(price3) > total(price2), `${kind} upgrades must scale with level`);
}

economy.setState({ wood: 1, stone: 1 });
const price = economy.upgradeCost('keep', 2);
assert.equal(economy.canAfford(price), false);
assert.ok((economy.missing(price).stone ?? 0) > 0);
economy.setState({ wood: 1000, stone: 1000 });
assert.equal(economy.canAfford(price), true);
assert.equal(economy.spend(price), true);

const game = await readFile(new URL('../src/ThreeGame.ts', import.meta.url), 'utf8');
for (const method of ['upgradeSelectedFortification', 'upgradeSelectedMosque',
  'upgradeSelectedCarpenter', 'upgradeSelectedHarbor', 'upgradeSelectedResidence',
  'upgradeSelectedAgricultureBuilding', 'upgradeSelectedArmyCamp']) {
  const start = game.indexOf(`  private ${method}(): void {`);
  assert.ok(start >= 0, `Missing ${method}`);
  const end = game.indexOf('\n  private ', start + 1);
  const body = game.slice(start, end < 0 ? game.length : end);
  assert.match(body, /ensureUpgradeAffordable\(/, `${method}: affordability must be enforced`);
  assert.match(body, /spendUpgradeCost\(/, `${method}: resources must be consumed`);
}
assert.match(game, /if \(!this\.economyConstructionEnabled\(\)\) return true;/);
assert.match(game, /if \(!this\.economyConstructionEnabled\(\)\) return;/);

console.log('Upgrades require scalable resources, including all active building upgrade paths.');
