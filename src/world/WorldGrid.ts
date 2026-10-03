import type { MapLayoutId } from '../core/types';

export interface WorldGridDimensions {
  cols: number;
  rows: number;
  chunkSize: number;
}

export const DEFAULT_WORLD_GRID: WorldGridDimensions = {
  cols: 23,
  rows: 23,
  chunkSize: 12,
};

export const TRIPLE_ISLES_WORLD_GRID: WorldGridDimensions = {
  cols: 25,
  rows: 25,
  chunkSize: 12,
};

export const ROYAL_VALLEY_WORLD_GRID: WorldGridDimensions = {
  cols: 50,
  rows: 89,
  chunkSize: 12,
};

export const MAX_WORLD_COLS = Math.max(DEFAULT_WORLD_GRID.cols, TRIPLE_ISLES_WORLD_GRID.cols, ROYAL_VALLEY_WORLD_GRID.cols);
export const MAX_WORLD_ROWS = Math.max(DEFAULT_WORLD_GRID.rows, TRIPLE_ISLES_WORLD_GRID.rows, ROYAL_VALLEY_WORLD_GRID.rows);

export function worldGridForLayout(layout: MapLayoutId): WorldGridDimensions {
  if (layout === 'royal-valley-50x89') return { ...ROYAL_VALLEY_WORLD_GRID };
  if (layout === 'triple-isles-100x100') return { ...TRIPLE_ISLES_WORLD_GRID };
  return { ...DEFAULT_WORLD_GRID };
}

export function gridContains(grid: Pick<WorldGridDimensions, 'cols' | 'rows'>, x: number, y: number): boolean {
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < grid.cols && y < grid.rows;
}

export function worldGridCellCount(grid: Pick<WorldGridDimensions, 'cols' | 'rows'>): number {
  return grid.cols * grid.rows;
}
