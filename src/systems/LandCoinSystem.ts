import type { WorldGridDimensions } from '../world/WorldGrid';

export const LAND_PARCEL_SIDE = 4;
export const LAND_PARCEL_PRICE = 10;
export const COIN_EARN_INTERVAL_MS = 30_000;

export interface LandEconomyState {
  version: 1;
  coins: number;
  playedMsRemainder: number;
  ownedParcels: string[];
}

export interface LandParcel {
  id: string;
  x: number;
  y: number;
  cols: number;
  rows: number;
  cost: number;
  owned: boolean;
}

/** The central half of each world's columns starts owned, keeping template
 * castles near the middle. Both outside bands are purchasable 4x4 parcels. */
export function starterOwnedColumns(grid: Pick<WorldGridDimensions, 'cols'>): number {
  return Math.ceil(grid.cols / 2);
}

export function starterLandBounds(grid: Pick<WorldGridDimensions, 'cols'>): { minX: number; maxX: number } {
  const width = starterOwnedColumns(grid);
  const minX = Math.floor((grid.cols - width) / 2);
  return { minX, maxX: minX + width - 1 };
}

function parcelOrigin(x: number, y: number, grid: Pick<WorldGridDimensions, 'cols' | 'rows'>): { x: number; y: number } | null {
  const { minX, maxX } = starterLandBounds(grid);
  if (!Number.isInteger(x) || !Number.isInteger(y) ||
    x < 0 || x >= grid.cols || y < 0 || y >= grid.rows ||
    (x >= minX && x <= maxX)) return null;
  const originX = x < minX
    ? Math.floor(x / LAND_PARCEL_SIDE) * LAND_PARCEL_SIDE
    : maxX + 1 + Math.floor((x - (maxX + 1)) / LAND_PARCEL_SIDE) * LAND_PARCEL_SIDE;
  return { x: originX, y: Math.floor(y / LAND_PARCEL_SIDE) * LAND_PARCEL_SIDE };
}

function parcelId(x: number, y: number): string {
  return x + ',' + y;
}

export class LandCoinSystem {
  private coins = 0;
  private playedMsRemainder = 0;
  private owned = new Set<string>();

  reset(): void {
    this.coins = 0;
    this.playedMsRemainder = 0;
    this.owned.clear();
  }

  getState(): LandEconomyState {
    return {
      version: 1, coins: this.coins,
      playedMsRemainder: Math.floor(this.playedMsRemainder),
      ownedParcels: [...this.owned].sort(),
    };
  }

  setState(value?: Partial<LandEconomyState> | null): void {
    this.reset();
    if (!value) return;
    const safe = (input: unknown): number =>
      typeof input === 'number' && Number.isFinite(input) && input >= 0 ? Math.floor(input) : 0;
    this.coins = Math.min(1_000_000_000, safe(value.coins));
    this.playedMsRemainder = safe(value.playedMsRemainder) % COIN_EARN_INTERVAL_MS;
    for (const id of Array.isArray(value.ownedParcels) ? value.ownedParcels.slice(0, 4000) : []) {
      if (typeof id === 'string' && /^(?:0|[1-9]\d{0,3}),(?:0|[1-9]\d{0,3})$/.test(id)) this.owned.add(id);
    }
  }

  /**
   * Tick from real foreground render time, not Date.now or save timestamps:
   * never grant coins while the app is closed, hidden or on a long suspended frame.
   * Clamping blocks accidental windfalls when a WebView resumes after a pause.
   */
  tick(frameDeltaMs: number, active: boolean): boolean {
    if (!active || !Number.isFinite(frameDeltaMs) || frameDeltaMs <= 0) return false;
    const delta = Math.min(1000, frameDeltaMs);
    this.playedMsRemainder += delta;
    if (this.playedMsRemainder < COIN_EARN_INTERVAL_MS) return false;
    const reward = Math.floor(this.playedMsRemainder / COIN_EARN_INTERVAL_MS);
    this.playedMsRemainder %= COIN_EARN_INTERVAL_MS;
    this.coins = Math.min(1_000_000_000, this.coins + reward);
    return reward > 0;
  }

  /** Preserve players' pre-update construction in old saves without minting
   * currency. Natural scenery does not count as owned territory. */
  adoptLegacyBuildings(
    buildings: readonly { x: number; y: number }[],
    grid: Pick<WorldGridDimensions, 'cols' | 'rows'>,
  ): void {
    for (const { x, y } of buildings) {
      const origin = parcelOrigin(x, y, grid);
      if (origin) this.owned.add(parcelId(origin.x, origin.y));
    }
  }

  get balance(): number {
    return this.coins;
  }

  isOwned(x: number, y: number, grid: Pick<WorldGridDimensions, 'cols' | 'rows'>): boolean {
    if (!Number.isInteger(x) || !Number.isInteger(y) ||
      x < 0 || y < 0 || x >= grid.cols || y >= grid.rows) return false;
    const { minX, maxX } = starterLandBounds(grid);
    if (x >= minX && x <= maxX) return true;
    const origin = parcelOrigin(x, y, grid);
    return Boolean(origin && this.owned.has(parcelId(origin.x, origin.y)));
  }

  hasOwnership(cells: readonly { x: number; y: number }[], grid: Pick<WorldGridDimensions, 'cols' | 'rows'>): boolean {
    return cells.every(cell => this.isOwned(cell.x, cell.y, grid));
  }

  parcelAt(x: number, y: number, grid: Pick<WorldGridDimensions, 'cols' | 'rows'>): LandParcel | null {
    const origin = parcelOrigin(x, y, grid);
    if (!origin) return null;
    const id = parcelId(origin.x, origin.y);
    return {
      id, x: origin.x, y: origin.y,
      cols: Math.min(LAND_PARCEL_SIDE,
        origin.x < starterLandBounds(grid).minX
          ? starterLandBounds(grid).minX - origin.x
          : grid.cols - origin.x),
      rows: Math.min(LAND_PARCEL_SIDE, grid.rows - origin.y),
      cost: LAND_PARCEL_PRICE,
      owned: this.owned.has(id),
    };
  }

  parcels(grid: Pick<WorldGridDimensions, 'cols' | 'rows'>): LandParcel[] {
    const result: LandParcel[] = [];
    const { minX, maxX } = starterLandBounds(grid);
    for (let y = 0; y < grid.rows; y += LAND_PARCEL_SIDE) {
      for (let x = 0; x < minX; x += LAND_PARCEL_SIDE) {
        const parcel = this.parcelAt(x, y, grid);
        if (parcel) result.push(parcel);
      }
      for (let x = maxX + 1; x < grid.cols; x += LAND_PARCEL_SIDE) {
        const parcel = this.parcelAt(x, y, grid);
        if (parcel) result.push(parcel);
      }
    }
    return result;
  }

  purchase(x: number, y: number, grid: Pick<WorldGridDimensions, 'cols' | 'rows'>): 'purchased' | 'owned' | 'insufficient' | 'invalid' {
    const parcel = this.parcelAt(x, y, grid);
    if (!parcel) return 'invalid';
    if (parcel.owned) return 'owned';
    if (this.coins < parcel.cost) return 'insufficient';
    this.coins -= parcel.cost;
    this.owned.add(parcel.id);
    return 'purchased';
  }
}
