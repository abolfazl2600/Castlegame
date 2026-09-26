import * as THREE from 'three';
import { ModernArchitecture } from './ModernArchitecture';

export class FuturisticCastleRenderer {
  render(seed = 3000): THREE.Group {
    const group = new THREE.Group();
    const architecture = new ModernArchitecture();
    const { materials } = architecture;
    const metal = materials.structuralSteel;
    const armor = materials.armoredSteel;
    const dark = materials.compositePanel;
    const glass = materials.reinforcedGlass;
    const energy = materials.securityLight;
    const weapon = materials.industrialMetal;
    const warning = materials.industrialMetal;

    const addBox = (w: number, h: number, d: number, material: THREE.Material, x: number, y: number, z: number): THREE.Mesh => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      return mesh;
    };

    const addCylinder = (radius: number, height: number, material: THREE.Material, x: number, y: number, z: number, segments = 12): THREE.Mesh => {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 1.05, height, segments), material);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      return mesh;
    };

    const addBeam = (length: number, thickness: number, material: THREE.Material, x: number, y: number, z: number, angle: number): THREE.Mesh => {
      const mesh = addBox(length, thickness, thickness, material, x, y, z);
      mesh.rotation.y = angle;
      return mesh;
    };

    const addTower = (x: number, z: number, height: number, variant: number): void => {
      addCylinder(2.45, height, metal, x, height / 2, z, variant % 2 === 0 ? 8 : 10);
      addBox(3.45, 0.28, 3.45, armor, x, height + 0.15, z);
      addBox(3.05, 0.18, 3.05, dark, x, height + 0.36, z);
      for (let i = 0; i < 4; i += 1) {
        const a = i * Math.PI / 2 + (variant % 2) * 0.18;
        addBox(0.58, 0.82, 0.58, armor, x + Math.cos(a) * 1.28, height + 0.62, z + Math.sin(a) * 1.28);
      }
      addCylinder(0.62, 0.18, glass, x, height + 0.58, z, 16);

      addCylinder(0.86, 0.34, weapon, x, height + 0.82, z, 16);
      addCylinder(0.58, 0.28, glass, x, height + 1.02, z, 16);
      const housing = addBox(1.32, 0.72, 1.08, weapon, x, height + 1.34, z);
      housing.rotation.y = variant * 0.37;
      const barrelAngle = (variant % 2 === 0 ? 0.2 : -0.35) + variant * 0.14;
      const bx = x + Math.cos(barrelAngle) * 1.15;
      const bz = z + Math.sin(barrelAngle) * 1.15;
      addBeam(2.65, 0.24, weapon, (x + bx) / 2, height + 1.37, (z + bz) / 2, barrelAngle);
      const muzzle = addCylinder(0.18, 0.24, energy, bx + Math.cos(barrelAngle) * 0.1, height + 1.37, bz + Math.sin(barrelAngle) * 0.1, 10);
      muzzle.rotation.z = Math.PI / 2;
    };

    const outer = 15.2;

    // Modern architectural foundation: shared concrete geometry/materials.
    const foundation = architecture.ConcreteFoundation(31.8, 31.8, 0.45);
    foundation.position.y = 0.22;
    group.add(foundation);

    const wallH = 5.8;
    const wallT = 1.65;

    const northWall = architecture.ConcreteWallSegment(outer * 2, wallH, wallT);
    northWall.position.z = -outer;
    group.add(northWall);
    const southWall = architecture.ConcreteWallSegment(outer * 2, wallH, wallT);
    southWall.position.z = outer;
    group.add(southWall);
    const westWall = architecture.ConcreteWallSegment(wallT, wallH, outer * 2);
    westWall.position.x = -outer;
    group.add(westWall);
    const eastWall = architecture.ConcreteWallSegment(wallT, wallH, outer * 2);
    eastWall.position.x = outer;
    group.add(eastWall);

    for (let i = -3; i <= 3; i += 1) {
      const offset = i * 4.25;
      addBox(0.34, wallH + 0.28, wallT + 0.22, armor, offset, wallH / 2, -outer - 0.08);
      addBox(0.34, wallH + 0.28, wallT + 0.22, armor, offset, wallH / 2, outer + 0.08);
      addBox(wallT + 0.22, wallH + 0.28, 0.34, armor, -outer - 0.08, wallH / 2, offset);
      addBox(wallT + 0.22, wallH + 0.28, 0.34, armor, outer + 0.08, wallH / 2, offset);
      addBox(0.12, 0.18, wallT + 0.3, energy, offset, 3.0, -outer - 0.17);
      addBox(0.12, 0.18, wallT + 0.3, energy, offset, 3.0, outer + 0.17);
    }

    addBox(7.4, 7.0, 2.2, armor, 0, 3.5, -outer - 0.1);
    addBox(5.7, 5.9, 2.45, dark, 0, 3.0, -outer - 1.05);
    addBox(3.8, 5.25, 0.3, glass, 0, 2.65, -outer - 1.24);
    addBox(4.5, 0.28, 0.34, energy, 0, 6.0, -outer - 1.3);
    addBox(0.24, 5.0, 0.36, energy, -2.25, 2.55, -outer - 1.3);
    addBox(0.24, 5.0, 0.36, energy, 2.25, 2.55, -outer - 1.3);

    const towerPoints = [[-outer, -outer], [outer, -outer], [-outer, outer], [outer, outer]] as const;
    towerPoints.forEach(([x, z], i) => addTower(x, z, 9.0 + (i % 2) * 1.2, i + Math.abs(seed)));

    const platformPoints = [[-7, -outer], [7, -outer], [-outer, -6], [-outer, 6], [outer, -6], [outer, 6], [-7, outer], [7, outer]] as const;
    platformPoints.forEach(([x, z], i) => {
      addBox(3.0, 0.42, 3.0, armor, x, wallH + 0.25, z);
      addCylinder(0.46, 0.25, glass, x, wallH + 0.5, z, 14);
      const outward = Math.abs(x) > Math.abs(z) ? Math.sign(x) : Math.sign(z);
      const angle = outward > 0
        ? (Math.abs(x) > Math.abs(z) ? 0 : Math.PI / 2)
        : (Math.abs(x) > Math.abs(z) ? Math.PI : -Math.PI / 2);
      addBeam(2.2, 0.2, weapon, x + Math.cos(angle) * 0.75, wallH + 0.82, z + Math.sin(angle) * 0.75, angle);
      const muzzle = addCylinder(0.13, 0.22, energy, x + Math.cos(angle) * 1.85, wallH + 0.82, z + Math.sin(angle) * 1.85, 10);
      muzzle.rotation.z = Math.PI / 2;
      if (i % 2 === 0) addBox(0.12, 0.9, 0.12, warning, x + 1.0, wallH + 0.75, z);
    });

    addBox(12.5, 5.4, 10.5, metal, 0, 3.2, 1.4);

    // Reusable structural frame and access components around the central block.
    const frame = architecture.SteelFrame(12.5, 5.4, 10.5, 0.22);
    frame.position.set(0, 0, 1.4);
    group.add(frame);

    const frontWindow = architecture.ReinforcedWindow(6.1, 2.2, 0.28);
    frontWindow.position.set(0, 9.9, -1.28);
    group.add(frontWindow);

    const rearWindow = architecture.ReinforcedWindow(6.1, 2.2, 0.28);
    rearWindow.position.set(0, 9.9, 4.08);
    group.add(rearWindow);

    const modernDoor = architecture.ModernDoor(2.4, 3.0, 0.28);
    modernDoor.position.set(0, 0, -3.95);
    group.add(modernDoor);

    const roofPlatform = architecture.IndustrialPlatform(10.7, 9.0, 0.28);
    roofPlatform.position.set(0, 6.85, 1.4);
    group.add(roofPlatform);
    addBox(10.7, 2.2, 9.0, armor, 0, 6.9, 1.4);
    addBox(8.8, 0.32, 7.2, dark, 0, 8.2, 1.4);
    addBox(6.8, 3.4, 5.2, dark, 0, 9.8, 1.4);
    addBox(6.1, 2.2, 0.28, glass, 0, 9.9, -1.25);
    addBox(6.1, 2.2, 0.28, glass, 0, 9.9, 4.05);
    addBox(0.34, 4.5, 5.4, glass, -3.15, 9.6, 1.4);
    addBox(0.34, 4.5, 5.4, glass, 3.15, 9.6, 1.4);

    addCylinder(0.32, 4.5, armor, 0, 13.1, 1.4, 12);
    addCylinder(1.35, 0.34, energy, 0, 15.25, 1.4, 20);
    addCylinder(0.78, 0.22, glass, 0, 15.48, 1.4, 16);
    for (let i = 0; i < 4; i += 1) {
      const a = i * Math.PI / 2;
      addBeam(3.2, 0.14, energy, Math.cos(a) * 1.45, 15.35, 1.4 + Math.sin(a) * 1.45, a);
    }

    for (let i = 0; i < 8; i += 1) {
      const a = i * Math.PI / 4;
      const x = Math.cos(a) * 10.5;
      const z = Math.sin(a) * 10.5;
      const block = addBox(2.5, 3.0 + (i % 3) * 0.45, 2.5, armor, x, 1.5, z);
      block.rotation.y = a + Math.PI / 4;
      addBox(1.2, 2.2, 0.16, glass, x, 1.75, z + Math.sin(a) * 1.27);
    }

    addBox(28.8, 0.12, 28.8, energy, 0, 0.44, 0);

    group.userData.futuristicCastle = {
      era: 3000,
      architecturalLanguage: 'reinforced-concrete-steel',
      reusableArchitecture: true,
      automatedDefenses: 12,
      combatSystem: false,
    };
    return group;
  }
}
