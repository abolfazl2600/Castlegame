import * as THREE from 'three';
export type CarpenterWorkshopLevel = 1 | 2 | 3 | 4;

function normalizeCarpenterLevel(levelValue?: number | null): CarpenterWorkshopLevel {
  const numeric = Number(levelValue ?? 1);
  const normalized = Number.isFinite(numeric) ? Math.floor(numeric) : 1;
  return Math.max(1, Math.min(4, normalized)) as CarpenterWorkshopLevel;
}

const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
const LOG_GEOMETRY = new THREE.CylinderGeometry(0.12, 0.14, 1.18, 8);
const BARREL_GEOMETRY = new THREE.CylinderGeometry(0.22, 0.25, 0.52, 10);
const CART_WHEEL_GEOMETRY = new THREE.CylinderGeometry(0.23, 0.23, 0.08, 10);
const HOOK_GEOMETRY = new THREE.TorusGeometry(0.12, 0.025, 6, 10, Math.PI * 1.45);

function material(color: number, roughness = 1, metalness = 0): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

const MATERIALS = {
  timber: material(0x6b4931),
  timberLight: material(0x9a6a43),
  timberDark: material(0x493121),
  plank: material(0xb88755),
  roof: material(0x80563e),
  masterRoof: material(0x664239),
  stone: material(0x8a877b),
  iron: material(0x60666b, 0.58, 0.48),
  canvas: material(0xb79d70),
  soil: material(0x796049),
  rope: material(0x554334),
  sawdust: material(0xb99769),
};

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
  const mesh = new THREE.Mesh(UNIT_BOX, mat);
  mesh.scale.set(width, height, depth);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function addRoof(
  group: THREE.Group,
  radius: number,
  height: number,
  zScale: number,
  mat: THREE.Material,
  x: number,
  y: number,
  z: number,
): THREE.Mesh {
  const roof = new THREE.Mesh(new THREE.ConeGeometry(radius, height, 4), mat);
  roof.rotation.y = Math.PI / 4;
  roof.position.set(x, y, z);
  roof.scale.z = zScale;
  roof.castShadow = true;
  group.add(roof);
  return roof;
}

function addLogStack(
  group: THREE.Group,
  count: number,
  x: number,
  z: number,
  timber: THREE.Material,
  columns = 3,
): void {
  const logs = new THREE.InstancedMesh(LOG_GEOMETRY, timber, count);
  logs.castShadow = true;
  logs.receiveShadow = true;
  const matrix = new THREE.Matrix4();
  const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI / 2));
  for (let i = 0; i < count; i += 1) {
    const row = Math.floor(i / columns);
    const col = i % columns;
    const px = x + (col - (columns - 1) / 2) * 0.28;
    matrix.compose(
      new THREE.Vector3(px, 2.38 + row * 0.23, z),
      rotation,
      new THREE.Vector3(1, 1, 1),
    );
    logs.setMatrixAt(i, matrix);
  }
  logs.instanceMatrix.needsUpdate = true;
  group.add(logs);
}

function addPlankStack(
  group: THREE.Group,
  count: number,
  x: number,
  y: number,
  z: number,
  width = 1.25,
): void {
  const planks = new THREE.InstancedMesh(UNIT_BOX, MATERIALS.plank, count);
  planks.castShadow = true;
  planks.receiveShadow = true;
  const matrix = new THREE.Matrix4();
  for (let i = 0; i < count; i += 1) {
    matrix.compose(
      new THREE.Vector3(x, y + i * 0.11, z),
      new THREE.Quaternion(),
      new THREE.Vector3(width, 0.09, 0.22),
    );
    planks.setMatrixAt(i, matrix);
  }
  planks.instanceMatrix.needsUpdate = true;
  group.add(planks);
}

function addWorkbench(group: THREE.Group, x: number, z: number, width = 1.2): void {
  addBox(group, width, 0.16, 0.55, MATERIALS.plank, x, 2.72, z);
  addBox(group, 0.12, 0.72, 0.12, MATERIALS.timberDark, x - width * 0.34, 2.43, z);
  addBox(group, 0.12, 0.72, 0.12, MATERIALS.timberDark, x + width * 0.34, 2.43, z);
}

function addSawhorse(group: THREE.Group, x: number, z: number): void {
  addBox(group, 0.9, 0.12, 0.18, MATERIALS.timber, x, 2.74, z);
  addBox(group, 0.1, 0.65, 0.1, MATERIALS.timberDark, x - 0.3, 2.48, z - 0.16).rotation.z = 0.25;
  addBox(group, 0.1, 0.65, 0.1, MATERIALS.timberDark, x + 0.3, 2.48, z + 0.16).rotation.z = -0.25;
}

function addBarrel(group: THREE.Group, x: number, z: number): void {
  const barrel = new THREE.Mesh(BARREL_GEOMETRY, MATERIALS.timber);
  barrel.position.set(x, 2.49, z);
  barrel.castShadow = true;
  group.add(barrel);
}

