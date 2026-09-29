import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [scene, qa, game, ambientMotion, worldStyle, docs] = await Promise.all([
  readFile(new URL('./visual-reference-scene.mjs', import.meta.url), 'utf8'),
  readFile(new URL('./final-visual-coherence-qa.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../src/ThreeGame.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/rendering/AmbientMotionSystem.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/rendering/WorldStyle.ts', import.meta.url), 'utf8'),
  readFile(new URL('../docs/visual-audits/issue-137/README.md', import.meta.url), 'utf8'),
]);

for (const name of ['starter', 'dense', 'castle', 'farm', 'harbor', 'modern']) {
  assert.match(
    scene,
    new RegExp(`FINAL_QA_SCENES[^]*['"]${name}['"]`),
    `Final QA must include the ${name} fixture.`,
  );
}

assert.match(
  scene,
  /northDamage = x === 8 \? 0\.22 : x === 10 \? 0\.54 : x === 12 \? 0\.84 : 0/,
  'Castle QA fixture must include damaged, heavy and partial wall states.',
);
assert.match(scene, /cell\(x, 6, 'farm', level\)/);
assert.match(scene, /cell\(x, 10, 'cowBarn', level\)/);
assert.match(scene, /cell\(x, 14, 'appleOrchard', level\)/);
assert.match(scene, /cell\(x, 18, 'armyCamp', level\)/);
assert.match(scene, /cell\(5, 16, 'harbor', 1/);
assert.match(scene, /cell\(14, 16, 'harbor', 4/);
assert.match(scene, /gameMode: definition\.mode/);
assert.match(
  scene,
  /function modernCells\(\)[\s\S]*futuristicCastle/,
  'Modern QA fixture must render the supported Futuristic Castle family.',
);
assert.match(
  scene,
  /if \(kind === 'modern'\) return \{ mode: 'modern'/,
  'Modern QA fixture must load through Modern Mode.',
);

assert.match(qa, /width:\s*740,\s*height:\s*390/);
assert.match(qa, /starter-normal-mobile-landscape/);
assert.match(qa, /castle-battle-normal-desktop/);
assert.match(qa, /dense-strategic-desktop/);
assert.match(qa, /knownFocusedFollowups:\s*\[135, 136\]/);
assert.match(qa, /maxUiCoverage/);
assert.match(qa, /maxFrameP95Ms/);
assert.match(qa, /maxDrawCalls/);
assert.match(qa, /maxTriangles/);
assert.match(qa, /maxSceneMaterials/);
assert.match(qa, /maxRedrawMs/);
assert.match(qa, /performanceFollowupRequired/);
assert.match(qa, /productionBudgetPassed/);
assert.match(qa, /hardViolations/);

assert.match(worldStyle, /nearInspection:\s*48/);
assert.match(worldStyle, /normalGameplay:\s*104/);
assert.match(worldStyle, /maximumStrategic:\s*148/);

const animateStart = game.indexOf('private animate(time: number): void {');
assert.notEqual(animateStart, -1);
const animate = game.slice(animateStart);
assert.match(
  animate,
  /const ambientScale = this\.ambientMotion\.update/,
  'Ambient motion must be routed through the shared motion layer.',
);
assert.match(animate, /effectsEnabled: settings\.graphics\.effectsEnabled/);
assert.match(animate, /reducedMotion: settings\.interface\.reducedMotion/);
assert.match(
  ambientMotion,
  /if \(!options\.effectsEnabled \|\| options\.reducedMotion\) return 0/,
  'Ambient motion must remain gated by reduced-motion/effects settings.',
);
assert.match(animate, /windmillSystem\.update/);
assert.match(ambientMotion, /registerTextureFlow/);
assert.match(ambientMotion, /registerFlag/);
assert.doesNotMatch(animate, /riverTexture\.offset/);
assert.doesNotMatch(animate, /oceanTexture\.offset/);

assert.match(docs, /#134 is now complete/);
assert.match(docs, /#135/);
assert.match(docs, /#136/);
assert.match(docs, /not marked complete/i);
assert.match(docs, /#136 production performance targets/);

console.log('Final visual coherence QA contract checks passed.');
