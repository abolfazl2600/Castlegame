import * as THREE from 'three';
import type { KeepState, TerrainKind, TileKind } from '../core/types';
import { CastleDetailGenerator } from '../building/CastleDetailGenerator';
import { MedievalMaterials } from './MedievalMaterials';

export interface KeepRenderContext {
  tileSize: number;
  toWorld: (x: number, y: number) => { x: number; z: number };
  elevationAt: (x: number, y: number) => number;
  terrainAt: (x: number, y: number) => TerrainKind;
  kindAt: (x: number, y: number) => TileKind | undefined;
}

export class KeepRenderer {
  constructor(
    private readonly details: CastleDetailGenerator,
    private readonly materials: MedievalMaterials,
  ) {}

  render(keep: KeepState, context: KeepRenderContext): THREE.Group {
    const group = new THREE.Group();
    const rotated = keep.rotation % 2 !== 0;
    const widthCells = rotated ? keep.depth : keep.width;
    const depthCells = rotated ? keep.width : keep.depth;
    const width = widthCells * context.tileSize * 0.88;
    const depth = depthCells * context.tileSize * 0.88;
    const center = context.toWorld(keep.x, keep.y);

    const elevations: number[] = [];
    const halfW = Math.floor(widthCells / 2);
    const halfD = Math.floor(depthCells / 2);

    for (let oy = 0; oy < depthCells; oy += 1) {
      for (let ox = 0; ox < widthCells; ox += 1) {
        elevations.push(
          context.elevationAt(keep.x - halfW + ox, keep.y - halfD + oy),
        );
      }
    }

    const minElevation = Math.min(...elevations, 0);
    const maxElevation = Math.max(...elevations, 0);
    const foundationBottom = 2.15 + minElevation;
    const foundationTop = 2.72 + maxElevation;
    const foundationHeight = Math.max(0.58, foundationTop - foundationBottom);

    group.position.set(center.x, 0, center.z);

    const stone = this.materials.stoneVariant(keep.x, keep.y);
    const stoneDark = this.materials.foundation;
    const stoneLight = this.materials.limestoneAlt;
    const wood = this.materials.timber;
    const roof = this.materials.roofTile;
    const roofDark = this.materials.roofDark;
    const slit = this.materials.arrowVoid;
    const windowMaterial = new THREE.MeshStandardMaterial({
      color: 0x8bcbd2,
      emissive: 0x123b43,
      emissiveIntensity: 0.35,
      roughness: 0.36,
    });

    this.addBox(
      group,
      width + 1.05,
      foundationHeight + 0.2,
      depth + 1.05,
      stoneDark,
      0,
      foundationBottom + (foundationHeight + 0.2) / 2,
      0,
    );
    this.addBox(
      group,
      width + 0.62,
      0.34,
      depth + 0.62,
      stoneLight,
      0,
      foundationTop - 0.08,
      0,
    );

    const floorHeight = 2.45;
    const floorGap = 0.13;
    const bodyBottom = foundationTop;
    const totalBodyHeight = keep.floors * floorHeight;
    const entranceSide = this.chooseEntrance(keep, context, widthCells, depthCells);

    for (let floor = 0; floor < keep.floors; floor += 1) {
      const y = bodyBottom + floor * floorHeight + floorHeight / 2;
      this.addBox(group, width, floorHeight - floorGap, depth, stone, 0, y, 0);

      this.addBox(
        group,
        width + 0.16,
        0.16,
        depth + 0.16,
        floor % 2 === 0 ? stoneDark : stoneLight,
        0,
        bodyBottom + (floor + 1) * floorHeight - 0.08,
        0,
      );
    }

    this.addKeepOpenings(
      group,
      keep,
      entranceSide,
      width,
      depth,
      bodyBottom,
      floorHeight,
      stoneDark,
      slit,
      windowMaterial,
    );

    this.addEntrance(
      group,
      keep,
      context,
      entranceSide,
      width,
      depth,
      foundationTop,
      wood,
      stoneLight,
    );

    const bodyTop = bodyBottom + totalBodyHeight;

    if (keep.cornerTowers) {
      this.addCornerTowers(
        group,
        keep,
        width,
        depth,
        foundationTop,
        bodyTop,
        stone,
        stoneDark,
        roof,
        slit,
      );
    }

    this.addRoof(group, keep, width, depth, bodyTop, stone, roof, roofDark);

    if (keep.battlements || keep.roof === 'flatBattlement' || keep.roof === 'defensivePlatform') {
      this.addBattlements(group, width, depth, bodyTop + 0.18, stone);
    }

    this.addFlags(group, keep, width, depth, bodyTop, wood, roof);

    group.userData.castleAccess = {
      groundConnected: true,
      floors: Array.from({ length: keep.floors }, (_, index) => ({
        floor: index + 1,
        connectedTo: index === 0 ? 'ground' : index,
      })),
    };

    return group;
  }

