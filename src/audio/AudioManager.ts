import type { GameMode } from '../core/GameMode';
import { audioEvents } from './AudioEventBus';
import { createAudioAssetRegistry } from './AudioAssets';
import { AndroidAudioLifecycleBridge } from './AndroidAudioLifecycle';
import type { AudioAsset, AudioEventDetail, AudioSettings } from './types';

const DEFAULT_SETTINGS: AudioSettings = {
  masterVolume: 1,
  musicEnabled: true,
  musicVolume: 0.7,
  sfxEnabled: true,
  sfxVolume: 1,
  muted: false,
};

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
const MAX_TOTAL_SFX_VOICES = 12;

interface ToneRecipe {
  start: number;
  end: number;
  duration: number;
  type: OscillatorType;
  level: number;
  second?: number;
}

const PROCEDURAL_SFX: Record<string, ToneRecipe> = {
  'ui.tool-select': { start: 420, end: 640, duration: 0.07, type: 'sine', level: 0.16 },
  'building.place': { start: 180, end: 115, duration: 0.16, type: 'triangle', level: 0.22, second: 270 },
  'combat.battle-start': { start: 120, end: 240, duration: 0.32, type: 'sawtooth', level: 0.16, second: 180 },
  'combat.battle-stop': { start: 220, end: 105, duration: 0.22, type: 'triangle', level: 0.15 },
  'combat.battle-reset': { start: 150, end: 320, duration: 0.25, type: 'sine', level: 0.15, second: 225 },
};

export class AudioManager {
  private readonly registry = createAudioAssetRegistry();
  private readonly settingsStorageKey: string;
  private readonly sfxVoices = new Map<string, HTMLAudioElement[]>();
  private currentMusic: { assetId: string; element: HTMLAudioElement } | null = null;
  private currentMode: GameMode;
  private settings: AudioSettings;
  private initialized = false;
  private initializationRequested = false;
  private disposed = false;
  private unsubscribeEvents: (() => void) | null = null;
  private readonly lifecycleBlocks = new Set<string>();
  private readonly proceduralNodes = new Map<OscillatorNode, 'music' | 'sfx'>();
  private readonly lifecycleBridge: AndroidAudioLifecycleBridge;
  private resumePromise: Promise<void> | null = null;

  private audioContext: AudioContext | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private ambientTimer: number | null = null;

  private readonly gestureHandler = (): void => {
    void this.initializeFromUserGesture();
  };

  constructor(options: { initialMode?: GameMode; settingsStorageKey?: string } = {}) {
    this.currentMode = options.initialMode ?? 'medieval';
    this.settingsStorageKey = options.settingsStorageKey ?? 'castle-role-audio-settings';
    this.settings = this.loadSettings();

    this.unsubscribeEvents = audioEvents.on((event) => this.handleEvent(event));
    window.addEventListener('pointerdown', this.gestureHandler, { passive: true });
    window.addEventListener('keydown', this.gestureHandler, { passive: true });
    window.addEventListener('touchstart', this.gestureHandler, { passive: true });
    this.lifecycleBridge = new AndroidAudioLifecycleBridge(this);
  }

