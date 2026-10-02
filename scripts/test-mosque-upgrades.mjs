import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

const game = read('src/ThreeGame.ts');
const state = read('src/state/GameState.ts');
const save = read('src/core/SaveSystem.ts');
const docs = read('docs/visual-upgrade-language.md');

function between(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, 'Missing start marker: ' + startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, 'Missing end marker: ' + endMarker);
  return source.slice(start, end);
}

assert.match(
  game,
  /const MOSQUE_LEVELS = \[[\s\S]*?Basic Mosque[\s\S]*?Improved Mosque[\s\S]*?Grand Mosque[\s\S]*?Monumental Mosque[\s\S]*?\] as const;/,
  'Mosque must define exactly four named architectural levels.',
);
assert.match(game, /const MOSQUE_MAX_LEVEL = MOSQUE_LEVELS\.length;/);

const tool = between(game, "{ id: 'mosque'", "{ id: 'mine'");
assert.match(tool, /Upgradeable landmark · 4 architectural levels/);

assert.match(
  state,
  /kind === 'tower' \|\| kind === 'gate' \|\| kind === 'cottage' \|\| kind === 'mosque'\) return Math\.min\(4, level\)/,
  'Mosque state must clamp to Levels 1–4.',
);

const rendererDispatch = between(game, "else if (cell.kind === 'mosque')", "else if (cell.kind === 'windmill')");
assert.match(rendererDispatch, /cell\.level \?\? 1/,
  'Existing Mosques without level data must render safely as Level 1.');
assert.match(rendererDispatch, /MOSQUE_MAX_LEVEL/);

const renderer = between(game, 'private makeMosque(', 'private residentialLevelForCell');
assert.match(renderer, /upgradeVisualProfile\(safeLevel\)/,
  'Mosque levels must participate in the shared mobile-aware visual progression budget.');
assert.match(renderer, /safeLevel === 1[\s\S]*?addDome/);
assert.match(renderer, /safeLevel === 2[\s\S]*?addMinaret/);
assert.match(renderer, /safeLevel >= 3[\s\S]*?formal-courtyard/);
assert.match(renderer, /safeLevel >= 4[\s\S]*?monumental-mosque/);
assert.match(renderer, /safeLevel === 3 \? 2\.75 : 3\.45/,
  'Upper Mosque levels need a clearly taller minaret silhouette.');
assert.match(renderer, /safeLevel === 3 \? 0\.78 : 0\.98/,
  'Level 4 must gain a larger landmark central dome.');
assert.match(renderer, /SphereGeometry\(radius, safeLevel >= 4 \? 14 : 10, 7/,
  'Dome geometry must stay bounded for mobile rendering.');
assert.doesNotMatch(renderer, /new THREE\.PointLight|new THREE\.SpotLight/,
  'Mosque progression must not add expensive dynamic lights.');

assert.match(game, /id="mosque-upgrade-card"/);
assert.match(game, /data-mosque-level="1"/);
assert.match(game, /data-mosque-level="4"/);
assert.match(game, /id="mosque-upgrade-button"/);
assert.match(game, /get<HTMLButtonElement>\('mosque-upgrade-button'\)\.onclick = \(\) => this\.upgradeSelectedMosque\(\);/);

const upgrade = between(game, 'private upgradeSelectedMosque(): void {', 'private syncCarpenterUpgradeUI(): void {');
assert.match(upgrade, /this\.recordHistory\(\)/,
  'Mosque upgrades must be undoable.');
assert.match(upgrade, /this\.services\.state\.setLevel\(point\.x, point\.y, nextLevel\)/,
  'Mosque upgrades must transform the existing cell in place.');
assert.match(upgrade, /this\.startConstruction\(/,
  'Mosque upgrades must reuse visible construction feedback.');
assert.match(upgrade, /assetId: 'building\.upgrade'/,
  'Mosque upgrades must reuse the shared building-upgrade sound.');
assert.match(upgrade, /this\.scheduleSave\(\)/,
  'Mosque upgrades must persist through the existing save pipeline.');

const sync = between(game, 'private syncMosqueUpgradeUI(): void {', 'private upgradeSelectedMosque(): void {');
assert.match(sync, /level < MOSQUE_MAX_LEVEL/);
assert.match(sync, /button\.disabled = !next \|\| this\.battleSystem\.isActive\(\)/);
assert.match(sync, /Maximum Level/);

assert.match(save, /cells: this\.host\.state\.entries\(\)/,
  'SaveSystem must serialize cell level state.');
assert.match(save, /this\.host\.state\.replace\(/,
  'SaveSystem must restore cell level state.');

assert.match(docs, /Mosque progression/);
assert.match(docs, /Basic Mosque → Improved Mosque → Grand Mosque → Monumental Mosque/);

console.log('Mosque four-level upgrade progression contract passed.');
