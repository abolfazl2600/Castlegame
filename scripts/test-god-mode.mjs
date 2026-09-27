import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [registry, game, html, saveSystem, destructible] = await Promise.all([
  readFile(new URL('../src/godmode/GodModeSystem.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/ThreeGame.ts', import.meta.url), 'utf8'),
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../src/core/SaveSystem.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/building/DestructibleBuildingSystem.ts', import.meta.url), 'utf8'),
]);

assert.match(registry, /class GodModeActionRegistry/);
assert.match(registry, /validateTarget\(target: GodModeTarget \| null/);
assert.match(registry, /execute\(target: GodModeTarget/);
assert.match(registry, /createFutureGodModeAction/);

assert.match(game, /id: 'missileStrike'/);
assert.match(game, /availableModes: \['sandbox'\]/);
assert.match(game, /resolveGodModeTarget/);
assert.match(game, /getStructureFootprint\(cell\.kind, cell\.x, cell\.y\)/);
assert.match(game, /destructibleBuildingSystem\.applyDamage/);
assert.match(game, /private executeMissileStrike\(target: GodModeTarget\)/);
assert.match(game, /private fireGodModeAt\(point: GridPoint \| null\)/);
assert.match(game, /private godModeCapacity = 10/);
assert.match(game, /this\.fireGodModeAt\(cell\)/);
assert.match(game, /Missile capacity exhausted/);
assert.match(game, /this\.services\.state\.removeCell\(target\.anchor\.x, target\.anchor\.y\)/);
assert.match(game, /createMissileStrikeEffect/);
assert.match(game, /godModeActions\.register/);
assert.match(game, /captureSnapshot\(\)/);
assert.match(saveSystem, /damage: clamp\(cell\.damage/);
assert.match(destructible, /applyDamage\(cell: GridCell/);

assert.match(html, /id="god-mode-panel"/);
assert.match(html, /data-god-action="missileStrike"/);
assert.match(html, /id="god-mode-confirm"/);
assert.match(html, /id="god-mode-capacity"/);
assert.match(html, /id="god-mode-cancel"/);

console.log('God Mode registry, targeting, damage, persistence and UI checks passed.');
