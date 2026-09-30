import type { PerformanceMode } from '../settings/SettingsModel';

export type ActiveRenderProfile = Exclude<PerformanceMode, 'auto'>;

// Frame intervals include CPU/GPU stalls: react to trends, not individual slow frames.
// Long rAF gaps from tab switches and breakpoints are not performance samples.
const SLOW_FRAME_MS = 29;
const FAST_FRAME_MS = 18;
const DOWNGRADE_AFTER_MS = 3_000;
const UPGRADE_AFTER_MS = 12_000;
const CHANGE_COOLDOWN_MS = 12_000;
const MAX_VALID_FRAME_MS = 250;

/**
 * Independent quality selection. Touch input and viewport width never
 * dictate the graphics preset. Auto uses sustained frame pacing and hysteresis.
 */
export class AdaptiveRenderProfile {
  private requested: PerformanceMode | null = null;
  private current: ActiveRenderProfile = 'balanced';
  private smoothedFrameMs: number | null = null;
  private slowForMs = 0;
  private fastForMs = 0;
  private cooldownMs = 0;

  resolve(mode: PerformanceMode): ActiveRenderProfile {
    if (this.requested !== mode) {
      this.requested = mode;
      this.current = mode === 'auto' ? 'balanced' : mode;
      this.resetSamples();
    }
    return this.current;
  }

  recordFrame(frameDeltaMs: number, mode: PerformanceMode): void {
    this.resolve(mode);
    if (mode !== 'auto') return;

    if (!Number.isFinite(frameDeltaMs) || frameDeltaMs <= 0 || frameDeltaMs > MAX_VALID_FRAME_MS) {
      // Keep the transition cooldown across a tab pause, but discard bad samples.
      this.smoothedFrameMs = null;
      this.slowForMs = 0;
      this.fastForMs = 0;
      return;
    }

    this.smoothedFrameMs = this.smoothedFrameMs === null
      ? frameDeltaMs
      : this.smoothedFrameMs + 0.08 * (frameDeltaMs - this.smoothedFrameMs);

    this.cooldownMs = Math.max(0, this.cooldownMs - frameDeltaMs);
    if (this.cooldownMs > 0) return;

    if (this.smoothedFrameMs > SLOW_FRAME_MS) {
      this.slowForMs += frameDeltaMs;
      this.fastForMs = 0;
    } else if (this.smoothedFrameMs < FAST_FRAME_MS) {
      this.fastForMs += frameDeltaMs;
      this.slowForMs = 0;
    } else {
      this.slowForMs = 0;
      this.fastForMs = 0;
    }

    if (this.slowForMs >= DOWNGRADE_AFTER_MS && this.current !== 'performance') {
      this.current = this.current === 'quality' ? 'balanced' : 'performance';
      this.resetAfterChange();
    } else if (this.fastForMs >= UPGRADE_AFTER_MS && this.current !== 'quality') {
      this.current = this.current === 'performance' ? 'balanced' : 'quality';
      this.resetAfterChange();
    }
  }

  averageFrameMs(): number | null {
    return this.smoothedFrameMs;
  }

  private resetSamples(): void {
    this.smoothedFrameMs = null;
    this.slowForMs = 0;
    this.fastForMs = 0;
    this.cooldownMs = 0;
  }

  private resetAfterChange(): void {
    this.slowForMs = 0;
    this.fastForMs = 0;
    this.cooldownMs = CHANGE_COOLDOWN_MS;
  }
}
