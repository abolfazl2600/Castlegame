import * as THREE from 'three';

export class OrchardSystem {
  create(group: THREE.Group, size: number, seed: number): void {
    const orchardSize = THREE.MathUtils.clamp(Math.floor(size), 1, 3);
    const hash = (value: number): number => {
      const n = Math.sin(value * 12.9898 + seed * 78.233) * 43758.5453;
      return n - Math.floor(n);
    };

    const soil = new THREE.MeshStandardMaterial({ color: 0x76563d, roughness: 1 });
    const soilDark = new THREE.MeshStandardMaterial({ color: 0x594332, roughness: 1 });
    const grass = new THREE.MeshStandardMaterial({ color: 0x6f8749, roughness: 1 });
    const trunk = new THREE.MeshStandardMaterial({ color: 0x68442d, roughness: 0.96 });
    const branch = new THREE.MeshStandardMaterial({ color: 0x513622, roughness: 0.98 });
    const leaf = new THREE.MeshStandardMaterial({ color: 0x47703c, roughness: 0.9 });
    const leafLight = new THREE.MeshStandardMaterial({ color: 0x668d4b, roughness: 0.9 });
    const apple = new THREE.MeshStandardMaterial({ color: 0xb83b2f, roughness: 0.82 });
    const appleDark = new THREE.MeshStandardMaterial({ color: 0x8f2d26, roughness: 0.86 });
    const fence = new THREE.MeshStandardMaterial({ color: 0x765137, roughness: 1 });

    const fieldScale = 3.35 + (orchardSize - 1) * 0.25;
    const field = new THREE.Mesh(
      new THREE.BoxGeometry(fieldScale, 0.14, fieldScale),
      soil,
    );
    field.position.y = 0.08;
    field.receiveShadow = true;
    group.add(field);

    const border = new THREE.Mesh(
      new THREE.BoxGeometry(fieldScale * 0.9, 0.035, fieldScale * 0.9),
      grass,
    );
    border.position.y = 0.17;
    border.receiveShadow = true;
    group.add(border);

    const rows = orchardSize === 1 ? 3 : orchardSize === 2 ? 4 : 5;
    const spacing = fieldScale / (rows + 1);

    for (let row = 0; row < rows; row += 1) {
      const z = -fieldScale / 2 + spacing * (row + 1);
      for (let col = 0; col < rows; col += 1) {
        const x = -fieldScale / 2 + spacing * (col + 1);
        const localSeed = row * 101 + col * 37;
        const tree = new THREE.Group();
        const scale = 0.86 + hash(localSeed + 1) * 0.28;
        const rotation = (hash(localSeed + 2) - 0.5) * 0.22;

        const trunkHeight = 0.92 * scale;
        const trunkMesh = new THREE.Mesh(
          new THREE.CylinderGeometry(0.13 * scale, 0.18 * scale, trunkHeight, 7),
          trunk,
        );
        trunkMesh.position.y = 0.28 + trunkHeight / 2;
        trunkMesh.castShadow = true;
        tree.add(trunkMesh);

        for (const [angle, length, height] of [
          [0.25, 0.72, 0.86],
          [-0.7, 0.62, 0.76],
          [2.25, 0.58, 0.8],
        ] as Array<[number, number, number]>) {
          const limb = new THREE.Mesh(
            new THREE.CylinderGeometry(0.045 * scale, 0.075 * scale, length * scale, 6),
            branch,
          );
          limb.position.set(
            Math.cos(angle) * length * 0.28 * scale,
            height * scale,
            Math.sin(angle) * length * 0.28 * scale,
          );
          limb.rotation.z = Math.sin(angle) * 0.8;
          limb.rotation.x = Math.cos(angle) * 0.45;
          limb.castShadow = true;
          tree.add(limb);
        }

        const canopy = new THREE.Mesh(
          new THREE.DodecahedronGeometry(0.82 * scale, 1),
          hash(localSeed + 3) > 0.5 ? leaf : leafLight,
        );
        canopy.position.y = 1.28 * scale;
        canopy.scale.set(1.05, 0.86, 0.98);
        canopy.castShadow = true;
        tree.add(canopy);

        if (hash(localSeed + 4) > 0.42) {
          const appleCount = 1 + Math.floor(hash(localSeed + 5) * 4);
          for (let appleIndex = 0; appleIndex < appleCount; appleIndex += 1) {
            const a = hash(localSeed + 10 + appleIndex) * Math.PI * 2;
            const radius = 0.42 + hash(localSeed + 20 + appleIndex) * 0.25;
            const fruit = new THREE.Mesh(
              new THREE.SphereGeometry(0.075 + hash(localSeed + 30 + appleIndex) * 0.025, 7, 6),
              appleIndex % 3 === 0 ? appleDark : apple,
            );
            fruit.position.set(
              Math.cos(a) * radius * scale,
              (1.18 + hash(localSeed + 40 + appleIndex) * 0.48) * scale,
              Math.sin(a) * radius * scale,
            );
            fruit.castShadow = true;
            tree.add(fruit);
          }
        }

        tree.position.set(
          x + (hash(localSeed + 50) - 0.5) * 0.14,
          0,
          z + (hash(localSeed + 60) - 0.5) * 0.14,
        );
        tree.rotation.y = rotation;
        group.add(tree);
      }
    }

    // Narrow cultivation furrows make the field read as worked agricultural ground.
    for (let i = 1; i < rows; i += 1) {
      const offset = -fieldScale / 2 + spacing * i;
      const furrow = new THREE.Mesh(
        new THREE.BoxGeometry(0.055, 0.025, fieldScale * 0.84),
        soilDark,
      );
      furrow.position.set(offset, 0.19, 0);
      group.add(furrow);

      const crossFurrow = new THREE.Mesh(
        new THREE.BoxGeometry(fieldScale * 0.84, 0.025, 0.055),
        soilDark,
      );
      crossFurrow.position.set(0, 0.195, offset);
      group.add(crossFurrow);
    }

    const fenceHeight = 0.5;
    for (const side of [-1, 1]) {
      for (let i = 0; i < 4; i += 1) {
        const t = -fieldScale / 2 + 0.25 + i * ((fieldScale - 0.5) / 3);
        for (const zSide of [side * (fieldScale / 2 - 0.08)]) {
          const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, fenceHeight, 0.08), fence);
          post.position.set(t, fenceHeight / 2, zSide);
          post.castShadow = true;
          group.add(post);
        }
      }
    }
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(fieldScale - 0.35, 0.075, 0.075),
        fence,
      );
      rail.position.set(0, 0.34, side * (fieldScale / 2 - 0.08));
      rail.castShadow = true;
      group.add(rail);
    }

    // Leave a subtle entrance gap so the orchard reads as an actual farm plot.
    const entrance = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.085, 0.12),
      fence,
    );
    entrance.position.set(0, 0.34, fieldScale / 2 - 0.08);
    entrance.visible = false;
    group.add(entrance);
  }
}
