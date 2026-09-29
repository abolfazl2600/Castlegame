import * as THREE from 'three';
import type { GridCell, KeepState, TerrainKind, TileKind, TowerBridgeState, WallDirection } from '../core/types';
import { BattleNavigation, type NavPoint, type WallNavNode } from './BattleNavigation';
import { WallSystem } from '../building/WallSystem';
import { FactionRelations } from './FactionRelations';
import { BattleObjectiveSystem } from './objectives/BattleObjectiveSystem';
import { DEFAULT_BATTLE_SCENARIO } from './objectives/BattleObjectiveDefinitions';
import type { BattleScenario, ObjectiveBuildingSnapshot, ObjectivePositionSnapshot } from './objectives/BattleObjectiveTypes';
import type {
  BattleMissileLaunchOptions,
  BattleMissileLaunchResult,
  BattleMissileTarget,
  BattleResult,
  BattleSetup,
  BattleStatus,
  BattleUnit,
  BattleUnitStats,
  Faction,
  UnitType,
} from './types';
import { defenderUnitStats, militaryTierDefinition, normalizeMilitaryTier, type MilitaryTier } from './MilitaryProgression';
import { WALL_DAMAGE_READABILITY } from '../rendering/DefenseVisualLanguage';

export type CoreUnitType = 'swordsman' | 'archer' | 'spearman' | 'crossbowman' | 'modernSoldier';

export interface BattleWorldContext {
  size: number;
  tileSize: number;
  gridToWorld: (x: number, y: number) => { x: number; z: number };
  terrainAt: (x: number, y: number) => TerrainKind;
  elevationAt: (x: number, y: number) => number;
  kindAt: (x: number, y: number) => TileKind | undefined;
  cellAt: (x: number, y: number) => GridCell | undefined;
  fortificationTopAt: (x: number, y: number, cell: GridCell) => number;
  castleLinksAt?: (x: number, y: number) => WallDirection[] | undefined;
  keeps: () => KeepState[];
  towerBridges: () => TowerBridgeState[];
  setWallBattleVisibility: (x: number, y: number, visible: boolean) => void;
  buildingDamageAt?: (x: number, y: number) => number;
  onWallDamage?: (x: number, y: number, damage: number) => void;
  gatePassable?: (x: number, y: number) => boolean;
  wallWeaponVisuals?: () => THREE.Object3D[];
  effectsEnabled?: () => boolean;
  objectiveBuildings?: () => ObjectiveBuildingSnapshot[];
  objectivePositions?: () => ObjectivePositionSnapshot[];
}

interface UnitRuntime {
  data: BattleUnit;
  stats: BattleUnitStats;
  view: THREE.Group;
  position: THREE.Vector3;
  home: THREE.Vector3;
  path: NavPoint[];
  pathIndex: number;
  surface: 'ground' | 'wall' | 'ladder';
  gridX: number;
  gridY: number;
  attackTimer: number;
  decisionTimer: number;
  repathTimer: number;
  animTime: number;
  moving: boolean;
  deathTime: number;
  defenseRadius: number;
  defenderBehavior: DefenderBehaviorState;
  patrolTarget?: NavPoint;
  patrolIndex: number;
  patrolCooldown: number;
  defenseOriginGrid: NavPoint;
  progressCheckTimer: number;
  stuckSeconds: number;
  recoveryTime: number;
  recoverySign: number;
  lastProgressPosition: THREE.Vector3;
  assignedLadderId?: string;
  activeLadderId?: string;
  climbProgress: number;
  wallSeconds: number;
  attackProgress: number;
  attackDuration: number;
  attackApplied: boolean;
  hitReaction: number;
  victoryPhase: number;
  entryTarget?: THREE.Vector3;
  deploymentRoute?: WallNavNode[];
  deploymentIndex?: number;
}

type WallDamageStage = 'healthy' | 'damaged' | 'heavy' | 'partial' | 'breached';
type SiegeMode = 'entrance' | 'breach' | 'ladder';
type DefenderBehaviorState = 'idle' | 'patrol' | 'detect' | 'chase' | 'attack' | 'return';

interface WallBattleState {
  x: number;
  y: number;
  cell: GridCell;
  maxHealth: number;
  health: number;
  initialPersistentDamage: number;
  battleDamage: number;
  stage: WallDamageStage;
  visual: THREE.Group;
}

interface WallCollapseFragment {
  view: THREE.Mesh;
  velocity: THREE.Vector3;
  spin: THREE.Vector3;
  groundY: number;
  bounce: number;
  settled: boolean;
}

interface WallDustParticle {
  view: THREE.Mesh;
  velocity: THREE.Vector3;
  baseScale: number;
  growth: number;
  lifetime: number;
}

interface WallShockwave {
  view: THREE.Mesh;
  baseScale: number;
  growth: number;
  lifetime: number;
  delay: number;
}

interface WallCollapseEffect {
  age: number;
  lifetime: number;
  fragments: WallCollapseFragment[];
  dust: WallDustParticle[];
  shockwaves: WallShockwave[];
}

interface SiegeLadder {
  id: string;
  wall: NavPoint;
  base: NavPoint;
  inside: NavPoint;
  topY: number;
  status: 'carrying' | 'placed';
  carrierId?: string;
  climberId?: string;
  view?: THREE.Group;
}

interface SiegePlan {
  mode: SiegeMode;
  wall?: NavPoint;
  base?: NavPoint;
  inside?: NavPoint;
  ladderId?: string;
}

interface WallSides {
  base: NavPoint;
  inside: NavPoint;
}

interface WallWeaponPosition {
  x: number;
  y: number;
  direction: WallDirection;
  range: number;
}

interface ArrowProjectile {
  view: THREE.Mesh;
  targetId: string;
  damage: number;
  speed: number;
  life: number;
}

interface MissileProjectile {
  view: THREE.Group;
  targetId: string;
  start: THREE.Vector3;
  targetPoint: THREE.Vector3;
  elapsed: number;
  duration: number;
  impactRadius: number;
  damage: number;
}

interface UnitVisualRefs {
  body: THREE.Object3D;
  leftLeg: THREE.Object3D;
  rightLeg: THREE.Object3D;
  leftArm: THREE.Object3D;
  rightArm: THREE.Object3D;
  weapon: THREE.Object3D;
  shield?: THREE.Object3D;
}

export interface BattleStartOptions {
  readonly attackerSpawnInterval?: number;
  readonly attackerSpawnBatchSize?: number;
  readonly scenario?: BattleScenario;
  /**
   * Keeps battle-only wall damage across consecutive BattleSystem.start() calls.
   * Intended for multi-wave sessions such as Survival; never writes to GameState.
   */
  readonly preserveSessionWallDamage?: boolean;
  readonly militaryTier?: MilitaryTier;
}

export function getUnitCombatStats(unitType: UnitType): BattleUnitStats | undefined {
  if (!(unitType in UNIT_COMBAT_STATS)) return undefined;
  return UNIT_COMBAT_STATS[unitType as CoreUnitType];
}

const BATTLE_SPEED_LEVELS = [0.5, 1, 1.5, 2, 3] as const;
const DEFAULT_BATTLE_SPEED = 1;

export const UNIT_COMBAT_STATS: Readonly<Record<CoreUnitType, BattleUnitStats>> = {
  swordsman: {
    maxHealth: 110,
    attack: 20,
    defense: 24,
    damage: 20,
    attackRange: 1.25,
    attackCooldown: 0.82,
    moveSpeed: 3.1,
    scanRange: 5.8,
  },
  archer: {
    maxHealth: 76,
    attack: 14,
    defense: 10,
    damage: 14,
    attackRange: 13,
    attackCooldown: 1.55,
    moveSpeed: 2.55,
    scanRange: 14.5,
  },
  spearman: {
    maxHealth: 104,
    attack: 18,
    defense: 30,
    damage: 18,
    attackRange: 1.85,
    attackCooldown: 0.94,
    moveSpeed: 2.85,
    scanRange: 6.4,
  },
  crossbowman: {
    maxHealth: 88,
    attack: 25,
    defense: 14,
    damage: 25,
    attackRange: 11.5,
    attackCooldown: 2.05,
    moveSpeed: 2.3,
    scanRange: 13.2,
  },
  modernSoldier: {
    maxHealth: 96,
    attack: 23,
    defense: 22,
    damage: 23,
    attackRange: 15.5,
    attackCooldown: 0.72,
    moveSpeed: 3.0,
    scanRange: 17,
  },
};

