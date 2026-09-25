import * as THREE from 'three';
import type { GridCell, KeepState, TerrainKind, TileKind } from '../core/types';
import { BattleNavigation, type NavPoint, type WallNavNode } from './BattleNavigation';
import { FactionRelations } from './FactionRelations';
import type {
  BattleResult,
  BattleSetup,
  BattleStatus,
  BattleUnit,
  BattleUnitStats,
  Faction,
} from './types';

export interface BattleWorldContext {
  size: number;
  tileSize: number;
  gridToWorld: (x: number, y: number) => { x: number; z: number };
  terrainAt: (x: number, y: number) => TerrainKind;
  elevationAt: (x: number, y: number) => number;
  kindAt: (x: number, y: number) => TileKind | undefined;
  cellAt: (x: number, y: number) => GridCell | undefined;
  fortificationTopAt: (x: number, y: number, cell: GridCell) => number;
  keeps: () => KeepState[];
}

interface UnitRuntime {
  data: BattleUnit;
  stats: BattleUnitStats;
  view: THREE.Group;
  position: THREE.Vector3;
  home: THREE.Vector3;
  path: NavPoint[];
  pathIndex: number;
  surface: 'ground' | 'wall';
  gridX: number;
  gridY: number;
  attackTimer: number;
  decisionTimer: number;
  repathTimer: number;
  animTime: number;
  moving: boolean;
  deathTime: number;
  defenseRadius: number;
}

interface ArrowProjectile {
  view: THREE.Mesh;
  targetId: string;
  damage: number;
  speed: number;
  life: number;
}

interface UnitVisualRefs {
  body: THREE.Object3D;
  leftLeg: THREE.Object3D;
  rightLeg: THREE.Object3D;
  weapon: THREE.Object3D;
  shield?: THREE.Object3D;
}

const UNIT_STATS: Record<'swordsman' | 'archer', BattleUnitStats> = {
  swordsman: {
    maxHealth: 110,
    damage: 19,
    attackRange: 1.25,
    attackCooldown: 0.82,
    moveSpeed: 3.1,
    scanRange: 5.8,
  },
  archer: {
    maxHealth: 76,
    damage: 13,
    attackRange: 13,
    attackCooldown: 1.55,
    moveSpeed: 2.55,
    scanRange: 14.5,
  },
};

export class BattleSystem {
  private readonly navigation: BattleNavigation;
  private readonly relations = new FactionRelations();
  private readonly units = new Map<string, UnitRuntime>();
  private readonly arrows: ArrowProjectile[] = [];
  private readonly sharedGeometries: THREE.BufferGeometry[] = [];
  private readonly sharedMaterials: THREE.Material[] = [];
  private readonly bodyGeometry = this.geometry(new THREE.CylinderGeometry(0.22, 0.29, 0.68, 7));
  private readonly headGeometry = this.geometry(new THREE.SphereGeometry(0.2, 7, 6));
  private readonly helmetGeometry = this.geometry(new THREE.ConeGeometry(0.25, 0.3, 7));
  private readonly legGeometry = this.geometry(new THREE.CylinderGeometry(0.07, 0.08, 0.44, 5));
  private readonly shieldGeometry = this.geometry(new THREE.CylinderGeometry(0.27, 0.3, 0.08, 10));
  private readonly swordGeometry = this.geometry(new THREE.BoxGeometry(0.07, 0.62, 0.05));
  private readonly bowGeometry = this.geometry(new THREE.TorusGeometry(0.29, 0.035, 4, 8, Math.PI));
  private readonly quiverGeometry = this.geometry(new THREE.CylinderGeometry(0.08, 0.1, 0.48, 6));
  private readonly arrowGeometry = this.geometry(new THREE.CylinderGeometry(0.022, 0.022, 0.68, 5));
  private readonly skinMaterial = this.material(new THREE.MeshStandardMaterial({ color: 0xd8aa82, roughness: 0.94 }));
  private readonly metalMaterial = this.material(new THREE.MeshStandardMaterial({ color: 0x757b7d, roughness: 0.64, metalness: 0.34 }));
  private readonly swordMaterial = this.material(new THREE.MeshStandardMaterial({ color: 0xb7bec1, roughness: 0.48, metalness: 0.54 }));
  private readonly woodMaterial = this.material(new THREE.MeshStandardMaterial({ color: 0x604331, roughness: 0.96 }));
  private readonly attackerMaterial = this.material(new THREE.MeshStandardMaterial({ color: 0x9f3f42, roughness: 0.9 }));
  private readonly attackerDarkMaterial = this.material(new THREE.MeshStandardMaterial({ color: 0x5d282c, roughness: 0.94 }));
  private readonly defenderMaterial = this.material(new THREE.MeshStandardMaterial({ color: 0x3d668f, roughness: 0.9 }));
  private readonly defenderDarkMaterial = this.material(new THREE.MeshStandardMaterial({ color: 0x243f5c, roughness: 0.94 }));
  private readonly objectiveMaterial = this.material(
    new THREE.MeshBasicMaterial({ color: 0xffd477, transparent: true, opacity: 0.56, depthWrite: false }),
  );

