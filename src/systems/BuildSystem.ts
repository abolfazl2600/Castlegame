import Phaser from 'phaser';
import { TILE_SIZE } from '../core/constants';
import type { TileKind, ToolKind } from '../core/types';
import { GameState } from '../state/GameState';

const COLORS: Record<TileKind, number> = {
  castle: 0xa7b0be,
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

    if (tool === 'erase') {
      this.state.removeCell(x, y);
    } else {
      this.state.setCell(x, y, tool);
    }

    this.redraw();
    return true;
  }

  redraw(): void {
    this.layer.clear();

    for (const cell of this.state.entries()) {
      const px = cell.x * TILE_SIZE;
      const py = cell.y * TILE_SIZE;

      if (cell.kind === 'road') {
        this.drawRoad(px, py);
      } else {
        this.drawCastle(px, py);
      }
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

  private drawCastle(x: number, y: number): void {
    this.layer.fillStyle(0x1f2937, 0.34);
    this.layer.fillRoundedRect(x + 5, y + 8, TILE_SIZE - 8, TILE_SIZE - 7, 5);
    this.layer.fillStyle(COLORS.castle, 1);
    this.layer.fillRoundedRect(x + 3, y + 4, TILE_SIZE - 8, TILE_SIZE - 9, 4);
    this.layer.fillStyle(0x6b7280, 1);
    this.layer.fillRect(x + 6, y + 1, 7, 8);
    this.layer.fillRect(x + TILE_SIZE - 18, y + 1, 7, 8);
    this.layer.fillStyle(0x374151, 1);
    this.layer.fillRoundedRect(x + TILE_SIZE / 2 - 4, y + TILE_SIZE - 13, 8, 9, 2);
  }
}
