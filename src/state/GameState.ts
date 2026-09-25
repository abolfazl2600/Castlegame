import type { GridCell, TileKind } from '../core/types';

export interface CellEntry extends GridCell {
  x: number;
  y: number;
}

export class GameState {
  private readonly cells = new Map<string, GridCell>();

  private key(x: number, y: number): string {
    return `${x},${y}`;
  }

  getCell(x: number, y: number): GridCell | undefined {
    return this.cells.get(this.key(x, y));
  }

  setCell(x: number, y: number, kind: TileKind, level = 1, options: Partial<GridCell> = {}): void {
    this.cells.set(this.key(x, y), {
      ...options,
      kind,
      level: Math.max(1, Math.floor(level)),
    });
  }

  updateCell(x: number, y: number, changes: Partial<GridCell>): void {
    const cell = this.getCell(x, y);
    if (!cell) return;

    const next: GridCell = { ...cell, ...changes };
    if (next.level !== undefined) next.level = Math.max(1, Math.floor(next.level));
    this.cells.set(this.key(x, y), next);
  }

  setLevel(x: number, y: number, level: number): void {
    this.updateCell(x, y, { level });
  }

  removeCell(x: number, y: number): void {
    this.cells.delete(this.key(x, y));
  }

  clear(): void {
    this.cells.clear();
  }

  replace(cells: CellEntry[]): void {
    this.clear();
    for (const cell of cells) {
      const { x, y, kind, level, ...options } = cell;
      this.setCell(x, y, kind, level ?? 1, options);
    }
  }

  entries(): CellEntry[] {
    const result: CellEntry[] = [];

    for (const [key, cell] of this.cells.entries()) {
      const [x, y] = key.split(',').map(Number);
      result.push({ x, y, ...cell, level: cell.level ?? 1 });
    }

    return result;
  }
}