  private mode: BattleStatus['mode'] = 'idle';
  private captureSeconds = 0;
  private readonly captureRequiredSeconds = 10;
  private battleSeconds = 0;
  private attackerStartCount = 0;
  private defenderStartCount = 0;
  private objectiveGrid: NavPoint = { x: 0, y: 0 };
  private capturePointGrid: NavPoint = { x: 0, y: 0 };
  private objectiveWorld = new THREE.Vector3();
  private objectiveMarker: THREE.Mesh | null = null;
  private statusTimer = 0;
  private globalDecisionTimer = 0;
  private finalResult: BattleResult | undefined;

  constructor(
    private readonly layer: THREE.Group,
    private readonly world: BattleWorldContext,
    private readonly onStatus: (status: BattleStatus) => void,
  ) {
    this.navigation = new BattleNavigation({
      size: world.size,
      terrainAt: world.terrainAt,
      elevationAt: world.elevationAt,
      kindAt: world.kindAt,
      cellAt: world.cellAt,
      fortificationTopAt: world.fortificationTopAt,
      keeps: world.keeps,
    });
  }

  isActive(): boolean {
    return this.mode !== 'idle';
  }

  isRunning(): boolean {
    return this.mode === 'running';
  }

  start(setup: BattleSetup): void {
    this.reset(false);
    this.navigation.invalidate();
    this.mode = 'running';
    this.captureSeconds = 0;
    this.battleSeconds = 0;
    this.finalResult = undefined;

    const normalized = this.normalizeSetup(setup);
    this.attackerStartCount = normalized.attackerSwordsmen + normalized.attackerArchers;
    this.defenderStartCount = normalized.defenderSwordsmen + normalized.defenderArchers;

    this.objectiveGrid = this.navigation.castleObjective();
    this.capturePointGrid =
      this.navigation.findNearestWalkable(this.objectiveGrid, 10) ?? this.objectiveGrid;

    const objectiveWorld = this.world.gridToWorld(this.objectiveGrid.x, this.objectiveGrid.y);
    this.objectiveWorld.set(
      objectiveWorld.x,
      2.28 + this.world.elevationAt(this.capturePointGrid.x, this.capturePointGrid.y),
      objectiveWorld.z,
    );
    this.createObjectiveMarker();

    this.spawnAttackers(normalized);
    this.spawnDefenders(normalized);
    this.emitStatus();
  }

  stop(): void {
    if (this.mode !== 'running') return;
    this.mode = 'paused';
    this.emitStatus();
  }

  resume(): void {
    if (this.mode !== 'paused') return;
    this.mode = 'running';
    this.emitStatus();
  }

  reset(emit = true): void {
    for (const runtime of this.units.values()) {
      this.layer.remove(runtime.view);
    }
    this.units.clear();

    for (const arrow of this.arrows) {
      this.layer.remove(arrow.view);
    }
    this.arrows.length = 0;

    if (this.objectiveMarker) {
      this.layer.remove(this.objectiveMarker);
      this.objectiveMarker.geometry.dispose();
      this.objectiveMarker = null;
    }

    this.mode = 'idle';
    this.captureSeconds = 0;
    this.battleSeconds = 0;
    this.attackerStartCount = 0;
    this.defenderStartCount = 0;
    this.finalResult = undefined;

    if (emit) this.emitStatus();
  }

