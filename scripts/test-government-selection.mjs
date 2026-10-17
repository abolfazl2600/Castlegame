import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  GOVERNMENTS, GovernmentSystem, governmentDefinition, normalizeGovernmentState,
} from '../src/systems/GovernmentSystem.ts';

assert.deepEqual(GOVERNMENTS.map((entry) => entry.kind), [
  'kingdom', 'republic', 'sultanate', 'military',
]);
assert.equal(new Set(GOVERNMENTS.map((entry) => entry.flagColor)).size, 4);
assert.equal(new Set(GOVERNMENTS.map((entry) => entry.titleFa)).size, 4);
assert.equal(governmentDefinition('sultanate').titleFa, 'سلطان');

const government = new GovernmentSystem();
assert.deepEqual(government.getState(), { version: 1, kind: 'kingdom', realmName: '' });
government.setState({ kind: 'republic', realmName: '  سرزمین من  ' });
assert.deepEqual(government.getState(), { version: 1, kind: 'republic', realmName: 'سرزمین من' });
const snapshot = government.getState();
snapshot.realmName = 'changed';
assert.equal(government.getState().realmName, 'سرزمین من');
const loaded = new GovernmentSystem();
loaded.setState(government.getState());
assert.deepEqual(loaded.getState(), government.getState());
assert.equal(normalizeGovernmentState({ kind: 'unknown', realmName: 'x' }).kind, 'kingdom');
assert.equal(normalizeGovernmentState({ kind: 'military', realmName: '<tag>' }).kind, 'military');
assert.equal(normalizeGovernmentState({ realmName: 'x'.repeat(90) }).realmName.length, 40);
government.reset();
assert.equal(government.getState().kind, 'kingdom');

const source = readFileSync(new URL('../src/ThreeGame.ts', import.meta.url), 'utf8');
const save = readFileSync(new URL('../src/core/SaveSystem.ts', import.meta.url), 'utf8');
const ui = readFileSync(new URL('../src/ui/GovernmentSelectionUI.ts', import.meta.url), 'utf8');
const types = readFileSync(new URL('../src/core/types.ts', import.meta.url), 'utf8');
const method = (name) => {
  const start = source.indexOf('  private ' + name + '(');
  assert.ok(start >= 0, name);
  const end = source.indexOf('\n  private ', start + 1);
  return source.slice(start, end < 0 ? source.length : end);
};
assert.match(method('openMapLayoutSelector'), /openGovernmentSelector/);
assert.match(method('openGovernmentSelector'), /governmentUI.open/);
assert.match(method('startNewGame'), /government.setState\(government\)/);
assert.match(source, /data-template[\s\S]*?this.openGovernmentSelector\(\(government\)/);
assert.match(source, /data-terrain-template[\s\S]*?this.openGovernmentSelector\(\(government\)/);
assert.match(source, /this.addGovernmentFlag\(renderedKeep\)/);
assert.match(source, /setGovernmentState: \(value\) =>/);
assert.match(save, /government: this.host.getGovernmentState\?\.\(\)/);
assert.match(save, /setGovernmentState\?\.\(data.government\)/);
assert.match(save, /government: raw.government/);
assert.match(save, /government: parsed.government/);
assert.match(types, /government\?: GovernmentState/);
assert.match(ui, /role="dialog"/);
assert.match(ui, /data-government-back/);
assert.match(ui, /name = 'government-kind'/);
assert.doesNotMatch(source, /getGovernmentState:\s*\(\)\s*=>\s*this\.services\.economySystem/);
console.log('Government selection, normalization, save contract, map/template routes and flag checks: ok');
