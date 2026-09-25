import Phaser from 'phaser';
import { TILE_SIZE } from '../core/constants';
import type { TileKind, ToolKind } from '../core/types';
import { GameState } from '../state/GameState';
import { EnvironmentSystem } from './EnvironmentSystem';

const COLORS: Record<TileKind, number> = {
  wall: 0xe5d1bc,
  gate: 0xc99366,
  tower: 0xf0ddd0,
  road: 0xa07b63,
  cottage: 0xd99374,
  house: 0xe3d8f2,
  manor: 0xefb4be,
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
        case 'road':
          this.drawRoad(px, py);
          break;
        case 'wall':
          this.drawWall(cell.x, cell.y, px, py);
          break;
        case 'gate':
          this.drawGate(cell.x, cell.y, px, py);
          break;
        case 'tower':
          this.drawTower(cell.x, cell.y, px, py);
          break;
        case 'cottage':
          this.drawCottage(px, py);
          break;
        case 'house':
          this.drawHouse(px, py);
          break;
        case 'manor':
          this.drawManor(px, py);
          break;
      }
    }
  }

  private isWallFamily(x: number, y: number): boolean {
    const kind = this.state.getCell(x, y)?.kind;
    return kind === 'wall' || kind === 'gate' || kind === 'tower';
  }

  private drawRoad(x: number, y: number): void {
    this.layer.fillStyle(COLORS.road, 1);
    this.layer.fillRoundedRect(x + 5, y + 8, TILE_SIZE - 10, TILE_SIZE - 16, 6);
    this.layer.lineStyle(2, 0x7c5d4a, 0.55);
    this.layer.strokeRoundedRect(x + 5, y + 8, TILE_SIZE - 10, TILE_SIZE - 16, 6);
    this.layer.fillStyle(0xccb098, 0.45);
    this.layer.fillCircle(x + 14, y + 18, 2);
    this.layer.fillCircle(x + 26, y + 23, 2);
  }

  private drawWall(cellX: number, cellY: number, x: number, y: number): void {
    const left = this.isWallFamily(cellX - 1, cellY);
    const right = this.isWallFamily(cellX + 1, cellY);
    const up = this.isWallFamily(cellX, cellY - 1);
    const down = this.isWallFamily(cellX, cellY + 1);
    const connections = [left, right, up, down].filter(Boolean).length;

    this.layer.fillStyle(0x7b6254, 0.16);
    this.layer.fillEllipse(x + TILE_SIZE / 2, y + TILE_SIZE - 4, 28, 7);

    this.layer.fillStyle(COLORS.wall, 1);
    this.layer.fillRoundedRect(x + 10, y + 10, TILE_SIZE - 20, TILE_SIZE - 20, 4);

    if (left) this.layer.fillRect(x, y + 14, 16, 12);
    if (right) this.layer.fillRect(x + TILE_SIZE - 16, y + 14, 16, 12);
    if (up) this.layer.fillRect(x + 14, y, 12, 16);
    if (down) this.layer.fillRect(x + 14, y + TILE_SIZE - 16, 12, 16);

    this.layer.fillStyle(0xf6ebde, 1);

    if (connections === 1) {
      if (!up) this.drawMerlons(x + 8, y + 6);
      if (!down) this.drawMerlons(x + 8, y + TILE_SIZE - 12);
      if (!left) this.drawVerticalMerlons(x + 6, y + 8);
      if (!right) this.drawVerticalMerlons(x + TILE_SIZE - 12, y + 8);
    } else if (connections === 2 && ((left && right) || (up && down))) {
      if (left && right) this.drawMerlons(x + 6, y + 6);
      else this.drawVerticalMerlons(x + 6, y + 6);
    } else if (connections === 2) {
      this.drawMerlons(x + 7, y + 5);
      this.drawVerticalMerlons(x + TILE_SIZE - 12, y + 7);
    } else if (connections === 3) {
      this.drawMerlons(x + 7, y + 5);
      this.drawVerticalMerlons(x + 6, y + 7);
      this.drawVerticalMerlons(x + TILE_SIZE - 12, y + 7);
    } else {
      this.drawMerlons(x + 7, y + 5);
      this.drawVerticalMerlons(x + 6, y + 7);
      this.drawVerticalMerlons(x + TILE_SIZE - 12, y + 7);
    }

    this.layer.lineStyle(1, 0xccb89f, 0.85);
    this.layer.strokeRoundedRect(x + 10, y + 10, TILE_SIZE - 20, TILE_SIZE - 20, 4);
  }

  private drawGate(cellX: number, cellY: number, x: number, y: number): void {
    const left = this.isWallFamily(cellX - 1, cellY);
    const right = this.isWallFamily(cellX + 1, cellY);

    this.layer.fillStyle(0x7b6254, 0.18);
    this.layer.fillEllipse(x + TILE_SIZE / 2, y + TILE_SIZE - 4, 30, 8);

    this.layer.fillStyle(COLORS.wall, 1);
    this.layer.fillRect(x + 4, y + 10, 9, 18);
    this.layer.fillRect(x + TILE_SIZE - 13, y + 10, 9, 18);
    if (left) this.layer.fillRect(x, y + 14, 9, 11);
    if (right) this.layer.fillRect(x + TILE_SIZE - 9, y + 14, 9, 11);

    this.layer.fillStyle(COLORS.gate, 1);
    this.layer.fillRoundedRect(x + 13, y + 13, 14, 17, 3);
    this.layer.fillStyle(0x8f5f3e, 1);
    this.layer.fillRect(x + 16, y + 14, 2, 15);
    this.layer.fillRect(x + 22, y + 14, 2, 15);
    this.layer.fillStyle(0x5b3a27, 1);
    this.layer.fillCircle(x + 20, y + 22, 1.7);

    this.drawMerlons(x + 4, y + 6);
  }

  private drawTower(cellX: number, cellY: number, x: number, y: number): void {
    const left = this.isWallFamily(cellX - 1, cellY);
    const right = this.isWallFamily(cellX + 1, cellY);
    const up = this.isWallFamily(cellX, cellY - 1);
    const down = this.isWallFamily(cellX, cellY + 1);

    this.layer.fillStyle(0x7b6254, 0.18);
    this.layer.fillEllipse(x + TILE_SIZE / 2, y + TILE_SIZE - 4, 32, 9);
    this.layer.fillStyle(COLORS.tower, 1);
    this.layer.fillEllipse(x + TILE_SIZE / 2, y + 21, 24, 20);
    this.layer.fillRect(x + 8, y + 12, 24, 13);
    this.layer.fillStyle(0xecc7d2, 1);
    this.layer.fillTriangle(x + 9, y + 13, x + 20, y + 3, x + 31, y + 13);
    this.layer.fillStyle(0xc46375, 1);
    this.layer.fillRect(x + 19, y + 4, 2, 6);
    this.layer.fillStyle(0x93d9d6, 0.9);
    this.layer.fillRect(x + 17, y + 18, 6, 6);

    if (left) this.layer.fillRect(x, y + 15, 12, 8);
    if (right) this.layer.fillRect(x + TILE_SIZE - 12, y + 15, 12, 8);
    if (up) this.layer.fillRect(x + 16, y, 8, 12);
    if (down) this.layer.fillRect(x + 16, y + TILE_SIZE - 12, 8, 12);

    this.drawMerlons(x + 10, y + 11);
  }

  private drawCottage(x: number, y: number): void {
    this.drawHouseShadow(x, y);
    this.layer.fillStyle(0xf1d4c0, 1);
    this.layer.fillRoundedRect(x + 9, y + 16, 21, 14, 4);
    this.layer.fillStyle(0xd7896e, 1);
    this.layer.fillTriangle(x + 7, y + 18, x + 19, y + 8, x + 32, y + 18);
    this.layer.fillStyle(0x946454, 1);
    this.layer.fillRect(x + 17, y + 20, 5, 10);
    this.layer.fillStyle(0xb5eef1, 0.8);
    this.layer.fillRect(x + 12, y + 20, 4, 4);
    this.layer.fillRect(x + 24, y + 20, 4, 4);
  }

  private drawHouse(x: number, y: number): void {
    this.drawHouseShadow(x, y);
    this.layer.fillStyle(0xf1e7f7, 1);
    this.layer.fillRoundedRect(x + 7, y + 14, 24, 17, 4);
    this.layer.fillStyle(0xa98ad8, 1);
    this.layer.fillTriangle(x + 5, y + 17, x + 19, y + 6, x + 33, y + 17);
    this.layer.fillStyle(0x946454, 1);
    this.layer.fillRect(x + 18, y + 21, 5, 10);
    this.layer.fillStyle(0xb5eef1, 0.8);
    this.layer.fillRect(x + 10, y + 19, 5, 5);
    this.layer.fillRect(x + 24, y + 19, 5, 5);
  }

  private drawManor(x: number, y: number): void {
    this.drawHouseShadow(x, y);
    this.layer.fillStyle(0xf4cfd6, 1);
    this.layer.fillRoundedRect(x + 5, y + 13, 28, 18, 4);
    this.layer.fillStyle(0xe48a98, 1);
    this.layer.fillTriangle(x + 4, y + 16, x + 19, y + 4, x + 34, y + 16);
    this.layer.fillStyle(0x946454, 1);
    this.layer.fillRect(x + 17, y + 20, 6, 11);
    this.layer.fillStyle(0xb5eef1, 0.8);
    this.layer.fillRect(x + 9, y + 18, 4, 5);
    this.layer.fillRect(x + 26, y + 18, 4, 5);
    this.layer.fillRect(x + 9, y + 25, 4, 4);
    this.layer.fillRect(x + 26, y + 25, 4, 4);
  }

  private drawMerlons(x: number, y: number): void {
    this.layer.fillStyle(0xf8eee3, 1);
    this.layer.fillRect(x, y, 5, 4);
    this.layer.fillRect(x + 8, y, 5, 4);
    this.layer.fillRect(x + 16, y, 5, 4);
  }

  private drawVerticalMerlons(x: number, y: number): void {
    this.layer.fillStyle(0xf8eee3, 1);
    this.layer.fillRect(x, y, 4, 5);
    this.layer.fillRect(x, y + 8, 4, 5);
    this.layer.fillRect(x, y + 16, 4, 5);
  }

  private drawHouseShadow(x: number, y: number): void {
    this.layer.fillStyle(0x111827, 0.14);
    this.layer.fillEllipse(x + TILE_SIZE / 2, y + TILE_SIZE - 6, 27, 7);
  }
}
