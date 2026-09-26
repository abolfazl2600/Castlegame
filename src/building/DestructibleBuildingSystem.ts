import * as THREE from 'three';
import type { GridCell, TileKind } from '../core/types';

export type BuildingDamageStage =
  | 'healthy'
  | 'light'
  | 'heavy'
  | 'severe'
  | 'destroyed';

export interface BuildingDamageInfo {
  damage: number;
  stage: BuildingDamageStage;
}

const NON_DESTRUCTIBLE: ReadonlySet<TileKind> = new Set([
  'road',
  'dirtRoad',
  'stoneRoad',
  'moat',
  'tree',
  'rock',
  'mountain',
  'river' as TileKind,
]);

export class DestructibleBuildingSystem {
  getStage(damage = 0): BuildingDamageStage {
    const value = THREE.MathUtils.clamp(Number.isFinite(damage) ? damage : 0, 0, 1);
    if (value >= 1) return 'destroyed';
    if (value >= 0.78) return 'severe';
    if (value >= 0.5) return 'heavy';
    if (value > 0) return 'light';
    return 'healthy';
  }

  getInfo(cell: GridCell): BuildingDamageInfo {
    const damage = THREE.MathUtils.clamp(cell.damage ?? 0, 0, 1);
    return { damage, stage: this.getStage(damage) };
  }

  isDestructible(kind: TileKind): boolean {
    return !NON_DESTRUCTIBLE.has(kind);
  }

  maxHealth(kind: TileKind, level = 1): number {
    const base =
      kind === 'wall3' ? 860 :
      kind === 'wall1' ? 650 :
      kind === 'wall2' ? 430 :
      kind === 'tower' ? 900 :
      kind === 'gate' ? 620 :
      kind === 'stairTower' ? 680 :
      kind === 'manor' ? 520 :
      kind === 'villa' ? 460 :
      kind === 'house' ? 380 :
      kind === 'cottage' ? 300 :
      kind === 'keep' ? 1100 :
      kind === 'marketHall' ? 480 :
      kind === 'smallMarket' ? 330 :
      kind === 'marketStall' ? 180 :
      kind === 'windmill' ? 420 :
      kind === 'farm' || kind === 'appleOrchard' ? 260 :
      kind === 'armyCamp' ? 280 :
      kind === 'mine' || kind === 'hut' ? 240 :
      kind === 'smallDock' || kind === 'woodenPier' || kind === 'harbor' || kind === 'fishingDock' ? 340 :
      300;

    return Math.round(base * (1 + Math.max(0, level - 1) * 0.15));
  }

  applyDamage(cell: GridCell, amount: number): number {
    const maxHealth = this.maxHealth(cell.kind, cell.level ?? 1);
    const next = THREE.MathUtils.clamp((cell.damage ?? 0) + Math.max(0, amount) / maxHealth, 0, 1);
    return next;
  }

  setDamageRatio(cell: GridCell, ratio: number): number {
    return THREE.MathUtils.clamp(Number.isFinite(ratio) ? ratio : 0, 0, 1);
  }

  renderDamage(group: THREE.Group, cell: GridCell): void {
    const info = this.getInfo(cell);
    if (info.stage === 'healthy' || !this.isDestructible(cell.kind)) return;

    const meshes: THREE.Mesh[] = [];
    group.traverse((object) => {
      if (object instanceof THREE.Mesh && object.userData.destructibleVisual !== true) meshes.push(object);
    });

    const damageMaterial = new THREE.MeshStandardMaterial({
      color: 0x302a26,
      roughness: 1,
    });
    const rubbleMaterial = new THREE.MeshStandardMaterial({
      color: 0x81766c,
      roughness: 1,
      flatShading: true,
    });

    const seed = Math.abs(cell.x * 92821 + cell.y * 68917 + cell.kind.length * 131);
    const upper = meshes
      .map((mesh, index) => ({ mesh, index, score: mesh.position.y + index * 0.013 }))
      .sort((a, b) => b.score - a.score);

    if (info.stage === 'heavy' || info.stage === 'severe' || info.stage === 'destroyed') {
      const hideCount =
        info.stage === 'destroyed'
          ? Math.ceil(meshes.length * 0.42)
          : info.stage === 'severe'
            ? Math.ceil(meshes.length * 0.24)
            : Math.ceil(meshes.length * 0.1);

      for (let i = 0; i < hideCount; i += 1) {
        const candidate = upper[(i * 3 + seed) % Math.max(1, upper.length)];
        if (candidate) candidate.mesh.visible = false;
      }
    }

    const crackCount =
      info.stage === 'light' ? 2 :
      info.stage === 'heavy' ? 4 :
      info.stage === 'severe' ? 6 :
      7;

    for (let i = 0; i < crackCount; i += 1) {
      const crack = new THREE.Mesh(
        new THREE.BoxGeometry(
          0.055 + (i % 2) * 0.025,
          0.65 + (i % 3) * 0.32,
          0.08,
        ),
        damageMaterial,
      );
      crack.userData.destructibleVisual = true;
      crack.position.set(
        ((i * 37 + seed) % 100) / 100 * 3.0 - 1.5,
        1.55 + ((i * 17 + seed) % 100) / 100 * 2.4,
        ((i * 53 + seed) % 100) / 100 * 2.2 - 1.1,
      );
      crack.rotation.z = (i % 2 ? -1 : 1) * (0.22 + (i % 4) * 0.09);
      group.add(crack);
    }

    if (info.stage === 'heavy' || info.stage === 'severe' || info.stage === 'destroyed') {
      const rubbleCount = info.stage === 'destroyed' ? 10 : info.stage === 'severe' ? 7 : 4;
      for (let i = 0; i < rubbleCount; i += 1) {
        const chunk = new THREE.Mesh(
          new THREE.DodecahedronGeometry(0.12 + (i % 3) * 0.055, 0),
          rubbleMaterial,
        );
        chunk.userData.destructibleVisual = true;
        chunk.position.set(
          -1.4 + (i % 5) * 0.7,
          0.16 + Math.floor(i / 5) * 0.14,
          -1.15 + (i % 4) * 0.55,
        );
        chunk.rotation.set(i * 0.37, i * 0.51, i * 0.29);
        chunk.scale.y = 0.7;
        chunk.castShadow = true;
        group.add(chunk);
      }
    }

    if (info.stage === 'severe' || info.stage === 'destroyed') {
      const smoke = new THREE.Mesh(
        new THREE.SphereGeometry(info.stage === 'destroyed' ? 0.42 : 0.28, 7, 6),
        new THREE.MeshStandardMaterial({
          color: 0x4b4540,
          transparent: true,
          opacity: 0.3,
          roughness: 1,
        }),
      );
      smoke.userData.destructibleVisual = true;
      smoke.position.set(0.35, 3.8, 0.1);
      group.add(smoke);
    }
  }
}
