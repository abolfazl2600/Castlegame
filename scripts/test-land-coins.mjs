import assert from 'node:assert/strict';
import { LandCoinSystem, LAND_PARCEL_PRICE, COIN_EARN_INTERVAL_MS, starterOwnedColumns } from '../src/systems/LandCoinSystem.ts';

const small = { cols: 23, rows: 23 };
const large = { cols: 50, rows: 89 };
assert.equal(starterOwnedColumns(small), 12);
assert.equal(starterOwnedColumns(large), 25);
const coins = new LandCoinSystem();
assert.equal(coins.balance, 0);
for (let y = 0; y < small.rows; y++) {
  for (let x = 0; x < small.cols; x++) {
    assert.equal(coins.isOwned(x, y, small), x < 12, `starter half at ${x},${y}`);
  }
}
assert.equal(coins.isOwned(-1, 0, small), false);
assert.equal(coins.isOwned(23, 0, small), false);
assert.equal(coins.purchase(13, 3, small), 'insufficient');

for (let i = 0; i < 29; i++) assert.equal(coins.tick(1000, true), false);
assert.equal(coins.tick(1000, true), true);
assert.equal(coins.balance, 1);
assert.equal(coins.tick(1_000_000, false), false, 'background time is never paid');
assert.equal(coins.tick(1_000_000, true), false, 'suspended-frame time must be clamped');
assert.equal(coins.balance, 1);
for (let i = 0; i < 270; i++) coins.tick(1000, true);
assert.equal(coins.balance, LAND_PARCEL_PRICE);
const bought = coins.parcelAt(13, 3, small);
assert.equal(bought?.x, 12);
assert.equal(bought?.y, 0);
assert.equal(bought?.cols, 4);
assert.equal(bought?.rows, 4);
assert.equal(coins.purchase(13, 3, small), 'purchased');
assert.equal(coins.balance, 0);
assert.equal(coins.purchase(15, 2, small), 'owned');
assert.equal(coins.isOwned(15, 3, small), true);
assert.equal(coins.isOwned(16, 3, small), false);
assert.equal(coins.hasOwnership([{ x: 11, y: 2 }, { x: 12, y: 2 }], small), true);
assert.equal(coins.hasOwnership([{ x: 15, y: 2 }, { x: 16, y: 2 }], small), false);
assert.equal(coins.purchase(2, 2, small), 'invalid');
assert.equal(coins.parcelAt(22, 22, small)?.cols, 3);
assert.equal(coins.parcelAt(22, 22, small)?.rows, 3);

const save = coins.getState();
const loaded = new LandCoinSystem();
loaded.setState(save);
assert.deepEqual(loaded.getState(), save);
assert.equal(loaded.isOwned(13, 3, small), true);
assert.equal(loaded.balance, coins.balance);
const old = new LandCoinSystem();
old.setState(undefined);
assert.equal(old.balance, 0);
assert.equal(old.isOwned(11, 11, small), true);
assert.equal(old.isOwned(12, 11, small), false);
old.setState({ coins: Infinity, playedMsRemainder: -500, ownedParcels: ['0,0', '../../etc', '12,0'] });
assert.equal(old.balance, 0);
assert.equal(old.isOwned(12, 1, small), true);
assert.equal(old.getState().playedMsRemainder, 0);
assert.equal(coins.parcels(large).filter(p => !p.owned).length, 161);
console.log('Land coins: default half, parcel bounds, payment, foreground-only timer, save migration and tamper checks passed.');
