import { SAVE_AUTOSAVE_KEY, SAVE_KEY, SAVE_LEGACY_KEY, SAVE_QUICK_KEY, SAVE_SLOT_COUNT, SAVE_STORAGE_PREFIX } from '../core/constants';
import {
  createDefaultSettings,
  SETTINGS_SCHEMA_VERSION,
  type AudioSettings,
  type GraphicsSettings,
  type InterfaceSettings,
  type GameplaySettings,
  type SettingsData,
} from './SettingsModel';

export const SETTINGS_STORAGE_KEY = 'castle-role.settings.v2';
const LEGACY_SETTINGS_STORAGE_KEY = 'castle-role.settings.v1';

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

  resetSettings(): void {
    this.storage?.removeItem(SETTINGS_STORAGE_KEY);
    this.storage?.removeItem(LEGACY_SETTINGS_STORAGE_KEY);
    this.settings = createDefaultSettings();
    this.persist();
    this.emit();
  }

  resetLocalSave(): boolean {
    if (!this.storage) return false;
    this.storage.removeItem(SAVE_KEY);
    this.storage.removeItem(SAVE_LEGACY_KEY);
    this.storage.removeItem(SAVE_AUTOSAVE_KEY);
    this.storage.removeItem(SAVE_QUICK_KEY);
    for (let slot = 1; slot <= SAVE_SLOT_COUNT; slot += 1) {
      this.storage.removeItem(`${SAVE_STORAGE_PREFIX}slot-${slot}`);
    }
    if (this.gameSaveKey && this.gameSaveKey !== SAVE_KEY) this.storage.removeItem(this.gameSaveKey);
    return true;
  }

  clearSettingsStorage(): void {
    this.storage?.removeItem(SETTINGS_STORAGE_KEY);
    this.storage?.removeItem(LEGACY_SETTINGS_STORAGE_KEY);
  }

  clearAllLocalData(): void {
    this.storage?.removeItem(SETTINGS_STORAGE_KEY);
    this.storage?.removeItem(LEGACY_SETTINGS_STORAGE_KEY);
    this.storage?.removeItem(SAVE_KEY);
    this.storage?.removeItem(SAVE_LEGACY_KEY);
    this.storage?.removeItem(SAVE_AUTOSAVE_KEY);
    this.storage?.removeItem(SAVE_QUICK_KEY);
    for (let slot = 1; slot <= SAVE_SLOT_COUNT; slot += 1) this.storage?.removeItem(`${SAVE_STORAGE_PREFIX}slot-${slot}`);
    if (this.gameSaveKey && this.gameSaveKey !== SAVE_KEY) this.storage?.removeItem(this.gameSaveKey);
    this.storage?.removeItem('castle-role:privacy-consent:v1');
  }

  private load(): SettingsData {
    const defaults = createDefaultSettings();
    if (!this.storage) return defaults;

    try {
      const raw = this.storage.getItem(SETTINGS_STORAGE_KEY) ?? this.storage.getItem(LEGACY_SETTINGS_STORAGE_KEY);
      if (!raw) return defaults;

      const parsed = JSON.parse(raw) as StoredSettings;
      const migrated = migrate(parsed);
      const settings = validateSettings(mergeSettings(defaults, migrated));

      if (this.storage.getItem(SETTINGS_STORAGE_KEY) === null) {
        try {
          this.storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
          this.storage.removeItem(LEGACY_SETTINGS_STORAGE_KEY);
        } catch {
          // Continue with the validated in-memory settings.
        }
      }

      return settings;
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

  if (version <= 0 || version === 1 || version === SETTINGS_SCHEMA_VERSION) {
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
  const numberInRange = (value: unknown, fallback: number, min = 0, max = 1): number =>
    typeof value === 'number' && Number.isFinite(value)
      ? Math.min(max, Math.max(min, value))
      : fallback;

  const quality = input.graphics.quality;
  const performanceMode = input.graphics.performanceMode;
  const environmentDetail = input.graphics.environmentDetail;
  const language = input.interface.language;
  const controlScheme = input.gameplay.controlScheme;

  return {
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    gameplay: {
      controlScheme:
        controlScheme === 'standard' || controlScheme === 'touch'
          ? controlScheme
          : defaults.gameplay.controlScheme,
      tutorialCompleted:
        typeof input.gameplay.tutorialCompleted === 'boolean'
          ? input.gameplay.tutorialCompleted
          : defaults.gameplay.tutorialCompleted,
      cameraSensitivity: numberInRange(
        input.gameplay.cameraSensitivity,
        defaults.gameplay.cameraSensitivity,
        0.5,
        2,
      ),
      combatFeedback:
        typeof input.gameplay.combatFeedback === 'boolean'
          ? input.gameplay.combatFeedback
          : defaults.gameplay.combatFeedback,
    },
    graphics: {
      quality:
        quality === 'low' || quality === 'medium' || quality === 'high'
          ? quality
          : defaults.graphics.quality,
      effectsEnabled:
        typeof input.graphics.effectsEnabled === 'boolean'
          ? input.graphics.effectsEnabled
          : defaults.graphics.effectsEnabled,
      shadowsEnabled:
        typeof input.graphics.shadowsEnabled === 'boolean'
          ? input.graphics.shadowsEnabled
          : defaults.graphics.shadowsEnabled,
      performanceMode:
        performanceMode === 'balanced' || performanceMode === 'performance' || performanceMode === 'quality'
          ? performanceMode
          : defaults.graphics.performanceMode,
      environmentDetail:
        environmentDetail === 'low' || environmentDetail === 'medium' || environmentDetail === 'high'
          ? environmentDetail
          : defaults.graphics.environmentDetail,
    },
    audio: {
      masterVolume: numberInRange(input.audio.masterVolume, defaults.audio.masterVolume),
      musicVolume: numberInRange(input.audio.musicVolume, defaults.audio.musicVolume),
      sfxVolume: numberInRange(input.audio.sfxVolume, defaults.audio.sfxVolume),
      muted: typeof input.audio.muted === 'boolean' ? input.audio.muted : defaults.audio.muted,
    },
    interface: {
      uiScale: numberInRange(input.interface.uiScale, defaults.interface.uiScale, 0.75, 1.5),
      language: language === 'system' || language === 'en' ? language : defaults.interface.language,
      reducedMotion:
        typeof input.interface.reducedMotion === 'boolean'
          ? input.interface.reducedMotion
          : defaults.interface.reducedMotion,
      highContrast:
        typeof input.interface.highContrast === 'boolean'
          ? input.interface.highContrast
          : defaults.interface.highContrast,
      confirmDestructiveActions:
        typeof input.interface.confirmDestructiveActions === 'boolean'
          ? input.interface.confirmDestructiveActions
          : defaults.interface.confirmDestructiveActions,
      showHelp:
        typeof input.interface.showHelp === 'boolean'
          ? input.interface.showHelp
          : defaults.interface.showHelp,
    },
  };
}

function cloneSettings(settings: SettingsData): SettingsData {
  return JSON.parse(JSON.stringify(settings)) as SettingsData;
}
