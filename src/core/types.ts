export type WallKind = 'wall1' | 'wall2' | 'wall3';
export type WallThickness = 'thin' | 'medium' | 'thick';
export type TowerShape = 'square' | 'round' | 'octagonal' | 'corner' | 'watch';
export type TowerTop = 'battlement' | 'roof' | 'flat' | 'flag' | 'watch';
export type AccessKind = 'stoneStairs' | 'woodenStairs' | 'ramp' | 'ladder';
export type TerrainToolKind = 'raise' | 'lower' | 'flatten' | 'smooth' | 'dig' | 'hill' | 'cliff';

export type TileKind =
  | WallKind
  | 'gate'
  | 'tower'
  | 'road'
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
  }>;
  terrain?: Array<{ x: number; y: number; kind: TerrainOverrideKind }>;
  elevations?: Array<{ x: number; y: number; value: number }>;
  worldSeeded?: boolean;
}
