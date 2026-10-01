import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const threeGame = await readFile(new URL('../src/ThreeGame.ts', import.meta.url), 'utf8');
const visualStyle = await readFile(new URL('../src/rendering/TemplateVisualStyle.ts', import.meta.url), 'utf8');
const docs = await readFile(new URL('../docs/templates/crac-des-chevaliers.md', import.meta.url), 'utf8');

assert.equal(html.split('data-template="crac-des-chevaliers"').length - 1, 1);
assert.equal([...html.matchAll(/data-template=\"[^\"]+\"/g)].length, 34, 'Template picker must preserve all 34 complete starting worlds.');
assert.match(threeGame, /'crac-des-chevaliers': { layoutId: 'mainland', seed: 5901 }/);
assert.match(threeGame, /template === 'crac-des-chevaliers'/);
assert.match(visualStyle, /'crac-des-chevaliers': { stoneStyle: 'limestone', towerBridgeKind: 'stone', family: 'medieval' }/);

for (const marker of [
  'const outerEnceinte',
  'const innerEnceinte',
  "placeWallPath(outerEnceinte, 'wall1', 2",
  "placeWallPath(innerEnceinte, 'wall3', 4",
  "place(19, 9, 'gate', 2",
  "place(17, 9, 'gate', 4",
  "placeKeepTemplate(10, 12, 3, 3, 5",
  "place(12, 8, 'basilica', 1",
  'const southBarbican',
  "this.terrainOverrides.set(this.key(x, 17), 'river')",
]) assert.ok(threeGame.includes(marker), 'Missing Crac template marker: ' + marker);

assert.match(threeGame, /rasterizeWallPath\(route\)/);

for (const source of [
  'whc.unesco.org/en/list/1229',
  'archeologie.culture.gouv.fr/crac-chevaliers/en/about-castle',
  'archeologie.culture.gouv.fr/crac-chevaliers/en/strengthening-fortifications-13th-century',
  'archeologie.culture.gouv.fr/crac-chevaliers/en/final-construction-phase',
  'commons.wikimedia.org/wiki/File:Krak_des_chevaliers_-_plan.jpg',
]) assert.ok(docs.includes(source), 'Missing historic source: ' + source);

assert.match(docs, /mid-13th-century Hospitaller final construction phase/i);
assert.match(docs, /does not include later Mamluk architectural additions/i);
assert.match(docs, /Fidelity and scale compromises/);
assert.match(docs, /Matched-view comparison checklist/);

console.log('Crac des Chevaliers historic template contract checks passed.');
