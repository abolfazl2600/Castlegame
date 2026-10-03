import type { GridCell, KeepState, TerrainKind, TileKind, TowerBridgeState, WallDirection } from '../core/types';
import { ConnectedWallNetwork } from '../building/ConnectedWallNetwork';
import type { AutomaticWallAccess } from '../building/CastleDetailGenerator';

export interface NavPoint {
  x: number;
  y: number;
}

export interface WallNavNode extends NavPoint {
  worldY: number;
  kind: TileKind;
}

export interface BattleNavigationContext {
  cols: () => number;
  rows: () => number;
  terrainAt: (x: number, y: number) => TerrainKind;
  elevationAt: (x: number, y: number) => number;
  kindAt: (x: number, y: number) => TileKind | undefined;
  cellAt: (x: number, y: number) => GridCell | undefined;
  fortificationTopAt: (x: number, y: number, cell: GridCell) => number;
  castleLinksAt?: (x: number, y: number) => WallDirection[] | undefined;
  keeps: () => KeepState[];
  towerBridges?: () => TowerBridgeState[];
  automaticWallAccess?: () => AutomaticWallAccess[];
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
      cols: context.cols,
      rows: context.rows,
      cellAt: context.cellAt,
      elevationAt: context.elevationAt,
      fortificationTopAt: context.fortificationTopAt,
      castleLinksAt: context.castleLinksAt,
    });
  }

  invalidate(): void {
    this.pathCache.clear();
  }

  isGroundWalkable(x: number, y: number): boolean {
    const cols = this.context.cols();
    const rows = this.context.rows();
    if (x < 0 || y < 0 || x >= cols || y >= rows) return false;

    const terrain = this.context.terrainAt(x, y);
    if (terrain === 'water' || terrain === 'river' || terrain === 'mountain') return false;

    const kind = this.context.kindAt(x, y);
    const collapsed = (this.context.cellAt(x, y)?.damage ?? 0) >= 1;
    if (collapsed && (kind === 'wall1' || kind === 'wall2' || kind === 'wall3' || kind === 'gate')) return true;
    if (kind === 'gate' && this.context.gatePassable && !this.context.gatePassable(x, y)) {
      return false;
    }
    if (kind === 'gate' && this.context.cellAt(x, y)?.gateOpen === false) return false;

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
      kind === 'gate'
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

    while (open.size > 0 && iterations < this.context.cols() * this.context.rows() * 6) {
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
    for (let y = 0; y < this.context.rows(); y += 1) {
      for (let x = 0; x < this.context.cols(); x += 1) {
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
      return {
        x: Math.floor(this.context.cols() / 2),
        y: Math.floor(this.context.rows() / 2),
      };
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
    for (let y = 0; y < this.context.rows(); y += 1) {
      for (let x = 0; x < this.context.cols(); x += 1) {
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
    const cols = this.context.cols();
    const rows = this.context.rows();

    for (let x = 1; x < cols - 1; x += 1) {
      edgeCandidates.push({ x, y: 1 }, { x, y: rows - 2 });
    }
    for (let y = 2; y < rows - 2; y += 1) {
      edgeCandidates.push({ x: 1, y }, { x: cols - 2, y });
    }

    const walkable = edgeCandidates
      .filter((point) => this.isGroundWalkable(point.x, point.y))
      .sort(
        (a, b) =>
          this.heuristic(b, objective) - this.heuristic(a, objective),
      );

    if (walkable.length === 0) {
      const fallback = this.findNearestWalkable(
        { x: 1, y: rows - 2 },
        Math.max(cols, rows),
      );
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

    for (let y = 0; y < this.context.rows(); y += 1) {
      for (let x = 0; x < this.context.cols(); x += 1) {
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

    for (let y = 0; y < this.context.rows(); y += 1) {
      for (let x = 0; x < this.context.cols(); x += 1) {
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
    const nodes = this.defensiveNetwork.nodes().map((node) => ({
      x: node.x,
      y: node.y,
      kind: node.kind,
      worldY: node.worldY + 0.28,
    }));
    const byKey = new Map(nodes.map((node) => [this.key(node.x, node.y), node]));
    const queue = nodes.filter((node) => this.accessGroundCell(node) !== null);
    const visited = new Set<string>();
    while (queue.length) {
      const node = queue.shift()!;
      const key = this.key(node.x, node.y);
      if (visited.has(key)) continue;
      visited.add(key);
      for (const next of this.connectedWallNeighbors(node, byKey)) {
        if (!visited.has(this.key(next.x, next.y))) queue.push(next);
      }
    }
    return nodes.filter((node) => visited.has(this.key(node.x, node.y)));
  }

  accessGroundCell(node: NavPoint): NavPoint | null {
    const automatic = this.automaticAccessAt(node);
    if (automatic) {
      const ground = { x: automatic.groundX, y: automatic.groundY };
      return this.isGroundWalkable(ground.x, ground.y) ? ground : null;
    }

    const kind = this.context.kindAt(node.x, node.y);
    if (kind !== 'tower' && kind !== 'gate') return null;

    const keep = this.context.keeps()[0];
    const center = keep ?? {
      x: Math.floor(this.context.cols() / 2),
      y: Math.floor(this.context.rows() / 2),
    };
    const candidates = DIRS.slice(0, 4)
      .map((direction) => ({ x: node.x + direction.x, y: node.y + direction.y }))
      .filter((point) => this.isGroundWalkable(point.x, point.y));
    candidates.sort((a, b) => this.heuristic(a, center) - this.heuristic(b, center) || a.y - b.y || a.x - b.x);
    return candidates[0] ?? null;
  }

  private automaticAccessAt(node: NavPoint): AutomaticWallAccess | undefined {
    return this.context.automaticWallAccess?.().find(
      (access) => access.targetX === node.x && access.targetY === node.y,
    );
  }

  accessRouteTo(target: WallNavNode): WallNavNode[] {
    const nodes = this.wallPlatformNodes();
    const byKey = new Map(nodes.map((node) => [this.key(node.x, node.y), node]));
    const start = byKey.get(this.key(target.x, target.y));
    if (!start) return [];
    const queue = [start];
    const parent = new Map<string, string>();
    const seen = new Set<string>([this.key(start.x, start.y)]);
    while (queue.length) {
      const node = queue.shift()!;
      const key = this.key(node.x, node.y);
      if (this.accessGroundCell(node)) {
        const route: WallNavNode[] = [node];
        let current = key;
        while (parent.has(current)) {
          current = parent.get(current)!;
          route.push(byKey.get(current)!);
        }
        return route;
      }
      for (const next of this.connectedWallNeighbors(node, byKey)) {
        const nextKey = this.key(next.x, next.y);
        if (seen.has(nextKey)) continue;
        seen.add(nextKey);
        parent.set(nextKey, key);
        queue.push(next);
      }
    }
    return [];
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
