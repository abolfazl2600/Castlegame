import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  ASSAULT_RALLY_MAX_SECONDS,
  RETREAT_COOLDOWN_SECONDS,
  RETREAT_DURATION_SECONDS,
  attackerFocusAdjustment,
  breachApproachScore,
  releaseAssaultGroup,
  retreatGoal,
  shouldRetreatAttacker,
} from '../src/battle/AttackerTactics.ts';

const wall = {
  pathLength: 12,
  currentHealth: 650,
  maxHealth: 650,
  defendersNearby: 1,
  wallLevel: 1,
};
const healthy = breachApproachScore(wall);
assert.ok(breachApproachScore({ ...wall, currentHealth: 130 }) < healthy,
  'Attackers must prefer the same wall when damaged');
assert.ok(breachApproachScore({ ...wall, defendersNearby: 6 }) > healthy,
  'A heavily defended wall must be less attractive');
assert.ok(breachApproachScore({ ...wall, stalledPenalty: 14 }) > healthy,
  'Repeatedly blocked assaults should switch to another reachable breach');
assert.ok(breachApproachScore({ ...wall, pathLength: 3 }) < healthy,
  'Shorter reachable approach is preferred');
assert.ok(breachApproachScore({ ...wall, currentHealth: -5 }) >= 0);

assert.equal(shouldRetreatAttacker(27, 100, 2, 5, 0), true);
assert.equal(shouldRetreatAttacker(28, 100, 1, 2, 0), true);
assert.equal(shouldRetreatAttacker(29, 100, 2, 5, 0), false);
assert.equal(shouldRetreatAttacker(25, 100, 0, 5, 0), false);
assert.equal(shouldRetreatAttacker(25, 100, 1, 1, 0), false);
assert.equal(shouldRetreatAttacker(25, 100, 1, 2, 1), false);
assert.equal(shouldRetreatAttacker(0, 100, 1, 2, 0), false);
assert.ok(RETREAT_DURATION_SECONDS > 0 && RETREAT_COOLDOWN_SECONDS > RETREAT_DURATION_SECONDS);

assert.deepEqual(retreatGoal({ x: 10, y: 10 }, [{ x: 11, y: 10 }],
  { x: 0, y: 0 }, 25, 25), { x: 5, y: 10 });
assert.deepEqual(retreatGoal({ x: 2, y: 10 }, [{ x: 10, y: 10 }],
  { x: 0, y: 0 }, 25, 25), { x: 0, y: 10 },
  'Fallback cannot send the unit outside the map');
assert.deepEqual(retreatGoal({ x: 10, y: 10 }, [],
  { x: 10, y: 20 }, 25, 25), { x: 10, y: 15 });
assert.deepEqual(retreatGoal({ x: 3, y: 3 }, [],
  { x: 3, y: 3 }, 25, 25), { x: 3, y: 3 });

assert.ok(attackerFocusAdjustment(2) < attackerFocusAdjustment(0),
  'First squad members should favor the same reachable defender');
assert.ok(attackerFocusAdjustment(6) > attackerFocusAdjustment(3),
  'Overcrowded targets must become less attractive');
assert.equal(releaseAssaultGroup(1, 5, 0), false);
assert.equal(releaseAssaultGroup(3, 5, 0), true);
assert.equal(releaseAssaultGroup(2, 2, 0), true);
assert.equal(releaseAssaultGroup(1, 5, ASSAULT_RALLY_MAX_SECONDS), true,
  'Staged waves must never be held indefinitely');

const battle = await readFile(new URL('../src/battle/BattleSystem.ts', import.meta.url), 'utf8');
assert.match(battle, /this\.selectBreachCandidate\(anchor, 0\.52\)/,
  'Only actually weakened walls should trigger pre-ladder rerouting');
assert.match(battle, /this\.ladders\.size === 0/,
  'Do not abandon an existing ladder assault for a new weak-wall plan');
assert.match(battle, /this\.holdForCoordinatedBreach\(runtime, base\)/);
assert.match(battle, /this\.updateAttackerRetreat\(runtime, delta\)/);
assert.match(battle, /this\.stalledAssaultWall = this\.gridKey/);
assert.match(battle, /runtime\.retreatSeconds > 0/,
  'Retreat paths must be protected from ordinary tactical reassignment');
assert.match(battle, /this\.navigation\.findPath\([\s\S]*?destination, false/,
  'Retreat must use walkable navigation, not direct movement through walls');

console.log('Attacker tactical scoring, regrouping, retreat and integration contracts passed.');