  private chooseEntrance(
    keep: KeepState,
    context: KeepRenderContext,
    widthCells: number,
    depthCells: number,
  ): 'N' | 'E' | 'S' | 'W' {
    const halfW = Math.floor(widthCells / 2);
    const halfD = Math.floor(depthCells / 2);
    const candidates = {
      N: { x: keep.x, y: keep.y - halfD - 1 },
      E: { x: keep.x + halfW + 1, y: keep.y },
      S: { x: keep.x, y: keep.y + halfD + 1 },
      W: { x: keep.x - halfW - 1, y: keep.y },
    } as const;

    const scores: Record<'N' | 'E' | 'S' | 'W', number> = {
      N: 0,
      E: 0,
      S: 0,
      W: 0,
    };

    for (const side of ['N', 'E', 'S', 'W'] as const) {
      const target = candidates[side];
      const terrain = context.terrainAt(target.x, target.y);
      const kind = context.kindAt(target.x, target.y);

      if (terrain === 'water' || terrain === 'river') scores[side] -= 20;
      else if (terrain === 'mountain') scores[side] -= 4;
      else scores[side] += 3;

      if (kind === 'road') scores[side] += 8;
      else if (kind) scores[side] -= 7;

      const outsideElevation = context.elevationAt(target.x, target.y);
      const centerElevation = context.elevationAt(keep.x, keep.y);
      scores[side] -= Math.abs(outsideElevation - centerElevation) * 2.2;
    }

    return this.details.chooseEntranceSide(keep, scores);
  }

  private addKeepOpenings(
    group: THREE.Group,
    keep: KeepState,
    entranceSide: 'N' | 'E' | 'S' | 'W',
    width: number,
    depth: number,
    bodyBottom: number,
    floorHeight: number,
    frameMaterial: THREE.Material,
    slitMaterial: THREE.Material,
    windowMaterial: THREE.Material,
  ): void {
    for (const side of ['N', 'E', 'S', 'W'] as const) {
      const span = side === 'N' || side === 'S' ? width : depth;
      const openings = this.details.keepOpenings(keep, side, span);

      for (const opening of openings) {
        if (opening.floor === 0 && side === entranceSide && Math.abs(opening.offset) < 1.3) {
          continue;
        }

        const y =
          bodyBottom +
          opening.floor * floorHeight +
          floorHeight * (opening.type === 'slit' ? 0.52 : 0.58);

        const widthOpening = opening.type === 'slit' ? 0.18 : 0.62 * opening.scale;
        const heightOpening = opening.type === 'slit' ? 0.84 : 0.72 * opening.scale;
        const material = opening.type === 'slit' ? slitMaterial : windowMaterial;

        let x = 0;
        let z = 0;
        let w = widthOpening;
        let d = 0.08;

        if (side === 'N') {
          x = opening.offset;
          z = -depth / 2 - 0.045;
        } else if (side === 'S') {
          x = -opening.offset;
          z = depth / 2 + 0.045;
        } else if (side === 'E') {
          x = width / 2 + 0.045;
          z = opening.offset;
          w = 0.08;
          d = widthOpening;
        } else {
          x = -width / 2 - 0.045;
          z = -opening.offset;
          w = 0.08;
          d = widthOpening;
        }

        this.addBox(group, w, heightOpening, d, material, x, y, z);

        if (opening.type === 'window') {
          this.addOpeningFrame(
            group,
            side,
            x,
            y,
            z,
            widthOpening,
            heightOpening,
            frameMaterial,
          );
        }
      }
    }
  }

