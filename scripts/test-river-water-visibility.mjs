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
  /afterLoad:\s*\(\)\s*=>\s*this\.normalizeRiverElevations\(\)/,
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
