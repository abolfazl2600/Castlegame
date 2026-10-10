import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'vite';

// Bundle the real production modules for an executable Node integration test,
// without requiring a browser, GPU or Android audio hardware.
const temp = mkdtempSync(join(process.cwd(), '.audio-settings-qa-'));
let SettingsStore, AudioManager;
try {
  await build({
    configFile: false,
    logLevel: 'silent',
    build: {
      outDir: temp, emptyOutDir: false, minify: false,
      lib: {
        entry: {
          settings: 'src/settings/SettingsStore.ts',
          audio: 'src/audio/AudioManager.ts',
        },
        formats: ['es'],
        fileName: (_format, name) => `${name}.mjs`,
      },
    },
  });
  ({ SettingsStore } = await import(pathToFileURL(join(temp, 'settings.mjs')).href));
  ({ AudioManager } = await import(pathToFileURL(join(temp, 'audio.mjs')).href));
} finally {
  rmSync(temp, { recursive: true, force: true });
}

class MemoryStorage {
  constructor(values = {}, failCanonicalWrite = false) {
    this.items = new Map(Object.entries(values));
    this.writes = [];
    this.reads = [];
    this.removals = [];
    this.failCanonicalWrite = failCanonicalWrite;
  }
  getItem(key) { this.reads.push(key); return this.items.get(key) ?? null; }
  setItem(key, value) {
    if (this.failCanonicalWrite && key === 'castle-role.settings.v2') throw Error('Quota exceeded');
    this.items.set(key, String(value));
    this.writes.push(key);
  }
  removeItem(key) { this.items.delete(key); this.removals.push(key); }
  key(index) { return [...this.items.keys()][index] ?? null; }
  get length() { return this.items.size; }
  clear() { this.items.clear(); }
}

Object.defineProperty(globalThis, 'navigator', {
  configurable: true, value: { userAgent: 'AudioSettings regression on Node' },
});
globalThis.window = {
  addEventListener() {}, removeEventListener() {},
};
globalThis.document = {
  hidden: false,
  documentElement: { dataset: {} },
  addEventListener() {}, removeEventListener() {},
};

const LEGACY = 'castle-role-audio-settings';
const CANONICAL = 'castle-role.settings.v2';

// An existing canonical record is authoritative even if a stale audio-only
// record holds conflicting mute/volume values.
const canonicalStorage = new MemoryStorage({
  [CANONICAL]: JSON.stringify({ schemaVersion: 2, audio: {
    musicVolume: 0.31, musicEnabled: false, muted: true, sfxEnabled: false,
  }}),
  [LEGACY]: JSON.stringify({ musicVolume: 0.99, musicEnabled: true, muted: false }),
});
globalThis.localStorage = canonicalStorage;
const settings = new SettingsStore(canonicalStorage);
assert.equal(settings.get().audio.musicVolume, 0.31);
assert.equal(settings.get().audio.musicEnabled, false);
assert.equal(settings.get().audio.muted, true);
assert.equal(canonicalStorage.getItem(LEGACY), null, 'stale duplicate record should be retired');

const audio = new AudioManager({
  settingsStorageKey: null,
  initialSettings: settings.get().audio,
});
const unsubscribe = settings.subscribe((next) => audio.applySettings(next.audio));
assert.deepEqual(audio.getSettings(), settings.get().audio, 'initial audio must match SettingsStore');

canonicalStorage.writes.length = 0;
canonicalStorage.reads.length = 0;
settings.setGraphics({ quality: 'low' });
assert.deepEqual(canonicalStorage.writes, [CANONICAL],
  'an unrelated graphics change may persist SettingsStore once, never the audio key');
assert.equal(canonicalStorage.reads.includes(LEGACY), false,
  'runtime should not re-read the obsolete audio key');

canonicalStorage.writes.length = 0;
settings.setAudio({ masterVolume: 0.25, musicEnabled: true, muted: false,
  ambientVolume: 0.4, sfxVolume: 0.5, sfxEnabled: true });
assert.deepEqual(canonicalStorage.writes, [CANONICAL],
  'audio updates must persist only once through the settings authority');
assert.deepEqual(audio.getSettings(), settings.get().audio,
  'all enabled/disabled, mute and volume changes must reach the audio engine');

canonicalStorage.writes.length = 0;
audio.applySettings(settings.get().audio);
audio.setMasterVolume(audio.getSettings().masterVolume);
audio.setMusicVolume(audio.getSettings().musicVolume);
audio.setAmbientVolume(audio.getSettings().ambientVolume);
audio.setSfxVolume(audio.getSettings().sfxVolume);
assert.equal(canonicalStorage.writes.length, 0, 'replaying unchanged audio values does not write');

const reloaded = new SettingsStore(canonicalStorage);
assert.deepEqual(reloaded.get().audio, settings.get().audio, 'all audio preferences survive reload');
unsubscribe();
audio.dispose();

const legacyStorage = new MemoryStorage({ [LEGACY]: JSON.stringify({
  masterVolume: 0.22, musicVolume: 0.45, muted: true, sfxEnabled: false, ambientVolume: 0.35,
}) });
const migrated = new SettingsStore(legacyStorage);
assert.equal(migrated.get().audio.masterVolume, 0.22);
assert.equal(migrated.get().audio.musicVolume, 0.45);
assert.equal(migrated.get().audio.muted, true);
assert.equal(migrated.get().audio.sfxEnabled, false);
assert.equal(migrated.get().audio.ambientVolume, 0.35);
assert.ok(legacyStorage.items.has(CANONICAL), 'legacy audio is copied to canonical storage');
assert.ok(!legacyStorage.items.has(LEGACY), 'legacy audio is removed only after successful copy');
assert.deepEqual(new SettingsStore(legacyStorage).get().audio, migrated.get().audio);

const v1Storage = new MemoryStorage({
  'castle-role.settings.v1': JSON.stringify({ schemaVersion: 1, audio: { musicVolume: 0.61 } }),
  [LEGACY]: JSON.stringify({ musicVolume: 0.99 }),
});
assert.equal(new SettingsStore(v1Storage).get().audio.musicVolume, 0.61,
  'former consolidated settings must outrank the deprecated audio-only key');

const failingStorage = new MemoryStorage({ [LEGACY]: JSON.stringify({ muted: true }) }, true);
assert.equal(new SettingsStore(failingStorage).get().audio.muted, true,
  'migration failure retains the valid in-memory preferences');
assert.ok(failingStorage.items.has(LEGACY), 'failed migration must keep the old record recoverable');

const resetStorage = new MemoryStorage({
  [CANONICAL]: JSON.stringify({ schemaVersion: 2, audio: { muted: true } }),
  [LEGACY]: JSON.stringify({ muted: false }),
});
const resetStore = new SettingsStore(resetStorage);
resetStore.resetSettings();
assert.equal(resetStorage.items.has(LEGACY), false, 'reset removes stale audio-only record');
assert.equal(resetStore.get().audio.muted, false);

console.log('Audio settings: single source, stale-key precedence, migration, reload and write-count integration passed.');
