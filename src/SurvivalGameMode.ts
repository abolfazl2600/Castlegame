import type {
  GameModeLifecycle,
  GameModeLifecycleContext,
  GameModeDefinition,
} from './core/GameModeFoundation';
import type { GameModeId } from './core/GameModeFoundation';
import type { GameState } from './state/GameState';
import type { BattleSetup, BattleStatus } from './battle/types';
import { BattleSystem, type BattleStartOptions } from './battle/BattleSystem';

export type SurvivalWaveState = 'idle' | 'spawning' | 'active' | 'intermission' | 'defeat' | 'ended';

export interface SurvivalEnemyComposition {
  swordsman?: number;
  spearman?: number;
  archer?: number;
  crossbowman?: number;
  modernSoldier?: number;
}

export interface SurvivalWaveDefinition {
  readonly waveNumber: number;
  readonly enemies: Readonly<SurvivalEnemyComposition>;
  readonly spawnInterval: number;
  readonly spawnBatchSize: number;
  readonly intermissionSeconds: number;
  readonly difficulty: number;
}

export interface SurvivalConfig {
  readonly waves: readonly SurvivalWaveDefinition[];
  readonly endlessScaling: {
    readonly extraSwordsmenPerWave: number;
    readonly extraArchersEveryNWaves: number;
    readonly extraSpearmenEveryNWaves: number;
    readonly extraCrossbowmenEveryNWaves: number;
    readonly minimumSpawnInterval: number;
  };
}

export interface SurvivalRuntimeState {
  currentWave: number;
  highestCompletedWave: number;
  waveState: SurvivalWaveState;
  activeWaveEnemyCount: number;
  survivalElapsedTime: number;
  waveElapsedTime: number;
}

export interface SurvivalLifecycleDependencies {
  readonly battleSystem: BattleSystem;
  readonly getBattleSetup: () => BattleSetup;
  readonly setStatus: (message: string) => void;
  readonly setAttackState: (active: boolean) => void;
  readonly onDefeat: () => void;
}

export const SURVIVAL_CONFIG: SurvivalConfig = {
  waves: [
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
  ],
  endlessScaling: {
    extraSwordsmenPerWave: 3,
    extraArchersEveryNWaves: 2,
    extraSpearmenEveryNWaves: 3,
    extraCrossbowmenEveryNWaves: 4,
    minimumSpawnInterval: 0.22,
  },
};

function enemyCount(enemies: SurvivalEnemyComposition): number {
  return Object.values(enemies).reduce((total, value) => total + (value ?? 0), 0);
}

function toBattleSetup(
  enemies: SurvivalEnemyComposition,
  defenders: BattleSetup,
): BattleSetup {
  return {
    attackerSwordsmen: enemies.swordsman ?? 0,
    attackerArchers: enemies.archer ?? 0,
    attackerSpearmen: enemies.spearman ?? 0,
    attackerCrossbowmen: enemies.crossbowman ?? 0,
    attackerModernSoldiers: enemies.modernSoldier ?? 0,
    defenderSwordsmen: defenders.defenderSwordsmen,
    defenderArchers: defenders.defenderArchers,
    defenderSpearmen: defenders.defenderSpearmen,
    defenderCrossbowmen: defenders.defenderCrossbowmen,
    defenderModernSoldiers: defenders.defenderModernSoldiers,
  };
}

export function getSurvivalWaveDefinition(waveNumber: number): SurvivalWaveDefinition {
  const explicit = SURVIVAL_CONFIG.waves.find((wave) => wave.waveNumber === waveNumber);
  if (explicit) return explicit;

  const base = SURVIVAL_CONFIG.waves[SURVIVAL_CONFIG.waves.length - 1];
  const extraWaves = Math.max(1, waveNumber - base.waveNumber);
  const scale = SURVIVAL_CONFIG.endlessScaling;

  return {
    waveNumber,
    enemies: {
      swordsman: (base.enemies.swordsman ?? 0) + extraWaves * scale.extraSwordsmenPerWave,
      spearman:
        (base.enemies.spearman ?? 0) +
        Math.floor(extraWaves / scale.extraSpearmenEveryNWaves),
      archer:
        (base.enemies.archer ?? 0) +
        Math.floor(extraWaves / scale.extraArchersEveryNWaves),
      crossbowman:
        (base.enemies.crossbowman ?? 0) +
        Math.floor(extraWaves / scale.extraCrossbowmenEveryNWaves),
    },
    spawnInterval: Math.max(
      scale.minimumSpawnInterval,
      base.spawnInterval - extraWaves * 0.02,
    ),
    spawnBatchSize: Math.min(5, base.spawnBatchSize + Math.floor(extraWaves / 3)),
    intermissionSeconds: base.intermissionSeconds,
    difficulty: base.difficulty + extraWaves * 0.18,
  };
}

