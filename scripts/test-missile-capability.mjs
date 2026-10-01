import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [missile, gameState, battleSystem, threeGame, saveSystem, html] = await Promise.all([
  readFile(new URL('../src/battle/MissileCapability.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/state/GameState.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/battle/BattleSystem.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/ThreeGame.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/core/SaveSystem.ts', import.meta.url), 'utf8'),
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
]);

assert.match(missile, /unlockTier:\s*4/);
assert.match(missile, /maxStock:\s*3/);
assert.match(missile, /export function missileModeAvailable\(_mode: GameMode\): boolean \{\s*return true;/);
assert.match(missile, /export function missilesUnlocked\(_mode: GameMode, _tier: MilitaryTier\): boolean \{\s*return true;/);
assert.doesNotMatch(missile, /mode === 'sandbox'|mode === 'modern'/);
assert.match(gameState, /getMissileState\(\): MissileInventoryState/);
assert.match(battleSystem, /launchMissile\(/);
assert.match(threeGame, /beginMissileProduction\(/);
assert.match(threeGame, /this\.battleSystem\.launchMissile\(targetId/);
assert.match(saveSystem, /missiles:\s*this\.host\.state\.getMissileState\(\)/);
assert.match(html, /id="military-missile-produce"/);
assert.match(html, /id="military-missile-launch"/);

console.log('Unified missile production, targeting, damage and persistence checks passed.');
