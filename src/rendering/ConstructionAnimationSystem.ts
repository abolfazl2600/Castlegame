import * as THREE from 'three';

interface Part {
  mesh: THREE.Mesh;
  visible: boolean;
  y: number;
  stage: number;
}

interface Animation {
  key: string;
  root: THREE.Object3D;
  startedAt: number;
  duration: number;
  parts: Part[];
  manual: boolean;
  progress: number;
}

/** Short-lived presentation state. The authoritative building exists before start(). */
export class ConstructionAnimationSystem {
  private readonly active = new Map<string, Animation>();

  start(key: string, root: THREE.Object3D, now: number, duration: number, manual = false, progress = 0): void {
    this.cancel(key);
    const animation: Animation = { key, root, startedAt: now, duration, parts: this.partsFor(root), manual, progress };
    if (animation.parts.length === 0) return;
    this.active.set(key, animation);
    this.apply(animation, progress, false);
  }

  rebind(resolve: (key: string) => THREE.Object3D | undefined): void {
    for (const [key, animation] of this.active) {
      const next = resolve(key);
      if (!next) {
        this.active.delete(key);
        continue;
      }
      if (next === animation.root) continue;
      animation.root = next;
      animation.parts = this.partsFor(next);
      this.apply(animation, animation.progress, false);
    }
  }

  update(now: number, reducedMotion: boolean): string[] {
    const completed: string[] = [];
    for (const [key, animation] of this.active) {
      if (animation.manual) continue;
      const duration = reducedMotion ? Math.min(120, animation.duration) : animation.duration;
      const progress = Math.min(1, Math.max(0, (now - animation.startedAt) / duration));
      animation.progress = progress;
      this.apply(animation, progress, reducedMotion);
      if (progress >= 1) {
        this.active.delete(key);
        completed.push(key);
      }
    }
    return completed;
  }

  /** Real work projects advance their visuals from completed worker time.
   * Reduced-motion changes only presentation, never project completion time. */
  setProgress(key: string, progress: number, reducedMotion = false): void {
    const animation = this.active.get(key);
    if (!animation || !animation.manual) return;
    animation.progress = Math.min(1, Math.max(0, progress));
    this.apply(animation, animation.progress, reducedMotion);
  }

  cancel(key: string): void {
    const animation = this.active.get(key);
    if (!animation) return;
    for (const part of animation.parts) {
      part.mesh.visible = part.visible;
      part.mesh.position.y = part.y;
      delete part.mesh.userData.constructionHidden;
    }
    this.active.delete(key);
  }

  clear(): void {
    for (const key of [...this.active.keys()]) this.cancel(key);
  }

  get count(): number { return this.active.size; }

  private partsFor(root: THREE.Object3D): Part[] {
    root.updateWorldMatrix(true, true);
    const meshes: THREE.Mesh[] = [];
    root.traverse((object) => {
      if (object instanceof THREE.Mesh && object.visible) meshes.push(object);
    });
    if (meshes.length === 0) return [];
    const bounds = new THREE.Box3();
    for (const mesh of meshes) bounds.expandByObject(mesh);
    const range = Math.max(0.1, bounds.max.y - bounds.min.y);
    const box = new THREE.Box3();
    return meshes.map((mesh) => {
      box.setFromObject(mesh);
      const center = (box.min.y + box.max.y) / 2;
      const fraction = (center - bounds.min.y) / range;
      const size = box.getSize(new THREE.Vector3());
      const small = size.x * size.y * size.z < 0.12;
      return {
        mesh, visible: mesh.visible, y: mesh.position.y,
        stage: small && fraction > 0.25 ? 3 : fraction < 0.22 ? 0 : fraction < 0.66 ? 1 : 2,
      };
    });
  }

  private apply(animation: Animation, progress: number, reducedMotion: boolean): void {
    for (const part of animation.parts) {
      const start = part.stage * 0.22;
      const local = Math.min(1, Math.max(0, (progress - start) / 0.22));
      part.mesh.visible = part.visible && (progress >= start || (!animation.manual && reducedMotion));
      part.mesh.userData.constructionHidden = !part.mesh.visible;
      part.mesh.position.y = part.y - (reducedMotion ? 0 : (1 - local) * 0.22);
      if (progress >= 1) {
        part.mesh.visible = part.visible;
        part.mesh.position.y = part.y;
        delete part.mesh.userData.constructionHidden;
      }
    }
  }
}
