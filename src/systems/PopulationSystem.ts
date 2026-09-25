import type { TileKind } from '../core/types';
import type { CellEntry } from '../state/GameState';

export interface PopulationGroups {
  civilians: number;
  military: number;
  workers: number;
  farmers: number;
  miners: number;
  sailors: number;
  merchants: number;
}

const CIVILIAN_VALUES: Partial<Record<TileKind, number>> = {
  hut: 4,
  cottage: 12,
  house: 20,
  manor: 36,
  villa: 28,
  farm: 6,
  mine: 5,
  smallDock: 4,
  woodenPier: 2,
  harbor: 12,
  fishingDock: 6,
};

export class PopulationSystem {
  calculate(
    cells: CellEntry[],
    military: number,
  ): PopulationGroups {
    let civilians = 0;
    let workers = 0;
    let farmers = 0;
    let miners = 0;
    let sailors = 0;
    let merchants = 0;

    for (const cell of cells) {
      civilians += CIVILIAN_VALUES[cell.kind] ?? 0;

      if (cell.kind === 'farm') farmers += 6;
      else if (cell.kind === 'mine') miners += 5;
      else if (cell.kind === 'smallDock' || cell.kind === 'woodenPier') sailors += 2;
      else if (cell.kind === 'fishingDock') sailors += 5;
      else if (cell.kind === 'harbor') {
        sailors += 6;
        merchants += 6;
      } else if (
        cell.kind === 'cottage' ||
        cell.kind === 'house' ||
        cell.kind === 'manor' ||
        cell.kind === 'villa' ||
        cell.kind === 'hut'
      ) {
        workers += Math.max(1, Math.round((CIVILIAN_VALUES[cell.kind] ?? 0) * 0.2));
      }
    }

    return {
      civilians,
      military: Math.max(0, Math.floor(military)),
      workers,
      farmers,
      miners,
      sailors,
      merchants,
    };
  }
}
