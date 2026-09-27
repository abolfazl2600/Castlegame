import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const baseline = readFileSync(new URL('./visual-baseline.mjs', import.meta.url), 'utf8');

for (const capture of [
  'dense-normal-desktop',
  'combat-normal-desktop',
  'combat-reduced-motion-desktop',
  'combat-panel-mobile',
]) {
  assert.match(baseline, new RegExp(capture), `Visual baseline must capture ${capture}`);
}

assert.match(baseline, /BATTLE_SETUP/, 'Visual baseline must use a fixed representative battle setup');
assert.match(baseline, /battle:\s*true/, 'Visual baseline must benchmark live combat');
assert.match(baseline, /effectsEnabled:\s*false/, 'Visual baseline must verify effects-disabled combat');
assert.match(baseline, /reducedMotion:\s*true/, 'Visual baseline must verify reduced-motion combat');
assert.match(baseline, /\['low', 'medium', 'high'\]/, 'Visual baseline must cover every graphics quality');
assert.match(baseline, /battleState/, 'Visual metrics must record the observed battle state');

console.log('Phase-5 visual audit covers dense, combat, mobile, quality and motion/effects settings.');
