import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AdaptiveRenderProfile } from '../src/rendering/AdaptiveRenderProfile.ts';
import { createDefaultSettings } from '../src/settings/SettingsModel.ts';

assert.equal(createDefaultSettings().graphics.performanceMode, 'auto', 'new installs start with Auto');

const adaptive = new AdaptiveRenderProfile();
const run = (count, interval, mode = 'auto') => {
  for (let frame = 0; frame < count; frame += 1) adaptive.recordFrame(interval, mode);
};

assert.equal(adaptive.resolve('auto'), 'balanced', 'Auto starts with balanced rendering');
run(45, 40);
assert.equal(adaptive.resolve('auto'), 'balanced', 'a short FPS drop must not downgrade');
run(60, 40);
assert.equal(adaptive.resolve('auto'), 'performance', 'sustained slow frames downgrade');
adaptive.recordFrame(2000, 'auto');
assert.equal(adaptive.resolve('auto'), 'performance', 'background gaps must not count as slow frames');
run(800, 16.67);
assert.equal(adaptive.resolve('auto'), 'performance', 'cooldown prevents immediate upgrading');
run(800, 16.67);
assert.equal(adaptive.resolve('auto'), 'balanced', 'stable recovery upgrades one level');
run(800, 16.67);
assert.equal(adaptive.resolve('auto'), 'balanced', 'upgrades cannot skip their cooldown');
run(800, 16.67);
assert.equal(adaptive.resolve('auto'), 'quality', 'long-term fast frames eventually reach Quality');
assert.equal(adaptive.resolve('performance'), 'performance', 'manual Performance is pinned');
run(1000, 16.67, 'performance');
assert.equal(adaptive.resolve('performance'), 'performance', 'manual Performance cannot upgrade');
assert.equal(adaptive.resolve('quality'), 'quality', 'manual Quality is pinned');
run(500, 40, 'quality');
assert.equal(adaptive.resolve('quality'), 'quality', 'manual Quality cannot downgrade');
assert.equal(adaptive.resolve('auto'), 'balanced', 're-entering Auto clears old history');

const game = readFileSync(new URL('../src/ThreeGame.ts', import.meta.url), 'utf8');
const ui = readFileSync(new URL('../src/settings/SettingsUI.ts', import.meta.url), 'utf8');
const budget = readFileSync(new URL('../src/rendering/DistanceDetailBudget.ts', import.meta.url), 'utf8');
const store = readFileSync(new URL('../src/settings/SettingsStore.ts', import.meta.url), 'utf8');

assert.doesNotMatch(game, /settings\.gameplay\.controlScheme === 'touch'/, 'Touch must not select graphics budget');
assert.doesNotMatch(game, /window\.innerWidth <= 760/, 'Viewport width must not select graphics budget');
assert.match(game, /this\.adaptiveRenderProfile\.resolve\(settings\.graphics\.performanceMode\)/);
assert.match(budget, /budgetForProfile\(profile, this\.band\)/, 'LOD uses the active render preset');
assert.match(budget, /isSuppressibleMicroDetail/, 'LOD preserves non-suppressible geometry');
assert.match(ui, /<option value=\"auto\">Auto \(adaptive\)<\/option>/, 'Graphics UI exposes Auto');
assert.match(store, /performanceMode === 'auto'/, 'Auto must survive settings persistence');
console.log('adaptive render profile and independent touch controls: ok');
