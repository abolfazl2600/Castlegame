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
  /this\.worldWidth \/ 2 - WORLD_STYLE\.camera\.targetPadding[\s\S]*?this\.worldHeight \/ 2 - WORLD_STYLE\.camera\.targetPadding/,
  'Camera target bounds must derive independently from rectangular playable extents.',
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

assert.doesNotMatch(
  worldStyle,
  /planDistance/,
  'The shared camera configuration must not retain a legacy 2D plan distance.',
);
assert.doesNotMatch(
  threeGame,
  /plan2d|setViewMode|renderPlanLayer|view-2d-button|view-3d-button/,
  'Gameplay camera code must remain 3D-only.',
);
assert.match(
  threeGame,
  /private setCameraView\(view: '45' \| 'top'\): void \{/,
  '45-degree and top-down camera presets must remain available inside the 3D renderer.',
);

console.log('Gameplay camera zoom/reference contract checks passed.');
