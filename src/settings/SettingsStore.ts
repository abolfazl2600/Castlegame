import {
  createDefaultSettings,
  SETTINGS_SCHEMA_VERSION,
  type AudioSettings,
  type GraphicsSettings,
  type InterfaceSettings,
  type GameplaySettings,
  type SettingsData,
} from './SettingsModel';

export const SETTINGS_STORAGE_KEY = 'castle-role.settings.v1';

export type SettingsListener = (settings: SettingsData) => void;

interface StoredSettings {
  schemaVersion?: unknown;
  gameplay?: Partial<GameplaySettings>;
  graphics?: Partial<GraphicsSettings>;
  audio?: Partial<AudioSettings>;
  interface?: Partial<InterfaceSettings>;
}

export class SettingsStore {
  private settings: SettingsData;
  private readonly listeners = new Set<SettingsListener>();

  constructor(
    private readonly storage: Storage | null = typeof localStorage !== 'undefined' ? localStorage : null,
    private readonly gameSaveKey?: string,
  ) {
    this.settings = this.load();
  }

  get(): SettingsData {
    return cloneSettings(this.settings);
  }

  subscribe(listener: SettingsListener): () => void {
    this.listeners.add(listener);
    listener(this.get());
    return () => this.listeners.delete(listener);
  }

  update(patch: DeepPartial<SettingsData>): void {
    const candidate = mergeSettings(this.settings, patch);
    this.settings = validateSettings(candidate);
    this.persist();
    this.emit();
  }

  setGameplay(patch: Partial<GameplaySettings>): void { this.update({ gameplay: patch }); }
  setGraphics(patch: Partial<GraphicsSettings>): void { this.update({ graphics: patch }); }
  setAudio(patch: Partial<AudioSettings>): void { this.update({ audio: patch }); }
  setInterface(patch: Partial<InterfaceSettings>): void { this.update({ interface: patch }); }

  restoreDefaults(): void {
    this.settings = createDefaultSettings();
    this.persist();
    this.emit();
  }

  resetLocalSave(): boolean {
    if (!this.storage || !this.gameSaveKey) return false;
    this.storage.removeItem(this.gameSaveKey);
    return true;
  }

  clearSettingsStorage(): void {
    this.storage?.removeItem(SETTINGS_STORAGE_KEY);
  }

  private load(): SettingsData {
    const defaults = createDefaultSettings();
    if (!this.storage) return defaults;

    try {
      const raw = this.storage.getItem(SETTINGS_STORAGE_KEY);
      if (!raw) return defaults;
      const parsed = JSON.parse(raw) as StoredSettings;
      const migrated = migrate(parsed);
      return validateSettings(mergeSettings(defaults, migrated));
    } catch {
      return defaults;
    }
  }

  private persist(): void {
    if (!this.storage) return;
    try {
      this.storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(this.settings));
    } catch {
      // Settings are non-critical. Runtime continues with the in-memory state.
    }
  }

  private emit(): void {
    const snapshot = this.get();
    for (const listener of this.listeners) listener(snapshot);
  }
}

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

function migrate(input: StoredSettings): DeepPartial<SettingsData> {
  const version = Number.isInteger(input.schemaVersion) ? Number(input.schemaVersion) : 0;

  if (version <= 0) {
    return {
      gameplay: input.gameplay,
      graphics: input.graphics,
      audio: input.audio,
      interface: input.interface,
    };
  }

  if (version === SETTINGS_SCHEMA_VERSION) {
    return {
      gameplay: input.gameplay,
      graphics: input.graphics,
      audio: input.audio,
      interface: input.interface,
    };
  }

  return {};
}

function mergeSettings(base: SettingsData, patch: DeepPartial<SettingsData>): SettingsData {
  return {
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    gameplay: { ...base.gameplay, ...(patch.gameplay ?? {}) },
    graphics: { ...base.graphics, ...(patch.graphics ?? {}) },
    audio: { ...base.audio, ...(patch.audio ?? {}) },
    interface: { ...base.interface, ...(patch.interface ?? {}) },
  };
}

function validateSettings(input: SettingsData): SettingsData {
  const defaults = createDefaultSettings();
  const numberInRange = (value: unknown, fallback: number): number =>
    typeof value === 'number' && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback;

  const quality = input.graphics.quality;
  const performanceMode = input.graphics.performanceMode;
  const language = input.interface.language;
  const controlScheme = input.gameplay.controlScheme;

  return {
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    gameplay: {
      controlScheme:
        controlScheme === 'standard' || controlScheme === 'touch'
          ? controlScheme
          : defaults.gameplay.controlScheme,
      tutorialCompleted: typeof input.gameplay.tutorialCompleted === 'boolean'
        ? input.gameplay.tutorialCompleted
        : defaults.gameplay.tutorialCompleted,
    },
    graphics: {
      quality: quality === 'low' || quality === 'medium' || quality === 'high'
        ? quality
        : defaults.graphics.quality,
      effectsEnabled: typeof input.graphics.effectsEnabled === 'boolean'
        ? input.graphics.effectsEnabled
        : defaults.graphics.effectsEnabled,
      shadowsEnabled: typeof input.graphics.shadowsEnabled === 'boolean'
        ? input.graphics.shadowsEnabled
        : defaults.graphics.shadowsEnabled,
      performanceMode:
        performanceMode === 'balanced' || performanceMode === 'performance' || performanceMode === 'quality'
          ? performanceMode
          : defaults.graphics.performanceMode,
    },
    audio: {
      masterVolume: numberInRange(input.audio.masterVolume, defaults.audio.masterVolume),
      musicVolume: numberInRange(input.audio.musicVolume, defaults.audio.musicVolume),
      sfxVolume: numberInRange(input.audio.sfxVolume, defaults.audio.sfxVolume),
      muted: typeof input.audio.muted === 'boolean' ? input.audio.muted : defaults.audio.muted,
    },
    interface: {
      uiScale:
        typeof input.interface.uiScale === 'number' && Number.isFinite(input.interface.uiScale)
          ? Math.min(1.5, Math.max(0.75, input.interface.uiScale))
          : defaults.interface.uiScale,
      language: language === 'system' || language === 'en' ? language : defaults.interface.language,
      reducedMotion: typeof input.interface.reducedMotion === 'boolean'
        ? input.interface.reducedMotion
        : defaults.interface.reducedMotion,
      highContrast: typeof input.interface.highContrast === 'boolean'
        ? input.interface.highContrast
        : defaults.interface.highContrast,
    },
  };
}

function cloneSettings(settings: SettingsData): SettingsData {
  return JSON.parse(JSON.stringify(settings)) as SettingsData;
}
