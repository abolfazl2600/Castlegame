import type { KeepState, WallDirection, WallKind } from '../core/types';
import { CASTLE_DETAIL_VERSION } from '../core/constants';

export interface KeepOpening {
  type: 'window' | 'slit';
  offset: number;
  floor: number;
  side: 'N' | 'E' | 'S' | 'W';
  scale: number;
}

export interface KeepFlagPlacement {
  xFactor: number;
  zFactor: number;
  heightOffset: number;
  primary: boolean;
}

export interface WallDetailPlan {
  slitOffsets: number[];
  flag: boolean;
}

export class CastleDetailGenerator {
  private hash(...values: number[]): number {
    let h = 2166136261 ^ CASTLE_DETAIL_VERSION;

    for (const value of values) {
      const n = Math.floor(value * 1000);
      h ^= n;
      h = Math.imul(h, 16777619);
      h ^= h >>> 13;
    }

    return (h >>> 0) / 4294967295;
  }

  keepOpenings(
    keep: KeepState,
    side: 'N' | 'E' | 'S' | 'W',
    wallSpan: number,
  ): KeepOpening[] {
    const result: KeepOpening[] = [];
    const sideIndex = ['N', 'E', 'S', 'W'].indexOf(side);
    const usable = Math.max(1, Math.floor(wallSpan / 1.45));

    for (let floor = 0; floor < keep.floors; floor += 1) {
      const defensiveFloor = floor === 0 || floor === 1;
      const desired = Math.max(1, usable - (defensiveFloor ? 1 : 0));

      for (let i = 0; i < desired; i += 1) {
        const t = desired === 1 ? 0 : i / (desired - 1) - 0.5;
        const jitter = (this.hash(keep.seed, sideIndex, floor, i) - 0.5) * 0.12;
        const offset = (t + jitter) * wallSpan * 0.68;

        const slitBias = defensiveFloor ? 0.78 : 0.28;
        const type =
          this.hash(keep.seed, sideIndex, floor, i, 91) < slitBias ? 'slit' : 'window';

        result.push({
          type,
          offset,
          floor,
          side,
          scale: 0.9 + this.hash(keep.seed, sideIndex, floor, i, 27) * 0.18,
        });
      }
    }

    return result;
  }

  keepFlags(keep: KeepState): KeepFlagPlacement[] {
    const result: KeepFlagPlacement[] = [
      { xFactor: 0, zFactor: 0, heightOffset: 2.6, primary: true },
    ];

    const area = keep.width * keep.depth;
    if (area >= 16 && keep.cornerTowers) {
      const corner = this.hash(keep.seed, area, keep.floors) > 0.5 ? 1 : -1;
      result.push({
        xFactor: corner * 0.42,
        zFactor: -corner * 0.42,
        heightOffset: 2.1,
        primary: false,
      });
    }

    return result;
  }

  wallPlan(
    x: number,
    y: number,
    level: number,
    kind: WallKind,
    direction: WallDirection,
    span: number,
    nearImportantConnection: boolean,
  ): WallDetailPlan {
    const directionIndex = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'].indexOf(direction);
    const materialBias = kind === 'wall2' ? 0.78 : kind === 'wall3' ? 1.1 : 1;
    const count = Math.max(0, Math.floor((span / 1.55) * materialBias));
    const slitOffsets: number[] = [];

    for (let i = 0; i < count; i += 1) {
      if (nearImportantConnection && (i === 0 || i === count - 1)) continue;

      const t = count <= 1 ? 0 : i / (count - 1) - 0.5;
      const jitter = (this.hash(x, y, level, directionIndex, i) - 0.5) * 0.08;
      slitOffsets.push((t + jitter) * span * 0.64);
    }

    const flag =
      level >= 3 &&
      !nearImportantConnection &&
      this.hash(x, y, level, directionIndex, 733) > 0.965;

    return { slitOffsets, flag };
  }

  chooseEntranceSide(
    keep: KeepState,
    scores: Record<'N' | 'E' | 'S' | 'W', number>,
  ): 'N' | 'E' | 'S' | 'W' {
    const sides: Array<'N' | 'E' | 'S' | 'W'> = ['N', 'E', 'S', 'W'];
    let best = sides[0];
    let bestScore = Number.NEGATIVE_INFINITY;

    for (let i = 0; i < sides.length; i += 1) {
      const side = sides[i];
      const tieBreak = this.hash(keep.seed, i) * 0.001;
      const score = scores[side] + tieBreak;

      if (score > bestScore) {
        best = side;
        bestScore = score;
      }
    }

    return best;
  }
}
