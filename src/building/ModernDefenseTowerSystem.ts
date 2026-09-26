import * as THREE from 'three';
import type { GridCell, ModernTowerKind } from '../core/types';

export interface ModernTowerConfig {
  kind: ModernTowerKind;
  label: string;
  height: number;
  radius: number;
  health: number;
  mountTypes: string[];
}

export const MODERN_TOWER_CONFIGS: Record<ModernTowerKind, ModernTowerConfig> = {
  modernWatchtower: {
    kind: 'modernWatchtower',
    label: 'Modern Watchtower',
    height: 8.8,
    radius: 1.72,
    health: 760,
    mountTypes: ['optic', 'light', 'weapon'],
  },
  heavyDefenseTower: {
    kind: 'heavyDefenseTower',
    label: 'Heavy Defense Tower',
    height: 7.8,
    radius: 2.0,
    health: 1150,
    mountTypes: ['weapon', 'armor'],
  },
  missileDefenseTower: {
    kind: 'missileDefenseTower',
    label: 'Missile Defense Tower',
    height: 8.4,
    radius: 1.9,
    health: 980,
    mountTypes: ['missile-launcher', 'sensor'],
  },
  automatedTurretTower: {
    kind: 'automatedTurretTower',
    label: 'Automated Turret Tower',
    height: 6.2,
    radius: 1.82,
    health: 860,
    mountTypes: ['turret', 'sensor'],
  },
  radarTower: {
    kind: 'radarTower',
    label: 'Radar Tower',
    height: 12.5,
    radius: 1.55,
    health: 720,
    mountTypes: ['radar', 'sensor', 'light'],
  },
};

const concrete = new THREE.MeshStandardMaterial({
  color: 0x707a80,
  roughness: 0.72,
  metalness: 0.12,
});
const steel = new THREE.MeshStandardMaterial({
  color: 0x3f4b53,
  roughness: 0.38,
  metalness: 0.82,
});
const armored = new THREE.MeshStandardMaterial({
  color: 0x1e2930,
  roughness: 0.3,
  metalness: 0.9,
});
const accent = new THREE.MeshStandardMaterial({
  color: 0x8fc8d7,
  roughness: 0.25,
  metalness: 0.7,
  emissive: 0x164b5c,
  emissiveIntensity: 0.45,
});
const dark = new THREE.MeshStandardMaterial({
  color: 0x151b20,
  roughness: 0.5,
  metalness: 0.72,
});

export class ModernDefenseTowerSystem {
  getConfig(kind: ModernTowerKind): ModernTowerConfig {
    return MODERN_TOWER_CONFIGS[kind];
  }

