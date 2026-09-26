import type { GridCell, TileKind, WallDirection } from '../core/types';
import type { GridPoint } from './WallSystem';
import { WallSystem } from './WallSystem';

export interface DefensiveNetworkContext {
  size: number;
  cellAt: (x: number, y: number) => GridCell | undefined;
  fortificationTopAt: (x: number, y: number, cell: GridCell) => number;
}

export interface DefensiveNetworkNode extends GridPoint {
  kind: TileKind;
  worldY: number;
}

const CARDINALS: WallDirection[] = ['N', 'E', 'S', 'W'];
const MAX_CONNECTION_HEIGHT_DELTA = 3.4;
const MAX_WALL_HEIGHT_DELTA = 1.35;

export class ConnectedWallNetwork {
  constructor(private readonly context: DefensiveNetworkContext) {}

  isNode(x: number, y: number): boolean {
    const cell = this.context.cellAt(x, y);
    return cell ? this.isDefensiveCell(cell) : false;
  }

  nodeAt(x: number, y: number): DefensiveNetworkNode | null {
    const cell = this.context.cellAt(x, y);
    if (!cell || !this.isDefensiveCell(cell)) return null;

    return {
      x,
      y,
      kind: cell.kind,
      worldY:
        this.context.elevationAt?.(x, y) ??
        this.context.fortificationTopAt(x, y, cell),
    };
  }

  nodes(): DefensiveNetworkNode[] {
    const result: DefensiveNetworkNode[] = [];

    for (let y = 0; y < this.context.size; y += 1) {
      for (let x = 0; x < this.context.size; x += 1) {
        const node = this.nodeAt(x, y);
        if (node) result.push(node);
      }
    }

    return result;
  }

  neighbors(node: GridPoint): DefensiveNetworkNode[] {
    const current = this.nodeAt(node.x, node.y);
    if (!current) return [];

    const result: DefensiveNetworkNode[] = [];
    const currentCell = this.context.cellAt(node.x, node.y);

    for (const direction of this.allowedDirections(currentCell)) {
      const vector = WallSystem.vector(direction);
      const neighbor = this.nodeAt(node.x + vector.x, node.y + vector.y);
      if (!neighbor || !this.isCompatible(current, neighbor)) continue;

      if (!result.some((item) => item.x === neighbor.x && item.y === neighbor.y)) {
        result.push(neighbor);
      }
    }

    return result;
  }

  hasConnection(a: GridPoint, b: GridPoint): boolean {
    return this.neighbors(a).some((node) => node.x === b.x && node.y === b.y);
  }

  componentFrom(start: GridPoint): DefensiveNetworkNode[] {
    const initial = this.nodeAt(start.x, start.y);
    if (!initial) return [];

    const queue: DefensiveNetworkNode[] = [initial];
    const visited = new Set<string>();
    const result: DefensiveNetworkNode[] = [];

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) continue;

      const key = this.key(current.x, current.y);
      if (visited.has(key)) continue;

      visited.add(key);
      result.push(current);

      for (const neighbor of this.neighbors(current)) {
        if (!visited.has(this.key(neighbor.x, neighbor.y))) queue.push(neighbor);
      }
    }

    return result;
  }

  private allowedDirections(cell: GridCell | undefined): WallDirection[] {
    const explicit = cell?.wallLinks ?? [];
    const directions = new Set<WallDirection>(CARDINALS);

    for (const direction of explicit) {
      directions.add(direction);
    }

    return WallSystem.directions.filter((direction) => directions.has(direction));
  }

  private isCompatible(a: DefensiveNetworkNode, b: DefensiveNetworkNode): boolean {
    if (a.x === b.x && a.y === b.y) return false;

    const aWall = this.isWalkableWall(a.kind);
    const bWall = this.isWalkableWall(b.kind);

    if (aWall && bWall) {
      return Math.abs(a.worldY - b.worldY) <= MAX_WALL_HEIGHT_DELTA;
    }

    const aAccess = this.isAccessNode(a.kind);
    const bAccess = this.isAccessNode(b.kind);

    if ((aWall && bAccess) || (bWall && aAccess)) {
      return Math.abs(a.worldY - b.worldY) <= MAX_CONNECTION_HEIGHT_DELTA;
    }

    if (aAccess && bAccess) {
      return Math.abs(a.worldY - b.worldY) <= MAX_CONNECTION_HEIGHT_DELTA;
    }

    return false;
  }

  private isWalkableWall(kind: TileKind): boolean {
    return (
      kind === 'wall1' ||
      kind === 'wall2' ||
      kind === 'wall3'
    );
  }

  private isAccessNode(kind: TileKind): boolean {
    return (
      kind === 'tower' ||
      kind === 'stairTower' ||
      kind === 'gate'
    );
  }

  private isDefensiveCell(cell: GridCell): boolean {
    if (this.isWalkableWall(cell.kind)) return cell.walkway === true;
    return this.isAccessNode(cell.kind);
  }

  private key(x: number, y: number): string {
    return `${x},${y}`;
  }
}
