import * as THREE from 'three';

export interface AmbientMotionOptions {
  effectsEnabled: boolean;
  reducedMotion: boolean;
  quality: 'low' | 'medium' | 'high';
  environmentDetail: 'low' | 'medium' | 'high';
  performanceMode: 'balanced' | 'performance' | 'quality';
  cameraDistance: number;
  normalDistance: number;
  strategicDistance: number;
  budgetScale?: number;
}

interface MotionEntry {
  object: THREE.Object3D;
  basePosition: THREE.Vector3;
  baseRotation: THREE.Euler;
  baseScale: THREE.Vector3;
  phase: number;
  amplitude: number;
  speed: number;
}

interface TextureFlow {
  texture: THREE.Texture;
  xPerMs: number;
  yPerMs: number;
}

interface CloudDrift {
  object: THREE.Object3D;
  speedPerMs: number;
  wrapMinX: number;
  wrapMaxX: number;
}

export interface AmbientMotionStats {
  flags: number;
  sways: number;
  bobs: number;
  smokes: number;
  clouds: number;
  waterFlows: number;
}

/**
 * Shared, lightweight motion registry for non-gameplay world animation.
 *
 * The system owns no gameplay state. It only animates registered render objects
 * and texture offsets, and it can be cleared independently whenever build
 * geometry is redrawn.
 */
export class AmbientMotionSystem {
  private readonly textureFlows: TextureFlow[] = [];
  private readonly flags: MotionEntry[] = [];
  private readonly sways: MotionEntry[] = [];
  private readonly bobs: MotionEntry[] = [];
  private readonly smokes: MotionEntry[] = [];
  private readonly clouds: CloudDrift[] = [];
  private frame = 0;

  registerTextureFlow(texture: THREE.Texture, xPerMs: number, yPerMs: number): void {
    if (this.textureFlows.some((entry) => entry.texture === texture)) return;
    this.textureFlows.push({ texture, xPerMs, yPerMs });
  }

  registerFlag(object: THREE.Object3D, phase = 0): void {
    this.flags.push(this.entry(object, phase, 0.08, 0.0032));
  }

  registerSway(object: THREE.Object3D, phase: number, amplitude = 0.035, speed = 0.00135): void {
    this.sways.push(this.entry(object, phase, amplitude, speed));
  }

  registerBob(object: THREE.Object3D, phase: number, amplitude = 0.1, speed = 0.00145): void {
    this.bobs.push(this.entry(object, phase, amplitude, speed));
  }

  registerSmoke(object: THREE.Object3D, phase: number, rise = 0.34, speed = 0.00022): void {
    this.smokes.push(this.entry(object, phase, rise, speed));
  }

  registerCloud(object: THREE.Object3D, speedPerMs: number, wrapMinX: number, wrapMaxX: number): void {
    this.clouds.push({ object, speedPerMs, wrapMinX, wrapMaxX });
  }

  clearSceneBound(): void {
    this.restoreEntries(this.flags);
    this.restoreEntries(this.sways);
    this.restoreEntries(this.bobs);
    this.restoreEntries(this.smokes);
    this.flags.length = 0;
    this.sways.length = 0;
    this.bobs.length = 0;
    this.smokes.length = 0;
  }