  getSettings(): AudioSettings {
    return { ...this.settings };
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getMode(): GameMode {
    return this.currentMode;
  }

  setMode(mode: GameMode): void {
    if (this.currentMode === mode) return;
    this.currentMode = mode;
    this.stopMusic();
    if (this.initialized && !document.hidden) this.startProceduralAmbience();
  }

  setMasterVolume(value: number): void {
    this.settings.masterVolume = clamp01(value);
    this.persistSettings();
    this.applyVolumes();
  }

  setMusicEnabled(enabled: boolean): void {
    if (this.settings.musicEnabled === enabled) return;
    this.settings.musicEnabled = enabled;
    this.persistSettings();
    this.applyVolumes();
    if (!enabled) {
      this.currentMusic?.element.pause();
      this.stopProceduralAmbience();
      this.stopProceduralNodes('music');
      return;
    }
    void this.resumePlaybackIfAllowed();
  }

  setMusicVolume(value: number): void {
    this.settings.musicVolume = clamp01(value);
    this.persistSettings();
    this.applyVolumes();
  }

  setSfxEnabled(enabled: boolean): void {
    if (this.settings.sfxEnabled === enabled) return;
    this.settings.sfxEnabled = enabled;
    this.persistSettings();
    this.applyVolumes();
    if (!enabled) {
      this.clearSfxVoices();
      this.stopProceduralNodes('sfx');
    }
  }

  setSfxVolume(value: number): void {
    this.settings.sfxVolume = clamp01(value);
    this.persistSettings();
    this.applyVolumes();
  }

  setMuted(muted: boolean): void {
    if (this.settings.muted === muted) return;
    this.settings.muted = muted;
    this.persistSettings();
    this.applyVolumes();
    if (muted) {
      this.currentMusic?.element.pause();
      this.stopProceduralAmbience();
      this.clearSfxVoices();
      this.stopProceduralNodes();
      return;
    }
    void this.resumePlaybackIfAllowed();
  }

  async initializeFromUserGesture(): Promise<boolean> {
    if (this.disposed) return false;

    if (this.initialized) {
      await this.resumePlaybackIfAllowed();
      return true;
    }
    if (this.initializationRequested) return false;

    this.initializationRequested = true;
    try {
      const context = this.ensureAudioGraph();
      await context.resume();
      this.initialized = true;
      document.documentElement.dataset.audioEngine = 'ready';

      if (this.lifecycleBlocks.size > 0 || document.hidden) {
        await context.suspend().catch(() => undefined);
        document.documentElement.dataset.audioLifecycle = 'suspended';
        return true;
      }

      await this.resumePlaybackIfAllowed();
      return true;
    } catch {
      this.initialized = false;
      delete document.documentElement.dataset.audioEngine;
      return false;
    } finally {
      this.initializationRequested = false;
    }
  }

  registerAsset(asset: AudioAsset): void {
    if (asset.mode !== this.currentMode) return;
    this.registry.set(asset.id, { ...asset });
  }

  playMusic(assetId: string): void {
    const asset = this.resolveAsset(assetId);
    if (!asset) {
      if (this.canPlayMusicNow()) this.startProceduralAmbience();
      return;
    }
    if (asset.bus !== 'music' || (!asset.loop && !asset.src)) return;

    if (this.currentMusic?.assetId === assetId) {
      if (this.canPlayMusicNow() && this.currentMusic.element.paused) {
        void this.currentMusic.element.play().catch(() => undefined);
      }
      return;
    }
    this.stopHtmlMusic();

    const element = this.createElement(asset);
    element.loop = asset.loop ?? true;
    this.currentMusic = { assetId, element };

    if (this.canPlayMusicNow()) {
      void element.play().catch(() => undefined);
    }
    this.applyVolumes();
  }

  stopMusic(): void {
    this.stopHtmlMusic();
    this.stopProceduralAmbience();
  }

  playSfx(assetId: string): void {
    if (
      !this.initialized
      || this.settings.muted
      || !this.settings.sfxEnabled
      || this.lifecycleBlocks.size > 0
      || document.hidden
    ) return;

    const asset = this.resolveAsset(assetId);
    if (!asset) {
      this.playProceduralSfx(assetId);
      return;
    }
    if (asset.bus === 'music') return;

    const maxVoices = Math.max(1, Math.min(asset.maxVoices ?? 4, 8));
    const voices = this.sfxVoices.get(assetId) ?? [];
    const active = voices.filter((voice) => !voice.paused && !voice.ended);

    while (active.length >= maxVoices) {
      const oldest = active.shift();
      oldest?.pause();
      if (oldest) oldest.currentTime = 0;
    }

    const allActive = Array.from(this.sfxVoices.values())
      .flat()
      .filter((voice) => !voice.paused && !voice.ended);
    while (allActive.length >= MAX_TOTAL_SFX_VOICES) {
      const oldest = allActive.shift();
      oldest?.pause();
      if (oldest) oldest.currentTime = 0;
    }

    const element = this.createElement(asset);
    element.loop = false;
    element.addEventListener('ended', () => this.removeVoice(assetId, element), { once: true });
    voices.push(element);
    this.sfxVoices.set(assetId, voices);

    void element.play().catch(() => this.removeVoice(assetId, element));
  }

  pause(reason = 'manual'): void {
    this.suspendForLifecycle(reason);
  }

  async resume(reason = 'manual'): Promise<void> {
    this.lifecycleBlocks.delete(reason);
    await this.resumePlaybackIfAllowed();
  }

  suspendForLifecycle(source: string): void {
    if (this.disposed || this.lifecycleBlocks.has(source)) return;
    const wasActive = this.lifecycleBlocks.size === 0;
    this.lifecycleBlocks.add(source);
    if (!wasActive) return;

    this.currentMusic?.element.pause();
    this.stopProceduralAmbience();
    this.clearSfxVoices();
    this.stopProceduralNodes();
    if (this.audioContext?.state === 'running') void this.audioContext.suspend().catch(() => undefined);
    document.documentElement.dataset.audioLifecycle = 'suspended';
  }

  resumeFromLifecycle(source: string): void {
    if (this.disposed || !this.lifecycleBlocks.has(source)) return;
    this.lifecycleBlocks.delete(source);
    void this.resumePlaybackIfAllowed();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.unsubscribeEvents?.();
    this.unsubscribeEvents = null;
    window.removeEventListener('pointerdown', this.gestureHandler);
    window.removeEventListener('keydown', this.gestureHandler);
    window.removeEventListener('touchstart', this.gestureHandler);
    this.lifecycleBridge.dispose();
    this.stopMusic();
    this.clearSfxVoices();
    this.stopProceduralNodes();
    this.lifecycleBlocks.clear();
    if (this.audioContext && this.audioContext.state !== 'closed') void this.audioContext.close();
    this.audioContext = null;
    this.musicGain = null;
    this.sfxGain = null;
    delete document.documentElement.dataset.audioEngine;
  }

  private handleEvent(event: AudioEventDetail): void {
    if (event.action === 'set_mode' && event.mode) {
      this.setMode(event.mode);
      return;
    }
    if (event.action === 'play_music' && event.assetId) {
      this.playMusic(event.assetId);
      return;
    }
    if (event.action === 'play_sfx' && event.assetId) {
      this.playSfx(event.assetId);
      return;
    }
    if (event.action === 'stop_music') {
      this.stopMusic();
      return;
    }
    if (event.action === 'pause') {
      this.pause();
      return;
    }
    if (event.action === 'resume') void this.resume();
  }

  private ensureAudioGraph(): AudioContext {
    if (this.audioContext && this.musicGain && this.sfxGain) return this.audioContext;

    const context = new AudioContext();
    const musicGain = context.createGain();
    const sfxGain = context.createGain();
    musicGain.connect(context.destination);
    sfxGain.connect(context.destination);

    this.audioContext = context;
    this.musicGain = musicGain;
    this.sfxGain = sfxGain;
    this.applyVolumes();
    return context;
  }

  private playProceduralSfx(assetId: string): void {
    const recipe = PROCEDURAL_SFX[assetId];
    if (!recipe || !this.audioContext || !this.sfxGain) return;

    this.playTone(recipe.start, recipe.end, recipe.duration, recipe.type, recipe.level);
    if (recipe.second) {
      this.playTone(recipe.second, Math.max(70, recipe.second * 0.72), recipe.duration * 0.9, 'sine', recipe.level * 0.55, 0.018);
    }
  }

  private playTone(
    startFrequency: number,
    endFrequency: number,
    duration: number,
    type: OscillatorType,
    level: number,
    delay = 0,
  ): void {
    const context = this.audioContext;
    const destination = this.sfxGain;
    if (!context || !destination || context.state !== 'running') return;

    const startAt = context.currentTime + delay;
    const endAt = startAt + duration;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(startFrequency, startAt);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(35, endFrequency), endAt);

    envelope.gain.setValueAtTime(0.0001, startAt);
    envelope.gain.exponentialRampToValueAtTime(Math.max(0.001, level), startAt + Math.min(0.025, duration * 0.25));
    envelope.gain.exponentialRampToValueAtTime(0.0001, endAt);

    oscillator.connect(envelope);
    envelope.connect(destination);
    this.trackProceduralNode(oscillator, 'sfx');
    oscillator.start(startAt);
    oscillator.stop(endAt + 0.02);
  }

