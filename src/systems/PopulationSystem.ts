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
  cottage: 18,
  house: 30,
  manor: 42,
  villa: 36,
  farm: 8,
  marketStall: 2,
  smallMarket: 8,
  marketHall: 18,
  mine: 5,
  smallDock: 4,
  woodenPier: 2,
  harbor: 12,
  fishingDock: 6,
  armyCamp: 0,
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

      if (cell.kind === 'farm') farmers += 8;
      else if (cell.kind === 'mine') miners += 5;
      else if (cell.kind === 'smallDock' || cell.kind === 'woodenPier') sailors += 2;
      else if (cell.kind === 'fishingDock') sailors += 5;
      else if (cell.kind === 'marketStall') merchants += 2;
      else if (cell.kind === 'smallMarket') merchants += 6;
      else if (cell.kind === 'marketHall') merchants += 14;
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
