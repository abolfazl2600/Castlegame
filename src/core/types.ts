export type WallKind = 'wall1' | 'wall2' | 'wall3';
export type MountainKind = 'mountain1' | 'mountain2' | 'mountain3';

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
  | MountainKind;

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
  | 'erase';

export type TerrainKind = 'water' | 'shore' | 'plains' | 'mountain' | 'forest';

export interface GridCell {
  kind: TileKind;
}

export interface SavedGame {
  version: number;
  updatedAt: number;
  cells: Array<{ x: number; y: number; kind: TileKind }>;
}