  update(deltaMs: number, timeMs: number): void {
    if (this.mode !== 'running') {
      if (this.objectiveMarker) this.animateObjective(timeMs);
      return;
    }

    const delta = Math.min(0.05, deltaMs / 1000);
    this.battleSeconds += delta;
    this.globalDecisionTimer -= delta;
    this.statusTimer -= delta;

    if (this.globalDecisionTimer <= 0) {
      this.globalDecisionTimer = 0.28;
      this.refreshTargets();
    }

    const buckets = this.buildSpatialBuckets();
    for (const runtime of this.units.values()) {
      this.updateUnit(runtime, delta, buckets);
    }

    this.updateProjectiles(delta);
    this.updateCapture(delta);
    this.cleanupDead(delta);
    this.animateObjective(timeMs);

    if (this.statusTimer <= 0) {
      this.statusTimer = 0.22;
      this.emitStatus();
    }

    this.checkVictory();
  }

  status(): BattleStatus {
    const attackersAlive = this.countAlive('attacker');
    const defendersAlive = this.countAlive('defender');

    return {
      mode: this.mode,
      captureProgress: THREE.MathUtils.clamp(
        this.captureSeconds / this.captureRequiredSeconds,
        0,
        1,
      ),
      captureSeconds: this.captureSeconds,
      captureRequiredSeconds: this.captureRequiredSeconds,
      attackersAlive,
      defendersAlive,
      result: this.finalResult,
    };
  }

  dispose(): void {
    this.reset(false);
    for (const geometry of this.sharedGeometries) geometry.dispose();
    for (const material of this.sharedMaterials) material.dispose();
  }

  private normalizeSetup(setup: BattleSetup): BattleSetup {
    const clamp = (value: number): number =>
      THREE.MathUtils.clamp(Math.floor(Number.isFinite(value) ? value : 0), 0, 120);

    return {
      attackerSwordsmen: clamp(setup.attackerSwordsmen),
      attackerArchers: clamp(setup.attackerArchers),
      defenderSwordsmen: clamp(setup.defenderSwordsmen),
      defenderArchers: clamp(setup.defenderArchers),
    };
  }

  private spawnAttackers(setup: BattleSetup): void {
    const total = setup.attackerSwordsmen + setup.attackerArchers;
    const spawnCells = this.navigation.attackerSpawnCells(this.objectiveGrid, Math.max(1, total));
    let cursor = 0;

    for (let i = 0; i < setup.attackerSwordsmen; i += 1) {
      const cell = spawnCells[cursor % spawnCells.length] ?? { x: 1, y: this.world.size - 2 };
      this.spawnGroundUnit('attacker', 'swordsman', cell, cursor, true);
      cursor += 1;
    }

    for (let i = 0; i < setup.attackerArchers; i += 1) {
      const cell = spawnCells[cursor % spawnCells.length] ?? { x: 1, y: this.world.size - 2 };
      this.spawnGroundUnit('attacker', 'archer', cell, cursor + 7, true);
      cursor += 1;
    }
  }

  private spawnDefenders(setup: BattleSetup): void {
    const wallNodes = this.navigation.wallPlatformNodes();
    const usedWallNodes = new Set<string>();
    const archerWallCount = Math.min(setup.defenderArchers, wallNodes.length);

    for (let i = 0; i < archerWallCount; i += 1) {
      const index =
        wallNodes.length <= 1
          ? 0
          : Math.floor((i / Math.max(1, archerWallCount - 1)) * (wallNodes.length - 1));
      const node = wallNodes[index];
      const key = `${node.x},${node.y}`;
      if (usedWallNodes.has(key)) continue;
      usedWallNodes.add(key);
      this.spawnWallUnit('defender', 'archer', node, i);
    }

    const remainingArchers = setup.defenderArchers - usedWallNodes.size;
    const groundCount = setup.defenderSwordsmen + Math.max(0, remainingArchers);
    const groundCells = this.navigation.defenderGroundCells(this.capturePointGrid, Math.max(1, groundCount));
    let cursor = 0;

    for (let i = 0; i < setup.defenderSwordsmen; i += 1) {
      const cell = groundCells[cursor % groundCells.length] ?? this.capturePointGrid;
      this.spawnGroundUnit('defender', 'swordsman', cell, cursor, false);
      cursor += 1;
    }

    for (let i = 0; i < remainingArchers; i += 1) {
      const cell = groundCells[cursor % groundCells.length] ?? this.capturePointGrid;
      this.spawnGroundUnit('defender', 'archer', cell, cursor + 11, false);
      cursor += 1;
    }
  }

