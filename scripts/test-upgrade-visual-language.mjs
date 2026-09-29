import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [language, game, docs] = await Promise.all([
  readFile(new URL('../src/rendering/UpgradeVisualLanguage.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/ThreeGame.ts', import.meta.url), 'utf8'),
  readFile(new URL('../docs/visual-upgrade-language.md', import.meta.url), 'utf8'),
]);

for (const level of [1, 2, 3, 4]) {
  assert.match(language, new RegExp(`\\n  ${level}: \\{`), `Missing visual upgrade Level ${level}`);
}
for (const name of ['basic', 'established', 'advanced', 'landmark']) {
  assert.match(language, new RegExp(`name: '${name}'`), `Missing progression name ${name}`);
}

assert.match(language, /massingScale:/);
assert.match(language, /verticalityScale:/);
assert.match(language, /workingAreaScale:/);
assert.match(language, /roofComplexity:/);
assert.match(language, /materialTier:/);
assert.match(language, /maxSecondaryProps:/);
assert.match(language, /maxAmbientAnimatedElements:/);
assert.match(language, /maxSilhouetteElements:/);
assert.match(language, /activityMultiplier:/);
assert.match(language, /allowEmissiveAccent:/);
assert.match(language, /medieval:/);
assert.match(language, /modern:/);

const propBudgets = [...language.matchAll(/maxSecondaryProps:\s*(\d+)/g)].map((m) => Number(m[1]));
const animationBudgets = [...language.matchAll(/maxAmbientAnimatedElements:\s*(\d+)/g)].map((m) => Number(m[1]));
assert.deepEqual(propBudgets, [4, 7, 10, 14], 'Secondary prop budgets must stay explicitly bounded.');
assert.deepEqual(animationBudgets, [1, 2, 3, 4], 'Animation budgets must stay explicitly bounded.');

for (const method of ['makeFarm', 'makeCowBarn', 'makeArmyCamp', 'makeHarbor']) {
  const start = game.indexOf(`private ${method}(`);
  assert.notEqual(start, -1, `Missing representative renderer ${method}`);
  const end = game.indexOf('\n  private ', start + 12);
  const block = game.slice(start, end === -1 ? undefined : end);
  assert.match(
    block,
    /upgradeVisualProfile\(normalizedLevel\)/,
    `${method} must attach the shared visual progression profile.`,
  );
}

assert.match(docs, /silhouette → proportion\/material → activity → props/);
assert.match(docs, /Crop Farm:/);
assert.match(docs, /Cattle Farm:/);
assert.match(docs, /Army Camp:/);
assert.match(docs, /Harbor:/);
assert.match(docs, /Modern guidance/);
assert.match(docs, /Performance rule/);

console.log('Shared four-level visual upgrade language checks passed.');