export function createSurvivalDefinition(
  dependencies: SurvivalLifecycleDependencies,
): GameModeDefinition {
  return {
    id: 'survival',
    displayName: 'Survival',
    description: 'Endless wave defense using the existing castle, enemy, combat, and navigation systems.',
    available: true,
    metadata: {
      source: 'survival-game-mode',
      endless: true,
      foundation: 'game-mode-registry',
    },
    createLifecycle: () => new SurvivalGameMode(dependencies),
  };
}

export class SurvivalGameMode implements GameModeLifecycle {
  private readonly runtime: SurvivalRuntimeState = {
    currentWave: 0,
    highestCompletedWave: 0,
    waveState: 'idle',
    activeWaveEnemyCount: 0,
    survivalElapsedTime: 0,
    waveElapsedTime: 0,
  };

  private hud: HTMLElement | null = null;
  private lastBattleMode: BattleStatus['mode'] = 'idle';

  constructor(private readonly dependencies: SurvivalLifecycleDependencies) {}

  initialize(context: GameModeLifecycleContext): void {
    this.assertContext(context);
    this.ensureHud();
    this.renderHud();
  }

  start(context: GameModeLifecycleContext): void {
    this.assertContext(context);
    this.resetRuntime();
    this.dependencies.setAttackState(true);
    this.ensureHud();
    this.startWave(1, context);
  }

  pause(context: GameModeLifecycleContext): void {
    this.assertContext(context);
    if (this.runtime.waveState === 'ended' || this.runtime.waveState === 'defeat') return;
    if (this.dependencies.battleSystem.isRunning()) {
      this.dependencies.battleSystem.stop();
    }
    this.renderHud();
  }

  resume(context: GameModeLifecycleContext): void {
    this.assertContext(context);
    if (this.runtime.waveState === 'ended' || this.runtime.waveState === 'defeat') return;
    if (this.dependencies.battleSystem.status().mode === 'paused') {
      this.dependencies.battleSystem.resume();
    }
    this.renderHud();
  }

  restart(context: GameModeLifecycleContext): void {
    this.assertContext(context);
    this.dependencies.battleSystem.reset(false);
    this.resetRuntime();
    this.dependencies.setAttackState(true);
    this.ensureHud();
    this.startWave(1, context);
  }

  end(context: GameModeLifecycleContext): void {
    this.assertContext(context);
    if (this.runtime.waveState === 'ended') return;

    if (this.dependencies.battleSystem.isRunning()) {
      this.dependencies.battleSystem.stop();
    }
    this.runtime.waveState =
      this.runtime.waveState === 'defeat' ? 'defeat' : 'ended';
    this.dependencies.setAttackState(false);
    this.renderHud();
  }

  cleanup(context: GameModeLifecycleContext): void {
    this.assertContext(context);
    this.dependencies.battleSystem.reset(false);
    this.dependencies.setAttackState(false);
    this.removeHud();
    this.resetRuntime();
  }

  update(context: GameModeLifecycleContext, deltaMs: number): void {
    this.assertContext(context);
    if (
      this.runtime.waveState === 'idle' ||
      this.runtime.waveState === 'ended' ||
      this.runtime.waveState === 'defeat'
    ) {
      return;
    }

    const delta = Math.min(0.25, Math.max(0, deltaMs / 1000));
    this.runtime.survivalElapsedTime += delta;
    this.runtime.waveElapsedTime += delta;

    const battleStatus = this.dependencies.battleSystem.status();
    this.lastBattleMode = battleStatus.mode;

    if (battleStatus.mode === 'finished') {
      if (battleStatus.result?.winner === 'attacker') {
        this.runtime.waveState = 'defeat';
        this.dependencies.setAttackState(false);
        this.renderHud();
        this.dependencies.onDefeat();
        return;
      }

      if (
        battleStatus.result?.winner === 'defender' &&
        this.runtime.waveState !== 'intermission'
      ) {
        this.runtime.highestCompletedWave = Math.max(
          this.runtime.highestCompletedWave,
          this.runtime.currentWave,
        );
        this.runtime.waveState = 'intermission';
        this.runtime.waveElapsedTime = 0;
        this.dependencies.setStatus(
          `Wave ${this.runtime.currentWave} cleared · next wave incoming`,
        );
        this.renderHud();
        return;
      }
    }

    if (
      this.runtime.waveState === 'intermission' &&
      this.runtime.waveElapsedTime >= getSurvivalWaveDefinition(this.runtime.currentWave).intermissionSeconds
    ) {
      this.startWave(this.runtime.currentWave + 1, context);
      return;
    }

    const alive = battleStatus.attackersAlive;
    if (battleStatus.mode === 'running') {
      this.runtime.waveState =
        alive > 0 && this.lastBattleMode === 'running' ? 'active' : 'spawning';
    }
    this.runtime.activeWaveEnemyCount = alive;
    this.renderHud();
  }

