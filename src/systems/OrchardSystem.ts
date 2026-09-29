import * as THREE from 'three';
import { WORLD_STYLE } from '../rendering/WorldStyle';
import { SETTLEMENT_STYLE } from '../rendering/SettlementStyle';
import { upgradeVisualProfile } from '../rendering/UpgradeVisualLanguage';

interface OrchardLayout {
  fieldScale: number;
  columns: number;
  rows: number;
  treeScale: number;
}

export class OrchardSystem {
  private readonly unitBox = new THREE.BoxGeometry(1, 1, 1);
  private readonly trunkGeometry = new THREE.CylinderGeometry(0.13, 0.18, 0.92, 7);
  private readonly branchGeometry = new THREE.CylinderGeometry(0.04, 0.07, 0.58, 6);
  private readonly canopyGeometry = new THREE.DodecahedronGeometry(0.55, 1);
  private readonly appleGeometry = new THREE.SphereGeometry(0.075, 7, 6);
  private readonly packingShedRoofGeometry = new THREE.ConeGeometry(0.82, 0.62, 4);

  private readonly soil = new THREE.MeshStandardMaterial({
    color: SETTLEMENT_STYLE.soil,
    roughness: 1,
  });
  private readonly soilDark = new THREE.MeshStandardMaterial({ color: 0x624a36, roughness: 1 });
  private readonly packedEarth = new THREE.MeshStandardMaterial({ color: SETTLEMENT_STYLE.path, roughness: 1 });
  private readonly grass = new THREE.MeshStandardMaterial({
    color: WORLD_STYLE.palette.grassShaded,
    roughness: 1,
  });
  private readonly trunk = new THREE.MeshStandardMaterial({ color: 0x68442d, roughness: 0.96 });
  private readonly branch = new THREE.MeshStandardMaterial({ color: 0x513622, roughness: 0.98 });
  private readonly leafDark = new THREE.MeshStandardMaterial({
    color: WORLD_STYLE.palette.foliageDark,
    roughness: 0.92,
  });
  private readonly leaf = new THREE.MeshStandardMaterial({
    color: WORLD_STYLE.palette.foliageMid,
    roughness: 0.9,
  });
  private readonly leafLight = new THREE.MeshStandardMaterial({
    color: WORLD_STYLE.palette.foliageLight,
    roughness: 0.9,
  });
  private readonly apple = new THREE.MeshStandardMaterial({ color: 0xc94435, roughness: 0.8 });
  private readonly appleDark = new THREE.MeshStandardMaterial({ color: 0x922d27, roughness: 0.84 });
  private readonly fence = new THREE.MeshStandardMaterial({ color: SETTLEMENT_STYLE.timber, roughness: 1 });
  private readonly crateWood = new THREE.MeshStandardMaterial({ color: 0x8a603e, roughness: 1 });
  private readonly shedWall = new THREE.MeshStandardMaterial({ color: SETTLEMENT_STYLE.plaster[1], roughness: 0.96 });
  private readonly shedRoof = new THREE.MeshStandardMaterial({ color: SETTLEMENT_STYLE.roof[1], roughness: 0.94 });

  create(group: THREE.Group, size: number, seed: number): void {
    const orchardSize = THREE.MathUtils.clamp(Math.floor(size), 1, 4);
    const layout = this.layoutFor(orchardSize);
    const hash = (value: number): number => {
      const n = Math.sin(value * 12.9898 + seed * 78.233) * 43758.5453;
      return n - Math.floor(n);
    };

    group.userData.orchardSize = orchardSize;
    group.userData.orchardSeed = seed;
    group.userData.orchardVisualVersion = 3;
    group.userData.upgradeVisualProfile = upgradeVisualProfile(orchardSize);
    group.userData.orchardVisualVariant = [
      'young-grove',
      'working-orchard',
      'mature-orchard',
      'estate-orchard',
    ][orchardSize - 1];

    this.addGround(group, layout);
    this.addPlantingRows(group, layout);

    const innerSpan = layout.fieldScale - 1.18;
    const xStep = layout.columns > 1 ? innerSpan / (layout.columns - 1) : 0;
    const zStep = layout.rows > 1 ? innerSpan / (layout.rows - 1) : 0;

    for (let row = 0; row < layout.rows; row += 1) {
      const z = -innerSpan / 2 + zStep * row;
      for (let col = 0; col < layout.columns; col += 1) {
        // Level 1 keeps one tree out of the front-center slot to make the entrance legible.
        // Level 4 reserves a back corner for the packing shed landmark mass.
        if (
          (orchardSize === 1 &&
            row === layout.rows - 1 &&
            col === Math.floor(layout.columns / 2)) ||
          (orchardSize === 4 && row === 0 && col === layout.columns - 1)
        ) {
          continue;
        }

        const x = -innerSpan / 2 + xStep * col;
        const localSeed = orchardSize * 1000 + row * 101 + col * 37;
        this.addTree(
          group,
          x + (hash(localSeed + 50) - 0.5) * 0.08,
          z + (hash(localSeed + 60) - 0.5) * 0.08,
          layout.treeScale,
          localSeed,
          hash,
        );
      }
    }

    this.addFence(group, layout.fieldScale);
    this.addEntrancePath(group, layout.fieldScale);
    if (orchardSize >= 2) this.addProduceCrate(group, layout.fieldScale, seed);
    if (orchardSize >= 3) this.addEntranceTrellis(group, layout.fieldScale);
    if (orchardSize >= 4) {
      this.addPackingShed(group, layout.fieldScale);
      this.addProduceCrate(group, layout.fieldScale, seed + 17);
    }

    group.userData.orchardTreeLayout = {
      columns: layout.columns,
      rows: layout.rows,
    };
  }

