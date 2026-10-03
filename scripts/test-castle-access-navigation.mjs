import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [
  threeGame,
  battleSystem,
  battleNavigation,
  castleDetailGenerator,
  gameMode,
  gameDomainServices,
  gameState,
  saveSystem,
  constants,
] = await Promise.all([
  readFile(new URL('../src/ThreeGame.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/battle/BattleSystem.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/battle/BattleNavigation.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/building/CastleDetailGenerator.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/core/GameMode.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/core/GameDomainServices.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/state/GameState.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/core/SaveSystem.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/core/constants.ts', import.meta.url), 'utf8'),
]);

function between(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `Missing start marker: ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `Missing end marker: ${endMarker}`);
  return source.slice(start, end);
}

assert.match(
  gameDomainServices,
  /CastleDetailGenerator[\s\S]*?detailGenerator/,
  'Castle detail generation must remain a shared domain service.',
);
assert.doesNotMatch(
  gameDomainServices,
  /CastleAccessSystem|castleAccessSystem/,
  'Automatic wall access must not restore the obsolete standalone access service.',
);

assert.match(
  castleDetailGenerator,
  /wallPlan\([\s\S]*?slitOffsets[\s\S]*?buttresses[\s\S]*?flag/,
  'Arrow slits, buttresses, and flags must share one procedural wall-detail plan.',
);
assert.match(
  castleDetailGenerator,
  /wallAccessPlan\([\s\S]*?terrainBuildable[\s\S]*?isOccupied/,
  'Wall access must be generated from live geometry and valid ground clearance.',
);
assert.match(
  castleDetailGenerator,
  /neighbors\.length === 2[\s\S]*?neighbors\.length >= 3/,
  'Automatic access placement must account for straight walls and junction topology.',
);
assert.match(
  castleDetailGenerator,
  /existingGroundAnchors[\s\S]*?tower[\s\S]*?gate/,
  'Existing tower and gate access anchors must influence whether extra wall stairs are generated.',
);

assert.match(
  threeGame,
  /getAutomaticWallAccess\(\)[\s\S]*?wallAccessPlan/,
  'ThreeGame must materialize the canonical automatic wall-access plan.',
);
assert.match(
  threeGame,
  /makeAutomaticWallStairs\([\s\S]*?automaticWallAccess/,
  'Automatic wall access must have a compact derived visual representation.',
);
assert.match(
  threeGame,
  /automaticWallAccess:\s*\(\) => this\.getAutomaticWallAccess\(\)/,
  'Battle runtime must consume the same derived wall-access plan used by rendering.',
);
assert.doesNotMatch(
  threeGame,
  /GeneratedAccess|getGeneratedCastleAccess|makeGeneratedAccess|makeStairTower|makeAccess\(/,
  'The removed bulky legacy stair/ramp renderer must not be restored.',
);

const buildings = between(
  threeGame,
  'const BUILDING_KINDS: TileKind[] = [',
  'type ViewMode',
);
for (const removed of ['stoneStairs', 'woodenStairs', 'ramp', 'ladder']) {
  assert.doesNotMatch(
    buildings,
    new RegExp(`['"]${removed}['"]`),
    `${removed} must not return as a player-placeable runtime building kind.`,
  );
}

const unifiedBuildings = between(
  gameMode,
  'const BUILDINGS: readonly TileKind[] = [',
  'const WORLD_TOOLS',
);
for (const removed of ['stoneStairs', 'woodenStairs', 'ramp', 'ladder']) {
  assert.doesNotMatch(
    unifiedBuildings,
    new RegExp(`['"]${removed}['"]`),
    `${removed} must not be exposed by the unified game ruleset.`,
  );
}

const migration = between(
  threeGame,
  'private migrateKind(',
  'private bindUI(): void {',
);
for (const removed of ['stairTower', 'stoneStairs', 'woodenStairs', 'ramp', 'ladder']) {
  assert.match(
    migration,
    new RegExp(`kind === ['"]${removed}['"]`),
    `Legacy explicit ${removed} saves must be normalized away during migration.`,
  );
}
assert.match(
  migration,
  /procedural wall detail plan can regenerate safe access/,
  'Legacy wall-access migration must document regeneration by the procedural system.',
);

const advancedEditor = between(
  threeGame,
  '<span class="settings-section-title">Advanced Editor</span>',
  '</div></section></div>',
);
assert.doesNotMatch(
  advancedEditor,
  /wall stairs|buttresses|defensive openings|arrow slits/i,
  'Advanced Editor must not expose or describe automatic wall secondary details.',
);

assert.match(
  battleSystem,
  /automaticWallAccess\??:\s*\(\) => AutomaticWallAccess\[\]/,
  'BattleWorldContext must expose derived automatic wall access.',
);
assert.match(
  battleSystem,
  /automaticWallAccess:\s*world\.automaticWallAccess/,
  'BattleSystem must forward automatic wall access into navigation.',
);

