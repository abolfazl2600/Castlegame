export type TileKind = 'castle' | 'road';
export type ToolKind = TileKind | 'erase';

export interface GridCell {
  kind: TileKind;
}

export interface SavedGame {
  version: number;
  updatedAt: number;
  cells: Array<{ x: number; y: number; kind: TileKind }>;
}
