import type { GameMode } from './GameMode';

export type WallKind = 'wall1' | 'wall2' | 'wall3';
export type RoadKind = 'road' | 'dirtRoad' | 'stoneRoad';
/** Legacy dock kinds remain readable for pre-v13 saves; new gameplay creates only `harbor`. */
export type HarborKind = 'smallDock' | 'woodenPier' | 'harbor' | 'fishingDock';
export type ShipKind = 'fishingBoat' | 'tradingBoat' | 'transportShip';
export type WallThickness = 'thin' | 'medium' | 'thick';
export type WallDirection = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';
export type GateRotationMode = 'auto' | 'manual';
export type WallCornerKind = 'square' | 'rounded' | 'reinforced' | 'turret' | 'buttressed';

export type TowerShape = 'square' | 'round' | 'octagonal' | 'corner' | 'watch';
export type TowerTop =
  | 'conical'
  | 'hipped'
  | 'pyramidal'
  | 'openBattlement'
  | 'timberRoof'
  | 'battlement'
  | 'roof'
  | 'flat'
  | 'flag'
  | 'watch';
export type StoneStyle = 'limestone' | 'darkStone' | 'sandstone' | 'frontier' | 'whitePlaster' | 'earthen';
export type TowerBridgeKind = 'stone' | 'wood';
export type AccessKind = 'stoneStairs' | 'woodenStairs' | 'ramp' | 'ladder';
export type GeneratedAccessKind = AccessKind | 'stairTower';
export type TerrainToolKind = 'raise' | 'lower' | 'flatten' | 'smooth' | 'hill' | 'cliff';
export type KeepRoofStyle = 'flatBattlement' | 'sloped' | 'defensivePlatform' | 'towered' | 'japaneseTiered';

export interface KeepState {
  id: number;
  x: number;
  y: number;
  width: number;
  depth: number;
  floors: number;
  rotation: number;
  cornerTowers: boolean;
  roof: KeepRoofStyle;
  battlements: boolean;
  seed: number;
}

export type TileKind =
  | WallKind
  | RoadKind
  | HarborKind
  | 'gate'
  | 'tower'
  /** Legacy save compatibility only. New Stair Towers are generated architecture. */
  | 'stairTower'
  | 'cottage'
  | 'house'
  | 'manor'
  | 'villa'
  | 'farm'
  | 'cowBarn'
  | 'appleOrchard'
  | 'armyCamp'
  | 'market'
  | 'basilica'
  | 'mosque'
  | 'windmill'
  | 'mine'
  | 'carpenter'
  | 'mountain'
  | 'tree'
  | 'rock'
  | 'hut'
  | 'moat'
  | AccessKind;

export type ToolKind =
  | TileKind
  | 'keep'
  | 'towerBridge'
  | 'mountainRange'
  | 'river'
  | 'land'
  | TerrainToolKind
  | 'erase';

export type MapLayoutId = 'island' | 'mainland' | 'peninsula' | 'twin-isles' | 'urban-60x80';
export type TerrainKind = 'water' | 'shore' | 'plains' | 'river' | 'mountain' | 'forest';
export type TerrainOverrideKind = 'plains' | 'river';

export interface GridCell {
  kind: TileKind;
  level?: number;
  thickness?: WallThickness;
  battlement?: boolean;
  walkway?: boolean;
  towerShape?: TowerShape;
  towerTop?: TowerTop;
  rotation?: number;
  rotationMode?: GateRotationMode;
  wallLinks?: WallDirection[];
  gateOpen?: boolean;
  shipKind?: ShipKind;
  accessHeight?: number;
  /** Persistent building damage ratio: 0 = healthy, 1 = destroyed. */
  damage?: number;
}

export interface TowerBridgeState {
  id: number;
  ax: number;
  ay: number;
  bx: number;
  by: number;
  kind: TowerBridgeKind;
  /** Upgrade progression. Legacy saves without this field are treated as Level 1. */
  level?: number;
}

export interface SavedBattleSetup {
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

export interface MissileInventoryState {
  stock: number;
  productionRemainingMs: number;
  cooldownRemainingMs: number;
  supply: number;
  supplyRechargeRemainingMs: number;
}

export interface EconomyResourceState {
  logs: number;
  wood: number;
  stone: number;
  grain: number;
  apples: number;
  flour: number;
  food: number;
}

export type CivilianOccupation =
  | 'idle'
  | 'farmer'
  | 'builder'
  | 'miner'
  | 'sailor'
  | 'merchant'
  | 'worker'
  | 'militia';

export type MilitiaUnitType = 'swordsman' | 'archer' | 'spearman' | 'crossbowman';

export interface PopulationGridRef {
  x: number;
  y: number;
}

export interface SavedCitizenState {
  id: string;
  alive: boolean;
  home?: PopulationGridRef;
  occupation: CivilianOccupation;
  workplace?: PopulationGridRef;
  previousOccupation?: Exclude<CivilianOccupation, 'militia'>;
  previousWorkplace?: PopulationGridRef;
  militiaType?: MilitiaUnitType;
  mobilized?: boolean;
}

export interface SavedProfessionalSoldierState {
  id: string;
  alive: boolean;
  /** Soldiers are camp-assigned; legacy modernSoldier saves remain readable. */
  unitType: MilitiaUnitType | 'modernSoldier';
  camp?: PopulationGridRef;
}

export interface PopulationSimulationState {
  nextCitizenId: number;
  nextSoldierId: number;
  housingCapacityHighWater: number;
  citizens: SavedCitizenState[];
  professionalArmy: SavedProfessionalSoldierState[];
}

export interface EnvironmentSimulationState {
  cycleDays: number;
  day: number;
  progress: number;
}

export interface MissionProgressState {
  version: 1;
  completedAt: Record<string, number>;
  pinnedMissionId?: string;
  defenseVictories: number;
  flawlessDefenseVictories: number;
}

export interface SavedGame {
  version: number;
  gameMode?: GameMode;
  mapLayoutId?: MapLayoutId;
  worldSeed?: number;
  updatedAt: number;
  cells: Array<{
    x: number;
    y: number;
    kind: TileKind;
    level?: number;
    thickness?: WallThickness;
    battlement?: boolean;
    walkway?: boolean;
    towerShape?: TowerShape;
    towerTop?: TowerTop;
    rotation?: number;
    rotationMode?: GateRotationMode;
    wallLinks?: WallDirection[];
    gateOpen?: boolean;
    shipKind?: ShipKind;
    accessHeight?: number;
    damage?: number;
  }>;
  keeps?: KeepState[];
  stoneStyle?: StoneStyle;
  towerBridges?: TowerBridgeState[];
  terrain?: Array<{ x: number; y: number; kind: TerrainOverrideKind }>;
  elevations?: Array<{ x: number; y: number; value: number }>;
  worldSeeded?: boolean;
  battleSetup?: SavedBattleSetup;
  militaryTier?: number;
  missiles?: MissileInventoryState;
  economy?: EconomyResourceState;
  population?: PopulationSimulationState;
  environment?: EnvironmentSimulationState;
  missions?: MissionProgressState;
}

export interface SaveMetadata {
  id: string;
  slot: number | 'quick' | 'autosave';
  name: string;
  createdAt: number;
  updatedAt: number;
  schemaVersion: number;
  gameVersion?: string;
  gameMode?: GameMode;
  summary: {
    buildings: number;
    keeps: number;
    terrainChanges: number;
    elevations: number;
  };
}

export interface SaveRecord {
  metadata: SaveMetadata;
  data: SavedGame;
}
