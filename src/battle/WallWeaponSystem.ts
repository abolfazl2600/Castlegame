import * as THREE from 'three';
import { WallDefenseSystem, type WallWeaponPosition } from '../building/WallDefenseSystem';
import type { GridCell } from '../core/types';
import type {
  WallProjectileType,
  WallTargetType,
  WallWeapon,
  WallWeaponType,
} from './WallWeapon';

export interface WallWeaponTarget {
  id: string;
  faction: string;
  position: THREE.Vector3;
  kind: 'ground' | 'air';
  alive: boolean;
}

export interface WallWeaponWorld {
  size: number;
  tileSize: number;
  gridToWorld: (x: number, y: number) => { x: number; z: number };
  elevationAt: (x: number, y: number) => number;
  fortificationTopAt: (x: number, y: number, cell: GridCell) => number;
  cellAt: (x: number, y: number) => GridCell | undefined;
  isModernMode: () => boolean;
  isWallOperational: (x: number, y: number) => boolean;
  getTargets: () => WallWeaponTarget[];
  applyDamage: (targetId: string, damage: number) => void;
  applyAreaDamage: (origin: THREE.Vector3, radius: number, damage: number) => void;
}

interface WeaponConfig {
  type: WallWeaponType;
  range: number;
  damage: number;
  fireRate: number;
  projectileType: WallProjectileType;
  targetType: WallTargetType;
  rotationSpeed: number;
}

interface MountRuntime {
  key: string;
  position: WallWeaponPosition;
  weapon: WallWeapon;
  root: THREE.Group;
  barrel: THREE.Group;
  muzzle: THREE.Object3D;
}

interface Projectile {
  kind: WallProjectileType;
  view: THREE.Object3D;
  targetId: string;
  damage: number;
  speed: number;
  life: number;
  blastRadius: number;
  lastTargetPosition: THREE.Vector3;
}

const CONFIGS: Record<WallWeaponType, WeaponConfig> = {
  heavyMachineGun: {
    type: 'heavyMachineGun',
    range: 22,
    damage: 9,
    fireRate: 7,
    projectileType: 'bullet',
    targetType: 'ground',
    rotationSpeed: 4.8,
  },
  automaticCannon: {
    type: 'automaticCannon',
    range: 27,
    damage: 24,
    fireRate: 1.7,
    projectileType: 'shell',
    targetType: 'ground',
    rotationSpeed: 3.8,
  },
  plasmaCannon: {
    type: 'plasmaCannon',
    range: 31,
    damage: 38,
    fireRate: 0.8,
    projectileType: 'plasma',
    targetType: 'any',
    rotationSpeed: 3.1,
  },
  missileLauncher: {
    type: 'missileLauncher',
    range: 38,
    damage: 58,
    fireRate: 0.28,
    projectileType: 'missile',
    targetType: 'any',
    rotationSpeed: 2.2,
  },
};

const TYPE_ORDER: WallWeaponType[] = [
  'heavyMachineGun',
  'automaticCannon',
  'plasmaCannon',
  'missileLauncher',
];

export class WallWeaponSystem {
  private readonly mounts = new Map<string, MountRuntime>();
  private readonly projectiles: Projectile[] = [];
  private readonly emissiveMaterial = new THREE.MeshStandardMaterial({
    color: 0x77eaff,
    emissive: 0x22a8c8,
    emissiveIntensity: 2.2,
    metalness: 0.15,
    roughness: 0.18,
  });
  private readonly weaponMaterial = new THREE.MeshStandardMaterial({
    color: 0x202a32,
    metalness: 0.92,
    roughness: 0.2,
  });
  private readonly armorMaterial = new THREE.MeshStandardMaterial({
    color: 0x697782,
    metalness: 0.88,
    roughness: 0.24,
  });
  private readonly projectileMaterial = new THREE.MeshStandardMaterial({
    color: 0xffd36a,
    emissive: 0x9c4b12,
    emissiveIntensity: 1.5,
    metalness: 0.2,
    roughness: 0.3,
  });
  private readonly missileMaterial = new THREE.MeshStandardMaterial({
    color: 0x59656c,
    metalness: 0.88,
    roughness: 0.24,
  });
  private readonly explosionMaterial = new THREE.MeshBasicMaterial({
    color: 0xffa23b,
    transparent: true,
    opacity: 0.78,
    depthWrite: false,
  });
  private readonly geometryCache: THREE.BufferGeometry[] = [];
  private readonly materialCache: THREE.Material[] = [];
  private refreshTimer = 0;

