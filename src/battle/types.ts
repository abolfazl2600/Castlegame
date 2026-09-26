export type Faction = 'attacker' | 'defender' | (string & {});
export type UnitType = 'swordsman' | 'archer' | 'spearman' | 'crossbowman' | 'modernSoldier' | (string & {});
export type UnitState = 'forming' | 'moving' | 'guarding' | 'attacking' | 'dead';

export interface BattleUnitStats {
  maxHealth: number;
  damage: number;
  attackRange: number;
  attackCooldown: number;
  moveSpeed: number;
  scanRange: number;
}

export interface BattleUnit {
  id: string;
  faction: Faction;
  unitType: UnitType;
  health: number;
  maxHealth: number;
  damage: number;
  attackRange: number;
  attackCooldown: number;
  moveSpeed: number;
  targetId?: string;
  state: UnitState;
}

export interface BattleSetup {
  attackerSwordsmen: number;
  attackerArchers: number;
  attackerSpearmen: number;
  attackerCrossbowmen: number;
  attackerModernSoldiers: number;
  defenderSwordsmen: number;
  defenderArchers: number;
  defenderSpearmen: number;
  defenderCrossbowmen: number;
  defenderModernSoldiers: number;
}

export interface BattleResult {
  winner: Faction | 'none';
  attackersRemaining: number;
  defendersRemaining: number;
  attackersKilled: number;
  defendersKilled: number;
  durationSeconds: number;
}

export interface BattleStatus {
  mode: 'idle' | 'running' | 'paused' | 'finished';
  captureProgress: number;
  captureSeconds: number;
  captureRequiredSeconds: number;
  attackersAlive: number;
  defendersAlive: number;
  result?: BattleResult;
}
