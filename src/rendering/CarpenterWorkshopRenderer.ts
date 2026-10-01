import * as THREE from 'three';

export type CarpenterWorkshopLevel = 1 | 2 | 3;

function material(color: number, roughness = 1, metalness = 0): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function addBox(
  group: THREE.Group,
  width: number,
  height: number,
  depth: number,
  mat: THREE.Material,
  x: number,
  y: number,
  z: number,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function addLogStack(
  group: THREE.Group,
  count: number,
  x: number,
  z: number,
  timber: THREE.Material,
): void {
  for (let i = 0; i < count; i += 1) {
    const row = Math.floor(i / 3);
    const col = i % 3;
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 1.18, 8), timber);
    log.rotation.z = Math.PI / 2;
    log.position.set(x + (col - 1) * 0.28, 2.38 + row * 0.23, z);
    log.castShadow = true;
    group.add(log);
  }
}

export class CarpenterWorkshopRenderer {
  render(levelValue: number, seed = 0): THREE.Group {
    const level = Math.max(1, Math.min(3, Math.floor(levelValue || 1))) as CarpenterWorkshopLevel;
    const group = new THREE.Group();
    group.userData.settlementFamily = 'carpenter';
    group.userData.settlementReadabilityClass = level === 1 ? 'basic' : level === 2 ? 'established' : 'advanced';
    group.userData.carpenterLevel = level;

    const timber = material(0x6b4931);
    const timberLight = material(0x9a6a43);
    const timberDark = material(0x493121);
    const plank = material(0xb88755);
    const roof = material(level >= 3 ? 0x70483a : 0x80563e);
    const stone = material(0x8a877b);
    const iron = material(0x60666b, 0.58, 0.48);
    const canvas = material(0xb79d70);
    const soil = material(0x796049);

    addBox(group, 3.45, 0.16, 3.45, soil, 0, 2.2, 0);

    if (level === 1) {
      // Open starter yard: the work itself is the silhouette.
      addBox(group, 2.15, 1.65, 1.45, timberLight, 0.45, 3.02, 0.42);
      const roofMesh = new THREE.Mesh(new THREE.ConeGeometry(1.62, 1.08, 4), roof);
      roofMesh.rotation.y = Math.PI / 4;
      roofMesh.position.set(0.45, 4.2, 0.42);
      roofMesh.scale.z = 0.72;
      roofMesh.castShadow = true;
      group.add(roofMesh);

      addBox(group, 1.35, 0.16, 0.55, plank, -0.72, 2.72, -0.78);
      addBox(group, 0.12, 0.72, 0.12, timberDark, -1.18, 2.43, -0.78);
      addBox(group, 0.12, 0.72, 0.12, timberDark, -0.28, 2.43, -0.78);
      addLogStack(group, 6, -0.62, 1.12, timber);
    }

    if (level >= 2) {
      // A clear timber-framed workshop with a covered cutting bay.
      addBox(group, 2.5, 2.25, 1.75, timberLight, 0.3, 3.35, 0.32);
      addBox(group, 2.72, 0.2, 1.96, timberDark, 0.3, 2.3, 0.32);

      const roofMesh = new THREE.Mesh(new THREE.ConeGeometry(1.9, 1.35, 4), roof);
      roofMesh.rotation.y = Math.PI / 4;
      roofMesh.position.set(0.3, 5.15, 0.32);
      roofMesh.scale.z = 0.72;
      roofMesh.castShadow = true;
      group.add(roofMesh);

      // Covered side bay and visible carpenter bench.
      addBox(group, 1.18, 0.14, 1.65, canvas, -1.18, 4.18, 0.25);
      addBox(group, 0.12, 1.8, 0.12, timberDark, -1.62, 3.22, -0.28);
      addBox(group, 0.12, 1.8, 0.12, timberDark, -0.72, 3.22, -0.28);
      addBox(group, 1.05, 0.18, 0.5, plank, -1.15, 2.78, -0.38);
      addLogStack(group, 9, -0.95, 1.25, timber);

      // Saw frame gives the workshop an immediately readable production identity.
      addBox(group, 0.11, 1.25, 0.11, iron, 1.25, 3.1, -0.78);
      addBox(group, 0.11, 1.25, 0.11, iron, 1.78, 3.1, -0.78);
      addBox(group, 0.64, 0.09, 0.11, iron, 1.51, 3.72, -0.78);
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.82, 0.32), iron);
      blade.position.set(1.51, 3.25, -0.78);
      blade.castShadow = true;
      group.add(blade);
    }

    if (level >= 3) {
      // Master workshop: stone base, loft, larger cutting hall and hoist.
      addBox(group, 3.0, 0.42, 2.25, stone, 0.18, 2.36, 0.25);
      addBox(group, 2.78, 2.55, 2.0, timberLight, 0.18, 3.78, 0.25);
      addBox(group, 0.18, 2.75, 2.12, timberDark, -1.08, 3.82, 0.25);
      addBox(group, 0.18, 2.75, 2.12, timberDark, 1.44, 3.82, 0.25);

      const roofMesh = new THREE.Mesh(new THREE.ConeGeometry(2.05, 1.52, 4), roof);
      roofMesh.rotation.y = Math.PI / 4;
      roofMesh.position.set(0.18, 5.78, 0.25);
      roofMesh.scale.z = 0.76;
      roofMesh.castShadow = true;
      group.add(roofMesh);

      // Upper drying loft and stacked finished planks.
      addBox(group, 2.2, 0.16, 0.7, plank, 0.15, 4.55, -1.18);
      for (let i = 0; i < 5; i += 1) {
        addBox(group, 1.25, 0.09, 0.22, plank, -1.0, 2.5 + i * 0.11, 1.25);
      }

      // Simple timber hoist: large-form level-three landmark.
      addBox(group, 0.18, 3.0, 0.18, timberDark, 1.45, 3.72, 1.24);
      addBox(group, 1.35, 0.18, 0.18, timberDark, 0.88, 5.15, 1.24);
      const rope = new THREE.Mesh(
        new THREE.CylinderGeometry(0.025, 0.025, 1.15, 6),
        material(0x554334),
      );
      rope.position.set(0.28, 4.58, 1.24);
      group.add(rope);

      const hook = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.025, 6, 10, Math.PI * 1.45), iron);
      hook.position.set(0.28, 3.98, 1.24);
      hook.rotation.z = Math.PI / 2;
      group.add(hook);

      addLogStack(group, 12, 1.05, -1.18, timber);
    }

    group.rotation.y = ((seed % 4) * Math.PI) / 2;
    return group;
  }
}
