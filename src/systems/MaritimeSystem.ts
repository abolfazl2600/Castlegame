import type { HarborKind, ShipKind, TerrainKind } from '../core/types';

export interface CoastDirection {
  dx: number;
  dy: number;
  rotation: number;
  waterDepth: 'shallow' | 'deep';
}

export interface MaritimeContext {
  size: number;
  terrainAt: (x: number, y: number) => TerrainKind;
}

export class MaritimeSystem {
  constructor(private readonly context: MaritimeContext) {}

  coastDirection(x: number, y: number): CoastDirection | null {
    const terrain = this.context.terrainAt(x, y);
    if (terrain === 'water' || terrain === 'river' || terrain === 'mountain') return null;

    // Rendering extends the pier toward local -Z. These rotation values turn
    // local -Z toward the detected coastline water direction.
    const directions = [
      { dx: 0, dy: -1, rotation: 0 },
      { dx: 1, dy: 0, rotation: 3 },
      { dx: 0, dy: 1, rotation: 2 },
      { dx: -1, dy: 0, rotation: 1 },
    ];

    let fallback: CoastDirection | null = null;

    for (const direction of directions) {
      const nx = x + direction.dx;
      const ny = y + direction.dy;
      const water = this.context.terrainAt(nx, ny);
      if (water !== 'water') continue;

      const farX = nx + direction.dx;
      const farY = ny + direction.dy;
      const farWater =
        farX >= 0 &&
        farY >= 0 &&
        farX < this.context.size &&
        farY < this.context.size &&
        this.context.terrainAt(farX, farY) === 'water';

      const candidate: CoastDirection = {
        ...direction,
        waterDepth: farWater ? 'deep' : 'shallow',
      };

      if (farWater) return candidate;
      fallback = candidate;
    }

    return fallback;
  }

  canPlace(kind: HarborKind, x: number, y: number): CoastDirection | null {
    const direction = this.coastDirection(x, y);
    if (!direction) return null;

    if ((kind === 'harbor' || kind === 'woodenPier') && direction.waterDepth !== 'deep') {
      return null;
    }

    return direction;
  }

  defaultShip(kind: HarborKind): ShipKind | null {
    if (kind === 'fishingDock') return 'fishingBoat';
    if (kind === 'harbor') return 'tradingBoat';
    if (kind === 'woodenPier') return 'transportShip';
    if (kind === 'smallDock') return 'fishingBoat';
    return null;
  }
}
