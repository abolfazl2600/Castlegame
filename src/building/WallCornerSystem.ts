import type { GridCell, WallCornerKind, WallDirection } from '../core/types';
import { WallSystem } from './WallSystem';

export interface CornerAnalysis {
  kind: WallCornerKind;
  angle: number;
  major: boolean;
}

export class WallCornerSystem {
  analyze(cell: GridCell, links: WallDirection[], x: number, y: number): CornerAnalysis | null {
    if (links.length < 2) return null;

    const level = cell.level ?? 1;
    const thickness = cell.thickness ?? 'medium';
    const major = level >= 3 || thickness === 'thick';
    const sorted = [...links].sort(
      (a, b) => WallSystem.directions.indexOf(a) - WallSystem.directions.indexOf(b),
    );

    let smallestAngle = 180;
    for (let i = 0; i < sorted.length; i += 1) {
      for (let j = i + 1; j < sorted.length; j += 1) {
        smallestAngle = Math.min(
          smallestAngle,
          WallSystem.connectionAngle(sorted[i], sorted[j]),
        );
      }
    }

    const seed = Math.abs((x * 73856093) ^ (y * 19349663) ^ (level * 83492791));
    let kind: WallCornerKind = 'square';

    if (links.length >= 3) {
      kind = major ? 'turret' : 'reinforced';
    } else if (smallestAngle === 45 || smallestAngle === 135) {
      kind = major ? 'buttressed' : 'rounded';
    } else if (major && seed % 5 === 0) {
      kind = 'turret';
    } else if (major) {
      kind = 'reinforced';
    } else if (seed % 4 === 0) {
      kind = 'rounded';
    } else {
      kind = 'square';
    }

    return { kind, angle: smallestAngle, major };
  }
}
