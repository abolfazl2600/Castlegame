import type { TileKind } from '../core/types';

export interface StructureFootprintCell {
  x: number;
  y: number;
}

/**
 * The rendered Modern Fortress spans about 32 world units on a 4-unit grid.
 * Reserving a centered 9x9 grid footprint (36x36 world units) conservatively
 * contains the visible foundation and defensive perimeter.
 */
export const FUTURISTIC_CASTLE_FOOTPRINT_RADIUS = 4;

export function getStructureFootprint(
  kind: TileKind,
  anchorX: number,
  anchorY: number,
): StructureFootprintCell[] {
  if (kind !== 'futuristicCastle') {
    return [{ x: anchorX, y: anchorY }];
  }

  const cells: StructureFootprintCell[] = [];
  for (
    let y = anchorY - FUTURISTIC_CASTLE_FOOTPRINT_RADIUS;
    y <= anchorY + FUTURISTIC_CASTLE_FOOTPRINT_RADIUS;
    y += 1
  ) {
    for (
      let x = anchorX - FUTURISTIC_CASTLE_FOOTPRINT_RADIUS;
      x <= anchorX + FUTURISTIC_CASTLE_FOOTPRINT_RADIUS;
      x += 1
    ) {
      cells.push({ x, y });
    }
  }

  return cells;
}
