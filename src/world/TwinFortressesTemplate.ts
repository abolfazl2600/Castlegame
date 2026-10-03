import type { GridCell, KeepState, TileKind } from '../core/types';

export interface TwinFortressesTemplateCell extends GridCell {
  x: number;
  y: number;
}

export interface TwinFortressesTemplate {
  cells: TwinFortressesTemplateCell[];
  keeps: KeepState[];
}

/**
 * Authored two-fortress battlefield for the 90×95 named map layout.
 * The runtime keeps the existing 22×22 simulation grid for performance; the
 * 90×95 designation is the authored world footprint used by the map selector.
 */
export function createTwinFortressesTemplate(): TwinFortressesTemplate {
  const cells = new Map<string, TwinFortressesTemplateCell>();

  const place = (
    x: number,
    y: number,
    kind: TileKind,
    level = 1,
    options: Partial<GridCell> = {},
  ): void => {
    if (x < 0 || y < 0 || x >= 22 || y >= 22) return;
    cells.set(`${x},${y}`, { x, y, kind, level, ...options });
  };

  const wallRect = (
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
    level = 2,
  ): void => {
    for (let x = minX; x <= maxX; x += 1) {
      place(x, minY, 'wall1', level, { battlement: true, walkway: true });
      place(x, maxY, 'wall1', level, { battlement: true, walkway: true });
    }
    for (let y = minY; y <= maxY; y += 1) {
      place(minX, y, 'wall1', level, { battlement: true, walkway: true });
      place(maxX, y, 'wall1', level, { battlement: true, walkway: true });
    }
  };

  // Western fortress.
  wallRect(2, 5, 8, 15, 3);
  place(5, 15, 'gate', 2);
  for (const [x, y, shape, top] of [
    [2, 5, 'round', 'conical'],
    [8, 5, 'square', 'hipped'],
    [2, 15, 'watch', 'timberRoof'],
    [8, 15, 'round', 'openBattlement'],
  ] as Array<[number, number, TwinFortressesTemplateCell['towerShape'], TwinFortressesTemplateCell['towerTop']]>) {
    place(x, y, 'tower', 3, { towerShape: shape, towerTop: top });
  }

  // Eastern fortress.
  wallRect(13, 5, 19, 15, 3);
  place(16, 15, 'gate', 2);
  for (const [x, y, shape, top] of [
    [13, 5, 'square', 'hipped'],
    [19, 5, 'round', 'conical'],
    [13, 15, 'round', 'openBattlement'],
    [19, 15, 'watch', 'timberRoof'],
  ] as Array<[number, number, TwinFortressesTemplateCell['towerShape'], TwinFortressesTemplateCell['towerTop']]>) {
    place(x, y, 'tower', 3, { towerShape: shape, towerTop: top });
  }

  // Gate approaches and a contested central road.
  for (let y = 10; y <= 20; y += 1) {
    if (y !== 15) {
      place(5, y, 'stoneRoad');
      place(16, y, 'stoneRoad');
    }
  }
  for (let x = 5; x <= 16; x += 1) place(x, 18, 'stoneRoad');
  for (let x = 9; x <= 12; x += 1) place(x, 12, 'dirtRoad');

  // Military camps inside each fortress.
  place(3, 11, 'armyCamp', 2);
  place(7, 11, 'armyCamp', 2);
  place(14, 11, 'armyCamp', 2);
  place(18, 11, 'armyCamp', 2);

  // Western logistics and resources.
  place(1, 17, 'farm', 2);
  place(3, 18, 'farm', 2);
  place(7, 17, 'farm', 2);
  place(1, 19, 'hut', 1);
  place(8, 19, 'tree', 2);
  place(2, 3, 'mine', 1);

  // Eastern logistics and resources.
  place(14, 17, 'farm', 2);
  place(18, 17, 'farm', 2);
  place(20, 18, 'farm', 2);
  place(19, 20, 'hut', 1);
  place(13, 19, 'tree', 2);
  place(19, 3, 'mine', 1);

  // Neutral resources between the armies.
  place(10, 3, 'farm', 2);
  place(11, 4, 'farm', 2);
  place(10, 20, 'hut', 1);
  place(11, 20, 'tree', 2);
  place(12, 20, 'rock', 2);

  const keeps: KeepState[] = [
    {
      id: 1,
      x: 5,
      y: 9,
      width: 3,
      depth: 3,
      floors: 4,
      rotation: 0,
      cornerTowers: true,
      roof: 'defensivePlatform',
      battlements: true,
      seed: 9051,
    },
    {
      id: 2,
      x: 16,
      y: 9,
      width: 3,
      depth: 3,
      floors: 4,
      rotation: 0,
      cornerTowers: true,
      roof: 'defensivePlatform',
      battlements: true,
      seed: 9052,
    },
  ];

  return { cells: [...cells.values()], keeps };
}
