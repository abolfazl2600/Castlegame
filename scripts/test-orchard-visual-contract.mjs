import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [orchard, game] = await Promise.all([
  readFile(new URL('../src/systems/OrchardSystem.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/ThreeGame.ts', import.meta.url), 'utf8'),
]);

assert.match(orchard, /import \{ WORLD_STYLE \} from '\.\.\/rendering\/WorldStyle'/);
assert.match(orchard, /orchardVisualVersion = 2/);
assert.match(orchard, /fieldScale: 3\.34, columns: 3, rows: 3/);
assert.match(orchard, /fieldScale: 3\.58, columns: 4, rows: 3/);
assert.match(orchard, /fieldScale: 3\.82, columns: 4, rows: 4/);
assert.match(orchard, /private addPlantingRows/);
assert.match(orchard, /private addFence/);
assert.match(orchard, /private addEntrancePath/);
assert.match(orchard, /private addProduceCrate/);
assert.match(orchard, /const entranceGap = 0\.9/);
assert.match(orchard, /private readonly unitBox = new THREE\.BoxGeometry\(1, 1, 1\)/);
assert.match(orchard, /private readonly canopyGeometry = new THREE\.DodecahedronGeometry/);
assert.match(orchard, /private readonly appleGeometry = new THREE\.SphereGeometry/);
assert.doesNotMatch(orchard, /entrance\.visible\s*=\s*false/);

assert.match(
  game,
  /cell\.kind === 'appleOrchard'\) this\.services\.orchardSystem\.create\(group, cell\.level \?\? 1, cell\.x \* 97 \+ cell\.y \* 53\)/,
);
assert.match(game, /setCell\(gx, gy, 'appleOrchard', size\)/);

console.log('Apple Orchard visual contract checks passed.');
