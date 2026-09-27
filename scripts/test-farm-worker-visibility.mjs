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

assert.match(allocation, /const maxVisibleCitizens = 40;/);
assert.match(allocation, /const maxVisibleFarmers = 40;/);
assert.match(allocation, /let visibleCitizens = 0;[\s\S]*?let visibleFarmers = 0;/);
assert.doesNotMatch(allocation, /result\.length\s*>=\s*maxVisibleAgents/);

const primary = allocation.indexOf('First pass reserves one stable worker');
const secondary = allocation.indexOf('if (homes.length > 0)');
assert.ok(primary >= 0, 'Primary farmer allocation pass is required.');
assert.ok(secondary > primary, 'Second workers must be allocated after primary farm workers.');
assert.match(allocation, /key: `farmer:\$\{farm\.x\},\$\{farm\.y\}:0`/);

const movement = between(
  threeGame,
  'private updateSettlementAgents(deltaMs: number): void {',
  'private updatePopulationUI(): void {',
);
assert.match(
  movement,
  /agent\.phase === 'work'[\s\S]*?6800 \+ \(agent\.id % 4\) \* 520/,
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

console.log('Farm worker visibility regression checks passed.');
