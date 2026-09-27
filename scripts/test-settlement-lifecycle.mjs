import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const threeGame = await readFile(
  new URL('../src/ThreeGame.ts', import.meta.url),
  'utf8',
);

function between(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `Missing start marker: ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `Missing end marker: ${endMarker}`);
  return source.slice(start, end);
}

assert.match(
  threeGame,
  /interface SettlementAgent\s*\{[\s\S]*?key:\s*string;/,
  'Settlement agents must have stable logical keys.',
);
assert.match(
  threeGame,
  /destinationGrid:\s*GridPoint;/,
  'Settlement agents must retain their intended destination for path invalidation.',
);

const redraw = between(
  threeGame,
  'private redraw(): void {',
  'private getWallWeaponVisuals(',
);
assert.match(
  redraw,
  /this\.reconcileSettlementAgents\(cells\)/,
  'World redraw must reconcile settlement agents.',
);
assert.doesNotMatch(
  redraw,
  /refreshSettlementAgents|clearGroup\(this\.settlementLayer\)|settlementAgents\.length\s*=\s*0|nextSettlementAgentId\s*=\s*1/,
  'Ordinary redraw must never rebuild or clear the settlement population.',
);

const reconcile = between(
  threeGame,
  'private reconcileSettlementAgents(',
  'private buildDesiredSettlementAgents(',
);
assert.match(
  reconcile,
  /existingByKey\.get\(spec\.key\)/,
  'Reconciliation must match existing agents by stable key.',
);
assert.match(
  reconcile,
  /this\.updateSettlementAssignment\(existing, spec, currentHomes\)/,
  'Matching agents must be updated in place rather than respawned.',
);
assert.match(
  reconcile,
  /this\.spawnSettlementAgentFromSpec\(spec\)/,
  'Only missing desired agents should be spawned.',
);
assert.match(
  reconcile,
  /this\.removeSettlementAgent\(removed\)/,
  'Only agents absent from the desired topology should be removed.',
);
assert.doesNotMatch(
  reconcile,
  /clearGroup\(this\.settlementLayer\)|settlementAgents\.length\s*=\s*0|nextSettlementAgentId\s*=\s*1/,
  'Reconciliation must preserve runtime population state.',
);

const target = between(
  threeGame,
  'private setSettlementTarget(',
  'private isSettlementBlocked(',
);
assert.match(
  target,
  /agent\.destinationGrid\s*=\s*\{ \.\.\.resolved \}/,
  'Settlement routing must retain the intended destination.',
);

const invalidation = between(
  threeGame,
  'private invalidateSettlementPaths(): void {',
  'private settlementTraversabilitySignature(): string {',
);
assert.match(
  invalidation,
  /this\.setSettlementTarget\(agent, agent\.destinationGrid\)/,
  'Topology changes must recalculate routes from the current runtime position.',
);
assert.doesNotMatch(
  invalidation,
  /agent\.position\s*=|agent\.phase\s*=|agent\.waitMs\s*=/,
  'Path invalidation must not reset movement state.',
);

const resetWorld = between(
  threeGame,
  'private resetWorldForMode(',
  'private startNewGameWithMode(',
);
assert.match(
  resetWorld,
  /this\.clearSettlementAgents\(\)/,
  'True world resets must explicitly clear settlement agents.',
);

const loadHandler = between(
  threeGame,
  "get<HTMLButtonElement>('load-button').onclick",
  "get<HTMLButtonElement>('reset-button').onclick",
);
assert.match(
  loadHandler,
  /this\.clearSettlementAgents\(\)[\s\S]*?this\.load\(\)/,
  'Loading a replacement save must clear the previous runtime settlement first.',
);

for (const method of ['private applyTemplate(', 'private applyTerrainTemplate(']) {
  const start = threeGame.indexOf(method);
  assert.notEqual(start, -1, `Missing method: ${method}`);
  const next = threeGame.indexOf('\n  private ', start + method.length);
  const block = threeGame.slice(start, next === -1 ? threeGame.length : next);
  assert.match(
    block,
    /this\.clearSettlementAgents\(\)/,
    `${method} must clear agents because it replaces the whole world.`,
  );
}

assert.doesNotMatch(
  threeGame,
  /refreshSettlementAgents/,
  'The destructive refreshSettlementAgents lifecycle must remain removed.',
);

console.log('Settlement lifecycle regression checks passed.');
