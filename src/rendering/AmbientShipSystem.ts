import * as THREE from 'three';
import type { TerrainKind } from '../core/types';

export interface AmbientShipContext {
  cols: () => number;
  rows: () => number;
  tileSize: number;
  terrainAt: (x: number, y: number) => TerrainKind;
  gridToWorld: (x: number, y: number) => { x: number; z: number };
}

export interface AmbientShipUpdateOptions {
  effectsEnabled: boolean;
  reducedMotion: boolean;
  environmentDetail: 'low' | 'medium' | 'high';
  animationScale: number;
  cameraDistance: number;
  strategicDistance: number;
}

interface WaterRoute {
  start: THREE.Vector3;
  end: THREE.Vector3;
  length: number;
  signature: string;
  score: number;
}

interface ShipVisual {
  root: THREE.Group;
  fineDetail: THREE.Group;
  wake: THREE.Group;
  flag: THREE.Object3D;
}

export class AmbientShipSystem {
  readonly layer = new THREE.Group();

  private route: WaterRoute | null = null;
  private visual: ShipVisual | null = null;
  private progress = 0.28;
  private direction: 1 | -1 = 1;

  constructor(private readonly context: AmbientShipContext) {
    this.layer.name = 'ambient-maritime-ship';
  }

  get count(): number {
    return this.visual ? 1 : 0;
  }

  rebuild(seed = 0): void {
    const nextRoute = this.findWaterRoute(seed);
    if (!nextRoute) {
      this.clear();
      return;
    }

    if (this.route?.signature === nextRoute.signature && this.visual) return;

    this.clear();
    this.route = nextRoute;
    this.progress = 0.22 + (Math.abs(Math.trunc(seed)) % 31) / 100;
    this.direction = (Math.abs(Math.trunc(seed)) % 2 === 0 ? 1 : -1);

    const visual = this.createDetailedShip();
    this.visual = visual;
    this.layer.add(visual.root);
    this.placeOnRoute(0);
  }

  update(deltaMs: number, timeMs: number, options: AmbientShipUpdateOptions): void {
    if (!this.route || !this.visual) return;

    const detailDistance = Math.max(1, options.strategicDistance * 0.86);
    this.visual.fineDetail.visible =
      options.environmentDetail !== 'low' &&
      options.cameraDistance < detailDistance;

    const canAnimate =
      options.effectsEnabled &&
      !options.reducedMotion &&
      options.animationScale > 0.03;

    this.visual.wake.visible =
      canAnimate &&
      options.environmentDetail !== 'low' &&
      options.cameraDistance < options.strategicDistance;

    if (!canAnimate) {
      this.placeOnRoute(0);
      this.visual.root.position.y = 0;
      this.visual.root.rotation.z = 0;
      this.visual.root.rotation.x = 0;
      return;
    }

    const dt = Math.min(50, Math.max(0, deltaMs)) / 1000;
    const speed = this.context.tileSize * 0.115 * THREE.MathUtils.clamp(options.animationScale, 0.35, 1);
    const normalizedStep = (speed * dt) / Math.max(0.001, this.route.length);
    this.progress += normalizedStep * this.direction;

    if (this.progress >= 1) {
      this.progress = 1;
      this.direction = -1;
    } else if (this.progress <= 0) {
      this.progress = 0;
      this.direction = 1;
    }

    this.placeOnRoute(dt);

    const bob = Math.sin(timeMs * 0.00105) * 0.055 * options.animationScale;
    const roll = Math.sin(timeMs * 0.00073 + 1.7) * 0.012 * options.animationScale;
    const pitch = Math.cos(timeMs * 0.00061 + 0.4) * 0.008 * options.animationScale;
    this.visual.root.position.y = bob;
    this.visual.root.rotation.z = roll;
    this.visual.root.rotation.x = pitch;
    this.visual.flag.rotation.y = Math.sin(timeMs * 0.0022) * 0.12 * options.animationScale;
  }

