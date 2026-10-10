/**
 * Limits expensive scene-wide LOD/shadow recalculations when the measured
 * draw-call count remains above a cap that protected geometry cannot satisfy.
 *
 * Explicit scene/quality invalidation is handled by the governor; this gate
 * deals only with otherwise-unchanged over-budget frames.
 */
export class OverBudgetRecheckGate {
  private lastCheckedCalls: number | null = null;
  private lastCheckedAtMs = Number.NEGATIVE_INFINITY;

  /** A meaningful increase in draw calls warrants another attempt. */
  private static readonly MIN_GROWTH_CALLS = 16;
  private static readonly GROWTH_FRACTION = 0.04;
  private static readonly GROWTH_COOLDOWN_MS = 750;
  /** Periodically retry even small changes that accumulate under the threshold. */
  private static readonly MAX_STALE_MS = 10_000;

  shouldReapply(drawCalls: number, cap: number, nowMs: number): boolean {
    if (
      !Number.isFinite(drawCalls) || !Number.isFinite(cap) ||
      !Number.isFinite(nowMs) || cap <= 0 || drawCalls <= cap
    ) {
      this.reset();
      return false;
    }

    if (this.lastCheckedCalls === null) {
      this.lastCheckedCalls = drawCalls;
      this.lastCheckedAtMs = nowMs;
      return true;
    }

    const sinceLastCheck = Math.max(0, nowMs - this.lastCheckedAtMs);
    const significantGrowth =
      drawCalls >= this.lastCheckedCalls +
        Math.max(OverBudgetRecheckGate.MIN_GROWTH_CALLS, Math.ceil(cap * OverBudgetRecheckGate.GROWTH_FRACTION));

    if (
      (significantGrowth && sinceLastCheck >= OverBudgetRecheckGate.GROWTH_COOLDOWN_MS) ||
      sinceLastCheck >= OverBudgetRecheckGate.MAX_STALE_MS
    ) {
      this.lastCheckedCalls = drawCalls;
      this.lastCheckedAtMs = nowMs;
      return true;
    }
    return false;
  }

  /** Call whenever the scene, distance band, quality or shadow policy changes. */
  reset(): void {
    this.lastCheckedCalls = null;
    this.lastCheckedAtMs = Number.NEGATIVE_INFINITY;
  }
}
