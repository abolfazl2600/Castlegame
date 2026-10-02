export const CARPENTER_LEVELS = [
  {
    level: 1,
    name: 'Basic Carpenter Shed',
    description: 'A compact starter shed with a simple workbench, small lumber pile, and basic hand-tool storage.',
    workers: 2,
    inputPerSecond: 0.30,
    yieldRatio: 0.80,
  },
  {
    level: 2,
    name: 'Established Workshop',
    description: 'A larger covered workshop with an extended cutting bay, organized lumber racks, and stronger framing.',
    workers: 4,
    inputPerSecond: 0.58,
    yieldRatio: 0.90,
  },
  {
    level: 3,
    name: 'Advanced Woodworking Yard',
    description: 'An expanded production yard with stone-backed storage, a drying loft, timber hoist, carts, and dedicated work areas.',
    workers: 6,
    inputPerSecond: 0.90,
    yieldRatio: 1.00,
  },
  {
    level: 4,
    name: 'Master Carpenter Workshop',
    description: 'A prestigious master workshop with a reinforced hall, production wing, formal lumber racks, upgraded roofline, and maximum throughput.',
    workers: 8,
    inputPerSecond: 1.20,
    yieldRatio: 1.00,
  },
] as const;

export type CarpenterWorkshopLevel = (typeof CARPENTER_LEVELS)[number]['level'];
export type CarpenterWorkshopLevelDefinition = (typeof CARPENTER_LEVELS)[number];

export const CARPENTER_MAX_LEVEL: CarpenterWorkshopLevel = 4;

export function normalizeCarpenterLevel(levelValue?: number | null): CarpenterWorkshopLevel {
  const numeric = Number(levelValue ?? 1);
  const normalized = Number.isFinite(numeric) ? Math.floor(numeric) : 1;
  return Math.max(1, Math.min(CARPENTER_MAX_LEVEL, normalized)) as CarpenterWorkshopLevel;
}

export function carpenterLevelDefinition(levelValue?: number | null): CarpenterWorkshopLevelDefinition {
  return CARPENTER_LEVELS[normalizeCarpenterLevel(levelValue) - 1];
}
