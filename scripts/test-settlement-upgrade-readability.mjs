import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [settlementStyle, game, windmill, docs, captureStrip] = await Promise.all([
  readFile(new URL('../src/rendering/SettlementStyle.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/ThreeGame.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/systems/WindmillSystem.ts', import.meta.url), 'utf8'),
  readFile(new URL('../docs/visual-upgrade-language.md', import.meta.url), 'utf8'),
  readFile(new URL('./capture-settlement-upgrade-strips.mjs', import.meta.url), 'utf8'),
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
assert.match(captureStrip, /add\(7 \+ \(level - 1\) \* 3, 5, 'cottage', level\)/,
  'Normal-zoom residential QA must exercise canonical cottage Levels 1–4.');
assert.doesNotMatch(captureStrip, /\['cottage', 'house', 'manor', 'villa'\]\.forEach/,
  'Visual QA must not model the old residential variants as parallel build choices.');

for (const method of ['makeFarm', 'makeCowBarn', 'makeArmyCamp', 'makeHarbor']) {
  const start = game.indexOf(`private ${method}(`);
  assert.notEqual(start, -1, `Missing ${method}`);
  const end = game.indexOf('\n  private ', start + 12);
  const block = game.slice(start, end === -1 ? undefined : end);
  assert.match(block, /upgradeVisualProfile\(normalizedLevel\)/, `${method} must use the shared four-level profile.`);
}

assert.match(game, /settlementFamily = 'market'/);
assert.match(game, /settlementReadabilityClass = 'landmark'/);
assert.match(game, /settlementFamily = 'basilica'/);
assert.match(windmill, /settlementFamily = 'windmill'/);
assert.match(windmill, /settlementReadabilityClass = 'landmark'/);

assert.match(docs, /Settlement application \(#132\)/);
assert.match(docs, /Cottage Cluster → House Cluster → Manor → Villa District/);
assert.match(docs, /Only Level 1 is exposed as a normal residential build tool/);
assert.match(docs, /Market, Basilica, and Windmill remain fixed-role landmarks/);

console.log('Settlement four-level visual readability checks passed.');
