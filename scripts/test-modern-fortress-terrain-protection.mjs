import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [threeGame, footprints, packageJson] = await Promise.all([
  readFile(new URL('../src/ThreeGame.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/building/StructureFootprints.ts', import.meta.url), 'utf8'),
  readFile(new URL('../package.json', import.meta.url), 'utf8'),
]);

function methodBody(source, signature) {
  const start = source.indexOf(signature);
  assert.notEqual(start, -1, `Missing method: ${signature}`);
  const next = source.indexOf('\n  private ', start + signature.length);
  assert.notEqual(next, -1, `Could not find end of method: ${signature}`);
  return source.slice(start, next);
}

assert.match(
  footprints,
  /FUTURISTIC_CASTLE_FOOTPRINT_RADIUS\s*=\s*4/,
  'Modern Fortress must use the shared 9x9 footprint definition.',
);
assert.match(
  footprints,
  /kind !== 'futuristicCastle'/,
  'The shared footprint helper must preserve single-cell behavior for other building kinds.',
);

const radiusMatch = footprints.match(/FUTURISTIC_CASTLE_FOOTPRINT_RADIUS\s*=\s*(\d+)/);
assert.ok(radiusMatch, 'Could not read Modern Fortress footprint radius.');
const radius = Number(radiusMatch[1]);
assert.equal((radius * 2 + 1) ** 2, 81, 'Modern Fortress footprint must reserve 81 cells.');
assert.equal(Math.abs(14 - 10) <= radius, true, 'A footprint edge cell must be protected.');
assert.equal(Math.abs(15 - 10) <= radius, false, 'Terrain immediately outside the footprint must remain editable.');

const terrainGate = methodBody(threeGame, 'private canEditTerrainAt(x: number, y: number): boolean {');
assert.match(
  terrainGate,
  /this\.services\.state\.entries\(\)/,
  'Terrain protection must derive from live structure anchors so save/load reconstructs it.',
);
assert.match(
  terrainGate,
  /anchor\.kind !== 'futuristicCastle'/,
  'Only Modern Fortress anchors should expand to the protected fortress footprint.',
);
assert.match(
  terrainGate,
  /getStructureFootprint\(anchor\.kind, anchor\.x, anchor\.y\)/,
  'Terrain protection must use the shared structure footprint helper.',
);
assert.match(
  terrainGate,
  /cell\.x === x && cell\.y === y/,
  'Terrain protection must test the requested grid cell against the footprint.',
);

const brush = methodBody(threeGame, 'private applyTerrainBrush(center: GridPoint): void {');
const brushGuard = brush.indexOf('if (!this.canEditTerrainAt(point.x, point.y)) continue;');
const brushElevation = brush.indexOf('this.setAbsoluteElevation(point.x, point.y, next);');
assert.ok(brushGuard >= 0 && brushGuard < brushElevation, 'Brushes must skip protected cells before changing elevation.');
assert.doesNotMatch(
  brush,
  /if \(!this\.canEditTerrainAt\(center\.x, center\.y\)\) return;/,
  'A partially overlapping brush must still edit unprotected neighboring cells.',
);

const mountain = methodBody(threeGame, 'private shapeMountainFootprint(gx: number, gy: number, level: number): void {');
assert.match(
  mountain,
  /if \(!this\.canEditTerrainAt\(x, y\)\) continue;/,
  'Mountain shaping must skip protected footprint cells.',
);

const mountainRange = methodBody(threeGame, 'private applyMountainRange(');
assert.match(
  mountainRange,
  /if \(!this\.canEditTerrainAt\(x, y\)\) continue;/,
  'Mountain Range must skip protected footprint cells.',
);

const buildClick = methodBody(threeGame, 'private handleBuildClick(event: PointerEvent): void {');
const terrainToolBranch = buildClick.indexOf("if (this.selectedTool === 'river' || this.selectedTool === 'land')");
const terrainToolGuard = buildClick.indexOf('if (!this.canEditTerrainAt(gx, gy))', terrainToolBranch);
const riverWrite = buildClick.indexOf("this.terrainOverrides.set(overrideKey, 'river')", terrainToolBranch);
const landWrite = buildClick.indexOf("this.terrainOverrides.set(overrideKey, 'plains')", terrainToolBranch);
assert.ok(
  terrainToolBranch >= 0 &&
  terrainToolGuard > terrainToolBranch &&
  terrainToolGuard < riverWrite &&
  terrainToolGuard < landWrite,
  'River and Land edits must be rejected before modifying protected terrain.',
);

const mountainBranch = buildClick.indexOf("if (this.selectedTool === 'mountain')");
const mountainClickGuard = buildClick.indexOf('if (!this.canEditTerrainAt(gx, gy))', mountainBranch);
const mountainPlacement = buildClick.indexOf("this.services.state.setCell(gx, gy, 'mountain', 1)", mountainBranch);
assert.ok(
  mountainBranch >= 0 && mountainClickGuard > mountainBranch && mountainClickGuard < mountainPlacement,
  'Direct Mountain placement must reject protected footprint cells.',
);

const eraseBranch = buildClick.indexOf("if (this.selectedTool === 'erase')");
const fortressRemoval = buildClick.indexOf('this.services.state.removeCell(gx, gy);', eraseBranch);
const overrideBranch = buildClick.indexOf('if (this.terrainOverrides.has(overrideKey))', eraseBranch);
const eraseTerrainGuard = buildClick.indexOf('if (!this.canEditTerrainAt(gx, gy))', overrideBranch);
const overrideDelete = buildClick.indexOf('this.terrainOverrides.delete(overrideKey);', overrideBranch);
assert.ok(fortressRemoval >= 0 && fortressRemoval < overrideBranch, 'Erase must still remove the fortress anchor normally.');
assert.ok(
  eraseTerrainGuard > overrideBranch && eraseTerrainGuard < overrideDelete,
  'Erase must not rewrite terrain overrides under a surviving fortress footprint.',
);

assert.match(
  packageJson,
  /test:modern-fortress-terrain-protection/,
  'Modern Fortress terrain protection regression must run in the build pipeline.',
);

console.log('Modern Fortress terrain protection regression checks passed.');