  private placeOnRoute(dt: number): void {
    if (!this.route || !this.visual) return;

    const { start, end } = this.route;
    this.visual.root.position.x = THREE.MathUtils.lerp(start.x, end.x, this.progress);
    this.visual.root.position.z = THREE.MathUtils.lerp(start.z, end.z, this.progress);

    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const forward = Math.atan2(dx, dz) + (this.direction < 0 ? Math.PI : 0);
    if (dt <= 0) {
      this.visual.root.rotation.y = forward;
      return;
    }

    const current = this.visual.root.rotation.y;
    const delta = Math.atan2(Math.sin(forward - current), Math.cos(forward - current));
    const turn = 1 - Math.exp(-dt * 1.8);
    this.visual.root.rotation.y = current + delta * turn;
  }

  private findWaterRoute(seed: number): WaterRoute | null {
    const candidates: WaterRoute[] = [];
    const cols = this.context.cols();
    const rows = this.context.rows();
    const centerX = (cols - 1) / 2;
    const centerY = (rows - 1) / 2;

    const addRun = (
      horizontal: boolean,
      fixed: number,
      startIndex: number,
      endIndex: number,
    ): void => {
      const cells = endIndex - startIndex + 1;
      if (cells < 9) return;

      const padding = cells >= 12 ? 2 : 1;
      const a = startIndex + padding;
      const b = endIndex - padding;
      if (b - a < 4) return;

      const startGrid = horizontal ? { x: a, y: fixed } : { x: fixed, y: a };
      const endGrid = horizontal ? { x: b, y: fixed } : { x: fixed, y: b };
      const startWorld = this.context.gridToWorld(startGrid.x, startGrid.y);
      const endWorld = this.context.gridToWorld(endGrid.x, endGrid.y);
      const start = new THREE.Vector3(startWorld.x, 0, startWorld.z);
      const end = new THREE.Vector3(endWorld.x, 0, endWorld.z);
      const length = start.distanceTo(end);
      const runCenter = (startIndex + endIndex) * 0.5;
      const proximity = horizontal
        ? Math.abs(fixed - centerY) + Math.abs(runCenter - centerX) * 0.35
        : Math.abs(fixed - centerX) + Math.abs(runCenter - centerY) * 0.35;
      const score = cells * 10 - proximity * 2.4;

      candidates.push({
        start,
        end,
        length,
        score,
        signature:
          (horizontal ? 'h' : 'v') +
          ':' + fixed +
          ':' + startIndex +
          ':' + endIndex,
      });
    };

    for (let y = 0; y < rows; y += 1) {
      let runStart = -1;
      for (let x = 0; x <= cols; x += 1) {
        const water = x < cols && this.context.terrainAt(x, y) === 'water';
        if (water && runStart < 0) runStart = x;
        if (!water && runStart >= 0) {
          addRun(true, y, runStart, x - 1);
          runStart = -1;
        }
      }
    }

    for (let x = 0; x < cols; x += 1) {
      let runStart = -1;
      for (let y = 0; y <= rows; y += 1) {
        const water = y < rows && this.context.terrainAt(x, y) === 'water';
        if (water && runStart < 0) runStart = y;
        if (!water && runStart >= 0) {
          addRun(false, x, runStart, y - 1);
          runStart = -1;
        }
      }
    }

    if (candidates.length === 0) return null;
    candidates.sort((a, b) => b.score - a.score);

    const topCount = Math.min(3, candidates.length);
    const choice = Math.abs(Math.trunc(seed)) % topCount;
    return candidates[choice];
  }

