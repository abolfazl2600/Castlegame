import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [
  manager,
  adaptive,
  ambient,
  assets,
  settingsModel,
  settingsStore,
  settingsUI,
  debugOverlay,
  battleSystem,
  threeGame,
] = await Promise.all([
  readFile(new URL('../src/audio/AudioManager.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/audio/AdaptiveMusicEngine.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/audio/AmbientAudioEngine.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/audio/AudioAssets.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/settings/SettingsModel.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/settings/SettingsStore.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/settings/SettingsUI.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/debug/PerformanceDebugOverlay.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/battle/BattleSystem.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/ThreeGame.ts', import.meta.url), 'utf8'),
]);

assert.equal((manager.match(/new AudioContext\(\)/g) ?? []).length, 1, 'AudioManager must own one AudioContext.');
assert.match(manager, /sfxVoiceLimit/);
assert.match(manager, /mobileDefault = .*20.*24/);
assert.match(manager, /ensureVoiceCapacity/);
assert.match(manager, /cooldownUntil/);
assert.match(manager, /AdaptiveMusicEngine/);
assert.match(manager, /AmbientAudioEngine/);
assert.match(manager, /AndroidAudioLifecycleBridge/);

assert.match(adaptive, /type MusicIntensityState = 'calm' \| 'tension' \| 'combat'/);
assert.match(adaptive, /private nextBarBoundary/);
assert.match(adaptive, /this\.context\.currentTime/);
assert.match(adaptive, /timeConstant = rising \? 1\.1 : 3\.8/);
assert.match(adaptive, /queueSection/);
assert.match(adaptive, /createStem\('base'/);
assert.match(adaptive, /createStem\('harmony'/);
assert.match(adaptive, /createStem\('rhythm'/);
assert.match(adaptive, /createStem\('tension'/);

for (const layer of ['wind', 'birds', 'water', 'settlement', 'fire', 'battle']) {
  assert.match(ambient, new RegExp(layer));
}

for (const soundId of [
  'building.place',
  'building.started',
  'building.complete',
  'building.upgrade',
  'building.destroyed',
  'building.invalid',
  'combat.melee-hit',
  'combat.ranged-shot',
  'combat.projectile-impact',
  'combat.wall-hit',
  'combat.wall-destroyed',
  'combat.unit-death',
  'combat.victory',
  'combat.defeat',
  'ui.button',
  'ui.confirm',
  'ui.cancel',
  'ui.warning',
]) {
  assert.match(assets, new RegExp(soundId.replace('.', '\\.')));
}

assert.match(settingsModel, /ambientEnabled: boolean/);
assert.match(settingsModel, /ambientVolume: number/);
assert.match(settingsStore, /input\.audio\.ambientEnabled/);
assert.match(settingsStore, /input\.audio\.ambientVolume/);
assert.match(settingsUI, /Ambient enabled/);
assert.match(settingsUI, /Ambient volume/);

assert.match(debugOverlay, /getAudioDiagnostics/);
assert.match(debugOverlay, /Music intensity/);
assert.match(debugOverlay, /SFX voices/);
assert.match(debugOverlay, /Ambient layers/);

assert.match(battleSystem, /combat\.melee-hit/);
assert.match(battleSystem, /combat\.ranged-shot/);
assert.match(battleSystem, /combat\.wall-destroyed/);
assert.match(threeGame, /updateAdaptiveAudio/);
assert.match(threeGame, /setGameplayIntensity/);
assert.match(threeGame, /building\.complete/);
assert.match(threeGame, /building\.upgrade/);
assert.match(threeGame, /building\.invalid/);

console.log('Adaptive music, ambient audio, and gameplay SFX contract checks passed.');