  private startProceduralAmbience(): void {
    if (
      !this.canPlayMusicNow()
      || !this.audioContext
      || this.audioContext.state !== 'running'
      || !this.musicGain
      || this.ambientTimer !== null
    ) return;
    this.playAmbientPhrase();
    this.ambientTimer = window.setInterval(() => this.playAmbientPhrase(), 7000);
  }

  private stopProceduralAmbience(): void {
    if (this.ambientTimer !== null) {
      window.clearInterval(this.ambientTimer);
      this.ambientTimer = null;
    }
  }

  private playAmbientPhrase(): void {
    const context = this.audioContext;
    const destination = this.musicGain;
    if (!context || !destination || context.state !== 'running' || !this.canPlayMusicNow()) return;

    const root = 110;
    const ratios = [1, 1.5, 2];
    const startAt = context.currentTime + 0.02;
    const duration = 4.8;

    ratios.forEach((ratio, index) => {
      const oscillator = context.createOscillator();
      const envelope = context.createGain();
      oscillator.type = index === 0 ? 'sine' : 'triangle';
      oscillator.frequency.setValueAtTime(root * ratio, startAt);
      envelope.gain.setValueAtTime(0.0001, startAt);
      envelope.gain.exponentialRampToValueAtTime(index === 0 ? 0.045 : 0.018, startAt + 0.9);
      envelope.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
      oscillator.connect(envelope);
      envelope.connect(destination);
      this.trackProceduralNode(oscillator, 'music');
      oscillator.start(startAt);
      oscillator.stop(startAt + duration + 0.05);
    });
  }

