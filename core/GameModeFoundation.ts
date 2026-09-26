export type GameModeId = string;

export interface GameModeLifecycleContext {
  readonly sessionId: string;
  readonly modeId: GameModeId;
  readonly state: unknown;
}

export interface GameModeLifecycle {
  initialize(context: GameModeLifecycleContext): void;
  start(context: GameModeLifecycleContext): void;
  pause(context: GameModeLifecycleContext): void;
  resume(context: GameModeLifecycleContext): void;
  restart(context: GameModeLifecycleContext): void;
  end(context: GameModeLifecycleContext): void;
  cleanup(context: GameModeLifecycleContext): void;
  /** Optional per-frame lifecycle hook driven by GameSession. */
  update?(context: GameModeLifecycleContext, deltaMs: number, timeMs: number): void;
}

export interface GameModeDefinition {
  readonly id: GameModeId;
  readonly displayName: string;
  readonly description: string;
  readonly available: boolean;
  readonly metadata?: Readonly<Record<string, string | number | boolean>>;
  readonly createLifecycle?: () => GameModeLifecycle;
}

export class GameModeRegistry {
  private readonly definitions = new Map<GameModeId, GameModeDefinition>();

  register(definition: GameModeDefinition): void {
    if (!definition.id.trim() || !definition.displayName.trim()) {
      throw new Error('Invalid game mode definition');
    }
    if (this.definitions.has(definition.id)) {
      throw new Error('Game mode already registered');
    }
    this.definitions.set(definition.id, definition);
  }

  get(id: GameModeId): GameModeDefinition | undefined {
    return this.definitions.get(id);
  }

  getAll(): GameModeDefinition[] {
    return Array.from(this.definitions.values());
  }

  has(id: GameModeId): boolean {
    return this.definitions.has(id);
  }

  isAvailable(id: GameModeId): boolean {
    return this.definitions.get(id)?.available === true;
  }
}

export const GAME_MODE_REGISTRY = new GameModeRegistry();

export interface GameModeSelectionResult {
  readonly ok: boolean;
  readonly mode?: GameModeDefinition;
  readonly reason?: 'unknown' | 'unavailable';
}

export function selectGameMode(
  registry: GameModeRegistry,
  id: GameModeId,
): GameModeSelectionResult {
  const mode = registry.get(id);
  if (!mode) return { ok: false, reason: 'unknown' };
  if (!mode.available) return { ok: false, reason: 'unavailable' };
  return { ok: true, mode };
}
