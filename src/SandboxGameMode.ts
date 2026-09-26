import type {
  GameModeDefinition,
  GameModeId,
  GameModeLifecycle,
  GameModeLifecycleContext,
} from './core/GameModeFoundation';
import type { GameState } from './state/GameState';

export interface SandboxRuntimeState {
  active: boolean;
  paused: boolean;
}

export interface SandboxLifecycleDependencies {
  readonly resetWorld: () => void;
  readonly setStatus: (message: string) => void;
}

export const SANDBOX_MODE_ID: GameModeId = 'sandbox';

export function createSandboxDefinition(
  dependencies: SandboxLifecycleDependencies,
): GameModeDefinition {
  return {
    id: SANDBOX_MODE_ID,
    displayName: 'Sandbox',
    description: 'Free-form construction and experimentation using the existing world and building systems.',
    available: true,
    metadata: {
      source: 'sandbox-game-mode',
      construction: 'free-form',
      buildingValidation: 'existing-system',
    },
    createLifecycle: () => new SandboxGameMode(dependencies),
  };
}

export class SandboxGameMode implements GameModeLifecycle {
  private readonly runtime: SandboxRuntimeState = {
    active: false,
    paused: false,
  };

  constructor(private readonly dependencies: SandboxLifecycleDependencies) {}

  initialize(context: GameModeLifecycleContext): void {
    this.assertContext(context);
    this.runtime.active = false;
    this.runtime.paused = false;
  }

  start(context: GameModeLifecycleContext): void {
    this.assertContext(context);
    this.runtime.active = true;
    this.runtime.paused = false;
    this.dependencies.setStatus('Sandbox ready · free-form construction enabled');
  }

  pause(context: GameModeLifecycleContext): void {
    this.assertContext(context);
    if (!this.runtime.active) return;
    this.runtime.paused = true;
  }

  resume(context: GameModeLifecycleContext): void {
    this.assertContext(context);
    if (!this.runtime.active) return;
    this.runtime.paused = false;
  }

  restart(context: GameModeLifecycleContext): void {
    this.assertContext(context);
    this.runtime.active = false;
    this.runtime.paused = false;
    this.dependencies.resetWorld();
    this.runtime.active = true;
    this.dependencies.setStatus('Sandbox restarted · world reset and ready for construction');
  }

  end(context: GameModeLifecycleContext): void {
    this.assertContext(context);
    this.runtime.active = false;
    this.runtime.paused = false;
  }

  cleanup(context: GameModeLifecycleContext): void {
    this.assertContext(context);
    this.runtime.active = false;
    this.runtime.paused = false;
  }

  update(context: GameModeLifecycleContext): void {
    this.assertContext(context);
    // Sandbox has no independent simulation loop. Construction, rendering,
    // world updates, and entity updates remain owned by the existing systems.
  }

  private assertContext(context: GameModeLifecycleContext): void {
    if (context.modeId !== SANDBOX_MODE_ID) {
      throw new Error('Sandbox lifecycle used with an incompatible game mode');
    }
    if (!(context.state instanceof Object)) {
      throw new Error('Sandbox lifecycle requires the existing game state');
    }
  }
}

export type SandboxStateStore = GameState;
