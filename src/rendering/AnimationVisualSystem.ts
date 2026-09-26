import * as THREE from 'three';

export type AnimationState = 'IDLE' | 'MOVE' | 'ATTACK' | 'HIT' | 'DEATH';

export type VisualQuality = 'low' | 'medium' | 'high';

export interface AnimationVisualConfig {
  effectsEnabled: boolean;
  quality: VisualQuality;
  reducedMotion: boolean;
  combatFeedback: boolean;
}

interface EffectInstance {
  root: THREE.Group;
  life: number;
  maxLife: number;
  kind: 'impact' | 'explosion' | 'death' | 'construction' | 'damage';
  particles: THREE.Mesh[];
}

interface UnitVisualState {
  state: AnimationState;
  moving: boolean;
  hitUntil: number;
  deathStarted: boolean;
}

const DEFAULT_CONFIG: AnimationVisualConfig = {
  effectsEnabled: true,
  quality: 'high',
  reducedMotion: false,
  combatFeedback: true,
};

const QUALITY_LIMITS: Record<VisualQuality, number> = {
  low: 28,
  medium: 55,
  high: 90,
};

export class AnimationVisualSystem {
  private readonly layer: THREE.Group;
  private readonly camera?: THREE.Camera;
  private readonly effects: EffectInstance[] = [];
  private readonly units = new Map<string, UnitVisualState>();
  private readonly burstGeometry = new THREE.IcosahedronGeometry(0.11, 0);
  private readonly ringGeometry = new THREE.RingGeometry(0.18, 0.26, 16);
  private readonly flashGeometry = new THREE.SphereGeometry(0.18, 8, 8);
  private readonly particleMaterials = new Map<string, THREE.MeshBasicMaterial>();
  private config: AnimationVisualConfig = { ...DEFAULT_CONFIG };
  private elapsed = 0;
  private resultBanner: HTMLDivElement | null = null;

  constructor(layer: THREE.Group, camera?: THREE.Camera) {
    this.layer = layer;
    this.camera = camera;
  }

  setConfig(config: Partial<AnimationVisualConfig>): void {
    this.config = { ...this.config, ...config };
    if (!this.config.effectsEnabled) this.clearEffects();
  }

  syncUnit(
    id: string,
    gameplayState: string,
    moving: boolean,
    view: THREE.Object3D,
  ): AnimationState {
    let state: AnimationState;
    if (gameplayState === 'dead') state = 'DEATH';
    else if (gameplayState === 'attacking') state = 'ATTACK';
    else if (moving || gameplayState === 'moving' || gameplayState === 'forming') state = 'MOVE';
    else state = 'IDLE';

    const previous = this.units.get(id);
    if (!previous) {
      this.units.set(id, { state, moving, hitUntil: 0, deathStarted: state === 'DEATH' });
    } else {
      previous.state = state;
      previous.moving = moving;
      if (state === 'DEATH') previous.deathStarted = true;
    }

    view.userData.animationState = state;
    return state;
  }

  unitAttack(position: THREE.Vector3, ranged = false): void {
    if (!this.canPlayPrimaryEffect()) return;
    this.spawnImpact(position, ranged ? 0.75 : 0.6, ranged ? 'impact' : 'damage');
  }

  unitHit(position: THREE.Vector3, damage: number): void {
    if (!this.config.combatFeedback) return;
    const id = Math.max(0, Math.round(damage));
    this.spawnDamageFeedback(position, id);
    this.spawnImpact(position, 0.52, 'impact');
  }

  unitDeath(id: string, position: THREE.Vector3): void {
    const state = this.units.get(id) ?? {
      state: 'DEATH' as AnimationState,
      moving: false,
      hitUntil: 0,
      deathStarted: true,
    };
    state.state = 'DEATH';
    state.deathStarted = true;
    this.units.set(id, state);
    if (this.canPlayPrimaryEffect()) this.spawnDeath(position);
  }

  projectileSpawn(position: THREE.Vector3, color = 0xd9b66d): void {
    if (!this.canPlayPrimaryEffect()) return;
    const marker = new THREE.Mesh(
      this.flashGeometry,
      this.getMaterial('projectile', color, 0.75),
    );
    marker.scale.setScalar(0.18);
    marker.position.copy(position);
    marker.userData.visualProjectileOrigin = true;
    this.layer.add(marker);
    const effect: EffectInstance = {
      root: new THREE.Group(),
      life: 0.12,
      maxLife: 0.12,
      kind: 'impact',
      particles: [marker],
    };
    this.effects.push(effect);
    this.trimEffects();
  }

