import type { BattleStatus } from '../battle/types';
import type { KeepState, MissionProgressState } from '../core/types';
import type { CellEntry } from '../state/GameState';

export type MissionCategory = 'growth' | 'fortress' | 'maritime' | 'defense';

export interface MissionSnapshot {
  population: {
    totalPopulation: number;
    deadCivilians: number;
  };
  cells: CellEntry[];
  keeps: KeepState[];
  battle: BattleStatus;
}

export interface MissionProgress {
  current: number;
  target: number;
  complete: boolean;
}

export interface MissionDefinition {
  id: string;
  category: MissionCategory;
  icon: string;
  title: string;
  description: string;
  progressLabel: string;
  target: number;
  priority: number;
  unlocksAfter?: readonly string[];
  evaluate(snapshot: MissionSnapshot, state: MissionProgressState): MissionProgress;
}

export interface MissionViewEntry {
  definition: MissionDefinition;
  progress: MissionProgress;
  completed: boolean;
  completedAt?: number;
  unlocked: boolean;
  pinned: boolean;
}

export interface MissionView {
  active: MissionViewEntry[];
  completed: MissionViewEntry[];
  locked: MissionViewEntry[];
  pinnedMissionId?: string;
  totalCompleted: number;
  totalMissions: number;
}

export interface MissionUpdateResult {
  completedIds: string[];
  stateChanged: boolean;
}

const createInitialState = (): MissionProgressState => ({
  version: 1,
  completedAt: {},
  defenseVictories: 0,
  flawlessDefenseVictories: 0,
});

function progress(current: number, target: number): MissionProgress {
  const safeCurrent = Math.max(0, Number.isFinite(current) ? current : 0);
  const safeTarget = Math.max(1, Number.isFinite(target) ? target : 1);
  return {
    current: Math.min(safeCurrent, safeTarget),
    target: safeTarget,
    complete: safeCurrent >= safeTarget,
  };
}

function maxHarborLevel(cells: CellEntry[]): number {
  return cells.reduce((max, cell) => cell.kind === 'harbor' ? Math.max(max, cell.level ?? 1) : max, 0);
}

function maxKeepFloors(keeps: KeepState[]): number {
  return keeps.reduce((max, keep) => Math.max(max, keep.floors || 0), 0);
}

export const MISSION_DEFINITIONS: readonly MissionDefinition[] = [
  {
    id: 'growth-population-25',
    category: 'growth',
    icon: '⌂',
    title: 'A Growing Settlement',
    description: 'Grow the settlement to 25 living citizens.',
    progressLabel: 'Population',
    target: 25,
    priority: 100,
    evaluate: (snapshot) => progress(snapshot.population.totalPopulation, 25),
  },
  {
    id: 'maritime-first-harbor',
    category: 'maritime',
    icon: '⚓',
    title: 'Open the Coast',
    description: 'Build a Harbor to establish a permanent coastal route.',
    progressLabel: 'Harbors',
    target: 1,
    priority: 92,
    evaluate: (snapshot) => progress(snapshot.cells.filter((cell) => cell.kind === 'harbor').length, 1),
  },
  {
    id: 'fortress-keep-3',
    category: 'fortress',
    icon: '♜',
    title: 'Raise the Keep',
    description: 'Develop a Keep to at least three floors so the stronghold reads clearly as a seat of power.',
    progressLabel: 'Keep floors',
    target: 3,
    priority: 88,
    evaluate: (snapshot) => progress(maxKeepFloors(snapshot.keeps), 3),
  },
  {
    id: 'growth-population-100',
    category: 'growth',
    icon: '♛',
    title: 'A True Castle Town',
    description: 'Reach a population of 100 without losing sight of settlement growth.',
    progressLabel: 'Population',
    target: 100,
    priority: 76,
    unlocksAfter: ['growth-population-25'],
    evaluate: (snapshot) => progress(snapshot.population.totalPopulation, 100),
  },
  {
    id: 'maritime-harbor-3',
    category: 'maritime',
    icon: '⚓',
    title: 'Merchant Harbor',
    description: 'Upgrade a Harbor to Level 3 to turn the coast into a serious trade route.',
    progressLabel: 'Harbor level',
    target: 3,
    priority: 72,
    unlocksAfter: ['maritime-first-harbor'],
    evaluate: (snapshot) => progress(maxHarborLevel(snapshot.cells), 3),
  },
  {
    id: 'defense-first-victory',
    category: 'defense',
    icon: '⚔',
    title: 'Hold the Line',
    description: 'Defend the castle successfully against one completed attack.',
    progressLabel: 'Defense victories',
    target: 1,
    priority: 84,
    evaluate: (_snapshot, state) => progress(state.defenseVictories, 1),
  },
  {
    id: 'defense-three-victories',
    category: 'defense',
    icon: '🛡',
    title: 'Proven Defenses',
    description: 'Win three completed defensive battles.',
    progressLabel: 'Defense victories',
    target: 3,
    priority: 68,
    unlocksAfter: ['defense-first-victory'],
    evaluate: (_snapshot, state) => progress(state.defenseVictories, 3),
  },
  {
    id: 'defense-flawless',
    category: 'defense',
    icon: '✦',
    title: 'No Civilian Left Behind',
    description: 'Win a defensive battle without increasing the civilian death count during that battle.',
    progressLabel: 'Flawless defenses',
    target: 1,
    priority: 64,
    unlocksAfter: ['defense-first-victory'],
    evaluate: (_snapshot, state) => progress(state.flawlessDefenseVictories, 1),
  },
];

export class MissionSystem {
  private state: MissionProgressState = createInitialState();
  private battleTracked = false;
  private battleStartCivilianDeaths = 0;
  private lastBattleMode: BattleStatus['mode'] = 'idle';

