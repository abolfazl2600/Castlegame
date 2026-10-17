import type { WorldGridDimensions } from './WorldGrid';

/** Sixteen visible land plots: the middle two columns (eight plots) start unlocked. */
export const LAND_PLOT_COLUMNS = 4;
export const LAND_PLOT_ROWS = 4;
export const LAND_PLOT_COUNT = LAND_PLOT_COLUMNS * LAND_PLOT_ROWS;
export const LAND_PLOT_PRICE = 100;
export const LAND_COIN_REWARD = 10;
export const LAND_COIN_INTERVAL_MS = 60_000;
const MAX_COINS = 10_000_000;

export interface LandProgressState {
  coins: number;
  activeTimeRemainderMs: number;
  unlockedPlots: number[];
}

export interface LandPlot {
  id: number;
  col: number;
  row: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  unlocked: boolean;
}

const INITIAL_PLOTS = Array.from({ length: LAND_PLOT_COUNT }, (_, id) => id)
  .filter((id) => id % LAND_PLOT_COLUMNS === 1 || id % LAND_PLOT_COLUMNS === 2);

export function plotForCell(x: number, y: number, grid: Pick<WorldGridDimensions, 'cols' | 'rows'>): number | null {
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= grid.cols || y >= grid.rows) return null;
  const col = Math.floor((x * LAND_PLOT_COLUMNS) / grid.cols);
  const row = Math.floor((y * LAND_PLOT_ROWS) / grid.rows);
  return row * LAND_PLOT_COLUMNS + col;
}

export class LandProgression {
  private coins = 0;
  private remainderMs = 0;
  private unlocked = new Set<number>(INITIAL_PLOTS);

  reset(): void {
    this.coins = 0;
    this.remainderMs = 0;
    this.unlocked = new Set(INITIAL_PLOTS);
  }

  restore(
    saved?: Partial<LandProgressState> | null,
    legacyOccupied: ReadonlyArray<{ x: number; y: number }> = [],
    grid?: Pick<WorldGridDimensions, 'cols' | 'rows'>,
  ): void {
    this.reset();
    if (saved && Array.isArray(saved.unlockedPlots)) {
      this.unlocked = new Set([
        ...INITIAL_PLOTS,
        ...saved.unlockedPlots.filter((id) => Number.isInteger(id) && id >= 0 && id < LAND_PLOT_COUNT),
      ]);
      this.coins = Number.isFinite(saved.coins) ? Math.max(0, Math.min(MAX_COINS, Math.floor(saved.coins!))) : 0;
      this.remainderMs = Number.isFinite(saved.activeTimeRemainderMs)
        ? Math.max(0, Math.floor(saved.activeTimeRemainderMs!)) % LAND_COIN_INTERVAL_MS
        : 0;
    } else if (grid) {
      // Legacy saves had no ownership system: keep player-built land accessible.
      for (const cell of legacyOccupied) {
        const id = plotForCell(cell.x, cell.y, grid);
        if (id !== null) this.unlocked.add(id);
      }
    }
  }

  snapshot(): LandProgressState {
    return {
      coins: this.coins,
      activeTimeRemainderMs: this.remainderMs,
      unlockedPlots: [...this.unlocked].sort((a, b) => a - b),
    };
  }

  get balance(): number { return this.coins; }
  get millisecondsUntilReward(): number { return LAND_COIN_INTERVAL_MS - this.remainderMs; }
  get unlockedCount(): number { return this.unlocked.size; }

  /** Active foreground frame time only; a long suspended frame never earns offline coins. */
  tick(frameMs: number): boolean {
    if (!Number.isFinite(frameMs) || frameMs <= 0) return false;
    this.remainderMs += Math.min(frameMs, 1000);
    if (this.remainderMs < LAND_COIN_INTERVAL_MS) return false;
    const rewards = Math.floor(this.remainderMs / LAND_COIN_INTERVAL_MS);
    this.remainderMs %= LAND_COIN_INTERVAL_MS;
    this.coins = Math.min(MAX_COINS, this.coins + rewards * LAND_COIN_REWARD);
    return true;
  }

  isUnlocked(id: number): boolean {
    return Number.isInteger(id) && this.unlocked.has(id);
  }

  isUnlockedAt(x: number, y: number, grid: Pick<WorldGridDimensions, 'cols' | 'rows'>): boolean {
    const id = plotForCell(x, y, grid);
    return id !== null && this.unlocked.has(id);
  }

  buy(id: number): boolean {
    if (!Number.isInteger(id) || id < 0 || id >= LAND_PLOT_COUNT || this.unlocked.has(id) || this.coins < LAND_PLOT_PRICE) return false;
    this.coins -= LAND_PLOT_PRICE;
    this.unlocked.add(id);
    return true;
  }

  plots(grid: Pick<WorldGridDimensions, 'cols' | 'rows'>): LandPlot[] {
    return Array.from({ length: LAND_PLOT_COUNT }, (_, id) => {
      const col = id % LAND_PLOT_COLUMNS;
      const row = Math.floor(id / LAND_PLOT_COLUMNS);
      return {
        id, col, row,
        minX: Math.ceil(col * grid.cols / LAND_PLOT_COLUMNS),
        maxX: Math.ceil((col + 1) * grid.cols / LAND_PLOT_COLUMNS) - 1,
        minY: Math.ceil(row * grid.rows / LAND_PLOT_ROWS),
        maxY: Math.ceil((row + 1) * grid.rows / LAND_PLOT_ROWS) - 1,
        unlocked: this.unlocked.has(id),
      };
    });
  }
}
