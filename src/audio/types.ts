import type { AmbientContext } from './AmbientAudioEngine';
import type { MusicIntensityState } from './AdaptiveMusicEngine';

export type AudioBus = 'music' | 'ui' | 'building' | 'combat' | 'destruction' | 'ambient';
export type AudioPriority = 'low' | 'normal' | 'high' | 'critical';
export type AudioAction =
  | 'play_sfx'
  | 'play_music'
  | 'stop_music'
  | 'set_music_intensity'
  | 'set_ambient_context'
  | 'pause'
  | 'resume';

export interface ProceduralToneRecipe {
  start: number;
  end: number;
  duration: number;
  type: OscillatorType;
  level: number;
  second?: number;
}

export interface AudioAsset {
  id: string;
  bus: AudioBus;
  src?: string;
  loop?: boolean;
  volume?: number;
  maxVoices?: number;
  priority?: AudioPriority;
  cooldownMs?: number;
  spatial?: boolean;
  preload?: 'preload' | 'stream' | 'lazy';
  tone?: ProceduralToneRecipe;
}

export interface AudioEventDetail {
  action: AudioAction;
  assetId?: string;
  bus?: AudioBus;
  volume?: number;
  force?: boolean;
  intensity?: number;
  ambient?: Partial<AmbientContext>;
}

export interface AudioSettings {
  masterVolume: number;
  musicEnabled: boolean;
  musicVolume: number;
  ambientEnabled: boolean;
  ambientVolume: number;
  sfxEnabled: boolean;
  sfxVolume: number;
  muted: boolean;
}

export interface AudioDiagnostics {
  contextState: AudioContextState | 'uninitialized';
  unlocked: boolean;
  musicState: MusicIntensityState;
  intensity: number;
  activeSection: string;
  activeStemCount: number;
  pendingMusicState: MusicIntensityState | null;
  activeSfxVoices: number;
  voiceLimit: number;
  activeAmbientLayers: string[];
}

export interface AudioManagerOptions {
  settingsStorageKey?: string;
  sfxVoiceLimit?: number;
}
