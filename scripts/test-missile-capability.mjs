import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const typescriptModule = require('typescript');
const ts = typescriptModule.default ?? typescriptModule;

const [missileSource, gameState, battleSystem, threeGame, saveSystem, html, coreTypes] = await Promise.all([
  readFile(new URL('../src/battle/MissileCapability.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/state/GameState.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/battle/BattleSystem.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/ThreeGame.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/core/SaveSystem.ts', import.meta.url), 'utf8'),
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../src/core/types.ts', import.meta.url), 'utf8'),
]);

function between(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `Missing start marker: ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `Missing end marker: ${endMarker}`);
  return source.slice(start, end);
}

const transpiled = ts.transpileModule(missileSource, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ES2022,
  },
}).outputText;
const missile = await import(
  `data:text/javascript;base64,${Buffer.from(transpiled, 'utf8').toString('base64')}`
);

const {
  MISSILE_CONFIG,
  beginMissileProduction,
  defaultMissileState,
  missilesUnlocked,
  normalizeMissileState,
  tickMissileState,
} = missile;

assert.equal(MISSILE_CONFIG.unlockTier, 4);
assert.equal(MISSILE_CONFIG.maxStock, 3);
assert.equal(MISSILE_CONFIG.supplyCost, 2);
assert.equal(MISSILE_CONFIG.productionMs, 10_000);
assert.equal(MISSILE_CONFIG.cooldownMs, 12_000);

assert.equal(missilesUnlocked('modern', 3), false);
assert.equal(missilesUnlocked('modern', 4), true);
assert.equal(missilesUnlocked('sandbox', 1), true);
assert.equal(missilesUnlocked('medieval', 4), false);

const base = defaultMissileState();
assert.deepEqual(base, {
  stock: 0,
  productionRemainingMs: 0,
  cooldownRemainingMs: 0,
  supply: 6,
  supplyRechargeRemainingMs: 30_000,
});

const locked = beginMissileProduction(base, 'modern', 3, false);
assert.equal(locked.ok, false);
assert.match(locked.message, /Tier 4/);

const duringBattle = beginMissileProduction(base, 'modern', 4, true);
assert.equal(duringBattle.ok, false);
assert.match(duringBattle.message, /active battle/);

const insufficient = beginMissileProduction({ ...base, supply: 1 }, 'modern', 4, false);
assert.equal(insufficient.ok, false);
assert.match(insufficient.message, /Need 2/);

const started = beginMissileProduction(base, 'modern', 4, false);
assert.equal(started.ok, true);
assert.equal(started.state.supply, 4);
assert.equal(started.state.productionRemainingMs, 10_000);
assert.equal(started.state.stock, 0);

const midway = tickMissileState(started.state, 4_000, true, true, true);
assert.equal(midway.state.productionRemainingMs, 6_000);
assert.equal(midway.state.stock, 0);
assert.equal(midway.produced, false);

const completed = tickMissileState(midway.state, 6_000, true, true, true);
assert.equal(completed.state.productionRemainingMs, 0);
assert.equal(completed.state.stock, 1);
assert.equal(completed.produced, true);

const paused = tickMissileState(
  { ...completed.state, cooldownRemainingMs: 8_000 },
  2_000,
  true,
  false,
  false,
);
assert.equal(paused.state.cooldownRemainingMs, 8_000);

const cooling = tickMissileState(
  { ...completed.state, cooldownRemainingMs: 2_000 },
  2_000,
  true,
  false,
  true,
);
assert.equal(cooling.state.cooldownRemainingMs, 0);
assert.equal(cooling.cooldownReady, true);

const normalized = normalizeMissileState({
  stock: 99,
  supply: -5,
  productionRemainingMs: 99_999,
  cooldownRemainingMs: -1,
});
assert.equal(normalized.stock, 3);
assert.equal(normalized.supply, 0);
assert.equal(normalized.productionRemainingMs, 10_000);
assert.equal(normalized.cooldownRemainingMs, 0);

assert.match(coreTypes, /export interface MissileInventoryState/);
assert.match(gameState, /private missiles: MissileInventoryState = defaultMissileState\(\)/);
assert.match(gameState, /getMissileState\(\): MissileInventoryState/);
assert.match(gameState, /setMissileState\(value\?: Partial<MissileInventoryState> \| null\)/);

const launch = between(battleSystem, 'launchMissile(', 'status(): BattleStatus');
assert.match(launch, /this\.mode !== 'running'/);
assert.match(launch, /target\.data\.faction !== 'attacker'/);
assert.match(launch, /distance > range/);
assert.match(launch, /this\.missiles\.push/);

const impact = between(battleSystem, 'private resolveMissileImpact(', 'private clearMissiles(');
assert.match(impact, /runtime\.data\.faction !== 'attacker'/);
assert.match(impact, /distance > missile\.impactRadius/);
assert.match(impact, /this\.applyDamage\(runtime, missile\.damage/);

const resetRuntime = between(battleSystem, 'private resetRuntime(', 'update(deltaMs: number');
assert.match(resetRuntime, /this\.clearMissiles\(\)/);

assert.match(threeGame, /beginMissileProduction\(/);
assert.match(threeGame, /stock:\s*state\.stock - 1/);
assert.match(threeGame, /cooldownRemainingMs:\s*MISSILE_CONFIG\.cooldownMs/);
assert.match(threeGame, /this\.battleSystem\.launchMissile\(targetId/);
assert.match(threeGame, /!this\.battleSystem\.isRunning\(\)/);
assert.match(threeGame, /getMissileTargets\(MISSILE_CONFIG\.range\)/);
assert.match(threeGame, /option\.disabled = !target\.inRange/);

assert.match(saveSystem, /missiles:\s*this\.host\.state\.getMissileState\(\)/);
assert.match(saveSystem, /this\.host\.state\.setMissileState\(data\.missiles\)/);
assert.match(saveSystem, /missiles:\s*parsed\.missiles/);
assert.match(saveSystem, /missiles:\s*raw\.missiles/);

assert.match(html, /id="military-missile-produce"/);
assert.match(html, /id="military-missile-target"/);
assert.match(html, /id="military-missile-launch"/);
assert.match(html, /id="military-missile-production-fill"/);

console.log('Modern missile production, targeting, damage and persistence checks passed.');
