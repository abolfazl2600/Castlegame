/**
 * Software-only landscape presentation for portrait touch displays.
 *
 * Rotating the BODY (rather than the WebGL canvas alone) keeps every HUD,
 * portal/dialog appended to body, and pointer target in the same coordinate
 * system. CSS receives real visual-viewport dimensions; the game renders into
 * logical width=physical height and logical height=physical width.
 */
export const SOFTWARE_LANDSCAPE_CHANGE_EVENT = 'castle-role:software-landscape-change';

type ScreenPoint = Pick<PointerEvent, 'clientX' | 'clientY'>;
type TouchPoint = ScreenPoint & Pick<PointerEvent, 'pointerId'>;

export function isSoftwareLandscape(): boolean {
  return document.documentElement.dataset.gameOrientation === 'software-landscape';
}

/** Coordinates in the unrotated logical landscape space (for touch gestures). */
export function gameViewportPoint(point: TouchPoint): TouchPoint {
  if (!isSoftwareLandscape()) return {
    pointerId: point.pointerId, clientX: point.clientX, clientY: point.clientY,
  };
  const width = Number.parseFloat(
    document.documentElement.style.getPropertyValue('--game-physical-width'),
  ) || window.innerWidth;
  return {
    pointerId: point.pointerId,
    clientX: point.clientY,
    clientY: width - point.clientX,
  };
}

/** Normalized local UV coordinates even when the whole DOM is rotated 90°. */
export function normalizedPointInElement(
  element: Element,
  point: ScreenPoint,
): { x: number; y: number } {
  const rect = element.getBoundingClientRect();
  if (isSoftwareLandscape()) {
    return {
      x: (point.clientY - rect.top) / Math.max(1, rect.height),
      y: (rect.right - point.clientX) / Math.max(1, rect.width),
    };
  }
  return {
    x: (point.clientX - rect.left) / Math.max(1, rect.width),
    y: (point.clientY - rect.top) / Math.max(1, rect.height),
  };
}

export class SoftwareLandscapeViewport {
  private frame = 0;
  private previous = '';
  private readonly touchScreen = window.matchMedia('(pointer: coarse)');

  constructor(private readonly root: HTMLElement = document.documentElement) {
    this.apply();
    const schedule = (): void => {
      if (this.frame) cancelAnimationFrame(this.frame);
      this.frame = requestAnimationFrame(() => {
        this.frame = 0;
        this.apply();
      });
    };
    window.addEventListener('resize', schedule, { passive: true });
    window.addEventListener('orientationchange', schedule, { passive: true });
    window.addEventListener('pageshow', schedule, { passive: true });
    document.addEventListener('fullscreenchange', schedule);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) schedule();
    });
    window.visualViewport?.addEventListener('resize', schedule, { passive: true });
    window.visualViewport?.addEventListener('scroll', schedule, { passive: true });
    window.screen.orientation?.addEventListener('change', schedule);
    this.touchScreen.addEventListener('change', schedule);
    window.addEventListener('castle-role:android-viewport-change', schedule);
  }

  private apply(): void {
    const viewport = window.visualViewport;
    const physicalWidth = Math.max(1, Math.round(viewport?.width ?? window.innerWidth));
    const physicalHeight = Math.max(1, Math.round(viewport?.height ?? window.innerHeight));
    const isTouchDevice = this.touchScreen.matches ||
      /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const rotate = isTouchDevice && physicalHeight > physicalWidth;
    const logicalWidth = rotate ? physicalHeight : physicalWidth;
    const logicalHeight = rotate ? physicalWidth : physicalHeight;
    const signature = [physicalWidth, physicalHeight, Number(rotate)].join(':');

    this.root.style.setProperty('--game-physical-width', physicalWidth + 'px');
    this.root.style.setProperty('--game-physical-height', physicalHeight + 'px');
    this.root.style.setProperty('--game-logical-width', logicalWidth + 'px');
    this.root.style.setProperty('--game-logical-height', logicalHeight + 'px');
    this.root.dataset.gameOrientation = rotate ? 'software-landscape' : 'natural-landscape';

    if (signature !== this.previous) {
      this.previous = signature;
      window.dispatchEvent(new CustomEvent(SOFTWARE_LANDSCAPE_CHANGE_EVENT, {
        detail: { physicalWidth, physicalHeight, logicalWidth, logicalHeight, rotated: rotate },
      }));
      // Three.js and responsive menus use the normal resize event. Defer until
      // the new layout has been applied to obtain correct canvas client sizes.
      requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    }
  }
}
