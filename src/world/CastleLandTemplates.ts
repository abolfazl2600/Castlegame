import type { GridCell, KeepState, MapLayoutId, TileKind } from '../core/types';
import { terrainForMapLayout } from './MapLayouts';
import { worldGridForLayout } from './WorldGrid';

export type CastleLandId = 'highland-crown-100x100' | 'sunset-lagoon-100x100';
export type CastleLandCell = GridCell & { x: number; y: number };

export interface CastleLandTemplate {
  cells: CastleLandCell[];
  keeps: KeepState[];
}

/**
 * Authored, deterministic starting worlds made exclusively from editable game
 * cells and real keeps. Terrain comes from their matching 25×25 map layouts.
 */
export function createCastleLandTemplate(layout: CastleLandId): CastleLandTemplate {
  const grid = worldGridForLayout(layout);
  const cells = new Map<string, CastleLandCell>();

  const place = (x: number, y: number, kind: TileKind, level = 1, options: Partial<GridCell> = {}): void => {
    if (x < 0 || y < 0 || x >= grid.cols || y >= grid.rows) return;
    const terrain = terrainForMapLayout(layout as MapLayoutId, x, y, grid);
    if (terrain === 'water' || terrain === 'shore' || terrain === 'river') return;
    cells.set(`${x},${y}`, { x, y, kind, level, ...options });
  };

  const wallRect = (left: number, top: number, right: number, bottom: number): void => {
    for (let x = left; x <= right; x += 1) {
      place(x, top, 'wall1', 1, { battlement: true, walkway: true });
      place(x, bottom, 'wall1', 1, { battlement: true, walkway: true });
    }
    for (let y = top; y <= bottom; y += 1) {
      place(left, y, 'wall1', 1, { battlement: true, walkway: true });
      place(right, y, 'wall1', 1, { battlement: true, walkway: true });
    }
  };

  const tower = (x: number, y: number, shape: GridCell['towerShape'], top: GridCell['towerTop']): void => {
    place(x, y, 'tower', 3, { towerShape: shape, towerTop: top });
  };

  const road = (points: readonly (readonly [number, number])[], kind: 'stoneRoad' | 'dirtRoad'): void => {
    for (const [x, y] of points) if (!cells.has(`${x},${y}`)) place(x, y, kind);
  };

  let keep: KeepState;
  if (layout === 'highland-crown-100x100') {
    // Large northern citadel, steep western access, productive southern valley.
    wallRect(6, 5, 17, 16);
    place(11, 16, 'gate', 3, { rotationMode: 'auto' });
    place(17, 11, 'gate', 2, { rotationMode: 'auto' });
    tower(6, 5, 'round', 'conical');
    tower(17, 5, 'round', 'conical');
    tower(6, 16, 'square', 'openBattlement');
    tower(17, 16, 'square', 'openBattlement');
    tower(11, 5, 'watch', 'openBattlement');
    place(8, 12, 'armyCamp', 3);
    place(15, 12, 'basilica', 1);
    place(8, 8, 'manor', 3);
    place(15, 8, 'tower', 2, { towerShape: 'watch', towerTop: 'timberRoof' });
    for (let y = 17; y <= 22; y += 1) road([[11, y]], 'stoneRoad');
    road([[9, 19], [10, 19], [12, 19], [13, 19], [14, 19], [15, 19]], 'dirtRoad');
    place(8, 19, 'cottage');
    place(14, 18, 'market');
    place(16, 19, 'carpenter', 2);
    place(7, 21, 'farm', 3);
    place(10, 22, 'cowBarn', 2);
    place(15, 22, 'farm', 2);
    place(18, 20, 'windmill', 2);
    place(4, 8, 'mine', 2);
    place(20, 6, 'mine', 2);
    place(19, 17, 'armyCamp', 2);
    keep = {
      id: 1, x: 12, y: 10, width: 4, depth: 4, floors: 5,
      rotation: 0, cornerTowers: true, roof: 'defensivePlatform',
      battlements: true, seed: 6201,
    };
  } else {
    // Seaward sandstone fortress with a sheltered lagoon and coastal economy.
    wallRect(5, 5, 14, 15);
    place(10, 15, 'gate', 3, { rotationMode: 'auto' });
    place(14, 10, 'gate', 2, { rotationMode: 'auto' });
    tower(5, 5, 'round', 'conical');
    tower(14, 5, 'square', 'hipped');
    tower(5, 15, 'round', 'openBattlement');
    tower(14, 15, 'round', 'openBattlement');
    tower(8, 15, 'watch', 'timberRoof');
    place(7, 12, 'armyCamp', 3);
    place(12, 12, 'mosque', 2);
    place(7, 8, 'manor', 3);
    for (let y = 16; y <= 22; y += 1) road([[10, y]], 'stoneRoad');
    road([[11, 18], [12, 18], [13, 18], [14, 18], [15, 18], [16, 18], [17, 18], [18, 18]], 'stoneRoad');
    place(6, 18, 'cottage');
    place(8, 19, 'market');
    place(12, 19, 'carpenter', 2);
    place(5, 21, 'farm', 3);
    place(9, 22, 'farm', 2);
    place(13, 21, 'cowBarn', 2);
    place(16, 21, 'windmill', 2);
    place(3, 6, 'mine', 2);
    place(4, 17, 'armyCamp', 2);
    place(17, 6, 'tower', 2, { towerShape: 'watch', towerTop: 'openBattlement' });
    keep = {
      id: 1, x: 10, y: 9, width: 4, depth: 4, floors: 4,
      rotation: 0, cornerTowers: true, roof: 'towered',
      battlements: true, seed: 6301,
    };
  }

  // The keep's authored footprint is reserved for the true KeepSystem, never
  // for decorative tiles or occupied road cells.
  for (let y = keep.y - Math.floor(keep.depth / 2); y <= keep.y + Math.ceil(keep.depth / 2) - 1; y += 1) {
    for (let x = keep.x - Math.floor(keep.width / 2); x <= keep.x + Math.ceil(keep.width / 2) - 1; x += 1) {
      cells.delete(`${x},${y}`);
    }
  }

  return { cells: [...cells.values()], keeps: [keep] };
}
