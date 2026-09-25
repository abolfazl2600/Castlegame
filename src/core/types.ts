export type TileKind = 'wall' | 'gate' | 'tower' | 'road' | 'cottage' | 'house' | 'manor';
export type ToolKind = TileKind | 'erase';
export type UnitKind = 'worker' | 'soldier';
export type TerrainKind = 'water' | 'shore' | 'plains' | 'river' | 'mountain' | 'forest';

export interface GridCell {
  kind: TileKind;
}

export interface SavedGame {
  version: number;
  updatedAt: number;
  cells: Array<{ x: number; y: number; kind: TileKind }>;
}
