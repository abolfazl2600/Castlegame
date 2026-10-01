export interface EndlessDefenseEnemyComposition {
  swordsman?: number;
  spearman?: number;
  archer?: number;
  crossbowman?: number;
}

export interface EndlessDefenseWaveDefinition {
  readonly waveNumber: number;
  readonly enemies: Readonly<EndlessDefenseEnemyComposition>;
  readonly spawnInterval: number;
  readonly spawnBatchSize: number;
  readonly intermissionSeconds: number;
  readonly difficulty: number;
}

export const ENDLESS_DEFENSE_WAVES: readonly EndlessDefenseWaveDefinition[] = [
  { waveNumber: 1, enemies: { swordsman: 6 }, spawnInterval: 0.9, spawnBatchSize: 1, intermissionSeconds: 4, difficulty: 1 },
  { waveNumber: 2, enemies: { swordsman: 8, archer: 2 }, spawnInterval: 0.82, spawnBatchSize: 1, intermissionSeconds: 4, difficulty: 1.12 },
  { waveNumber: 3, enemies: { swordsman: 10, spearman: 2, archer: 2 }, spawnInterval: 0.75, spawnBatchSize: 1, intermissionSeconds: 4, difficulty: 1.25 },
  { waveNumber: 4, enemies: { swordsman: 12, spearman: 3, archer: 3 }, spawnInterval: 0.68, spawnBatchSize: 2, intermissionSeconds: 4, difficulty: 1.4 },
  { waveNumber: 5, enemies: { swordsman: 14, spearman: 4, archer: 4 }, spawnInterval: 0.62, spawnBatchSize: 2, intermissionSeconds: 4, difficulty: 1.55 },
  { waveNumber: 6, enemies: { swordsman: 16, spearman: 4, archer: 5, crossbowman: 2 }, spawnInterval: 0.56, spawnBatchSize: 2, intermissionSeconds: 4, difficulty: 1.72 },
  { waveNumber: 7, enemies: { swordsman: 18, spearman: 5, archer: 6, crossbowman: 3 }, spawnInterval: 0.5, spawnBatchSize: 2, intermissionSeconds: 4, difficulty: 1.9 },
  { waveNumber: 8, enemies: { swordsman: 20, spearman: 6, archer: 7, crossbowman: 4 }, spawnInterval: 0.45, spawnBatchSize: 3, intermissionSeconds: 4, difficulty: 2.08 },
  { waveNumber: 9, enemies: { swordsman: 22, spearman: 7, archer: 8, crossbowman: 5 }, spawnInterval: 0.4, spawnBatchSize: 3, intermissionSeconds: 4, difficulty: 2.26 },
  { waveNumber: 10, enemies: { swordsman: 24, spearman: 8, archer: 9, crossbowman: 6 }, spawnInterval: 0.36, spawnBatchSize: 3, intermissionSeconds: 4, difficulty: 2.45 },
];

export function getEndlessDefenseWave(waveNumber: number): EndlessDefenseWaveDefinition {
  const explicit = ENDLESS_DEFENSE_WAVES.find((wave) => wave.waveNumber === waveNumber);
  if (explicit) return explicit;

  const base = ENDLESS_DEFENSE_WAVES[ENDLESS_DEFENSE_WAVES.length - 1];
  const extraWaves = Math.max(1, waveNumber - base.waveNumber);
  return {
    waveNumber,
    enemies: {
      swordsman: (base.enemies.swordsman ?? 0) + extraWaves * 3,
      spearman: (base.enemies.spearman ?? 0) + Math.floor(extraWaves / 3),
      archer: (base.enemies.archer ?? 0) + Math.floor(extraWaves / 2),
      crossbowman: (base.enemies.crossbowman ?? 0) + Math.floor(extraWaves / 4),
    },
    spawnInterval: Math.max(0.22, base.spawnInterval - extraWaves * 0.02),
    spawnBatchSize: Math.min(5, base.spawnBatchSize + Math.floor(extraWaves / 3)),
    intermissionSeconds: base.intermissionSeconds,
    difficulty: base.difficulty + extraWaves * 0.18,
  };
}

export function endlessDefenseEnemyCount(enemies: EndlessDefenseEnemyComposition): number {
  return Object.values(enemies).reduce((total, value) => total + (value ?? 0), 0);
}
