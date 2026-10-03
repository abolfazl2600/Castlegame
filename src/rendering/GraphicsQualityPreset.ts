import type { GraphicsQuality } from '../settings/SettingsModel';

export interface BattlePresentationBudget {
  decorativeEffectsEnabled: boolean;
  missileTrailParticleCap: number;
  missileExplosionEffectCap: number;
  impactEffectCap: number;
  wallCollapseEffectCap: number;
}

export interface GraphicsQualityPreset {
  quality: GraphicsQuality;
  resolutionScale: number;
  allowDynamicShadows: boolean;
  shadowBudgetScale: number;
  particleBudgetScale: number;
  animationBudgetScale: number;
  microDetailBudgetScale: number;
  foliageDetailScale: number;
  npcPresentationScale: number;
  battle: BattlePresentationBudget;
}

/**
 * Single source of truth for Low / Medium / High presentation budgets.
 *
 * These values may reduce rendering and animation presentation only. They must
 * never change AI, pathfinding, combat damage, projectile hit resolution, unit
 * spawn counts, economy, or any other gameplay/simulation outcome.
 */
const GRAPHICS_QUALITY_PRESETS: Record<GraphicsQuality, GraphicsQualityPreset> = {
  low: {
    quality: 'low',
    resolutionScale: 0.75,
    allowDynamicShadows: false,
    shadowBudgetScale: 0,
    particleBudgetScale: 0.35,
    animationBudgetScale: 0.55,
    microDetailBudgetScale: 0.55,
    foliageDetailScale: 0.6,
    npcPresentationScale: 0.7,
    battle: {
      decorativeEffectsEnabled: false,
      missileTrailParticleCap: 0,
      missileExplosionEffectCap: 0,
      impactEffectCap: 0,
      wallCollapseEffectCap: 0,
    },
  },
  medium: {
    quality: 'medium',
    resolutionScale: 1,
    allowDynamicShadows: true,
    shadowBudgetScale: 0.7,
    particleBudgetScale: 0.7,
    animationBudgetScale: 0.8,
    microDetailBudgetScale: 0.8,
    foliageDetailScale: 0.85,
    npcPresentationScale: 0.9,
    battle: {
      decorativeEffectsEnabled: true,
      missileTrailParticleCap: 24,
      missileExplosionEffectCap: 4,
      impactEffectCap: 10,
      wallCollapseEffectCap: 4,
    },
  },
  high: {
    quality: 'high',
    resolutionScale: 1.35,
    allowDynamicShadows: true,
    shadowBudgetScale: 1,
    particleBudgetScale: 1,
    animationBudgetScale: 1,
    microDetailBudgetScale: 1,
    foliageDetailScale: 1,
    npcPresentationScale: 1,
    battle: {
      decorativeEffectsEnabled: true,
      missileTrailParticleCap: 48,
      missileExplosionEffectCap: 6,
      impactEffectCap: 16,
      wallCollapseEffectCap: 6,
    },
  },
};

export function graphicsQualityPreset(quality: GraphicsQuality): GraphicsQualityPreset {
  return GRAPHICS_QUALITY_PRESETS[quality];
}
