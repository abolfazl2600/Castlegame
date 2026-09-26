import type { GridCell, KeepState, TerrainKind, TileKind, TowerBridgeState } from '../core/types';
import { ConnectedWallNetwork } from '../building/ConnectedWallNetwork';

export interface NavPoint {
  x: number;
  y: number;
}

export interface WallNavNode extends NavPoint {
  worldY: number;
  kind: TileKind;
}

export interface BattleNavigationContext {
  size: number;
  terrainAt: (x: number, y: number) => TerrainKind;
  elevationAt: (x: number, y: number) => number;
  kindAt: (x: number, y: number) => TileKind | undefined;
  cellAt: (x: number, y: number) => GridCell | undefined;
  fortificationTopAt: (x: number, y: number, cell: GridCell) => number;
  keeps: () => KeepState[];
  towerBridges?: () => TowerBridgeState[];
  temporaryGroundPassable?: (x: number, y: number) => boolean;
  gatePassable?: (x: number, y: number) => boolean;
}

interface SearchNode extends NavPoint {
  g: number;
  f: number;
  parent?: string;
}

const DIRS: NavPoint[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
  { x: 1, y: 1 },
  { x: -1, y: 1 },
  { x: 1, y: -1 },
  { x: -1, y: -1 },
];

export class BattleNavigation {
  private readonly pathCache = new Map<string, NavPoint[]>();
  private readonly defensiveNetwork: ConnectedWallNetwork;

  constructor(private readonly context: BattleNavigationContext) {
    this.defensiveNetwork = new ConnectedWallNetwork({
      size: context.size,
      cellAt: context.cellAt,
      elevationAt: context.elevationAt,
      fortificationTopAt: context.fortificationTopAt,
    });
  }

  invalidate(): void {
    this.pathCache.clear();
  }

  isGroundWalkable(x: number, y: number): boolean {
    const { size } = this.context;
    if (x < 0 || y < 0 || x >= size || y >= size) return false;

    const terrain = this.context.terrainAt(x, y);
    if (terrain === 'water' || terrain === 'river' || terrain === 'mountain') return false;

    const kind = this.context.kindAt(x, y);
    if (kind === 'gate' && this.context.gatePassable && !this.context.gatePassable(x, y)) {
      return false;
    }

    if (this.context.temporaryGroundPassable?.(x, y)) return true;

    for (const keep of this.context.keeps()) {
      const rotated = keep.rotation % 2 !== 0;
      const width = rotated ? keep.depth : keep.width;
      const depth = rotated ? keep.width : keep.depth;
      const startX = keep.x - Math.floor(width / 2);
      const startY = keep.y - Math.floor(depth / 2);
      if (
        x >= startX &&
        y >= startY &&
        x < startX + width &&
        y < startY + depth
      ) {
        return false;
      }
    }

    if (!kind) return true;

    if (
      kind === 'road' ||
      kind === 'dirtRoad' ||
      kind === 'stoneRoad' ||
      kind === 'farm' ||
      kind === 'gate' ||
      kind === 'stoneStairs' ||
      kind === 'woodenStairs' ||
      kind === 'ramp' ||
      kind === 'ladder'
    ) {
      return true;
    }

    return false;
  }

  findPath(start: NavPoint, goal: NavPoint, allowNearest = true): NavPoint[] {
    const cacheKey = `${start.x},${start.y}->${goal.x},${goal.y}:${allowNearest ? 1 : 0}`;
    const cached = this.pathCache.get(cacheKey);
    if (cached) return cached.map((point) => ({ ...point }));

    const open = new Map<string, SearchNode>();
    const closed = new Set<string>();
    const nodes = new Map<string, SearchNode>();
    const startKey = this.key(start.x, start.y);
    const first: SearchNode = {
      ...start,
      g: 0,
      f: this.heuristic(start, goal),
    };

    open.set(startKey, first);
    nodes.set(startKey, first);

    let bestKey = startKey;
    let bestDistance = this.heuristic(start, goal);
    let iterations = 0;

    while (open.size > 0 && iterations < this.context.size * this.context.size * 6) {
      iterations += 1;

      let currentKey = '';
      let current: SearchNode | null = null;
      for (const [key, candidate] of open) {
        if (!current || candidate.f < current.f) {
          current = candidate;
          currentKey = key;
        }
      }

      if (!current) break;
      open.delete(currentKey);
      closed.add(currentKey);

      const distanceToGoal = this.heuristic(current, goal);
      if (distanceToGoal < bestDistance) {
        bestDistance = distanceToGoal;
        bestKey = currentKey;
      }

      if (current.x === goal.x && current.y === goal.y) {
        bestKey = currentKey;
        break;
      }

      for (const dir of DIRS) {
        const nx = current.x + dir.x;
        const ny = current.y + dir.y;
        const key = this.key(nx, ny);
        if (closed.has(key)) continue;

        const isGoal = nx === goal.x && ny === goal.y;
        if (!isGoal && !this.isGroundWalkable(nx, ny)) continue;
        if (isGoal && !this.isGroundWalkable(nx, ny)) continue;

        if (dir.x !== 0 && dir.y !== 0) {
          if (
            !this.isGroundWalkable(current.x + dir.x, current.y) ||
            !this.isGroundWalkable(current.x, current.y + dir.y)
          ) {
            continue;
          }
        }

        const stepCost = dir.x !== 0 && dir.y !== 0 ? 1.414 : 1;
        const elevationCost =
          Math.abs(
            this.context.elevationAt(nx, ny) -
            this.context.elevationAt(current.x, current.y),
          ) * 0.45;
        const g = current.g + stepCost + elevationCost;
        const previous = nodes.get(key);

        if (previous && g >= previous.g) continue;

        const next: SearchNode = {
          x: nx,
          y: ny,
          g,
          f: g + this.heuristic({ x: nx, y: ny }, goal),
          parent: currentKey,
        };

        nodes.set(key, next);
        open.set(key, next);
      }
    }

    if (!allowNearest && bestDistance > 0.01) return [];

    const path = this.reconstruct(nodes, bestKey);
    this.pathCache.set(cacheKey, path);
    return path.map((point) => ({ ...point }));
  }

