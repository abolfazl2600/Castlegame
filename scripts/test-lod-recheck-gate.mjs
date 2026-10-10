import assert from 'node:assert/strict';
import { OverBudgetRecheckGate } from '../src/rendering/OverBudgetRecheckGate.ts';

const gate = new OverBudgetRecheckGate();
assert.equal(gate.shouldReapply(499, 500, 0), false, 'within budget should not rescan');
assert.equal(gate.shouldReapply(800, 500, 16), true, 'first excess must be inspected');
for (let frame = 2; frame <= 599; frame += 1) {
  assert.equal(gate.shouldReapply(800, 500, frame * 16), false,
    'unchanged protected-geometry overload must not cause a scan every frame');
}
assert.equal(gate.shouldReapply(800, 500, 10_100), true,
  'bounded periodic check must catch non-significant accumulated scene changes');
assert.equal(gate.shouldReapply(830, 500, 10_400), false,
  'growth must respect cooldown and avoid repeated frame spikes');
assert.equal(gate.shouldReapply(830, 500, 10_900), true,
  'significant sustained growth should trigger re-budgeting');
assert.equal(gate.shouldReapply(831, 500, 11_700), false,
  'unchanged load after a growth-triggered scan should stabilize again');
assert.equal(gate.shouldReapply(450, 500, 11_800), false,
  'falling below cap must reset the over-budget gate');
assert.equal(gate.shouldReapply(530, 500, 11_900), true,
  'crossing the cap again must request a fresh evaluation');
gate.reset();
assert.equal(gate.shouldReapply(530, 500, 12_000), true,
  'explicit scene/quality invalidation must allow immediate re-evaluation');
assert.equal(gate.shouldReapply(NaN, 500, 12_100), false, 'invalid render info must reset the gate');

const quality = new OverBudgetRecheckGate();
assert.equal(quality.shouldReapply(1010, 1000, 0), true);
assert.equal(quality.shouldReapply(1040, 1000, 1000), false,
  'quality mode should not rescan for jitter below its proportional growth threshold');
assert.equal(quality.shouldReapply(1051, 1000, 2000), true,
  'quality mode should react to an increase above its growth threshold');

const stress = new OverBudgetRecheckGate();
let attempts = 0;
for (let frame = 0; frame < 600; frame += 1) {
  if (stress.shouldReapply(720, 500, frame * 16)) attempts += 1;
}
assert.equal(attempts, 1, '600 stable over-cap frames should cause only one pressure retry, not 600');
console.log(`Protected-scene synthetic stress: 600 over-cap frames -> ${attempts} LOD retry (previously 600).`);
console.log('LOD pressure hysteresis, growth responsiveness and invalidation contracts: ok');
