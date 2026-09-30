import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const threeGame = await readFile(new URL('../src/ThreeGame.ts', import.meta.url), 'utf8');
const types = await readFile(new URL('../src/core/types.ts', import.meta.url), 'utf8');
const saveSystem = await readFile(new URL('../src/core/SaveSystem.ts', import.meta.url), 'utf8');
const keepRenderer = await readFile(new URL('../src/rendering/KeepRenderer.ts', import.meta.url), 'utf8');
const materials = await readFile(new URL('../src/rendering/MedievalMaterials.ts', import.meta.url), 'utf8');
const visualStyle = await readFile(new URL('../src/rendering/TemplateVisualStyle.ts', import.meta.url), 'utf8');
const docs = await readFile(new URL('../docs/templates/himeji.md', import.meta.url), 'utf8');

assert.equal(html.split('data-template="himeji-castle"').length - 1, 1, 'Himeji must appear exactly once in the template picker.');
assert.match(html, /Himeji Castle · Japan/);
assert.match(html, /Choose from 33 complete starting worlds/);

assert.match(threeGame, /'himeji-castle': { layoutId: 'mainland', seed: 5801 }/);
assert.match(threeGame, /template === 'himeji-castle'/);
assert.match(visualStyle, /'himeji-castle': { stoneStyle: 'whitePlaster', towerBridgeKind: 'stone', family: 'medieval' }/);

assert.match(types, /\| 'japaneseTiered'/);
assert.match(types, /\| 'whitePlaster'/);
assert.match(saveSystem, /value === 'whitePlaster'/);
assert.match(threeGame, /<option value="whitePlaster">White Plaster<\/option>/);
assert.match(threeGame, /<option value="japaneseTiered">Japanese Tiered<\/option>/);
assert.match(materials, /japaneseRoofTile/);
assert.match(keepRenderer, /addJapaneseRoofTier/);
assert.match(keepRenderer, /architectureFamily = 'japanese-castle'/);

assert.match(threeGame, /const outerMoat: GridPoint\[\]/);
assert.match(threeGame, /rasterizeWallPath\(outerMoat, true\)/);
assert.match(threeGame, /const sangokuMoat: GridPoint\[\]/);
assert.match(threeGame, /placeWallPath\(outerDefense,[\s\S]*?true\);/);
assert.match(threeGame, /placeWallPath\(innerKeepDefense,[\s\S]*?true\);/);
assert.match(threeGame, /placeWallPath\(westBaileyDefense,[\s\S]*?true\);/);

assert.match(threeGame, /\[11, 17, 2\], \/\/ Hishi Gate/);
assert.match(threeGame, /\[16, 11, 3\], \/\/ Bizen Gate/);
assert.match(threeGame, /placeKeepTemplate\(14, 7, 3, 3, 6, 'japaneseTiered', false, 0, false\);/);
assert.ok(
  threeGame.split(/placeKeepTemplate\([^\n]+japaneseTiered/g).length - 1 >= 5,
  'Himeji should include the main tenshu, three subsidiary keeps, and the compressed Nishi-no-Maru.',
);
assert.match(threeGame, /const windingApproach: GridPoint\[\]/);
assert.match(threeGame, /rasterizeWallPath\(windingApproach\)/);

for (const source of [
  'whc.unesco.org/en/list/661',
  'whc.unesco.org/archive/advisory_body_evaluation/661.pdf',
  'himejicastle.jp/en/guide/history/',
  'himejicastle.jp/en/guide/photo/',
  'city.himeji.lg.jp/castle/0000007738.html',
  'city.himeji.lg.jp/castle/0000015616.html',
  'city.himeji.lg.jp/castle/0000015639.html',
  'city.himeji.lg.jp/castle/0000015648.html',
  'city.himeji.lg.jp/castle/0000015651.html',
]) {
  assert.ok(docs.includes(source), `Himeji source pack is missing ${source}`);
}
assert.match(docs, /present-day preserved core complex as documented in 2026/);
assert.match(docs, /Fidelity and scale compromises/);
assert.match(docs, /Matched-view comparison checklist/);

console.log('Himeji historic template contract checks passed.');
