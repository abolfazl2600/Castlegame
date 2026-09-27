import * as THREE from 'three';
import type { StoneStyle } from '../core/types';
import type { MedievalMaterials } from './MedievalMaterials';

export class BasilicaRenderer {
  constructor(private readonly materials: MedievalMaterials) {}

  render(stoneStyle: StoneStyle, gx: number, gy: number): THREE.Group {
    const group = new THREE.Group();
    const stone = this.materials.castleStone(stoneStyle, 'body', gx, gy);
    const stoneAlt = this.materials.castleStone(stoneStyle, 'alt', gx, gy);
    const stoneDark = this.materials.castleStone(stoneStyle, 'foundation', gx, gy);
    const roof = this.materials.roofTile;
    const roofDark = this.materials.roofDark;
    const opening = this.materials.arrowVoid;

    this.addBox(group, 2.55, 0.32, 3.5, stoneDark, 0, 2.36, 0);
    this.addBox(group, 2.22, 2.15, 3.2, stone, 0, 3.5, 0);
    this.addBox(group, 3.35, 1.72, 1.18, stoneAlt, 0, 3.35, 0.28);

    const apse = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 1.95, 10, 1, false, 0, Math.PI), stone);
    apse.rotation.z = Math.PI / 2;
    apse.rotation.y = Math.PI / 2;
    apse.position.set(0, 3.45, -1.58);
    apse.castShadow = true;
    apse.receiveShadow = true;
    group.add(apse);

    this.addPitchedRoof(group, 2.6, 3.55, 1.0, roof, 0, 4.95, 0);
    this.addPitchedRoof(group, 3.48, 1.28, 0.72, roof, 0, 4.42, 0.28);

    this.addBox(group, 1.22, 3.15, 1.15, stoneAlt, 0, 4.35, 1.22);
    this.addPitchedRoof(group, 1.38, 1.3, 0.96, roofDark, 0, 6.06, 1.22);

    for (const x of [-0.72, 0.72]) {
      for (const z of [-0.9, 0, 0.9]) {
        this.addBox(group, 0.16, 0.72, 0.05, opening, x, 3.72, z);
      }
    }
    for (const x of [-1.28, 1.28]) {
      this.addBox(group, 0.05, 0.7, 0.18, opening, x, 3.55, 0.2);
    }

    const rose = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.36, 12), opening);
    rose.position.set(0, 4.42, 1.81);
    rose.renderOrder = 2;
    group.add(rose);

    const crossMaterial = this.materials.iron;
    this.addBox(group, 0.08, 0.74, 0.08, crossMaterial, 0, 7.0, 1.22);
    this.addBox(group, 0.5, 0.08, 0.08, crossMaterial, 0, 7.06, 1.22);

    group.userData.landmark = 'basilica';
    return group;
  }

  private addPitchedRoof(
    group: THREE.Group,
    width: number,
    depth: number,
    rise: number,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
  ): void {
    const halfWidth = width / 2;
    const slope = Math.hypot(halfWidth, rise);
    const angle = Math.atan2(rise, halfWidth);

    for (const side of [-1, 1]) {
      const roof = new THREE.Mesh(new THREE.BoxGeometry(slope, 0.16, depth), material);
      roof.rotation.z = side * angle;
      roof.position.set(x + side * halfWidth * 0.48, y + rise * 0.46, z);
      roof.castShadow = true;
      roof.receiveShadow = true;
      group.add(roof);
    }
  }

  private addBox(
    group: THREE.Group,
    width: number,
    height: number,
    depth: number,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
  ): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  }
}