  private spawnGroundUnit(
    faction: Faction,
    unitType: 'swordsman' | 'archer',
    cell: NavPoint,
    index: number,
    attacker: boolean,
  ): void {
    const base = this.world.gridToWorld(cell.x, cell.y);
    const spacing = 0.74;
    const column = index % 5;
    const row = Math.floor(index / 5) % 5;
    const offsetX = (column - 2) * spacing * 0.38;
    const offsetZ = (row - 2) * spacing * 0.38 + (attacker && unitType === 'archer' ? 0.55 : 0);
    const position = new THREE.Vector3(
      base.x + offsetX,
      2.22 + this.world.elevationAt(cell.x, cell.y),
      base.z + offsetZ,
    );

    const runtime = this.createRuntime(faction, unitType, position, cell.x, cell.y, 'ground');
    runtime.home.copy(position);

    if (faction === 'attacker') {
      const target = this.navigation.findNearestWalkable(this.capturePointGrid, 10) ?? this.capturePointGrid;
      runtime.path = this.navigation.findPath(cell, target, true);
      runtime.pathIndex = Math.min(1, Math.max(0, runtime.path.length - 1));
      runtime.data.state = 'forming';
    } else {
      runtime.data.state = 'guarding';
      runtime.defenseRadius = unitType === 'swordsman' ? 9.5 : 11.5;
    }

    this.units.set(runtime.data.id, runtime);
    this.layer.add(runtime.view);
  }

  private spawnWallUnit(
    faction: Faction,
    unitType: 'archer',
    node: WallNavNode,
    index: number,
  ): void {
    const base = this.world.gridToWorld(node.x, node.y);
    const offset = ((index % 3) - 1) * 0.42;
    const position = new THREE.Vector3(
      base.x + offset,
      node.worldY,
      base.z - offset * 0.25,
    );

    const runtime = this.createRuntime(faction, unitType, position, node.x, node.y, 'wall');
    runtime.home.copy(position);
    runtime.data.state = 'guarding';
    runtime.defenseRadius = 16;
    this.units.set(runtime.data.id, runtime);
    this.layer.add(runtime.view);
  }

  private createRuntime(
    faction: Faction,
    unitType: 'swordsman' | 'archer',
    position: THREE.Vector3,
    gridX: number,
    gridY: number,
    surface: 'ground' | 'wall',
  ): UnitRuntime {
    const stats = UNIT_STATS[unitType];
    const id = `${faction}-${unitType}-${this.units.size + 1}-${Math.floor(position.x * 31 + position.z * 17)}`;
    const view = this.createUnitView(faction, unitType);
    view.position.copy(position);
    view.scale.setScalar(0.92);

    const data: BattleUnit = {
      id,
      faction,
      unitType,
      health: stats.maxHealth,
      maxHealth: stats.maxHealth,
      damage: stats.damage,
      attackRange: stats.attackRange,
      attackCooldown: stats.attackCooldown,
      moveSpeed: stats.moveSpeed,
      state: 'forming',
    };

    return {
      data,
      stats,
      view,
      position: position.clone(),
      home: position.clone(),
      path: [],
      pathIndex: 0,
      surface,
      gridX,
      gridY,
      attackTimer: Math.random() * 0.4,
      decisionTimer: 0,
      repathTimer: 0,
      animTime: Math.random() * Math.PI * 2,
      moving: false,
      deathTime: 0,
      defenseRadius: 10,
    };
  }