  projectileImpact(position: THREE.Vector3, explosive = false): void {
    if (!this.canPlayPrimaryEffect()) return;
    if (explosive) this.spawnExplosion(position);
    else this.spawnImpact(position, 0.72, 'impact');
  }

  wallImpact(position: THREE.Vector3): void {
    if (!this.canPlayPrimaryEffect()) return;
    this.spawnImpact(position, 0.9, 'damage');
  }

  wallDestroyed(position: THREE.Vector3): void {
    if (!this.canPlayPrimaryEffect()) return;
    this.spawnExplosion(position);
  }

  buildingDamage(position: THREE.Vector3, ratio: number): void {
    if (!this.config.combatFeedback || !this.canPlayPrimaryEffect()) return;
    if (ratio < 0.2 || this.elapsed % 0.16 > 0.04) return;
    this.spawnImpact(position, 0.5 + ratio * 0.25, 'damage');
  }

  construction(position: THREE.Vector3): void {
    if (!this.canPlayPrimaryEffect()) return;
    this.spawnImpact(position, 0.7, 'construction');
  }

  battleResult(result: 'victory' | 'defeat'): void {
    this.clearEffects();
    if (this.config.reducedMotion) return;

    this.resultBanner?.remove();
    const banner = document.createElement('div');
    banner.className = `castlegame-visual-result castlegame-visual-result--${result}`;
    banner.textContent = result === 'victory' ? 'VICTORY' : 'DEFEAT';
    banner.setAttribute('aria-hidden', 'true');
    document.body.appendChild(banner);
    this.resultBanner = banner;
    window.setTimeout(() => {
      if (this.resultBanner === banner) {
        banner.remove();
        this.resultBanner = null;
      }
    }, 1500);
  }

  update(deltaSeconds: number): void {
    this.elapsed += Math.max(0, deltaSeconds);
    if (this.effects.length === 0) return;

    for (let i = this.effects.length - 1; i >= 0; i -= 1) {
      const effect = this.effects[i];
      effect.life -= deltaSeconds;
      const progress = 1 - Math.max(0, effect.life) / effect.maxLife;
      const eased = 1 - Math.pow(1 - progress, 2);

      if (effect.kind === 'explosion' || effect.kind === 'impact' || effect.kind === 'damage' || effect.kind === 'construction') {
        effect.root.scale.setScalar(0.65 + eased * 1.15);
      }

      for (let p = 0; p < effect.particles.length; p += 1) {
        const particle = effect.particles[p];
        const direction = particle.userData.visualDirection as THREE.Vector3 | undefined;
        if (direction) particle.position.addScaledVector(direction, deltaSeconds * (1.5 + p * 0.35));
        particle.rotation.x += deltaSeconds * (1.5 + p);
        particle.rotation.y += deltaSeconds * (1.1 + p * 0.6);
        particle.scale.setScalar(Math.max(0.05, 1 - eased * 0.85));
      }

      if (effect.life <= 0) {
        for (const particle of effect.particles) {
          this.disposeObject(particle);
        }
        effect.root.clear();
        this.layer.remove(effect.root);
        this.effects.splice(i, 1);
      }
    }
  }

  clear(): void {
    this.clearEffects();
    this.units.clear();
    this.resultBanner?.remove();
    this.resultBanner = null;
  }

  dispose(): void {
    this.clear();
    this.burstGeometry.dispose();
    this.ringGeometry.dispose();
    this.flashGeometry.dispose();
    for (const material of this.particleMaterials.values()) material.dispose();
    this.particleMaterials.clear();
  }

  private canPlayPrimaryEffect(): boolean {
    return this.config.effectsEnabled && this.config.combatFeedback && !this.config.reducedMotion;
  }

