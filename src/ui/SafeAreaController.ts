import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';

export interface SafeAreaInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

interface SafeAreaNativePlugin {
  getInsets(): Promise<SafeAreaInsets>;
  addListener(
    eventName: 'insetsChanged',
    listener: (insets: SafeAreaInsets) => void,
  ): Promise<PluginListenerHandle>;
}

const nativeSafeArea = registerPlugin<SafeAreaNativePlugin>('SafeArea');

const ZERO_INSETS: SafeAreaInsets = { top: 0, right: 0, bottom: 0, left: 0 };

function positive(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function maxInsets(...sources: SafeAreaInsets[]): SafeAreaInsets {
  return {
    top: Math.max(...sources.map((source) => positive(source.top))),
    right: Math.max(...sources.map((source) => positive(source.right))),
    bottom: Math.max(...sources.map((source) => positive(source.bottom))),
    left: Math.max(...sources.map((source) => positive(source.left))),
  };
}

/**
 * Keeps reusable CSS safe-area tokens synchronized with browser and Android insets.
 *
 * CSS env(safe-area-inset-*) remains the first-line fallback. On Android store
 * builds a small Capacitor plugin supplies WindowInsets so display cutouts,
 * gesture zones and transient system bars are represented even when WebView's
 * env() values lag behind a system UI transition.
 */
export class SafeAreaController {
  private readonly probe: HTMLDivElement;
  private nativeInsets: SafeAreaInsets = ZERO_INSETS;
  private frame = 0;
  private nativeListener: PluginListenerHandle | null = null;

  constructor(private readonly root: HTMLElement = document.documentElement) {
    this.probe = document.createElement('div');
    this.probe.setAttribute('aria-hidden', 'true');
    this.probe.style.cssText = [
      'position:fixed',
      'pointer-events:none',
      'visibility:hidden',
      'z-index:-1',
      'padding-top:env(safe-area-inset-top,0px)',
      'padding-right:env(safe-area-inset-right,0px)',
      'padding-bottom:env(safe-area-inset-bottom,0px)',
      'padding-left:env(safe-area-inset-left,0px)',
    ].join(';');
    document.body.appendChild(this.probe);

    this.bindViewportEvents();
    this.scheduleUpdate();
    void this.bindNativeInsets();
  }

  private bindViewportEvents(): void {
    const schedule = (): void => this.scheduleUpdate();

    window.addEventListener('resize', schedule, { passive: true });
    window.addEventListener('orientationchange', schedule, { passive: true });
    window.addEventListener('pageshow', schedule, { passive: true });
    window.addEventListener('focus', schedule, { passive: true });
    document.addEventListener('fullscreenchange', schedule);

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.scheduleUpdate();
        void this.refreshNativeInsets();
      }
    });

    const viewport = window.visualViewport;
    viewport?.addEventListener('resize', schedule, { passive: true });
    viewport?.addEventListener('scroll', schedule, { passive: true });
  }

  private async bindNativeInsets(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;

    await this.refreshNativeInsets();

    try {
      this.nativeListener = await nativeSafeArea.addListener('insetsChanged', (insets) => {
        this.nativeInsets = this.normalizeInsets(insets);
        this.scheduleUpdate();
      });
    } catch (error) {
      console.warn('Native safe-area listener unavailable; browser insets will be used.', error);
    }
  }

  private async refreshNativeInsets(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;

    try {
      this.nativeInsets = this.normalizeInsets(await nativeSafeArea.getInsets());
      this.scheduleUpdate();
    } catch (error) {
      console.warn('Native safe-area query unavailable; browser insets will be used.', error);
    }
  }

  private normalizeInsets(insets: SafeAreaInsets): SafeAreaInsets {
    return {
      top: positive(Number(insets.top)),
      right: positive(Number(insets.right)),
      bottom: positive(Number(insets.bottom)),
      left: positive(Number(insets.left)),
    };
  }

  private readEnvironmentInsets(): SafeAreaInsets {
    const style = getComputedStyle(this.probe);
    return {
      top: positive(Number.parseFloat(style.paddingTop)),
      right: positive(Number.parseFloat(style.paddingRight)),
      bottom: positive(Number.parseFloat(style.paddingBottom)),
      left: positive(Number.parseFloat(style.paddingLeft)),
    };
  }

  private readVisualViewportInsets(): SafeAreaInsets {
    const viewport = window.visualViewport;
    if (!viewport) return ZERO_INSETS;

    const layoutWidth = document.documentElement.clientWidth || window.innerWidth;
    const layoutHeight = document.documentElement.clientHeight || window.innerHeight;

    return {
      top: positive(viewport.offsetTop),
      left: positive(viewport.offsetLeft),
      right: positive(layoutWidth - viewport.offsetLeft - viewport.width),
      bottom: positive(layoutHeight - viewport.offsetTop - viewport.height),
    };
  }

  private scheduleUpdate(): void {
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.applyInsets();
    });
  }

  private applyInsets(): void {
    const insets = maxInsets(
      this.readEnvironmentInsets(),
      this.readVisualViewportInsets(),
      this.nativeInsets,
    );

    this.root.style.setProperty('--safe-area-top', String(insets.top) + 'px');
    this.root.style.setProperty('--safe-area-right', String(insets.right) + 'px');
    this.root.style.setProperty('--safe-area-bottom', String(insets.bottom) + 'px');
    this.root.style.setProperty('--safe-area-left', String(insets.left) + 'px');
    this.root.dataset.safeArea = Object.values(insets).some((value) => value > 0.5) ? 'active' : 'clear';

    window.dispatchEvent(new CustomEvent<SafeAreaInsets>('castle-safe-area-change', { detail: insets }));
  }
}
