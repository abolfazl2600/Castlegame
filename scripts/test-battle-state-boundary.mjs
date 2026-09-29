import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [battleSystem, threeGame, survivalMode] = await Promise.all([
  readFile(new URL('../src/battle/BattleSystem.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/ThreeGame.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/SurvivalGameMode.ts', import.meta.url), 'utf8'),
]);

function between(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `Missing start marker: ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `Missing end marker: ${endMarker}`);
  return source.slice(start, end);
}

assert.match(battleSystem, /onWallDamage\?: \(x: number, y: number, damage: number\) => void/);

const damageWall = between(
  battleSystem,
  'private damageWall(',
  'private renderWallDamage(',
);
assert.match(
  damageWall,
  /wall\.battleDamage\s*=/,
  'Battle wall damage must be tracked in battle runtime state.',
);
assert.match(damageWall, /this\.world\.onWallDamage\?\.\(wall\.x, wall\.y/,
  'Battle damage must be committed through the world boundary.');
assert.doesNotMatch(damageWall, /updateCell|GameState|save\s*\(/,
  'BattleSystem must not own persistence mechanics.');
assert.match(
  damageWall,
  /spawnWallDestructionBurst\(wall, nextStage\)/,
  'Wall damage stage transitions must trigger the procedural destruction burst.',
);

assert.match(
  battleSystem,
  /interface WallCollapseEffect[\s\S]*?fragments: WallCollapseFragment\[\][\s\S]*?dust: WallDustParticle\[\][\s\S]*?shockwaves: WallShockwave\[\]/,
  'Detailed wall destruction must track stone fragments, dust, and shockwaves as one lifecycle.',
);
assert.match(
  battleSystem,
  /private addWallCrackNetwork\([\s\S]*?segments = 5 \+ intensity \* 5/,
  'Damaged walls must build a multi-segment branching crack network.',
);
assert.match(
  battleSystem,
  /private addBrokenWallRemnants\([\s\S]*?for \(let i = 0; i < 30; i \+= 1\)/,
  'Breached walls must leave a dense persistent rubble field and broken wall remnants.',
);
assert.match(
  battleSystem,
  /const fragmentCount =[\s\S]*?stage === 'partial' \? 28 :[\s\S]*?52;/,
  'A full breach must launch the high-detail 52-fragment collapse burst.',
);
assert.match(
  battleSystem,
  /const dustCount =[\s\S]*?stage === 'partial' \? 11 :[\s\S]*?20;/,
  'A full breach must launch a dense multi-puff dust cloud.',
);
assert.match(
  battleSystem,
  /fragment\.velocity\.y -= 10\.8 \* delta/,
  'Flying wall debris must use gravity during collapse.',
);
assert.match(
  battleSystem,
  /fragment\.velocity\.y = Math\.abs\(fragment\.velocity\.y\) \* fragment\.bounce/,
  'Wall debris must bounce and settle instead of simply disappearing.',
);
assert.match(
  battleSystem,
  /shockCount = stage === 'breached' \? 3 : 1/,
  'Major wall failure must produce layered ground shockwaves.',
);
assert.match(
  battleSystem,
  /private clearWallCollapseEffects\(\): void/,
  'Wall destruction effects must be explicitly cleaned up by the battle lifecycle.',
);
assert.match(
  battleSystem,
  /!this\.sharedGeometries\.includes\(object\.geometry\)/,
  'Siege visual cleanup must not dispose shared destruction geometries.',
);

const battleIntegration = between(
  threeGame,
  'this.battleSystem = new BattleSystem(',
  'this.registerBuiltInGameModes();',
);
assert.match(battleIntegration, /onWallDamage:[\s\S]*?state\.updateCell\(x, y, \{ damage \}\)/,
  'World state must own persistent castle damage.');

const battleUi = between(
  threeGame,
  'private updateBattleUI(',
  'private selectTool(',
);
assert.doesNotMatch(
  battleUi,
  /this\.save\s*\(/,
  'Battle UI must not save on every status update.',
);
assert.doesNotMatch(
  battleUi,
  /this\.redraw\s*\(/,
  'Battle cleanup is owned by BattleSystem and must not rely on a world redraw.',
);

assert.match(
  survivalMode,
  /preserveSessionWallDamage:\s*true/,
  'Survival must explicitly preserve runtime wall damage between waves.',
);
assert.match(
  survivalMode,
  /battleSystem\.reset\(false\)/,
  'Survival lifecycle must explicitly clear session wall damage.',
);

console.log('Battle state-boundary regression checks passed.');
