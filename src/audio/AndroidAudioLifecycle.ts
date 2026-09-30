export const ANDROID_AUDIO_LIFECYCLE_EVENT = 'castle-role:android-lifecycle';
export const ANDROID_AUDIO_FOCUS_EVENT = 'castle-role:android-audio-focus';

export interface AudioLifecycleController {
  suspendForLifecycle(source: string): void;
  resumeFromLifecycle(source: string): void;
}

export interface AndroidAudioLifecycleApi {
  pause(): void;
  resume(): void;
  setAppActive(active: boolean): void;
  setAudioFocus(hasFocus: boolean): void;
  setInterrupted(interrupted: boolean): void;
}

type NativeWindow = Window & {
  Capacitor?: {
    isNativePlatform?: () => boolean;
    getPlatform?: () => string;
  };
  cordova?: unknown;
  Android?: unknown;
  CastleRoleAudioLifecycle?: AndroidAudioLifecycleApi;
};

interface LifecycleEventDetail {
  active?: boolean;
  state?: 'active' | 'foreground' | 'resumed' | 'inactive' | 'background' | 'paused' | 'interrupted';
}

interface AudioFocusEventDetail {
  hasFocus?: boolean;
  state?: 'gain' | 'loss' | 'duck';
}

function isNativeAndroidShell(): boolean {
  const nativeWindow = window as NativeWindow;
  const capacitor = nativeWindow.Capacitor;
  try {
    if (capacitor?.isNativePlatform?.() && capacitor.getPlatform?.() === 'android') return true;
  } catch {
    // Fall through to wrapper markers.
  }

  return /Android/i.test(navigator.userAgent) && Boolean(nativeWindow.cordova || nativeWindow.Android);
}

/**
 * Normalizes browser page lifecycle and Android-wrapper lifecycle/audio-focus
 * signals into idempotent suspend/resume sources. Native wrappers can call
 * window.CastleRoleAudioLifecycle directly or dispatch the documented custom
 * events without coupling the web build to a specific wrapper package.
 */
export class AndroidAudioLifecycleBridge {
  private readonly nativeAndroid = isNativeAndroidShell();
  private readonly nativeWindow = window as NativeWindow;
  private readonly api: AndroidAudioLifecycleApi;
  private disposed = false;

  private readonly visibilityHandler = (): void => {
    this.setSource('document-visibility', document.hidden);
  };

  private readonly pageHideHandler = (): void => {
    this.setSource('page-lifecycle', true);
  };

  private readonly pageShowHandler = (): void => {
    this.setSource('page-lifecycle', false);
  };

  private readonly freezeHandler = (): void => {
    this.setSource('page-freeze', true);
  };

  private readonly nativePauseHandler = (): void => {
    this.setSource('native-app', true);
  };

  private readonly nativeResumeHandler = (): void => {
    this.setSource('native-app', false);
    this.setSource('page-freeze', false);
  };

  private readonly windowBlurHandler = (): void => {
    if (this.nativeAndroid) this.setSource('native-window-focus', true);
  };

  private readonly windowFocusHandler = (): void => {
    if (this.nativeAndroid) this.setSource('native-window-focus', false);
  };

  private readonly lifecycleEventHandler = (event: Event): void => {
    const detail = (event as CustomEvent<LifecycleEventDetail>).detail ?? {};
    const active =
      typeof detail.active === 'boolean'
        ? detail.active
        : detail.state === 'active' || detail.state === 'foreground' || detail.state === 'resumed';
    this.setSource('native-app', !active);
  };

  private readonly audioFocusEventHandler = (event: Event): void => {
    const detail = (event as CustomEvent<AudioFocusEventDetail>).detail ?? {};
    const hasFocus =
      typeof detail.hasFocus === 'boolean'
        ? detail.hasFocus
        : detail.state === 'gain';
    this.setSource('native-audio-focus', !hasFocus);
  };

  constructor(private readonly controller: AudioLifecycleController) {
    this.api = {
      pause: () => this.setSource('native-app', true),
      resume: () => this.setSource('native-app', false),
      setAppActive: (active) => this.setSource('native-app', !active),
      setAudioFocus: (hasFocus) => this.setSource('native-audio-focus', !hasFocus),
      setInterrupted: (interrupted) => this.setSource('native-interruption', interrupted),
    };

    document.addEventListener('visibilitychange', this.visibilityHandler);
    window.addEventListener('pagehide', this.pageHideHandler);
    window.addEventListener('pageshow', this.pageShowHandler);
    document.addEventListener('freeze', this.freezeHandler);
    document.addEventListener('pause', this.nativePauseHandler);
    document.addEventListener('resume', this.nativeResumeHandler);
    window.addEventListener('blur', this.windowBlurHandler);
    window.addEventListener('focus', this.windowFocusHandler);
    window.addEventListener(ANDROID_AUDIO_LIFECYCLE_EVENT, this.lifecycleEventHandler);
    window.addEventListener(ANDROID_AUDIO_FOCUS_EVENT, this.audioFocusEventHandler);

    this.nativeWindow.CastleRoleAudioLifecycle = this.api;
    if (document.hidden) this.setSource('document-visibility', true);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    document.removeEventListener('visibilitychange', this.visibilityHandler);
    window.removeEventListener('pagehide', this.pageHideHandler);
    window.removeEventListener('pageshow', this.pageShowHandler);
    document.removeEventListener('freeze', this.freezeHandler);
    document.removeEventListener('pause', this.nativePauseHandler);
    document.removeEventListener('resume', this.nativeResumeHandler);
    window.removeEventListener('blur', this.windowBlurHandler);
    window.removeEventListener('focus', this.windowFocusHandler);
    window.removeEventListener(ANDROID_AUDIO_LIFECYCLE_EVENT, this.lifecycleEventHandler);
    window.removeEventListener(ANDROID_AUDIO_FOCUS_EVENT, this.audioFocusEventHandler);

    if (this.nativeWindow.CastleRoleAudioLifecycle === this.api) {
      delete this.nativeWindow.CastleRoleAudioLifecycle;
    }
  }

  private setSource(source: string, suspended: boolean): void {
    if (this.disposed) return;
    if (suspended) this.controller.suspendForLifecycle(source);
    else this.controller.resumeFromLifecycle(source);
  }
}
