import type { GridCell, WallDirection } from '../core/types';
import { WallSystem } from './WallSystem';

export interface WallWeaponPosition {
  x: number;
  y: number;
  direction: WallDirection;
  range: number;
}

/**
 * Deterministic wall-mounted weapon placement.
 *
 * Positions are derived from the current wall layout rather than saved as
 * independent buildings, so save/load and wall edits remain authoritative.
 */
export class WallDefenseSystem {
  static positions(
    size: number,
    cellAt: (x: number, y: number) => GridCell | undefined,
  ): WallWeaponPosition[] {
    const candidates: WallWeaponPosition[] = [];

    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const cell = cellAt(x, y);
        if (!cell || !this.isSuitableWall(cell)) continue;

        const direction = this.weaponDirection(x, y, cell, cellAt);
        if (!direction) continue;

        candidates.push({
          x,
          y,
          direction,
          range: 14,
        });
      }
    }

    // Keep a fixed spacing along the network. The hash makes the result stable
    // while preventing every wall cell from becoming a gun emplacement.
    const selected: WallWeaponPosition[] = [];
    for (const candidate of candidates) {
      if ((candidate.x * 17 + candidate.y * 31) % 5 !== 0) continue;

      const tooClose = selected.some(
        (item) => Math.hypot(item.x - candidate.x, item.y - candidate.y) < 4.5,
      );
      if (tooClose) continue;

      selected.push(candidate);
    }

    // A short wall still gets one defensive position when it is walkable.
    if (selected.length === 0 && candidates.length > 0) {
      selected.push(candidates[Math.floor(candidates.length / 2)]);
    }

    return selected;
  }

  private static isSuitableWall(cell: GridCell): boolean {
    return (
      (cell.kind === 'wall1' || cell.kind === 'wall2' || cell.kind === 'wall3') &&
      cell.walkway === true
    );
  }

  private static weaponDirection(
    x: number,
    y: number,
    cell: GridCell,
    cellAt: (x: number, y: number) => GridCell | undefined,
  ): WallDirection | null {
    const links = cell.wallLinks ?? [];
    const horizontal = links.includes('E') || links.includes('W');
    const vertical = links.includes('N') || links.includes('S');

    const preferred: WallDirection[] = horizontal && !vertical
      ? ((x + y) % 2 === 0 ? ['N', 'S'] : ['S', 'N'])
      : vertical && !horizontal
        ? ((x + y) % 2 === 0 ? ['E', 'W'] : ['W', 'E'])
        : ['N', 'E', 'S', 'W'];

    for (const direction of preferred) {
      const vector = WallSystem.vector(direction);
      const adjacent = cellAt(x + vector.x, y + vector.y);
      if (!adjacent || adjacent.kind === 'gate' || adjacent.kind === 'tower') {
        return direction;
      }
    }

    return preferred[0] ?? null;
  }
}
