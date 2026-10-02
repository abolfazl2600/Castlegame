import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const game = read('src/ThreeGame.ts');
const gameMode = read('src/core/GameMode.ts');
const state = read('src/state/GameState.ts');
const settlement = read('src/rendering/SettlementStyle.ts');
const population = read('src/systems/PopulationSystem.ts');
const economy = read('src/systems/EconomySystem.ts');
const docs = read('docs/visual-upgrade-language.md');

function between(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, 'Missing start marker: ' + startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, 'Missing end marker: ' + endMarker);
  return source.slice(start, end);
}

const residentialTools = between(game, "label: 'Residential',", "label: 'Economy',");
assert.match(residentialTools, /id: 'cottage'/, 'Level 1 must remain the residential build tool.');
assert.doesNotMatch(residentialTools, /id: 'house'|id: 'manor'|id: 'villa'/,
  'Higher residential levels must not be exposed as separate build tools.');
assert.match(residentialTools, /label: 'Residential District'/);
assert.match(residentialTools, /Cottage → House → Manor → Villa/);

const buildingGroup = gameMode.match(/\{ label: 'Buildings', toolIds: \[([^\]]+)\] \}/)?.[1] ?? '';
assert.ok(buildingGroup.includes("'cottage'"), 'Unified Buildings group must expose cottage.');
for (const oldKind of ["'house'", "'manor'", "'villa'"]) {
  assert.equal(buildingGroup.includes(oldKind), false,
    oldKind + ' must no longer be a normal build-panel tool.');
}

assert.match(game, /const RESIDENTIAL_LEVELS = \[[\s\S]*?Cottage Cluster[\s\S]*?House Cluster[\s\S]*?Manor[\s\S]*?Villa District[\s\S]*?\] as const;/);
assert.match(settlement, /RESIDENTIAL_LEVEL_KINDS = \['cottage', 'house', 'manor', 'villa'\]/);
assert.match(game, /RESIDENTIAL_LEVEL_KINDS\[residentialLevel - 1\]/,
  'Canonical residential levels must render through the four distinct silhouette layouts.');

const migration = between(game, 'private migrateKind(', 'private bindUI(): void {');
assert.match(migration, /kind === 'cottage'.*kind: 'cottage'.*RESIDENTIAL_MAX_LEVEL/s);
assert.match(migration, /kind === 'house'.*kind: 'cottage', level: 2/s);
assert.match(migration, /kind === 'manor'.*kind: 'cottage', level: 3/s);
assert.match(migration, /kind === 'villa'.*kind: 'cottage', level: 4/s);
assert.match(state, /kind === 'tower' \|\| kind === 'gate' \|\| kind === 'cottage'\) return Math\.min\(4, level\)/,
  'Canonical residence levels must be clamped to the four-level progression.');

assert.match(game, /id="residential-upgrade-card"/);
assert.match(game, /id="residential-upgrade-button"/);
assert.match(game, /private syncResidentialUpgradeUI\(\): void/);
const upgrade = between(game, 'private upgradeSelectedResidence(): void {', 'private syncAgricultureUpgradeUI(): void {');
assert.match(upgrade, /this\.recordHistory\(\)/, 'Residential upgrades must be undoable.');
assert.match(upgrade, /updateCell\(point\.x, point\.y, \{[\s\S]*?kind: 'cottage',[\s\S]*?level: nextLevel/,
  'An upgrade must preserve the same cell while canonicalizing kind+level.');
assert.match(upgrade, /this\.startConstruction\(/,
  'Residential upgrades must reuse construction feedback.');
assert.match(upgrade, /assetId: 'building\.upgrade'/,
  'Residential upgrades must reuse the shared upgrade sound.');

const shortcuts = between(game, 'const shortcutMap: Record<string, ToolKind> = {', '      };');
assert.match(shortcuts, /'7': 'cottage'/);
assert.doesNotMatch(shortcuts, /'8': 'house'|'9': 'manor'|'0': 'villa'/,
  'Old direct shortcuts must not bypass sequential progression.');

const templatePlace = between(game, 'const place = (', 'const placeKeepTemplate = (');
assert.match(templatePlace, /kind === 'house' \? 2/);
assert.match(templatePlace, /kind === 'manor' \? 3/);
assert.match(templatePlace, /kind === 'villa' \? 4/);
assert.match(templatePlace, /authoredResidentialLevel === null \? kind : 'cottage'/,
  'Authored templates must normalize old residential aliases into canonical state.');

assert.match(population, /RESIDENTIAL_LEVEL_CAPACITY = \[0, 18, 30, 42, 36\]/);
assert.match(population, /cell\.kind === 'cottage'[\s\S]*?cell\.level/,
  'Housing capacity must read the canonical residential level.');
assert.match(economy, /cell\.kind === 'cottage' && scaledLevel\(cell\) === 3/,
  'Level 3 must preserve the former Manor storage behavior.');

for (const [kind, marker] of [
  ['cottage', 'loose-low-hamlet'],
  ['house', 'dense-roof-block'],
  ['manor', 'formal-hall-and-wings'],
  ['villa', 'open-u-court'],
]) {
  assert.match(settlement, new RegExp(kind + ": \\{ massing: '" + marker + "'"),
    kind + ' must retain a distinct large-form silhouette.');
}
assert.match(game, /formal-manor-gate/);
assert.match(game, /corner-cupola-and-stone-court/);
assert.match(game, /Level 1 stays open;[\s\S]*?Level 2 is partially organized;[\s\S]*?Levels 3–4 gain formal compound edges/,
  'Residential tiers must differ in compound-scale enclosure, not only props or materials.');

assert.match(docs, /one four-step \*\*in-place gameplay upgrade line\*\*/);
assert.match(docs, /Only Level 1 is exposed as a normal residential build tool/);
assert.match(docs, /legacy saves\/templates using/);
assert.match(docs, /migrate to Levels 2, 3, and 4 respectively/);

console.log('Residential four-level in-place upgrade progression contract passed.');
