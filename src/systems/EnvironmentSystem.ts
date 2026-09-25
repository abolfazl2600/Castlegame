import Phaser from 'phaser';
import { TILE_SIZE, WORLD_COLS, WORLD_ROWS, WORLD_WIDTH, WORLD_HEIGHT } from '../core/constants';
import type { TerrainKind, ToolKind } from '../core/types';

export class EnvironmentSystem {
  private readonly ground: Phaser.GameObjects.Graphics;
  private readonly terrain: Phaser.GameObjects.Graphics;
  private readonly terrainMap: TerrainKind[][] = [];

  constructor(private readonly scene: Phaser.Scene) {
    this.ground = scene.add.graphics().setDepth(-30);
    this.terrain = scene.add.graphics().setDepth(-20);
    this.generateTerrain();
    this.draw();
  }

  getTerrainAt(x: number, y: number): TerrainKind {
    return this.terrainMap[y]?.[x] ?? 'plains';
  }

  canBuild(tool: ToolKind, x: number, y: number): boolean {
    if (tool === 'erase') return true;
    const terrain = this.getTerrainAt(x, y);
    if (terrain === 'river' || terrain === 'mountain') return false;
    if (terrain === 'forest') return tool === 'road';
    return true;
  }

  private generateTerrain(): void {
    for (let y = 0; y < WORLD_ROWS; y += 1) {
      const row: TerrainKind[] = [];
      for (let x = 0; x < WORLD_COLS; x += 1) row.push(this.computeTerrain(x, y));
      this.terrainMap.push(row);
    }
  }

  private computeTerrain(x: number, y: number): TerrainKind {
    const riverCenter = WORLD_COLS * 0.28 + Math.sin(y * 0.13) * 5 + Math.sin(y * 0.045) * 3;
    const riverWidth = 2.4 + Math.sin(y * 0.08) * 0.6;
    if (Math.abs(x - riverCenter) <= riverWidth) return 'river';

    const mountainNoise = Math.sin(x * 0.22) + Math.cos(y * 0.19) + Math.sin((x + y) * 0.1);
    if (x > WORLD_COLS * 0.65 && y < WORLD_ROWS * 0.36 && mountainNoise > 0.55) return 'mountain';

    const forestNoise =
      Math.sin(x * 0.31) +
      Math.cos(y * 0.27) +
      Math.sin((x * 0.18) + (y * 0.24)) * 0.8;
    const inForestBelt =
      (x > WORLD_COLS * 0.52 && y > WORLD_ROWS * 0.42) ||
      (x < WORLD_COLS * 0.2 && y > WORLD_ROWS * 0.55);
    if (inForestBelt && forestNoise > 0.75) return 'forest';

    return 'plains';
  }

  private draw(): void {
    this.ground.fillStyle(0x24412c, 1);
    this.ground.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    for (let y = 0; y < WORLD_ROWS; y += 1) {
      for (let x = 0; x < WORLD_COLS; x += 1) {
        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;
        const kind = this.getTerrainAt(x, y);

        if (kind === 'plains' || kind === 'forest') {
          this.terrain.fillStyle((x + y) % 2 === 0 ? 0x2e4b35 : 0x325239, 1);
          this.terrain.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        } else if (kind === 'river') {
          this.terrain.fillStyle(0x4f7f99, 1);
          this.terrain.fillRoundedRect(px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2, 9);
          this.terrain.fillStyle(0x77adc7, 0.45);
          this.terrain.fillRoundedRect(px + 4, py + 8, TILE_SIZE - 12, 5, 3);
          this.terrain.fillRoundedRect(px + 12, py + 22, TILE_SIZE - 18, 4, 3);
        } else {
          this.terrain.fillStyle(0x52606d, 1);
          this.terrain.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        }

        if (kind === 'mountain') {
          this.terrain.fillStyle(0x374151, 1);
          this.terrain.fillTriangle(px + 4, py + 33, px + 20, py + 3, px + 36, py + 33);
          this.terrain.fillStyle(0x64748b, 1);
          this.terrain.fillTriangle(px + 10, py + 33, px + 20, py + 7, px + 27, py + 33);
          this.terrain.fillStyle(0xe5e7eb, 0.88);
          this.terrain.fillTriangle(px + 17, py + 12, px + 20, py + 5, px + 23, py + 12);
        }

        if (kind === 'forest') {
          this.terrain.fillStyle(0x3f6a43, 0.95);
          this.terrain.fillCircle(px + 12, py + 18, 8);
          this.terrain.fillCircle(px + 24, py + 14, 9);
          this.terrain.fillCircle(px + 19, py + 24, 8);
          this.terrain.fillStyle(0x24412c, 0.75);
          this.terrain.fillRect(px + 17, py + 24, 4, 10);
        }
      }
    }
  }
}
