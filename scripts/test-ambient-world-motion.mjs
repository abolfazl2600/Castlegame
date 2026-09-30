import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [ambient, game, orchard, docs] = await Promise.all([
  readFile(new URL('../src/rendering/AmbientMotionSystem.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/ThreeGame.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/systems/OrchardSystem.ts', import.meta.url), 'utf8'),
  readFile(new URL('../docs/ambient-world-motion.md', import.meta.url), 'utf8'),
]);

for (const method of [
  'registerTextureFlow',
  'registerFlag',
  'registerSway',
  'registerBob',
  'registerSmoke',
  'clearSceneBound',
  'motionScale',
  'stats',
]) {
  assert.match(ambient, new RegExp(`\\b${method}\\b`), `AmbientMotionSystem missing ${method}`);
}

assert.match(ambient, /if \(!options\.effectsEnabled \|\| options\.reducedMotion\) return 0/);
assert.match(ambient, /options\.quality === 'low'/);
assert.match(ambient, /options\.environmentDetail === 'low'/);
assert.match(ambient, /options\.performanceMode === 'performance'/);
assert.match(ambient, /options\.cameraDistance > normal/);
assert.match(ambient, /options\.cameraDistance >= strategic/);
assert.match(ambient, /return 3;[\s\S]*return 2;[\s\S]*return 1;/);
assert.match(ambient, /restoreEntries\(this\.flags\)/);
assert.match(ambient, /this\.flags\.length = 0/);
assert.match(ambient, /this\.sways\.length = 0/);
assert.match(ambient, /this\.bobs\.length = 0/);
assert.match(ambient, /this\.smokes\.length = 0/);

assert.match(game, /private readonly ambientMotion = new AmbientMotionSystem\(\)/);
assert.doesNotMatch(ambient, /\b(?:CloudDrift|registerCloud|clouds)\b/, 'Cloud motion must not be registered or updated.');
assert.doesNotMatch(game, /\b(?:ambientCloud|createAmbientWorld|ambientLayer|registerCloud)\b/, 'Cloud meshes and their scene layer must be removed.');
assert.match(game, /registerTextureFlow\(this\.riverTexture, 0\.000035, -0\.00032\)/);
assert.match(game, /registerTextureFlow\(this\.oceanTexture, 0\.000018, -0\.000012\)/);

const redraw = game.slice(game.indexOf('private redraw(): void'), game.indexOf('private renderMinimap(): void'));
assert.match(redraw, /ambientMotion\.clearSceneBound\(\)/);
assert.match(redraw, /ambientMotion\.registerFlag/);
assert.match(redraw, /ambientMotion\.registerSway/);

assert.match(game, /ambientMotion\.registerSway\(crown/);
assert.match(orchard, /tree\.userData\.ambientSway/);
assert.match(game, /ambient-chimney-smoke/);
assert.match(game, /ambientMotion\.registerSmoke\(smoke/);
assert.match(game, /ambientMotion\.registerBob\(/);
assert.match(game, /ambientMotion\.registerSway\([\s\S]*flame/);
assert.match(game, /ambientMotion: this\.ambientMotion\.stats\(\)/);

const animate = game.slice(game.indexOf('private animate(time: number)'), game.lastIndexOf('\n}'));
assert.match(animate, /updateSettlementAgents\(deltaMs\)/, 'Gameplay NPC motion must remain outside the decorative motion gate.');
assert.match(animate, /const ambientScale = this\.ambientMotion\.update/);
assert.match(
  animate,
  /const cameraDistance = this\.camera\.position\.distanceTo\(this\.controls\.target\)/,
  'Animation loop must derive camera distance from the active camera target.',
);
assert.match(
  animate,
  /(?:cameraDistance,|cameraDistance:\s*this\.camera\.position\.distanceTo\(this\.controls\.target\))/,
  'Ambient motion must receive the current camera distance.',
);
assert.match(animate, /normalDistance: WORLD_STYLE\.camera\.referenceDistances\.normalGameplay/);
assert.match(animate, /strategicDistance: WORLD_STYLE\.camera\.referenceDistances\.maximumStrategic/);
assert.match(animate, /windmillSystem\.update\(\(deltaMs \/ 1000\) \* ambientScale\)/);
assert.doesNotMatch(animate, /riverTexture\.offset/);
assert.doesNotMatch(animate, /oceanTexture\.offset/);
assert.doesNotMatch(game, /animatedFlags/);

assert.match(docs, /Real farmer and citizen movement remains owned by the settlement simulation/);
assert.match(docs, /maximum strategic/);
assert.match(docs, /Reduced Motion/);
assert.match(docs, /Scene-bound registrations are cleared before/);

console.log('Ambient world motion is centralized, accessibility-aware, distance-aware, and redraw-safe.');
