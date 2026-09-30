import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const threeGame = await readFile(new URL('../src/ThreeGame.ts', import.meta.url), 'utf8');
const types = await readFile(new URL('../src/core/types.ts', import.meta.url), 'utf8');
const gameMode = await readFile(new URL('../src/core/GameMode.ts', import.meta.url), 'utf8');
const saveSystem = await readFile(new URL('../src/core/SaveSystem.ts', import.meta.url), 'utf8');
const visualStyle = await readFile(new URL('../src/rendering/TemplateVisualStyle.ts', import.meta.url), 'utf8');
const castleStyle = await readFile(new URL('../src/rendering/CastleArchitectureStyle.ts', import.meta.url), 'utf8');
const materials = await readFile(new URL('../src/rendering/MedievalMaterials.ts', import.meta.url), 'utf8');
const docs = await readFile(new URL('../docs/templates/arg-e-bam.md', import.meta.url), 'utf8');

assert.equal(html.split('data-template="arg-e-bam"').length - 1, 1, 'Arg-e Bam must appear once in the template picker.');
assert.ok(html.includes('Arg-e Bam · Iran'), 'Template card must name Arg-e Bam and Iran.');
assert.ok(html.includes('Pre-2003 earthen citadel'), 'Template card must state the selected historical reference period.');

assert.ok(
  threeGame.includes("'arg-e-bam': { layoutId: 'mainland', seed: 5701 }"),
  'Arg-e Bam must own a deterministic authored mainland layout.',
);
assert.ok(threeGame.includes("template === 'arg-e-bam'"), 'Arg-e Bam needs a complete authored world branch.');
assert.ok(
  visualStyle.includes("'arg-e-bam': { stoneStyle: 'earthen', towerBridgeKind: 'wood', family: 'medieval' }"),
  'Arg-e Bam must use the shared earthen visual family.',
);

assert.ok(types.includes("| 'mosque'"), 'The reusable mosque building kind must be part of TileKind.');
assert.ok(types.includes("| 'earthen'"), 'StoneStyle must expose the reusable earthen family.');
assert.ok(gameMode.includes("'mosque'"), 'Mosque must be available in medieval-capable game modes.');
assert.ok(saveSystem.includes("value === 'earthen'"), 'Save/load validation must preserve earthen stone style.');
assert.ok(castleStyle.includes('earthen: {'), 'Castle architecture palette must define earthen colors.');
assert.ok(materials.includes('createEarthenTexture'), 'Earthen fortifications must use a dedicated adobe-like texture path.');

assert.ok(threeGame.includes('const bamOuterRampart: GridPoint[]'), 'Template must author the outer enclosure.');
assert.ok(threeGame.includes('const bamCitadelRampart: GridPoint[]'), 'Template must author the separate governor citadel.');
assert.ok(threeGame.includes("place(11, 19, 'gate', 3"), 'Template must include the southern principal gate.');
assert.ok(threeGame.includes("place(8, 13, 'mosque', 2"), 'Template must include a dedicated mosque landmark.');
assert.ok(
  threeGame.includes("placeKeepTemplate(11, 7, 3, 3, 4, 'flatBattlement', true"),
  'Template must include the raised governor residence/citadel mass.',
);
assert.ok(threeGame.includes('const bamMoat: GridPoint[]'), 'Template must author the perimeter dry moat.');
assert.ok(threeGame.includes("place(point.x, point.y, 'moat')"), 'Authored moat cells must remain normal editable state.');
assert.ok(threeGame.includes('const earthen = this.stoneStyle === \'earthen\';'), 'Residential renderer must react to earthen style.');
assert.ok(threeGame.includes("'layout-arid-ground'"), 'Earthen style must replace the green plains top with arid ground.');
assert.ok(threeGame.includes("'arid-scrub'"), 'Earthen plains must use sparse dry environmental detail.');
assert.ok(threeGame.includes("'terrain-elev-arid'"), 'Raised citadel terrain must remain dry instead of using green elevation caps.');
assert.ok(threeGame.includes("group.userData.landmark = 'courtyard-mosque'"), 'Mosque renderer must expose a stable landmark contract.');

for (const source of [
  'whc.unesco.org/en/list/1208',
  'whc.unesco.org/uploads/nominations/1208bis.pdf',
  'dsr.nii.ac.jp/bam/plan/index.html.en',
  'dsr.nii.ac.jp/bam/before-after.html.en',
  'dsr.nii.ac.jp/bam/collection/000131-000135.html.en',
  'www.nii.ac.jp/pi/n5/5_99.pdf',
]) {
  assert.ok(docs.includes(source), `Historic source pack is missing ${source}`);
}

assert.match(docs, /pre-earthquake reference state immediately before 26 December 2003/);
assert.match(docs, /38 watch-towers/);
assert.match(docs, /10–15 m perimeter moat/);
assert.match(docs, /Fidelity and scale compromises/);
assert.match(docs, /Feature-by-feature fidelity checklist/);
assert.match(docs, /Matched-view comparison checklist/);

console.log('Arg-e Bam historic template contract checks passed.');