  private addOpeningFrame(
    group: THREE.Group,
    side: 'N' | 'E' | 'S' | 'W',
    x: number,
    y: number,
    z: number,
    openingWidth: number,
    openingHeight: number,
    material: THREE.Material,
  ): void {
    const horizontal = side === 'N' || side === 'S';
    const edge = 0.08;

    if (horizontal) {
      this.addBox(group, openingWidth + 0.16, edge, 0.1, material, x, y + openingHeight / 2 + 0.06, z);
      this.addBox(group, openingWidth + 0.16, edge, 0.1, material, x, y - openingHeight / 2 - 0.06, z);
      this.addBox(group, edge, openingHeight, 0.1, material, x - openingWidth / 2 - 0.06, y, z);
      this.addBox(group, edge, openingHeight, 0.1, material, x + openingWidth / 2 + 0.06, y, z);
    } else {
      this.addBox(group, 0.1, edge, openingWidth + 0.16, material, x, y + openingHeight / 2 + 0.06, z);
      this.addBox(group, 0.1, edge, openingWidth + 0.16, material, x, y - openingHeight / 2 - 0.06, z);
      this.addBox(group, 0.1, openingHeight, edge, material, x, y, z - openingWidth / 2 - 0.06);
      this.addBox(group, 0.1, openingHeight, edge, material, x, y, z + openingWidth / 2 + 0.06);
    }
  }

  private addEntrance(
    group: THREE.Group,
    keep: KeepState,
    context: KeepRenderContext,
    side: 'N' | 'E' | 'S' | 'W',
    width: number,
    depth: number,
    foundationTop: number,
    wood: THREE.Material,
    stone: THREE.Material,
  ): void {
    const doorWidth = 1.25;
    const doorHeight = 1.75;
    const doorY = foundationTop + doorHeight / 2 + 0.04;
    let x = 0;
    let z = 0;
    let w = doorWidth;
    let d = 0.16;

    if (side === 'N') z = -depth / 2 - 0.09;
    else if (side === 'S') z = depth / 2 + 0.09;
    else if (side === 'E') {
      x = width / 2 + 0.09;
      w = 0.16;
      d = doorWidth;
    } else {
      x = -width / 2 - 0.09;
      w = 0.16;
      d = doorWidth;
    }

    this.addBox(group, w, doorHeight, d, wood, x, doorY, z);
    this.addOpeningFrame(group, side, x, doorY, z, doorWidth, doorHeight, stone);

    const direction = {
      N: { dx: 0, dy: -1, rx: 0 },
      E: { dx: 1, dy: 0, rx: Math.PI / 2 },
      S: { dx: 0, dy: 1, rx: Math.PI },
      W: { dx: -1, dy: 0, rx: -Math.PI / 2 },
    }[side];

    const rotated = keep.rotation % 2 !== 0;
    const widthCells = rotated ? keep.depth : keep.width;
    const depthCells = rotated ? keep.width : keep.depth;
    const halfCells =
      side === 'N' || side === 'S'
        ? Math.ceil(depthCells / 2)
        : Math.ceil(widthCells / 2);
    const outsideX = keep.x + direction.dx * halfCells;
    const outsideY = keep.y + direction.dy * halfCells;
    const terrainHeight = 2.22 + context.elevationAt(outsideX, outsideY);
    const threshold = foundationTop + 0.08;
    const rise = Math.max(0, threshold - terrainHeight);

    if (rise < 0.22) return;

    const stairGroup = new THREE.Group();
    stairGroup.rotation.y = direction.rx;
    group.add(stairGroup);

    const stepCount = Math.max(2, Math.ceil(rise / 0.32));
    const run = Math.min(3.2, 0.46 * stepCount);
    const halfSpan = side === 'N' || side === 'S' ? depth / 2 : width / 2;

    for (let i = 0; i < stepCount; i += 1) {
      const t = (i + 1) / stepCount;
      const stepDepth = run / stepCount + 0.05;
      this.addBox(
        stairGroup,
        Math.min(1.8, doorWidth + 0.5),
        0.18,
        stepDepth,
        stone,
        0,
        terrainHeight + t * rise,
        -(halfSpan + 0.18 + t * run),
      );
    }
  }

