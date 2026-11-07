/**
 * Headless, deterministic attacker decisions. Keep tactics independent of
 * Three.js and persistence so the same rules work on web and Android.
 */
export interface TacticalPoint { x: number; y: number }

export interface BreachAssessment {
  pathLength: number;
  currentHealth: number;
  maxHealth: number;
  defendersNearby: number;
  wallLevel: number;
  stalledPenalty?: number;
}

export function breachApproachScore(input: BreachAssessment): number {
  const health = Math.max(0, Math.min(input.maxHealth, input.currentHealth));
  return input.pathLength +
    (health / 520) * 2.2 +
    input.defendersNearby * 1.35 +
    Math.max(0, input.wallLevel - 1) * 1.1 +
    Math.max(0, input.stalledPenalty ?? 0);
}

export const RETREAT_HEALTH_THRESHOLD = 0.28;
export const RETREAT_DURATION_SECONDS = 3.8;
export const RETREAT_COOLDOWN_SECONDS = 14;
export const ASSAULT_RALLY_MAX_SECONDS = 3.5;

/** Only an injured, supported attacker under immediate pressure falls back. */
export function shouldRetreatAttacker(
  health: number,
  maxHealth: number,
  nearbyEnemies: number,
  remainingAttackers: number,
  cooldownSeconds: number,
): boolean {
  return maxHealth > 0 &&
    health > 0 &&
    health / maxHealth <= RETREAT_HEALTH_THRESHOLD &&
    nearbyEnemies > 0 &&
    remainingAttackers > 1 &&
    cooldownSeconds <= 0;
}

/** Prefer a safe location away from the *group* of nearby defenders. */
export function retreatGoal(
  unit: TacticalPoint,
  threats: readonly TacticalPoint[],
  fallback: TacticalPoint,
  cols: number,
  rows: number,
): TacticalPoint {
  let dx = 0;
  let dy = 0;
  for (const threat of threats) {
    const awayX = unit.x - threat.x;
    const awayY = unit.y - threat.y;
    const distanceSquared = Math.max(1, awayX * awayX + awayY * awayY);
    dx += awayX / distanceSquared;
    dy += awayY / distanceSquared;
  }
  if (Math.hypot(dx, dy) < 0.001) {
    dx = fallback.x - unit.x;
    dy = fallback.y - unit.y;
  }
  const length = Math.hypot(dx, dy);
  if (length < 0.001) return { ...unit };
  return {
    x: Math.max(0, Math.min(cols - 1, Math.round(unit.x + dx / length * 5))),
    y: Math.max(0, Math.min(rows - 1, Math.round(unit.y + dy / length * 5))),
  };
}

/**
 * A small focus incentive brings 2-4 attackers together; the increasing
 * penalty above that prevents the entire army swarming one defender.
 */
export function attackerFocusAdjustment(assigned: number): number {
  if (assigned === 0) return 0;
  if (assigned <= 3) return -1.6;
  return (assigned - 3) * 2.2;
}

export function releaseAssaultGroup(
  nearbyMelee: number,
  totalMelee: number,
  waitedSeconds: number,
): boolean {
  if (totalMelee <= 1) return true;
  return nearbyMelee >= Math.min(3, totalMelee) ||
    waitedSeconds >= ASSAULT_RALLY_MAX_SECONDS;
}
