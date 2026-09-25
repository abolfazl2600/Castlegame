import { SAVE_KEY, SAVE_VERSION, WORLD_COLS, WORLD_ROWS } from '../core/constants';
import type { SavedGame, TileKind } from '../core/types';
import { GameState } from '../state/GameState';

interface RawSavedGame {
  version?: number;
  cells?: Array<{ x?: number; y?: number; kind?: string }>;
}

const migratedKinds: Record<string, TileKind> = {
  castle: 'wall',
  wall: 'wall',
  gate: 'gate',
  tower: 'tower',
  road: 'road',
  cottage: 'cottage',
  house: 'house',
  manor: 'manor',
};

export class SaveSystem {
  constructor(
    private readonly state: GameState,
    private readonly onStatus: (message: string) => void,
  ) {}

  load(): boolean {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;

      const parsed = JSON.parse(raw) as RawSavedGame;
      if (parsed.version !== SAVE_VERSION || !Array.isArray(parsed.cells)) {
        this.onStatus('Save version unsupported');
        return false;
      }

      const cells: Array<{ x: number; y: number; kind: TileKind }> = [];
      for (const cell of parsed.cells) {
        if (!Number.isInteger(cell.x) || !Number.isInteger(cell.y) || !cell.kind) continue;
        if ((cell.x as number) < 0 || (cell.y as number) < 0 || (cell.x as number) >= WORLD_COLS || (cell.y as number) >= WORLD_ROWS) continue;
        const kind = migratedKinds[cell.kind];
        if (!kind) continue;
        cells.push({ x: cell.x as number, y: cell.y as number, kind });
      }

      this.state.replace(cells);
      this.onStatus('Loaded local save');
      return true;
    } catch {
      this.onStatus('Could not load save');
      return false;
    }
  }

  save(): void {
    const data: SavedGame = {
      version: SAVE_VERSION,
      updatedAt: Date.now(),
      cells: this.state.entries(),
    };

    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    this.onStatus('Saved locally');
  }

  reset(): void {
    localStorage.removeItem(SAVE_KEY);
    this.state.clear();
    this.onStatus('Map reset');
  }
}
