import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { GameplayFeedbackSystem } from '../src/rendering/GameplayFeedbackSystem.ts';
import { AUDIO_ASSETS } from '../src/audio/AudioAssets.ts';

const feedback = new GameplayFeedbackSystem();
feedback.spawn('construction', 4, 2, 8, 'low');
assert.ok(feedback.count >= 4, 'Construction must create a ring and visible sparks');
assert.equal(feedback.layer.children.length, feedback.count);

const geometryTypes = new Set(feedback.layer.children.map((child) => child.geometry.type));
assert.ok(geometryTypes.has('RingGeometry'));
assert.ok(geometryTypes.has('OctahedronGeometry'));

for (let i = 0; i < 100; i += 1) feedback.spawn('impact', i, 2, 0, 'low');
assert.ok(feedback.count <= 36, 'Low-quality scenes must have a strict particle cap');

feedback.update(16, true);
for (const object of feedback.layer.children) {
  assert.ok(Number.isFinite(object.scale.x) && object.scale.x > 0);
}
feedback.update(16, false);
assert.equal(feedback.count, 0, 'Disabling effects must immediately clear live visuals');

feedback.spawn('destruction', 0, 0, 0, 'medium');
assert.ok(feedback.count > 0);
for (let i = 0; i < 120; i += 1) feedback.update(16, true);
assert.equal(feedback.count, 0, 'All transient particles must retire without timers');

feedback.spawn('victory', 0, 0, 0, 'high');
assert.ok(feedback.count > 10, 'Victory should have a visibly richer burst');
feedback.spawn('impact', NaN, 0, 0, 'high');
feedback.spawn('impact', 0, Infinity, 0, 'high');
feedback.clear();
assert.equal(feedback.count, 0, 'Clearing the scene must release burst references');
feedback.dispose();

for (const id of [
  'building.place',
  'building.started',
  'building.complete',
  'building.destroyed',
  'combat.melee-hit',
  'combat.projectile-impact',
  'combat.wall-hit',
  'combat.wall-destroyed',
  'combat.victory',
]) {
  const cue = AUDIO_ASSETS.find((entry) => entry.id === id);
  assert.ok(cue?.tone, `The sound manifest must include event-driven ${id}`);
  assert.ok(cue.tone.duration > 0 && cue.tone.duration < 1,
    `Feedback sound ${id} must be brief, not an ambient loop`);
  assert.ok(cue.maxVoices && cue.maxVoices <= 5,
    `Feedback sound ${id} must have bounded concurrency`);
  assert.ok(cue.cooldownMs && cue.cooldownMs > 0,
    `Feedback sound ${id} must have a cooldown`);
}
assert.equal(new Set(AUDIO_ASSETS.map((asset) => asset.id)).size, AUDIO_ASSETS.length,
  'Logical SFX identifiers must stay unique');

const [game, battle, audio] = await Promise.all([
  readFile(new URL('../src/ThreeGame.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/battle/BattleSystem.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/audio/AudioManager.ts', import.meta.url), 'utf8'),
]);
for (const marker of [
  "this.showGridFeedback('construction'",
  "this.showGridFeedback('destruction'",
  "this.showGridFeedback('victory'",
  "this.showConstructionCompletionFeedback(key)",
  'this.gameplayFeedback.update(deltaMs,',
  'settings.graphics.effectsEnabled && !settings.interface.reducedMotion',
  'this.gameplayFeedback.clear();',
]) assert.ok(game.includes(marker), `Gameplay feedback integration is missing: ${marker}`);
assert.match(game, /onVisualFeedback: \(kind, x, y, z\) => this\.showWorldFeedback/);
assert.match(battle, /onVisualFeedback\?: \(kind: 'impact' \| 'destruction'/);
assert.match(battle, /this\.world\.onVisualFeedback\?\.\('impact'/);
assert.match(battle, /this\.world\.onVisualFeedback\?\.\('destruction'/);
assert.match(audio, /this\.settings\.muted/);
assert.match(audio, /this\.settings\.sfxEnabled/);
assert.match(audio, /this\.lifecycleBlocks\.size > 0/);
assert.match(audio, /this\.ensureVoiceCapacity/);

console.log('Construction, impact, destruction and victory feedback contracts passed.');