  private spawnImpact(position: THREE.Vector3, scale: number, kind: EffectInstance['kind']): void {
    if (!this.canPlayPrimaryEffect()) return;
    const root = new THREE.Group();
    root.position.copy(position);
    root.position.y += 0.15;

    const ring = new THREE.Mesh(
      this.ringGeometry,
      this.getMaterial(`ring-${kind}`, kind === 'damage' ? 0xe0a64b : 0xf4d27b, 0.82),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.scale.setScalar(scale);
    root.add(ring);

    const particles = this.createParticles(root, kind === 'damage' ? 3 : 4, kind === 'damage' ? 0x8d7a62 : 0xf2c46f);
    root.scale.setScalar(0.7);
    this.layer.add(root);
    this.addEffect({ root, life: 0.22, maxLife: 0.22, kind, particles });
  }

  private spawnExplosion(position: THREE.Vector3): void {
    if (!this.canPlayPrimaryEffect()) return;
    const root = new THREE.Group();
    root.position.copy(position);

    const flash = new THREE.Mesh(
      this.flashGeometry,
      this.getMaterial('explosion-flash', 0xffd27a, 0.9),
    );
    root.add(flash);

    const particles = this.createParticles(
      root,
      this.config.quality === 'low' ? 4 : this.config.quality === 'medium' ? 6 : 8,
      0x8d7660,
    );
    root.scale.setScalar(0.6);
    this.layer.add(root);
    this.addEffect({ root, life: 0.5, maxLife: 0.5, kind: 'explosion', particles });
  }

  private spawnDeath(position: THREE.Vector3): void {
    const root = new THREE.Group();
    root.position.copy(position);
    const ring = new THREE.Mesh(
      this.ringGeometry,
      this.getMaterial('death', 0x6f6256, 0.62),
    );
    ring.rotation.x = -Math.PI / 2;
    root.add(ring);
    const particles = this.createParticles(root, this.config.quality === 'low' ? 2 : 3, 0x6f6256);
    this.layer.add(root);
    this.addEffect({ root, life: 0.38, maxLife: 0.38, kind: 'death', particles });
  }

  private spawnDamageFeedback(position: THREE.Vector3, damage: number): void {
    const root = new THREE.Group();
    root.position.copy(position);
    const flash = new THREE.Mesh(
      this.flashGeometry,
      this.getMaterial('damage-flash', 0xfff1cf, 0.72),
    );
    flash.scale.setScalar(0.22 + Math.min(0.35, damage / 160));
    root.add(flash);
    this.layer.add(root);
    this.addEffect({ root, life: 0.14, maxLife: 0.14, kind: 'damage', particles: [flash] });

    if (this.config.quality !== 'low') {
      const label = document.createElement('div');
      label.className = 'castlegame-damage-number';
      label.textContent = String(damage);
      label.style.left = '50%';
      label.style.top = '50%';
      label.style.transform = 'translate(-50%, -50%)';
      label.setAttribute('aria-hidden', 'true');
      document.body.appendChild(label);
      window.setTimeout(() => label.remove(), 480);
    }
  }

  private createParticles(root: THREE.Group, count: number, color: number): THREE.Mesh[] {
    const particles: THREE.Mesh[] = [];
    for (let i = 0; i < count; i += 1) {
      const particle = new THREE.Mesh(
        this.burstGeometry,
        this.getMaterial(`particle-${color.toString(16)}`, color, 0.78),
      );
      const angle = (i / Math.max(1, count)) * Math.PI * 2;
      const direction = new THREE.Vector3(Math.cos(angle), 0.45 + (i % 2) * 0.25, Math.sin(angle)).normalize();
      particle.userData.visualDirection = direction;
      particle.scale.setScalar(0.55 + (i % 3) * 0.18);
      root.add(particle);
      particles.push(particle);
    }
    return particles;
  }

  private addEffect(effect: EffectInstance): void {
    this.effects.push(effect);
    this.trimEffects();
  }

  private trimEffects(): void {
    const limit = QUALITY_LIMITS[this.config.quality];
    while (this.effects.length > limit) {
      const oldest = this.effects.shift();
      if (!oldest) break;
      for (const particle of oldest.particles) this.disposeObject(particle);
      this.layer.remove(oldest.root);
    }
  }

  private clearEffects(): void {
    for (const effect of this.effects) {
      for (const particle of effect.particles) this.disposeObject(particle);
      this.layer.remove(effect.root);
    }
    this.effects.length = 0;
  }

  private getMaterial(key: string, color: number, opacity: number): THREE.MeshBasicMaterial {
    const existing = this.particleMaterials.get(key);
    if (existing) return existing;
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: opacity < 1,
      opacity,
      depthWrite: false,
    });
    this.particleMaterials.set(key, material);
    return material;
  }

  private disposeObject(object: THREE.Object3D): void {
    if (object.parent) object.parent.remove(object);
  }
}
