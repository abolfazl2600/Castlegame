import { TILE_SIZE } from '../core/constants';
import type { MapLayoutId, TerrainKind } from '../core/types';

export interface MapLayoutDefinition {
  id: MapLayoutId;
  label: string;
  description: string;
  preview: string;
}

/** Exact land dimensions in world units, independent of the surrounding ocean. */
export const URBAN_LAND_WIDTH = 60;
export const URBAN_LAND_DEPTH = 80;

/** Authored dimensions of the two-fortress battlefield. The renderer keeps the existing tile grid. */
export const TWIN_FORTRESSES_LAND_WIDTH = 90;
export const TWIN_FORTRESSES_LAND_DEPTH = 95;

export function urbanLandBounds(size: number) {
  const cols = URBAN_LAND_WIDTH / TILE_SIZE;
  const rows = URBAN_LAND_DEPTH / TILE_SIZE;
  const minX = Math.floor((size - cols) / 2);
  const minY = Math.floor((size - rows) / 2);
  return { minX, minY, cols, rows, maxX: minX + cols - 1, maxY: minY + rows - 1 };
}

export const MAP_LAYOUTS: readonly MapLayoutDefinition[] = [
  {
    id: 'island',
    label: 'Classic Island',
    description: 'The original rounded island with a central river, forests, mountains, and ocean on every side.',
    preview: '◯',
  },
  {
    id: 'mainland',
    label: 'Mainland Coast',
    description: 'A broad continuous mainland that reaches three map edges, with a long eastern coastline and generous building space.',
    preview: '▰≈',
  },
  {
    id: 'peninsula',
    label: 'Peninsula',
    description: 'A long connected landform reaching the north edge, surrounded by water on both sides and opening into a wide central plateau.',
    preview: '▽',
  },
  {
    id: 'twin-isles',
    label: 'Twin Isles',
    description: 'Two separated buildable islands with distinct shores and open water between them for bridges, ports, and split settlements.',
    preview: '◯ ◯',
  },
  {
    id: 'urban-60x80',
    label: 'Urban Land 60×80',
    description: 'A flat rectangular plot, 60×80 world units (15×20 building tiles), with ocean outside its boundaries.',
    preview: '▦',
  },
  {
    id: 'twin-fortresses-90x95',
    label: 'Twin Fortresses 90×95',
    description: 'A two-castle battlefield with twin gates, keeps, military camps, roads, and distributed resources.',
    preview: '♜⚔♜',
  },
] as const;

export function isMapLayoutId(value: unknown): value is MapLayoutId {
  return value === 'island' ||
    value === 'mainland' ||
    value === 'peninsula' ||
    value === 'twin-isles' ||
    value === 'urban-60x80' ||
    value === 'twin-fortresses-90x95';
}

export function normalizeMapLayoutId(value: unknown): MapLayoutId {
  return isMapLayoutId(value) ? value : 'island';
}

function coastlineNoise(x: number, y: number): number {
  return (
    Math.sin(x * 0.73 + y * 0.19) * 0.018 +
    Math.cos(y * 0.61 - x * 0.17) * 0.022 +
    Math.sin((x + y) * 0.31) * 0.014 +
    Math.cos((x - y) * 0.24) * 0.011
  );
}

function islandScore(x: number, y: number, size: number): number {
  const nx = (x + 0.5) / size - 0.5;
  const ny = (y + 0.5) / size - 0.5;
  const radial = Math.sqrt(nx * nx * 0.94 + ny * ny * 1.04);
  return 0.43 - radial + coastlineNoise(x, y);
}

function mainlandScore(x: number, y: number, size: number): number {
  const nx = (x + 0.5) / size - 0.5;
  const ny = (y + 0.5) / size - 0.5;
  const coast =
    0.34 -
    nx +
    Math.sin(y * 0.41) * 0.035 +
    Math.sin(y * 0.13 + 1.2) * 0.025 +
    coastlineNoise(x, y) * 0.7;
  const southernBay =
    ny > 0.18
      ? Math.max(0, 0.13 - Math.hypot(nx - 0.23, ny - 0.34)) * 0.8
      : 0;
  return coast - southernBay;
}

function peninsulaScore(x: number, y: number, size: number): number {
  const nx = (x + 0.5) / size - 0.5;
  const ny = (y + 0.5) / size - 0.5;
  const centerline = Math.sin((ny + 0.48) * Math.PI * 1.35) * 0.035;
  const width =
    0.17 +
    Math.max(0, 0.42 - Math.abs(ny + 0.02)) * 0.34 +
    (ny < -0.3 ? 0.035 : 0);
  const sideMargin = width - Math.abs(nx - centerline);
  const southernTip = 0.39 - ny;
  return Math.min(sideMargin, southernTip) + coastlineNoise(x, y) * 0.55;
}

