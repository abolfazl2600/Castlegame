import assert from 'node:assert/strict';
import { MissionSystem } from '../src/missions/MissionSystem.ts';

function battle(mode = 'idle', winner) {
  return {
    mode,
    result: winner ? { winner } : undefined,
  };
}

function snapshot({
  population = 0,
  deadCivilians = 0,
  cells = [],
  keeps = [],
  battleStatus = battle(),
} = {}) {
  return {
    population: { totalPopulation: population, deadCivilians },
    cells,
    keeps,
    battle: battleStatus,
  };
}

const missions = new MissionSystem();

let result = missions.update(snapshot({ population: 24 }));
assert.equal(result.completedIds.includes('growth-population-25'), false);
assert.equal(missions.getView(snapshot({ population: 24 })).pinnedMissionId, 'growth-population-25');

result = missions.update(snapshot({ population: 25 }));
assert.equal(result.completedIds.includes('growth-population-25'), true);
assert.equal(missions.getView(snapshot({ population: 25 })).active.some((entry) => entry.definition.id === 'growth-population-100'), true);

result = missions.update(snapshot({
  population: 25,
  cells: [{ x: 1, y: 1, kind: 'harbor', level: 3 }],
  keeps: [{ id: 1, x: 2, y: 2, width: 3, depth: 3, floors: 3, rotation: 0, cornerTowers: true, roof: 'flatBattlement', battlements: true, seed: 1 }],
}));
assert.equal(result.completedIds.includes('maritime-first-harbor'), true);
assert.equal(result.completedIds.includes('maritime-harbor-3'), true);
assert.equal(result.completedIds.includes('fortress-keep-3'), true);

missions.observeBattle(battle('running'), 0);
const changed = missions.observeBattle(battle('finished', 'defender'), 0);
assert.equal(changed, true);
result = missions.update(snapshot({
  population: 25,
  battleStatus: battle('finished', 'defender'),
}));
assert.equal(result.completedIds.includes('defense-first-victory'), true);
assert.equal(result.completedIds.includes('defense-flawless'), true);

missions.observeBattle(battle('idle'), 0);
missions.observeBattle(battle('running'), 0);
missions.observeBattle(battle('finished', 'defender'), 1);
missions.observeBattle(battle('idle'), 1);
missions.observeBattle(battle('running'), 1);
missions.observeBattle(battle('finished', 'defender'), 2);
result = missions.update(snapshot({ population: 25, deadCivilians: 2, battleStatus: battle('finished', 'defender') }));
assert.equal(result.completedIds.includes('defense-three-victories'), true);

const saved = missions.getState();
const restored = new MissionSystem();
restored.setState(saved);
assert.deepEqual(restored.getState(), saved);
assert.equal(restored.getView(snapshot({ population: 25 })).completed.some((entry) => entry.definition.id === 'defense-three-victories'), true);

assert.equal(restored.setPinnedMission('growth-population-100'), true);
assert.equal(restored.getState().pinnedMissionId, 'growth-population-100');
assert.equal(restored.setPinnedMission('not-a-real-mission'), false);

console.log('Mission system checks passed.');
