export type MusicIntensityState = 'calm' | 'tension' | 'combat';

export interface AdaptiveMusicDiagnostics {
  state: MusicIntensityState;
  section: string;
  rawIntensity: number;
  smoothedIntensity: number;
  activeStemCount: number;
  pendingState: MusicIntensityState | null;
  bpm: number;
}

type StemName = 'base' | 'harmony' | 'rhythm' | 'tension';

interface Stem {
  oscillator: OscillatorNode;
  gain: GainNode;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const STEM_FREQUENCIES: Record<MusicIntensityState, Record<StemName, number>> = {
  calm: { base: 110, harmony: 164.81, rhythm: 220, tension: 82.41 },
  tension: { base: 123.47, harmony: 185, rhythm: 246.94, tension: 92.5 },
  combat: { base: 98, harmony: 146.83, rhythm: 196, tension: 73.42 },
};

const STATE_SECTIONS: Record<MusicIntensityState, string> = {
  calm: 'calm-loop',
  tension: 'tension-loop',
  combat: 'combat-loop',
};

/**
 * Small procedural adaptive score.
 *
 * All stems start once on a shared AudioContext timeline (vertical layering).
 * Major harmonic/section changes are scheduled on bar boundaries using the
 * AudioContext clock (horizontal re-sequencing), never render-frame timing.
 */
export class AdaptiveMusicEngine {
  private readonly stems = new Map<StemName, Stem>();
  private started = false;
  private timelineStart = 0;
  private rawIntensity = 0;
  private smoothedIntensity = 0;
  private state: MusicIntensityState = 'calm';
  private pendingState: MusicIntensityState | null = null;
  private section = STATE_SECTIONS.calm;
  private lastIntensitySampleTime = 0;
  private lastStateCommitTime = -Infinity;
  private transitionToken = 0;

  readonly bpm = 84;
  readonly beatsPerBar = 4;

  constructor(
    private readonly context: AudioContext,
    private readonly output: AudioNode,
  ) {}

  start(): void {
    if (this.started) return;
    this.started = true;
    this.timelineStart = this.context.currentTime + 0.05;
    this.lastIntensitySampleTime = this.context.currentTime;

    this.createStem('base', 'sine');
    this.createStem('harmony', 'triangle');
    this.createStem('rhythm', 'square');
    this.createStem('tension', 'sawtooth');

    this.applyFrequencies('calm', this.timelineStart, 0.05);
    this.applyVerticalMix(this.timelineStart, 0.05);
  }

  setIntensity(value: number): void {
    this.rawIntensity = clamp(Number.isFinite(value) ? value : 0, 0, 2);
    if (!this.started) return;

    const now = this.context.currentTime;
    const dt = clamp(now - this.lastIntensitySampleTime, 0, 1);
    this.lastIntensitySampleTime = now;

    const rising = this.rawIntensity > this.smoothedIntensity;
    const timeConstant = rising ? 1.1 : 3.8;
    const alpha = dt <= 0 ? 0 : 1 - Math.exp(-dt / timeConstant);
    this.smoothedIntensity += (this.rawIntensity - this.smoothedIntensity) * alpha;
    this.applyVerticalMix(now, 0.8);

    const desired = this.resolveState(this.smoothedIntensity);
    if (desired === this.state && this.pendingState !== null) {
      this.pendingState = null;
      this.transitionToken += 1;
      return;
    }
    if (desired === this.state || desired === this.pendingState) return;
    if (now - this.lastStateCommitTime < 2.25) return;

    this.queueSection(desired, now);
  }

  getDiagnostics(): AdaptiveMusicDiagnostics {
    return {
      state: this.state,
      section: this.section,
      rawIntensity: this.rawIntensity,
      smoothedIntensity: this.smoothedIntensity,
      activeStemCount: this.started ? this.stems.size : 0,
      pendingState: this.pendingState,
      bpm: this.bpm,
    };
  }

  stop(): void {
    if (!this.started) return;
    this.started = false;
    this.transitionToken += 1;
    this.pendingState = null;
    for (const { oscillator, gain } of this.stems.values()) {
      try {
        gain.gain.cancelScheduledValues(this.context.currentTime);
        gain.gain.setTargetAtTime(0, this.context.currentTime, 0.03);
        oscillator.stop(this.context.currentTime + 0.15);
      } catch {
        // Best-effort teardown.
      }
      try {
        oscillator.disconnect();
        gain.disconnect();
      } catch {
        // Best-effort teardown.
      }
    }
    this.stems.clear();
  }

  private createStem(name: StemName, type: OscillatorType): void {
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    gain.gain.setValueAtTime(0.0001, this.timelineStart);
    oscillator.connect(gain);
    gain.connect(this.output);
    oscillator.start(this.timelineStart);
    this.stems.set(name, { oscillator, gain });
  }

  private applyVerticalMix(at: number, fadeSeconds: number): void {
    const x = this.smoothedIntensity;
    const targets: Record<StemName, number> = {
      base: 0.042,
      harmony: 0.018 + clamp(x / 2, 0, 1) * 0.018,
      rhythm: clamp((x - 0.2) / 1.4, 0, 1) * 0.012,
      tension: clamp((x - 0.75) / 1.25, 0, 1) * 0.014,
    };

    for (const [name, stem] of this.stems) {
      const parameter = stem.gain.gain;
      parameter.cancelScheduledValues(at);
      parameter.setValueAtTime(Math.max(0.0001, parameter.value), at);
      parameter.linearRampToValueAtTime(Math.max(0.0001, targets[name]), at + fadeSeconds);
    }
  }

  private resolveState(value: number): MusicIntensityState {
    if (this.state === 'calm') {
      if (value >= 1.25) return 'combat';
      if (value >= 0.42) return 'tension';
      return 'calm';
    }
    if (this.state === 'tension') {
      if (value >= 1.32) return 'combat';
      if (value <= 0.2) return 'calm';
      return 'tension';
    }
    if (value <= 0.72) return value <= 0.2 ? 'calm' : 'tension';
    return 'combat';
  }

  private queueSection(nextState: MusicIntensityState, now: number): void {
    this.pendingState = nextState;
    const boundary = this.nextBarBoundary(now);
    const token = ++this.transitionToken;

    this.applyFrequencies(nextState, boundary, 0.22);

    const delayMs = Math.max(0, (boundary - this.context.currentTime) * 1000);
    window.setTimeout(() => {
      if (!this.started || token !== this.transitionToken || this.pendingState !== nextState) return;
      this.state = nextState;
      this.section = STATE_SECTIONS[nextState];
      this.pendingState = null;
      this.lastStateCommitTime = this.context.currentTime;
    }, delayMs);
  }

  private applyFrequencies(state: MusicIntensityState, at: number, glideSeconds: number): void {
    const targets = STEM_FREQUENCIES[state];
    for (const [name, stem] of this.stems) {
      const frequency = stem.oscillator.frequency;
      frequency.cancelScheduledValues(at);
      frequency.setValueAtTime(Math.max(35, frequency.value), at);
      frequency.exponentialRampToValueAtTime(targets[name], at + glideSeconds);
    }
  }

  private nextBarBoundary(now: number): number {
    const secondsPerBeat = 60 / this.bpm;
    const barDuration = secondsPerBeat * this.beatsPerBar;
    const elapsed = Math.max(0, now - this.timelineStart);
    const bars = Math.floor(elapsed / barDuration) + 1;
    return this.timelineStart + bars * barDuration;
  }
}
