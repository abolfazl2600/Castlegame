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

/** Authored Himeji Castle plot requested for the historic template. */
export const HIMEJI_LAND_WIDTH = 46;
export const HIMEJI_LAND_DEPTH = 90;

/** Large handcrafted north-south valley. Dimensions are world units, matching the other authored layouts. */
export const ROYAL_VALLEY_LAND_WIDTH = 50;
export const ROYAL_VALLEY_LAND_DEPTH = 89;

export function urbanLandBounds(size: number) {
  const cols = URBAN_LAND_WIDTH / TILE_SIZE;
  const rows = URBAN_LAND_DEPTH / TILE_SIZE;
  const minX = Math.floor((size - cols) / 2);
  const minY = Math.floor((size - rows) / 2);
  return { minX, minY, cols, rows, maxX: minX + cols - 1, maxY: minY + rows - 1 };
}

/**
 * Raster bounds for the authored 46×90 Himeji plot.
 *
 * The engine uses 4-unit cells and now provides a 23×23 grid (92×92 rendered units),
 * so the complete authored depth fits without the former 22-row clipping:
 * 12×23 cells. Keeping the 46×90 dimensions as first-class map metadata prevents
 * the historic template from falling back to a generic square mainland footprint.
 */
export function himejiLandBounds(size: number) {
  const cols = Math.ceil(HIMEJI_LAND_WIDTH / TILE_SIZE);
  const rows = Math.ceil(HIMEJI_LAND_DEPTH / TILE_SIZE);
  const minX = Math.floor((size - cols) / 2);
  const minY = Math.floor((size - rows) / 2);
  return { minX, minY, cols, rows, maxX: minX + cols - 1, maxY: minY + rows - 1 };
}

export function royalValleyLandBounds(size: number) {
  const cols = Math.ceil(ROYAL_VALLEY_LAND_WIDTH / TILE_SIZE);
  const rows = Math.ceil(ROYAL_VALLEY_LAND_DEPTH / TILE_SIZE);
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
  {
    id: 'himeji-46x90',
    label: 'Himeji Castle Ground 46×90',
    description: 'A narrow 46×90 authored historic-castle plot used by the Himeji Castle starting world.',
    preview: '🏯',
  },
  {
    id: 'royal-valley-50x89',
    label: 'Royal Valley 50×89',
    description: 'A long 50×89 coastal valley with a navigable river, mountain ridge, forests, open farmland, and room for a complete kingdom.',
    preview: '♜≈🌲',
  },
] as const;

