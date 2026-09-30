import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const game = await readFile(new URL('../src/ThreeGame.ts', import.meta.url), 'utf8');

// Wall placement must preview the actual resulting connected topology and height
// before pointer-up confirms the edit.
assert.match(game, /private renderWallPreview\(path: GridPoint\[\], decrease = false\): void/);
assert.match(game, /existing\.level = decrease[\s\S]*?MAX_WALL_LEVEL/);
assert.match(game, /marker\.userData\.previewTopology = draftBlock\?\.topology/);
assert.match(game, /body\.userData\.previewLevel = draftBlock\.level/);
assert.match(game, /Wall preview · \$\{path\.length\} segment/);
assert.match(game, /constructionCostPreviewLabel\(wallKind, costedSegments\)/);
assert.match(game, /invalidSegments > 0/);
assert.match(game, /target height L\$\{heightTarget\}/);

// Gate and tower replacement/upgrade previews must come from the same
// authoritative CastleBlockSystem used by the final rendered castle.
assert.match(game, /private previewCastlePlacementBlock\(point: GridPoint, decrease = false\): CastleBlockState \| null/);
assert.match(game, /if \(tool !== 'gate' && tool !== 'tower'\) return null/);
assert.match(game, /kind: 'tower'[\s\S]*?wallLinks: existing\?\.wallLinks/);
assert.match(game, /kind: 'gate'[\s\S]*?rotationMode: 'auto'/);
assert.match(game, /return this\.castleBlockSystem\.build\([\s\S]*?terrainElevation/);
assert.match(game, /castlePreview\.links\.includes\('E'\)/);
assert.match(game, /body\.userData\.previewTopology = castlePreview\.topology/);
assert.match(game, /previewAttachment = castlePreview\.attachment/);
assert.match(game, /Gate preview|\$\{label\} preview/);

// Direct wall -> tower replacement and wall -> gate replacement must preserve
// wall links so surrounding topology does not need manual rebuilding.
assert.match(game, /if \(current && !this\.isWallFamily\(current\)\) return;/);
assert.match(game, /this\.services\.state\.setCell\(gx, gy, 'tower'[\s\S]*?wallLinks: cell\?\.wallLinks/);
assert.match(game, /selectedFortification && currentFortification[\s\S]*?wallLinks: cell\?\.wallLinks/);

// Touch interruption must never commit a half-finished castle edit. A second
// finger suppresses the active build pointer(s); cancel/background restores a
// clean gesture state and an unfinished terrain stroke is rolled back.
assert.match(game, /private readonly activeTouchPointers = new Set<number>\(\)/);
assert.match(game, /private readonly suppressedTouchPointers = new Set<number>\(\)/);
assert.match(game, /this\.activeTouchPointers\.size > 1/);
assert.match(game, /this\.suppressedTouchPointers\.add\(pointerId\)/);
assert.match(game, /this\.cancelActiveTouchBuildGesture\(canvas\)/);
assert.match(game, /const suppressed = this\.suppressedTouchPointers\.has\(event\.pointerId\)/);
assert.match(game, /if \(terrainSnapshot\) \{[\s\S]*?this\.restoreSnapshot\(terrainSnapshot\)/);
assert.match(game, /window\.addEventListener\('blur', cancelInterruptedTouchGesture\)/);
assert.match(game, /document\.addEventListener\('visibilitychange'/);

// Existing editing paths must continue to update local castle topology and keep
// undo/save/load semantics instead of creating a parallel castle state.
assert.match(game, /this\.redrawCastleNeighborhood\(path\)/);
assert.match(game, /this\.pushUndoSnapshot\(before\)/);
assert.match(game, /this\.scheduleSave\(\)/);

console.log('connected castle build/edit UX regression checks passed');
