import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [style, materials, game, keep, accessTest, gateTest] = await Promise.all([
  readFile(new URL('../src/rendering/CastleArchitectureStyle.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/rendering/MedievalMaterials.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/ThreeGame.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/rendering/KeepRenderer.ts', import.meta.url), 'utf8'),
  readFile(new URL('./test-castle-access-navigation.mjs', import.meta.url), 'utf8'),
  readFile(new URL('./test-gate-orientation.mjs', import.meta.url), 'utf8'),
]);

for (const stoneStyle of ['limestone', 'darkStone', 'sandstone', 'frontier', 'whitePlaster']) {
  assert.match(style, new RegExp(`\\b${stoneStyle}: \\{`));
}

assert.match(style, /light|body: 0xc8c9b2/);
assert.match(style, /battlement:/);
assert.match(style, /gate:/);
assert.match(style, /tower:/);
assert.match(style, /bridge:/);
assert.match(style, /access:/);
assert.match(style, /keep:/);

assert.match(materials, /CASTLE_STONE_PALETTES/);
assert.match(materials, /CASTLE_ARCHITECTURE_STYLE\.palette\.timber/);
assert.match(materials, /CASTLE_ARCHITECTURE_STYLE\.palette\.roofTerracotta/);
assert.match(materials, /createStylePalette/);
assert.match(materials, /japaneseRoofTile/);
assert.match(keep, /addJapaneseRoofTier/);
assert.match(keep, /architectureFamily = 'japanese-castle'/);

assert.match(game, /CASTLE_ARCHITECTURE_STYLE\.wall\.stoneBaseHeight/);
assert.match(game, /CASTLE_ARCHITECTURE_STYLE\.battlement/);
assert.match(game, /const gateStyle = CASTLE_ARCHITECTURE_STYLE\.gate/);
assert.match(game, /CASTLE_ARCHITECTURE_STYLE\.tower\.connectorWidth/);
assert.match(game, /CASTLE_ARCHITECTURE_STYLE\.bridge\.stoneDeckWidth/);
assert.match(game, /CASTLE_ARCHITECTURE_STYLE\.access\.stairTowerWidth/);
assert.match(game, /const stone = this\.medievalMaterials\.castleStone\(this\.stoneStyle, 'walkway', gx, gy\)/);
assert.doesNotMatch(game, /const stone = new THREE\.MeshStandardMaterial\(\{ color: 0xb7afa4/);

assert.match(keep, /CASTLE_ARCHITECTURE_STYLE\.keep\.floorHeight/);
assert.match(keep, /CASTLE_ARCHITECTURE_STYLE\.battlement/);

assert.match(accessTest, /generatedAccess/);
assert.match(gateTest, /resolveGateOrientation/);

console.log('Castle architecture style kit and integration checks passed.');
