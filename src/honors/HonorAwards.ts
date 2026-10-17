import type { MissionView } from '../missions/MissionSystem';

export interface HonorAwardRule {
  id: string;
  missionId: string;
  fallbackName: { fa: string; en: string };
}

/** Earned by completing existing missions; no new currency or save schema. */
export const HONOR_AWARD_RULES: readonly HonorAwardRule[] = [
  { id: 'royal-architect', missionId: 'growth-ten-homes',
    fallbackName: { fa: 'معمار سلطنتی', en: 'Royal Architect' } },
  { id: 'harvest-steward', missionId: 'growth-three-farms',
    fallbackName: { fa: 'نگهبان برداشت', en: 'Harvest Steward' } },
  { id: 'stone-bastion', missionId: 'fortress-ten-walls',
    fallbackName: { fa: 'معمار دژ سنگی', en: 'Stone Bastion' } },
  { id: 'prosperous-realm', missionId: 'growth-population-100',
    fallbackName: { fa: 'فرمانروای آبادانی', en: 'Prosperous Realm' } },
];

/**
 * Earning is based on the current save's already-persisted completed mission
 * state, not on whether someone downloaded public GitHub image bytes.
 */
export function hasEarnedHonor(view: MissionView, id: string): boolean {
  const rule = HONOR_AWARD_RULES.find((item) => item.id === id);
  return Boolean(rule && view.completed.some((entry) => entry.definition.id === rule.missionId));
}
