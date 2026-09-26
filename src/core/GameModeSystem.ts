export type GameMode = 'Medieval' | 'Modern';

const MODE_STORAGE_KEY = 'castle-role-game-mode-v1';

export class GameModeSystem {
  get(): GameMode {
    return this.normalize(localStorage.getItem(MODE_STORAGE_KEY));
  }

  set(mode: GameMode): void {
    localStorage.setItem(MODE_STORAGE_KEY, mode);
  }

  saveKey(baseKey: string, mode: GameMode): string {
    return `${baseKey}-${mode.toLowerCase()}`;
  }

  private normalize(value: string | null): GameMode {
    return value === 'Modern' ? 'Modern' : 'Medieval';
  }
}
