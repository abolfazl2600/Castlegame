import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const threeGame = await readFile(new URL('../src/ThreeGame.ts', import.meta.url), 'utf8');
const types = await readFile(new URL('../src/core/types.ts', import.meta.url), 'utf8');
const gameMode = await readFile(new URL('../src/core/GameMode.ts', import.meta.url), 'utf8');
const wallPath = await readFile(new URL('../src/building/WallPath.ts', import.meta.url), 'utf8');
const basilica = await readFile(new URL('../src/rendering/BasilicaRenderer.ts', import.meta.url), 'utf8');
const visualStyle = await readFile(new URL('../src/rendering/TemplateVisualStyle.ts', import.meta.url), 'utf8');
const docs = await readFile(new URL('../docs/templates/carcassonne.md', import.meta.url), 'utf8');

assert.equal(
  html.split('data-template="carcassonne"').length - 1,
  1,
  'Carcassonne must appear once in the template picker.',
);
assert.equal([...html.matchAll(/data-template=\"[^\"]+\"/g)].length, 37, 'Template picker must preserve all 37 complete starting worlds.');
assert.ok(threeGame.includes("'carcassonne': { layoutId: 'mainland', seed: 5601 }"));
assert.ok(threeGame.includes("template === 'carcassonne'"));
assert.ok(
  visualStyle.includes(
    "'carcassonne': { stoneStyle: 'limestone', towerBridgeKind: 'stone', family: 'medieval' }",
  ),
);

assert.match(
  threeGame,
  /placeWallPath\(outerRampart,[\s\S]*?\}, true\);/,
  'Outer rampart must be emitted as a closed wall path.',
);
assert.match(
  threeGame,
  /placeWallPath\(innerRampart,[\s\S]*?\}, true\);/,
  'Inner rampart must be emitted as a closed wall path.',
);
assert.match(
  threeGame,
  /place\(19, 9, 'gate', 2\);[\s\S]*?place\(17, 9, 'gate', 3\);/,
  'Porte Narbonnaise must keep its outer and inner gates.',
);
assert.match(
  threeGame,
  /place\(3, 13, 'gate', 2\);[\s\S]*?place\(5, 13, 'gate', 3\);/,
  'Porte d\'Aude must keep its outer and inner gates.',
);
assert.ok(
  threeGame.includes("placeKeepTemplate(8, 10, 3, 3, 4, 'towered', true"),
  'Château Comtal keep placement must remain present.',
);
assert.ok(
  threeGame.includes("place(13, 12, 'basilica', 2"),
  'Saint-Nazaire basilica landmark must remain present.',
);
assert.ok(
  threeGame.includes("this.terrainOverrides.set(this.key(x, y), 'river')"),
  'The authored Aude river channel must remain present.',
);

assert.ok(types.includes("| 'basilica'"));
assert.ok(
  gameMode.split("'basilica'").length - 1 >= 2,
  'Basilica should remain available in the unified building ruleset.',
);
assert.match(gameMode, /export type GameMode = 'unified'/);
assert.doesNotMatch(gameMode, /GAME_MODE_CONFIG|survival:\s*\{|sandbox:\s*\{/);
assert.ok(threeGame.includes('new BasilicaRenderer(this.medievalMaterials)'));
assert.ok(basilica.includes("landmark = 'basilica'"));
assert.ok(basilica.includes('RingGeometry'));

assert.ok(wallPath.includes('every consecutive point is cardinally'));
assert.ok(wallPath.includes('export function rasterizeWallPath'));
assert.ok(wallPath.includes('closed = false'));

assert.ok(
  threeGame.includes('const wallPlanOutline = 0x3b3328;'),
  'Plan view must keep a high-contrast fortification outline.',
);
assert.ok(
  threeGame.split('wallPlanOutline').length - 1 >= 4,
  'Plan wall runs and towers must reuse the same high-contrast outline.',
);
assert.ok(
  threeGame.includes('terrainTile.renderOrder = 39;'),
  'Plan terrain must render below fortification geometry.',
);
assert.doesNotMatch(
  threeGame.slice(threeGame.indexOf('private renderPlanLayer'), threeGame.indexOf('const gridPoints: THREE.Vector3[]')),
  /\b0\.96\b/,
  'Plan terrain must stay opaque so transparent sorting cannot overpaint fortifications.',
);

for (const source of [
  'whc.unesco.org/en/list/345',
  'remparts-carcassonne.fr/en/discover/history-of-the-monument',
  'remparts-carcassonne.fr/en/discover/an-iconic-silhouette',
]) {
  assert.ok(docs.includes(source), `Historic source pack is missing ${source}`);
}
assert.ok(docs.includes('present-day fortified city as documented in 2025'));
assert.ok(docs.includes('Fidelity and scale compromises'));
assert.ok(docs.includes('Matched-view comparison checklist'));

console.log('Carcassonne historic template contract checks passed.');
