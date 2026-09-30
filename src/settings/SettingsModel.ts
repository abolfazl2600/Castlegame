export const SETTINGS_SCHEMA_VERSION = 2 as const;

export type GraphicsQuality = 'low' | 'medium' | 'high';
export type PerformanceMode = 'balanced' | 'performance' | 'quality';
export type EnvironmentDetail = 'low' | 'medium' | 'high';
export type LanguageCode = 'system' | 'en';
export type ControlScheme = 'standard' | 'touch';

export interface GameplaySettings {
  controlScheme: ControlScheme;
  tutorialCompleted: boolean;
  cameraSensitivity: number;
  combatFeedback: boolean;
}

export interface GraphicsSettings {
  quality: GraphicsQuality;
  effectsEnabled: boolean;
  shadowsEnabled: boolean;
  performanceMode: PerformanceMode;
  environmentDetail: EnvironmentDetail;
  debugMode: boolean;
}

export interface AudioSettings {
  masterVolume: number;
  musicEnabled: boolean;
  musicVolume: number;
  sfxEnabled: boolean;
  sfxVolume: number;
  muted: boolean;
}

export interface InterfaceSettings {
  uiScale: number;
  language: LanguageCode;
  reducedMotion: boolean;
  highContrast: boolean;
  confirmDestructiveActions: boolean;
  showHelp: boolean;
}

export interface SettingsData {
  schemaVersion: typeof SETTINGS_SCHEMA_VERSION;
  gameplay: GameplaySettings;
  graphics: GraphicsSettings;
  audio: AudioSettings;
  interface: InterfaceSettings;
}

export function createDefaultSettings(): SettingsData {
  return {
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    gameplay: {
      controlScheme: 'standard',
      tutorialCompleted: false,
      cameraSensitivity: 1,
      combatFeedback: true,
    },
    graphics: {
      quality: 'high',
      effectsEnabled: true,
      shadowsEnabled: true,
      performanceMode: 'balanced',
      environmentDetail: 'high',
      debugMode: false,
    },
    audio: {
      masterVolume: 1,
      musicEnabled: true,
      musicVolume: 0.8,
      sfxEnabled: true,
      sfxVolume: 1,
      muted: false,
    },
    interface: {
      uiScale: 1,
      language: 'system',
      reducedMotion: false,
      highContrast: false,
      confirmDestructiveActions: true,
      showHelp: true,
    },
  };
}
