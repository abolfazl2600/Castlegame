import * as THREE from 'three';

/**
 * Applies seasonal tints from the immutable factory color of each material.
 *
 * Blending from the previously tinted color towards a seasonal target on every
 * update compounds the tint beyond the authored strength. This registry keeps
 * only the original color for each live material; disposed materials need no
 * explicit cleanup because keys are weakly held.
 */
export class SeasonalMaterialTint {
  private readonly baseColors = new WeakMap<THREE.MeshStandardMaterial, THREE.Color>();

  register(material: THREE.MeshStandardMaterial, baseHex: number): void {
    this.baseColors.set(material, new THREE.Color(baseHex));
  }

  apply(material: THREE.MeshStandardMaterial, seasonalHex: number, strength: number, blend: number): void {
    const base = this.baseColors.get(material);
    if (!base) return;
    const desired = base.clone().lerp(
      new THREE.Color(seasonalHex),
      THREE.MathUtils.clamp(strength, 0, 1),
    );
    material.color.lerp(desired, THREE.MathUtils.clamp(blend, 0, 1));
  }

  target(material: THREE.MeshStandardMaterial, seasonalHex: number, strength: number): THREE.Color | null {
    const base = this.baseColors.get(material);
    if (!base) return null;
    return base.clone().lerp(new THREE.Color(seasonalHex), THREE.MathUtils.clamp(strength, 0, 1));
  }
}
