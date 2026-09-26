import type { GameState } from '../state/GameState';
import {
  GAME_MODE_REGISTRY,
  type GameModeDefinition,
  type GameModeId,
  type GameModeLifecycle,
  type GameModeLifecycleContext,
  type GameModeRegistry,
  selectGameMode,
} from './GameModeFoundation';

export type GameSessionStatus =
  | 'idle'
  | 'initializing'
  | 'running'
  | 'paused'
  | 'ended';

export interface GameSessionResult {
  readonly ok: boolean;
  readonly reason?: 'no-mode' | 'unknown' | 'unavailable' | 'invalid-state' | 'lifecycle-failed';
}

function createNoopLifecycle(): GameModeLifecycle {
  return {
    initialize: () => undefined,
    start: () => undefined,
    pause: () => undefined,
    resume: () => undefined,
    restart: () => undefined,
    end: () => undefined,
    cleanup: () => undefined,
  };
}

export class GameSession {
  private readonly sessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  private selectedMode: GameModeDefinition | null = null;
  private lifecycle: GameModeLifecycle | null = null;
  private status: GameSessionStatus = 'idle';

  constructor(
    private readonly state: GameState,
    private readonly registry: GameModeRegistry = GAME_MODE_REGISTRY,
  ) {}

  getSessionId(): string {
    return this.sessionId;
  }

  getStatus(): GameSessionStatus {
    return this.status;
  }

  getSelectedModeId(): GameModeId | null {
    return this.selectedMode?.id ?? null;
  }

  getSelectedMode(): GameModeDefinition | null {
    return this.selectedMode;
  }

  selectMode(id: GameModeId): GameSessionResult {
    const selection = selectGameMode(this.registry, id);
    if (!selection.ok || !selection.mode) {
      return { ok: false, reason: selection.reason };
    }

    if (this.status === 'running' || this.status === 'paused' || this.status === 'initializing') {
      return { ok: false, reason: 'invalid-state' };
    }

    this.selectedMode = selection.mode;
    this.lifecycle = selection.mode.createLifecycle?.() ?? createNoopLifecycle();
    this.status = 'idle';
    return { ok: true };
  }

  private context(): GameModeLifecycleContext | null {
    if (!this.selectedMode) return null;
    return {
      sessionId: this.sessionId,
      modeId: this.selectedMode.id,
      state: this.state,
    };
  }

  initialize(): GameSessionResult {
    const context = this.context();
    if (!context || !this.lifecycle) return { ok: false, reason: 'no-mode' };
    if (this.status !== 'idle' && this.status !== 'ended') {
      return { ok: false, reason: 'invalid-state' };
    }

    this.status = 'initializing';
    try {
      this.lifecycle.initialize(context);
      this.status = 'idle';
      return { ok: true };
    } catch {
      this.status = 'ended';
      return { ok: false, reason: 'lifecycle-failed' };
    }
  }

  start(): GameSessionResult {
    const context = this.context();
    if (!context || !this.lifecycle) return { ok: false, reason: 'no-mode' };
    if (this.status !== 'idle') return { ok: false, reason: 'invalid-state' };

    try {
      this.lifecycle.start(context);
      this.status = 'running';
      return { ok: true };
    } catch {
      this.status = 'ended';
      return { ok: false, reason: 'lifecycle-failed' };
    }
  }

  pause(): GameSessionResult {
    const context = this.context();
    if (!context || !this.lifecycle) return { ok: false, reason: 'no-mode' };
    if (this.status !== 'running') return { ok: false, reason: 'invalid-state' };

    try {
      this.lifecycle.pause(context);
      this.status = 'paused';
      return { ok: true };
    } catch {
      return { ok: false, reason: 'lifecycle-failed' };
    }
  }

  resume(): GameSessionResult {
    const context = this.context();
    if (!context || !this.lifecycle) return { ok: false, reason: 'no-mode' };
    if (this.status !== 'paused') return { ok: false, reason: 'invalid-state' };

    try {
      this.lifecycle.resume(context);
      this.status = 'running';
      return { ok: true };
    } catch {
      return { ok: false, reason: 'lifecycle-failed' };
    }
  }

  restart(): GameSessionResult {
    const context = this.context();
    if (!context || !this.lifecycle) return { ok: false, reason: 'no-mode' };
    if (this.status !== 'running' && this.status !== 'paused') {
      return { ok: false, reason: 'invalid-state' };
    }

    try {
      this.lifecycle.restart(context);
      this.status = 'running';
      return { ok: true };
    } catch {
      this.status = 'ended';
      return { ok: false, reason: 'lifecycle-failed' };
    }
  }

  end(): GameSessionResult {
    const context = this.context();
    if (!context || !this.lifecycle) return { ok: false, reason: 'no-mode' };
    if (this.status !== 'running' && this.status !== 'paused') {
      return { ok: false, reason: 'invalid-state' };
    }

    try {
      this.lifecycle.end(context);
      this.status = 'ended';
      return { ok: true };
    } catch {
      this.status = 'ended';
      return { ok: false, reason: 'lifecycle-failed' };
    }
  }

  cleanup(): GameSessionResult {
    const context = this.context();
    if (!context || !this.lifecycle) return { ok: false, reason: 'no-mode' };

    try {
      this.lifecycle.cleanup(context);
      this.status = 'ended';
      return { ok: true };
    } catch {
      this.status = 'ended';
      return { ok: false, reason: 'lifecycle-failed' };
    }
  }
}
