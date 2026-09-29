import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [worldStyle, threeGame] = await Promise.all([
  readFile(new URL('../src/rendering/WorldStyle.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/ThreeGame.ts', import.meta.url), 'utf8'),
]);

assert.match(
  worldStyle,
  /referenceDistances:\s*\{[\s\S]*nearInspection:\s*48,[\s\S]*normalGameplay:\s*104,[\s\S]*maximumStrategic:\s*148,/,
  'Camera reference distances must be documented in the shared world style.',
);
assert.match(worldStyle, /minDistance:\s*40,/, 'Near gameplay zoom must remain bounded.');
assert.match(worldStyle, /maxDistance:\s*150,/, 'Strategic gameplay zoom must remain bounded.');
assert.match(
  worldStyle,
  /position:\s*new THREE\.Vector3\(55, 64, 61\)/,
  'Default 3D camera must use the normal gameplay reference composition.',
);
assert.match(
  threeGame,
  /controls\.minDistance = WORLD_STYLE\.camera\.minDistance;/,
  'OrbitControls must consume the shared minimum zoom bound.',
);
assert.match(
  threeGame,
  /controls\.maxDistance = WORLD_STYLE\.camera\.maxDistance;/,
  'OrbitControls must consume the shared maximum zoom bound.',
);
assert.match(
  threeGame,
  /controls\.zoomToCursor = false;/,
  'Zoom must preserve the existing focus target instead of jumping laterally.',
);
assert.match(
  threeGame,
  /private enforceGameplayCameraBounds\(\): void \{/,
  'Gameplay camera must clamp its focus and distance to the playable world.',
);
assert.match(
  threeGame,
  /WORLD \/ 2 - WORLD_STYLE\.camera\.targetPadding/,
  'Camera target bounds must derive from the playable map extent.',
);
assert.match(
  threeGame,
  /private resetGameplayCameraReference\(\): void \{/,
  'Templates and manual loads must be able to restore the normal reference camera.',
);
assert.match(
  threeGame,
  /this\.resetGameplayCameraReference\(\);[\s\S]*this\.redraw\(\);/,
  'Load/template flows must restore a consistent reference camera before redraw.',
);

const viewModeStart = threeGame.indexOf('private setViewMode(');
const viewModeEnd = threeGame.indexOf('private updateViewModeUI(', viewModeStart);
assert.notEqual(viewModeStart, -1);
assert.notEqual(viewModeEnd, -1);
const viewMode = threeGame.slice(viewModeStart, viewModeEnd);
assert.doesNotMatch(
  viewMode,
  /controls\.(?:minDistance|maxDistance)\s*=\s*\d/,
  'View modes must not reintroduce scattered literal zoom bounds.',
);
assert.match(
  viewMode,
  /WORLD_STYLE\.camera\.planDistance/,
  'Plan camera distance must also come from the shared camera configuration.',
);

console.log('Gameplay camera zoom/reference contract checks passed.');
