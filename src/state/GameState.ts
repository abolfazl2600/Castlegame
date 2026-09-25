import type { GridCell, TileKind } from '../core/types';

export class GameState {
  private readonly cells = new Map<string, GridCell>();

  private key(x: number, y: number): string {
    return `${x},${y}`;
  }

  getCell(x: number, y: number): GridCell | undefined {
    return this.cells.get(this.key(x, y));
  }

  setCell(x: number, y: number, kind: TileKind): void {
    this.cells.set(this.key(x, y), { kind });
  }

  removeCell(x: number, y: number): void {
    this.cells.delete(this.key(x, y));
  }

  clear(): void {
    this.cells.clear();
  }

  replace(cells: Array<{ x: number; y: number; kind: TileKind }>): void {
    this.clear();
    for (const cell of cells) {
      this.setCell(cell.x, cell.y, cell.kind);
    }
  }

  entries(): Array<{ x: number; y: number; kind: TileKind }> {
    const result: Array<{ x: number; y: number; kind: TileKind }> = [];
    for (const [key, cell] of this.cells.entries()) {
      const [x, y] = key.split(',').map(Number);
      result.push({ x, y, kind: cell.kind });
    }
    return result;
  }
}
