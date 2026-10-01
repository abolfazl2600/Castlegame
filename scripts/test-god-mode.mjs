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
assert.match(registry, /isAvailable\(id: string\)/);
assert.doesNotMatch(registry, /availableModes|GameMode/);
assert.match(game, /id: 'missileStrike'/);
assert.doesNotMatch(game, /God Mode is available in Sandbox only|availableModes/);
assert.match(game, /godModeButton\.hidden = false/);
assert.match(game, /resolveGodModeTarget/);
assert.match(game, /destructibleBuildingSystem\.applyDamage/);
assert.match(game, /private executeMissileStrike\(target: GodModeTarget\)/);
assert.match(game, /private godModeCapacity = 10/);
assert.match(saveSystem, /damage: clamp\(cell\.damage/);
assert.match(destructible, /applyDamage\(cell: GridCell/);
assert.match(html, /id="god-mode-button"/);
assert.match(html, /id="god-mode-panel"/);
assert.match(html, /data-god-action="missileStrike"/);

console.log('Unified God Mode availability, targeting, damage, persistence and UI checks passed.');
