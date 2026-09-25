import Phaser from 'phaser';
import {
  TILE_SIZE,
  WORLD_COLS,
  WORLD_HEIGHT,
  WORLD_ROWS,
  WORLD_WIDTH,
} from '../core/constants';

export class GridSystem {
  private readonly terrain: Phaser.GameObjects.Graphics;
  private readonly grid: Phaser.GameObjects.Graphics;
  private readonly hover: Phaser.GameObjects.Rectangle;

  constructor(private readonly scene: Phaser.Scene) {
    this.terrain = scene.add.graphics().setDepth(-20);
    this.grid = scene.add.graphics().setDepth(-10);

    this.drawTerrain();
    this.drawGrid();

    this.hover = scene.add
      .rectangle(0, 0, TILE_SIZE - 4, TILE_SIZE - 4, 0xf9fafb, 0.14)
      .setStrokeStyle(2, 0xf9fafb, 0.9)
      .setOrigin(0)
      .setVisible(false)
      .setDepth(20);
  }

  private drawTerrain(): void {
    this.terrain.fillStyle(0x263c2d, 1);
    this.terrain.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    const patchSize = TILE_SIZE * 8;
    for (let y = 0; y < WORLD_HEIGHT; y += patchSize) {
      for (let x = 0; x < WORLD_WIDTH; x += patchSize) {
        if ((x / patchSize + y / patchSize) % 2 === 0) {
          this.terrain.fillStyle(0x2b4432, 0.42);
          this.terrain.fillRoundedRect(x + 10, y + 10, patchSize - 20, patchSize - 20, 24);
        }
      }
    }
  }

  private drawGrid(): void {
    this.grid.lineStyle(1, 0xe5e7eb, 0.08);
    for (let x = 0; x <= WORLD_WIDTH; x += TILE_SIZE) {
      this.grid.lineBetween(x, 0, x, WORLD_HEIGHT);
    }
    for (let y = 0; y <= WORLD_HEIGHT; y += TILE_SIZE) {
      this.grid.lineBetween(0, y, WORLD_WIDTH, y);
    }
  }

  pointerToCell(pointer: Phaser.Input.Pointer): { x: number; y: number } | null {
    const worldPoint = pointer.positionToCamera(this.scene.cameras.main) as Phaser.Math.Vector2;
    const x = Math.floor(worldPoint.x / TILE_SIZE);
    const y = Math.floor(worldPoint.y / TILE_SIZE);

    if (x < 0 || y < 0 || x >= WORLD_COLS || y >= WORLD_ROWS) return null;
    return { x, y };
  }

  setHover(cell: { x: number; y: number } | null, valid: boolean): void {
    if (!cell) {
      this.hover.setVisible(false);
      return;
    }

    const color = valid ? 0xf9fafb : 0xef4444;
    this.hover
      .setPosition(cell.x * TILE_SIZE + 2, cell.y * TILE_SIZE + 2)
      .setStrokeStyle(2, color, 0.95)
      .setFillStyle(color, valid ? 0.14 : 0.1)
      .setVisible(true);
  }
}
