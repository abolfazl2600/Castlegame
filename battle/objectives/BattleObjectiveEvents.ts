import type { BattleObjectiveEvent } from './BattleObjectiveTypes';

export type BattleObjectiveEventListener = (event: BattleObjectiveEvent) => void;

export class BattleObjectiveEventBus {
  private readonly listeners = new Set<BattleObjectiveEventListener>();

  subscribe(listener: BattleObjectiveEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event: BattleObjectiveEvent): void {
    for (const listener of this.listeners) listener(event);
  }

  clear(): void {
    this.listeners.clear();
  }
}
