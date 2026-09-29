import type {
  GridCell,
  StoneStyle,
  TowerShape,
  TowerTop,
  WallDirection,
  WallKind,
} from '../core/types';

export type CastleBlockKind = 'wall' | 'gate' | 'tower';
export type CastleTopology = 'isolated' | 'end' | 'straight' | 'corner' | 't-junction' | '4-way' | 'multi-junction';

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
  topology: CastleTopology;
  /** Clockwise angle from north to the first connected arm, in degrees. */
  orientation: number;
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
const DIRECTIONS: WallDirection[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

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

function topologyFor(links: WallDirection[]): CastleTopology {
  if (links.length === 0) return 'isolated';
  if (links.length === 1) return 'end';
  if (links.length === 2) {
    return (DIRECTIONS.indexOf(links[0]) + 4) % 8 === DIRECTIONS.indexOf(links[1])
      ? 'straight' : 'corner';
  }
  if (links.length === 3) return 't-junction';
  if (links.length === 4) return '4-way';
  return 'multi-junction';
}

function normalizedLinks(
  cell: { x: number; y: number; wallLinks?: WallDirection[] },
  byCell: Map<string, { x: number; y: number; kind: string; wallLinks?: WallDirection[] }>,
): WallDirection[] {
  return DIRECTIONS.filter((direction) => {
    if (!cell.wallLinks?.length && direction.length > 1) return false;
    const vector = connectionVector(direction);
    const neighbor = byCell.get(key(cell.x + vector.x, cell.y + vector.y));
    if (!neighbor || !CASTLE_KINDS.has(neighbor.kind)) return false;
    const opposite = DIRECTIONS[(DIRECTIONS.indexOf(direction) + 4) % 8];
    // Legacy cells infer connections; explicit links must agree at both ends.
    return (!cell.wallLinks?.length || cell.wallLinks.includes(direction)) &&
      (!neighbor.wallLinks?.length || neighbor.wallLinks.includes(opposite));
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
        topology: topologyFor(links),
        orientation: links.length ? DIRECTIONS.indexOf(links[0]) * 45 : 0,
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