  reset(): void {
    this.state = createInitialState();
    this.battleTracked = false;
    this.battleStartCivilianDeaths = 0;
    this.lastBattleMode = 'idle';
  }

  getState(): MissionProgressState {
    return {
      version: 1,
      completedAt: { ...this.state.completedAt },
      pinnedMissionId: this.state.pinnedMissionId,
      defenseVictories: this.state.defenseVictories,
      flawlessDefenseVictories: this.state.flawlessDefenseVictories,
    };
  }

  setState(value?: Partial<MissionProgressState> | null): void {
    if (!value) {
      this.reset();
      return;
    }

    const completedAt: Record<string, number> = {};
    if (value.completedAt && typeof value.completedAt === 'object') {
      for (const [id, timestamp] of Object.entries(value.completedAt)) {
        if (!MISSION_DEFINITIONS.some((mission) => mission.id === id)) continue;
        const normalized = Number(timestamp);
        completedAt[id] = Number.isFinite(normalized) && normalized > 0 ? normalized : Date.now();
      }
    }

    const pinnedMissionId =
      typeof value.pinnedMissionId === 'string' &&
      MISSION_DEFINITIONS.some((mission) => mission.id === value.pinnedMissionId)
        ? value.pinnedMissionId
        : undefined;

    this.state = {
      version: 1,
      completedAt,
      pinnedMissionId,
      defenseVictories: Math.max(0, Math.floor(Number(value.defenseVictories) || 0)),
      flawlessDefenseVictories: Math.max(0, Math.floor(Number(value.flawlessDefenseVictories) || 0)),
    };
    this.battleTracked = false;
    this.battleStartCivilianDeaths = 0;
    this.lastBattleMode = 'idle';
  }

  setPinnedMission(id?: string): boolean {
    if (id && !MISSION_DEFINITIONS.some((mission) => mission.id === id)) return false;
    if (this.state.pinnedMissionId === id) return false;
    this.state.pinnedMissionId = id;
    return true;
  }

  update(snapshot: MissionSnapshot): MissionUpdateResult {
    let stateChanged = this.observeBattle(snapshot.battle, snapshot.population.deadCivilians);
    const completedIds: string[] = [];

    for (const definition of MISSION_DEFINITIONS) {
      if (this.state.completedAt[definition.id]) continue;
      if (!this.isUnlocked(definition)) continue;
      const result = definition.evaluate(snapshot, this.state);
      if (!result.complete) continue;
      this.state.completedAt[definition.id] = Date.now();
      completedIds.push(definition.id);
      stateChanged = true;
    }

    if (
      this.state.pinnedMissionId &&
      (this.state.completedAt[this.state.pinnedMissionId] ||
        !this.isUnlocked(MISSION_DEFINITIONS.find((mission) => mission.id === this.state.pinnedMissionId)!))
    ) {
      this.state.pinnedMissionId = undefined;
      stateChanged = true;
    }

    if (!this.state.pinnedMissionId) {
      const next = this.availableEntries(snapshot)
        .filter((entry) => !entry.completed)
        .sort((a, b) => b.definition.priority - a.definition.priority)[0];
      if (next) {
        this.state.pinnedMissionId = next.definition.id;
        stateChanged = true;
      }
    }

    return { completedIds, stateChanged };
  }

  getView(snapshot: MissionSnapshot): MissionView {
    const entries = MISSION_DEFINITIONS.map((definition): MissionViewEntry => {
      const completedAt = this.state.completedAt[definition.id];
      const unlocked = this.isUnlocked(definition);
      return {
        definition,
        progress: definition.evaluate(snapshot, this.state),
        completed: Boolean(completedAt),
        completedAt,
        unlocked,
        pinned: this.state.pinnedMissionId === definition.id,
      };
    });

    const active = entries
      .filter((entry) => entry.unlocked && !entry.completed)
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.definition.priority - a.definition.priority);
    const completed = entries
      .filter((entry) => entry.completed)
      .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));
    const locked = entries
      .filter((entry) => !entry.unlocked && !entry.completed)
      .sort((a, b) => b.definition.priority - a.definition.priority);

    return {
      active,
      completed,
      locked,
      pinnedMissionId: this.state.pinnedMissionId,
      totalCompleted: completed.length,
      totalMissions: entries.length,
    };
  }

  private availableEntries(snapshot: MissionSnapshot): MissionViewEntry[] {
    return this.getView(snapshot).active;
  }

  private isUnlocked(definition: MissionDefinition): boolean {
    const dependencies = definition.unlocksAfter ?? [];
    return dependencies.every((id) => Boolean(this.state.completedAt[id]));
  }

  observeBattle(battle: BattleStatus, deadCivilians: number): boolean {
    const mode = battle.mode;
    let changed = false;

    if (
      mode === 'running' &&
      !this.battleTracked &&
      (this.lastBattleMode === 'idle' || this.lastBattleMode === 'finished')
    ) {
      this.battleTracked = true;
      this.battleStartCivilianDeaths = deadCivilians;
    }

    if (mode === 'finished' && this.lastBattleMode !== 'finished' && this.battleTracked) {
      if (battle.result?.winner === 'defender') {
        this.state.defenseVictories += 1;
        if (deadCivilians <= this.battleStartCivilianDeaths) {
          this.state.flawlessDefenseVictories += 1;
        }
        changed = true;
      }
      this.battleTracked = false;
    }

    if (mode === 'idle' && this.lastBattleMode !== 'idle') {
      this.battleTracked = false;
    }

    this.lastBattleMode = mode;
    return changed;
  }
}
