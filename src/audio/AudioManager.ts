import type { GameMode } from '../core/GameMode';
import { audioEvents } from './AudioEventBus';
import { createAudioAssetRegistry } from './AudioAssets';
import type { AudioAsset, AudioEventDetail, AudioSettings } from './types';

const DEFAULT_SETTINGS: AudioSettings = {
  masterVolume: 1,
  musicVolume: 0.7,
  sfxVolume: 1,
  muted: false,
};

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

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
  private readonly gestureHandler = (): void => {
    void this.initializeFromUserGesture();
  };
  private readonly visibilityHandler = (): void => {
    if (document.hidden) {
      this.pause();
    } else {
      void this.resume();
    }
  };
  private readonly pageShowHandler = (): void => {
    void this.resume();
  };

  constructor(options: { initialMode?: GameMode; settingsStorageKey?: string } = {}) {
    this.currentMode = options.initialMode ?? 'medieval';
    this.settingsStorageKey = options.settingsStorageKey ?? 'castle-role-audio-settings';
    this.settings = this.loadSettings();

    this.unsubscribeEvents = audioEvents.on((event) => this.handleEvent(event));
    window.addEventListener('pointerdown', this.gestureHandler, { passive: true });
    window.addEventListener('keydown', this.gestureHandler, { passive: true });
    window.addEventListener('touchstart', this.gestureHandler, { passive: true });
    document.addEventListener('visibilitychange', this.visibilityHandler);
    window.addEventListener('pageshow', this.pageShowHandler);
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
  }

  setMasterVolume(value: number): void {
    this.settings.masterVolume = clamp01(value);
    this.persistSettings();
    this.applyVolumes();
  }

  setMusicVolume(value: number): void {
    this.settings.musicVolume = clamp01(value);
    this.persistSettings();
    this.applyVolumes();
  }

  setSfxVolume(value: number): void {
    this.settings.sfxVolume = clamp01(value);
    this.persistSettings();
    this.applyVolumes();
  }

  setMuted(muted: boolean): void {
    this.settings.muted = muted;
    this.persistSettings();
    this.applyVolumes();
  }

  async initializeFromUserGesture(): Promise<boolean> {
    if (this.disposed || this.initialized) return this.initialized;
    if (this.initializationRequested) return false;

    this.initializationRequested = true;
    try {
      // HTMLAudioElement playback is deliberately unlocked only from a real
      // user gesture. We do not create or start a music stream at construction.
      this.initialized = true;
      if (this.currentMusic) await this.currentMusic.element.play();
      return true;
    } catch {
      this.initialized = false;
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
    if (!asset || asset.bus !== 'music' || !asset.loop && !asset.src) return;

    if (this.currentMusic?.assetId === assetId) return;
    this.stopMusic();

    const element = this.createElement(asset);
    element.loop = asset.loop ?? true;
    this.currentMusic = { assetId, element };

    if (this.initialized) {
      void element.play().catch(() => {
        // Browser autoplay/suspension errors are intentionally non-fatal.
      });
    }
    this.applyVolumes();
  }

  stopMusic(): void {
    const current = this.currentMusic;
    if (!current) return;
    current.element.pause();
    current.element.currentTime = 0;
    current.element.removeAttribute('src');
    current.element.load();
    this.currentMusic = null;
  }

  playSfx(assetId: string): void {
    if (!this.initialized || this.settings.muted) return;

    const asset = this.resolveAsset(assetId);
    if (!asset || asset.bus === 'music') return;

    const maxVoices = Math.max(1, Math.min(asset.maxVoices ?? 4, 8));
    const voices = this.sfxVoices.get(assetId) ?? [];
    const active = voices.filter((voice) => !voice.paused && !voice.ended);

    while (active.length >= maxVoices) {
      const oldest = active.shift();
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

  pause(): void {
    this.currentMusic?.element.pause();
    for (const voices of this.sfxVoices.values()) {
      for (const voice of voices) voice.pause();
    }
  }

  async resume(): Promise<void> {
    if (!this.initialized || this.settings.muted || document.hidden) return;
    if (this.currentMusic) {
      await this.currentMusic.element.play().catch(() => undefined);
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.unsubscribeEvents?.();
    this.unsubscribeEvents = null;
    window.removeEventListener('pointerdown', this.gestureHandler);
    window.removeEventListener('keydown', this.gestureHandler);
    window.removeEventListener('touchstart', this.gestureHandler);
    document.removeEventListener('visibilitychange', this.visibilityHandler);
    window.removeEventListener('pageshow', this.pageShowHandler);
    this.stopMusic();
    for (const voices of this.sfxVoices.values()) {
      for (const voice of voices) {
        voice.pause();
        voice.removeAttribute('src');
        voice.load();
      }
    }
    this.sfxVoices.clear();
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
    if (event.action === 'resume') {
      void this.resume();
    }
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
    const busVolume = bus === 'music' ? this.settings.musicVolume : this.settings.sfxVolume;
    return this.settings.masterVolume * busVolume;
  }

  private applyVolumes(): void {
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
        musicVolume: clamp01(Number(parsed.musicVolume ?? DEFAULT_SETTINGS.musicVolume)),
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
      // Settings persistence is optional and must never affect gameplay.
    }
  }
}
