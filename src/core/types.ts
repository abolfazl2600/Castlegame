export type WallKind = 'wall1' | 'wall2' | 'wall3';
export type RoadKind = 'road' | 'dirtRoad' | 'stoneRoad';
export type HarborKind = 'smallDock' | 'woodenPier' | 'harbor' | 'fishingDock';
export type ShipKind = 'fishingBoat' | 'tradingBoat' | 'transportShip';
export type WallThickness = 'thin' | 'medium' | 'thick';
export type WallDirection = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';
export type WallCornerKind = 'square' | 'rounded' | 'reinforced' | 'turret' | 'buttressed';

export type TowerShape = 'square' | 'round' | 'octagonal' | 'corner' | 'watch';
export type TowerTop = 'battlement' | 'roof' | 'flat' | 'flag' | 'watch';
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
  | 'cottage'
  | 'house'
  | 'manor'
  | 'villa'
  | 'farm'
  | 'mine'
  | 'mountain'
  | 'tree'
  | 'rock'
  | 'hut'
  | 'moat'
  | AccessKind;

export type ToolKind =
  | TileKind
  | 'keep'
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
}

export interface SavedGame {
  version: number;
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
  }>;
  keeps?: KeepState[];
  terrain?: Array<{ x: number; y: number; kind: TerrainOverrideKind }>;
  elevations?: Array<{ x: number; y: number; value: number }>;
  worldSeeded?: boolean;
}
