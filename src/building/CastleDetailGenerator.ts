import type { KeepState, TileKind, WallDirection, WallKind } from '../core/types';
import type { CellEntry } from '../state/GameState';
import { CASTLE_DETAIL_VERSION } from '../core/constants';
import { WallSystem } from './WallSystem';

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

export type WallButtressStyle = 'simple' | 'heavy' | 'stepped' | 'angled';

export interface WallButtressPlacement {
  z: number;
  side: -1 | 1;
  height: number;
  style: WallButtressStyle;
}

export interface WallDetailPlan {
  slitOffsets: number[];
  buttresses: WallButtressPlacement[];
  flag: boolean;
}

export interface AutomaticWallAccess {
  targetX: number;
  targetY: number;
  groundX: number;
  groundY: number;
  rotation: number;
}

export interface AutomaticWallAccessContext {
  size: number;
  terrainBuildable: (x: number, y: number) => boolean;
  isOccupied: (x: number, y: number) => boolean;
  linksAt?: (x: number, y: number) => WallDirection[] | undefined;
}

interface AccessCandidate extends AutomaticWallAccess {
  score: number;
}

const CARDINALS: WallDirection[] = ['N', 'E', 'S', 'W'];

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
    height = 0,
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

    const buttresses: WallButtressPlacement[] = [];
    const buttressCount = kind === 'wall3' ? 2 : height >= 7.1 ? 1 : 0;
    for (let i = 0; i < buttressCount; i += 1) {
      const z = buttressCount === 1 ? span * 0.55 : span * (0.38 + i * 0.34);
      const style: WallButtressStyle =
        kind === 'wall3'
          ? 'heavy'
          : height >= 9.2
            ? 'stepped'
            : Math.abs(x * 17 + y * 29 + i) % 3 === 0
              ? 'angled'
              : 'simple';

      for (const side of [-1, 1] as const) {
        buttresses.push({
          z,
          side,
          height: Math.min(height * 0.5, 4.1),
          style,
        });
      }
    }

    const flag =
      level >= 3 &&
      !nearImportantConnection &&
      this.hash(x, y, level, directionIndex, 733) > 0.965;

    return { slitOffsets, buttresses, flag };
  }

  wallAccessPlan(
    cells: CellEntry[],
    context: AutomaticWallAccessContext,
  ): AutomaticWallAccess[] {
    const fortifications = new Map<string, CellEntry>();

    for (const cell of cells) {
      if (!this.isFortification(cell.kind) || (cell.damage ?? 0) >= 0.86) continue;
      fortifications.set(this.key(cell.x, cell.y), cell);
    }

    const visited = new Set<string>();
    const result: AutomaticWallAccess[] = [];

    for (const [startKey, start] of fortifications) {
      if (visited.has(startKey)) continue;

      const component = this.collectComponent(start, fortifications, visited, context);
      const walls = component.filter(
        (cell) => this.isWall(cell.kind) && cell.walkway !== false,
      );
      if (walls.length === 0) continue;

      const existingGroundAnchors = component.filter(
        (cell) =>
          (cell.kind === 'tower' || cell.kind === 'gate') &&
          this.findAccessPlacement(cell, context) !== null,
      );

      const desired =
        existingGroundAnchors.length === 0
          ? Math.max(1, Math.ceil(walls.length / 14))
          : walls.length >= 18
            ? Math.max(1, Math.floor(walls.length / 18))
            : 0;

      if (desired === 0) continue;

      const candidates = walls
        .map((wall) => {
          const placement = this.findAccessPlacement(wall, context);
          if (!placement) return null;

          const neighbors = this.neighbors(wall, fortifications, context);
          const adjacentAnchor = neighbors.some(
            (neighbor) => neighbor.kind === 'tower' || neighbor.kind === 'gate',
          );
          const topologyScore =
            neighbors.length === 2 ? 6 :
            neighbors.length === 1 ? 3 :
            neighbors.length >= 3 ? -9 : 0;

          return {
            targetX: wall.x,
            targetY: wall.y,
            groundX: placement.groundX,
            groundY: placement.groundY,
            rotation: placement.rotation,
            score:
              placement.score +
              topologyScore -
              (adjacentAnchor ? 7 : 0) +
              this.hash(wall.x, wall.y, neighbors.length, 401) * 0.01,
          } satisfies AccessCandidate;
        })
        .filter((candidate): candidate is AccessCandidate => candidate !== null)
        .sort((a, b) => b.score - a.score || a.targetY - b.targetY || a.targetX - b.targetX);

      const selected: AutomaticWallAccess[] = [];
      for (const candidate of candidates) {
        if (selected.length >= desired) break;
        const tooClose = selected.some(
          (item) => Math.hypot(item.targetX - candidate.targetX, item.targetY - candidate.targetY) < 5,
        );
        if (tooClose) continue;

        selected.push({
          targetX: candidate.targetX,
          targetY: candidate.targetY,
          groundX: candidate.groundX,
          groundY: candidate.groundY,
          rotation: candidate.rotation,
        });
      }

      if (selected.length === 0 && candidates[0]) {
        const candidate = candidates[0];
        selected.push({
          targetX: candidate.targetX,
          targetY: candidate.targetY,
          groundX: candidate.groundX,
          groundY: candidate.groundY,
          rotation: candidate.rotation,
        });
      }

      result.push(...selected);
    }

    return this.dedupeAccess(result);
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

  private collectComponent(
    start: CellEntry,
    fortifications: Map<string, CellEntry>,
    visited: Set<string>,
    context: AutomaticWallAccessContext,
  ): CellEntry[] {
    const queue: CellEntry[] = [start];
    const result: CellEntry[] = [];

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) continue;

      const currentKey = this.key(current.x, current.y);
      if (visited.has(currentKey)) continue;
      visited.add(currentKey);
      result.push(current);

      for (const neighbor of this.neighbors(current, fortifications, context)) {
        if (!visited.has(this.key(neighbor.x, neighbor.y))) queue.push(neighbor);
      }
    }

    return result;
  }

  private neighbors(
    cell: CellEntry,
    fortifications: Map<string, CellEntry>,
    context: AutomaticWallAccessContext,
  ): CellEntry[] {
    const result: CellEntry[] = [];
    const explicit = context.linksAt?.(cell.x, cell.y) ?? cell.wallLinks;
    const directions = explicit && explicit.length > 0 ? explicit : CARDINALS;

    for (const direction of directions) {
      const vector = WallSystem.vector(direction);
      const neighbor = fortifications.get(this.key(cell.x + vector.x, cell.y + vector.y));
      if (neighbor && !result.some((item) => item.x === neighbor.x && item.y === neighbor.y)) {
        result.push(neighbor);
      }
    }

    return result;
  }

  private findAccessPlacement(
    target: CellEntry,
    context: AutomaticWallAccessContext,
  ): { groundX: number; groundY: number; rotation: number; score: number } | null {
    const options = [
      { dx: 0, dy: 1, rotation: 0 },
      { dx: 1, dy: 0, rotation: 1 },
      { dx: 0, dy: -1, rotation: 2 },
      { dx: -1, dy: 0, rotation: 3 },
    ];

    const scored = options
      .map((option) => {
        const groundX = target.x + option.dx;
        const groundY = target.y + option.dy;
        if (
          groundX < 0 ||
          groundY < 0 ||
          groundX >= context.size ||
          groundY >= context.size ||
          context.isOccupied(groundX, groundY) ||
          !context.terrainBuildable(groundX, groundY)
        ) {
          return null;
        }

        const outwardX = groundX + option.dx;
        const outwardY = groundY + option.dy;
        const outwardClear =
          outwardX >= 0 &&
          outwardY >= 0 &&
          outwardX < context.size &&
          outwardY < context.size &&
          !context.isOccupied(outwardX, outwardY) &&
          context.terrainBuildable(outwardX, outwardY);

        const sideObstructions = [
          { x: groundX + option.dy, y: groundY + option.dx },
          { x: groundX - option.dy, y: groundY - option.dx },
        ].filter(
          (point) =>
            point.x < 0 ||
            point.y < 0 ||
            point.x >= context.size ||
            point.y >= context.size ||
            context.isOccupied(point.x, point.y) ||
            !context.terrainBuildable(point.x, point.y),
        ).length;

        return {
          groundX,
          groundY,
          rotation: option.rotation,
          score: (outwardClear ? 10 : 4) - sideObstructions * 3,
        };
      })
      .filter(
        (
          value,
        ): value is { groundX: number; groundY: number; rotation: number; score: number } =>
          value !== null,
      )
      .sort((a, b) => b.score - a.score || a.rotation - b.rotation);

    return scored[0] ?? null;
  }

  private dedupeAccess(items: AutomaticWallAccess[]): AutomaticWallAccess[] {
    const grounds = new Set<string>();
    const targets = new Set<string>();

    return items.filter((item) => {
      const groundKey = this.key(item.groundX, item.groundY);
      const targetKey = this.key(item.targetX, item.targetY);
      if (grounds.has(groundKey) || targets.has(targetKey)) return false;
      grounds.add(groundKey);
      targets.add(targetKey);
      return true;
    });
  }

  private isFortification(kind: TileKind): boolean {
    return this.isWall(kind) || kind === 'tower' || kind === 'gate';
  }

  private isWall(kind: TileKind): kind is WallKind {
    return kind === 'wall1' || kind === 'wall2' || kind === 'wall3';
  }

  private key(x: number, y: number): string {
    return `${x},${y}`;
  }
}
