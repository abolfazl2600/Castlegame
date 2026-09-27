import type { BattleUnitStats } from './types';

export type MilitaryTier = 1 | 2 | 3 | 4;

export interface MilitaryTierDefinition {
  readonly tier: MilitaryTier;
  readonly name: string;
  readonly technology: string;
  readonly requirement: string;
  readonly unitHealthMultiplier: number;
  readonly unitDefenseMultiplier: number;
  readonly unitDamageMultiplier: number;
  readonly unitMoveSpeedMultiplier: number;
  readonly unitScanRangeMultiplier: number;
  readonly wallHealthMultiplier: number;
  readonly weaponRangeMultiplier: number;
  readonly weaponDamageMultiplier: number;
  readonly weaponCooldownMultiplier: number;
}

export const MILITARY_TIERS: readonly MilitaryTierDefinition[] = [
  {
    tier: 1,
    name: 'Field Camp',
    technology: 'Basic watch rotations, issued weapons, and local militia training',
    requirement: 'Build an Army Camp',
    unitHealthMultiplier: 1,
    unitDefenseMultiplier: 1,
    unitDamageMultiplier: 1,
    unitMoveSpeedMultiplier: 1,
    unitScanRangeMultiplier: 1,
    wallHealthMultiplier: 1,
    weaponRangeMultiplier: 1,
    weaponDamageMultiplier: 1,
    weaponCooldownMultiplier: 1,
  },
  {
    tier: 2,
    name: 'Reinforced Camp',
    technology: 'Professional drills, shield formations, improved equipment, and faster response',
    requirement: 'Upgrade an Army Camp to Level 2',
    unitHealthMultiplier: 1.1,
    unitDefenseMultiplier: 1.12,
    unitDamageMultiplier: 1.08,
    unitMoveSpeedMultiplier: 1.04,
    unitScanRangeMultiplier: 1.05,
    wallHealthMultiplier: 1.1,
    weaponRangeMultiplier: 1.03,
    weaponDamageMultiplier: 1.05,
    weaponCooldownMultiplier: 0.96,
  },
  {
    tier: 3,
    name: 'Command Camp',
    technology: 'Veteran formations, reinforced armor, fortification corps, and coordinated siege defense',
    requirement: 'Upgrade an Army Camp to Level 3',
    unitHealthMultiplier: 1.2,
    unitDefenseMultiplier: 1.24,
    unitDamageMultiplier: 1.16,
    unitMoveSpeedMultiplier: 1.08,
    unitScanRangeMultiplier: 1.12,
    wallHealthMultiplier: 1.28,
    weaponRangeMultiplier: 1.12,
    weaponDamageMultiplier: 1.14,
    weaponCooldownMultiplier: 0.88,
  },
  {
    tier: 4,
    name: 'Royal War Camp',
    technology: 'Elite troops, advanced targeting, hardened defenses, rapid logistics, and maximum battlefield coordination',
    requirement: 'Upgrade an Army Camp to Level 4',
    unitHealthMultiplier: 1.32,
    unitDefenseMultiplier: 1.38,
    unitDamageMultiplier: 1.28,
    unitMoveSpeedMultiplier: 1.12,
    unitScanRangeMultiplier: 1.2,
    wallHealthMultiplier: 1.48,
    weaponRangeMultiplier: 1.24,
    weaponDamageMultiplier: 1.28,
    weaponCooldownMultiplier: 0.76,
  },
];

export function normalizeMilitaryTier(value: unknown): MilitaryTier {
  const tier = Number(value);
  return tier === 4 ? 4 : tier === 3 ? 3 : tier === 2 ? 2 : 1;
}

export function militaryTierDefinition(tier: MilitaryTier): MilitaryTierDefinition {
  return MILITARY_TIERS[tier - 1];
}

export function defenderUnitStats(base: BattleUnitStats, tier: MilitaryTier): BattleUnitStats {
  const definition = militaryTierDefinition(tier);
  return {
    ...base,
    maxHealth: Math.round(base.maxHealth * definition.unitHealthMultiplier),
    attack: Math.round(base.attack * definition.unitDamageMultiplier),
    defense: Math.round(base.defense * definition.unitDefenseMultiplier),
    damage: Math.round(base.damage * definition.unitDamageMultiplier),
    moveSpeed: Number((base.moveSpeed * definition.unitMoveSpeedMultiplier).toFixed(2)),
    scanRange: Number((base.scanRange * definition.unitScanRangeMultiplier).toFixed(2)),
  };
}
