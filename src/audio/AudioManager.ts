import { audioEvents } from './AudioEventBus';
import { createAudioAssetRegistry } from './AudioAssets';
import { AdaptiveMusicEngine } from './AdaptiveMusicEngine';
import { AmbientAudioEngine, type AmbientContext } from './AmbientAudioEngine';
import { AndroidAudioLifecycleBridge } from './AndroidAudioLifecycle';
import type {
  AudioAsset,
  AudioBus,
  AudioDiagnostics,
  AudioManagerOptions,
  AudioPriority,
  AudioSettings,
  ProceduralToneRecipe,
} from './types';

const DEFAULT_SETTINGS: AudioSettings = {
  masterVolume: 1,
  musicEnabled: true,
  musicVolume: 0.7,
  ambientEnabled: true,
  ambientVolume: 0.65,
  sfxEnabled: true,
  sfxVolume: 1,
  muted: false,
};

const DEFAULT_AMBIENT_CONTEXT: AmbientContext = {
  wind: 0.55,
  birds: 0.45,
  water: 0.2,
  settlement: 0.15,
  fire: 0.12,
  battle: 0,
};

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

const PRIORITY_WEIGHT: Record<AudioPriority, number> = {
  low: 0,
  normal: 1,
  high: 2,
  critical: 3,
};

interface SfxVoice {
  element: HTMLAudioElement;
  priority: AudioPriority;
  startedAt: number;
}

interface ProceduralVoice {
  node: OscillatorNode;
  gain: GainNode;
  assetId: string;
  bus: AudioBus;
  priority: AudioPriority;
  startedAt: number;
}

export class AudioManager {
  private readonly registry = createAudioAssetRegistry();
  private readonly settingsStorageKey: string;
  private readonly sfxVoiceLimit: number;
  private readonly sfxVoices = new Map<string, SfxVoice[]>();
  private readonly proceduralNodes = new Map<OscillatorNode, ProceduralVoice>();
  private readonly cooldownUntil = new Map<string, number>();
  private currentMusic: { assetId: string; element: HTMLAudioElement } | null = null;
  private settings: AudioSettings;
  private ambientContext: AmbientContext = { ...DEFAULT_AMBIENT_CONTEXT };
  private gameplayIntensity = 0;
  private initialized = false;
  private initializationRequested = false;
  private disposed = false;
  private unsubscribeEvents: (() => void) | null = null;
  private readonly lifecycleBlocks = new Set<string>();
  private readonly lifecycleBridge: AndroidAudioLifecycleBridge;
  private resumePromise: Promise<void> | null = null;

  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private gameplayGain: GainNode | null = null;
  private uiGain: GainNode | null = null;
  private adaptiveMusic: AdaptiveMusicEngine | null = null;
  private ambientEngine: AmbientAudioEngine | null = null;

  private readonly gestureHandler = (): void => {
    void this.initializeFromUserGesture();
  };

  private readonly uiClickHandler = (event: Event): void => {
    if (!this.initialized || this.disposed) return;
    const origin = event.target instanceof Element ? event.target : null;
    const button = origin?.closest('button, [role="button"]');
    if (!button || button.matches(':disabled') || button.getAttribute('aria-disabled') === 'true') return;
    this.playSfx('ui.button');
  };

  constructor(options: AudioManagerOptions = {}) {
    this.settingsStorageKey = options.settingsStorageKey ?? 'castle-role-audio-settings';
    const mobileDefault = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) ? 20 : 24;
    this.sfxVoiceLimit = Math.max(4, Math.min(48, Math.trunc(options.sfxVoiceLimit ?? mobileDefault)));
    this.settings = this.loadSettings();