  private createUnitView(faction: Faction, unitType: 'swordsman' | 'archer'): THREE.Group {
    const root = new THREE.Group();
    const primary = faction === 'attacker' ? this.attackerMaterial : this.defenderMaterial;
    const dark = faction === 'attacker' ? this.attackerDarkMaterial : this.defenderDarkMaterial;

    const body = new THREE.Mesh(this.bodyGeometry, primary);
    body.position.y = 0.69;
    root.add(body);

    const head = new THREE.Mesh(this.headGeometry, this.skinMaterial);
    head.position.y = 1.18;
    root.add(head);

    const helmet = new THREE.Mesh(this.helmetGeometry, this.metalMaterial);
    helmet.position.y = 1.43;
    root.add(helmet);

    const leftLeg = new THREE.Mesh(this.legGeometry, dark);
    leftLeg.position.set(-0.11, 0.25, 0);
    root.add(leftLeg);

    const rightLeg = new THREE.Mesh(this.legGeometry, dark);
    rightLeg.position.set(0.11, 0.25, 0);
    root.add(rightLeg);

    let weapon: THREE.Object3D;
    let shield: THREE.Object3D | undefined;

    if (unitType === 'swordsman') {
      weapon = new THREE.Mesh(this.swordGeometry, this.swordMaterial);
      weapon.position.set(0.34, 0.78, 0.02);
      weapon.rotation.z = -0.34;
      root.add(weapon);

      shield = new THREE.Mesh(this.shieldGeometry, primary);
      shield.rotation.z = Math.PI / 2;
      shield.position.set(-0.31, 0.78, -0.02);
      root.add(shield);
    } else {
      weapon = new THREE.Mesh(this.bowGeometry, this.woodMaterial);
      weapon.position.set(0.31, 0.82, 0.02);
      weapon.rotation.set(0, Math.PI / 2, Math.PI / 2);
      root.add(weapon);

      const quiver = new THREE.Mesh(this.quiverGeometry, dark);
      quiver.position.set(-0.22, 0.82, 0.12);
      quiver.rotation.z = -0.28;
      root.add(quiver);
    }

    const factionBand = new THREE.Mesh(
      new THREE.CylinderGeometry(0.31, 0.31, 0.08, 8),
      primary,
    );
    factionBand.position.y = 0.98;
    root.add(factionBand);

    const refs: UnitVisualRefs = { body, leftLeg, rightLeg, weapon, shield };
    root.userData.visualRefs = refs;
    return root;
  }

  private updateUnit(
    runtime: UnitRuntime,
    delta: number,
    buckets: Map<string, UnitRuntime[]>,
  ): void {
    runtime.animTime += delta;
    runtime.attackTimer = Math.max(0, runtime.attackTimer - delta);
    runtime.repathTimer = Math.max(0, runtime.repathTimer - delta);
    runtime.moving = false;

    if (runtime.data.state === 'dead') {
      runtime.deathTime += delta;
      runtime.view.rotation.z = THREE.MathUtils.lerp(runtime.view.rotation.z, Math.PI / 2, delta * 5);
      runtime.view.position.y = runtime.position.y - Math.min(0.2, runtime.deathTime * 0.08);
      return;
    }

    const target = runtime.data.targetId
      ? this.units.get(runtime.data.targetId)
      : undefined;

    if (target && target.data.state !== 'dead') {
      this.faceTarget(runtime, target.position);
      const distance = runtime.position.distanceTo(target.position);

      if (runtime.data.unitType === 'archer') {
        if (distance <= runtime.stats.attackRange) {
          runtime.data.state = 'attacking';
          if (runtime.attackTimer <= 0) this.fireArrow(runtime, target);
        } else if (runtime.surface === 'ground') {
          this.moveTowardTarget(runtime, target.position, delta);
        }
      } else {
        const verticalDifference = Math.abs(runtime.position.y - target.position.y);
        if (distance <= runtime.stats.attackRange && verticalDifference <= 1.5) {
          runtime.data.state = 'attacking';
          if (runtime.attackTimer <= 0) this.meleeAttack(runtime, target);
        } else if (runtime.surface === 'ground') {
          this.moveTowardTarget(runtime, target.position, delta);
        }
      }
    } else if (runtime.surface === 'ground') {
      if (runtime.data.faction === 'attacker') this.followAttackerObjective(runtime, delta);
      else this.guardDefenderArea(runtime, delta);
    } else {
      runtime.data.state = 'guarding';
    }

    if (runtime.surface === 'ground' && runtime.moving) {
      this.applySeparation(runtime, delta, buckets);
    }

    runtime.view.position.copy(runtime.position);
    this.animateUnit(runtime);
  }

  private followAttackerObjective(runtime: UnitRuntime, delta: number): void {
    if (runtime.path.length === 0 || runtime.pathIndex >= runtime.path.length) {
      runtime.data.state = 'guarding';
      return;
    }

    const waypoint = runtime.path[runtime.pathIndex];
    const world = this.world.gridToWorld(waypoint.x, waypoint.y);
    const target = new THREE.Vector3(
      world.x,
      2.22 + this.world.elevationAt(waypoint.x, waypoint.y),
      world.z,
    );

    if (this.moveTowardPoint(runtime, target, delta, 0.34)) {
      runtime.gridX = waypoint.x;
      runtime.gridY = waypoint.y;
      runtime.pathIndex += 1;
    }

    runtime.data.state = runtime.pathIndex <= 1 ? 'forming' : 'moving';
  }