function addLumberRack(group: THREE.Group, x: number, z: number, width = 1.4, tiers = 3): void {
  addBox(group, 0.12, 1.55, 0.12, MATERIALS.timberDark, x - width / 2, 3.02, z);
  addBox(group, 0.12, 1.55, 0.12, MATERIALS.timberDark, x + width / 2, 3.02, z);
  for (let tier = 0; tier < tiers; tier += 1) {
    addBox(group, width, 0.09, 0.24, MATERIALS.plank, x, 2.62 + tier * 0.42, z);
  }
}

function addCart(group: THREE.Group, x: number, z: number): void {
  addBox(group, 0.9, 0.18, 0.55, MATERIALS.plank, x, 2.58, z);
  addBox(group, 0.08, 0.08, 0.9, MATERIALS.timberDark, x + 0.75, 2.55, z);
  for (const dz of [-0.32, 0.32]) {
    const wheel = new THREE.Mesh(CART_WHEEL_GEOMETRY, MATERIALS.timberDark);
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(x - 0.22, 2.36, z + dz);
    wheel.castShadow = true;
    group.add(wheel);
  }
}

function addSawFrame(group: THREE.Group, x: number, z: number): void {
  addBox(group, 0.11, 1.25, 0.11, MATERIALS.iron, x - 0.27, 3.1, z);
  addBox(group, 0.11, 1.25, 0.11, MATERIALS.iron, x + 0.27, 3.1, z);
  addBox(group, 0.64, 0.09, 0.11, MATERIALS.iron, x, 3.72, z);
  addBox(group, 0.04, 0.82, 0.32, MATERIALS.iron, x, 3.25, z);
}

function addHoist(group: THREE.Group, x: number, z: number, height = 3.0): void {
  addBox(group, 0.18, height, 0.18, MATERIALS.timberDark, x, 2.22 + height / 2, z);
  addBox(group, 1.35, 0.18, 0.18, MATERIALS.timberDark, x - 0.57, 2.22 + height - 0.07, z);
  const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.15, 6), MATERIALS.rope);
  rope.position.set(x - 1.15, 2.22 + height - 0.65, z);
  group.add(rope);
  const hook = new THREE.Mesh(HOOK_GEOMETRY, MATERIALS.iron);
  hook.position.set(x - 1.15, 2.22 + height - 1.25, z);
  hook.rotation.z = Math.PI / 2;
  group.add(hook);
}

function addSawdustPatch(group: THREE.Group, x: number, z: number, scale = 1): void {
  const patch = new THREE.Mesh(new THREE.CircleGeometry(0.34 * scale, 12), MATERIALS.sawdust);
  patch.rotation.x = -Math.PI / 2;
  patch.position.set(x, 2.295, z);
  patch.receiveShadow = true;
  group.add(patch);
}

function addLevelOne(group: THREE.Group): void {
  addBox(group, 2.05, 1.62, 1.4, MATERIALS.timberLight, 0.48, 3.01, 0.45);
  addRoof(group, 1.55, 1.02, 0.70, MATERIALS.roof, 0.48, 4.16, 0.45);
  addWorkbench(group, -0.72, -0.78, 1.2);
  addSawhorse(group, 1.05, -0.72);
  addLogStack(group, 6, -0.62, 1.12, MATERIALS.timber);
  addPlankStack(group, 3, 0.85, 2.38, 1.15, 0.92);
  addBox(group, 0.48, 0.42, 0.48, MATERIALS.timber, -1.22, 2.48, 0.15);
  addSawdustPatch(group, -0.28, -0.35, 0.8);
}

function addLevelTwo(group: THREE.Group): void {
  addBox(group, 2.55, 2.25, 1.78, MATERIALS.timberLight, 0.3, 3.35, 0.32);
  addBox(group, 2.78, 0.2, 1.98, MATERIALS.timberDark, 0.3, 2.3, 0.32);
  addRoof(group, 1.92, 1.36, 0.72, MATERIALS.roof, 0.3, 5.15, 0.32);

  addBox(group, 1.25, 0.14, 1.72, MATERIALS.canvas, -1.22, 4.18, 0.25);
  addBox(group, 0.12, 1.8, 0.12, MATERIALS.timberDark, -1.66, 3.22, -0.3);
  addBox(group, 0.12, 1.8, 0.12, MATERIALS.timberDark, -0.76, 3.22, -0.3);
  addWorkbench(group, -1.18, -0.4, 1.05);
  addSawFrame(group, 1.48, -0.78);
  addLogStack(group, 9, -0.95, 1.25, MATERIALS.timber);
  addLumberRack(group, 1.02, 1.24, 1.2, 2);
  addBarrel(group, 1.55, 1.15);
  addSawdustPatch(group, 0.92, -0.55, 1.0);
}

