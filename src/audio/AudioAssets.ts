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

  tone('building.place', 'building', { start: 240, end: 98, duration: 0.2, type: 'triangle', level: 0.17, second: 410 }, { priority: 'normal', cooldownMs: 75, maxVoices: 3 }),
  tone('building.started', 'building', { start: 235, end: 144, duration: 0.14, type: 'triangle', level: 0.1, second: 295 }, { priority: 'low', cooldownMs: 120, maxVoices: 2 }),
  tone('building.complete', 'building', { start: 390, end: 780, duration: 0.31, type: 'triangle', level: 0.15, second: 580 }, { priority: 'high', cooldownMs: 250, maxVoices: 2 }),
  tone('building.upgrade', 'building', { start: 260, end: 740, duration: 0.25, type: 'sine', level: 0.15, second: 390 }, { priority: 'high', cooldownMs: 120 }),
  tone('building.destroyed', 'destruction', { start: 142, end: 44, duration: 0.43, type: 'sawtooth', level: 0.14, second: 76 }, { priority: 'high', cooldownMs: 165, maxVoices: 3 }),
  tone('building.invalid', 'ui', { start: 190, end: 150, duration: 0.13, type: 'square', level: 0.08, second: 190 }, { priority: 'normal', cooldownMs: 140 }),

  tone('combat.melee-hit', 'combat', { start: 205, end: 88, duration: 0.095, type: 'square', level: 0.085 }, { priority: 'low', cooldownMs: 40, maxVoices: 5 }),
  tone('combat.ranged-shot', 'combat', { start: 410, end: 190, duration: 0.075, type: 'triangle', level: 0.07 }, { priority: 'low', cooldownMs: 28, maxVoices: 6 }),
  tone('combat.projectile-impact', 'combat', { start: 165, end: 72, duration: 0.13, type: 'sawtooth', level: 0.09 }, { priority: 'normal', cooldownMs: 55, maxVoices: 5 }),
  tone('combat.wall-hit', 'destruction', { start: 128, end: 67, duration: 0.17, type: 'square', level: 0.1, second: 190 }, { priority: 'normal', cooldownMs: 105, maxVoices: 4 }),
  tone('combat.wall-destroyed', 'destruction', { start: 115, end: 38, duration: 0.54, type: 'sawtooth', level: 0.16, second: 64 }, { priority: 'critical', cooldownMs: 350, maxVoices: 2 }),
  tone('combat.unit-death', 'combat', { start: 220, end: 85, duration: 0.18, type: 'triangle', level: 0.08 }, { priority: 'low', cooldownMs: 45, maxVoices: 5 }),
  tone('combat.battle-start', 'combat', { start: 120, end: 240, duration: 0.32, type: 'sawtooth', level: 0.14, second: 180 }, { priority: 'critical', cooldownMs: 500, maxVoices: 1 }),
  tone('combat.battle-stop', 'combat', { start: 220, end: 105, duration: 0.22, type: 'triangle', level: 0.13 }, { priority: 'high', cooldownMs: 300, maxVoices: 1 }),
  tone('combat.battle-reset', 'combat', { start: 150, end: 320, duration: 0.25, type: 'sine', level: 0.13, second: 225 }, { priority: 'high', cooldownMs: 300, maxVoices: 1 }),
  tone('combat.victory', 'combat', { start: 392, end: 783.99, duration: 0.67, type: 'triangle', level: 0.17, second: 523.25 }, { priority: 'critical', cooldownMs: 1600, maxVoices: 2 }),
  tone('combat.defeat', 'combat', { start: 196, end: 73.42, duration: 0.62, type: 'sawtooth', level: 0.11, second: 130.81 }, { priority: 'critical', cooldownMs: 1500, maxVoices: 1 }),
];

export function createAudioAssetRegistry(): Map<string, AudioAsset> {
  return new Map(AUDIO_ASSETS.map((asset) => [asset.id, asset]));
}