  private guardDefenderArea(runtime: UnitRuntime, delta: number): void {
    const distanceHome = runtime.position.distanceTo(runtime.home);
    if (distanceHome > 0.42) {
      this.moveTowardPoint(runtime, runtime.home, delta, 0.3);
      runtime.data.state = 'moving';
    } else {
      runtime.data.state = 'guarding';
    }
  }

  private moveTowardTarget(runtime: UnitRuntime, target: THREE.Vector3, delta: number): void {
    const distanceFromHome =
      runtime.data.faction === 'defender'
        ? runtime.position.distanceTo(runtime.home)
        : 0;

    if (
      runtime.data.faction === 'defender' &&
      distanceFromHome > runtime.defenseRadius
    ) {
      this.moveTowardPoint(runtime, runtime.home, delta, 0.35);
      return;
    }

    this.moveTowardPoint(runtime, target, delta, runtime.stats.attackRange * 0.9);
  }

  private moveTowardPoint(
    runtime: UnitRuntime,
    target: THREE.Vector3,
    delta: number,
    stopDistance: number,
  ): boolean {
    const planar = new THREE.Vector3(
      target.x - runtime.position.x,
      0,
      target.z - runtime.position.z,
    );
    const distance = planar.length();
    if (distance <= stopDistance) return true;

    planar.normalize();
    const step = Math.min(distance - stopDistance, runtime.stats.moveSpeed * delta);
    runtime.position.addScaledVector(planar, Math.max(0, step));
    runtime.view.rotation.y = Math.atan2(planar.x, planar.z);
    runtime.moving = true;

    const gx = Math.floor(runtime.position.x / this.world.tileSize + this.world.size / 2);
    const gy = Math.floor(runtime.position.z / this.world.tileSize + this.world.size / 2);
    if (gx >= 0 && gy >= 0 && gx < this.world.size && gy < this.world.size) {
      runtime.gridX = gx;
      runtime.gridY = gy;
      runtime.position.y = 2.22 + this.world.elevationAt(gx, gy);
    }

    return false;
  }

  private applySeparation(
    runtime: UnitRuntime,
    delta: number,
    buckets: Map<string, UnitRuntime[]>,
  ): void {
    const key = this.bucketKey(runtime.position);
    const nearby = buckets.get(key) ?? [];
    const push = new THREE.Vector3();

    for (const other of nearby) {
      if (other === runtime || other.data.state === 'dead') continue;
      if (other.surface !== runtime.surface) continue;

      const dx = runtime.position.x - other.position.x;
      const dz = runtime.position.z - other.position.z;
      const distanceSq = dx * dx + dz * dz;
      if (distanceSq <= 0.0001 || distanceSq > 0.75 * 0.75) continue;

      const distance = Math.sqrt(distanceSq);
      push.x += (dx / distance) * (0.75 - distance);
      push.z += (dz / distance) * (0.75 - distance);
    }

    if (push.lengthSq() > 0.0001) {
      push.normalize().multiplyScalar(delta * 0.65);
      runtime.position.add(push);
    }
  }

  private refreshTargets(): void {
    const alive = Array.from(this.units.values()).filter(
      (runtime) => runtime.data.state !== 'dead',
    );
    const targetedCount = new Map<string, number>();

    for (const runtime of alive) {
      if (runtime.data.targetId) {
        targetedCount.set(
          runtime.data.targetId,
          (targetedCount.get(runtime.data.targetId) ?? 0) + 1,
        );
      }
    }

    for (const runtime of alive) {
      const current = runtime.data.targetId
        ? this.units.get(runtime.data.targetId)
        : undefined;

      if (current && current.data.state !== 'dead') {
        const distance = runtime.position.distanceTo(current.position);
        if (distance <= runtime.stats.scanRange * 1.45) continue;
      }

      let best: UnitRuntime | undefined;
      let bestScore = Number.POSITIVE_INFINITY;

      for (const candidate of alive) {
        if (!this.relations.areHostile(runtime.data.faction, candidate.data.faction)) continue;

        const distance = runtime.position.distanceTo(candidate.position);
        if (distance > runtime.stats.scanRange) continue;

        if (
          runtime.data.unitType === 'swordsman' &&
          Math.abs(runtime.position.y - candidate.position.y) > 1.8
        ) {
          continue;
        }

        const immediateThreat =
          candidate.data.targetId === runtime.data.id ? -1.8 : 0;
        const focusPenalty = (targetedCount.get(candidate.data.id) ?? 0) * 0.85;
        const objectiveBias =
          runtime.data.faction === 'attacker' &&
          candidate.data.faction === 'defender'
            ? distance * 0.04
            : 0;
        const score = distance + focusPenalty + immediateThreat + objectiveBias;

        if (score < bestScore) {
          bestScore = score;
          best = candidate;
        }
      }

      runtime.data.targetId = best?.data.id;
    }
  }