  private stopHtmlMusic(): void {
    const current = this.currentMusic;
    if (!current) return;
    current.element.pause();
    current.element.currentTime = 0;
    current.element.removeAttribute('src');
    current.element.load();
    this.currentMusic = null;
  }

  private resolveAsset(assetId: string): AudioAsset | undefined {
    const asset = this.registry.get(assetId);
    return asset?.mode === this.currentMode ? asset : undefined;
  }

  private createElement(asset: AudioAsset): HTMLAudioElement {
    const element = new Audio(asset.src);
    element.preload = 'auto';
    element.volume = clamp01((asset.volume ?? 1) * this.effectiveVolume(asset.bus));
    element.setAttribute('playsinline', '');
    return element;
  }

  private effectiveVolume(bus: AudioAsset['bus']): number {
    if (this.settings.muted) return 0;
    if (bus === 'music' && !this.settings.musicEnabled) return 0;
    if (bus !== 'music' && !this.settings.sfxEnabled) return 0;
    const busVolume = bus === 'music' ? this.settings.musicVolume : this.settings.sfxVolume;
    return this.settings.masterVolume * busVolume;
  }

  private applyVolumes(): void {
    const now = this.audioContext?.currentTime ?? 0;
    if (this.musicGain) this.musicGain.gain.setTargetAtTime(this.effectiveVolume('music'), now, 0.015);
    if (this.sfxGain) this.sfxGain.gain.setTargetAtTime(this.effectiveVolume('ui'), now, 0.015);

    if (this.currentMusic) {
      const asset = this.registry.get(this.currentMusic.assetId);
      if (asset) this.currentMusic.element.volume = clamp01((asset.volume ?? 1) * this.effectiveVolume('music'));
    }

    for (const [assetId, voices] of this.sfxVoices) {
      const asset = this.registry.get(assetId);
      if (!asset) continue;
      const volume = clamp01((asset.volume ?? 1) * this.effectiveVolume(asset.bus));
      for (const voice of voices) voice.volume = volume;
    }
  }

