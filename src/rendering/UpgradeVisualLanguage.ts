export type UpgradeVisualLevel = 1 | 2 | 3 | 4;
export type UpgradeVisualEra = 'medieval' | 'modern';

export interface UpgradeVisualProfile {
  readonly level: UpgradeVisualLevel;
  readonly name: 'basic' | 'established' | 'advanced' | 'landmark';
  readonly massingScale: number;
  readonly verticalityScale: number;
  readonly workingAreaScale: number;
  readonly roofComplexity: 1 | 2 | 3 | 4;
  readonly materialTier: 1 | 2 | 3 | 4;
  readonly landmarkStrength: 0 | 1 | 2 | 3;
  readonly maxSecondaryProps: number;
  readonly maxAmbientAnimatedElements: number;
  readonly maxSilhouetteElements: number;
  readonly activityMultiplier: number;
  readonly allowEmissiveAccent: boolean;
}

/**
 * Shared four-level visual language.
 *
 * Large-form changes are intentionally front-loaded. Prop/animation budgets grow
 * slowly so richer levels remain bounded and silhouette stays the primary signal.
 */
export const UPGRADE_VISUAL_LANGUAGE: Readonly<Record<UpgradeVisualLevel, UpgradeVisualProfile>> = {
  1: {
    level: 1,
    name: 'basic',
    massingScale: 1,
    verticalityScale: 1,
    workingAreaScale: 1,
    roofComplexity: 1,
    materialTier: 1,
    landmarkStrength: 0,
    maxSecondaryProps: 4,
    maxAmbientAnimatedElements: 1,
    maxSilhouetteElements: 3,
    activityMultiplier: 1,
    allowEmissiveAccent: false,
  },
  2: {
    level: 2,
    name: 'established',
    massingScale: 1.18,
    verticalityScale: 1.12,
    workingAreaScale: 1.2,
    roofComplexity: 2,
    materialTier: 2,
    landmarkStrength: 1,
    maxSecondaryProps: 7,
    maxAmbientAnimatedElements: 2,
    maxSilhouetteElements: 4,
    activityMultiplier: 1.25,
    allowEmissiveAccent: false,
  },
  3: {
    level: 3,
    name: 'advanced',
    massingScale: 1.38,
    verticalityScale: 1.28,
    workingAreaScale: 1.42,
    roofComplexity: 3,
    materialTier: 3,
    landmarkStrength: 2,
    maxSecondaryProps: 10,
    maxAmbientAnimatedElements: 3,
    maxSilhouetteElements: 6,
    activityMultiplier: 1.55,
    allowEmissiveAccent: false,
  },
  4: {
    level: 4,
    name: 'landmark',
    massingScale: 1.62,
    verticalityScale: 1.5,
    workingAreaScale: 1.68,
    roofComplexity: 4,
    materialTier: 4,
    landmarkStrength: 3,
    maxSecondaryProps: 14,
    maxAmbientAnimatedElements: 4,
    maxSilhouetteElements: 8,
    activityMultiplier: 1.9,
    allowEmissiveAccent: true,
  },
} as const;

export const UPGRADE_ERA_GUIDANCE = {
  medieval: {
    materialProgression: ['rough timber', 'reinforced timber/stone', 'mature masonry', 'premium masonry/metal'] as const,
    landmarkVocabulary: ['canopy', 'secondary roof', 'tower/silo/gallery', 'formal crown/standard'] as const,
    emissiveUse: 'lantern/fire accents only; never use color glow as the primary level signal',
  },
  modern: {
    materialProgression: ['utility concrete', 'reinforced panels', 'steel/glass systems', 'premium armor/controlled light'] as const,
    landmarkVocabulary: ['service frame', 'elevated module', 'command/defense superstructure', 'spire/crown/major light signature'] as const,
    emissiveUse: 'controlled security/energy accents are allowed only after silhouette differences are established',
  },
} as const satisfies Record<UpgradeVisualEra, object>;

export function normalizeUpgradeVisualLevel(value: number): UpgradeVisualLevel {
  const level = Math.max(1, Math.min(4, Math.floor(Number.isFinite(value) ? value : 1)));
  return level as UpgradeVisualLevel;
}

export function upgradeVisualProfile(value: number): UpgradeVisualProfile {
  return UPGRADE_VISUAL_LANGUAGE[normalizeUpgradeVisualLevel(value)];
}
