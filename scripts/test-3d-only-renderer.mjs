import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [
  threeGame,
  html,
  selectionVisual,
  worldStyle,
  main,
  settingsUI,
  faRuntime,
  faHelp,
] = await Promise.all([
  readFile(new URL('../src/ThreeGame.ts', import.meta.url), 'utf8'),
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../src/selection/SelectionVisual.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/rendering/WorldStyle.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/main.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/settings/SettingsUI.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/i18n/faRuntime.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/i18n/faHelp.ts', import.meta.url), 'utf8'),
]);

for (const [name, source] of [
  ['ThreeGame', threeGame],
  ['index.html', html],
  ['SelectionVisual', selectionVisual],
  ['WorldStyle', worldStyle],
  ['SettingsUI', settingsUI],
  ['faRuntime', faRuntime],
  ['faHelp', faHelp],
]) {
  assert.doesNotMatch(source, /\bplan2d\b|2D Plan|view-2d-button|view-3d-button/, `${name} must not expose the retired 2D gameplay path.`);
}

assert.doesNotMatch(threeGame, /\bViewMode\b|setViewMode\(|updateViewModeUI\(|renderPlanLayer\(|private readonly planLayer/, 'ThreeGame must have one production renderer path.');
assert.doesNotMatch(selectionVisual, /planMode/, 'Selection feedback must be world-space 3D only.');
assert.doesNotMatch(worldStyle, /planDistance/, 'Camera configuration must not retain a 2D plan distance.');
assert.match(html, /id="camera-45-button"/, 'The 45-degree 3D camera preset must remain available.');
assert.match(html, /id="camera-top-button"/, 'The top-down 3D camera preset must remain available.');
assert.match(main, /3D renderer initialization failed · Reload or check WebGL support/, '3D startup failures must be explicit instead of falling back to 2D.');
assert.match(main, /new ThreeGame\(gameRoot, settingsStore\)/, 'The application must initialize the Three.js runtime directly.');

console.log('3D-only renderer contract checks passed.');
