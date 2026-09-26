import * as THREE from 'three';
import { ModernMaterials } from './ModernMaterials';

/**
 * Reusable procedural architecture primitives for Modern Mode.
 * Geometry is cached by dimensions and materials are shared through one palette.
 */
export class ModernArchitecture {
  readonly materials: ModernMaterials;
  private readonly geometryCache = new Map<string, THREE.BufferGeometry>();

  constructor(materials = new ModernMaterials()) {
    this.materials = materials;
  }

  ConcreteFoundation(width: number, depth: number, height = 0.45): THREE.Mesh {
    return this.box(width, height, depth, this.materials.reinforcedConcrete);
  }

  SteelFrame(width: number, height: number, depth: number, beam = 0.24): THREE.Group {
    const group = new THREE.Group();
    const steel = this.materials.structuralSteel;
    const add = (w: number, h: number, d: number, x: number, y: number, z: number) => {
      const mesh = this.box(w, h, d, steel);
      mesh.position.set(x, y, z);
      group.add(mesh);
    };
    add(beam, height, beam, -width / 2 + beam / 2, height / 2, -depth / 2 + beam / 2);
    add(beam, height, beam, width / 2 - beam / 2, height / 2, -depth / 2 + beam / 2);
    add(beam, height, beam, -width / 2 + beam / 2, height / 2, depth / 2 - beam / 2);
    add(beam, height, beam, width / 2 - beam / 2, height / 2, depth / 2 - beam / 2);
    add(width, beam, beam, 0, height - beam / 2, -depth / 2 + beam / 2);
    add(width, beam, beam, 0, height - beam / 2, depth / 2 - beam / 2);
    add(beam, beam, depth, -width / 2 + beam / 2, height - beam / 2, 0);
    add(beam, beam, depth, width / 2 - beam / 2, height - beam / 2, 0);
    return group;
  }

  ArmoredPanel(width: number, height: number, depth = 0.18): THREE.Mesh {
    return this.box(width, height, depth, this.materials.armoredSteel);
  }

  ConcreteWallSegment(width: number, height: number, depth: number): THREE.Group {
    const group = new THREE.Group();
    const wall = this.box(width, height, depth, this.materials.reinforcedConcrete);
    wall.position.y = height / 2;
    group.add(wall);
    const cap = this.box(width + 0.12, 0.18, depth + 0.12, this.materials.armoredSteel);
    cap.position.y = height - 0.09;
    group.add(cap);
    const jointCount = Math.max(1, Math.floor(width / 4));
    for (let i = 1; i < jointCount; i += 1) {
      const joint = this.box(0.07, height * 0.92, depth + 0.04, this.materials.industrialMetal);
      joint.position.set(-width / 2 + (width * i) / jointCount, height / 2, 0);
      group.add(joint);
    }
    return group;
  }

  SteelBeam(length: number, thickness = 0.22, rotationY = 0): THREE.Mesh {
    const beam = this.box(length, thickness, thickness, this.materials.structuralSteel);
    beam.rotation.y = rotationY;
    return beam;
  }

  ModernDoor(width = 1.8, height = 3.0, depth = 0.16): THREE.Group {
    const group = new THREE.Group();
    const frame = this.box(width + 0.28, height + 0.28, depth + 0.08, this.materials.structuralSteel);
    frame.position.y = height / 2;
    group.add(frame);
    const door = this.box(width, height, depth, this.materials.compositePanel);
    door.position.set(0, height / 2, -0.05);
    group.add(door);
    const strip = this.box(0.08, height * 0.78, depth + 0.05, this.materials.securityLight);
    strip.position.set(width / 2 - 0.16, height / 2, -0.15);
    group.add(strip);
    return group;
  }

  ReinforcedWindow(width = 2.4, height = 1.8, depth = 0.14): THREE.Group {
    const group = new THREE.Group();
    group.add(this.box(width, height, depth, this.materials.reinforcedGlass));
    const t = 0.12;
    const steel = this.materials.structuralSteel;
    for (const [w, h, x, y] of [
      [width + t, t, 0, height / 2], [width + t, t, 0, -height / 2],
      [t, height, -width / 2, 0], [t, height, width / 2, 0],
    ] as Array<[number, number, number, number]>) {
      const frame = this.box(w, h, depth + 0.06, steel);
      frame.position.set(x, y, 0);
      group.add(frame);
    }
    group.add(this.box(t * 0.7, height, depth + 0.08, steel));
    return group;
  }

  IndustrialPlatform(width: number, depth: number, thickness = 0.3): THREE.Group {
    const group = new THREE.Group();
    group.add(this.box(width, thickness, depth, this.materials.modernConcreteFlooring));
    const frame = this.box(width + 0.12, 0.16, depth + 0.12, this.materials.structuralSteel);
    frame.position.y = thickness / 2;
    group.add(frame);
    for (const [x, z] of [
      [-width / 2 + 0.22, -depth / 2 + 0.22], [width / 2 - 0.22, -depth / 2 + 0.22],
      [-width / 2 + 0.22, depth / 2 - 0.22], [width / 2 - 0.22, depth / 2 - 0.22],
    ]) {
      const support = this.box(0.22, 1.1, 0.22, this.materials.structuralSteel);
      support.position.set(x, -0.55, z);
      group.add(support);
    }
    return group;
  }

  dispose(): void {
    for (const geometry of this.geometryCache.values()) geometry.dispose();
    this.geometryCache.clear();
    this.materials.dispose();
  }

  private box(width: number, height: number, depth: number, material: THREE.Material): THREE.Mesh {
    const key = 'box:' + width.toFixed(4) + ':' + height.toFixed(4) + ':' + depth.toFixed(4);
    let geometry = this.geometryCache.get(key);
    if (!geometry) {
      geometry = new THREE.BoxGeometry(width, height, depth);
      this.geometryCache.set(key, geometry);
    }
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }
}