  private canResumeAudioContext(): boolean {
    return (
      this.initialized
      && !this.disposed
      && this.lifecycleBlocks.size === 0
      && !document.hidden
    );
  }

  private canPlayMusicNow(): boolean {
    return (
      this.canResumeAudioContext()
      && !this.settings.muted
      && this.settings.musicEnabled
      && this.settings.masterVolume > 0
      && this.settings.musicVolume > 0
    );
  }

  private async resumePlaybackIfAllowed(): Promise<void> {
    if (!this.canResumeAudioContext()) return;
    if (this.resumePromise) return this.resumePromise;

    this.resumePromise = (async () => {
      if (this.audioContext?.state === 'suspended') {
        await this.audioContext.resume().catch(() => undefined);
      }

      if (!this.canResumeAudioContext()) return;

      if (this.canPlayMusicNow()) {
        if (this.currentMusic?.element.paused) {
          await this.currentMusic.element.play().catch(() => undefined);
        }
        this.startProceduralAmbience();
      }

      document.documentElement.dataset.audioLifecycle = 'active';
    })();

    try {
      await this.resumePromise;
    } finally {
      this.resumePromise = null;
    }
  }

  private clearSfxVoices(): void {
    for (const voices of this.sfxVoices.values()) {
      for (const voice of voices) {
        voice.pause();
        voice.removeAttribute('src');
        voice.load();
      }
    }
    this.sfxVoices.clear();
  }

  private trackProceduralNode(node: OscillatorNode, bus: 'music' | 'sfx'): void {
    this.proceduralNodes.set(node, bus);
    node.addEventListener('ended', () => this.proceduralNodes.delete(node), { once: true });
  }

  private stopProceduralNodes(bus?: 'music' | 'sfx'): void {
    for (const [node, nodeBus] of Array.from(this.proceduralNodes.entries())) {
      if (bus && nodeBus !== bus) continue;
      this.proceduralNodes.delete(node);
      try {
        node.stop();
      } catch {
        // The node may already have naturally ended.
      }
      try {
        node.disconnect();
      } catch {
        // Disconnection is best-effort during lifecycle teardown.
      }
    }
  }

  private removeVoice(assetId: string, element: HTMLAudioElement): void {
    const voices = this.sfxVoices.get(assetId);
    if (!voices) return;
    const next = voices.filter((voice) => voice !== element);
    if (next.length) this.sfxVoices.set(assetId, next);
    else this.sfxVoices.delete(assetId);
    element.removeAttribute('src');
    element.load();
  }

  private loadSettings(): AudioSettings {
    try {
      const raw = localStorage.getItem(this.settingsStorageKey);
      if (!raw) return { ...DEFAULT_SETTINGS };
      const parsed = JSON.parse(raw) as Partial<AudioSettings>;
      return {
        masterVolume: clamp01(Number(parsed.masterVolume ?? DEFAULT_SETTINGS.masterVolume)),
        musicEnabled: Boolean(parsed.musicEnabled ?? DEFAULT_SETTINGS.musicEnabled),
        musicVolume: clamp01(Number(parsed.musicVolume ?? DEFAULT_SETTINGS.musicVolume)),
        sfxEnabled: Boolean(parsed.sfxEnabled ?? DEFAULT_SETTINGS.sfxEnabled),
        sfxVolume: clamp01(Number(parsed.sfxVolume ?? DEFAULT_SETTINGS.sfxVolume)),
        muted: Boolean(parsed.muted ?? DEFAULT_SETTINGS.muted),
      };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  private persistSettings(): void {
    try {
      localStorage.setItem(this.settingsStorageKey, JSON.stringify(this.settings));
    } catch {
      // Runtime audio remains available even if persistence is blocked.
    }
  }
}