export class BattleSystem {
  /**
   * Canonical deterministic wall-defense weapon placement.
   * BattleSystem owns both placement and runtime wall-defense behavior.
   */
  static wallWeaponPositions(
    size: number,
    cellAt: (x: number, y: number) => GridCell | undefined,
  ): WallWeaponPosition[] {
    const candidates: WallWeaponPosition[] = [];

    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const cell = cellAt(x, y);
        if (!cell || !this.isSuitableWall(cell)) continue;

        const direction = this.weaponDirection(x, y, cell, cellAt);
        if (!direction) continue;

        candidates.push({ x, y, direction, range: 14 });
      }
    }

    const selected: WallWeaponPosition[] = [];
    for (const candidate of candidates) {
      if ((candidate.x * 17 + candidate.y * 31) % 5 !== 0) continue;
      const tooClose = selected.some(
        (item) => Math.hypot(item.x - candidate.x, item.y - candidate.y) < 4.5,
      );
      if (tooClose) continue;
      selected.push(candidate);
    }

    if (selected.length === 0 && candidates.length > 0) {
      selected.push(candidates[Math.floor(candidates.length / 2)]);
    }

    return selected;
  }

  private static isSuitableWall(cell: GridCell): boolean {
    return (
      (cell.kind === 'wall1' || cell.kind === 'wall2' || cell.kind === 'wall3') &&
      cell.walkway === true
    );
  }

  private static weaponDirection(
    x: number,
    y: number,
    cell: GridCell,
    cellAt: (x: number, y: number) => GridCell | undefined,
  ): WallDirection | null {
    const links = cell.wallLinks ?? [];
    const horizontal = links.includes('E') || links.includes('W');
    const vertical = links.includes('N') || links.includes('S');

    const preferred: WallDirection[] = horizontal && !vertical
      ? ((x + y) % 2 === 0 ? ['N', 'S'] : ['S', 'N'])
      : vertical && !horizontal
        ? ((x + y) % 2 === 0 ? ['E', 'W'] : ['W', 'E'])
        : ['N', 'E', 'S', 'W'];

    for (const direction of preferred) {
      const vector = WallSystem.vector(direction);
      const adjacent = cellAt(x + vector.x, y + vector.y);
      if (!adjacent || adjacent.kind === 'gate' || adjacent.kind === 'tower') {
        return direction;
      }
    }

    return preferred[0] ?? null;
  }


  private readonly navigation: BattleNavigation;
  private readonly relations = new FactionRelations();
  private readonly units = new Map<string, UnitRuntime>();
  private readonly arrows: ArrowProjectile[] = [];
  private readonly missiles: MissileProjectile[] = [];
  private readonly impactEffects: Array<{ view: THREE.Mesh; remainingMs: number }> = [];
  private readonly wallCollapseEffects: WallCollapseEffect[] = [];
  private readonly sharedGeometries: THREE.BufferGeometry[] = [];
  private readonly sharedMaterials: THREE.Material[] = [];
  private readonly bodyGeometry = this.geometry(new THREE.CylinderGeometry(0.22, 0.29, 0.68, 7));
  private readonly headGeometry = this.geometry(new THREE.SphereGeometry(0.2, 7, 6));
  private readonly helmetGeometry = this.geometry(new THREE.ConeGeometry(0.25, 0.3, 7));
  private readonly legGeometry = this.geometry(new THREE.CylinderGeometry(0.07, 0.08, 0.44, 5));
  private readonly armGeometry = this.geometry(new THREE.CylinderGeometry(0.055, 0.065, 0.38, 5));
  private readonly shieldGeometry = this.geometry(new THREE.CylinderGeometry(0.27, 0.3, 0.08, 10));
  private readonly swordGeometry = this.geometry(new THREE.BoxGeometry(0.07, 0.62, 0.05));
  private readonly spearGeometry = this.geometry(new THREE.CylinderGeometry(0.035, 0.035, 1.45, 6));
  private readonly spearTipGeometry = this.geometry(new THREE.ConeGeometry(0.09, 0.25, 5));
  private readonly bowGeometry = this.geometry(new THREE.TorusGeometry(0.29, 0.035, 4, 8, Math.PI));
  private readonly crossbowStockGeometry = this.geometry(new THREE.BoxGeometry(0.58, 0.08, 0.07));
  private readonly crossbowBowGeometry = this.geometry(new THREE.BoxGeometry(0.08, 0.06, 0.62));
  private readonly quiverGeometry = this.geometry(new THREE.CylinderGeometry(0.08, 0.1, 0.48, 6));
  private readonly arrowGeometry = this.geometry(new THREE.CylinderGeometry(0.022, 0.022, 0.68, 5));
  private readonly rifleGeometry = this.geometry(new THREE.BoxGeometry(0.08, 0.08, 0.9));
  private readonly rifleStockGeometry = this.geometry(new THREE.BoxGeometry(0.13, 0.11, 0.32));
  private readonly missileBodyGeometry = this.geometry(new THREE.CylinderGeometry(0.1, 0.14, 1.25, 8));
  private readonly missileNoseGeometry = this.geometry(new THREE.ConeGeometry(0.14, 0.32, 8));
  private readonly missileBlastGeometry = this.geometry(new THREE.RingGeometry(0.72, 1, 24));
  private readonly wallFlashGeometry = this.geometry(new THREE.SphereGeometry(0.09, 6, 5));
  private readonly wallChipGeometry = this.geometry(new THREE.DodecahedronGeometry(0.16, 0));
  private readonly wallStoneGeometry = this.geometry(new THREE.DodecahedronGeometry(0.3, 0));
  private readonly wallSlabGeometry = this.geometry(new THREE.BoxGeometry(0.56, 0.3, 0.42));
  private readonly wallDustGeometry = this.geometry(new THREE.SphereGeometry(0.3, 7, 5));
  private readonly wallShockwaveGeometry = this.geometry(new THREE.RingGeometry(0.55, 0.78, 28));
  private readonly tacticalMaterial = this.material(new THREE.MeshStandardMaterial({ color: 0x334039, roughness: 0.9 }));
  private readonly rifleMaterial = this.material(new THREE.MeshStandardMaterial({ color: 0x1d2322, roughness: 0.46, metalness: 0.52 }));
  private readonly missileMaterial = this.material(new THREE.MeshStandardMaterial({ color: 0xcfd7d8, roughness: 0.38, metalness: 0.62 }));
  private readonly missileNoseMaterial = this.material(new THREE.MeshStandardMaterial({ color: 0xb34d3f, roughness: 0.52, metalness: 0.35 }));
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
  private readonly damageDarkMaterial = this.material(
    new THREE.MeshStandardMaterial({ color: 0x3d332d, roughness: 1 }),
  );
  private readonly rubbleMaterial = this.material(
    new THREE.MeshStandardMaterial({ color: 0x81766c, roughness: 1, flatShading: true }),
  );
  private readonly rubbleLightMaterial = this.material(
    new THREE.MeshStandardMaterial({ color: 0xa19587, roughness: 1, flatShading: true }),
  );
  private readonly exposedCoreMaterial = this.material(
    new THREE.MeshStandardMaterial({ color: 0x645a50, roughness: 1, flatShading: true }),
  );
  private readonly dustMaterial = this.material(
    new THREE.MeshBasicMaterial({
      color: 0xb6a58f,
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
    }),
  );
  private readonly dustDarkMaterial = this.material(
    new THREE.MeshBasicMaterial({
      color: 0x75695e,
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
    }),
  );
  private readonly collapseShockMaterial = this.material(
    new THREE.MeshBasicMaterial({
      color: 0xd2c0a4,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  private readonly ladderWoodMaterial = this.material(
    new THREE.MeshStandardMaterial({ color: 0x6f4d31, roughness: 0.96 }),
  );
  private readonly ladderRailGeometry = this.geometry(new THREE.CylinderGeometry(0.055, 0.065, 1, 6));
  private readonly ladderRungGeometry = this.geometry(new THREE.CylinderGeometry(0.038, 0.042, 1, 6));

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
  private readonly wallStates = new Map<string, WallBattleState>();
  private readonly sessionWallDamage = new Map<string, number>();
  private preserveSessionWallDamage = false;
  private readonly wallNodes = new Map<string, WallNavNode>();
  private readonly breachedWalls = new Set<string>();
  private readonly ladders = new Map<string, SiegeLadder>();
  private siegePlan: SiegePlan | null = null;
  private siegeDecisionTimer = 0;
  private ladderCounter = 0;
  private wallWeapons: WallWeaponPosition[] = [];
  private wallWeaponTimers = new Map<string, number>();
  private pendingAttackerSpawns: Array<{ unitType: CoreUnitType; index: number }> = [];
  private attackerSpawnCells: NavPoint[] = [];
  private attackerSpawnCursor = 0;
  private attackerSpawnInterval = 0;
  private attackerSpawnTimer = 0;
  private attackerSpawnBatchSize = 1;
  private battleSpeed = DEFAULT_BATTLE_SPEED;
  private militaryTier: MilitaryTier = 1;
  private preparedDefenderSignature = '';
  private readonly objectiveSystem = new BattleObjectiveSystem();

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
      castleLinksAt: world.castleLinksAt,
      keeps: world.keeps,
      towerBridges: world.towerBridges,
      temporaryGroundPassable: (x, y) => this.breachedWalls.has(this.gridKey(x, y)),
      gatePassable: world.gatePassable,
    });
  }

  isActive(): boolean {
    return this.mode !== 'idle';
  }

  isRunning(): boolean {
    return this.mode === 'running';
  }

  isUnderAttack(): boolean {
    return this.mode === 'running' || this.mode === 'paused';
  }

  prepareDefenders(setup: BattleSetup, militaryTier: MilitaryTier = 1, force = false): void {
    if (this.mode !== 'idle') return;

    const normalized = this.normalizeSetup(setup);
    const normalizedTier = normalizeMilitaryTier(militaryTier);
    const signature = this.defenderSetupSignature(normalized, normalizedTier);
    const defenderCount = this.configuredDefenderCount(normalized);

    if (
      !force &&
      signature === this.preparedDefenderSignature &&
      this.countAlive('defender') === defenderCount
    ) {
      return;
    }

    for (const runtime of this.units.values()) {
      this.layer.remove(runtime.view);
    }
    this.units.clear();

    this.militaryTier = normalizedTier;
    this.initializeObjectiveAnchors();
    this.defenderStartCount = defenderCount;
    this.spawnDefenders(normalized);
    this.preparedDefenderSignature = signature;
    this.emitStatus();
  }

  start(setup: BattleSetup, options: BattleStartOptions = {}): void {
    const preserveSessionWallDamage = options.preserveSessionWallDamage === true;
    const normalized = this.normalizeSetup(setup);
    const nextMilitaryTier = normalizeMilitaryTier(options.militaryTier ?? 1);
    const defenderCount = this.configuredDefenderCount(normalized);
    const preparedSignature = this.defenderSetupSignature(normalized, nextMilitaryTier);
    const reusePreparedGarrison =
      this.mode === 'idle' &&
      this.preparedDefenderSignature === preparedSignature &&
      this.countAlive('defender') === defenderCount;

    if (!reusePreparedGarrison) {
      this.resetRuntime(false, preserveSessionWallDamage);
    } else {
      this.clearTransientBattleRuntime(preserveSessionWallDamage);
    }

    this.militaryTier = nextMilitaryTier;
    this.mode = 'running';
    this.battleSpeed = DEFAULT_BATTLE_SPEED;
    this.captureSeconds = 0;
    this.battleSeconds = 0;
    this.finalResult = undefined;
    this.siegeDecisionTimer = 0;
    this.initializeObjectiveAnchors();
    this.initializeWallStates();
    this.initializeWallWeapons();

    this.attackerStartCount =
      normalized.attackerSwordsmen +
      normalized.attackerArchers +
      normalized.attackerSpearmen +
      normalized.attackerCrossbowmen +
      normalized.attackerModernSoldiers;
    this.defenderStartCount = defenderCount;

    this.createObjectiveMarker();

    this.attackerSpawnInterval = Math.max(
      0,
      Number.isFinite(options.attackerSpawnInterval ?? 0)
        ? options.attackerSpawnInterval ?? 0
        : 0,
    );
    this.attackerSpawnBatchSize = Math.max(1, Math.floor(options.attackerSpawnBatchSize ?? 1));
    this.spawnAttackers(normalized, this.attackerSpawnInterval > 0);
    if (!reusePreparedGarrison) this.spawnDefenders(normalized);
    this.preparedDefenderSignature = '';
    this.refreshSiegePlan(true);
    this.objectiveSystem.start(options.scenario ?? DEFAULT_BATTLE_SCENARIO, this.battleSeconds);
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

  getBattleSpeed(): number {
    return this.battleSpeed;
  }

  setBattleSpeed(speed: number): void {
    const nearest = BATTLE_SPEED_LEVELS.reduce((best, candidate) =>
      Math.abs(candidate - speed) < Math.abs(best - speed) ? candidate : best,
    DEFAULT_BATTLE_SPEED);

    if (this.battleSpeed === nearest) return;
    this.battleSpeed = nearest;
    this.emitStatus();
  }

  increaseBattleSpeed(): void {
    const index = BATTLE_SPEED_LEVELS.indexOf(this.battleSpeed as (typeof BATTLE_SPEED_LEVELS)[number]);
    this.setBattleSpeed(BATTLE_SPEED_LEVELS[Math.min(BATTLE_SPEED_LEVELS.length - 1, index + 1)]);
  }

  decreaseBattleSpeed(): void {
    const index = BATTLE_SPEED_LEVELS.indexOf(this.battleSpeed as (typeof BATTLE_SPEED_LEVELS)[number]);
    this.setBattleSpeed(BATTLE_SPEED_LEVELS[Math.max(0, index - 1)]);
  }

  resetBattleSpeed(): void {
    this.setBattleSpeed(DEFAULT_BATTLE_SPEED);
  }

  reset(emit = true): void {
    this.resetRuntime(emit, false);
  }

  private initializeObjectiveAnchors(): void {
    this.objectiveGrid = this.navigation.castleObjective();
    this.capturePointGrid =
      this.navigation.findNearestWalkable(this.objectiveGrid, 10) ?? this.objectiveGrid;

    const objectiveWorld = this.world.gridToWorld(this.objectiveGrid.x, this.objectiveGrid.y);
    this.objectiveWorld.set(
      objectiveWorld.x,
      2.28 + this.world.elevationAt(this.capturePointGrid.x, this.capturePointGrid.y),
      objectiveWorld.z,
    );
  }

  private configuredDefenderCount(setup: BattleSetup): number {
    return (
      setup.defenderSwordsmen +
      setup.defenderArchers +
      setup.defenderSpearmen +
      setup.defenderCrossbowmen +
      setup.defenderModernSoldiers
    );
  }

  private defenderTopologySignature(): string {
    const defensiveKinds = new Set<TileKind>([
      'wall1',
      'wall2',
      'wall3',
      'gate',
      'tower',
      'armyCamp',
    ]);
    const parts: string[] = [];

    for (let y = 0; y < this.world.size; y += 1) {
      for (let x = 0; x < this.world.size; x += 1) {
        const kind = this.world.kindAt(x, y);
        if (kind && defensiveKinds.has(kind)) parts.push(`${x},${y},${kind}`);
      }
    }

    for (const keep of this.world.keeps()) {
      parts.push(`keep:${keep.id}:${keep.x},${keep.y},${keep.width},${keep.depth},${keep.floors},${keep.rotation}`);
    }

    return parts.join('|');
  }

  private defenderSetupSignature(setup: BattleSetup, tier: MilitaryTier): string {
    return [
      tier,
      setup.defenderSwordsmen,
      setup.defenderArchers,
      setup.defenderSpearmen,
      setup.defenderCrossbowmen,
      setup.defenderModernSoldiers,
      this.defenderTopologySignature(),
    ].join(':');
  }

  private clearTransientBattleRuntime(preserveSessionWallDamage: boolean): void {
    for (const [id, runtime] of this.units) {
      if (runtime.data.faction !== 'attacker') continue;
      this.layer.remove(runtime.view);
      this.units.delete(id);
    }

    this.wallWeapons = [];
    this.wallWeaponTimers.clear();

    for (const arrow of this.arrows) this.layer.remove(arrow.view);
    this.arrows.length = 0;
    this.clearMissiles();

    if (this.objectiveMarker) {
      this.layer.remove(this.objectiveMarker);
      this.objectiveMarker.geometry.dispose();
      this.objectiveMarker = null;
    }

    this.clearSiegeState();
    this.objectiveSystem.reset();
    this.pendingAttackerSpawns = [];
    this.attackerSpawnCells = [];
    this.attackerSpawnCursor = 0;
    this.attackerSpawnInterval = 0;
    this.attackerSpawnTimer = 0;
    this.attackerSpawnBatchSize = 1;

    if (!preserveSessionWallDamage) this.sessionWallDamage.clear();
    this.preserveSessionWallDamage = preserveSessionWallDamage;

    for (const runtime of this.units.values()) {
      runtime.data.targetId = undefined;
      runtime.data.state = 'guarding';
      runtime.defenderBehavior = 'idle';
      runtime.path = [];
      runtime.pathIndex = 0;
      runtime.patrolTarget = undefined;
    }
  }

  private resetRuntime(emit: boolean, preserveSessionWallDamage: boolean): void {
    for (const runtime of this.units.values()) {
      this.layer.remove(runtime.view);
    }
    this.units.clear();
    this.preparedDefenderSignature = '';
    this.wallWeapons = [];
    this.wallWeaponTimers.clear();

    for (const arrow of this.arrows) {
      this.layer.remove(arrow.view);
    }
    this.arrows.length = 0;
    this.clearMissiles();

    if (this.objectiveMarker) {
      this.layer.remove(this.objectiveMarker);
      this.objectiveMarker.geometry.dispose();
      this.objectiveMarker = null;
    }

    this.clearSiegeState();
    this.objectiveSystem.reset();

    this.mode = 'idle';
    this.battleSpeed = DEFAULT_BATTLE_SPEED;
    this.captureSeconds = 0;
    this.battleSeconds = 0;
    this.attackerStartCount = 0;
    this.defenderStartCount = 0;
    this.finalResult = undefined;
    this.pendingAttackerSpawns = [];
    this.attackerSpawnCells = [];
    this.attackerSpawnCursor = 0;
    this.attackerSpawnInterval = 0;
    this.attackerSpawnTimer = 0;
    this.attackerSpawnBatchSize = 1;

    if (!preserveSessionWallDamage) this.sessionWallDamage.clear();
    this.preserveSessionWallDamage = preserveSessionWallDamage;

    if (emit) this.emitStatus();
  }

  update(deltaMs: number, timeMs: number): void {
    this.updateImpactEffects(deltaMs);
    this.updateWallCollapseEffects(deltaMs);
    if (this.mode !== 'running') {
      if (this.mode === 'idle' && this.preparedDefenderSignature) {
        const idleDelta = Math.min(0.05, deltaMs / 1000);
        for (const runtime of this.units.values()) {
          if (runtime.data.faction !== 'defender' || runtime.data.state === 'dead') continue;
          runtime.animTime += idleDelta;
          runtime.moving = false;
          if (runtime.deploymentRoute) this.updateDefenderDeployment(runtime, idleDelta);
          runtime.view.position.copy(runtime.position);
          this.animateUnit(runtime);
        }
      }
      if (this.objectiveMarker) this.animateObjective(timeMs);
      return;
    }

    // Battle speed scales the battle simulation clock only. The render loop,
    // menus, camera, and other non-battle systems continue using real time.
    const delta = Math.min(0.05, deltaMs / 1000) * this.battleSpeed;
    this.battleSeconds += delta;
    this.globalDecisionTimer -= delta;
    this.statusTimer -= delta;
    this.updatePendingAttackerSpawns(delta);
    this.siegeDecisionTimer -= delta;

    if (this.globalDecisionTimer <= 0) {
      this.globalDecisionTimer = 0.28;
      this.refreshTargets();
    }

    if (this.siegeDecisionTimer <= 0) {
      this.siegeDecisionTimer = 1.2;
      this.refreshSiegePlan(false);
      this.ensureAdditionalLadder();
    }

    const buckets = this.buildSpatialBuckets();
    for (const runtime of this.units.values()) {
      this.updateUnit(runtime, delta, buckets);
    }

    this.updateWallWeapons(delta);
    this.updateProjectiles(delta);
    this.updateMissiles(delta);
    this.updateCapture(delta);
    this.cleanupDead(delta);
    this.animateObjective(timeMs);

    if (this.statusTimer <= 0) {
      this.objectiveSystem.update(this.createObjectiveContext(delta));
      this.statusTimer = 0.22;
      this.emitStatus();
    }

    this.checkVictory();
  }

  getMissileTargets(range: number): BattleMissileTarget[] {
    const maximumRange = Math.max(0, Number.isFinite(range) ? range : 0);
    const result: BattleMissileTarget[] = [];

    for (const runtime of this.units.values()) {
      if (runtime.data.faction !== 'attacker' || runtime.data.state === 'dead') continue;
      const distance = Math.hypot(
        runtime.position.x - this.objectiveWorld.x,
        runtime.position.z - this.objectiveWorld.z,
      );
      result.push({
        id: runtime.data.id,
        unitType: runtime.data.unitType,
        health: runtime.data.health,
        maxHealth: runtime.data.maxHealth,
        distance,
        inRange: distance <= maximumRange,
      });
    }

    return result.sort((a, b) => a.distance - b.distance);
  }

  launchMissile(targetId: string, options: BattleMissileLaunchOptions): BattleMissileLaunchResult {
    if (this.mode !== 'running') {
      return { ok: false, message: 'Missiles can only launch while a battle is running' };
    }

    const target = this.units.get(targetId);
    if (!target || target.data.state === 'dead' || target.data.faction !== 'attacker') {
      return { ok: false, message: 'Select a valid hostile target' };
    }

    const range = Math.max(0, Number(options.range) || 0);
    const impactRadius = Math.max(0.5, Number(options.impactRadius) || 0.5);
    const damage = Math.max(0, Number(options.damage) || 0);
    const distance = Math.hypot(
      target.position.x - this.objectiveWorld.x,
      target.position.z - this.objectiveWorld.z,
    );
    if (distance > range) {
      return { ok: false, message: 'Selected hostile target is outside missile range' };
    }
    if (damage <= 0) {
      return { ok: false, message: 'Missile payload is unavailable' };
    }

    const start = this.objectiveWorld.clone();
    start.y += 5.5;
    const targetPoint = target.position.clone();
    targetPoint.y += 0.55;

    const view = new THREE.Group();
    const body = new THREE.Mesh(this.missileBodyGeometry, this.missileMaterial);
    const nose = new THREE.Mesh(this.missileNoseGeometry, this.missileNoseMaterial);
    nose.position.y = 0.78;
    view.add(body, nose);
    view.position.copy(start);
    view.scale.setScalar(1.15);
    this.layer.add(view);

    this.missiles.push({
      view,
      targetId,
      start,
      targetPoint,
      elapsed: 0,
      duration: THREE.MathUtils.clamp(distance / 34, 0.85, 1.8),
      impactRadius,
      damage,
    });

    return { ok: true, message: `Missile launched at ${target.data.unitType}` };
  }

  status(): BattleStatus {
    const attackersAlive = this.countAlive('attacker');
    const defendersAlive = this.countAlive('defender');
    const defenderAliveByType = this.countDefendersByType();

    return {
      mode: this.mode,
      battleSpeed: this.battleSpeed,
      captureProgress: THREE.MathUtils.clamp(
        this.captureSeconds / this.captureRequiredSeconds,
        0,
        1,
      ),
      captureSeconds: this.captureSeconds,
      captureRequiredSeconds: this.captureRequiredSeconds,
      attackersAlive,
      defendersAlive,
      defenderAliveByType,
      result: this.finalResult,
      objectives: this.objectiveSystem.getState().runtime,
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
      attackerSpearmen: clamp(setup.attackerSpearmen),
      attackerCrossbowmen: clamp(setup.attackerCrossbowmen),
      attackerModernSoldiers: clamp(setup.attackerModernSoldiers),
      defenderSwordsmen: clamp(setup.defenderSwordsmen),
      defenderArchers: clamp(setup.defenderArchers),
      defenderSpearmen: clamp(setup.defenderSpearmen),
      defenderCrossbowmen: clamp(setup.defenderCrossbowmen),
      defenderModernSoldiers: clamp(setup.defenderModernSoldiers),
    };
  }

  private spawnAttackers(setup: BattleSetup, staged: boolean): void {
    const total =
      setup.attackerSwordsmen +
      setup.attackerArchers +
      setup.attackerSpearmen +
      setup.attackerCrossbowmen +
      setup.attackerModernSoldiers;
    this.attackerSpawnCells = this.navigation.attackerSpawnCells(
      this.objectiveGrid,
      Math.max(1, total),
    );
    this.attackerSpawnCursor = 0;

    const pending: Array<{ unitType: CoreUnitType; index: number }> = [];
    const queueType = (unitType: CoreUnitType, count: number, indexOffset: number): void => {
      for (let i = 0; i < count; i += 1) {
        pending.push({ unitType, index: i + indexOffset });
      }
    };

    queueType('swordsman', setup.attackerSwordsmen, 0);
    queueType('spearman', setup.attackerSpearmen, 5);
    queueType('archer', setup.attackerArchers, 11);
    queueType('crossbowman', setup.attackerCrossbowmen, 17);
    queueType('modernSoldier', setup.attackerModernSoldiers, 23);

    if (!staged) {
      this.pendingAttackerSpawns = [];
      for (const entry of pending) this.spawnPendingAttacker(entry);
      return;
    }

    this.pendingAttackerSpawns = pending;
    this.attackerSpawnTimer = 0;
    this.spawnPendingAttackerBatch();
  }

  private updatePendingAttackerSpawns(delta: number): void {
    if (this.mode !== 'running' || this.pendingAttackerSpawns.length === 0) return;

    this.attackerSpawnTimer -= delta;
    if (this.attackerSpawnTimer > 0) return;

    this.spawnPendingAttackerBatch();
    this.attackerSpawnTimer = this.attackerSpawnInterval;
  }

  private spawnPendingAttackerBatch(): void {
    const batch = Math.min(this.attackerSpawnBatchSize, this.pendingAttackerSpawns.length);
    for (let i = 0; i < batch; i += 1) {
      const entry = this.pendingAttackerSpawns.shift();
      if (entry) this.spawnPendingAttacker(entry);
    }
  }

  private spawnPendingAttacker(entry: { unitType: CoreUnitType; index: number }): void {
    const cell =
      this.attackerSpawnCells[this.attackerSpawnCursor % Math.max(1, this.attackerSpawnCells.length)] ??
      { x: 1, y: this.world.size - 2 };
    this.attackerSpawnCursor += 1;
    this.spawnGroundUnit('attacker', entry.unitType, cell, entry.index, true);
  }

  private spawnDefenders(setup: BattleSetup): void {
    const wallNodes = this.navigation.wallPlatformNodes();
    const usedWallNodes = new Set<string>();

    // Professional soldiers are persistent Army Camp troops. Keep them visibly
    // stationed around military infrastructure while idle instead of placing them
    // on castle walls as if they were free militia.
    const armyCamps = this.findArmyCamps();
    const professionalCells: NavPoint[] = [];
    for (const camp of armyCamps) {
      professionalCells.push(
        ...this.navigation.defenderGroundCells(
          camp,
          Math.max(4, Math.ceil(setup.defenderModernSoldiers / Math.max(1, armyCamps.length))),
        ),
      );
    }
    const professionalFallback = armyCamps[0] ?? this.capturePointGrid;
    for (let i = 0; i < setup.defenderModernSoldiers; i += 1) {
      const cell =
        professionalCells[i % Math.max(1, professionalCells.length)] ??
        professionalFallback;
      this.spawnGroundUnit('defender', 'modernSoldier', cell, 400 + i, false);
    }

    const rangedOrder: Array<{ type: CoreUnitType; count: number }> = [
      { type: 'crossbowman', count: setup.defenderCrossbowmen },
      { type: 'archer', count: setup.defenderArchers },
    ];
    const remainingRanged = new Map<CoreUnitType, number>(
      rangedOrder.map((entry) => [entry.type, entry.count]),
    );

    let wallCursor = 0;
    for (const entry of rangedOrder) {
      const desired = Math.min(entry.count, Math.max(0, wallNodes.length - usedWallNodes.size));
      let placed = 0;

      while (placed < desired && wallCursor < wallNodes.length * 3) {
        const index =
          wallNodes.length <= 1
            ? 0
            : Math.floor(
                ((wallCursor % wallNodes.length) / Math.max(1, wallNodes.length - 1)) *
                  (wallNodes.length - 1),
              );
        const node = wallNodes[index];
        wallCursor += 1;
        const key = `${node.x},${node.y}`;
        if (usedWallNodes.has(key)) continue;

        usedWallNodes.add(key);
        this.spawnWallUnit('defender', entry.type, node, wallCursor + placed);
        placed += 1;
      }

      remainingRanged.set(entry.type, Math.max(0, entry.count - placed));
    }

    const gateGuardCells = this.navigation.gateGuardCells();
    const gateGuardCount = Math.min(
      setup.defenderSwordsmen + setup.defenderSpearmen,
      gateGuardCells.length,
    );
    let gateGuardPlaced = 0;
    let gateGuardSwordPlaced = 0;
    let gateGuardSpearPlaced = 0;

    for (let i = 0; i < gateGuardCount; i += 1) {
      const useSpear =
        gateGuardSpearPlaced < setup.defenderSpearmen &&
        (gateGuardSwordPlaced >= setup.defenderSwordsmen || i % 2 === 1);
      const type: CoreUnitType = useSpear ? 'spearman' : 'swordsman';
      this.spawnGroundUnit('defender', type, gateGuardCells[i], 100 + i, false);
      gateGuardPlaced += 1;
      if (type === 'spearman') gateGuardSpearPlaced += 1;
      else gateGuardSwordPlaced += 1;
    }

    const meleeTotal =
      Math.max(0, setup.defenderSwordsmen - gateGuardSwordPlaced) +
      Math.max(0, setup.defenderSpearmen - gateGuardSpearPlaced);
    const wallMeleeCount = Math.min(
      Math.floor(meleeTotal * 0.3),
      Math.max(0, wallNodes.length - usedWallNodes.size),
    );
    let wallMeleePlaced = 0;
    let wallSwordPlaced = 0;
    let wallSpearPlaced = 0;

    for (
      let i = 0;
      i < wallNodes.length * 2 && wallMeleePlaced < wallMeleeCount;
      i += 1
    ) {
      const node = wallNodes[(i * 3 + 1) % Math.max(1, wallNodes.length)];
      if (!node) break;
      const key = `${node.x},${node.y}`;
      if (usedWallNodes.has(key)) continue;

      const useSpear =
        wallSpearPlaced < setup.defenderSpearmen &&
        (wallSwordPlaced >= setup.defenderSwordsmen || wallMeleePlaced % 2 === 1);
      const type: CoreUnitType = useSpear ? 'spearman' : 'swordsman';

      usedWallNodes.add(key);
      this.spawnWallUnit('defender', type, node, i + 31);
      wallMeleePlaced += 1;
      if (type === 'spearman') wallSpearPlaced += 1;
      else wallSwordPlaced += 1;
    }

    const remainingSwordsmen = Math.max(
      0,
      setup.defenderSwordsmen - gateGuardSwordPlaced - wallSwordPlaced,
    );
    const remainingSpearmen = Math.max(
      0,
      setup.defenderSpearmen - gateGuardSpearPlaced - wallSpearPlaced,
    );
    const remainingArchers = remainingRanged.get('archer') ?? 0;
    const remainingCrossbowmen = remainingRanged.get('crossbowman') ?? 0;
    const groundCount =
      remainingSwordsmen +
      remainingSpearmen +
      remainingArchers +
      remainingCrossbowmen;

    const camp = this.findArmyCamp();
    const defenseAnchor = camp ?? this.capturePointGrid;
    const groundCells = this.navigation.defenderGroundCells(
      defenseAnchor,
      Math.max(1, groundCount),
    );
    let cursor = 0;

    const spawnGroundType = (unitType: CoreUnitType, count: number, offset: number): void => {
      for (let i = 0; i < count; i += 1) {
        const cell =
          groundCells[cursor % groundCells.length] ??
          defenseAnchor;
        this.spawnGroundUnit(
          'defender',
          unitType,
          cell,
          cursor + offset,
          false,
        );
        cursor += 1;
      }
    };

    spawnGroundType('swordsman', remainingSwordsmen, 0);
    spawnGroundType('spearman', remainingSpearmen, 7);
    spawnGroundType('archer', remainingArchers, 13);
    spawnGroundType('crossbowman', remainingCrossbowmen, 19);
  }

  private findArmyCamps(): NavPoint[] {
    const camps: NavPoint[] = [];
    for (let y = 0; y < this.world.size; y += 1) {
      for (let x = 0; x < this.world.size; x += 1) {
        if (this.world.kindAt(x, y) === 'armyCamp') camps.push({ x, y });
      }
    }
    return camps.sort(
      (a, b) =>
        this.gridDistance(a, this.capturePointGrid) -
        this.gridDistance(b, this.capturePointGrid),
    );
  }

  private findArmyCamp(): NavPoint | null {
    let best: NavPoint | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (let y = 0; y < this.world.size; y += 1) {
      for (let x = 0; x < this.world.size; x += 1) {
        if (this.world.kindAt(x, y) !== 'armyCamp') continue;
        const distance = this.gridDistance({ x, y }, this.capturePointGrid);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = { x, y };
        }
      }
    }

    if (!best) return null;
    return this.navigation.findNearestWalkable(best, 4) ?? best;
  }

  private spawnGroundUnit(
    faction: Faction,
    unitType: CoreUnitType,
    cell: NavPoint,
    index: number,
    attacker: boolean,
  ): UnitRuntime {
    const base = this.world.gridToWorld(cell.x, cell.y);
    const spacing = 0.74;
    const column = index % 5;
    const row = Math.floor(index / 5) % 5;
    const offsetX = (column - 2) * spacing * 0.38;
    const offsetZ =
      (row - 2) * spacing * 0.38 +
      (attacker && this.isRangedUnit(unitType) ? 0.55 : 0);
    const edgePosition = new THREE.Vector3(
      base.x + offsetX,
      2.22 + this.world.elevationAt(cell.x, cell.y),
      base.z + offsetZ,
    );
    const position = edgePosition.clone();

    if (attacker) {
      const outward = new THREE.Vector3(
        edgePosition.x - this.objectiveWorld.x,
        0,
        edgePosition.z - this.objectiveWorld.z,
      );
      if (outward.lengthSq() < 0.001) outward.set(0, 0, 1);
      outward.normalize();
      position.addScaledVector(outward, this.world.tileSize * 2.25);
    }

    const runtime = this.createRuntime(faction, unitType, position, cell.x, cell.y, 'ground');
    runtime.home.copy(position);

    if (faction === 'attacker') {
      const target = this.navigation.findNearestWalkable(this.capturePointGrid, 10) ?? this.capturePointGrid;
      runtime.path = this.navigation.findPath(cell, target, true);
      runtime.pathIndex = Math.min(1, Math.max(0, runtime.path.length - 1));
      runtime.entryTarget = edgePosition;
      runtime.data.state = 'forming';
    } else {
      runtime.data.state = 'guarding';
      runtime.defenderBehavior = 'idle';
      runtime.defenseRadius = this.isMeleeUnit(unitType) ? 9.5 : 11.5;
      runtime.defenseOriginGrid = { x: cell.x, y: cell.y };
    }

    this.units.set(runtime.data.id, runtime);
    this.layer.add(runtime.view);
    return runtime;
  }

  private spawnWallUnit(
    faction: Faction,
    unitType: CoreUnitType,
    node: WallNavNode,
    index: number,
  ): void {
    if (faction === 'defender') {
      const route = this.navigation.accessRouteTo(node);
      const access = route.length && this.navigation.accessGroundCell(route[0]);
      if (!access) {
        const fallback = this.navigation.findNearestWalkable(node, 5);
        if (fallback) this.spawnGroundUnit(faction, unitType, fallback, index, false);
        return;
      }
      const runtime = this.spawnGroundUnit(faction, unitType, access, index, false);
      runtime.deploymentRoute = route;
      runtime.deploymentIndex = 0;
      runtime.defenseOriginGrid = { x: node.x, y: node.y };
      return;
    }
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
    runtime.defenderBehavior = 'idle';
    runtime.defenseRadius = this.isMeleeUnit(unitType) ? 10.5 : 12.5;
    runtime.defenseOriginGrid = { x: node.x, y: node.y };
    this.units.set(runtime.data.id, runtime);
    this.layer.add(runtime.view);
  }

  private updateDefenderDeployment(runtime: UnitRuntime, delta: number): void {
    const route = runtime.deploymentRoute;
    if (!route?.length) return;
    const index = runtime.deploymentIndex ?? 0;
    const next = route[index];
    if (!next) {
      runtime.deploymentRoute = undefined;
      runtime.home.copy(runtime.position);
      runtime.defenderBehavior = 'idle';
      runtime.data.state = 'guarding';
      return;
    }
    if (this.mode === 'running' && !this.wallNodes.has(this.gridKey(next.x, next.y))) {
      // An edited/collapsed route cannot retain a defender on a stale wall node.
      runtime.deploymentRoute = undefined;
      const safe = this.navigation.findNearestWalkable({ x: runtime.gridX, y: runtime.gridY }, 4);
      if (safe) {
        const ground = this.world.gridToWorld(safe.x, safe.y);
        runtime.position.set(ground.x, 2.22 + this.world.elevationAt(safe.x, safe.y), ground.z);
        runtime.gridX = safe.x;
        runtime.gridY = safe.y;
      }
      runtime.surface = 'ground';
      runtime.home.copy(runtime.position);
      runtime.data.state = 'guarding';
      return;
    }
    const world = this.world.gridToWorld(next.x, next.y);
    const target = new THREE.Vector3(world.x, next.worldY, world.z);
    if (this.moveTowardWallPoint(runtime, target, delta, 0.25)) {
      runtime.position.copy(target);
      runtime.surface = 'wall';
      runtime.gridX = next.x;
      runtime.gridY = next.y;
      runtime.deploymentIndex = index + 1;
      if (runtime.deploymentIndex >= route.length) {
        runtime.deploymentRoute = undefined;
        runtime.home.copy(runtime.position);
        runtime.defenderBehavior = 'idle';
        runtime.data.state = 'guarding';
        return;
      }
    }
    runtime.data.state = 'moving';
  }

  private createRuntime(
    faction: Faction,
    unitType: CoreUnitType,
    position: THREE.Vector3,
    gridX: number,
    gridY: number,
    surface: 'ground' | 'wall',
  ): UnitRuntime {
    const baseStats = UNIT_COMBAT_STATS[unitType];
    const stats = faction === 'defender' ? defenderUnitStats(baseStats, this.militaryTier) : baseStats;
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
      attack: stats.attack,
      defense: stats.defense,
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
      defenderBehavior: 'idle',
      patrolIndex: 0,
      patrolCooldown: 0,
      defenseOriginGrid: { x: gridX, y: gridY },
      progressCheckTimer: 0.65,
      stuckSeconds: 0,
      recoveryTime: 0,
      recoverySign: this.units.size % 2 === 0 ? 1 : -1,
      lastProgressPosition: position.clone(),
      climbProgress: 0,
      wallSeconds: 0,
      attackProgress: 1,
      attackDuration: Math.max(0.24, Math.min(stats.attackCooldown * 0.46, 0.52)),
      attackApplied: false,
      hitReaction: 0,
      victoryPhase: Math.random() * Math.PI * 2,
    };
  }

  private createUnitView(faction: Faction, unitType: CoreUnitType): THREE.Group {
    const root = new THREE.Group();
    const primary =
      faction === 'attacker' ? this.attackerMaterial : this.defenderMaterial;
    const dark =
      faction === 'attacker' ? this.attackerDarkMaterial : this.defenderDarkMaterial;

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

    const leftArm = new THREE.Group();
    const leftArmMesh = new THREE.Mesh(this.armGeometry, dark);
    leftArmMesh.position.y = -0.18;
    leftArm.add(leftArmMesh);
    leftArm.position.set(-0.27, 1.03, 0);
    root.add(leftArm);

    const rightArm = new THREE.Group();
    const rightArmMesh = new THREE.Mesh(this.armGeometry, dark);
    rightArmMesh.position.y = -0.18;
    rightArm.add(rightArmMesh);
    rightArm.position.set(0.27, 1.03, 0);
    root.add(rightArm);

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
    } else if (unitType === 'spearman') {
      const spear = new THREE.Group();
      const shaft = new THREE.Mesh(this.spearGeometry, this.woodMaterial);
      shaft.rotation.z = -0.08;
      spear.add(shaft);

      const tip = new THREE.Mesh(this.spearTipGeometry, this.swordMaterial);
      tip.position.y = 0.82;
      spear.add(tip);

      spear.position.set(0.34, 0.86, 0.02);
      spear.rotation.z = -0.22;
      weapon = spear;
      root.add(weapon);

      shield = new THREE.Mesh(this.shieldGeometry, primary);
      shield.rotation.z = Math.PI / 2;
      shield.scale.set(0.9, 0.9, 0.9);
      shield.position.set(-0.31, 0.76, 0.02);
      root.add(shield);
    } else if (unitType === 'modernSoldier') {
      const rifle = new THREE.Group();
      const stock = new THREE.Mesh(this.rifleStockGeometry, this.tacticalMaterial);
      stock.position.z = -0.25;
      rifle.add(stock);
      const barrel = new THREE.Mesh(this.rifleGeometry, this.rifleMaterial);
      barrel.position.z = 0.28;
      rifle.add(barrel);
      rifle.position.set(0.28, 0.83, 0.05);
      rifle.rotation.x = -0.18;
      rifle.rotation.z = -0.12;
      weapon = rifle;
      root.add(weapon);
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.48, 0.22), this.tacticalMaterial);
      plate.position.set(0, 0.78, -0.02);
      root.add(plate);
      helmet.scale.set(1.08, 0.92, 1.08);
      const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.12), this.rifleMaterial);
      pouch.position.set(-0.28, 0.68, 0.05);
      root.add(pouch);
    } else if (unitType === 'crossbowman') {
      const crossbow = new THREE.Group();
      const stock = new THREE.Mesh(this.crossbowStockGeometry, this.woodMaterial);
      stock.rotation.z = -0.1;
      crossbow.add(stock);

      const bow = new THREE.Mesh(this.crossbowBowGeometry, this.metalMaterial);
      bow.position.x = 0.22;
      crossbow.add(bow);

      crossbow.position.set(0.29, 0.84, 0.04);
      crossbow.rotation.y = Math.PI / 2;
      weapon = crossbow;
      root.add(weapon);

      const quiver = new THREE.Mesh(this.quiverGeometry, dark);
      quiver.position.set(-0.22, 0.82, 0.12);
      quiver.rotation.z = -0.28;
      root.add(quiver);
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

    if (unitType === 'spearman') {
      const crest = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.18, 0.34),
        primary,
      );
      crest.position.y = 1.61;
      root.add(crest);
    } else if (unitType === 'crossbowman') {
      helmet.scale.set(1.04, 0.84, 1.04);
      const belt = new THREE.Mesh(
        new THREE.BoxGeometry(0.48, 0.08, 0.32),
        dark,
      );
      belt.position.y = 0.78;
      root.add(belt);
    }

    const factionBand = new THREE.Mesh(
      new THREE.CylinderGeometry(0.31, 0.31, 0.08, 8),
      primary,
    );
    factionBand.position.y = 0.98;
    root.add(factionBand);
    // Broad color planes stay recognizable at the normal elevated camera zoom.
    const crest = new THREE.Mesh(this.shieldGeometry, primary);
    crest.scale.set(0.5, 0.6, 0.5);
    crest.rotation.x = Math.PI / 2;
    crest.position.set(0, 1.04, -0.19);
    root.add(crest);

    const refs: UnitVisualRefs = { body, leftLeg, rightLeg, leftArm, rightArm, weapon, shield };
    root.userData.visualRefs = refs;
    return root;
  }

  private isRangedUnit(unitType: UnitType): boolean {
    return unitType === 'archer' || unitType === 'crossbowman' || unitType === 'modernSoldier';
  }

  private isMeleeUnit(unitType: UnitType): boolean {
    return unitType === 'swordsman' || unitType === 'spearman';
  }

  private updateUnit(
    runtime: UnitRuntime,
    delta: number,
    buckets: Map<string, UnitRuntime[]>,
  ): void {
    runtime.animTime += delta;
    runtime.attackTimer = Math.max(0, runtime.attackTimer - delta);
    runtime.repathTimer = Math.max(0, runtime.repathTimer - delta);
    runtime.recoveryTime = Math.max(0, runtime.recoveryTime - delta);
    runtime.progressCheckTimer -= delta;
    runtime.moving = false;

    if (runtime.data.state === 'dead') {
      runtime.deathTime += delta;
      runtime.view.rotation.z = THREE.MathUtils.lerp(runtime.view.rotation.z, Math.PI / 2, delta * 5);
      runtime.view.position.y = runtime.position.y - Math.min(0.2, runtime.deathTime * 0.08);
      this.animateUnit(runtime);
      return;
    }

    if (runtime.deploymentRoute) {
      runtime.data.targetId = undefined;
      this.updateDefenderDeployment(runtime, delta);
      runtime.view.position.copy(runtime.position);
      this.animateUnit(runtime);
      return;
    }

    if (runtime.entryTarget) {
      runtime.data.targetId = undefined;
      runtime.data.state = 'forming';
      if (this.moveTowardPoint(runtime, runtime.entryTarget, delta, 0.28)) {
        runtime.position.copy(runtime.entryTarget);
        runtime.entryTarget = undefined;
      }
      runtime.view.position.copy(runtime.position);
      this.animateUnit(runtime);
      return;
    }

    if (runtime.surface === 'ladder') {
      this.updateLadderClimb(runtime, delta);
      runtime.view.position.copy(runtime.position);
      this.animateUnit(runtime);
      return;
    }

    let target = runtime.data.targetId
      ? this.units.get(runtime.data.targetId)
      : undefined;

    if (
      runtime.data.faction === 'defender' &&
      target &&
      target.data.state !== 'dead' &&
      target.position.distanceTo(runtime.home) > runtime.defenseRadius
    ) {
      runtime.data.targetId = undefined;
      runtime.defenderBehavior = 'return';
      target = undefined;
    }

    if (target && target.data.state !== 'dead') {
      if (runtime.data.faction === 'defender') {
        runtime.defenderBehavior =
          runtime.position.distanceTo(target.position) <= runtime.stats.attackRange
            ? 'attack'
            : 'chase';
      }

      this.faceTarget(runtime, target.position);
      const distance = runtime.position.distanceTo(target.position);

      if (this.isRangedUnit(runtime.data.unitType)) {
        const hasAttackVisibility = this.hasUnitAttackVisibility(runtime, target);
        if (distance <= runtime.stats.attackRange && hasAttackVisibility) {
          runtime.data.state = 'attacking';
          if (runtime.attackTimer <= 0) this.fireArrow(runtime, target);
        } else if (runtime.surface === 'ground') {
          // Awareness is intentionally broader than attack visibility. A unit
          // may know an enemy is behind a wall, but it must route to a valid
          // crossing (or fall back to siege behavior) instead of firing
          // through the fortification.
          const stopDistance = hasAttackVisibility
            ? runtime.stats.attackRange * 0.9
            : Math.min(0.55, runtime.stats.attackRange * 0.35);
          const moved = this.moveTowardTarget(
            runtime,
            target.position,
            delta,
            stopDistance,
          );
          if (!moved && runtime.data.faction === 'attacker') {
            if (!this.updateSiegeGroundAttacker(runtime, delta)) {
              this.followAttackerObjective(runtime, delta);
            }
          }
        } else if (runtime.surface === 'wall' && target.surface === 'wall') {
          this.moveAlongWallToward(runtime, target, delta);
        }
      } else {
        const verticalDifference = Math.abs(runtime.position.y - target.position.y);
        const hasAttackVisibility = this.hasUnitAttackVisibility(runtime, target);
        if (
          distance <= runtime.stats.attackRange &&
          verticalDifference <= 1.5 &&
          hasAttackVisibility
        ) {
          runtime.data.state = 'attacking';
          if (runtime.attackTimer <= 0) this.meleeAttack(runtime, target);
        } else if (runtime.surface === 'ground') {
          const attackPosition = hasAttackVisibility
            ? this.meleeApproachPoint(runtime, target)
            : target.position;
          const moved = this.moveTowardTarget(
            runtime,
            attackPosition,
            delta,
            hasAttackVisibility
              ? runtime.stats.attackRange * 0.9
              : 0.4,
          );
          if (!moved && runtime.data.faction === 'attacker') {
            if (!this.updateSiegeGroundAttacker(runtime, delta)) {
              this.followAttackerObjective(runtime, delta);
            }
          }
        } else if (runtime.surface === 'wall' && target.surface === 'wall') {
          this.moveAlongWallToward(runtime, target, delta);
        }
      }
    } else if (runtime.surface === 'ground') {
      if (runtime.data.faction === 'attacker') {
        if (!this.updateSiegeGroundAttacker(runtime, delta)) {
          this.followAttackerObjective(runtime, delta);
        }
      } else {
        this.updateDefenderBehavior(runtime, delta);
      }
    } else if (runtime.surface === 'wall') {
      this.updateWallSurfaceUnit(runtime, delta);
    }

    if (
      (runtime.surface === 'ground' || runtime.surface === 'wall') &&
      runtime.moving
    ) {
      this.applySeparation(runtime, delta, buckets);
    }

    this.updateStuckRecovery(runtime, delta);

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

  private updateDefenderBehavior(runtime: UnitRuntime, delta: number): void {
    runtime.patrolCooldown = Math.max(0, runtime.patrolCooldown - delta);

    const distanceHome = runtime.position.distanceTo(runtime.home);

    // A defender never leaves its assigned defensive area just to chase a target.
    if (distanceHome > runtime.defenseRadius) {
      runtime.data.targetId = undefined;
      runtime.defenderBehavior = 'return';
    }

    if (runtime.defenderBehavior === 'return') {
      if (runtime.surface === 'ground') {
        const home = runtime.defenseOriginGrid;
        if (
          runtime.path.length === 0 ||
          runtime.pathIndex >= runtime.path.length ||
          runtime.path[runtime.path.length - 1]?.x !== home.x ||
          runtime.path[runtime.path.length - 1]?.y !== home.y
        ) {
          runtime.path = this.navigation.findPath(
            { x: runtime.gridX, y: runtime.gridY },
            home,
            true,
          );
          runtime.pathIndex = Math.min(1, Math.max(0, runtime.path.length - 1));
        }

        if (runtime.path.length > 1 && runtime.pathIndex < runtime.path.length) {
          this.followGroundPath(runtime, delta, 'moving');
          return;
        }
      } else {
        const node = this.wallNodes.get(this.gridKey(runtime.gridX, runtime.gridY));
        if (node) {
          const neighbors = this.navigation
            .connectedWallNeighbors(node, this.wallNodes)
            .filter(
              (candidate) =>
                this.gridDistance(candidate, runtime.defenseOriginGrid) <
                this.gridDistance(node, runtime.defenseOriginGrid),
            )
            .sort(
              (a, b) =>
                this.gridDistance(a, runtime.defenseOriginGrid) -
                this.gridDistance(b, runtime.defenseOriginGrid),
            );

          const next = neighbors[0];
          if (next) {
            const world = this.world.gridToWorld(next.x, next.y);
            const destination = new THREE.Vector3(world.x, next.worldY, world.z);
            if (this.moveTowardWallPoint(runtime, destination, delta, 0.28)) {
              runtime.gridX = next.x;
              runtime.gridY = next.y;
              runtime.position.y = next.worldY;
            }
            runtime.data.state = 'moving';
            return;
          }
        }
      }

      runtime.path = [];
      runtime.pathIndex = 0;
      runtime.patrolTarget = undefined;
      runtime.defenderBehavior = 'idle';
      runtime.data.state = 'guarding';
      return;
    }

    if (runtime.patrolTarget) {
      if (runtime.surface === 'ground') {
        if (runtime.path.length > 1 && runtime.pathIndex < runtime.path.length) {
          this.followGroundPath(runtime, delta, 'moving');
          runtime.defenderBehavior = 'patrol';
          return;
        }

        const patrolWorld = this.world.gridToWorld(
          runtime.patrolTarget.x,
          runtime.patrolTarget.y,
        );
        const reached = runtime.position.distanceTo(
          new THREE.Vector3(
            patrolWorld.x,
            runtime.position.y,
            patrolWorld.z,
          ),
        ) <= 0.55;

        if (!reached) {
          runtime.path = this.navigation.findPath(
            { x: runtime.gridX, y: runtime.gridY },
            runtime.patrolTarget,
            false,
          );
          runtime.pathIndex = Math.min(1, Math.max(0, runtime.path.length - 1));

          if (runtime.path.length > 1) {
            runtime.defenderBehavior = 'patrol';
            this.followGroundPath(runtime, delta, 'moving');
            return;
          }
        }
      } else {
        const node = this.wallNodes.get(this.gridKey(runtime.gridX, runtime.gridY));
        if (node && (node.x !== runtime.patrolTarget.x || node.y !== runtime.patrolTarget.y)) {
          const neighbors = this.navigation
            .connectedWallNeighbors(node, this.wallNodes)
            .filter(
              (candidate) =>
                this.gridDistance(
                  { x: candidate.x, y: candidate.y },
                  runtime.defenseOriginGrid,
                ) <= runtime.defenseRadius,
            )
            .sort(
              (a, b) =>
                this.gridDistance(a, runtime.patrolTarget!) -
                this.gridDistance(b, runtime.patrolTarget!),
            );

          const next = neighbors[0];
          if (next) {
            const world = this.world.gridToWorld(next.x, next.y);
            const destination = new THREE.Vector3(world.x, next.worldY, world.z);
            if (this.moveTowardWallPoint(runtime, destination, delta, 0.28)) {
              runtime.gridX = next.x;
              runtime.gridY = next.y;
              runtime.position.y = next.worldY;
            }
            runtime.defenderBehavior = 'patrol';
            runtime.data.state = 'moving';
            return;
          }
        }
      }

      runtime.patrolTarget = undefined;
      runtime.path = [];
      runtime.pathIndex = 0;
      runtime.patrolCooldown = 1.4;
      runtime.defenderBehavior = 'idle';
      runtime.data.state = 'guarding';
      return;
    }

    if (runtime.patrolCooldown <= 0) {
      const target = this.selectDefenderPatrolTarget(runtime);
      if (target) {
        runtime.patrolTarget = target;
        runtime.defenderBehavior = 'patrol';
        runtime.data.state = 'moving';
        return;
      }
    }

    runtime.defenderBehavior = 'idle';
    runtime.data.state = 'guarding';
  }

  private selectDefenderPatrolTarget(runtime: UnitRuntime): NavPoint | null {
    if (runtime.surface === 'wall') {
      const node = this.wallNodes.get(this.gridKey(runtime.gridX, runtime.gridY));
      if (!node) return null;

      const candidates = this.navigation
        .connectedWallNeighbors(node, this.wallNodes)
        .filter(
          (candidate) =>
            this.gridDistance(
              { x: candidate.x, y: candidate.y },
              runtime.defenseOriginGrid,
            ) <= runtime.defenseRadius,
        )
        .sort((a, b) => {
          const da = this.gridDistance(a, runtime.defenseOriginGrid);
          const db = this.gridDistance(b, runtime.defenseOriginGrid);
          if (da !== db) return db - da;
          return a.x - b.x || a.y - b.y;
        });

      if (candidates.length === 0) return null;
      const chosen = candidates[runtime.patrolIndex % candidates.length];
      runtime.patrolIndex += 1;
      return { x: chosen.x, y: chosen.y };
    }

    const offsets = [
      { x: -2, y: 0 },
      { x: 0, y: -2 },
      { x: 2, y: 0 },
      { x: 0, y: 2 },
      { x: -2, y: -2 },
      { x: 2, y: -2 },
      { x: 2, y: 2 },
      { x: -2, y: 2 },
    ];

    for (let attempt = 0; attempt < offsets.length; attempt += 1) {
      const offset = offsets[(runtime.patrolIndex + attempt) % offsets.length];
      const candidate = {
        x: runtime.defenseOriginGrid.x + offset.x,
        y: runtime.defenseOriginGrid.y + offset.y,
      };
      if (!this.navigation.isGroundWalkable(candidate.x, candidate.y)) continue;
      if (
        this.gridDistance(candidate, runtime.defenseOriginGrid) >
        runtime.defenseRadius / Math.max(1, this.world.tileSize)
      ) {
        continue;
      }
      runtime.patrolIndex += attempt + 1;
      return candidate;
    }

    return null;
  }

  private followGroundPath(
    runtime: UnitRuntime,
    delta: number,
    state: BattleUnit['state'],
  ): void {
    if (runtime.path.length === 0 || runtime.pathIndex >= runtime.path.length) {
      runtime.data.state = state;
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

    runtime.data.state = state;
  }


  private moveTowardTarget(
    runtime: UnitRuntime,
    target: THREE.Vector3,
    delta: number,
    stopDistance = runtime.stats.attackRange * 0.9,
  ): boolean {
    const distanceFromHome =
      runtime.data.faction === 'defender'
        ? runtime.position.distanceTo(runtime.home)
        : 0;

    if (
      runtime.data.faction === 'defender' &&
      distanceFromHome > runtime.defenseRadius
    ) {
      return this.moveTowardPoint(runtime, runtime.home, delta, 0.35);
    }

    // Defenders must always use the validated ground graph while chasing.
    // This prevents direct movement from cutting through walls or buildings.
    if (runtime.surface === 'ground' && runtime.data.faction === 'defender') {
      const targetGrid = this.worldToGrid(target);
      const goal = this.navigation.isGroundWalkable(targetGrid.x, targetGrid.y)
        ? targetGrid
        : this.navigation.findNearestWalkable(targetGrid, 3);

      if (!goal) {
        runtime.moving = false;
        return false;
      }

      if (
        runtime.repathTimer <= 0 ||
        runtime.path.length === 0 ||
        runtime.pathIndex >= runtime.path.length
      ) {
        const path = this.navigation.findPath(
          { x: runtime.gridX, y: runtime.gridY },
          goal,
          false,
        );
        if (path.length > 1) {
          runtime.path = path;
          runtime.pathIndex = 1;
          runtime.repathTimer = 0.45;
        } else {
          runtime.repathTimer = 0.2;
        }
      }

      if (runtime.path.length > 1 && runtime.pathIndex < runtime.path.length) {
        this.followGroundPath(runtime, delta, 'moving');
        return true;
      }

      runtime.moving = false;
      return false;
    }

    // Combat target chasing must use the same ground navigation graph as
    // objective movement whenever a wall/building blocks the direct segment.
    if (runtime.surface === 'ground') {
      const targetGrid = this.worldToGrid(target);
      const direction = new THREE.Vector3(
        target.x - runtime.position.x,
        0,
        target.z - runtime.position.z,
      );
      const distance = direction.length();

      if (distance > stopDistance) {
        direction.normalize();
        const probeDistance = Math.min(
          Math.max(this.world.tileSize * 0.55, 0.35),
          distance,
        );
        const probe = runtime.position.clone().addScaledVector(direction, probeDistance);
        const probeGrid = this.worldToGrid(probe);

        if (!this.canTraverseGroundTransition(runtime.gridX, runtime.gridY, probeGrid)) {
          const goal = this.navigation.isGroundWalkable(targetGrid.x, targetGrid.y)
            ? targetGrid
            : this.navigation.findNearestWalkable(targetGrid, 3);

          if (goal) {
            if (
              runtime.repathTimer <= 0 ||
              runtime.path.length === 0 ||
              runtime.pathIndex >= runtime.path.length
            ) {
              const path = this.navigation.findPath(
                { x: runtime.gridX, y: runtime.gridY },
                goal,
                false,
              );
              if (path.length > 1) {
                runtime.path = path;
                runtime.pathIndex = 1;
                runtime.repathTimer = 0.4;
              } else {
                runtime.repathTimer = 0.2;
              }
            }

            if (runtime.path.length > 1 && runtime.pathIndex < runtime.path.length) {
              this.followGroundPath(runtime, delta, 'moving');
              return true;
            }
          }

          runtime.moving = false;
          return false;
        }
      }
    }

    return this.moveTowardPoint(runtime, target, delta, stopDistance);
  }

  private worldToGrid(position: THREE.Vector3): NavPoint {
    return {
      x: Math.floor(position.x / this.world.tileSize + this.world.size / 2),
      y: Math.floor(position.z / this.world.tileSize + this.world.size / 2),
    };
  }

  private hasUnitAttackVisibility(
    attacker: UnitRuntime,
    target: UnitRuntime,
  ): boolean {
    const origin = attacker.position.clone();
    origin.y += this.isRangedUnit(attacker.data.unitType) ? 0.95 : 0.58;
    const destination = target.position.clone();
    destination.y += 0.72;
    return this.hasDirectAttackVisibility(origin, destination);
  }

  private hasDirectAttackVisibility(
    origin: THREE.Vector3,
    destination: THREE.Vector3,
  ): boolean {
    const start = this.worldToGrid(origin);
    const end = this.worldToGrid(destination);
    const planarDistance = Math.hypot(
      destination.x - origin.x,
      destination.z - origin.z,
    );
    const steps = Math.max(
      1,
      Math.ceil(planarDistance / Math.max(0.2, this.world.tileSize * 0.22)),
    );
    let lastKey = '';

    for (let index = 1; index < steps; index += 1) {
      const t = index / steps;
      const sample = new THREE.Vector3(
        THREE.MathUtils.lerp(origin.x, destination.x, t),
        THREE.MathUtils.lerp(origin.y, destination.y, t),
        THREE.MathUtils.lerp(origin.z, destination.z, t),
      );
      const grid = this.worldToGrid(sample);
      const key = this.gridKey(grid.x, grid.y);

      if (key === lastKey) continue;
      lastKey = key;

      if (
        (grid.x === start.x && grid.y === start.y) ||
        (grid.x === end.x && grid.y === end.y)
      ) {
        continue;
      }

      const kind = this.world.kindAt(grid.x, grid.y);
      if (!this.isFortificationSightBlocker(kind, grid.x, grid.y)) continue;

      const cell = this.world.cellAt(grid.x, grid.y);
      const top = cell
        ? this.world.elevationAt(grid.x, grid.y) +
          this.world.fortificationTopAt(grid.x, grid.y, cell)
        : this.world.elevationAt(grid.x, grid.y) + 4;

      if (sample.y <= top + 0.16) return false;
    }

    return true;
  }

  private isFortificationSightBlocker(
    kind: TileKind | undefined,
    x: number,
    y: number,
  ): boolean {
    if (!kind) return false;
    if (this.breachedWalls.has(this.gridKey(x, y))) return false;

    if (kind === 'gate') {
      return this.world.gatePassable
        ? !this.world.gatePassable(x, y)
        : true;
    }

    return (
      kind === 'wall1' ||
      kind === 'wall2' ||
      kind === 'wall3' ||
      kind === 'tower'
    );
  }

  private canTraverseGroundTransition(
    fromX: number,
    fromY: number,
    to: NavPoint,
  ): boolean {
    if (!this.navigation.isGroundWalkable(to.x, to.y)) return false;

    const dx = to.x - fromX;
    const dy = to.y - fromY;
    if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1 && dx !== 0 && dy !== 0) {
      return (
        this.navigation.isGroundWalkable(fromX + dx, fromY) &&
        this.navigation.isGroundWalkable(fromX, fromY + dy)
      );
    }

    return true;
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

    if (runtime.recoveryTime > 0) {
      const side = new THREE.Vector3(-planar.z, 0, planar.x)
        .multiplyScalar(runtime.recoverySign * 0.42);
      planar.add(side).normalize();
    }

    const step = Math.min(distance - stopDistance, runtime.stats.moveSpeed * delta);
    runtime.position.addScaledVector(planar, Math.max(0, step));
    this.rotateUnitToward(runtime, Math.atan2(planar.x, planar.z), delta, 11);
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

  private initializeWallStates(): void {
    this.wallStates.clear();
    this.breachedWalls.clear();
    this.wallNodes.clear();

    for (let y = 0; y < this.world.size; y += 1) {
      for (let x = 0; x < this.world.size; x += 1) {
        const cell = this.world.cellAt(x, y);
        if (!cell) continue;
        if (cell.kind !== 'wall1' && cell.kind !== 'wall2' && cell.kind !== 'wall3') continue;

        const maxHealth = this.wallMaxHealth(cell);
        const visual = new THREE.Group();
        const world = this.world.gridToWorld(x, y);
        visual.position.set(world.x, this.world.elevationAt(x, y), world.z);
        this.layer.add(visual);

        const initialPersistentDamage = THREE.MathUtils.clamp(
          this.world.buildingDamageAt?.(x, y) ?? 0,
          0,
          1,
        );
        const key = this.gridKey(x, y);
        const battleDamage = this.preserveSessionWallDamage && !this.world.onWallDamage
          ? THREE.MathUtils.clamp(
              this.sessionWallDamage.get(key) ?? 0,
              0,
              1 - initialPersistentDamage,
            )
          : 0;
        const health = Math.max(
          0,
          maxHealth * (1 - initialPersistentDamage - battleDamage),
        );
        const stage: WallDamageStage =
          health <= 0 ? 'breached' :
          health / maxHealth <= 0.14 ? 'partial' :
          health / maxHealth <= 0.38 ? 'heavy' :
          health / maxHealth <= 0.7 ? 'damaged' : 'healthy';

        this.wallStates.set(key, {
          x,
          y,
          cell,
          maxHealth,
          health,
          initialPersistentDamage,
          battleDamage,
          stage,
          visual,
        });
        if (stage !== 'healthy') this.renderWallDamage(this.wallStates.get(this.gridKey(x, y))!);
        if (stage === 'breached') {
          this.breachedWalls.add(this.gridKey(x, y));
          this.wallNodes.delete(this.gridKey(x, y));
          this.world.setWallBattleVisibility(x, y, false);
        }
      }
    }

    for (const node of this.navigation.wallPlatformNodes()) {
      this.wallNodes.set(this.gridKey(node.x, node.y), node);
    }
    for (const key of this.breachedWalls) {
      this.wallNodes.delete(key);
    }
    if (this.breachedWalls.size > 0) this.navigation.invalidate();
  }

  private wallMaxHealth(cell: GridCell): number {
    const base =
      cell.kind === 'wall2' ? 430 :
      cell.kind === 'wall3' ? 860 :
      650;
    const thickness =
      cell.thickness === 'thin' ? 0.82 :
      cell.thickness === 'thick' ? 1.28 :
      1;
    const level = Math.max(1, cell.level ?? 1);
    return Math.round(base * thickness * (1 + (level - 1) * 0.18) * militaryTierDefinition(this.militaryTier).wallHealthMultiplier);
  }

  private clearSiegeState(): void {
    this.clearWallCollapseEffects();
    for (const wall of this.wallStates.values()) {
      this.world.setWallBattleVisibility(wall.x, wall.y, true);
      this.layer.remove(wall.visual);
      this.clearSiegeVisualGroup(wall.visual);
    }

    for (const ladder of this.ladders.values()) {
      if (ladder.view) {
        this.layer.remove(ladder.view);
        this.clearSiegeVisualGroup(ladder.view);
      }
    }

    for (const runtime of this.units.values()) {
      this.clearCarrierLadder(runtime);
      runtime.assignedLadderId = undefined;
      runtime.activeLadderId = undefined;
      runtime.climbProgress = 0;
      if (runtime.surface === 'ladder') runtime.surface = 'ground';
    }

    this.wallStates.clear();
    this.breachedWalls.clear();
    this.ladders.clear();
    this.wallNodes.clear();
    this.siegePlan = null;
    this.ladderCounter = 0;
    this.navigation.invalidate();
  }

  private clearSiegeVisualGroup(group: THREE.Group): void {
    group.traverse((object) => {
      if (
        object instanceof THREE.Mesh &&
        object.geometry !== this.ladderRailGeometry &&
        object.geometry !== this.ladderRungGeometry &&
        !this.sharedGeometries.includes(object.geometry)
      ) {
        object.geometry.dispose();
      }
    });
    group.clear();
  }

  private refreshSiegePlan(force: boolean): void {
    if (this.mode !== 'running') return;

    const anchor = this.primaryGroundAttacker();
    if (!anchor) return;

    const exactPath = this.navigation.findPath(
      { x: anchor.gridX, y: anchor.gridY },
      this.capturePointGrid,
      false,
    );

    if (exactPath.length > 0) {
      const breachInPath = exactPath.find((point) =>
        this.breachedWalls.has(this.gridKey(point.x, point.y)),
      );
      const nextPlan: SiegePlan = breachInPath
        ? { mode: 'breach', wall: breachInPath }
        : { mode: 'entrance' };

      if (force || !this.sameSiegePlan(this.siegePlan, nextPlan)) {
        this.siegePlan = nextPlan;
        this.assignObjectivePaths(exactPath);
      }
      return;
    }

    const placed = Array.from(this.ladders.values())
      .filter((ladder) => ladder.status === 'placed')
      .sort(
        (a, b) =>
          this.gridDistance(a.base, { x: anchor.gridX, y: anchor.gridY }) -
          this.gridDistance(b.base, { x: anchor.gridX, y: anchor.gridY }),
      )[0];

    if (placed) {
      const nextPlan: SiegePlan = {
        mode: 'ladder',
        wall: placed.wall,
        base: placed.base,
        inside: placed.inside,
        ladderId: placed.id,
      };
      if (force || !this.sameSiegePlan(this.siegePlan, nextPlan)) {
        this.siegePlan = nextPlan;
        this.assignSiegePaths();
      }
      return;
    }

    const carrying = Array.from(this.ladders.values()).find(
      (ladder) => ladder.status === 'carrying',
    );
    if (carrying) {
      this.siegePlan = {
        mode: 'ladder',
        wall: carrying.wall,
        base: carrying.base,
        inside: carrying.inside,
        ladderId: carrying.id,
      };
      if (force) this.assignSiegePaths();
      return;
    }

    const ladderCandidate = this.selectLadderCandidate(anchor, false);
    if (ladderCandidate) {
      const ladder = this.createLadderAttack(ladderCandidate.wall, ladderCandidate.sides);
      if (ladder) {
        this.siegePlan = {
          mode: 'ladder',
          wall: ladder.wall,
          base: ladder.base,
          inside: ladder.inside,
          ladderId: ladder.id,
        };
        this.assignSiegePaths();
        return;
      }
    }

    const breachCandidate = this.selectBreachCandidate(anchor);
    if (breachCandidate) {
      const nextPlan: SiegePlan = {
        mode: 'breach',
        wall: { x: breachCandidate.wall.x, y: breachCandidate.wall.y },
        base: breachCandidate.sides.base,
        inside: breachCandidate.sides.inside,
      };
      if (force || !this.sameSiegePlan(this.siegePlan, nextPlan)) {
        this.siegePlan = nextPlan;
        this.assignSiegePaths();
      }
    }
  }

  private primaryGroundAttacker(): UnitRuntime | undefined {
    return Array.from(this.units.values()).find(
      (runtime) =>
        runtime.data.faction === 'attacker' &&
        runtime.data.state !== 'dead' &&
        runtime.surface === 'ground',
    );
  }

  private sameSiegePlan(a: SiegePlan | null, b: SiegePlan): boolean {
    if (!a || a.mode !== b.mode) return false;
    if (a.ladderId !== b.ladderId) return false;
    if ((a.wall?.x ?? -1) !== (b.wall?.x ?? -1)) return false;
    if ((a.wall?.y ?? -1) !== (b.wall?.y ?? -1)) return false;
    return true;
  }

  private assignObjectivePaths(sharedPath?: NavPoint[]): void {
    for (const runtime of this.units.values()) {
      if (
        runtime.data.faction !== 'attacker' ||
        runtime.data.state === 'dead' ||
        runtime.surface !== 'ground' ||
        runtime.assignedLadderId
      ) {
        continue;
      }

      const path =
        sharedPath &&
        runtime.gridX === sharedPath[0]?.x &&
        runtime.gridY === sharedPath[0]?.y
          ? sharedPath
          : this.navigation.findPath(
              { x: runtime.gridX, y: runtime.gridY },
              this.capturePointGrid,
              false,
            );

      runtime.path =
        path.length > 0
          ? path
          : this.navigation.findPath(
              { x: runtime.gridX, y: runtime.gridY },
              this.capturePointGrid,
              true,
            );
      runtime.pathIndex = Math.min(1, Math.max(0, runtime.path.length - 1));
    }
  }

  private assignSiegePaths(): void {
    if (!this.siegePlan) return;

    for (const runtime of this.units.values()) {
      if (
        runtime.data.faction !== 'attacker' ||
        runtime.data.state === 'dead' ||
        runtime.surface !== 'ground'
      ) {
        continue;
      }

      let target: NavPoint | undefined;

      if (runtime.assignedLadderId) {
        target = this.ladders.get(runtime.assignedLadderId)?.base;
      } else if (this.siegePlan.mode === 'ladder') {
        const ladder = this.nearestLadderFor(runtime, true);
        target = ladder?.base ?? this.siegePlan.base;
      } else if (this.siegePlan.mode === 'breach') {
        target = this.siegePlan.base;
      }

      if (!target) continue;

      runtime.path = this.navigation.findPath(
        { x: runtime.gridX, y: runtime.gridY },
        target,
        true,
      );
      runtime.pathIndex = Math.min(1, Math.max(0, runtime.path.length - 1));
    }
  }

  private selectLadderCandidate(
    anchor: UnitRuntime,
    avoidExisting: boolean,
  ): { wall: WallBattleState; sides: WallSides; score: number } | null {
    let best: { wall: WallBattleState; sides: WallSides; score: number } | null = null;
    const anchorPoint = { x: anchor.gridX, y: anchor.gridY };

    for (const wall of this.wallStates.values()) {
      if (wall.stage === 'breached') continue;
      if (wall.cell.walkway !== true) continue;

      if (
        avoidExisting &&
        Array.from(this.ladders.values()).some(
          (ladder) => this.gridDistance(ladder.wall, { x: wall.x, y: wall.y }) < 3.2,
        )
      ) {
        continue;
      }

      const sides = this.wallSides(wall.x, wall.y);
      if (!sides) continue;

      const path = this.navigation.findPath(anchorPoint, sides.base, false);
      if (path.length === 0) continue;

      const topY =
        this.world.elevationAt(wall.x, wall.y) +
        this.world.fortificationTopAt(wall.x, wall.y, wall.cell) +
        0.22;
      const groundY = 2.22 + this.world.elevationAt(sides.base.x, sides.base.y);
      const rise = topY - groundY;
      if (rise < 3.2 || rise > 13.5) continue;

      const slope = Math.abs(
        this.world.elevationAt(wall.x, wall.y) -
        this.world.elevationAt(sides.base.x, sides.base.y),
      );
      if (slope > 2.2) continue;

      const nearbyDefenders = this.defendersNearGrid(wall.x, wall.y, 2.4);
      const score =
        path.length +
        rise * 0.32 +
        nearbyDefenders * 1.75 +
        Math.max(0, (wall.cell.level ?? 1) - 2) * 1.4;

      if (!best || score < best.score) {
        best = { wall, sides, score };
      }
    }

    return best;
  }

  private selectBreachCandidate(
    anchor: UnitRuntime,
  ): { wall: WallBattleState; sides: WallSides; score: number } | null {
    let best: { wall: WallBattleState; sides: WallSides; score: number } | null = null;
    const anchorPoint = { x: anchor.gridX, y: anchor.gridY };

    for (const wall of this.wallStates.values()) {
      if (wall.stage === 'breached') continue;

      const sides = this.wallSides(wall.x, wall.y);
      if (!sides) continue;

      const path = this.navigation.findPath(anchorPoint, sides.base, false);
      if (path.length === 0) continue;

      const insidePath = this.navigation.findPath(
        sides.inside,
        this.capturePointGrid,
        true,
      );
      if (insidePath.length === 0) continue;

      const nearbyDefenders = this.defendersNearGrid(wall.x, wall.y, 2.2);
      const healthFactor = wall.maxHealth / 520;
      const score =
        path.length +
        healthFactor * 2.2 +
        nearbyDefenders * 1.35 +
        Math.max(0, (wall.cell.level ?? 1) - 1) * 1.1;

      if (!best || score < best.score) {
        best = { wall, sides, score };
      }
    }

    return best;
  }

  private wallSides(x: number, y: number): WallSides | null {
    const candidates = [
      { x: x + 1, y },
      { x: x - 1, y },
      { x, y: y + 1 },
      { x, y: y - 1 },
    ].filter((point) => this.navigation.isGroundWalkable(point.x, point.y));

    if (candidates.length < 2) return null;

    candidates.sort(
      (a, b) =>
        this.gridDistance(a, this.objectiveGrid) -
        this.gridDistance(b, this.objectiveGrid),
    );

    const inside = candidates[0];
    const base = candidates[candidates.length - 1];
    if (inside.x === base.x && inside.y === base.y) return null;
    return { base, inside };
  }

  private defendersNearGrid(x: number, y: number, radiusCells: number): number {
    const center = this.world.gridToWorld(x, y);
    const radius = radiusCells * this.world.tileSize;
    let count = 0;

    for (const runtime of this.units.values()) {
      if (
        runtime.data.faction !== 'defender' ||
        runtime.data.state === 'dead'
      ) {
        continue;
      }

      if (
        Math.hypot(
          runtime.position.x - center.x,
          runtime.position.z - center.z,
        ) <= radius
      ) {
        count += 1;
      }
    }

    return count;
  }

  private createLadderAttack(
    wall: WallBattleState,
    sides: WallSides,
  ): SiegeLadder | null {
    const candidates = Array.from(this.units.values())
      .filter(
        (runtime) =>
          runtime.data.faction === 'attacker' &&
          runtime.data.state !== 'dead' &&
          runtime.surface === 'ground' &&
          !runtime.assignedLadderId,
      )
      .sort((a, b) => {
        const aSword = this.isMeleeUnit(a.data.unitType) ? 0 : 1;
        const bSword = this.isMeleeUnit(b.data.unitType) ? 0 : 1;
        if (aSword !== bSword) return aSword - bSword;
        return (
          this.gridDistance({ x: a.gridX, y: a.gridY }, sides.base) -
          this.gridDistance({ x: b.gridX, y: b.gridY }, sides.base)
        );
      });

    const carrier = candidates[0];
    if (!carrier) return null;

    const id = `siege-ladder-${++this.ladderCounter}`;
    const topY =
      this.world.elevationAt(wall.x, wall.y) +
      this.world.fortificationTopAt(wall.x, wall.y, wall.cell) +
      0.18;

    const ladder: SiegeLadder = {
      id,
      wall: { x: wall.x, y: wall.y },
      base: { ...sides.base },
      inside: { ...sides.inside },
      topY,
      status: 'carrying',
      carrierId: carrier.data.id,
    };

    this.ladders.set(id, ladder);
    carrier.assignedLadderId = id;
    this.attachCarrierLadder(carrier);

    carrier.path = this.navigation.findPath(
      { x: carrier.gridX, y: carrier.gridY },
      ladder.base,
      true,
    );
    carrier.pathIndex = Math.min(1, Math.max(0, carrier.path.length - 1));
    return ladder;
  }

  private ensureAdditionalLadder(): void {
    if (this.mode !== 'running' || this.siegePlan?.mode !== 'ladder') return;

    const attackers = this.countAlive('attacker');
    const desired = Math.min(3, Math.max(1, Math.ceil(attackers / 22)));
    if (this.ladders.size >= desired) return;

    const anchor = this.primaryGroundAttacker();
    if (!anchor) return;
    const candidate = this.selectLadderCandidate(anchor, true);
    if (!candidate) return;

    const ladder = this.createLadderAttack(candidate.wall, candidate.sides);
    if (ladder) this.assignSiegePaths();
  }

  private attachCarrierLadder(runtime: UnitRuntime): void {
    if (runtime.view.userData.siegeCarrierLadder) return;

    const ladder = new THREE.Group();
    ladder.name = 'carried-siege-ladder';
    ladder.rotation.z = Math.PI / 2;
    ladder.rotation.y = 0.26;
    ladder.position.set(0, 0.95, 0.24);

    for (const x of [-0.22, 0.22]) {
      const rail = new THREE.Mesh(this.ladderRailGeometry, this.ladderWoodMaterial);
      rail.scale.y = 1.55;
      rail.position.x = x;
      ladder.add(rail);
    }

    for (let i = 0; i < 5; i += 1) {
      const rung = new THREE.Mesh(this.ladderRungGeometry, this.ladderWoodMaterial);
      rung.rotation.z = Math.PI / 2;
      rung.scale.y = 0.48;
      rung.position.y = -0.62 + i * 0.31;
      ladder.add(rung);
    }

    runtime.view.userData.siegeCarrierLadder = ladder;
    runtime.view.add(ladder);
  }

  private clearCarrierLadder(runtime: UnitRuntime): void {
    const ladder = runtime.view.userData.siegeCarrierLadder as THREE.Group | undefined;
    if (!ladder) return;
    runtime.view.remove(ladder);
    delete runtime.view.userData.siegeCarrierLadder;
  }

  private updateSiegeGroundAttacker(runtime: UnitRuntime, delta: number): boolean {
    if (runtime.assignedLadderId) {
      const assigned = this.ladders.get(runtime.assignedLadderId);
      if (assigned && assigned.status === 'carrying') {
        if (runtime.path.length > 0 && runtime.pathIndex < runtime.path.length) {
          this.followGroundPath(runtime, delta, 'moving');
          return true;
        }

        const baseWorld = this.world.gridToWorld(assigned.base.x, assigned.base.y);
        const base = new THREE.Vector3(
          baseWorld.x,
          2.22 + this.world.elevationAt(assigned.base.x, assigned.base.y),
          baseWorld.z,
        );

        if (this.moveTowardPoint(runtime, base, delta, 0.58)) {
          this.placeLadder(assigned, runtime);
        }
        runtime.data.state = 'moving';
        return true;
      }

      runtime.assignedLadderId = undefined;
      this.clearCarrierLadder(runtime);
    }

    const placedLadder = this.nearestLadderFor(runtime, false);
    if (this.siegePlan?.mode === 'ladder' && placedLadder) {
      if (runtime.path.length > 0 && runtime.pathIndex < runtime.path.length) {
        this.followGroundPath(runtime, delta, 'moving');
        return true;
      }

      const baseWorld = this.world.gridToWorld(
        placedLadder.base.x,
        placedLadder.base.y,
      );
      const distance = Math.hypot(
        runtime.position.x - baseWorld.x,
        runtime.position.z - baseWorld.z,
      );

      if (distance <= 1.3) {
        if (!this.tryBeginLadderClimb(runtime, placedLadder)) {
          this.holdAtLadderQueue(runtime, placedLadder, delta);
        }
      } else {
        runtime.path = this.navigation.findPath(
          { x: runtime.gridX, y: runtime.gridY },
          placedLadder.base,
          true,
        );
        runtime.pathIndex = Math.min(1, Math.max(0, runtime.path.length - 1));
        this.followGroundPath(runtime, delta, 'moving');
      }
      return true;
    }

    if (
      this.siegePlan?.mode === 'ladder' &&
      this.siegePlan.base
    ) {
      const stageWorld = this.world.gridToWorld(
        this.siegePlan.base.x,
        this.siegePlan.base.y,
      );
      const wait = new THREE.Vector3(
        stageWorld.x,
        2.22 + this.world.elevationAt(this.siegePlan.base.x, this.siegePlan.base.y),
        stageWorld.z,
      );
      const slot = Math.abs(this.hashString(runtime.data.id)) % 6;
      wait.x += ((slot % 3) - 1) * 0.82;
      wait.z += (Math.floor(slot / 3) + 1) * 0.72;
      this.moveTowardPoint(runtime, wait, delta, 0.36);
      runtime.data.state = 'moving';
      return true;
    }

    if (
      this.siegePlan?.mode === 'breach' &&
      this.siegePlan.wall &&
      this.siegePlan.base
    ) {
      const wall = this.wallStates.get(
        this.gridKey(this.siegePlan.wall.x, this.siegePlan.wall.y),
      );

      if (!wall || wall.stage === 'breached') return false;

      const baseWorld = this.world.gridToWorld(
        this.siegePlan.base.x,
        this.siegePlan.base.y,
      );
      const base = new THREE.Vector3(
        baseWorld.x,
        2.22 + this.world.elevationAt(this.siegePlan.base.x, this.siegePlan.base.y),
        baseWorld.z,
      );

      if (this.isRangedUnit(runtime.data.unitType)) {
        const wallWorld = this.world.gridToWorld(wall.x, wall.y);
        const away = new THREE.Vector3(
          base.x - wallWorld.x,
          0,
          base.z - wallWorld.z,
        ).normalize();
        const support = base.clone().addScaledVector(away, 3.2);
        this.moveTowardPoint(runtime, support, delta, 0.55);
        runtime.data.state = 'guarding';
        return true;
      }

      if (runtime.path.length > 0 && runtime.pathIndex < runtime.path.length) {
        this.followGroundPath(runtime, delta, 'moving');
        return true;
      }

      const wallWorld = this.world.gridToWorld(wall.x, wall.y);
      const towardBase = new THREE.Vector3(
        base.x - wallWorld.x,
        0,
        base.z - wallWorld.z,
      ).normalize();
      const attackPoint = new THREE.Vector3(
        wallWorld.x,
        2.22 + this.world.elevationAt(this.siegePlan.base.x, this.siegePlan.base.y),
        wallWorld.z,
      ).addScaledVector(towardBase, 2.15);
      const distance = Math.hypot(
        runtime.position.x - attackPoint.x,
        runtime.position.z - attackPoint.z,
      );

      if (distance <= 0.95) {
        runtime.data.state = 'attacking';
        this.faceTarget(runtime, new THREE.Vector3(wallWorld.x, attackPoint.y, wallWorld.z));
        if (runtime.attackTimer <= 0) {
          runtime.attackTimer = runtime.stats.attackCooldown * 1.1;
          this.damageWall(wall, runtime.stats.attack * 1.45);
        }
      } else {
        this.moveTowardPoint(runtime, attackPoint, delta, 0.32);
        runtime.data.state = 'moving';
      }
      return true;
    }

    return false;
  }

  private nearestLadderFor(
    runtime: UnitRuntime,
    includeCarrying: boolean,
  ): SiegeLadder | undefined {
    const candidates = Array.from(this.ladders.values()).filter(
      (ladder) => includeCarrying || ladder.status === 'placed',
    );
    candidates.sort(
      (a, b) =>
        this.gridDistance({ x: runtime.gridX, y: runtime.gridY }, a.base) -
        this.gridDistance({ x: runtime.gridX, y: runtime.gridY }, b.base),
    );
    return candidates[0];
  }

  private placeLadder(ladder: SiegeLadder, carrier: UnitRuntime): void {
    ladder.status = 'placed';
    ladder.carrierId = undefined;
    carrier.assignedLadderId = undefined;
    this.clearCarrierLadder(carrier);

    const view = this.createPlacedLadderView(ladder);
    ladder.view = view;
    this.layer.add(view);

    this.siegePlan = {
      mode: 'ladder',
      wall: ladder.wall,
      base: ladder.base,
      inside: ladder.inside,
      ladderId: ladder.id,
    };
    this.assignSiegePaths();
  }

  private createPlacedLadderView(ladder: SiegeLadder): THREE.Group {
    const group = new THREE.Group();
    group.name = ladder.id;

    const baseWorld = this.world.gridToWorld(ladder.base.x, ladder.base.y);
    const wallWorld = this.world.gridToWorld(ladder.wall.x, ladder.wall.y);
    const bottom = new THREE.Vector3(
      baseWorld.x,
      2.24 + this.world.elevationAt(ladder.base.x, ladder.base.y),
      baseWorld.z,
    );
    const top = new THREE.Vector3(
      wallWorld.x,
      ladder.topY,
      wallWorld.z,
    );

    const horizontal = new THREE.Vector3(
      top.x - bottom.x,
      0,
      top.z - bottom.z,
    ).normalize();
    const perpendicular = new THREE.Vector3(-horizontal.z, 0, horizontal.x)
      .multiplyScalar(0.27);

    for (const side of [-1, 1]) {
      this.addLadderBeam(
        group,
        bottom.clone().addScaledVector(perpendicular, side),
        top.clone().addScaledVector(perpendicular, side),
        this.ladderRailGeometry,
      );
    }

    const rungCount = THREE.MathUtils.clamp(
      Math.round(bottom.distanceTo(top) / 0.72),
      7,
      22,
    );
    for (let i = 1; i < rungCount; i += 1) {
      const t = i / rungCount;
      const center = bottom.clone().lerp(top, t);
      this.addLadderBeam(
        group,
        center.clone().sub(perpendicular),
        center.clone().add(perpendicular),
        this.ladderRungGeometry,
      );
    }

    return group;
  }

  private addLadderBeam(
    group: THREE.Group,
    start: THREE.Vector3,
    end: THREE.Vector3,
    geometry: THREE.BufferGeometry,
  ): void {
    const direction = end.clone().sub(start);
    const length = direction.length();
    if (length <= 0.001) return;

    const beam = new THREE.Mesh(geometry, this.ladderWoodMaterial);
    beam.position.copy(start).add(end).multiplyScalar(0.5);
    beam.scale.y = length;
    beam.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction.normalize(),
    );
    beam.castShadow = true;
    group.add(beam);
  }

  private tryBeginLadderClimb(
    runtime: UnitRuntime,
    ladder: SiegeLadder,
  ): boolean {
    if (ladder.status !== 'placed' || ladder.climberId) return false;

    ladder.climberId = runtime.data.id;
    runtime.surface = 'ladder';
    runtime.activeLadderId = ladder.id;
    runtime.climbProgress = 0;
    runtime.data.targetId = undefined;
    runtime.data.state = 'moving';
    runtime.path = [];
    runtime.pathIndex = 0;
    return true;
  }

  private holdAtLadderQueue(
    runtime: UnitRuntime,
    ladder: SiegeLadder,
    delta: number,
  ): void {
    const base = this.world.gridToWorld(ladder.base.x, ladder.base.y);
    const wall = this.world.gridToWorld(ladder.wall.x, ladder.wall.y);
    const outward = new THREE.Vector3(
      base.x - wall.x,
      0,
      base.z - wall.z,
    ).normalize();
    const side = new THREE.Vector3(-outward.z, 0, outward.x);
    const slot = Math.abs(this.hashString(runtime.data.id)) % 8;
    const row = Math.floor(slot / 2) + 1;
    const lane = slot % 2 === 0 ? -1 : 1;
    const target = new THREE.Vector3(
      base.x,
      2.22 + this.world.elevationAt(ladder.base.x, ladder.base.y),
      base.z,
    )
      .addScaledVector(outward, row * 0.68)
      .addScaledVector(side, lane * 0.42);

    this.moveTowardPoint(runtime, target, delta, 0.25);
    runtime.data.state = 'guarding';
  }

  private updateLadderClimb(runtime: UnitRuntime, delta: number): void {
    const ladder = runtime.activeLadderId
      ? this.ladders.get(runtime.activeLadderId)
      : undefined;

    if (!ladder || ladder.status !== 'placed') {
      runtime.surface = 'ground';
      runtime.activeLadderId = undefined;
      return;
    }

    const baseWorld = this.world.gridToWorld(ladder.base.x, ladder.base.y);
    const wallWorld = this.world.gridToWorld(ladder.wall.x, ladder.wall.y);
    const bottom = new THREE.Vector3(
      baseWorld.x,
      2.24 + this.world.elevationAt(ladder.base.x, ladder.base.y),
      baseWorld.z,
    );
    const top = new THREE.Vector3(wallWorld.x, ladder.topY, wallWorld.z);
    const length = Math.max(1, bottom.distanceTo(top));

    runtime.climbProgress = Math.min(
      1,
      runtime.climbProgress + delta * (runtime.stats.moveSpeed * 0.72) / length,
    );
    runtime.position.copy(bottom).lerp(top, runtime.climbProgress);
    this.rotateUnitToward(
      runtime,
      Math.atan2(wallWorld.x - baseWorld.x, wallWorld.z - baseWorld.z),
      delta,
      8,
    );
    runtime.data.state = 'moving';

    if (runtime.climbProgress < 1) return;

    ladder.climberId = undefined;
    runtime.surface = 'wall';
    runtime.gridX = ladder.wall.x;
    runtime.gridY = ladder.wall.y;
    runtime.position.copy(top);
    runtime.activeLadderId = ladder.id;
    runtime.climbProgress = 0;
    runtime.wallSeconds = 0;
    runtime.data.state = 'guarding';
  }

  private updateWallSurfaceUnit(runtime: UnitRuntime, delta: number): void {
    runtime.wallSeconds += delta;

    if (runtime.data.faction === 'defender') {
      runtime.data.state = 'guarding';
      return;
    }

    const node = this.wallNodes.get(this.gridKey(runtime.gridX, runtime.gridY));
    if (node) {
      const neighbors = this.navigation.connectedWallNeighbors(node, this.wallNodes);
      if (neighbors.length > 0) {
        neighbors.sort(
          (a, b) =>
            this.gridDistance(a, this.objectiveGrid) -
            this.gridDistance(b, this.objectiveGrid),
        );
        const next = neighbors[0];

        if (
          this.gridDistance(next, this.objectiveGrid) + 0.1 <
          this.gridDistance(node, this.objectiveGrid)
        ) {
          const world = this.world.gridToWorld(next.x, next.y);
          const target = new THREE.Vector3(world.x, next.worldY, world.z);
          if (this.moveTowardWallPoint(runtime, target, delta, 0.28)) {
            runtime.gridX = next.x;
            runtime.gridY = next.y;
            runtime.position.y = next.worldY;
          }
          runtime.data.state = 'moving';
          return;
        }
      }
    }

    if (runtime.wallSeconds >= 2.6) {
      const inside = this.findInteriorGroundFromWall(runtime.gridX, runtime.gridY);
      if (inside) {
        const world = this.world.gridToWorld(inside.x, inside.y);
        runtime.surface = 'ground';
        runtime.gridX = inside.x;
        runtime.gridY = inside.y;
        runtime.position.set(
          world.x,
          2.22 + this.world.elevationAt(inside.x, inside.y),
          world.z,
        );
        runtime.path = this.navigation.findPath(
          inside,
          this.capturePointGrid,
          true,
        );
        runtime.pathIndex = Math.min(1, Math.max(0, runtime.path.length - 1));
        runtime.data.state = 'moving';
        return;
      }
    }

    runtime.data.state = 'guarding';
  }

  private moveAlongWallToward(
    runtime: UnitRuntime,
    targetUnit: UnitRuntime,
    delta: number,
  ): void {
    const node = this.wallNodes.get(this.gridKey(runtime.gridX, runtime.gridY));
    if (!node) return;

    const targetNode = this.wallNodes.get(
      this.gridKey(targetUnit.gridX, targetUnit.gridY),
    );
    if (!targetNode) return;

    const neighbors = this.navigation.connectedWallNeighbors(node, this.wallNodes);
    if (neighbors.length === 0) return;

    neighbors.sort(
      (a, b) =>
        this.gridDistance(a, targetNode) -
        this.gridDistance(b, targetNode),
    );
    const next = neighbors[0];
    const world = this.world.gridToWorld(next.x, next.y);
    const target = new THREE.Vector3(world.x, next.worldY, world.z);

    if (this.moveTowardWallPoint(runtime, target, delta, 0.28)) {
      runtime.gridX = next.x;
      runtime.gridY = next.y;
      runtime.position.y = next.worldY;
    }
    runtime.data.state = 'moving';
  }

  private moveTowardWallPoint(
    runtime: UnitRuntime,
    target: THREE.Vector3,
    delta: number,
    stopDistance: number,
  ): boolean {
    const direction = target.clone().sub(runtime.position);
    const distance = direction.length();
    if (distance <= stopDistance) return true;

    direction.normalize();
    runtime.position.addScaledVector(
      direction,
      Math.min(distance - stopDistance, runtime.stats.moveSpeed * delta),
    );
    this.rotateUnitToward(runtime, Math.atan2(direction.x, direction.z), delta, 11);
    runtime.moving = true;
    return false;
  }

  private findInteriorGroundFromWall(x: number, y: number): NavPoint | null {
    const candidates = [
      { x: x + 1, y },
      { x: x - 1, y },
      { x, y: y + 1 },
      { x, y: y - 1 },
    ].filter((point) => this.navigation.isGroundWalkable(point.x, point.y));

    if (candidates.length === 0) return null;
    candidates.sort(
      (a, b) =>
        this.gridDistance(a, this.objectiveGrid) -
        this.gridDistance(b, this.objectiveGrid),
    );

    const candidate = candidates[0];
    if (
      this.gridDistance(candidate, this.objectiveGrid) >=
      this.gridDistance({ x, y }, this.objectiveGrid)
    ) {
      return null;
    }
    return candidate;
  }

  private damageWall(wall: WallBattleState, amount: number): void {
    if (wall.stage === 'breached') return;

    wall.health = Math.max(0, wall.health - amount);
    const ratio = wall.health / wall.maxHealth;
    const nextStage: WallDamageStage =
      wall.health <= 0
        ? 'breached'
        : ratio <= 0.14
          ? 'partial'
          : ratio <= 0.38
            ? 'heavy'
            : ratio <= 0.7
              ? 'damaged'
              : 'healthy';

    if (nextStage !== wall.stage) {
      wall.stage = nextStage;
      this.renderWallDamage(wall);
      this.spawnWallDestructionBurst(wall, nextStage);
    }

    wall.battleDamage = THREE.MathUtils.clamp(
      1 - wall.initialPersistentDamage - wall.health / wall.maxHealth,
      0,
      1 - wall.initialPersistentDamage,
    );
    this.world.onWallDamage?.(wall.x, wall.y, Math.min(1, wall.initialPersistentDamage + wall.battleDamage));
    if (this.preserveSessionWallDamage && !this.world.onWallDamage) {
      if (wall.battleDamage > 0) {
        this.sessionWallDamage.set(this.gridKey(wall.x, wall.y), wall.battleDamage);
      } else {
        this.sessionWallDamage.delete(this.gridKey(wall.x, wall.y));
      }
    }

    if (nextStage !== 'breached') return;

    this.breachedWalls.add(this.gridKey(wall.x, wall.y));
    this.wallNodes.delete(this.gridKey(wall.x, wall.y));
    this.world.setWallBattleVisibility(wall.x, wall.y, false);
    this.navigation.invalidate();
    this.objectiveSystem.emit({ type: 'WALL_BREACHED', entityId: this.gridKey(wall.x, wall.y) });
    this.reactDefendersToBreach(wall);
    this.refreshSiegePlan(true);
  }

  private wallFxNoise(wall: WallBattleState, salt: number): number {
    const value = Math.sin(
      wall.x * 91.713 +
      wall.y * 47.337 +
      wall.cell.kind.length * 13.17 +
      salt * 19.19,
    ) * 43758.5453;
    return value - Math.floor(value);
  }

  private wallDamageRotation(cell: GridCell): number {
    const links = cell.wallLinks ?? [];
    const horizontal = links.includes('E') || links.includes('W');
    const vertical = links.includes('N') || links.includes('S');
    if (vertical && !horizontal) return Math.PI / 2;
    if (horizontal && !vertical) return 0;
    return ((cell.rotation ?? 0) % 2) * Math.PI / 2;
  }

  private addStaticWallChunk(
    parent: THREE.Group,
    wall: WallBattleState,
    index: number,
    position: THREE.Vector3,
    scale: THREE.Vector3,
    lightChance = 0.34,
  ): THREE.Mesh {
    const mesh = new THREE.Mesh(
      this.wallFxNoise(wall, index * 7 + 3) > 0.72 ? this.wallSlabGeometry : this.wallStoneGeometry,
      this.wallFxNoise(wall, index * 11 + 5) < lightChance
        ? this.rubbleLightMaterial
        : this.rubbleMaterial,
    );
    mesh.position.copy(position);
    mesh.scale.copy(scale);
    mesh.rotation.set(
      this.wallFxNoise(wall, index * 13 + 7) * 0.8 - 0.4,
      this.wallFxNoise(wall, index * 17 + 9) * Math.PI,
      this.wallFxNoise(wall, index * 19 + 11) * 0.9 - 0.45,
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  private addWallCrackNetwork(
    parent: THREE.Group,
    wall: WallBattleState,
    height: number,
    intensity: number,
  ): void {
    const segments = 5 + intensity * 5;
    const faceDepth = 1.12;
    for (let face = 0; face < 2; face += 1) {
      const z = (face === 0 ? -1 : 1) * faceDepth;
      for (let i = 0; i < segments; i += 1) {
        const seed = face * 100 + i;
        const branch = i % 4;
        const length = 0.42 + this.wallFxNoise(wall, seed + 1) * (0.6 + intensity * 0.13);
        const crack = new THREE.Mesh(
          new THREE.BoxGeometry(0.045 + (i % 3) * 0.012, length, 0.055),
          this.damageDarkMaterial,
        );
        crack.position.set(
          (this.wallFxNoise(wall, seed + 2) - 0.5) * (1.45 + intensity * 0.08),
          2.9 + this.wallFxNoise(wall, seed + 3) * Math.max(1.2, height - 3.2),
          z,
        );
        crack.rotation.z =
          (this.wallFxNoise(wall, seed + 4) - 0.5) * 1.15 +
          (branch === 0 ? 0.58 : branch === 1 ? -0.55 : 0);
        crack.rotation.x = (face === 0 ? 1 : -1) * 0.03;
        crack.renderOrder = 5;
        parent.add(crack);

        if (i % 3 === 0 && intensity >= 2) {
          const branchCrack = new THREE.Mesh(
            new THREE.BoxGeometry(0.038, length * 0.56, 0.052),
            this.damageDarkMaterial,
          );
          branchCrack.position.copy(crack.position);
          branchCrack.position.x += (this.wallFxNoise(wall, seed + 8) - 0.5) * 0.28;
          branchCrack.position.y -= length * 0.22;
          branchCrack.rotation.z = crack.rotation.z + (i % 2 === 0 ? 0.72 : -0.68);
          parent.add(branchCrack);
        }
      }
    }
  }

  private addBrokenWallRemnants(
    parent: THREE.Group,
    wall: WallBattleState,
    height: number,
  ): void {
    const stubHeight = Math.max(2.4, Math.min(height * 0.52, 4.8));
    const blockRows = Math.max(3, Math.round(stubHeight / 0.62));

    for (const side of [-1, 1]) {
      for (let row = 0; row < blockRows; row += 1) {
        const rowWidth = row >= blockRows - 2 ? 1 : 2;
        for (let col = 0; col < rowWidth; col += 1) {
          const index = (side + 1) * 100 + row * 7 + col;
          const inward = row >= blockRows - 2 ? 0.18 + row * 0.04 : 0;
          const x =
            side * (1.45 - inward) +
            (col - (rowWidth - 1) / 2) * 0.52 +
            (this.wallFxNoise(wall, index) - 0.5) * 0.16;
          const y =
            2.5 +
            row * 0.56 +
            (this.wallFxNoise(wall, index + 1) - 0.5) * 0.12;
          const z = (this.wallFxNoise(wall, index + 2) - 0.5) * 0.58;
          const block = new THREE.Mesh(
            this.wallSlabGeometry,
            row % 3 === 0 ? this.rubbleLightMaterial : this.rubbleMaterial,
          );
          block.position.set(x, y, z);
          block.scale.set(
            0.82 + this.wallFxNoise(wall, index + 3) * 0.28,
            0.8 + this.wallFxNoise(wall, index + 4) * 0.24,
            1.15 + this.wallFxNoise(wall, index + 5) * 0.36,
          );
          block.rotation.set(
            (this.wallFxNoise(wall, index + 6) - 0.5) * 0.12,
            (this.wallFxNoise(wall, index + 7) - 0.5) * 0.18,
            side * (0.025 + this.wallFxNoise(wall, index + 8) * 0.055),
          );
          block.castShadow = true;
          block.receiveShadow = true;
          parent.add(block);
        }
      }

      const exposedCore = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, stubHeight * 0.7, 1.28),
        this.exposedCoreMaterial,
      );
      exposedCore.position.set(side * 0.78, 2.55 + stubHeight * 0.33, 0);
      exposedCore.rotation.z = side * 0.09;
      parent.add(exposedCore);
    }

    for (let i = 0; i < 30; i += 1) {
      const angle = this.wallFxNoise(wall, 400 + i) * Math.PI * 2;
      const radius = 0.4 + this.wallFxNoise(wall, 500 + i) * 1.85;
      const large = i < 10;
      const position = new THREE.Vector3(
        Math.cos(angle) * radius,
        2.2 + this.wallFxNoise(wall, 600 + i) * (large ? 0.34 : 0.2),
        Math.sin(angle) * radius * 0.74,
      );
      const scale = large
        ? new THREE.Vector3(
            0.9 + this.wallFxNoise(wall, 700 + i) * 0.8,
            0.55 + this.wallFxNoise(wall, 710 + i) * 0.5,
            0.75 + this.wallFxNoise(wall, 720 + i) * 0.65,
          )
        : new THREE.Vector3(
            0.45 + this.wallFxNoise(wall, 730 + i) * 0.45,
            0.32 + this.wallFxNoise(wall, 740 + i) * 0.34,
            0.42 + this.wallFxNoise(wall, 750 + i) * 0.42,
          );
      this.addStaticWallChunk(parent, wall, 800 + i, position, scale);
    }

    for (let i = 0; i < 8; i += 1) {
      const slab = new THREE.Mesh(
        this.wallSlabGeometry,
        i % 3 === 0 ? this.rubbleLightMaterial : this.exposedCoreMaterial,
      );
      slab.position.set(
        -1.4 + (i % 4) * 0.9,
        2.31 + Math.floor(i / 4) * 0.13,
        -0.95 + (i % 3) * 0.92,
      );
      slab.scale.set(1.4 + (i % 2) * 0.45, 0.5, 1.05 + (i % 3) * 0.2);
      slab.rotation.set(0.12 * (i % 2), i * 0.58, (i % 2 ? -1 : 1) * 0.22);
      slab.castShadow = true;
      parent.add(slab);
    }
  }

  private addWallDamageSilhouetteCue(
    parent: THREE.Group,
    wall: WallBattleState,
    height: number,
    stage: WallDamageStage,
  ): void {
    if (stage === 'healthy' || stage === 'breached') return;

    const severity =
      stage === 'damaged' ? 1 :
      stage === 'heavy' ? 2 :
      3;
    const cue = WALL_DAMAGE_READABILITY[stage];
    parent.userData.damageReadability = cue;

    // A few displaced crest stones keep damage readable at normal/strategic zoom
    // without filling the parapet with noise.
    const chipCount = severity === 1 ? 3 : severity === 2 ? 5 : 7;
    const span = severity === 3 ? 2.45 : severity === 2 ? 1.75 : 1.15;
    for (let i = 0; i < chipCount; i += 1) {
      const t = i / (chipCount - 1);
      const x = (t - 0.5) * span;
      const dropped = severity >= 2 && i % 2 === 1;
      const chip = new THREE.Mesh(
        i % 3 === 0 ? this.wallSlabGeometry : this.wallChipGeometry,
        i % 4 === 0 ? this.exposedCoreMaterial : this.rubbleLightMaterial,
      );
      chip.position.set(
        x + (this.wallFxNoise(wall, 5100 + i) - 0.5) * 0.18,
        height + 0.18 - (dropped ? 0.72 + severity * 0.18 : 0.08 + severity * 0.08),
        (this.wallFxNoise(wall, 5200 + i) - 0.5) * 0.68,
      );
      chip.scale.set(
        0.75 + severity * 0.14,
        0.62 + (i % 2) * 0.18,
        0.72 + severity * 0.08,
      );
      chip.rotation.set(
        (this.wallFxNoise(wall, 5300 + i) - 0.5) * 0.55,
        this.wallFxNoise(wall, 5400 + i) * Math.PI,
        (this.wallFxNoise(wall, 5500 + i) - 0.5) * 0.8,
      );
      chip.castShadow = true;
      parent.add(chip);
    }

    if (severity >= 2) {
      const notchWidth = severity === 3 ? 2.5 : 1.55;
      const notchHeight = severity === 3 ? 1.95 : 1.18;
      for (const face of [-1, 1]) {
        const notch = new THREE.Mesh(
          new THREE.BoxGeometry(notchWidth, notchHeight, 0.13),
          this.damageDarkMaterial,
        );
        notch.position.set(
          severity === 3 ? -0.12 : 0.18,
          height - notchHeight * 0.28,
          face * 1.15,
        );
        notch.rotation.z = face * (severity === 3 ? 0.09 : -0.06);
        notch.renderOrder = 6;
        parent.add(notch);
      }
    }
  }

  private renderWallDamage(wall: WallBattleState): void {
    this.clearSiegeVisualGroup(wall.visual);
    if (wall.stage === 'healthy') return;

    const height = this.world.fortificationTopAt(wall.x, wall.y, wall.cell);
    const damageRoot = new THREE.Group();
    damageRoot.rotation.y = this.wallDamageRotation(wall.cell);
    damageRoot.userData.damageStage = wall.stage;
    damageRoot.userData.damageReadability = WALL_DAMAGE_READABILITY[wall.stage];
    wall.visual.userData.damageStage = wall.stage;
    wall.visual.add(damageRoot);

    const intensity =
      wall.stage === 'damaged' ? 1 :
      wall.stage === 'heavy' ? 2 :
      wall.stage === 'partial' ? 3 :
      4;

    if (wall.stage !== 'breached') {
      this.addWallCrackNetwork(damageRoot, wall, height, intensity);
      this.addWallDamageSilhouetteCue(damageRoot, wall, height, wall.stage);

      const scarCount = 3 + intensity * 3;
      for (let i = 0; i < scarCount; i += 1) {
        const face = i % 2 === 0 ? -1 : 1;
        const scar = new THREE.Mesh(
          new THREE.BoxGeometry(
            0.2 + this.wallFxNoise(wall, 900 + i) * 0.24,
            0.14 + this.wallFxNoise(wall, 920 + i) * 0.22,
            0.065,
          ),
          i % 3 === 0 ? this.exposedCoreMaterial : this.damageDarkMaterial,
        );
        scar.position.set(
          (this.wallFxNoise(wall, 940 + i) - 0.5) * 1.65,
          3 + this.wallFxNoise(wall, 960 + i) * Math.max(1.4, height - 3.5),
          face * 1.135,
        );
        scar.rotation.z = (this.wallFxNoise(wall, 980 + i) - 0.5) * 0.65;
        damageRoot.add(scar);
      }
    }

    if (wall.stage === 'heavy' || wall.stage === 'partial') {
      const partial = wall.stage === 'partial';
      const cavity = new THREE.Mesh(
        new THREE.BoxGeometry(partial ? 2.15 : 1.28, partial ? 2.5 : 1.55, 0.2),
        this.damageDarkMaterial,
      );
      cavity.position.set(
        partial ? -0.05 : 0.26,
        height - (partial ? 1.45 : 1.05),
        -1.18,
      );
      cavity.rotation.z = partial ? -0.08 : 0.1;
      damageRoot.add(cavity);

      const brokenEdgeCount = partial ? 15 : 8;
      for (let i = 0; i < brokenEdgeCount; i += 1) {
        const angle = (i / brokenEdgeCount) * Math.PI * 2;
        const radiusX = partial ? 1.22 : 0.78;
        const radiusY = partial ? 1.42 : 0.9;
        const edgeStone = new THREE.Mesh(
          this.wallChipGeometry,
          i % 4 === 0 ? this.exposedCoreMaterial : this.rubbleLightMaterial,
        );
        edgeStone.position.set(
          cavity.position.x + Math.cos(angle) * radiusX,
          cavity.position.y + Math.sin(angle) * radiusY,
          -1.23,
        );
        edgeStone.scale.set(
          0.8 + this.wallFxNoise(wall, 1100 + i) * 0.7,
          0.65 + this.wallFxNoise(wall, 1120 + i) * 0.8,
          0.5,
        );
        edgeStone.rotation.set(i * 0.17, i * 0.31, angle);
        damageRoot.add(edgeStone);
      }

      const rubbleCount = partial ? 18 : 9;
      for (let i = 0; i < rubbleCount; i += 1) {
        const position = new THREE.Vector3(
          -1.25 + this.wallFxNoise(wall, 1200 + i) * 2.5,
          2.22 + this.wallFxNoise(wall, 1220 + i) * 0.32,
          -1.2 + this.wallFxNoise(wall, 1240 + i) * 1.1,
        );
        const scale = new THREE.Vector3(
          0.45 + this.wallFxNoise(wall, 1260 + i) * 0.85,
          0.35 + this.wallFxNoise(wall, 1280 + i) * 0.45,
          0.45 + this.wallFxNoise(wall, 1300 + i) * 0.75,
        );
        this.addStaticWallChunk(damageRoot, wall, 1320 + i, position, scale);
      }

      if (partial) {
        for (let i = 0; i < 5; i += 1) {
          const fallen = new THREE.Mesh(
            this.wallSlabGeometry,
            i % 2 === 0 ? this.rubbleMaterial : this.rubbleLightMaterial,
          );
          fallen.position.set(
            -1.35 + i * 0.68,
            2.36 + (i % 2) * 0.12,
            0.45 + (i % 3) * 0.38,
          );
          fallen.scale.set(1.1 + (i % 2) * 0.35, 0.55, 0.8 + (i % 3) * 0.18);
          fallen.rotation.set(0.18, i * 0.64, (i % 2 ? -1 : 1) * 0.28);
          fallen.castShadow = true;
          damageRoot.add(fallen);
        }
      }
      return;
    }

    if (wall.stage === 'breached') {
      this.addBrokenWallRemnants(damageRoot, wall, height);
    }
  }

  private spawnWallDestructionBurst(wall: WallBattleState, stage: WallDamageStage): void {
    if (stage === 'healthy' || this.world.effectsEnabled?.() === false) return;

    const severity =
      stage === 'damaged' ? 1 :
      stage === 'heavy' ? 2 :
      stage === 'partial' ? 3 :
      4;
    const fragmentCount =
      stage === 'damaged' ? 8 :
      stage === 'heavy' ? 16 :
      stage === 'partial' ? 28 :
      52;
    const dustCount =
      stage === 'damaged' ? 3 :
      stage === 'heavy' ? 6 :
      stage === 'partial' ? 11 :
      20;
    const effect: WallCollapseEffect = {
      age: 0,
      lifetime: stage === 'breached' ? 4.2 : 2.4 + severity * 0.28,
      fragments: [],
      dust: [],
      shockwaves: [],
    };

    const rotation = this.wallDamageRotation(wall.cell);
    const origin = wall.visual.position.clone();
    const groundY = origin.y + 2.2;
    const height = this.world.fortificationTopAt(wall.x, wall.y, wall.cell);
    const burstHeight = THREE.MathUtils.clamp(height * (stage === 'breached' ? 0.58 : 0.48), 3.4, 7.4);

    for (let i = 0; i < fragmentCount; i += 1) {
      const big = stage === 'breached' && i < 16;
      const medium = i < Math.ceil(fragmentCount * 0.55);
      const geometry = big
        ? this.wallSlabGeometry
        : medium
          ? this.wallStoneGeometry
          : this.wallChipGeometry;
      const material =
        i % 5 === 0
          ? this.rubbleLightMaterial
          : i % 7 === 0
            ? this.exposedCoreMaterial
            : this.rubbleMaterial;
      const fragment = new THREE.Mesh(geometry, material);
      const local = new THREE.Vector3(
        (this.wallFxNoise(wall, 1500 + i) - 0.5) * (stage === 'breached' ? 2.4 : 1.5),
        2.55 + this.wallFxNoise(wall, 1600 + i) * burstHeight,
        (this.wallFxNoise(wall, 1700 + i) - 0.5) * 1.7,
      );
      local.applyAxisAngle(new THREE.Vector3(0, 1, 0), rotation);
      fragment.position.copy(origin).add(local);

      const outwardSign = this.wallFxNoise(wall, 1800 + i) < 0.5 ? -1 : 1;
      const velocityLocal = new THREE.Vector3(
        (this.wallFxNoise(wall, 1900 + i) - 0.5) * (2.3 + severity * 0.7),
        2.4 + this.wallFxNoise(wall, 2000 + i) * (2.4 + severity * 1.25),
        outwardSign * (1.4 + this.wallFxNoise(wall, 2100 + i) * (2 + severity * 0.9)),
      );
      velocityLocal.applyAxisAngle(new THREE.Vector3(0, 1, 0), rotation);

      const size =
        big ? 0.95 + this.wallFxNoise(wall, 2200 + i) * 1.15 :
        medium ? 0.62 + this.wallFxNoise(wall, 2300 + i) * 0.72 :
        0.4 + this.wallFxNoise(wall, 2400 + i) * 0.42;
      fragment.scale.set(
        size * (0.8 + this.wallFxNoise(wall, 2500 + i) * 0.45),
        size * (0.55 + this.wallFxNoise(wall, 2600 + i) * 0.5),
        size * (0.75 + this.wallFxNoise(wall, 2700 + i) * 0.5),
      );
      fragment.rotation.set(
        this.wallFxNoise(wall, 2800 + i) * Math.PI,
        this.wallFxNoise(wall, 2900 + i) * Math.PI,
        this.wallFxNoise(wall, 3000 + i) * Math.PI,
      );
      fragment.castShadow = big || medium;
      fragment.receiveShadow = true;
      this.layer.add(fragment);

      effect.fragments.push({
        view: fragment,
        velocity: velocityLocal,
        spin: new THREE.Vector3(
          (this.wallFxNoise(wall, 3100 + i) - 0.5) * (5 + severity),
          (this.wallFxNoise(wall, 3200 + i) - 0.5) * (6 + severity),
          (this.wallFxNoise(wall, 3300 + i) - 0.5) * (5 + severity),
        ),
        groundY,
        bounce: 0.22 + this.wallFxNoise(wall, 3400 + i) * 0.22,
        settled: false,
      });
    }

    for (let i = 0; i < dustCount; i += 1) {
      const dust = new THREE.Mesh(
        this.wallDustGeometry,
        i % 3 === 0 ? this.dustDarkMaterial : this.dustMaterial,
      );
      const local = new THREE.Vector3(
        (this.wallFxNoise(wall, 3500 + i) - 0.5) * (1.5 + severity * 0.45),
        2.45 + this.wallFxNoise(wall, 3600 + i) * (2.4 + severity * 0.6),
        (this.wallFxNoise(wall, 3700 + i) - 0.5) * (1.4 + severity * 0.55),
      );
      local.applyAxisAngle(new THREE.Vector3(0, 1, 0), rotation);
      dust.position.copy(origin).add(local);
      const baseScale = 0.45 + this.wallFxNoise(wall, 3800 + i) * 0.65;
      dust.scale.setScalar(baseScale);
      dust.renderOrder = 14;
      this.layer.add(dust);

      const drift = new THREE.Vector3(
        (this.wallFxNoise(wall, 3900 + i) - 0.5) * 0.9,
        0.42 + this.wallFxNoise(wall, 4000 + i) * 0.72,
        (this.wallFxNoise(wall, 4100 + i) - 0.5) * 0.9,
      );
      effect.dust.push({
        view: dust,
        velocity: drift,
        baseScale,
        growth: 1.7 + severity * 0.38 + this.wallFxNoise(wall, 4200 + i) * 1.3,
        lifetime: 0.9 + this.wallFxNoise(wall, 4300 + i) * (0.9 + severity * 0.18),
      });
    }

    if (stage === 'partial' || stage === 'breached') {
      const shockCount = stage === 'breached' ? 3 : 1;
      for (let i = 0; i < shockCount; i += 1) {
        const wave = new THREE.Mesh(this.wallShockwaveGeometry, this.collapseShockMaterial);
        wave.rotation.x = -Math.PI / 2;
        wave.position.set(origin.x, groundY + 0.05 + i * 0.015, origin.z);
        const baseScale = stage === 'breached' ? 1.4 + i * 0.45 : 0.9;
        wave.scale.setScalar(baseScale);
        wave.renderOrder = 12;
        this.layer.add(wave);
        effect.shockwaves.push({
          view: wave,
          baseScale,
          growth: stage === 'breached' ? 5.2 + i * 1.2 : 3.2,
          lifetime: stage === 'breached' ? 0.75 + i * 0.18 : 0.55,
          delay: i * 0.09,
        });
      }
    }

    this.wallCollapseEffects.push(effect);
    while (this.wallCollapseEffects.length > 6) {
      const oldest = this.wallCollapseEffects.shift();
      if (oldest) this.disposeWallCollapseEffect(oldest);
    }
  }

  private updateWallCollapseEffects(deltaMs: number): void {
    if (this.wallCollapseEffects.length === 0) return;
    if (this.world.effectsEnabled?.() === false) {
      this.clearWallCollapseEffects();
      return;
    }

    const delta = Math.min(0.05, Math.max(0, deltaMs) / 1000);
    for (let effectIndex = this.wallCollapseEffects.length - 1; effectIndex >= 0; effectIndex -= 1) {
      const effect = this.wallCollapseEffects[effectIndex];
      effect.age += delta;

      for (const fragment of effect.fragments) {
        if (fragment.settled) continue;
        fragment.velocity.y -= 10.8 * delta;
        fragment.view.position.addScaledVector(fragment.velocity, delta);
        fragment.view.rotation.x += fragment.spin.x * delta;
        fragment.view.rotation.y += fragment.spin.y * delta;
        fragment.view.rotation.z += fragment.spin.z * delta;

        if (fragment.view.position.y > fragment.groundY) continue;
        fragment.view.position.y = fragment.groundY;
        fragment.velocity.y = Math.abs(fragment.velocity.y) * fragment.bounce;
        fragment.velocity.x *= 0.58;
        fragment.velocity.z *= 0.58;
        fragment.spin.multiplyScalar(0.62);
        if (fragment.velocity.y < 0.55) {
          fragment.velocity.set(0, 0, 0);
          fragment.spin.set(0, 0, 0);
          fragment.settled = true;
        }
      }

      for (const dust of effect.dust) {
        const progress = THREE.MathUtils.clamp(effect.age / dust.lifetime, 0, 1);
        dust.view.position.addScaledVector(dust.velocity, delta);
        dust.velocity.y += delta * 0.08;
        const scale = dust.baseScale + dust.growth * Math.sin(progress * Math.PI * 0.72);
        dust.view.scale.setScalar(Math.max(0.05, scale));
        dust.view.visible = progress < 1;
      }

      for (const shock of effect.shockwaves) {
        const localAge = effect.age - shock.delay;
        if (localAge < 0) {
          shock.view.visible = false;
          continue;
        }
        shock.view.visible = localAge < shock.lifetime;
        if (!shock.view.visible) continue;
        const progress = THREE.MathUtils.clamp(localAge / shock.lifetime, 0, 1);
        shock.view.scale.setScalar(shock.baseScale + shock.growth * progress);
      }

      if (effect.age < effect.lifetime) continue;
      this.disposeWallCollapseEffect(effect);
      this.wallCollapseEffects.splice(effectIndex, 1);
    }
  }

  private disposeWallCollapseEffect(effect: WallCollapseEffect): void {
    for (const fragment of effect.fragments) this.layer.remove(fragment.view);
    for (const dust of effect.dust) this.layer.remove(dust.view);
    for (const shock of effect.shockwaves) this.layer.remove(shock.view);
  }

  private clearWallCollapseEffects(): void {
    for (const effect of this.wallCollapseEffects) this.disposeWallCollapseEffect(effect);
    this.wallCollapseEffects.length = 0;
  }

  private reactDefendersToBreach(wall: WallBattleState): void {
    const sides = this.wallSides(wall.x, wall.y);
    if (!sides) return;

    const breachWorld = this.world.gridToWorld(wall.x, wall.y);
    const responders = Array.from(this.units.values())
      .filter(
        (runtime) =>
          runtime.data.faction === 'defender' &&
          this.isMeleeUnit(runtime.data.unitType) &&
          runtime.data.state !== 'dead' &&
          runtime.surface === 'ground',
      )
      .sort(
        (a, b) =>
          Math.hypot(
            a.position.x - breachWorld.x,
            a.position.z - breachWorld.z,
          ) -
          Math.hypot(
            b.position.x - breachWorld.x,
            b.position.z - breachWorld.z,
          ),
      )
      .filter(
        (runtime) =>
          Math.hypot(
            runtime.position.x - breachWorld.x,
            runtime.position.z - breachWorld.z,
          ) <= this.world.tileSize * 4.4,
      )
      .slice(0, 5);

    const insideWorld = this.world.gridToWorld(sides.inside.x, sides.inside.y);

    responders.forEach((runtime, index) => {
      const lane = (index % 3) - 1;
      const row = Math.floor(index / 3);
      runtime.home.set(
        insideWorld.x + lane * 0.72,
        2.22 + this.world.elevationAt(sides.inside.x, sides.inside.y),
        insideWorld.z + row * 0.68,
      );
      runtime.path = this.navigation.findPath(
        { x: runtime.gridX, y: runtime.gridY },
        sides.inside,
        true,
      );
      runtime.pathIndex = Math.min(1, Math.max(0, runtime.path.length - 1));
      runtime.data.targetId = undefined;
      runtime.defenseRadius = Math.max(runtime.defenseRadius, 12);
    });
  }

  private gridDistance(a: NavPoint, b: NavPoint): number {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  private hashString(value: string): number {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
      hash = (hash * 31 + value.charCodeAt(i)) | 0;
    }
    return hash;
  }

  private applySeparation(
    runtime: UnitRuntime,
    delta: number,
    buckets: Map<string, UnitRuntime[]>,
  ): void {
    const push = new THREE.Vector3();
    const bucketSize = 2.4;
    const bx = Math.floor(runtime.position.x / bucketSize);
    const bz = Math.floor(runtime.position.z / bucketSize);
    const personalSpace = this.isMeleeUnit(runtime.data.unitType) ? 0.72 : 0.66;
    let neighbors = 0;

    for (let oz = -1; oz <= 1; oz += 1) {
      for (let ox = -1; ox <= 1; ox += 1) {
        const nearby = buckets.get(`${bx + ox},${bz + oz}`) ?? [];

        for (const other of nearby) {
          if (other === runtime || other.data.state === 'dead') continue;
          if (other.surface !== runtime.surface) continue;
          if (other.data.faction !== runtime.data.faction) continue;

          const dx = runtime.position.x - other.position.x;
          const dz = runtime.position.z - other.position.z;
          const distanceSq = dx * dx + dz * dz;
          if (distanceSq <= 0.0001 || distanceSq > personalSpace * personalSpace) continue;

          const distance = Math.sqrt(distanceSq);
          const pressure = (personalSpace - distance) / personalSpace;
          push.x += (dx / distance) * pressure;
          push.z += (dz / distance) * pressure;
          neighbors += 1;
        }
      }
    }

    if (push.lengthSq() > 0.0001) {
      const recoveryScale = runtime.recoveryTime > 0 ? 0.32 : 1;
      const strength = Math.min(0.92, 0.32 + neighbors * 0.08) * recoveryScale;
      push.normalize().multiplyScalar(delta * strength);
      runtime.position.add(push);
    }
  }

  private updateStuckRecovery(runtime: UnitRuntime, delta: number): void {
    if (runtime.surface !== 'ground' || runtime.data.state === 'dead') return;

    if (!runtime.moving) {
      runtime.stuckSeconds = Math.max(0, runtime.stuckSeconds - delta * 1.6);
      if (runtime.progressCheckTimer <= 0) {
        runtime.progressCheckTimer = 0.65;
        runtime.lastProgressPosition.copy(runtime.position);
      }
      return;
    }

    if (runtime.progressCheckTimer > 0) return;
    runtime.progressCheckTimer = 0.65;

    const progress = runtime.position.distanceTo(runtime.lastProgressPosition);
    runtime.lastProgressPosition.copy(runtime.position);

    if (progress >= 0.16) {
      runtime.stuckSeconds = 0;
      return;
    }

    runtime.stuckSeconds += 0.65;
    if (runtime.stuckSeconds < 1.25) return;

    runtime.stuckSeconds = 0;
    runtime.recoveryTime = 0.95;
    runtime.recoverySign *= -1;

    if (runtime.data.faction === 'attacker') {
      const start = { x: runtime.gridX, y: runtime.gridY };
      const siegeTarget =
        runtime.assignedLadderId
          ? this.ladders.get(runtime.assignedLadderId)?.base
          : this.siegePlan?.mode === 'ladder'
            ? this.nearestLadderFor(runtime, true)?.base ?? this.siegePlan.base
            : this.siegePlan?.mode === 'breach'
              ? this.siegePlan.base
              : undefined;
      const target =
        siegeTarget ??
        this.navigation.findNearestWalkable(this.capturePointGrid, 10) ??
        this.capturePointGrid;
      const path = this.navigation.findPath(start, target, true);
      if (path.length > 1) {
        runtime.path = path;
        runtime.pathIndex = 1;
      }
    } else {
      const sideStep = new THREE.Vector3(
        runtime.recoverySign * 0.75,
        0,
        -runtime.recoverySign * 0.55,
      );
      runtime.home.add(sideStep);
    }
  }

  private meleeApproachPoint(runtime: UnitRuntime, target: UnitRuntime): THREE.Vector3 {
    const targeters = Array.from(this.units.values())
      .filter(
        (unit) =>
          unit.data.state !== 'dead' &&
          this.isMeleeUnit(unit.data.unitType) &&
          unit.data.targetId === target.data.id,
      )
      .sort((a, b) => a.data.id.localeCompare(b.data.id));

    const slot = Math.max(0, targeters.findIndex((unit) => unit === runtime));
    const ring = Math.floor(slot / 8);
    const angle = ((slot % 8) / 8) * Math.PI * 2;
    const radius = ring === 0 ? 0.92 : 1.48 + (ring - 1) * 0.38;

    return new THREE.Vector3(
      target.position.x + Math.cos(angle) * radius,
      target.position.y,
      target.position.z + Math.sin(angle) * radius,
    );
  }

  private refreshTargets(): void {
    // Target acquisition represents strategic awareness, not direct attack
    // visibility. Do not filter hostile units by wall line-of-sight here;
    // ranged attacks apply physical occlusion separately.
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
        const chaseLimit =
          runtime.data.faction === 'attacker'
            ? this.isRangedUnit(runtime.data.unitType)
              ? 14.5
              : 7.2
            : runtime.defenseRadius;
        const threat = current.data.targetId === runtime.data.id;
        const insideDefenseArea =
          current.position.distanceTo(runtime.home) <= runtime.defenseRadius;

        if (
          distance <= chaseLimit &&
          (runtime.data.faction !== 'defender' || insideDefenseArea) &&
          (runtime.data.faction !== 'attacker' || threat || this.isDefenderOnAdvance(current, runtime))
        ) {
          if (runtime.data.faction === 'defender') {
            runtime.defenderBehavior =
              distance <= runtime.stats.attackRange ? 'attack' : 'chase';
          }
          continue;
        }
      }

      let best: UnitRuntime | undefined;
      let bestScore = Number.POSITIVE_INFINITY;

      for (const candidate of alive) {
        if (!this.relations.areHostile(runtime.data.faction, candidate.data.faction)) continue;

        const distance = runtime.position.distanceTo(candidate.position);
        if (distance > runtime.stats.scanRange) continue;

        if (
          runtime.data.faction === 'defender' &&
          candidate.position.distanceTo(runtime.home) > runtime.defenseRadius
        ) {
          continue;
        }

        if (
          this.isMeleeUnit(runtime.data.unitType) &&
          Math.abs(runtime.position.y - candidate.position.y) > 1.8
        ) {
          continue;
        }

        const immediateThreat = candidate.data.targetId === runtime.data.id;
        const focus = targetedCount.get(candidate.data.id) ?? 0;

        if (runtime.data.faction === 'attacker') {
          const defenderOnAdvance = this.isDefenderOnAdvance(candidate, runtime);
          const attackerObjectiveDistance = Math.hypot(
            runtime.position.x - this.objectiveWorld.x,
            runtime.position.z - this.objectiveWorld.z,
          );
          const defenderObjectiveDistance = Math.hypot(
            candidate.position.x - this.objectiveWorld.x,
            candidate.position.z - this.objectiveWorld.z,
          );

          if (
            !immediateThreat &&
            !defenderOnAdvance &&
            defenderObjectiveDistance > attackerObjectiveDistance + 4.5
          ) {
            continue;
          }

          if (
            this.isMeleeUnit(runtime.data.unitType) &&
            focus >= 8 &&
            !immediateThreat
          ) {
            continue;
          }

          const blockingBonus = defenderOnAdvance ? -3.2 : 0;
          const threatBonus = immediateThreat ? -4.5 : 0;
          const entranceBonus =
            candidate.position.distanceTo(this.objectiveWorld) < this.world.tileSize * 2.2
              ? -1.8
              : 0;
          const focusPenalty = focus * 1.15;
          const score =
            distance +
            focusPenalty +
            blockingBonus +
            threatBonus +
            entranceBonus +
            Math.max(0, defenderObjectiveDistance - attackerObjectiveDistance) * 0.18;

          if (score < bestScore) {
            bestScore = score;
            best = candidate;
          }
          continue;
        }

        const immediateThreatBonus = immediateThreat ? -2.2 : 0;
        const focusPenalty = focus * 0.72;
        const score = distance + focusPenalty + immediateThreatBonus;

        if (score < bestScore) {
          bestScore = score;
          best = candidate;
        }
      }

      runtime.data.targetId = best?.data.id;
      if (runtime.data.faction === 'defender') {
        runtime.defenderBehavior = best ? 'detect' : runtime.defenderBehavior;
      }
    }
  }

  private isDefenderOnAdvance(defender: UnitRuntime, attacker: UnitRuntime): boolean {
    const nextWaypoint = attacker.path[attacker.pathIndex];
    const waypointWorld = nextWaypoint
      ? this.world.gridToWorld(nextWaypoint.x, nextWaypoint.y)
      : { x: this.objectiveWorld.x, z: this.objectiveWorld.z };

    const toGoal = new THREE.Vector2(
      waypointWorld.x - attacker.position.x,
      waypointWorld.z - attacker.position.z,
    );
    const toDefender = new THREE.Vector2(
      defender.position.x - attacker.position.x,
      defender.position.z - attacker.position.z,
    );

    const goalLength = toGoal.length();
    const defenderDistance = toDefender.length();
    if (goalLength < 0.01 || defenderDistance < 0.01) return defenderDistance < 4.5;

    const alignment = toGoal.normalize().dot(toDefender.clone().normalize());
    const nearRoute = alignment > 0.46 && defenderDistance < Math.max(5.2, goalLength + 2);
    const guardingEntrance =
      defender.position.distanceTo(this.objectiveWorld) < this.world.tileSize * 2.4;

    return nearRoute || guardingEntrance;
  }

  private meleeAttack(attacker: UnitRuntime, target: UnitRuntime): void {
    attacker.attackTimer = attacker.stats.attackCooldown;
    attacker.attackProgress = 0;
    attacker.attackDuration = Math.max(0.24, Math.min(attacker.stats.attackCooldown * 0.46, 0.52));
    attacker.attackApplied = false;

    // Damage remains on the existing combat cadence; the visual attack begins here.
    this.applyDamage(target, attacker.stats.attack);
  }

  private fireArrow(attacker: UnitRuntime, target: UnitRuntime): void {
    if (!this.hasUnitAttackVisibility(attacker, target)) return;

    attacker.attackTimer = attacker.stats.attackCooldown;
    attacker.attackProgress = 0;
    attacker.attackDuration = Math.max(0.24, Math.min(attacker.stats.attackCooldown * 0.46, 0.52));
    attacker.attackApplied = true;

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
      damage: attacker.stats.attack,
      speed: attacker.data.unitType === 'crossbowman' ? 23 : 18,
      life: 3.2,
    });

    const refs = attacker.view.userData.visualRefs as UnitVisualRefs | undefined;
    if (refs) refs.weapon.rotation.y += 0.22;
  }

  private initializeWallWeapons(): void {
    this.wallWeapons = BattleSystem.wallWeaponPositions(
      this.world.size,
      (x, y) => this.world.cellAt(x, y),
    );
    this.wallWeaponTimers.clear();
    for (const weapon of this.wallWeapons) {
      this.wallWeaponTimers.set(this.gridKey(weapon.x, weapon.y), 0.25);
    }
  }

  private updateWallWeapons(delta: number): void {
    if (this.wallWeapons.length === 0) return;
    for (const weapon of this.wallWeapons) {
      const key = this.gridKey(weapon.x, weapon.y);
      const nextTimer = Math.max(0, (this.wallWeaponTimers.get(key) ?? 0) - delta);
      this.wallWeaponTimers.set(key, nextTimer);
      const wallState = this.wallStates.get(key);
      if (!wallState || wallState.stage === 'breached') continue;

      const cell = this.world.cellAt(weapon.x, weapon.y);
      if (!cell) continue;
      const base = this.world.gridToWorld(weapon.x, weapon.y);
      const topY = this.world.elevationAt(weapon.x, weapon.y) + this.world.fortificationTopAt(weapon.x, weapon.y, cell);
      const origin = new THREE.Vector3(base.x, topY + 0.3, base.z);

      let target: UnitRuntime | undefined;
      let bestDistance = Number.POSITIVE_INFINITY;
      for (const candidate of this.units.values()) {
        if (candidate.data.faction !== 'attacker' || candidate.data.state === 'dead') continue;
        const distance = Math.hypot(candidate.position.x - origin.x, candidate.position.z - origin.z);
        const tier = militaryTierDefinition(this.militaryTier);
        if (distance > weapon.range * tier.weaponRangeMultiplier * this.world.tileSize) continue;
        const targetPoint = candidate.position.clone();
        targetPoint.y += 0.72;
        if (!this.hasDirectAttackVisibility(origin, targetPoint)) continue;
        if (distance < bestDistance) { bestDistance = distance; target = candidate; }
      }

      const visual = this.world.wallWeaponVisuals?.().find((object) => {
        const data = object.userData.wallWeapon as { gx?: number; gy?: number } | undefined;
        return data?.gx === weapon.x && data?.gy === weapon.y;
      });
      if (visual && target) {
        visual.rotation.y = Math.atan2(target.position.x - visual.position.x, target.position.z - visual.position.z);
      }

      if (!target || nextTimer > 0) continue;
      const tier = militaryTierDefinition(this.militaryTier);
      this.applyDamage(target, 18 * tier.weaponDamageMultiplier);
      this.wallWeaponTimers.set(key, 0.95 * tier.weaponCooldownMultiplier);

      if (this.world.effectsEnabled?.() !== false) {
        const flash = new THREE.Mesh(this.wallFlashGeometry, this.objectiveMaterial);
        flash.position.lerpVectors(origin, target.position, 0.18);
        this.addImpactEffect(flash, 55);
      }
    }
  }

  private applyDamage(target: UnitRuntime, amount: number): void {
    if (target.data.state === 'dead') return;

    // Preserve the existing damage pipeline while making the new Defense stat
    // the single mitigation point for unit damage. Higher Defense reduces
    // incoming damage without creating a second combat calculation system.
    const mitigation = 100 / (100 + Math.max(0, target.stats.defense));
    const effectiveDamage = Math.max(0, amount * mitigation);
    target.data.health = Math.max(0, target.data.health - effectiveDamage);
    target.hitReaction = Math.max(target.hitReaction, 0.18);
    if (target.data.health <= 0) this.killUnit(target);
  }

  private updateMissiles(delta: number): void {
    for (let index = this.missiles.length - 1; index >= 0; index -= 1) {
      const missile = this.missiles[index];
      const target = this.units.get(missile.targetId);
      if (target && target.data.faction === 'attacker' && target.data.state !== 'dead') {
        missile.targetPoint.copy(target.position);
        missile.targetPoint.y += 0.55;
      }

      missile.elapsed += delta;
      const progress = THREE.MathUtils.clamp(missile.elapsed / missile.duration, 0, 1);
      missile.view.position.lerpVectors(missile.start, missile.targetPoint, progress);
      missile.view.position.y += Math.sin(progress * Math.PI) * 9;
      missile.view.rotation.z = Math.atan2(
        missile.targetPoint.x - missile.view.position.x,
        Math.max(0.001, missile.targetPoint.y - missile.view.position.y),
      );

      if (progress < 1) continue;
      this.resolveMissileImpact(missile);
      this.missiles.splice(index, 1);
    }
  }

  private resolveMissileImpact(missile: MissileProjectile): void {
    const impact = missile.targetPoint.clone();

    for (const runtime of this.units.values()) {
      if (runtime.data.faction !== 'attacker' || runtime.data.state === 'dead') continue;
      const distance = Math.hypot(runtime.position.x - impact.x, runtime.position.z - impact.z);
      if (distance > missile.impactRadius) continue;
      const falloff = 1 - THREE.MathUtils.clamp(distance / missile.impactRadius, 0, 1);
      this.applyDamage(runtime, missile.damage * (0.45 + falloff * 0.55));
    }

    this.layer.remove(missile.view);
    if (this.world.effectsEnabled?.() !== false) {
      const blast = new THREE.Mesh(this.missileBlastGeometry, this.objectiveMaterial);
      blast.position.copy(impact);
      blast.position.y += 0.14;
      blast.rotation.x = -Math.PI / 2;
      blast.scale.setScalar(Math.max(0.8, missile.impactRadius * 0.4));
      this.addImpactEffect(blast, 180);
    }
    this.emitStatus();
  }

  private addImpactEffect(view: THREE.Mesh, remainingMs: number): void {
    this.layer.add(view);
    this.impactEffects.push({ view, remainingMs });
    if (this.impactEffects.length > 16) {
      const oldest = this.impactEffects.shift();
      if (oldest) this.layer.remove(oldest.view);
    }
  }

  private updateImpactEffects(deltaMs: number): void {
    const enabled = this.world.effectsEnabled?.() !== false;
    for (let index = this.impactEffects.length - 1; index >= 0; index -= 1) {
      const effect = this.impactEffects[index];
      effect.remainingMs -= Math.max(0, deltaMs);
      if (enabled && effect.remainingMs > 0) continue;
      this.layer.remove(effect.view);
      this.impactEffects.splice(index, 1);
    }
  }

  private clearMissiles(): void {
    for (const missile of this.missiles) this.layer.remove(missile.view);
    this.missiles.length = 0;
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

      // Projectiles do not home through a fortification if the target moves
      // behind an intact wall after the shot was released.
      if (!this.hasDirectAttackVisibility(arrow.view.position, targetPoint)) {
        this.layer.remove(arrow.view);
        this.arrows.splice(i, 1);
        continue;
      }

      const deltaVector = targetPoint.sub(arrow.view.position);
      const distance = deltaVector.length();

      if (distance <= 0.48) {
        this.applyDamage(target, arrow.damage);
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

    if (this.objectiveSystem.hasFailedPrimaryObjective()) {
      this.finishBattle('defender', 'objective_failed');
      return;
    }

    if (this.objectiveSystem.isVictorySatisfied()) {
      this.finishBattle('attacker', 'objective_completed');
      return;
    }

    if (
      attackersAlive === 0 &&
      this.attackerStartCount > 0 &&
      this.pendingAttackerSpawns.length === 0
    ) {
      this.finishBattle('defender', 'elimination');
      return;
    }

    if (this.captureSeconds >= this.captureRequiredSeconds) {
      this.finishBattle('attacker', 'capture');
      return;
    }

    if (this.attackerStartCount === 0 && this.defenderStartCount > 0) {
      this.finishBattle('defender', 'no_attackers');
    }
  }

  private finishBattle(winner: Faction, reason: BattleResult['reason'] = 'objective_completed'): void {
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
      reason,
      completedObjectives: this.objectiveSystem.getState().runtime.filter((objective) => objective.status === 'completed').map((objective) => objective.id),
      failedObjectives: this.objectiveSystem.getState().runtime.filter((objective) => objective.status === 'failed').map((objective) => objective.id),
    };

    this.objectiveSystem.stop();
    this.clearSiegeState();
    this.clearMissiles();
    for (const effect of this.impactEffects) this.layer.remove(effect.view);
    this.impactEffects.length = 0;
    this.emitStatus();
  }

  private killUnit(runtime: UnitRuntime): void {
    if (runtime.assignedLadderId) {
      const ladder = this.ladders.get(runtime.assignedLadderId);
      if (ladder?.status === 'carrying') this.ladders.delete(ladder.id);
      this.clearCarrierLadder(runtime);
      runtime.assignedLadderId = undefined;
      this.siegeDecisionTimer = 0;
    }

    if (runtime.activeLadderId) {
      const ladder = this.ladders.get(runtime.activeLadderId);
      if (ladder?.climberId === runtime.data.id) ladder.climberId = undefined;
    }

    runtime.data.health = 0;
    runtime.data.state = 'dead';
    runtime.data.targetId = undefined;
    this.objectiveSystem.emit({ type: 'UNIT_KILLED', entityId: runtime.data.id, faction: runtime.data.faction });
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

    runtime.hitReaction = Math.max(0, runtime.hitReaction - 1 / 60);

    if (runtime.data.state === 'dead') {
      const death = THREE.MathUtils.clamp(runtime.deathTime * 2.6, 0, 1);
      refs.leftLeg.rotation.x = 0.15 * death;
      refs.rightLeg.rotation.x = -0.12 * death;
      refs.leftArm.rotation.z = -0.8 * death;
      refs.rightArm.rotation.z = 0.8 * death;
      refs.body.position.y = 0.69 - 0.12 * death;
      return;
    }

    const locomotionSpeed = runtime.moving
      ? (runtime.stats.moveSpeed >= 3 ? 10.5 : 8.5)
      : 2.2;
    const stride = Math.sin(runtime.animTime * locomotionSpeed);
    const walkAmount = runtime.moving ? 0.52 : 0.035;

    refs.leftLeg.rotation.x = stride * walkAmount;
    refs.rightLeg.rotation.x = -stride * walkAmount;
    refs.body.position.y =
      0.69 + Math.abs(stride) * (runtime.moving ? 0.038 : 0.012);

    // Natural arm counter-swing while moving.
    refs.leftArm.rotation.x = -stride * (runtime.moving ? 0.34 : 0.025);
    refs.rightArm.rotation.x = stride * (runtime.moving ? 0.34 : 0.025);
    refs.leftArm.rotation.z = 0;
    refs.rightArm.rotation.z = 0;

    if (runtime.hitReaction > 0) {
      const hit = runtime.hitReaction / 0.18;
      refs.body.rotation.z = Math.sin(runtime.animTime * 32) * 0.045 * hit;
      refs.leftArm.rotation.x -= 0.28 * hit;
      refs.rightArm.rotation.x -= 0.18 * hit;
    } else {
      refs.body.rotation.z = THREE.MathUtils.lerp(refs.body.rotation.z, 0, 0.18);
    }

    const defending =
      runtime.data.state === 'guarding' &&
      this.isMeleeUnit(runtime.data.unitType) &&
      runtime.data.faction === 'defender';

    if (defending && refs.shield) {
      refs.shield.rotation.x = THREE.MathUtils.lerp(refs.shield.rotation.x, -0.28, 0.18);
      refs.leftArm.rotation.x -= 0.32;
    } else if (refs.shield) {
      refs.shield.rotation.x = THREE.MathUtils.lerp(refs.shield.rotation.x, 0, 0.18);
    }

    if (runtime.data.state === 'attacking') {
      runtime.attackProgress = Math.min(
        1,
        runtime.attackProgress + (1 / 60) / Math.max(0.12, runtime.attackDuration),
      );
      const p = runtime.attackProgress;
      const attackCurve = p < 0.42
        ? p / 0.42
        : 1 - (p - 0.42) / 0.58;
      const windup = THREE.MathUtils.clamp(attackCurve, 0, 1);

      refs.leftArm.rotation.x = -0.55 * windup;
      refs.rightArm.rotation.x = 0.7 * windup;

      if (runtime.data.unitType === 'swordsman') {
        refs.weapon.rotation.z = -0.34 - 1.35 * windup;
        if (refs.shield) refs.shield.rotation.x = -0.18 * windup;
      } else if (runtime.data.unitType === 'spearman') {
        refs.weapon.rotation.z = -0.22 - 0.95 * windup;
        if (refs.shield) refs.shield.rotation.x = -0.14 * windup;
      } else if (runtime.data.unitType === 'modernSoldier') {
        refs.weapon.rotation.z = -0.12 - 0.32 * windup;
        refs.weapon.rotation.x = -0.18 + 0.18 * windup;
        refs.rightArm.rotation.x = 0.38 * windup;
      } else if (runtime.data.unitType === 'crossbowman') {
        refs.weapon.rotation.z = -0.12 + 0.18 * windup;
        refs.weapon.rotation.x = -0.18 * windup;
        refs.rightArm.rotation.x = 0.5 * windup;
      } else {
        // Archer: draw/release gesture while the existing projectile system owns damage.
        refs.weapon.rotation.y = Math.PI / 2 + 0.34 * windup;
        refs.rightArm.rotation.x = 0.52 * windup;
        refs.leftArm.rotation.x = -0.38 * windup;
      }

      if (p >= 1) {
        runtime.data.state =
          runtime.data.targetId && runtime.attackTimer > 0 ? 'guarding' : 'moving';
        runtime.attackProgress = 1;
      }
    } else {
      if (runtime.data.unitType === 'swordsman') {
        refs.weapon.rotation.z = THREE.MathUtils.lerp(refs.weapon.rotation.z, -0.34, 0.2);
      } else if (runtime.data.unitType === 'spearman') {
        refs.weapon.rotation.z = THREE.MathUtils.lerp(refs.weapon.rotation.z, -0.22, 0.2);
      } else if (runtime.data.unitType === 'modernSoldier') {
        refs.weapon.rotation.z = THREE.MathUtils.lerp(refs.weapon.rotation.z, -0.12, 0.2);
        refs.weapon.rotation.x = THREE.MathUtils.lerp(refs.weapon.rotation.x, -0.18, 0.2);
      } else {
        refs.weapon.rotation.y = THREE.MathUtils.lerp(refs.weapon.rotation.y, Math.PI / 2, 0.2);
        refs.weapon.rotation.x = THREE.MathUtils.lerp(refs.weapon.rotation.x, 0, 0.2);
      }
    }

    if (
      this.mode === 'finished' &&
      this.finalResult?.winner === runtime.data.faction
    ) {
      runtime.victoryPhase += 0.045;
      const cheer = Math.max(0, Math.sin(runtime.victoryPhase));
      refs.leftArm.rotation.x -= cheer * 0.65;
      refs.rightArm.rotation.x -= cheer * 0.65;
      refs.body.position.y += cheer * 0.045;
    }
  }

  private faceTarget(runtime: UnitRuntime, target: THREE.Vector3): void {
    const dx = target.x - runtime.position.x;
    const dz = target.z - runtime.position.z;
    if (Math.abs(dx) + Math.abs(dz) < 0.001) return;
    this.rotateUnitToward(runtime, Math.atan2(dx, dz), 1 / 60, 12);
  }

  private rotateUnitToward(
    runtime: UnitRuntime,
    targetAngle: number,
    delta: number,
    turnRate: number,
  ): void {
    const current = runtime.view.rotation.y;
    let difference = targetAngle - current;
    while (difference > Math.PI) difference -= Math.PI * 2;
    while (difference < -Math.PI) difference += Math.PI * 2;
    const maxStep = turnRate * delta;
    runtime.view.rotation.y = current + THREE.MathUtils.clamp(difference, -maxStep, maxStep);
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

  private gridKey(x: number, y: number): string {
    return `${x},${y}`;
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

  private countDefendersByType(): BattleStatus['defenderAliveByType'] {
    const counts: BattleStatus['defenderAliveByType'] = {
      swordsman: 0,
      archer: 0,
      spearman: 0,
      crossbowman: 0,
      modernSoldier: 0,
    };
    for (const runtime of this.units.values()) {
      if (runtime.data.faction !== 'defender' || runtime.data.state === 'dead') continue;
      switch (runtime.data.unitType) {
        case 'swordsman':
          counts.swordsman += 1;
          break;
        case 'archer':
          counts.archer += 1;
          break;
        case 'spearman':
          counts.spearman += 1;
          break;
        case 'crossbowman':
          counts.crossbowman += 1;
          break;
        case 'modernSoldier':
          counts.modernSoldier += 1;
          break;
        default:
          break;
      }
    }
    return counts;
  }

  private createObjectiveContext(deltaSeconds: number) {
    const units = Array.from(this.units.values()).map((runtime) => ({
      id: runtime.data.id,
      faction: runtime.data.faction,
      unitType: runtime.data.unitType,
      health: runtime.data.health,
      maxHealth: runtime.data.maxHealth,
      state: runtime.data.state,
      x: runtime.position.x,
      y: runtime.position.y,
      z: runtime.position.z,
    }));
    const walls = Array.from(this.wallStates.values()).map((wall) => ({
      id: this.gridKey(wall.x, wall.y),
      health: wall.health,
      maxHealth: wall.maxHealth,
      breached: wall.stage === 'breached',
      x: wall.x,
      y: wall.y,
    }));
    const buildings = this.world.objectiveBuildings?.() ?? [];
    const positions = [
      ...(this.world.objectivePositions?.() ?? []),
      { id: 'castle-objective', x: this.objectiveWorld.x, y: this.objectiveWorld.y, z: this.objectiveWorld.z, controlledBy: this.captureSeconds >= this.captureRequiredSeconds ? 'attacker' as Faction : undefined },
    ];
    return {
      battleTime: this.battleSeconds,
      deltaSeconds,
      units,
      walls,
      buildings,
      positions,
      captureProgress: THREE.MathUtils.clamp(this.captureSeconds / this.captureRequiredSeconds, 0, 1),
      battleFinished: this.mode === 'finished',
    };
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
