import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [threeGame, coreTypes, saveSystem] = await Promise.all([
  readFile(new URL('../src/ThreeGame.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/core/types.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/core/SaveSystem.ts', import.meta.url), 'utf8'),
]);

assert.match(threeGame, /private resolveGateOrientation\(/);
assert.match(threeGame, /verticalNeighbors !== horizontalNeighbors/);
assert.match(threeGame, /rotationMode === 'manual'/);
assert.match(threeGame, /rotationMode: 'auto'/);
assert.match(threeGame, /rotationMode: 'manual' as const/);
assert.match(coreTypes, /export type GateRotationMode = 'auto' \| 'manual'/);
assert.match(coreTypes, /rotationMode\?: GateRotationMode/);
assert.match(saveSystem, /rotationMode: cell\.rotationMode/);

console.log('Gate orientation regression checks passed.');
