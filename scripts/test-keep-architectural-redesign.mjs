import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks, stripTypeScriptTypes } from 'node:module';

registerHooks({
  resolve(specifier, context, next) {
    try {
      return next(specifier, context);
    } catch (error) {
      if (specifier.startsWith('.') && !specifier.endsWith('.ts')) return next(specifier + '.ts', context);
      throw error;
    }
  },
  load(url, context, next) {
    if (url.endsWith('.ts')) return {
      format: 'module', shortCircuit: true,
      source: stripTypeScriptTypes(readFileSync(new URL(url), 'utf8'), { mode: 'transform' }),
    };
    return next(url, context);
  },
});

const THREE = await import('three');
const { KeepRenderer } = await import('../src/rendering/KeepRenderer.ts');
const { CastleDetailGenerator } = await import('../src/building/CastleDetailGenerator.ts');

const material = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
const stone = material(0xc8c9b2), dark = material(0x8d927f), light = material(0xd8d6bd);
const wood = material(0x654531), shadowWood = material(0x473327);
const roof = material(0xc96b3e), roofDark = material(0x704432), voidMat = material(0x1b1b19);
const materials = {
  castleStone: (_, role) => role === 'foundation' || role === 'dark' ? dark : role === 'alt' ? light : stone,
  timber: wood, timberDark: shadowWood, iron: material(0x555d5f),
  roofTile: roof, japaneseRoofTile: roofDark, roofDark,
  arrowVoid: voidMat, bannerCloth: material(0x8d3940),
};
const renderer = new KeepRenderer(new CastleDetailGenerator(), materials);
const context = {
  tileSize: 4,
  toWorld: (x, y) => ({ x: (x + .5) * 4, z: (y + .5) * 4 }),
  elevationAt: (x, y) => (x > 18 ? 1.15 : y < 9 ? -.3 : 0),
  terrainAt: () => 'plains',
  kindAt: () => undefined,
  stoneStyle: 'limestone',
};
const base = {
  id: 1, x: 14, y: 15, width: 3, depth: 4,
  floors: 3, rotation: 0, cornerTowers: true,
  roof: 'sloped', battlements: true, seed: 829731,
};
const render = (changes = {}) => {
  const keep = { ...base, ...changes };
  const prior = JSON.stringify(keep);
  const group = renderer.render(keep, context);
  assert.equal(JSON.stringify(keep), prior, 'visual redesign must not mutate saved KeepState');
  const box = new THREE.Box3().setFromObject(group);
  for (const value of [...box.min, ...box.max]) assert.ok(Number.isFinite(value), 'bounds must be finite');
  assert.ok(box.max.y > box.min.y + 6, 'a keep must remain a readable vertical silhouette');
  assert.equal(group.userData.castleAccess.groundConnected, true);
  assert.equal(group.userData.castleAccess.floors.length, keep.floors);
  assert.equal(group.position.x, (keep.x + .5) * 4);
  return { group, box };
};
const meshes = group => {
  let n = 0;
  group.traverse(object => { if (object.isMesh) n += 1; });
  return n;
};
const signature = group => {
  const parts = [];
  group.traverse(node => {
    if (!node.isMesh) return;
    parts.push([node.name, ...node.position.toArray().map(v => Number(v.toFixed(4))),
      ...node.rotation.toArray().slice(0, 3).map(v => Number(v.toFixed(4)))].join(','));
  });
  return parts;
};

for (const roofStyle of ['sloped', 'towered', 'flatBattlement', 'defensivePlatform', 'japaneseTiered']) {
  const { group, box } = render({ roof: roofStyle });
  assert.ok(meshes(group) < 1200, roofStyle + ': excessive mesh budget');
  assert.ok(box.min.y < 2.25, roofStyle + ': foundation must reach the terrain');
  if (roofStyle === 'japaneseTiered') {
    assert.equal(group.userData.architectureFamily, 'japanese-castle');
    assert.equal(group.getObjectByName('keep-great-hall-gable'), undefined);
  } else {
    assert.equal(group.userData.architectureFamily, 'stone-great-hall');
    assert.equal(group.userData.keepRoofVariant, roofStyle);
    assert.ok(group.getObjectByName('keep-turret-machicolation'), 'turret corbels must be present');
    assert.ok(group.getObjectByName('keep-heraldic-banner'), 'keep must show a heraldic banner');
  }
  if (roofStyle === 'sloped') {
    const gable = group.getObjectByName('keep-great-hall-gable');
    assert.ok(gable && gable.geometry.type === 'ExtrudeGeometry',
      'sloped keep must use an actual rectangular gable instead of a stretched cone');
  }
  if (roofStyle === 'towered') {
    assert.ok(group.getObjectByName('keep-watch-hall-gable'),
      'towered variant must have an upper watch-hall roof');
    assert.ok(box.max.y > render({ roof: 'flatBattlement' }).box.max.y,
      'towered crown must project above the battlement-only roof');
  }
  console.log('ok: '+roofStyle+' keep — '+meshes(group)+' meshes, '+box.max.y.toFixed(1)+' high');
}

const plain = render({ cornerTowers: false, battlements: false });
assert.equal(plain.group.getObjectByName('keep-corner-turret'), undefined,
  'optional corner turrets must be suppressed');
const tall = render({ floors: 4 });
const short = render({ floors: 2 });
assert.ok(tall.box.max.y > short.box.max.y + 3, 'floor count must still change the keep silhouette');
const rotated = render({ width: 3, depth: 5, rotation: 1 });
const foundation = rotated.group.children[0].geometry.parameters;
assert.ok(foundation.width > foundation.depth,
  'rotated keep must swap its structural footprint axes; exterior stairs may extend world-space bounds');

const first = render({ roof: 'towered', seed: 98652 });
const again = render({ roof: 'towered', seed: 98652 });
assert.deepEqual(signature(first.group), signature(again.group),
  'rebuilding the same keep must generate identical geometry');
assert.notEqual(materials.bannerCloth, materials.roofTile,
  'banners must not reuse the roofing texture as cloth');
console.log('Keep architectural redesign: all roof families, terrain, footprint, optional parts and redraw checks passed.');
