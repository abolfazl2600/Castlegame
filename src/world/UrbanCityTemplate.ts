import type { GridCell } from '../core/types';
import { urbanLandBounds } from './MapLayouts';

export type UrbanCityCell = GridCell & { x: number; y: number };

/** A deterministic, fully editable city made exclusively from normal game cells. */
export function createUrbanCityTemplate(size: number): UrbanCityCell[] {
  const bounds = urbanLandBounds(size);
  if (bounds.minX < 0 || bounds.minY < 0) {
    throw new RangeError('The urban plot must fit inside the world.');
  }
  const cells = new Map<string, UrbanCityCell>();
  const place = (x: number, y: number, kind: GridCell['kind'], level = 1, rotation = 0) => {
    cells.set(`${x},${y}`, { x: bounds.minX + x, y: bounds.minY + y, kind, level, rotation });
  };

  // Three avenues and five cross streets connect every district and the square.
  for (const x of [1, 7, 13]) {
    for (let y = 1; y <= 19; y += 1) place(x, y, 'stoneRoad');
  }
  for (const y of [2, 6, 10, 14, 18]) {
    for (let x = 1; x <= 13; x += 1) place(x, y, 'stoneRoad');
  }
  for (let y = 9; y <= 11; y += 1) {
    for (let x = 6; x <= 8; x += 1) place(x, y, 'stoneRoad');
  }

  // Residential blocks face the nearest street; taller homes mark the avenues.
  for (const y of [3, 5, 7, 13, 15]) {
    for (const x of [2, 4, 6, 8, 10, 12]) {
      const kind = x === 6 || x === 8 ? 'house' : 'cottage';
      place(x, y, kind, kind === 'house' ? 2 : 1, y === 5 || y === 13 ? 0 : 2);
    }
  }

  // Civic frontage, market square, and workshops alongside the main boulevard.
  place(4, 1, 'manor', 2);
  place(10, 1, 'basilica');
  place(2, 9, 'market', 2);
  place(4, 9, 'market');
  place(10, 9, 'carpenter');
  place(12, 9, 'manor');

  // Southern food district leaves room between productive buildings.
  place(2, 17, 'cowBarn');
  place(4, 17, 'farm');
  place(6, 17, 'windmill');
  place(8, 17, 'farm');
  place(10, 17, 'appleOrchard');
  place(12, 17, 'farm');
  place(4, 19, 'farm');
  place(10, 19, 'appleOrchard');

  // Pocket parks and a green coastal buffer keep the street plan readable.
  for (const x of [2, 4, 10, 12]) place(x, 11, 'tree', 2);
  for (const x of [0, 14]) {
    for (const y of [1, 5, 9, 13, 17, 19]) place(x, y, 'tree', 2);
  }
  for (const x of [3, 6, 8, 11]) place(x, 0, 'tree', 2);
  return [...cells.values()];
}
