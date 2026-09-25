import Phaser from 'phaser';
import { TILE_SIZE, WORLD_COLS, WORLD_ROWS, WORLD_WIDTH, WORLD_HEIGHT } from '../core/constants';
import type { TerrainKind, ToolKind } from '../core/types';

export class EnvironmentSystem {
  private readonly ground: Phaser.GameObjects.Graphics;
  private readonly terrain: Phaser.GameObjects.Graphics;
  private readonly terrainMap: TerrainKind[][] = [];

  constructor(scene: Phaser.Scene) {
    this.ground = scene.add.graphics().setDepth(-40);
    this.terrain = scene.add.graphics().setDepth(-30);
    this.generateTerrain();
    this.draw();
  }

  getTerrainAt(x: number, y: number): TerrainKind {
    return this.terrainMap[y]?.[x] ?? 'water';
  }

  canBuild(tool: ToolKind, x: number, y: number): boolean {
    if (tool === 'erase') return true;
    const terrain = this.getTerrainAt(x, y);

    if (terrain === 'water' || terrain === 'river' || terrain === 'mountain') return false;
    if (terrain === 'forest') return tool === 'road' || tool === 'tower';
    return true;
  }

  private generateTerrain(): void {
    for (let y = 0; y < WORLD_ROWS; y += 1) {
      const row: TerrainKind[] = [];
      for (let x = 0; x < WORLD_COLS; x += 1) {
        row.push(this.computeTerrain(x, y));
      }
      this.terrainMap.push(row);
    }
  }

  private computeTerrain(x: number, y: number): TerrainKind {
    const nx = x / WORLD_COLS - 0.5;
    const ny = y / WORLD_ROWS - 0.5;
    const radial = Math.sqrt(nx * nx + ny * ny);
    const islandNoise = Math.sin(x * 0.19) * 0.03 + Math.cos(y * 0.16) * 0.04 + Math.sin((x + y) * 0.11) * 0.03;
    const islandValue = 0.43 - radial + islandNoise;

    if (islandValue < -0.04) return 'water';
    if (islandValue < 0.015) return 'shore';

    const riverSpine = WORLD_COLS * 0.47 + Math.sin(y * 0.16) * 2.1 + Math.cos(y * 0.07) * 1.2;
    const riverWidth = 1.2 + Math.sin(y * 0.11) * 0.35;
    if (y > 7 && y < WORLD_ROWS - 5 && Math.abs(x - riverSpine) < riverWidth && islandValue > 0.06) return 'river';

    const mountainNoise = Math.sin(x * 0.25) + Math.cos(y * 0.18) + Math.sin((x + y) * 0.1);
    const plateauZone = x > WORLD_COLS * 0.50 && y < WORLD_ROWS * 0.36;
    if (plateauZone && mountainNoise > 0.45) return 'mountain';

    const forestNoise = Math.sin(x * 0.31) + Math.cos(y * 0.29) + Math.sin((x * 0.15) + (y * 0.18));
    const forestZone = (x < WORLD_COLS * 0.32 && y > WORLD_ROWS * 0.42) || (x > WORLD_COLS * 0.62 && y > WORLD_ROWS * 0.58);
    if (forestZone && forestNoise > 0.55) return 'forest';

    return 'plains';
  }

  private draw(): void {
    this.ground.clear();
    this.terrain.clear();

    this.ground.fillStyle(0x66c6d1, 1);
    this.ground.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    for (let y = 0; y < WORLD_ROWS; y += 1) {
      for (let x = 0; x < WORLD_COLS; x += 1) {
        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;
        const kind = this.getTerrainAt(x, y);

        switch (kind) {
          case 'water':
            this.drawWater(px, py, x, y);
            break;
          case 'shore':
            this.drawShore(px, py, x, y);
            break;
          case 'plains':
            this.drawPlains(px, py, x, y);
            break;
          case 'river':
            this.drawRiver(px, py, x, y);
            break;
          case 'mountain':
            this.drawMountain(px, py, x, y);
            break;
          case 'forest':
            this.drawForest(px, py, x, y);
            break;
        }
      }
    }
  }

