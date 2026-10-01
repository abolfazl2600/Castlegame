import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const battleSystem = await readFile(
  new URL('../src/battle/BattleSystem.ts', import.meta.url),
  'utf8',
);

function between(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `Missing start marker: ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `Missing end marker: ${endMarker}`);
  return source.slice(start, end);
}

const updateUnit = between(
  battleSystem,
  'private updateUnit(',
  'private followAttackerObjective(',
);
assert.match(
  updateUnit,
  /runtime\.surface === 'ground'\s*\|\|\s*\(runtime\.surface === 'wall' && runtime\.moving\)/,
  'Ground-unit separation must run even while a unit is stationary or attacking.',
);

const separation = between(
  battleSystem,
  'private applySeparation(',
  'private updateStuckRecovery(',
);

assert.doesNotMatch(
  separation,
  /distanceSq <= 0\.0001 \|\| distanceSq > personalSpace \* personalSpace/,
  'Perfect overlaps must not be discarded before they can be separated.',
);
assert.match(
  separation,
  /const pairHash = Math\.abs\(this\.hashString/,
  'Perfect overlaps must use a deterministic pair-based escape direction.',
);
assert.match(
  separation,
  /const sign = runtime\.data\.id === firstId \? 1 : -1/,
  'The pair-based escape direction must push the two overlapping units apart.',
);
assert.match(
  separation,
  /const stationaryScale = runtime\.moving \? 1 : 0\.72/,
  'Stationary combatants must receive a controlled anti-overlap push.',
);
assert.match(
  separation,
  /this\.navigation\.isGroundWalkable\(candidateGrid\.x, candidateGrid\.y\)/,
  'Separation must not push ground units into blocked cells.',
);
assert.match(
  separation,
  /this\.canTraverseGroundTransition\(/,
  'Separation displacement must respect the ground navigation transition rules.',
);
assert.match(
  separation,
  /new THREE\.Vector3\(displacement\.x, 0, 0\)[\s\S]*new THREE\.Vector3\(0, 0, displacement\.z\)/,
  'Tight corridors must have axis-only separation fallbacks.',
);

console.log('Battle unit separation regression checks passed.');
