import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const system = readFileSync(new URL('../src/rendering/AmbientShipSystem.ts', import.meta.url), 'utf8');
const game = readFileSync(new URL('../src/ThreeGame.ts', import.meta.url), 'utf8');

assert.match(system, /terrainAt\(x, y\) === 'water'/, 'ambient ship routes must be restricted to water cells');
assert.match(system, /cells < 9/, 'ambient ship should require a long continuous water lane');
assert.match(system, /reducedMotion/, 'ambient ship movement must honor reduced-motion settings');
assert.match(system, /ambient-ship-fine-detail/, 'ambient ship should expose a distance-budgeted fine-detail group');
assert.match(system, /addRigging/, 'ambient ship should include rigging detail');
assert.match(system, /addSail/, 'ambient ship should include multiple sail meshes');
assert.match(system, /ambient-ship-wake/, 'ambient ship should render a subtle wake while moving');
assert.match(system, /this\.route\?\.signature === nextRoute\.signature/, 'redraws should not reset an unchanged ship route');

assert.match(game, /new AmbientShipSystem\(/, 'ThreeGame must instantiate the ambient ship system');
assert.match(game, /this\.scene\.add\(this\.ambientShip\.layer\)/, 'ambient ship layer must be attached to the scene');
assert.match(game, /this\.ambientShip\.rebuild\(this\.worldSeed\)/, 'ambient ship route must rebuild with world terrain');
assert.match(game, /this\.ambientShip\.update\(deltaMs, time,/, 'ambient ship must be updated from the animation loop');
assert.match(game, /ambientShips: this\.ambientShip\.count/, 'performance diagnostics must report ambient ship count');

console.log('ambient ship contract: ok');