  private drawWater(x: number, y: number, cellX: number, cellY: number): void {
    this.terrain.fillStyle((cellX + cellY) % 2 === 0 ? 0x63c9d1 : 0x5cc0cb, 1);
    this.terrain.fillRect(x, y, TILE_SIZE, TILE_SIZE);
    this.terrain.fillStyle(0xb9f3f7, 0.18);
    this.terrain.fillEllipse(x + 14, y + 11, 16, 6);
    this.terrain.fillEllipse(x + 28, y + 25, 12, 4);
  }

  private drawShore(x: number, y: number, cellX: number, cellY: number): void {
    this.terrain.fillStyle((cellX + cellY) % 2 === 0 ? 0xcde889 : 0xc7e27c, 1);
    this.terrain.fillRect(x, y, TILE_SIZE, TILE_SIZE);
    this.terrain.fillStyle(0xefddb3, 0.55);
    this.terrain.fillRect(x, y + TILE_SIZE - 7, TILE_SIZE, 7);
    this.terrain.fillStyle(0xa8d072, 0.22);
    this.terrain.fillCircle(x + 9, y + 10, 2);
    this.terrain.fillCircle(x + 27, y + 19, 2);
  }

  private drawPlains(x: number, y: number, cellX: number, cellY: number): void {
    this.terrain.fillStyle((cellX + cellY) % 2 === 0 ? 0xcbe47e : 0xc2dc72, 1);
    this.terrain.fillRoundedRect(x, y, TILE_SIZE, TILE_SIZE, 5);
    this.terrain.fillStyle(0xa0c768, 0.26);
    this.terrain.fillCircle(x + 7, y + 11, 2);
    this.terrain.fillCircle(x + 25, y + 26, 2);
    this.terrain.fillCircle(x + 31, y + 16, 1.8);
  }

  private drawRiver(x: number, y: number, cellX: number, cellY: number): void {
    this.drawPlains(x, y, cellX, cellY);
    this.terrain.fillStyle(0x6ad2dc, 1);
    this.terrain.fillRoundedRect(x + 1, y + 2, TILE_SIZE - 2, TILE_SIZE - 4, 11);
    this.terrain.fillStyle(0xc2fbff, 0.35);
    this.terrain.fillRoundedRect(x + 8, y + 9, TILE_SIZE - 17, 4, 2);
    this.terrain.fillRoundedRect(x + 12, y + 23, TILE_SIZE - 21, 3, 2);
  }

  private drawMountain(x: number, y: number, cellX: number, cellY: number): void {
    this.drawPlains(x, y, cellX, cellY);
    this.terrain.fillStyle(0xd2bea7, 1);
    this.terrain.fillTriangle(x + 4, y + 34, x + 21, y + 5, x + 38, y + 34);
    this.terrain.fillStyle(0xb99f87, 1);
    this.terrain.fillTriangle(x + 11, y + 34, x + 21, y + 11, x + 30, y + 34);
    this.terrain.fillStyle(0xefdfcf, 0.9);
    this.terrain.fillTriangle(x + 18, y + 15, x + 21, y + 8, x + 24, y + 15);
    if ((cellX + cellY) % 3 === 0) {
      this.terrain.fillStyle(0xcfb49a, 0.85);
      this.terrain.fillCircle(x + 8, y + 31, 3);
      this.terrain.fillCircle(x + 31, y + 33, 2.5);
    }
  }

  private drawForest(x: number, y: number, cellX: number, cellY: number): void {
    this.drawPlains(x, y, cellX, cellY);
    this.terrain.fillStyle(0x70a75e, 1);
    this.terrain.fillCircle(x + 12, y + 18, 7);
    this.terrain.fillCircle(x + 24, y + 14, 8);
    this.terrain.fillCircle(x + 19, y + 24, 7);
    this.terrain.fillStyle(0x5e8244, 1);
    this.terrain.fillRect(x + 17, y + 24, 4, 9);
    if ((cellX + cellY) % 2 === 0) {
      this.terrain.fillStyle(0x89ba6d, 0.95);
      this.terrain.fillCircle(x + 30, y + 22, 5);
      this.terrain.fillStyle(0x5e8244, 1);
      this.terrain.fillRect(x + 29, y + 25, 3, 7);
    }
  }
}