  private startWave(waveNumber: number, context: GameModeLifecycleContext): void {
    this.assertContext(context);
    const definition = getSurvivalWaveDefinition(waveNumber);
    const enemyTotal = enemyCount(definition.enemies);
    if (enemyTotal <= 0) {
      this.runtime.waveState = 'ended';
      this.dependencies.setAttackState(false);
      this.dependencies.setStatus('Survival configuration contains an empty wave');
      this.renderHud();
      return;
    }

    const battleSetup = toBattleSetup(
      definition.enemies,
      this.dependencies.getBattleSetup(),
    );
    const options: BattleStartOptions = {
      attackerSpawnInterval: definition.spawnInterval,
      attackerSpawnBatchSize: definition.spawnBatchSize,
    };

    this.runtime.currentWave = waveNumber;
    this.runtime.activeWaveEnemyCount = enemyTotal;
    this.runtime.waveElapsedTime = 0;
    this.runtime.waveState = 'spawning';
    this.dependencies.battleSystem.start(battleSetup, options);
    this.dependencies.setStatus(
      `Survival · Wave ${waveNumber} · ${enemyTotal} enemies`,
    );
    this.renderHud();
  }

  private resetRuntime(): void {
    this.runtime.currentWave = 0;
    this.runtime.highestCompletedWave = 0;
    this.runtime.waveState = 'idle';
    this.runtime.activeWaveEnemyCount = 0;
    this.runtime.survivalElapsedTime = 0;
    this.runtime.waveElapsedTime = 0;
    this.lastBattleMode = 'idle';
  }

  private assertContext(context: GameModeLifecycleContext): void {
    if (context.modeId !== 'survival') {
      throw new Error('Survival lifecycle used with an incompatible game mode');
    }
  }

  private ensureHud(): void {
    if (this.hud?.isConnected) return;

    let hud = document.getElementById('survival-hud');
    if (!hud) {
      hud = document.createElement('section');
      hud.id = 'survival-hud';
      hud.setAttribute('aria-live', 'polite');
      hud.innerHTML =
        '<div class="survival-hud-title">SURVIVAL</div>' +
        '<div class="survival-hud-row"><span>Wave</span><strong data-survival-wave>—</strong></div>' +
        '<div class="survival-hud-row"><span>Status</span><strong data-survival-status>READY</strong></div>' +
        '<div class="survival-hud-row"><span>Enemies</span><strong data-survival-enemies>0</strong></div>' +
        '<div class="survival-hud-row"><span>Time</span><strong data-survival-time>00:00</strong></div>';
      document.body.appendChild(hud);
    }
    this.hud = hud;
  }

  private renderHud(): void {
    if (!this.hud) return;

    const wave = this.hud.querySelector<HTMLElement>('[data-survival-wave]');
    const status = this.hud.querySelector<HTMLElement>('[data-survival-status]');
    const enemies = this.hud.querySelector<HTMLElement>('[data-survival-enemies]');
    const time = this.hud.querySelector<HTMLElement>('[data-survival-time]');

    if (wave) wave.textContent = String(this.runtime.currentWave || '—');
    if (status) {
      status.textContent =
        this.runtime.waveState === 'spawning' ? 'SPAWNING' :
        this.runtime.waveState === 'active' ? 'DEFENDING' :
        this.runtime.waveState === 'intermission' ? 'WAVE CLEARED' :
        this.runtime.waveState === 'defeat' ? 'DEFEATED' :
        this.runtime.waveState === 'ended' ? 'ENDED' :
        'READY';
    }
    if (enemies) enemies.textContent = String(this.runtime.activeWaveEnemyCount);
    if (time) time.textContent = formatTime(this.runtime.survivalElapsedTime);
  }

  private removeHud(): void {
    this.hud?.remove();
    this.hud = null;
  }
}

function formatTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  const remainder = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

export const SURVIVAL_MODE_ID: GameModeId = 'survival';
export type SurvivalStateStore = GameState;