const groundWalkability = between(
  battleNavigation,
  'isGroundWalkable(x: number, y: number): boolean {',
  'findPath(',
);
for (const removed of ['stoneStairs', 'woodenStairs', 'ramp', 'ladder']) {
  assert.doesNotMatch(
    groundWalkability,
    new RegExp(`kind === ['"]${removed}['"]`),
    `${removed} must not require persisted special ground walkability.`,
  );
}

assert.match(
  battleNavigation,
  /automaticWallAccess\??:\s*\(\) => AutomaticWallAccess\[\]/,
  'BattleNavigation must accept the derived access plan.',
);
assert.match(
  battleNavigation,
  /const queue = nodes\.filter\(\(node\) => this\.accessGroundCell\(node\) !== null\)/,
  'Wall-platform reachability must seed from every valid automatic or structural access node.',
);
assert.match(
  battleNavigation,
  /automaticAccessAt\(node\)[\s\S]*?groundX[\s\S]*?groundY/,
  'Automatic stair targets must resolve to their validated ground entry cell.',
);
assert.match(
  battleNavigation,
  /if \(this\.accessGroundCell\(node\)\) \{/,
  'Wall access routes must terminate at a generated or structural ground connection.',
);
assert.doesNotMatch(
  battleNavigation,
  /stairTowerAccessNodes|isCastleAccessKind|generatedAccess/,
  'BattleNavigation must not restore legacy stair-tower APIs or persisted access kinds.',
);
assert.doesNotMatch(
  battleSystem,
  /tryUseStairTowerToReach|tryUseStairTowerToDescend|tryMoveDefenderToWallPosition|WallAccessTransition|accessTransition/,
  'Battle runtime must use normal deployment routing instead of hidden stair-transition state.',
);

const attackVisibility = between(
  battleSystem,
  'private hasUnitAttackVisibility(',
  'private canTraverseGroundTransition(',
);
assert.match(
  attackVisibility,
  /kind === 'wall1'[\s\S]*?kind === 'wall2'[\s\S]*?kind === 'wall3'[\s\S]*?kind === 'tower'/,
  'Intact fortifications must continue blocking direct attack visibility.',
);
assert.match(
  attackVisibility,
  /breachedWalls\.has/,
  'Breached wall cells must stop blocking attack visibility.',
);
assert.match(
  attackVisibility,
  /kind === 'gate'[\s\S]*?gatePassable/,
  'Gate visibility must continue following runtime open/closed state.',
);

assert.match(
  battleSystem,
  /interface SiegeLadder/,
  'Enemy siege ladders must remain available as a separate attack mechanic.',
);
assert.match(
  battleSystem,
  /createLadderAttack/,
  'Automatic defender wall access must not remove siege ladder attacks.',
);

assert.doesNotMatch(
  threeGame,
  /wall-walkway|No Walkway|wallWalkway|const walkway = cell\.walkway \?\? false;/,
  'Wall walkway must no longer be player-configurable or rendered from a disabled legacy flag.',
);
assert.match(
  threeGame,
  /const activeWalkway = !partial;/,
  'Intact and non-breached wall geometry must always render a top walkway.',
);

assert.doesNotMatch(
  threeGame,
  /wall-battlement|No Battlement|wallBattlement|const battlement = !partial && \(cell\.battlement \?\? true\);/,
  'Wall battlements must no longer be player-configurable or rendered from a disabled legacy flag.',
);
assert.match(
  threeGame,
  /const battlement = !partial;/,
  'Intact and non-breached wall geometry must always render battlements.',
);
assert.doesNotMatch(
  threeGame,
  /battlement\s*:\s*false/,
  'Built-in wall templates must not create battlement-disabled wall cells.',
);
assert.match(
  gameState,
  /return \{ \.\.\.options, battlement: true, walkway: true \};/,
  'Runtime wall state must canonicalize battlements and walkways to enabled.',
);
assert.match(
  saveSystem,
  /battlement: migration\.kind === 'wall1' \|\| migration\.kind === 'wall2' \|\| migration\.kind === 'wall3' \? true : cell\.battlement,/,
  'Legacy saves with disabled battlements must normalize wall cells to enabled battlements.',
);

const detailVersionMatch = constants.match(/export const CASTLE_DETAIL_VERSION = (\d+);/);
assert.ok(detailVersionMatch, 'Castle detail generation version must be declared.');
assert.ok(
  Number(detailVersionMatch[1]) >= 2,
  'Automatic wall detail rule changes must advance the deterministic detail version.',
);

const saveVersionMatch = constants.match(/export const SAVE_VERSION = (\d+);/);
assert.ok(saveVersionMatch, 'Persistent save schema version must be declared.');
assert.ok(
  Number(saveVersionMatch[1]) >= 18,
  'Canonical wall persistence requires save schema version 18 or newer.',
);

console.log('Automatic wall detail/access navigation regression checks passed.');
