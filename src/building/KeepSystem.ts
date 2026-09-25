import type { KeepRoofStyle, KeepState, TerrainKind } from '../core/types';

export interface KeepDraft {
  x: number;
  y: number;
  width: number;
  depth: number;
  floors: number;
  rotation: number;
  cornerTowers: boolean;
  roof: KeepRoofStyle;
  battlements: boolean;
}

export interface KeepValidation {
  valid: boolean;
  reason?: string;
  minElevation: number;
  maxElevation: number;
}

export class KeepSystem {
  private readonly keeps = new Map<number, KeepState>();
  private nextId = 1;

  entries(): KeepState[] {
    return Array.from(this.keeps.values()).map((keep) => ({ ...keep }));
  }

  clear(): void {
    this.keeps.clear();
    this.nextId = 1;
  }

  replace(keeps: KeepState[]): void {
    this.clear();

    for (const keep of keeps) {
      const normalized: KeepState = {
        ...keep,
        width: Math.max(2, Math.floor(keep.width)),
        depth: Math.max(2, Math.floor(keep.depth)),
        floors: Math.max(1, Math.floor(keep.floors)),
        rotation: ((Math.floor(keep.rotation) % 4) + 4) % 4,
      };
      this.keeps.set(normalized.id, normalized);
      this.nextId = Math.max(this.nextId, normalized.id + 1);
    }
  }

  add(draft: KeepDraft): KeepState {
    const id = this.nextId++;
    const seed = Math.abs(
      Math.imul(draft.x + 31, 73856093) ^
      Math.imul(draft.y + 17, 19349663) ^
      Math.imul(id + 7, 83492791),
    );

    const keep: KeepState = {
      id,
      seed,
      ...draft,
      width: Math.max(2, Math.floor(draft.width)),
      depth: Math.max(2, Math.floor(draft.depth)),
      floors: Math.max(1, Math.floor(draft.floors)),
      rotation: ((Math.floor(draft.rotation) % 4) + 4) % 4,
    };

    this.keeps.set(id, keep);
    return { ...keep };
  }

  update(id: number, changes: Partial<Omit<KeepState, 'id' | 'seed'>>): KeepState | null {
    const current = this.keeps.get(id);
    if (!current) return null;

    const next: KeepState = {
      ...current,
      ...changes,
    };

    next.width = Math.max(2, Math.floor(next.width));
    next.depth = Math.max(2, Math.floor(next.depth));
    next.floors = Math.max(1, Math.floor(next.floors));
    next.rotation = ((Math.floor(next.rotation) % 4) + 4) % 4;

    this.keeps.set(id, next);
    return { ...next };
  }

  remove(id: number): void {
    this.keeps.delete(id);
  }

  get(id: number): KeepState | undefined {
    const keep = this.keeps.get(id);
    return keep ? { ...keep } : undefined;
  }

  footprint(keep: KeepState | KeepDraft): Array<{ x: number; y: number }> {
    const rotated = keep.rotation % 2 !== 0;
    const width = rotated ? keep.depth : keep.width;
    const depth = rotated ? keep.width : keep.depth;
    const halfW = Math.floor(width / 2);
    const halfD = Math.floor(depth / 2);
    const startX = keep.x - halfW;
    const startY = keep.y - halfD;
    const result: Array<{ x: number; y: number }> = [];

    for (let oy = 0; oy < depth; oy += 1) {
      for (let ox = 0; ox < width; ox += 1) {
        result.push({ x: startX + ox, y: startY + oy });
      }
    }

    return result;
  }

  findAtCell(x: number, y: number): KeepState | undefined {
    for (const keep of this.keeps.values()) {
      if (this.footprint(keep).some((cell) => cell.x === x && cell.y === y)) {
        return { ...keep };
      }
    }

    return undefined;
  }

  validate(
    draft: KeepState | KeepDraft,
    size: number,
    terrainAt: (x: number, y: number) => TerrainKind,
    elevationAt: (x: number, y: number) => number,
    isOccupied: (x: number, y: number) => boolean,
    ignoreKeepId?: number,
  ): KeepValidation {
    let minElevation = Number.POSITIVE_INFINITY;
    let maxElevation = Number.NEGATIVE_INFINITY;

    for (const cell of this.footprint(draft)) {
      if (cell.x < 0 || cell.y < 0 || cell.x >= size || cell.y >= size) {
        return { valid: false, reason: 'Keep foundation extends outside the buildable world.', minElevation: 0, maxElevation: 0 };
      }

      const terrain = terrainAt(cell.x, cell.y);
      if (terrain === 'water' || terrain === 'river') {
        return { valid: false, reason: 'Keep foundation cannot be placed in water.', minElevation: 0, maxElevation: 0 };
      }

      const otherKeep = this.findAtCell(cell.x, cell.y);
      if (otherKeep && otherKeep.id !== ignoreKeepId) {
        return { valid: false, reason: 'Keep foundation overlaps another Keep.', minElevation: 0, maxElevation: 0 };
      }

      if (isOccupied(cell.x, cell.y)) {
        return { valid: false, reason: 'Keep foundation overlaps another structure.', minElevation: 0, maxElevation: 0 };
      }

      const elevation = elevationAt(cell.x, cell.y);
      minElevation = Math.min(minElevation, elevation);
      maxElevation = Math.max(maxElevation, elevation);
    }

    if (!Number.isFinite(minElevation) || !Number.isFinite(maxElevation)) {
      minElevation = 0;
      maxElevation = 0;
    }

    if (maxElevation - minElevation > 2.8) {
      return {
        valid: false,
        reason: 'Terrain is too steep for a believable Keep foundation.',
        minElevation,
        maxElevation,
      };
    }

    return { valid: true, minElevation, maxElevation };
  }
}
