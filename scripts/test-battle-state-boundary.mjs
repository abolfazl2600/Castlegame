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

assert.doesNotMatch(
  battleSystem,
  /\bsetBuildingDamage\b/,
  'BattleWorldContext must not expose a persistent building-damage mutation callback.',
);

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
assert.doesNotMatch(
  damageWall,
  /updateCell|GameState|save\s*\(/,
  'Battle wall damage must not mutate or persist world state.',
);

const battleIntegration = between(
  threeGame,
  'this.battleSystem = new BattleSystem(',
  'this.registerBuiltInGameModes();',
);
assert.doesNotMatch(
  battleIntegration,
  /setBuildingDamage/,
  'ThreeGame must not wire battle damage into GameState.',
);

const battleUi = between(
  threeGame,
  'private updateBattleUI(',
  'private selectTool(',
);
assert.doesNotMatch(
  battleUi,
  /this\.save\s*\(/,
  'Battle completion must not save battle-only structural state.',
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
