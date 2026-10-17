import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks, stripTypeScriptTypes } from 'node:module';

registerHooks({
  resolve(specifier, context, next) {
    try { return next(specifier, context); }
    catch (error) {
      if (specifier.startsWith('.') && !specifier.endsWith('.ts')) return next(specifier + '.ts', context);
      throw error;
    }
  },
  load(url, context, next) {
    if (url.endsWith('.ts')) return {
      format: 'module',
      shortCircuit: true,
      source: stripTypeScriptTypes(readFileSync(new URL(url), 'utf8'), { mode: 'transform' }),
    };
    return next(url, context);
  },
});

const {
  LandProgression, LAND_PLOT_COUNT, LAND_PLOT_PRICE, LAND_COIN_REWARD,
  LAND_COIN_INTERVAL_MS, plotForCell,
} = await import('../src/world/LandProgression.ts');

const progression = new LandProgression();
assert.equal(LAND_PLOT_COUNT, 16);
assert.equal(progression.unlockedCount, 8, 'Exactly half of plots are unlocked initially');
assert.equal(progression.balance, 0, 'New players begin without coins');
assert.deepEqual(progression.snapshot().unlockedPlots, [1, 2, 5, 6, 9, 10, 13, 14]);
assert.equal(progression.isUnlockedAt(-1, 0, { cols: 23, rows: 23 }), false);
assert.equal(progression.isUnlockedAt(1000, 0, { cols: 23, rows: 23 }), false);

for (const grid of [{ cols: 23, rows: 23 }, { cols: 25, rows: 25 }, { cols: 50, rows: 89 }]) {
  const plots = progression.plots(grid);
  assert.equal(plots.length, 16);
  for (let y = 0; y < grid.rows; y++) {
    for (let x = 0; x < grid.cols; x++) {
      const id = plotForCell(x, y, grid);
      assert.ok(id !== null && id >= 0 && id < 16);
      const plot = plots[id];
      assert.ok(x >= plot.minX && x <= plot.maxX && y >= plot.minY && y <= plot.maxY);
      assert.equal(progression.isUnlockedAt(x, y, grid), progression.isUnlocked(id));
    }
  }
}
assert.equal(progression.tick(-100), false);
assert.equal(progression.tick(Infinity), false);
assert.equal(progression.tick(100_000), false, 'Huge background gaps must not grant coins');
assert.equal(progression.snapshot().activeTimeRemainderMs, 1000);
for (let i = 0; i < 59; i++) progression.tick(1000);
assert.equal(progression.balance, LAND_COIN_REWARD);
assert.equal(progression.snapshot().activeTimeRemainderMs, 0);
assert.equal(progression.buy(0), false, 'Plots cannot be purchased without sufficient balance');

for (let i = 0; i < (LAND_PLOT_PRICE / LAND_COIN_REWARD - 1) * LAND_COIN_INTERVAL_MS / 1000; i++) progression.tick(1000);
assert.equal(progression.balance, LAND_PLOT_PRICE);
assert.equal(progression.buy(0), true);
assert.equal(progression.balance, 0);
assert.equal(progression.isUnlocked(0), true);
assert.equal(progression.buy(0), false, 'Purchased plots cannot be bought twice');
assert.equal(progression.unlockedCount, 9);
const snapshot = progression.snapshot();

const restored = new LandProgression();
restored.restore(snapshot);
assert.deepEqual(restored.snapshot(), snapshot, 'Coin balance and purchases survive save/load');
restored.reset();
assert.equal(restored.unlockedCount, 8, 'New-game reset returns to eight free plots');

const legacy = new LandProgression();
legacy.restore(undefined, [{ x: 0, y: 0 }, { x: 22, y: 22 }], { cols: 23, rows: 23 });
assert.ok(legacy.isUnlockedAt(0, 0, { cols: 23, rows: 23 }), 'Legacy buildings remain accessible');
assert.ok(legacy.isUnlockedAt(22, 22, { cols: 23, rows: 23 }));
assert.equal(legacy.balance, 0);

const malformed = new LandProgression();
malformed.restore({ coins: -20, activeTimeRemainderMs: -5000, unlockedPlots: [-1, 999, 1.5, 0] });
assert.equal(malformed.balance, 0);
assert.equal(malformed.unlockedCount, 9, 'Invalid plot IDs are ignored');
assert.equal(malformed.snapshot().activeTimeRemainderMs, 0);

console.log('Land progression: timed coins, all layouts, purchases, legacy migrations and save/load passed');
