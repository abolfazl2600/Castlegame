import type { GameMode } from '../core/GameMode';
import type { GridCell, TileKind } from '../core/types';

export interface GodModePoint {
  x: number;
  y: number;
}

/** The canonical target selected by a God Mode action. The anchor identifies
 * the authoritative state cell; footprint lets actions treat large structures
 * as one object instead of affecting an arbitrary rendered tile. */
export interface GodModeTarget {
  anchor: GodModePoint;
  kind: TileKind;
  footprint: readonly GodModePoint[];
}

export interface GodModeExecutionResult {
  ok: boolean;
  message: string;
  damage?: number;
  destroyed?: boolean;
}

export interface GodModeActionContext {
  readonly mode: GameMode;
  getCell(point: GodModePoint): GridCell | undefined;
  isDestructible(kind: TileKind): boolean;
  executeMissileStrike(target: GodModeTarget): GodModeExecutionResult;
}

export interface GodModeActionDefinition {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly availableModes: readonly GameMode[];
  readonly enabled: boolean;
  validateTarget(target: GodModeTarget | null, context: GodModeActionContext): string | null;
  execute(target: GodModeTarget, context: GodModeActionContext): GodModeExecutionResult;
}

/** Small registry used by the God Mode panel and input flow. New world actions
 * register here instead of adding branches to the canvas input handler. */
export class GodModeActionRegistry {
  private readonly actions = new Map<string, GodModeActionDefinition>();

  register(action: GodModeActionDefinition): void {
    if (this.actions.has(action.id)) throw new Error(`God Mode action already registered: ${action.id}`);
    this.actions.set(action.id, action);
  }

  get(id: string): GodModeActionDefinition | undefined {
    return this.actions.get(id);
  }

  list(mode?: GameMode): GodModeActionDefinition[] {
    return Array.from(this.actions.values()).filter((action) =>
      mode === undefined || action.availableModes.includes(mode),
    );
  }

  isAvailable(id: string, mode: GameMode): boolean {
    const action = this.actions.get(id);
    return Boolean(action?.enabled && action.availableModes.includes(mode));
  }
}

export function createFutureGodModeAction(
  id: 'flood' | 'earthquake',
  label: string,
  description: string,
): GodModeActionDefinition {
  return {
    id,
    label,
    description,
    availableModes: [],
    enabled: false,
    validateTarget: () => 'This God Mode action is reserved for a future update.',
    execute: () => ({ ok: false, message: 'This God Mode action is not implemented yet.' }),
  };
}
