import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [
  threeGame,
  battleSystem,
  battleNavigation,
  gameMode,
  gameDomainServices,
] = await Promise.all([
  readFile(new URL('../src/ThreeGame.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/battle/BattleSystem.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/battle/BattleNavigation.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/core/GameMode.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/core/GameDomainServices.ts', import.meta.url), 'utf8'),
]);

function between(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `Missing start marker: ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `Missing end marker: ${endMarker}`);
  return source.slice(start, end);
}

assert.doesNotMatch(
  gameDomainServices,
  /CastleAccessSystem|castleAccessSystem/,
  'Automatic CastleAccessSystem must not be part of runtime services.',
);

assert.doesNotMatch(
  threeGame,
  /GeneratedAccess|getGeneratedCastleAccess|makeGeneratedAccess|makeStairTower|makeAccess\(/,
  'ThreeGame must not generate or render wall-connected stair/ramp/ladder structures.',
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
    `${removed} must not remain a runtime building kind.`,
  );
}

const medievalBuildings = between(
  gameMode,
  'const MEDIEVAL_BUILDINGS: readonly TileKind[] = [',
  'const COMMON_WORLD_TOOLS',
);
for (const removed of ['stoneStairs', 'woodenStairs', 'ramp', 'ladder']) {
  assert.doesNotMatch(
    medievalBuildings,
    new RegExp(`['"]${removed}['"]`),
    `${removed} must not be exposed by game modes.`,
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
    `Legacy ${removed} saves must be discarded during migration.`,
  );
}
assert.match(
  migration,
  /\) return null;/,
  'Legacy wall-access cells must migrate to no structure.',
);

assert.doesNotMatch(
  battleSystem,
  /generatedAccess\??:/,
  'BattleWorldContext must not expose generated wall access.',
);
assert.doesNotMatch(
  battleSystem,
  /generatedAccess:\s*world\.generatedAccess/,
  'BattleSystem must not forward generated wall access into navigation.',
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
    `${removed} must not create special ground walkability.`,
  );
}

assert.doesNotMatch(
  battleNavigation,
  /stairTowerAccessNodes|isCastleAccessKind|generatedAccess/,
  'BattleNavigation must not expose any wall stair access API.',
);
assert.doesNotMatch(
  battleSystem,
  /tryUseStairTowerToReach|tryUseStairTowerToDescend|tryMoveDefenderToWallPosition|WallAccessTransition|accessTransition/,
  'Battle runtime must not keep hidden ground-to-wall stair transitions.',
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
  'Enemy siege ladders must remain available as an attack mechanic.',
);
assert.match(
  battleSystem,
  /createLadderAttack/,
  'Removing wall architecture stairs must not remove siege ladder attacks.',
);

assert.match(
  threeGame,
  /const walkway = cell\.walkway \?\? false;/,
  'Wall walkway visuals must remain independently selectable on wall cells.',
);

console.log('Wall-connected access removal/navigation regression checks passed.');
