import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [orchard, game] = await Promise.all([
  readFile(new URL('../src/systems/OrchardSystem.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/ThreeGame.ts', import.meta.url), 'utf8'),
]);

assert.match(orchard, /import \{ WORLD_STYLE \} from '\.\.\/rendering\/WorldStyle'/);
assert.match(orchard, /orchardVisualVersion = 4/);
assert.match(orchard, /fieldScale: 3\.34, columns: 3, rows: 3/);
assert.match(orchard, /fieldScale: 3\.58, columns: 4, rows: 3/);
assert.match(orchard, /fieldScale: 3\.82, columns: 4, rows: 4/);
assert.match(orchard, /fieldScale: 4\.02, columns: 5, rows: 4/);
assert.match(orchard, /MathUtils\.clamp\(Math\.floor\(size\), 1, 4\)/);
assert.match(orchard, /upgradeVisualProfile\(orchardSize\)/);
assert.match(orchard, /activeOrchard = true/);
assert.match(orchard, /const readabilityAnchor =/);
assert.match(orchard, /trunkMesh\.userData\.distanceDetailPriority = 'silhouette'/);
assert.match(orchard, /mainCanopy\.userData\.distanceDetailPriority = 'silhouette'/);
assert.match(orchard, /private addEntranceTrellis/);
assert.match(orchard, /private addPackingShed/);
assert.match(orchard, /orchardLandmark = 'packing-shed'/);
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
assert.match(game, /Math\.min\(4, \(cell\?\.level \?\? 1\) \+ 1\)/);
assert.match(game, /1 \+ \(\(gx \* 7 \+ gy \* 11\) % 4\)/);

console.log('Apple Orchard visual contract checks passed.');
