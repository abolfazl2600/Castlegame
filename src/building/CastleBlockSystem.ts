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
export type CastleDamageStage = 'intact' | 'cracked' | 'heavy' | 'partial-breach' | 'collapsed';

export function castleDamageStage(damage: number): CastleDamageStage {
  if (damage >= 1) return 'collapsed';
  if (damage >= 0.86) return 'partial-breach';
  if (damage >= 0.62) return 'heavy';
  if (damage >= 0.3) return 'cracked';
  return 'intact';
}

export interface CastleTraversalMetadata {
  walkableTop: boolean;
  blocksGround: boolean;
  isCrossing: boolean;
  passable: boolean;
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
  /** Local structural top, independent of terrain elevation. */
  topLocal: number;
  /** World-space structural top, with terrain elevation added exactly once. */
  topWorld: number;
  stack: CastleLevelState[];
  neighborTopDelta: Partial<Record<WallDirection, number>>;
  damage: number;
  damageStage: CastleDamageStage;
  rubble: boolean;
  links: WallDirection[];
  topology: CastleTopology;
  /** Clockwise angle from north to the first connected arm, in degrees. */
  orientation: number;
  corner: boolean;
  stoneStyle: StoneStyle;
  traversal: CastleTraversalMetadata;
  towerShape?: TowerShape;
  towerTop?: TowerTop;
  attachment?: 'standalone' | 'wall-line' | 'corner' | 'junction';
}

export interface CastleLevelState {
  index: number;
  baseLocal: number;
  topLocal: number;
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
/** Walls may be upgraded once beyond their base level; towers keep their existing multi-level progression. */
export const MAX_WALL_LEVEL = 12;
const DIRECTIONS: WallDirection[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const BODY_BASE = 2.58;
const WALL_RISE = 2.15;

export function castleHeightFor(cell: GridCell): { topLocal: number; stack: CastleLevelState[] } {
  const rawLevel = Number.isFinite(cell.level) ? Math.max(1, Math.floor(cell.level!)) : 1;
  const level = cell.kind === 'gate' || cell.kind === 'tower' ? Math.min(4, rawLevel) : Math.min(MAX_WALL_LEVEL, rawLevel);
  const base = cell.kind === 'wall1' ? 5.2 : cell.kind === 'wall2' ? 4.7 :
    cell.kind === 'wall3' ? 5.8 : cell.kind === 'tower' ?
      ((cell.towerShape ?? 'round') === 'watch' ? 6.4 : 7.4) : 5.27;
  const rise = cell.kind === 'gate' ? 0.55 : WALL_RISE;
  const stack = Array.from({ length: level }, (_, index) => ({
    index: index + 1,
    baseLocal: BODY_BASE + (index === 0 ? 0 : base + (index - 1) * rise),
    topLocal: BODY_BASE + base + index * rise,
  }));
  return { topLocal: cell.kind === 'gate' ? 7.85 + (level - 1) * rise : stack[level - 1].topLocal, stack };
}

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
  cell: { x: number; y: number; wallLinks?: WallDirection[]; damage?: number },
  byCell: Map<string, { x: number; y: number; kind: string; wallLinks?: WallDirection[]; damage?: number }>,
): WallDirection[] {
  if ((cell.damage ?? 0) >= 1) return [];
  return DIRECTIONS.filter((direction) => {
    const vector = connectionVector(direction);
    const neighbor = byCell.get(key(cell.x + vector.x, cell.y + vector.y));
    if (!neighbor || !CASTLE_KINDS.has(neighbor.kind)) return false;
    if ((neighbor.damage ?? 0) >= 1) return false;
    // Touching cardinal blocks join automatically, including newly replaced gates/towers.
    // Diagonal joins require reciprocal explicit links: corner-touch alone is not a wall.
    if (direction.length === 1) return true;
    const opposite = DIRECTIONS[(DIRECTIONS.indexOf(direction) + 4) % 8];
    return Boolean(cell.wallLinks?.includes(direction) && neighbor.wallLinks?.includes(opposite));
  });
}

export class CastleBlockSystem {
  build(
    cells: Array<{ x: number; y: number } & GridCell>,
    stoneStyle: StoneStyle,
    terrainElevationAt: (x: number, y: number) => number = () => 0,
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
      const sourceKind = cell.kind as WallKind | 'gate' | 'tower';
      const kind: CastleBlockKind =
        sourceKind === 'gate' ? 'gate' : sourceKind === 'tower' ? 'tower' : 'wall';
      const heightState = castleHeightFor(cell);
      const level = heightState.stack.length;
      const damage = Math.max(0, Math.min(1, Number(cell.damage ?? 0)));
      const damageStage = castleDamageStage(damage);
      const collapsed = damageStage === 'collapsed';
      const topWorld = heightState.topLocal + terrainElevationAt(cell.x, cell.y);
      const neighborTopDelta: Partial<Record<WallDirection, number>> = {};
      for (const direction of links) {
        const vector = connectionVector(direction);
        const neighbor = byCell.get(key(cell.x + vector.x, cell.y + vector.y));
        if (neighbor) neighborTopDelta[direction] =
          castleHeightFor(neighbor).topLocal + terrainElevationAt(neighbor.x, neighbor.y) - topWorld;
      }

      return {
        id: stableBlockId(cell.x, cell.y),
        structureId: structureIdByCell.get(key(cell.x, cell.y)) ?? `castle-structure:${cell.x}:${cell.y}`,
        x: cell.x,
        y: cell.y,
        kind,
        sourceKind,
        level,
        height: level,
        topLocal: heightState.topLocal,
        topWorld,
        stack: heightState.stack,
        neighborTopDelta,
        damage,
        damageStage,
        rubble: collapsed,
        links,
        topology: topologyFor(links),
        orientation: links.length ? DIRECTIONS.indexOf(links[0]) * 45 : 0,
        corner: kind === 'wall' && isCorner(links),
        stoneStyle,
        traversal: {
          walkableTop: !collapsed && damageStage !== 'partial-breach' && (kind !== 'gate' ? Boolean(cell.walkway) : true),
          blocksGround: !collapsed && (kind !== 'gate' || cell.gateOpen === false),
          isCrossing: kind === 'gate' || (collapsed && kind === 'wall'),
          passable: collapsed && kind === 'wall' || kind === 'gate' && (collapsed || cell.gateOpen !== false),
        },
        towerShape: kind === 'tower' ? cell.towerShape : undefined,
        towerTop: kind === 'tower' ? cell.towerTop : undefined,
        attachment: kind === 'tower' ?
          (links.length === 0 ? 'standalone' : topologyFor(links) === 'straight' ? 'wall-line' :
            topologyFor(links) === 'corner' ? 'corner' : links.length === 1 ? 'wall-line' : 'junction') : undefined,
      };
    });

    return { blocks, structures };
  }

  isCastleCell(cell: GridCell | undefined): boolean {
    return Boolean(cell && CASTLE_KINDS.has(cell.kind));
  }
}
