import * as THREE from 'three';

/** Metrics are an estimate of replaced opaque draw submissions, not measured GPU calls. */
export interface CastleBoxBatchStats {
  batches: number;
  instances: number;
  removedDrawables: number;
  estimatedDrawCallsSaved: number;
}

type BoxCandidate = {
  mesh: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>;
  width: number;
  height: number;
  depth: number;
};

/**
 * Instance repeated *static* box details only inside their original parent group.
 *
 * Keeping the parent hierarchy intact preserves wall/keep roots, selection metadata,
 * construction transforms, local rotations, and neighborhood replacement semantics.
 * Never collapse flags, interactive meshes, animated nodes, transparent geometry,
 * arbitrary geometries, or nodes carrying gameplay metadata.
 */
export function instanceStaticCastleBoxes(root: THREE.Object3D): CastleBoxBatchStats {
  const stats: CastleBoxBatchStats = {
    batches: 0,
    instances: 0,
    removedDrawables: 0,
    estimatedDrawCallsSaved: 0,
  };

  const visit = (parent: THREE.Object3D): void => {
    if (parent.userData.ambientSway || parent.userData.castleFlag) return;

    // Snapshot before mutation: new instances should not be traversed again.
    const children = [...parent.children];
    const byMaterialAndState = new Map<string, BoxCandidate[]>();

    for (const child of children) {
      if (!(child instanceof THREE.Mesh) || child instanceof THREE.InstancedMesh) continue;
      if (!(child.geometry instanceof THREE.BoxGeometry)) continue;
      if (!(child.material instanceof THREE.MeshStandardMaterial)) continue;
      if (child.material.transparent || child.material.opacity !== 1 || !child.material.depthWrite) continue;
      if (!child.visible || child.children.length > 0 || Object.keys(child.userData).length > 0) continue;
      if (child.morphTargetInfluences?.length || child.isSkinnedMesh) continue;

      const box = child.geometry;
      const { width, height, depth, widthSegments, heightSegments, depthSegments } = box.parameters;
      if (![width, height, depth].every((value) => Number.isFinite(value) && value > 0)) continue;
      if (widthSegments !== 1 || heightSegments !== 1 || depthSegments !== 1) continue;

      // Geometries baked with translations/scales are not equivalent to a unit cube.
      box.computeBoundingBox();
      const bounds = box.boundingBox;
      if (!bounds ||
          Math.abs(bounds.min.x + width / 2) > 1e-4 ||
          Math.abs(bounds.max.x - width / 2) > 1e-4 ||
          Math.abs(bounds.min.y + height / 2) > 1e-4 ||
          Math.abs(bounds.max.y - height / 2) > 1e-4 ||
          Math.abs(bounds.min.z + depth / 2) > 1e-4 ||
          Math.abs(bounds.max.z - depth / 2) > 1e-4) continue;

      const key = [
        child.material.uuid, child.castShadow, child.receiveShadow,
        child.renderOrder, child.layers.mask, child.frustumCulled,
      ].join(':');
      const bucket = byMaterialAndState.get(key) ?? [];
      bucket.push({ mesh: child as THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>, width, height, depth });
      byMaterialAndState.set(key, bucket);
    }

    for (const bucket of byMaterialAndState.values()) {
      if (bucket.length < 2) continue;
      const first = bucket[0].mesh;
      const geometry = new THREE.BoxGeometry(1, 1, 1);
      const batch = new THREE.InstancedMesh(geometry, first.material, bucket.length);
      batch.name = 'castle-static-box-batch';
      batch.castShadow = first.castShadow;
      batch.receiveShadow = first.receiveShadow;
      batch.renderOrder = first.renderOrder;
      batch.layers.mask = first.layers.mask;
      batch.frustumCulled = first.frustumCulled;
      batch.userData.castleBoxBatch = { instances: bucket.length };

      const matrix = new THREE.Matrix4();
      const scale = new THREE.Matrix4();
      for (let index = 0; index < bucket.length; index += 1) {
        const { mesh, width, height, depth } = bucket[index];
        mesh.updateMatrix();
        matrix.copy(mesh.matrix).multiply(scale.makeScale(width, height, depth));
        batch.setMatrixAt(index, matrix);
        parent.remove(mesh);
        // All eligible geometries are ordinary, independently constructed boxes.
        // GPU disposal is safe after their source drawables leave this parent.
        mesh.geometry.dispose();
      }
      batch.instanceMatrix.needsUpdate = true;
      batch.computeBoundingSphere();
      parent.add(batch);

      stats.batches += 1;
      stats.instances += bucket.length;
      stats.removedDrawables += bucket.length;
      stats.estimatedDrawCallsSaved += bucket.length - 1;
    }

    for (const child of children) {
      if (child.parent === parent && !(child instanceof THREE.Mesh)) visit(child);
    }
  };

  visit(root);
  return stats;
}