  update(deltaMs: number, timeMs: number, options: AmbientMotionOptions): number {
    const intensity = this.motionScale(options);
    if (intensity <= 0) {
      this.restoreEntries(this.flags);
      this.restoreEntries(this.sways);
      this.restoreEntries(this.bobs);
      this.restoreEntries(this.smokes);
      return 0;
    }

    const clampedDelta = Math.max(0, Math.min(50, deltaMs));
    for (const flow of this.textureFlows) {
      flow.texture.offset.x += flow.xPerMs * clampedDelta * intensity;
      flow.texture.offset.y += flow.yPerMs * clampedDelta * intensity;
    }

    for (const cloud of this.clouds) {
      cloud.object.position.x += cloud.speedPerMs * clampedDelta * intensity;
      if (cloud.object.position.x > cloud.wrapMaxX) cloud.object.position.x = cloud.wrapMinX;
      else if (cloud.object.position.x < cloud.wrapMinX) cloud.object.position.x = cloud.wrapMaxX;
    }

    this.frame += 1;
    const cadence = this.updateCadence(options);
    if (this.frame % cadence !== 0) return intensity;

    for (const flag of this.flags) {
      const wave = Math.sin(timeMs * flag.speed + flag.phase);
      flag.object.rotation.y = flag.baseRotation.y + wave * flag.amplitude * intensity;
      flag.object.scale.x = flag.baseScale.x * (0.94 + Math.abs(wave) * 0.09 * intensity);
    }

    for (const sway of this.sways) {
      const wave = Math.sin(timeMs * sway.speed + sway.phase);
      sway.object.rotation.z = sway.baseRotation.z + wave * sway.amplitude * intensity;
      sway.object.rotation.x = sway.baseRotation.x + Math.cos(timeMs * sway.speed * 0.73 + sway.phase) * sway.amplitude * 0.42 * intensity;
    }

    for (const bob of this.bobs) {
      const wave = Math.sin(timeMs * bob.speed + bob.phase);
      bob.object.position.y = bob.basePosition.y + wave * bob.amplitude * intensity;
      bob.object.rotation.z = bob.baseRotation.z + wave * 0.018 * intensity;
      bob.object.rotation.x = bob.baseRotation.x + Math.cos(timeMs * bob.speed * 0.81 + bob.phase) * 0.012 * intensity;
    }

    for (const smoke of this.smokes) {
      const cycle = ((timeMs * smoke.speed + smoke.phase) % 1 + 1) % 1;
      const drift = Math.sin(timeMs * 0.0011 + smoke.phase * Math.PI * 2);
      smoke.object.position.y = smoke.basePosition.y + cycle * smoke.amplitude * intensity;
      smoke.object.position.x = smoke.basePosition.x + drift * 0.08 * intensity;
      const scale = 0.88 + cycle * 0.24 * intensity;
      smoke.object.scale.set(
        smoke.baseScale.x * scale,
        smoke.baseScale.y * scale,
        smoke.baseScale.z * scale,
      );
    }

    return intensity;
  }

  motionScale(options: AmbientMotionOptions): number {
    if (!options.effectsEnabled || options.reducedMotion) return 0;

    const quality =
      options.quality === 'low' ? 0.38 :
      options.quality === 'medium' ? 0.72 :
      1;
    const detail =
      options.environmentDetail === 'low' ? 0.52 :
      options.environmentDetail === 'medium' ? 0.78 :
      1;
    const performance =
      options.performanceMode === 'performance' ? 0.62 :
      options.performanceMode === 'balanced' ? 0.86 :
      1;

    const normal = Math.max(1, options.normalDistance);
    const strategic = Math.max(normal + 1, options.strategicDistance);
    let distance = 1;
    if (options.cameraDistance > normal) {
      const t = THREE.MathUtils.clamp(
        (options.cameraDistance - normal) / (strategic - normal),
        0,
        1,
      );
      distance = THREE.MathUtils.lerp(1, 0.28, t);
    }
    if (options.cameraDistance >= strategic) distance = 0.2;

    const budget = THREE.MathUtils.clamp(options.budgetScale ?? 1, 0, 1);
    return THREE.MathUtils.clamp(quality * detail * performance * distance * budget, 0, 1);
  }

  stats(): AmbientMotionStats {
    return {
      flags: this.flags.length,
      sways: this.sways.length,
      bobs: this.bobs.length,
      smokes: this.smokes.length,
      clouds: this.clouds.length,
      waterFlows: this.textureFlows.length,
    };
  }

  private entry(
    object: THREE.Object3D,
    phase: number,
    amplitude: number,
    speed: number,
  ): MotionEntry {
    return {
      object,
      basePosition: object.position.clone(),
      baseRotation: object.rotation.clone(),
      baseScale: object.scale.clone(),
      phase,
      amplitude,
      speed,
    };
  }

  private restoreEntries(entries: readonly MotionEntry[]): void {
    for (const entry of entries) {
      entry.object.position.copy(entry.basePosition);
      entry.object.rotation.copy(entry.baseRotation);
      entry.object.scale.copy(entry.baseScale);
    }
  }

  private updateCadence(options: AmbientMotionOptions): number {
    if (
      options.quality === 'low' ||
      options.environmentDetail === 'low' ||
      options.performanceMode === 'performance'
    ) return 3;
    if (
      options.quality === 'medium' ||
      options.environmentDetail === 'medium' ||
      options.performanceMode === 'balanced'
    ) return 2;
    return 1;
  }
}
