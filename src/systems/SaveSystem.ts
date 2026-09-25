import { SAVE_KEY, SAVE_VERSION } from '../core/constants';
import type { SavedGame } from '../core/types';
import { GameState } from '../state/GameState';

export class SaveSystem {
  constructor(
    private readonly state: GameState,
    private readonly onStatus: (message: string) => void,
  ) {}

  load(): boolean {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;

      const parsed = JSON.parse(raw) as SavedGame;
      if (parsed.version !== SAVE_VERSION || !Array.isArray(parsed.cells)) {
        this.onStatus('Save version unsupported');
        return false;
      }

      this.state.replace(parsed.cells);
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