  findNearestWalkable(goal: NavPoint, maxRadius = 8): NavPoint | null {
    if (this.isGroundWalkable(goal.x, goal.y)) return { ...goal };

    for (let radius = 1; radius <= maxRadius; radius += 1) {
      for (let dy = -radius; dy <= radius; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
          const x = goal.x + dx;
          const y = goal.y + dy;
          if (this.isGroundWalkable(x, y)) return { x, y };
        }
      }
    }

    return null;
  }

  castleObjective(): NavPoint {
    const keep = this.context.keeps()[0];
    if (keep) return { x: keep.x, y: keep.y };

    const candidates: NavPoint[] = [];
    for (let y = 0; y < this.context.size; y += 1) {
      for (let x = 0; x < this.context.size; x += 1) {
        const kind = this.context.kindAt(x, y);
        if (
          kind === 'wall1' ||
          kind === 'wall2' ||
          kind === 'wall3' ||
          kind === 'gate' ||
          kind === 'tower' ||
          kind === 'house' ||
          kind === 'manor' ||
          kind === 'villa'
        ) {
          candidates.push({ x, y });
        }
      }
    }

    if (candidates.length === 0) {
      const center = Math.floor(this.context.size / 2);
      return { x: center, y: center };
    }

    const sum = candidates.reduce(
      (acc, item) => ({ x: acc.x + item.x, y: acc.y + item.y }),
      { x: 0, y: 0 },
    );

    return {
      x: Math.round(sum.x / candidates.length),
      y: Math.round(sum.y / candidates.length),
    };
  }

  bestAttackerEntry(objective: NavPoint): NavPoint {
    const gates: NavPoint[] = [];
    for (let y = 0; y < this.context.size; y += 1) {
      for (let x = 0; x < this.context.size; x += 1) {
        if (this.context.kindAt(x, y) === 'gate') gates.push({ x, y });
      }
    }

    if (gates.length > 0) {
      gates.sort(
        (a, b) =>
          this.heuristic(a, objective) - this.heuristic(b, objective),
      );
      const gate = gates[0];
      return this.findNearestWalkable(gate, 2) ?? gate;
    }

    return this.findNearestWalkable(objective, 10) ?? objective;
  }

  attackerSpawnCells(objective: NavPoint, count: number): NavPoint[] {
    const edgeCandidates: NavPoint[] = [];
    const size = this.context.size;

    for (let x = 1; x < size - 1; x += 1) {
      edgeCandidates.push({ x, y: 1 }, { x, y: size - 2 });
    }
    for (let y = 2; y < size - 2; y += 1) {
      edgeCandidates.push({ x: 1, y }, { x: size - 2, y });
    }

    const walkable = edgeCandidates
      .filter((point) => this.isGroundWalkable(point.x, point.y))
      .sort(
        (a, b) =>
          this.heuristic(b, objective) - this.heuristic(a, objective),
      );

    if (walkable.length === 0) {
      const fallback = this.findNearestWalkable({ x: 1, y: size - 2 }, size);
      return fallback ? Array.from({ length: count }, () => ({ ...fallback })) : [];
    }

    const anchor = walkable[0];
    const nearby = walkable
      .filter((point) => this.heuristic(point, anchor) <= 7)
      .sort((a, b) => {
        const da = this.heuristic(a, anchor);
        const db = this.heuristic(b, anchor);
        return da - db || a.y - b.y || a.x - b.x;
      });

    const result: NavPoint[] = [];
    for (let i = 0; i < count; i += 1) {
      result.push({ ...(nearby[i % nearby.length] ?? anchor) });
    }
    return result;
  }

  gateGuardCells(): NavPoint[] {
    const result: NavPoint[] = [];

    for (let y = 0; y < this.context.size; y += 1) {
      for (let x = 0; x < this.context.size; x += 1) {
        if (this.context.kindAt(x, y) !== 'gate') continue;

        const candidates: NavPoint[] = [
          { x: x - 1, y },
          { x: x + 1, y },
          { x, y: y - 1 },
          { x, y: y + 1 },
        ].filter((point) => this.isGroundWalkable(point.x, point.y));

        for (const candidate of candidates.slice(0, 2)) {
          if (!result.some((item) => item.x === candidate.x && item.y === candidate.y)) {
            result.push(candidate);
          }
        }
      }
    }

    return result;
  }

  defenderGroundCells(objective: NavPoint, count: number): NavPoint[] {
    const candidates: Array<NavPoint & { score: number }> = [];

    for (let y = 0; y < this.context.size; y += 1) {
      for (let x = 0; x < this.context.size; x += 1) {
        if (!this.isGroundWalkable(x, y)) continue;
        const distance = this.heuristic({ x, y }, objective);
        if (distance > 7) continue;

        const kind = this.context.kindAt(x, y);
        const score =
          10 - distance +
          (kind === 'road' ? 1.8 : 0) -
          Math.abs(this.context.elevationAt(x, y)) * 0.15;
        candidates.push({ x, y, score });
      }
    }

    candidates.sort((a, b) => b.score - a.score);
    return Array.from({ length: count }, (_, index) => {
      const cell = candidates[index % Math.max(1, candidates.length)];
      return cell ? { x: cell.x, y: cell.y } : { ...objective };
    });
  }

  wallPlatformNodes(): WallNavNode[] {
    return this.defensiveNetwork.nodes().map((node) => ({
      x: node.x,
      y: node.y,
      kind: node.kind,
      worldY: node.worldY + 0.28,
    }));
  }

  connectedWallNeighbors(node: WallNavNode, nodes: Map<string, WallNavNode>): WallNavNode[] {
    const result: WallNavNode[] = [];

    for (const neighbor of this.defensiveNetwork.neighbors(node)) {
      const mapped = nodes.get(this.key(neighbor.x, neighbor.y));
      if (!mapped) continue;
      if (!result.some((candidate) => candidate.x === mapped.x && candidate.y === mapped.y)) {
        result.push(mapped);
      }
    }

    // Explicit tower bridges remain valid long-range defensive links.
    for (const bridge of this.context.towerBridges?.() ?? []) {
      const isA = bridge.ax === node.x && bridge.ay === node.y;
      const isB = bridge.bx === node.x && bridge.by === node.y;
      if (!isA && !isB) continue;

      const other = nodes.get(
        this.key(
          isA ? bridge.bx : bridge.ax,
          isA ? bridge.by : bridge.ay,
        ),
      );
      if (!other) continue;
      if (Math.abs(other.worldY - node.worldY) > 3.4) continue;
      if (!result.some((candidate) => candidate.x === other.x && candidate.y === other.y)) {
        result.push(other);
      }
    }

    return result;
  }

  stairTowerAccessNodes(): Array<{ top: WallNavNode; ground: NavPoint }> {
    const nodes = this.wallPlatformNodes();
    const result: Array<{ top: WallNavNode; ground: NavPoint }> = [];

    for (const node of nodes) {
      if (
        node.kind !== 'stairTower' &&
        node.kind !== 'tower' &&
        node.kind !== 'gate' &&
        !this.hasDedicatedWallAccess(node)
      ) {
        continue;
      }

      const groundCandidates = [
        { x: node.x + 1, y: node.y },
        { x: node.x - 1, y: node.y },
        { x: node.x, y: node.y + 1 },
        { x: node.x, y: node.y - 1 },
      ]
        .filter((point) => this.isGroundWalkable(point.x, point.y))
        .sort(
          (a, b) =>
            this.heuristic(a, this.castleObjective()) -
            this.heuristic(b, this.castleObjective()),
        );

      const ground = groundCandidates[0];
      if (ground) result.push({ top: node, ground });
    }

    return result;
  }

  private hasDedicatedWallAccess(node: WallNavNode): boolean {
    if (
      node.kind !== 'wall1' &&
      node.kind !== 'wall2' &&
      node.kind !== 'wall3'
    ) {
      return false;
    }

    const candidates = [
      { x: node.x + 1, y: node.y },
      { x: node.x - 1, y: node.y },
      { x: node.x, y: node.y + 1 },
      { x: node.x, y: node.y - 1 },
    ];

    return candidates.some((point) => {
      const cell = this.context.cellAt(point.x, point.y);
      if (!cell) return false;
      return (
        cell.kind === 'stoneStairs' ||
        cell.kind === 'woodenStairs' ||
        cell.kind === 'ramp' ||
        cell.kind === 'ladder'
      );
    });
  }

  private reconstruct(nodes: Map<string, SearchNode>, endKey: string): NavPoint[] {
    const result: NavPoint[] = [];
    let key: string | undefined = endKey;
    let guard = 0;

    while (key && guard < 2048) {
      const node = nodes.get(key);
      if (!node) break;
      result.push({ x: node.x, y: node.y });
      key = node.parent;
      guard += 1;
    }

    return result.reverse();
  }

  private heuristic(a: NavPoint, b: NavPoint): number {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  private key(x: number, y: number): string {
    return `${x},${y}`;
  }
}
