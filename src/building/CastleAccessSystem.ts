import type { AccessKind, KeepState, TileKind, WallDirection } from '../core/types';
import type { CellEntry } from '../state/GameState';
import { WallSystem } from './WallSystem';

export interface GeneratedAccess {
  x: number;
  y: number;
  kind: AccessKind;
  rotation: number;
  targetX: number;
  targetY: number;
}

export interface CastleAccessContext {
  size: number;
  getCell: (x: number, y: number) => CellEntry | undefined;
  terrainBuildable: (x: number, y: number) => boolean;
  isOccupied: (x: number, y: number) => boolean;
}

export class CastleAccessSystem {
  generate(
    cells: CellEntry[],
    _keeps: KeepState[],
    context: CastleAccessContext,
  ): GeneratedAccess[] {
    const fortifications = new Map<string, CellEntry>();

    for (const cell of cells) {
      if (this.isFortification(cell.kind)) {
        fortifications.set(this.key(cell.x, cell.y), cell);
      }
    }

    const visited = new Set<string>();
    const result: GeneratedAccess[] = [];

    for (const [startKey, start] of fortifications) {
      if (visited.has(startKey)) continue;

      const component = this.collectComponent(start, fortifications, visited);
      const walls = component.filter((cell) => this.isWall(cell.kind));
      if (walls.length === 0) continue;

      const existingManualAccess = cells.some(
        (cell) =>
          this.isAccess(cell.kind) &&
          component.some(
            (wall) =>
              Math.abs(wall.x - cell.x) + Math.abs(wall.y - cell.y) <= 1,
          ),
      );

      if (existingManualAccess) continue;

      const towerOrGate = component
        .filter((cell) => cell.kind === 'tower' || cell.kind === 'gate')
        .sort((a, b) => (b.level ?? 1) - (a.level ?? 1));

      const walkwayWalls = walls.filter((wall) => wall.walkway === true);

      if (walkwayWalls.length > 0 && towerOrGate.length > 0) {
        const towerAccess = this.findPlacement(towerOrGate[0], context);
        if (towerAccess) {
          result.push({
            x: towerAccess.x,
            y: towerAccess.y,
            kind: this.chooseKind(towerOrGate[0], towerAccess.clearance),
            rotation: towerAccess.rotation,
            targetX: towerOrGate[0].x,
            targetY: towerOrGate[0].y,
          });
        }
      }

      const hasTowerOrGate = towerOrGate.length > 0;
      const longestLevel = Math.max(...walls.map((wall) => wall.level ?? 1));
      let accessCount = 0;

      if (walls.length >= 11) accessCount = Math.max(1, Math.floor(walls.length / 9));
      else if (walls.length >= 6 && !hasTowerOrGate) accessCount = 1;
      else if (longestLevel >= 4 && walls.length >= 4 && !hasTowerOrGate) accessCount = 1;

      if (accessCount === 0) continue;

      const candidates = walkwayWalls
        .sort((a, b) => a.x - b.x || a.y - b.y);

      if (candidates.length === 0) continue;

      for (let index = 0; index < accessCount; index += 1) {
        const position = Math.floor(
          ((index + 1) / (accessCount + 1)) * (candidates.length - 1),
        );
        const target = candidates[position];
        const placement = this.findPlacement(target, context);
        if (!placement) continue;

        const kind = this.chooseKind(target, placement.clearance);
        result.push({
          x: placement.x,
          y: placement.y,
          kind,
          rotation: placement.rotation,
          targetX: target.x,
          targetY: target.y,
        });
      }
    }

    return this.dedupe(result);
  }

  private collectComponent(
    start: CellEntry,
    fortifications: Map<string, CellEntry>,
    visited: Set<string>,
  ): CellEntry[] {
    const queue: CellEntry[] = [start];
    const result: CellEntry[] = [];

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) break;

      const currentKey = this.key(current.x, current.y);
      if (visited.has(currentKey)) continue;
      visited.add(currentKey);
      result.push(current);

      for (const neighbor of this.neighbors(current, fortifications)) {
        const neighborKey = this.key(neighbor.x, neighbor.y);
        if (!visited.has(neighborKey)) queue.push(neighbor);
      }
    }

    return result;
  }

  private neighbors(
    cell: CellEntry,
    fortifications: Map<string, CellEntry>,
  ): CellEntry[] {
    const result: CellEntry[] = [];
    const directions: WallDirection[] =
      cell.wallLinks && cell.wallLinks.length > 0
        ? cell.wallLinks
        : ['N', 'E', 'S', 'W'];

    for (const direction of directions) {
      const vector = WallSystem.vector(direction);
      const neighbor = fortifications.get(
        this.key(cell.x + vector.x, cell.y + vector.y),
      );
      if (neighbor) result.push(neighbor);
    }

    return result;
  }

  private findPlacement(
    target: CellEntry,
    context: CastleAccessContext,
  ): { x: number; y: number; rotation: number; clearance: number } | null {
    const options = [
      { dx: 0, dy: 1, rotation: 0 },
      { dx: 1, dy: 0, rotation: 1 },
      { dx: 0, dy: -1, rotation: 2 },
      { dx: -1, dy: 0, rotation: 3 },
    ];

    const scored = options
      .map((option) => {
        const x = target.x + option.dx;
        const y = target.y + option.dy;

        if (
          x < 0 ||
          y < 0 ||
          x >= context.size ||
          y >= context.size ||
          context.isOccupied(x, y) ||
          !context.terrainBuildable(x, y)
        ) {
          return null;
        }

        let clearance = 1;
        const outwardX = x + option.dx;
        const outwardY = y + option.dy;
        if (
          outwardX >= 0 &&
          outwardY >= 0 &&
          outwardX < context.size &&
          outwardY < context.size &&
          !context.isOccupied(outwardX, outwardY) &&
          context.terrainBuildable(outwardX, outwardY)
        ) {
          clearance += 1;
        }

        return { x, y, rotation: option.rotation, clearance };
      })
      .filter(
        (
          value,
        ): value is {
          x: number;
          y: number;
          rotation: number;
          clearance: number;
        } => value !== null,
      )
      .sort((a, b) => b.clearance - a.clearance);

    return scored[0] ?? null;
  }

  private chooseKind(target: CellEntry, clearance: number): AccessKind {
    const level = target.level ?? 1;

    if (clearance >= 2 && level >= 2 && target.kind !== 'wall2') {
      return 'stoneStairs';
    }

    if (clearance >= 2 && level <= 3) {
      return 'woodenStairs';
    }

    if (level <= 2) return 'ladder';
    return clearance >= 2 ? 'ramp' : 'ladder';
  }

  private dedupe(items: GeneratedAccess[]): GeneratedAccess[] {
    const used = new Set<string>();
    return items.filter((item) => {
      const key = this.key(item.x, item.y);
      if (used.has(key)) return false;
      used.add(key);
      return true;
    });
  }

  private isFortification(kind: TileKind): boolean {
    return this.isWall(kind) || kind === 'tower' || kind === 'gate';
  }

  private isWall(kind: TileKind): boolean {
    return kind === 'wall1' || kind === 'wall2' || kind === 'wall3';
  }

  private isAccess(kind: TileKind): boolean {
    return (
      kind === 'stoneStairs' ||
      kind === 'woodenStairs' ||
      kind === 'ramp' ||
      kind === 'ladder'
    );
  }

  private key(x: number, y: number): string {
    return `${x},${y}`;
  }
}
