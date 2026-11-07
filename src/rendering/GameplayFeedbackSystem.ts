import * as THREE from 'three';

export type GameplayCueKind = 'construction' | 'impact' | 'destruction' | 'victory';
export type FeedbackQuality = 'low' | 'medium' | 'high';

interface ActiveParticle {
  mesh: THREE.Mesh;
  kind: 'spark' | 'ring';
  elapsed: number;
  lifetime: number;
  baseScale: number;
  speedX: number;
  speedY: number;
  speedZ: number;
}

/**
 * Ephemeral world-space feedback; no save-state mutations, animation timers or
 * per-frame geometry/material allocations. All effects are bounded for Android.
 */
export class GameplayFeedbackSystem {
  readonly layer = new THREE.Group();

  private readonly sparkGeometry = new THREE.OctahedronGeometry(0.16, 0);
  private readonly ringGeometry = new THREE.RingGeometry(0.56, 0.72, 24);
  private readonly sparkMaterials: Record<GameplayCueKind, THREE.MeshBasicMaterial> = {
    construction: new THREE.MeshBasicMaterial({ color: 0xffd47a, transparent: true, opacity: 0.88, depthWrite: false }),
    impact: new THREE.MeshBasicMaterial({ color: 0xffb57a, transparent: true, opacity: 0.9, depthWrite: false }),
    destruction: new THREE.MeshBasicMaterial({ color: 0xbfa38a, transparent: true, opacity: 0.74, depthWrite: false }),
    victory: new THREE.MeshBasicMaterial({ color: 0xffe28b, transparent: true, opacity: 0.9, depthWrite: false }),
  };
  private readonly ringMaterials: Record<GameplayCueKind, THREE.MeshBasicMaterial> = {
    construction: new THREE.MeshBasicMaterial({ color: 0xffd47a, transparent: true, opacity: 0.48, depthWrite: false, side: THREE.DoubleSide }),
    impact: new THREE.MeshBasicMaterial({ color: 0xff9a66, transparent: true, opacity: 0.46, depthWrite: false, side: THREE.DoubleSide }),
    destruction: new THREE.MeshBasicMaterial({ color: 0xc6ad93, transparent: true, opacity: 0.48, depthWrite: false, side: THREE.DoubleSide }),
    victory: new THREE.MeshBasicMaterial({ color: 0xffde79, transparent: true, opacity: 0.58, depthWrite: false, side: THREE.DoubleSide }),
  };
  private readonly active: ActiveParticle[] = [];
  private serial = 0;

  get count(): number { return this.active.length; }

  spawn(kind: GameplayCueKind, x: number, y: number, z: number, quality: FeedbackQuality): void {
    if (![x, y, z].every(Number.isFinite)) return;
    const capacity = quality === 'low' ? 36 : quality === 'medium' ? 86 : 144;
    const sparks = quality === 'low' ? 3 : quality === 'medium' ? 6 : 10;
    const count = kind === 'victory' ? sparks + 5 : kind === 'destruction' ? sparks + 2 : sparks;
    if (this.active.length >= capacity) return;
    const available = capacity - this.active.length;
    const serial = this.serial++;
    const rings = kind === 'victory' ? 2 : 1;
    for (let i = 0; i < Math.min(rings, available); i += 1) {
      const mesh = new THREE.Mesh(this.ringGeometry, this.ringMaterials[kind]);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(x, y + 0.08 + i * 0.1, z);
      this.layer.add(mesh);
      this.active.push({
        mesh, kind: 'ring', elapsed: 0,
        lifetime: kind === 'victory' ? 1.3 + i * 0.25 : kind === 'destruction' ? 0.66 : 0.42,
        baseScale: kind === 'victory' ? 2.3 + i * 1.1 : kind === 'destruction' ? 1.2 : 0.72,
        speedX: 0, speedY: 0, speedZ: 0,
      });
    }
    for (let i = 0; i < count && this.active.length < capacity; i += 1) {
      const angle = i * 2.3999632297 + serial * 0.37;
      const speed = kind === 'victory' ? 3.1 : kind === 'destruction' ? 1.8 : 1.45;
      const mesh = new THREE.Mesh(this.sparkGeometry, this.sparkMaterials[kind]);
      mesh.position.set(x, y + (kind === 'victory' ? 0.6 : 0.24), z);
      this.layer.add(mesh);
      this.active.push({
        mesh, kind: 'spark', elapsed: 0,
        lifetime: kind === 'victory' ? 1.3 : kind === 'destruction' ? 0.75 : 0.44,
        baseScale: kind === 'victory' ? 0.88 : kind === 'destruction' ? 1.18 : 0.75,
        speedX: Math.cos(angle) * speed,
        speedY: kind === 'victory' ? 3.8 + (i % 3) * 0.65 :
          kind === 'destruction' ? 1.3 + (i % 3) * 0.35 : 2.1 + (i % 3) * 0.25,
        speedZ: Math.sin(angle) * speed,
      });
    }
  }

  update(deltaMs: number, enabled: boolean): void {
    if (!enabled) {
      this.clear();
      return;
    }
    const dt = Number.isFinite(deltaMs) ? Math.max(0, Math.min(0.05, deltaMs / 1000)) : 0;
    for (let i = this.active.length - 1; i >= 0; i -= 1) {
      const item = this.active[i];
      item.elapsed += dt;
      const progress = Math.min(1, item.elapsed / item.lifetime);
      if (progress >= 1) {
        this.layer.remove(item.mesh);
        this.active.splice(i, 1);
        continue;
      }
      if (item.kind === 'ring') {
        item.mesh.scale.setScalar(item.baseScale * (0.45 + 1.7 * progress) * (1 - progress * 0.65));
      } else {
        item.mesh.position.x += item.speedX * dt;
        item.mesh.position.y += item.speedY * dt;
        item.mesh.position.z += item.speedZ * dt;
        item.speedY -= 5.6 * dt;
        item.mesh.scale.setScalar(item.baseScale * Math.max(0.12, 1 - progress));
      }
    }
  }

  clear(): void {
    for (const item of this.active) this.layer.remove(item.mesh);
    this.active.length = 0;
  }

  dispose(): void {
    this.clear();
    this.sparkGeometry.dispose();
    this.ringGeometry.dispose();
    for (const material of Object.values(this.sparkMaterials)) material.dispose();
    for (const material of Object.values(this.ringMaterials)) material.dispose();
  }
}