  private meleeAttack(attacker: UnitRuntime, target: UnitRuntime): void {
    attacker.attackTimer = attacker.stats.attackCooldown;
    target.data.health -= attacker.stats.damage;

    const refs = attacker.view.userData.visualRefs as UnitVisualRefs | undefined;
    if (refs) refs.weapon.rotation.z -= 0.65;

    if (target.data.health <= 0) this.killUnit(target);
  }

  private fireArrow(attacker: UnitRuntime, target: UnitRuntime): void {
    attacker.attackTimer = attacker.stats.attackCooldown;

    const arrow = new THREE.Mesh(this.arrowGeometry, this.woodMaterial);
    arrow.position.copy(attacker.position);
    arrow.position.y += 0.95;

    const targetPoint = target.position.clone();
    targetPoint.y += 0.75;
    const direction = targetPoint.sub(arrow.position).normalize();
    arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
    arrow.renderOrder = 20;
    this.layer.add(arrow);

    this.arrows.push({
      view: arrow,
      targetId: target.data.id,
      damage: attacker.stats.damage,
      speed: 18,
      life: 3.2,
    });

    const refs = attacker.view.userData.visualRefs as UnitVisualRefs | undefined;
    if (refs) refs.weapon.rotation.y += 0.22;
  }

  private updateProjectiles(delta: number): void {
    for (let i = this.arrows.length - 1; i >= 0; i -= 1) {
      const arrow = this.arrows[i];
      arrow.life -= delta;
      const target = this.units.get(arrow.targetId);

      if (!target || target.data.state === 'dead' || arrow.life <= 0) {
        this.layer.remove(arrow.view);
        this.arrows.splice(i, 1);
        continue;
      }

      const targetPoint = target.position.clone();
      targetPoint.y += 0.72;
      const deltaVector = targetPoint.sub(arrow.view.position);
      const distance = deltaVector.length();

      if (distance <= 0.48) {
        target.data.health -= arrow.damage;
        if (target.data.health <= 0) this.killUnit(target);
        this.layer.remove(arrow.view);
        this.arrows.splice(i, 1);
        continue;
      }

      deltaVector.normalize();
      arrow.view.position.addScaledVector(
        deltaVector,
        Math.min(distance, arrow.speed * delta),
      );
      arrow.view.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        deltaVector,
      );
    }
  }

  private updateCapture(delta: number): void {
    const captureRadius = Math.max(3.2, this.world.tileSize * 1.15);
    let attackers = 0;
    let defenders = 0;

    for (const runtime of this.units.values()) {
      if (runtime.data.state === 'dead') continue;
      const planarDistance = Math.hypot(
        runtime.position.x - this.objectiveWorld.x,
        runtime.position.z - this.objectiveWorld.z,
      );
      if (planarDistance > captureRadius) continue;

      if (runtime.data.faction === 'attacker') attackers += 1;
      else if (runtime.data.faction === 'defender') defenders += 1;
    }

    if (attackers > 0 && defenders === 0) {
      this.captureSeconds = Math.min(
        this.captureRequiredSeconds,
        this.captureSeconds + delta,
      );
    } else if (defenders > 0) {
      this.captureSeconds = Math.max(0, this.captureSeconds - delta * 0.35);
    }
  }

  private checkVictory(): void {
    if (this.mode !== 'running') return;

    const attackersAlive = this.countAlive('attacker');
    const defendersAlive = this.countAlive('defender');

    if (attackersAlive === 0 && this.attackerStartCount > 0) {
      this.finishBattle('defender');
      return;
    }

    if (this.captureSeconds >= this.captureRequiredSeconds) {
      this.finishBattle('attacker');
      return;
    }

    if (this.attackerStartCount === 0 && this.defenderStartCount > 0) {
      this.finishBattle('defender');
    }
  }

  private finishBattle(winner: Faction): void {
    this.mode = 'finished';
    const attackersRemaining = this.countAlive('attacker');
    const defendersRemaining = this.countAlive('defender');

    this.finalResult = {
      winner,
      attackersRemaining,
      defendersRemaining,
      attackersKilled: Math.max(0, this.attackerStartCount - attackersRemaining),
      defendersKilled: Math.max(0, this.defenderStartCount - defendersRemaining),
      durationSeconds: Math.round(this.battleSeconds * 10) / 10,
    };

    this.emitStatus();
  }

  private killUnit(runtime: UnitRuntime): void {
    runtime.data.health = 0;
    runtime.data.state = 'dead';
    runtime.data.targetId = undefined;
    runtime.deathTime = 0;

    for (const other of this.units.values()) {
      if (other.data.targetId === runtime.data.id) other.data.targetId = undefined;
    }
  }

  private cleanupDead(_delta: number): void {
    // Corpses remain visible until Reset Battle so the battlefield result is readable.
  }

  private createObjectiveMarker(): void {
    const geometry = new THREE.RingGeometry(2.1, 2.55, 40);
    const marker = new THREE.Mesh(geometry, this.objectiveMaterial);
    marker.rotation.x = -Math.PI / 2;
    marker.position.copy(this.objectiveWorld);
    marker.position.y += 0.04;
    marker.renderOrder = 18;
    this.layer.add(marker);
    this.objectiveMarker = marker;
  }

  private animateObjective(timeMs: number): void {
    if (!this.objectiveMarker) return;
    const pulse = 1 + Math.sin(timeMs * 0.003) * 0.07;
    this.objectiveMarker.scale.set(pulse, pulse, pulse);
  }

  private animateUnit(runtime: UnitRuntime): void {
    const refs = runtime.view.userData.visualRefs as UnitVisualRefs | undefined;
    if (!refs) return;

    if (runtime.data.state === 'dead') return;

    const speed = runtime.moving ? 9 : 2.4;
    const swing = Math.sin(runtime.animTime * speed) * (runtime.moving ? 0.5 : 0.05);
    refs.leftLeg.rotation.x = swing;
    refs.rightLeg.rotation.x = -swing;
    refs.body.position.y = 0.69 + Math.abs(Math.sin(runtime.animTime * speed)) * (runtime.moving ? 0.035 : 0.012);

    if (runtime.data.state !== 'attacking') {
      if (runtime.data.unitType === 'swordsman') refs.weapon.rotation.z = -0.34;
      else refs.weapon.rotation.y = Math.PI / 2;
    }
  }

  private faceTarget(runtime: UnitRuntime, target: THREE.Vector3): void {
    const dx = target.x - runtime.position.x;
    const dz = target.z - runtime.position.z;
    if (Math.abs(dx) + Math.abs(dz) < 0.001) return;
    runtime.view.rotation.y = Math.atan2(dx, dz);
  }

  private buildSpatialBuckets(): Map<string, UnitRuntime[]> {
    const buckets = new Map<string, UnitRuntime[]>();

    for (const runtime of this.units.values()) {
      if (runtime.data.state === 'dead') continue;
      const key = this.bucketKey(runtime.position);
      const bucket = buckets.get(key);
      if (bucket) bucket.push(runtime);
      else buckets.set(key, [runtime]);
    }

    return buckets;
  }

  private bucketKey(position: THREE.Vector3): string {
    const size = 2.4;
    return `${Math.floor(position.x / size)},${Math.floor(position.z / size)}`;
  }

  private countAlive(faction: Faction): number {
    let count = 0;
    for (const runtime of this.units.values()) {
      if (
        runtime.data.faction === faction &&
        runtime.data.state !== 'dead'
      ) {
        count += 1;
      }
    }
    return count;
  }

  private emitStatus(): void {
    this.onStatus(this.status());
  }

  private geometry<T extends THREE.BufferGeometry>(geometry: T): T {
    this.sharedGeometries.push(geometry);
    return geometry;
  }

  private material<T extends THREE.Material>(material: T): T {
    this.sharedMaterials.push(material);
    return material;
  }
}
