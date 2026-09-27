import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [saveSystem, threeGame] = await Promise.all([
  readFile(new URL('../src/core/SaveSystem.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/ThreeGame.ts', import.meta.url), 'utf8'),
]);

function between(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `Missing start marker: ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `Missing end marker: ${endMarker}`);
  return source.slice(start, end);
}

const hostContract = between(
  saveSystem,
  'export interface SaveLoadHost',
  'interface RawSave',
);
assert.match(
  hostContract,
  /syncModeDependentUI\(\): void;/,
  'SaveSystem host must expose one authoritative mode-dependent UI synchronization hook.',
);

const applyData = between(
  saveSystem,
  'private applyData(data: SavedGame): void {',
  'private validateRecord(',
);
const setModeIndex = applyData.indexOf('this.host.state.setGameMode(loadedMode);');
const syncUiIndex = applyData.indexOf('this.host.syncModeDependentUI();');
assert.notEqual(setModeIndex, -1, 'Save load must restore the saved game mode.');
assert.notEqual(syncUiIndex, -1, 'Save load must synchronize mode-dependent UI.');
assert.ok(
  setModeIndex < syncUiIndex,
  'Mode-dependent UI must be synchronized only after the loaded mode is active.',
);
assert.doesNotMatch(
  applyData,
  /this\.host\.updateGameModeUI\(\);[\s\S]*this\.host\.syncTemplateAvailability\(\);/,
  'SaveSystem must not partially synchronize mode UI with separate label/template hooks.',
);

const saveHost = between(
  threeGame,
  'this.saveSystem = new SaveSystem({',
  'this.riverTexture = this.createRiverTexture();',
);
assert.match(
  saveHost,
  /syncModeDependentUI:\s*\(\)\s*=>\s*this\.syncModeDependentUI\(\)/,
  'ThreeGame must wire SaveSystem to the centralized mode UI synchronization method.',
);

const modeSync = between(
  threeGame,
  'private syncModeDependentUI(): void {',
  'private refreshBuildPanelForMode(): void {',
);
assert.match(
  modeSync,
  /this\.selectedTool !== null && !this\.isToolAvailable\(this\.selectedTool\)/,
  'Cross-mode synchronization must detect a stale selected tool.',
);
assert.match(
  modeSync,
  /this\.selectedTool = null;/,
  'A stale selected tool must be cleared.',
);
assert.match(modeSync, /this\.updateGameModeUI\(\);/, 'Mode label and Battle visibility must be synchronized.');
assert.match(modeSync, /this\.syncTemplateAvailability\(\);/, 'Template visibility must be synchronized.');
assert.match(modeSync, /this\.refreshBuildPanelForMode\(\);/, 'Build panel must be rebuilt for the active mode.');

const toolbarRefresh = between(
  threeGame,
  'private refreshBuildPanelForMode(): void {',
  'private registerBuiltInGameModes(): void {',
);
assert.match(
  toolbarRefresh,
  /querySelectorAll<HTMLElement>\('\.tool-category'\)\.forEach\(\(category\) => category\.remove\(\)\)/,
  'Toolbar refresh must replace stale categories rather than append duplicates.',
);
assert.match(
  toolbarRefresh,
  /querySelectorAll<HTMLButtonElement>\('\[data-tool\]'\)\.forEach/,
  'Toolbar refresh must rebind tool click handlers after rebuilding buttons.',
);
assert.match(
  toolbarRefresh,
  /noneButton\?\.classList\.toggle\('is-selected', this\.selectedTool === null\)/,
  'Toolbar neutral selection state must follow the normalized selected tool.',
);

const modeReset = between(
  threeGame,
  'private resetWorldForMode(mode: GameMode): void {',
  'private startNewGameWithMode(mode: GameMode): void {',
);
assert.match(
  modeReset,
  /this\.syncModeDependentUI\(\);/,
  'Normal mode changes and save loads must share the same mode UI synchronization path.',
);

console.log('Save mode UI synchronization regression checks passed.');
