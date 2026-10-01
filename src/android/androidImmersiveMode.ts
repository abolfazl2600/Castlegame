import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

export const ANDROID_VIEWPORT_CHANGE_EVENT = 'castle-role:android-viewport-change';

export interface AndroidViewportDetail {
  width: number;
  height: number;
  offsetLeft: number;
  offsetTop: number;
  scale: number;
}

function isNativeAndroid(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

/**
 * Keeps the web runtime synchronized with Android window/system-UI transitions.
 *
 * Native fullscreen is owned by MainActivity. This bridge deliberately does not
 * hide system bars from JavaScript, so Android's normal swipe-to-reveal escape
 * path stays intact. It only re-measures the visible viewport and nudges normal
 * window resize listeners (including Three.js) when that viewport changes.
 */
export function installAndroidImmersiveViewportBridge(): void {
  if (!isNativeAndroid()) return;

  const root = document.documentElement;
  const visualViewport = window.visualViewport;
  let rafId = 0;
  let dispatchingSyntheticResize = false;
  let lastSignature = '';

  root.dataset.nativeAndroid = 'true';

  const measure = (): void => {
    rafId = 0;

    const detail: AndroidViewportDetail = {
      width: Math.max(1, Math.round(visualViewport?.width ?? window.innerWidth)),
      height: Math.max(1, Math.round(visualViewport?.height ?? window.innerHeight)),
      offsetLeft: Math.round(visualViewport?.offsetLeft ?? 0),
      offsetTop: Math.round(visualViewport?.offsetTop ?? 0),
      scale: visualViewport?.scale ?? 1,
    };

    const signature = [
      detail.width,
      detail.height,
      detail.offsetLeft,
      detail.offsetTop,
      detail.scale,
    ].join(':');

    root.style.setProperty('--android-viewport-width', `${detail.width}px`);
    root.style.setProperty('--android-viewport-height', `${detail.height}px`);
    root.style.setProperty('--android-viewport-offset-left', `${detail.offsetLeft}px`);
    root.style.setProperty('--android-viewport-offset-top', `${detail.offsetTop}px`);

    window.dispatchEvent(
      new CustomEvent<AndroidViewportDetail>(ANDROID_VIEWPORT_CHANGE_EVENT, { detail }),
    );

    if (signature !== lastSignature) {
      lastSignature = signature;
      dispatchingSyntheticResize = true;
      window.dispatchEvent(new Event('resize'));
      dispatchingSyntheticResize = false;
    }
  };

  const scheduleMeasure = (): void => {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(measure);
  };

  const refreshBurst = (): void => {
    scheduleMeasure();
    window.setTimeout(scheduleMeasure, 80);
    window.setTimeout(scheduleMeasure, 260);
  };

  const onWindowResize = (): void => {
    if (!dispatchingSyntheticResize) scheduleMeasure();
  };

  window.addEventListener('resize', onWindowResize, { passive: true });
  window.addEventListener('orientationchange', refreshBurst, { passive: true });
  window.addEventListener('focus', refreshBurst, { passive: true });
  window.addEventListener('pageshow', refreshBurst, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refreshBurst();
  });
  document.addEventListener('resume', refreshBurst);
  visualViewport?.addEventListener('resize', scheduleMeasure, { passive: true });
  visualViewport?.addEventListener('scroll', scheduleMeasure, { passive: true });

  void App.addListener('appStateChange', ({ isActive }) => {
    if (isActive) refreshBurst();
  }).catch((error: unknown) => {
    console.warn('Failed to register Android immersive lifecycle listener', error);
  });

  refreshBurst();
}
