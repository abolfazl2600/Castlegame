import Phaser from 'phaser';
import { TILE_SIZE } from '../core/constants';
import type { TileKind, ToolKind } from '../core/types';
import { GameState } from '../state/GameState';

const COLORS: Record<TileKind, number> = {
  wall: 0xa9b1bd,
  road: 0xb89064,
};

export class BuildSystem {
  private readonly layer: Phaser.GameObjects.Graphics;

  constructor(
    private readonly state: GameState,
    scene: Phaser.Scene,
  ) {
    this.layer = scene.add.graphics().setDepth(10);
    this.redraw();
  }

  canApply(x: number, y: number, tool: ToolKind): boolean {
    const existing = this.state.getCell(x, y);
    if (tool === 'erase') return existing !== undefined;
    return existing?.kind !== tool;
  }

  apply(x: number, y: number, tool: ToolKind): boolean {
    if (!this.canApply(x, y, tool)) return false;

    if (tool === 'erase') this.state.removeCell(x, y);
    else this.state.setCell(x, y, tool);

    this.redraw();
    return true;
  }

  redraw(): void {
    this.layer.clear();

    for (const cell of this.state.entries()) {
      const px = cell.x * TILE_SIZE;
      const py = cell.y * TILE_SIZE;

      if (cell.kind === 'road') this.drawRoad(px, py);
      else this.drawWall(cell.x, cell.y, px, py);
    }
  }

  private drawRoad(x: number, y: number): void {
    this.layer.fillStyle(COLORS.road, 1);
    this.layer.fillRoundedRect(x + 4, y + 4, TILE_SIZE - 8, TILE_SIZE - 8, 7);
    this.layer.lineStyle(2, 0x7c5d3e, 0.55);
    this.layer.strokeRoundedRect(x + 4, y + 4, TILE_SIZE - 8, TILE_SIZE - 8, 7);
    this.layer.fillStyle(0xe2c29e, 0.45);
    this.layer.fillCircle(x + TILE_SIZE * 0.35, y + TILE_SIZE * 0.42, 2);
    this.layer.fillCircle(x + TILE_SIZE * 0.65, y + TILE_SIZE * 0.62, 2);
  }

  private drawWall(cellX: number, cellY: number, x: number, y: number): void {
    const hasWall = (dx: number, dy: number) =>
      this.state.getCell(cellX + dx, cellY + dy)?.kind === 'wall';

    this.layer.fillStyle(0x111827, 0.28);
    this.layer.fillRoundedRect(x + 4, y + 7, TILE_SIZE - 6, TILE_SIZE - 7, 4);

    this.layer.fillStyle(COLORS.wall, 1);
    this.layer.fillRoundedRect(x + 3, y + 3, TILE_SIZE - 6, TILE_SIZE - 8, 3);

    if (hasWall(-1, 0)) this.layer.fillRect(x, y + 5, 7, TILE_SIZE - 12);
    if (hasWall(1, 0)) this.layer.fillRect(x + TILE_SIZE - 7, y + 5, 7, TILE_SIZE - 12);
    if (hasWall(0, -1)) this.layer.fillRect(x + 5, y, TILE_SIZE - 10, 7);
    if (hasWall(0, 1)) this.layer.fillRect(x + 5, y + TILE_SIZE - 9, TILE_SIZE - 10, 9);

    this.layer.lineStyle(1, 0x6b7280, 0.65);
    this.layer.lineBetween(x + 5, y + 14, x + TILE_SIZE - 5, y + 14);
    this.layer.lineBetween(x + 5, y + 25, x + TILE_SIZE - 5, y + 25);
    this.layer.lineBetween(x + 14, y + 4, x + 14, y + 14);
    this.layer.lineBetween(x + 27, y + 14, x + 27, y + 25);

    this.layer.fillStyle(0xd1d5db, 1);
    this.layer.fillRect(x + 5, y + 1, 8, 6);
    this.layer.fillRect(x + TILE_SIZE / 2 - 4, y + 1, 8, 6);
    this.layer.fillRect(x + TILE_SIZE - 13, y + 1, 8, 6);
  }
}