  constructor(
    private readonly layer: THREE.Group,
    private readonly world: WallWeaponWorld,
  ) {
    this.materialCache.push(
      this.emissiveMaterial,
      this.weaponMaterial,
      this.armorMaterial,
      this.projectileMaterial,
      this.missileMaterial,
      this.explosionMaterial,
    );
  }

  update(delta: number): void {
    if (!this.world.isModernMode()) {
      this.clear();
      this.clearProjectiles();
      return;
    }

    this.refreshTimer -= delta;
    if (this.refreshTimer <= 0) {
      this.refreshTimer = 0.75;
      this.syncMounts();
    }

    const targets = this.world.getTargets();
    for (const mount of this.mounts.values()) {
      this.updateMount(mount, targets, delta);
    }

    this.updateProjectiles(delta);
  }

  reset(): void {
    this.clear();
    for (const projectile of this.projectiles) this.layer.remove(projectile.view);
    this.projectiles.length = 0;
  }

  dispose(): void {
    this.reset();
    for (const geometry of this.geometryCache) geometry.dispose();
    for (const material of this.materialCache) material.dispose();
  }

  private syncMounts(): void {
    const positions = WallDefenseSystem.positions(
      this.world.size,
      (x, y) => this.world.cellAt(x, y),
    );

    const desired = new Map<string, WallWeaponPosition>();
    for (const position of positions) {
      if (!this.world.isWallOperational(position.x, position.y)) continue;
      const key = `${position.x},${position.y}`;
      desired.set(key, position);

      const existing = this.mounts.get(key);
      if (existing) {
        existing.weapon.enabled = true;
        continue;
      }

      const type = TYPE_ORDER[Math.abs(position.x * 31 + position.y * 17) % TYPE_ORDER.length];
      this.mounts.set(key, this.createMount(position, type));
    }

    for (const [key, mount] of this.mounts) {
      if (!desired.has(key) || !this.world.isWallOperational(mount.position.x, mount.position.y)) {
        this.layer.remove(mount.root);
        this.mounts.delete(key);
      }
    }
  }

