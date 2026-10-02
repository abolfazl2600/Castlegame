import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [saveSystem, threeGame, gameMode, html] = await Promise.all([
  readFile(new URL('../src/core/SaveSystem.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/ThreeGame.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/core/GameMode.ts', import.meta.url), 'utf8'),
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
]);

assert.match(gameMode, /export type GameMode = 'unified'/);
assert.match(gameMode, /export const GAME_DEFINITION/);
assert.match(gameMode, /value === 'medieval'/);
assert.match(gameMode, /value === 'survival'/);
assert.match(gameMode, /value === 'sandbox'/);
assert.match(gameMode, /return 'unified'/);

assert.doesNotMatch(html, /id="game-mode-modal"/);
assert.doesNotMatch(html, /id="game-mode-button"/);
assert.doesNotMatch(html, /id="map-layout-modal"/);
assert.match(html, /id="templates-modal"/);
assert.match(html, /id="starting-map-layout-grid"/);
assert.match(html, /id="god-mode-button"/);
assert.match(html, /id="battle-endless"/);

assert.doesNotMatch(threeGame, /GAME_MODE_REGISTRY|createSurvivalDefinition|createSandboxDefinition/);
assert.doesNotMatch(threeGame, /openGameModeSelector|startNewGameWithMode|resetWorldForMode/);
assert.match(threeGame, /private openMapLayoutSelector\(\): void/);
assert.match(threeGame, /private startNewGame\(\): void/);
assert.match(threeGame, /this\.services\.state\.setGameMode\('unified'\)/);
assert.match(threeGame, /private startEndlessDefenseFromUI\(\): void/);
assert.match(threeGame, /private updateEndlessDefense\(deltaMs: number\): void/);
assert.match(threeGame, /godModeButton\.hidden = false/);

assert.match(saveSystem, /normalizeGameMode\(data\.gameMode\)/);
assert.match(saveSystem, /this\.host\.state\.setGameMode\(loadedMode\)/);

console.log('Unified game runtime and legacy save normalization checks passed.');
