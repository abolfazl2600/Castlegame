import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const threeGame = await readFile(new URL('../src/ThreeGame.ts', import.meta.url), 'utf8');
const types = await readFile(new URL('../src/core/types.ts', import.meta.url), 'utf8');
const saveSystem = await readFile(new URL('../src/core/SaveSystem.ts', import.meta.url), 'utf8');
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

const templates = [
  ['mainland-frontier', 'mainland', '5501', 'Mainland Coast layout'],
  ['coastal-peninsula', 'peninsula', '5502', 'Peninsula layout'],
  ['split-isles', 'twin-isles', '5503', 'Twin Isles layout'],
];

for (const [id, layoutId, seed, description] of templates) {
  assert.equal(html.split(`data-template="${id}"`).length - 1, 1, `Template picker must register ${id} exactly once.`);
  assert.ok(html.includes(description), `${id} description must name its underlying map layout.`);
  assert.ok(
    threeGame.includes(`'${id}': { layoutId: '${layoutId}', seed: ${seed} }`),
    `${id} must own its map layout and deterministic seed.`,
  );
  assert.ok(threeGame.includes(`template === '${id}'`), `${id} needs a complete authored world branch.`);
}

assert.match(
  threeGame,
  /const authoredLayoutTemplate = PLAYABLE_LAYOUT_TEMPLATES\[template\];[\s\S]*?this\.worldSeed = authoredLayoutTemplate\.seed;[\s\S]*?this\.setMapLayoutId\(authoredLayoutTemplate\.layoutId\);/,
  'Applying an authored layout template must switch the whole-map silhouette and seed before generation.',
);

assert.match(
  threeGame,
  /const prepareBuildableArea = \([\s\S]*?baseTerrain === 'water' \|\| baseTerrain === 'shore'\) continue;/,
  'Template build preparation must not flatten water or coastline tiles.',
);

assert.match(
  threeGame,
  /template === 'split-isles'[\s\S]*?placeHarborTemplate\(3, 'transportShip'[\s\S]*?placeHarborTemplate\(4, 'transportShip'/,
  'Split Isles must provide transport-capable unified Harbor progression on both landmasses.',
);

assert.match(
  threeGame,
  /template === 'coastal-peninsula'[\s\S]*?for \(let x = 7; x <= 16; x \+= 1\)[\s\S]*?'wall1'/,
  'Coastal Peninsula must fortify the narrow landward approach.',
);

assert.match(types, /worldSeed\?: number;/, 'Saved worlds must carry a deterministic seed.');
assert.match(saveSystem, /worldSeed: this\.host\.getWorldSeed\(\)/, 'Save data must persist the world seed.');
assert.match(saveSystem, /this\.host\.setWorldSeed\(normalizeWorldSeed\(data\.worldSeed\)\)/, 'Loading must restore the world seed.');
assert.match(saveSystem, /return Number\.isFinite\(numeric\) \? Math\.trunc\(numeric\) : 0;/, 'Legacy saves must default to the original zero seed.');
assert.match(html, /Choose from 32 complete starting worlds/, 'Template count must include the current complete starting worlds.');

console.log('Playable layout template regression checks passed.');
