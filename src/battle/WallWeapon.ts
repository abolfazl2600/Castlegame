import * as THREE from 'three';

export type WallWeaponType =
  | 'heavyMachineGun'
  | 'automaticCannon'
  | 'plasmaCannon'
  | 'missileLauncher';

export type WallProjectileType = 'bullet' | 'shell' | 'plasma' | 'missile';
export type WallTargetType = 'ground' | 'air' | 'any';

export interface WallWeapon {
  readonly id: string;
  readonly type: WallWeaponType;
  readonly range: number;
  readonly damage: number;
  readonly fireRate: number;
  readonly projectileType: WallProjectileType;
  readonly targetType: WallTargetType;
  readonly rotationSpeed: number;
  enabled: boolean;
  targetId?: string;
  cooldown: number;
  mount: THREE.Group;
}
