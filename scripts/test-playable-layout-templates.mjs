import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const threeGame = await readFile(new URL('../src/ThreeGame.ts', import.meta.url), 'utf8');
const types = await readFile(new URL('../src/core/types.ts', import.meta.url), 'utf8');
const saveSystem = await readFile(new URL('../src/core/SaveSystem.ts', import.meta.url), 'utf8');
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

const templates = [
  ['urban-city-60x80', 'urban-60x80', '6001', '60×80 world units: connected streets, central square, homes, market, parks, and farms.'],
  ['royal-valley-50x89', 'royal-valley-50x89', '5089', '50×89 tiles: royal fortress, river crossing, village, farms, forests, mountain resources, army camps, and working harbors.'],
  ['mainland-frontier', 'mainland', '5501', 'Coast, fortified town, farms, roads, camp, and pier.'],
  ['coastal-peninsula', 'peninsula', '5502', 'Narrow peninsula, cross-wall, town, farms, and harbors.'],
  ['split-isles', 'twin-isles', '5503', 'Castle island + village island with sea transport.'],
  ['arg-e-bam', 'mainland', '5701', 'Historic Iran · earthen citadel, bazaar axis, and raised governor keep.'],
  ['himeji-castle', 'himeji-46x90', '5801', 'Historic Japan · 46×90 castle ground, white tiered keep, layered baileys, moats, and winding approach.'],
];

for (const [id, layoutId, seed, description] of templates) {
  assert.equal(html.split(`data-template="${id}"`).length - 1, 1, `Template picker must register ${id} exactly once.`);
  assert.ok(html.includes(description), `${id} description must match its picker card.`);
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

assert.match(
  threeGame,
  /template === 'royal-valley-50x89'[\s\S]*?addTemplateBridge[\s\S]*?placeHarborTemplate\(4, 'tradingBoat'[\s\S]*?placeHarborTemplate\(2, 'fishingBoat'/,
  'Royal Valley must exercise the bridge and unified harbor systems.',
);
assert.match(
  threeGame,
  /template === 'royal-valley-50x89'[\s\S]*?'farm'[\s\S]*?'mine'[\s\S]*?'armyCamp'/,
  'Royal Valley must include military, resource, and agricultural gameplay.',
);

assert.match(types, /worldSeed\?: number;/, 'Saved worlds must carry a deterministic seed.');
assert.match(saveSystem, /worldSeed: this\.host\.getWorldSeed\(\)/, 'Save data must persist the world seed.');
assert.match(saveSystem, /this\.host\.setWorldSeed\(normalizeWorldSeed\(data\.worldSeed\)\)/, 'Loading must restore the world seed.');
assert.match(saveSystem, /return Number\.isFinite\(numeric\) \? Math\.trunc\(numeric\) : 0;/, 'Legacy saves must default to the original zero seed.');
assert.equal([...html.matchAll(/data-template="[^"]+"/g)].length, 37, 'Template picker must include all current starting worlds.');

console.log('Playable layout template regression checks passed.');
