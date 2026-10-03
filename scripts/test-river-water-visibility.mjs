import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const threeGame = await readFile(
  new URL('../src/ThreeGame.ts', import.meta.url),
  'utf8',
);

function between(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `Missing start marker: ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `Missing end marker: ${endMarker}`);
  return source.slice(start, end);
}

const saveHost = between(
  threeGame,
  'this.saveSystem = new SaveSystem({',
  'this.riverTexture = this.createRiverTexture();',
);
assert.match(
  saveHost,
  /afterLoad:\s*\(\)\s*=>\s*\{[\s\S]*?this\.normalizeRiverElevations\(\);[\s\S]*?\}/,
  'Loading a save must normalize legacy negative river elevations.',
);

const normalizer = between(
  threeGame,
  'private normalizeRiverElevationAt(',
  'private setAbsoluteElevation(',
);
assert.match(
  normalizer,
  /this\.terrainAt\(x, y\) !== 'river'/,
  'River normalization must only affect river terrain.',
);
assert.match(
  normalizer,
  /elevationOverrides\.delete\(key\)/,
  'Negative river elevation overrides must be removed.',
);

const terrainRender = between(
  threeGame,
  'private renderTerrain(): void {',
  'private renderGroundVariation(',
);
assert.match(
  terrainRender,
  /if \(terrain === 'river'\)[\s\S]*?group\.position\.y = Math\.max\(0, elevation\)/,
  'River rendering must keep water above the island surface even for stale negative elevation state.',
);

const riverMaterial = between(
  threeGame,
  'this.riverWaterMaterial = new THREE.MeshStandardMaterial({',
  'this.oceanWaterMaterial = new THREE.MeshStandardMaterial({',
);
assert.match(
  riverMaterial,
  /depthWrite:\s*false/,
  'Transparent river water must not write depth and reintroduce camera-dependent flicker.',
);

const riverRenderer = between(
  threeGame,
  'private renderRiverTile(',
  'private terrainSurfaceYForCliff(',
);
assert.doesNotMatch(
  riverRenderer,
  /addRiverSurface\(/,
  'River tiles must not stack connector water planes over the center surface.',
);
assert.ok(
  riverRenderer.split('new THREE.PlaneGeometry(TILE, TILE, 1, 1)').length - 1 >= 2,
  'Each river tile must use one exact-tile bed and one exact-tile water surface.',
);

const worldLayoutSurface = between(
  threeGame,
  'private currentWorldLayoutSurfaceSignature(): string {',
  'private baseTerrainAt(',
);
assert.match(
  worldLayoutSurface,
  /terrainAt: \(x, y\) => this\.terrainAt\(x, y\)/,
  'The chunked world layout surface must use effective terrain so carved rivers remove the original grass slab.',
);
assert.doesNotMatch(
  worldLayoutSurface,
  /const terrain = this\.baseTerrainAt\(x, y\);/,
  'The world layout surface must not ignore terrain overrides.',
);
assert.match(
  worldLayoutSurface,
  /signature === this\.worldLayoutSurfaceSignature/,
  'World layout surface rebuilding should be cached when terrain has not changed.',
);
assert.match(
  threeGame,
  /private worldLayoutSurfaceSignature = '';/,
  'World layout surface caching must start invalid so the initial layout is built.',
);
assert.doesNotMatch(
  worldLayoutSurface,
  /TILE \* 1\.012/,
  'Base grass/shore tiles must not overlap coplanar neighbors; exact tile extents prevent z-fighting.',
);

const groundVariation = between(
  threeGame,
  'private renderGroundVariation(',
  'private renderCoastPatch(',
);
assert.match(
  groundVariation,
  /2\.255 \+ this\.terrainElevation\(gx, gy\)/,
  'Decorative ground patches must sit safely above the terrain/cliff cap surface.',
);

const cliffCap = between(
  threeGame,
  'private renderCliffPlateauPatch(',
  'private renderElevationPatch(',
);
assert.match(
  cliffCap,
  /const half = TILE \* 0\.5;/,
  'Cliff caps must meet neighboring cells at exact tile boundaries instead of overlapping.',
);
assert.match(
  cliffCap,
  /exposed\.north \?[^:]+: 0;/,
  'Non-exposed cliff edges must not jitter across neighboring coplanar caps.',
);


const redraw = between(
  threeGame,
  'private redraw(): void {',
  '/** Replace only wall meshes',
);
assert.match(
  redraw,
  /this\.rebuildWorldLayoutSurface\(\);[\s\S]*?this\.renderTerrain\(\);/,
  'Redraw must synchronize the world layout surface before rendering river tiles.',
);

const eraseBlock = between(
  threeGame,
  "if (this.selectedTool === 'erase') {",
  "if (this.selectedTool === 'keep') {",
);
assert.match(
  eraseBlock,
  /terrainOverrides\.delete\(overrideKey\);[\s\S]*?normalizeRiverElevationAt\(gx, gy\)/,
  'Erasing a land override back to a natural river must clear an invalid negative elevation.',
);

const manualRiver = between(
  threeGame,
  "if (this.selectedTool === 'river' || this.selectedTool === 'land') {",
  "if (this.isHarborTool(this.selectedTool)) {",
);
assert.match(
  manualRiver,
  /elevationOverrides\.delete\(overrideKey\);[\s\S]*?terrainOverrides\.set\(overrideKey, 'river'\)/,
  'Manual river carving must discard a prior Dig/Lower elevation before creating water.',
);

const restoreSnapshot = between(
  threeGame,
  'private restoreSnapshot(',
  'private undo(): void {',
);
assert.match(
  restoreSnapshot,
  /normalizeRiverElevations\(\)/,
  'Undo/redo snapshot restoration must normalize stale river elevations.',
);

console.log('River water visibility regression checks passed.');
