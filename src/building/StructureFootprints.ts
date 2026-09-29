import type { TileKind } from '../core/types';

export interface StructureFootprintCell {
  x: number;
  y: number;
}

/**
 * Returns the occupied grid footprint for a structure anchor.
 *
 * Current buildable structures occupy a single grid cell. Keeping this helper
 * centralizes footprint-aware selection and terrain protection for future
 * multi-cell structures without coupling it to a removed building family.
 */
export function getStructureFootprint(
  _kind: TileKind,
  anchorX: number,
  anchorY: number,
): StructureFootprintCell[] {
  return [{ x: anchorX, y: anchorY }];
}
