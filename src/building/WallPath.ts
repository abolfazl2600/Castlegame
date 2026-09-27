export interface WallPathPoint {
  x: number;
  y: number;
}

function samePoint(a: WallPathPoint, b: WallPathPoint): boolean {
  return a.x === b.x && a.y === b.y;
}

/**
 * Rasterize a straight segment into a 4-neighbour grid path.
 *
 * Unlike ordinary Bresenham output, every consecutive point is cardinally
 * adjacent. This lets irregular or curved-looking fortification plans keep
 * using the existing wall/gate/tower connection and navigation systems.
 */
export function rasterizeOrthogonalWallSegment(
  start: WallPathPoint,
  end: WallPathPoint,
): WallPathPoint[] {
  const points: WallPathPoint[] = [{ x: Math.trunc(start.x), y: Math.trunc(start.y) }];
  const target = { x: Math.trunc(end.x), y: Math.trunc(end.y) };
  let x = points[0].x;
  let y = points[0].y;
  const deltaX = Math.abs(target.x - x);
  const deltaY = Math.abs(target.y - y);
  const stepX = target.x === x ? 0 : target.x > x ? 1 : -1;
  const stepY = target.y === y ? 0 : target.y > y ? 1 : -1;
  let movedX = 0;
  let movedY = 0;

  while (x !== target.x || y !== target.y) {
    if (x === target.x) {
      y += stepY;
      movedY += 1;
    } else if (y === target.y) {
      x += stepX;
      movedX += 1;
    } else {
      const progressX = deltaX === 0 ? 1 : movedX / deltaX;
      const progressY = deltaY === 0 ? 1 : movedY / deltaY;
      if (progressX <= progressY) {
        x += stepX;
        movedX += 1;
      } else {
        y += stepY;
        movedY += 1;
      }
    }
    points.push({ x, y });
  }

  return points;
}

/**
 * Rasterize an authored wall polyline or closed enclosure into unique grid
 * cells while preserving the authored traversal order.
 */
export function rasterizeWallPath(
  vertices: readonly WallPathPoint[],
  closed = false,
): WallPathPoint[] {
  if (vertices.length === 0) return [];
  if (vertices.length === 1) return [{ x: Math.trunc(vertices[0].x), y: Math.trunc(vertices[0].y) }];

  const result: WallPathPoint[] = [];
  const segmentCount = closed ? vertices.length : vertices.length - 1;

  for (let index = 0; index < segmentCount; index += 1) {
    const start = vertices[index];
    const end = vertices[(index + 1) % vertices.length];
    const segment = rasterizeOrthogonalWallSegment(start, end);
    for (const point of segment) {
      if (result.length === 0 || !samePoint(result[result.length - 1], point)) {
        result.push(point);
      }
    }
  }

  if (closed && result.length > 1 && samePoint(result[0], result[result.length - 1])) {
    result.pop();
  }

  return result;
}