function twinIslesScore(x: number, y: number, size: number): number {
  const nx = (x + 0.5) / size - 0.5;
  const ny = (y + 0.5) / size - 0.5;
  const left =
    0.205 -
    Math.sqrt(
      ((nx + 0.21) * (nx + 0.21)) / 0.95 +
      ((ny + 0.05) * (ny + 0.05)) / 1.15,
    );
  const right =
    0.215 -
    Math.sqrt(
      ((nx - 0.22) * (nx - 0.22)) / 1.05 +
      ((ny - 0.08) * (ny - 0.08)) / 0.9,
    );
  return Math.max(left, right) + coastlineNoise(x, y) * 0.7;
}

function landScore(layout: MapLayoutId, x: number, y: number, size: number): number {
  if (layout === 'mainland') return mainlandScore(x, y, size);
  if (layout === 'peninsula') return peninsulaScore(x, y, size);
  if (layout === 'twin-isles') return twinIslesScore(x, y, size);
  return islandScore(x, y, size);
}

function layoutRiver(layout: MapLayoutId, x: number, y: number, size: number, score: number): boolean {
  if (score <= 0.06 || y <= 1 || y >= size - 2) return false;

  if (layout === 'island') {
    const center =
      size * 0.48 +
      Math.sin(y * 0.54) * 1.18 +
      Math.sin(y * 0.18 + 1.2) * 0.42;
    const width =
      0.48 +
      (Math.sin(y * 0.37 + 0.8) + 1) * 0.16 +
      (y > size * 0.62 ? 0.12 : 0);
    return Math.abs(x - center) < width;
  }

  if (layout === 'mainland') {
    const center = size * 0.42 + Math.sin(y * 0.43 + 0.8) * 1.35;
    const width = y > size * 0.58 ? 0.78 : 0.58;
    return Math.abs(x - center) < width;
  }

  if (layout === 'peninsula') {
    const center = size * 0.5 + Math.sin(y * 0.31) * 0.65;
    return y > size * 0.2 && y < size * 0.72 && Math.abs(x - center) < 0.46;
  }

  return false;
}

function layoutMountain(layout: MapLayoutId, x: number, y: number, size: number): boolean {
  const rockyNoise =
    Math.sin(x * 0.47 + y * 0.22) +
    Math.cos(y * 0.53 - x * 0.18);

  if (layout === 'island') {
    const zone =
      (x > size * 0.61 && y < size * 0.43) ||
      (x > size * 0.7 && y > size * 0.46 && y < size * 0.7);
    return zone && rockyNoise > 0.48;
  }

  if (layout === 'mainland') {
    return x < size * 0.24 && y < size * 0.62 && rockyNoise > 0.42;
  }

  if (layout === 'peninsula') {
    return y < size * 0.28 && Math.abs(x - size * 0.5) < size * 0.14 && rockyNoise > 0.28;
  }

  return (
    ((x < size * 0.36 && y < size * 0.42) ||
      (x > size * 0.62 && y > size * 0.48)) &&
    rockyNoise > 0.52
  );
}

function layoutForest(layout: MapLayoutId, x: number, y: number, size: number): boolean {
  const forestNoise =
    Math.sin(x * 0.61) +
    Math.cos(y * 0.49) +
    Math.sin((x + y) * 0.33);

  if (layout === 'island') {
    const zone =
      (x < size * 0.37 && y > size * 0.35) ||
      (x > size * 0.62 && y > size * 0.56) ||
      (x < size * 0.28 && y < size * 0.34);
    return zone && forestNoise > -0.25;
  }

  if (layout === 'mainland') {
    return (
      ((x < size * 0.5 && y > size * 0.55) ||
        (x > size * 0.55 && y < size * 0.34)) &&
      forestNoise > -0.18
    );
  }

  if (layout === 'peninsula') {
    return y > size * 0.38 && y < size * 0.75 && forestNoise > 0.1;
  }

  return forestNoise > 0.45;
}

export function terrainForMapLayout(
  layout: MapLayoutId,
  x: number,
  y: number,
  size: number,
): TerrainKind {
  if (x < 0 || y < 0 || x >= size || y >= size) return 'water';

  if (layout === 'twin-fortresses-90x95') {
    const edgeMountain = (x <= 2 && y <= 4) || (x >= size - 3 && y >= size - 5);
    if (edgeMountain) return 'mountain';
    const forestPocket = (x >= 9 && x <= 11 && y <= 4) || (x >= 10 && x <= 12 && y >= size - 5);
    if (forestPocket) return 'forest';
    return 'plains';
  }

  if (layout === 'urban-60x80') {
    const bounds = urbanLandBounds(size);
    return x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY
      ? 'plains' : 'water';
  }

  const score = landScore(layout, x, y, size);
  if (score < -0.035) return 'water';
  if (score < 0.025) return 'shore';

  if (layoutRiver(layout, x, y, size, score)) return 'river';
  if (layoutMountain(layout, x, y, size)) return 'mountain';
  if (layoutForest(layout, x, y, size)) return 'forest';
  return 'plains';
}