  create(group: THREE.Group, cell: GridCell, gx: number, gy: number): THREE.Group {
    const config = this.getConfig(cell.kind as ModernTowerKind);
    const level = Math.max(1, cell.level ?? 1);
    const height = config.height + (level - 1) * 1.75;
    const radius = config.radius;
    const baseY = 2.35;

    this.addBox(group, radius * 2.25, 0.62, radius * 2.25, concrete, 0, 0.5, 0);
    this.addBox(group, radius * 1.85, 0.22, radius * 1.85, armored, 0, 0.88, 0);

    const core = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.72, radius * 0.82, height - 1.0, 10),
      config.kind === 'heavyDefenseTower' ? concrete : armored,
    );
    core.position.y = baseY + (height - 1.0) / 2;
    core.castShadow = true;
    core.receiveShadow = true;
    group.add(core);

    this.addStructuralFrame(group, radius, height);
    this.addArmoredPanels(group, radius, height, config.kind);

    const platformY = baseY + height - 0.55;
    this.addBox(group, radius * 2.05, 0.18, radius * 2.05, steel, 0, platformY, 0);

    if (config.kind === 'modernWatchtower') {
      this.addWatchSensor(group, platformY + 0.45);
    } else if (config.kind === 'heavyDefenseTower') {
      this.addHeavyDefenseModule(group, platformY + 0.42);
    } else if (config.kind === 'missileDefenseTower') {
      this.addMissileLauncherPlaceholder(group, platformY + 0.42);
    } else if (config.kind === 'automatedTurretTower') {
      this.addTurretPlaceholder(group, platformY + 0.38);
    } else {
      this.addRadarAssembly(group, platformY + 0.35);
    }

    const mountPoints = this.createMountPoints(config, radius, platformY);
    group.userData.modernTower = {
      kind: config.kind,
      label: config.label,
      level,
      health: config.health * (1 + (level - 1) * 0.15),
      footprint: { width: 1, depth: 1 },
      collision: { type: 'grid-cell', radius: radius * 1.2, height },
      equipmentMounts: mountPoints,
      gx,
      gy,
    };

    return group;
  }

  private addStructuralFrame(group: THREE.Group, radius: number, height: number): void {
    const frameRadius = radius * 0.86;
    for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      const x = Math.cos(angle) * frameRadius;
      const z = Math.sin(angle) * frameRadius;
      const beam = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, height - 0.65, 0.16),
        steel,
      );
      beam.position.set(x, 2.35 + (height - 0.65) / 2, z);
      beam.castShadow = true;
      group.add(beam);
    }

    for (const y of [3.0, 5.6, 8.2].filter((value) => value < height + 1.5)) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(frameRadius, 0.07, 6, 12),
        steel,
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = y;
      ring.castShadow = true;
      group.add(ring);
    }
  }

  private addArmoredPanels(
    group: THREE.Group,
    radius: number,
    height: number,
    kind: ModernTowerKind,
  ): void {
    const panelHeight = kind === 'heavyDefenseTower' ? 1.65 : 1.25;
    const count = kind === 'radarTower' ? 4 : 6;

    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2;
      const panel = new THREE.Mesh(
        new THREE.BoxGeometry(radius * 0.62, panelHeight, 0.12),
        i % 2 === 0 ? armored : steel,
      );
      panel.position.set(
        Math.cos(angle) * (radius * 0.9),
        3.15 + (i % 3) * 1.85,
        Math.sin(angle) * (radius * 0.9),
      );
      panel.rotation.y = -angle;
      panel.castShadow = true;
      panel.receiveShadow = true;
      group.add(panel);
    }

    const lightBand = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.94, radius * 0.94, 0.08, 16),
      accent,
    );
    lightBand.position.y = Math.min(9.4, 3.1 + Math.floor(height / 2));
    group.add(lightBand);
  }

  private addWatchSensor(group: THREE.Group, y: number): void {
    this.addBox(group, 0.18, 0.9, 0.18, steel, 0, y + 0.35, 0);
    const sensor = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 8), accent);
    sensor.position.y = y + 0.92;
    sensor.scale.y = 0.72;
    group.add(sensor);
  }

  private addHeavyDefenseModule(group: THREE.Group, y: number): void {
    this.addBox(group, 1.65, 0.55, 1.65, armored, 0, y + 0.28, 0);
    for (const x of [-0.58, 0.58]) {
      this.addBox(group, 0.28, 0.8, 0.28, steel, x, y + 0.7, 0);
    }
  }

  private addMissileLauncherPlaceholder(group: THREE.Group, y: number): void {
    for (const x of [-0.55, 0, 0.55]) {
      const tube = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.22, 1.55, 10),
        dark,
      );
      tube.position.set(x, y + 0.8, 0);
      tube.castShadow = true;
      group.add(tube);
    }
    this.addBox(group, 1.65, 0.16, 0.7, accent, 0, y + 0.06, 0);
  }

  private addTurretPlaceholder(group: THREE.Group, y: number): void {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.78, 0.32, 12), dark);
    base.position.y = y + 0.16;
    group.add(base);
    const turret = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.55, 0.42, 10), armored);
    turret.position.y = y + 0.52;
    turret.userData.equipmentMount = 'turret';
    group.add(turret);
    this.addBox(group, 0.18, 0.18, 1.05, steel, 0, y + 0.64, 0.58);
  }

  private addRadarAssembly(group: THREE.Group, y: number): void {
    this.addBox(group, 0.12, 3.0, 0.12, steel, 0, y + 1.5, 0);
    const dish = new THREE.Mesh(
      new THREE.SphereGeometry(0.95, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.48),
      armored,
    );
    dish.position.set(0, y + 2.35, 0);
    dish.rotation.x = -Math.PI / 3;
    dish.userData.equipmentMount = 'radar';
    group.add(dish);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.055, 6, 18), accent);
    ring.position.copy(dish.position);
    ring.rotation.x = dish.rotation.x;
    group.add(ring);
  }

  private createMountPoints(
    config: ModernTowerConfig,
    radius: number,
    platformY: number,
  ): Array<{ id: string; type: string; position: [number, number, number] }> {
    return config.mountTypes.map((type, index) => {
      const angle = (index / Math.max(1, config.mountTypes.length)) * Math.PI * 2;
      return {
        id: `${config.kind}-mount-${index + 1}`,
        type,
        position: [
          Math.cos(angle) * radius * 0.72,
          platformY + 0.25,
          Math.sin(angle) * radius * 0.72,
        ],
      };
    });
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
