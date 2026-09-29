import type {
  GridCell,
  StoneStyle,
  TowerShape,
  TowerTop,
  WallDirection,
  WallKind,
} from '../core/types';

export type CastleBlockKind = 'wall' | 'gate' | 'tower';

export interface CastleTraversalMetadata {
  walkableTop: boolean;
  blocksGround: boolean;
  isCrossing: boolean;
}

export interface CastleBlockState {
  id: string;
  structureId: string;
  x: number;
  y: number;
  kind: CastleBlockKind;
  sourceKind: WallKind | 'gate' | 'tower';
  level: number;
  height: number;
  damage: number;
  links: WallDirection[];
  corner: boolean;
  stoneStyle: StoneStyle;
  traversal: CastleTraversalMetadata;
  towerShape?: TowerShape;
  towerTop?: TowerTop;
}

export interface CastleStructureState {
  id: string;
  blockIds: string[];
}

export interface CastleBlockSnapshot {
  blocks: CastleBlockState[];
  structures: CastleStructureState[];
}

const CASTLE_KINDS = new Set<string>(['wall1', 'wall2', 'wall3', 'gate', 'tower']);

function key(x: number, y: number): string {
  return `${x},${y}`;
}

function stableBlockId(x: number, y: number): string {
  return `castle-block:${x}:${y}`;
}

function connectionVector(direction: WallDirection): { x: number; y: number } {
  switch (direction) {
    case 'N': return { x: 0, y: -1 };
    case 'NE': return { x: 1, y: -1 };
    case 'E': return { x: 1, y: 0 };
    case 'SE': return { x: 1, y: 1 };
    case 'S': return { x: 0, y: 1 };
    case 'SW': return { x: -1, y: 1 };
    case 'W': return { x: -1, y: 0 };
    case 'NW': return { x: -1, y: -1 };
  }
}

function isCorner(links: WallDirection[]): boolean {
  if (links.length < 2) return false;
  const cardinal = new Set(['N', 'E', 'S', 'W']);
  const cardinalLinks = links.filter((item) => cardinal.has(item));
  if (cardinalLinks.length < 2) return links.length > 2;
  const oppositePairs = new Set(['N:S', 'S:N', 'E:W', 'W:E']);
  return cardinalLinks.some((a) => cardinalLinks.some((b) => a !== b && !oppositePairs.has(`${a}:${b}`)));
}

function normalizedLinks(
  cell: { x: number; y: number; wallLinks?: WallDirection[] },
  byCell: Map<string, { x: number; y: number; kind: string }>,
): WallDirection[] {
  if (cell.wallLinks && cell.wallLinks.length > 0) return [...cell.wallLinks];
  const directions: WallDirection[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return directions.filter((direction) => {
    const vector = connectionVector(direction);
    const neighbor = byCell.get(key(cell.x + vector.x, cell.y + vector.y));
    return Boolean(neighbor && CASTLE_KINDS.has(neighbor.kind));
  });
}

export class CastleBlockSystem {
  build(
    cells: Array<{ x: number; y: number } & GridCell>,
    stoneStyle: StoneStyle,
  ): CastleBlockSnapshot {
    const castleCells = cells.filter((cell) => CASTLE_KINDS.has(cell.kind));
    const byCell = new Map(castleCells.map((cell) => [key(cell.x, cell.y), cell]));
    const structureIdByCell = new Map<string, string>();
    const structures: CastleStructureState[] = [];
    const visited = new Set<string>();

    const ordered = [...castleCells].sort((a, b) => a.y - b.y || a.x - b.x);

    for (const start of ordered) {
      const startKey = key(start.x, start.y);
      if (visited.has(startKey)) continue;
      const structureId = `castle-structure:${start.x}:${start.y}`;
      const queue = [start];
      const blockIds: string[] = [];
      visited.add(startKey);

      while (queue.length > 0) {
        const current = queue.shift()!;
        const currentKey = key(current.x, current.y);
        structureIdByCell.set(currentKey, structureId);
        blockIds.push(stableBlockId(current.x, current.y));

        const links = normalizedLinks(current, byCell);
        for (const direction of links) {
          const vector = connectionVector(direction);
          const neighbor = byCell.get(key(current.x + vector.x, current.y + vector.y));
          if (!neighbor) continue;
          const neighborKey = key(neighbor.x, neighbor.y);
          if (visited.has(neighborKey)) continue;
          visited.add(neighborKey);
          queue.push(neighbor);
        }
      }

      structures.push({ id: structureId, blockIds: blockIds.sort() });
    }

    const blocks: CastleBlockState[] = ordered.map((cell) => {
      const links = normalizedLinks(cell, byCell);
      const level = Math.max(1, Math.floor(cell.level ?? 1));
      const sourceKind = cell.kind as WallKind | 'gate' | 'tower';
      const kind: CastleBlockKind =
        sourceKind === 'gate' ? 'gate' : sourceKind === 'tower' ? 'tower' : 'wall';

      return {
        id: stableBlockId(cell.x, cell.y),
        structureId: structureIdByCell.get(key(cell.x, cell.y)) ?? `castle-structure:${cell.x}:${cell.y}`,
        x: cell.x,
        y: cell.y,
        kind,
        sourceKind,
        level,
        height: level,
        damage: Math.max(0, Math.min(1, Number(cell.damage ?? 0))),
        links,
        corner: kind === 'wall' && isCorner(links),
        stoneStyle,
        traversal: {
          walkableTop: kind !== 'gate' ? Boolean(cell.walkway) : true,
          blocksGround: kind !== 'gate',
          isCrossing: kind === 'gate',
        },
        towerShape: kind === 'tower' ? cell.towerShape : undefined,
        towerTop: kind === 'tower' ? cell.towerTop : undefined,
      };
    });

    return { blocks, structures };
  }

  isCastleCell(cell: GridCell | undefined): boolean {
    return Boolean(cell && CASTLE_KINDS.has(cell.kind));
  }
}