  private layoutFor(size: number): OrchardLayout {
    if (size === 1) {
      return { fieldScale: 3.34, columns: 3, rows: 3, treeScale: 0.9 };
    }
    if (size === 2) {
      return { fieldScale: 3.58, columns: 4, rows: 3, treeScale: 0.82 };
    }
    if (size === 3) {
      return { fieldScale: 3.82, columns: 4, rows: 4, treeScale: 0.76 };
    }
    return { fieldScale: 4.02, columns: 5, rows: 4, treeScale: 0.72 };
  }

  private addGround(group: THREE.Group, layout: OrchardLayout): void {
    const grassBase = this.box(
      this.grass,
      layout.fieldScale,
      0.12,
      layout.fieldScale,
    );
    grassBase.position.y = 0.06;
    grassBase.receiveShadow = true;
    group.add(grassBase);

    const cultivatedSize = layout.fieldScale - 0.28;
    const cultivated = this.box(
      this.soil,
      cultivatedSize,
      0.055,
      cultivatedSize,
    );
    cultivated.position.y = 0.145;
    cultivated.receiveShadow = true;
    group.add(cultivated);
  }

  private addPlantingRows(group: THREE.Group, layout: OrchardLayout): void {
    const innerSpan = layout.fieldScale - 1.18;
    const xStep = layout.columns > 1 ? innerSpan / (layout.columns - 1) : 0;

    for (let col = 0; col < layout.columns; col += 1) {
      const x = -innerSpan / 2 + xStep * col;
      const bed = this.box(this.soilDark, 0.42, 0.028, innerSpan + 0.3);
      bed.position.set(x, 0.18, 0);
      bed.receiveShadow = true;
      group.add(bed);

      const furrowLeft = this.box(this.packedEarth, 0.026, 0.012, innerSpan + 0.18);
      furrowLeft.position.set(x - 0.15, 0.198, 0);
      group.add(furrowLeft);

      const furrowRight = furrowLeft.clone();
      furrowRight.position.x = x + 0.15;
      group.add(furrowRight);
    }
  }

