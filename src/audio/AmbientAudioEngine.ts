export interface AmbientContext {
  wind: number;
  birds: number;
  water: number;
  settlement: number;
  battle: number;
}

export interface AmbientAudioDiagnostics {
  activeLayers: string[];
}

type AmbientLayerName = keyof AmbientContext;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/**
 * Persistent, low-cost ambient layers. Sources are created once and context
 * changes only automate gain values, avoiding per-frame audio allocation.
 */
export class AmbientAudioEngine {
  private readonly gains = new Map<AmbientLayerName, GainNode>();
  private readonly sources: AudioScheduledSourceNode[] = [];
  private contextValues: AmbientContext = {
    wind: 0.55,
    birds: 0.45,
    water: 0.2,
    settlement: 0.15,
    battle: 0,
  };
  private started = false;

  constructor(
    private readonly context: AudioContext,
    private readonly output: AudioNode,
  ) {}

  start(): void {
    if (this.started) return;
    this.started = true;

    this.createNoiseLayer('wind', 'lowpass', 900);
    this.createNoiseLayer('water', 'bandpass', 650);
    this.createToneLayer('birds', 1760, 'triangle');
    this.createToneLayer('settlement', 146.83, 'sine');
    this.createToneLayer('battle', 55, 'sawtooth');
    this.applyContext(0.9);
  }

  setContext(next: Partial<AmbientContext>): void {
    this.contextValues = {
      wind: clamp01(next.wind ?? this.contextValues.wind),
      birds: clamp01(next.birds ?? this.contextValues.birds),
      water: clamp01(next.water ?? this.contextValues.water),
      settlement: clamp01(next.settlement ?? this.contextValues.settlement),
      battle: clamp01(next.battle ?? this.contextValues.battle),
    };
    if (this.started) this.applyContext(1.2);
  }

  getDiagnostics(): AmbientAudioDiagnostics {
    const activeLayers = (Object.keys(this.contextValues) as AmbientLayerName[])
      .filter((name) => this.contextValues[name] > 0.04);
    return { activeLayers };
  }

  stop(): void {
    if (!this.started) return;
    this.started = false;
    for (const source of this.sources) {
      try {
        source.stop();
      } catch {
        // Source may have already ended.
      }
      try {
        source.disconnect();
      } catch {
        // Best-effort teardown.
      }
    }
    this.sources.length = 0;
    for (const gain of this.gains.values()) {
      try {
        gain.disconnect();
      } catch {
        // Best-effort teardown.
      }
    }
    this.gains.clear();
  }

  private createNoiseLayer(name: AmbientLayerName, filterType: BiquadFilterType, frequency: number): void {
    const buffer = this.context.createBuffer(1, Math.max(1, Math.floor(this.context.sampleRate * 1.5)), this.context.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let index = 0; index < channel.length; index += 1) {
      channel[index] = Math.random() * 2 - 1;
    }

    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    source.buffer = buffer;
    source.loop = true;
    filter.type = filterType;
    filter.frequency.value = frequency;
    filter.Q.value = 0.5;
    gain.gain.value = 0.0001;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.output);
    source.start(this.context.currentTime + 0.03);
    this.sources.push(source);
    this.gains.set(name, gain);
  }

  private createToneLayer(name: AmbientLayerName, frequency: number, type: OscillatorType): void {
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.value = 0.0001;
    oscillator.connect(gain);
    gain.connect(this.output);
    oscillator.start(this.context.currentTime + 0.03);
    this.sources.push(oscillator);
    this.gains.set(name, gain);
  }

  private applyContext(fadeSeconds: number): void {
    const now = this.context.currentTime;
    const scale: Record<AmbientLayerName, number> = {
      wind: 0.028,
      birds: 0.0045,
      water: 0.022,
      settlement: 0.006,
      battle: 0.012,
    };
    for (const [name, gain] of this.gains) {
      const target = Math.max(0.0001, this.contextValues[name] * scale[name]);
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), now);
      gain.gain.linearRampToValueAtTime(target, now + fadeSeconds);
    }
  }
}
