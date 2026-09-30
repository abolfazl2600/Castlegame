import type { BattleObjectiveRuntimeState, BattleObjectiveDefinition } from './BattleObjectiveTypes';

type ObjectiveItem = {
  definition: BattleObjectiveDefinition;
  runtime: BattleObjectiveRuntimeState;
};

/**
 * Battle objectives remain part of the game logic, but their visual panel is
 * intentionally disabled. This keeps objective tracking available to the
 * battle system without showing the "Objective / Eliminate Enemy army" modal
 * on desktop or mobile.
 */
export class BattleObjectiveUI {
  constructor(private readonly getState: () => ObjectiveItem[]) {
    void this.getState;
  }

  mount(): void {
    this.removeExistingPanel();
  }

  render(): void {
    this.removeExistingPanel();
  }

  unmount(): void {
    this.removeExistingPanel();
  }

  private removeExistingPanel(): void {
    if (typeof document === 'undefined') return;

    document.getElementById('battle-objectives-panel')?.remove();
    document.getElementById('battle-objectives-styles')?.remove();
  }
}
