import type { BattleUnitStats } from './types';

export type MilitaryTier = 1 | 2 | 3 | 4;

export interface MilitaryTierDefinition {
  readonly tier: MilitaryTier;
  readonly name: string;
  readonly technology: string;
  readonly requirement: string;
  readonly unitHealthMultiplier: number;
  readonly unitDefenseMultiplier: number;
  readonly wallHealthMultiplier: number;
  readonly weaponRangeMultiplier: number;
  readonly weaponDamageMultiplier: number;
  readonly weaponCooldownMultiplier: number;
}

export const MILITARY_TIERS: readonly MilitaryTierDefinition[] = [
  { tier: 1, name: 'Militia Garrison', technology: 'Basic watch rotations and issued weapons', requirement: 'Starting tier', unitHealthMultiplier: 1, unitDefenseMultiplier: 1, wallHealthMultiplier: 1, weaponRangeMultiplier: 1, weaponDamageMultiplier: 1, weaponCooldownMultiplier: 1 },
  { tier: 2, name: 'Drill Command', technology: 'Shield drills and coordinated formations', requirement: 'Unlock Military Tier 1 first', unitHealthMultiplier: 1.08, unitDefenseMultiplier: 1.1, wallHealthMultiplier: 1.1, weaponRangeMultiplier: 1, weaponDamageMultiplier: 1, weaponCooldownMultiplier: 1 },
  { tier: 3, name: 'Fortification Corps', technology: 'Reinforced masonry and siege platforms', requirement: 'Unlock Military Tier 2 first', unitHealthMultiplier: 1.16, unitDefenseMultiplier: 1.18, wallHealthMultiplier: 1.25, weaponRangeMultiplier: 1.1, weaponDamageMultiplier: 1.08, weaponCooldownMultiplier: 0.92 },
  { tier: 4, name: 'War Council', technology: 'Advanced targeting and battle logistics', requirement: 'Unlock Military Tier 3 first', unitHealthMultiplier: 1.24, unitDefenseMultiplier: 1.28, wallHealthMultiplier: 1.4, weaponRangeMultiplier: 1.2, weaponDamageMultiplier: 1.2, weaponCooldownMultiplier: 0.82 },
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
  return { ...base, maxHealth: Math.round(base.maxHealth * definition.unitHealthMultiplier), defense: Math.round(base.defense * definition.unitDefenseMultiplier) };
}
