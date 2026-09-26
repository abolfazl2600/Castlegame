import type { GameMode } from './GameMode';

export type WallKind = 'wall1' | 'wall2' | 'wall3';
export type RoadKind = 'road' | 'dirtRoad' | 'stoneRoad';
export type HarborKind = 'smallDock' | 'woodenPier' | 'harbor' | 'fishingDock';
export type ShipKind = 'fishingBoat' | 'tradingBoat' | 'transportShip';
export type WallThickness = 'thin' | 'medium' | 'thick';
export type WallDirection = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';
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
export type StoneStyle = 'limestone' | 'darkStone' | 'sandstone' | 'frontier';
export type TowerBridgeKind = 'stone' | 'wood';
export type AccessKind = 'stoneStairs' | 'woodenStairs' | 'ramp' | 'ladder';
export type TerrainToolKind = 'raise' | 'lower' | 'flatten' | 'smooth' | 'dig' | 'hill' | 'cliff';
export type KeepRoofStyle = 'flatBattlement' | 'sloped' | 'defensivePlatform' | 'towered';

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
  | 'stairTower'
  | 'cottage'
  | 'house'
  | 'manor'
  | 'villa'
  | 'farm'
  | 'appleOrchard'
  | 'armyCamp'
  | 'market'
  | 'windmill'
  | 'mine'
  | 'mountain'
  | 'tree'
  | 'rock'
  | 'hut'
  | 'moat'
  | AccessKind
  | 'futuristicCastle';

export type ToolKind =
  | TileKind
  | 'keep'
  | 'towerBridge'
  | 'mountainRange'
  | 'river'
  | 'land'
  | TerrainToolKind
  | 'erase';

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
  wallLinks?: WallDirection[];
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

export interface SavedGame {
  version: number;
  gameMode?: GameMode;
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
    wallLinks?: WallDirection[];
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
