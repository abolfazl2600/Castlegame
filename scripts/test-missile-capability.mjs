import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [missile, gameState, battleSystem, threeGame, saveSystem, html, coreTypes] = await Promise.all([
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

assert.match(missile, /unlockTier:\s*4/);
assert.match(missile, /maxStock:\s*3/);
assert.match(missile, /productionMs:\s*10_000/);
assert.match(missile, /supplyCost:\s*2/);
assert.match(missile, /cooldownMs:\s*12_000/);
assert.match(missile, /range:\s*56/);
assert.match(missile, /impactRadius:\s*7\.5/);
assert.match(missile, /mode === 'modern' \|\| mode === 'sandbox'/);
assert.match(missile, /mode === 'sandbox' \|\| \(mode === 'modern' && tier >= MISSILE_CONFIG\.unlockTier\)/);

const production = between(
  missile,
  'export function beginMissileProduction(',
  'export function tickMissileState(',
);
assert.match(production, /if \(!missileModeAvailable\(mode\)\)/);
assert.match(production, /if \(!missilesUnlocked\(mode, tier\)\)/);
assert.match(production, /if \(battleActive\)/);
assert.match(production, /current\.productionRemainingMs > 0/);
assert.match(production, /current\.stock >= MISSILE_CONFIG\.maxStock/);
assert.match(production, /current\.supply < MISSILE_CONFIG\.supplyCost/);
assert.match(production, /supply:\s*current\.supply - MISSILE_CONFIG\.supplyCost/);
assert.match(production, /productionRemainingMs:\s*MISSILE_CONFIG\.productionMs/);

const tick = missile.slice(missile.indexOf('export function tickMissileState('));
assert.match(tick, /if \(!available \|\| !timersEnabled/);
assert.match(tick, /productionEnabled && productionRemainingMs > 0/);
assert.match(tick, /productionRemainingMs === 0 && stock < MISSILE_CONFIG\.maxStock/);
assert.match(tick, /stock \+= 1/);
assert.match(tick, /cooldownRemainingMs = Math\.max\(0, current\.cooldownRemainingMs - delta\)/);
assert.match(tick, /supply < MISSILE_CONFIG\.maxSupply/);
assert.match(tick, /supply \+= 1/);

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
assert.match(threeGame, /timersEnabled = !this\.battleSystem\.isUnderAttack\(\) \|\| this\.battleSystem\.isRunning\(\)/);

assert.match(saveSystem, /missiles:\s*this\.host\.state\.getMissileState\(\)/);
assert.match(saveSystem, /this\.host\.state\.setMissileState\(data\.missiles\)/);
assert.match(saveSystem, /missiles:\s*parsed\.missiles/);
assert.match(saveSystem, /missiles:\s*raw\.missiles/);

assert.match(html, /id="military-missile-produce"/);
assert.match(html, /id="military-missile-target"/);
assert.match(html, /id="military-missile-launch"/);
assert.match(html, /id="military-missile-production-fill"/);

console.log('Modern missile production, targeting, damage and persistence checks passed.');
