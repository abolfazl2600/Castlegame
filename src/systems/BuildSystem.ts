import Phaser from 'phaser';
import { TILE_SIZE } from '../core/constants';
import type { TileKind, ToolKind } from '../core/types';
import { GameState } from '../state/GameState';
import { EnvironmentSystem } from './EnvironmentSystem';

const COLORS: Record<TileKind, number> = {
  wall: 0xb7c0ca,
  road: 0xb89064,
  cottage: 0xc48b5f,
  house: 0x9aa7b3,
  manor: 0xa788d5,
};

export class BuildSystem {
  private readonly layer: Phaser.GameObjects.Graphics;

  constructor(
    private readonly state: GameState,
    private readonly environment: EnvironmentSystem,
    scene: Phaser.Scene,
  ) {
    this.layer = scene.add.graphics().setDepth(10);
    this.redraw();
  }

  canApply(x: number, y: number, tool: ToolKind): boolean {
    const existing = this.state.getCell(x, y);
    if (tool === 'erase') return existing !== undefined;
    if (!this.environment.canBuild(tool, x, y)) return false;
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
      switch (cell.kind) {
        case 'road': this.drawRoad(px, py); break;
        case 'wall': this.drawWall(cell.x, cell.y, px, py); break;
        case 'cottage': this.drawCottage(px, py); break;
        case 'house': this.drawHouse(px, py); break;
        case 'manor': this.drawManor(px, py); break;
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

  private drawWall(cellX: number, cellY: number, x: number, y: number): void {
    const hasWall = (dx: number, dy: number) => this.state.getCell(cellX + dx, cellY + dy)?.kind === 'wall';
    this.layer.fillStyle(0x111827, 0.3);
    this.layer.fillRoundedRect(x + 4, y + 8, TILE_SIZE - 6, TILE_SIZE - 7, 4);
    this.layer.fillStyle(COLORS.wall, 1);
    this.layer.fillRoundedRect(x + 3, y + 3, TILE_SIZE - 6, TILE_SIZE - 8, 3);
    if (hasWall(-1, 0)) this.layer.fillRect(x, y + 5, 7, TILE_SIZE - 10);
    if (hasWall(1, 0)) this.layer.fillRect(x + TILE_SIZE - 7, y + 5, 7, TILE_SIZE - 10);
    if (hasWall(0, -1)) this.layer.fillRect(x + 5, y, TILE_SIZE - 10, 7);
    if (hasWall(0, 1)) this.layer.fillRect(x + 5, y + TILE_SIZE - 9, TILE_SIZE - 10, 9);
    this.layer.fillStyle(0xe5e7eb, 0.95);
    this.layer.fillRect(x + 5, y + 1, 8, 6);
    this.layer.fillRect(x + TILE_SIZE / 2 - 4, y + 1, 8, 6);
    this.layer.fillRect(x + TILE_SIZE - 13, y + 1, 8, 6);
  }

  private drawCottage(x: number, y: number): void {
    this.drawHouseShadow(x, y);
    this.layer.fillStyle(0xe8dcc5, 1);
    this.layer.fillRoundedRect(x + 8, y + 15, 22, 16, 4);
    this.layer.fillStyle(0x8a4d32, 1);
    this.layer.fillTriangle(x + 6, y + 17, x + 19, y + 6, x + 32, y + 17);
    this.layer.fillStyle(0x7c4f32, 1);
    this.layer.fillRect(x + 17, y + 20, 5, 11);
    this.layer.fillStyle(0x93c5fd, 0.75);
    this.layer.fillRect(x + 11, y + 20, 4, 5);
    this.layer.fillRect(x + 25, y + 20, 4, 5);
  }

  private drawHouse(x: number, y: number): void {
    this.drawHouseShadow(x, y);
    this.layer.fillStyle(0xdbe3ea, 1);
    this.layer.fillRoundedRect(x + 7, y + 13, 24, 18, 4);
    this.layer.fillStyle(0x64748b, 1);
    this.layer.fillTriangle(x + 5, y + 16, x + 19, y + 5, x + 33, y + 16);
    this.layer.fillStyle(0x475569, 1);
    this.layer.fillRect(x + 26, y + 8, 3, 6);
    this.layer.fillStyle(0x7c4f32, 1);
    this.layer.fillRect(x + 18, y + 21, 5, 10);
    this.layer.fillStyle(0x93c5fd, 0.75);
    this.layer.fillRect(x + 10, y + 19, 5, 5);
    this.layer.fillRect(x + 24, y + 19, 5, 5);
  }

  private drawManor(x: number, y: number): void {
    this.drawHouseShadow(x, y);
    this.layer.fillStyle(0xe9ddfa, 1);
    this.layer.fillRoundedRect(x + 5, y + 12, 28, 19, 4);
    this.layer.fillStyle(0x7c5bb8, 1);
    this.layer.fillTriangle(x + 4, y + 16, x + 19, y + 3, x + 34, y + 16);
    this.layer.fillStyle(0x5b4290, 1);
    this.layer.fillRect(x + 8, y + 8, 5, 6);
    this.layer.fillRect(x + 26, y + 8, 5, 6);
    this.layer.fillStyle(0x7c4f32, 1);
    this.layer.fillRect(x + 17, y + 20, 6, 11);
    this.layer.fillStyle(0xbfdbfe, 0.8);
    this.layer.fillRect(x + 9, y + 18, 4, 5);
    this.layer.fillRect(x + 26, y + 18, 4, 5);
  }

  private drawHouseShadow(x: number, y: number): void {
    this.layer.fillStyle(0x111827, 0.22);
    this.layer.fillEllipse(x + TILE_SIZE / 2, y + TILE_SIZE - 6, 28, 8);
  }
}
