import type { Faction, UnitType } from '../types';

export type BattleObjectiveType =
  | 'destroy_gate'
  | 'capture_tower'
  | 'breach_wall'
  | 'protect_commander'
  | 'hold_position'
  | 'escort_siege_weapon'
  | 'destroy_enemy_siege_equipment'
  | 'capture_keep'
  | 'survive'
  | 'defeat_enemy_commander'
  | 'protect_gate'
  | 'protect_wall'
  | 'eliminate_army'
  | 'reach_castle'
  | 'destroy_siege_camp';

export type BattleObjectiveStatus = 'locked' | 'active' | 'completed' | 'failed';
export type BattleObjectivePriority = 'primary' | 'secondary';
export type ObjectiveVictoryMode = 'all_primary' | 'any_primary';

export interface ObjectiveTarget {
  gateId?: string;
  wallId?: string;
  towerId?: string;
  keepId?: string;
  unitId?: string;
  entityId?: string;
  positionId?: string;
}

export interface ObjectiveRewardConfig {
  gold?: number;
  resources?: Record<string, number>;
  experience?: number;
  stars?: number;
  unlockId?: string;
}

export interface BattleObjectiveDefinition {
  id: string;
  type: BattleObjectiveType;
  title: string;
  description: string;
  priority: BattleObjectivePriority;
  ownerFaction?: Faction;
  target?: ObjectiveTarget;
  optional?: boolean;
  prerequisites?: string[];
  configuration?: Record<string, unknown>;
  reward?: ObjectiveRewardConfig;
}

export interface BattleObjectiveRuntimeState {
  id: string;
  status: BattleObjectiveStatus;
  currentProgress: number;
  targetProgress: number;
  progressRatio: number;
  activatedAt?: number;
  completedAt?: number;
  failedAt?: number;
  failureReason?: string;
}

export interface ObjectiveUnitSnapshot {
  id: string;
  faction: Faction;
  unitType: UnitType;
  health: number;
  maxHealth: number;
  state: 'forming' | 'moving' | 'guarding' | 'attacking' | 'dead';
  x: number;
  y: number;
  z: number;
}

export interface ObjectiveWallSnapshot {
  id: string;
  health: number;
  maxHealth: number;
  breached: boolean;
  x: number;
  y: number;
}

export interface ObjectiveBuildingSnapshot {
  id: string;
  health?: number;
  maxHealth?: number;
  destroyed?: boolean;
  ownerFaction?: Faction;
  controlledBy?: Faction;
  x?: number;
  y?: number;
  z?: number;
}

export interface ObjectivePositionSnapshot {
  id: string;
  controlledBy?: Faction;
  x: number;
  y: number;
  z: number;
}

export interface ObjectiveContext {
  battleTime: number;
  deltaSeconds: number;
  units: readonly ObjectiveUnitSnapshot[];
  walls: readonly ObjectiveWallSnapshot[];
  buildings: readonly ObjectiveBuildingSnapshot[];
  positions: readonly ObjectivePositionSnapshot[];
  captureProgress: number;
  battleFinished: boolean;
}

export interface BattleScenario {
  id: string;
  primaryObjectives: readonly BattleObjectiveDefinition[];
  secondaryObjectives?: readonly BattleObjectiveDefinition[];
  victory?: {
    mode: ObjectiveVictoryMode;
  };
}

export interface BattleObjectiveEvent {
  type:
    | 'UNIT_KILLED'
    | 'UNIT_REACHED_LOCATION'
    | 'BUILDING_DAMAGED'
    | 'BUILDING_DESTROYED'
    | 'WALL_BREACHED'
    | 'GATE_DESTROYED'
    | 'TOWER_CAPTURED'
    | 'TOWER_LOST'
    | 'KEEP_CAPTURED'
    | 'SIEGE_WEAPON_DESTROYED'
    | 'SIEGE_WEAPON_REACHED_DESTINATION'
    | 'COMMANDER_KILLED'
    | 'POSITION_CAPTURED'
    | 'POSITION_LOST'
    | 'BATTLE_TIME_UPDATED'
    | 'REINFORCEMENTS_SPAWNED';
  entityId?: string;
  faction?: Faction;
  payload?: Readonly<Record<string, unknown>>;
}
