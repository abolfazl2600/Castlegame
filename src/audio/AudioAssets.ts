import type { AudioAsset } from './types';

/**
 * Audio is intentionally asset-light. Add real files here later without changing
 * gameplay systems or AudioManager.
 *
 * Medieval and modern manifests are separate so a mode can never resolve the
 * other mode's audio by accident.
 */
export const MEDIEVAL_AUDIO_ASSETS: readonly AudioAsset[] = [];

export const MODERN_AUDIO_ASSETS: readonly AudioAsset[] = [];

export function createAudioAssetRegistry(): Map<string, AudioAsset> {
  const registry = new Map<string, AudioAsset>();
  for (const asset of [...MEDIEVAL_AUDIO_ASSETS, ...MODERN_AUDIO_ASSETS]) {
    registry.set(asset.id, asset);
  }
  return registry;
}
