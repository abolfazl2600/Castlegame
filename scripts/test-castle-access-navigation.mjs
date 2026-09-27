import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [
  threeGame,
  battleSystem,
  battleNavigation,
  castleAccessSystem,
  gameMode,
  coreTypes,
] = await Promise.all([
  readFile(new URL('../src/ThreeGame.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/battle/BattleSystem.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/battle/BattleNavigation.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/building/CastleAccessSystem.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/core/GameMode.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/core/types.ts', import.meta.url), 'utf8'),
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

assert.match(
  coreTypes,
  /export type GeneratedAccessKind = AccessKind \| 'stairTower';/,
  'Stair Tower must be represented as generated castle access.',
);
assert.doesNotMatch(
  gameMode,
  /stairTower/,
  'Stair Tower must not be exposed by any game-mode build list.',
);
assert.match(
  castleAccessSystem,
  /kind:\s*GeneratedAccessKind;/,
  'GeneratedAccess must use the generated-access kind contract.',
);
assert.match(
  castleAccessSystem,
  /return 'stairTower';/,
  'CastleAccessSystem must be able to choose an automatic Stair Tower.',
);
assert.match(
  castleAccessSystem,
  /target\.kind === 'wall1' \|\| target\.kind === 'wall3'/,
  'Automatic Stair Towers must be selected from masonry wall targets.',
);

assert.match(
  threeGame,
  /private generatedCastleAccess: GeneratedAccess\[\] \| null = null;/,
  'ThreeGame must cache the generated-access array shared by rendering and battle.',
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
  /this\.generatedCastleAccess = null;/,
  'Architecture redraw must invalidate derived castle access before regeneration.',
);
assert.match(
  redraw,
  /const generatedAccess = this\.getGeneratedCastleAccess\(\);/,
  'Rendering must consume the canonical generated-access provider.',
);
assert.match(
  redraw,
  /this\.makeGeneratedAccess\(group, access\);/,
  'Generated access rendering must consume each canonical access record directly.',
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

const provider = between(
  threeGame,
  'private getGeneratedCastleAccess(): GeneratedAccess[] {',
  'private redraw(): void {',
);
assert.match(
  provider,
  /if \(this\.generatedCastleAccess\) return this\.generatedCastleAccess;/,
  'Canonical generated access must be reused after the first materialization.',
);
assert.match(
  provider,
  /this\.generatedCastleAccess = this\.services\.castleAccessSystem\.generate\(/,
  'Only the canonical provider may populate the generated-access cache.',
);
assert.match(
  provider,
  /return this\.generatedCastleAccess;/,
  'The provider must return the cached array instance.',
);

const generatedRenderer = between(
  threeGame,
  'private generatedAccessRise(',
  'private makeAccess(',
);
assert.match(
  generatedRenderer,
  /group\.rotation\.y = access\.rotation \* Math\.PI \/ 2;/,
  'Generated access rotation must be derived from and applied from the canonical record.',
);
assert.match(
  generatedRenderer,
  /if \(access\.kind === 'stairTower'\)/,
  'Generated Stair Towers must use their dedicated wall-integrated renderer.',
);
assert.match(
  generatedRenderer,
  /this\.fortificationTopLocal\(target\)/,
  'Generated access height must reuse the authoritative fortification top calculation.',
);
assert.match(
  generatedRenderer,
  /this\.makeStairTower\(group, access, rise\)/,
  'Generated Stair Towers must receive the exact computed wall rise.',
);

const migration = between(
  threeGame,
  'private migrateKind(',
  'private bindUI(): void {',
);
assert.match(
  migration,
  /if \(kind === 'stairTower'\) return null;/,
  'Legacy persisted Stair Towers must be removed so derived access can regenerate.',
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
