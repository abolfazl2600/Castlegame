import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const game = await readFile(new URL('../src/ThreeGame.ts', import.meta.url), 'utf8');
const css = await readFile(new URL('../src/style.css', import.meta.url), 'utf8');

const refreshStart = game.indexOf('private refreshBuildPanelForMode(): void {');
const filterStart = game.indexOf('private filterBuildTools(): void {', refreshStart);
const registerStart = game.indexOf('private registerBuiltInGameModes(): void {', filterStart);
assert.notEqual(refreshStart, -1);
assert.notEqual(filterStart, -1);
assert.notEqual(registerStart, -1);
const buildMethods = game.slice(refreshStart, registerStart);

assert.match(game, /private activeBuildCategory: string \| null = null;/);
assert.match(game, /class="build-category-tabs" role="tablist"/);
assert.match(game, /class="build-tool-sections"/);
assert.match(game, /id="build-search-clear"/);
assert.match(game, /class="build-inspect-button is-selected"/);
assert.match(game, /<span class="settings-section-title">Tool Options<\/span>/);
assert.match(game, /class="settings-section build-settings-section"/);
assert.doesNotMatch(game, /class="settings-section build-settings-section is-open"/);
assert.match(game, /aria-expanded="false"/);

for (const id of [
  'wall-thickness',
  'wall-battlement',
  'wall-walkway',
  'castle-stone-style',
  'tower-bridge-kind',
  'tower-shape',
  'tower-top',
  'keep-width',
  'keep-depth',
  'keep-floors',
  'keep-roof',
  'keep-corner-towers',
  'keep-battlements',
  'brush-size',
  'brush-strength',
  'move-up',
  'move-left',
  'move-down',
  'move-right',
  'rotate-selected',
  'undo-button',
  'redo-button',
  'select-clear',
]) {
  assert.ok(game.includes(`id="${id}"`), `Build sidebar redesign must preserve #${id}.`);
}

assert.match(buildMethods, /data-build-category/);
assert.match(buildMethods, /role="tabpanel"/);
assert.match(buildMethods, /matchingCategories = new Set<string>\(\)/);
assert.match(buildMethods, /toolbar\.classList\.toggle\('is-searching', searching\)/);
assert.match(buildMethods, /tab\.hidden = searching && !matchingCategories\.has\(categoryName\)/);
assert.match(game, /if \(tool !== null\) \{[\s\S]*?this\.activeBuildCategory = category\.label;/);

assert.doesNotMatch(buildMethods, /tool-category-header/);
assert.doesNotMatch(game, /No Build Tool Selected/);

assert.match(css, /\.tool-category-items \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
assert.match(css, /\.build-category-tabs \{[\s\S]*?overflow-x: auto/);
assert.match(css, /\.build-category-tab\.is-active/);
assert.match(css, /\.settings-section-items \{[\s\S]*?display: none/);
assert.match(css, /\.settings-section\.is-open \.settings-section-items \{ display: grid; \}/);
assert.match(css, /width: min\(92vw, 336px\)/);
assert.match(css, /\.tool-copy small \{ display: none; \}/);

console.log('Build sidebar UX regression checks passed.');
