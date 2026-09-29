import assert from 'node:assert/strict';
import { EnvironmentSystem } from '../src/systems/EnvironmentSystem.ts';

const system = new EnvironmentSystem();
system.setState({ cycleDays: 48, day: 12, progress: 0.49 });
const saved = system.getState();

const restored = new EnvironmentSystem();
restored.setState(saved);
assert.deepEqual(restored.getState(), saved, 'environment state must round-trip');

const before = restored.visualState();
restored.advance(1000);
const after = restored.visualState();
assert.notEqual(after.localProgress, before.localProgress, 'season progress should advance gradually');

restored.setState({ cycleDays: 48, day: 0, progress: 0 });
assert.equal(restored.visualState().season, 'spring');
restored.setState({ cycleDays: 48, day: 0, progress: 0.26 });
assert.equal(restored.visualState().season, 'summer');
restored.setState({ cycleDays: 48, day: 0, progress: 0.51 });
assert.equal(restored.visualState().season, 'autumn');
restored.setState({ cycleDays: 48, day: 0, progress: 0.76 });
assert.equal(restored.visualState().season, 'winter');

console.log('seasonal environment regression checks passed');
