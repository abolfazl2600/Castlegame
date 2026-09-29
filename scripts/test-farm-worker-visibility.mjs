import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const threeGame = await readFile(
  new URL('../src/ThreeGame.ts', import.meta.url),
  'utf8',
);
const farmLife = await readFile(
  new URL('../src/systems/FarmLifeSystem.ts', import.meta.url),
  'utf8',
);

function between(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `Missing start marker: ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `Missing end marker: ${endMarker}`);
  return source.slice(start, end);
}

const allocation = between(
  threeGame,
  'private buildDesiredSettlementAgents(',
  'private updateSettlementAssignment(',
);

assert.match(allocation, /populationSystem\.reconcile\(cells\)/);
assert.match(allocation, /visibleCivilianRoster\(40, 40\)/);
assert.match(allocation, /role: assignment\.role/);
assert.doesNotMatch(allocation, /key: `citizen:/);
assert.doesNotMatch(allocation, /key: `farmer:/);

const movement = between(
  threeGame,
  'private updateSettlementAgents(deltaMs: number): void {',
  'private syncEconomyUI(): void {',
);
assert.match(
  movement,
  /agent\.role !== 'citizen' && agent\.work/,
);
assert.match(
  movement,
  /agent\.role === 'farmer'[\s\S]*?6800 \+ \(agent\.id % 4\) \* 520/,
);
assert.match(
  movement,
  /agent\.role === 'worker' && agent\.work[\s\S]*?3600 \+ \(agent\.id % 4\) \* 410/,
);

const targetPosition = between(
  threeGame,
  'private settlementTargetPosition(',
  'private chooseCitizenDestination(',
);
assert.match(targetPosition, /workCell\?\.kind === 'farm'/);
assert.match(targetPosition, /farmWorld\.z - 2\.08/);

const farmVisuals = between(
  threeGame,
  'private makeFarm(group: THREE.Group): THREE.Group {',
  'private makeArmyCamp(',
);
for (const detail of ['farm-path', 'farm-basket', 'farm-sack', 'farm-tool-iron']) {
  assert.match(farmVisuals, new RegExp(detail));
}
assert.match(farmVisuals, /group\.userData\.activeFarm = true;/);

const farmerAnimation = between(
  farmLife,
  'private updateFarmers(',
  'private setFarmerAction(',
);
assert.match(farmerAnimation, /const moving = agent\.waitMs <= 0;/);
assert.match(farmerAnimation, /const working = agent\.phase === 'work' && agent\.waitMs > 0;/);
assert.match(
  farmerAnimation,
  /agent\.work[\s\S]*?getCell\(agent\.work\.x, agent\.work\.y\)/,
);
assert.match(
  farmerAnimation,
  /if \(!working\) \{[\s\S]*?setFarmerAction\(animation, 'rest', time\)/,
);

console.log('Roster-backed farm and worker visibility regression checks passed.');
