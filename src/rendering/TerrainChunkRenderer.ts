import * as THREE from 'three';
import type { TerrainKind } from '../core/types';
import type { WorldGridDimensions } from '../world/WorldGrid';

export interface TerrainChunkRenderContext {
  grid: WorldGridDimensions;
  terrainAt: (x: number, y: number) => TerrainKind;
  gridToWorld: (x: number, y: number) => { x: number; z: number };
  soilMaterial: THREE.Material;
  grassMaterial: THREE.Material;
  shoreMaterial: THREE.Material;
}

interface ChunkStats {
  chunks: number;
  instances: number;
}

/**
 * Chunked static world-surface renderer.
 *
 * Each chunk owns at most three InstancedMeshes (soil, grass, shore). Three.js can
 * frustum-cull each chunk independently, so a 50×89 world no longer submits one
 * giant terrain batch when only a small camera region is visible.
 */
export class TerrainChunkRenderer {
  readonly layer = new THREE.Group();

  private readonly soilGeometry: THREE.BoxGeometry;
  private readonly grassGeometry: THREE.BoxGeometry;
  private readonly shoreGeometry: THREE.BoxGeometry;
  private lastStats: ChunkStats = { chunks: 0, instances: 0 };

  constructor(private readonly tileSize: number) {
    this.layer.name = 'terrain-chunks';
    this.soilGeometry = new THREE.BoxGeometry(tileSize * 1.015, 1.55, tileSize * 1.015);
    this.grassGeometry = new THREE.BoxGeometry(tileSize, 0.16, tileSize);
    this.shoreGeometry = new THREE.BoxGeometry(tileSize, 0.12, tileSize);
  }

  stats(): ChunkStats {
    return { ...this.lastStats };
  }

  rebuild(context: TerrainChunkRenderContext): void {
    this.layer.clear();

    const { cols, rows, chunkSize } = context.grid;
    const matrix = new THREE.Matrix4();
    let chunks = 0;
    let instances = 0;

    for (let chunkY = 0; chunkY < rows; chunkY += chunkSize) {
      for (let chunkX = 0; chunkX < cols; chunkX += chunkSize) {
        const maxX = Math.min(cols, chunkX + chunkSize);
        const maxY = Math.min(rows, chunkY + chunkSize);
        const land: Array<{ x: number; y: number }> = [];
        const grass: Array<{ x: number; y: number }> = [];
        const shore: Array<{ x: number; y: number }> = [];

        for (let y = chunkY; y < maxY; y += 1) {
          for (let x = chunkX; x < maxX; x += 1) {
            const terrain = context.terrainAt(x, y);
            if (terrain === 'water' || terrain === 'river') continue;
            land.push({ x, y });
            if (terrain === 'shore') shore.push({ x, y });
            else grass.push({ x, y });
          }
        }

        if (land.length === 0) continue;
        chunks += 1;

        const addInstances = (
          name: string,
          points: Array<{ x: number; y: number }>,
          geometry: THREE.BufferGeometry,
          material: THREE.Material,
          y: number,
        ): void => {
          if (points.length === 0) return;
          const mesh = new THREE.InstancedMesh(geometry, material, points.length);
          mesh.name = name;
          mesh.userData.terrainChunk = { chunkX, chunkY, maxX, maxY };
          points.forEach((point, index) => {
            const world = context.gridToWorld(point.x, point.y);
            matrix.makeTranslation(world.x, y, world.z);
            mesh.setMatrixAt(index, matrix);
          });
          mesh.instanceMatrix.needsUpdate = true;
          mesh.receiveShadow = true;
          mesh.frustumCulled = true;
          mesh.computeBoundingSphere();
          this.layer.add(mesh);
          instances += points.length;
        };

        addInstances('terrain-chunk-soil', land, this.soilGeometry, context.soilMaterial, 1.31);
        addInstances('terrain-chunk-grass', grass, this.grassGeometry, context.grassMaterial, 2.125);
        addInstances('terrain-chunk-shore', shore, this.shoreGeometry, context.shoreMaterial, 2.105);
      }
    }

    this.lastStats = { chunks, instances };
  }

  dispose(): void {
    this.layer.clear();
    this.soilGeometry.dispose();
    this.grassGeometry.dispose();
    this.shoreGeometry.dispose();
  }
}