    this.unsubscribeEvents = audioEvents.on((event) => this.handleEvent(event));
    window.addEventListener('pointerdown', this.gestureHandler, { passive: true });
    window.addEventListener('keydown', this.gestureHandler, { passive: true });
    window.addEventListener('touchstart', this.gestureHandler, { passive: true });
    document.addEventListener('click', this.uiClickHandler, true);
    this.lifecycleBridge = new AndroidAudioLifecycleBridge(this);
  }

  getSettings(): AudioSettings {
    return { ...this.settings };
  }

  getDiagnostics(): AudioDiagnostics {
    const music = this.adaptiveMusic?.getDiagnostics();
    return {
      contextState: this.audioContext?.state ?? 'uninitialized',
      unlocked: this.initialized,
      musicState: music?.state ?? 'calm',
      intensity: music?.smoothedIntensity ?? this.gameplayIntensity,
      activeSection: music?.section ?? 'calm-loop',
      activeStemCount: music?.activeStemCount ?? 0,
      pendingMusicState: music?.pendingState ?? null,
      activeSfxVoices: this.activeSfxVoiceCount(),
      voiceLimit: this.sfxVoiceLimit,
      activeAmbientLayers: this.ambientEngine?.getDiagnostics().activeLayers ?? [],
    };
  }

  isInitialized(): boolean {
    return this.initialized;
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
    if (enabled) void this.resumePlaybackIfAllowed();
    else this.currentMusic?.element.pause();
  }

  setMusicVolume(value: number): void {
    this.settings.musicVolume = clamp01(value);
    this.persistSettings();
    this.applyVolumes();
  }

  setAmbientEnabled(enabled: boolean): void {
    if (this.settings.ambientEnabled === enabled) return;
    this.settings.ambientEnabled = enabled;
    this.persistSettings();
    this.applyVolumes();
    if (enabled) void this.resumePlaybackIfAllowed();
  }

  setAmbientVolume(value: number): void {
    this.settings.ambientVolume = clamp01(value);
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
      this.stopProceduralNodes();
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
      this.clearSfxVoices();
      this.stopProceduralNodes();
      return;
    }
    void this.resumePlaybackIfAllowed();
  }

  setGameplayIntensity(value: number): void {
    this.gameplayIntensity = Math.min(2, Math.max(0, Number.isFinite(value) ? value : 0));
    this.adaptiveMusic?.setIntensity(this.gameplayIntensity);
  }

  setAmbientContext(context: Partial<AmbientContext>): void {
    this.ambientContext = {
      wind: clamp01(context.wind ?? this.ambientContext.wind),
      birds: clamp01(context.birds ?? this.ambientContext.birds),
      water: clamp01(context.water ?? this.ambientContext.water),
      settlement: clamp01(context.settlement ?? this.ambientContext.settlement),
      fire: clamp01(context.fire ?? this.ambientContext.fire),
      battle: clamp01(context.battle ?? this.ambientContext.battle),
    };
    this.ambientEngine?.setContext(this.ambientContext);
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
    this.registry.set(asset.id, { ...asset });
  }

  playMusic(assetId: string): void {
    const asset = this.resolveAsset(assetId);
    // Never synthesize a persistent music bed as a fallback. If an authored
    // music asset has not been registered yet, keep the game silent.
    if (!asset?.src) return;
    if (asset.bus !== 'music') return;

    if (this.currentMusic?.assetId === assetId) {
      if (this.canPlayMusicNow() && this.currentMusic.element.paused) {
        void this.currentMusic.element.play().catch(() => undefined);
      }
      return;
    }

    this.stopHtmlMusic();
    this.adaptiveMusic?.stop();

    const element = this.createElement(asset);
    element.loop = asset.loop ?? true;
    this.currentMusic = { assetId, element };

    if (this.canPlayMusicNow()) void element.play().catch(() => undefined);
    this.applyVolumes();
  }

  stopMusic(): void {
    this.stopHtmlMusic();
    this.adaptiveMusic?.stop();
  }

  playSfx(assetId: string, force = false): void {
    if (
      !this.initialized
      || this.settings.muted
      || !this.settings.sfxEnabled
      || this.lifecycleBlocks.size > 0
      || document.hidden
    ) return;

    const asset = this.resolveAsset(assetId);
    if (!asset || asset.bus === 'music' || asset.bus === 'ambient') return;

    const nowMs = (this.audioContext?.currentTime ?? performance.now() / 1000) * 1000;
    if (!force && nowMs < (this.cooldownUntil.get(assetId) ?? 0)) return;
    this.cooldownUntil.set(assetId, nowMs + Math.max(0, asset.cooldownMs ?? 0));

    const priority = asset.priority ?? 'normal';
    const maxVoices = Math.max(1, Math.min(asset.maxVoices ?? 4, 12));
    while (this.countAssetVoices(assetId) >= maxVoices) {
      if (!this.evictOldestAssetVoice(assetId)) return;
    }
    if (!this.ensureVoiceCapacity(priority)) return;

    if (asset.tone) {
      this.playProceduralSfx(asset, priority);
      return;
    }
    if (!asset.src) return;

    const voice: SfxVoice = {
      element: this.createElement(asset),
      priority,
      startedAt: nowMs,
    };
    voice.element.loop = false;
    voice.element.addEventListener('ended', () => this.removeVoice(assetId, voice.element), { once: true });
    const voices = this.sfxVoices.get(assetId) ?? [];
    voices.push(voice);
    this.sfxVoices.set(assetId, voices);
    void voice.element.play().catch(() => this.removeVoice(assetId, voice.element));
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
    document.removeEventListener('click', this.uiClickHandler, true);
    this.lifecycleBridge.dispose();
    this.stopMusic();
    this.ambientEngine?.stop();
    this.clearSfxVoices();
    this.stopProceduralNodes();
    this.lifecycleBlocks.clear();
    if (this.audioContext && this.audioContext.state !== 'closed') void this.audioContext.close();
    this.audioContext = null;
    this.masterGain = null;
    this.musicGain = null;
    this.ambientGain = null;
    this.gameplayGain = null;
    this.uiGain = null;
    this.adaptiveMusic = null;
    this.ambientEngine = null;
    delete document.documentElement.dataset.audioEngine;
  }

  private handleEvent(event: import('./types').AudioEventDetail): void {
    if (event.action === 'play_music' && event.assetId) {
      this.playMusic(event.assetId);
      return;
    }
    if (event.action === 'play_sfx' && event.assetId) {
      this.playSfx(event.assetId, event.force ?? false);
      return;
    }
    if (event.action === 'set_music_intensity') {
      this.setGameplayIntensity(event.intensity ?? 0);
      return;
    }
    if (event.action === 'set_ambient_context' && event.ambient) {
      this.setAmbientContext(event.ambient);
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
    if (
      this.audioContext
      && this.masterGain
      && this.musicGain
      && this.ambientGain
      && this.gameplayGain
      && this.uiGain
    ) return this.audioContext;

    const context = new AudioContext();
    const masterGain = context.createGain();
    const musicGain = context.createGain();
    const ambientGain = context.createGain();
    const gameplayGain = context.createGain();
    const uiGain = context.createGain();

    musicGain.connect(masterGain);
    ambientGain.connect(masterGain);
    gameplayGain.connect(masterGain);
    uiGain.connect(masterGain);
    masterGain.connect(context.destination);

    this.audioContext = context;
    this.masterGain = masterGain;
    this.musicGain = musicGain;
    this.ambientGain = ambientGain;
    this.gameplayGain = gameplayGain;
    this.uiGain = uiGain;
    this.adaptiveMusic = new AdaptiveMusicEngine(context, musicGain);
    this.ambientEngine = new AmbientAudioEngine(context, ambientGain);
    this.ambientEngine.setContext(this.ambientContext);
    this.applyVolumes();
    return context;
  }

  private playProceduralSfx(asset: AudioAsset, priority: AudioPriority): void {
    const recipe = asset.tone;
    if (!recipe || !this.audioContext) return;

    this.playTone(asset.id, recipe, asset.bus, priority, asset.volume ?? 1);
    if (recipe.second && this.ensureVoiceCapacity(priority)) {
      this.playTone(
        asset.id,
        {
          ...recipe,
          start: recipe.second,
          end: Math.max(70, recipe.second * 0.72),
          duration: recipe.duration * 0.9,
          type: 'sine',
          level: recipe.level * 0.55,
          second: undefined,
        },
        asset.bus,
        priority,
        asset.volume ?? 1,
        0.018,
      );
    }
  }

  private playTone(
    assetId: string,
    recipe: ProceduralToneRecipe,
    bus: AudioBus,
    priority: AudioPriority,
    assetVolume: number,
    delay = 0,
  ): void {
    const context = this.audioContext;
    const destination = bus === 'ui' ? this.uiGain : this.gameplayGain;
    if (!context || !destination || context.state !== 'running') return;

    const startAt = context.currentTime + delay;
    const endAt = startAt + recipe.duration;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();

    oscillator.type = recipe.type;
    oscillator.frequency.setValueAtTime(recipe.start, startAt);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(35, recipe.end), endAt);

    envelope.gain.setValueAtTime(0.0001, startAt);
    envelope.gain.exponentialRampToValueAtTime(
      Math.max(0.001, recipe.level * clamp01(assetVolume)),
      startAt + Math.min(0.025, recipe.duration * 0.25),
    );
    envelope.gain.exponentialRampToValueAtTime(0.0001, endAt);

    oscillator.connect(envelope);
    envelope.connect(destination);
    const voice: ProceduralVoice = {
      node: oscillator,
      gain: envelope,
      assetId,
      bus,
      priority,
      startedAt: startAt * 1000,
    };
    this.proceduralNodes.set(oscillator, voice);
    oscillator.addEventListener('ended', () => this.removeProceduralVoice(oscillator), { once: true });
    oscillator.start(startAt);
    oscillator.stop(endAt + 0.02);
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
    return this.registry.get(assetId);
  }

  private createElement(asset: AudioAsset): HTMLAudioElement {
    const element = new Audio(asset.src ?? '');
    element.preload = asset.preload === 'stream' ? 'metadata' : asset.preload === 'lazy' ? 'none' : 'auto';
    element.volume = clamp01((asset.volume ?? 1) * this.effectiveElementVolume(asset.bus));
    element.setAttribute('playsinline', '');
    return element;
  }

  private effectiveElementVolume(bus: AudioBus): number {
    if (this.settings.muted) return 0;
    if (bus === 'music') {
      if (!this.settings.musicEnabled) return 0;
      return this.settings.masterVolume * this.settings.musicVolume;
    }
    if (bus === 'ambient') {
      if (!this.settings.ambientEnabled) return 0;
      return this.settings.masterVolume * this.settings.ambientVolume;
    }
    if (!this.settings.sfxEnabled) return 0;
    return this.settings.masterVolume * this.settings.sfxVolume;
  }

  private applyVolumes(): void {
    const now = this.audioContext?.currentTime ?? 0;
    const master = this.settings.muted ? 0 : this.settings.masterVolume;
    if (this.masterGain) this.masterGain.gain.setTargetAtTime(master, now, 0.015);
    if (this.musicGain) {
      this.musicGain.gain.setTargetAtTime(this.settings.musicEnabled ? this.settings.musicVolume : 0, now, 0.02);
    }
    if (this.ambientGain) {
      this.ambientGain.gain.setTargetAtTime(this.settings.ambientEnabled ? this.settings.ambientVolume : 0, now, 0.02);
    }
    const sfxVolume = this.settings.sfxEnabled ? this.settings.sfxVolume : 0;
    if (this.gameplayGain) this.gameplayGain.gain.setTargetAtTime(sfxVolume, now, 0.015);
    if (this.uiGain) this.uiGain.gain.setTargetAtTime(sfxVolume, now, 0.015);

    if (this.currentMusic) {
      const asset = this.registry.get(this.currentMusic.assetId);
      if (asset) {
        this.currentMusic.element.volume = clamp01((asset.volume ?? 1) * this.effectiveElementVolume('music'));
      }
    }

    for (const [assetId, voices] of this.sfxVoices) {
      const asset = this.registry.get(assetId);
      if (!asset) continue;
      const volume = clamp01((asset.volume ?? 1) * this.effectiveElementVolume(asset.bus));
      for (const voice of voices) voice.element.volume = volume;
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
      }

      // Ambient and adaptive-music procedural beds intentionally do not
      // auto-start. Until authored loop assets are available, startup should
      // remain quiet and only short event-driven SFX may play.
      document.documentElement.dataset.audioLifecycle = 'active';
    })();

    try {
      await this.resumePromise;
    } finally {
      this.resumePromise = null;
    }
  }

  private activeSfxVoiceCount(): number {
    let count = this.proceduralNodes.size;
    for (const voices of this.sfxVoices.values()) {
      count += voices.filter((voice) => !voice.element.paused && !voice.element.ended).length;
    }
    return count;
  }

  private countAssetVoices(assetId: string): number {
    const html = (this.sfxVoices.get(assetId) ?? [])
      .filter((voice) => !voice.element.paused && !voice.element.ended).length;
    let procedural = 0;
    for (const voice of this.proceduralNodes.values()) {
      if (voice.assetId === assetId) procedural += 1;
    }
    return html + procedural;
  }

  private ensureVoiceCapacity(priority: AudioPriority): boolean {
    while (this.activeSfxVoiceCount() >= this.sfxVoiceLimit) {
      if (!this.evictVoice(priority)) return false;
    }
    return true;
  }

  private evictVoice(incomingPriority: AudioPriority): boolean {
    const incomingWeight = PRIORITY_WEIGHT[incomingPriority];
    const candidates: Array<{ weight: number; startedAt: number; stop: () => void }> = [];
    const consider = (weight: number, startedAt: number, stop: () => void): void => {
      if (weight <= incomingWeight) candidates.push({ weight, startedAt, stop });
    };

    for (const [node, voice] of this.proceduralNodes) {
      consider(PRIORITY_WEIGHT[voice.priority], voice.startedAt, () => {
        try {
          node.stop();
        } catch {
          // Node may already have ended.
        }
        this.removeProceduralVoice(node);
      });
    }

    for (const [assetId, voices] of this.sfxVoices) {
      for (const voice of voices) {
        if (voice.element.paused || voice.element.ended) continue;
        consider(PRIORITY_WEIGHT[voice.priority], voice.startedAt, () => {
          voice.element.pause();
          this.removeVoice(assetId, voice.element);
        });
      }
    }

    candidates.sort((a, b) => a.weight - b.weight || a.startedAt - b.startedAt);
    const victim = candidates[0];
    if (!victim) return false;
    victim.stop();
    return true;
  }

  private evictOldestAssetVoice(assetId: string): boolean {
    let oldestProcedural: ProceduralVoice | null = null;
    for (const voice of this.proceduralNodes.values()) {
      if (voice.assetId !== assetId) continue;
      if (!oldestProcedural || voice.startedAt < oldestProcedural.startedAt) oldestProcedural = voice;
    }

    const htmlVoices = (this.sfxVoices.get(assetId) ?? [])
      .filter((voice) => !voice.element.paused && !voice.element.ended)
      .sort((a, b) => a.startedAt - b.startedAt);
    const oldestHtml = htmlVoices[0];

    if (oldestProcedural && (!oldestHtml || oldestProcedural.startedAt <= oldestHtml.startedAt)) {
      try {
        oldestProcedural.node.stop();
      } catch {
        // Node may already have ended.
      }
      this.removeProceduralVoice(oldestProcedural.node);
      return true;
    }
    if (oldestHtml) {
      oldestHtml.element.pause();
      this.removeVoice(assetId, oldestHtml.element);
      return true;
    }
    return false;
  }

  private clearSfxVoices(): void {
    for (const voices of this.sfxVoices.values()) {
      for (const voice of voices) {
        voice.element.pause();
        voice.element.removeAttribute('src');
        voice.element.load();
      }
    }
    this.sfxVoices.clear();
  }

  private stopProceduralNodes(): void {
    for (const [node, voice] of Array.from(this.proceduralNodes.entries())) {
      this.proceduralNodes.delete(node);
      try {
        node.stop();
      } catch {
        // The node may already have naturally ended.
      }
      try {
        node.disconnect();
        voice.gain.disconnect();
      } catch {
        // Disconnection is best-effort during lifecycle teardown.
      }
    }
  }

  private removeProceduralVoice(node: OscillatorNode): void {
    const voice = this.proceduralNodes.get(node);
    if (!voice) return;
    this.proceduralNodes.delete(node);
    try {
      node.disconnect();
      voice.gain.disconnect();
    } catch {
      // Best-effort cleanup.
    }
  }

  private removeVoice(assetId: string, element: HTMLAudioElement): void {
    const voices = this.sfxVoices.get(assetId);
    if (!voices) return;
    const next = voices.filter((voice) => voice.element !== element);
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
        ambientEnabled: Boolean(parsed.ambientEnabled ?? DEFAULT_SETTINGS.ambientEnabled),
        ambientVolume: clamp01(Number(parsed.ambientVolume ?? DEFAULT_SETTINGS.ambientVolume)),
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
