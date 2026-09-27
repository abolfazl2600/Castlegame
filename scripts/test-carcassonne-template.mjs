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

assert.equal(html.split('data-template="carcassonne"').length - 1, 1, 'Carcassonne must appear once in the template picker.');
assert.match(html, /Choose from 32 complete starting worlds/);
assert.match(threeGame, /'carcassonne': { layoutId: 'mainland', seed: 5601 }/);
assert.match(threeGame, /template === 'carcassonne'/);
assert.match(visualStyle, /'carcassonne': { stoneStyle: 'limestone', towerBridgeKind: 'stone', family: 'medieval' }/);

assert.match(threeGame, /placeWallPath(outerRampart,[sS]*?true);/);
assert.match(threeGame, /placeWallPath(innerRampart,[sS]*?true);/);
assert.match(threeGame, /place(19, 9, 'gate', 2);[sS]*?place(17, 9, 'gate', 3);/);
assert.match(threeGame, /place(3, 13, 'gate', 2);[sS]*?place(6, 13, 'gate', 3);/);
assert.match(threeGame, /placeKeepTemplate(8, 10, 3, 3, 4, 'towered', true/);
assert.match(threeGame, /place(13, 12, 'basilica', 2/);
assert.match(threeGame, /this.terrainOverrides.set(this.key(x, y), 'river')/);

assert.match(types, /| 'basilica'/);
assert.ok(gameMode.split("'basilica'").length - 1 >= 4, 'Basilica should be available in medieval-capable building groups.');
assert.match(threeGame, /new BasilicaRenderer(this.medievalMaterials)/);
assert.match(basilica, /landmark = 'basilica'/);
assert.match(basilica, /RingGeometry/);

assert.match(wallPath, /every consecutive point is cardinally/);
assert.match(wallPath, /export function rasterizeWallPath/);
assert.match(wallPath, /closed = false/);

for (const source of [
  'whc.unesco.org/en/list/345',
  'remparts-carcassonne.fr/en/discover/history-of-the-monument',
  'remparts-carcassonne.fr/en/discover/an-iconic-silhouette',
]) {
  assert.ok(docs.includes(source), `Historic source pack is missing ${source}`);
}
assert.match(docs, /present-day fortified city as documented in 2025/);
assert.match(docs, /Fidelity and scale compromises/);
assert.match(docs, /Matched-view comparison checklist/);

console.log('Carcassonne historic template contract checks passed.');
