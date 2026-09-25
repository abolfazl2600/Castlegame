export type WallKind = 'wall1' | 'wall2' | 'wall3';
export type WallThickness = 'thin' | 'medium' | 'thick';
export type TowerShape = 'square' | 'round' | 'octagonal' | 'corner' | 'watch';
export type TowerTop = 'battlement' | 'roof' | 'flat' | 'flag' | 'watch';

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
  | 'moat';

export type ToolKind =
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
  | 'moat'
  | 'river'
  | 'land'
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
  }>;
  terrain?: Array<{ x: number; y: number; kind: TerrainOverrideKind }>;
  worldSeeded?: boolean;
}
