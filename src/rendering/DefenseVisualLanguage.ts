import type { TowerShape, WallKind } from '../core/types';

export type DefenseReadabilityRole =
  | 'stone-curtain'
  | 'timber-palisade'
  | 'reinforced-bulwark'
  | 'gatehouse'
  | 'keep'
  | 'watch-tower'
  | 'round-tower'
  | 'octagonal-tower'
  | 'square-tower'
  | 'corner-tower';

export interface DefenseSilhouetteProfile {
  readonly role: DefenseReadabilityRole;
  readonly skyline: string;
  readonly massing: string;
  readonly landmark: string;
  readonly maxTopAccents: number;
}

export const WALL_SILHOUETTE_PROFILES: Readonly<Record<WallKind, DefenseSilhouetteProfile>> = {
  wall1: {
    role: 'stone-curtain',
    skyline: 'clean-crenellated-parapet',
    massing: 'medium-stone-curtain',
    landmark: 'regular-stone-merlons',
    maxTopAccents: 0,
  },
  wall2: {
    role: 'timber-palisade',
    skyline: 'sparse-pointed-timber-posts',
    massing: 'lower-lightweight-timber-wall',
    landmark: 'pointed-post-rail',
    maxTopAccents: 6,
  },
  wall3: {
    role: 'reinforced-bulwark',
    skyline: 'broad-shouldered-crenellated-cap',
    massing: 'thick-reinforced-stone-wall',
    landmark: 'heavy-cap-and-bastion-merlons',
    maxTopAccents: 4,
  },
} as const;

export const GATEHOUSE_SILHOUETTE_PROFILE: DefenseSilhouetteProfile = {
  role: 'gatehouse',
  skyline: 'twin-raised-entry-pylons',
  massing: 'wide-opening-with-flanking-piers',
  landmark: 'paired-pier-crowns-over-opening',
  maxTopAccents: 4,
};

export const KEEP_SILHOUETTE_PROFILE: DefenseSilhouetteProfile = {
  role: 'keep',
  skyline: 'dominant-central-defensive-mass',
  massing: 'multi-cell-vertical-core',
  landmark: 'roof-or-battlement-crown-with-corner-towers',
  maxTopAccents: 8,
};

export const TOWER_SILHOUETTE_PROFILES: Readonly<Record<TowerShape, DefenseSilhouetteProfile>> = {
  watch: {
    role: 'watch-tower',
    skyline: 'narrow-observation-crown',
    massing: 'slender-round-watch-body',
    landmark: 'observation-collar',
    maxTopAccents: 4,
  },
  round: {
    role: 'round-tower',
    skyline: 'round-defensive-crown',
    massing: 'broad-cylindrical-body',
    landmark: 'circular-platform',
    maxTopAccents: 4,
  },
  octagonal: {
    role: 'octagonal-tower',
    skyline: 'faceted-defensive-crown',
    massing: 'faceted-stone-body',
    landmark: 'octagonal-gallery',
    maxTopAccents: 4,
  },
  square: {
    role: 'square-tower',
    skyline: 'square-defensive-crown',
    massing: 'broad-square-body',
    landmark: 'four-corner-shoulders',
    maxTopAccents: 4,
  },
  corner: {
    role: 'corner-tower',
    skyline: 'heavy-square-corner-crown',
    massing: 'reinforced-corner-body',
    landmark: 'cross-wall-shoulders',
    maxTopAccents: 4,
  },
} as const;

export const WALL_DAMAGE_READABILITY = {
  healthy: { silhouetteLoss: 0, cue: 'continuous-top-line' },
  damaged: { silhouetteLoss: 0, cue: 'large-upper-cracks-and-chips' },
  heavy: { silhouetteLoss: 1, cue: 'broken-parapet-notch-and-rubble' },
  partial: { silhouetteLoss: 2, cue: 'deep-top-breach-and-fallen-slabs' },
  breached: { silhouetteLoss: 3, cue: 'open-gap-with-low-rubble-stubs' },
} as const;

export function towerSilhouetteProfile(shape: TowerShape): DefenseSilhouetteProfile {
  return TOWER_SILHOUETTE_PROFILES[shape];
}
