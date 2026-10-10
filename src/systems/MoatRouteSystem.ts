/** Continuous, cardinally connected moat strokes and restorable worker excavation. */
export interface MoatPoint { x: number; y: number }
export interface PendingMoatTask extends MoatPoint { progressMs: number }
export type MoatSegmentStatus = 'new' | 'existing' | 'blocked';
export interface MoatRouteAssessment {
  segments: Array<{ point: MoatPoint; status: MoatSegmentStatus }>;
  newCount: number;
  existingCount: number;
  blockedCount: number;
  valid: boolean;
}

/** Interpolate missed pointer events, including fast mobile drags, without diagonal gaps. */
export function extendMoatRoute(
  route: readonly MoatPoint[],
  from: MoatPoint,
  to: MoatPoint,
  limit = 1024,
): MoatPoint[] {
  const result = [...route];
  if (!result.length) result.push({ ...from });
  let x = from.x;
  let y = from.y;
  const add = (nx: number, ny: number): void => {
    if (result.length < limit) result.push({ x: nx, y: ny });
  };
  // Follow the dominant direction first, as existing road dragging does.
  const alongX = (): void => {
    const step = Math.sign(to.x - x);
    while (x !== to.x && result.length < limit) { x += step; add(x, y); }
  };
  const alongY = (): void => {
    const step = Math.sign(to.y - y);
    while (y !== to.y && result.length < limit) { y += step; add(x, y); }
  };
  if (Math.abs(to.x - x) >= Math.abs(to.y - y)) { alongX(); alongY(); }
  else { alongY(); alongX(); }
  return result;
}

/** No partial construction: a blocked cell invalidates the whole contiguous route. */
export function assessMoatRoute(
  points: readonly MoatPoint[],
  statusAt: (point: MoatPoint) => MoatSegmentStatus,
): MoatRouteAssessment {
  const seen = new Set<string>();
  const segments: MoatRouteAssessment['segments'] = [];
  let newCount = 0;
  let existingCount = 0;
  let blockedCount = 0;
  for (const point of points) {
    const key = `${point.x},${point.y}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const status = statusAt(point);
    segments.push({ point, status });
    if (status === 'new') newCount++;
    else if (status === 'existing') existingCount++;
    else blockedCount++;
  }

  // Independent of pointer sampling and loop retracing: all unique tiles must
  // belong to one orthogonally connected component, not touch only diagonally.
  let connected = segments.length > 0;
  if (segments.length) {
    const byKey = new Set(segments.map(({ point }) => `${point.x},${point.y}`));
    const visited = new Set<string>();
    const first = segments[0].point;
    const queue: MoatPoint[] = [first];
    visited.add(`${first.x},${first.y}`);
    for (let index = 0; index < queue.length; index++) {
      const point = queue[index];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const x = point.x + dx, y = point.y + dy, key = `${x},${y}`;
        if (!byKey.has(key) || visited.has(key)) continue;
        visited.add(key);
        queue.push({ x, y });
      }
    }
    connected = visited.size === byKey.size;
  }
  return { segments, newCount, existingCount, blockedCount,
    valid: connected && blockedCount === 0 && newCount > 0 };
}

/** Ignore malformed/stale input, duplicates and completed work. Old saves omit the field. */
export function restoreMoatTasks(
  saved: unknown,
  validAt: (point: MoatPoint) => boolean,
  maximum = 4096,
): PendingMoatTask[] {
  if (!Array.isArray(saved)) return [];
  const tasks: PendingMoatTask[] = [];
  const seen = new Set<string>();
  for (const entry of saved.slice(0, maximum)) {
    if (!entry || !Number.isInteger(entry.x) || !Number.isInteger(entry.y) ||
        !Number.isFinite(entry.progressMs) || entry.progressMs < 0 || entry.progressMs >= 1800) continue;
    const point = { x: entry.x as number, y: entry.y as number };
    const key = `${point.x},${point.y}`;
    if (seen.has(key) || !validAt(point)) continue;
    seen.add(key);
    tasks.push({ ...point, progressMs: entry.progressMs });
  }
  return tasks;
}

/** Completed excavations flood from river/ocean connections through cardinal moat links. */
export function computeMoatFlooding(
  moatCells: readonly MoatPoint[],
  terrainAt: (x: number, y: number) => string,
): Set<string> {
  const all = new Set(moatCells.map(({ x, y }) => `${x},${y}`));
  const flooded = new Set<string>();
  const queue: MoatPoint[] = [];
  const offsets = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  for (const point of moatCells) {
    if (offsets.some(([dx, dy]) => {
      const terrain = terrainAt(point.x + dx, point.y + dy);
      return terrain === 'river' || terrain === 'water';
    })) {
      const key = `${point.x},${point.y}`;
      if (flooded.has(key)) continue;
      flooded.add(key);
      queue.push(point);
    }
  }
  for (let index = 0; index < queue.length; index++) {
    const point = queue[index];
    for (const [dx, dy] of offsets) {
      const x = point.x + dx, y = point.y + dy, key = `${x},${y}`;
      if (!all.has(key) || flooded.has(key)) continue;
      flooded.add(key);
      queue.push({ x, y });
    }
  }
  return flooded;
}
