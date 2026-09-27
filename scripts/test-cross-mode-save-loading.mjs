import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [saveSystem, threeGame, gameMode] = await Promise.all([
  readFile(new URL('../src/core/SaveSystem.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/ThreeGame.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/core/GameMode.ts', import.meta.url), 'utf8'),
]);

function between(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `Missing start marker: ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `Missing end marker: ${endMarker}`);
  return source.slice(start, end);
}

const hostInterface = between(
  saveSystem,
  'export interface SaveLoadHost {',
  'interface RawSave {',
);

assert.match(
  hostInterface,
  /isBuildingAvailableForMode\(mode: GameMode, kind: string\): boolean;/,
  'Save loading must expose a mode-aware building availability check.',
);
assert.doesNotMatch(
  hostInterface,
  /isBuildingAvailable\(kind: string\): boolean;/,
  'Save loading must not rely on the pre-load runtime mode.',
);

const applyData = between(
  saveSystem,
  'private applyData(data: SavedGame): void {',
  'private validateRecord(',
);

assert.match(
  applyData,
  /const loadedMode: GameMode = isGameMode\(data\.gameMode\) \? data\.gameMode : 'medieval';/,
  'Save loading must resolve the saved game mode before restoring cells.',
);
assert.match(
  applyData,
  /this\.host\.isBuildingAvailableForMode\(loadedMode, migration\.kind\)/,
  'Every restored cell must be validated against loadedMode.',
);
assert.doesNotMatch(
  applyData,
  /this\.host\.isBuildingAvailable\(migration\.kind\)/,
  'Restored cells must never be filtered through the current runtime mode.',
);
assert.ok(
  applyData.indexOf('isBuildingAvailableForMode(loadedMode, migration.kind)') <
    applyData.indexOf('this.host.state.setGameMode(loadedMode)'),
  'Mode-aware validation must not require mutating state before cell validation.',
);

const applyRecord = between(
  saveSystem,
  'private applyRecord(record: SaveRecord): boolean {',
  'private applyData(data: SavedGame): void {',
);
assert.match(
  applyRecord,
  /const backup = this\.createData\(\);[\s\S]*?this\.applyData\(record\.data\);[\s\S]*?catch[\s\S]*?this\.applyData\(backup\);/,
  'Cross-mode loading must preserve the existing rollback path.',
);

const saveHost = between(
  threeGame,
  'this.saveSystem = new SaveSystem({',
  'this.riverTexture = this.createRiverTexture();',
);
assert.match(
  saveHost,
  /isBuildingAvailableForMode:\s*\(mode, kind\)\s*=>\s*isBuildingAvailable\(mode, kind as TileKind\)/,
  'ThreeGame must validate save cells using the explicitly supplied mode.',
);

const modern = between(
  gameMode,
  '  modern: {',
  '  sandbox: {',
);
assert.match(
  modern,
  /availableBuildingKinds:\s*\['futuristicCastle','tree','rock','mountain'\]/,
  'Modern saves must accept futuristicCastle.',
);
assert.doesNotMatch(
  modern,
  /availableBuildingKinds:[^\n]*'wall1'/,
  'Modern mode must continue rejecting medieval wall cells.',
);

const medieval = between(
  gameMode,
  '  medieval: {',
  '  survival: {',
);
assert.match(
  medieval,
  /availableBuildingKinds:\s*\[\.\.\.MEDIEVAL_BUILDINGS, 'tree','rock','mountain'\]/,
  'Medieval saves must continue accepting representative medieval structures.',
);

const medievalBuildings = between(
  gameMode,
  'const MEDIEVAL_BUILDINGS:',
  'const COMMON_WORLD_TOOLS:',
);
assert.match(
  medievalBuildings,
  /'wall1'/,
  'The inverse Modern -> Medieval regression requires a representative medieval building.',
);
assert.doesNotMatch(
  medievalBuildings,
  /'futuristicCastle'/,
  'Medieval mode must continue rejecting futuristicCastle.',
);

console.log('Cross-mode save loading regression checks passed.');
