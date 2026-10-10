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

interface ChunkEntry {
  meshes: THREE.InstancedMesh[];
  instances: number;
}

// Only terrain classes that affect this renderer's geometry are distinct.
// River and water have no land meshes; forest, mountain and plains share grass.
function surfaceClass(terrain: TerrainKind): number {
  if (terrain === 'water' || terrain === 'river') return 0;
  if (terrain === 'shore') return 2;
  return 1;
}

/**
 * Chunked static world-surface renderer.
 *
 * A full rebuild is required when grid dimensions or material owners change.
 * For local terrain edits, update() retains unaffected chunk meshes and their
 * already-uploaded GPU instance buffers. Shared geometries and materials are
 * never disposed while chunks are replaced.
 */
export class TerrainChunkRenderer {
  readonly layer = new THREE.Group();

  private readonly soilGeometry: THREE.BoxGeometry;
  private readonly grassGeometry: THREE.BoxGeometry;
  private readonly shoreGeometry: THREE.BoxGeometry;
  private lastStats: ChunkStats = { chunks: 0, instances: 0 };
  private grid: WorldGridDimensions | null = null;
  private materials: { soil: THREE.Material; grass: THREE.Material; shore: THREE.Material } | null = null;
  private surface = new Uint8Array(0);
  private readonly entries = new Map<number, ChunkEntry>();

  constructor(tileSize: number) {
    this.layer.name = 'terrain-chunks';
    this.soilGeometry = new THREE.BoxGeometry(tileSize * 1.015, 1.55, tileSize * 1.015);
    this.grassGeometry = new THREE.BoxGeometry(tileSize, 0.16, tileSize);
    this.shoreGeometry = new THREE.BoxGeometry(tileSize, 0.12, tileSize);
  }

  stats(): ChunkStats {
    return { ...this.lastStats };
  }

  private removeChunk(key: number): void {
    const old = this.entries.get(key);
    if (!old) return;
    for (const mesh of old.meshes) {
      this.layer.remove(mesh);
      mesh.dispose();
    }
    this.entries.delete(key);
    this.lastStats.chunks -= 1;
    this.lastStats.instances -= old.instances;
  }

  private clearChunks(): void {
    for (const key of this.entries.keys()) this.removeChunk(key);
    this.layer.clear();
    this.lastStats = { chunks: 0, instances: 0 };
  }

  private addChunk(context: TerrainChunkRenderContext, chunkX: number, chunkY: number): void {
    const { cols, rows, chunkSize } = context.grid;
    const maxX = Math.min(cols, chunkX + chunkSize);
    const maxY = Math.min(rows, chunkY + chunkSize);
    const land: Array<{ x: number; y: number }> = [];
    const grass: Array<{ x: number; y: number }> = [];
    const shore: Array<{ x: number; y: number }> = [];

    for (let y = chunkY; y < maxY; y += 1) {
      for (let x = chunkX; x < maxX; x += 1) {
        const kind = this.surface[y * cols + x];
        if (kind === 0) continue;
        const point = { x, y };
        land.push(point);
        if (kind === 2) shore.push(point);
        else grass.push(point);
      }
    }
    if (land.length === 0) return;

    const meshes: THREE.InstancedMesh[] = [];
    const matrix = new THREE.Matrix4();
    const addInstances = (
      name: string,
      points: Array<{ x: number; y: number }>,
      geometry: THREE.BufferGeometry,
      material: THREE.Material,
      elevation: number,
    ): void => {
      if (points.length === 0) return;
      const mesh = new THREE.InstancedMesh(geometry, material, points.length);
      mesh.name = name;
      mesh.userData.terrainChunk = { chunkX, chunkY, maxX, maxY };
      points.forEach((point, index) => {
        const world = context.gridToWorld(point.x, point.y);
        matrix.makeTranslation(world.x, elevation, world.z);
        mesh.setMatrixAt(index, matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = true;
      mesh.computeBoundingSphere();
      this.layer.add(mesh);
      meshes.push(mesh);
    };

    addInstances('terrain-chunk-soil', land, this.soilGeometry, context.soilMaterial, 1.31);
    addInstances('terrain-chunk-grass', grass, this.grassGeometry, context.grassMaterial, 2.125);
    addInstances('terrain-chunk-shore', shore, this.shoreGeometry, context.shoreMaterial, 2.105);

    const instances = land.length + grass.length + shore.length;
    this.entries.set(chunkY * cols + chunkX, { meshes, instances });
    this.lastStats.chunks += 1;
    this.lastStats.instances += instances;
  }

  /** Force a full rebuild, such as when switching grid dimensions. */
  rebuild(context: TerrainChunkRenderContext): void {
    this.clearChunks();
    const { cols, rows, chunkSize } = context.grid;
    this.grid = { cols, rows, chunkSize };
    this.materials = {
      soil: context.soilMaterial,
      grass: context.grassMaterial,
      shore: context.shoreMaterial,
    };
    this.surface = new Uint8Array(cols * rows);
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        this.surface[y * cols + x] = surfaceClass(context.terrainAt(x, y));
      }
    }
    for (let chunkY = 0; chunkY < rows; chunkY += chunkSize) {
      for (let chunkX = 0; chunkX < cols; chunkX += chunkSize) {
        this.addChunk(context, chunkX, chunkY);
      }
    }
  }

  /**
   * Synchronize terrain after edits. Only chunks whose rendered surface class
   * changed are rebuilt. Edits which keep the same geometry (e.g. river to
   * water or plains to forest) do not touch GPU buffers.
   */
  update(context: TerrainChunkRenderContext): void {
    const { cols, rows, chunkSize } = context.grid;
    if (
      !this.grid ||
      this.grid.cols !== cols ||
      this.grid.rows !== rows ||
      this.grid.chunkSize !== chunkSize ||
      this.materials?.soil !== context.soilMaterial ||
      this.materials?.grass !== context.grassMaterial ||
      this.materials?.shore !== context.shoreMaterial
    ) {
      this.rebuild(context);
      return;
    }

    const dirty = new Set<number>();
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        const index = y * cols + x;
        const next = surfaceClass(context.terrainAt(x, y));
        if (next === this.surface[index]) continue;
        this.surface[index] = next;
        const chunkX = Math.floor(x / chunkSize) * chunkSize;
        const chunkY = Math.floor(y / chunkSize) * chunkSize;
        dirty.add(chunkY * cols + chunkX);
      }
    }

    for (const key of dirty) {
      const chunkX = key % cols;
      const chunkY = Math.floor(key / cols);
      this.removeChunk(key);
      this.addChunk(context, chunkX, chunkY);
    }
    // Preserve the original deterministic chunk and soil/grass/shore ordering.
    if (dirty.size > 0) {
      const rank = (name: string): number =>
        name === 'terrain-chunk-soil' ? 0 : name === 'terrain-chunk-grass' ? 1 : 2;
      this.layer.children.sort((left, right) => {
        const a = left.userData.terrainChunk;
        const b = right.userData.terrainChunk;
        return a.chunkY - b.chunkY || a.chunkX - b.chunkX || rank(left.name) - rank(right.name);
      });
    }
  }

  dispose(): void {
    this.clearChunks();
    this.grid = null;
    this.materials = null;
    this.surface = new Uint8Array(0);
    this.soilGeometry.dispose();
    this.grassGeometry.dispose();
    this.shoreGeometry.dispose();
  }
}