  private addCornerTowers(
    group: THREE.Group,
    keep: KeepState,
    width: number,
    depth: number,
    foundationTop: number,
    bodyTop: number,
    stone: THREE.Material,
    dark: THREE.Material,
    roof: THREE.Material,
    slit: THREE.Material,
  ): void {
    const radius = Math.max(0.78, Math.min(width, depth) * 0.09);
    const towerHeight = bodyTop - foundationTop + 1.15;
    const corners: Array<[number, number]> = [
      [-width / 2, -depth / 2],
      [width / 2, -depth / 2],
      [-width / 2, depth / 2],
      [width / 2, depth / 2],
    ];

    for (let index = 0; index < corners.length; index += 1) {
      const [x, z] = corners[index];
      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(radius, radius * 1.06, towerHeight, 12),
        stone,
      );
      body.position.set(x, foundationTop + towerHeight / 2, z);
      body.castShadow = true;
      body.receiveShadow = true;
      group.add(body);

      const bandCount = Math.max(2, keep.floors);
      for (let floor = 1; floor < bandCount; floor += 1) {
        const band = new THREE.Mesh(
          new THREE.CylinderGeometry(radius * 1.04, radius * 1.04, 0.12, 12),
          dark,
        );
        band.position.set(x, foundationTop + (towerHeight * floor) / bandCount, z);
        group.add(band);
      }

      for (let floor = 0; floor < keep.floors; floor += 1) {
        const slitMesh = this.addBox(
          group,
          0.12,
          0.62,
          0.08,
          slit,
          x,
          foundationTop + 1.05 + floor * 2.15,
          z - radius - 0.02,
        );
        slitMesh.rotation.y = index % 2 === 0 ? 0 : Math.PI / 2;
      }

      if (keep.roof === 'sloped' || keep.roof === 'towered') {
        const eave = new THREE.Mesh(
          new THREE.CylinderGeometry(radius * 1.42, radius * 1.42, 0.2, 12),
          this.materials.roofDark,
        );
        eave.position.set(x, foundationTop + towerHeight + 0.08, z);
        eave.castShadow = true;
        group.add(eave);

        const cap = new THREE.Mesh(new THREE.ConeGeometry(radius * 1.38, 1.85, 12), roof);
        cap.position.set(x, foundationTop + towerHeight + 1.0, z);
        cap.castShadow = true;
        group.add(cap);
      } else {
        this.addTowerBattlements(group, x, z, radius, foundationTop + towerHeight, stone);
      }
    }
  }

  private addTowerBattlements(
    group: THREE.Group,
    x: number,
    z: number,
    radius: number,
    y: number,
    material: THREE.Material,
  ): void {
    const count = 8;
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2;
      this.addBox(
        group,
        0.34,
        0.56,
        0.34,
        material,
        x + Math.cos(angle) * radius,
        y + 0.3,
        z + Math.sin(angle) * radius,
      );
    }
  }

  private addRoof(
    group: THREE.Group,
    keep: KeepState,
    width: number,
    depth: number,
    bodyTop: number,
    stone: THREE.Material,
    roof: THREE.Material,
    roofDark: THREE.Material,
  ): void {
    if (keep.roof === 'sloped') {
      const roofHeight = Math.max(1.9, Math.min(width, depth) * 0.2);
      this.addBox(group, width + 0.52, 0.2, depth + 0.52, roofDark, 0, bodyTop + 0.08, 0);

      const mesh = new THREE.Mesh(
        new THREE.ConeGeometry(Math.max(width, depth) * 0.67, roofHeight, 4),
        roof,
      );
      mesh.position.y = bodyTop + 0.14 + roofHeight / 2;
      mesh.rotation.y = Math.PI / 4;
      mesh.scale.set(width / Math.max(width, depth), 1, depth / Math.max(width, depth));
      mesh.castShadow = true;
      group.add(mesh);
      return;
    }

    if (keep.roof === 'towered') {
      this.addBox(group, width * 0.55, 1.2, depth * 0.55, stone, 0, bodyTop + 0.6, 0);
      const crown = new THREE.Mesh(
        new THREE.ConeGeometry(Math.max(width, depth) * 0.31, 1.9, 4),
        roof,
      );
      crown.position.y = bodyTop + 2.15;
      crown.rotation.y = Math.PI / 4;
      crown.castShadow = true;
      group.add(crown);
      return;
    }

    this.addBox(
      group,
      width * 0.92,
      0.22,
      depth * 0.92,
      keep.roof === 'defensivePlatform' ? roofDark : stone,
      0,
      bodyTop + 0.1,
      0,
    );
  }

  private addBattlements(
    group: THREE.Group,
    width: number,
    depth: number,
    y: number,
    material: THREE.Material,
  ): void {
    const inset = 0.28;
    this.addCrenellatedStrip(group, width - inset * 2, -depth / 2 + inset, y, 0, material);
    this.addCrenellatedStrip(group, width - inset * 2, depth / 2 - inset, y, Math.PI, material);
    this.addCrenellatedStrip(group, depth - inset * 2, -width / 2 + inset, y, Math.PI / 2, material);
    this.addCrenellatedStrip(group, depth - inset * 2, width / 2 - inset, y, -Math.PI / 2, material);
  }

  private addCrenellatedStrip(
    group: THREE.Group,
    span: number,
    z: number,
    y: number,
    rotationY: number,
    material: THREE.Material,
  ): void {
    const merlonWidth = 0.72;
    const crenelWidth = 0.52;
    const baseHeight = 0.38;
    const merlonHeight = 0.82;
    const module = merlonWidth + crenelWidth;
    const count = Math.max(2, Math.floor(span / module));
    const actualSpan = count * module + merlonWidth;
    const shape = new THREE.Shape();

    let x = -actualSpan / 2;
    shape.moveTo(x, 0);
    shape.lineTo(actualSpan / 2, 0);
    shape.lineTo(actualSpan / 2, baseHeight + merlonHeight);

    for (let i = count; i >= 0; i -= 1) {
      const merlonRight = -actualSpan / 2 + i * module + merlonWidth;
      const merlonLeft = merlonRight - merlonWidth;
      shape.lineTo(merlonRight, baseHeight + merlonHeight);
      shape.lineTo(merlonLeft, baseHeight + merlonHeight);

      if (i > 0) {
        shape.lineTo(merlonLeft, baseHeight);
        shape.lineTo(merlonLeft - crenelWidth, baseHeight);
      }
    }

    shape.lineTo(-actualSpan / 2, 0);

    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: 0.34,
      bevelEnabled: true,
      bevelSize: 0.035,
      bevelThickness: 0.025,
      bevelSegments: 1,
      curveSegments: 1,
    });
    geometry.translate(0, 0, -0.17);

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(0, y, z);
    mesh.rotation.y = rotationY;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  private addFlags(
    group: THREE.Group,
    keep: KeepState,
    width: number,
    depth: number,
    bodyTop: number,
    wood: THREE.Material,
    cloth: THREE.Material,
  ): void {
    for (const [index, placement] of this.details.keepFlags(keep).entries()) {
      const x = placement.xFactor * width;
      const z = placement.zFactor * depth;
      const mastHeight = placement.primary ? 3.0 : 2.25;
      const mastBase = bodyTop + (keep.roof === 'sloped' ? 1.0 : 0.3);

      this.addBox(group, 0.08, mastHeight, 0.08, wood, x, mastBase + mastHeight / 2, z);

      const flag = this.addBox(
        group,
        placement.primary ? 1.35 : 0.95,
        placement.primary ? 0.65 : 0.46,
        0.055,
        cloth,
        x + (placement.primary ? 0.7 : 0.5),
        mastBase + placement.heightOffset,
        z,
      );
      flag.userData.castleFlag = { phase: keep.seed * 0.001 + index * 0.7 };
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