  private addTree(
    group: THREE.Group,
    x: number,
    z: number,
    baseScale: number,
    localSeed: number,
    hash: (value: number) => number,
  ): void {
    const tree = new THREE.Group();
    const scale = baseScale * (0.9 + hash(localSeed + 1) * 0.18);
    tree.rotation.y = (hash(localSeed + 2) - 0.5) * 0.26;

    const trunkMesh = new THREE.Mesh(this.trunkGeometry, this.trunk);
    trunkMesh.scale.setScalar(scale);
    trunkMesh.position.y = 0.18 + 0.46 * scale;
    trunkMesh.castShadow = true;
    tree.add(trunkMesh);

    const branchAngles = [0.35, 2.3, 4.35];
    for (let index = 0; index < branchAngles.length; index += 1) {
      const angle = branchAngles[index] + (hash(localSeed + 10 + index) - 0.5) * 0.34;
      const limb = new THREE.Mesh(this.branchGeometry, this.branch);
      limb.scale.setScalar(scale * (0.86 + hash(localSeed + 20 + index) * 0.18));
      limb.position.set(
        Math.cos(angle) * 0.19 * scale,
        (0.78 + index * 0.055) * scale,
        Math.sin(angle) * 0.19 * scale,
      );
      limb.rotation.z = Math.sin(angle) * 0.9;
      limb.rotation.x = Math.cos(angle) * 0.5;
      limb.castShadow = true;
      tree.add(limb);
    }

    const canopyMaterials = [this.leafDark, this.leaf, this.leafLight] as const;
    const canopyVariant = Math.floor(hash(localSeed + 30) * canopyMaterials.length);
    const mainCanopy = new THREE.Mesh(this.canopyGeometry, canopyMaterials[canopyVariant]);
    mainCanopy.position.set(0, 1.23 * scale, 0);
    mainCanopy.scale.set(1.08 * scale, 0.88 * scale, 1.02 * scale);
    mainCanopy.castShadow = true;
    tree.add(mainCanopy);

    const sideCanopyA = new THREE.Mesh(
      this.canopyGeometry,
      canopyMaterials[(canopyVariant + 1) % canopyMaterials.length],
    );
    sideCanopyA.position.set(
      (-0.25 + hash(localSeed + 31) * 0.08) * scale,
      (1.14 + hash(localSeed + 32) * 0.08) * scale,
      (hash(localSeed + 33) - 0.5) * 0.18 * scale,
    );
    sideCanopyA.scale.set(0.72 * scale, 0.68 * scale, 0.72 * scale);
    sideCanopyA.castShadow = true;
    tree.add(sideCanopyA);

    const sideCanopyB = new THREE.Mesh(
      this.canopyGeometry,
      canopyMaterials[(canopyVariant + 2) % canopyMaterials.length],
    );
    sideCanopyB.position.set(
      (0.25 - hash(localSeed + 34) * 0.08) * scale,
      (1.13 + hash(localSeed + 35) * 0.09) * scale,
      (hash(localSeed + 36) - 0.5) * 0.18 * scale,
    );
    sideCanopyB.scale.set(0.7 * scale, 0.66 * scale, 0.72 * scale);
    sideCanopyB.castShadow = true;
    tree.add(sideCanopyB);

    if (hash(localSeed + 40) > 0.28) {
      const appleCount = 2 + Math.floor(hash(localSeed + 41) * 2);
      for (let appleIndex = 0; appleIndex < appleCount; appleIndex += 1) {
        const angle = hash(localSeed + 50 + appleIndex) * Math.PI * 2;
        const radius = (0.34 + hash(localSeed + 60 + appleIndex) * 0.12) * scale;
        const fruit = new THREE.Mesh(
          this.appleGeometry,
          appleIndex % 3 === 0 ? this.appleDark : this.apple,
        );
        fruit.position.set(
          Math.cos(angle) * radius,
          (1.08 + hash(localSeed + 70 + appleIndex) * 0.3) * scale,
          Math.sin(angle) * radius,
        );
        fruit.scale.setScalar(0.92 + hash(localSeed + 80 + appleIndex) * 0.18);
        fruit.castShadow = true;
        tree.add(fruit);
      }
    }

    tree.position.set(x, 0, z);
    group.add(tree);
  }

  private addFence(group: THREE.Group, fieldScale: number): void {
    const edge = fieldScale / 2 - 0.08;
    const fenceHeight = 0.56;
    const entranceGap = 0.9;
    const gatePostX = entranceGap / 2;

    const addPost = (x: number, z: number, height = fenceHeight): void => {
      const post = this.box(this.fence, 0.085, height, 0.085);
      post.position.set(x, height / 2, z);
      post.castShadow = true;
      group.add(post);
    };

    const addRailX = (centerX: number, z: number, length: number): void => {
      for (const y of [0.3, 0.48]) {
        const rail = this.box(this.fence, length, 0.065, 0.065);
        rail.position.set(centerX, y, z);
        rail.castShadow = true;
        group.add(rail);
      }
    };

    const addRailZ = (x: number, centerZ: number, length: number): void => {
      for (const y of [0.3, 0.48]) {
        const rail = this.box(this.fence, 0.065, 0.065, length);
        rail.position.set(x, y, centerZ);
        rail.castShadow = true;
        group.add(rail);
      }
    };

    addRailX(0, -edge, fieldScale - 0.16);
    addRailZ(-edge, 0, fieldScale - 0.16);
    addRailZ(edge, 0, fieldScale - 0.16);

    const frontSegmentLength = edge - gatePostX;
    addRailX(-(gatePostX + frontSegmentLength / 2), edge, frontSegmentLength);
    addRailX(gatePostX + frontSegmentLength / 2, edge, frontSegmentLength);

    const sidePostCount = Math.max(4, Math.round(fieldScale / 0.9) + 1);
    for (let index = 0; index < sidePostCount; index += 1) {
      const t = -edge + (index / (sidePostCount - 1)) * edge * 2;
      addPost(-edge, t);
      addPost(edge, t);
      addPost(t, -edge);
    }

    for (let index = 0; index < sidePostCount; index += 1) {
      const t = -edge + (index / (sidePostCount - 1)) * edge * 2;
      if (Math.abs(t) <= gatePostX + 0.08) continue;
      addPost(t, edge);
    }

    // Taller entrance posts make the deliberately open access point visible at gameplay zoom.
    addPost(-gatePostX, edge, 0.72);
    addPost(gatePostX, edge, 0.72);
  }

