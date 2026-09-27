import * as THREE from 'three';

export interface WebGLDisposalOptions {
  /** Return true if the material is shared across structures and should NOT be disposed. */
  isSharedMaterial?: (material: THREE.Material) => boolean;
  /** Return true if the geometry is shared (e.g. unit box) and should NOT be disposed. */
  isSharedGeometry?: (geometry: THREE.BufferGeometry) => boolean;
  /** Return true if the texture is shared (e.g. procedural river/ocean) and should NOT be disposed. */
  isSharedTexture?: (texture: THREE.Texture) => boolean;
}

const TEXTURE_PROPERTY_KEYS = [
  'map',
  'bumpMap',
  'normalMap',
  'roughnessMap',
  'metalnessMap',
  'alphaMap',
  'emissiveMap',
  'lightMap',
  'aoMap',
  'envMap',
  'specularMap',
  'displacementMap',
] as const;

/**
 * Recursively disposes all GPU-allocated geometries, materials, and textures
 * attached to an Object3D subtree while honoring shared resource filters.
 */
export function disposeHierarchy(
  root: THREE.Object3D,
  options: WebGLDisposalOptions = {},
): void {
  root.traverse((object) => {
    // 1. Dispose mesh/line/points geometry if not shared
    const renderable = object as THREE.Mesh | THREE.Line | THREE.Points | THREE.Sprite;
    if (renderable.geometry instanceof THREE.BufferGeometry) {
      if (!options.isSharedGeometry || !options.isSharedGeometry(renderable.geometry)) {
        renderable.geometry.dispose();
      }
    }

    // 2. Dispose materials & child textures if not shared
    const rawMaterial = (object as { material?: THREE.Material | THREE.Material[] }).material;
    if (rawMaterial) {
      const materials = Array.isArray(rawMaterial) ? rawMaterial : [rawMaterial];
      for (const mat of materials) {
        if (!mat || (options.isSharedMaterial && options.isSharedMaterial(mat))) {
          continue;
        }

        // Dispose textures bound to this material instance
        const matRecord = mat as unknown as Record<string, unknown>;
        for (const key of TEXTURE_PROPERTY_KEYS) {
          const tex = matRecord[key];
          if (tex instanceof THREE.Texture) {
            if (!options.isSharedTexture || !options.isSharedTexture(tex)) {
              tex.dispose();
            }
          }
        }

        mat.dispose();
      }
    }
  });
}

/**
 * Clears and disposes all child objects and GPU resources within a Three.js Group.
 */
export function disposeGroup(
  group: THREE.Group | THREE.Object3D,
  options: WebGLDisposalOptions = {},
): void {
  disposeHierarchy(group, options);
  group.clear();
}
