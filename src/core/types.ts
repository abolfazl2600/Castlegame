export type TileKind = 'wall' | 'road';
export type ToolKind = TileKind | 'erase';
export type UnitKind = 'worker' | 'soldier';

export interface GridCell {
  kind: TileKind;
}

export interface SavedGame {
  version: number;
  updatedAt: number;
  cells: Array<{ x: number; y: number; kind: TileKind }>;
}
