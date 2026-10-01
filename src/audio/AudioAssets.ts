import type { AudioAsset } from './types';

/** Add real files here without changing gameplay systems or AudioManager. */
export const AUDIO_ASSETS: readonly AudioAsset[] = [];

export function createAudioAssetRegistry(): Map<string, AudioAsset> {
  return new Map(AUDIO_ASSETS.map((asset) => [asset.id, asset]));
}