  private addEntrancePath(group: THREE.Group, fieldScale: number): void {
    const edge = fieldScale / 2 - 0.08;
    const pathLength = Math.min(1.15, fieldScale * 0.31);
    const path = this.box(this.packedEarth, 0.62, 0.035, pathLength);
    path.position.set(0, 0.22, edge - pathLength / 2 + 0.04);
    path.receiveShadow = true;
    group.add(path);
  }

  private addEntranceTrellis(group: THREE.Group, fieldScale: number): void {
    const edge = fieldScale / 2 - 0.08;
    const postHeight = 1.28;
    for (const x of [-0.52, 0.52]) {
      const post = this.box(this.fence, 0.11, postHeight, 0.11);
      post.position.set(x, postHeight / 2 + 0.18, edge - 0.03);
      post.castShadow = true;
      group.add(post);
    }
    const beam = this.box(this.fence, 1.28, 0.12, 0.14);
    beam.position.set(0, 1.38, edge - 0.03);
    beam.castShadow = true;
    group.add(beam);
  }

  private addPackingShed(group: THREE.Group, fieldScale: number): void {
    const edge = fieldScale / 2 - 0.08;
    const x = edge - 0.58;
    const z = -edge + 0.58;

    const foundation = this.box(this.crateWood, 1.18, 0.12, 0.94);
    foundation.position.set(x, 0.24, z);
    foundation.castShadow = true;
    group.add(foundation);

    const body = this.box(this.shedWall, 1.08, 1.04, 0.84);
    body.position.set(x, 0.8, z);
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    const roof = new THREE.Mesh(this.packingShedRoofGeometry, this.shedRoof);
    roof.position.set(x, 1.62, z);
    roof.rotation.y = Math.PI / 4;
    roof.scale.z = 0.72;
    roof.castShadow = true;
    group.add(roof);

    const loadingCanopy = this.box(this.fence, 0.92, 0.09, 0.42);
    loadingCanopy.position.set(x - 0.08, 1.08, z + 0.58);
    loadingCanopy.rotation.x = -0.08;
    loadingCanopy.castShadow = true;
    group.add(loadingCanopy);

    group.userData.orchardLandmark = 'packing-shed';
  }

  private addProduceCrate(group: THREE.Group, fieldScale: number, seed: number): void {
    const edge = fieldScale / 2 - 0.08;
    const direction = seed % 2 === 0 ? 1 : -1;
    const x = direction * 0.66;
    const z = edge - 0.46;

    const crate = this.box(this.crateWood, 0.42, 0.18, 0.34);
    crate.position.set(x, 0.25, z);
    crate.castShadow = true;
    group.add(crate);

    for (let index = 0; index < 3; index += 1) {
      const fruit = new THREE.Mesh(
        this.appleGeometry,
        index === 0 ? this.appleDark : this.apple,
      );
      fruit.position.set(
        x + (index - 1) * 0.11,
        0.39 + (index === 1 ? 0.035 : 0),
        z + (index % 2 === 0 ? 0.045 : -0.035),
      );
      fruit.scale.setScalar(0.86);
      fruit.castShadow = true;
      group.add(fruit);
    }
  }

  private box(
    material: THREE.Material,
    width: number,
    height: number,
    depth: number,
  ): THREE.Mesh {
    const mesh = new THREE.Mesh(this.unitBox, material);
    mesh.scale.set(width, height, depth);
    return mesh;
  }
}
