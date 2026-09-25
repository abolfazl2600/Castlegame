import type { GridCell, WallDirection } from '../core/types';

export interface GridPoint {
  x: number;
  y: number;
}

const ORDER: WallDirection[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

const VECTORS: Record<WallDirection, GridPoint> = {
  N: { x: 0, y: -1 },
  NE: { x: 1, y: -1 },
  E: { x: 1, y: 0 },
  SE: { x: 1, y: 1 },
  S: { x: 0, y: 1 },
  SW: { x: -1, y: 1 },
  W: { x: -1, y: 0 },
  NW: { x: -1, y: -1 },
};

export class WallSystem {
  static readonly directions = ORDER;

  static vector(direction: WallDirection): GridPoint {
    return VECTORS[direction];
  }

  static opposite(direction: WallDirection): WallDirection {
    return ORDER[(ORDER.indexOf(direction) + 4) % 8];
  }

  static directionFromDelta(dx: number, dy: number): WallDirection {
    const angle = Math.atan2(dy, dx);
    const octant = Math.round(angle / (Math.PI / 4));
    const normalized = (octant + 8) % 8;
    const angleOrder: WallDirection[] = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'];
    return angleOrder[normalized];
  }

  static createSnappedPath(start: GridPoint, end: GridPoint, size: number): GridPoint[] {
    const dx = end.x - start.x;
    const dy = end.y - start.y;

    if (dx === 0 && dy === 0) return [start];

    const direction = this.directionFromDelta(dx, dy);
    const vector = this.vector(direction);
    const projectedSteps = Math.max(1, Math.round(Math.hypot(dx, dy) / Math.hypot(vector.x, vector.y)));
    const points: GridPoint[] = [];

    for (let i = 0; i <= projectedSteps; i += 1) {
      const point = {
        x: start.x + vector.x * i,
        y: start.y + vector.y * i,
      };

      if (point.x < 0 || point.y < 0 || point.x >= size || point.y >= size) break;
      points.push(point);
    }

    return points.length > 0 ? points : [start];
  }

  static addLink(cell: GridCell | undefined, direction: WallDirection): WallDirection[] {
    const links = new Set(cell?.wallLinks ?? []);
    links.add(direction);
    return ORDER.filter((item) => links.has(item));
  }

  static removeLink(cell: GridCell | undefined, direction: WallDirection): WallDirection[] {
    const links = new Set(cell?.wallLinks ?? []);
    links.delete(direction);
    return ORDER.filter((item) => links.has(item));
  }

  static connectionAngle(a: WallDirection, b: WallDirection): number {
    const ai = ORDER.indexOf(a);
    const bi = ORDER.indexOf(b);
    const raw = Math.abs(ai - bi);
    const steps = Math.min(raw, 8 - raw);
    return steps * 45;
  }

  static isDiagonal(direction: WallDirection): boolean {
    return direction === 'NE' || direction === 'SE' || direction === 'SW' || direction === 'NW';
  }

  static worldAngle(direction: WallDirection): number {
    const vector = this.vector(direction);
    return Math.atan2(vector.x, vector.y);
  }
}
