import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [saveSystem, gameMode, threeGame] = await Promise.all([
  readFile(new URL('../src/core/SaveSystem.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/core/GameMode.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/ThreeGame.ts', import.meta.url), 'utf8'),
]);

assert.match(gameMode, /export type GameMode = 'unified'/);
assert.match(gameMode, /value === 'medieval'/);
assert.match(gameMode, /value === 'survival'/);
assert.match(gameMode, /value === 'sandbox'/);
assert.match(gameMode, /return 'unified'/);
assert.match(saveSystem, /const loadedMode: GameMode = normalizeGameMode\(data\.gameMode\)/);
assert.match(saveSystem, /this\.host\.state\.setGameMode\(loadedMode\)/);
assert.doesNotMatch(threeGame, /GAME_MODE_REGISTRY|createSurvivalDefinition|createSandboxDefinition/);
assert.match(threeGame, /this\.services\.state\.setGameMode\('unified'\)/);

console.log('Legacy mode saves normalize into the unified game.');
