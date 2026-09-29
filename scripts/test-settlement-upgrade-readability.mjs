import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [settlementStyle, game, orchard, windmill, docs] = await Promise.all([
  readFile(new URL('../src/rendering/SettlementStyle.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/ThreeGame.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/systems/OrchardSystem.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/systems/WindmillSystem.ts', import.meta.url), 'utf8'),
  readFile(new URL('../docs/visual-upgrade-language.md', import.meta.url), 'utf8'),
]);

for (const [kind, level] of [
  ['cottage', 1],
  ['house', 2],
  ['manor', 3],
  ['villa', 4],
]) {
  assert.match(
    settlementStyle,
    new RegExp(`\\b${kind}: ${level},`),
    `Residential progression must map ${kind} to visual level ${level}.`,
  );
}
assert.match(settlementStyle, /RESIDENCE_VISUAL_VARIANTS/);
assert.match(game, /RESIDENCE_VISUAL_LEVELS\[kind\]/);
assert.match(game, /upgradeVisualProfile\(visualLevel\)/);
assert.match(game, /residenceLandmark = 'corner-cupola'/);

for (const method of ['makeFarm', 'makeCowBarn', 'makeArmyCamp', 'makeHarbor']) {
  const start = game.indexOf(`private ${method}(`);
  assert.notEqual(start, -1, `Missing ${method}`);
  const end = game.indexOf('\n  private ', start + 12);
  const block = game.slice(start, end === -1 ? undefined : end);
  assert.match(block, /upgradeVisualProfile\(normalizedLevel\)/, `${method} must use the shared four-level profile.`);
}

assert.match(orchard, /MathUtils\.clamp\(Math\.floor\(size\), 1, 4\)/);
assert.match(orchard, /upgradeVisualProfile\(orchardSize\)/);
assert.match(orchard, /'young-grove'[\s\S]*'working-orchard'[\s\S]*'mature-orchard'[\s\S]*'estate-orchard'/);
assert.match(orchard, /fieldScale: 4\.02, columns: 5, rows: 4/);
assert.match(orchard, /private addEntranceTrellis/);
assert.match(orchard, /private addPackingShed/);
assert.match(orchard, /orchardLandmark = 'packing-shed'/);
assert.match(game, /Math\.min\(4, \(cell\?\.level \?\? 1\) \+ 1\)/);
assert.match(game, /1 \+ \(\(gx \* 7 \+ gy \* 11\) % 4\)/);

assert.match(game, /settlementFamily = 'market'/);
assert.match(game, /settlementReadabilityClass = 'landmark'/);
assert.match(game, /settlementFamily = 'basilica'/);
assert.match(windmill, /settlementFamily = 'windmill'/);
assert.match(windmill, /settlementReadabilityClass = 'landmark'/);

assert.match(docs, /Settlement application \(#132\)/);
assert.match(docs, /Cottage → House → Manor → Villa/);
assert.match(docs, /Estate Orchard/);
assert.match(docs, /Market, Basilica, and Windmill remain fixed-role landmarks/);

console.log('Settlement four-level visual readability checks passed.');