  private createMount(position: WallWeaponPosition, type: WallWeaponType): MountRuntime {
    const config = CONFIGS[type];
    const root = new THREE.Group();
    root.name = `wall-weapon-${type}-${position.x}-${position.y}`;

    const world = this.world.gridToWorld(position.x, position.y);
    const normal = this.directionVector(position.direction);
    const top = this.world.elevationAt(position.x, position.y) +
      this.world.fortificationTopAt(position.x, position.y, this.world.cellAt(position.x, position.y)!);

    root.position.set(
      world.x + normal.x * this.world.tileSize * 0.42,
      top - 0.72,
      world.z + normal.z * this.world.tileSize * 0.42,
    );

    const mountBase = new THREE.Mesh(
      this.geometry(new THREE.CylinderGeometry(0.42, 0.5, 0.22, 10)),
      this.armorMaterial,
    );
    mountBase.position.y = 0.1;
    root.add(mountBase);

    const barrel = new THREE.Group();
    barrel.position.y = 0.34;
    barrel.rotation.y = Math.atan2(normal.x, normal.z);
    root.add(barrel);

    const housing = new THREE.Mesh(
      this.geometry(new THREE.BoxGeometry(0.72, 0.52, 0.62)),
      this.weaponMaterial,
    );
    housing.position.y = 0.12;
    barrel.add(housing);

    const barrelLength = type === 'missileLauncher' ? 1.0 : type === 'automaticCannon' ? 1.25 : 1.08;
    const barrelMesh = new THREE.Mesh(
      this.geometry(new THREE.CylinderGeometry(
        type === 'heavyMachineGun' ? 0.075 : 0.12,
        type === 'heavyMachineGun' ? 0.09 : 0.15,
        barrelLength,
        8,
      )),
      this.weaponMaterial,
    );
    barrelMesh.rotation.x = Math.PI / 2;
    barrelMesh.position.z = -barrelLength * 0.5;
    barrel.add(barrelMesh);

    const muzzle = type === 'missileLauncher'
      ? new THREE.Mesh(
          this.geometry(new THREE.CylinderGeometry(0.18, 0.22, 0.42, 8)),
          this.missileMaterial,
        )
      : new THREE.Mesh(
          this.geometry(new THREE.CylinderGeometry(0.13, 0.15, 0.22, 8)),
          type === 'plasmaCannon' ? this.emissiveMaterial : this.weaponMaterial,
        );

    muzzle.rotation.x = Math.PI / 2;
    muzzle.position.z = -barrelLength - 0.18;
    barrel.add(muzzle);

    if (type === 'missileLauncher') {
      const rail = new THREE.Mesh(
        this.geometry(new THREE.BoxGeometry(0.12, 0.12, 1.2)),
        this.armorMaterial,
      );
      rail.position.set(0.23, 0.06, -0.48);
      barrel.add(rail);
    }

    root.userData.wallWeapon = { type, x: position.x, y: position.y };
    root.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });

    this.layer.add(root);

    const weapon: WallWeapon = {
      id: root.name,
      type,
      range: config.range,
      damage: config.damage,
      fireRate: config.fireRate,
      projectileType: config.projectileType,
      targetType: config.targetType,
      rotationSpeed: config.rotationSpeed,
      enabled: true,
      cooldown: 0,
      mount: root,
    };

    return {
      key: `${position.x},${position.y}`,
      position,
      weapon,
      root,
      barrel,
      muzzle,
    };
  }

  private updateMount(mount: MountRuntime, targets: WallWeaponTarget[], delta: number): void {
    if (!mount.weapon.enabled || !this.world.isWallOperational(mount.position.x, mount.position.y)) {
      mount.weapon.enabled = false;
      mount.root.visible = false;
      return;
    }

    mount.root.visible = true;
    mount.weapon.cooldown = Math.max(0, mount.weapon.cooldown - delta);

    const target = this.selectTarget(mount, targets);
    if (!target) {
      mount.weapon.targetId = undefined;
      return;
    }

    mount.weapon.targetId = target.id;
    const desired = Math.atan2(
      target.position.x - mount.root.position.x,
      target.position.z - mount.root.position.z,
    );

    let current = mount.barrel.rotation.y;
    const deltaAngle = THREE.MathUtils.euclideanModulo(desired - current + Math.PI, Math.PI * 2) - Math.PI;
    const step = mount.weapon.rotationSpeed * delta;
    current += THREE.MathUtils.clamp(deltaAngle, -step, step);
    mount.barrel.rotation.y = current;

    const aligned = Math.abs(deltaAngle) <= 0.16;
    if (aligned && mount.weapon.cooldown <= 0) {
      this.fire(mount, target);
    }
  }

  private selectTarget(mount: MountRuntime, targets: WallWeaponTarget[]): WallWeaponTarget | undefined {
    const origin = mount.root.position;
    let best: WallWeaponTarget | undefined;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const target of targets) {
      if (!target.alive) continue;
      if (target.faction === 'defender') continue;
      if (mount.weapon.targetType === 'ground' && target.kind !== 'ground') continue;
      if (mount.weapon.targetType === 'air' && target.kind !== 'air') continue;

      const distance = origin.distanceTo(target.position);
      if (distance > mount.weapon.range) continue;
      if (distance < bestDistance) {
        best = target;
        bestDistance = distance;
      }
    }

    return best;
  }

  private fire(mount: MountRuntime, target: WallWeaponTarget): void {
    mount.weapon.cooldown = 1 / mount.weapon.fireRate;

    const origin = mount.muzzle.getWorldPosition(new THREE.Vector3());
    const projectile = this.createProjectile(
      mount.weapon.projectileType,
      origin,
      target,
      mount.weapon.damage,
    );
    this.projectiles.push(projectile);
  }

  private createProjectile(
    kind: WallProjectileType,
    origin: THREE.Vector3,
    target: WallWeaponTarget,
    damage: number,
  ): Projectile {
    let view: THREE.Object3D;

    if (kind === 'missile') {
      const group = new THREE.Group();
      const body = new THREE.Mesh(
        this.geometry(new THREE.CylinderGeometry(0.11, 0.14, 0.62, 8)),
        this.missileMaterial,
      );
      body.rotation.z = Math.PI / 2;
      group.add(body);
      const nose = new THREE.Mesh(
        this.geometry(new THREE.ConeGeometry(0.14, 0.26, 8)),
        this.emissiveMaterial,
      );
      nose.rotation.z = -Math.PI / 2;
      nose.position.x = 0.44;
      group.add(nose);
      view = group;
    } else if (kind === 'plasma') {
      view = new THREE.Mesh(
        this.geometry(new THREE.SphereGeometry(0.18, 8, 8)),
        this.emissiveMaterial,
      );
    } else if (kind === 'shell') {
      view = new THREE.Mesh(
        this.geometry(new THREE.SphereGeometry(0.11, 7, 6)),
        this.projectileMaterial,
      );
    } else {
      view = new THREE.Mesh(
        this.geometry(new THREE.SphereGeometry(0.055, 6, 5)),
        this.projectileMaterial,
      );
    }

    view.position.copy(origin);
    this.layer.add(view);

    return {
      kind,
      view,
      targetId: target.id,
      damage,
      speed: kind === 'missile' ? 10 : kind === 'plasma' ? 42 : kind === 'shell' ? 24 : 54,
      life: kind === 'missile' ? 6 : 2.2,
      blastRadius: kind === 'missile' ? 3.4 : 0,
      lastTargetPosition: target.position.clone(),
    };
  }

  private updateProjectiles(delta: number): void {
    for (let i = this.projectiles.length - 1; i >= 0; i -= 1) {
      const projectile = this.projectiles[i];
      projectile.life -= delta;

      const target = this.world.getTargets().find((item) => item.id === projectile.targetId && item.alive);
      const targetPosition = target?.position.clone() ?? projectile.lastTargetPosition;
      projectile.lastTargetPosition.copy(targetPosition);

      const direction = targetPosition.sub(projectile.view.position);
      const distance = direction.length();

      if (distance <= 0.6 || projectile.life <= 0) {
        if (projectile.kind === 'missile') {
          this.explode(projectile);
        } else if (projectile.life > 0) {
          this.world.applyDamage(projectile.targetId, projectile.damage);
        }
        this.layer.remove(projectile.view);
        this.projectiles.splice(i, 1);
        continue;
      }

      direction.normalize();
      projectile.view.position.addScaledVector(direction, Math.min(distance, projectile.speed * delta));
      projectile.view.lookAt(targetPosition);
    }
  }

  private explode(projectile: Projectile): void {
    this.world.applyAreaDamage(projectile.lastTargetPosition, projectile.blastRadius, projectile.damage);
    const flashMaterial = this.explosionMaterial.clone();
    const flash = new THREE.Mesh(
      new THREE.SphereGeometry(0.35, 10, 8),
      flashMaterial,
    );
    this.geometryCache.push(flash.geometry);
    flash.position.copy(projectile.lastTargetPosition);
    this.layer.add(flash);

    const startedAt = performance.now();
    const animate = (): void => {
      const age = (performance.now() - startedAt) / 1000;
      flash.scale.setScalar(1 + age * 5);
      flashMaterial.opacity = Math.max(0, 0.78 * (1 - age * 3));
      if (age >= 0.34) {
        this.layer.remove(flash);
        flashMaterial.dispose();
        return;
      }
      requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }

  private clear(): void {
    for (const mount of this.mounts.values()) this.layer.remove(mount.root);
    this.mounts.clear();
  }

  private clearProjectiles(): void {
    for (const projectile of this.projectiles) this.layer.remove(projectile.view);
    this.projectiles.length = 0;
  }

  private directionVector(direction: WallWeaponPosition['direction']): THREE.Vector3 {
    switch (direction) {
      case 'N': return new THREE.Vector3(0, 0, -1);
      case 'S': return new THREE.Vector3(0, 0, 1);
      case 'E': return new THREE.Vector3(1, 0, 0);
      case 'W': return new THREE.Vector3(-1, 0, 0);
      case 'NE': return new THREE.Vector3(1, 0, -1).normalize();
      case 'SE': return new THREE.Vector3(1, 0, 1).normalize();
      case 'SW': return new THREE.Vector3(-1, 0, 1).normalize();
      case 'NW': return new THREE.Vector3(-1, 0, -1).normalize();
    }
  }

  private geometry<T extends THREE.BufferGeometry>(geometry: T): T {
    this.geometryCache.push(geometry);
    return geometry;
  }
}
