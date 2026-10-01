export interface TouchPoint {
  pointerId: number;
  clientX: number;
  clientY: number;
}

export interface TouchCameraDelta {
  fingers: 1 | 2;
  dx: number;
  dy: number;
  scale: number;
}

export type TouchIntent = 'tap' | 'stroke' | 'camera' | 'blocked';

interface TrackedPoint extends TouchPoint {
  startX: number;
  startY: number;
  travelled: boolean;
}

/** Owns a whole touch sequence. Once navigation/cancellation wins, no remaining
 * finger can turn back into a build tap, even after returning to its origin. */
export class TouchGestureSession {
  private readonly points = new Map<number, TrackedPoint>();
  private intent: TouchIntent = 'tap';
  private navigating = false;
  private baseline: { x: number; y: number; distance: number } | null = null;

  constructor(
    private readonly cancelAction: () => void,
    private readonly moveCamera: (delta: TouchCameraDelta) => void,
    private readonly threshold = 6,
  ) {}

  has(pointerId: number): boolean { return this.points.has(pointerId); }
  get pointerIds(): number[] { return [...this.points.keys()]; }

  down(point: TouchPoint, intent: TouchIntent): boolean {
    if (this.points.has(point.pointerId)) return false;
    if (this.points.size === 0) {
      this.intent = intent;
      this.navigating = intent === 'camera' || intent === 'blocked';
    }
    this.points.set(point.pointerId, { ...point, startX: point.clientX, startY: point.clientY, travelled: false });
    if (this.points.size > 1) {
      this.navigating = true;
      if (this.intent !== 'blocked') this.cancelAction();
    }
    this.rebase();
    return !this.navigating;
  }

  move(point: TouchPoint): boolean {
    const tracked = this.points.get(point.pointerId);
    if (!tracked) return false;
    this.track(tracked, point);
    if (!this.navigating && this.intent === 'tap' && tracked.travelled) {
      this.navigating = true;
      this.cancelAction();
    }
    const next = this.measure();
    if (this.navigating && this.intent !== 'blocked' && next && this.baseline) {
      this.moveCamera({ fingers: this.points.size === 2 ? 2 : 1,
        dx: next.x - this.baseline.x, dy: next.y - this.baseline.y,
        // Coincident fingers cannot provide a meaningful zoom baseline.
        scale: next.distance > 2 && this.baseline.distance > 2 ? next.distance / this.baseline.distance : 1 });
    }
    this.baseline = next;
    return !this.navigating;
  }

  up(point: TouchPoint): boolean {
    const tracked = this.points.get(point.pointerId);
    if (!tracked) return false;
    this.track(tracked, point);
    const action = !this.navigating && (this.intent === 'stroke' || !tracked.travelled);
    if (!action && !this.navigating) this.cancelAction();
    this.points.delete(point.pointerId);
    this.rebase();
    return action;
  }

  cancel(pointerId: number): void {
    if (!this.points.delete(pointerId)) return;
    this.navigating = true;
    if (this.intent !== 'blocked') this.cancelAction();
    this.rebase();
  }

  interrupt(): void {
    if (this.points.size && this.intent !== 'blocked') this.cancelAction();
    this.points.clear();
    this.rebase();
  }

  private track(tracked: TrackedPoint, point: TouchPoint): void {
    tracked.clientX = point.clientX;
    tracked.clientY = point.clientY;
    tracked.travelled ||= Math.hypot(point.clientX - tracked.startX, point.clientY - tracked.startY) > this.threshold;
  }

  private measure(): { x: number; y: number; distance: number } | null {
    const points = [...this.points.values()];
    if (points.length === 1) return { x: points[0].clientX, y: points[0].clientY, distance: 0 };
    if (points.length !== 2) return null; // Ignore ambiguous three-or-more-finger gestures.
    const [a, b] = points;
    return { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2,
      distance: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) };
  }

  private rebase(): void { this.baseline = this.measure(); }
}
