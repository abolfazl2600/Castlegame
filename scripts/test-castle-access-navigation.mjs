import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [threeGame, battleSystem, battleNavigation] = await Promise.all([
  readFile(new URL('../src/ThreeGame.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/battle/BattleSystem.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/battle/BattleNavigation.ts', import.meta.url), 'utf8'),
]);

function between(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `Missing start marker: ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `Missing end marker: ${endMarker}`);
  return source.slice(start, end);
}

assert.match(
  threeGame,
  /private getGeneratedCastleAccess\(\): GeneratedAccess\[\]/,
  'ThreeGame must expose one canonical generated castle-access provider.',
);

const integration = between(
  threeGame,
  'this.battleSystem = new BattleSystem(',
  'this.registerBuiltInGameModes();',
);
assert.match(
  integration,
  /generatedAccess:\s*\(\)\s*=>\s*this\.getGeneratedCastleAccess\(\)/,
  'BattleSystem must receive the canonical generated-access provider.',
);

const redraw = between(
  threeGame,
  'private redraw(): void {',
  'private renderPlanLayer(',
);
assert.match(
  redraw,
  /const generatedAccess = this\.getGeneratedCastleAccess\(\);/,
  'Rendering must consume the canonical generated-access provider.',
);
assert.doesNotMatch(
  redraw,
  /castleAccessSystem\.generate\(/,
  'redraw() must not independently regenerate castle access.',
);

const generatorCalls = threeGame.match(/castleAccessSystem\.generate\(/g) ?? [];
assert.equal(
  generatorCalls.length,
  1,
  'CastleAccessSystem.generate() must be called only by the canonical provider.',
);

assert.match(
  battleSystem,
  /generatedAccess\?:\s*\(\)\s*=>\s*GeneratedAccess\[\]/,
  'BattleWorldContext must reuse the GeneratedAccess contract.',
);
assert.match(
  battleSystem,
  /generatedAccess:\s*world\.generatedAccess/,
  'BattleSystem must forward generated access into BattleNavigation.',
);

const accessNodes = between(
  battleNavigation,
  'stairTowerAccessNodes():',
  'private isCastleAccessKind(',
);
assert.match(
  accessNodes,
  /this\.context\.generatedAccess\?\.\(\)/,
  'BattleNavigation must consume generated access.',
);
assert.match(
  accessNodes,
  /nodesByKey\.get\(this\.key\(access\.targetX, access\.targetY\)\)/,
  'Generated access must terminate at an actual defensive platform node.',
);
assert.match(
  accessNodes,
  /addAccess\(top, \{ x: access\.x, y: access\.y \}\)/,
  'Generated access ground coordinates must be used exactly.',
);
assert.doesNotMatch(
  accessNodes,
  /node\.kind\s*!==\s*['"]tower['"]/,
  'Towers must not receive implicit vertical access without a real access structure.',
);
assert.doesNotMatch(
  accessNodes,
  /node\.kind\s*!==\s*['"]gate['"]/,
  'Gates must not receive implicit vertical access without a real access structure.',
);
assert.doesNotMatch(
  battleNavigation,
  /hasDedicatedWallAccess/,
  'Legacy adjacency-based access inference must remain removed.',
);

console.log('Castle access/navigation regression checks passed.');
