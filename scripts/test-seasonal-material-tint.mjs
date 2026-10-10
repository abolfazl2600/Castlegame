import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { SeasonalMaterialTint } from '../src/rendering/SeasonalMaterialTint.ts';
import { EnvironmentSystem } from '../src/systems/EnvironmentSystem.ts';

const palette = new SeasonalMaterialTint();
const environment = new EnvironmentSystem();
const samples = [
  ['layout-grass', 0x8fb560, 'grass', 0.78],
  ['terrain-elev-grass', 0x91aa57, 'grass', 0.72],
  ['grass-forest-0', 0x597e38, 'foliage', 0.70],
  ['farm-crop-green', 0x7fba4f, 'crop', 0.88],
  ['farm-crop-gold', 0xc4a04a, 'crop', 0.62],
  ['tree-foliage-0', 0x387b39, 'foliage', 0.90],
];
const materials = samples.map(([key, base]) => {
  const material = new THREE.MeshStandardMaterial({ color: base });
  palette.register(material, base);
  return { key, material, base };
});
function applyAt(progress, force = false) {
  environment.setState({ cycleDays: 48, day: 0, progress });
  const state = environment.visualState();
  for (let i = 0; i < samples.length; i += 1) {
    const [key, , component, strength] = samples[i];
    const material = materials[i].material;
    palette.apply(material, state[component], strength, force ? 1 : 0.08);
  }
}
function colors() { return materials.map(({ material }) => material.color.getHex()); }
function desiredAt(progress) {
  environment.setState({ cycleDays: 48, day: 0, progress });
  const state = environment.visualState();
  return materials.map(({ material }, i) => {
    const component = samples[i][2], strength = samples[i][3];
    return palette.target(material, state[component], strength).getHex();
  });
}

applyAt(0, true);
const spring = colors();
assert.deepEqual(spring, desiredAt(0), 'initial forced refresh uses authored tint strength');
for (let i = 0; i < 2000; i += 1) applyAt(0);
assert.deepEqual(colors(), spring,
  'repeating ordinary refreshes with unchanged environment must never compound seasonal tint');

applyAt(0.76, true);
const winter = colors();
assert.deepEqual(winter, desiredAt(0.76));
for (let i = 0; i < 750; i += 1) applyAt(0.76);
assert.deepEqual(colors(), winter, 'winter color must be independent of refresh count');

for (const progress of [0.19, 0.48, 0.72, 0.82, 0.1, 0.51, 0.99, 0.12]) {
  for (let i = 0; i < 40; i += 1) applyAt(progress);
}
applyAt(0, true);
assert.deepEqual(colors(), spring, 'full season cycle must reproduce the original spring colors exactly');

applyAt(0.76, true);
assert.deepEqual(colors(), winter, 'forced redraw/load must ignore prior seasonal update history');

const recreatedPalette = new SeasonalMaterialTint();
for (let i = 0; i < samples.length; i += 1) {
  const [, base, component, strength] = samples[i];
  const material = new THREE.MeshStandardMaterial({ color: base });
  recreatedPalette.register(material, base);
  const state = environment.visualState();
  recreatedPalette.apply(material, state[component], strength, 1);
  assert.equal(material.color.getHex(), materials[i].material.color.getHex(),
    'a newly reconstructed material must match the original scene after save/load');
  material.dispose();
}

const clampMaterial = new THREE.MeshStandardMaterial({ color: 0x334455 });
palette.register(clampMaterial, 0x334455);
palette.apply(clampMaterial, 0xff0000, 0, 1);
assert.equal(clampMaterial.color.getHex(), 0x334455, 'zero strength means factory color');
palette.apply(clampMaterial, 0xff0000, 1, 1);
assert.equal(clampMaterial.color.getHex(), 0xff0000, 'full strength means seasonal target');
palette.apply(clampMaterial, 0xff0000, 0, 1);
assert.equal(clampMaterial.color.getHex(), 0x334455, 'factory color remains recoverable');
clampMaterial.dispose();

const gameSource = await readFile(new URL('../src/ThreeGame.ts', import.meta.url), 'utf8');
assert.match(gameSource, /this\.seasonalMaterialTint\.register\(material, color\)/);
assert.match(gameSource, /this\.seasonalMaterialTint\.apply\(material, target, strength, blend\)/);
assert.doesNotMatch(gameSource, /this\.seasonalColor\(current, target,/);

for (const entry of materials) entry.material.dispose();
console.log('Seasonal material tints: 2,750+ repeated refreshes, cycles, forced load and original-color preservation: ok');
