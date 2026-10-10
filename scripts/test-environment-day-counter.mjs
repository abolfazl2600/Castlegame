import assert from 'node:assert/strict';
import { EnvironmentSystem } from '../src/systems/EnvironmentSystem.ts';

const frameMs = 50;
const framesPerMinute = 60_000 / frameMs;

const ordinary = new EnvironmentSystem();
for (let frame = 0; frame < framesPerMinute - 1; frame += 1) {
  ordinary.advance(frameMs);
}
assert.equal(ordinary.getState().day, 0, 'partial minutes must not increment the calendar');
ordinary.advance(frameMs);
assert.equal(ordinary.getState().day, 1, '1200 normal 50ms game frames equal one day');
assert.ok(Math.abs(ordinary.getState().progress - 1 / 48) < 1e-10);

for (let frame = 0; frame < framesPerMinute * 2; frame += 1) ordinary.advance(frameMs);
assert.equal(ordinary.getState().day, 3, 'subsequent minute boundaries must accumulate');
assert.equal(ordinary.visualState().season, 'spring');

const split = new EnvironmentSystem();
for (let frame = 0; frame < 667; frame += 1) split.advance(frameMs);
const snapshot = split.getState();
const restored = new EnvironmentSystem();
restored.setState(snapshot);
for (let frame = 667; frame < framesPerMinute; frame += 1) restored.advance(frameMs);
assert.equal(restored.getState().day, 1, 'save/load must preserve partial-minute progress');
assert.ok(Math.abs(restored.getState().progress - 1 / 48) < 1e-10,
  'seasonal progress must survive save/load without restarting');

const seasonBoundary = new EnvironmentSystem();
seasonBoundary.setState({ cycleDays: 8, day: 7, progress: 0.99 });
seasonBoundary.advance(4_800);
assert.equal(seasonBoundary.getState().day, 8, 'sub-minute remainder from a loaded near-boundary season is respected');
assert.equal(seasonBoundary.visualState().season, 'spring', 'season must wrap without resetting cumulative days');
assert.ok(seasonBoundary.getState().progress < 0.01);

const multipleCycles = new EnvironmentSystem();
multipleCycles.setState({ cycleDays: 8, day: 5, progress: 0 });
multipleCycles.advance(8 * 60_000 * 2 + 60_000);
assert.equal(multipleCycles.getState().day, 22, 'long explicit elapsed deltas span multiple cycles');
assert.ok(Math.abs(multipleCycles.getState().progress - 1 / 8) < 1e-10);
assert.equal(multipleCycles.visualState().season, 'spring');

const invalid = new EnvironmentSystem();
for (const value of [0, -1, NaN, Infinity, -Infinity]) {
  const before = invalid.getState();
  assert.equal(invalid.advance(value), false, 'invalid elapsed time should be ignored');
  assert.deepEqual(invalid.getState(), before);
}

console.log('Environment day accumulation, bounded 50ms frames, multi-cycle elapsed time and save/load: ok');