function addLevelThree(group: THREE.Group): void {
  addBox(group, 3.05, 0.42, 2.28, MATERIALS.stone, 0.18, 2.36, 0.25);
  addBox(group, 2.82, 2.58, 2.02, MATERIALS.timberLight, 0.18, 3.79, 0.25);
  addBox(group, 0.18, 2.75, 2.12, MATERIALS.timberDark, -1.08, 3.82, 0.25);
  addBox(group, 0.18, 2.75, 2.12, MATERIALS.timberDark, 1.44, 3.82, 0.25);
  addRoof(group, 2.08, 1.54, 0.76, MATERIALS.roof, 0.18, 5.8, 0.25);

  addBox(group, 2.2, 0.16, 0.7, MATERIALS.plank, 0.15, 4.55, -1.18);
  addPlankStack(group, 6, -1.0, 2.5, 1.28);
  addLogStack(group, 12, 1.05, -1.18, MATERIALS.timber);
  addLumberRack(group, -1.25, -0.92, 1.35, 3);
  addWorkbench(group, -0.65, 0.95, 1.25);
  addSawFrame(group, 0.8, -0.9);
  addHoist(group, 1.45, 1.24, 3.0);
  addCart(group, -1.18, 1.25);
  addBarrel(group, 1.48, 0.88);
  addSawdustPatch(group, 0.1, -0.72, 1.15);
}

function addLevelFour(group: THREE.Group): void {
  // Final tier uses a wider stone plinth and two connected production volumes,
  // giving it a silhouette that remains legible at normal strategy-game zoom.
  addBox(group, 3.72, 0.48, 2.78, MATERIALS.stone, 0.05, 2.39, 0.12);
  addBox(group, 2.62, 3.0, 2.18, MATERIALS.timberLight, 0.42, 4.0, 0.18);
  addBox(group, 1.25, 2.25, 1.82, MATERIALS.timber, -1.42, 3.62, 0.22);
  addRoof(group, 2.02, 1.62, 0.78, MATERIALS.masterRoof, 0.42, 6.2, 0.18);
  addRoof(group, 1.15, 1.0, 0.72, MATERIALS.masterRoof, -1.42, 5.16, 0.22);

  // Reinforced facade and exposed joinery communicate master-tier carpentry.
  for (const x of [-0.78, 0.4, 1.58]) {
    addBox(group, 0.16, 2.85, 0.18, MATERIALS.timberDark, x, 4.0, -0.94);
  }
  addBox(group, 2.55, 0.16, 0.18, MATERIALS.timberDark, 0.4, 4.82, -0.94);
  addBox(group, 2.55, 0.16, 0.18, MATERIALS.timberDark, 0.4, 3.25, -0.94);

  // Dedicated covered production bay.
  addBox(group, 1.62, 0.14, 1.52, MATERIALS.canvas, 1.32, 4.58, 1.12);
  addBox(group, 0.14, 2.15, 0.14, MATERIALS.timberDark, 0.66, 3.48, 1.5);
  addBox(group, 0.14, 2.15, 0.14, MATERIALS.timberDark, 1.92, 3.48, 1.5);
  addWorkbench(group, 1.28, 1.02, 1.35);
  addSawFrame(group, 1.18, -1.18);

  // High-capacity organized storage.
  addLumberRack(group, -1.45, -1.08, 1.45, 4);
  addLumberRack(group, -1.42, 1.15, 1.45, 4);
  addLogStack(group, 16, 0.0, 1.42, MATERIALS.timber, 4);
  addPlankStack(group, 8, 0.1, 2.5, -1.38, 1.45);

  // Master-yard utility details.
  addHoist(group, 1.82, 0.25, 3.45);
  addCart(group, -0.5, 1.35);
  addBarrel(group, -1.78, 0.35);
  addBarrel(group, -1.78, 0.78);
  addSawhorse(group, -0.45, -1.32);
  addSawdustPatch(group, 0.55, -0.95, 1.35);

  // Distinctive sign frame marks the maximum tier without relying on color.
  addBox(group, 0.14, 1.7, 0.14, MATERIALS.timberDark, -1.82, 3.08, -1.28);
  addBox(group, 0.92, 0.14, 0.14, MATERIALS.timberDark, -1.42, 3.86, -1.28);
  addBox(group, 0.62, 0.42, 0.08, MATERIALS.plank, -1.42, 3.58, -1.29);
}

export class CarpenterWorkshopRenderer {
  render(levelValue: number, seed = 0): THREE.Group {
    const level = normalizeCarpenterLevel(levelValue);
    const group = new THREE.Group();
    group.userData.settlementFamily = 'carpenter';
    group.userData.settlementReadabilityClass =
      level === 1 ? 'basic' : level === 2 ? 'established' : level === 3 ? 'advanced' : 'landmark';
    group.userData.carpenterLevel = level;

    addBox(group, level === 4 ? 4.1 : 3.55, 0.16, level === 4 ? 3.55 : 3.55, MATERIALS.soil, 0, 2.2, 0);

    if (level === 1) addLevelOne(group);
    else if (level === 2) addLevelTwo(group);
    else if (level === 3) addLevelThree(group);
    else addLevelFour(group);

    group.rotation.y = ((seed % 4) * Math.PI) / 2;
    return group;
  }
}

