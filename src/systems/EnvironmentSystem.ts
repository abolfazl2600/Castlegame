export type SeasonName = 'spring' | 'summer' | 'autumn' | 'winter';

export interface EnvironmentState {
  cycleDays: number;
  day: number;
  progress: number;
}

export interface SeasonVisualState {
  season: SeasonName;
  nextSeason: SeasonName;
  localProgress: number;
  grass: number;
  foliage: number;
  crop: number;
  fog: number;
  sky: number;
  sunlight: number;
  sunIntensity: number;
}

const SEASONS: readonly SeasonName[] = ['spring', 'summer', 'autumn', 'winter'];

const PALETTES: Readonly<Record<SeasonName, Omit<SeasonVisualState, 'season' | 'nextSeason' | 'localProgress'>>> = {
  spring: {
    grass: 0x8fbf64,
    foliage: 0x5f9b50,
    crop: 0x8fbd59,
    fog: 0xc6d8c8,
    sky: 0xb8d5d8,
    sunlight: 0xffe8b7,
    sunIntensity: 1.2,
  },
  summer: {
    grass: 0x9fbc62,
    foliage: 0x4f843e,
    crop: 0xc7b959,
    fog: 0xc9d3bd,
    sky: 0xb9ced0,
    sunlight: 0xffdfa0,
    sunIntensity: 1.28,
  },
  autumn: {
    grass: 0xa49455,
    foliage: 0xb06c32,
    crop: 0xb9863f,
    fog: 0xc7b99e,
    sky: 0xbfae98,
    sunlight: 0xffcf8d,
    sunIntensity: 1.12,
  },
  winter: {
    grass: 0xb7baa5,
    foliage: 0x73806b,
    crop: 0x8e855d,
    fog: 0xc9d0cf,
    sky: 0xb8c4ca,
    sunlight: 0xe8eef3,
    sunIntensity: 0.96,
  },
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;
  const br = (b >> 16) & 0xff;
  const bg = (b >> 8) & 0xff;
  const bb = b & 0xff;
  const mix = (x: number, y: number) => Math.round(x + (y - x) * t);
  return (mix(ar, br) << 16) | (mix(ag, bg) << 8) | mix(ab, bb);
}

export class EnvironmentSystem {
  private state: EnvironmentState = {
    cycleDays: 48,
    day: 0,
    progress: 0,
  };

  getState(): EnvironmentState {
    return { ...this.state };
  }

  setState(value?: Partial<EnvironmentState> | null): void {
    const cycleDays = Number(value?.cycleDays);
    const day = Number(value?.day);
    const progress = Number(value?.progress);
    this.state = {
      cycleDays: Number.isFinite(cycleDays) ? Math.max(8, Math.round(cycleDays)) : 48,
      day: Number.isFinite(day) ? Math.max(0, Math.floor(day)) : 0,
      progress: Number.isFinite(progress) ? clamp01(progress) : 0,
    };
  }

  advance(deltaMs: number): boolean {
    if (!Number.isFinite(deltaMs) || deltaMs <= 0) return false;
    const before = this.state.progress;
    const cycleMs = this.state.cycleDays * 60_000;
    const delta = deltaMs / cycleMs;
    const total = before + delta;
    const wrapped = total >= 1;
    this.state.progress = total % 1;
    this.state.day += Math.floor(deltaMs / 60_000);
    return wrapped || Math.abs(this.state.progress - before) > 0.000001;
  }

  visualState(): SeasonVisualState {
    const scaled = this.state.progress * SEASONS.length;
    const index = Math.floor(scaled) % SEASONS.length;
    const season = SEASONS[index];
    const nextSeason = SEASONS[(index + 1) % SEASONS.length];
    const t = scaled - Math.floor(scaled);
    const a = PALETTES[season];
    const b = PALETTES[nextSeason];
    return {
      season,
      nextSeason,
      localProgress: t,
      grass: lerpColor(a.grass, b.grass, t),
      foliage: lerpColor(a.foliage, b.foliage, t),
      crop: lerpColor(a.crop, b.crop, t),
      fog: lerpColor(a.fog, b.fog, t),
      sky: lerpColor(a.sky, b.sky, t),
      sunlight: lerpColor(a.sunlight, b.sunlight, t),
      sunIntensity: a.sunIntensity + (b.sunIntensity - a.sunIntensity) * t,
    };
  }

  vegetationGrowthMultiplier(): number {
    const state = this.visualState();
    if (state.season === 'winter') return 0.2;
    if (state.season === 'autumn') return 0.6;
    if (state.season === 'spring') return 1.2;
    return 1;
  }
}