  private createDetailedShip(): ShipVisual {
    const root = new THREE.Group();
    root.name = 'ambient-detailed-sailing-ship';

    const fineDetail = new THREE.Group();
    fineDetail.name = 'ambient-ship-fine-detail';
    root.add(fineDetail);

    const wake = new THREE.Group();
    wake.name = 'ambient-ship-wake';
    wake.position.set(0, 0, -4.4);
    root.add(wake);

    const hull = this.material(0x5a3526, 0.86);
    const hullDark = this.material(0x2d1d18, 0.93);
    const timber = this.material(0x805637, 0.82);
    const timberDark = this.material(0x4a3024, 0.9);
    const timberLight = this.material(0xa77848, 0.8);
    const rope = this.material(0xb79b6d, 1);
    const sail = this.material(0xe4d7b7, 0.92, THREE.DoubleSide);
    const sailAccent = this.material(0xb95f49, 0.88, THREE.DoubleSide);
    const metal = this.material(0x47484a, 0.55);
    const glass = this.material(0xe8b45a, 0.5, THREE.FrontSide, 0.72);
    const cargo = this.material(0x71503a, 0.94);
    const wakeMat = new THREE.MeshBasicMaterial({
      color: 0xe8fbff,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const hullMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(1.12, 1.5, 7.5, 12),
      hull,
    );
    hullMesh.rotation.x = Math.PI / 2;
    hullMesh.scale.z = 0.58;
    hullMesh.position.y = 1.12;
    hullMesh.castShadow = true;
    root.add(hullMesh);

    this.addBox(root, 1.05, 0.28, 7.8, hullDark, 0, 0.76, 0, true);
    this.addBox(root, 2.42, 0.18, 5.65, timberLight, 0, 1.5, -0.1, true);
    this.addBox(root, 2.05, 0.24, 1.55, timber, 0, 1.72, 2.8, true);
    this.addBox(root, 1.95, 0.2, 1.25, timber, 0, 1.64, -3.0, true);

    for (const side of [-1, 1]) {
      this.addBox(root, 0.09, 0.12, 5.6, timberDark, side * 1.22, 1.88, -0.05);
      for (let i = 0; i < 6; i += 1) {
        this.addBox(root, 0.075, 0.56, 0.075, timberDark, side * 1.22, 1.7, -2.55 + i * 1.02);
      }
    }

    this.addBox(root, 1.7, 0.95, 1.35, hullDark, 0, 2.12, 2.42, true);
    this.addBox(root, 1.5, 0.72, 1.14, timberLight, 0, 2.64, 2.42, true);
    const cabinRoof = new THREE.Mesh(new THREE.ConeGeometry(1.22, 0.54, 4), hullDark);
    cabinRoof.rotation.y = Math.PI / 4;
    cabinRoof.scale.z = 0.72;
    cabinRoof.position.set(0, 3.22, 2.42);
    cabinRoof.castShadow = true;
    root.add(cabinRoof);

    for (const side of [-1, 1]) {
      const windowMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.3), glass);
      windowMesh.position.set(side * 0.756, 2.72, 2.28);
      windowMesh.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
      fineDetail.add(windowMesh);
    }

    const mastA = this.addCylinder(root, 0.11, 0.15, 5.4, timber, 0, 4.05, -1.25, 9, true);
    const mastB = this.addCylinder(root, 0.1, 0.13, 4.65, timber, 0, 3.68, 1.42, 9, true);
    mastA.userData.ambientShipMast = true;
    mastB.userData.ambientShipMast = true;

    this.addBox(root, 3.05, 0.1, 0.1, timberDark, 0, 5.25, -1.25);
    this.addBox(root, 2.55, 0.09, 0.09, timberDark, 0, 4.72, 1.42);
    this.addBox(root, 2.28, 0.08, 0.08, timberDark, 0, 3.72, -1.25);

    this.addSail(root, sail, 2.62, 2.1, 0, 4.25, -1.21);
    this.addSail(root, sailAccent, 2.08, 1.72, 0, 3.95, 1.46);
    this.addSail(fineDetail, sail, 1.84, 1.25, 0, 3.18, -1.2);

    const crowsNest = this.addCylinder(fineDetail, 0.44, 0.52, 0.34, hullDark, 0, 6.18, -1.25, 10);
    crowsNest.rotation.y = Math.PI / 10;

    this.addRigging(fineDetail, rope, [
      new THREE.Vector3(0, 6.65, -1.25),
      new THREE.Vector3(-1.16, 1.88, -2.8),
    ]);
    this.addRigging(fineDetail, rope, [
      new THREE.Vector3(0, 6.65, -1.25),
      new THREE.Vector3(1.16, 1.88, -2.8),
    ]);
    this.addRigging(fineDetail, rope, [
      new THREE.Vector3(0, 6.65, -1.25),
      new THREE.Vector3(0, 1.82, 3.6),
    ]);
    this.addRigging(fineDetail, rope, [
      new THREE.Vector3(0, 5.95, 1.42),
      new THREE.Vector3(-1.12, 1.86, 2.85),
    ]);
    this.addRigging(fineDetail, rope, [
      new THREE.Vector3(0, 5.95, 1.42),
      new THREE.Vector3(1.12, 1.86, 2.85),
    ]);

