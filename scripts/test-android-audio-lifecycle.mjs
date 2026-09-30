import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [manager, bridge, settingsModel, settingsStore, settingsUI, threeGame] = await Promise.all([
  readFile(new URL('../src/audio/AudioManager.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/audio/AndroidAudioLifecycle.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/settings/SettingsModel.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/settings/SettingsStore.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/settings/SettingsUI.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/ThreeGame.ts', import.meta.url), 'utf8'),
]);

assert.match(bridge, /visibilitychange/);
assert.match(bridge, /pagehide/);
assert.match(bridge, /pageshow/);
assert.match(bridge, /addEventListener\('pause'/);
assert.match(bridge, /addEventListener\('resume'/);
assert.match(bridge, /CastleRoleAudioLifecycle/);
assert.match(bridge, /native-audio-focus/);
assert.match(bridge, /native-interruption/);

assert.match(manager, /lifecycleBlocks = new Set<string>/);
assert.match(manager, /clearSfxVoices\(\)/);
assert.match(manager, /stopProceduralNodes\(\)/);
assert.match(manager, /resumePromise/);
assert.match(manager, /canResumeAudioContext\(\)/);
assert.match(manager, /if \(!this\.canResumeAudioContext\(\)\) return/);
assert.match(manager, /!this\.settings\.sfxEnabled/);
assert.match(manager, /this\.settings\.musicEnabled/);
assert.match(manager, /this\.lifecycleBridge\.dispose\(\)/);

assert.match(settingsModel, /musicEnabled: boolean/);
assert.match(settingsModel, /sfxEnabled: boolean/);
assert.match(settingsModel, /musicEnabled: true/);
assert.match(settingsModel, /sfxEnabled: true/);
assert.match(settingsStore, /SETTINGS_STORAGE_KEY = 'castle-role\.settings\.v2'/);
assert.match(settingsStore, /input\.audio\.musicEnabled/);
assert.match(settingsStore, /input\.audio\.sfxEnabled/);
assert.match(settingsUI, /data-setting=\"\$\{key\}\"/);
assert.match(settingsUI, /Music enabled/);
assert.match(settingsUI, /Sound effects enabled/);
assert.match(threeGame, /setMusicEnabled\(settings\.audio\.musicEnabled\)/);
assert.match(threeGame, /setSfxEnabled\(settings\.audio\.sfxEnabled\)/);

console.log('Android audio lifecycle and persistent sound settings regression checks passed.');
