import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/battle/MilitaryProgression.ts', import.meta.url), 'utf8');

assert.ok(source.includes('export type MilitaryTier = 1 | 2 | 3 | 4'));
for (const name of ['Field Camp', 'Reinforced Camp', 'Command Camp', 'Royal War Camp']) {
  assert.ok(source.includes(`name: '${name}'`), `Missing military level: ${name}`);
}

const multiplierNames = [
  'unitHealthMultiplier',
  'unitDefenseMultiplier',
  'unitDamageMultiplier',
  'unitMoveSpeedMultiplier',
  'unitScanRangeMultiplier',
  'wallHealthMultiplier',
  'weaponRangeMultiplier',
  'weaponDamageMultiplier',
];

for (const multiplierName of multiplierNames) {
  const pattern = new RegExp(multiplierName + ': ([0-9.]+)', 'g');
  const values = [...source.matchAll(pattern)].map((match) => Number(match[1]));
  assert.equal(values.length, 4, multiplierName + ' must be defined for all four levels');
  for (let index = 1; index < values.length; index += 1) {
    assert.ok(values[index] >= values[index - 1], multiplierName + ' must not regress at a higher level');
  }
}

const cooldowns = [...source.matchAll(/weaponCooldownMultiplier: ([0-9.]+)/g)].map((match) => Number(match[1]));
assert.equal(cooldowns.length, 4);
for (let index = 1; index < cooldowns.length; index += 1) {
  assert.ok(cooldowns[index] <= cooldowns[index - 1], 'higher levels must not fire wall weapons more slowly');
}

assert.ok(source.includes('attack: Math.round(base.attack * definition.unitDamageMultiplier)'));
assert.ok(source.includes('damage: Math.round(base.damage * definition.unitDamageMultiplier)'));
assert.ok(source.includes('moveSpeed: Number'));
assert.ok(source.includes('scanRange: Number'));

console.log('Military progression follows the four Army Camp building levels.');