    const flag = new THREE.Group();
    flag.position.set(0, 6.74, -1.25);
    const flagPole = this.addBox(flag, 0.045, 0.8, 0.045, timberDark, 0, 0.32, 0);
    flagPole.castShadow = false;
    const flagCloth = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.36), sailAccent);
    flagCloth.position.set(0.37, 0.55, 0);
    flagCloth.rotation.y = 0.03;
    flag.add(flagCloth);
    root.add(flag);

    for (const x of [-0.62, 0.1, 0.66]) {
      this.addBox(fineDetail, 0.52, 0.5, 0.58, cargo, x, 1.86, 0.08, true);
    }

    for (const x of [-0.88, 0.88]) {
      const barrel = this.addCylinder(fineDetail, 0.27, 0.27, 0.52, timber, x, 1.88, 1.08, 10);
      barrel.rotation.z = Math.PI / 2;
    }

    const anchor = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.055, 6, 12), metal);
    anchor.position.set(-1.38, 1.18, -2.35);
    anchor.rotation.y = Math.PI / 2;
    fineDetail.add(anchor);
    this.addBox(fineDetail, 0.07, 0.65, 0.07, metal, -1.38, 0.92, -2.35);

    this.addBox(fineDetail, 0.55, 0.82, 0.12, timberDark, 0, 1.02, 3.9);
    for (const side of [-1, 1]) {
      const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.11, 7, 6), glass);
      lantern.position.set(side * 0.72, 3.02, 2.95);
      fineDetail.add(lantern);
    }

    const wakePlaneA = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 4.2), wakeMat);
    wakePlaneA.rotation.x = -Math.PI / 2;
    wakePlaneA.rotation.z = 0.18;
    wakePlaneA.position.set(-0.72, 0.99, -1.2);
    wake.add(wakePlaneA);

    const wakePlaneB = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 4.2), wakeMat);
    wakePlaneB.rotation.x = -Math.PI / 2;
    wakePlaneB.rotation.z = -0.18;
    wakePlaneB.position.set(0.72, 0.99, -1.2);
    wake.add(wakePlaneB);

    root.userData.ambientShip = true;
    root.userData.ambientShipDetail = 'high';
    return { root, fineDetail, wake, flag };
  }

  private addSail(
    group: THREE.Group,
    material: THREE.Material,
    width: number,
    height: number,
    x: number,
    y: number,
    z: number,
  ): void {
    const shape = new THREE.Shape();
    shape.moveTo(-width * 0.5, height * 0.5);
    shape.lineTo(width * 0.5, height * 0.42);
    shape.lineTo(width * 0.42, -height * 0.5);
    shape.lineTo(-width * 0.44, -height * 0.42);
    shape.closePath();
    const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), material);
    mesh.position.set(x, y, z);
    mesh.rotation.y = 0.015;
    mesh.castShadow = true;
    group.add(mesh);
  }

  private addRigging(group: THREE.Group, material: THREE.MeshStandardMaterial, points: THREE.Vector3[]): void {
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const color = material.color.clone();
    const lineMaterial = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.72,
    });
    group.add(new THREE.Line(geometry, lineMaterial));
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
    castShadow = false,
  ): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = castShadow;
    group.add(mesh);
    return mesh;
  }

  private addCylinder(
    group: THREE.Group,
    radiusTop: number,
    radiusBottom: number,
    height: number,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
    segments = 8,
    castShadow = false,
  ): THREE.Mesh {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments),
      material,
    );
    mesh.position.set(x, y, z);
    mesh.castShadow = castShadow;
    group.add(mesh);
    return mesh;
  }

  private material(
    color: number,
    roughness: number,
    side: THREE.Side = THREE.FrontSide,
    opacity = 1,
  ): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({
      color,
      roughness,
      metalness: color === 0x47484a ? 0.36 : 0.02,
      side,
      transparent: opacity < 1,
      opacity,
    });
  }

  private clear(): void {
    const materials = new Set<THREE.Material>();
    const geometries = new Set<THREE.BufferGeometry>();

    this.layer.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.geometry) geometries.add(mesh.geometry);
      const material = (mesh as { material?: THREE.Material | THREE.Material[] }).material;
      if (Array.isArray(material)) material.forEach((entry) => materials.add(entry));
      else if (material) materials.add(material);
    });

    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    this.layer.clear();
    this.visual = null;
    this.route = null;
  }
}
