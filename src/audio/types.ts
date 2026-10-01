export type AudioBus = 'music' | 'ui' | 'building' | 'combat' | 'destruction' | 'ambient';
export type AudioAction =
  | 'play_sfx'
  | 'play_music'
  | 'stop_music'
  | 'pause'
  | 'resume';

export interface AudioAsset {
  id: string;
  bus: AudioBus;
  src: string;
  loop?: boolean;
  volume?: number;
  maxVoices?: number;
}

export interface AudioEventDetail {
  action: AudioAction;
  assetId?: string;
  bus?: AudioBus;
  volume?: number;
  force?: boolean;
}

export interface AudioSettings {
  masterVolume: number;
  musicEnabled: boolean;
  musicVolume: number;
  sfxEnabled: boolean;
  sfxVolume: number;
  muted: boolean;
}

export interface AudioManagerOptions {
  settingsStorageKey?: string;
}