export function isMapLayoutId(value: unknown): value is MapLayoutId {
  return value === 'island' ||
    value === 'mainland' ||
    value === 'peninsula' ||
    value === 'twin-isles' ||
    value === 'urban-60x80' ||
    value === 'twin-fortresses-90x95' ||
    value === 'himeji-46x90' ||
    value === 'royal-valley-50x89';
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

interface RiverProfile {
  centerRatio: number;
  startRatio: number;
  endRatio: number;
  broadAmplitude: number;
  broadCycles: number;
  broadPhase: number;
  secondaryAmplitude: number;
  secondaryCycles: number;
  secondaryPhase: number;
  localAmplitude: number;
  localCycles: number;
  localPhase: number;
  asymmetry: number;
  baseWidth: number;
  widthVariation: number;
  widthCycles: number;
  widthPhase: number;
  bendWidening: number;
  bankIrregularity: number;
  bankCycles: number;
  bankPhase: number;
}

const RIVER_PROFILES: Partial<Record<MapLayoutId, RiverProfile>> = {
  island: {
    centerRatio: 0.49,
    startRatio: 0.1,
    endRatio: 0.9,
    broadAmplitude: 1.55,
    broadCycles: 0.72,
    broadPhase: 0.35,
    secondaryAmplitude: 0.68,
    secondaryCycles: 1.85,
    secondaryPhase: 1.55,
    localAmplitude: 0.24,
    localCycles: 4.15,
    localPhase: 0.4,
    asymmetry: 0.32,
    baseWidth: 0.68,
    widthVariation: 0.3,
    widthCycles: 1.55,
    widthPhase: 0.8,
    bendWidening: 0.16,
    bankIrregularity: 0.16,
    bankCycles: 3.7,
    bankPhase: 0.2,
  },
  mainland: {
    centerRatio: 0.42,
    startRatio: 0.08,
    endRatio: 0.92,
    broadAmplitude: 2.05,
    broadCycles: 0.55,
    broadPhase: 1.05,
    secondaryAmplitude: 0.82,
    secondaryCycles: 1.42,
    secondaryPhase: 0.15,
    localAmplitude: 0.28,
    localCycles: 3.35,
    localPhase: 2.05,
    asymmetry: 0.42,
    baseWidth: 0.82,
    widthVariation: 0.42,
    widthCycles: 1.18,
    widthPhase: 0.1,
    bendWidening: 0.24,
    bankIrregularity: 0.2,
    bankCycles: 3,
    bankPhase: 1.25,
  },
  peninsula: {
    centerRatio: 0.5,
    startRatio: 0.2,
    endRatio: 0.74,
    broadAmplitude: 0.72,
    broadCycles: 0.82,
    broadPhase: 0.25,
    secondaryAmplitude: 0.3,
    secondaryCycles: 1.75,
    secondaryPhase: 1.35,
    localAmplitude: 0.12,
    localCycles: 3.6,
    localPhase: 0.7,
    asymmetry: 0.12,
    baseWidth: 0.54,
    widthVariation: 0.14,
    widthCycles: 1.35,
    widthPhase: 2.1,
    bendWidening: 0.07,
    bankIrregularity: 0.08,
    bankCycles: 2.6,
    bankPhase: 0.35,
  },
};

function riverWave(t: number, cycles: number, phase: number): number {
  return Math.sin(t * Math.PI * 2 * cycles + phase);
}

function riverCenterline(profile: RiverProfile, t: number, size: number): number {
  const broad = riverWave(t, profile.broadCycles, profile.broadPhase);
  const secondary = riverWave(t, profile.secondaryCycles, profile.secondaryPhase);
  const local = riverWave(t, profile.localCycles, profile.localPhase);
  const asymmetric =
    riverWave(t, profile.broadCycles * 0.47, profile.broadPhase + 1.1) *
    riverWave(t, profile.secondaryCycles * 0.73, profile.secondaryPhase - 0.6);

  return (
    size * profile.centerRatio +
    broad * profile.broadAmplitude +
    secondary * profile.secondaryAmplitude +
    local * profile.localAmplitude +
    asymmetric * profile.asymmetry
  );
}

function riverHalfWidth(profile: RiverProfile, t: number): number {
  const primary = (riverWave(t, profile.widthCycles, profile.widthPhase) + 1) * 0.5;
  const secondary =
    (riverWave(t, profile.widthCycles * 2.27, profile.widthPhase + 1.7) + 1) * 0.5;
  const majorBend = Math.abs(
    riverWave(t, profile.broadCycles, profile.broadPhase + 0.25),
  );

  return (
    profile.baseWidth +
    profile.widthVariation * (primary * 0.7 + secondary * 0.3) +
    profile.bendWidening * majorBend
  );
}

function riverBankVariation(
  profile: RiverProfile,
  t: number,
  side: -1 | 1,
): number {
  const primary = riverWave(
    t,
    profile.bankCycles,
    profile.bankPhase + (side < 0 ? -0.65 : 0.8),
  );
  const detail = riverWave(
    t,
    profile.bankCycles * 1.83,
    profile.bankPhase + (side < 0 ? 1.4 : -0.9),
  );
  return profile.bankIrregularity * (primary * 0.72 + detail * 0.28);
}

function layoutRiver(layout: MapLayoutId, x: number, y: number, size: number, score: number): boolean {
  const profile = RIVER_PROFILES[layout];
  if (!profile || score <= 0.05 || y <= 1 || y >= size - 2) return false;

  const t = y / Math.max(1, size - 1);
  if (t < profile.startRatio || t > profile.endRatio) return false;

  const center = riverCenterline(profile, t, size);
  const signedDistance = x - center;
  const bankVariation = riverBankVariation(
    profile,
    t,
    signedDistance < 0 ? -1 : 1,
  );
  const halfWidth = Math.max(
    0.46,
    riverHalfWidth(profile, t) + bankVariation,
  );

  // Bank variation only changes the contiguous half-width for a row. It never
  // punches random holes into the channel, so editable terrain stays coherent.
  return Math.abs(signedDistance) <= halfWidth;
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

  if (layout === 'royal-valley-50x89') {
    const bounds = royalValleyLandBounds(size);
    if (x < bounds.minX || x > bounds.maxX || y < bounds.minY || y > bounds.maxY) return 'water';

    const localX = x - bounds.minX;
    const localY = y - bounds.minY;
    const edgeDistance = Math.min(
      localX,
      bounds.cols - 1 - localX,
      localY,
      bounds.rows - 1 - localY,
    );

    // Continuous sandy rim keeps both long coasts readable and guarantees harbor access.
    if (edgeDistance <= 0) return 'shore';

    // A narrow navigable river runs north-south along the eastern side of the valley,
    // leaving a large uninterrupted western plain for settlement and fortification.
    const t = localY / Math.max(1, bounds.rows - 1);
    const riverCenter =
      bounds.cols * 0.73 +
      Math.sin(t * Math.PI * 2 * 1.35 + 0.4) * 0.72 +
      Math.sin(t * Math.PI * 2 * 3.1) * 0.24;
    if (
      localY >= 2 &&
      localY <= bounds.rows - 3 &&
      Math.abs(localX - riverCenter) <= (localY % 7 === 0 ? 0.78 : 0.56)
    ) {
      return 'river';
    }

    const ridgeNoise = Math.sin(localY * 0.72) + Math.cos((localX + localY) * 0.37);
    if (
      localX <= 2 &&
      localY >= 2 &&
      localY <= bounds.rows - 3 &&
      ridgeNoise > -0.38
    ) {
      return 'mountain';
    }

    const forestNoise =
      Math.sin(localX * 0.91 + localY * 0.21) +
      Math.cos(localY * 0.54 - localX * 0.27);
    const northernForest = localY >= 2 && localY <= 7 && localX >= 3 && localX <= 7;
    const southernForest = localY >= bounds.rows - 8 && localY <= bounds.rows - 3 && localX >= 3 && localX <= 8;
    const riverWoodland = localX >= 7 && localX <= 9 && localY >= 10 && localY <= 17;
    if ((northernForest || southernForest || riverWoodland) && forestNoise > -0.48) return 'forest';

    return 'plains';
  }

  if (layout === 'himeji-46x90') {
    const bounds = himejiLandBounds(size);
    return x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY
      ? 'plains' : 'water';
  }

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
