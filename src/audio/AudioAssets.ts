import type { AudioAsset, AudioBus, AudioPriority, ProceduralToneRecipe } from './types';

function tone(
  id: string,
  bus: AudioBus,
  recipe: ProceduralToneRecipe,
  options: {
    priority?: AudioPriority;
    cooldownMs?: number;
    maxVoices?: number;
    volume?: number;
  } = {},
): AudioAsset {
  return {
    id,
    bus,
    tone: recipe,
    priority: options.priority ?? 'normal',
    cooldownMs: options.cooldownMs ?? 0,
    maxVoices: options.maxVoices ?? 4,
    volume: options.volume ?? 1,
    preload: 'preload',
  };
}

/**
 * Single logical sound manifest. Gameplay systems request these IDs and never
 * need to know whether a cue is procedural today or backed by a streamed file
 * later.
 */
export const AUDIO_ASSETS: readonly AudioAsset[] = [
  tone('ui.button', 'ui', { start: 520, end: 680, duration: 0.045, type: 'sine', level: 0.09 }, { priority: 'low', cooldownMs: 35, maxVoices: 3 }),
  tone('ui.tool-select', 'ui', { start: 420, end: 640, duration: 0.07, type: 'sine', level: 0.14 }, { cooldownMs: 45 }),
  tone('ui.confirm', 'ui', { start: 540, end: 820, duration: 0.09, type: 'triangle', level: 0.12 }, { priority: 'normal' }),
  tone('ui.cancel', 'ui', { start: 360, end: 240, duration: 0.08, type: 'triangle', level: 0.11 }, { priority: 'normal' }),
  tone('ui.warning', 'ui', { start: 260, end: 180, duration: 0.16, type: 'square', level: 0.08, second: 330 }, { priority: 'high', cooldownMs: 180 }),
  tone('ui.modal-open', 'ui', { start: 460, end: 610, duration: 0.07, type: 'sine', level: 0.08 }, { priority: 'low', cooldownMs: 80 }),
  tone('ui.modal-close', 'ui', { start: 520, end: 380, duration: 0.065, type: 'sine', level: 0.08 }, { priority: 'low', cooldownMs: 80 }),

  tone('building.place', 'building', { start: 180, end: 115, duration: 0.16, type: 'triangle', level: 0.2, second: 270 }, { priority: 'normal', cooldownMs: 45 }),
  tone('building.started', 'building', { start: 210, end: 160, duration: 0.11, type: 'triangle', level: 0.12, second: 315 }, { priority: 'low', cooldownMs: 80 }),
  tone('building.complete', 'building', { start: 330, end: 660, duration: 0.22, type: 'triangle', level: 0.14, second: 495 }, { priority: 'high', cooldownMs: 120 }),
  tone('building.upgrade', 'building', { start: 260, end: 740, duration: 0.25, type: 'sine', level: 0.15, second: 390 }, { priority: 'high', cooldownMs: 120 }),
  tone('building.destroyed', 'destruction', { start: 145, end: 52, duration: 0.32, type: 'sawtooth', level: 0.15, second: 95 }, { priority: 'high', cooldownMs: 90 }),
  tone('building.invalid', 'ui', { start: 190, end: 150, duration: 0.13, type: 'square', level: 0.08, second: 190 }, { priority: 'normal', cooldownMs: 140 }),

  tone('combat.melee-hit', 'combat', { start: 175, end: 92, duration: 0.08, type: 'square', level: 0.08 }, { priority: 'low', cooldownMs: 25, maxVoices: 6 }),
  tone('combat.ranged-shot', 'combat', { start: 410, end: 190, duration: 0.075, type: 'triangle', level: 0.07 }, { priority: 'low', cooldownMs: 28, maxVoices: 6 }),
  tone('combat.projectile-impact', 'combat', { start: 130, end: 65, duration: 0.11, type: 'sawtooth', level: 0.08 }, { priority: 'normal', cooldownMs: 35, maxVoices: 6 }),
  tone('combat.wall-hit', 'destruction', { start: 115, end: 72, duration: 0.14, type: 'square', level: 0.09 }, { priority: 'normal', cooldownMs: 55, maxVoices: 5 }),
  tone('combat.wall-destroyed', 'destruction', { start: 105, end: 42, duration: 0.42, type: 'sawtooth', level: 0.14, second: 70 }, { priority: 'critical', cooldownMs: 180, maxVoices: 2 }),
  tone('combat.unit-death', 'combat', { start: 220, end: 85, duration: 0.18, type: 'triangle', level: 0.08 }, { priority: 'low', cooldownMs: 45, maxVoices: 5 }),
  tone('combat.battle-start', 'combat', { start: 120, end: 240, duration: 0.32, type: 'sawtooth', level: 0.14, second: 180 }, { priority: 'critical', cooldownMs: 500, maxVoices: 1 }),
  tone('combat.battle-stop', 'combat', { start: 220, end: 105, duration: 0.22, type: 'triangle', level: 0.13 }, { priority: 'high', cooldownMs: 300, maxVoices: 1 }),
  tone('combat.battle-reset', 'combat', { start: 150, end: 320, duration: 0.25, type: 'sine', level: 0.13, second: 225 }, { priority: 'high', cooldownMs: 300, maxVoices: 1 }),
  tone('combat.victory', 'combat', { start: 261.63, end: 523.25, duration: 0.5, type: 'triangle', level: 0.13, second: 392 }, { priority: 'critical', cooldownMs: 1500, maxVoices: 1 }),
  tone('combat.defeat', 'combat', { start: 196, end: 73.42, duration: 0.62, type: 'sawtooth', level: 0.11, second: 130.81 }, { priority: 'critical', cooldownMs: 1500, maxVoices: 1 }),
];

export function createAudioAssetRegistry(): Map<string, AudioAsset> {
  return new Map(AUDIO_ASSETS.map((asset) => [asset.id, asset]));
}
