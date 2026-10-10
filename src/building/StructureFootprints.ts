import type { TileKind } from '../core/types';

export interface StructureFootprintCell {
  x: number;
  y: number;
}

/** The Market's rendered foundation and placement rule both span three grid tiles per side. */
export function getStructureFootprint(
  kind: TileKind,
  anchorX: number,
  anchorY: number,
): StructureFootprintCell[] {
  if (kind === 'market') {
    const cells: StructureFootprintCell[] = [];
    for (let y = anchorY - 1; y <= anchorY + 1; y += 1) {
      for (let x = anchorX - 1; x <= anchorX + 1; x += 1) {
        cells.push({ x, y });
      }
    }
    return cells;
  }
  return [{ x: anchorX, y: anchorY }];
}

/**
 * Resolve the authoritative structure anchor from an inspected grid point.
 * Prefer a direct anchor in older authored/saved worlds that already contain
 * overlaps, so adding footprint enforcement never deletes or hides those cells.
 */
export function findStructureAnchorAt<T extends { kind: TileKind; x: number; y: number }>(
  anchors: readonly T[],
  x: number,
  y: number,
): T | undefined {
  const direct = anchors.find((anchor) => anchor.x === x && anchor.y === y);
  return direct ?? anchors.find((anchor) =>
    getStructureFootprint(anchor.kind, anchor.x, anchor.y)
      .some((point) => point.x === x && point.y === y));
}
