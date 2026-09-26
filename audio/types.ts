import type { GameMode } from '../core/GameMode';

export type AudioBus = 'music' | 'ui' | 'building' | 'combat' | 'destruction' | 'ambient';
export type AudioAction =
  | 'play_sfx'
  | 'play_music'
  | 'stop_music'
  | 'pause'
  | 'resume'
  | 'set_mode';

export interface AudioAsset {
  id: string;
  bus: AudioBus;
  src: string;
  mode: GameMode;
  loop?: boolean;
  volume?: number;
  maxVoices?: number;
}

export interface AudioEventDetail {
  action: AudioAction;
  assetId?: string;
  bus?: AudioBus;
  mode?: GameMode;
  volume?: number;
  force?: boolean;
}

export interface AudioSettings {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
}

export interface AudioManagerOptions {
  initialMode?: GameMode;
  settingsStorageKey?: string;
}
