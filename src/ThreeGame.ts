import * as THREE from 'three';
import { createUrbanCityTemplate } from './world/UrbanCityTemplate';
import { createTwinFortressesTemplate } from './world/TwinFortressesTemplate';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { TouchGestureSession } from './input/TouchGestureSession';
import { applyTouchCameraDelta } from './input/TouchCamera';
import { createGameDomainServices } from './core/GameDomainServices';
import { SaveSystem, type SaveStorage } from './core/SaveSystem';
import type { GameExtension } from './core/GameExtension';
import type { GameState } from './state/GameState';
import { SAVE_KEY, SAVE_VERSION, TILE_SIZE, WORLD_COLS } from './core/constants';
import { WallSystem } from './building/WallSystem';
import { CastleBlockSystem, MAX_WALL_LEVEL, castleDamageStage, castleHeightFor, type CastleBlockState } from './building/CastleBlockSystem';
import { ConstructionAnimationSystem } from './rendering/ConstructionAnimationSystem';
import { AmbientFaunaSystem } from './rendering/AmbientFaunaSystem';
import { rasterizeWallPath } from './building/WallPath';
import { KeepRenderer } from './rendering/KeepRenderer';
import { BasilicaRenderer } from './rendering/BasilicaRenderer';
import { CarpenterWorkshopRenderer } from './rendering/CarpenterWorkshopRenderer';
import { MedievalMaterials } from './rendering/MedievalMaterials';
import { CASTLE_ARCHITECTURE_STYLE } from './rendering/CastleArchitectureStyle';
import { WORLD_STYLE, styleTone } from './rendering/WorldStyle';
import { AmbientMotionSystem } from './rendering/AmbientMotionSystem';
import { EnvironmentSystem } from './systems/EnvironmentSystem';
import { DistanceDetailBudgetSystem } from './rendering/DistanceDetailBudget';
import { AdaptiveRenderProfile } from './rendering/AdaptiveRenderProfile';
import { PerformanceDebugOverlay } from './debug/PerformanceDebugOverlay';
import { instanceStaticCastleBoxes } from './rendering/StaticCastleBoxInstancing';
import {
  RESIDENCE_LAYOUTS,
  RESIDENCE_VISUAL_LEVELS,
  RESIDENCE_VISUAL_VARIANTS,
  SETTLEMENT_STYLE,
  settlementVariant,
  type ResidenceKind,
} from './rendering/SettlementStyle';
import { getTemplateVisualPreset } from './rendering/TemplateVisualStyle';
import { upgradeVisualProfile } from './rendering/UpgradeVisualLanguage';
import {
  GATEHOUSE_SILHOUETTE_PROFILE,
  WALL_SILHOUETTE_PROFILES,
  towerSilhouetteProfile,
} from './rendering/DefenseVisualLanguage';
import { BattleSystem } from './battle/BattleSystem';
import { MILITARY_TIERS, militaryTierDefinition, normalizeMilitaryTier, type MilitaryTier } from './battle/MilitaryProgression';
import {
  beginMissileProduction,
  MISSILE_CONFIG,
  missilesUnlocked,
  tickMissileState,
} from './battle/MissileCapability';
import type { BattleSetup, BattleStatus } from './battle/types';
import { endlessDefenseEnemyCount, getEndlessDefenseWave } from './battle/EndlessDefense';
import { MaritimeSystem } from './systems/MaritimeSystem';
import type { GameMode } from './core/GameMode';
import { GAME_DEFINITION, isBuildingAvailable, isToolAvailable } from './core/GameMode';
import type { SettingsStore } from './settings/SettingsStore';
import { resolveLocale, t } from './i18n/localization';
import { applyGraphicsSettings, applyInputSettings, applySceneGraphicsSettings } from './settings/SettingsSubsystems';
import { getStructureFootprint } from './building/StructureFootprints';
import { MAP_LAYOUTS, himejiLandBounds, normalizeMapLayoutId, terrainForMapLayout } from './world/MapLayouts';
import { AudioManager } from './audio/AudioManager';
import { audioEvents } from './audio/AudioEventBus';
import { registerSystemAction } from './app/applicationActions';
import { MissionSystem, type MissionSnapshot } from './missions/MissionSystem';
import { MissionUI } from './missions/MissionUI';
import {
  GodModeActionRegistry,
  createFutureGodModeAction,
  type GodModeActionContext,
  type GodModeExecutionResult,
  type GodModeTarget,
} from './godmode/GodModeSystem';
import type {
  EconomyResourceState,
  PopulationSimulationState,
  GridCell,
  HarborKind,
  KeepRoofStyle,
  MapLayoutId,
  RoadKind,
  ShipKind,
  StoneStyle,
  TowerBridgeKind,
  TowerBridgeState,
  KeepState,
  TerrainKind,
  TerrainOverrideKind,
  TerrainToolKind,
  TileKind,
  ToolKind,
  TowerShape,
  TowerTop,
  WallDirection,
  WallKind,
  WallThickness,
} from './core/types';

const SIZE = WORLD_COLS;
const TILE = TILE_SIZE;
const WORLD = SIZE * TILE;
const WALL_KINDS: WallKind[] = ['wall1', 'wall2', 'wall3'];
const ROAD_KINDS: RoadKind[] = ['road', 'dirtRoad', 'stoneRoad'];
const HARBOR_KINDS: HarborKind[] = ['harbor'];
const PLAYABLE_LAYOUT_TEMPLATES: Readonly<Record<string, { layoutId: MapLayoutId; seed: number }>> = {
  'urban-city-60x80': { layoutId: 'urban-60x80', seed: 6001 },
  'twin-fortresses-90x95': { layoutId: 'twin-fortresses-90x95', seed: 9095 },
  'mainland-frontier': { layoutId: 'mainland', seed: 5501 },
  'coastal-peninsula': { layoutId: 'peninsula', seed: 5502 },
  'split-isles': { layoutId: 'twin-isles', seed: 5503 },
  'carcassonne': { layoutId: 'mainland', seed: 5601 },
  'crac-des-chevaliers': { layoutId: 'mainland', seed: 5901 },
  'arg-e-bam': { layoutId: 'mainland', seed: 5701 },
  'himeji-castle': { layoutId: 'himeji-46x90', seed: 5801 },
};
const ARMY_CAMP_LEVELS = [
  { level: 1, name: 'Field Camp', description: 'A basic tent camp with a fire, supplies, and a small weapon rack.' },
  { level: 2, name: 'Reinforced Camp', description: 'Larger tents, siege stores, reinforced equipment racks, and stronger field organization.' },
  { level: 3, name: 'Command Camp', description: 'A dedicated command pavilion with map tables, twin standards, and expanded armory support.' },
  { level: 4, name: 'Royal War Camp', description: 'A fortified semi-permanent base with a command hall, guard posts, medical support, and logistics.' },
] as const;
const ARMY_CAMP_MAX_LEVEL = ARMY_CAMP_LEVELS.length;

type AgricultureUpgradeKind = 'farm' | 'cowBarn';
interface AgricultureUpgradeLevel {
  level: 1 | 2 | 3 | 4;
  name: string;
  description: string;
}
const AGRICULTURE_UPGRADE_LEVELS: Record<AgricultureUpgradeKind, readonly AgricultureUpgradeLevel[]> = {
  farm: [
    { level: 1, name: 'Smallholding', description: 'A working crop field with a compact shed, irrigation ditch, tools, and basic storage.' },
    { level: 2, name: 'Irrigated Farm', description: 'Improved irrigation, extra field infrastructure, and covered working space increase the farmstead scale.' },
    { level: 3, name: 'Prosperous Farmstead', description: 'A larger granary, expanded storage, and stronger field organization mark a mature farm.' },
    { level: 4, name: 'Manorial Farm', description: 'Stone-backed storage, upgraded granary buildings, and a formal farm entrance create an elite estate farm.' },
  ],
  cowBarn: [
    { level: 1, name: 'Cattle Shed', description: 'A modest cattle barn with a fenced yard, trough, hay, and a small herd.' },
    { level: 2, name: 'Reinforced Barn', description: 'A larger timber barn, improved feeding area, and expanded hay storage support more livestock.' },
    { level: 3, name: 'Expanded Stockyard', description: 'A substantial barn complex with stone foundations, covered pens, and a larger herd.' },
    { level: 4, name: 'Royal Stockyard', description: 'A prestigious fortified stockyard with a grand barn, silo, formal gate, and premium livestock facilities.' },
  ],
};
const AGRICULTURE_MAX_LEVEL = 4;

const CARPENTER_LEVELS = [
  { level: 1, name: 'Timber Yard', description: 'A small open carpenter yard that processes Logs into construction-ready Wood.', workers: 2, inputPerSecond: 0.30, yieldRatio: 0.80 },
  { level: 2, name: 'Carpenter Workshop', description: 'A larger covered workshop with a dedicated cutting bay, better tools, and higher throughput.', workers: 4, inputPerSecond: 0.58, yieldRatio: 0.90 },
  { level: 3, name: 'Master Carpenter Guild', description: 'A mature timber workshop with a loft, heavy saw frame, hoist, storage, and maximum conversion efficiency.', workers: 6, inputPerSecond: 0.90, yieldRatio: 1.00 },
] as const;
const CARPENTER_MAX_LEVEL = CARPENTER_LEVELS.length;

const HARBOR_LEVELS = [
  { level: 1, name: 'Landing Dock', description: 'A compact timber landing with simple mooring posts, basic cargo, and a fishing boat.' },
  { level: 2, name: 'Fishing Wharf', description: 'A broader working wharf with side platforms, railings, fishing gear, storage, and more supports.' },
  { level: 3, name: 'Merchant Pier', description: 'A developed commercial pier with a stone apron, covered warehouse, crane, cargo stacks, and transport ship access.' },
  { level: 4, name: 'Grand Harbor', description: 'A substantial port with a stone quay, twin docking arms, roofed harbor buildings, cranes, lantern posts, and trading vessel facilities.' },
] as const;
const HARBOR_MAX_LEVEL = HARBOR_LEVELS.length;

type FortificationUpgradeKind = 'tower' | 'gate' | 'towerBridge' | 'keep';
interface FortificationUpgradeLevel {
  level: 1 | 2 | 3 | 4;
  name: string;
  description: string;
}
const FORTIFICATION_UPGRADE_LEVELS: Record<FortificationUpgradeKind, readonly FortificationUpgradeLevel[]> = {
  tower: [
    { level: 1, name: 'Watch Tower', description: 'A practical defensive tower with a basic fighting platform and simple firing positions.' },
    { level: 2, name: 'Reinforced Tower', description: 'Stronger masonry bands, improved upper defenses, and a more substantial silhouette mark the first major upgrade.' },
    { level: 3, name: 'Command Tower', description: 'A projecting defense gallery, richer stonework, and command details make the tower visibly more advanced.' },
    { level: 4, name: 'Royal Bastion', description: 'The tallest, most refined tower form adds a fortified crown, metal detailing, and prominent standards.' },
  ],
  gate: [
    { level: 1, name: 'Castle Gate', description: 'A functional timber gate set into a compact stone gateway.' },
    { level: 2, name: 'Reinforced Gate', description: 'Heavier masonry, iron door reinforcement, and stronger side supports improve the entrance defense.' },
    { level: 3, name: 'Guarded Gatehouse', description: 'A taller gatehouse with machicolation-style supports, firing positions, and a more imposing upper defense.' },
    { level: 4, name: 'Royal Gatehouse', description: 'Twin elevated guard turrets, formal standards, and premium defensive detailing create a landmark entrance.' },
  ],
  towerBridge: [
    { level: 1, name: 'Tower Walk', description: 'A simple elevated crossing between two compatible towers.' },
    { level: 2, name: 'Reinforced Bridge', description: 'A broader deck with denser supports and stronger side protection improves the crossing.' },
    { level: 3, name: 'Fortified Skyway', description: 'Guard frames, reinforced rails, and structural bracing give the bridge a mature defensive profile.' },
    { level: 4, name: 'Royal Tower Bridge', description: 'A prestigious fortified crossing with overhead guard frames, metal accents, and visible standards.' },
  ],
  keep: [
    { level: 1, name: 'Stone Keep', description: 'A compact defensive keep with a clear, readable base silhouette.' },
    { level: 2, name: 'Fortified Keep', description: 'The keep grows taller and gains stronger roof and corner defenses.' },
    { level: 3, name: 'Great Keep', description: 'A larger footprint, taller massing, and prominent towers make the keep a settlement landmark.' },
    { level: 4, name: 'Royal Keep', description: 'The final keep form is broader, taller, and visually richer with a commanding defensive crown.' },
  ],
};
const FORTIFICATION_MAX_LEVEL = 4;
const KEEP_UPGRADE_PRESETS = [
  { level: 1, width: 3, depth: 3, floors: 2, roof: 'flatBattlement', cornerTowers: false, battlements: true },
  { level: 2, width: 3, depth: 3, floors: 3, roof: 'sloped', cornerTowers: true, battlements: true },
  { level: 3, width: 4, depth: 4, floors: 4, roof: 'towered', cornerTowers: true, battlements: true },
  { level: 4, width: 5, depth: 5, floors: 5, roof: 'defensivePlatform', cornerTowers: true, battlements: true },
] as const;

const BUILDING_KINDS: TileKind[] = [
  'wall1',
  'wall2',
  'wall3',
  'gate',
  'tower',
  'road',
  'dirtRoad',
  'stoneRoad',
  'harbor',
  'cottage',
  'house',
  'manor',
  'villa',
  'farm',
  'cowBarn',
  'appleOrchard',
  'armyCamp',
  'market',
  'basilica',
  'mosque',
  'windmill',
  'mine',
  'carpenter',
  'mountain',
  'tree',
  'rock',
  'hut',
  'moat',
];
const CONSTRUCTION_VISUAL_KINDS = new Set<TileKind>([
  'wall1', 'wall2', 'wall3', 'gate', 'tower', 'cottage', 'house', 'manor', 'villa',
  'hut', 'farm', 'cowBarn', 'appleOrchard', 'market', 'windmill', 'mine', 'carpenter',
  'armyCamp', 'harbor', 'basilica', 'mosque',
]);

type ViewMode = 'plan2d' | 'world3d';

interface GridPoint {
  x: number;
  y: number;
}

interface ToolDefinition {
  id: ToolKind;
  icon: string;
  label: string;
  detail: string;
  shortcut: string;
}

interface MoatTask {
  x: number;
  y: number;
  progressMs: number;
  workerId?: number;
}

interface WorkerAgent {
  id: number;
  view: THREE.Group;
  taskKey?: string;
  homeX: number;
  homeZ: number;
  path: GridPoint[];
  pathIndex: number;
  destinationGrid?: GridPoint;
  repathMs: number;
}

interface SettlementAgent {
  key: string;
  id: number;
  role: 'citizen' | 'farmer' | 'worker';
  view: THREE.Group;
  home: GridPoint;
  work?: GridPoint;
  position: THREE.Vector3;
  target: THREE.Vector3;
  targetGrid: GridPoint;
  destinationGrid: GridPoint;
  waitMs: number;
  phase: 'home' | 'work' | 'wander';
  speed: number;
  anim: number;
  path: GridPoint[];
}

interface SettlementAgentSpec {
  key: string;
  role: SettlementAgent['role'];
  home: GridPoint;
  work?: GridPoint;
  seed: number;
}

interface HistorySnapshot {
  mapLayoutId: MapLayoutId;
  worldSeed: number;
  cells: ReturnType<GameState['entries']>;
  keeps: KeepState[];
  terrain: Array<[string, TerrainOverrideKind]>;
  elevations: Array<[string, number]>;
  stoneStyle: StoneStyle;
  towerBridges: TowerBridgeState[];
  militaryTier: MilitaryTier;
  economy: EconomyResourceState;
  population: PopulationSimulationState;
}

const TOOL_GROUPS: Array<{ label: string; tools: ToolDefinition[] }> = [
  {
    label: 'Castle & Defense',
    tools: [
      { id: 'wall1', icon: '🪨', label: 'Stone Wall', detail: 'Drag A → B · stack floors', shortcut: '1' },
      { id: 'wall2', icon: '🪵', label: 'Wooden Wall', detail: 'Drag A → B · timber defense', shortcut: '2' },
      { id: 'wall3', icon: '🛡️', label: 'Reinforced Wall', detail: 'Drag A → B · heavy defense', shortcut: '3' },
      { id: 'gate', icon: '🚪', label: 'Gate', detail: 'Snaps into fortification lines', shortcut: '4' },
      { id: 'tower', icon: '🏰', label: 'Tower', detail: 'Place a tower · appearance evolves automatically', shortcut: '5' },
      { id: 'towerBridge', icon: '🌉', label: 'Tower Bridge', detail: 'Build or select between two compatible towers', shortcut: 'D' },
      { id: 'keep', icon: '🏯', label: 'Keep', detail: 'Place a keep · size and detail grow with upgrades', shortcut: 'P' },
      { id: 'moat', icon: '💧', label: 'Moat', detail: 'Workers excavate queued tiles', shortcut: 'Q' },
    ],
  },
  {
    label: 'Residential',
    tools: [
      { id: 'cottage', icon: '🏠', label: 'Cottage Cluster', detail: '3 small cottages + village props', shortcut: '7' },
      { id: 'house', icon: '🏡', label: 'House Cluster', detail: '4 connected village homes', shortcut: '8' },
      { id: 'manor', icon: '🏯', label: 'Manor Court', detail: 'Main hall + service houses', shortcut: '9' },
      { id: 'villa', icon: '🏘️', label: 'Villa Quarter', detail: '3 detailed homes + courtyard', shortcut: '0' },
    ],
  },
  {
    label: 'Economy',
    tools: [
      { id: 'market', icon: '🏪', label: 'Market', detail: 'Large medieval marketplace · tents · stalls · shops', shortcut: '-' },
      { id: 'basilica', icon: '⛪', label: 'Basilica', detail: 'Large stone church landmark · nave · transept · tower', shortcut: '-' },
      { id: 'mosque', icon: '◫', label: 'Courtyard Mosque', detail: 'Low-rise prayer hall · courtyard · domed bays', shortcut: '-' },
      { id: 'mine', icon: '⛏️', label: 'Mine', detail: 'Produces stone for construction', shortcut: '-' },
      { id: 'hut', icon: '🛖', label: 'Woodcutter Hut', detail: 'Produces logs from nearby trees', shortcut: '-' },
      { id: 'carpenter', icon: '🪚', label: 'Carpenter Workshop', detail: '3 levels · converts Logs into Wood', shortcut: '-' },
    ],
  },
  {
    label: 'Agriculture',
    tools: [
      { id: 'farm', icon: '🌾', label: 'Farm', detail: 'Upgradeable crop farm · 4 visual levels', shortcut: 'F' },
      { id: 'cowBarn', icon: '🐄', label: 'Cow Barn', detail: 'Upgradeable cattle farm · 4 visual levels', shortcut: '-' },
      { id: 'appleOrchard', icon: '🍎', label: 'Apple Orchard', detail: 'Four visual maturity levels · procedural apple trees', shortcut: 'Y' },
      { id: 'windmill', icon: '⚙️', label: 'Medieval Windmill', detail: 'Four-sail working mill · continuous rotation', shortcut: 'W' },
    ],
  },
  {
    label: 'Roads & Access',
    tools: [
      { id: 'road', icon: '🛣️', label: 'Road', detail: 'Drag A → B · standard road', shortcut: '6' },
      { id: 'dirtRoad', icon: '🟫', label: 'Dirt Road', detail: 'Drag A → B · village track', shortcut: 'I' },
      { id: 'stoneRoad', icon: '◼️', label: 'Stone Road', detail: 'Drag A → B · paved route', shortcut: 'O' },
    ],
  },
  {
    label: 'Terrain',
    tools: [
      { id: 'rock', icon: '🪨', label: 'Rock', detail: 'Place natural rock formations', shortcut: '-' },
      { id: 'mountain', icon: '⛰️', label: 'Mountain', detail: 'Repeated clicks grow natural peaks', shortcut: 'N' },
      { id: 'mountainRange', icon: '🏔️', label: 'Mountain Range', detail: 'Drag A → B · ridge + foothills', shortcut: 'K' },
      { id: 'river', icon: '🌊', label: 'River', detail: 'Carve connected flowing water', shortcut: 'R' },
      { id: 'land', icon: '🌱', label: 'Land', detail: 'Fill water into buildable land', shortcut: 'L' },
      { id: 'raise', icon: '⬆️', label: 'Raise', detail: 'Raise terrain with brush', shortcut: 'U' },
      { id: 'lower', icon: '⬇️', label: 'Lower', detail: 'Lower terrain with brush', shortcut: 'J' },
      { id: 'flatten', icon: '▰', label: 'Flatten', detail: 'Level terrain to brush center', shortcut: 'B' },
      { id: 'smooth', icon: '〰️', label: 'Smooth', detail: 'Blend nearby terrain heights', shortcut: 'V' },
      { id: 'hill', icon: '⛰️', label: 'Create Hill', detail: 'Build a rounded hill', shortcut: 'H' },
      { id: 'cliff', icon: '🗻', label: 'Create Cliff', detail: 'Create a sharp raised plateau', shortcut: 'C' },
    ],
  },
  {
    label: 'Environment',
    tools: [
      { id: 'tree', icon: '🌲', label: 'Tree', detail: 'Plant a detailed tree', shortcut: 'T' },
      { id: 'erase', icon: '⌫', label: 'Remove', detail: 'Trees, rocks, huts & builds', shortcut: 'X' },
    ],
  },
  {
    label: 'Military',
    tools: [
      { id: 'armyCamp', icon: '⛺', label: 'Army Camp', detail: 'Upgradeable military base · 4 visual levels', shortcut: 'A' },
    ],
  },
  {
    label: 'Harbor & Shipping',
    tools: [
      { id: 'harbor', icon: '⚓', label: 'Harbor', detail: 'Upgradeable coastal port · 4 visual levels', shortcut: '-' },
    ],
  },
];

export class ThreeGame {
  private readonly extensions = new Set<GameExtension>();

  registerExtension(extension: GameExtension): () => void {
    this.extensions.add(extension);
    extension.onBuildPanelRefreshed?.();
    this.redraw();
    return () => {
      this.extensions.delete(extension);
      this.redraw();
    };
  }
  private readonly root: HTMLElement;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(48, 1, 0.1, 700);
  private readonly renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  private readonly controls: OrbitControls;
  private readonly settingsStore: SettingsStore;
  private readonly audioManager: AudioManager;
  private readonly distanceDetailBudget = new DistanceDetailBudgetSystem();
  private readonly adaptiveRenderProfile = new AdaptiveRenderProfile();
  private readonly performanceDebug: PerformanceDebugOverlay;
  /** Domain state and gameplay services are composed here, away from rendering/UI concerns. */
  private readonly services = createGameDomainServices();
  private readonly missionSystem = new MissionSystem();
  private readonly missionUI = new MissionUI({
    onPinMission: (id) => this.setPinnedMission(id),
  });
  private missionRefreshAccumulatorMs = 0;
  private readonly castleBlockSystem = new CastleBlockSystem();
  private readonly constructionAnimation = new ConstructionAnimationSystem();
  private readonly ambientFauna = new AmbientFaunaSystem();
  private readonly constructionObjects = new Map<string, THREE.Object3D>();
  private castleBlocksByCell = new Map<string, CastleBlockState>();
  private readonly maritimeSystem = new MaritimeSystem({
    size: SIZE,
    terrainAt: (x, y) => this.terrainAt(x, y),
  });
    private readonly medievalMaterials = new MedievalMaterials();
  private readonly keepRenderer = new KeepRenderer(this.services.detailGenerator, this.medievalMaterials);
  private readonly basilicaRenderer = new BasilicaRenderer(this.medievalMaterials);
  private readonly carpenterRenderer = new CarpenterWorkshopRenderer();
  private saveSystem!: SaveSystem;
  private readonly terrainOverrides = new Map<string, TerrainOverrideKind>();
  private readonly elevationOverrides = new Map<string, number>();
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly worldLayoutLayer = new THREE.Group();
  private readonly terrainLayer = new THREE.Group();
  private readonly buildLayer = new THREE.Group();
  private readonly ambientMotion = new AmbientMotionSystem();
  private readonly environmentSystem = new EnvironmentSystem();
  private readonly planLayer = new THREE.Group();
  private readonly wallPreviewLayer = new THREE.Group();
  private buildPreviewKey = '';
  private readonly workerLayer = new THREE.Group();
  private readonly settlementLayer = new THREE.Group();
  private readonly battleLayer = new THREE.Group();
  private readonly godModeLayer = new THREE.Group();
  private readonly godModeMarkerLayer = new THREE.Group();
  private readonly godModeActions = new GodModeActionRegistry();
  private readonly planMaterials = new Map<string, THREE.MeshBasicMaterial>();
  private readonly environmentMaterials = new Map<string, THREE.MeshStandardMaterial>();
  private readonly visualBenchmark = new URLSearchParams(window.location.search).has('visualBaseline');
  private lastRedrawMs = 0;
  private readonly settlementUnitBox = new THREE.BoxGeometry(1, 1, 1);
  private readonly buildObjectsByCell = new Map<string, THREE.Object3D>();
  private readonly battleSystem: BattleSystem;
  private readonly groundHit = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD, WORLD),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  private readonly moatTasks = new Map<string, MoatTask>();
  private readonly workers: WorkerAgent[] = [];
  private readonly settlementAgents: SettlementAgent[] = [];
  private nextSettlementAgentId = 1;
  private settlementNavigationSignature = '';
  private readonly riverTexture: THREE.CanvasTexture;
  private readonly riverWaterMaterial: THREE.MeshStandardMaterial;
  private readonly oceanTexture: THREE.CanvasTexture;
  private readonly oceanWaterMaterial: THREE.MeshStandardMaterial;
  private readonly shallowWaterMaterial: THREE.MeshStandardMaterial;

  private mapLayoutId: MapLayoutId = 'island';
  private worldSeed = 0;
  private newGameSelectionPending = false;
  private selectedTool: ToolKind | null = 'wall1';
  private selectedCell: GridPoint | null = null;
  private minimapCursor: GridPoint = { x: Math.floor(SIZE / 2), y: Math.floor(SIZE / 2) };
  private viewMode: ViewMode = 'world3d';
  private toolbarOpen = window.innerWidth > 760;
  private activeBuildCategory: string | null = null;
  private readonly saved3DCameraPosition = WORLD_STYLE.camera.position.clone();
  private readonly saved3DTarget = new THREE.Vector3(0, 0, 0);
  private wallThickness: WallThickness = 'medium';
  private wallBattlement = true;
  private wallWalkway = false;
  private towerShape: TowerShape = 'round';
  private towerTop: TowerTop = 'openBattlement';
  private stoneStyle: StoneStyle = 'limestone';
  private towerBridgeKind: TowerBridgeKind = 'stone';
  private towerBridgeStart: GridPoint | null = null;
  private towerBridgeHover: GridPoint | null = null;
  private readonly towerBridges = new Map<number, TowerBridgeState>();
  private nextTowerBridgeId = 1;
  private selectedTowerBridgeId: number | null = null;
  private keepWidth = 3;
  private keepDepth = 3;
  private keepFloors = 2;
  private keepRotation = 0;
  private keepCornerTowers = false;
  private keepRoof: KeepRoofStyle = 'flatBattlement';
  private keepBattlements = true;
  private selectedKeepId: number | null = null;
  private brushSize = 2;
  private brushStrength = 1;
  private battleSetup: BattleSetup = {
    attackerSwordsmen: 30,
    attackerArchers: 20,
    attackerSpearmen: 12,
    attackerCrossbowmen: 8,
    defenderSwordsmen: 0,
    defenderArchers: 0,
    defenderSpearmen: 0,
    defenderCrossbowmen: 0,
    attackerModernSoldiers: 0,
    defenderModernSoldiers: 0,
  };
  private militaryTier: MilitaryTier = 1;
  private populationBattleCommitted = false;
  private populationBattleStart: BattleSetup | null = null;
  private endlessDefenseActive = false;
  private endlessDefensePaused = false;
  private endlessDefenseWave = 0;
  private endlessDefenseIntermissionMs = 0;
  private endlessDefenseAwaitingNextWave = false;
  private missileUiRefreshMs = 0;
  private environmentRefreshMs = 0;

  private readonly undoStack: HistorySnapshot[] = [];
  private readonly redoStack: HistorySnapshot[] = [];
  private godModeOpen = false;
  private freeBuildEnabled = false;
  private godModeActionId = 'missileStrike';
  private godModeTarget: GodModeTarget | null = null;
  private godModeHover: GridPoint | null = null;
  private godModeTouchStart: { pointerId: number; x: number; y: number } | null = null;
  private godModeCapacity = 10;
  private readonly godModeMaxCapacity = 10;
  private readonly godModeEffects: Array<{ group: THREE.Group; elapsed: number; duration: number }> = [];
  private terrainStrokeActive = false;
  private terrainStrokeChanged = false;
  private terrainStrokeSnapshot: HistorySnapshot | null = null;
  private cancelWorldTouchInput: (() => void) | null = null;
  private lastTerrainBrushKey = '';

  private wallDragStart: GridPoint | null = null;
  private wallDragEnd: GridPoint | null = null;
  private wallPreviewStatus = '';
  private roadDragStart: GridPoint | null = null;
  private roadDragEnd: GridPoint | null = null;
  private mountainRangeStart: GridPoint | null = null;
  private mountainRangeEnd: GridPoint | null = null;
  private pointerStart: { x: number; y: number } | null = null;
  private longPressCell: GridPoint | null = null;
  private longPressPointerId: number | null = null;
  private longPressStartedAt = 0;
  private longPressTriggered = false;
  private longPressStartScreen: { x: number; y: number } | null = null;

  private saveTimer: number | null = null;
  private economySaveAccumulatorMs = 0;
  private worldSeeded = false;
  private loadedSaveVersion = 0;
  private lastFrameTime = 0;
  private cameraTransitionFrame: number | null = null;
  private audioAmbientAccumulatorMs = 0;
  private audioBattleRunningMs = 0;
  private lastAudioBattleMode: BattleStatus['mode'] = 'idle';

  constructor(root: HTMLElement, settingsStore: SettingsStore, storage: SaveStorage = localStorage) {
    const hadSave = storage.getItem(SAVE_KEY) !== null;
    this.root = root;
    this.settingsStore = settingsStore;
    this.audioManager = new AudioManager();
    this.saveSystem = new SaveSystem({
      state: this.services.state,
      keepSystem: this.services.keepSystem,
      terrainOverrides: this.terrainOverrides,
      elevationOverrides: this.elevationOverrides,
      getCommittedElevationOverrides: () => this.terrainStrokeActive && this.terrainStrokeSnapshot
        ? new Map(this.terrainStrokeSnapshot.elevations) : this.elevationOverrides,
      towerBridges: this.towerBridges,
      getGameMode: () => this.gameMode,
      getMapLayoutId: () => this.mapLayoutId,
      setMapLayoutId: (value) => this.setMapLayoutId(value),
      getWorldSeed: () => this.worldSeed,
      setWorldSeed: (value) => { this.worldSeed = Number.isFinite(value) ? Math.trunc(value) : 0; },
      getStoneStyle: () => this.stoneStyle,
      getWorldSeeded: () => this.worldSeeded,
      getBattleSetup: () => this.battleSetup,
      setBattleSetup: (value) => { this.battleSetup = value as BattleSetup; },
      getMilitaryTier: () => this.militaryTier,
      setMilitaryTier: (value) => { this.militaryTier = normalizeMilitaryTier(value); },
      getEconomyState: () => this.services.economySystem.getState(),
      setEconomyState: (value) => { this.services.economySystem.setState(value); },
      getPopulationState: () => this.services.populationSystem.getState(),
      setPopulationState: (value) => { this.services.populationSystem.setState(value); },
      getEnvironmentState: () => this.environmentSystem.getState(),
      setEnvironmentState: (value) => { this.environmentSystem.setState(value); },
      getMissionState: () => this.missionSystem.getState(),
      setMissionState: (value) => { this.missionSystem.setState(value); },
      setWorldSeeded: (value) => { this.worldSeeded = value; },
      setLoadedSaveVersion: (value) => { this.loadedSaveVersion = value; },
      setStoneStyle: (value) => { this.stoneStyle = value; },
      migrateKind: (kind, level, saveVersion) => this.migrateKind(kind, level, saveVersion),
      isBuildingAvailable: (kind) => isBuildingAvailable(kind as TileKind),
      key: (x, y) => this.key(x, y),
      syncLoadedWorldUI: () => this.syncLoadedWorldUI(),
      prepareForLoad: () => {
        this.cancelWorldTouchInput?.();
        this.endlessDefenseActive = false;
        this.endlessDefensePaused = false;
        this.endlessDefenseWave = 0;
        this.endlessDefenseIntermissionMs = 0;
        this.endlessDefenseAwaitingNextWave = false;
        this.battleSystem.reset(false);
        this.populationBattleCommitted = false;
        this.populationBattleStart = null;
        this.services.gateSystem.setAttackState(false);
        document.getElementById('game-shell')?.classList.remove('battle-mode');
        this.workerLayer.visible = this.viewMode === 'world3d';
        this.settlementLayer.visible = this.viewMode === 'world3d';
        this.freeBuildEnabled = false;
        this.godModeOpen = false;
        this.godModeTarget = null;
        this.godModeHover = null;
        this.godModeTouchStart = null;
        this.clearGroup(this.godModeMarkerLayer);
        const godModePanel = document.getElementById('god-mode-panel');
        if (godModePanel) godModePanel.hidden = true;
        this.constructionAnimation.clear();
        this.clearSettlementAgents();
      },
      afterLoad: () => {
        this.rebuildWorldLayoutSurface();
        this.normalizeRiverElevations();
        this.applyEnvironmentVisuals(true);
      },
      setStatus: (message) => this.setStatus(message),
    }, storage);
    this.riverTexture = this.createRiverTexture();
    this.oceanTexture = this.createOceanTexture();
    this.riverWaterMaterial = new THREE.MeshStandardMaterial({
      color: WORLD_STYLE.palette.riverWater,
      map: this.riverTexture,
      roughness: 0.16,
      metalness: 0.08,
      transparent: true,
      opacity: 0.92,
      emissive: 0x0b4050,
      emissiveIntensity: 0.16,
    });
    this.oceanWaterMaterial = new THREE.MeshStandardMaterial({
      color: WORLD_STYLE.palette.deepWater,
      map: this.oceanTexture,
      roughness: 0.25,
      metalness: 0.08,
      transparent: true,
      opacity: 0.95,
      emissive: 0x062d42,
      emissiveIntensity: 0.12,
    });
    this.shallowWaterMaterial = new THREE.MeshStandardMaterial({
      color: WORLD_STYLE.palette.shallowWater,
      map: this.oceanTexture,
      roughness: 0.34,
      metalness: 0.02,
      transparent: true,
      opacity: 0.78,
      emissive: 0x123b43,
      emissiveIntensity: 0.08,
    });
    this.ambientMotion.registerTextureFlow(this.riverTexture, 0.000035, -0.00032);
    this.ambientMotion.registerTextureFlow(this.oceanTexture, 0.000018, -0.000012);
    const initialSettings = this.settingsStore.get();
    applyGraphicsSettings(this.renderer, initialSettings);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    applyGraphicsSettings(this.renderer, initialSettings);
    this.renderer.domElement.id = 'game-canvas';
    root.appendChild(this.renderer.domElement);
    if (this.visualBenchmark) {
      // Opt-in diagnostics and fixed camera for the reproducible visual baseline script.
      (window as unknown as { __castleVisualFrame: () => object }).__castleVisualFrame = () => ({
        drawCalls: this.renderer.info.render.calls,
        triangles: this.renderer.info.render.triangles,
      });
      (window as unknown as { __castleVisualMetrics: () => object }).__castleVisualMetrics = () => {
        const geometries = new Set<THREE.BufferGeometry>();
        const materials = new Set<THREE.Material>();
        this.scene.traverse((object) => {
          if (!(object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Points)) return;
          geometries.add(object.geometry);
          for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
        });
        const gl = this.renderer.getContext();
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        const drawingBuffer = new THREE.Vector2();
        this.renderer.getDrawingBufferSize(drawingBuffer);
        return {
          drawCalls: this.renderer.info.render.calls,
          triangles: this.renderer.info.render.triangles,
          sceneGeometries: geometries.size,
          sceneMaterials: materials.size,
          gpuGeometries: this.renderer.info.memory.geometries,
          gpuTextures: this.renderer.info.memory.textures,
          lastRedrawMs: this.lastRedrawMs,
          ambientMotion: this.ambientMotion.stats(),
          visualBudget: this.distanceDetailBudget.snapshot(),
          environment: this.environmentSystem.visualState(),
          pixelRatio: this.renderer.getPixelRatio(),
          drawingBuffer: { width: drawingBuffer.x, height: drawingBuffer.y },
          gpu: {
            vendor: String(debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR)),
            renderer: String(debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)),
            version: String(gl.getParameter(gl.VERSION)),
            shadingLanguageVersion: String(gl.getParameter(gl.SHADING_LANGUAGE_VERSION)),
            maxTextureSize: Number(gl.getParameter(gl.MAX_TEXTURE_SIZE)),
          },
        };
      };
      (window as unknown as { __castleVisualCamera: (position: { x: number; y: number; z: number; targetX: number; targetY: number; targetZ: number }) => void }).__castleVisualCamera = (position) => {
        this.camera.position.set(position.x, position.y, position.z);
        this.controls.target.set(position.targetX, position.targetY, position.targetZ);
        this.controls.update();
      };
      (window as unknown as {
        __castleVisualGridPoint: (x: number, y: number) => { x: number; y: number };
      }).__castleVisualGridPoint = (x, y) => {
        if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= SIZE || y >= SIZE) {
          throw new Error(`Visual QA grid point is outside the world: ${x},${y}`);
        }
        const world = this.gridToWorld(x, y);
        const projected = new THREE.Vector3(world.x, this.groundHit.position.y, world.z).project(this.camera);
        const rect = this.renderer.domElement.getBoundingClientRect();
        return {
          x: (projected.x + 1) * 0.5 * rect.width,
          y: (1 - projected.y) * 0.5 * rect.height,
        };
      };
    }

    this.scene.background = new THREE.Color(WORLD_STYLE.lighting.fog);
    this.scene.fog = new THREE.Fog(WORLD_STYLE.lighting.fog, WORLD_STYLE.lighting.fogNear, WORLD_STYLE.lighting.fogFar);
    applySceneGraphicsSettings(this.scene, initialSettings);
    this.camera.position.copy(WORLD_STYLE.camera.position);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.minDistance = WORLD_STYLE.camera.minDistance;
    this.controls.maxDistance = WORLD_STYLE.camera.maxDistance;
    this.controls.maxPolarAngle = WORLD_STYLE.camera.maxPolarAngle;
    this.controls.zoomToCursor = false;
    this.controls.target.set(0, 0, 0);
    this.controls.addEventListener('change', () => this.enforceGameplayCameraBounds());
    applyInputSettings(this.controls, this.settingsStore.get());
    this.performanceDebug = new PerformanceDebugOverlay(this.settingsStore, {
      renderer: this.renderer,
      scene: this.scene,
      getCameraDistance: () => this.camera.position.distanceTo(this.controls.target),
      getViewMode: () => this.viewMode,
      getVisualBudget: () => this.distanceDetailBudget.snapshot(),
      getRenderLayers: () => [
        { name: 'Terrain', root: this.terrainLayer },
        { name: 'Buildings / Castle', root: this.buildLayer },
        { name: 'Fauna', root: this.ambientFauna.layer },
        { name: 'Workers', root: this.workerLayer },
        { name: 'NPCs', root: this.settlementLayer },
        { name: 'Battle', root: this.battleLayer },
        { name: 'Plan / preview', root: this.planLayer },
        { name: 'Build preview', root: this.wallPreviewLayer },
        { name: 'Effects', root: this.godModeLayer },
        { name: 'Effect markers', root: this.godModeMarkerLayer },
      ],
      getRuntimeCounts: () => ({
        workers: this.workers.length,
        settlementAgents: this.settlementAgents.length,
        battleObjects: this.battleLayer.children.length,
      }),
      getAudioDiagnostics: () => this.audioManager.getDiagnostics(),
    });
    this.settingsStore.subscribe((settings) => {
      applyGraphicsSettings(this.renderer, settings);
      applySceneGraphicsSettings(this.scene, settings);
      this.renderer.toneMappingExposure = settings.graphics.effectsEnabled ? 1.0 : 1;
      applyInputSettings(this.controls, settings);
      this.audioManager.setMasterVolume(settings.audio.masterVolume);
      this.audioManager.setMusicEnabled(settings.audio.musicEnabled);
      this.audioManager.setMusicVolume(settings.audio.musicVolume);
      this.audioManager.setAmbientEnabled(settings.audio.ambientEnabled);
      this.audioManager.setAmbientVolume(settings.audio.ambientVolume);
      this.audioManager.setSfxEnabled(settings.audio.sfxEnabled);
      this.audioManager.setSfxVolume(settings.audio.sfxVolume);
      this.audioManager.setMuted(settings.audio.muted);
      document.documentElement.style.setProperty('--castle-ui-scale', String(settings.interface.uiScale));
      document.documentElement.toggleAttribute('data-reduced-motion', settings.interface.reducedMotion);
      document.documentElement.toggleAttribute('data-high-contrast', settings.interface.highContrast);
      document.documentElement.lang = resolveLocale(settings.interface.language);
      const helpModal = document.getElementById('help-modal');
      if (helpModal && !settings.interface.showHelp) helpModal.hidden = true;
      const battlePanel = document.getElementById('battle-panel');
      battlePanel?.classList.toggle('settings-no-combat-feedback', !settings.gameplay.combatFeedback);
      if (this.ambientFauna.counts.birds > 0) this.rebuildAmbientFauna();
    });

    this.addLights();
    this.createWorld();

    this.scene.add(this.ambientFauna.layer);
    this.scene.add(this.terrainLayer);
    this.scene.add(this.buildLayer);
    this.scene.add(this.planLayer);
    this.scene.add(this.wallPreviewLayer);
    this.scene.add(this.workerLayer);
    this.scene.add(this.settlementLayer);
    this.scene.add(this.battleLayer);
    this.scene.add(this.godModeLayer);
    this.scene.add(this.godModeMarkerLayer);
    this.planLayer.visible = false;

    this.battleSystem = new BattleSystem(
      this.battleLayer,
      {
        size: SIZE,
        tileSize: TILE,
        gridToWorld: (x, y) => this.gridToWorld(x, y),
        terrainAt: (x, y) => this.terrainAt(x, y),
        elevationAt: (x, y) => this.terrainElevation(x, y),
        kindAt: (x, y) => this.kindAt(x, y),
        cellAt: (x, y) => this.services.state.getCell(x, y),
        fortificationTopAt: (_x, _y, cell) => this.fortificationTopLocal(cell),
        castleLinksAt: (x, y) => this.castleBlocksByCell.get(this.key(x, y))?.links,
        keeps: () => this.services.keepSystem.entries(),
        towerBridges: () => Array.from(this.towerBridges.values()).map((bridge) => ({ ...bridge })),
        setWallBattleVisibility: (x, y, visible) => this.setBattleWallVisibility(x, y, visible),
        buildingDamageAt: (x, y) => this.services.state.getCell(x, y)?.damage ?? 0,
        onWallDamage: (x, y, damage) => {
          const cell = this.services.state.getCell(x, y);
          if (!cell || !this.isWallFamily(cell.kind)) return;
          this.services.state.updateCell(x, y, { damage });
          this.scheduleSave();
        },
        gatePassable: (x, y) => this.services.gateSystem.isGatePassable(x, y),
        wallWeaponVisuals: () => this.getWallWeaponVisuals(),
        effectsEnabled: () => {
          const settings = this.settingsStore.get();
          return settings.graphics.effectsEnabled && !settings.interface.reducedMotion && settings.graphics.quality !== 'low';
        },
      },
      (status) => this.updateBattleUI(status),
    );

    this.registerGodModeActions();

    this.groundHit.rotation.x = -Math.PI / 2;
    this.groundHit.position.y = 2.05;
    this.scene.add(this.groundHit);

    this.load();
    if (!this.worldSeeded || this.loadedSaveVersion < SAVE_VERSION) {
      this.seedNaturalProps();
      this.worldSeeded = true;
      this.loadedSaveVersion = SAVE_VERSION;
      this.save(false);
    }

    this.createWorkers();
    this.redraw();
    this.applyEnvironmentVisuals(true);
    this.bindUI();
    this.updateMissions(0, true);
    // Keep the construction tool initialized during world creation/redraw, then enter the neutral mode only after UI binding.
    this.selectTool(null);
    this.setToolbarOpen(this.toolbarOpen);
    this.setViewMode(hadSave ? 'world3d' : 'plan2d');
    this.syncGameplayControls();
    this.syncTemplateAvailability();
    if (!hadSave) this.openMapLayoutSelector();
    this.bindPointerInput();
    this.resize();

    window.addEventListener('resize', () => this.resize());
    requestAnimationFrame((time) => this.animate(time));
  }

  private key(x: number, y: number): string {
    return `${x},${y}`;
  }

  private isWallTool(tool: ToolKind): tool is WallKind {
    return WALL_KINDS.includes(tool as WallKind);
  }

  private isRoadTool(tool: ToolKind): tool is RoadKind {
    return ROAD_KINDS.includes(tool as RoadKind);
  }

  private isHarborTool(tool: ToolKind): tool is HarborKind {
    return HARBOR_KINDS.includes(tool as HarborKind);
  }

  private get gameMode(): GameMode {
    return this.services.state.getGameMode();
  }

  private setMapLayoutId(value: MapLayoutId): void {
    const next = normalizeMapLayoutId(value);
    const changed = next !== this.mapLayoutId;
    this.mapLayoutId = next;
    if (changed && this.worldLayoutLayer.parent) {
      this.rebuildWorldLayoutSurface();
    }
    this.syncTemplateAvailability();
  }

  private isToolAvailable(tool: ToolKind): boolean {
    return isToolAvailable(tool);
  }

  private isBuildingAvailable(kind: TileKind): boolean {
    return isBuildingAvailable(kind);
  }

  private economyConstructionEnabled(): boolean {
    return !this.freeBuildEnabled;
  }

  private isConstructionAffordable(tool: ToolKind, quantity = 1): boolean {
    if (!this.economyConstructionEnabled()) return true;
    const cost = this.services.economySystem.constructionCost(tool, quantity);
    return this.services.economySystem.canAfford(cost);
  }

  private constructionCostPreviewLabel(tool: ToolKind, quantity = 1): string {
    if (quantity <= 0) return 'no new cost';
    if (!this.economyConstructionEnabled()) return 'free build';
    const cost = this.services.economySystem.constructionCost(tool, quantity);
    const parts: string[] = [];
    if ((cost.wood ?? 0) > 0.001) parts.push(`${Math.ceil(cost.wood ?? 0)} wood`);
    if ((cost.stone ?? 0) > 0.001) parts.push(`${Math.ceil(cost.stone ?? 0)} stone`);
    return parts.length > 0 ? parts.join(' + ') : 'no material cost';
  }

  private ensureConstructionAffordable(tool: ToolKind, quantity = 1): boolean {
    if (!this.economyConstructionEnabled()) return true;
    const cost = this.services.economySystem.constructionCost(tool, quantity);
    if (this.services.economySystem.canAfford(cost)) return true;

    const missing = this.services.economySystem.missing(cost);
    const needs: string[] = [];
    if ((missing.wood ?? 0) > 0.001) needs.push(`${Math.ceil(missing.wood ?? 0)} wood`);
    if ((missing.stone ?? 0) > 0.001) needs.push(`${Math.ceil(missing.stone ?? 0)} stone`);
    this.setStatus(`Not enough resources · need ${needs.join(' + ') || 'more materials'}`);
    return false;
  }

  private spendConstructionCost(tool: ToolKind, quantity = 1): void {
    if (!this.economyConstructionEnabled()) return;
    const cost = this.services.economySystem.constructionCost(tool, quantity);
    this.services.economySystem.spend(cost);
    this.syncEconomyUI();
  }

  private registerGodModeActions(): void {
    this.godModeActions.register({
      id: 'missileStrike',
      label: 'Missile Strike',
      description: 'Target one building and call down a direct missile impact.',
      enabled: true,
      validateTarget: (target, context) => {
        if (!target) return 'Select a building in the world.';
        const cell = context.getCell(target.anchor);
        if (!cell) return 'The selected building no longer exists.';
        if (!context.isDestructible(cell.kind)) return 'This object cannot be damaged by a missile.';
        if ((cell.damage ?? 0) >= 1) return 'This building is already destroyed.';
        return null;
      },
      execute: (target, context) => context.executeMissileStrike(target),
    });
    this.godModeActions.register(createFutureGodModeAction(
      'flood',
      'Flood',
      'Reserved for an area event that will interact with terrain and structures.',
    ));
    this.godModeActions.register(createFutureGodModeAction(
      'earthquake',
      'Earthquake',
      'Reserved for an area event that will affect terrain, buildings and people.',
    ));
  }

  private godModeContext(): GodModeActionContext {
    return {
      getCell: (point) => this.services.state.getCell(point.x, point.y),
      isDestructible: (kind) => this.services.destructibleBuildingSystem.isDestructible(kind),
      executeMissileStrike: (target) => this.executeMissileStrike(target),
    };
  }

  private isGodModeTargeting(): boolean {
    return this.godModeOpen && this.godModeActionId === 'missileStrike';
  }

  private resolveGodModeTarget(point: GridPoint): GodModeTarget | null {
    const direct = this.services.state.getCell(point.x, point.y);
    if (direct) {
      return {
        anchor: { x: point.x, y: point.y },
        kind: direct.kind,
        footprint: getStructureFootprint(direct.kind, point.x, point.y)
          .filter((item) => item.x >= 0 && item.y >= 0 && item.x < SIZE && item.y < SIZE),
      };
    }

    // Footprint-aware targeting supports any future multi-cell structures.
    for (const cell of this.services.state.entries()) {
      const footprint = getStructureFootprint(cell.kind, cell.x, cell.y);
      if (footprint.some((item) => item.x === point.x && item.y === point.y)) {
        return {
          anchor: { x: cell.x, y: cell.y },
          kind: cell.kind,
          footprint: footprint.filter((item) => item.x >= 0 && item.y >= 0 && item.x < SIZE && item.y < SIZE),
        };
      }
    }

    return null;
  }

  private setGodModeTarget(point: GridPoint | null): void {
    this.godModeHover = point;
    this.godModeTarget = point ? this.resolveGodModeTarget(point) : null;
    this.renderGodModeTargetMarker();
    this.updateGodModeUI();
  }

  private selectGodModeAction(actionId: string): void {
    const action = this.godModeActions.get(actionId);
    if (!action || !this.godModeActions.isAvailable(actionId)) {
      this.setStatus('God Mode action is unavailable');
      return;
    }
    this.godModeActionId = actionId;
    this.setGodModeTarget(null);
    this.setStatus(`${action.label} ready · select a building`);
  }

  private openGodMode(): void {
    this.godModeOpen = true;
    this.setToolbarOpen(false);
    const battlePanel = document.getElementById('battle-panel');
    if (battlePanel) battlePanel.hidden = true;
    this.godModeActionId = 'missileStrike';
    this.setGodModeTarget(null);
    const panel = document.getElementById('god-mode-panel');
    if (panel) panel.hidden = false;
    this.updateGodModeUI();
    this.setStatus('God Mode ready · choose an action');
  }

  private closeGodMode(): void {
    this.godModeOpen = false;
    this.godModeTouchStart = null;
    this.setGodModeTarget(null);
    const panel = document.getElementById('god-mode-panel');
    if (panel) panel.hidden = true;
    this.setStatus('God Mode closed');
  }

  private cancelGodModeTarget(): void {
    this.setGodModeTarget(null);
    this.setStatus('God Mode target cleared');
  }

  private confirmGodModeAction(): void {
    this.fireGodModeTarget();
  }

  private fireGodModeAt(point: GridPoint | null): void {
    this.godModeTarget = point ? this.resolveGodModeTarget(point) : null;
    this.renderGodModeTargetMarker();
    this.updateGodModeUI();
    this.fireGodModeTarget();
  }

  private fireGodModeTarget(): void {
    const action = this.godModeActions.get(this.godModeActionId);
    const target = this.godModeTarget;
    if (!action || !target) {
      this.setStatus('Click a valid building to fire');
      return;
    }
    if (this.godModeCapacity <= 0) {
      this.setStatus('Missile capacity exhausted');
      return;
    }
    const context = this.godModeContext();
    const reason = action.validateTarget(target, context);
    if (reason) {
      this.setStatus(reason);
      this.updateGodModeUI();
      return;
    }
    const result = action.execute(target, context);
    if (result.ok) {
      this.godModeCapacity -= 1;
      this.setStatus(`${result.message} · missiles remaining ${this.godModeCapacity}/${this.godModeMaxCapacity}`);
      this.setGodModeTarget(null);
    } else {
      this.setStatus(result.message);
    }
  }

  private updateGodModeUI(): void {
    const action = this.godModeActions.get(this.godModeActionId);
    const targetLabel = document.getElementById('god-mode-target');
    const feedback = document.getElementById('god-mode-feedback');
    const confirm = document.getElementById('god-mode-confirm') as HTMLButtonElement | null;
    const cancel = document.getElementById('god-mode-cancel') as HTMLButtonElement | null;
    const freeBuild = document.getElementById('god-mode-free-build') as HTMLButtonElement | null;
    const preview = this.godModeTarget;
    if (targetLabel) {
      targetLabel.textContent = preview
        ? `Target: ${preview.kind} · anchor ${preview.anchor.x},${preview.anchor.y} · ${preview.footprint.length} tile footprint`
        : 'Target: none · click a building in the world';
    }
    if (feedback) {
      feedback.textContent = action
        ? (preview ? (action.validateTarget(preview, this.godModeContext()) ?? 'Click the highlighted building to fire immediately') : action.description)
        : 'Choose an action';
    }
    const capacity = document.getElementById('god-mode-capacity');
    if (capacity) capacity.textContent = `Missiles: ${this.godModeCapacity}/${this.godModeMaxCapacity}`;
    if (confirm) confirm.disabled = !preview || !action || !this.godModeActions.isAvailable(this.godModeActionId);
    if (cancel) cancel.disabled = !preview;
    if (freeBuild) {
      freeBuild.textContent = `Free Build: ${this.freeBuildEnabled ? 'ON' : 'OFF'}`;
      freeBuild.setAttribute('aria-pressed', String(this.freeBuildEnabled));
    }
    document.querySelectorAll<HTMLButtonElement>('[data-god-action]').forEach((button) => {
      button.classList.toggle('is-selected', button.dataset.godAction === this.godModeActionId);
    });
  }

  private renderGodModeTargetMarker(): void {
    this.clearGroup(this.godModeMarkerLayer);
    const target = this.godModeTarget;
    if (!target || !this.godModeOpen) return;
    const material = new THREE.MeshBasicMaterial({
      color: 0xff6b4a,
      transparent: true,
      opacity: 0.72,
      wireframe: true,
      depthTest: false,
    });
    for (const point of target.footprint) {
      const marker = new THREE.Mesh(new THREE.BoxGeometry(TILE * 0.88, 0.18, TILE * 0.88), material);
      const world = this.gridToWorld(point.x, point.y);
      marker.position.set(world.x, this.terrainElevation(point.x, point.y) + 0.3, world.z);
      marker.userData.godModeMarker = true;
      this.godModeMarkerLayer.add(marker);
    }
  }

  private executeMissileStrike(target: GodModeTarget): GodModeExecutionResult {
    const cell = this.services.state.getCell(target.anchor.x, target.anchor.y);
    if (!cell) return { ok: false, message: 'The selected building no longer exists.' };
    if (!this.services.destructibleBuildingSystem.isDestructible(cell.kind)) {
      return { ok: false, message: 'This object cannot be damaged by a missile.' };
    }

    this.recordHistory();
    const damageAmount = this.services.destructibleBuildingSystem.maxHealth(cell.kind, cell.level ?? 1) * 0.72;
    const nextDamage = this.services.destructibleBuildingSystem.applyDamage(cell, damageAmount);
    const destroyed = nextDamage >= 1;
    if (destroyed && !WALL_KINDS.includes(cell.kind as WallKind) && cell.kind !== 'gate') {
      if (cell.kind === 'tower') this.removeTowerBridgesAt(target.anchor.x, target.anchor.y);
      this.services.state.removeCell(target.anchor.x, target.anchor.y);
    } else {
      this.services.state.updateCell(target.anchor.x, target.anchor.y, { damage: nextDamage });
    }

    this.createMissileStrikeEffect(target);
    this.redraw();
    this.scheduleSave();
    return {
      ok: true,
      message: destroyed ? `Missile strike destroyed ${cell.kind} · occupancy cleared` : `Missile strike hit ${cell.kind} · damage ${(nextDamage * 100).toFixed(0)}%`,
      damage: nextDamage,
      destroyed,
    };
  }

  private createMissileStrikeEffect(target: GodModeTarget): void {
    const settings = this.settingsStore.get();
    if (!settings.graphics.effectsEnabled || settings.interface.reducedMotion || settings.graphics.quality === 'low') return;
    const group = new THREE.Group();
    const center = this.gridToWorld(target.anchor.x, target.anchor.y);
    const elevation = this.terrainElevation(target.anchor.x, target.anchor.y);
    group.position.set(center.x, elevation, center.z);
    const missileMaterial = new THREE.MeshBasicMaterial({ color: 0xffd08a });
    const smokeMaterial = new THREE.MeshBasicMaterial({ color: 0x452f2a, transparent: true, opacity: 0.7 });
    const missile = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.16, 1.8, 8), missileMaterial);
    missile.position.y = 34;
    group.add(missile);
    const plume = new THREE.Mesh(new THREE.SphereGeometry(0.38, 8, 6), smokeMaterial);
    plume.position.y = 1.6;
    plume.scale.set(1.8, 0.7, 1.8);
    group.add(plume);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.35, 0.52, 24),
      new THREE.MeshBasicMaterial({ color: 0xff6b3d, transparent: true, opacity: 0.9, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.25;
    group.add(ring);
    this.godModeLayer.add(group);
    this.godModeEffects.push({ group, elapsed: 0, duration: 700 });
    while (this.godModeEffects.length > 4) {
      const oldest = this.godModeEffects.shift();
      if (oldest) {
        this.clearGroup(oldest.group);
        this.godModeLayer.remove(oldest.group);
      }
    }
  }

  private updateGodModeEffects(deltaMs: number): void {
    for (let index = this.godModeEffects.length - 1; index >= 0; index -= 1) {
      const effect = this.godModeEffects[index];
      effect.elapsed += deltaMs;
      const progress = THREE.MathUtils.clamp(effect.elapsed / effect.duration, 0, 1);
      const missile = effect.group.children[0];
      const plume = effect.group.children[1];
      const ring = effect.group.children[2];
      if (missile) missile.position.y = 34 * (1 - Math.min(1, progress * 1.35));
      if (plume) {
        plume.scale.setScalar(1 + progress * 2.4);
        if ((plume as THREE.Mesh).material instanceof THREE.MeshBasicMaterial) {
          ((plume as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - progress);
        }
      }
      if (ring) {
        ring.scale.setScalar(1 + progress * 5);
        if ((ring as THREE.Mesh).material instanceof THREE.MeshBasicMaterial) {
          ((ring as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - progress);
        }
      }
      if (progress >= 1) {
        this.clearGroup(effect.group);
        this.godModeLayer.remove(effect.group);
        this.godModeEffects.splice(index, 1);
      }
    }
  }

  private syncGameplayControls(): void {
    const battleButton = document.getElementById('battle-button');
    if (battleButton) battleButton.hidden = false;
    const godModeButton = document.getElementById('god-mode-button');
    if (godModeButton) godModeButton.hidden = false;
  }

  private syncTemplateAvailability(): void {
    document.querySelectorAll<HTMLButtonElement>('[data-template]').forEach((button) => {
      const template = button.dataset.template;
      button.hidden = false;
      button.disabled = false;

      const authoredLayoutTemplate = PLAYABLE_LAYOUT_TEMPLATES[template ?? ''];
      const targetLayoutId = authoredLayoutTemplate?.layoutId ?? 'island';
      const targetLayout = MAP_LAYOUTS.find((layout) => layout.id === targetLayoutId);
      button.title = `Uses ${targetLayout?.label ?? targetLayoutId}.`;
    });
  }

  private syncLoadedWorldUI(): void {
    this.syncGameplayControls();
    this.syncTemplateAvailability();
    this.syncMilitaryUI();
    this.updateGodModeUI();
    this.refreshBuildPanel();
  }

  private buildCategoryIcon(label: string): string {
    const normalized = label.toLocaleLowerCase();
    if (normalized.includes('castle') || normalized.includes('defense') || normalized.includes('fortress')) return '♜';
    if (normalized.includes('military')) return '⚔';
    if (normalized.includes('road') || normalized.includes('harbor') || normalized.includes('infrastructure')) return '↗';
    if (normalized.includes('terrain') || normalized.includes('environment')) return '⌁';
    return '⌂';
  }

  private refreshBuildPanel(): void {
    const toolbar = document.getElementById('toolbar');
    if (!toolbar) return;

    const ruleset = GAME_DEFINITION;
    const toolDefinitions = new Map(
      TOOL_GROUPS.flatMap((group) => group.tools.map((tool) => [tool.id, tool] as const)),
    );
    const tabs = toolbar.querySelector<HTMLElement>('.build-category-tabs');
    const sections = toolbar.querySelector<HTMLElement>('.build-tool-sections');
    const settings = toolbar.querySelector<HTMLElement>('.builder-settings');
    const noneButton = toolbar.querySelector<HTMLElement>('[data-build-none]');
    if (!tabs || !sections || !settings) return;

    const groups = ruleset.toolGroups
      .map((group) => ({
        label: group.label,
        tools: group.toolIds
          .map((toolId) => toolDefinitions.get(toolId))
          .filter((tool): tool is ToolDefinition => Boolean(tool)),
      }))
      .filter((group) => group.tools.length > 0);

    const selectedGroup = groups.find((group) =>
      this.selectedTool !== null && group.tools.some((tool) => tool.id === this.selectedTool),
    );
    const availableCategories = new Set(groups.map((group) => group.label));
    if (selectedGroup) {
      this.activeBuildCategory = selectedGroup.label;
    } else if (!this.activeBuildCategory || !availableCategories.has(this.activeBuildCategory)) {
      this.activeBuildCategory = groups[0]?.label ?? null;
    }

    tabs.innerHTML = groups.map((group, index) => {
      const active = group.label === this.activeBuildCategory;
      return (
        '<button id="build-category-tab-' + index + '" class="build-category-tab' + (active ? ' is-active' : '') +
        '" type="button" role="tab" aria-selected="' + active +
        '" aria-controls="build-tool-panel-' + index +
        '" data-build-category="' + group.label + '">' +
        '<span aria-hidden="true">' + this.buildCategoryIcon(group.label) + '</span>' +
        '<strong>' + group.label + '</strong>' +
        '<small>' + group.tools.length + '</small>' +
        '</button>'
      );
    }).join('');

    sections.innerHTML = groups.map((group, index) => {
      const active = group.label === this.activeBuildCategory;
      const buttons = group.tools.map((tool) =>
        '<button class="tool-button' + (tool.id === this.selectedTool ? ' is-selected' : '') +
        '" data-tool="' + tool.id +
        '" type="button" aria-pressed="' + (tool.id === this.selectedTool) +
        '" title="' + tool.detail + '">' +
        '<span class="tool-icon" aria-hidden="true">' + tool.icon + '</span>' +
        '<span class="tool-copy"><strong>' + tool.label + '</strong><small>' + tool.detail + '</small></span>' +
        '<kbd>' + tool.shortcut + '</kbd></button>'
      ).join('');

      return (
        '<section id="build-tool-panel-' + index +
        '" class="tool-category' + (active ? ' is-active' : '') +
        '" role="tabpanel" aria-labelledby="build-category-tab-' + index + '" data-category="' + group.label + '"' +
        (active ? '' : ' hidden') + '>' +
        '<div class="tool-category-label"><span>' + group.label + '</span><small>' + group.tools.length + ' tools</small></div>' +
        '<div class="tool-category-items">' + buttons + '</div>' +
        '</section>'
      );
    }).join('');

    settings.hidden = false;

    noneButton?.classList.toggle('is-selected', this.selectedTool === null);
    noneButton?.setAttribute('aria-pressed', String(this.selectedTool === null));
    const activeLabel = toolbar.querySelector<HTMLElement>('#build-active-label');
    if (activeLabel) {
      activeLabel.textContent = this.selectedTool === null
        ? 'Inspect'
        : (toolDefinitions.get(this.selectedTool)?.label ?? this.selectedTool);
    }

    this.filterBuildTools();
    this.syncArmyCampUpgradeUI();
    for (const extension of this.extensions) extension.onBuildPanelRefreshed?.();
  }

  private filterBuildTools(): void {
    const toolbar = document.getElementById('toolbar');
    if (!toolbar) return;

    const search = toolbar.querySelector<HTMLInputElement>('#build-search');
    const query = (search?.value ?? '').trim().toLocaleLowerCase();
    const searching = query.length > 0;
    const matchingCategories = new Set<string>();
    let matches = 0;

    toolbar.classList.toggle('is-searching', searching);

    toolbar.querySelectorAll<HTMLElement>('.tool-category').forEach((category) => {
      let categoryMatches = 0;
      category.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach((button) => {
        const found = !searching || (button.textContent ?? '').toLocaleLowerCase().includes(query);
        button.hidden = !found;
        if (found) categoryMatches += 1;
      });

      const categoryName = category.dataset.category ?? '';
      if (categoryMatches > 0) matchingCategories.add(categoryName);
      matches += categoryMatches;

      const active = searching
        ? categoryMatches > 0
        : categoryName === this.activeBuildCategory;
      category.hidden = !active;
      category.classList.toggle('is-active', active);
      category.setAttribute('aria-hidden', String(!active));
    });

    toolbar.querySelectorAll<HTMLButtonElement>('[data-build-category]').forEach((tab) => {
      const categoryName = tab.dataset.buildCategory ?? '';
      const active = !searching && categoryName === this.activeBuildCategory;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', String(active));
      tab.hidden = searching && !matchingCategories.has(categoryName);
    });

    if (!searching) {
      toolbar.querySelector<HTMLButtonElement>('[data-build-category].is-active')
        ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }

    const empty = toolbar.querySelector<HTMLElement>('#build-search-empty');
    if (empty) empty.hidden = !searching || matches > 0;
    const clear = toolbar.querySelector<HTMLButtonElement>('#build-search-clear');
    if (clear) clear.hidden = !searching;
  }

  private openMapLayoutSelector(): void {
    const modal = document.getElementById('templates-modal');
    const grid = document.getElementById('starting-map-layout-grid');
    if (!modal || !grid) {
      this.newGameSelectionPending = false;
      this.startNewGame();
      return;
    }

    this.newGameSelectionPending = true;
    grid.innerHTML = MAP_LAYOUTS.map((layout) =>
      '<button class="map-layout-card' +
      (layout.id === this.mapLayoutId ? ' is-selected' : '') +
      '" type="button" data-map-layout="' + layout.id + '">' +
      '<span class="map-layout-preview map-layout-preview-' + layout.id + '">' + layout.preview + '</span>' +
      '<strong>' + layout.label + '</strong>' +
      '<small>' + layout.description + '</small>' +
      '</button>',
    ).join('');

    grid.querySelectorAll<HTMLButtonElement>('[data-map-layout]').forEach((button) => {
      button.onclick = () => {
        const layoutId = normalizeMapLayoutId(button.dataset.mapLayout);
        this.newGameSelectionPending = false;
        this.setMapLayoutId(layoutId);
        this.startNewGame();
      };
    });

    this.syncTemplateAvailability();
    modal.hidden = false;
  }

  private resetWorld(): void {
    this.services.state.setGameMode('unified');
    this.services.state.clear();
    this.services.keepSystem.clear();
    this.towerBridges.clear();
    this.nextTowerBridgeId = 1;
    this.selectedTowerBridgeId = null;
    this.towerBridgeStart = null;
    this.towerBridgeHover = null;
    this.clearGroup(this.wallPreviewLayer);
    this.selectedCell = null;
    this.selectedKeepId = null;
    this.terrainOverrides.clear();
    this.elevationOverrides.clear();
    this.moatTasks.clear();
    this.clearGroup(this.workerLayer);
    this.workers.length = 0;
    this.clearSettlementAgents();
    this.battleSystem.reset(false);
    this.endlessDefenseActive = false;
    this.endlessDefensePaused = false;
    this.freeBuildEnabled = false;
    this.endlessDefenseWave = 0;
    this.endlessDefenseIntermissionMs = 0;
    this.endlessDefenseAwaitingNextWave = false;
    this.militaryTier = 1;
    this.services.state.setMissileState();
    this.services.economySystem.reset();
    this.services.populationSystem.setState();
    this.missionSystem.reset();
    this.missionRefreshAccumulatorMs = 0;
    this.populationBattleCommitted = false;
    this.populationBattleStart = null;
    this.economySaveAccumulatorMs = 0;
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    this.syncHistoryActions();
    this.worldSeeded = false;
    this.worldSeed = 0;
    this.rebuildWorldLayoutSurface();
    this.seedNaturalProps();
    this.worldSeeded = true;
    this.createWorkers();
    this.selectedTool = null;
    this.syncLoadedWorldUI();
    this.redraw();
  }

  private startNewGame(): void {
    this.resetWorld();
    this.save(false);
    this.newGameSelectionPending = false;
    const templates = document.getElementById('templates-modal');
    if (templates) templates.hidden = true;
    this.selectTool(null);
    const layout = MAP_LAYOUTS.find((item) => item.id === this.mapLayoutId);
    this.setStatus('New game · ' + (layout?.label ?? 'Classic Island'));
  }

  private createRiverTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 256;
    const context = canvas.getContext('2d');

    if (context) {
      const gradient = context.createLinearGradient(0, 0, 128, 0);
      gradient.addColorStop(0, '#4ba9bd');
      gradient.addColorStop(0.45, '#5fc5d3');
      gradient.addColorStop(1, '#3f9fb7');
      context.fillStyle = gradient;
      context.fillRect(0, 0, 128, 256);

      context.globalAlpha = 0.34;
      context.strokeStyle = '#d9fbff';
      context.lineWidth = 3;
      for (let y = -24; y < 300; y += 34) {
        context.beginPath();
        context.moveTo(-10, y);
        context.bezierCurveTo(30, y - 10, 74, y + 12, 140, y - 4);
        context.stroke();
      }

      context.globalAlpha = 0.17;
      context.strokeStyle = '#ffffff';
      context.lineWidth = 1.5;
      for (let y = -12; y < 300; y += 21) {
        context.beginPath();
        context.moveTo(2, y);
        context.quadraticCurveTo(62, y + 8, 126, y - 3);
        context.stroke();
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1.25, 3.2);
    texture.anisotropy = 4;
    return texture;
  }

  private createOceanTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext('2d');

    if (context) {
      const gradient = context.createLinearGradient(0, 0, 256, 256);
      gradient.addColorStop(0, '#0d667f');
      gradient.addColorStop(0.42, '#167f96');
      gradient.addColorStop(1, '#084f6b');
      context.fillStyle = gradient;
      context.fillRect(0, 0, 256, 256);

      context.globalAlpha = 0.18;
      for (let i = 0; i < 16; i += 1) {
        const y = i * 18 - 8;
        context.strokeStyle = i % 3 === 0 ? '#d7fbff' : '#78d8e0';
        context.lineWidth = i % 3 === 0 ? 2 : 1;
        context.beginPath();
        context.moveTo(-20, y);
        context.bezierCurveTo(52, y - 8, 118, y + 10, 286, y - 2);
        context.stroke();
      }

      context.globalAlpha = 0.12;
      for (let i = 0; i < 40; i += 1) {
        const x = (i * 67) % 256;
        const y = (i * 103) % 256;
        context.fillStyle = i % 2 === 0 ? '#ffffff' : '#022c42';
        context.beginPath();
        context.ellipse(x, y, 8 + (i % 5), 1.6 + (i % 3), 0.2, 0, Math.PI * 2);
        context.fill();
      }

      context.globalAlpha = 1;
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(5.2, 5.2);
    texture.anisotropy = 4;
    return texture;
  }

  private addLights(): void {
    const sky = new THREE.HemisphereLight(WORLD_STYLE.lighting.sky, WORLD_STYLE.lighting.ground, 1.2);
    this.scene.add(sky);

    const sun = new THREE.DirectionalLight(WORLD_STYLE.lighting.sun, WORLD_STYLE.lighting.sunIntensity);
    sun.position.set(48, 92, 26);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -82;
    sun.shadow.camera.right = 82;
    sun.shadow.camera.top = 82;
    sun.shadow.camera.bottom = -82;
    sun.shadow.camera.near = 8;
    sun.shadow.camera.far = 220;
    sun.shadow.bias = -0.00018;
    sun.shadow.normalBias = 0.035;
    sun.shadow.radius = 3;
    this.scene.add(sun);

    const coolFill = new THREE.DirectionalLight(WORLD_STYLE.lighting.fill, WORLD_STYLE.lighting.fillIntensity);
    coolFill.position.set(-50, 34, -42);
    this.scene.add(coolFill);

    const warmBounce = new THREE.PointLight(WORLD_STYLE.lighting.bounce, WORLD_STYLE.lighting.bounceIntensity, 95, 2);
    warmBounce.position.set(22, 12, 34);
    this.scene.add(warmBounce);
  }

  private createWorld(): void {
    const deepWater = new THREE.Mesh(
      new THREE.CircleGeometry(WORLD * 0.86, 112),
      this.oceanWaterMaterial,
    );
    deepWater.rotation.x = -Math.PI / 2;
    deepWater.position.y = -0.55;
    deepWater.receiveShadow = true;
    deepWater.userData.waterLayer = 'deep';
    this.scene.add(deepWater);

    // A continuous shallow-water shelf sits below every possible layout.
    // The authoritative land surface is rebuilt from the same tile generator
    // used by terrain, selection and navigation.
    const shallowWater = new THREE.Mesh(
      new THREE.CircleGeometry(WORLD * 0.69, 112),
      this.shallowWaterMaterial,
    );
    shallowWater.rotation.x = -Math.PI / 2;
    shallowWater.position.y = 0.95;
    shallowWater.receiveShadow = true;
    shallowWater.userData.waterLayer = 'shallow';
    this.scene.add(shallowWater);

    this.scene.add(this.worldLayoutLayer);
    this.rebuildWorldLayoutSurface();

    const grid = new THREE.GridHelper(WORLD, SIZE, 0xe8f7ff, 0x7eb8bd);
    grid.position.y = 2.18;
    (grid.material as THREE.Material).opacity = 0.075;
    (grid.material as THREE.Material).transparent = true;
    this.scene.add(grid);
  }

  private rebuildWorldLayoutSurface(): void {
    this.clearGroup(this.worldLayoutLayer);

    const land: GridPoint[] = [];
    const grass: GridPoint[] = [];
    const shore: GridPoint[] = [];

    for (let y = 0; y < SIZE; y += 1) {
      for (let x = 0; x < SIZE; x += 1) {
        const terrain = this.baseTerrainAt(x, y);
        if (terrain === 'water' || terrain === 'river') continue;
        land.push({ x, y });
        if (terrain === 'shore') shore.push({ x, y });
        else grass.push({ x, y });
      }
    }

    const soilMaterial = this.environmentMaterial('layout-soil', WORLD_STYLE.palette.soil, 1);
    const grassMaterial = this.environmentMaterial('layout-grass', WORLD_STYLE.palette.grassSunlit, 0.94);
    const shoreMaterial = this.environmentMaterial('layout-shore', 0xb8a878, 0.98);
    const matrix = new THREE.Matrix4();

    if (land.length > 0) {
      const soil = new THREE.InstancedMesh(
        new THREE.BoxGeometry(TILE * 1.015, 1.55, TILE * 1.015),
        soilMaterial,
        land.length,
      );
      land.forEach((point, index) => {
        const world = this.gridToWorld(point.x, point.y);
        matrix.makeTranslation(world.x, 1.31, world.z);
        soil.setMatrixAt(index, matrix);
      });
      soil.instanceMatrix.needsUpdate = true;
      soil.receiveShadow = true;
      this.worldLayoutLayer.add(soil);
    }

    if (grass.length > 0) {
      const top = new THREE.InstancedMesh(
        new THREE.BoxGeometry(TILE * 1.012, 0.16, TILE * 1.012),
        grassMaterial,
        grass.length,
      );
      grass.forEach((point, index) => {
        const world = this.gridToWorld(point.x, point.y);
        matrix.makeTranslation(world.x, 2.125, world.z);
        top.setMatrixAt(index, matrix);
      });
      top.instanceMatrix.needsUpdate = true;
      top.receiveShadow = true;
      this.worldLayoutLayer.add(top);
    }

    if (shore.length > 0) {
      const top = new THREE.InstancedMesh(
        new THREE.BoxGeometry(TILE * 1.012, 0.12, TILE * 1.012),
        shoreMaterial,
        shore.length,
      );
      shore.forEach((point, index) => {
        const world = this.gridToWorld(point.x, point.y);
        matrix.makeTranslation(world.x, 2.105, world.z);
        top.setMatrixAt(index, matrix);
      });
      top.instanceMatrix.needsUpdate = true;
      top.receiveShadow = true;
      this.worldLayoutLayer.add(top);
    }
  }

  private baseTerrainAt(x: number, y: number): TerrainKind {
    return terrainForMapLayout(this.mapLayoutId, x, y, SIZE);
  }

  private terrainAt(x: number, y: number): TerrainKind {
    return this.terrainOverrides.get(this.key(x, y)) ?? this.baseTerrainAt(x, y);
  }

  private baseTerrainElevation(x: number, y: number): number {
    const terrain = this.terrainAt(x, y);
    if (terrain === 'mountain') return 0.9;
    return 0;
  }

  private terrainElevation(x: number, y: number): number {
    return this.baseTerrainElevation(x, y) + (this.elevationOverrides.get(this.key(x, y)) ?? 0);
  }

  private normalizeRiverElevationAt(x: number, y: number): void {
    if (this.terrainAt(x, y) !== 'river') return;
    const key = this.key(x, y);
    if ((this.elevationOverrides.get(key) ?? 0) < 0) {
      this.elevationOverrides.delete(key);
    }
  }

  private normalizeRiverElevations(): void {
    for (const [key, value] of this.elevationOverrides.entries()) {
      if (value >= 0) continue;
      const [x, y] = key.split(',').map(Number);
      if (
        !Number.isInteger(x) ||
        !Number.isInteger(y) ||
        x < 0 ||
        y < 0 ||
        x >= SIZE ||
        y >= SIZE
      ) {
        continue;
      }
      this.normalizeRiverElevationAt(x, y);
    }
  }

  private setAbsoluteElevation(x: number, y: number, absolute: number): void {
    const clamped = THREE.MathUtils.clamp(absolute, -1.6, 6);
    const offset = clamped - this.baseTerrainElevation(x, y);
    if (Math.abs(offset) < 0.02) this.elevationOverrides.delete(this.key(x, y));
    else this.elevationOverrides.set(this.key(x, y), offset);
  }

  /**
   * Terrain protection is derived from live structure anchors rather than cached.
   * Save/load therefore reconstructs it automatically, and erasing the fortress
   * releases the footprint immediately.
   */
  private isStructureFootprintReserved(x: number, y: number): boolean {
    for (const anchor of this.services.state.entries()) {
      const footprint = getStructureFootprint(anchor.kind, anchor.x, anchor.y);
      if (footprint.length <= 1) continue;
      if (footprint.some((cell) => cell.x === x && cell.y === y)) return true;
    }
    return false;
  }

  private canEditTerrainAt(x: number, y: number): boolean {
    return !this.isStructureFootprintReserved(x, y);
  }

  private isTerrainTool(tool: ToolKind): tool is TerrainToolKind {
    return ['raise', 'lower', 'flatten', 'smooth', 'hill', 'cliff'].includes(tool);
  }

  private gridToWorld(gx: number, gy: number): { x: number; z: number } {
    return {
      x: (gx - SIZE / 2 + 0.5) * TILE,
      z: (gy - SIZE / 2 + 0.5) * TILE,
    };
  }

  private seedNaturalProps(): void {
    const seed = Math.trunc(this.worldSeed);
    for (let y = 0; y < SIZE; y += 1) {
      for (let x = 0; x < SIZE; x += 1) {
        if (this.services.state.getCell(x, y)) continue;

        const terrain = this.baseTerrainAt(x, y);
        const h1 = Math.abs((x * 92821 + y * 68917 + x * y * 137 + seed * 193) % 997);
        const h2 = Math.abs((x * 53 + y * 97 + x * y * 11 + seed * 17) % 101);

        if (terrain === 'forest') {
          const clearing = ((x - 5) * (x - 5) + (y - 12) * (y - 12)) < 7;
          if (!clearing && h1 % 5 !== 0) {
            this.services.state.setCell(x, y, 'tree', 1 + (h2 % 3));
          } else if (h2 % 9 === 0) {
            this.services.state.setCell(x, y, 'rock', 1);
          }
          continue;
        }

        if (terrain === 'shore') {
          if (h2 % 8 === 0) this.services.state.setCell(x, y, 'rock', 1 + (h1 % 2));
          else if (h2 % 11 === 0) this.services.state.setCell(x, y, 'tree', 1);
          continue;
        }

        if (terrain === 'mountain') {
          if (h2 % 4 === 0) this.services.state.setCell(x, y, 'rock', 1 + (h1 % 3));
          continue;
        }

        if (terrain === 'plains') {
          if (h1 % 31 === 5 && x > 3 && y > 3) {
            this.services.state.setCell(x, y, 'hut', 1);
          } else if (h1 % 23 === 7 && h2 % 3 !== 0) {
            this.services.state.setCell(x, y, 'tree', 1 + (h2 % 2));
          } else if (h1 % 41 === 3) {
            this.services.state.setCell(x, y, 'rock', 1);
          }
        }
      }
    }
  }

  private createWorkers(): void {
    const workerMaterial = new THREE.MeshStandardMaterial({ color: 0xd58a54, roughness: 0.9 });
    const skinMaterial = new THREE.MeshStandardMaterial({ color: 0xe8bf97, roughness: 0.9 });
    const hatMaterial = new THREE.MeshStandardMaterial({ color: 0xd8bd59, roughness: 0.85 });

    for (let i = 0; i < 3; i += 1) {
      const view = new THREE.Group();

      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.33, 0.78, 7), workerMaterial);
      body.position.y = 2.75;
      body.castShadow = true;
      view.add(body);

      const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 7), skinMaterial);
      head.position.y = 3.3;
      head.castShadow = true;
      view.add(head);

      const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.37, 0.3, 0.11, 9), hatMaterial);
      hat.position.y = 3.53;
      hat.castShadow = true;
      view.add(hat);

      const homeX = -4 + i * 2.1;
      const homeZ = 5.5;
      view.position.set(homeX, 0, homeZ);
      this.workerLayer.add(view);
      this.workers.push({
        id: i,
        view,
        homeX,
        homeZ,
        path: [],
        pathIndex: 0,
        repathMs: 0,
      });
    }
  }

  private clearGroup(group: THREE.Group): void {
    group.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.geometry && mesh.geometry !== this.settlementUnitBox) mesh.geometry.dispose();

      const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(material)) {
        for (const item of material) {
          if (
            item !== this.riverWaterMaterial &&
            item !== this.oceanWaterMaterial &&
            item !== this.shallowWaterMaterial &&
            !this.medievalMaterials.isSharedMaterial(item) &&
            !this.isPlanMaterial(item) &&
            !this.isEnvironmentMaterial(item)
          ) {
            item.dispose();
          }
        }
      } else if (
        material &&
        material !== this.riverWaterMaterial &&
        material !== this.oceanWaterMaterial &&
        material !== this.shallowWaterMaterial &&
        !this.medievalMaterials.isSharedMaterial(material) &&
        !this.isPlanMaterial(material) &&
        !this.isEnvironmentMaterial(material)
      ) {
        material.dispose();
      }
    });
    group.clear();
  }


  private syncPopulationDefenseAssignments(
    cells: ReturnType<GameState['entries']> = this.services.state.entries(),
  ): boolean {
    this.services.populationSystem.reconcile(cells);
    const battleSystem = (this as unknown as { battleSystem?: BattleSystem }).battleSystem;
    if (battleSystem?.isActive()) return false;

    // Camp construction/upgrade defines the guard roster; the player never edits it.
    // Dedicated camp guards do not consume civilian housing or jobs.
    this.services.populationSystem.setMilitiaComposition({
      swordsman: 0, archer: 0, spearman: 0, crossbowman: 0,
    });
    const capacity = this.services.populationSystem.professionalArmyCapacity(cells);
    this.services.populationSystem.setProfessionalArmyCount(capacity, cells);
    const garrison = this.services.populationSystem.professionalArmyComposition();
    const next: BattleSetup = {
      ...this.battleSetup,
      defenderSwordsmen: garrison.swordsman,
      defenderArchers: garrison.archer,
      defenderSpearmen: garrison.spearman,
      defenderCrossbowmen: garrison.crossbowman,
      defenderModernSoldiers: 0,
    };
    const changed =
      next.defenderSwordsmen !== this.battleSetup.defenderSwordsmen ||
      next.defenderArchers !== this.battleSetup.defenderArchers ||
      next.defenderSpearmen !== this.battleSetup.defenderSpearmen ||
      next.defenderCrossbowmen !== this.battleSetup.defenderCrossbowmen ||
      next.defenderModernSoldiers !== this.battleSetup.defenderModernSoldiers;
    this.battleSetup = next;
    return changed;
  }


  private syncIdleDefenderGarrison(force = false): void {
    const battleSystem = (this as unknown as { battleSystem?: BattleSystem }).battleSystem;
    if (!battleSystem || battleSystem.isActive()) return;
    battleSystem.prepareDefenders(this.battleSetup, this.militaryTier, force);
  }

  private redraw(): void {
    const redrawStart = this.visualBenchmark ? performance.now() : 0;
    this.ambientMotion.clearSceneBound();
    this.clearGroup(this.terrainLayer);
    this.clearGroup(this.buildLayer);
    this.services.gateSystem.clear();
    this.services.windmillSystem.clear();
    this.buildObjectsByCell.clear();
    this.constructionObjects.clear();
    this.clearGroup(this.planLayer);
    this.renderTerrain();

    const floodedMoats = this.computeFloodedMoats();
    const cells = this.services.state.entries();
    this.rebuildAmbientFauna();
    const castleSnapshot = this.castleBlockSystem.build(cells, this.stoneStyle, (x, y) => this.terrainElevation(x, y));
    const castleBlocks = new Map(castleSnapshot.blocks.map((block) => [this.key(block.x, block.y), block]));
    this.castleBlocksByCell = castleBlocks;

    for (const cell of cells) {
      const building = this.makeBuilding(cell, floodedMoats);
      building.userData.cellKey = this.key(cell.x, cell.y);
      building.userData.cellKind = cell.kind;
      const castleBlock = castleBlocks.get(this.key(cell.x, cell.y));
      if (castleBlock?.kind === 'wall') instanceStaticCastleBoxes(building);
      if (castleBlock) building.userData.castleBlock = castleBlock;
      this.buildObjectsByCell.set(this.key(cell.x, cell.y), building);
      this.constructionObjects.set(`cell:${cell.x},${cell.y}`, building);
      this.buildLayer.add(building);
    }

    for (const keep of this.services.keepSystem.entries()) {
      const renderedKeep = this.keepRenderer.render(keep, {
          tileSize: TILE,
          toWorld: (x, y) => this.gridToWorld(x, y),
          elevationAt: (x, y) => this.terrainElevation(x, y),
          terrainAt: (x, y) => this.terrainAt(x, y),
          kindAt: (x, y) => this.kindAt(x, y),
          stoneStyle: this.stoneStyle,
        });
      instanceStaticCastleBoxes(renderedKeep);
      this.constructionObjects.set(`keep:${keep.id}`, renderedKeep);
      this.buildLayer.add(renderedKeep);
    }

    for (const bridge of this.towerBridges.values()) {
      const renderedBridge = this.makeTowerBridge(bridge);
      this.constructionObjects.set(`bridge:${bridge.id}`, renderedBridge);
      this.buildLayer.add(renderedBridge);
    }


    for (const weapon of BattleSystem.wallWeaponPositions(
      SIZE,
      (x, y) => this.services.state.getCell(x, y),
    )) {
      const cell = this.services.state.getCell(weapon.x, weapon.y);
      if (!cell) continue;
      this.buildLayer.add(this.makeWallWeaponVisual(weapon.x, weapon.y, weapon.direction, cell));
    }

    for (const task of this.moatTasks.values()) {
      const pending = new THREE.Group();
      const position = this.gridToWorld(task.x, task.y);
      pending.position.set(position.x, 0, position.z);

      const marker = new THREE.MeshStandardMaterial({
        color: 0xe6bb74,
        transparent: true,
        opacity: 0.48,
        roughness: 1,
      });
      this.addBox(pending, 3.5, 0.12, 3.5, marker, 0, 2.22, 0);
      this.buildLayer.add(pending);
    }

    this.renderPlanLayer(cells);
    this.renderMinimap();
    this.syncPopulationDefenseAssignments(cells);
    this.reconcileSettlementAgents(cells);
    this.updatePopulationUI();
    this.syncEconomyUI();
    this.syncArmyCampUpgradeUI();
    this.syncIdleDefenderGarrison();
    this.syncSelectedGateButton();

    this.buildLayer.traverse((object) => {
      if (object.userData.castleFlag) {
        const phase = Number(object.userData.castleFlag?.phase ?? 0);
        this.ambientMotion.registerFlag(object, phase);
      }
      if (object.userData.ambientSway) {
        const sway = object.userData.ambientSway as {
          phase?: number;
          amplitude?: number;
          speed?: number;
        };
        this.ambientMotion.registerSway(
          object,
          Number(sway.phase ?? 0),
          Number(sway.amplitude ?? 0.02),
          Number(sway.speed ?? 0.001),
        );
      }
    });
    this.distanceDetailBudget.invalidate();
    this.constructionAnimation.rebind((key) => this.constructionObjects.get(key));
    if (this.visualBenchmark) this.lastRedrawMs = performance.now() - redrawStart;
  }

  /** Replace only wall meshes whose connection form can change after a cell edit. */
  private redrawCastleNeighborhood(points: GridPoint[]): void {
    if (this.battleSystem?.isActive()) {
      this.redraw();
      return;
    }
    const affected = new Set<string>();
    for (const point of points) {
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          affected.add(this.key(point.x + dx, point.y + dy));
        }
      }
    }
    const cells = this.services.state.entries();
    const byKey = new Map(cells.map((cell) => [this.key(cell.x, cell.y), cell]));
    const snapshot = this.castleBlockSystem.build(cells, this.stoneStyle, (x, y) => this.terrainElevation(x, y));
    const nextBlocks = new Map(snapshot.blocks.map((block) => [this.key(block.x, block.y), block]));
    // Gates, towers and mounted weapons own additional runtime objects; rebuild those safely.
    const weapons = BattleSystem.wallWeaponPositions(SIZE, (x, y) => this.services.state.getCell(x, y));
    if ([...affected].some((key) => {
      const oldKind = this.buildObjectsByCell.get(key)?.userData.cellKind as TileKind | undefined;
      const nextKind = byKey.get(key)?.kind;
      return (oldKind && !WALL_KINDS.includes(oldKind as WallKind)) ||
        (nextKind && !WALL_KINDS.includes(nextKind as WallKind));
    }) || weapons.some((weapon) => affected.has(this.key(weapon.x, weapon.y)))) {
      this.redraw();
      return;
    }
    this.castleBlocksByCell = nextBlocks;
    const floodedMoats = this.computeFloodedMoats();
    for (const key of affected) {
      const old = this.buildObjectsByCell.get(key);
      if (old) {
        this.ambientMotion.unregisterSubtree(old);
        this.buildLayer.remove(old);
        this.clearGroup(old as THREE.Group);
        this.buildObjectsByCell.delete(key);
        this.constructionObjects.delete(`cell:${key}`);
      }
      const cell = byKey.get(key);
      if (!cell) continue;
      const building = this.makeBuilding(cell, floodedMoats);
      building.userData.cellKey = key;
      building.userData.cellKind = cell.kind;
      building.userData.castleBlock = nextBlocks.get(key);
      if (nextBlocks.get(key)?.kind === 'wall') instanceStaticCastleBoxes(building);
      this.buildObjectsByCell.set(key, building);
      this.constructionObjects.set(`cell:${key}`, building);
      this.buildLayer.add(building);
      building.traverse((object) => {
        if (object.userData.castleFlag) this.ambientMotion.registerFlag(object, Number(object.userData.castleFlag.phase ?? 0));
        if (object.userData.ambientSway) {
          const sway = object.userData.ambientSway as { phase?: number; amplitude?: number; speed?: number };
          this.ambientMotion.registerSway(object, Number(sway.phase ?? 0), Number(sway.amplitude ?? 0.02), Number(sway.speed ?? 0.001));
        }
      });
    }
    this.clearGroup(this.planLayer);
    this.renderPlanLayer(cells);
    this.renderMinimap();
    this.distanceDetailBudget.invalidate();
    this.constructionAnimation.rebind((key) => this.constructionObjects.get(key));
    this.rebuildAmbientFauna();
  }

  private rebuildAmbientFauna(): void {
    this.ambientFauna.rebuild({
      size: SIZE,
      seed: this.worldSeed,
      terrainAt: (x, y) => this.terrainAt(x, y),
      elevationAt: (x, y) => this.terrainElevation(x, y),
      blockedAt: (x, y) => Boolean(this.services.state.getCell(x, y) ||
        this.services.keepSystem.findAtCell(x, y) || this.isStructureFootprintReserved(x, y)),
      farmAt: (x, y) => this.services.state.getCell(x, y)?.kind === 'farm',
      toWorld: (x, y) => this.gridToWorld(x, y),
    }, this.settingsStore.get().graphics.quality);
  }

  private startConstruction(key: string, duration = 850): void {
    const object = this.constructionObjects.get(key);
    if (!object || this.viewMode === 'plan2d') return;
    this.constructionAnimation.start(key, object, performance.now(), duration);
    audioEvents.emit({ action: 'play_sfx', assetId: 'building.started' });
  }

  private renderMinimap(): void {
    const canvas = document.getElementById('minimap-canvas') as HTMLCanvasElement | null;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    // One tile per map cell keeps the map deterministic and cheap on redraw.
    canvas.width = canvas.height = SIZE;
    const palette = WORLD_STYLE.palette;
    const terrainColors: Record<TerrainKind, number> = {
      water: palette.deepWater,
      river: palette.riverWater,
      shore: palette.shoreSand,
      plains: palette.grassSunlit,
      forest: palette.grassForest,
      mountain: palette.terrainRock,
    };
    const color = (value: number) => `#${value.toString(16).padStart(6, '0')}`;
    for (let y = 0; y < SIZE; y += 1) {
      for (let x = 0; x < SIZE; x += 1) {
        const cell = this.services.state.getCell(x, y);
        const kind = cell?.kind;
        let tileColor = terrainColors[this.terrainAt(x, y)];
        if (kind === 'tree') tileColor = palette.foliageDark;
        else if (kind === 'farm' || kind === 'appleOrchard') tileColor = palette.soil;
        else if (kind === 'basilica') tileColor = SETTLEMENT_STYLE.stone;
        else if (kind && ROAD_KINDS.includes(kind as RoadKind)) tileColor = kind === 'stoneRoad' ? 0xc8c9b2 : 0x8f7151;
        else if (kind === 'gate' || kind === 'tower' || WALL_KINDS.includes(kind as WallKind)) tileColor = 0xc8c9b2;
        else if (kind && kind !== 'rock' && kind !== 'mountain') tileColor = 0xc96b3e;
        context.fillStyle = color(tileColor);
        context.fillRect(x, y, 1, 1);
      }
    }
    context.fillStyle = '#7043a5';
    for (const keep of this.services.keepSystem.entries()) context.fillRect(keep.x, keep.y, 2, 2);
    if (this.selectedCell) {
      context.fillStyle = '#ffffff';
      context.fillRect(this.selectedCell.x, this.selectedCell.y, 1, 1);
    }
    // A small contrasting ring remains legible over land, water and landmarks.
    context.strokeStyle = '#102536';
    context.lineWidth = 1;
    context.strokeRect(this.minimapCursor.x - 1.5, this.minimapCursor.y - 1.5, 4, 4);
    context.strokeStyle = '#8ce6ff';
    context.strokeRect(this.minimapCursor.x - 0.5, this.minimapCursor.y - 0.5, 2, 2);
  }

  private getWallWeaponVisuals(): THREE.Object3D[] {
    const result: THREE.Object3D[] = [];
    this.buildLayer.traverse((object) => {
      if (object.userData.wallWeapon) result.push(object);
    });
    return result;
  }

  private makeWallWeaponVisual(
    gx: number,
    gy: number,
    direction: WallDirection,
    cell: GridCell,
  ): THREE.Group {
    const group = new THREE.Group();
    const position = this.gridToWorld(gx, gy);
    const topY = this.fortificationTopLocal(cell);
    group.position.set(position.x, this.terrainElevation(gx, gy) + topY - 0.12, position.z);
    group.rotation.y = WallSystem.worldAngle(direction);

    const mount = new THREE.MeshStandardMaterial({ color: 0x30383c, roughness: 0.72, metalness: 0.42 });
    const barrel = new THREE.MeshStandardMaterial({ color: 0x171c1f, roughness: 0.48, metalness: 0.68 });
    const accent = new THREE.MeshStandardMaterial({ color: 0x56656a, roughness: 0.58, metalness: 0.5 });

    this.addBox(group, 0.72, 0.16, 0.72, mount, 0, 0.05, 0);
    this.addBox(group, 0.18, 0.18, 0.72, accent, 0, 0.2, 0);

    const barrelMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.085, 1.05, 8), barrel);
    barrelMesh.rotation.x = Math.PI / 2;
    barrelMesh.position.set(0, 0.27, 0.48);
    barrelMesh.castShadow = true;
    group.add(barrelMesh);

    const sight = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.24), accent);
    sight.position.set(0, 0.39, 0.32);
    group.add(sight);
    group.userData.wallWeapon = { gx, gy, direction, range: 14 };
    return group;
  }

  private setBattleWallVisibility(x: number, y: number, visible: boolean): void {
    const object = this.buildObjectsByCell.get(this.key(x, y));
    if (!object) return;
    object.visible = visible;
  }

  private environmentMaterial(key: string, color: number, roughness = 0.95): THREE.MeshStandardMaterial {
    const existing = this.environmentMaterials.get(key);
    if (existing) return existing;

    const material = new THREE.MeshStandardMaterial({
      color,
      roughness,
      metalness: 0,
      flatShading: key.includes('rock'),
    });
    this.environmentMaterials.set(key, material);
    return material;
  }

  private seasonalColor(base: number, seasonal: number, strength: number): number {
    return new THREE.Color(base).lerp(new THREE.Color(seasonal), THREE.MathUtils.clamp(strength, 0, 1)).getHex();
  }

  private applyEnvironmentVisuals(force = false): void {
    const state = this.environmentSystem.visualState();
    const background = new THREE.Color(state.sky);
    if (this.scene.background instanceof THREE.Color) this.scene.background.lerp(background, force ? 1 : 0.08);
    if (this.scene.fog instanceof THREE.Fog) this.scene.fog.color.lerp(new THREE.Color(state.fog), force ? 1 : 0.08);

    this.scene.traverse((object) => {
      if (object instanceof THREE.DirectionalLight && object.castShadow) {
        object.color.lerp(new THREE.Color(state.sunlight), force ? 1 : 0.08);
        object.intensity = THREE.MathUtils.lerp(object.intensity, state.sunIntensity, force ? 1 : 0.08);
      }
    });

    const seasonalKeys: Array<[string, number, number]> = [
      ['layout-grass', state.grass, 0.78],
      ['filled-grass', state.grass, 0.72],
      ['terrain-elev-grass', state.grass, 0.72],
      ['grass-plains-0', state.grass, 0.82],
      ['grass-plains-1', state.grass, 0.82],
      ['grass-plains-2', state.grass, 0.82],
      ['grass-forest-0', state.foliage, 0.7],
      ['grass-forest-1', state.foliage, 0.7],
      ['grass-forest-2', state.foliage, 0.7],
      ['farm-crop-green', state.crop, 0.88],
      ['farm-crop-gold', state.crop, 0.62],
      ['farm-crop-young', state.crop, 0.82],
      ['tree-foliage-0', state.foliage, 0.9],
      ['tree-foliage-1', state.foliage, 0.82],
      ['tree-foliage-2', state.foliage, 0.88],
    ];
    for (const [key, target, strength] of seasonalKeys) {
      const material = this.environmentMaterials.get(key);
      if (!material) continue;
      const current = material.color.getHex();
      material.color.setHex(this.seasonalColor(current, target, force ? strength : strength * 0.08));
    }
  }

  private updateEnvironment(deltaMs: number): void {
    this.environmentSystem.advance(deltaMs);
    this.environmentRefreshMs -= deltaMs;
    if (this.environmentRefreshMs <= 0) {
      this.environmentRefreshMs = 250;
      this.applyEnvironmentVisuals(false);
    }
  }

  private isEnvironmentMaterial(material: THREE.Material): boolean {
    for (const candidate of this.environmentMaterials.values()) {
      if (candidate === material) return true;
    }
    return false;
  }

  private isPlanMaterial(material: THREE.Material): boolean {
    for (const candidate of this.planMaterials.values()) {
      if (candidate === material) return true;
    }
    return false;
  }

  private planMaterial(color: number, opacity = 1): THREE.MeshBasicMaterial {
    const key = `${color}:${opacity.toFixed(2)}`;
    const existing = this.planMaterials.get(key);
    if (existing) return existing;

    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: opacity < 1,
      opacity,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.planMaterials.set(key, material);
    return material;
  }

  private addPlanRect(
    group: THREE.Group,
    width: number,
    depth: number,
    color: number,
    x: number,
    z: number,
    y: number,
    opacity = 1,
    rotationY = 0,
  ): THREE.Mesh {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(width, depth),
      this.planMaterial(color, opacity),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = -rotationY;
    mesh.position.set(x, y, z);
    mesh.renderOrder = 40;
    group.add(mesh);
    return mesh;
  }

  private renderPlanLayer(cells: ReturnType<GameState['entries']>): void {
    const terrainColors: Record<TerrainKind, number> = {
      water: WORLD_STYLE.palette.deepWater,
      shore: WORLD_STYLE.palette.shoreSand,
      plains: WORLD_STYLE.palette.grassSunlit,
      river: WORLD_STYLE.palette.riverWater,
      mountain: WORLD_STYLE.palette.terrainRock,
      forest: WORLD_STYLE.palette.grassForest,
    };

    for (let y = 0; y < SIZE; y += 1) {
      for (let x = 0; x < SIZE; x += 1) {
        const position = this.gridToWorld(x, y);
        const terrain = this.terrainAt(x, y);
        const elevation = this.terrainElevation(x, y);
        const tone = styleTone(elevation);
        const base = new THREE.Color(terrainColors[terrain]).multiplyScalar(tone);
        this.addPlanRect(
          this.planLayer,
          TILE - 0.08,
          TILE - 0.08,
          base.getHex(),
          position.x,
          position.z,
          10,
          0.96,
        );
      }
    }

    const grid = new THREE.GridHelper(WORLD, SIZE, 0xe7f6ef, 0x1f3d46);
    grid.position.y = 10.04;
    grid.renderOrder = 41;
    const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material];
    for (const material of gridMaterials) {
      material.transparent = true;
      material.opacity = 0.32;
      material.depthTest = false;
      material.depthWrite = false;
    }
    this.planLayer.add(grid);

    const colors: Record<string, number> = {
      wall1: 0xd1c2a3,
      wall2: 0x8e6544,
      wall3: 0x9ba4a7,
      gate: 0x9e7041,
      tower: 0xb7ab91,
      road: 0x9a7658,
      dirtRoad: 0x8a6142,
      stoneRoad: 0xa9a195,
      harbor: 0x6a5038,
      cottage: 0xd69f78,
      house: 0xb899ce,
      manor: 0xc97888,
      villa: 0x70b4ac,
      farm: 0xc2ad54,
      appleOrchard: 0x9c6d3e,
      armyCamp: 0x8f6b4d,
      basilica: 0xd8d2bd,
      mosque: 0xb98a5b,
      mine: 0x665f59,
      mountain: 0x71675f,
      tree: 0x356c43,
      rock: 0x77736f,
      hut: 0x9d6845,
      moat: 0x317f9d,
      stoneStairs: 0xb7afa4,
      woodenStairs: 0x805b3d,
      ramp: 0xa49b8e,
      ladder: 0x755039,
    };

    for (const cell of cells) {
      const position = this.gridToWorld(cell.x, cell.y);
      const color = colors[cell.kind] ?? 0xe6d9be;

      if (WALL_KINDS.includes(cell.kind as WallKind)) {
        const thickness = this.wallThicknessValue(
          cell.kind as WallKind,
          cell.thickness ?? 'medium',
        );
        this.addPlanRect(
          this.planLayer,
          thickness * 0.9,
          thickness * 0.9,
          color,
          position.x,
          position.z,
          10.22,
        );

        const links = this.wallConnections(cell.x, cell.y, cell);
        const directions = links.length > 0 ? links : (['E', 'W'] as WallDirection[]);
        for (const direction of directions) {
          const vector = WallSystem.vector(direction);
          const length = (TILE * Math.hypot(vector.x, vector.y)) / 2 + 0.35;
          const angle = WallSystem.worldAngle(direction);
          const centerX = position.x + vector.x * TILE * 0.25;
          const centerZ = position.z + vector.y * TILE * 0.25;
          this.addPlanRect(
            this.planLayer,
            thickness * 0.78,
            length,
            color,
            centerX,
            centerZ,
            10.2,
            1,
            angle,
          );
        }
        continue;
      }

      if (cell.kind === 'tower') {
        const radius = (cell.towerShape ?? 'round') === 'watch' ? 1.7 : 2.08;
        const tower = new THREE.Mesh(
          new THREE.CircleGeometry(
            radius,
            (cell.towerShape ?? 'round') === 'octagonal' ? 8 : 20,
          ),
          this.planMaterial(color),
        );
        tower.position.set(position.x, 0.08, position.z);
        this.planLayer.add(tower);
        continue;
      }

      if (cell.kind === 'gate') {
        this.addPlanRect(this.planLayer, 3.5, 2.1, color, position.x, position.z, 10.28);
        this.addPlanRect(this.planLayer, 1.55, 2.28, 0x29231f, position.x, position.z, 10.3);
        continue;
      }

      const size =
        cell.kind === 'road' ? 2.0 :
        cell.kind === 'tree' || cell.kind === 'rock' ? 1.25 :
        cell.kind === 'farm' || cell.kind === 'appleOrchard' || cell.kind === 'armyCamp' ? 3.5 :
        cell.kind === 'basilica' || cell.kind === 'mosque' ? 3.4 :
        cell.kind === 'moat' ? 3.65 :
        2.7;

      this.addPlanRect(
        this.planLayer,
        size,
        size,
        color,
        position.x,
        position.z,
        10.18,
        cell.kind === 'road' ? 0.92 : 0.97,
        (cell.rotation ?? 0) * Math.PI / 2,
      );
    }

    for (const keep of this.services.keepSystem.entries()) {
      const rotated = keep.rotation % 2 !== 0;
      const widthCells = rotated ? keep.depth : keep.width;
      const depthCells = rotated ? keep.width : keep.depth;
      const position = this.gridToWorld(keep.x, keep.y);
      const width = widthCells * TILE * 0.9;
      const depth = depthCells * TILE * 0.9;

      this.addPlanRect(
        this.planLayer,
        width,
        depth,
        0xb8aa90,
        position.x,
        position.z,
        10.34,
      );
      this.addPlanRect(
        this.planLayer,
        Math.max(1.4, width - 1.2),
        Math.max(1.4, depth - 1.2),
        0x817766,
        position.x,
        position.z,
        10.36,
        0.78,
      );

      if (keep.cornerTowers) {
        const cornerX = width / 2 - 0.55;
        const cornerZ = depth / 2 - 0.55;
        for (const [dx, dz] of [
          [-cornerX, -cornerZ],
          [cornerX, -cornerZ],
          [-cornerX, cornerZ],
          [cornerX, cornerZ],
        ] as Array<[number, number]>) {
          const tower = new THREE.Mesh(
            new THREE.CircleGeometry(0.7, 12),
            this.planMaterial(0xd0c2a6),
          );
          tower.rotation.x = -Math.PI / 2;
          tower.position.set(position.x + dx, 10.4, position.z + dz);
          tower.renderOrder = 46;
          this.planLayer.add(tower);
        }
      }
    }

    if (this.selectedCell) {
      const selected = this.gridToWorld(this.selectedCell.x, this.selectedCell.y);
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(TILE * 0.36, TILE * 0.45, 4),
        this.planMaterial(0x71e8ff, 0.9),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.rotation.z = Math.PI / 4;
      ring.position.set(selected.x, 10.5, selected.z);
      ring.renderOrder = 50;
      this.planLayer.add(ring);
    }
  }

  private enforceGameplayCameraBounds(): void {
    if (this.visualBenchmark) return;

    const limit = Math.max(0, WORLD / 2 - WORLD_STYLE.camera.targetPadding);
    const previousTarget = this.controls.target.clone();
    const clampedTarget = previousTarget.clone();
    clampedTarget.x = THREE.MathUtils.clamp(clampedTarget.x, -limit, limit);
    clampedTarget.y = THREE.MathUtils.clamp(
      clampedTarget.y,
      WORLD_STYLE.camera.minTargetY,
      WORLD_STYLE.camera.maxTargetY,
    );
    clampedTarget.z = THREE.MathUtils.clamp(clampedTarget.z, -limit, limit);

    if (!clampedTarget.equals(previousTarget)) {
      const offset = this.camera.position.clone().sub(previousTarget);
      this.controls.target.copy(clampedTarget);
      this.camera.position.copy(clampedTarget).add(offset);
    }

    const offset = this.camera.position.clone().sub(this.controls.target);
    const distance = offset.length();
    const clampedDistance = THREE.MathUtils.clamp(
      distance,
      WORLD_STYLE.camera.minDistance,
      WORLD_STYLE.camera.maxDistance,
    );
    if (distance > 0.0001 && Math.abs(distance - clampedDistance) > 0.001) {
      offset.setLength(clampedDistance);
      this.camera.position.copy(this.controls.target).add(offset);
    }
  }

  private resetGameplayCameraReference(): void {
    this.saved3DTarget.set(0, 0, 0);
    this.saved3DCameraPosition.copy(WORLD_STYLE.camera.position);

    if (this.viewMode === 'world3d') {
      this.controls.target.copy(this.saved3DTarget);
      this.camera.position.copy(this.saved3DCameraPosition);
      this.camera.lookAt(this.controls.target);
      this.controls.update();
      this.enforceGameplayCameraBounds();
    }
  }

  private setCameraView(view: '45' | 'top'): void {
    if (this.viewMode !== 'world3d' || this.battleSystem.isActive()) {
      this.setViewMode('world3d');
    }

    if (this.cameraTransitionFrame !== null) {
      cancelAnimationFrame(this.cameraTransitionFrame);
      this.cameraTransitionFrame = null;
    }

    const target = this.controls.target.clone();
    const offset = this.camera.position.clone().sub(target);
    const distance = THREE.MathUtils.clamp(offset.length(), this.controls.minDistance, this.controls.maxDistance);
    const horizontalDistance = Math.hypot(offset.x, offset.z);
    const azimuth = horizontalDistance > 0.0001 ? Math.atan2(offset.z, offset.x) : 0;

    const destination = new THREE.Vector3();
    if (view === 'top') {
      destination.set(target.x, target.y + distance, target.z);
    } else {
      const horizontalRadius = distance * Math.SQRT1_2;
      destination.set(
        target.x + Math.cos(azimuth) * horizontalRadius,
        target.y + horizontalRadius,
        target.z + Math.sin(azimuth) * horizontalRadius,
      );
    }
    const start = this.camera.position.clone();
    const duration = 280;
    const startedAt = performance.now();
    this.controls.enabled = false;

    const animateTransition = (time: number): void => {
      const progress = THREE.MathUtils.clamp((time - startedAt) / duration, 0, 1);
      const eased = 1 - Math.pow(1 - progress, 3);

      this.camera.position.lerpVectors(start, destination, eased);
      this.camera.lookAt(target);

      if (progress < 1) {
        this.cameraTransitionFrame = requestAnimationFrame(animateTransition);
        return;
      }

      this.camera.position.copy(destination);
      this.camera.lookAt(target);
      this.controls.target.copy(target);
      this.controls.enabled = true;
      this.controls.update();
      this.cameraTransitionFrame = null;
      this.setStatus(view === '45' ? '45° Camera View' : 'Top Camera View');
    };

    this.cameraTransitionFrame = requestAnimationFrame(animateTransition);
  }

  private setViewMode(mode: ViewMode): void {
    if (mode === 'plan2d' && this.battleSystem.isActive()) {
      this.setStatus('Battle Mode uses the 3D isometric battlefield');
      return;
    }

    if (mode === this.viewMode && mode === 'world3d') {
      this.updateViewModeUI();
      return;
    }

    if (mode === 'plan2d' && this.viewMode === 'world3d') {
      this.saved3DCameraPosition.copy(this.camera.position);
      this.saved3DTarget.copy(this.controls.target);
    }

    this.viewMode = mode;
    const planMode = mode === 'plan2d';

    this.planLayer.visible = planMode;
    this.terrainLayer.visible = !planMode;
    this.buildLayer.visible = !planMode;
    this.workerLayer.visible = !planMode;
    this.settlementLayer.visible = !planMode && !this.battleSystem.isActive();
    this.battleLayer.visible = !planMode;
    this.godModeLayer.visible = !planMode;
    this.godModeMarkerLayer.visible = !planMode;

    if (planMode) {
      this.camera.up.set(0, 1, 0);
      this.camera.position.set(0, WORLD_STYLE.camera.planDistance, 0.001);
      this.controls.target.set(0, 0, 0);
      this.controls.enableRotate = false;
      this.controls.enablePan = true;
      this.controls.touches.ONE = THREE.TOUCH.PAN;
      this.controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
      this.controls.minDistance = WORLD_STYLE.camera.minDistance;
      this.controls.maxDistance = WORLD_STYLE.camera.maxDistance;
      this.setStatus('2D Plan mode · design first, then switch to 3D');
    } else {
      this.camera.up.set(0, 1, 0);
      this.camera.position.copy(this.saved3DCameraPosition);
      this.controls.target.copy(this.saved3DTarget);
      this.controls.enableRotate = true;
      this.controls.enablePan = true;
      this.controls.touches.ONE = THREE.TOUCH.ROTATE;
      this.controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
      this.controls.minDistance = WORLD_STYLE.camera.minDistance;
      this.controls.maxDistance = WORLD_STYLE.camera.maxDistance;
      this.setStatus('3D View · inspect your built castle');
    }

    this.camera.lookAt(this.controls.target);
    this.controls.update();
    this.updateViewModeUI();
  }

  private updateViewModeUI(): void {
    const planButton = document.getElementById('view-2d-button');
    const worldButton = document.getElementById('view-3d-button');
    const badge = document.getElementById('scene-badge');
    const planMode = this.viewMode === 'plan2d';

    planButton?.classList.toggle('is-active', planMode);
    worldButton?.classList.toggle('is-active', !planMode);

    if (planButton) planButton.setAttribute('aria-pressed', String(planMode));
    if (worldButton) worldButton.setAttribute('aria-pressed', String(!planMode));
    if (badge) badge.textContent = planMode ? 'TOP-DOWN 2D PLAN' : 'REAL-TIME 3D WORLD';
  }

  private setToolbarOpen(open: boolean): void {
    if (open && this.battleSystem.isActive()) {
      this.setStatus('Construction is disabled during Battle Mode');
      return;
    }

    this.toolbarOpen = open;
    const toolbar = document.getElementById('toolbar');
    const opener = document.getElementById('toolbar-open');
    toolbar?.classList.toggle('is-collapsed', !open);

    if (opener) {
      opener.classList.toggle('is-visible', !open);
      opener.setAttribute('aria-expanded', String(open));
    }
    const mobileOpener = document.querySelector<HTMLButtonElement>('[data-mobile-proxy="toolbar-open"]');
    mobileOpener?.setAttribute('aria-expanded', String(open));
    if (open && document.documentElement.classList.contains('mobile-ui-active')) toolbar?.scrollTo(0, 0);
  }

  private renderTerrain(): void {
    for (let y = 0; y < SIZE; y += 1) {
      for (let x = 0; x < SIZE; x += 1) {
        const terrain = this.terrainAt(x, y);
        const base = this.baseTerrainAt(x, y);
        const elevation = this.terrainElevation(x, y);
        const edited = this.elevationOverrides.has(this.key(x, y));
        const position = this.gridToWorld(x, y);
        const group = new THREE.Group();
        group.position.set(position.x, 0, position.z);

        if (terrain === 'river') {
          // River water must remain visible even if stale/legacy state carries
          // a negative elevation override. Positive authored river elevations
          // (for example mountain templates) remain untouched.
          group.position.y = Math.max(0, elevation);
          this.renderRiverTile(group, x, y);
          this.terrainLayer.add(group);
          continue;
        }

        if (this.terrainOverrides.get(this.key(x, y)) === 'plains' && (base === 'water' || base === 'river')) {
          const soil = this.environmentMaterial('filled-soil', 0x786b50, 1);
          const grass = this.environmentMaterial('filled-grass', 0x9ebc62, 0.94);
          this.addBox(group, TILE, 0.5, TILE, soil, 0, 1.87, 0);
          this.addBox(group, TILE, 0.14, TILE, grass, 0, 2.19, 0);
        }

        if (terrain === 'shore') this.renderCoastPatch(group, x, y);
        else if (terrain === 'forest' || terrain === 'plains') this.renderGroundVariation(group, x, y, terrain);

        if (edited && terrain !== 'mountain') {
          this.renderElevationPatch(group, elevation);
        }

        const occupying = this.services.state.getCell(x, y)?.kind;
        const hidesMountain =
          occupying !== undefined &&
          (this.isWallFamily(occupying) || occupying === 'mine' || occupying === 'tower' || occupying === 'gate');

        if (terrain === 'mountain' && !hidesMountain) {
          const mountainGroup = new THREE.Group();
          mountainGroup.position.y = elevation;
          this.addNaturalMountain(mountainGroup, x, y);
          group.add(mountainGroup);
        }

        if (!occupying && terrain !== 'water' && terrain !== 'mountain') {
          this.addEnvironmentalDetail(group, x, y, terrain);
        }

        if (group.children.length > 0) this.terrainLayer.add(group);
      }
    }
  }

  private renderGroundVariation(
    group: THREE.Group,
    gx: number,
    gy: number,
    terrain: 'forest' | 'plains',
  ): void {
    const hash = Math.abs((gx * 109 + gy * 173 + gx * gy * 13) % 97);
    if (hash % 4 !== 0) return;

    const color =
      terrain === 'forest'
        ? hash % 2 === 0 ? WORLD_STYLE.palette.grassForest : WORLD_STYLE.palette.foliageMid
        : hash % 3 === 0 ? WORLD_STYLE.palette.grassSunlit : WORLD_STYLE.palette.grassShaded;
    const patch = new THREE.Mesh(
      new THREE.CircleGeometry(0.55 + (hash % 4) * 0.17, 10),
      this.environmentMaterial(`grass-${terrain}-${hash % 3}`, color, 1),
    );
    patch.rotation.x = -Math.PI / 2;
    patch.position.set(
      ((hash % 5) - 2) * 0.18,
      2.215 + this.terrainElevation(gx, gy),
      (((hash * 3) % 5) - 2) * 0.2,
    );
    patch.scale.y = 0.62;
    group.add(patch);
  }

  private renderCoastPatch(group: THREE.Group, gx: number, gy: number): void {
    const hash = Math.abs((gx * 79 + gy * 131 + gx * gy * 7) % 997);
    const rocky = hash % 5 === 0 || hash % 11 === 0;
    const wideBeach = !rocky && hash % 4 !== 0;

    const drySand = this.environmentMaterial('coast-dry-sand', 0xc9b47d, 1);
    const warmSand = this.environmentMaterial('coast-warm-sand', 0xbda66f, 1);
    const wetSand = this.environmentMaterial('coast-wet-sand', 0x8f805f, 1);
    const coastRock = this.environmentMaterial('coast-rock', 0x7b746a, 1);
    const coastDarkRock = this.environmentMaterial('coast-rock-dark', 0x625e58, 1);
    const coastalGrass = this.environmentMaterial('coastal-grass', 0x708946, 1);
    const driftwood = this.environmentMaterial('coast-driftwood', 0x72543c, 1);

    const baseRadius = wideBeach ? 1.78 : rocky ? 1.28 : 1.52;
    const beach = new THREE.Mesh(
      new THREE.CircleGeometry(baseRadius, 14),
      rocky ? coastRock : hash % 3 === 0 ? warmSand : drySand,
    );
    beach.rotation.x = -Math.PI / 2;
    beach.position.y = 2.235;
    beach.scale.set(
      1.06 + (hash % 3) * 0.08,
      0.82 + (hash % 4) * 0.04,
      1,
    );
    beach.rotation.z = (hash % 9) * 0.12;
    group.add(beach);

    const edges = [
      { dx: 0, dy: -1, x: 0, z: -1.55, w: 3.25, d: 0.82, shallowX: 0, shallowZ: -2.25, shallowW: 3.6, shallowD: 1.25 },
      { dx: 1, dy: 0, x: 1.55, z: 0, w: 0.82, d: 3.25, shallowX: 2.25, shallowZ: 0, shallowW: 1.25, shallowD: 3.6 },
      { dx: 0, dy: 1, x: 0, z: 1.55, w: 3.25, d: 0.82, shallowX: 0, shallowZ: 2.25, shallowW: 3.6, shallowD: 1.25 },
      { dx: -1, dy: 0, x: -1.55, z: 0, w: 0.82, d: 3.25, shallowX: -2.25, shallowZ: 0, shallowW: 1.25, shallowD: 3.6 },
    ].filter((edge) => this.terrainAt(gx + edge.dx, gy + edge.dy) === 'water');

    const foam = this.planMaterial(0xe8fff8, 0.25);

    for (const edge of edges) {
      const wet = new THREE.Mesh(
        new THREE.PlaneGeometry(edge.w, edge.d),
        rocky ? coastDarkRock : wetSand,
      );
      wet.rotation.x = -Math.PI / 2;
      wet.position.set(edge.x, 2.255, edge.z);
      wet.renderOrder = 1;
      group.add(wet);

      const shallow = new THREE.Mesh(
        new THREE.PlaneGeometry(edge.shallowW, edge.shallowD),
        this.shallowWaterMaterial,
      );
      shallow.rotation.x = -Math.PI / 2;
      shallow.position.set(edge.shallowX, 1.04, edge.shallowZ);
      shallow.renderOrder = 1;
      group.add(shallow);

      const foamMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(
          edge.dx === 0 ? edge.w * 0.9 : 0.13,
          edge.dy === 0 ? edge.d * 0.9 : 0.13,
        ),
        foam,
      );
      foamMesh.rotation.x = -Math.PI / 2;
      foamMesh.position.set(
        edge.x * 1.04,
        1.4,
        edge.z * 1.04,
      );
      foamMesh.renderOrder = 3;
      group.add(foamMesh);

      if (!rocky && hash % 3 === 0) {
        const grassX = -edge.dx * 0.95;
        const grassZ = -edge.dy * 0.95;
        for (let i = 0; i < 3; i += 1) {
          const blade = this.addBox(
            group,
            0.055,
            0.38 + i * 0.07,
            0.055,
            coastalGrass,
            grassX + (i - 1) * 0.15 * (edge.dy === 0 ? 0.4 : 1),
            2.46,
            grassZ + (i - 1) * 0.15 * (edge.dx === 0 ? 0.4 : 1),
          );
          blade.rotation.z = (i - 1) * 0.12;
        }
      }
    }

    if (rocky) {
      const rockCount = 1 + (hash % 3);
      for (let i = 0; i < rockCount; i += 1) {
        const stone = new THREE.Mesh(
          new THREE.DodecahedronGeometry(0.24 + ((hash + i) % 4) * 0.08, 0),
          i % 2 === 0 ? coastRock : coastDarkRock,
        );
        stone.position.set(
          -0.8 + i * 0.62,
          2.42 + i * 0.04,
          0.58 - i * 0.37,
        );
        stone.scale.set(1.15, 0.62 + i * 0.08, 0.9);
        stone.rotation.y = (hash + i) * 0.31;
        stone.castShadow = true;
        group.add(stone);
      }

      if (hash % 7 === 0) {
        const cliff = new THREE.Mesh(
          new THREE.DodecahedronGeometry(0.78, 0),
          coastDarkRock,
        );
        cliff.position.set(-0.62, 2.35, 0.72);
        cliff.scale.set(1.45, 1.05, 0.72);
        cliff.rotation.y = (hash % 5) * 0.18;
        cliff.castShadow = true;
        group.add(cliff);
      }
    } else if (hash % 9 === 0) {
      const log = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.14, 1.25, 7),
        driftwood,
      );
      log.rotation.z = Math.PI / 2;
      log.rotation.y = (hash % 8) * 0.28;
      log.position.set(0.2, 2.39, 0.52);
      log.castShadow = true;
      group.add(log);
    }

    if (!rocky && hash % 13 === 0) {
      const shellMaterial = this.environmentMaterial('coast-shell', 0xd7c9a7, 1);
      for (let i = 0; i < 3; i += 1) {
        const shell = new THREE.Mesh(
          new THREE.SphereGeometry(0.055 + i * 0.01, 6, 4),
          shellMaterial,
        );
        shell.scale.y = 0.32;
        shell.position.set(-0.55 + i * 0.24, 2.29, -0.45 + i * 0.11);
        group.add(shell);
      }
    }
  }

  private addEnvironmentalDetail(
    group: THREE.Group,
    gx: number,
    gy: number,
    terrain: TerrainKind,
  ): void {
    const hash = Math.abs((gx * 313 + gy * 197 + gx * gy * 43) % 997);

    if ((terrain === 'plains' || terrain === 'forest') && hash % 19 === 0) {
      const bush = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.28 + (hash % 4) * 0.04, 0),
        this.environmentMaterial('bush', 0x4f783e, 1),
      );
      bush.position.set(-0.8 + (hash % 5) * 0.32, 2.44, 0.65 - (hash % 3) * 0.35);
      bush.scale.y = 0.72;
      bush.castShadow = true;
      group.add(bush);
    }

    if (terrain === 'plains' && hash % 47 === 0) {
      const log = new THREE.Mesh(
        new THREE.CylinderGeometry(0.13, 0.16, 1.25, 7),
        this.environmentMaterial('fallen-log', 0x66503a, 1),
      );
      log.rotation.z = Math.PI / 2;
      log.rotation.y = (hash % 6) * 0.42;
      log.position.set(0.3, 2.39, -0.4);
      log.castShadow = true;
      group.add(log);
    }

    if ((terrain === 'shore' || terrain === 'plains') && hash % 29 === 0) {
      const grass = this.environmentMaterial('wild-grass', 0x728d43, 1);
      for (let i = 0; i < 3; i += 1) {
        const blade = this.addBox(
          group,
          0.05,
          0.4 + i * 0.08,
          0.05,
          grass,
          -0.35 + i * 0.18,
          2.4,
          0.5,
        );
        blade.rotation.z = (i - 1) * 0.18;
      }
    }
  }

  private isRiverAt(x: number, y: number): boolean {
    return this.terrainAt(x, y) === 'river';
  }

  private addRiverSurface(
    group: THREE.Group,
    width: number,
    depth: number,
    x: number,
    z: number,
    rotationY = 0,
  ): void {
    const geometry = new THREE.PlaneGeometry(width, depth, 1, 1);
    geometry.rotateX(-Math.PI / 2);

    const water = new THREE.Mesh(geometry, this.riverWaterMaterial);
    water.position.set(x, 2.075, z);
    water.rotation.y = rotationY;
    water.receiveShadow = true;
    group.add(water);
  }

  private renderRiverTile(group: THREE.Group, gx: number, gy: number): void {
    const left = this.isRiverAt(gx - 1, gy);
    const right = this.isRiverAt(gx + 1, gy);
    const up = this.isRiverAt(gx, gy - 1);
    const down = this.isRiverAt(gx, gy + 1);
    const connections = Number(left) + Number(right) + Number(up) + Number(down);
    const hash = Math.abs((gx * 157 + gy * 263 + gx * gy * 17) % 997);
    const width = 2.3 + (hash % 5) * 0.11;
    const radius = width * 0.57;

    const riverBed = this.environmentMaterial('river-bed', 0x4b463e, 1);
    const wetEarth = this.environmentMaterial('river-wet-earth', 0x625948, 1);
    const bankSand = this.environmentMaterial('river-bank-sand', 0x9d8b64, 1);
    const bankGrass = this.environmentMaterial('river-bank-grass', 0x829d50, 0.98);
    const stoneMaterial = this.environmentMaterial('river-stone', 0x7f7b74, 1);

    this.addBox(group, TILE, 0.34, TILE, wetEarth, 0, 1.86, 0);
    const bed = new THREE.Mesh(new THREE.CircleGeometry(radius + 0.28, 24), riverBed);
    bed.rotation.x = -Math.PI / 2;
    bed.position.y = 2.005;
    group.add(bed);

    const centerGeometry = new THREE.CircleGeometry(radius, 30);
    centerGeometry.rotateX(-Math.PI / 2);
    const centerWater = new THREE.Mesh(centerGeometry, this.riverWaterMaterial);
    centerWater.position.y = 2.055;
    group.add(centerWater);

    const connectorLength = TILE / 2 + radius * 0.68;
    const addConnection = (dx: number, dz: number, rotation: number, scale = 1): void => {
      this.addRiverSurface(
        group,
        connectorLength,
        width * scale,
        dx,
        dz,
        rotation,
      );
    };

    if (left) addConnection(-1.22, 0, Math.PI / 2, 0.98);
    if (right) addConnection(1.22, 0, Math.PI / 2, 1.02);
    if (up) addConnection(0, -1.22, 0, 0.96);
    if (down) addConnection(0, 1.22, 0, 1.04);

    if (connections === 0) {
      this.addRiverSurface(group, width, TILE + 0.4, 0, 0);
    }

    const bankWidth = 0.5 + (hash % 4) * 0.04;
    const addBank = (x: number, z: number, bw: number, bd: number, rotation = 0): void => {
      const bank = this.addBox(group, bw, 0.38, bd, bankSand, x, 2.17, z);
      bank.rotation.y = rotation;
      const cap = this.addBox(group, bw * 0.9, 0.08, bd * 0.92, bankGrass, x, 2.39, z);
      cap.rotation.y = rotation;
    };

    if (!left) addBank(-1.72, 0, bankWidth, TILE * 1.04, 0.04 * ((hash % 3) - 1));
    if (!right) addBank(1.72, 0, bankWidth, TILE * 1.04, -0.05 * ((hash % 3) - 1));
    if (!up) addBank(0, -1.72, TILE * 1.04, bankWidth, -0.04);
    if (!down) addBank(0, 1.72, TILE * 1.04, bankWidth, 0.05);

    if ((left && down) || (right && up) || (left && up) || (right && down)) {
      const turnFoam = new THREE.Mesh(
        new THREE.RingGeometry(radius * 0.82, radius * 0.94, 20, 1, 0, Math.PI * 0.75),
        this.planMaterial(0xd7fbff, 0.18),
      );
      turnFoam.rotation.x = -Math.PI / 2;
      turnFoam.rotation.z = (hash % 4) * Math.PI / 2;
      turnFoam.position.y = 2.07;
      group.add(turnFoam);
    }

    const pebbleCount = hash % 4 === 0 ? 2 : hash % 5 === 0 ? 1 : 0;
    for (let i = 0; i < pebbleCount; i += 1) {
      const pebble = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.13 + ((hash + i) % 3) * 0.05, 0),
        stoneMaterial,
      );
      const side = (hash + i) % 2 === 0 ? -1 : 1;
      pebble.position.set(side * (1.38 + i * 0.18), 2.32, -0.75 + i * 0.9);
      pebble.scale.y = 0.52;
      pebble.castShadow = true;
      group.add(pebble);
    }
  }

  private renderElevationPatch(group: THREE.Group, elevation: number): void {
    const grass = this.environmentMaterial('terrain-elev-grass', 0x91aa57, 0.98);
    const dirt = this.environmentMaterial('terrain-elev-dirt', 0x76624d, 1);
    const rock = this.environmentMaterial('terrain-elev-rock', 0x746c63, 1);

    if (elevation > 0.03) {
      const material = elevation > 3.4 ? rock : elevation > 1.8 ? dirt : grass;
      const mound = new THREE.Mesh(
        new THREE.CylinderGeometry(
          TILE * (elevation > 2.8 ? 0.5 : 0.56),
          TILE * 0.67,
          elevation,
          12,
          2,
          false,
        ),
        material,
      );
      mound.position.y = 2.2 + elevation / 2;
      mound.rotation.y = elevation * 0.17;
      mound.castShadow = elevation > 0.6;
      mound.receiveShadow = true;
      group.add(mound);

      if (elevation > 2.4) {
        const shoulder = new THREE.Mesh(
          new THREE.DodecahedronGeometry(TILE * 0.27, 0),
          rock,
        );
        shoulder.position.set(TILE * 0.28, 2.15 + elevation * 0.62, -TILE * 0.24);
        shoulder.scale.set(1.3, 0.72, 1);
        shoulder.castShadow = true;
        group.add(shoulder);
      }
      return;
    }

    if (elevation < -0.03) {
      const depth = Math.min(1.55, Math.abs(elevation));
      const earth = this.environmentMaterial('terrain-low-earth', 0x51453a, 1);
      const side = this.environmentMaterial('terrain-low-side', 0x78644b, 1);
      const hollow = new THREE.Mesh(
        new THREE.CylinderGeometry(TILE * 0.47, TILE * 0.58, 0.12, 12),
        earth,
      );
      hollow.position.y = 2.15;
      group.add(hollow);

      for (let i = 0; i < 7; i += 1) {
        const angle = (i / 7) * Math.PI * 2;
        const wall = new THREE.Mesh(
          new THREE.BoxGeometry(0.45, 0.2 + depth * 0.12, 1.15),
          side,
        );
        wall.position.set(Math.cos(angle) * 1.65, 2.2, Math.sin(angle) * 1.65);
        wall.rotation.y = -angle;
        group.add(wall);
      }
    }
  }

  private addNaturalMountain(group: THREE.Group, gx: number, gy: number): void {
    const hash = Math.abs((gx * 113 + gy * 191 + gx * gy * 17) % 997);
    const level = 2 + (hash % 3);
    this.addMountainFormation(group, level, hash);
  }

  private addMountainFormation(
    group: THREE.Group,
    level: number,
    seed: number,
  ): void {
    const safeLevel = THREE.MathUtils.clamp(Math.floor(level), 1, 12);
    const low = this.environmentMaterial('mountain-low', 0x6f7652, 1);
    const dirt = this.environmentMaterial('mountain-dirt', 0x75614e, 1);
    const rockA = this.environmentMaterial('mountain-rock-a', 0x746c65, 1);
    const rockB = this.environmentMaterial('mountain-rock-b', 0x8b7f74, 1);
    const rockHigh = this.environmentMaterial('mountain-rock-high', 0xa99f93, 1);
    const dark = this.environmentMaterial('mountain-cliff-dark', 0x554f4b, 1);

    const scale = 0.86 + Math.min(safeLevel, 7) * 0.09;
    const height = 3.4 + Math.min(safeLevel, 8) * 0.72;
    const baseRadius = 2.0 + Math.min(safeLevel, 6) * 0.12;
    const angle = (seed % 17) * 0.19;

    const foothill = new THREE.Mesh(
      new THREE.CylinderGeometry(baseRadius * 0.9, baseRadius * 1.26, 0.72 + safeLevel * 0.08, 11),
      safeLevel <= 2 ? low : dirt,
    );
    foothill.position.y = 2.45;
    foothill.rotation.y = angle;
    foothill.scale.z = 0.82 + (seed % 5) * 0.035;
    foothill.castShadow = true;
    foothill.receiveShadow = true;
    group.add(foothill);

    const main = new THREE.Mesh(
      new THREE.ConeGeometry(baseRadius * scale, height, 8),
      safeLevel >= 3 ? rockA : dirt,
    );
    main.position.set(-0.28, 2.55 + height / 2, 0.12);
    main.rotation.y = angle + 0.22;
    main.scale.z = 0.78 + (seed % 4) * 0.06;
    main.castShadow = true;
    main.receiveShadow = true;
    group.add(main);

    const ridgeHeight = height * (0.62 + (seed % 3) * 0.05);
    const ridge = new THREE.Mesh(
      new THREE.ConeGeometry(baseRadius * 0.62, ridgeHeight, 7),
      rockB,
    );
    ridge.position.set(
      1.05 + (seed % 3) * 0.12,
      2.46 + ridgeHeight / 2,
      0.6 - (seed % 4) * 0.1,
    );
    ridge.rotation.y = angle - 0.48;
    ridge.scale.x = 0.86;
    ridge.castShadow = true;
    group.add(ridge);

    const shoulder = new THREE.Mesh(
      new THREE.DodecahedronGeometry(baseRadius * 0.62, 0),
      seed % 2 === 0 ? rockA : rockB,
    );
    shoulder.position.set(-1.2, 3.05 + safeLevel * 0.16, -0.75);
    shoulder.scale.set(1.18, 0.74 + safeLevel * 0.03, 0.92);
    shoulder.rotation.y = angle * 1.4;
    shoulder.castShadow = true;
    group.add(shoulder);

    if (safeLevel >= 3) {
      const cliff = new THREE.Mesh(
        new THREE.DodecahedronGeometry(baseRadius * 0.5, 0),
        dark,
      );
      cliff.position.set(0.78, 3.15 + safeLevel * 0.22, -1.03);
      cliff.scale.set(0.72, 1.32, 0.48);
      cliff.rotation.y = angle + 0.5;
      cliff.castShadow = true;
      group.add(cliff);
    }

    if (safeLevel >= 4) {
      const peakHeight = height * 0.28;
      const peak = new THREE.Mesh(
        new THREE.ConeGeometry(baseRadius * 0.34, peakHeight, 7),
        rockHigh,
      );
      peak.position.set(
        -0.28,
        2.55 + height * 0.86,
        0.12,
      );
      peak.rotation.y = angle - 0.18;
      peak.castShadow = true;
      group.add(peak);
    }

    if (safeLevel <= 3) {
      const shrub = this.environmentMaterial('mountain-shrub', 0x496d3e, 1);
      for (let i = 0; i < 2; i += 1) {
        const bush = new THREE.Mesh(
          new THREE.DodecahedronGeometry(0.24 + i * 0.05, 0),
          shrub,
        );
        bush.position.set(-1.5 + i * 2.25, 2.72, 1.15 - i * 0.38);
        bush.scale.y = 0.72;
        bush.castShadow = true;
        group.add(bush);
      }
    }
  }

  private makeBuilding(cell: ReturnType<GameState['entries']>[number], floodedMoats: Set<string>): THREE.Group {
    for (const extension of this.extensions) {
      const building = extension.createBuilding?.(cell);
      if (building) return building;
    }
    const group = new THREE.Group();
    const position = this.gridToWorld(cell.x, cell.y);
    group.position.set(position.x, this.terrainElevation(cell.x, cell.y), position.z);

    if (ROAD_KINDS.includes(cell.kind as RoadKind)) this.makeRoad(group, cell.x, cell.y, cell.kind as RoadKind);
    else if (HARBOR_KINDS.includes(cell.kind as HarborKind)) this.makeHarbor(group, Math.max(1, Math.min(HARBOR_MAX_LEVEL, cell.level ?? 1)), cell);
    else if (WALL_KINDS.includes(cell.kind as WallKind)) {
      this.makeWall(group, cell.kind as WallKind, cell.x, cell.y, cell);
    } else if (cell.kind === 'gate') this.makeGate(group, cell.x, cell.y, cell);
    else if (cell.kind === 'tower') this.makeTower(group, cell.x, cell.y, cell);

    else if (cell.kind === 'farm') this.makeFarm(group, Math.max(1, Math.min(AGRICULTURE_MAX_LEVEL, cell.level ?? 1)));
    else if (cell.kind === 'cowBarn') this.makeCowBarn(group, Math.max(1, Math.min(AGRICULTURE_MAX_LEVEL, cell.level ?? 1)), cell.x, cell.y);
    else if (cell.kind === 'appleOrchard') this.services.orchardSystem.create(group, cell.level ?? 1, cell.x * 97 + cell.y * 53);
    else if (cell.kind === 'armyCamp') this.makeArmyCamp(group, Math.max(1, Math.min(ARMY_CAMP_MAX_LEVEL, cell.level ?? 1)));
    else if (cell.kind === 'market') this.makeMarketBuilding(group, cell.x, cell.y);
    else if (cell.kind === 'basilica') {
      group.userData.settlementFamily = 'basilica';
      group.userData.settlementReadabilityClass = 'landmark';
      group.add(this.basilicaRenderer.render(this.stoneStyle, cell.x, cell.y));
    }
    else if (cell.kind === 'mosque') this.makeMosque(group, cell.x, cell.y);
    else if (cell.kind === 'windmill') this.services.windmillSystem.create(group);
    else if (cell.kind === 'mine') this.makeMine(group);
    else if (cell.kind === 'carpenter') group.add(
      this.carpenterRenderer.render(
        Math.max(1, Math.min(CARPENTER_MAX_LEVEL, cell.level ?? 1)),
        cell.x * 97 + cell.y * 53,
      ),
    );
    else if (cell.kind === 'mountain') this.makeMountain(group, cell.level ?? 1, cell.x, cell.y);
    else if (cell.kind === 'tree') this.makeTree(group, cell.level ?? 1);
    else if (cell.kind === 'rock') this.makeRock(group, cell.level ?? 1);
    else if (cell.kind === 'hut') this.makeHut(group);
    else if (cell.kind === 'moat') this.makeMoat(group, floodedMoats.has(this.key(cell.x, cell.y)));
    else if (cell.kind === 'cottage' || cell.kind === 'house' ||
      cell.kind === 'manor' || cell.kind === 'villa') {
      this.makeHouse(group, cell.kind, cell.x, cell.y);
    }

    if (!this.isWallFamily(cell.kind) && !ROAD_KINDS.includes(cell.kind as RoadKind) && cell.kind !== 'moat') {
      group.rotation.y = (cell.rotation ?? 0) * Math.PI / 2;
    }

    this.services.destructibleBuildingSystem.renderDamage(group, cell, cell.x, cell.y);
    return group;
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

  private kindAt(x: number, y: number): TileKind | undefined {
    return this.services.state.getCell(x, y)?.kind;
  }

  private isWallFamily(kind: TileKind | undefined): boolean {
    return kind === 'wall1' || kind === 'wall2' || kind === 'wall3' || kind === 'gate' || kind === 'tower';
  }

  private isRoadFamily(kind: TileKind | undefined): boolean {
    return kind === 'road' || kind === 'dirtRoad' || kind === 'stoneRoad' || kind === 'gate';
  }

  private makeRoad(group: THREE.Group, gx: number, gy: number, kind: RoadKind): THREE.Group {
    const road =
      kind === 'dirtRoad'
        ? this.environmentMaterial('road-dirt', 0x8a6142, 1)
        : kind === 'stoneRoad'
          ? this.environmentMaterial('road-stone', SETTLEMENT_STYLE.stone, 0.98)
          : this.environmentMaterial('road-standard', SETTLEMENT_STYLE.path, 0.98);
    const edge =
      kind === 'stoneRoad'
        ? this.environmentMaterial('road-stone-edge', 0x6e6961, 1)
        : this.environmentMaterial('road-edge', 0x70523f, 1);

    const left = this.isRoadFamily(this.kindAt(gx - 1, gy));
    const right = this.isRoadFamily(this.kindAt(gx + 1, gy));
    const up = this.isRoadFamily(this.kindAt(gx, gy - 1));
    const down = this.isRoadFamily(this.kindAt(gx, gy + 1));

    if (this.terrainAt(gx, gy) === 'river') {
      const horizontal = left || right || (!up && !down);
      const bridgeMaterial =
        kind === 'stoneRoad'
          ? this.environmentMaterial('bridge-stone', SETTLEMENT_STYLE.stone, 1)
          : this.environmentMaterial('bridge-timber', 0x775137, 0.98);
      const support =
        kind === 'stoneRoad'
          ? this.environmentMaterial('bridge-stone-support', 0x625f58, 1)
          : this.environmentMaterial('bridge-timber-support', 0x4f3526, 1);

      const deck = this.addBox(
        group,
        horizontal ? TILE + 0.3 : 1.95,
        0.28,
        horizontal ? 1.95 : TILE + 0.3,
        bridgeMaterial,
        0,
        2.58,
        0,
      );
      deck.castShadow = true;

      if (kind === 'stoneRoad') {
        for (const offset of [-0.72, 0.72]) {
          this.addBox(
            group,
            horizontal ? TILE + 0.2 : 0.22,
            0.48,
            horizontal ? 0.22 : TILE + 0.2,
            support,
            horizontal ? 0 : offset,
            2.42,
            horizontal ? offset : 0,
          );
        }
      } else {
        for (const along of [-1.35, 0, 1.35]) {
          for (const side of [-0.72, 0.72]) {
            this.addBox(
              group,
              0.14,
              1.7,
              0.14,
              support,
              horizontal ? along : side,
              1.72,
              horizontal ? side : along,
            );
          }
        }
      }

      return group;
    }

    const roadWidth = kind === 'stoneRoad' ? 1.9 : kind === 'dirtRoad' ? 1.82 : 1.86;
    this.addBox(group, roadWidth, 0.14, roadWidth, road, 0, 2.28, 0);

    const arms: Array<{ active: boolean; dx: number; dy: number; axis: 'x' | 'z'; sign: number }> = [
      { active: left, dx: -1, dy: 0, axis: 'x', sign: -1 },
      { active: right, dx: 1, dy: 0, axis: 'x', sign: 1 },
      { active: up, dx: 0, dy: -1, axis: 'z', sign: -1 },
      { active: down, dx: 0, dy: 1, axis: 'z', sign: 1 },
    ];

    for (const arm of arms) {
      if (!arm.active) continue;
      const delta =
        this.terrainElevation(gx + arm.dx, gy + arm.dy) -
        this.terrainElevation(gx, gy);
      this.addRoadArm(group, arm.axis, arm.sign, delta, roadWidth, road);
    }

    if (!left && !right && !up && !down) {
      this.addBox(group, 3.35, 0.14, roadWidth, road, 0, 2.28, 0);
    }

    this.addBox(group, roadWidth + 0.12, 0.045, roadWidth + 0.12, edge, 0, 2.2, 0);

    if (kind === 'dirtRoad') {
      const track = this.environmentMaterial('road-track', 0x604632, 1);
      // Keep marks inside the center on intersections; arms carry the route.
      if (!left && !right) {
        this.addBox(group, 0.15, 0.025, 1.6, track, -0.42, 2.37, 0);
        this.addBox(group, 0.15, 0.025, 1.6, track, 0.42, 2.37, 0);
      }
    } else if (kind === 'stoneRoad') {
      const joint = this.environmentMaterial('road-joint', 0x5b5751, 1);
      if (!left && !right) {
        for (let i = -1; i <= 1; i += 1) {
          this.addBox(group, 1.62, 0.025, 0.055, joint, 0, 2.38, i * 0.5);
        }
      }
    } else {
      const center = this.environmentMaterial('road-standard-wear', 0x907961, 1);
      this.addBox(group, 0.56, 0.018, 0.56, center, 0, 2.36, 0);
    }

    return group;
  }

  private addRoadArm(
    group: THREE.Group,
    axis: 'x' | 'z',
    sign: number,
    elevationDelta: number,
    roadWidth: number,
    material: THREE.Material,
  ): void {
    const run = TILE / 2 + 0.12;
    const rise = elevationDelta / 2;
    const length = Math.sqrt(run * run + rise * rise);
    const arm = this.addBox(
      group,
      axis === 'x' ? length : roadWidth,
      0.14,
      axis === 'z' ? length : roadWidth,
      material,
      axis === 'x' ? sign * run / 2 : 0,
      2.28 + rise / 2,
      axis === 'z' ? sign * run / 2 : 0,
    );

    const angle = Math.atan2(rise, run);
    if (axis === 'x') arm.rotation.z = sign * angle;
    else arm.rotation.x = -sign * angle;
  }

  private makeHarbor(
    group: THREE.Group,
    level: number,
    cell: GridCell,
  ): THREE.Group {
    const normalizedLevel = Math.max(1, Math.min(HARBOR_MAX_LEVEL, Math.floor(level)));
    group.userData.upgradeVisualProfile = upgradeVisualProfile(normalizedLevel);
    const timber = this.environmentMaterial('harbor-timber', 0x6c4a32, 0.98);
    const timberLight = this.environmentMaterial('harbor-timber-light', 0x8a6444, 0.98);
    const timberDark = this.environmentMaterial('harbor-timber-dark', 0x493224, 1);
    const rope = this.environmentMaterial('harbor-rope', 0xb29a68, 1);
    const crate = this.environmentMaterial('harbor-crate', 0x855f3d, 1);
    const barrel = this.environmentMaterial('harbor-barrel', 0x70482f, 1);
    const stone = this.environmentMaterial('harbor-stone', 0x777168, 1);
    const stoneDark = this.environmentMaterial('harbor-stone-dark', 0x57544f, 1);
    const plaster = this.environmentMaterial('harbor-plaster', 0xd4c8a7, 0.96);
    const roof = this.environmentMaterial('harbor-roof', 0x8b4c36, 0.96);
    const metal = this.environmentMaterial('harbor-metal', 0x4e5557, 0.9);
    const lantern = this.environmentMaterial('harbor-lantern', 0xffc978, 0.9);

    const pierLengths = [4.9, 5.9, 7.0, 8.1] as const;
    const pierWidths = [1.35, 1.7, 2.1, 2.7] as const;
    const pierLength = pierLengths[normalizedLevel - 1];
    const pierWidth = pierWidths[normalizedLevel - 1];
    const shoreWidth = normalizedLevel >= 4 ? 5.2 : normalizedLevel >= 3 ? 4.1 : pierWidth + 0.75;

    // Every level keeps the same readable shoreline-to-water axis while gaining
    // width, length, structural weight and a richer silhouette.
    this.addBox(
      group,
      shoreWidth,
      normalizedLevel >= 3 ? 0.34 : 0.26,
      normalizedLevel >= 3 ? 2.45 : 1.9,
      normalizedLevel >= 3 ? stone : timber,
      0,
      2.42,
      -0.35,
    );
    this.addBox(
      group,
      pierWidth,
      normalizedLevel >= 4 ? 0.3 : 0.24,
      pierLength,
      timber,
      0,
      2.38,
      -pierLength / 2 - 0.65,
    );

    const supportCount = 3 + normalizedLevel * 2;
    for (let i = 0; i < supportCount; i += 1) {
      const z = -1.25 - i * ((pierLength - 0.65) / Math.max(1, supportCount - 1));
      for (const x of [-pierWidth * 0.43, pierWidth * 0.43]) {
        this.addBox(
          group,
          normalizedLevel >= 3 ? 0.16 : 0.13,
          2.65,
          normalizedLevel >= 3 ? 0.16 : 0.13,
          timberDark,
          x,
          1.2,
          z,
        );
      }
    }

    // Mooring posts and side rails become denser with each upgrade.
    const railSegments = 2 + normalizedLevel;
    for (const side of [-1, 1]) {
      for (let i = 0; i <= railSegments; i += 1) {
        const z = -1.35 - (pierLength - 1.25) * (i / railSegments);
        const x = side * pierWidth * 0.55;
        this.addBox(group, 0.11, 0.88, 0.11, timberDark, x, 2.8, z);
        if (normalizedLevel >= 2 && i < railSegments) {
          const nextZ = -1.35 - (pierLength - 1.25) * ((i + 1) / railSegments);
          this.addBox(
            group,
            0.07,
            0.07,
            Math.max(0.2, Math.abs(nextZ - z)),
            timberLight,
            x,
            3.08,
            (z + nextZ) / 2,
          );
        }
      }
    }

    const ropeMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.026, 0.026, Math.max(2, pierLength - 1.5), 5),
      rope,
    );
    ropeMesh.rotation.x = Math.PI / 2;
    ropeMesh.position.set(pierWidth * 0.6, 3.05, -pierLength / 2 - 0.58);
    group.add(ropeMesh);

    // Level 1: small landing with only essential cargo and one boat.
    this.addBox(group, 0.62, 0.55, 0.62, crate, -0.42, 2.75, -1.25);
    this.addBox(group, 0.48, 0.68, 0.48, barrel, 0.42, 2.78, -1.42);

    if (normalizedLevel >= 2) {
      // Level 2: fishing wharf gains side platforms, equipment, net mast and storage.
      const sideWidth = 1.05;
      for (const side of [-1, 1]) {
        this.addBox(
          group,
          sideWidth,
          0.22,
          2.55,
          timber,
          side * (pierWidth / 2 + sideWidth / 2 - 0.08),
          2.4,
          -pierLength + 0.72,
        );
        for (const z of [-pierLength + 0.05, -pierLength + 1.55]) {
          this.addBox(
            group,
            0.12,
            2.45,
            0.12,
            timberDark,
            side * (pierWidth / 2 + sideWidth * 0.78),
            1.22,
            z,
          );
        }
      }

      const netMast = this.addBox(group, 0.09, 2.0, 0.09, timberDark, -0.5, 3.45, -2.2);
      netMast.rotation.z = -0.12;
      this.addBox(group, 1.1, 0.055, 0.055, rope, -0.78, 4.18, -2.2);
      this.addBox(group, 0.72, 0.42, 0.5, crate, 0.62, 2.68, -2.2);
      this.addBox(group, 0.52, 0.7, 0.52, barrel, -0.56, 2.77, -2.72);
    }

    if (normalizedLevel >= 3) {
      // Level 3: a real merchant pier adds a warehouse, stone apron and cargo crane.
      this.addBox(group, 2.25, 0.22, 1.45, stoneDark, -0.82, 2.58, 0.2);
      this.addBox(group, 2.05, 1.45, 1.28, plaster, -0.82, 3.4, 0.2);
      const warehouseRoof = new THREE.Mesh(new THREE.ConeGeometry(1.48, 0.72, 4), roof);
      warehouseRoof.rotation.y = Math.PI / 4;
      warehouseRoof.scale.z = 0.58;
      warehouseRoof.position.set(-0.82, 4.48, 0.2);
      warehouseRoof.castShadow = true;
      group.add(warehouseRoof);
      this.addBox(group, 0.64, 0.95, 0.06, timberDark, -0.82, 3.2, -0.47);

      const craneX = pierWidth / 2 + 0.72;
      this.addBox(group, 0.16, 2.9, 0.16, timberDark, craneX, 3.65, -2.7);
      const boom = this.addBox(group, 0.14, 0.14, 2.3, timber, craneX, 5.02, -3.45);
      boom.rotation.x = -0.08;
      this.addBox(group, 0.045, 1.18, 0.045, rope, craneX, 4.5, -4.35);
      this.addBox(group, 0.32, 0.28, 0.32, metal, craneX, 3.92, -4.35);

      for (const [x, z] of [
        [0.55, -1.1],
        [1.08, -1.14],
        [0.82, -1.72],
        [1.28, -1.82],
      ] as Array<[number, number]>) {
        this.addBox(group, 0.5, 0.48, 0.5, crate, x, 2.72, z);
      }
    }

    if (normalizedLevel >= 4) {
      // Level 4: grand harbor uses a wide stone quay, twin docking arms,
      // harbor office, second crane and lanterns for a unmistakable end-state silhouette.
      const armWidth = 1.35;
      for (const side of [-1, 1]) {
        const armX = side * (pierWidth / 2 + armWidth / 2 - 0.08);
        this.addBox(group, armWidth, 0.3, 3.35, timber, armX, 2.42, -pierLength + 1.05);
        this.addBox(group, 0.22, 0.42, 3.48, stoneDark, armX, 2.18, -pierLength + 1.05);
      }

      this.addBox(group, 1.8, 0.26, 1.3, stoneDark, 1.45, 2.6, 0.28);
      this.addBox(group, 1.62, 1.65, 1.14, plaster, 1.45, 3.5, 0.28);
      const officeRoof = new THREE.Mesh(new THREE.ConeGeometry(1.18, 0.8, 4), roof);
      officeRoof.rotation.y = Math.PI / 4;
      officeRoof.scale.z = 0.62;
      officeRoof.position.set(1.45, 4.73, 0.28);
      officeRoof.castShadow = true;
      group.add(officeRoof);
      this.addBox(group, 0.5, 0.86, 0.06, timberDark, 1.45, 3.22, -0.31);

      const secondCraneX = -pierWidth / 2 - 0.78;
      this.addBox(group, 0.17, 3.0, 0.17, timberDark, secondCraneX, 3.7, -4.7);
      this.addBox(group, 0.15, 0.15, 2.45, timber, secondCraneX, 5.08, -5.45);
      this.addBox(group, 0.045, 1.15, 0.045, rope, secondCraneX, 4.5, -6.42);

      for (const side of [-1, 1]) {
        const x = side * (shoreWidth / 2 - 0.34);
        this.addBox(group, 0.11, 1.25, 0.11, metal, x, 3.24, -0.3);
        const light = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), lantern);
        light.position.set(x, 3.92, -0.3);
        group.add(light);
      }

      for (const [x, z] of [
        [-1.75, -1.3],
        [-1.25, -1.45],
        [1.55, -1.25],
        [1.85, -1.78],
      ] as Array<[number, number]>) {
        this.addBox(group, 0.56, 0.54, 0.56, crate, x, 2.76, z);
      }
    }

    const shipKind = cell.shipKind ?? this.maritimeSystem.defaultShipForLevel(normalizedLevel);
    this.makeDockedShip(
      group,
      shipKind,
      -pierLength - 1.35,
      normalizedLevel >= 4 ? 1.72 : normalizedLevel >= 3 ? -1.35 : -1.08,
    );

    group.userData.harborLevel = normalizedLevel;
    return group;
  }

  private makeDockedShip(
    group: THREE.Group,
    kind: ShipKind,
    z: number,
    x: number,
  ): void {
    const hull = this.environmentMaterial('ship-hull', 0x5f3d2d, 1);
    const hullDark = this.environmentMaterial('ship-hull-dark', 0x34251f, 1);
    const sail = this.environmentMaterial('ship-sail', 0xd4c6a1, 0.96);
    const sailAccent = this.environmentMaterial('ship-sail-accent', 0x9f4d43, 0.96);
    const mast = this.environmentMaterial('ship-mast', 0x6c5035, 1);

    const length =
      kind === 'fishingBoat' ? 2.5 :
      kind === 'tradingBoat' ? 3.8 :
      4.6;
    const width =
      kind === 'fishingBoat' ? 0.95 :
      kind === 'tradingBoat' ? 1.25 :
      1.45;

    const boat = new THREE.Group();
    boat.position.set(x, 0, z);
    boat.rotation.y = kind === 'fishingBoat' ? 0.08 : -0.04;
    group.add(boat);

    const hullMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(width * 0.42, width * 0.62, length, 8),
      hull,
    );
    hullMesh.rotation.x = Math.PI / 2;
    hullMesh.scale.y = 0.55;
    hullMesh.position.y = 1.18;
    hullMesh.castShadow = true;
    boat.add(hullMesh);

    this.addBox(boat, width * 0.72, 0.18, length * 0.62, hullDark, 0, 1.38, 0);

    if (kind !== 'fishingBoat') {
      this.addBox(boat, 0.08, 2.25, 0.08, mast, 0, 2.46, 0.05);
      const canvas = this.addBox(
        boat,
        kind === 'transportShip' ? 1.35 : 1.1,
        kind === 'transportShip' ? 1.5 : 1.25,
        0.045,
        kind === 'transportShip' ? sailAccent : sail,
        0.58,
        2.81,
        0.05,
      );
      canvas.rotation.z = -0.08;
    } else {
      this.addBox(boat, 0.06, 1.15, 0.06, mast, -0.15, 1.96, 0);
      this.addBox(boat, 0.75, 0.04, 0.04, mast, 0.18, 2.38, 0);
    }

    const bobPhase = Math.abs(x * 0.41 + z * 0.29 + kind.length * 0.67);
    this.ambientMotion.registerBob(
      boat,
      bobPhase,
      kind === 'fishingBoat' ? 0.085 : 0.11,
      0.00125,
    );
  }

  private wallThicknessValue(kind: WallKind, thickness: WallThickness): number {
    const base = kind === 'wall1' ? 1.85 : kind === 'wall2' ? 1.65 : 2.05;
    const multiplier = thickness === 'thin' ? 0.78 : thickness === 'thick' ? 1.3 : 1;
    return base * multiplier;
  }

  private wallConnections(gx: number, gy: number, cell: GridCell): WallDirection[] {
    const resolved = this.castleBlocksByCell.get(this.key(gx, gy));
    if (resolved) return resolved.links;
    if (cell.wallLinks && cell.wallLinks.length > 0) {
      return cell.wallLinks.filter((direction) => {
        const vector = WallSystem.vector(direction);
        return this.isWallFamily(this.kindAt(gx + vector.x, gy + vector.y));
      });
    }

    const inferred: WallDirection[] = [];
    const cardinal: Array<{ direction: WallDirection; dx: number; dy: number }> = [
      { direction: 'N', dx: 0, dy: -1 },
      { direction: 'E', dx: 1, dy: 0 },
      { direction: 'S', dx: 0, dy: 1 },
      { direction: 'W', dx: -1, dy: 0 },
    ];

    for (const item of cardinal) {
      if (this.isWallFamily(this.kindAt(gx + item.dx, gy + item.dy))) {
        inferred.push(item.direction);
      }
    }

    return inferred;
  }

  private makeWall(
    group: THREE.Group,
    kind: WallKind,
    gx: number,
    gy: number,
    cell: GridCell,
  ): THREE.Group {
    const level = cell.level ?? 1;
    const thicknessChoice = cell.thickness ?? 'medium';
    const thickness = this.wallThicknessValue(kind, thicknessChoice);
    const damageStage = castleDamageStage(cell.damage ?? 0);
    const partial = damageStage === 'partial-breach';
    const battlement = !partial && (cell.battlement ?? true);
    const walkway = cell.walkway ?? false;
    const activeWalkway = walkway && !partial;
    const links = this.wallConnections(gx, gy, cell);
    group.userData.defenseSilhouette = WALL_SILHOUETTE_PROFILES[kind];

    if (damageStage === 'collapsed') {
      const rubble = this.medievalMaterials.castleStone(this.stoneStyle, 'foundation', gx, gy);
      for (let i = 0; i < 7; i += 1) {
        const x = ((gx * 13 + gy * 7 + i * 11) % 7 - 3) * 0.38;
        const z = ((gx * 5 + gy * 17 + i * 13) % 7 - 3) * 0.34;
        this.addBox(group, 0.7 + (i % 3) * 0.2, 0.24 + (i % 2) * 0.2, 0.62, rubble, x, 2.35, z);
      }
      group.userData.rubble = true;
      return group;
    }

    const heightState = castleHeightFor(cell);
    const height = (heightState.topLocal - CASTLE_ARCHITECTURE_STYLE.elevation.bodyBaseY) * (partial ? 0.55 : 1);
    const topY = CASTLE_ARCHITECTURE_STYLE.elevation.bodyBaseY + height;

    const wallMaterial =
      kind === 'wall2'
        ? this.medievalMaterials.timber
        : this.medievalMaterials.castleStone(this.stoneStyle, 'body', gx, gy);
    const darkMaterial =
      kind === 'wall2'
        ? this.medievalMaterials.timberDark
        : this.medievalMaterials.castleStone(this.stoneStyle, 'foundation', gx, gy);
    const accentMaterial =
      kind === 'wall2'
        ? this.medievalMaterials.timberDark
        : this.medievalMaterials.castleStone(this.stoneStyle, 'alt', gx, gy);
    const walkwayMaterial =
      kind === 'wall2'
        ? this.medievalMaterials.timber
        : this.medievalMaterials.castleStone(this.stoneStyle, 'walkway', gx, gy);
    const metalMaterial = this.medievalMaterials.iron;
    const slitMaterial = this.medievalMaterials.arrowVoid;

    let junctionThickness = thickness;
    for (const direction of links) {
      const vector = WallSystem.vector(direction);
      const neighbor = this.services.state.getCell(gx + vector.x, gy + vector.y);
      if (neighbor && WALL_KINDS.includes(neighbor.kind as WallKind)) {
        junctionThickness = Math.max(
          junctionThickness,
          this.wallThicknessValue(
            neighbor.kind as WallKind,
            neighbor.thickness ?? 'medium',
          ),
        );
      }
    }

    // Terrain-adaptive foundations keep the wall vertical while stepped masonry
    // reaches down into lower surrounding ground.
    const ownElevation = this.terrainElevation(gx, gy);
    const adjacentElevations = WallSystem.directions
      .map((direction) => WallSystem.vector(direction))
      .filter((vector) => Math.abs(vector.x) + Math.abs(vector.y) === 1)
      .map((vector) => this.terrainElevation(gx + vector.x, gy + vector.y));
    const localLow = Math.min(ownElevation, ...adjacentElevations);
    const foundationDrop = THREE.MathUtils.clamp(ownElevation - localLow, 0, 3.4);
    const foundationHeight = CASTLE_ARCHITECTURE_STYLE.wall.foundationBaseHeight + foundationDrop;

    this.addBox(
      group,
      junctionThickness * (CASTLE_ARCHITECTURE_STYLE.wall.foundationWidthScale + 0.14),
      foundationHeight,
      junctionThickness * 1.52,
      darkMaterial,
      0,
      2.22 - foundationHeight / 2 + 0.24,
      0,
    );
    this.addBox(
      group,
      junctionThickness * CASTLE_ARCHITECTURE_STYLE.wall.plinthWidthScale,
      0.38,
      junctionThickness * 1.3,
      accentMaterial,
      0,
      2.55,
      0,
    );

    if (foundationDrop > 0.45) {
      const steps = Math.min(3, Math.ceil(foundationDrop / 0.8));
      for (let step = 0; step < steps; step += 1) {
        const stepHeight = Math.min(
          foundationDrop,
          0.55 + step * 0.42,
        );
        const widthScale = 1.62 + step * 0.18;
        this.addBox(
          group,
          junctionThickness * widthScale,
          0.32,
          junctionThickness * widthScale,
          step % 2 === 0 ? darkMaterial : accentMaterial,
          0,
          2.12 - stepHeight,
          0,
        );
      }
    }
    this.addBox(
      group,
      junctionThickness * 1.12,
      height,
      junctionThickness * 1.12,
      wallMaterial,
      0,
      2.58 + height / 2,
      0,
    );
    if (damageStage !== 'intact') {
      const cracks = damageStage === 'heavy' ? 3 : 1;
      for (let i = 0; i < cracks; i += 1) {
        this.addBox(group, 0.06, height * (0.2 + i * 0.07), 0.08, slitMaterial,
          -0.34 + i * 0.32, 2.58 + height * (0.42 + i * 0.1), junctionThickness * 0.57);
      }
    }

    if (links.length === 0) {
      for (const direction of ['E', 'W'] as WallDirection[]) {
        this.addDirectionalWallArm(
          group,
          direction,
          0,
          height,
          thickness,
          wallMaterial,
          darkMaterial,
          walkwayMaterial,
          accentMaterial,
          slitMaterial,
          kind,
          gx,
          gy,
          level,
          battlement,
          activeWalkway,
          false,
        );
      }
    } else {
      for (const direction of links) {
        const vector = WallSystem.vector(direction);
        const neighbor = this.services.state.getCell(gx + vector.x, gy + vector.y);
        if (!neighbor || !this.isWallFamily(neighbor.kind)) continue;

        const elevationDelta =
          this.terrainElevation(gx + vector.x, gy + vector.y) -
          this.terrainElevation(gx, gy);

        this.addDirectionalWallArm(
          group,
          direction,
          elevationDelta,
          height,
          thickness,
          wallMaterial,
          darkMaterial,
          walkwayMaterial,
          accentMaterial,
          slitMaterial,
          kind,
          gx,
          gy,
          level,
          battlement,
          activeWalkway,
          links.length >= 2 || neighbor.kind === 'tower' || neighbor.kind === 'gate',
        );
      }
    }

    const topology = this.castleBlocksByCell.get(this.key(gx, gy))?.topology;
    const corner = topology === 'corner' || topology === 't-junction' || topology === '4-way' || topology === 'multi-junction'
      ? this.services.wallCornerSystem.analyze(cell, links, gx, gy)
      : null;
    if (corner) {
      this.addAutomaticCorner(
        group,
        corner.kind,
        height,
        junctionThickness,
        topY,
        wallMaterial,
        darkMaterial,
        accentMaterial,
        battlement,
        activeWalkway,
        walkwayMaterial,
      );
    } else if (activeWalkway) {
      this.addBox(
        group,
        junctionThickness + 0.9,
        0.28,
        junctionThickness + 0.9,
        walkwayMaterial,
        0,
        topY + 0.08,
        0,
      );
    }

    // Horizontal floor/campaign bands keep very tall walls architecturally legible.
    const visibleFloorLines = partial ? 0 : Math.min(Math.max(0, level - 1), 10);
    for (let floor = 1; floor <= visibleFloorLines; floor += 1) {
      this.addBox(
        group,
        junctionThickness * 1.16,
        0.16,
        junctionThickness * 1.16,
        darkMaterial,
        0,
        heightState.stack[0].topLocal + floor * CASTLE_ARCHITECTURE_STYLE.wall.levelRise - 1.05,
        0,
      );
    }

    if (kind === 'wall3') {
      this.addBox(
        group,
        junctionThickness + 0.45,
        0.28,
        junctionThickness + 0.45,
        metalMaterial,
        0,
        3.45,
        0,
      );
    }

    const shouldFlag = links.some((direction) =>
      this.services.detailGenerator.wallPlan(
        gx,
        gy,
        level,
        kind,
        direction,
        TILE,
        links.length >= 2,
      ).flag,
    );

    if (shouldFlag && (corner?.major || level >= 4)) {
      this.addAutomaticFlag(group, topY + 0.5, gx, gy, accentMaterial);
    }

    return group;
  }

  private addDirectionalWallArm(
    group: THREE.Group,
    direction: WallDirection,
    elevationDelta: number,
    height: number,
    thickness: number,
    wallMaterial: THREE.Material,
    darkMaterial: THREE.Material,
    walkwayMaterial: THREE.Material,
    accentMaterial: THREE.Material,
    slitMaterial: THREE.Material,
    kind: WallKind,
    gx: number,
    gy: number,
    level: number,
    battlement: boolean,
    walkway: boolean,
    importantConnection: boolean,
  ): void {
    const vector = WallSystem.vector(direction);
    const diagonalScale = Math.hypot(vector.x, vector.y);
    const run = (TILE * diagonalScale) / 2 + 0.24;
    const arm = new THREE.Group();
    arm.rotation.y = WallSystem.worldAngle(direction);
    group.add(arm);

    // Keep the defensive wall vertical. Terrain changes are absorbed by deeper
    // foundations and by a stepped height transition between adjacent cells.
    const bodyLength = run + CASTLE_ARCHITECTURE_STYLE.wall.joinOverlap;
    this.addBox(
      arm,
      thickness,
      height,
      bodyLength,
      wallMaterial,
      0,
      2.58 + height / 2,
      run / 2,
    );

    const terrainDrop = Math.max(0, -elevationDelta);
    const terrainRise = Math.max(0, elevationDelta);
    const foundationDepth = CASTLE_ARCHITECTURE_STYLE.wall.foundationBaseHeight + 0.04 + terrainDrop * 0.8 + Math.abs(elevationDelta) * 0.2;
    this.addBox(
      arm,
      thickness * 1.34,
      foundationDepth,
      bodyLength + 0.16,
      darkMaterial,
      0,
      2.22 - foundationDepth / 2 + 0.16,
      run / 2,
    );

    this.addBox(
      arm,
      thickness * 1.18,
      0.3,
      bodyLength + 0.08,
      accentMaterial,
      0,
      2.64,
      run / 2,
    );

    if (terrainRise > 0.35) {
      const stepHeight = Math.min(terrainRise, 1.4);
      this.addBox(
        arm,
        thickness * 1.2,
        stepHeight,
        Math.min(0.72, run * 0.28),
        darkMaterial,
        0,
        2.22 + stepHeight / 2,
        run - 0.18,
      );
    }

    if (walkway) {
      this.addBox(
        arm,
        Math.max(1.05, thickness - CASTLE_ARCHITECTURE_STYLE.wall.walkwayInset),
        CASTLE_ARCHITECTURE_STYLE.wall.walkwayThickness,
        bodyLength,
        walkwayMaterial,
        0,
        2.58 + height - 0.17,
        run / 2,
      );
    }

    if (battlement) {
      const sideOffset = Math.max(0.46, thickness / 2 - 0.03);
      const parapetSpan = Math.max(0.95, run - (importantConnection ? 0.38 : 0.1));

      if (kind === 'wall2') {
        this.addTimberPalisadeCrown(
          arm,
          parapetSpan,
          sideOffset,
          2.58 + height + 0.03,
          wallMaterial,
          darkMaterial,
        );
      } else {
        for (const side of [-1, 1]) {
          this.addCrenellatedParapet(
            arm,
            parapetSpan,
            side * sideOffset,
            2.58 + height + 0.03,
            wallMaterial,
            importantConnection ? 0.1 : 0,
          );
        }

        if (kind === 'wall3') {
          this.addReinforcedWallCrown(
            arm,
            thickness,
            parapetSpan,
            2.58 + height + 0.03,
            wallMaterial,
            accentMaterial,
          );
        }
      }
    }

    const detailPlan = this.services.detailGenerator.wallPlan(
      gx,
      gy,
      level,
      kind,
      direction,
      run,
      importantConnection,
    );

    const slitY = 2.58 + Math.min(height * 0.52, 2.55 + Math.max(0, level - 1) * 0.3);
    for (const offset of detailPlan.slitOffsets) {
      const z = THREE.MathUtils.clamp(run / 2 + offset, 0.5, run - 0.45);
      for (const side of [-1, 1]) {
        this.addBox(
          arm,
          0.08,
          0.82,
          0.19,
          slitMaterial,
          side * (thickness / 2 + 0.045),
          slitY,
          z,
        );
      }
    }

    const tall = height >= 7.1;
    const buttressCount =
      kind === 'wall3' ? 2 : tall && !importantConnection ? 1 : importantConnection && tall ? 1 : 0;

    for (let i = 0; i < buttressCount; i += 1) {
      const z = buttressCount === 1 ? run * 0.55 : run * (0.38 + i * 0.34);
      for (const side of [-1, 1]) {
        const style =
          kind === 'wall3' || thickness >= 2.3
            ? 'heavy'
            : height >= 9.2
              ? 'stepped'
              : Math.abs(gx * 17 + gy * 29 + i) % 3 === 0
                ? 'angled'
                : 'simple';
        this.addContextualButtress(
          arm,
          style,
          side * (thickness / 2 + 0.28),
          z,
          Math.min(height * 0.5, 4.1),
          accentMaterial,
          side,
        );
      }
    }

    const shouldMachicolate =
      kind !== 'wall2' &&
      (level >= 3 || kind === 'wall3') &&
      (!importantConnection || level >= 4) &&
      Math.abs(gx * 37 + gy * 17 + level) % 3 !== 1;
    if (shouldMachicolate) {
      this.addWallMachicolations(
        arm,
        thickness,
        run,
        2.58 + height,
        wallMaterial,
        darkMaterial,
      );
    }

    if (kind !== 'wall2' && Math.abs(gx * 13 + gy * 23 + level) % 4 === 0) {
      this.addBox(
        arm,
        thickness + 0.05,
        0.1,
        Math.min(1.15, run * 0.34),
        this.medievalMaterials.moss,
        0,
        2.9,
        run * 0.62,
      );
    }
  }

  private addTimberPalisadeCrown(
    group: THREE.Group,
    span: number,
    sideOffset: number,
    y: number,
    timber: THREE.Material,
    timberDark: THREE.Material,
  ): void {
    const railLength = Math.max(1.0, span * 0.92);
    for (const side of [-1, 1]) {
      this.addBox(
        group,
        0.18,
        0.22,
        railLength,
        timberDark,
        side * sideOffset,
        y + 0.28,
        span / 2,
      );

      const postCount = 3;
      for (let i = 0; i < postCount; i += 1) {
        const z = span * (0.22 + i * 0.28);
        const post = this.addBox(
          group,
          0.22,
          0.82,
          0.22,
          timber,
          side * sideOffset,
          y + 0.58,
          z,
        );
        post.castShadow = true;

        const point = new THREE.Mesh(
          new THREE.ConeGeometry(0.2, 0.48, 4),
          timberDark,
        );
        point.position.set(side * sideOffset, y + 1.23, z);
        point.rotation.y = Math.PI / 4;
        point.castShadow = true;
        group.add(point);
      }
    }
  }

  private addReinforcedWallCrown(
    group: THREE.Group,
    thickness: number,
    span: number,
    y: number,
    stone: THREE.Material,
    accent: THREE.Material,
  ): void {
    this.addBox(
      group,
      thickness + 0.54,
      0.22,
      Math.max(1.1, span * 0.86),
      accent,
      0,
      y + 0.18,
      span / 2,
    );

    for (const zFactor of [0.28, 0.72]) {
      const z = span * zFactor;
      this.addBox(
        group,
        thickness + 0.42,
        0.72,
        0.52,
        stone,
        0,
        y + 0.64,
        z,
      );
    }
  }

  private addCrenellatedParapet(
    group: THREE.Group,
    span: number,
    sideOffset: number,
    y: number,
    material: THREE.Material,
    endInset = 0,
  ): void {
    const { merlonWidth, crenelWidth, baseHeight, merlonHeight, depth, bevel } =
      CASTLE_ARCHITECTURE_STYLE.battlement;
    const module = merlonWidth + crenelWidth;
    const usable = Math.max(0.9, span - endInset * 2);
    const count = Math.max(1, Math.floor((usable - merlonWidth) / module));
    const actualSpan = count * module + merlonWidth;
    const shape = new THREE.Shape();

    shape.moveTo(-actualSpan / 2, 0);
    shape.lineTo(actualSpan / 2, 0);
    shape.lineTo(actualSpan / 2, baseHeight + merlonHeight);

    for (let i = count; i >= 0; i -= 1) {
      const right = -actualSpan / 2 + i * module + merlonWidth;
      const left = right - merlonWidth;
      shape.lineTo(right, baseHeight + merlonHeight);
      shape.lineTo(left, baseHeight + merlonHeight);

      if (i > 0) {
        shape.lineTo(left, baseHeight);
        shape.lineTo(left - crenelWidth, baseHeight);
      }
    }

    shape.lineTo(-actualSpan / 2, 0);

    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: true,
      bevelSize: bevel,
      bevelThickness: bevel,
      bevelSegments: 1,
      curveSegments: 1,
    });
    geometry.rotateY(Math.PI / 2);
    geometry.translate(-depth / 2, 0, 0);

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(sideOffset, y, span / 2);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  private addContextualButtress(
    group: THREE.Group,
    style: 'simple' | 'heavy' | 'stepped' | 'angled',
    x: number,
    z: number,
    height: number,
    material: THREE.Material,
    side: number,
  ): void {
    if (style === 'simple') {
      this.addTaperedButtress(
        group,
        x,
        2.28 + height / 2,
        z,
        height,
        0.46,
        0.74,
        material,
      );
      return;
    }

    if (style === 'heavy') {
      this.addTaperedButtress(
        group,
        x + side * 0.1,
        2.28 + height / 2,
        z,
        height,
        0.64,
        1.08,
        material,
      );
      this.addBox(
        group,
        0.82,
        0.34,
        1.15,
        material,
        x + side * 0.18,
        2.35,
        z,
      );
      return;
    }

    if (style === 'stepped') {
      const stages = 3;
      for (let stage = 0; stage < stages; stage += 1) {
        const stageHeight = height * (0.44 - stage * 0.075);
        const stageWidth = 1.0 - stage * 0.18;
        const stageX = x + side * stage * 0.08;
        this.addBox(
          group,
          stageWidth,
          stageHeight,
          0.82 - stage * 0.12,
          material,
          stageX,
          2.26 + stageHeight / 2 + stage * height * 0.24,
          z,
        );
      }
      return;
    }

    const brace = this.addBox(
      group,
      0.72,
      Math.sqrt(height * height + 1.25 * 1.25),
      0.72,
      material,
      x + side * 0.38,
      2.18 + height / 2,
      z,
    );
    brace.rotation.z = side * Math.atan2(1.25, height);
  }

  private addWallMachicolations(
    group: THREE.Group,
    thickness: number,
    span: number,
    topY: number,
    stone: THREE.Material,
    support: THREE.Material,
  ): void {
    const projection = thickness / 2 + 0.38;
    const count = Math.max(2, Math.min(4, Math.floor(span / 1.1)));

    for (const side of [-1, 1]) {
      this.addBox(
        group,
        0.48,
        0.32,
        Math.max(1.25, span * 0.78),
        stone,
        side * projection,
        topY - 0.46,
        span / 2,
      );

      for (let i = 0; i < count; i += 1) {
        const z = span * (0.2 + (i / Math.max(1, count - 1)) * 0.6);
        const corbel = this.addBox(
          group,
          0.36,
          0.62,
          0.36,
          support,
          side * (thickness / 2 + 0.18),
          topY - 0.72,
          z,
        );
        corbel.rotation.z = side * 0.12;
      }
    }
  }

  private addTowerMachicolations(
    group: THREE.Group,
    shape: TowerShape,
    topY: number,
    size: number,
    stone: THREE.Material,
    support: THREE.Material,
  ): void {
    const squareLike = shape === 'square' || shape === 'corner';
    if (squareLike) {
      const span = size + 0.5;
      const edge = span / 2;
      for (const side of [-1, 1]) {
        this.addBox(group, span + 0.4, 0.3, 0.5, stone, 0, topY - 0.5, side * (edge + 0.16));
        this.addBox(group, 0.5, 0.3, span + 0.4, stone, side * (edge + 0.16), topY - 0.5, 0);
      }
      for (const x of [-span * 0.32, 0, span * 0.32]) {
        for (const z of [-edge, edge]) {
          this.addBox(group, 0.3, 0.62, 0.38, support, x, topY - 0.78, z);
        }
      }
      for (const z of [-span * 0.32, 0, span * 0.32]) {
        for (const x of [-edge, edge]) {
          this.addBox(group, 0.38, 0.62, 0.3, support, x, topY - 0.78, z);
        }
      }
      return;
    }

    const radius = size + 0.28;
    const segments = shape === 'octagonal' ? 8 : 12;
    const ring = new THREE.Mesh(
      new THREE.CylinderGeometry(radius + 0.18, radius + 0.18, 0.32, segments),
      stone,
    );
    ring.position.y = topY - 0.48;
    ring.castShadow = true;
    group.add(ring);

    for (let i = 0; i < segments; i += 2) {
      const angle = (i / segments) * Math.PI * 2;
      const corbel = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, 0.66, 0.38),
        support,
      );
      corbel.position.set(
        Math.cos(angle) * radius,
        topY - 0.78,
        Math.sin(angle) * radius,
      );
      corbel.rotation.y = -angle;
      corbel.castShadow = true;
      group.add(corbel);
    }
  }

  private addTaperedButtress(
    group: THREE.Group,
    x: number,
    y: number,
    z: number,
    height: number,
    topWidth: number,
    bottomWidth: number,
    material: THREE.Material,
  ): void {
    const geometry = new THREE.CylinderGeometry(
      Math.max(0.18, topWidth * 0.48),
      Math.max(0.28, bottomWidth * 0.58),
      height,
      4,
      1,
      false,
    );
    geometry.rotateY(Math.PI / 4);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.scale.z = 0.78;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  private addAutomaticCorner(
    group: THREE.Group,
    kind: 'square' | 'rounded' | 'reinforced' | 'turret' | 'buttressed',
    height: number,
    thickness: number,
    topY: number,
    wallMaterial: THREE.Material,
    darkMaterial: THREE.Material,
    accentMaterial: THREE.Material,
    battlement: boolean,
    walkway: boolean,
    walkwayMaterial: THREE.Material,
  ): void {
    const radius = thickness * (kind === 'turret' ? 1.02 : 0.9);
    const cornerExtra = kind === 'turret' ? 1.5 : kind === 'reinforced' ? 0.45 : 0;

    if (kind === 'rounded' || kind === 'turret') {
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(radius * 1.2, radius * 1.34, 0.85, 16),
        darkMaterial,
      );
      base.position.y = 2.18;
      base.castShadow = true;
      base.receiveShadow = true;
      group.add(base);

      const cylinder = new THREE.Mesh(
        new THREE.CylinderGeometry(radius, radius * 1.06, height + cornerExtra, 16),
        wallMaterial,
      );
      cylinder.position.y = 2.58 + (height + cornerExtra) / 2;
      cylinder.castShadow = true;
      cylinder.receiveShadow = true;
      group.add(cylinder);

      if (walkway) {
        const platform = new THREE.Mesh(
          new THREE.CylinderGeometry(radius * 1.05, radius * 1.05, 0.3, 16),
          walkwayMaterial,
        );
        platform.position.y = topY + cornerExtra - 0.2;
        platform.castShadow = true;
        group.add(platform);
      }

      if (battlement) {
        const parapetRing = new THREE.Mesh(
          new THREE.CylinderGeometry(radius * 1.04, radius * 1.04, 0.42, 16, 1, true),
          wallMaterial,
        );
        parapetRing.position.y = topY + cornerExtra + 0.22;
        parapetRing.castShadow = true;
        parapetRing.receiveShadow = true;
        group.add(parapetRing);

        const count = kind === 'turret' ? 10 : 8;
        for (let i = 0; i < count; i += 1) {
          const angle = (i / count) * Math.PI * 2;
          const merlon = new THREE.Mesh(
            new THREE.CylinderGeometry(0.22, 0.28, 0.92, 4),
            wallMaterial,
          );
          merlon.rotation.y = Math.PI / 4 - angle;
          merlon.position.set(
            Math.cos(angle) * radius * 0.98,
            topY + cornerExtra + 0.48,
            Math.sin(angle) * radius * 0.98,
          );
          merlon.castShadow = true;
          merlon.receiveShadow = true;
          group.add(merlon);
        }
      }
    } else {
      const scale = kind === 'reinforced' ? 1.58 : kind === 'buttressed' ? 1.48 : 1.28;
      this.addBox(
        group,
        thickness * scale,
        height + cornerExtra,
        thickness * scale,
        wallMaterial,
        0,
        2.58 + (height + cornerExtra) / 2,
        0,
      );
      this.addBox(
        group,
        thickness * (scale + 0.28),
        0.78,
        thickness * (scale + 0.28),
        darkMaterial,
        0,
        2.18,
        0,
      );

      if (kind === 'reinforced' || kind === 'buttressed') {
        for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
          const support = new THREE.Group();
          support.rotation.y = angle;
          group.add(support);
          this.addTaperedButtress(
            support,
            0,
            2.25 + Math.min(3.8, height * 0.5) / 2,
            thickness * 1.08,
            Math.min(3.8, height * 0.5),
            thickness * 0.34,
            thickness * 0.62,
            kind === 'reinforced' ? darkMaterial : accentMaterial,
          );
        }
      }

      if (walkway) {
        this.addBox(
          group,
          thickness * scale + 0.2,
          0.3,
          thickness * scale + 0.2,
          walkwayMaterial,
          0,
          topY - 0.2,
          0,
        );
      }

      if (battlement) {
        const span = thickness * scale;
        const edge = span / 2 - 0.18;
        this.addCornerCrenellations(group, span, edge, topY, wallMaterial);
      }
    }
  }

  private addCornerCrenellations(
    group: THREE.Group,
    span: number,
    edge: number,
    y: number,
    material: THREE.Material,
  ): void {
    this.addBox(group, span, 0.38, 0.28, material, 0, y + 0.18, -edge);
    this.addBox(group, span, 0.38, 0.28, material, 0, y + 0.18, edge);
    this.addBox(group, 0.28, 0.38, span, material, -edge, y + 0.18, 0);
    this.addBox(group, 0.28, 0.38, span, material, edge, y + 0.18, 0);

    const merlon = (x: number, z: number, rotationY: number): void => {
      const geometry = new THREE.CylinderGeometry(0.24, 0.3, 0.9, 4);
      geometry.rotateY(Math.PI / 4);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y + 0.46, z);
      mesh.rotation.y += rotationY;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    };

    const positions = [-span * 0.32, 0, span * 0.32];
    for (const p of positions) {
      merlon(p, -edge, 0);
      merlon(p, edge, Math.PI);
      merlon(-edge, p, Math.PI / 2);
      merlon(edge, p, -Math.PI / 2);
    }
  }

  private addAutomaticFlag(
    group: THREE.Group,
    topY: number,
    gx: number,
    gy: number,
    clothMaterial: THREE.Material,
  ): void {
    const mast = this.medievalMaterials.timberDark;
    this.addBox(group, 0.08, 2.2, 0.08, mast, 0, topY + 1.1, 0);
    const flag = this.addBox(group, 1.0, 0.46, 0.055, clothMaterial, 0.52, topY + 1.82, 0);
    flag.userData.castleFlag = { phase: (gx * 0.71 + gy * 0.37) % (Math.PI * 2) };
  }

  private addSlopedWallArm(
    group: THREE.Group,
    axis: 'x' | 'z',
    sign: number,
    elevationDelta: number,
    height: number,
    thickness: number,
    material: THREE.Material,
  ): void {
    const run = TILE / 2 + 0.18;
    const bodyLength = run + 0.22;
    const body = this.addBox(
      group,
      axis === 'x' ? bodyLength : thickness,
      height,
      axis === 'z' ? bodyLength : thickness,
      material,
      axis === 'x' ? sign * run / 2 : 0,
      2.58 + height / 2,
      axis === 'z' ? sign * run / 2 : 0,
    );
    body.castShadow = true;

    const terrainDrop = Math.max(0, -elevationDelta);
    const foundationHeight = 0.82 + terrainDrop * 0.8 + Math.abs(elevationDelta) * 0.2;
    this.addBox(
      group,
      axis === 'x' ? bodyLength + 0.14 : thickness * 1.28,
      foundationHeight,
      axis === 'z' ? bodyLength + 0.14 : thickness * 1.28,
      this.medievalMaterials.castleStone(this.stoneStyle, 'foundation'),
      axis === 'x' ? sign * run / 2 : 0,
      2.22 - foundationHeight / 2 + 0.16,
      axis === 'z' ? sign * run / 2 : 0,
    );
  }

  private resolveGateOrientation(
    gx: number,
    gy: number,
    cell?: GridCell,
  ): { vertical: boolean; rotation: number } {
    const manualRotation = ((cell?.rotation ?? 0) % 4 + 4) % 4;
    if (cell?.rotationMode === 'manual') {
      return { vertical: manualRotation % 2 === 1, rotation: manualRotation };
    }

    const links = this.castleBlocksByCell.get(this.key(gx, gy))?.links ?? this.wallConnections(gx, gy, cell ?? { kind: 'gate' });
    const horizontalNeighbors = Number(links.includes('W')) + Number(links.includes('E'));
    const verticalNeighbors = Number(links.includes('N')) + Number(links.includes('S'));

    let vertical: boolean;
    if (verticalNeighbors !== horizontalNeighbors) {
      vertical = verticalNeighbors > horizontalNeighbors;
    } else if (horizontalNeighbors + verticalNeighbors > 0 && cell?.rotation !== undefined) {
      vertical = manualRotation % 2 === 1;
    } else if (horizontalNeighbors + verticalNeighbors > 0) {
      vertical = ((gx + gy) & 1) === 1;
    } else {
      vertical = manualRotation % 2 === 1;
    }

    return { vertical, rotation: vertical ? 1 : 0 };
  }

  private makeGate(
    group: THREE.Group,
    gx: number,
    gy: number,
    cell: GridCell,
  ): THREE.Group {
    if ((cell.damage ?? 0) >= 1) {
      const rubble = this.medievalMaterials.castleStone(this.stoneStyle, 'foundation', gx, gy);
      for (let i = 0; i < 8; i += 1) {
        this.addBox(group, 0.65 + (i % 3) * 0.25, 0.3 + (i % 2) * 0.15, 0.7, rubble,
          ((i * 5 + gx * 3) % 9 - 4) * 0.38, 2.36, ((i * 7 + gy * 2) % 7 - 3) * 0.4);
      }
      group.userData.rubble = true;
      return group;
    }
    const safeLevel = Math.max(1, Math.min(FORTIFICATION_MAX_LEVEL, Math.floor(cell.level ?? 1)));
    const wallMaterial = this.medievalMaterials.castleStone(this.stoneStyle, 'body', gx, gy);
    const foundation = this.medievalMaterials.castleStone(this.stoneStyle, 'foundation', gx, gy);
    const accentStone = this.medievalMaterials.castleStone(this.stoneStyle, 'alt', gx, gy);
    const woodMaterial = this.medievalMaterials.timber;
    const darkWood = this.medievalMaterials.timberDark;
    const iron = this.medievalMaterials.iron;
    const shadow = this.medievalMaterials.arrowVoid;

    const orientation = this.resolveGateOrientation(gx, gy, cell);
    const vertical = orientation.vertical;
    group.userData.defenseSilhouette = {
      ...GATEHOUSE_SILHOUETTE_PROFILE,
      level: safeLevel,
    };

    const core = new THREE.Group();
    const door = new THREE.Group();
    const gateStyle = CASTLE_ARCHITECTURE_STYLE.gate;
    const gateHalfWidth = gateStyle.width / 2;
    const pierX = gateHalfWidth - gateStyle.pierWidth / 2;
    const levelRise = (safeLevel - 1) * 0.55;
    const gateBodyHeight = gateStyle.bodyHeight + levelRise;
    const gateBodyCenterY = 5.22 + levelRise / 2;
    const topBandY = 7.28 + levelRise;
    const walkwayY = 7.72 + levelRise;
    const battlementY = 7.78 + levelRise;
    this.addBox(core, gateStyle.width, 0.82, gateStyle.depth, foundation, 0, 2.15, 0);
    this.addBox(core, gateStyle.pierWidth, gateBodyHeight, gateStyle.depth - 0.18, wallMaterial, -pierX, gateBodyCenterY, 0);
    this.addBox(core, gateStyle.pierWidth, gateBodyHeight, gateStyle.depth - 0.18, wallMaterial, pierX, gateBodyCenterY, 0);
    this.addBox(core, gateStyle.width, gateStyle.topBandHeight, gateStyle.depth - 0.12, wallMaterial, 0, topBandY, 0);

    this.addBox(door, gateStyle.openingWidth, gateStyle.openingHeight, 0.2, shadow, 0, 4.2, -gateStyle.depth / 2 + 0.07);
    this.addBox(door, gateStyle.openingWidth - 0.17, gateStyle.openingHeight - 0.15, 0.24, woodMaterial, 0, 4.18, -gateStyle.depth / 2 - 0.05);
    for (const x of [-0.58, 0.58]) {
      this.addBox(door, 0.14, 3.05, 0.34, darkWood, x, 4.16, -1.39);
    }
    for (const y of [3.25, 4.15, 5.05]) {
      this.addBox(door, 1.8, 0.12, 0.34, darkWood, 0, y, -1.39);
    }
    core.add(door);

    this.addBox(core, gateStyle.width + 0.2, gateStyle.walkwayThickness, gateStyle.depth + 0.08, this.medievalMaterials.castleStone(this.stoneStyle, 'walkway', gx, gy), 0, walkwayY, 0);
    this.addTowerCrenellatedEdge(core, gateStyle.width - 0.46, 0, -(gateStyle.depth / 2 - 0.3), battlementY, 0, wallMaterial);
    this.addTowerCrenellatedEdge(core, gateStyle.width - 0.46, 0, gateStyle.depth / 2 - 0.3, battlementY, Math.PI, wallMaterial);

    // Twin raised pier crowns make a gate readable as an entrance rather than
    // another wall segment at normal/strategic zoom. Level 4 keeps its larger turrets.
    if (safeLevel < 4) {
      const crownHeight = 0.72 + (safeLevel - 1) * 0.18;
      for (const sign of [-1, 1]) {
        this.addBox(
          core,
          0.9,
          crownHeight,
          gateStyle.depth * 0.72,
          accentStone,
          sign * pierX,
          walkwayY + crownHeight / 2 + 0.22,
          0,
        );
        const cap = new THREE.Mesh(
          new THREE.ConeGeometry(0.68, 0.72 + safeLevel * 0.08, 4),
          this.medievalMaterials.roofTile,
        );
        cap.position.set(
          sign * pierX,
          walkwayY + crownHeight + 0.58,
          0,
        );
        cap.rotation.y = Math.PI / 4;
        cap.castShadow = true;
        core.add(cap);
      }
    }

    if (safeLevel >= 2) {
      for (const y of [3.45, 4.25, 5.05]) {
        this.addBox(door, gateStyle.openingWidth - 0.26, 0.09, 0.39, iron, 0, y, -1.4);
      }
      for (const sign of [-1, 1]) {
        this.addTaperedButtress(
          core,
          sign * (gateHalfWidth - 0.18),
          4.08,
          0,
          3.65,
          0.42,
          0.78,
          accentStone,
        );
      }
    }

    if (safeLevel >= 3) {
      const corbelY = walkwayY - 0.5;
      for (const x of [-1.45, -0.48, 0.48, 1.45]) {
        for (const zSign of [-1, 1]) {
          this.addBox(
            core,
            0.34,
            0.62,
            0.46,
            accentStone,
            x,
            corbelY,
            zSign * (gateStyle.depth / 2 + 0.08),
          );
        }
      }
      for (const x of [-pierX, pierX]) {
        for (const zSign of [-1, 1]) {
          this.addBox(
            core,
            0.16,
            0.72,
            0.08,
            shadow,
            x,
            topBandY - 0.45,
            zSign * (gateStyle.depth / 2 + 0.02),
          );
        }
      }
    }

    if (safeLevel >= 4) {
      const turretHeight = 1.85;
      const turretRadius = 0.72;
      for (const sign of [-1, 1]) {
        const turret = new THREE.Mesh(
          new THREE.CylinderGeometry(turretRadius, turretRadius * 1.06, turretHeight, 12),
          wallMaterial,
        );
        turret.position.set(sign * (gateHalfWidth - 0.26), walkwayY + turretHeight / 2 - 0.05, 0);
        turret.castShadow = true;
        turret.receiveShadow = true;
        core.add(turret);

        const crown = new THREE.Mesh(
          new THREE.CylinderGeometry(turretRadius * 1.12, turretRadius * 1.12, 0.24, 12),
          accentStone,
        );
        crown.position.set(sign * (gateHalfWidth - 0.26), walkwayY + turretHeight - 0.02, 0);
        crown.castShadow = true;
        core.add(crown);

        this.addBox(core, 0.07, 1.85, 0.07, iron, sign * (gateHalfWidth - 0.26), walkwayY + turretHeight + 0.82, 0);
        const flag = this.addBox(
          core,
          0.72,
          0.34,
          0.05,
          this.medievalMaterials.roofTile,
          sign * (gateHalfWidth - 0.26) + 0.36,
          walkwayY + turretHeight + 1.35,
          0,
        );
        flag.userData.castleFlag = { phase: gx * 0.37 + gy * 0.23 + sign };
      }
    }

    if (vertical) core.rotation.y = Math.PI / 2;
    group.add(core);
    this.services.gateSystem.registerGate(gx, gy, group, door, vertical, cell.gateOpen !== false);

    const specs = [
      { dx: -1, dy: 0, axis: 'x' as const, sign: -1 },
      { dx: 1, dy: 0, axis: 'x' as const, sign: 1 },
      { dx: 0, dy: -1, axis: 'z' as const, sign: -1 },
      { dx: 0, dy: 1, axis: 'z' as const, sign: 1 },
    ];

    for (const spec of specs) {
      if (!this.isWallFamily(this.kindAt(gx + spec.dx, gy + spec.dy))) continue;
      const elevationDelta =
        this.terrainElevation(gx + spec.dx, gy + spec.dy) -
        this.terrainElevation(gx, gy);
      this.addSlopedWallArm(
        group,
        spec.axis,
        spec.sign,
        elevationDelta,
        5.25,
        1.9,
        wallMaterial,
      );
    }

    return group;
  }

  private makeTower(group: THREE.Group, gx: number, gy: number, cell: GridCell): THREE.Group {
    const level = Math.max(1, Math.min(FORTIFICATION_MAX_LEVEL, Math.floor(cell.level ?? 1)));
    const shape = cell.towerShape ?? 'round';
    const top = cell.towerTop ?? 'battlement';
    const height = (shape === 'watch' ? 6.4 : 7.4) + Math.max(0, level - 1) * CASTLE_ARCHITECTURE_STYLE.tower.levelRise;
    const bodyBase = 2.58;
    const topY = bodyBase + height;
    group.userData.defenseSilhouette = {
      ...towerSilhouetteProfile(shape),
      level,
      top,
    };

    const stone = this.medievalMaterials.castleStone(this.stoneStyle, 'body', gx, gy);
    const darkStone = this.medievalMaterials.castleStone(this.stoneStyle, 'foundation', gx, gy);
    const stoneAccent = this.medievalMaterials.castleStone(this.stoneStyle, 'alt', gx, gy);
    const roofMaterial = this.medievalMaterials.roofTile;
    const wood = this.medievalMaterials.timber;
    const metal = this.medievalMaterials.iron;
    const openingMaterial = this.medievalMaterials.arrowVoid;

    const neighborElevations: number[] = [];
    for (let oy = -1; oy <= 1; oy += 1) {
      for (let ox = -1; ox <= 1; ox += 1) {
        if (ox === 0 && oy === 0) continue;
        neighborElevations.push(this.terrainElevation(gx + ox, gy + oy));
      }
    }
    const ownElevation = this.terrainElevation(gx, gy);
    const minNeighbor = Math.min(ownElevation, ...neighborElevations);
    const foundationDrop = THREE.MathUtils.clamp(ownElevation - minNeighbor, 0, 2.4);
    const foundationHeight = 0.95 + foundationDrop;

    const squareLike = shape === 'square' || shape === 'corner';
    const width = shape === 'corner' ? CASTLE_ARCHITECTURE_STYLE.tower.cornerWidth : shape === 'square' ? CASTLE_ARCHITECTURE_STYLE.tower.squareWidth : 0;
    const radius = shape === 'watch' ? CASTLE_ARCHITECTURE_STYLE.tower.watchRadius : shape === 'octagonal' ? CASTLE_ARCHITECTURE_STYLE.tower.octagonalRadius : CASTLE_ARCHITECTURE_STYLE.tower.roundRadius;

    if (squareLike) {
      this.addBox(
        group,
        width + 0.75,
        foundationHeight,
        width + 0.75,
        darkStone,
        0,
        2.22 - foundationHeight / 2 + 0.34,
        0,
      );
      this.addBox(group, width + 0.3, 0.34, width + 0.3, stoneAccent, 0, 2.66, 0);
      this.addBox(group, width, height, width, stone, 0, bodyBase + height / 2, 0);

      for (const [x, z] of [
        [-width / 2 + 0.22, -width / 2 + 0.22],
        [width / 2 - 0.22, -width / 2 + 0.22],
        [-width / 2 + 0.22, width / 2 - 0.22],
        [width / 2 - 0.22, width / 2 - 0.22],
      ] as Array<[number, number]>) {
        this.addTaperedButtress(
          group,
          x,
          2.4 + Math.min(3.8, height * 0.42) / 2,
          z,
          Math.min(3.8, height * 0.42),
          0.42,
          0.72,
          stoneAccent,
        );
      }

      if (shape === 'corner') {
        this.addBox(group, 0.44, height * 0.76, width + 0.38, darkStone, -width / 2 - 0.1, bodyBase + height * 0.38, 0);
        this.addBox(group, width + 0.38, height * 0.76, 0.44, darkStone, 0, bodyBase + height * 0.38, width / 2 + 0.1);
      }
    } else {
      const segments = shape === 'octagonal' ? 8 : shape === 'watch' ? 12 : 20;
      const foundationBase = new THREE.Mesh(
        new THREE.CylinderGeometry(radius * 1.32, radius * 1.48, foundationHeight, segments),
        darkStone,
      );
      foundationBase.position.y = 2.22 - foundationHeight / 2 + 0.34;
      foundationBase.castShadow = true;
      foundationBase.receiveShadow = true;
      group.add(foundationBase);

      const plinth = new THREE.Mesh(
        new THREE.CylinderGeometry(radius * 1.12, radius * 1.16, 0.34, segments),
        stoneAccent,
      );
      plinth.position.y = 2.66;
      plinth.castShadow = true;
      plinth.receiveShadow = true;
      group.add(plinth);

      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(radius, radius * 1.04, height, segments),
        stone,
      );
      body.position.y = bodyBase + height / 2;
      body.castShadow = true;
      body.receiveShadow = true;
      group.add(body);
    }

    const floorCount = Math.max(2, level + 2);
    for (let floor = 1; floor < floorCount; floor += 1) {
      const y = bodyBase + (height * floor) / floorCount;
      if (squareLike) {
        this.addBox(
          group,
          width + 0.12,
          0.16,
          width + 0.12,
          darkStone,
          0,
          y,
          0,
        );
      } else {
        const segments = shape === 'octagonal' ? 8 : shape === 'watch' ? 12 : 20;
        const band = new THREE.Mesh(
          new THREE.CylinderGeometry(radius * 1.04, radius * 1.04, 0.16, segments),
          darkStone,
        );
        band.position.y = y;
        band.castShadow = true;
        group.add(band);
      }
    }

    const towerLinks = this.wallConnections(gx, gy, cell);
    for (const direction of towerLinks) {
      const vector = WallSystem.vector(direction);
      if (!this.isWallFamily(this.kindAt(gx + vector.x, gy + vector.y))) continue;

      const elevationDelta =
        this.terrainElevation(gx + vector.x, gy + vector.y) -
        this.terrainElevation(gx, gy);
      this.addTowerWallConnector(
        group,
        direction,
        elevationDelta,
        Math.min(height, 5.7),
        stone,
      );
    }

    const openingRadius = squareLike ? width / 2 : radius;
    for (let floor = 0; floor < Math.max(2, level + 1); floor += 1) {
      const y = 3.55 + floor * 2.0;
      if (y > topY - 1.0) break;

      const slitHeight = floor === 0 ? 0.92 : 0.78;
      this.addBox(group, 0.18, slitHeight, 0.08, openingMaterial, 0, y, -openingRadius - 0.035);
      this.addBox(group, 0.18, slitHeight, 0.08, openingMaterial, 0, y, openingRadius + 0.035);
      this.addBox(group, 0.08, slitHeight, 0.18, openingMaterial, -openingRadius - 0.035, y, 0);
      this.addBox(group, 0.08, slitHeight, 0.18, openingMaterial, openingRadius + 0.035, y, 0);
    }

    if (
      level >= 2 &&
      (shape === 'corner' || shape === 'watch' || level >= 3 || Math.abs(gx * 19 + gy * 23) % 3 === 0)
    ) {
      this.addTowerMachicolations(
        group,
        shape,
        topY,
        squareLike ? width : radius,
        stone,
        darkStone,
      );
    }

    if (level >= 2) {
      const crestY = topY - 1.18;
      const crestOffset = openingRadius + 0.055;
      const north = this.addBox(group, 0.48, 0.68, 0.12, stoneAccent, 0, crestY, -crestOffset);
      const south = this.addBox(group, 0.48, 0.68, 0.12, stoneAccent, 0, crestY, crestOffset);
      const west = this.addBox(group, 0.12, 0.68, 0.48, stoneAccent, -crestOffset, crestY, 0);
      const east = this.addBox(group, 0.12, 0.68, 0.48, stoneAccent, crestOffset, crestY, 0);
      north.rotation.y = 0;
      south.rotation.y = Math.PI;
      west.rotation.y = Math.PI / 2;
      east.rotation.y = -Math.PI / 2;
    }

    if (level >= 3) {
      if (squareLike) {
        this.addBox(group, width + 0.72, 0.24, width + 0.72, stoneAccent, 0, topY - 0.38, 0);
      } else {
        const segments = shape === 'octagonal' ? 8 : shape === 'watch' ? 12 : 20;
        const gallery = new THREE.Mesh(
          new THREE.CylinderGeometry(radius * 1.2, radius * 1.2, 0.24, segments),
          stoneAccent,
        );
        gallery.position.y = topY - 0.38;
        gallery.castShadow = true;
        gallery.receiveShadow = true;
        group.add(gallery);
      }
    }

    if (level >= 4) {
      if (squareLike) {
        this.addBox(group, width + 0.92, 0.22, width + 0.92, darkStone, 0, topY + 0.04, 0);
      } else {
        const segments = shape === 'octagonal' ? 8 : shape === 'watch' ? 12 : 20;
        const crown = new THREE.Mesh(
          new THREE.CylinderGeometry(radius * 1.28, radius * 1.28, 0.22, segments),
          darkStone,
        );
        crown.position.y = topY + 0.04;
        crown.castShadow = true;
        group.add(crown);
      }

      for (const sign of [-1, 1]) {
        const poleX = sign * Math.min(1.05, openingRadius * 0.55);
        this.addBox(group, 0.07, 2.05, 0.07, metal, poleX, topY + 1.05, 0);
        const pennant = this.addBox(group, 0.7, 0.32, 0.05, roofMaterial, poleX + 0.35, topY + 1.72, 0);
        pennant.userData.castleFlag = { phase: gx * 0.29 + gy * 0.43 + sign * 0.7 };
      }
    }

    if (shape === 'watch') {
      const collarRadius = radius * 1.2;
      const collar = new THREE.Mesh(
        new THREE.CylinderGeometry(collarRadius, collarRadius * 0.96, 0.42, 12),
        wood,
      );
      collar.position.y = topY - 0.42;
      collar.castShadow = true;
      group.add(collar);
    } else if (shape === 'corner') {
      const shoulder = width / 2 + 0.12;
      for (const [x, z] of [
        [-shoulder, -shoulder],
        [shoulder, -shoulder],
        [-shoulder, shoulder],
        [shoulder, shoulder],
      ] as Array<[number, number]>) {
        this.addBox(group, 0.52, 0.68, 0.52, darkStone, x, topY - 0.16, z);
      }
    }

    this.addTowerTop(group, shape, top, topY, squareLike ? width : radius, stone, roofMaterial, wood, metal);

    const autoFlag =
      level >= 3 &&
      (shape === 'watch' || shape === 'corner' || Math.abs(gx * 31 + gy * 17 + level) % 7 === 0);
    if (autoFlag && top !== 'flag') {
      this.addBox(group, 0.08, 2.55, 0.08, wood, 0, topY + 1.3, 0);
      const flag = this.addBox(group, 1.1, 0.5, 0.055, roofMaterial, 0.59, topY + 2.08, 0);
      flag.userData.castleFlag = { phase: gx * 0.41 + gy * 0.29 + level };
    }

    return group;
  }

  private bridgePairKey(
    a: GridPoint,
    b: GridPoint,
  ): string {
    const first = a.x < b.x || (a.x === b.x && a.y <= b.y) ? a : b;
    const second = first === a ? b : a;
    return `${first.x},${first.y}:${second.x},${second.y}`;
  }

  private existingTowerBridge(
    a: GridPoint,
    b: GridPoint,
  ): TowerBridgeState | undefined {
    const key = this.bridgePairKey(a, b);
    return Array.from(this.towerBridges.values()).find(
      (bridge) =>
        this.bridgePairKey(
          { x: bridge.ax, y: bridge.ay },
          { x: bridge.bx, y: bridge.by },
        ) === key,
    );
  }

  private validateTowerBridge(
    a: GridPoint,
    b: GridPoint,
  ): { valid: boolean; reason?: string } {
    const cellA = this.services.state.getCell(a.x, a.y);
    const cellB = this.services.state.getCell(b.x, b.y);
    if (cellA?.kind !== 'tower' || cellB?.kind !== 'tower') {
      return { valid: false, reason: 'Tower Bridge requires two main towers' };
    }

    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 2 || distance > 8.5) {
      return { valid: false, reason: 'Tower Bridge distance must be 2–8 tiles' };
    }

    const aligned =
      dx === 0 ||
      dy === 0 ||
      Math.abs(dx) === Math.abs(dy);
    if (!aligned) {
      return { valid: false, reason: 'Towers must align straight or diagonally' };
    }

    const topA =
      this.terrainElevation(a.x, a.y) +
      this.fortificationTopLocal(cellA);
    const topB =
      this.terrainElevation(b.x, b.y) +
      this.fortificationTopLocal(cellB);
    if (Math.abs(topA - topB) > 1.8) {
      return { valid: false, reason: 'Tower platforms are too different in height' };
    }

    const steps = Math.max(Math.abs(dx), Math.abs(dy));
    for (let i = 1; i < steps; i += 1) {
      const x = Math.round(a.x + (dx * i) / steps);
      const y = Math.round(a.y + (dy * i) / steps);
      if (this.services.keepSystem.findAtCell(x, y)) {
        return { valid: false, reason: 'Bridge path crosses the Keep' };
      }

      const cell = this.services.state.getCell(x, y);
      if (
        cell &&
        cell.kind !== 'road' &&
        cell.kind !== 'dirtRoad' &&
        cell.kind !== 'stoneRoad' &&
        cell.kind !== 'moat'
      ) {
        return { valid: false, reason: 'Bridge path must remain clear' };
      }
    }

    return { valid: true };
  }

  private handleTowerBridgeClick(point: GridPoint): void {
    const cell = this.services.state.getCell(point.x, point.y);
    if (cell?.kind !== 'tower') {
      this.setStatus('Tower Bridge: select a main tower platform');
      return;
    }

    if (!this.towerBridgeStart) {
      this.towerBridgeStart = { ...point };
      this.towerBridgeHover = null;
      this.clearGroup(this.wallPreviewLayer);
      this.setStatus('Tower Bridge: select the second tower · an existing connection will be selected for upgrades');
      return;
    }

    const start = this.towerBridgeStart;
    if (start.x === point.x && start.y === point.y) {
      this.towerBridgeStart = null;
      this.towerBridgeHover = null;
      this.clearGroup(this.wallPreviewLayer);
      this.setStatus('Tower Bridge selection cancelled');
      return;
    }

    const existing = this.existingTowerBridge(start, point);
    if (existing) {
      this.selectedTowerBridgeId = existing.id;
      this.selectedCell = null;
      this.selectedKeepId = null;
      this.towerBridgeStart = null;
      this.towerBridgeHover = null;
      this.clearGroup(this.wallPreviewLayer);
      this.syncArmyCampUpgradeUI();
      const level = Math.max(1, Math.min(FORTIFICATION_MAX_LEVEL, Math.floor(existing.level ?? 1)));
      this.setStatus(`Tower Bridge selected · Level ${level} · upgrade or remove it from Build Settings`);
      return;
    }

    const validation = this.validateTowerBridge(start, point);
    if (!validation.valid) {
      this.setStatus(validation.reason ?? 'Invalid Tower Bridge');
      this.renderTowerBridgePreview(start, point);
      return;
    }

    if (!this.ensureConstructionAffordable('towerBridge')) return;

    this.recordHistory();
    const bridge: TowerBridgeState = {
      id: this.nextTowerBridgeId++,
      ax: start.x,
      ay: start.y,
      bx: point.x,
      by: point.y,
      kind: this.towerBridgeKind,
      level: 1,
    };
    this.towerBridges.set(bridge.id, bridge);
    this.selectedTowerBridgeId = bridge.id;
    this.selectedCell = null;
    this.selectedKeepId = null;
    this.spendConstructionCost('towerBridge');
    this.towerBridgeStart = null;
    this.towerBridgeHover = null;
    this.clearGroup(this.wallPreviewLayer);
    this.finishBuild();
    this.startConstruction(`bridge:${bridge.id}`, 1100);
    this.syncArmyCampUpgradeUI();
    this.setStatus(
      bridge.kind === 'stone'
        ? 'Stone Tower Bridge built · Level 1 · upgrade available'
        : 'Wooden Tower Bridge built · Level 1 · upgrade available',
    );
  }

  private renderTowerBridgePreview(
    a: GridPoint,
    b: GridPoint,
  ): void {
    this.clearGroup(this.wallPreviewLayer);
    const validation = this.validateTowerBridge(a, b);
    const cellA = this.services.state.getCell(a.x, a.y);
    const cellB = this.services.state.getCell(b.x, b.y);
    if (cellA?.kind !== 'tower' || cellB?.kind !== 'tower') return;

    const aw = this.gridToWorld(a.x, a.y);
    const bw = this.gridToWorld(b.x, b.y);
    const start = new THREE.Vector3(
      aw.x,
      this.terrainElevation(a.x, a.y) + this.fortificationTopLocal(cellA),
      aw.z,
    );
    const end = new THREE.Vector3(
      bw.x,
      this.terrainElevation(b.x, b.y) + this.fortificationTopLocal(cellB),
      bw.z,
    );
    const material = new THREE.MeshStandardMaterial({
      color: validation.valid ? 0x89d7ad : 0xe56f67,
      emissive: validation.valid ? 0x1f5a3e : 0x641f1c,
      emissiveIntensity: 0.28,
      transparent: true,
      opacity: 0.52,
      depthWrite: false,
    });
    this.addBridgeBeamBetween(
      this.wallPreviewLayer,
      start,
      end,
      1.6,
      0.22,
      material,
    );
  }

  private addBridgeBeamBetween(
    group: THREE.Group,
    start: THREE.Vector3,
    end: THREE.Vector3,
    width: number,
    height: number,
    material: THREE.Material,
  ): THREE.Mesh {
    const direction = end.clone().sub(start);
    const length = direction.length();
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, Math.max(0.05, length)),
      material,
    );
    mesh.position.copy(start).add(end).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      direction.normalize(),
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  }

  private makeTowerBridge(bridge: TowerBridgeState): THREE.Group {
    const group = new THREE.Group();
    const level = Math.max(1, Math.min(FORTIFICATION_MAX_LEVEL, Math.floor(bridge.level ?? 1)));
    const deckScale = 1 + (level - 1) * 0.1;
    const aCell = this.services.state.getCell(bridge.ax, bridge.ay);
    const bCell = this.services.state.getCell(bridge.bx, bridge.by);
    if (aCell?.kind !== 'tower' || bCell?.kind !== 'tower') return group;

    const aw = this.gridToWorld(bridge.ax, bridge.ay);
    const bw = this.gridToWorld(bridge.bx, bridge.by);
    const start = new THREE.Vector3(
      aw.x,
      this.terrainElevation(bridge.ax, bridge.ay) + this.fortificationTopLocal(aCell) - 0.18,
      aw.z,
    );
    const end = new THREE.Vector3(
      bw.x,
      this.terrainElevation(bridge.bx, bridge.by) + this.fortificationTopLocal(bCell) - 0.18,
      bw.z,
    );
    const forward = end.clone().sub(start);
    const horizontal = new THREE.Vector3(forward.x, 0, forward.z).normalize();
    const side = new THREE.Vector3(-horizontal.z, 0, horizontal.x);
    const span = start.distanceTo(end);

    if (bridge.kind === 'stone') {
      const stone = this.medievalMaterials.castleStone(this.stoneStyle, 'body', bridge.ax, bridge.ay);
      const walkway = this.medievalMaterials.castleStone(this.stoneStyle, 'walkway', bridge.ax, bridge.ay);
      const support = this.medievalMaterials.castleStone(this.stoneStyle, 'foundation', bridge.ax, bridge.ay);

      this.addBridgeBeamBetween(
        group,
        start,
        end,
        CASTLE_ARCHITECTURE_STYLE.bridge.stoneDeckWidth * deckScale,
        0.34 + (level - 1) * 0.035,
        walkway,
      );
      for (const sign of [-1, 1]) {
        const offset = side.clone().multiplyScalar(sign * CASTLE_ARCHITECTURE_STYLE.bridge.stoneRailOffset * deckScale);
        const railStart = start.clone().add(offset).add(new THREE.Vector3(0, 0.38, 0));
        const railEnd = end.clone().add(offset).add(new THREE.Vector3(0, 0.38, 0));
        this.addBridgeBeamBetween(group, railStart, railEnd, CASTLE_ARCHITECTURE_STYLE.bridge.stoneRailWidth, CASTLE_ARCHITECTURE_STYLE.bridge.stoneRailHeight, stone);
      }

      const supportCount = Math.max(1, Math.floor(span / Math.max(3.8, 6 - (level - 1) * 0.7)));
      for (let i = 1; i <= supportCount; i += 1) {
        const t = i / (supportCount + 1);
        const center = start.clone().lerp(end, t);
        for (const sign of [-1, 1]) {
          const offset = side.clone().multiplyScalar(sign * 0.72);
          const corbel = new THREE.Mesh(
            new THREE.BoxGeometry(0.42, 0.72, 0.52),
            support,
          );
          corbel.position.copy(center).add(offset);
          corbel.position.y -= 0.5;
          corbel.rotation.y = Math.atan2(horizontal.x, horizontal.z);
          corbel.castShadow = true;
          group.add(corbel);
        }
      }
    } else {
      const wood = this.medievalMaterials.timber;
      const dark = this.medievalMaterials.timberDark;
      const plankCount = Math.max(5, Math.round(span / 0.7));

      for (let i = 0; i < plankCount; i += 1) {
        const t0 = i / plankCount;
        const t1 = (i + 0.9) / plankCount;
        const p0 = start.clone().lerp(end, t0);
        const p1 = start.clone().lerp(end, t1);
        this.addBridgeBeamBetween(group, p0, p1, CASTLE_ARCHITECTURE_STYLE.bridge.woodDeckWidth * deckScale, 0.18 + (level - 1) * 0.025, wood);
      }

      for (const sign of [-1, 1]) {
        const offset = side.clone().multiplyScalar(sign * CASTLE_ARCHITECTURE_STYLE.bridge.woodRailOffset * deckScale);
        const railStart = start.clone().add(offset).add(new THREE.Vector3(0, 0.62, 0));
        const railEnd = end.clone().add(offset).add(new THREE.Vector3(0, 0.62, 0));
        this.addBridgeBeamBetween(group, railStart, railEnd, 0.11, 0.11, dark);
      }

      const postCount = Math.max(3, Math.floor(span / Math.max(1.35, 2.2 - (level - 1) * 0.22)));
      for (let i = 0; i <= postCount; i += 1) {
        const t = i / postCount;
        const center = start.clone().lerp(end, t);
        for (const sign of [-1, 1]) {
          const offset = side.clone().multiplyScalar(sign * CASTLE_ARCHITECTURE_STYLE.bridge.woodRailOffset * deckScale);
          const post = this.addBridgeBeamBetween(
            group,
            center.clone().add(offset).add(new THREE.Vector3(0, 0.1, 0)),
            center.clone().add(offset).add(new THREE.Vector3(0, 1.05, 0)),
            0.13,
            0.13,
            dark,
          );
          post.castShadow = true;
        }
      }
    }

    const frameMaterial = bridge.kind === 'stone'
      ? this.medievalMaterials.castleStone(this.stoneStyle, 'alt', bridge.ax, bridge.ay)
      : this.medievalMaterials.timberDark;
    const metal = this.medievalMaterials.iron;
    const railOffset = (bridge.kind === 'stone'
      ? CASTLE_ARCHITECTURE_STYLE.bridge.stoneRailOffset
      : CASTLE_ARCHITECTURE_STYLE.bridge.woodRailOffset) * deckScale;

    if (level >= 2) {
      const tieCount = Math.max(2, Math.floor(span / 3.1));
      for (let i = 1; i <= tieCount; i += 1) {
        const center = start.clone().lerp(end, i / (tieCount + 1)).add(new THREE.Vector3(0, -0.12, 0));
        const left = center.clone().add(side.clone().multiplyScalar(-railOffset * 0.92));
        const right = center.clone().add(side.clone().multiplyScalar(railOffset * 0.92));
        this.addBridgeBeamBetween(group, left, right, 0.16, 0.16, frameMaterial);
      }
    }

    if (level >= 3) {
      for (const sign of [-1, 1]) {
        const offset = side.clone().multiplyScalar(sign * railOffset);
        const upperStart = start.clone().add(offset).add(new THREE.Vector3(0, 1.08, 0));
        const upperEnd = end.clone().add(offset).add(new THREE.Vector3(0, 1.08, 0));
        this.addBridgeBeamBetween(group, upperStart, upperEnd, 0.13, 0.13, frameMaterial);
      }

      const guardCount = Math.max(2, Math.floor(span / 4));
      for (let i = 1; i <= guardCount; i += 1) {
        const center = start.clone().lerp(end, i / (guardCount + 1));
        for (const sign of [-1, 1]) {
          const base = center.clone().add(side.clone().multiplyScalar(sign * railOffset));
          this.addBridgeBeamBetween(
            group,
            base.clone().add(new THREE.Vector3(0, 0.18, 0)),
            base.clone().add(new THREE.Vector3(0, 1.42, 0)),
            0.14,
            0.14,
            frameMaterial,
          );
        }
      }
    }

    if (level >= 4) {
      for (const t of [0.3, 0.7]) {
        const center = start.clone().lerp(end, t);
        const leftBase = center.clone().add(side.clone().multiplyScalar(-railOffset));
        const rightBase = center.clone().add(side.clone().multiplyScalar(railOffset));
        const leftTop = leftBase.clone().add(new THREE.Vector3(0, 1.86, 0));
        const rightTop = rightBase.clone().add(new THREE.Vector3(0, 1.86, 0));
        this.addBridgeBeamBetween(group, leftBase.clone().add(new THREE.Vector3(0, 0.18, 0)), leftTop, 0.15, 0.15, metal);
        this.addBridgeBeamBetween(group, rightBase.clone().add(new THREE.Vector3(0, 0.18, 0)), rightTop, 0.15, 0.15, metal);
        this.addBridgeBeamBetween(group, leftTop, rightTop, 0.15, 0.15, metal);
      }

      const center = start.clone().lerp(end, 0.5);
      const pole = this.addBox(group, 0.07, 2.0, 0.07, metal, center.x, center.y + 1.0, center.z);
      pole.rotation.y = Math.atan2(horizontal.x, horizontal.z);
      const pennant = this.addBox(
        group,
        0.78,
        0.34,
        0.05,
        this.medievalMaterials.roofTile,
        center.x + horizontal.x * 0.38,
        center.y + 1.68,
        center.z + horizontal.z * 0.38,
      );
      pennant.rotation.y = Math.atan2(horizontal.x, horizontal.z);
      pennant.userData.castleFlag = { phase: bridge.id * 0.61 };
    }

    group.userData.towerBridge = { ...bridge, level };
    return group;
  }

  private removeTowerBridgesAt(x: number, y: number): void {
    for (const [id, bridge] of this.towerBridges) {
      if (
        (bridge.ax === x && bridge.ay === y) ||
        (bridge.bx === x && bridge.by === y)
      ) {
        this.towerBridges.delete(id);
        if (this.selectedTowerBridgeId === id) this.selectedTowerBridgeId = null;
      }
    }
  }

  private addTowerWallConnector(
    group: THREE.Group,
    direction: WallDirection,
    elevationDelta: number,
    height: number,
    material: THREE.Material,
  ): void {
    const vector = WallSystem.vector(direction);
    const run = (TILE * Math.hypot(vector.x, vector.y)) / 2 + 0.24;
    const connector = new THREE.Group();
    connector.rotation.y = WallSystem.worldAngle(direction);
    group.add(connector);

    this.addBox(
      connector,
      CASTLE_ARCHITECTURE_STYLE.tower.connectorWidth,
      height,
      run + CASTLE_ARCHITECTURE_STYLE.wall.joinOverlap,
      material,
      0,
      2.58 + height / 2,
      run / 2,
    );

    const terrainDrop = Math.max(0, -elevationDelta);
    const foundationHeight = 0.82 + terrainDrop * 0.8 + Math.abs(elevationDelta) * 0.2;
    this.addBox(
      connector,
      CASTLE_ARCHITECTURE_STYLE.tower.connectorFoundationWidth,
      foundationHeight,
      run + CASTLE_ARCHITECTURE_STYLE.wall.joinOverlap + 0.14,
      this.medievalMaterials.castleStone(this.stoneStyle, 'foundation'),
      0,
      2.22 - foundationHeight / 2 + 0.16,
      run / 2,
    );
  }

  private addTowerTop(
    group: THREE.Group,
    shape: TowerShape,
    top: TowerTop,
    topY: number,
    bodySize: number,
    stone: THREE.Material,
    roof: THREE.Material,
    wood: THREE.Material,
    metal: THREE.Material,
  ): void {
    const squareLike = shape === 'square' || shape === 'corner';
    const platformSpan = squareLike
      ? bodySize + 0.5
      : shape === 'watch'
        ? bodySize * 2 + 0.5
        : bodySize * 2 + 0.55;
    const walkwayMaterial = this.medievalMaterials.castleStone(
      this.stoneStyle,
      'walkway',
    );

    let resolvedTop: TowerTop = top;
    if (top === 'roof') resolvedTop = squareLike ? 'hipped' : 'conical';
    if (top === 'battlement') resolvedTop = 'openBattlement';
    if (top === 'hipped' && !squareLike) resolvedTop = 'conical';
    if (top === 'pyramidal' && !squareLike) resolvedTop = 'conical';
    if (top === 'conical' && squareLike) resolvedTop = 'hipped';

    const addDefensivePlatform = (withCrenels: boolean): void => {
      if (squareLike) {
        this.addBox(
          group,
          platformSpan,
          0.34,
          platformSpan,
          walkwayMaterial,
          0,
          topY + 0.1,
          0,
        );
        this.addBox(
          group,
          platformSpan + 0.26,
          0.22,
          platformSpan + 0.26,
          stone,
          0,
          topY - 0.03,
          0,
        );

        if (withCrenels) {
          const edge = platformSpan / 2 - 0.18;
          this.addTowerCrenellatedEdge(group, platformSpan - 0.28, 0, -edge, topY + 0.15, 0, stone);
          this.addTowerCrenellatedEdge(group, platformSpan - 0.28, 0, edge, topY + 0.15, Math.PI, stone);
          this.addTowerCrenellatedEdge(group, platformSpan - 0.28, -edge, 0, topY + 0.15, Math.PI / 2, stone);
          this.addTowerCrenellatedEdge(group, platformSpan - 0.28, edge, 0, topY + 0.15, -Math.PI / 2, stone);
        }
      } else {
        const segments = shape === 'octagonal' ? 8 : shape === 'watch' ? 12 : 20;
        const radius = platformSpan / 2;
        const slab = new THREE.Mesh(
          new THREE.CylinderGeometry(radius, radius, 0.34, segments),
          walkwayMaterial,
        );
        slab.position.y = topY + 0.1;
        slab.castShadow = true;
        slab.receiveShadow = true;
        group.add(slab);

        if (withCrenels) {
          const curb = new THREE.Mesh(
            new THREE.CylinderGeometry(radius, radius, 0.28, segments, 1, true),
            stone,
          );
          curb.position.y = topY + 0.42;
          curb.castShadow = true;
          group.add(curb);

          const count = shape === 'watch' ? 10 : 12;
          for (let i = 0; i < count; i += 1) {
            const angle = (i / count) * Math.PI * 2;
            const merlon = new THREE.Mesh(
              new THREE.CylinderGeometry(0.25, 0.31, 0.95, 4),
              stone,
            );
            merlon.rotation.y = Math.PI / 4 - angle;
            merlon.position.set(
              Math.cos(angle) * (radius - 0.2),
              topY + 0.78,
              Math.sin(angle) * (radius - 0.2),
            );
            merlon.castShadow = true;
            merlon.receiveShadow = true;
            group.add(merlon);
          }
        }
      }
    };

    if (resolvedTop === 'openBattlement' || top === 'flag') {
      addDefensivePlatform(true);

      if (top === 'flag') {
        this.addBox(group, 0.09, 3.0, 0.09, metal, 0, topY + 1.8, 0);
        const flag = this.addBox(group, 1.25, 0.58, 0.055, roof, 0.66, topY + 2.65, 0);
        flag.userData.castleFlag = { phase: topY * 0.37 };
      }
      return;
    }

    if (resolvedTop === 'flat') {
      addDefensivePlatform(false);
      return;
    }

    if (resolvedTop === 'conical') {
      const segments = shape === 'octagonal' ? 8 : shape === 'watch' ? 12 : 18;
      const radius = platformSpan * 0.58;
      const roofHeight = THREE.MathUtils.clamp(platformSpan * 0.72, 2.25, 3.7);

      const eave = new THREE.Mesh(
        new THREE.CylinderGeometry(radius * 1.04, radius * 1.04, 0.22, segments),
        this.medievalMaterials.roofDark,
      );
      eave.position.y = topY + 0.08;
      eave.castShadow = true;
      group.add(eave);

      const lowerSkirt = new THREE.Mesh(
        new THREE.CylinderGeometry(radius * 0.96, radius * 1.05, 0.34, segments),
        roof,
      );
      lowerSkirt.position.y = topY + 0.28;
      lowerSkirt.castShadow = true;
      group.add(lowerSkirt);

      const roofMesh = new THREE.Mesh(
        new THREE.ConeGeometry(radius, roofHeight, segments),
        roof,
      );
      roofMesh.position.y = topY + 0.34 + roofHeight / 2;
      roofMesh.castShadow = true;
      roofMesh.receiveShadow = true;
      group.add(roofMesh);

      this.addBox(group, 0.07, 0.8, 0.07, metal, 0, topY + roofHeight + 0.68, 0);
      return;
    }

    if (resolvedTop === 'hipped' || resolvedTop === 'pyramidal') {
      const steep = resolvedTop === 'pyramidal';
      const roofHeight = steep
        ? THREE.MathUtils.clamp(platformSpan * 0.75, 2.8, 4.2)
        : THREE.MathUtils.clamp(platformSpan * 0.48, 2.0, 3.2);
      const radius = platformSpan * (steep ? 0.62 : 0.66);

      this.addBox(
        group,
        platformSpan + 0.48,
        0.24,
        platformSpan + 0.48,
        this.medievalMaterials.roofDark,
        0,
        topY + 0.08,
        0,
      );

      const lower = new THREE.Mesh(
        new THREE.ConeGeometry(radius, roofHeight * 0.72, 4),
        roof,
      );
      lower.rotation.y = Math.PI / 4;
      lower.position.y = topY + 0.24 + roofHeight * 0.36;
      lower.castShadow = true;
      lower.receiveShadow = true;
      group.add(lower);

      const cap = new THREE.Mesh(
        new THREE.ConeGeometry(radius * 0.55, roofHeight * 0.48, 4),
        roof,
      );
      cap.rotation.y = Math.PI / 4;
      cap.position.y = topY + roofHeight * 0.72;
      cap.castShadow = true;
      group.add(cap);

      for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
        const beam = this.addBox(
          group,
          0.09,
          roofHeight * 0.86,
          0.09,
          this.medievalMaterials.timberDark,
          Math.sin(angle) * radius * 0.54,
          topY + roofHeight * 0.44,
          Math.cos(angle) * radius * 0.54,
        );
        beam.rotation.x = angle === 0 || angle === Math.PI
          ? (angle === 0 ? -0.46 : 0.46)
          : 0;
        beam.rotation.z = angle === Math.PI / 2 || angle === Math.PI * 1.5
          ? (angle === Math.PI / 2 ? 0.46 : -0.46)
          : 0;
      }
      return;
    }

    if (resolvedTop === 'timberRoof') {
      addDefensivePlatform(false);
      const roofRadius = platformSpan * 0.58;
      const postRadius = platformSpan * 0.34;

      for (const [x, z] of [
        [-postRadius, -postRadius],
        [postRadius, -postRadius],
        [-postRadius, postRadius],
        [postRadius, postRadius],
      ] as Array<[number, number]>) {
        this.addBox(group, 0.18, 1.75, 0.18, wood, x, topY + 1.08, z);
        this.addBox(group, 0.5, 0.16, 0.5, metal, x, topY + 0.3, z);
      }

      const collar = this.addBox(
        group,
        platformSpan + 0.55,
        0.22,
        platformSpan + 0.55,
        this.medievalMaterials.timberDark,
        0,
        topY + 1.92,
        0,
      );
      collar.castShadow = true;

      const canopy = new THREE.Mesh(
        new THREE.ConeGeometry(
          roofRadius,
          THREE.MathUtils.clamp(platformSpan * 0.46, 1.75, 2.7),
          squareLike ? 4 : shape === 'octagonal' ? 8 : 12,
        ),
        roof,
      );
      if (squareLike) canopy.rotation.y = Math.PI / 4;
      canopy.position.y = topY + 2.78;
      canopy.castShadow = true;
      canopy.receiveShadow = true;
      group.add(canopy);

      for (const z of [-postRadius, postRadius]) {
        this.addBox(group, platformSpan * 0.7, 0.11, 0.11, wood, 0, topY + 1.52, z);
      }
      return;
    }

    if (resolvedTop === 'watch') {
      addDefensivePlatform(false);
      const postRadius = platformSpan * 0.34;

      for (const [x, z] of [
        [-postRadius, -postRadius],
        [postRadius, -postRadius],
        [-postRadius, postRadius],
        [postRadius, postRadius],
      ] as Array<[number, number]>) {
        this.addBox(group, 0.16, 1.8, 0.16, wood, x, topY + 1.05, z);
        this.addBox(group, 0.5, 0.16, 0.5, metal, x, topY + 0.25, z);
      }

      this.addBox(
        group,
        platformSpan + 0.65,
        0.18,
        platformSpan + 0.65,
        this.medievalMaterials.roofDark,
        0,
        topY + 1.94,
        0,
      );
      const canopy = new THREE.Mesh(
        new THREE.ConeGeometry(platformSpan * 0.62, 1.75, 4),
        roof,
      );
      canopy.rotation.y = Math.PI / 4;
      canopy.position.y = topY + 2.82;
      canopy.castShadow = true;
      group.add(canopy);
      return;
    }

    addDefensivePlatform(true);
  }

  private addTowerCrenellatedEdge(
    group: THREE.Group,
    span: number,
    x: number,
    z: number,
    y: number,
    rotationY: number,
    material: THREE.Material,
  ): void {
    const merlonWidth = 0.78;
    const crenelWidth = 0.56;
    const baseHeight = 0.42;
    const merlonHeight = 1.0;
    const module = merlonWidth + crenelWidth;
    const count = Math.max(1, Math.floor((span - merlonWidth) / module));
    const actualSpan = count * module + merlonWidth;
    const shape = new THREE.Shape();

    shape.moveTo(-actualSpan / 2, 0);
    shape.lineTo(actualSpan / 2, 0);
    shape.lineTo(actualSpan / 2, baseHeight + merlonHeight);

    for (let i = count; i >= 0; i -= 1) {
      const right = -actualSpan / 2 + i * module + merlonWidth;
      const left = right - merlonWidth;
      shape.lineTo(right, baseHeight + merlonHeight);
      shape.lineTo(left, baseHeight + merlonHeight);
      if (i > 0) {
        shape.lineTo(left, baseHeight);
        shape.lineTo(left - crenelWidth, baseHeight);
      }
    }

    shape.lineTo(-actualSpan / 2, 0);

    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: 0.38,
      bevelEnabled: true,
      bevelSize: 0.04,
      bevelThickness: 0.035,
      bevelSegments: 1,
      curveSegments: 1,
    });
    geometry.translate(0, 0, -0.19);

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotationY;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  private fortificationTopLocal(cell: GridCell): number {
    if (this.isWallFamily(cell.kind)) return castleHeightFor(cell).topLocal;
    return 5.9;
  }


  private makeMarketBuilding(group: THREE.Group, gx: number, gy: number): THREE.Group {
    group.userData.settlementFamily = 'market';
    group.userData.settlementReadabilityClass = 'landmark';
    const timber = this.environmentMaterial('market-timber', 0x65452f, 0.98);
    const timberLight = this.environmentMaterial('market-timber-light', 0x8a623d, 0.96);
    const woodDark = this.environmentMaterial('market-wood-dark', 0x473022, 1);
    const plaster = this.environmentMaterial('market-plaster', SETTLEMENT_STYLE.plaster[1], 0.98);
    const stone = this.environmentMaterial('market-stone', SETTLEMENT_STYLE.foundation, 1);
    const roof = this.environmentMaterial('market-roof', SETTLEMENT_STYLE.roof[0], 0.98);
    const clothMaterials = [
      this.environmentMaterial('market-cloth-red', 0xb45f3e, 0.92),
      this.environmentMaterial('market-cloth-teal', 0x587d75, 0.92),
      this.environmentMaterial('market-cloth-blue', 0x6b6f92, 0.92),
      this.environmentMaterial('market-cloth-gold', 0x9a7541, 0.92),
    ];
    const crate = this.environmentMaterial('market-crate', 0x9a6b3d, 1);
    const goodsMaterials = [
      this.environmentMaterial('market-goods-green', 0x7c9b5a, 0.95),
      this.environmentMaterial('market-goods-red', 0x9b5b4a, 0.95),
      this.environmentMaterial('market-goods-blue', 0x667f9b, 0.95),
      this.environmentMaterial('market-goods-gold', 0xb08a4d, 0.95),
    ];
    const metal = this.environmentMaterial('market-metal', 0x6f675c, 0.7);
    const ground = this.environmentMaterial('market-ground', SETTLEMENT_STYLE.path, 1);

    const hash = (value: number): number => {
      const n = Math.sin(value * 12.9898 + gx * 78.233 + gy * 37.719) * 43758.5453;
      return n - Math.floor(n);
    };

    const addBox = (
      width: number,
      height: number,
      depth: number,
      material: THREE.Material,
      x: number,
      y: number,
      z: number,
      rotationY = 0,
    ): THREE.Mesh => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
      mesh.position.set(x, y, z);
      mesh.rotation.y = rotationY;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      return mesh;
    };

    const addBarrel = (x: number, z: number, scale: number): void => {
      const barrel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22 * scale, 0.25 * scale, 0.56 * scale, 8),
        woodDark,
      );
      barrel.position.set(x, 2.55 + 0.28 * scale, z);
      barrel.castShadow = true;
      group.add(barrel);
      for (const y of [2.39, 2.67]) {
        const band = new THREE.Mesh(new THREE.TorusGeometry(0.23 * scale, 0.022 * scale, 5, 8), metal);
        band.position.set(x, y + 0.04 * scale, z);
        band.rotation.x = Math.PI / 2;
        band.castShadow = true;
        group.add(band);
      }
    };

    const addCrate = (x: number, z: number, scale: number): void => {
      const size = 0.42 + scale * 0.16;
      addBox(size, size, size, crate, x, 2.45 + size / 2, z);
      addBox(size + 0.03, 0.045, 0.07, woodDark, x, 2.48 + size, z - size * 0.34);
    };

    const addGoods = (x: number, z: number, variant: number): void => {
      const material = goodsMaterials[variant % goodsMaterials.length];
      const goods = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 0.16, 7), material);
      goods.position.set(x, 3.04, z);
      goods.castShadow = true;
      group.add(goods);
    };

    const addStall = (x: number, z: number, width: number, rotation: number, variant: number): void => {
      const cloth = clothMaterials[variant % clothMaterials.length];
      const postX = Math.max(0.38, width / 2 - 0.1);
      const postZ = 0.34;
      for (const px of [-postX, postX]) {
        for (const pz of [-postZ, postZ]) addBox(0.09, 2.0, 0.09, timber, x + px, 3.25, z + pz, rotation);
      }
      addBox(width, 0.12, 0.72, timberLight, x, 2.9, z, rotation);
      const canopy = new THREE.Mesh(new THREE.ConeGeometry(width * 0.72, 0.58 + variant * 0.05, 4), cloth);
      canopy.position.set(x, 4.78 + variant * 0.05, z);
      canopy.rotation.y = Math.PI / 4 + rotation;
      canopy.scale.z = 0.74;
      canopy.castShadow = true;
      group.add(canopy);
      for (let i = 0; i < 2; i += 1) {
        addGoods(x - width * 0.28 + i * width * 0.28, z - 0.03, variant + i);
      }
      if (variant % 2 === 0) addCrate(x - width * 0.46, z + 0.68, 0.8);
      else addBarrel(x + width * 0.46, z + 0.7, 0.78);
      addBox(0.52, 0.12, 0.08, cloth, x, 4.0, z - 0.39, rotation);
    };

    const addSmallShop = (x: number, z: number, rotation: number, variant: number): void => {
      const wall = variant % 2 === 0 ? plaster : timberLight;
      addBox(2.15, 1.55, 1.7, wall, x, 3.15, z, rotation);
      addBox(2.28, 0.14, 1.82, timber, x, 4.0, z, rotation);
      const roofMesh = new THREE.Mesh(new THREE.ConeGeometry(1.5, 0.85, 4), roof);
      roofMesh.position.set(x, 4.62, z);
      roofMesh.rotation.y = Math.PI / 4 + rotation;
      roofMesh.scale.z = 0.72;
      roofMesh.castShadow = true;
      group.add(roofMesh);
      addBox(1.25, 0.72, 0.08, clothMaterials[(variant + 1) % clothMaterials.length], x, 3.28, z - 0.9, rotation);
      addCrate(x - 0.72, z + 0.82, 0.85);
      addBarrel(x + 0.72, z + 0.82, 0.9);
    };

    const addTent = (x: number, z: number, scale: number, rotation: number, variant: number): void => {
      const cloth = clothMaterials[variant % clothMaterials.length];
      const tent = new THREE.Mesh(new THREE.ConeGeometry(1.0 * scale, 1.75 * scale, 4), cloth);
      tent.position.set(x, 3.25 + 0.2 * scale, z);
      tent.rotation.y = Math.PI / 4 + rotation;
      tent.scale.z = 0.72;
      tent.castShadow = true;
      group.add(tent);
      addCrate(x - 0.55 * scale, z + 0.65 * scale, 0.7 + variant * 0.08);
      if (variant % 2 === 0) addBarrel(x + 0.58 * scale, z + 0.62 * scale, 0.72);
      addBox(0.7 * scale, 0.1, 0.08, cloth, x, 3.72 + 0.18 * scale, z - 0.55 * scale, rotation);
    };

    // One logical building occupies a 3x3 tile footprint and contains the entire marketplace.
    addBox(TILE * 2.82, 0.08, TILE * 2.82, ground, 0, 2.2, 0);
    addBox(TILE * 2.62, 0.12, TILE * 2.62, stone, 0, 2.28, 0);

    // Outer covered market structures make the footprint read as a single commercial district.
    addSmallShop(-3.55, -3.15, -0.08, Math.floor(hash(1) * 4));
    addSmallShop(3.55, -3.15, 0.06, Math.floor(hash(2) * 4));
    addSmallShop(-3.55, 3.15, 0.04, Math.floor(hash(3) * 4));
    addSmallShop(3.55, 3.15, -0.06, Math.floor(hash(4) * 4));

    const stallLayout = [
      [-3.1, -0.55], [-1.05, -0.65], [1.05, -0.65], [3.1, -0.55],
      [-3.05, 1.85], [-1.0, 1.9], [1.0, 1.9], [3.05, 1.85],
    ];
    stallLayout.forEach(([x, z], index) => {
      const variant = Math.floor(hash(20 + index) * clothMaterials.length);
      const rotation = (Math.floor(hash(40 + index) * 4) * Math.PI) / 2;
      const width = 1.45 + hash(60 + index) * 0.45;
      addStall(x, z, width, rotation, variant);
    });

    const tentLayout = [
      [-1.9, -3.05], [0, -3.15], [1.9, -3.05],
      [-2.0, 3.0], [0, 3.2], [2.0, 3.0],
    ];
    tentLayout.forEach(([x, z], index) => {
      const variant = Math.floor(hash(80 + index) * 4);
      addTent(x, z, 0.72 + hash(90 + index) * 0.18, hash(100 + index) * Math.PI, variant);
    });

    // Central trading house and open pedestrian court.
    addBox(3.5, 0.18, 3.0, stone, 0, 2.38, 0);
    addBox(3.05, 1.55, 2.45, plaster, 0, 3.18, 0.08);
    for (const x of [-1.42, 1.42]) addBox(0.16, 2.0, 0.16, timber, x, 3.35, 0.08);
    const hallRoof = new THREE.Mesh(new THREE.ConeGeometry(2.1, 1.15, 4), roof);
    hallRoof.position.set(0, 4.72, 0.08);
    hallRoof.rotation.y = Math.PI / 4;
    hallRoof.scale.z = 0.76;
    hallRoof.castShadow = true;
    group.add(hallRoof);
    addBox(2.5, 0.12, 0.08, clothMaterials[0], 0, 3.55, -1.24);
    addGoods(-0.6, -1.32, 0);
    addGoods(0, -1.32, 1);
    addGoods(0.6, -1.32, 2);

    // Storage clusters and signs add visual density without per-frame logic.
    for (let i = 0; i < 4; i += 1) {
      const x = -3.6 + (i % 2) * 7.2 + hash(120 + i) * 0.2;
      const z = i < 2 ? 4.8 + hash(140 + i) * 0.2 : -4.8 - hash(160 + i) * 0.2;
      addCrate(x, z, 0.72 + hash(180 + i) * 0.5);
    }

    for (const [x, z, phase] of [[-5.25, 0, 0], [5.25, 0, 1], [0, -5.35, 2], [0, 5.35, 3]]) {
      const sign = new THREE.Group();
      sign.position.set(x, 3.55, z);
      sign.rotation.y = phase * 0.2;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 1.55, 6), timber);
      post.position.y = -0.7;
      sign.add(post);
      const board = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.52, 0.09), timberLight);
      board.position.y = 0.05;
      board.castShadow = true;
      sign.add(board);
      group.add(sign);
    }

    // Short walkways deliberately remain visible between vendor clusters.
    const pathMaterial = this.environmentMaterial('market-walkway', 0x6f5944, 1);
    for (const z of [-1.45, 4.25]) addBox(10.0, 0.045, 0.48, pathMaterial, 0, 2.38, z);
    for (const x of [-4.25, 4.25]) addBox(0.48, 0.045, 10.0, pathMaterial, x, 2.39, 0);

    return group;
  }

  private addSettlementBox(
    group: THREE.Group, width: number, height: number, depth: number,
    material: THREE.Material, x: number, y: number, z: number,
  ): THREE.Mesh {
    const mesh = new THREE.Mesh(this.settlementUnitBox, material);
    mesh.scale.set(width, height, depth);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  }

  private makeMosque(group: THREE.Group, gx: number, gy: number): THREE.Group {
    const body = this.medievalMaterials.castleStone(this.stoneStyle, 'body', gx, gy);
    const alt = this.medievalMaterials.castleStone(this.stoneStyle, 'alt', gx + 1, gy);
    const dark = this.medievalMaterials.castleStone(this.stoneStyle, 'dark', gx, gy + 1);
    const foundation = this.medievalMaterials.castleStone(this.stoneStyle, 'foundation', gx, gy);

    // Reusable low-rise courtyard mosque language. It deliberately avoids a
    // generic tall minaret so earthen fortified settlements keep their skyline.
    this.addSettlementBox(group, 3.78, 0.12, 3.78, foundation, 0, 2.22, 0);
    this.addSettlementBox(group, 3.18, 0.08, 2.2, alt, 0, 2.31, 0.62);

    // Prayer hall and thick qibla wall occupy the northern edge of the court.
    this.addSettlementBox(group, 3.55, 1.42, 1.0, body, 0, 3.02, -1.28);
    this.addSettlementBox(group, 3.64, 0.22, 1.08, dark, 0, 3.79, -1.28);
    this.addSettlementBox(group, 0.76, 1.58, 0.42, body, 0, 3.1, -1.86);

    // Courtyard arcades keep the centre open and readable from gameplay zoom.
    for (const x of [-1.62, 1.62]) {
      this.addSettlementBox(group, 0.2, 1.0, 2.22, body, x, 2.78, 0.54);
      for (const z of [-0.18, 0.58, 1.34]) {
        this.addSettlementBox(group, 0.34, 1.08, 0.34, dark, x, 2.82, z);
      }
    }
    this.addSettlementBox(group, 3.45, 0.2, 0.3, body, 0, 3.15, 1.72);

    // Three shallow domes preserve a low earthen silhouette.
    for (const x of [-1.02, 0, 1.02]) {
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(0.5, 12, 7, 0, Math.PI * 2, 0, Math.PI / 2),
        alt,
      );
      dome.scale.y = 0.48;
      dome.position.set(x, 3.92, -1.28);
      dome.castShadow = true;
      dome.receiveShadow = true;
      group.add(dome);
    }

    const doorway = this.addSettlementBox(group, 0.52, 0.86, 0.06, dark, 0, 2.87, -1.82);
    doorway.userData.opening = true;
    group.userData.settlementFamily = 'mosque';
    group.userData.settlementReadabilityClass = 'landmark';
    group.userData.landmark = 'courtyard-mosque';
    return group;
  }

  private makeHouse(
    group: THREE.Group,
    kind: ResidenceKind,
    gx: number,
    gy: number,
  ): THREE.Group {
    if (kind !== 'cowBarn') {
      const visualLevel = RESIDENCE_VISUAL_LEVELS[kind];
      group.userData.upgradeVisualProfile = upgradeVisualProfile(visualLevel);
      group.userData.residenceVisualLevel = visualLevel;
      group.userData.residenceVisualVariant = RESIDENCE_VISUAL_VARIANTS[kind];
    }

    const earthen = this.stoneStyle === 'earthen';
    const pathMaterial = this.environmentMaterial(
      earthen ? 'earthen-village-path' : 'village-path',
      earthen ? 0x9f7956 : 0xa98d70,
      1,
    );
    const pathDark = this.environmentMaterial(
      earthen ? 'earthen-village-path-dark' : 'village-path-dark',
      earthen ? 0x79563f : 0x826b55,
      1,
    );
    const fenceMaterial = this.environmentMaterial(
      earthen ? 'earthen-village-fence' : 'village-fence',
      earthen ? 0x75513a : 0x6f4e37,
      1,
    );
    const grassPatch = this.environmentMaterial(
      earthen ? 'earthen-village-ground' : 'village-grass',
      earthen ? 0xb69268 : 0x93b75c,
      0.98,
    );
    const yardMaterial = this.environmentMaterial(
      earthen ? 'earthen-village-yard' : 'village-yard',
      earthen ? 0xa37d59 : 0xa7b967,
      0.98,
    );

    // Each residential cell is a compact lived-in medieval block rather than
    // one oversized house. Narrow alleys keep silhouettes readable from the
    // isometric camera while supporting more visible residents.
    this.addSettlementBox(group, 3.72, 0.055, 3.72, grassPatch, 0, 2.2, 0);
    this.addSettlementBox(group, 3.5, 0.065, 0.34, pathMaterial, 0, 2.26, 0.04);
    this.addSettlementBox(group, 0.34, 0.065, 3.42, pathMaterial, -0.08, 2.265, 0);
    this.addSettlementBox(group, 1.4, 0.04, 1.12, yardMaterial, 0.82, 2.245, 0.82);

    RESIDENCE_LAYOUTS[kind].forEach((part, index) => {
      const variation = settlementVariant(gx, gy, index, kind.length);
      const earthenWalls = [0xb98555, 0xc39261, 0xaa744d, 0xc89b6c];
      const earthenRoofs = [0x9a6948, 0xa97850, 0x8d6044];
      const wallColor = earthen
        ? earthenWalls[variation % earthenWalls.length]
        : SETTLEMENT_STYLE.plaster[variation % SETTLEMENT_STYLE.plaster.length];
      const roofColor = earthen
        ? earthenRoofs[(variation >>> 4) % earthenRoofs.length]
        : SETTLEMENT_STYLE.roof[(variation >>> 4) % SETTLEMENT_STYLE.roof.length];
      this.addMiniHouse(
        group,
        part.x + ((variation >>> 8) % 3 - 1) * 0.025,
        part.z,
        part.rotation + ((variation >>> 12) % 3 - 1) * 0.045,
        part.width,
        part.depth,
        part.height + ((variation >>> 16) % 3 - 1) * 0.05,
        wallColor,
        roofColor,
        part.detailed,
        variation % 3 === 0,
        earthen,
      );
    });

    if (kind === 'cottage') this.addVillageWell(group, 1.02, 0.92);
    if (kind === 'manor') {
      this.addVillageWell(group, 0, 0.8);
      for (const x of [-1.68, 1.68]) {
        this.addSettlementBox(group, 0.08, 0.64, 3.08, fenceMaterial, x, 2.52, 0);
      }
    }
    if (kind === 'villa') {
      const garden = new THREE.Mesh(new THREE.CircleGeometry(0.46, 12), yardMaterial);
      garden.rotation.x = -Math.PI / 2;
      garden.position.set(1.05, 2.27, 0.98);
      group.add(garden);
      this.addVillageWell(group, 1.04, 0.92);

      // Level 4 residential landmark: the tall corner pavilion receives a
      // visible cupola, so Villa reads as the final tier from normal zoom.
      const cupolaWall = this.environmentMaterial('villa-landmark-cupola-wall', SETTLEMENT_STYLE.stone, 0.96);
      const cupolaRoof = this.environmentMaterial('villa-landmark-cupola-roof', SETTLEMENT_STYLE.roof[2], 0.94);
      this.addSettlementBox(group, 0.5, 0.72, 0.5, cupolaWall, 1.2, 5.72, -0.92);
      const cupola = new THREE.Mesh(new THREE.ConeGeometry(0.47, 0.7, 4), cupolaRoof);
      cupola.rotation.y = Math.PI / 4;
      cupola.position.set(1.2, 6.43, -0.92);
      cupola.castShadow = true;
      cupola.receiveShadow = true;
      group.add(cupola);
      group.userData.residenceLandmark = 'corner-cupola';
    }

    // Edge fences, benches, barrels and market-like clutter give the block a
    // believable inhabited scale without overwhelming the single cell.
    for (const z of [-1.76, 1.76]) {
      this.addSettlementBox(group, 3.55, 0.07, 0.07, fenceMaterial, 0, 2.5, z);
      for (const x of [-1.62, -0.54, 0.54, 1.62]) {
        this.addSettlementBox(group, 0.075, 0.58, 0.075, fenceMaterial, x, 2.48, z);
      }
    }

    this.addSettlementBox(group, 0.52, 0.16, 0.22, pathDark, 1.18, 2.37, -0.08);
    this.addSettlementBox(group, 0.08, 0.42, 0.08, fenceMaterial, 1.38, 2.55, -0.08);
    this.addSettlementBox(group, 0.08, 0.42, 0.08, fenceMaterial, 0.98, 2.55, -0.08);

    return group;
  }

  private addMiniHouse(
    parent: THREE.Group,
    x: number,
    z: number,
    rotation: number,
    width: number,
    depth: number,
    height: number,
    wallColor: number,
    roofColor: number,
    detailed: boolean,
    chimneyVisible: boolean,
    earthen = false,
  ): void {
    const house = new THREE.Group();
    house.position.set(x, 0, z);
    house.rotation.y = rotation;
    parent.add(house);

    const wall = this.environmentMaterial(`residence-wall-${wallColor}`, wallColor, 0.94);
    const wallShade = this.environmentMaterial(`residence-shade-${wallColor}`, new THREE.Color(wallColor).multiplyScalar(0.82).getHex(), 0.98);
    const roof = this.environmentMaterial(`residence-roof-${roofColor}`, roofColor, 0.94);
    const roofDark = this.environmentMaterial('residence-roof-shadow', SETTLEMENT_STYLE.roofShadow, 0.98);
    const wood = this.environmentMaterial('house-timber', SETTLEMENT_STYLE.timber, 0.98);
    const stone = this.environmentMaterial(
      earthen ? 'house-earthen-foundation' : 'house-stone',
      earthen ? 0x78533b : SETTLEMENT_STYLE.foundation,
      1,
    );
    const glass = this.environmentMaterial('house-window', SETTLEMENT_STYLE.window, 0.88);

    this.addSettlementBox(house, width + 0.14, 0.18, depth + 0.14, stone, 0, 2.3, 0);
    this.addSettlementBox(house, width, height, depth, wall, 0, 2.32 + height / 2, 0);

    // Slightly projecting upper timber floor on richer non-earthen houses.
    if (detailed && !earthen) {
      this.addSettlementBox(
        house,
        width + 0.1,
        Math.min(0.44, height * 0.26),
        depth + 0.08,
        wallShade,
        0,
        2.32 + height * 0.76,
        0,
      );
      for (const sx of [-width * 0.38, width * 0.38]) {
        this.addSettlementBox(house, 0.055, height * 0.72, 0.055, wood, sx, 2.38 + height * 0.5, -depth / 2 - 0.035);
      }
      this.addSettlementBox(house, width * 0.82, 0.055, 0.055, wood, 0, 2.58 + height * 0.58, -depth / 2 - 0.04);
    }

    const roofHeight = 0.68 + height * 0.2;
    if (earthen) {
      const roofSlab = this.addSettlementBox(
        house,
        width + 0.16,
        0.14,
        depth + 0.16,
        roof,
        0,
        2.32 + height + 0.08,
        0,
      );
      roofSlab.castShadow = true;

      const parapetY = 2.32 + height + 0.24;
      this.addSettlementBox(house, width + 0.16, 0.24, 0.12, wallShade, 0, parapetY, -depth / 2 - 0.02);
      this.addSettlementBox(house, width + 0.16, 0.24, 0.12, wallShade, 0, parapetY, depth / 2 + 0.02);
      this.addSettlementBox(house, 0.12, 0.24, depth, wallShade, -width / 2 - 0.02, parapetY, 0);
      this.addSettlementBox(house, 0.12, 0.24, depth, wallShade, width / 2 + 0.02, parapetY, 0);

      if (detailed) {
        const dome = new THREE.Mesh(
          new THREE.SphereGeometry(Math.min(width, depth) * 0.24, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2),
          roof,
        );
        dome.scale.y = 0.42;
        dome.position.set(width * 0.18, 2.32 + height + 0.18, depth * 0.12);
        dome.castShadow = true;
        dome.receiveShadow = true;
        house.add(dome);
      }
    } else {
      const eave = this.addSettlementBox(
        house,
        width + 0.22,
        0.1,
        depth + 0.22,
        roofDark,
        0,
        2.32 + height + 0.02,
        0,
      );
      eave.castShadow = true;

      const roofMesh = new THREE.Mesh(
        new THREE.ConeGeometry(width * 0.68, roofHeight, 4),
        roof,
      );
      roofMesh.position.y = 2.32 + height + roofHeight / 2;
      roofMesh.rotation.y = Math.PI / 4;
      roofMesh.scale.z = Math.max(0.72, depth / Math.max(0.1, width));
      roofMesh.castShadow = true;
      roofMesh.receiveShadow = true;
      house.add(roofMesh);
    }

    this.addSettlementBox(
      house,
      width * 0.23,
      Math.min(0.78, height * 0.5),
      0.075,
      wood,
      0,
      2.66,
      -depth / 2 - 0.055,
    );

    const windowY = 2.68 + height * 0.34;
    for (const sx of [-width * 0.28, width * 0.28]) {
      this.addSettlementBox(house, width * 0.16, 0.28, 0.055, glass, sx, windowY, -depth / 2 - 0.045);
      this.addSettlementBox(house, width * 0.19, 0.045, 0.075, wood, sx, windowY - 0.17, -depth / 2 - 0.065);
    }

    // Side window and small sill improve readability at isometric angles.
    this.addSettlementBox(
      house,
      0.055,
      0.26,
      depth * 0.18,
      glass,
      width / 2 + 0.035,
      windowY,
      0.1,
    );
    this.addSettlementBox(
      house,
      0.075,
      0.045,
      depth * 0.22,
      wood,
      width / 2 + 0.055,
      windowY - 0.16,
      0.1,
    );

    if (chimneyVisible && !earthen) {
      const chimneyX = width * 0.28;
      const chimneyZ = depth * 0.12;
      this.addSettlementBox(
        house,
        0.14,
        0.58,
        0.14,
        stone,
        chimneyX,
        2.32 + height + 0.38,
        chimneyZ,
      );

      if (detailed) {
        const smokeMaterial = this.environmentMaterial('ambient-chimney-smoke', 0xc8c4b8, 1);
        smokeMaterial.transparent = true;
        smokeMaterial.opacity = 0.24;
        smokeMaterial.depthWrite = false;

        const smoke = new THREE.Group();
        smoke.position.set(chimneyX, 2.32 + height + 0.78, chimneyZ);
        for (const [sx, sy, scale] of [
          [0, 0, 0.13],
          [0.07, 0.24, 0.17],
        ] as Array<[number, number, number]>) {
          const puff = new THREE.Mesh(new THREE.SphereGeometry(1, 6, 5), smokeMaterial);
          puff.position.set(sx, sy, 0);
          puff.scale.set(scale, scale * 0.72, scale);
          smoke.add(puff);
        }
        house.add(smoke);
        const smokePhase = Math.abs(x * 0.37 + z * 0.53 + height * 0.19) % 1;
        this.ambientMotion.registerSmoke(smoke, smokePhase, 0.38, 0.00019);
      }
    }

    if (detailed && !earthen) {
      const awning = this.addSettlementBox(
        house,
        width * 0.72,
        0.075,
        0.28,
        wood,
        0,
        2.36,
        -depth / 2 - 0.18,
      );
      awning.rotation.x = -0.08;

      for (const side of [-1, 1]) {
        const flower = new THREE.Mesh(
          new THREE.SphereGeometry(0.075, 6, 5),
          new THREE.MeshStandardMaterial({
            color: side === -1 ? 0xe9ad68 : 0xd783a1,
            roughness: 0.9,
          }),
        );
        flower.position.set(
          side * width * 0.34,
          2.5,
          -depth / 2 - 0.16,
        );
        flower.castShadow = true;
        house.add(flower);
      }
    }
  }

  private addVillageWell(group: THREE.Group, x: number, z: number): void {
    const stone = this.environmentMaterial('village-well-stone', SETTLEMENT_STYLE.stone, 1);
    const wood = this.environmentMaterial('village-well-wood', SETTLEMENT_STYLE.timber, 1);

    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.38, 12), stone);
    ring.position.set(x, 2.42, z);
    ring.castShadow = true;
    group.add(ring);

    this.addSettlementBox(group, 0.08, 0.82, 0.08, wood, x - 0.38, 2.76, z);
    this.addSettlementBox(group, 0.08, 0.82, 0.08, wood, x + 0.38, 2.76, z);
    this.addSettlementBox(group, 0.9, 0.08, 0.08, wood, x, 3.14, z);
  }

  private makeFarm(group: THREE.Group, level = 1): THREE.Group {
    const normalizedLevel = Math.max(1, Math.min(AGRICULTURE_MAX_LEVEL, Math.floor(level)));
    group.userData.upgradeVisualProfile = upgradeVisualProfile(normalizedLevel);
    const soil = this.environmentMaterial('farm-soil', SETTLEMENT_STYLE.soil, 1);
    const wetSoil = this.environmentMaterial('farm-wet-soil', 0x59483a, 1);
    const cropGreen = this.environmentMaterial('farm-crop-green', 0x6f9c4f, 0.96);
    const cropGold = this.environmentMaterial('farm-crop-gold', 0xc8b95d, 0.94);
    const cropYoung = this.environmentMaterial('farm-crop-young', 0x8db95d, 0.94);
    const wood = this.environmentMaterial('farm-wood', SETTLEMENT_STYLE.timber, 1);
    const woodDark = this.environmentMaterial('farm-wood-dark', 0x4f392b, 1);
    const hay = this.environmentMaterial('farm-hay', 0xc69d4d, 1);
    const water = this.environmentMaterial('farm-water', 0x4e95a3, 0.38);
    const path = this.environmentMaterial('farm-path', SETTLEMENT_STYLE.path, 1);
    const basket = this.environmentMaterial('farm-basket', 0x8b5f35, 1);
    const sack = this.environmentMaterial('farm-sack', 0xb89b6a, 1);
    const iron = this.environmentMaterial('farm-tool-iron', 0x5b6160, 0.78);
    const stone = this.environmentMaterial('farm-upgrade-stone', SETTLEMENT_STYLE.foundation, 1);
    const roof = this.environmentMaterial('farm-upgrade-roof', SETTLEMENT_STYLE.roof[1], 0.96);
    const cloth = this.environmentMaterial('farm-upgrade-cloth', 0xc9b07b, 0.96);

    this.addBox(group, 3.7, 0.14, 3.7, soil, 0, 2.23, 0);

    // Alternating crop beds with visible furrows and slight height variation.
    const rows = [-1.28, -0.72, -0.16, 0.4, 0.96, 1.45];
    rows.forEach((x, index) => {
      const crop =
        index % 3 === 0 ? cropGold : index % 3 === 1 ? cropGreen : cropYoung;
      this.addBox(group, 0.22, 0.22 + (index % 2) * 0.05, 2.62, crop, x, 2.44, -0.18);
      this.addBox(group, 0.08, 0.04, 2.78, wetSoil, x + 0.22, 2.34, -0.18);

      for (let patchIndex = 0; patchIndex < 3; patchIndex += 1) {
        const patchHeight = 0.12 + ((index + patchIndex) % 3) * 0.035;
        this.addBox(
          group,
          0.27,
          patchHeight,
          0.28,
          patchIndex === 0 ? cropYoung : crop,
          x,
          2.55 + patchHeight * 0.35,
          -0.95 + patchIndex * 0.82 + (index % 2) * 0.08,
        );
      }
    });

    // Worked path and footprints between rows.
    this.addBox(group, 0.32, 0.035, 2.62, path, -0.44, 2.345, -0.18);
    for (let i = 0; i < 5; i += 1) {
      const footprint = this.addBox(
        group,
        0.08,
        0.018,
        0.16,
        wetSoil,
        -0.5 + (i % 2) * 0.12,
        2.374,
        -1.08 + i * 0.46,
      );
      footprint.rotation.y = (i % 2 === 0 ? -1 : 1) * 0.16;
    }

    // Irrigation ditch and a small wooden crossing.
    this.addBox(group, 3.36, 0.08, 0.26, wetSoil, 0, 2.31, 1.46);
    this.addBox(group, 3.12, 0.045, 0.16, water, 0, 2.36, 1.46);
    for (const x of [-0.22, 0, 0.22]) {
      this.addBox(group, 0.18, 0.08, 0.66, wood, x, 2.43, 1.46);
    }

    // Compact field shed.
    this.addBox(group, 0.78, 0.12, 0.7, woodDark, -1.2, 2.36, -1.42);
    this.addBox(group, 0.72, 0.88, 0.64, wood, -1.2, 2.82, -1.42);
    const shedRoof = new THREE.Mesh(
      new THREE.ConeGeometry(0.58, 0.48, 4),
      this.environmentMaterial('farm-roof', SETTLEMENT_STYLE.roof[0], 1),
    );
    shedRoof.rotation.y = Math.PI / 4;
    shedRoof.position.set(-1.2, 3.48, -1.42);
    shedRoof.castShadow = true;
    group.add(shedRoof);

    // Hay bales and a simple scarecrow make the farm readable at gameplay scale.
    for (const [x, z] of [[1.22, -1.35], [1.52, -1.06], [1.02, -1.03]] as Array<[number, number]>) {
      const bale = new THREE.Mesh(
        new THREE.CylinderGeometry(0.24, 0.24, 0.46, 9),
        hay,
      );
      bale.rotation.z = Math.PI / 2;
      bale.position.set(x, 2.52, z);
      bale.castShadow = true;
      group.add(bale);
    }

    this.addBox(group, 0.08, 1.32, 0.08, woodDark, 0.96, 2.94, 0.76);
    this.addBox(group, 0.86, 0.07, 0.07, woodDark, 0.96, 3.28, 0.76);
    const scareHead = new THREE.Mesh(
      new THREE.SphereGeometry(0.13, 7, 5),
      hay,
    );
    scareHead.position.set(0.96, 3.53, 0.76);
    scareHead.castShadow = true;
    group.add(scareHead);

    // Tool rack, baskets and seed sacks show recent field activity.
    this.addBox(group, 0.08, 0.78, 0.08, woodDark, -1.58, 2.72, -0.72);
    this.addBox(group, 0.08, 0.78, 0.08, woodDark, -0.88, 2.72, -0.72);
    this.addBox(group, 0.78, 0.07, 0.07, wood, -1.23, 3.02, -0.72);
    for (const x of [-1.45, -1.08]) {
      const handle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.018, 0.018, 0.72, 5),
        woodDark,
      );
      handle.position.set(x, 2.76, -0.7);
      handle.rotation.z = x < -1.2 ? -0.12 : 0.14;
      group.add(handle);
      this.addBox(group, 0.2, 0.035, 0.07, iron, x, 2.43, -0.7);
    }

    for (const [x, z] of [[-1.47, -0.34], [-1.08, -0.28]] as Array<[number, number]>) {
      const basketBody = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.15, 0.2, 8, 1, true),
        basket,
      );
      basketBody.position.set(x, 2.47, z);
      basketBody.castShadow = true;
      group.add(basketBody);
    }

    for (const [x, z, scale] of [
      [1.43, 0.18, 1],
      [1.14, 0.08, 0.82],
    ] as Array<[number, number, number]>) {
      const seedSack = new THREE.Mesh(
        new THREE.SphereGeometry(0.2 * scale, 7, 5),
        sack,
      );
      seedSack.scale.set(0.82, 1.18, 0.72);
      seedSack.position.set(x, 2.49, z);
      seedSack.castShadow = true;
      group.add(seedSack);
    }

    // Perimeter fence with a deliberate gate opening toward the road.
    for (const x of [-1.78, 1.78]) {
      this.addBox(group, 0.09, 0.62, 3.46, wood, x, 2.52, 0);
    }
    this.addBox(group, 2.54, 0.08, 0.08, wood, -0.58, 2.51, -1.78);
    this.addBox(group, 0.72, 0.08, 0.08, wood, 1.42, 2.51, -1.78);

    if (normalizedLevel >= 2) {
      // Level 2: visible irrigation expansion and a covered work station.
      this.addBox(group, 0.18, 0.1, 3.08, stone, 1.58, 2.35, 0);
      this.addBox(group, 0.1, 0.055, 2.86, water, 1.58, 2.42, 0);
      for (const x of [-1.5, -0.82]) {
        this.addBox(group, 0.08, 0.86, 0.08, woodDark, x, 2.79, 0.92);
      }
      const workRoof = this.addBox(group, 0.92, 0.08, 0.84, cloth, -1.16, 3.2, 0.92);
      workRoof.rotation.z = -0.08;
      this.addBox(group, 0.64, 0.12, 0.34, wood, -1.16, 2.5, 0.92);
    }

    if (normalizedLevel >= 3) {
      // Level 3: the small shed grows into a proper timber granary.
      this.addBox(group, 1.18, 0.22, 1.02, stone, -1.2, 2.39, -1.36);
      this.addBox(group, 1.08, 1.42, 0.92, wood, -1.2, 3.14, -1.36);
      this.addBox(group, 0.82, 0.16, 0.06, woodDark, -1.2, 2.78, -1.84);
      const granaryRoof = new THREE.Mesh(
        new THREE.ConeGeometry(0.86, 0.74, 4),
        roof,
      );
      granaryRoof.rotation.y = Math.PI / 4;
      granaryRoof.scale.z = 0.86;
      granaryRoof.position.set(-1.2, 4.22, -1.36);
      granaryRoof.castShadow = true;
      group.add(granaryRoof);

      for (const [x, z] of [[0.92, 1.02], [1.18, 1.02], [1.05, 1.3]] as Array<[number, number]>) {
        this.addBox(group, 0.32, 0.28, 0.32, wood, x, 2.51, z);
      }
    }

    if (normalizedLevel >= 4) {
      // Level 4: a stone-backed estate storehouse and formal farm gate.
      this.addBox(group, 1.36, 0.28, 1.08, stone, 1.12, 2.42, -1.18);
      this.addBox(group, 1.22, 1.58, 0.96, this.environmentMaterial('farm-estate-plaster', 0xd8cda9, 0.96), 1.12, 3.28, -1.18);
      const estateRoof = new THREE.Mesh(
        new THREE.ConeGeometry(0.92, 0.82, 4),
        roof,
      );
      estateRoof.rotation.y = Math.PI / 4;
      estateRoof.scale.z = 0.82;
      estateRoof.position.set(1.12, 4.5, -1.18);
      estateRoof.castShadow = true;
      group.add(estateRoof);

      for (const x of [0.72, 1.08]) {
        this.addBox(group, 0.12, 1.28, 0.12, stone, x, 2.88, -1.77);
      }
      this.addBox(group, 0.54, 0.14, 0.14, woodDark, 0.9, 3.46, -1.77);
      this.addBox(group, 0.06, 0.78, 0.06, woodDark, 0.9, 3.82, -1.77);
      this.addBox(group, 0.34, 0.24, 0.04, cloth, 1.08, 3.98, -1.77);
    }

    group.userData.activeFarm = true;
    group.userData.farmLevel = normalizedLevel;
    return group;
  }

  private makeCowBarn(group: THREE.Group, level: number, gx: number, gy: number): THREE.Group {
    const normalizedLevel = Math.max(1, Math.min(AGRICULTURE_MAX_LEVEL, Math.floor(level)));
    group.userData.upgradeVisualProfile = upgradeVisualProfile(normalizedLevel);
    this.makeHouse(group, 'cowBarn', gx, gy);

    const timber = this.environmentMaterial('cow-barn-upgrade-timber', 0x63452f, 1);
    const timberDark = this.environmentMaterial('cow-barn-upgrade-timber-dark', 0x473124, 1);
    const stone = this.environmentMaterial('cow-barn-upgrade-stone', SETTLEMENT_STYLE.foundation, 1);
    const stoneDark = this.environmentMaterial('cow-barn-upgrade-stone-dark', 0x747a6d, 1);
    const hay = this.environmentMaterial('cow-barn-upgrade-hay', 0xc69d4d, 1);
    const water = this.environmentMaterial('cow-barn-upgrade-water', 0x4e95a3, 0.42);
    const hide = this.environmentMaterial('cow-barn-cow-hide', 0x6a4a36, 0.96);
    const hideLight = this.environmentMaterial('cow-barn-cow-hide-light', 0xd6c9b6, 0.96);
    const roof = this.environmentMaterial('cow-barn-upgrade-roof', 0x9e5437, 0.96);
    const roofDark = this.environmentMaterial('cow-barn-upgrade-roof-dark', 0x6f3d2d, 1);
    const sack = this.environmentMaterial('cow-barn-upgrade-sack', 0xb99a67, 1);
    const iron = this.environmentMaterial('cow-barn-upgrade-iron', 0x596064, 0.82);
    const royalCloth = this.environmentMaterial('cow-barn-upgrade-royal-cloth', 0x74504b, 0.94);

    const addCow = (x: number, z: number, rotation = 0, light = false): void => {
      const cow = new THREE.Group();
      cow.position.set(x, 0, z);
      cow.rotation.y = rotation;
      group.add(cow);
      const bodyMaterial = light ? hideLight : hide;
      const headMaterial = light ? hide : hideLight;
      this.addBox(cow, 0.5, 0.34, 0.76, bodyMaterial, 0, 2.63, 0);
      this.addBox(cow, 0.34, 0.3, 0.32, headMaterial, 0, 2.72, -0.48);
      for (const sx of [-0.17, 0.17]) {
        for (const sz of [-0.22, 0.22]) {
          this.addBox(cow, 0.07, 0.38, 0.07, timberDark, sx, 2.34, sz);
        }
      }
    };

    const addHayBale = (x: number, z: number, y = 2.5, scale = 1): void => {
      const bale = new THREE.Mesh(
        new THREE.CylinderGeometry(0.23 * scale, 0.23 * scale, 0.42 * scale, 9),
        hay,
      );
      bale.rotation.z = Math.PI / 2;
      bale.position.set(x, y, z);
      bale.castShadow = true;
      group.add(bale);
    };

    const addBarrel = (x: number, z: number, y = 2.5): void => {
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.48, 10), timberDark);
      barrel.position.set(x, y, z);
      barrel.castShadow = true;
      group.add(barrel);
      this.addBox(group, 0.43, 0.035, 0.035, iron, x, y + 0.1, z);
      this.addBox(group, 0.43, 0.035, 0.035, iron, x, y - 0.1, z);
    };

    const addFenceRun = (
      x: number,
      z: number,
      length: number,
      horizontal: boolean,
      material: THREE.Material,
      postCount: number,
      railY = 2.62,
    ): void => {
      const railWidth = horizontal ? length : 0.07;
      const railDepth = horizontal ? 0.07 : length;
      this.addBox(group, railWidth, 0.07, railDepth, material, x, railY, z);
      this.addBox(group, railWidth, 0.07, railDepth, material, x, railY + 0.3, z);
      for (let index = 0; index < postCount; index += 1) {
        const t = postCount === 1 ? 0.5 : index / (postCount - 1);
        const px = horizontal ? x - length / 2 + t * length : x;
        const pz = horizontal ? z : z - length / 2 + t * length;
        this.addBox(group, 0.08, 0.74, 0.08, material, px, 2.55, pz);
      }
    };

    const addBarnBlock = (
      x: number,
      z: number,
      width: number,
      depth: number,
      height: number,
      foundationMaterial: THREE.Material,
      wallMaterial: THREE.Material,
      roofMaterial: THREE.Material,
      roofHeight: number,
    ): void => {
      this.addBox(group, width + 0.18, 0.24, depth + 0.18, foundationMaterial, x, 2.42, z);
      this.addBox(group, width, height, depth, wallMaterial, x, 2.52 + height / 2, z);
      const barnRoof = new THREE.Mesh(new THREE.ConeGeometry(width * 0.68, roofHeight, 4), roofMaterial);
      barnRoof.rotation.y = Math.PI / 4;
      barnRoof.scale.z = Math.max(0.72, depth / Math.max(0.1, width));
      barnRoof.position.set(x, 2.54 + height + roofHeight / 2, z);
      barnRoof.castShadow = true;
      barnRoof.receiveShadow = true;
      group.add(barnRoof);
    };

    // Level 1 — Cattle Shed: compact, rustic and intentionally sparse.
    // Keep the silhouette low and the yard lightly furnished so later levels read immediately larger.
    this.addBox(group, 1.12, 0.2, 0.4, timberDark, 0.86, 2.42, -0.12);
    this.addBox(group, 0.96, 0.08, 0.26, water, 0.86, 2.54, -0.12);
    addFenceRun(0, 1.58, 2.65, true, timberDark, 4);
    addFenceRun(-1.34, 0.92, 1.32, false, timberDark, 3);
    addHayBale(-1.28, -1.24, 2.5, 0.9);
    addCow(0.92, 0.78, Math.PI);
    group.userData.cowBarnVisualVariant = 'cattle-shed';

    if (normalizedLevel >= 2) {
      // Level 2 — Reinforced Barn: larger timber mass, expanded yard, feeding canopy,
      // larger herd and a much denser hay/feed work area.
      addBarnBlock(-0.55, -0.78, 2.18, 1.42, 1.5, stoneDark, timber, roof, 0.82);

      for (const x of [0.58, 1.58]) {
        this.addBox(group, 0.1, 1.08, 0.1, timber, x, 2.84, -0.9);
      }
      for (const z of [-1.28, -0.52]) {
        this.addBox(group, 0.1, 1.08, 0.1, timber, 1.08, 2.84, z);
      }
      const canopy = this.addBox(group, 1.28, 0.1, 1.04, roof, 1.08, 3.35, -0.9);
      canopy.rotation.z = -0.07;

      addFenceRun(0.1, 1.76, 3.25, true, timber, 5, 2.68);
      addFenceRun(-1.55, 1.12, 1.32, false, timber, 3, 2.68);
      addFenceRun(1.64, 1.12, 1.32, false, timber, 3, 2.68);

      for (const [x, z, scale] of [
        [1.52, -1.42, 1],
        [1.2, -1.38, 1],
        [1.38, -1.08, 0.95],
        [0.98, -1.15, 0.82],
      ] as Array<[number, number, number]>) {
        addHayBale(x, z, 2.5, scale);
      }
      this.addBox(group, 0.36, 0.28, 0.28, sack, -1.44, 2.51, -1.36);

      addCow(-0.9, 0.78, 0.18, true);
      addCow(1.18, 1.28, Math.PI * 0.86);
      group.userData.cowBarnVisualVariant = 'reinforced-barn';
    }

    if (normalizedLevel >= 3) {
      // Level 3 — Expanded Stockyard: twin-building silhouette, stone-backed main barn,
      // covered pen, more livestock, storage and dedicated work props.
      addBarnBlock(-0.48, -0.72, 2.82, 1.78, 1.96, stone, timber, roofDark, 1.02);
      addBarnBlock(1.12, 0.42, 1.28, 1.12, 1.28, stoneDark, timber, roof, 0.7);

      // Main barn doors and exposed timber framing create a stronger front silhouette.
      this.addBox(group, 0.9, 1.22, 0.09, timberDark, -0.48, 3.08, -1.65);
      for (const x of [-1.42, 0.46]) {
        this.addBox(group, 0.08, 1.5, 0.08, timberDark, x, 3.22, -1.66);
      }
      this.addBox(group, 2.02, 0.08, 0.08, timberDark, -0.48, 3.7, -1.66);

      // Covered stock pen.
      for (const x of [-1.46, -0.52, 0.42]) {
        this.addBox(group, 0.09, 1.18, 0.09, timber, x, 2.9, 1.03);
      }
      const penRoof = this.addBox(group, 2.05, 0.1, 0.86, roof, -0.52, 3.44, 1.03);
      penRoof.rotation.z = 0.05;

      addFenceRun(-0.45, 1.84, 3.72, true, timberDark, 6, 2.72);
      addFenceRun(-1.82, 0.92, 1.86, false, timberDark, 4, 2.72);
      addFenceRun(1.82, 1.18, 1.34, false, timberDark, 3, 2.72);

      addBarrel(1.54, -1.14);
      addBarrel(1.28, -1.36);
      this.addBox(group, 0.42, 0.32, 0.34, sack, 0.88, 2.51, -1.47);
      this.addBox(group, 0.46, 0.36, 0.38, sack, 0.48, 2.53, -1.45);
      this.addBox(group, 0.9, 0.12, 0.48, timberDark, 1.18, 2.47, 1.52);
      this.addBox(group, 0.78, 0.06, 0.35, hay, 1.18, 2.56, 1.52);

      addCow(-1.18, 1.24, -0.08);
      addCow(0.12, 1.35, Math.PI * 0.9, true);
      group.userData.cowBarnVisualVariant = 'expanded-stockyard';
    }

    if (normalizedLevel >= 4) {
      // Level 4 — Royal Stockyard: unmistakable final form with larger barn mass,
      // silo, formal stone gate, premium storage and the largest herd.
      addBarnBlock(-0.38, -0.62, 3.18, 1.96, 2.2, stone, timberDark, roofDark, 1.18);
      addBarnBlock(1.22, 0.56, 1.5, 1.18, 1.48, stone, timber, roof, 0.78);

      const silo = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.54, 2.22, 12), stone);
      silo.position.set(1.34, 3.48, -1.24);
      silo.castShadow = true;
      group.add(silo);
      const siloRoof = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.78, 12), roofDark);
      siloRoof.position.set(1.34, 4.98, -1.24);
      siloRoof.castShadow = true;
      group.add(siloRoof);

      // Formal gate and estate marker.
      for (const x of [-0.46, 0.46]) {
        this.addBox(group, 0.22, 1.48, 0.22, stone, x, 2.98, 1.78);
      }
      this.addBox(group, 1.16, 0.22, 0.22, stone, 0, 3.64, 1.78);
      this.addBox(group, 0.88, 0.09, 0.09, timberDark, 0, 3.36, 1.78);
      this.addBox(group, 0.38, 0.5, 0.06, royalCloth, 0.56, 3.5, 1.76);

      // Premium logistics corner: feed chest, barrels and raised hay stack.
      this.addBox(group, 0.82, 0.56, 0.62, timberDark, -1.42, 2.62, -1.42);
      addBarrel(-1.62, -0.9, 2.52);
      addHayBale(-1.3, -0.92, 2.54, 1.05);
      addHayBale(-1.02, -0.9, 2.54, 1.05);
      addHayBale(-1.16, -0.9, 2.84, 0.92);

      addFenceRun(0, 1.9, 3.9, true, stoneDark, 6, 2.72);
      addCow(-1.28, 1.5, 0.08, true);
      addCow(0.78, 1.52, -0.22);
      group.userData.cowBarnVisualVariant = 'royal-stockyard';
    }

    group.userData.cowBarnLevel = normalizedLevel;
    group.userData.cowBarnVisualProgression = {
      level: normalizedLevel,
      herdSize: normalizedLevel === 1 ? 1 : normalizedLevel === 2 ? 3 : normalizedLevel === 3 ? 5 : 7,
      hasExpandedFence: normalizedLevel >= 2,
      hasSecondaryBarn: normalizedLevel >= 3,
      hasSiloAndFormalGate: normalizedLevel >= 4,
    };
    return group;
  }

  private makeArmyCamp(group: THREE.Group, level = 1): THREE.Group {
    type CampVariant = 'field' | 'reinforced' | 'command' | 'fortified';

    const normalizedLevel = Math.max(1, Math.min(ARMY_CAMP_MAX_LEVEL, Math.floor(level)));
    group.userData.upgradeVisualProfile = upgradeVisualProfile(normalizedLevel);
    const variant = (['field', 'reinforced', 'command', 'fortified'] as CampVariant[])[normalizedLevel - 1];

    const canvas = this.environmentMaterial('army-canvas', 0x9b7653, 0.96);
    const canvasDark = this.environmentMaterial('army-canvas-dark', 0x6f5039, 1);
    const wood = this.environmentMaterial('army-camp-wood', 0x62452f, 1);
    const rope = this.environmentMaterial('army-camp-rope', 0xb49b6b, 1);
    const crate = this.environmentMaterial('army-camp-crate', 0x7e5939, 1);
    const iron = this.environmentMaterial('army-camp-iron', 0x555d61, 0.72);
    const fire = this.environmentMaterial('army-camp-fire', 0xd97832, 0.72);
    const ground = this.environmentMaterial('army-camp-ground', 0x7b6a50, 1);
    const canvasLight = this.environmentMaterial('army-canvas-light', 0xb28d68, 0.94);
    const medical = this.environmentMaterial('army-medical-canvas', 0xd6d0bd, 0.92);
    const medicalRed = this.environmentMaterial('army-medical-mark', 0x9b3f3f, 0.9);
    const darkWood = this.environmentMaterial('army-camp-dark-wood', 0x493426, 1);
    const fortifiedStone = this.environmentMaterial('army-camp-fortified-stone', 0x8d927f, 1);
    const royalCloth = this.environmentMaterial('army-camp-royal-cloth', 0x7043a5, 0.92);

    const addBox = (w: number, h: number, d: number, material: THREE.Material, x: number, y: number, z: number): THREE.Mesh =>
      this.addBox(group, w, h, d, material, x, y, z);

    const addTent = (
      x: number,
      z: number,
      scale = 1,
      material = canvas,
      roofMaterial = canvasDark,
    ): void => {
      addBox(2.05 * scale, 1.08 * scale, 1.75 * scale, material, x, 2.78 + 0.54 * scale, z);
      const roof = new THREE.Mesh(
        new THREE.ConeGeometry(1.52 * scale, 1.22 * scale, 4),
        roofMaterial,
      );
      roof.rotation.y = Math.PI / 4;
      roof.scale.z = 0.78;
      roof.position.set(x, 3.96 + 0.54 * scale, z);
      roof.castShadow = true;
      roof.receiveShadow = true;
      group.add(roof);
      addBox(0.78 * scale, 0.82 * scale, 0.06 * scale, roofMaterial, x, 2.72 + 0.54 * scale, z - 0.89 * scale);
      for (const sign of [-1, 1]) {
        const ropeMesh = new THREE.Mesh(
          new THREE.CylinderGeometry(0.014 * scale, 0.014 * scale, 1.28 * scale, 5),
          rope,
        );
        ropeMesh.position.set(x + sign * 1.12 * scale, 2.65 + 0.45 * scale, z + 0.06 * scale);
        ropeMesh.rotation.z = sign * 0.72;
        group.add(ropeMesh);
        addBox(0.06 * scale, 0.3 * scale, 0.06 * scale, wood, x + sign * 1.27 * scale, 2.35 + 0.28 * scale, z + 0.06 * scale);
      }
    };

    const addCrate = (x: number, z: number, scale = 1): void => {
      addBox(0.54 * scale, 0.42 * scale, 0.54 * scale, crate, x, 2.43 + 0.2 * scale, z);
      addBox(0.58 * scale, 0.045, 0.045, iron, x, 2.46 + 0.2 * scale, z);
    };

    const addWeaponRack = (x: number, z: number, scale = 1): void => {
      addBox(0.07 * scale, 0.9 * scale, 0.07 * scale, wood, x - 0.35 * scale, 2.78, z);
      addBox(0.07 * scale, 0.9 * scale, 0.07 * scale, wood, x + 0.35 * scale, 2.78, z);
      addBox(0.82 * scale, 0.07 * scale, 0.07 * scale, wood, x, 3.08, z);
      for (let i = 0; i < 3; i += 1) {
        const spear = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.95 * scale, 5), iron);
        spear.position.set(x - 0.25 * scale + i * 0.25 * scale, 3.42, z);
        spear.rotation.z = (i - 1) * 0.08;
        group.add(spear);
      }
    };

    const addFire = (x: number, z: number, scale = 1): void => {
      for (let i = 0; i < 3; i += 1) {
        const angle = (i / 3) * Math.PI * 2;
        const stone = new THREE.Mesh(
          new THREE.DodecahedronGeometry(0.14 * scale, 0),
          this.environmentMaterial('army-camp-stone', 0x69625b, 1),
        );
        stone.position.set(x + Math.cos(angle) * 0.24 * scale, 2.36, z + Math.sin(angle) * 0.24 * scale);
        group.add(stone);
      }
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.16 * scale, 0.46 * scale, 7), fire);
      flame.position.set(x, 2.62 + 0.18 * scale, z);
      group.add(flame);
      this.ambientMotion.registerSway(
        flame,
        Math.abs(x * 0.61 + z * 0.43),
        0.055,
        0.0038,
      );
    };

    const addBanner = (x: number, z: number, scale = 1, material = canvasDark): void => {
      addBox(0.065, 2.35 * scale, 0.065, wood, x, 3.22 + 0.35 * scale, z);
      const banner = addBox(0.78 * scale, 0.42 * scale, 0.04, material, x + 0.34 * scale, 4.16 + 0.35 * scale, z);
      banner.userData.castleFlag = { phase: x * 0.4 + z * 0.2 };
    };

    const addWagon = (x: number, z: number, scale = 1): void => {
      addBox(1.55 * scale, 0.24 * scale, 0.82 * scale, wood, x, 2.62, z);
      addBox(0.1 * scale, 0.1 * scale, 1.35 * scale, darkWood, x, 2.77, z);
      for (const wheelX of [-0.62, 0.62]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.28 * scale, 0.28 * scale, 0.12 * scale, 10), darkWood);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(x + wheelX * scale, 2.42, z);
        wheel.castShadow = true;
        group.add(wheel);
      }
      addCrate(x - 0.35 * scale, z, 0.75 * scale);
      addCrate(x + 0.35 * scale, z, 0.75 * scale);
    };

    const addMedicalTent = (x: number, z: number, scale = 1): void => {
      addTent(x, z, scale, medical, medical);
      addBox(0.42 * scale, 0.16 * scale, 0.035, medicalRed, x, 3.22 + 0.54 * scale, z - 0.91 * scale);
      addBox(0.035, 0.42 * scale, 0.035, medicalRed, x, 3.22 + 0.54 * scale, z - 0.91 * scale);
    };

    addBox(
      variant === 'reinforced' ? 5.8 : variant === 'command' ? 6.0 : variant === 'fortified' ? 6.4 : 5.0,
      0.06,
      variant === 'reinforced' ? 5.8 : variant === 'command' ? 5.8 : variant === 'fortified' ? 6.2 : 5.0,
      ground,
      0,
      2.22,
      0,
    );

    if (variant === 'field') {
      addTent(0, -0.55, 1.15);
      addTent(-1.25, 1.2, 0.58, canvasLight, canvas);
      addTent(1.3, 1.15, 0.58, canvasLight, canvas);
      addCrate(-1.55, 0.15);
      addCrate(-1.0, 0.42, 0.85);
      addWeaponRack(1.25, 0.25);
      addFire(0.7, 1.05);
      addBanner(1.72, -0.92);
    } else if (variant === 'reinforced') {
      addTent(0, -0.9, 1.45, canvas, darkWood);
      addTent(-2.0, 1.05, 0.75, canvasLight, canvasDark);
      addTent(2.0, 1.05, 0.75, canvasLight, canvasDark);
      addCrate(-1.95, 0.05, 1.15);
      addCrate(-1.35, 0.45, 1.05);
      addCrate(1.55, 0.15, 1.1);
      addWeaponRack(0.95, 0.85, 1.15);
      addBanner(2.25, -1.1, 1.15, darkWood);
      addFire(-0.75, 1.18, 1.1);

      // Siege preparation timber, frames and bundled materials.
      for (let i = 0; i < 4; i += 1) {
        const timber = addBox(0.22, 1.75, 0.22, wood, -2.25 + i * 0.42, 3.02, -0.1 + (i % 2) * 0.16);
        timber.rotation.z = (i % 2 === 0 ? -1 : 1) * 0.13;
      }
      for (let i = 0; i < 3; i += 1) {
        const beam = addBox(0.24, 0.24, 1.9, darkWood, -0.3 + i * 0.34, 2.47, 1.52);
        beam.rotation.y = i * 0.12;
      }
      // Simple siege-frame silhouette; visual staging only, not a siege weapon.
      addBox(0.14, 1.65, 0.14, wood, 0.0, 3.0, 1.72);
      addBox(1.3, 0.12, 0.12, wood, 0.0, 3.72, 1.72);
      addBox(0.12, 1.2, 0.12, wood, -0.62, 3.15, 1.72);
      addBox(0.12, 1.2, 0.12, wood, 0.62, 3.15, 1.72);
    } else if (variant === 'command') {
      addTent(0, -0.65, 1.55, canvas, darkWood);
      addTent(-1.9, 1.25, 0.58, canvasLight, canvas);
      addTent(1.9, 1.25, 0.58, canvasLight, canvas);
      addBanner(-2.25, -1.25, 1.2);
      addBanner(2.25, -1.25, 1.2);

      // Command table and map board.
      addBox(1.65, 0.12, 0.72, darkWood, 0, 3.0, -0.55);
      addBox(1.3, 0.045, 0.55, canvasLight, 0, 3.09, -0.55);
      addBox(0.08, 0.8, 0.08, wood, -0.68, 2.63, -0.55);
      addBox(0.08, 0.8, 0.08, wood, 0.68, 2.63, -0.55);
      addCrate(-1.7, 0.1);
      addCrate(1.7, 0.1);
      addWeaponRack(-1.55, 1.35, 0.8);
      addWeaponRack(1.55, 1.35, 0.8);
      addFire(0, 1.35, 0.7);
      addBanner(0, 1.72, 1.15, canvasDark);
    } else {
      // Level 4 becomes a visibly more permanent military base instead of
      // another lateral tent variant: stone foundation, timber command hall,
      // guard posts, logistics, medical support, and a royal standard.
      addBox(3.15, 0.34, 2.35, fortifiedStone, 0, 2.42, -0.62);
      addBox(2.82, 1.45, 2.08, darkWood, 0, 3.25, -0.62);
      const commandRoof = new THREE.Mesh(new THREE.ConeGeometry(2.05, 1.18, 4), royalCloth);
      commandRoof.rotation.y = Math.PI / 4;
      commandRoof.scale.z = 0.72;
      commandRoof.position.set(0, 4.62, -0.62);
      commandRoof.castShadow = true;
      commandRoof.receiveShadow = true;
      group.add(commandRoof);

      for (const x of [-2.55, 2.55]) {
        addBox(0.62, 0.28, 0.62, fortifiedStone, x, 2.38, -1.9);
        addBox(0.48, 1.55, 0.48, darkWood, x, 3.18, -1.9);
        const postRoof = new THREE.Mesh(new THREE.ConeGeometry(0.58, 0.72, 4), canvasDark);
        postRoof.rotation.y = Math.PI / 4;
        postRoof.position.set(x, 4.28, -1.9);
        postRoof.castShadow = true;
        group.add(postRoof);
      }

      addMedicalTent(-2.05, 1.35, 0.72);
      addTent(2.05, 1.35, 0.72, canvasLight, canvasDark);
      addWagon(2.0, 0.1, 0.82);
      addCrate(-1.55, 0.0, 1.1);
      addCrate(1.25, 0.15, 1.0);
      addWeaponRack(-1.75, -0.2, 1.0);
      addWeaponRack(1.72, -0.2, 1.0);
      addFire(0, 1.35, 0.72);
      addBanner(0, -2.25, 1.35, royalCloth);
      addBanner(-2.65, 1.95, 0.82, medicalRed);

      // Low palisade segments make the final silhouette read as fortified.
      for (const x of [-2.7, -1.8, -0.9, 0.9, 1.8, 2.7]) {
        addBox(0.11, 1.05, 0.11, wood, x, 2.78, 2.65);
      }
      addBox(2.0, 0.12, 0.12, wood, -1.85, 3.1, 2.65);
      addBox(2.0, 0.12, 0.12, wood, 1.85, 3.1, 2.65);
    }

    group.userData.armyCamp = true;
    group.userData.armyCampVariant = variant;
    group.userData.armyCampLevel = normalizedLevel;
    return group;
  }

  private makeTree(group: THREE.Group, level: number): THREE.Group {
    const variant = Math.max(1, level);
    const trunk = this.environmentMaterial('tree-trunk', 0x75533c, 1);
    const foliage = this.environmentMaterial(
      `tree-foliage-${(variant - 1) % 3}`,
      [WORLD_STYLE.palette.foliageMid, WORLD_STYLE.palette.foliageLight, WORLD_STYLE.palette.grassForest][(variant - 1) % 3],
      0.9,
    );

    const trunkMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 1.6, 7), trunk);
    trunkMesh.position.y = 3.0;
    trunkMesh.castShadow = true;
    group.add(trunkMesh);

    const crown = new THREE.Group();
    group.add(crown);
    for (const [radius, y] of [[1.05, 4.25], [0.78, 5.3], [0.5, 6.05]] as Array<[number, number]>) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(radius, radius * 1.95, 8), foliage);
      cone.position.y = y;
      cone.castShadow = true;
      crown.add(cone);
    }

    const swayPhase = variant * 0.73 + group.position.x * 0.017 + group.position.z * 0.023;
    this.ambientMotion.registerSway(crown, swayPhase, 0.032 + (variant % 3) * 0.004, 0.00115);
    return group;
  }

  private makeRock(group: THREE.Group, level: number): THREE.Group {
    const material = new THREE.MeshStandardMaterial({
      color: level % 2 === 0 ? 0x7a766f : 0x8a8379,
      roughness: 1,
      flatShading: true,
    });

    const main = new THREE.Mesh(new THREE.DodecahedronGeometry(0.95, 0), material);
    main.position.y = 2.8;
    main.scale.set(1.25, 0.78, 1.0);
    main.rotation.set(0.2, 0.35, 0.05);
    main.castShadow = true;
    group.add(main);

    const side = new THREE.Mesh(new THREE.DodecahedronGeometry(0.52, 0), material);
    side.position.set(0.9, 2.52, 0.45);
    side.scale.y = 0.75;
    side.castShadow = true;
    group.add(side);

    return group;
  }

  private makeHut(group: THREE.Group): THREE.Group {
    const wall = new THREE.MeshStandardMaterial({ color: 0xb78962, roughness: 1 });
    const roof = new THREE.MeshStandardMaterial({ color: 0x80624c, roughness: 1 });
    const wood = new THREE.MeshStandardMaterial({ color: 0x5f4433, roughness: 1 });

    this.addBox(group, 2.5, 2.25, 2.3, wall, 0, 3.35, 0);
    const roofMesh = new THREE.Mesh(new THREE.ConeGeometry(1.9, 1.75, 4), roof);
    roofMesh.position.y = 5.15;
    roofMesh.rotation.y = Math.PI / 4;
    roofMesh.castShadow = true;
    group.add(roofMesh);
    this.addBox(group, 0.55, 1.05, 0.1, wood, 0, 2.92, -1.18);
    return group;
  }

  private makeMountain(
    group: THREE.Group,
    level: number,
    gx: number,
    gy: number,
  ): THREE.Group {
    const seed = Math.abs((gx * 127 + gy * 211 + level * 53 + gx * gy * 7) % 997);
    this.addMountainFormation(group, level, seed);
    return group;
  }

  private makeMine(group: THREE.Group): THREE.Group {
    const rockA = new THREE.MeshStandardMaterial({ color: 0x6d625a, roughness: 1, flatShading: true });
    const rockB = new THREE.MeshStandardMaterial({ color: 0x81766c, roughness: 1, flatShading: true });
    const dark = new THREE.MeshStandardMaterial({ color: 0x171412, roughness: 1 });
    const timber = new THREE.MeshStandardMaterial({ color: 0x795238, roughness: 1 });
    const metal = new THREE.MeshStandardMaterial({ color: 0x707b82, metalness: 0.55, roughness: 0.48 });

    const mountain = new THREE.Mesh(new THREE.ConeGeometry(1.78, 5.0, 7), rockA);
    mountain.position.set(0, 4.7, 0.35);
    mountain.castShadow = true;
    mountain.receiveShadow = true;
    group.add(mountain);

    const shoulder = new THREE.Mesh(new THREE.ConeGeometry(1.0, 3.5, 6), rockB);
    shoulder.position.set(1.0, 3.85, 0.75);
    shoulder.castShadow = true;
    group.add(shoulder);

    this.addBox(group, 1.55, 1.8, 0.36, dark, 0, 3.08, -1.38);
    this.addBox(group, 0.2, 2.05, 0.45, timber, -0.82, 3.14, -1.4);
    this.addBox(group, 0.2, 2.05, 0.45, timber, 0.82, 3.14, -1.4);
    this.addBox(group, 1.86, 0.2, 0.45, timber, 0, 4.12, -1.4);
    this.addBox(group, 0.09, 0.08, 2.4, metal, -0.46, 2.32, -2.35);
    this.addBox(group, 0.09, 0.08, 2.4, metal, 0.46, 2.32, -2.35);

    return group;
  }

  private makeMoat(group: THREE.Group, wet: boolean): THREE.Group {
    const soil = new THREE.MeshStandardMaterial({ color: 0x564a3d, roughness: 1 });
    const inner = new THREE.MeshStandardMaterial({ color: 0x302b27, roughness: 1 });
    const water = new THREE.MeshStandardMaterial({
      color: 0x2b9fbd,
      roughness: 0.2,
      metalness: 0.04,
      transparent: true,
      opacity: 0.88,
    });

    this.addBox(group, 3.92, 0.12, 3.92, soil, 0, 2.13, 0);
    this.addBox(group, 3.28, 0.1, 3.28, wet ? water : inner, 0, 2.18, 0);

    const bank = new THREE.MeshStandardMaterial({ color: 0x7c684f, roughness: 1 });
    this.addBox(group, 3.92, 0.2, 0.26, bank, 0, 2.25, -1.82);
    this.addBox(group, 3.92, 0.2, 0.26, bank, 0, 2.25, 1.82);
    this.addBox(group, 0.26, 0.2, 3.42, bank, -1.82, 2.25, 0);
    this.addBox(group, 0.26, 0.2, 3.42, bank, 1.82, 2.25, 0);

    return group;
  }

  private computeFloodedMoats(): Set<string> {
    const flooded = new Set<string>();
    const queue: GridPoint[] = [];

    for (const cell of this.services.state.entries()) {
      if (cell.kind !== 'moat') continue;

      const neighbors = [
        [cell.x - 1, cell.y],
        [cell.x + 1, cell.y],
        [cell.x, cell.y - 1],
        [cell.x, cell.y + 1],
      ];

      if (neighbors.some(([x, y]) => this.terrainAt(x, y) === 'river')) {
        flooded.add(this.key(cell.x, cell.y));
        queue.push({ x: cell.x, y: cell.y });
      }
    }

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) break;

      const neighbors = [
        [current.x - 1, current.y],
        [current.x + 1, current.y],
        [current.x, current.y - 1],
        [current.x, current.y + 1],
      ];

      for (const [x, y] of neighbors) {
        if (this.kindAt(x, y) !== 'moat') continue;
        const cellKey = this.key(x, y);
        if (flooded.has(cellKey)) continue;
        flooded.add(cellKey);
        queue.push({ x, y });
      }
    }

    return flooded;
  }

  private captureSnapshot(): HistorySnapshot {
    return {
      mapLayoutId: this.mapLayoutId,
      worldSeed: this.worldSeed,
      cells: this.services.state.entries().map((cell) => ({
        ...cell,
        wallLinks: cell.wallLinks ? [...cell.wallLinks] : undefined,
      })),
      keeps: this.services.keepSystem.entries(),
      terrain: Array.from(this.terrainOverrides.entries()),
      elevations: Array.from(this.elevationOverrides.entries()),
      stoneStyle: this.stoneStyle,
      towerBridges: Array.from(this.towerBridges.values()).map((bridge) => ({ ...bridge })),
      militaryTier: this.militaryTier,
      economy: this.services.economySystem.getState(),
      population: this.services.populationSystem.getState(),
    };
  }

  private syncHistoryActions(): void {
    const syncButton = (id: string, disabled: boolean): void => {
      const button = document.getElementById(id);
      if (!(button instanceof HTMLButtonElement)) return;
      button.disabled = disabled;
      button.setAttribute('aria-disabled', String(disabled));
    };

    syncButton('header-undo-button', this.undoStack.length === 0);
    syncButton('undo-button', this.undoStack.length === 0);
    syncButton('redo-button', this.redoStack.length === 0);
  }

  private pushUndoSnapshot(snapshot: HistorySnapshot): void {
    this.undoStack.push(snapshot);
    if (this.undoStack.length > 60) this.undoStack.shift();
    this.redoStack.length = 0;
    this.syncHistoryActions();
  }

  private recordHistory(): void {
    this.pushUndoSnapshot(this.captureSnapshot());
  }

  private restoreSnapshot(snapshot: HistorySnapshot): void {
    this.constructionAnimation.clear();
    this.setMapLayoutId(snapshot.mapLayoutId ?? 'island');
    this.worldSeed = Number.isFinite(snapshot.worldSeed) ? Math.trunc(snapshot.worldSeed) : 0;
    this.services.state.replace(snapshot.cells);
    this.services.keepSystem.replace(snapshot.keeps ?? []);
    this.stoneStyle = snapshot.stoneStyle ?? 'limestone';
    this.towerBridges.clear();
    for (const bridge of snapshot.towerBridges ?? []) {
      this.towerBridges.set(bridge.id, { ...bridge });
    }
    this.nextTowerBridgeId =
      Math.max(0, ...Array.from(this.towerBridges.keys())) + 1;
    this.terrainOverrides.clear();
    this.elevationOverrides.clear();

    for (const [key, value] of snapshot.terrain) this.terrainOverrides.set(key, value);
    for (const [key, value] of snapshot.elevations) this.elevationOverrides.set(key, value);
    this.normalizeRiverElevations();
    this.militaryTier = normalizeMilitaryTier(snapshot.militaryTier);
    this.services.economySystem.setState(snapshot.economy);
    this.services.populationSystem.setState(snapshot.population);
    this.populationBattleCommitted = false;
    this.populationBattleStart = null;
    this.syncMilitaryUI();
    this.syncEconomyUI();

    this.selectedCell = null;
    this.selectedKeepId = null;
    this.selectedTowerBridgeId = null;
    this.towerBridgeStart = null;
    this.towerBridgeHover = null;
    const stoneSelect = document.getElementById('castle-stone-style') as HTMLSelectElement | null;
    if (stoneSelect) stoneSelect.value = this.stoneStyle;
    this.redraw();
    this.save(false);
  }

  private undo(): void {
    const snapshot = this.undoStack.pop();
    if (!snapshot) {
      this.syncHistoryActions();
      this.setStatus('Nothing to undo');
      return;
    }

    this.redoStack.push(this.captureSnapshot());
    this.restoreSnapshot(snapshot);
    this.syncHistoryActions();
    this.setStatus('Undo');
  }

  private redo(): void {
    const snapshot = this.redoStack.pop();
    if (!snapshot) {
      this.syncHistoryActions();
      this.setStatus('Nothing to redo');
      return;
    }

    this.undoStack.push(this.captureSnapshot());
    this.restoreSnapshot(snapshot);
    this.syncHistoryActions();
    this.setStatus('Redo');
  }

  private brushPoints(center: GridPoint): Array<GridPoint & { weight: number }> {
    const radius = Math.max(0, this.brushSize - 1);
    const points: Array<GridPoint & { weight: number }> = [];

    for (let y = center.y - radius; y <= center.y + radius; y += 1) {
      for (let x = center.x - radius; x <= center.x + radius; x += 1) {
        if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) continue;

        const distance = Math.hypot(x - center.x, y - center.y);
        if (radius > 0 && distance > radius + 0.35) continue;

        points.push({
          x,
          y,
          weight: radius === 0 ? 1 : THREE.MathUtils.clamp(1 - distance / (radius + 0.65), 0.18, 1),
        });
      }
    }

    return points;
  }

  private averageNeighborElevation(x: number, y: number): number {
    let sum = 0;
    let count = 0;

    for (let oy = -1; oy <= 1; oy += 1) {
      for (let ox = -1; ox <= 1; ox += 1) {
        const nx = x + ox;
        const ny = y + oy;
        if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE) continue;
        if (this.terrainAt(nx, ny) === 'water' || this.terrainAt(nx, ny) === 'river') continue;
        sum += this.terrainElevation(nx, ny);
        count += 1;
      }
    }

    return count === 0 ? this.terrainElevation(x, y) : sum / count;
  }

  private applyTerrainBrush(center: GridPoint): void {
    const tool = this.selectedTool;
    if (tool === null || !this.isTerrainTool(tool)) return;
    const points = this.brushPoints(center);
    const centerElevation = this.terrainElevation(center.x, center.y);
    const oldValues = new Map<string, number>();

    for (const point of points) {
      oldValues.set(this.key(point.x, point.y), this.terrainElevation(point.x, point.y));
    }

    let changed = false;

    for (const point of points) {
      if (!this.canEditTerrainAt(point.x, point.y)) continue;
      const terrain = this.terrainAt(point.x, point.y);
      if (terrain === 'water' || terrain === 'river') continue;

      const current = oldValues.get(this.key(point.x, point.y)) ?? this.terrainElevation(point.x, point.y);
      let next = current;
      const scaled = this.brushStrength * point.weight;

      if (tool === 'raise') next = current + 0.32 * scaled;
      else if (tool === 'lower') next = current - 0.32 * scaled;
      else if (tool === 'flatten') {
        next = THREE.MathUtils.lerp(current, centerElevation, THREE.MathUtils.clamp(0.3 * this.brushStrength, 0, 1));
      } else if (tool === 'smooth') {
        const average = this.averageNeighborElevation(point.x, point.y);
        next = THREE.MathUtils.lerp(current, average, THREE.MathUtils.clamp(0.26 * this.brushStrength, 0, 0.92));
      } else if (tool === 'hill') {
        next = current + 0.48 * scaled;
      } else if (tool === 'cliff') {
        const target = centerElevation + 0.85 * this.brushStrength;
        next = point.weight > 0.42 ? Math.max(current, target) : current;
      }

      next = THREE.MathUtils.clamp(next, -1.6, 6);
      if (Math.abs(next - current) < 0.005) continue;

      this.setAbsoluteElevation(point.x, point.y, next);
      changed = true;
    }

    if (changed) {
      this.terrainStrokeChanged = true;
      this.redraw();
      this.setStatus(`Terrain: ${tool} · brush ${this.brushSize} · strength ${this.brushStrength.toFixed(2)}`);
    }
  }

  private rotateSelected(): void {
    if (this.selectedKeepId !== null) {
      this.rotateSelectedKeep();
      return;
    }

    if (!this.selectedCell) {
      this.setStatus('Click a structure first');
      return;
    }

    const cell = this.services.state.getCell(this.selectedCell.x, this.selectedCell.y);
    if (!cell) {
      this.setStatus('Selected tile has no structure');
      return;
    }

    this.recordHistory();
    this.services.state.updateCell(this.selectedCell.x, this.selectedCell.y, {
      rotation: ((cell.rotation ?? 0) + 1) % 4,
      ...(cell.kind === 'gate' ? { rotationMode: 'manual' as const } : {}),
    });
    this.redraw();
    this.scheduleSave();
    this.setStatus('Rotated selected structure');
  }

  private cancelActiveTouchBuildGesture(): void {
    const terrainSnapshot =
      this.terrainStrokeActive && this.terrainStrokeChanged
        ? this.terrainStrokeSnapshot
        : null;

    this.cancelLongPress();
    this.godModeTouchStart = null;
    this.longPressTriggered = false;
    this.wallDragStart = null;
    this.wallDragEnd = null;
    this.roadDragStart = null;
    this.roadDragEnd = null;
    this.mountainRangeStart = null;
    this.mountainRangeEnd = null;
    this.terrainStrokeActive = false;
    this.terrainStrokeChanged = false;
    this.terrainStrokeSnapshot = null;
    this.lastTerrainBrushKey = '';
    this.pointerStart = null;
    this.buildPreviewKey = '';
    this.clearBuildPlacementPreview();
    this.towerBridgeStart = null;
    this.towerBridgeHover = null;
    this.controls.enabled = true;

    if (terrainSnapshot) {
      // A stroke changes elevation only. Do not rewind economy/population that
      // continued simulating while the player held a finger down.
      this.elevationOverrides.clear();
      for (const [key, value] of terrainSnapshot.elevations) this.elevationOverrides.set(key, value);
      this.normalizeRiverElevations();
      this.redraw();
    }
  }

  private bindPointerInput(): void {
    const canvas = this.renderer.domElement;
    const touches = new TouchGestureSession(
      () => this.cancelActiveTouchBuildGesture(),
      (delta) => {
        applyTouchCameraDelta(this.camera, this.controls, delta, canvas.clientHeight);
        this.enforceGameplayCameraBounds();
      },
    );
    if (new URLSearchParams(window.location.search).has('touchQA')) {
      // Read-only, opt-in diagnostics for CDP touch tests; normal release bounds
      // remain enabled (unlike visualBaseline's fixed-camera benchmark mode).
      (window as unknown as { __castleTouchQA: () => object }).__castleTouchQA = () => ({
        camera: this.camera.position.toArray(), target: this.controls.target.toArray(),
        distance: this.camera.position.distanceTo(this.controls.target),
        minDistance: this.controls.minDistance, maxDistance: this.controls.maxDistance,
        cells: this.services.state.entries(), elevations: [...this.elevationOverrides.entries()],
        undoCount: this.undoStack.length, pointers: touches.pointerIds,
        dragging: Boolean(this.wallDragStart || this.roadDragStart || this.terrainStrokeActive),
        preview: this.wallPreviewLayer.children.length,
      });
    }
    // Canvas touches belong to one owner. OrbitControls retains desktop mouse,
    // wheel and keyboard events; it never receives half of a touch sequence.
    const consumeTouch = (event: PointerEvent): void => {
      event.preventDefault();
      event.stopPropagation();
    };

    canvas.addEventListener(
      'pointerdown',
      (event) => {
        if (event.button !== 0) return;
        if (event.pointerType === 'touch') {
          consumeTouch(event);
          void this.audioManager.initializeFromUserGesture();
          canvas.setPointerCapture(event.pointerId);
          const stroke = !this.isGodModeTargeting() && this.selectedTool !== null &&
            (this.isWallTool(this.selectedTool) || this.isRoadTool(this.selectedTool) ||
              this.isTerrainTool(this.selectedTool) || this.selectedTool === 'mountainRange');
          const intent = !this.controls.enabled && !touches.pointerIds.length ? 'blocked' :
            this.battleSystem.isActive() ? 'camera' : stroke ? 'stroke' : 'tap';
          if (!touches.down(event, intent)) return;
        }
        if (this.battleSystem.isActive()) return;

        const cell = this.pickGridCell(event);
        if (cell && event.pointerType !== 'mouse') {
          this.renderBuildPlacementPreview(cell, true, event.shiftKey);
        }
        if (this.isGodModeTargeting()) {
          if (event.pointerType !== 'mouse') {
            // Keep OrbitControls' touch gestures available while aiming.
            this.godModeTouchStart = this.godModeTouchStart
              ? null // A second finger means a camera gesture, not a target tap.
              : { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
            return;
          }
          this.fireGodModeAt(cell);
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        if (cell && this.selectedTool !== null && this.selectedTool !== 'towerBridge') this.beginLongPress(event, cell);

        if (this.selectedTool !== null && this.isWallTool(this.selectedTool)) {
          if (!cell) return;
          this.wallDragStart = cell;
          this.wallDragEnd = cell;
          this.controls.enabled = false;
          canvas.setPointerCapture(event.pointerId);
          this.renderWallPreview([cell], event.shiftKey);
          this.setStatus(this.wallPreviewStatus);
          event.preventDefault();
          event.stopPropagation();
          return;
        }

        if (this.selectedTool !== null && this.isRoadTool(this.selectedTool)) {
          if (!cell) return;
          this.roadDragStart = cell;
          this.roadDragEnd = cell;
          this.controls.enabled = false;
          canvas.setPointerCapture(event.pointerId);
          this.renderRoadPreview([cell]);
          this.setStatus('Road drag: choose end point · release to confirm');
          event.preventDefault();
          event.stopPropagation();
          return;
        }

        if (this.selectedTool === 'mountainRange') {
          if (!cell) return;
          this.mountainRangeStart = cell;
          this.mountainRangeEnd = cell;
          this.controls.enabled = false;
          canvas.setPointerCapture(event.pointerId);
          this.renderMountainRangePreview([cell]);
          this.setStatus('Mountain Range: drag A → B · release to generate ridge');
          event.preventDefault();
          event.stopPropagation();
          return;
        }

        if (this.selectedTool !== null && this.isTerrainTool(this.selectedTool)) {
          if (!cell) return;

          this.terrainStrokeActive = true;
          this.terrainStrokeChanged = false;
          this.terrainStrokeSnapshot = this.captureSnapshot();
          this.lastTerrainBrushKey = this.key(cell.x, cell.y);
          this.controls.enabled = false;
          canvas.setPointerCapture(event.pointerId);
          this.applyTerrainBrush(cell);

          event.preventDefault();
          event.stopPropagation();
          return;
        }

        this.pointerStart = { x: event.clientX, y: event.clientY };
      },
      true,
    );

    canvas.addEventListener(
      'pointermove',
      (event) => {
        if (event.pointerType === 'touch') {
          consumeTouch(event);
          if (!touches.move(event)) return;
        }
        if (this.isGodModeTargeting() && event.pointerType === 'mouse' && !this.wallDragStart && !this.roadDragStart && !this.terrainStrokeActive) {
          const cell = this.pickGridCell(event);
          if (cell && (cell.x !== this.godModeHover?.x || cell.y !== this.godModeHover?.y)) {
            this.godModeHover = cell;
            const candidate = this.resolveGodModeTarget(cell);
            if (
              candidate?.anchor.x !== this.godModeTarget?.anchor.x ||
              candidate?.anchor.y !== this.godModeTarget?.anchor.y
            ) {
              this.godModeTarget = candidate;
              this.renderGodModeTargetMarker();
              this.updateGodModeUI();
            }
          }
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        this.cancelLongPressOnMovement(event);

        if (
          !this.wallDragStart &&
          !this.roadDragStart &&
          !this.mountainRangeStart &&
          !this.terrainStrokeActive &&
          !(this.selectedTool === 'towerBridge' && this.towerBridgeStart)
        ) {
          this.renderBuildPlacementPreview(this.pickGridCell(event), false, event.shiftKey);
        }

        if (this.wallDragStart) {
          const cell = this.pickGridCell(event);
          if (cell) {
            this.wallDragEnd = cell;
            const path = this.wallPath(this.wallDragStart, cell);
            this.renderWallPreview(path, event.shiftKey);
            this.setStatus(this.wallPreviewStatus);
          }
          event.preventDefault();
          event.stopPropagation();
          return;
        }

        if (this.roadDragStart) {
          const cell = this.pickGridCell(event);
          if (cell) {
            this.roadDragEnd = cell;
            const path = this.roadPath(this.roadDragStart, cell);
            this.renderRoadPreview(path);
            this.setStatus(`Road drag: ${path.length} tiles · release to build`);
          }
          event.preventDefault();
          event.stopPropagation();
          return;
        }

        if (this.selectedTool === 'towerBridge' && this.towerBridgeStart) {
          const cell = this.pickGridCell(event);
          if (
            cell &&
            (cell.x !== this.towerBridgeHover?.x || cell.y !== this.towerBridgeHover?.y)
          ) {
            this.towerBridgeHover = cell;
            if (this.services.state.getCell(cell.x, cell.y)?.kind === 'tower') {
              this.renderTowerBridgePreview(this.towerBridgeStart, cell);
            } else {
              this.clearGroup(this.wallPreviewLayer);
            }
          }
        }

        if (this.mountainRangeStart) {
          const cell = this.pickGridCell(event);
          if (cell) {
            this.mountainRangeEnd = cell;
            const path = this.mountainRangePath(this.mountainRangeStart, cell);
            this.renderMountainRangePreview(path);
            this.setStatus(`Mountain Range: ${path.length} ridge nodes · release to generate`);
          }
          event.preventDefault();
          event.stopPropagation();
          return;
        }

        if (this.terrainStrokeActive) {
          const cell = this.pickGridCell(event);
          if (cell) {
            const brushKey = this.key(cell.x, cell.y);
            if (brushKey !== this.lastTerrainBrushKey) {
              this.lastTerrainBrushKey = brushKey;
              this.applyTerrainBrush(cell);
            }
          }

          event.preventDefault();
          event.stopPropagation();
        }
      },
      true,
    );

    canvas.addEventListener(
      'pointerup',
      (event) => {
        if (event.button !== 0) return;

        if (event.pointerType === 'touch') {
          consumeTouch(event);
          const action = touches.up(event);
          if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
          if (!action) return;
        }

        if (this.isGodModeTargeting()) {
          const start = this.godModeTouchStart;
          this.godModeTouchStart = null;
          if (event.pointerType !== 'mouse') {
            if (start?.pointerId === event.pointerId &&
              Math.hypot(event.clientX - start.x, event.clientY - start.y) <= 10) {
              this.setGodModeTarget(this.pickGridCell(event));
            }
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          return;
        }

        const longPressTriggered = this.longPressTriggered;
        this.cancelLongPress();
        this.longPressTriggered = false;

        if (longPressTriggered) {
          this.wallDragStart = null;
          this.wallDragEnd = null;
          this.roadDragStart = null;
          this.roadDragEnd = null;
          this.mountainRangeStart = null;
          this.mountainRangeEnd = null;
          this.terrainStrokeActive = false;
          this.terrainStrokeSnapshot = null;
          this.clearGroup(this.wallPreviewLayer);
          this.controls.enabled = true;
          if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
          event.preventDefault();
          event.stopPropagation();
          return;
        }

        if (this.wallDragStart) {
          const end = this.pickGridCell(event) ?? this.wallDragEnd ?? this.wallDragStart;
          const startPoint = this.wallDragStart;

          this.wallDragStart = null;
          this.wallDragEnd = null;
          this.controls.enabled = true;

          if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
          this.buildWallDrag(startPoint, end, event.shiftKey);

          event.preventDefault();
          event.stopPropagation();
          return;
        }

        if (this.roadDragStart) {
          const end = this.pickGridCell(event) ?? this.roadDragEnd ?? this.roadDragStart;
          const startPoint = this.roadDragStart;

          this.roadDragStart = null;
          this.roadDragEnd = null;
          this.controls.enabled = true;

          if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
          this.buildRoadDrag(startPoint, end);

          event.preventDefault();
          event.stopPropagation();
          return;
        }

        if (this.mountainRangeStart) {
          const end = this.pickGridCell(event) ?? this.mountainRangeEnd ?? this.mountainRangeStart;
          const startPoint = this.mountainRangeStart;

          this.mountainRangeStart = null;
          this.mountainRangeEnd = null;
          this.controls.enabled = true;

          if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
          this.buildMountainRange(startPoint, end);

          event.preventDefault();
          event.stopPropagation();
          return;
        }

        if (this.terrainStrokeActive) {
          this.terrainStrokeActive = false;
          this.controls.enabled = true;

          if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);

          if (this.terrainStrokeChanged && this.terrainStrokeSnapshot) {
            this.pushUndoSnapshot(this.terrainStrokeSnapshot);
            this.scheduleSave();
          }

          this.terrainStrokeSnapshot = null;
          this.lastTerrainBrushKey = '';

          event.preventDefault();
          event.stopPropagation();
          return;
        }

        if (!this.pointerStart) return;

        const movement = Math.hypot(
          event.clientX - this.pointerStart.x,
          event.clientY - this.pointerStart.y,
        );
        this.pointerStart = null;

        if (movement <= 6) {
          const previewCell = this.pickGridCell(event);
          this.handleBuildClick(event);
          if (event.pointerType === 'mouse') this.renderBuildPlacementPreview(previewCell, true, event.shiftKey);
          else this.clearBuildPlacementPreview();
        }
      },
      true,
    );

    canvas.addEventListener('pointerleave', () => {
      if (
        !this.wallDragStart &&
        !this.roadDragStart &&
        !this.mountainRangeStart &&
        !this.terrainStrokeActive &&
        !(this.selectedTool === 'towerBridge' && this.towerBridgeStart)
      ) {
        this.clearBuildPlacementPreview();
      }
    });

    canvas.addEventListener('pointercancel', (event) => {
      if (event.pointerType === 'touch') {
        consumeTouch(event);
        touches.cancel(event.pointerId);
      } else {
        this.cancelActiveTouchBuildGesture();
      }
    }, true);
    canvas.addEventListener('lostpointercapture', (event) => {
      // Normal pointer-up removes the pointer first; unexpected capture loss
      // cancels and rolls back the active stroke instead of committing it.
      if (event.pointerType === 'touch') touches.cancel(event.pointerId);
    });

    const cancelInterruptedTouchGesture = (): void => {
      const captured = touches.pointerIds;
      touches.interrupt();
      for (const pointerId of captured) {
        if (canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
      }
    };
    this.cancelWorldTouchInput = cancelInterruptedTouchGesture;
    window.addEventListener('blur', cancelInterruptedTouchGesture);
    window.addEventListener('pagehide', cancelInterruptedTouchGesture);
    document.addEventListener('pause', cancelInterruptedTouchGesture);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) cancelInterruptedTouchGesture();
    });
    // UI owns touches that start outside the canvas. Cancel any unfinished world
    // gesture before a panel/tool/load action changes the game underneath it.
    document.addEventListener('pointerdown', (event) => {
      if (event.target !== canvas) cancelInterruptedTouchGesture();
    }, true);
    if (Capacitor.isNativePlatform()) {
      void App.addListener('appStateChange', ({ isActive }) => {
        if (!isActive) cancelInterruptedTouchGesture();
      });
    }
  }

  private beginLongPress(event: PointerEvent, cell: GridPoint): void {
    const removable =
      Boolean(this.services.state.getCell(cell.x, cell.y)) ||
      Boolean(this.services.keepSystem.findAtCell(cell.x, cell.y));

    if (!removable) {
      this.cancelLongPress();
      return;
    }

    this.longPressCell = cell;
    this.longPressPointerId = event.pointerId;
    this.longPressStartedAt = performance.now();
    this.longPressTriggered = false;
    this.longPressStartScreen = { x: event.clientX, y: event.clientY };

    const indicator = document.getElementById('long-press-indicator');
    if (indicator) {
      indicator.hidden = false;
      indicator.style.left = `${event.clientX}px`;
      indicator.style.top = `${event.clientY}px`;
      indicator.style.background =
        'conic-gradient(#ff6c61 0deg, rgba(8,20,30,.72) 0deg)';
    }
  }

  private cancelLongPressOnMovement(event: PointerEvent): void {
    if (
      !this.longPressCell ||
      this.longPressPointerId !== event.pointerId ||
      !this.longPressStartScreen
    ) {
      return;
    }

    const movement = Math.hypot(
      event.clientX - this.longPressStartScreen.x,
      event.clientY - this.longPressStartScreen.y,
    );

    if (movement > 9) this.cancelLongPress();
  }

  private cancelLongPress(): void {
    this.longPressCell = null;
    this.longPressPointerId = null;
    this.longPressStartedAt = 0;
    this.longPressStartScreen = null;
    const indicator = document.getElementById('long-press-indicator');
    if (indicator) indicator.hidden = true;
  }

  private updateLongPress(time: number): void {
    if (!this.longPressCell || this.longPressTriggered) return;

    const progress = THREE.MathUtils.clamp(
      (time - this.longPressStartedAt) / 3000,
      0,
      1,
    );
    const indicator = document.getElementById('long-press-indicator');
    if (indicator) {
      indicator.style.background =
        `conic-gradient(#ff6c61 ${Math.round(progress * 360)}deg, rgba(8,20,30,.72) 0deg)`;
      indicator.setAttribute('aria-label', `Hold to remove ${Math.round(progress * 100)}%`);
    }

    if (progress < 1) return;

    const target = this.longPressCell;
    this.longPressTriggered = true;
    this.performLongPressRemoval(target);
    this.cancelLongPress();
  }

  private performLongPressRemoval(point: GridPoint): void {
    const keep = this.services.keepSystem.findAtCell(point.x, point.y);
    const cell = this.services.state.getCell(point.x, point.y);
    if (!keep && !cell) return;

    this.recordHistory();

    if (keep) {
      this.services.keepSystem.remove(keep.id);
      if (this.selectedKeepId === keep.id) this.selectedKeepId = null;
      audioEvents.emit({ action: 'play_sfx', assetId: 'building.destroyed' });
      this.setStatus('Long-press removal · Keep removed · Undo available');
    } else if (cell) {
      if (cell.kind === 'tower') this.removeTowerBridgesAt(point.x, point.y);
      this.services.state.removeCell(point.x, point.y);
      audioEvents.emit({ action: 'play_sfx', assetId: 'building.destroyed' });
      this.setStatus('Long-press removal · object removed · Undo available');
    }

    this.wallDragStart = null;
    this.wallDragEnd = null;
    this.roadDragStart = null;
    this.roadDragEnd = null;
    this.clearGroup(this.wallPreviewLayer);
    this.controls.enabled = true;
    this.selectedCell = point;
    this.finishBuild();
  }

  private pickGridCell(event: PointerEvent): GridPoint | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);

    const hit = this.raycaster.intersectObject(this.groundHit, false)[0];
    if (!hit) return null;

    const x = Math.floor(hit.point.x / TILE + SIZE / 2);
    const y = Math.floor(hit.point.z / TILE + SIZE / 2);
    if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return null;

    return { x, y };
  }

  private roadPath(start: GridPoint, end: GridPoint): GridPoint[] {
    const points: GridPoint[] = [{ ...start }];
    let x = start.x;
    let y = start.y;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const xFirst = Math.abs(dx) >= Math.abs(dy);

    const walkX = (): void => {
      const step = Math.sign(end.x - x);
      while (x !== end.x) {
        x += step;
        points.push({ x, y });
      }
    };

    const walkY = (): void => {
      const step = Math.sign(end.y - y);
      while (y !== end.y) {
        y += step;
        points.push({ x, y });
      }
    };

    if (xFirst) {
      walkX();
      walkY();
    } else {
      walkY();
      walkX();
    }

    return points.filter(
      (point) => point.x >= 0 && point.y >= 0 && point.x < SIZE && point.y < SIZE,
    );
  }

  private renderRoadPreview(path: GridPoint[]): void {
    this.clearGroup(this.wallPreviewLayer);
    const roadKind = this.selectedTool as RoadKind;
    const baseValid = (point: GridPoint): boolean => {
      const terrain = this.terrainAt(point.x, point.y);
      const current = this.services.state.getCell(point.x, point.y);
      if (this.services.keepSystem.findAtCell(point.x, point.y)) return false;
      if (!current && this.isStructureFootprintReserved(point.x, point.y)) return false;
      if (current && !this.isRoadFamily(current.kind)) return false;
      if (terrain === 'water' || terrain === 'mountain') return false;
      return true;
    };
    const costsConstruction = (point: GridPoint): boolean => {
      const current = this.services.state.getCell(point.x, point.y);
      return baseValid(point) && (!current || current.kind !== roadKind);
    };
    const costedTiles = path.filter(costsConstruction).length;
    const affordable = costedTiles === 0 || this.isConstructionAffordable(roadKind, costedTiles);
    const validMaterial = new THREE.MeshBasicMaterial({
      color: 0x66e5a3,
      transparent: true,
      opacity: 0.5,
      depthTest: false,
      depthWrite: false,
    });
    const invalidMaterial = new THREE.MeshBasicMaterial({
      color: 0xff625f,
      transparent: true,
      opacity: 0.62,
      depthTest: false,
      depthWrite: false,
    });

    for (const point of path) {
      const position = this.gridToWorld(point.x, point.y);
      const valid = baseValid(point) && (!costsConstruction(point) || affordable);
      const preview = new THREE.Mesh(
        new THREE.BoxGeometry(TILE * 0.72, 0.1, TILE * 0.72),
        valid ? validMaterial : invalidMaterial,
      );
      preview.position.set(
        position.x,
        this.viewMode === 'plan2d' ? 10.16 : 2.34 + this.terrainElevation(point.x, point.y),
        position.z,
      );
      preview.renderOrder = 90;
      preview.castShadow = false;
      this.wallPreviewLayer.add(preview);
    }
  }

  private buildRoadDrag(start: GridPoint, end: GridPoint): void {
    const roadKind = this.selectedTool as RoadKind;
    const path = this.roadPath(start, end);
    const costedTiles = path.filter((point) => {
      const terrain = this.terrainAt(point.x, point.y);
      const current = this.services.state.getCell(point.x, point.y);
      if (this.services.keepSystem.findAtCell(point.x, point.y)) return false;
      if (!current && this.isStructureFootprintReserved(point.x, point.y)) return false;
      if (current && !this.isRoadFamily(current.kind)) return false;
      if (terrain === 'water' || terrain === 'mountain') return false;
      return !current || current.kind !== roadKind;
    }).length;

    if (costedTiles > 0 && !this.ensureConstructionAffordable(roadKind, costedTiles)) {
      this.clearGroup(this.wallPreviewLayer);
      return;
    }

    const before = this.captureSnapshot();
    let changed = 0;

    for (const point of path) {
      const terrain = this.terrainAt(point.x, point.y);
      const current = this.services.state.getCell(point.x, point.y);

      if (this.services.keepSystem.findAtCell(point.x, point.y)) continue;
      if (!current && this.isStructureFootprintReserved(point.x, point.y)) continue;
      if (current && !this.isRoadFamily(current.kind)) continue;
      if (terrain === 'water' || terrain === 'mountain') {
        continue;
      }

      this.services.state.setCell(point.x, point.y, roadKind, 1);
      changed += 1;
    }

    this.clearGroup(this.wallPreviewLayer);
    this.selectedCell = path[path.length - 1] ?? end;

    if (changed > 0) {
      this.pushUndoSnapshot(before);
      if (costedTiles > 0) this.spendConstructionCost(roadKind, costedTiles);
      this.redraw();
      this.scheduleSave();
      this.setStatus(`Built ${changed} connected road tiles · preview confirmed`);
    } else {
      this.setStatus('No valid road tiles in that path');
    }
  }

  private shapeMountainFootprint(gx: number, gy: number, level: number): void {
    const radius = Math.min(3.2, 2.15 + level * 0.12);
    const peak = 0.95 + Math.min(level, 8) * 0.48;

    for (let oy = -3; oy <= 3; oy += 1) {
      for (let ox = -3; ox <= 3; ox += 1) {
        const x = gx + ox;
        const y = gy + oy;
        if (x < 1 || y < 1 || x >= SIZE - 1 || y >= SIZE - 1) continue;
        if (!this.canEditTerrainAt(x, y)) continue;

        const distance = Math.hypot(ox, oy);
        if (distance > radius) continue;

        const terrain = this.terrainAt(x, y);
        if (terrain === 'water' || terrain === 'river') continue;
        if (this.services.keepSystem.findAtCell(x, y)) continue;

        const existing = this.services.state.getCell(x, y);
        if (
          existing &&
          existing.kind !== 'mountain' &&
          existing.kind !== 'tree' &&
          existing.kind !== 'rock' &&
          existing.kind !== 'hut'
        ) {
          continue;
        }

        const falloff = THREE.MathUtils.clamp(1 - distance / (radius + 0.2), 0, 1);
        const noise =
          Math.sin((x * 0.71 + y * 0.39 + level) * 1.1) * 0.18 +
          Math.cos((y * 0.57 - x * 0.22) * 1.3) * 0.12;
        const target = Math.max(0.12, falloff * peak + noise);

        if (target > this.terrainElevation(x, y) + 0.05) {
          this.setAbsoluteElevation(x, y, target);
        }

        if (
          existing?.kind === 'tree' &&
          (target > 1.75 || distance < 0.95)
        ) {
          this.services.state.removeCell(x, y);
        }
      }
    }
  }

  private mountainRangePath(start: GridPoint, end: GridPoint): GridPoint[] {
    const base = WallSystem.createSnappedPath(start, end, SIZE);
    if (base.length <= 2) return base;

    const result: GridPoint[] = [];
    const seen = new Set<string>();

    for (let i = 0; i < base.length; i += 1) {
      const point = base[i];
      const previous = base[Math.max(0, i - 1)];
      const next = base[Math.min(base.length - 1, i + 1)];
      const dx = Math.sign(next.x - previous.x);
      const dy = Math.sign(next.y - previous.y);
      const px = -dy;
      const py = dx;

      const hash = Math.abs((i * 47 + start.x * 23 + start.y * 31 + end.x * 17 + end.y * 13) % 17);
      const jitter = hash === 3 || hash === 11 ? 1 : hash === 7 ? -1 : 0;
      const x = THREE.MathUtils.clamp(point.x + px * jitter, 1, SIZE - 2);
      const y = THREE.MathUtils.clamp(point.y + py * jitter, 1, SIZE - 2);
      const key = this.key(x, y);

      if (!seen.has(key)) {
        seen.add(key);
        result.push({ x, y });
      }
    }

    return result;
  }

  private renderMountainRangePreview(path: GridPoint[]): void {
    this.clearGroup(this.wallPreviewLayer);
    if (path.length === 0) return;

    const ridgeMaterial = new THREE.MeshStandardMaterial({
      color: 0xc8b5a1,
      emissive: 0x5b493e,
      emissiveIntensity: 0.22,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      flatShading: true,
    });
    const foothillMaterial = new THREE.MeshStandardMaterial({
      color: 0x7fa05b,
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
    });

    for (let i = 0; i < path.length; i += 1) {
      const point = path[i];
      const world = this.gridToWorld(point.x, point.y);
      const elevation = this.terrainElevation(point.x, point.y);
      const peak = new THREE.Mesh(
        new THREE.ConeGeometry(0.72 + (i % 3) * 0.08, 1.8 + (i % 4) * 0.25, 7),
        ridgeMaterial,
      );
      peak.position.set(world.x, 3.1 + elevation, world.z);
      peak.rotation.y = i * 0.41;
      this.wallPreviewLayer.add(peak);

      if (i % 2 === 0) {
        const halo = new THREE.Mesh(
          new THREE.CircleGeometry(TILE * 0.82, 14),
          foothillMaterial,
        );
        halo.rotation.x = -Math.PI / 2;
        halo.position.set(world.x, 2.31 + elevation, world.z);
        this.wallPreviewLayer.add(halo);
      }
    }
  }

  private buildMountainRange(start: GridPoint, end: GridPoint): void {
    const before = this.captureSnapshot();
    const changed = this.applyMountainRange(start, end, true);

    this.clearGroup(this.wallPreviewLayer);
    this.selectedCell = end;

    if (!changed) {
      this.setStatus('Mountain Range needs open land away from deep water and buildings');
      return;
    }

    this.pushUndoSnapshot(before);
    this.redraw();
    this.scheduleSave();
    this.setStatus('Mountain Range generated · ridge, peaks, slopes, valleys and foothills');
  }

  private applyMountainRange(
    start: GridPoint,
    end: GridPoint,
    replaceNaturalProps: boolean,
  ): boolean {
    const path = this.mountainRangePath(start, end);
    let changed = false;

    for (let i = 0; i < path.length; i += 1) {
      const ridge = path[i];
      const ridgeHash = Math.abs(
        (ridge.x * 97 + ridge.y * 151 + i * 43 + start.x * 17 + end.y * 29) % 997,
      );
      const peakPulse =
        0.65 +
        Math.sin((i / Math.max(1, path.length - 1)) * Math.PI) * 0.9 +
        (ridgeHash % 5) * 0.12;
      const influenceRadius = 2.25 + (ridgeHash % 3) * 0.28;

      for (let oy = -3; oy <= 3; oy += 1) {
        for (let ox = -3; ox <= 3; ox += 1) {
          const x = ridge.x + ox;
          const y = ridge.y + oy;
          if (x < 1 || y < 1 || x >= SIZE - 1 || y >= SIZE - 1) continue;
          if (!this.canEditTerrainAt(x, y)) continue;
  
          const distance = Math.hypot(ox, oy);
          if (distance > influenceRadius) continue;

          const terrain = this.terrainAt(x, y);
          if (terrain === 'water' || terrain === 'river') continue;
          if (this.services.keepSystem.findAtCell(x, y)) continue;

          const cell = this.services.state.getCell(x, y);
          const natural =
            !cell ||
            cell.kind === 'tree' ||
            cell.kind === 'rock' ||
            cell.kind === 'hut' ||
            cell.kind === 'mountain';

          if (!natural) continue;
          if (cell && !replaceNaturalProps && cell.kind !== 'mountain') continue;

          const falloff = THREE.MathUtils.clamp(
            1 - distance / (influenceRadius + 0.4),
            0,
            1,
          );
          const localNoise =
            Math.sin((x + i) * 0.83) * 0.28 +
            Math.cos((y - i) * 0.61) * 0.22;
          const valleyCut = (ridgeHash + ox * 13 + oy * 19) % 11 === 0 ? 0.55 : 0;
          const targetElevation = Math.max(
            0.18,
            falloff * (1.15 + peakPulse * 1.35 + localNoise) - valleyCut,
          );

          if (targetElevation > this.terrainElevation(x, y) + 0.08) {
            this.setAbsoluteElevation(x, y, targetElevation);
            changed = true;
          }

          if (distance <= 0.72) {
            if (cell && cell.kind !== 'mountain') this.services.state.removeCell(x, y);
            const level = THREE.MathUtils.clamp(
              2 + Math.round(peakPulse + (ridgeHash % 3)),
              2,
              6,
            );
            this.services.state.setCell(x, y, 'mountain', level);
            changed = true;
          } else if (distance <= 1.55) {
            if (cell && cell.kind !== 'mountain' && replaceNaturalProps) {
              this.services.state.removeCell(x, y);
            }
            const detailHash = Math.abs((x * 41 + y * 71 + i * 23) % 13);
            if (!this.services.state.getCell(x, y) && detailHash === 2) {
              this.services.state.setCell(x, y, 'rock', 1 + (ridgeHash % 2));
            } else if (
              !this.services.state.getCell(x, y) &&
              targetElevation < 1.55 &&
              (detailHash === 5 || detailHash === 9)
            ) {
              this.services.state.setCell(x, y, 'tree', 1 + (detailHash % 2));
            }
          } else if (
            !this.services.state.getCell(x, y) &&
            targetElevation < 1.1 &&
            (ridgeHash + x + y) % 17 === 0
          ) {
            this.services.state.setCell(x, y, 'tree', 1);
          }
        }
      }
    }

    return changed;
  }

  private wallPath(start: GridPoint, end: GridPoint): GridPoint[] {
    return WallSystem.createSnappedPath(start, end, SIZE);
  }

  private renderWallPreview(path: GridPoint[], decrease = false): void {
    this.clearGroup(this.wallPreviewLayer);
    if (path.length === 0) return;

    const wallKind = this.selectedTool as WallKind;
    const single = path.length === 1;
    const baseValid = (point: GridPoint): boolean => {
      const terrain = this.terrainAt(point.x, point.y);
      const cell = this.services.state.getCell(point.x, point.y);
      if (this.services.keepSystem.findAtCell(point.x, point.y)) return false;
      if (!cell && this.isStructureFootprintReserved(point.x, point.y)) return false;
      if (single && cell?.kind === wallKind) return true;
      if (cell?.kind === 'tower' || cell?.kind === 'gate') return true;
      if (cell && !WALL_KINDS.includes(cell.kind as WallKind)) return false;
      if (!cell && !this.canBuildFortificationOnTerrain(terrain)) return false;
      return true;
    };
    const costsConstruction = (point: GridPoint): boolean => {
      const cell = this.services.state.getCell(point.x, point.y);
      if (!baseValid(point)) return false;
      if (single && cell?.kind === wallKind) return (cell.damage ?? 0) > 0;
      if (cell?.kind === 'tower' || cell?.kind === 'gate') return false;
      return !cell || cell.kind !== wallKind;
    };
    const costedSegments = path.filter(costsConstruction).length;
    const affordable = costedSegments === 0 || this.isConstructionAffordable(wallKind, costedSegments);
    const validMaterial = new THREE.MeshBasicMaterial({
      color: 0x66e5a3,
      transparent: true,
      opacity: 0.58,
      depthTest: false,
      depthWrite: false,
    });
    const invalidMaterial = new THREE.MeshBasicMaterial({
      color: 0xff625f,
      transparent: true,
      opacity: 0.68,
      depthTest: false,
      depthWrite: false,
    });
    const validity = path.map((point) => baseValid(point) && (!costsConstruction(point) || affordable));
    const draftCells = new Map(this.services.state.entries().map((cell) => [this.key(cell.x, cell.y), { ...cell }]));
    path.forEach((point, index) => {
      if (!validity[index]) return;
      const key = this.key(point.x, point.y);
      const existing = draftCells.get(key);
      if (!existing) {
        draftCells.set(key, {
          x: point.x,
          y: point.y,
          kind: wallKind,
          level: 1,
          thickness: this.wallThickness,
          battlement: this.wallBattlement,
          walkway: this.wallWalkway,
        });
      } else if (single && existing.kind === wallKind) {
        const currentLevel = Math.max(1, Math.floor(existing.level ?? 1));
        existing.level = decrease
          ? Math.max(1, currentLevel - 1)
          : Math.min(MAX_WALL_LEVEL, currentLevel + 1);
        existing.damage = 0;
        existing.thickness = this.wallThickness;
        existing.battlement = this.wallBattlement;
        existing.walkway = this.wallWalkway;
      } else if (WALL_KINDS.includes(existing.kind as WallKind)) {
        existing.kind = wallKind;
        existing.thickness = this.wallThickness;
        existing.battlement = this.wallBattlement;
        existing.walkway = this.wallWalkway;
      }
    });
    for (let i = 1; i < path.length; i += 1) {
      if (!validity[i - 1] || !validity[i]) continue;
      const direction = WallSystem.directionFromDelta(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
      const a = draftCells.get(this.key(path[i - 1].x, path[i - 1].y));
      const b = draftCells.get(this.key(path[i].x, path[i].y));
      if (a && b) {
        a.wallLinks = WallSystem.addLink(a, direction);
        b.wallLinks = WallSystem.addLink(b, WallSystem.opposite(direction));
      }
    }
    const draftBlocks = new Map(this.castleBlockSystem.build(
      [...draftCells.values()],
      this.stoneStyle,
      (x, y) => this.terrainElevation(x, y),
    ).blocks.map((block) => [this.key(block.x, block.y), block]));
    const invalidSegments = validity.filter((valid) => !valid).length;
    const heightTarget = single && path[0]
      ? draftBlocks.get(this.key(path[0].x, path[0].y))?.level
      : undefined;
    const heightSuffix = heightTarget !== undefined &&
      this.services.state.getCell(path[0].x, path[0].y)?.kind === wallKind
      ? ` · target height L${heightTarget}`
      : '';
    this.wallPreviewStatus =
      `Wall preview · ${path.length} segment${path.length === 1 ? '' : 's'} · ` +
      `${costedSegments} new/replace · cost ${this.constructionCostPreviewLabel(wallKind, costedSegments)}` +
      `${invalidSegments > 0 ? ` · ${invalidSegments} invalid` : ''}${heightSuffix}`;

    for (let i = 0; i < path.length; i += 1) {
      const point = path[i];
      const position = this.gridToWorld(point.x, point.y);
      const y = this.viewMode === 'plan2d'
        ? 10.18
        : 2.38 + this.terrainElevation(point.x, point.y);
      const material = validity[i] ? validMaterial : invalidMaterial;
      const marker = new THREE.Mesh(
        new THREE.CylinderGeometry(0.28, 0.28, 0.18, 10),
        material,
      );
      marker.position.set(position.x, y, position.z);
      marker.renderOrder = 90;
      marker.castShadow = false;
      const draftBlock = draftBlocks.get(this.key(point.x, point.y));
      marker.userData.previewTopology = draftBlock?.topology;
      marker.userData.previewLevel = draftBlock?.level;
      this.wallPreviewLayer.add(marker);

      if (validity[i] && draftBlock && this.viewMode === 'world3d') {
        const bodyHeight = Math.max(0.42, draftBlock.topLocal - 2.58);
        const body = new THREE.Mesh(
          new THREE.BoxGeometry(TILE * 0.34, bodyHeight, TILE * 0.34),
          validMaterial,
        );
        body.position.set(
          position.x,
          2.58 + this.terrainElevation(point.x, point.y) + bodyHeight / 2,
          position.z,
        );
        body.renderOrder = 88;
        body.castShadow = false;
        body.userData.previewTopology = draftBlock.topology;
        body.userData.previewLevel = draftBlock.level;
        this.wallPreviewLayer.add(body);
      }

      if (validity[i]) {
        const links = draftBlock?.links ?? [];
        for (const direction of links) {
          const vector = WallSystem.vector(direction);
          const arm = new THREE.Mesh(
            new THREE.BoxGeometry(0.5, 0.2, TILE * Math.hypot(vector.x, vector.y) / 2 + 0.24),
            validMaterial,
          );
          arm.position.set(position.x + vector.x * TILE / 4, y, position.z + vector.y * TILE / 4);
          arm.rotation.y = WallSystem.worldAngle(direction);
          arm.renderOrder = 89;
          this.wallPreviewLayer.add(arm);
        }
      }

      if (i === 0) continue;

      const previous = path[i - 1];
      const previousWorld = this.gridToWorld(previous.x, previous.y);
      const currentWorld = position;
      const dx = currentWorld.x - previousWorld.x;
      const dz = currentWorld.z - previousWorld.z;
      const length = Math.hypot(dx, dz);
      const y1 = this.viewMode === 'plan2d'
        ? 10.18
        : 2.38 + this.terrainElevation(previous.x, previous.y);
      const y2 = y;
      const rise = y2 - y1;
      const beamLength = Math.sqrt(length * length + rise * rise);
      const beamMaterial = validity[i - 1] && validity[i] ? validMaterial : invalidMaterial;

      const beam = new THREE.Mesh(
        new THREE.BoxGeometry(0.46, 0.2, beamLength),
        beamMaterial,
      );
      beam.position.set(
        (previousWorld.x + currentWorld.x) / 2,
        (y1 + y2) / 2,
        (previousWorld.z + currentWorld.z) / 2,
      );
      beam.rotation.y = Math.atan2(dx, dz);
      beam.rotation.x = -Math.atan2(rise, length);
      beam.renderOrder = 89;
      beam.castShadow = false;
      this.wallPreviewLayer.add(beam);
    }
  }

  private linkWallPath(path: GridPoint[]): void {
    for (let i = 0; i < path.length - 1; i += 1) {
      const current = path[i];
      const next = path[i + 1];
      const direction = WallSystem.directionFromDelta(
        next.x - current.x,
        next.y - current.y,
      );
      const opposite = WallSystem.opposite(direction);
      const currentCell = this.services.state.getCell(current.x, current.y);
      const nextCell = this.services.state.getCell(next.x, next.y);

      if (currentCell && this.isWallFamily(currentCell.kind)) {
        this.services.state.updateCell(current.x, current.y, {
          wallLinks: WallSystem.addLink(currentCell, direction),
        });
      }

      if (nextCell && this.isWallFamily(nextCell.kind)) {
        this.services.state.updateCell(next.x, next.y, {
          wallLinks: WallSystem.addLink(nextCell, opposite),
        });
      }
    }
  }

  private buildWallDrag(start: GridPoint, end: GridPoint, decrease: boolean): void {
    const wallKind = this.selectedTool as WallKind;
    const path = this.wallPath(start, end);
    const single = path.length === 1;
    const costedSegments = path.filter((point) => {
      const terrain = this.terrainAt(point.x, point.y);
      const cell = this.services.state.getCell(point.x, point.y);
      if (this.services.keepSystem.findAtCell(point.x, point.y)) return false;
      if (!cell && this.isStructureFootprintReserved(point.x, point.y)) return false;
      if (single && cell?.kind === wallKind) return (cell.damage ?? 0) > 0;
      if (cell?.kind === 'tower' || cell?.kind === 'gate') return false;
      if (cell && !WALL_KINDS.includes(cell.kind as WallKind)) return false;
      if (!cell && !this.canBuildFortificationOnTerrain(terrain)) return false;
      return !cell || cell.kind !== wallKind;
    }).length;

    if (costedSegments > 0 && !this.ensureConstructionAffordable(wallKind, costedSegments)) {
      this.clearGroup(this.wallPreviewLayer);
      return;
    }

    const before = this.captureSnapshot();
    let changed = false;

    for (const point of path) {
      const terrain = this.terrainAt(point.x, point.y);
      const cell = this.services.state.getCell(point.x, point.y);

      if (this.services.keepSystem.findAtCell(point.x, point.y)) continue;
      if (!cell && this.isStructureFootprintReserved(point.x, point.y)) continue;

      if (single && cell?.kind === wallKind) {
        const nextLevel = decrease
          ? Math.max(1, (cell.level ?? 1) - 1)
          : Math.min(MAX_WALL_LEVEL, (cell.level ?? 1) + 1);

        this.services.state.updateCell(point.x, point.y, {
          level: nextLevel,
          damage: 0,
          thickness: this.wallThickness,
          battlement: this.wallBattlement,
          walkway: this.wallWalkway,
        });
        changed = true;
        continue;
      }

      if (cell?.kind === 'tower' || cell?.kind === 'gate') {
        changed = true;
        continue;
      }

      if (cell && !WALL_KINDS.includes(cell.kind as WallKind)) continue;
      if (!cell && !this.canBuildFortificationOnTerrain(terrain)) continue;

      this.services.state.setCell(point.x, point.y, wallKind, cell?.level ?? 1, {
        thickness: this.wallThickness,
        battlement: this.wallBattlement,
        walkway: this.wallWalkway,
        wallLinks: cell?.wallLinks,
      });
      changed = true;
    }

    if (changed) this.linkWallPath(path);

    this.selectedCell = path[path.length - 1] ?? end;
    this.clearGroup(this.wallPreviewLayer);

    if (changed) {
      this.pushUndoSnapshot(before);
      if (costedSegments > 0) this.spendConstructionCost(wallKind, costedSegments);
      this.redrawCastleNeighborhood(path);
      for (const point of path.slice(0, 24)) {
        if (!before.cells.some((cell) => cell.x === point.x && cell.y === point.y)) {
          this.startConstruction(`cell:${point.x},${point.y}`, 520);
        }
      }
      this.scheduleSave();
      this.setStatus(
        single
          ? 'Wall segment updated'
          : `Built ${path.length} snapped wall segments · 45° angles supported`,
      );
    }
  }

  private buildPlacementFootprint(tool: ToolKind, point: GridPoint): GridPoint[] {
    if (tool === 'market') {
      const cells: GridPoint[] = [];
      for (let y = point.y - 1; y <= point.y + 1; y += 1) {
        for (let x = point.x - 1; x <= point.x + 1; x += 1) cells.push({ x, y });
      }
      return cells;
    }

    if (tool === 'keep') {
      return this.services.keepSystem.footprint(this.keepDraftForPlacement(point.x, point.y));
    }

    return [{ ...point }];
  }

  private evaluateBuildPlacement(
    point: GridPoint,
    decrease = false,
  ): { valid: boolean; cells: GridPoint[]; reason?: string } | null {
    const tool = this.selectedTool;
    if (tool === null || this.battleSystem.isActive()) return null;
    if (tool === 'erase' || tool === 'mountainRange' || this.isTerrainTool(tool)) return null;

    const cells = this.buildPlacementFootprint(tool, point);
    const cell = this.services.state.getCell(point.x, point.y);
    const current = cell?.kind;
    const terrain = this.terrainAt(point.x, point.y);
    const keepAtPoint = this.services.keepSystem.findAtCell(point.x, point.y);
    const reserved = this.isStructureFootprintReserved(point.x, point.y);

    if (tool === 'towerBridge') {
      if (this.towerBridgeStart) return null;
      const valid = current === 'tower';
      return {
        valid,
        cells,
        reason: valid ? undefined : 'Tower Bridge must start from a tower',
      };
    }

    if (this.isWallTool(tool)) {
      const validCell =
        !keepAtPoint &&
        (!current
          ? !reserved && this.canBuildFortificationOnTerrain(terrain)
          : current === tool || WALL_KINDS.includes(current as WallKind) || current === 'tower' || current === 'gate');
      const needsCost = !current || (WALL_KINDS.includes(current as WallKind) && current !== tool);
      const affordable = !needsCost || this.isConstructionAffordable(tool);
      return {
        valid: validCell && affordable,
        cells,
        reason: !validCell ? 'Wall placement is blocked here' : !affordable ? 'Not enough construction resources' : undefined,
      };
    }

    if (this.isRoadTool(tool)) {
      const validCell =
        !keepAtPoint &&
        !reserved &&
        (!current || this.isRoadFamily(current)) &&
        terrain !== 'water' &&
        terrain !== 'mountain';
      const needsCost = !current || current !== tool;
      const affordable = !needsCost || this.isConstructionAffordable(tool);
      return {
        valid: validCell && affordable,
        cells,
        reason: !validCell ? 'Road placement is blocked here' : !affordable ? 'Not enough construction resources' : undefined,
      };
    }

    if (tool === 'keep') {
      const draft = this.keepDraftForPlacement(point.x, point.y);
      const validation = this.validateKeepDraft(draft);
      const costUnits = Math.max(1, Math.ceil((draft.width * draft.depth * draft.floors) / 6));
      const affordable = this.isConstructionAffordable('keep', costUnits);
      return {
        valid: validation.valid && affordable,
        cells,
        reason: validation.reason ?? (!affordable ? 'Not enough construction resources' : undefined),
      };
    }

    if (tool === 'river') {
      const removableNatural =
        current === 'tree' || current === 'rock' || current === 'hut' || current === 'mountain';
      const valid = this.canEditTerrainAt(point.x, point.y) && (!current || removableNatural);
      return { valid, cells, reason: valid ? undefined : 'River carving is blocked here' };
    }

    if (tool === 'land') {
      const valid = this.canEditTerrainAt(point.x, point.y) && !current;
      return { valid, cells, reason: valid ? undefined : 'Land fill is blocked here' };
    }

    if (this.isHarborTool(tool)) {
      const valid =
        !current &&
        !keepAtPoint &&
        !reserved &&
        Boolean(this.maritimeSystem.canPlace(tool, point.x, point.y)) &&
        this.isConstructionAffordable('harbor');
      return { valid, cells, reason: valid ? undefined : 'Harbor needs a clear coastal tile and sufficient resources' };
    }

    if (tool === 'moat') {
      const valid =
        !current &&
        !keepAtPoint &&
        !reserved &&
        !this.moatTasks.has(this.key(point.x, point.y)) &&
        (terrain === 'plains' || terrain === 'shore');
      return { valid, cells, reason: valid ? undefined : 'Moat placement is blocked here' };
    }

    if (tool === 'mountain') {
      const valid =
        this.canEditTerrainAt(point.x, point.y) &&
        (current === 'mountain' || (!current && (terrain === 'plains' || terrain === 'shore' || terrain === 'forest')));
      return { valid, cells, reason: valid ? undefined : 'Mountain placement is blocked here' };
    }

    if (tool === 'mine') {
      const valid =
        !keepAtPoint &&
        !reserved &&
        (current === 'mountain' || (!current && terrain === 'mountain')) &&
        this.isConstructionAffordable('mine');
      return { valid, cells, reason: valid ? undefined : 'Mine requires a mountain and sufficient resources' };
    }

    if (tool === 'appleOrchard') {
      const existingCanChange = current === 'appleOrchard' && (cell?.level ?? 1) < 3;
      const newCanBuild =
        !current &&
        !keepAtPoint &&
        !reserved &&
        terrain === 'plains' &&
        this.isConstructionAffordable('appleOrchard');
      return {
        valid: existingCanChange || newCanBuild,
        cells,
        reason: existingCanChange || newCanBuild ? undefined : 'Apple Orchard placement is blocked here',
      };
    }

    if (tool === 'tree') {
      const valid =
        !current &&
        !keepAtPoint &&
        !reserved &&
        (terrain === 'plains' || terrain === 'shore' || terrain === 'forest');
      return { valid, cells, reason: valid ? undefined : 'Tree placement is blocked here' };
    }

    if (tool === 'tower') {
      const currentLevel = current === 'tower' ? Math.floor(cell?.level ?? 1) : 0;
      const towerCanChange = current === 'tower' &&
        (decrease ? currentLevel > 1 : currentLevel < FORTIFICATION_MAX_LEVEL);
      const validCell =
        !keepAtPoint &&
        (current === 'tower'
          ? towerCanChange
          : current
            ? this.isWallFamily(current)
            : !reserved && this.canBuildFortificationOnTerrain(terrain));
      const needsCost = current !== 'tower';
      const affordable = !needsCost || this.isConstructionAffordable('tower');
      return {
        valid: validCell && affordable,
        cells,
        reason: !validCell ? 'Tower placement is blocked here' : !affordable ? 'Not enough construction resources' : undefined,
      };
    }

    const selectedTile = tool as TileKind;
    if (!this.isBuildingAvailable(selectedTile)) {
      return { valid: false, cells, reason: 'Building is unavailable in this game mode' };
    }

    if (selectedTile === 'cowBarn') {
      const valid =
        !current &&
        !keepAtPoint &&
        !reserved &&
        terrain === 'plains' &&
        this.isConstructionAffordable('cowBarn');
      return { valid, cells, reason: valid ? undefined : 'Cow Barn requires clear plains and sufficient resources' };
    }

    if (selectedTile === 'market') {
      const valid =
        !current &&
        !keepAtPoint &&
        this.canBuildMarketAt(point.x, point.y) &&
        this.isConstructionAffordable('market');
      return { valid, cells, reason: valid ? undefined : 'Market needs a clear 3×3 land area and sufficient resources' };
    }

    if (current) {
      const gateReplacement = selectedTile === 'gate' && this.isWallFamily(current);
      const affordable = gateReplacement && this.isConstructionAffordable(selectedTile);
      return {
        valid: Boolean(gateReplacement && affordable),
        cells,
        reason: gateReplacement && !affordable ? 'Not enough construction resources' : 'Tile is already occupied',
      };
    }

    const valid =
      !keepAtPoint &&
      !reserved &&
      this.canBuildOnTerrain(tool, terrain) &&
      this.isConstructionAffordable(selectedTile);
    return {
      valid,
      cells,
      reason: valid ? undefined : 'Placement is blocked by terrain, occupancy, footprint, or resources',
    };
  }

  private previewCastlePlacementBlock(point: GridPoint): CastleBlockState | null {
    const tool = this.selectedTool;
    if (tool !== 'gate' && tool !== 'tower') return null;

    const cells = this.services.state.entries().map((cell) => ({
      ...cell,
      wallLinks: cell.wallLinks ? [...cell.wallLinks] : undefined,
    }));
    const byKey = new Map(cells.map((cell) => [this.key(cell.x, cell.y), cell]));
    const key = this.key(point.x, point.y);
    const existing = byKey.get(key);

    if (tool === 'tower') {
      const level = Math.max(1, Math.min(FORTIFICATION_MAX_LEVEL, Math.floor(existing?.level ?? 1)));
      const towerStyle = this.towerStyleForLevel(level, point.x, point.y);
      byKey.set(key, {
        ...(existing ?? { x: point.x, y: point.y, kind: 'tower' as const }),
        x: point.x,
        y: point.y,
        kind: 'tower',
        level,
        towerShape: towerStyle.shape,
        towerTop: towerStyle.top,
        wallLinks: existing?.wallLinks,
      });
    } else {
      const level = Math.max(
        1,
        Math.min(FORTIFICATION_MAX_LEVEL, Math.floor(existing?.level ?? 1)),
      );
      byKey.set(key, {
        ...(existing ?? { x: point.x, y: point.y, kind: 'gate' as const }),
        x: point.x,
        y: point.y,
        kind: 'gate',
        level,
        wallLinks: existing?.wallLinks,
        rotationMode: 'auto',
      });
    }

    return this.castleBlockSystem.build(
      [...byKey.values()],
      this.stoneStyle,
      (x, y) => this.terrainElevation(x, y),
    ).blocks.find((block) => block.x === point.x && block.y === point.y) ?? null;
  }

  private clearBuildPlacementPreview(): void {
    this.buildPreviewKey = '';
    this.clearGroup(this.wallPreviewLayer);
  }

  private renderBuildPlacementPreview(
    point: GridPoint | null,
    force = false,
    decrease = false,
  ): void {
    if (!point) {
      this.clearBuildPlacementPreview();
      return;
    }

    const preview = this.evaluateBuildPlacement(point, decrease);
    if (!preview) {
      if (
        !this.wallDragStart &&
        !this.roadDragStart &&
        !this.mountainRangeStart &&
        !(this.selectedTool === 'towerBridge' && this.towerBridgeStart)
      ) {
        this.clearBuildPlacementPreview();
      }
      return;
    }

    const castlePreview = preview.valid ? this.previewCastlePlacementBlock(point) : null;
    const key =
      `${this.selectedTool}:${point.x},${point.y}:${preview.valid}:${preview.cells.map((cell) => `${cell.x},${cell.y}`).join(';')}:` +
      `${this.keepWidth}x${this.keepDepth}x${this.keepFloors}:${this.keepRotation}:${this.viewMode}:${decrease}:` +
      `${castlePreview?.topology ?? ''}:${castlePreview?.level ?? ''}:${castlePreview?.orientation ?? ''}`;
    if (!force && key === this.buildPreviewKey) return;
    this.buildPreviewKey = key;
    this.clearGroup(this.wallPreviewLayer);

    const color = preview.valid ? 0x66e5a3 : 0xff625f;
    const fillMaterial = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: preview.valid ? 0.32 : 0.4,
      depthTest: false,
      depthWrite: false,
    });
    const edgeMaterial = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.96,
      depthTest: false,
      depthWrite: false,
    });
    const anchorMaterial = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.98,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    if (!preview.valid && preview.reason) {
      this.setStatus(`Invalid placement · ${preview.reason}`);
    } else if (castlePreview) {
      const label = castlePreview.kind === 'gate' ? 'Gate' : 'Tower';
      const attachment = castlePreview.attachment ? ` · ${castlePreview.attachment}` : '';
      this.setStatus(
        `${label} preview · ${castlePreview.topology}${attachment} · height L${castlePreview.level} · tap/release to confirm`,
      );
    }

    for (const footprintCell of preview.cells) {
      if (
        footprintCell.x < 0 || footprintCell.y < 0 ||
        footprintCell.x >= SIZE || footprintCell.y >= SIZE
      ) continue;

      const world = this.gridToWorld(footprintCell.x, footprintCell.y);
      const surfaceY = this.viewMode === 'plan2d'
        ? 10.14
        : 2.34 + this.terrainElevation(footprintCell.x, footprintCell.y);
      const geometry = new THREE.BoxGeometry(TILE * 0.88, 0.07, TILE * 0.88);
      const tile = new THREE.Mesh(geometry, fillMaterial);
      tile.position.set(world.x, surfaceY, world.z);
      tile.renderOrder = 90;
      tile.castShadow = false;
      tile.receiveShadow = false;
      this.wallPreviewLayer.add(tile);

      const outline = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), edgeMaterial);
      outline.position.copy(tile.position);
      outline.renderOrder = 91;
      this.wallPreviewLayer.add(outline);
    }

    if (castlePreview && this.viewMode === 'world3d') {
      const world = this.gridToWorld(point.x, point.y);
      const terrainY = this.terrainElevation(point.x, point.y);
      const bodyHeight = Math.max(0.5, castlePreview.topLocal - 2.58);
      const isGate = castlePreview.kind === 'gate';
      const horizontalLinks =
        Number(castlePreview.links.includes('E')) + Number(castlePreview.links.includes('W'));
      const verticalLinks =
        Number(castlePreview.links.includes('N')) + Number(castlePreview.links.includes('S'));
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(
          TILE * (isGate ? 0.76 : 0.62),
          bodyHeight,
          TILE * (isGate ? 0.38 : 0.62),
        ),
        fillMaterial,
      );
      body.position.set(world.x, 2.58 + terrainY + bodyHeight / 2, world.z);
      body.rotation.y = isGate
        ? (verticalLinks > horizontalLinks ? Math.PI / 2 : 0)
        : THREE.MathUtils.degToRad(castlePreview.orientation);
      body.renderOrder = 89;
      body.castShadow = false;
      body.userData.previewTopology = castlePreview.topology;
      body.userData.previewLevel = castlePreview.level;
      body.userData.previewAttachment = castlePreview.attachment;
      this.wallPreviewLayer.add(body);

      const connectionY = 2.86 + terrainY;
      for (const direction of castlePreview.links) {
        const vector = WallSystem.vector(direction);
        const arm = new THREE.Mesh(
          new THREE.BoxGeometry(0.42, 0.16, TILE * 0.54),
          fillMaterial,
        );
        arm.position.set(
          world.x + vector.x * TILE * 0.27,
          connectionY,
          world.z + vector.y * TILE * 0.27,
        );
        arm.rotation.y = WallSystem.worldAngle(direction);
        arm.renderOrder = 90;
        arm.castShadow = false;
        this.wallPreviewLayer.add(arm);
      }
    }

    const anchorWorld = this.gridToWorld(point.x, point.y);
    const anchorY = this.viewMode === 'plan2d'
      ? 10.22
      : 2.44 + this.terrainElevation(point.x, point.y);
    const anchor = new THREE.Mesh(
      new THREE.RingGeometry(TILE * 0.16, TILE * 0.28, 4),
      anchorMaterial,
    );
    anchor.rotation.x = -Math.PI / 2;
    anchor.rotation.z = Math.PI / 4;
    anchor.position.set(anchorWorld.x, anchorY, anchorWorld.z);
    anchor.renderOrder = 92;
    this.wallPreviewLayer.add(anchor);
  }

  private canBuildFortificationOnTerrain(terrain: TerrainKind): boolean {
    return terrain === 'plains' || terrain === 'shore' || terrain === 'forest' || terrain === 'mountain';
  }

  private handleBuildClick(event: PointerEvent): void {
    const point = this.pickGridCell(event);
    if (!point) return;

    const gx = point.x;
    const gy = point.y;
    this.selectedCell = point;
    this.selectedTowerBridgeId = null;
    this.syncSelectedGateButton();

    const cell = this.services.state.getCell(gx, gy);
    const current = cell?.kind;
    this.syncArmyCampUpgradeUI();
    const terrain = this.terrainAt(gx, gy);
    const overrideKey = this.key(gx, gy);
    const keepAtPoint = this.services.keepSystem.findAtCell(gx, gy);

    if (this.selectedTool === null) {
      if (keepAtPoint) {
        this.selectKeep(keepAtPoint);
      } else {
        this.selectedKeepId = null;
        this.setStatus(current ? `Selected: ${current}` : 'Inspect mode · click a structure');
      }
      return;
    }

    if (this.selectedTool === 'erase') {
      if (keepAtPoint) {
        this.recordHistory();
        this.services.keepSystem.remove(keepAtPoint.id);
        if (this.selectedKeepId === keepAtPoint.id) this.selectedKeepId = null;
        this.finishBuild();
        audioEvents.emit({ action: 'play_sfx', assetId: 'building.destroyed' });
    this.setStatus('Keep removed');
        return;
      }
      if (current) {
        this.recordHistory();
        if (current === 'tower') this.removeTowerBridgesAt(gx, gy);
        this.services.state.removeCell(gx, gy);
        if (WALL_KINDS.includes(current as WallKind)) {
          this.buildPreviewKey = '';
          this.redrawCastleNeighborhood([point]);
          this.scheduleSave();
        } else this.finishBuild();
        return;
      }

      if (this.terrainOverrides.has(overrideKey)) {
        if (!this.canEditTerrainAt(gx, gy)) {
          this.setStatus('Terrain is protected by a structure footprint');
          return;
        }
        this.recordHistory();
        this.terrainOverrides.delete(overrideKey);
        this.normalizeRiverElevationAt(gx, gy);
        this.finishBuild();
      }
      return;
    }

    if (this.selectedTool === 'keep') {
      this.placeKeep(gx, gy);
      return;
    }

    if (this.selectedTool === 'towerBridge') {
      this.handleTowerBridgeClick(point);
      return;
    }

    if (keepAtPoint) {
      this.selectKeep(keepAtPoint);
      return;
    }

    this.selectedKeepId = null;

    if (
      BUILDING_KINDS.includes(this.selectedTool as TileKind) &&
      !current &&
      this.isStructureFootprintReserved(gx, gy)
    ) {
      audioEvents.emit({ action: 'play_sfx', assetId: 'building.invalid' });
      this.setStatus('Placement blocked by an existing structure footprint');
      return;
    }

    if (this.selectedTool === 'river' || this.selectedTool === 'land') {
      if (this.moatTasks.has(overrideKey)) return;
      if (!this.canEditTerrainAt(gx, gy)) {
        this.setStatus('Terrain is protected by a structure footprint');
        return;
      }

      if (this.selectedTool === 'river') {
        const removableNatural =
          current === 'tree' ||
          current === 'rock' ||
          current === 'hut' ||
          current === 'mountain';
        if (current && !removableNatural) {
          this.setStatus('Remove the structure before carving river water here');
          return;
        }

        this.recordHistory();
        if (removableNatural) this.services.state.removeCell(gx, gy);

        // Manual river carving must always produce visible water. A previous
        // A previous lowered elevation override can push the river mesh below the
        // island grass surface, making a valid river tile look dry.
        this.elevationOverrides.delete(overrideKey);
        this.terrainOverrides.set(overrideKey, 'river');

        this.finishBuild();
        this.setStatus('River water created · no source connection required');
        return;
      }

      if (current) return;
      this.recordHistory();
      this.terrainOverrides.set(overrideKey, 'plains');
      this.finishBuild();
      return;
    }

    if (this.isHarborTool(this.selectedTool)) {
      if (current || keepAtPoint) {
        this.setStatus('Harbor structures need a clear coastal land tile');
        return;
      }

      const direction = this.maritimeSystem.canPlace(this.selectedTool, gx, gy);
      if (!direction) {
        audioEvents.emit({ action: 'play_sfx', assetId: 'building.invalid' });
        this.setStatus('Harbor placement requires a clear coastal land tile next to ocean water');
        return;
      }

      if (!this.ensureConstructionAffordable('harbor')) return;
      this.recordHistory();
      this.services.state.setCell(gx, gy, 'harbor', 1, {
        rotation: direction.rotation,
        shipKind: this.maritimeSystem.defaultShipForLevel(1),
      });
      this.spendConstructionCost('harbor');
      this.finishBuild();
      this.setStatus('Landing Dock placed · upgrade it from Build Settings');
      return;
    }

    if (this.selectedTool === 'moat') {
      if (current || this.moatTasks.has(overrideKey)) return;
      if (terrain !== 'plains' && terrain !== 'shore') return;
      this.moatTasks.set(overrideKey, { x: gx, y: gy, progressMs: 0 });
      this.setStatus('Workers assigned to dig moat');
      this.redraw();
      return;
    }

    if (this.selectedTool === 'mountain') {
      if (!this.canEditTerrainAt(gx, gy)) {
        this.setStatus('Terrain is protected by a structure footprint');
        return;
      }

      if (current === 'mountain') {
        this.recordHistory();
        const nextLevel = (cell?.level ?? 1) + 1;
        this.services.state.setLevel(gx, gy, nextLevel);
        this.shapeMountainFootprint(gx, gy, nextLevel);
        this.finishBuild();
        return;
      }

      if (!current && (terrain === 'plains' || terrain === 'shore' || terrain === 'forest')) {
        this.recordHistory();
        this.services.state.setCell(gx, gy, 'mountain', 1);
        this.shapeMountainFootprint(gx, gy, 1);
        this.finishBuild();
      }
      return;
    }

    if (this.selectedTool === 'mine') {
      if (current === 'mountain') {
        if (!this.ensureConstructionAffordable('mine')) return;
        this.recordHistory();
        this.services.state.setCell(gx, gy, 'mine', 1);
        this.spendConstructionCost('mine');
        this.finishBuild();
        return;
      }

      if (!current && terrain === 'mountain') {
        if (!this.ensureConstructionAffordable('mine')) return;
        this.recordHistory();
        this.services.state.setCell(gx, gy, 'mine', 1);
        this.spendConstructionCost('mine');
        this.finishBuild();
      }
      return;
    }

    if (this.selectedTool === 'appleOrchard') {
      if (current === 'appleOrchard') {
        const nextSize = event.shiftKey
          ? Math.max(1, (cell?.level ?? 1) - 1)
          : Math.min(4, (cell?.level ?? 1) + 1);
        if (nextSize === (cell?.level ?? 1)) {
          audioEvents.emit({ action: 'play_sfx', assetId: 'building.invalid' });
          this.setStatus(event.shiftKey ? 'Apple Orchard is already at Level 1' : 'Apple Orchard is already at Level 4 · Estate Orchard');
          return;
        }
        this.recordHistory();
        this.services.state.setCell(gx, gy, 'appleOrchard', nextSize);
        this.finishBuild();
        this.setStatus(`Apple Orchard visual level: ${nextSize}`);
        return;
      }
      if (!current && terrain === 'plains') {
        if (!this.ensureConstructionAffordable('appleOrchard')) return;
        this.recordHistory();
        const size = 1 + ((gx * 7 + gy * 11) % 4);
        this.services.state.setCell(gx, gy, 'appleOrchard', size);
        this.spendConstructionCost('appleOrchard');
        this.finishBuild();
        this.setStatus(`Apple Orchard placed · size ${size}`);
      }
      return;
    }

    if (this.selectedTool === 'tree') {
      if (!current && (terrain === 'plains' || terrain === 'shore' || terrain === 'forest')) {
        this.recordHistory();
        this.services.state.setCell(gx, gy, 'tree', 1 + ((gx + gy) % 3));
        this.finishBuild();
      }
      return;
    }

    if (this.selectedTool === 'tower') {
      if (current === 'tower') {
        const currentLevel = Math.max(1, Math.min(FORTIFICATION_MAX_LEVEL, Math.floor(cell?.level ?? 1)));
        this.selectedKeepId = null;
        this.syncArmyCampUpgradeUI();
        this.setStatus(`Tower selected · Level ${currentLevel} · use Upgrade below`);
        return;
      }

      if (current && !this.isWallFamily(current)) return;
      if (!current && !this.canBuildFortificationOnTerrain(terrain)) return;

      if (!this.ensureConstructionAffordable('tower')) return;
      this.recordHistory();
      const level = Math.max(1, Math.min(FORTIFICATION_MAX_LEVEL, Math.floor(cell?.level ?? 1)));
      const towerStyle = this.towerStyleForLevel(level, gx, gy);
      this.services.state.setCell(gx, gy, 'tower', level, {
        towerShape: towerStyle.shape,
        towerTop: towerStyle.top,
        wallLinks: cell?.wallLinks,
      });
      this.spendConstructionCost('tower');
      this.finishBuild();
      this.setStatus('Tower built · appearance will evolve automatically when upgraded');
      return;
    }

    const selectedTile = this.selectedTool as TileKind;
    if (selectedTile === 'cowBarn') {
      if (current) {
        audioEvents.emit({ action: 'play_sfx', assetId: 'building.invalid' });
        this.setStatus('Cow Barn requires an empty tile');
        return;
      }
      if (terrain !== 'plains') {
        audioEvents.emit({ action: 'play_sfx', assetId: 'building.invalid' });
        this.setStatus('Cow Barn requires open plains');
        return;
      }
      if (!this.ensureConstructionAffordable('cowBarn')) return;
      this.recordHistory();
      this.services.state.setCell(gx, gy, 'cowBarn', 1);
      this.spendConstructionCost('cowBarn');
      this.finishBuild();
      this.setStatus('Cow Barn placed · Level 1 livestock yard active');
      return;
    }
    if (!this.isBuildingAvailable(selectedTile)) {
      audioEvents.emit({ action: 'play_sfx', assetId: 'building.invalid' });
      this.setStatus('This building is unavailable');
      return;
    }
    const selectedFortification = selectedTile === 'gate';
    const currentFortification = current ? this.isWallFamily(current) : false;

    if (selectedTile === 'market') {
      if (current || keepAtPoint) return;
      if (!this.canBuildMarketAt(gx, gy)) {
        audioEvents.emit({ action: 'play_sfx', assetId: 'building.invalid' });
        this.setStatus('Market needs a clear 3×3 land area');
        return;
      }
      if (!this.ensureConstructionAffordable('market')) return;
      this.recordHistory();
      this.services.state.setCell(gx, gy, 'market', 1);
      this.spendConstructionCost('market');
      this.finishBuild();
      return;
    }

    if (current) {
      if (selectedFortification && currentFortification) {
        if (!this.ensureConstructionAffordable(selectedTile)) return;
        this.recordHistory();
        const inheritedLevel = selectedTile === 'gate'
          ? Math.max(1, Math.min(FORTIFICATION_MAX_LEVEL, Math.floor(cell?.level ?? 1)))
          : cell?.level ?? 1;
        this.services.state.setCell(gx, gy, selectedTile, inheritedLevel, {
          wallLinks: cell?.wallLinks,
          rotation: cell?.rotation,
          rotationMode: 'auto',
        });
        this.spendConstructionCost(selectedTile);
        this.finishBuild();
      }
      return;
    }

    if (!this.canBuildOnTerrain(this.selectedTool, terrain)) return;
    if (!this.ensureConstructionAffordable(selectedTile)) return;
    this.recordHistory();
    if (selectedTile === 'gate') {
      this.services.state.setCell(gx, gy, selectedTile, 1, { rotationMode: 'auto' });
    } else {
      this.services.state.setCell(gx, gy, selectedTile, 1);
    }
    this.spendConstructionCost(selectedTile);
    this.finishBuild();
  }

  private canBuildMarketAt(gx: number, gy: number): boolean {
    const radius = 1;
    for (let y = gy - radius; y <= gy + radius; y += 1) {
      for (let x = gx - radius; x <= gx + radius; x += 1) {
        if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return false;
        if (
          this.services.state.getCell(x, y) ||
          this.services.keepSystem.findAtCell(x, y) ||
          this.isStructureFootprintReserved(x, y)
        ) return false;
        const terrain = this.terrainAt(x, y);
        if (terrain === 'water' || terrain === 'river' || terrain === 'mountain' || terrain === 'forest') return false;
      }
    }
    return true;
  }

  private canBuildOnTerrain(tool: ToolKind, terrain: TerrainKind): boolean {
    if (tool === 'gate' || tool === 'tower') return this.canBuildFortificationOnTerrain(terrain);
    if (terrain === 'water' || terrain === 'river') return false;
    if (terrain === 'mountain') return tool === 'mine';
    if (terrain === 'forest') return tool === 'tree';
    if (tool === 'farm' || tool === 'cowBarn' || tool === 'appleOrchard') return terrain === 'plains';
    if (tool === 'windmill') return terrain === 'plains' || terrain === 'shore';
    return terrain === 'plains' || terrain === 'shore';
  }

  private finishBuild(): void {
    const point = this.selectedCell;
    const previous = point && this.undoStack.at(-1)?.cells.find((cell) => cell.x === point.x && cell.y === point.y);
    const current = point && this.services.state.getCell(point.x, point.y);
    const placementChanged = Boolean(point && current && (!previous || previous.kind !== current.kind));
    const newlyPlaced = point && current && CONSTRUCTION_VISUAL_KINDS.has(current.kind) && placementChanged;
    this.buildPreviewKey = '';
    if (placementChanged) audioEvents.emit({ action: 'play_sfx', assetId: 'building.place' });
    this.redraw();
    if (newlyPlaced && point) this.startConstruction(`cell:${point.x},${point.y}`,
      current.kind === 'gate' || current.kind === 'tower' || current.kind === 'harbor' ? 1150 : 800);
    this.scheduleSave();
  }

  private reconcileSettlementAgents(
    cells: ReturnType<GameState['entries']>,
  ): void {
    const desired = this.buildDesiredSettlementAgents(cells);
    const existingByKey = new Map(
      this.settlementAgents.map((agent) => [agent.key, agent] as const),
    );
    const currentHomes = new Set(
      cells
        .filter((cell) => this.isSettlementHomeKind(cell.kind))
        .map((cell) => this.key(cell.x, cell.y)),
    );
    const nextNavigationSignature = this.settlementTraversabilitySignature();
    const navigationChanged =
      this.settlementNavigationSignature !== '' &&
      this.settlementNavigationSignature !== nextNavigationSignature;

    for (const spec of desired) {
      const existing = existingByKey.get(spec.key);
      if (existing) {
        if (existing.role !== spec.role) {
          this.removeSettlementAgent(existing);
          existingByKey.delete(spec.key);
          this.spawnSettlementAgentFromSpec(spec);
          continue;
        }
        this.updateSettlementAssignment(existing, spec, currentHomes);
        existingByKey.delete(spec.key);
        continue;
      }

      this.spawnSettlementAgentFromSpec(spec);
    }

    for (const removed of existingByKey.values()) {
      this.removeSettlementAgent(removed);
    }

    this.settlementNavigationSignature = nextNavigationSignature;
    if (navigationChanged) this.invalidateSettlementPaths();

    this.settlementLayer.visible =
      this.viewMode === 'world3d' && !this.battleSystem.isActive();
  }

  private buildDesiredSettlementAgents(
    cells: ReturnType<GameState['entries']>,
  ): SettlementAgentSpec[] {
    this.services.populationSystem.reconcile(cells);
    return this.services.populationSystem
      .visibleCivilianRoster(40, 40)
      .map((assignment) => ({
        key: assignment.key,
        role: assignment.role,
        home: { ...assignment.home },
        work: assignment.work ? { ...assignment.work } : undefined,
        seed: assignment.seed,
      }));
  }

  private updateSettlementAssignment(
    agent: SettlementAgent,
    spec: SettlementAgentSpec,
    _currentHomes: Set<string>,
  ): void {
    let assignmentChanged = false;

    if (agent.home.x !== spec.home.x || agent.home.y !== spec.home.y) {
      agent.home = { ...spec.home };
      assignmentChanged = true;
    }

    const currentWorkKey = agent.work ? this.key(agent.work.x, agent.work.y) : '';
    const nextWorkKey = spec.work ? this.key(spec.work.x, spec.work.y) : '';
    if (currentWorkKey !== nextWorkKey) {
      agent.work = spec.work ? { ...spec.work } : undefined;
      assignmentChanged = true;
    }

    if (!assignmentChanged || agent.waitMs > 0) return;

    if (agent.role !== 'citizen' && agent.work) {
      const destination = agent.phase === 'work' ? agent.work : agent.home;
      this.setSettlementTarget(agent, destination);
      return;
    }

    this.setSettlementTarget(agent, agent.home);
  }

  private spawnSettlementAgentFromSpec(spec: SettlementAgentSpec): void {
    const id = this.nextSettlementAgentId++;
    const view = this.createSettlementPerson(spec.role, spec.seed);
    const world = this.gridToWorld(spec.home.x, spec.home.y);
    const offsetX = ((id % 3) - 1) * 0.42;
    const offsetZ = ((Math.floor(id / 3) % 3) - 1) * 0.38;
    const y = 2.24 + this.terrainElevation(spec.home.x, spec.home.y);
    const position = new THREE.Vector3(
      world.x + offsetX,
      y,
      world.z + offsetZ,
    );
    view.position.copy(position);
    this.settlementLayer.add(view);

    this.settlementAgents.push({
      key: spec.key,
      id,
      role: spec.role,
      view,
      home: { ...spec.home },
      work: spec.work ? { ...spec.work } : undefined,
      position: position.clone(),
      target: position.clone(),
      targetGrid: { ...spec.home },
      destinationGrid: { ...spec.home },
      waitMs: 350 + Math.abs(spec.seed % 900),
      phase: 'home',
      speed:
        spec.role === 'farmer'
          ? 1.55
          : 1.25 + (Math.abs(spec.seed) % 4) * 0.08,
      anim: Math.abs(spec.seed % 1000) * 0.013,
      path: [],
    });
  }

  private removeSettlementAgent(agent: SettlementAgent): void {
    this.settlementLayer.remove(agent.view);
    agent.view.traverse((object) => {
      if (object instanceof THREE.Mesh) object.geometry.dispose();
    });

    const index = this.settlementAgents.indexOf(agent);
    if (index >= 0) this.settlementAgents.splice(index, 1);
  }

  private clearSettlementAgents(): void {
    for (const agent of [...this.settlementAgents]) {
      this.removeSettlementAgent(agent);
    }
    this.nextSettlementAgentId = 1;
    this.settlementNavigationSignature = '';
  }

  private invalidateSettlementPaths(): void {
    for (const agent of this.settlementAgents) {
      agent.path.length = 0;
      if (agent.waitMs > 0) continue;
      this.setSettlementTarget(agent, agent.destinationGrid);
    }

    // Moat workers share the same ground traversability rules as settlement
    // agents. Keep their current world position, but discard only the route
    // when walls/gates/terrain change so unrelated NPC state is preserved.
    for (const worker of this.workers) {
      worker.path.length = 0;
      worker.pathIndex = 0;
      worker.destinationGrid = undefined;
      worker.repathMs = 0;
    }
  }

  private settlementTraversabilitySignature(): string {
    const blocked: string[] = [];

    for (let y = 0; y < SIZE; y += 1) {
      for (let x = 0; x < SIZE; x += 1) {
        if (this.isSettlementBlocked(x, y)) blocked.push(this.key(x, y));
      }
    }

    return blocked.join('|');
  }

  private isSettlementHomeKind(kind: TileKind): boolean {
    return (
      kind === 'hut' ||
      kind === 'cottage' ||
      kind === 'house' ||
      kind === 'manor' ||
      kind === 'villa'
    );
  }

  private createSettlementPerson(
    role: SettlementAgent['role'],
    seed: number,
  ): THREE.Group {
    const group = new THREE.Group();
    const palette = [
      0x9b5c4c,
      0x547c8f,
      0x76618f,
      0x7f8651,
      0xa77a4f,
      0x5f7e6d,
    ];
    const cloth = this.environmentMaterial(
      `person-cloth-${Math.abs(seed) % palette.length}`,
      palette[Math.abs(seed) % palette.length],
      0.92,
    );
    const clothDark = this.environmentMaterial(
      'person-cloth-dark',
      0x4b4039,
      0.98,
    );
    const skin = this.environmentMaterial('person-skin', 0xd5a27c, 0.92);
    const leather = this.environmentMaterial('person-leather', 0x684a35, 1);
    const straw = this.environmentMaterial('person-straw', 0xc7a95d, 1);

    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.2, 0.54, 6),
      role === 'farmer' ? this.environmentMaterial('farmer-cloth', 0x7d7448, 0.98) : cloth,
    );
    body.position.y = 0.52;
    body.castShadow = true;
    group.add(body);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.13, 7, 5),
      skin,
    );
    head.position.y = 0.92;
    head.castShadow = true;
    group.add(head);

    for (const x of [-0.07, 0.07]) {
      const leg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.045, 0.34, 5),
        clothDark,
      );
      leg.position.set(x, 0.18, 0);
      group.add(leg);
    }

    if (role === 'farmer') {
      const brim = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.22, 0.045, 9),
        straw,
      );
      brim.position.y = 1.08;
      group.add(brim);

      const crown = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11, 0.14, 0.13, 8),
        straw,
      );
      crown.position.y = 1.15;
      group.add(crown);

      const tool = new THREE.Mesh(
        new THREE.CylinderGeometry(0.018, 0.018, 0.75, 5),
        leather,
      );
      tool.rotation.z = -0.55;
      tool.position.set(0.18, 0.52, 0.08);
      group.add(tool);
      const basket = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.1, 0.19, 7),
        leather,
      );
      basket.position.set(-0.2, 0.35, 0.08);
      group.add(basket);
    } else {
      const cap = new THREE.Mesh(
        new THREE.ConeGeometry(0.15, 0.16, 6),
        clothDark,
      );
      cap.position.y = 1.08;
      group.add(cap);
      const satchel = new THREE.Mesh(
        new THREE.BoxGeometry(0.17, 0.22, 0.12),
        leather,
      );
      satchel.position.set(-0.2, 0.42, 0.02);
      group.add(satchel);
    }

    group.scale.setScalar(0.92);
    group.userData.settlementRole = role;
    for (const extension of this.extensions) extension.decoratePerson?.(group, role, seed);
    return group;
  }

  private settlementTargetPosition(
    agent: SettlementAgent,
    point: GridPoint,
  ): THREE.Vector3 {
    const world = this.gridToWorld(point.x, point.y);
    const roadLike = this.isRoadFamily(this.kindAt(point.x, point.y));
    const spread = roadLike ? 0.18 : 0.58;
    const offsetX = (((agent.id * 7 + point.x * 3) % 5) - 2) * spread * 0.22;
    const offsetZ = (((agent.id * 11 + point.y * 5) % 5) - 2) * spread * 0.22;

    if (agent.role === 'farmer' && agent.phase === 'work' && agent.work) {
      const workCell = this.services.state.getCell(agent.work.x, agent.work.y);
      const dx = point.x - agent.work.x;
      const dy = point.y - agent.work.y;
      if (workCell?.kind === 'farm' && Math.max(Math.abs(dx), Math.abs(dy)) === 1) {
        const farmWorld = this.gridToWorld(agent.work.x, agent.work.y);
        if (dx === 0 && dy === -1) {
          return new THREE.Vector3(
            farmWorld.x + 0.86 + offsetX * 0.35,
            2.24 + this.terrainElevation(point.x, point.y),
            farmWorld.z - 2.08,
          );
        }

        const length = Math.max(1, Math.hypot(dx, dy));
        return new THREE.Vector3(
          farmWorld.x + (dx / length) * 2.18 + offsetX * 0.3,
          2.24 + this.terrainElevation(point.x, point.y),
          farmWorld.z + (dy / length) * 2.18 + offsetZ * 0.3,
        );
      }
    }

    return new THREE.Vector3(
      world.x + offsetX,
      2.24 + this.terrainElevation(point.x, point.y),
      world.z + offsetZ,
    );
  }

  private chooseCitizenDestination(agent: SettlementAgent): GridPoint {
    const candidates = this.services.state.entries()
      .filter((cell) =>
        ROAD_KINDS.includes(cell.kind as RoadKind) ||
        cell.kind === 'cottage' ||
        cell.kind === 'house' ||
        cell.kind === 'manor' ||
        cell.kind === 'villa' ||
        cell.kind === 'farm',
      )
      .filter((cell) => {
        const terrain = this.terrainAt(cell.x, cell.y);
        return terrain !== 'water' && terrain !== 'river';
      });

    if (candidates.length === 0) return { ...agent.home };

    const sequence =
      Math.abs(Math.floor(agent.anim * 19) + agent.id * 23 + agent.targetGrid.x * 7);
    const choice = candidates[sequence % candidates.length];
    return { x: choice.x, y: choice.y };
  }

  private setSettlementTarget(
    agent: SettlementAgent,
    point: GridPoint,
  ): void {
    const start = this.worldToGrid(agent.position.x, agent.position.z);
    const resolved = this.resolveSettlementDestination(point, start);
    agent.destinationGrid = { ...resolved };
    agent.targetGrid = { ...resolved };
    agent.path = this.findSettlementPath(start, resolved);
    if (agent.path.length > 0) {
      agent.path.shift();
      const next = agent.path[0];
      if (next) agent.target.copy(this.settlementTargetPosition(agent, next));
    } else {
      agent.target.copy(this.settlementTargetPosition(agent, resolved));
    }
  }

  private isSettlementBlocked(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return true;
    const terrain = this.terrainAt(x, y);
    if (terrain === 'water' || terrain === 'river') return true;

    const cell = this.services.state.getCell(x, y);
    if (!cell) return false;

    // Intact walls/buildings remain solid. Gates are explicit navigation
    // portals and are traversable only while their runtime state is open.
    // Erased/destroyed wall cells naturally become passable because they no
    // longer have a blocking cell.
    if (cell.kind === 'gate') {
      return !this.services.gateSystem.isGatePassable(x, y);
    }

    return !ROAD_KINDS.includes(cell.kind as RoadKind);
  }

  private resolveSettlementDestination(point: GridPoint, start: GridPoint): GridPoint {
    if (!this.isSettlementBlocked(point.x, point.y)) return { ...point };

    let best: GridPoint | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let radius = 1; radius <= 3 && !best; radius += 1) {
      for (let y = point.y - radius; y <= point.y + radius; y += 1) {
        for (let x = point.x - radius; x <= point.x + radius; x += 1) {
          if (Math.max(Math.abs(x - point.x), Math.abs(y - point.y)) !== radius) continue;
          if (this.isSettlementBlocked(x, y)) continue;
          const distance = Math.hypot(x - point.x, y - point.y);
          if (distance < bestDistance) {
            bestDistance = distance;
            best = { x, y };
          }
        }
      }
    }
    return best ?? start;
  }

  private findSettlementPath(start: GridPoint, goal: GridPoint): GridPoint[] {
    if (start.x === goal.x && start.y === goal.y) return [start];

    const queue: GridPoint[] = [{ ...start }];
    const cameFrom = new Map<string, GridPoint | null>();
    const key = (p: GridPoint) => this.key(p.x, p.y);
    cameFrom.set(key(start), null);

    const directions: GridPoint[] = [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ];

    for (let index = 0; index < queue.length; index += 1) {
      const current = queue[index];
      if (current.x === goal.x && current.y === goal.y) break;

      for (const direction of directions) {
        const next = { x: current.x + direction.x, y: current.y + direction.y };
        const nextKey = key(next);
        if (cameFrom.has(nextKey) || this.isSettlementBlocked(next.x, next.y)) continue;
        cameFrom.set(nextKey, current);
        queue.push(next);
      }
    }

    const goalKey = key(goal);
    if (!cameFrom.has(goalKey)) return [start];

    const path: GridPoint[] = [];
    let current: GridPoint | null = goal;
    while (current) {
      path.push(current);
      current = cameFrom.get(key(current)) ?? null;
    }
    path.reverse();
    return path;
  }

  private worldToGrid(worldX: number, worldZ: number): GridPoint {
    return {
      x: THREE.MathUtils.clamp(Math.floor(worldX / TILE + SIZE / 2), 0, SIZE - 1),
      y: THREE.MathUtils.clamp(Math.floor(worldZ / TILE + SIZE / 2), 0, SIZE - 1),
    };
  }

  private updateSettlementAgents(deltaMs: number): void {
    for (const agent of this.settlementAgents) {
      agent.anim += deltaMs * 0.001;

      if (agent.waitMs > 0) {
        agent.waitMs = Math.max(0, agent.waitMs - deltaMs);
        const idleBob = Math.sin(agent.anim * 3.2 + agent.id) * 0.012;
        agent.view.position.y = agent.position.y + idleBob;

        if (agent.waitMs === 0) {
          if (agent.role !== 'citizen' && agent.work) {
            if (agent.phase === 'home') {
              agent.phase = 'work';
              this.setSettlementTarget(agent, agent.work);
            } else {
              agent.phase = 'home';
              this.setSettlementTarget(agent, agent.home);
            }
          } else {
            agent.phase = 'wander';
            this.setSettlementTarget(agent, this.chooseCitizenDestination(agent));
          }
        }
        continue;
      }

      const delta = agent.target.clone().sub(agent.position);
      const planarDistance = Math.hypot(delta.x, delta.z);

      if (planarDistance < 0.16) {
        agent.position.copy(agent.target);
        agent.view.position.copy(agent.position);

        if (agent.path.length > 0) {
          const next = agent.path.shift();
          if (next) {
            agent.targetGrid = { ...next };
            agent.target.copy(this.settlementTargetPosition(agent, next));
            continue;
          }
        }

        if (agent.role === 'farmer') {
          agent.waitMs = agent.phase === 'work'
            ? 6800 + (agent.id % 4) * 520
            : 950 + (agent.id % 3) * 160;
        } else if (agent.role === 'worker' && agent.work) {
          agent.waitMs = agent.phase === 'work'
            ? 3600 + (agent.id % 4) * 410
            : 900 + (agent.id % 3) * 180;
        } else {
          agent.waitMs = 650 + (agent.id % 5) * 260;
        }
        continue;
      }

      const seconds = deltaMs / 1000;
      const step = Math.min(planarDistance, agent.speed * seconds);
      agent.position.x += (delta.x / planarDistance) * step;
      agent.position.z += (delta.z / planarDistance) * step;
      agent.position.y = THREE.MathUtils.lerp(
        agent.position.y,
        agent.target.y,
        Math.min(1, seconds * 2.8),
      );

      agent.view.rotation.y = Math.atan2(delta.x, delta.z);
      const walkBob = Math.abs(Math.sin(agent.anim * 8.5 + agent.id)) * 0.045;
      agent.view.position.set(
        agent.position.x,
        agent.position.y + walkBob,
        agent.position.z,
      );
    }
  }

  private syncEconomyUI(): void {
    const cells = this.services.state.entries();
    const populationGroups = this.services.populationSystem.calculate(cells, 0);
    const snapshot = this.services.economySystem.snapshot(
      cells,
      populationGroups.civilians,
      this.services.keepSystem.entries().length,
    );
    const resources = snapshot.resources;
    const rates = snapshot.rates;
    const setText = (id: string, value: string): void => {
      const element = document.getElementById(id);
      if (element) element.textContent = value;
    };
    const formatAmount = (value: number): string =>
      value >= 100 ? String(Math.floor(value)) : value.toFixed(1).replace(/\.0$/, '');
    const formatRate = (value: number): string => {
      const rounded = Math.abs(value) < 0.005 ? 0 : value;
      return `${rounded >= 0 ? '+' : ''}${rounded.toFixed(2)}/s`;
    };

    setText('economy-logs', `Logs ${formatAmount(resources.logs)}`);
    setText('economy-wood', `Wood ${formatAmount(resources.wood)}`);
    setText('economy-stone', `Stone ${formatAmount(resources.stone)}`);
    setText('economy-grain', `Grain ${formatAmount(resources.grain)}`);
    setText('economy-apples', `Apples ${formatAmount(resources.apples)}`);
    setText('economy-flour', `Flour ${formatAmount(resources.flour)}`);
    setText('economy-food', `Food ${formatAmount(resources.food)}`);
    setText('economy-logs-rate', formatRate(rates.logsPerSecond));
    setText('economy-wood-rate', formatRate(rates.woodPerSecond));
    setText('economy-stone-rate', formatRate(rates.stonePerSecond));
    setText('economy-grain-rate', formatRate(rates.grainPerSecond));
    setText('economy-apples-rate', formatRate(rates.applesPerSecond));
    setText('economy-flour-rate', formatRate(rates.flourPerSecond));
    setText('economy-food-rate', formatRate(rates.foodPerSecond - rates.foodConsumptionPerSecond));

    setText('economy-storage', `Storage cap ${snapshot.storageCapacity} per resource`);
    const warning = document.getElementById('economy-warning');
    if (warning) warning.hidden = !snapshot.foodShortage;
  }

  private updateEconomy(deltaMs: number): void {
    const cells = this.services.state.entries();
    const populationGroups = this.services.populationSystem.calculate(cells, 0);
    const result = this.services.economySystem.tick(
      deltaMs,
      cells,
      populationGroups.civilians,
      this.services.keepSystem.entries().length,
    );

    if (!result.updated) return;

    this.syncEconomyUI();
    this.economySaveAccumulatorMs += 1000;
    if (this.economySaveAccumulatorMs >= 15000) {
      this.economySaveAccumulatorMs = 0;
      this.save(false);
    }

    if (result.shortageChanged) {
      this.setStatus(
        result.shortage
          ? 'Food shortage · build Farms, Orchards, Windmills, Cow Barns, or Markets'
          : 'Food supply recovered',
      );
    }
  }

  private updatePopulationUI(): void {
    const cells = this.services.state.entries();
    this.services.populationSystem.reconcile(cells);
    const snapshot = this.services.populationSystem.snapshot();
    const setText = (id: string, value: string): void => {
      const element = document.getElementById(id);
      if (element) element.textContent = value;
    };

    setText('city-population', `Population: ${snapshot.totalPopulation}`);
    setText('military-population', `Army: ${snapshot.militia + snapshot.professionalArmy}`);
    setText('population-available', `Available ${snapshot.available}`);
    setText('population-farmers', `Farmers ${snapshot.farmers}`);
    setText('population-builders', `Builders ${snapshot.builders}`);
    setText('population-workers', `Production/Service ${snapshot.productionWorkers}`);
    setText('population-militia', `Militia ${snapshot.militia}`);
    setText('population-professional', `Professional ${snapshot.professionalArmy}`);
  }

  private missionSnapshot(status: BattleStatus = this.battleSystem.status()): MissionSnapshot {
    const cells = this.services.state.entries();
    this.services.populationSystem.reconcile(cells);
    const population = this.services.populationSystem.snapshot();
    return {
      population: {
        totalPopulation: population.totalPopulation,
        deadCivilians: population.deadCivilians,
      },
      cells,
      keeps: this.services.keepSystem.entries(),
      battle: status,
    };
  }

  private updateMissions(deltaMs: number, force = false, status?: BattleStatus): void {
    this.missionRefreshAccumulatorMs += deltaMs;
    if (!force && this.missionRefreshAccumulatorMs < 300) return;
    this.missionRefreshAccumulatorMs = 0;

    const snapshot = this.missionSnapshot(status);
    const result = this.missionSystem.update(snapshot);
    this.missionUI.render(this.missionSystem.getView(snapshot), result.completedIds);
    if (result.stateChanged) this.save(false);
  }

  private setPinnedMission(id?: string): void {
    if (!this.missionSystem.setPinnedMission(id)) return;
    const snapshot = this.missionSnapshot();
    this.missionUI.render(this.missionSystem.getView(snapshot));
    this.save(false);
  }

  private updateWorkers(deltaMs: number): void {
    for (const worker of this.workers) {
      if (!worker.taskKey) {
        const taskEntry = Array.from(this.moatTasks.entries()).find(([, task]) => task.workerId === undefined);
        if (taskEntry) {
          worker.taskKey = taskEntry[0];
          taskEntry[1].workerId = worker.id;
        }
      }

      if (!worker.taskKey) {
        this.moveWorker(worker, worker.homeX, worker.homeZ, deltaMs, 3.3);
        continue;
      }

      const task = this.moatTasks.get(worker.taskKey);
      if (!task) {
        worker.taskKey = undefined;
        continue;
      }

      const target = this.gridToWorld(task.x, task.y);
      const arrived = this.moveWorker(worker, target.x, target.z, deltaMs, 5.2);
      if (!arrived) continue;

      task.progressMs += deltaMs;
      worker.view.rotation.y += Math.sin(task.progressMs * 0.018) * 0.012;

      if (task.progressMs >= 1800) {
        this.recordHistory();
        this.services.state.setCell(task.x, task.y, 'moat', 1);
        this.moatTasks.delete(worker.taskKey);
        worker.taskKey = undefined;
        this.redraw();
        this.scheduleSave();
        this.setStatus('Moat excavation completed');
      }
    }
  }

  private moveWorker(
    worker: WorkerAgent,
    targetX: number,
    targetZ: number,
    deltaMs: number,
    speed: number,
  ): boolean {
    worker.repathMs = Math.max(0, worker.repathMs - deltaMs);

    const start = this.worldToGrid(
      worker.view.position.x,
      worker.view.position.z,
    );
    const requestedGoal = this.worldToGrid(targetX, targetZ);
    const goal = this.resolveSettlementDestination(requestedGoal, start);
    const destinationChanged =
      !worker.destinationGrid ||
      worker.destinationGrid.x !== goal.x ||
      worker.destinationGrid.y !== goal.y;
    const nextPathPoint = worker.path[worker.pathIndex];
    const routeInvalid =
      !!nextPathPoint &&
      this.isSettlementBlocked(nextPathPoint.x, nextPathPoint.y);
    const routeFinished =
      worker.path.length === 0 || worker.pathIndex >= worker.path.length;

    if (
      destinationChanged ||
      routeInvalid ||
      (routeFinished && worker.repathMs <= 0)
    ) {
      const path = this.findSettlementPath(start, goal);
      const last = path[path.length - 1];
      const reachesGoal =
        !!last && last.x === goal.x && last.y === goal.y;

      worker.destinationGrid = { ...goal };
      worker.path = reachesGoal ? path : [];
      worker.pathIndex =
        reachesGoal && path.length > 1 ? 1 : path.length;
      // Failed routes retry at a controlled cadence instead of every frame.
      worker.repathMs = reachesGoal ? 300 : 650;
    }

    let moveX = targetX;
    let moveZ = targetZ;

    if (worker.pathIndex < worker.path.length) {
      const waypoint = worker.path[worker.pathIndex];
      const world = this.gridToWorld(waypoint.x, waypoint.y);
      moveX = world.x;
      moveZ = world.z;
    } else if (
      start.x !== goal.x ||
      start.y !== goal.y
    ) {
      return false;
    }

    const dx = moveX - worker.view.position.x;
    const dz = moveZ - worker.view.position.z;
    const distance = Math.hypot(dx, dz);

    if (distance < 0.28) {
      if (worker.pathIndex < worker.path.length) {
        worker.pathIndex += 1;
        return false;
      }
      return true;
    }

    const step = Math.min(distance, speed * (deltaMs / 1000));
    worker.view.position.x += (dx / distance) * step;
    worker.view.position.z += (dz / distance) * step;
    worker.view.rotation.y = Math.atan2(dx, dz);
    return false;
  }

  private scheduleSave(): void {
    if (this.saveTimer !== null) window.clearTimeout(this.saveTimer);
    this.setStatus('Unsaved changes…');
    this.saveTimer = window.setTimeout(() => {
      this.save();
      this.saveTimer = null;
    }, 450);
  }

    private save(updateStatus = true): void {
    this.saveSystem.save(updateStatus);
  }

    private load(): void {
    this.saveSystem.load();
  }

  private migrateKind(kind: string, level: number, saveVersion: number): { kind: TileKind; level: number } | null {
    // Wall-connected stairs/ramps/ladders were removed from the visual language.
    // Legacy saves discard them instead of recreating the old bulky wall attachments.
    if (
      kind === 'stairTower' ||
      kind === 'stoneStairs' ||
      kind === 'woodenStairs' ||
      kind === 'ramp' ||
      kind === 'ladder'
    ) return null;
    if (kind === 'marketStall' || kind === 'smallMarket' || kind === 'marketHall') return { kind: 'market', level: 1 };
    if (kind === 'wall') return { kind: 'wall1', level };
    if (kind === 'mountain1') return { kind: 'mountain', level: 1 };
    if (kind === 'mountain2') return { kind: 'mountain', level: 2 };
    if (kind === 'mountain3') return { kind: 'mountain', level: 3 };
    if (saveVersion < 13) {
      if (kind === 'smallDock') return { kind: 'harbor', level: 1 };
      if (kind === 'fishingDock') return { kind: 'harbor', level: 2 };
      if (kind === 'woodenPier') return { kind: 'harbor', level: 3 };
      if (kind === 'harbor') return { kind: 'harbor', level: 4 };
    }
    if (kind === 'harbor') return { kind: 'harbor', level: Math.max(1, Math.min(HARBOR_MAX_LEVEL, level)) };
    if (kind === 'tower' || kind === 'gate') {
      return { kind, level: Math.max(1, Math.min(FORTIFICATION_MAX_LEVEL, level)) };
    }
    if (kind === 'armyCamp') return { kind: 'armyCamp', level: Math.max(1, Math.min(ARMY_CAMP_MAX_LEVEL, level)) };
    if (kind === 'farm' || kind === 'cowBarn') {
      return { kind, level: Math.max(1, Math.min(AGRICULTURE_MAX_LEVEL, level)) };
    }
    if (!BUILDING_KINDS.includes(kind as TileKind)) return null;
    return { kind: kind as TileKind, level: Math.max(1, level) };
  }

  private bindUI(): void {
    const get = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
    const toolbar = get<HTMLElement>('toolbar');

    const noneHtml =
      '<button class="build-inspect-button is-selected" data-build-none="true" type="button" aria-pressed="true">' +
      '<span aria-hidden="true">◎</span><strong>Inspect</strong><kbd>Esc</kbd></button>';

    toolbar.innerHTML =
      '<div class="toolbar-title">' +
      '<div class="toolbar-heading"><span>Build</span><small>Choose a tool and place it</small></div>' +
      '<div class="toolbar-title-actions">' +
      '<button id="toolbar-close" class="toolbar-close" type="button" aria-label="Close build panel">×</button></div>' +
      '</div>' +
      '<div class="build-search" role="search">' +
      '<span class="build-search-icon" aria-hidden="true">⌕</span>' +
      '<input id="build-search" type="search" aria-label="Search build tools" placeholder="Search tools…" autocomplete="off" />' +
      '<button id="build-search-clear" class="build-search-clear" type="button" aria-label="Clear tool search" hidden>×</button>' +
      '</div>' +
      '<div class="build-context-row">' +
      '<div class="build-active" role="status" aria-live="polite"><span class="build-active-dot"></span><span>Active</span><strong id="build-active-label">Inspect</strong></div>' +
      noneHtml +
      '</div>' +
      '<div class="build-world-summary" role="group" aria-label="Population and army">' +
      '<span class="build-world-stat build-world-population"><span class="build-world-stat-icon" aria-hidden="true">♟</span><b id="city-population">Population: 0</b></span>' +
      '<span class="build-world-stat build-world-army"><span class="build-world-stat-icon" aria-hidden="true">⚔</span><b id="military-population">Army: 0</b></span>' +
      '</div>' +
      '<div class="build-population-breakdown" role="status" aria-label="Population allocation">' +
      '<span id="population-available">Available 0</span>' +
      '<span id="population-farmers">Farmers 0</span>' +
      '<span id="population-builders">Builders 0</span>' +
      '<span id="population-workers">Production/Service 0</span>' +
      '<span id="population-militia">Militia 0</span>' +
      '<span id="population-professional">Professional 0</span>' +
      '</div>' +
      '<div class="build-economy-summary" role="group" aria-label="Settlement resources">' +
      '<span class="build-resource-stat"><b id="economy-logs">Logs 0</b><small id="economy-logs-rate">+0/s</small></span>' +
      '<span class="build-resource-stat"><b id="economy-wood">Wood 0</b><small id="economy-wood-rate">+0/s</small></span>' +
      '<span class="build-resource-stat"><b id="economy-stone">Stone 0</b><small id="economy-stone-rate">+0/s</small></span>' +
      '<span class="build-resource-stat"><b id="economy-grain">Grain 0</b><small id="economy-grain-rate">+0/s</small></span>' +
      '<span class="build-resource-stat"><b id="economy-apples">Apples 0</b><small id="economy-apples-rate">+0/s</small></span>' +
      '<span class="build-resource-stat"><b id="economy-flour">Flour 0</b><small id="economy-flour-rate">+0/s</small></span>' +
      '<span class="build-resource-stat"><b id="economy-food">Food 0</b><small id="economy-food-rate">+0/s</small></span>' +
      '<span class="build-economy-storage" id="economy-storage">Storage 0 / 0</span>' +
      '<span class="build-economy-warning" id="economy-warning" hidden>Food shortage</span>' +
      '</div>' +
      '<div class="build-category-tabs" role="tablist" aria-label="Build tool categories"></div>' +
      '<div id="build-search-empty" class="build-search-empty" hidden>No tools match that search.</div>' +
      '<div class="build-tool-sections"></div>' +
      '<div class="builder-settings">' +
      '<div class="settings-actions build-global-actions" role="group" aria-label="Build history actions"><button id="undo-button" type="button" disabled>↶ Undo</button><button id="redo-button" type="button" disabled>↷ Redo</button></div>' +
      '<section id="selection-action-card" class="fortification-upgrade-card" aria-label="Selected building actions" hidden>' +
      '<div class="fortification-upgrade-heading"><div><span class="eyebrow">SELECTED BUILDING</span><strong id="selection-action-name">Building</strong></div></div>' +
      '<div class="settings-actions"><button id="rotate-selected" type="button" hidden>↻ Rotate</button><button id="remove-selected" type="button">Remove</button></div>' +
      '<div class="settings-actions"><button id="selected-gate-toggle" type="button" hidden>Open Gate</button></div>' +
      '</section>' +
      '<section id="fortification-upgrade-card" class="fortification-upgrade-card" aria-label="Selected fortification upgrade" hidden>' +
      '<div class="fortification-upgrade-heading"><div><span id="fortification-upgrade-type" class="eyebrow">SELECTED FORTIFICATION</span><strong id="fortification-upgrade-name">Fortification · Level 1</strong></div><span id="fortification-upgrade-badge">1 / 4</span></div>' +
      '<div class="fortification-level-track" aria-hidden="true"><span data-fortification-level="1"></span><span data-fortification-level="2"></span><span data-fortification-level="3"></span><span data-fortification-level="4"></span></div>' +
      '<small id="fortification-upgrade-description">Select a Tower, Gate, Keep, or Tower Bridge to inspect its upgrade path.</small>' +
      '<div class="fortification-upgrade-actions"><button id="fortification-upgrade-button" class="fortification-upgrade-button" type="button">Upgrade to Level 2</button><button id="fortification-remove-bridge-button" class="fortification-remove-bridge-button" type="button" hidden>Remove Bridge</button></div>' +
      '</section>' +
      '<section id="army-camp-upgrade-card" class="army-camp-upgrade-card" aria-label="Selected Army Camp upgrade" hidden>' +
      '<div class="army-camp-upgrade-heading"><div><span class="eyebrow">SELECTED MILITARY BUILDING</span><strong id="army-camp-upgrade-name">Army Camp · Level 1</strong></div><span id="army-camp-upgrade-badge">1 / 4</span></div>' +
      '<div class="army-camp-level-track" aria-hidden="true"><span data-camp-level="1"></span><span data-camp-level="2"></span><span data-camp-level="3"></span><span data-camp-level="4"></span></div>' +
      '<small id="army-camp-upgrade-description">Select an Army Camp to inspect its level.</small>' +
      '<button id="army-camp-upgrade-button" class="army-camp-upgrade-button" type="button">Upgrade to Level 2</button>' +
      '</section>' +
      '<section id="agriculture-upgrade-card" class="agriculture-upgrade-card" aria-label="Selected agriculture building upgrade" hidden>' +
      '<div class="agriculture-upgrade-heading"><div><span id="agriculture-upgrade-type" class="eyebrow">SELECTED AGRICULTURE BUILDING</span><strong id="agriculture-upgrade-name">Farm · Level 1</strong></div><span id="agriculture-upgrade-badge">1 / 4</span></div>' +
      '<div class="agriculture-level-track" aria-hidden="true"><span data-agriculture-level="1"></span><span data-agriculture-level="2"></span><span data-agriculture-level="3"></span><span data-agriculture-level="4"></span></div>' +
      '<small id="agriculture-upgrade-description">Select a Farm or Cow Barn to inspect its level.</small>' +
      '<button id="agriculture-upgrade-button" class="agriculture-upgrade-button" type="button">Upgrade to Level 2</button>' +
      '</section>' +
      '<section id="carpenter-upgrade-card" class="carpenter-upgrade-card" aria-label="Selected Carpenter Workshop upgrade" hidden>' +
      '<div class="carpenter-upgrade-heading"><div><span class="eyebrow">SELECTED CARPENTER</span><strong id="carpenter-upgrade-name">Timber Yard · Level 1</strong></div><span id="carpenter-upgrade-badge">1 / 3</span></div>' +
      '<div class="carpenter-level-track" aria-hidden="true"><span data-carpenter-level="1"></span><span data-carpenter-level="2"></span><span data-carpenter-level="3"></span></div>' +
      '<small id="carpenter-upgrade-description">Converts Logs into construction-ready Wood.</small>' +
      '<button id="carpenter-upgrade-button" class="carpenter-upgrade-button" type="button">Upgrade to Level 2</button>' +
      '</section>' +
      '<section id="harbor-upgrade-card" class="harbor-upgrade-card" aria-label="Selected Harbor upgrade" hidden>' +
      '<div class="harbor-upgrade-heading"><div><span class="eyebrow">SELECTED HARBOR</span><strong id="harbor-upgrade-name">Landing Dock · Level 1</strong></div><span id="harbor-upgrade-badge">1 / 4</span></div>' +
      '<div class="harbor-level-track" aria-hidden="true"><span data-harbor-level="1"></span><span data-harbor-level="2"></span><span data-harbor-level="3"></span><span data-harbor-level="4"></span></div>' +
      '<small id="harbor-upgrade-description">Select a Harbor to inspect its level.</small>' +
      '<button id="harbor-upgrade-button" class="harbor-upgrade-button" type="button">Upgrade to Level 2</button>' +
      '</section>' +
      '<section class="settings-section build-settings-section">' +
      '<button class="settings-section-header" type="button" aria-expanded="false">' +
      '<span class="settings-section-title">Advanced Editor</span>' +
      '<span id="build-settings-summary" class="settings-section-summary">Manual architecture & terrain tuning</span>' +
      '<span class="settings-section-chevron" aria-hidden="true">▶</span>' +
      '</button>' +
      '<div class="settings-section-items">' +
      '<div class="settings-title">Wall</div>' +
      '<label class="settings-row"><span>Thickness</span><select id="wall-thickness">' +
      '<option value="thin">Thin</option><option value="medium" selected>Medium</option><option value="thick">Thick</option>' +
      '</select></label>' +
      '<label class="settings-check"><input id="wall-battlement" type="checkbox" checked /><span>Battlement</span></label>' +
      '<label class="settings-check"><input id="wall-walkway" type="checkbox" /><span>Top Walkway</span></label>' +
      '<div class="settings-actions"><button id="selected-down" type="button">− Height</button><button id="selected-up" type="button">+ Height</button></div>' +
      '<div class="settings-title">Castle Architecture</div>' +
      '<label class="settings-row"><span>Stone Style</span><select id="castle-stone-style">' +
      '<option value="limestone" selected>Limestone</option><option value="darkStone">Dark Stone</option>' +
      '<option value="sandstone">Sandstone</option><option value="frontier">Rough Frontier</option><option value="whitePlaster">White Plaster</option>' +
      '</select></label>' +
      '<label class="settings-row"><span>Tower Bridge</span><select id="tower-bridge-kind">' +
      '<option value="stone" selected>Stone Bridge</option><option value="wood">Wooden Bridge</option>' +
      '</select></label>' +
      '<div class="settings-hint">Foundations, buttresses and machicolations are generated automatically.</div>' +
      '<div class="settings-title">Tower</div>' +
      '<label class="settings-row"><span>Base</span><select id="tower-shape">' +
      '<option value="square">Square Tower</option><option value="round" selected>Round Tower</option>' +
      '<option value="octagonal">Octagonal Tower</option><option value="corner">Corner Tower</option>' +
      '<option value="watch">Watch Tower</option></select></label>' +
      '<label class="settings-row"><span>Top</span><select id="tower-top">' +
      '<option value="openBattlement" selected>Open Battlement</option>' +
      '<option value="conical">Conical Roof</option><option value="hipped">Hipped Roof</option>' +
      '<option value="pyramidal">Pyramidal Roof</option><option value="timberRoof">Timber Roof</option>' +
      '<option value="flat">Flat Platform</option><option value="watch">Watch Platform</option></select></label>' +
      '<div class="settings-title">Keep</div>' +
      '<label class="settings-row"><span>Width</span><select id="keep-width">' +
      '<option value="2">2 tiles</option><option value="3" selected>3 tiles</option><option value="4">4 tiles</option><option value="5">5 tiles</option><option value="6">6 tiles</option>' +
      '</select></label>' +
      '<label class="settings-row"><span>Depth</span><select id="keep-depth">' +
      '<option value="2">2 tiles</option><option value="3" selected>3 tiles</option><option value="4">4 tiles</option><option value="5">5 tiles</option><option value="6">6 tiles</option>' +
      '</select></label>' +
      '<label class="settings-row"><span>Floors</span><select id="keep-floors">' +
      '<option value="1">1 floor</option><option value="2" selected>2 floors</option><option value="3">3 floors</option><option value="4">4 floors</option><option value="5">5 floors</option><option value="6">6 floors</option><option value="7">7 floors</option><option value="8">8 floors</option><option value="9">9 floors</option>' +
      '</select></label>' +
      '<label class="settings-row"><span>Roof</span><select id="keep-roof">' +
      '<option value="flatBattlement">Flat Battlement</option><option value="sloped">Medieval Sloped</option><option value="defensivePlatform">Defensive Platform</option><option value="towered">Towered Roof</option><option value="japaneseTiered">Japanese Tiered</option>' +
      '</select></label>' +
      '<label class="settings-check"><input id="keep-corner-towers" type="checkbox" /><span>Corner Towers</span></label>' +
      '<label class="settings-check"><input id="keep-battlements" type="checkbox" checked /><span>Keep Battlements</span></label>' +

      '<div class="settings-title">Terrain Brush</div>' +
      '<label class="settings-row"><span>Brush Size</span><select id="brush-size">' +
      '<option value="1">1 tile</option><option value="2" selected>2 tiles</option><option value="3">3 tiles</option><option value="4">4 tiles</option>' +
      '</select></label>' +
      '<label class="settings-row"><span>Strength</span><span class="range-wrap"><input id="brush-strength" type="range" min="0.25" max="2" step="0.25" value="1" /><b id="brush-strength-value">1.00</b></span></label>' +
      '<div class="settings-hint">Advanced architecture and terrain tuning is optional. Normal building uses automatic defaults.</div>' +
      '</div></section></div>';

    const builderSettings = toolbar.querySelector<HTMLElement>('.builder-settings');
    if (builderSettings) builderSettings.hidden = false;

    const buildSearch = toolbar.querySelector<HTMLInputElement>('#build-search');
    buildSearch?.addEventListener('input', () => this.filterBuildTools());
    toolbar.querySelector<HTMLButtonElement>('#build-search-clear')?.addEventListener('click', () => {
      if (!buildSearch) return;
      buildSearch.value = '';
      this.filterBuildTools();
      buildSearch.focus();
    });

    const buildCategoryTabs = toolbar.querySelector<HTMLElement>('.build-category-tabs');
    buildCategoryTabs?.addEventListener('wheel', (event) => {
      if (buildCategoryTabs.scrollWidth <= buildCategoryTabs.clientWidth + 1) return;
      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      if (delta === 0) return;

      const before = buildCategoryTabs.scrollLeft;
      buildCategoryTabs.scrollLeft += delta;
      if (buildCategoryTabs.scrollLeft !== before) {
        event.preventDefault();
        event.stopPropagation();
      }
    }, { passive: false });

    const buildControlSelector = '[data-build-category], [data-tool], [data-build-none]';
    let buildPointerTap: {
      pointerId: number;
      startX: number;
      startY: number;
      control: HTMLButtonElement;
    } | null = null;
    let suppressBuildClickUntil = 0;

    const activateBuildControl = (control: HTMLButtonElement, event?: Event): boolean => {
      if (!toolbar.contains(control) || control.disabled) return false;

      const category = control.dataset.buildCategory;
      if (category) {
        event?.preventDefault();
        this.activeBuildCategory = category;
        if (buildSearch) buildSearch.value = '';
        this.filterBuildTools();
        if (document.documentElement.classList.contains('mobile-ui-active')) toolbar.scrollTo(0, 0);
        return true;
      }

      const tool = control.dataset.tool as ToolKind | undefined;
      if (tool) {
        event?.preventDefault();
        this.selectTool(tool);
        if (this.selectedTool === tool && document.documentElement.classList.contains('mobile-ui-active')) {
          this.setToolbarOpen(false);
        }
        return true;
      }

      if (control.hasAttribute('data-build-none')) {
        event?.preventDefault();
        this.selectTool(null);
        return true;
      }

      return false;
    };

    toolbar.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'mouse') return;
      const target = event.target as HTMLElement | null;
      const control = target?.closest<HTMLButtonElement>(buildControlSelector) ?? null;
      if (!control || !toolbar.contains(control)) return;
      buildPointerTap = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        control,
      };
    });

    toolbar.addEventListener('pointerup', (event) => {
      if (!buildPointerTap || event.pointerId !== buildPointerTap.pointerId) return;
      const pending = buildPointerTap;
      buildPointerTap = null;

      const distance = Math.hypot(
        event.clientX - pending.startX,
        event.clientY - pending.startY,
      );
      if (distance > 10) return;

      const target = event.target as HTMLElement | null;
      const releasedControl = target?.closest<HTMLButtonElement>(buildControlSelector) ?? null;
      if (releasedControl !== pending.control) return;

      if (activateBuildControl(pending.control, event)) {
        // Touch browsers normally synthesize a click after pointerup. Avoid
        // selecting the same tool twice after the sidebar has already updated.
        suppressBuildClickUntil = performance.now() + 500;
      }
    });

    toolbar.addEventListener('pointercancel', () => {
      buildPointerTap = null;
    });

    toolbar.addEventListener('click', (event) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const control = target.closest<HTMLButtonElement>(buildControlSelector);
      if (!control || !toolbar.contains(control)) return;

      if (
        event instanceof MouseEvent &&
        event.detail > 0 &&
        performance.now() < suppressBuildClickUntil
      ) {
        event.preventDefault();
        return;
      }

      activateBuildControl(control, event);
    });

    this.refreshBuildPanel();
    this.updatePopulationUI();
    this.syncEconomyUI();

    get<HTMLButtonElement>('toolbar-close').onclick = () => this.setToolbarOpen(false);
    get<HTMLButtonElement>('toolbar-open').onclick = () => this.setToolbarOpen(!this.toolbarOpen);
    const minimap = get<HTMLButtonElement>('minimap');
    minimap.onkeydown = (event) => {
      const direction: Record<string, GridPoint> = {
        ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 },
        ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 },
      };
      const delta = direction[event.key];
      if (!delta) return;
      event.preventDefault();
      this.minimapCursor = {
        x: THREE.MathUtils.clamp(this.minimapCursor.x + delta.x, 0, SIZE - 1),
        y: THREE.MathUtils.clamp(this.minimapCursor.y + delta.y, 0, SIZE - 1),
      };
      minimap.setAttribute('aria-label', `Map sector ${this.minimapCursor.x + 1}, ${this.minimapCursor.y + 1}; press Enter to move camera`);
      this.renderMinimap();
    };
    minimap.onclick = (event) => {
      const canvas = get<HTMLCanvasElement>('minimap-canvas');
      const bounds = canvas.getBoundingClientRect();
      if (event.detail !== 0 && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) return;
      const x = event.detail === 0 ? this.minimapCursor.x : Math.max(0, Math.min(SIZE - 1, Math.floor((event.clientX - bounds.left) / bounds.width * SIZE)));
      const y = event.detail === 0 ? this.minimapCursor.y : Math.max(0, Math.min(SIZE - 1, Math.floor((event.clientY - bounds.top) / bounds.height * SIZE)));
      this.minimapCursor = { x, y };
      const next = this.gridToWorld(x, y);
      const offset = this.camera.position.clone().sub(this.controls.target);
      this.controls.target.set(next.x, this.controls.target.y, next.z);
      this.camera.position.copy(this.controls.target).add(offset);
      this.controls.update();
      const hint = document.querySelector<HTMLElement>('.minimap-hint');
      if (hint) hint.textContent = `Viewing sector ${x + 1}, ${y + 1}`;
      minimap.setAttribute('aria-label', `Map sector ${x + 1}, ${y + 1}; arrow keys choose sector, Enter moves camera`);
      this.renderMinimap();
    };
    get<HTMLButtonElement>('view-2d-button').onclick = () => this.setViewMode('plan2d');
    get<HTMLButtonElement>('view-3d-button').onclick = () => this.setViewMode('world3d');
    get<HTMLButtonElement>('camera-45-button').onclick = () => this.setCameraView('45');
    get<HTMLButtonElement>('camera-top-button').onclick = () => this.setCameraView('top');

    const buildSettingsSection = toolbar.querySelector<HTMLElement>('.build-settings-section');
    const buildSettingsHeader = toolbar.querySelector<HTMLButtonElement>('.settings-section-header');
    buildSettingsHeader?.addEventListener('click', () => {
      if (!buildSettingsSection || !buildSettingsHeader) return;
      const open = buildSettingsSection.classList.toggle('is-open');
      buildSettingsHeader.setAttribute('aria-expanded', String(open));
    });

    const wallThickness = get<HTMLSelectElement>('wall-thickness');
    wallThickness.value = this.wallThickness;
    wallThickness.onchange = () => {
      this.wallThickness = wallThickness.value as WallThickness;
      this.applyWallSettingsToSelected();
      this.syncWallSettingsSummary();
    };

    const wallBattlement = get<HTMLInputElement>('wall-battlement');
    wallBattlement.checked = this.wallBattlement;
    wallBattlement.onchange = () => {
      this.wallBattlement = wallBattlement.checked;
      this.applyWallSettingsToSelected();
      this.syncWallSettingsSummary();
    };

    const wallWalkway = get<HTMLInputElement>('wall-walkway');
    wallWalkway.checked = this.wallWalkway;
    wallWalkway.onchange = () => {
      this.wallWalkway = wallWalkway.checked;
      this.applyWallSettingsToSelected();
      this.syncWallSettingsSummary();
    };

    this.syncWallSettingsSummary();

    get<HTMLButtonElement>('selected-gate-toggle').onclick = () => this.toggleSelectedGate();

    const towerShape = get<HTMLSelectElement>('tower-shape');
    towerShape.onchange = () => {
      this.towerShape = towerShape.value as TowerShape;
      this.towerTop = this.compatibleTowerTop(this.towerShape, this.towerTop);
      const topSelect = document.getElementById('tower-top') as HTMLSelectElement | null;
      if (topSelect) topSelect.value = this.towerTop;
      this.applyTowerSettingsToSelected();
    };

    const towerTop = get<HTMLSelectElement>('tower-top');
    towerTop.onchange = () => {
      const requested = towerTop.value as TowerTop;
      this.towerTop = this.compatibleTowerTop(this.towerShape, requested);
      towerTop.value = this.towerTop;
      this.applyTowerSettingsToSelected();
    };

    const stoneStyle = get<HTMLSelectElement>('castle-stone-style');
    stoneStyle.value = this.stoneStyle;
    stoneStyle.onchange = () => {
      const next = stoneStyle.value as StoneStyle;
      if (next === this.stoneStyle) return;
      this.recordHistory();
      this.stoneStyle = next;
      this.redraw();
      this.scheduleSave();
      this.setStatus('Castle stone style: ' + next);
    };

    const bridgeKind = get<HTMLSelectElement>('tower-bridge-kind');
    bridgeKind.value = this.towerBridgeKind;
    bridgeKind.onchange = () => {
      this.towerBridgeKind = bridgeKind.value as TowerBridgeKind;
      this.setStatus('Tower bridge material: ' + this.towerBridgeKind);
    };

    const keepWidth = get<HTMLSelectElement>('keep-width');
    const keepDepth = get<HTMLSelectElement>('keep-depth');
    const keepFloors = get<HTMLSelectElement>('keep-floors');
    const keepRoof = get<HTMLSelectElement>('keep-roof');
    const keepCornerTowers = get<HTMLInputElement>('keep-corner-towers');
    const keepBattlements = get<HTMLInputElement>('keep-battlements');

    const updateKeepDraft = (): void => {
      this.keepWidth = Number(keepWidth.value);
      this.keepDepth = Number(keepDepth.value);
      this.keepFloors = Number(keepFloors.value);
      this.keepRoof = keepRoof.value as KeepRoofStyle;
      this.keepCornerTowers = keepCornerTowers.checked;
      this.keepBattlements = keepBattlements.checked;
      this.applyKeepSettingsToSelected();
    };

    keepWidth.onchange = updateKeepDraft;
    keepDepth.onchange = updateKeepDraft;
    keepFloors.onchange = updateKeepDraft;
    keepRoof.onchange = updateKeepDraft;
    keepCornerTowers.onchange = updateKeepDraft;
    keepBattlements.onchange = updateKeepDraft;

    get<HTMLButtonElement>('selected-down').onclick = () => this.adjustSelectedHeight(-1);
    get<HTMLButtonElement>('selected-up').onclick = () => this.adjustSelectedHeight(1);

    const brushSize = get<HTMLSelectElement>('brush-size');
    brushSize.onchange = () => {
      this.brushSize = Number(brushSize.value);
      this.setStatus(`Brush size: ${this.brushSize}`);
    };

    const brushStrength = get<HTMLInputElement>('brush-strength');
    const brushStrengthValue = get<HTMLElement>('brush-strength-value');
    brushStrength.oninput = () => {
      this.brushStrength = Number(brushStrength.value);
      brushStrengthValue.textContent = this.brushStrength.toFixed(2);
    };

    get<HTMLButtonElement>('rotate-selected').onclick = () => this.rotateSelected();
    get<HTMLButtonElement>('remove-selected').onclick = () => this.removeSelected();
    get<HTMLButtonElement>('fortification-upgrade-button').onclick = () => this.upgradeSelectedFortification();
    get<HTMLButtonElement>('fortification-remove-bridge-button').onclick = () => this.removeSelectedTowerBridge();
    get<HTMLButtonElement>('army-camp-upgrade-button').onclick = () => this.upgradeSelectedArmyCamp();
    get<HTMLButtonElement>('agriculture-upgrade-button').onclick = () => this.upgradeSelectedAgricultureBuilding();
    get<HTMLButtonElement>('carpenter-upgrade-button').onclick = () => this.upgradeSelectedCarpenter();
    get<HTMLButtonElement>('harbor-upgrade-button').onclick = () => this.upgradeSelectedHarbor();
    get<HTMLButtonElement>('undo-button').onclick = () => this.undo();
    get<HTMLButtonElement>('redo-button').onclick = () => this.redo();
    get<HTMLButtonElement>('header-undo-button').onclick = () => this.undo();
    this.syncHistoryActions();
    const help = get<HTMLElement>('help-modal');
    const templates = get<HTMLElement>('templates-modal');
    const battlePanel = get<HTMLElement>('battle-panel');

    get<HTMLButtonElement>('battle-button').onclick = () => {
      if (this.godModeOpen) this.closeGodMode();
      this.setToolbarOpen(false);
      battlePanel.hidden = false;
      this.syncBattleSetupUI();
      this.updateBattleUI(this.battleSystem.status());
    };
    get<HTMLButtonElement>('battle-close').onclick = () => {
      battlePanel.hidden = true;
    };
    get<HTMLButtonElement>('military-button').onclick = () => {
      if (this.godModeOpen) this.closeGodMode();
      this.setToolbarOpen(false);
      battlePanel.hidden = false;
      this.syncMilitaryUI();
    };
    get<HTMLButtonElement>('military-upgrade').onclick = () => this.upgradeMilitaryTier();
    get<HTMLButtonElement>('military-missile-produce').onclick = () => this.produceMissileFromUI();
    get<HTMLButtonElement>('military-missile-launch').onclick = () => this.launchMissileFromUI();
    get<HTMLSelectElement>('military-missile-target').onchange = () => this.syncMilitaryMissileUI();

    get<HTMLButtonElement>('god-mode-button').onclick = () => this.openGodMode();
    get<HTMLButtonElement>('god-mode-close').onclick = () => this.closeGodMode();
    get<HTMLButtonElement>('god-mode-confirm').onclick = () => this.confirmGodModeAction();
    get<HTMLButtonElement>('god-mode-cancel').onclick = () => this.cancelGodModeTarget();
    get<HTMLButtonElement>('god-mode-free-build').onclick = () => {
      this.freeBuildEnabled = !this.freeBuildEnabled;
      this.updateGodModeUI();
      this.syncEconomyUI();
      this.setStatus(this.freeBuildEnabled ? 'Free Build enabled' : 'Free Build disabled · economy costs restored');
    };
    document.querySelectorAll<HTMLButtonElement>('[data-god-action]').forEach((button) => {
      button.onclick = () => {
        const actionId = button.dataset.godAction;
        if (actionId) this.selectGodModeAction(actionId);
      };
    });
    this.updateGodModeUI();

    document.querySelectorAll<HTMLButtonElement>('[data-battle-field]').forEach((button) => {
      button.onclick = () => {
        const field = button.dataset.battleField as keyof BattleSetup | undefined;
        const delta = Number(button.dataset.delta ?? 0);
        if (!field || !Number.isFinite(delta)) return;
        this.adjustBattleSetup(field, delta);
      };
    });

    document.querySelectorAll<HTMLInputElement>('[data-battle-input]').forEach((input) => {
      const apply = (): void => {
        const field = input.dataset.battleInput as keyof BattleSetup | undefined;
        if (!field) return;
        this.setBattleSetupValue(field, Number(input.value));
      };
      input.onchange = apply;
      input.onblur = apply;
    });

    get<HTMLButtonElement>('battle-start').onclick = () => this.startBattleFromUI();
    get<HTMLButtonElement>('battle-endless').onclick = () => this.startEndlessDefenseFromUI();
    get<HTMLButtonElement>('battle-stop').onclick = () => this.stopBattleFromUI();
    get<HTMLButtonElement>('battle-reset').onclick = () => this.resetBattleFromUI();

    get<HTMLButtonElement>('battle-speed-down').onclick = () => {
      this.battleSystem.decreaseBattleSpeed();
    };
    get<HTMLButtonElement>('battle-speed-up').onclick = () => {
      this.battleSystem.increaseBattleSpeed();
    };
    this.syncBattleSetupUI();
    this.syncMilitaryUI();
    this.updateBattleUI(this.battleSystem.status());

    const openHelp = (): void => {
      if (!this.settingsStore.get().interface.showHelp) {
        this.setStatus('Help is disabled in Settings');
        return;
      }
      help.hidden = false;
    };
    const openTemplates = (): void => {
      this.newGameSelectionPending = false;
      this.syncTemplateAvailability();
      templates.hidden = false;
    };

    document.addEventListener('castlegame:open-help', openHelp);
    registerSystemAction('help', openHelp);
    registerSystemAction('templates', openTemplates);
    registerSystemAction('save', () => this.saveSystem.openSaveDialog());
    registerSystemAction('load', () => this.saveSystem.openLoadDialog());

    get<HTMLButtonElement>('help-close-button').onclick = () => {
      help.hidden = true;
    };
    get<HTMLButtonElement>('templates-button').onclick = openTemplates;
    get<HTMLButtonElement>('templates-close-button').onclick = () => {
      this.newGameSelectionPending = false;
      templates.hidden = true;
      this.syncTemplateAvailability();
    };

    templates.addEventListener('click', (event) => {
      if (event.target === templates) {
        this.newGameSelectionPending = false;
        templates.hidden = true;
        this.syncTemplateAvailability();
      }
    });

    document.querySelectorAll<HTMLButtonElement>('[data-template]').forEach((button) => {
      button.onclick = () => {
        const template = button.dataset.template;
        if (!template) return;
        if (this.newGameSelectionPending) {
          this.newGameSelectionPending = false;
          const authoredLayoutTemplate = PLAYABLE_LAYOUT_TEMPLATES[template];
          this.setMapLayoutId(authoredLayoutTemplate?.layoutId ?? 'island');
          this.resetWorld();
        }
        this.applyTemplate(template);
        templates.hidden = true;
      };
    });

    document.querySelectorAll<HTMLButtonElement>('[data-terrain-template]').forEach((button) => {
      button.onclick = () => {
        const template = button.dataset.terrainTemplate;
        if (!template) return;
        if (this.newGameSelectionPending) {
          this.newGameSelectionPending = false;
          this.setMapLayoutId('island');
          this.resetWorld();
        }
        this.applyTerrainTemplate(template);
        templates.hidden = true;
      };
    });

    // Hidden legacy bridge buttons remain compatible with existing automation and mobile proxies.
    // Settings uses registerSystemAction above and opens the dedicated save/load dialogs directly.
    get<HTMLButtonElement>('save-button').onclick = () => this.save();
    get<HTMLButtonElement>('load-button').onclick = () => {
      this.clearSettlementAgents();
      this.load();
      this.selectedCell = null;
      this.selectedKeepId = null;
      this.selectedTowerBridgeId = null;
      this.undoStack.length = 0;
      this.redoStack.length = 0;
      this.syncHistoryActions();
      this.resetGameplayCameraReference();
      this.redraw();
    };
    get<HTMLButtonElement>('reset-button').onclick = () => {
      const confirmRequired = this.settingsStore.get().interface.confirmDestructiveActions;
      if (!confirmRequired || confirm(t('Reset the entire world and start a new game?'))) {
        this.openMapLayoutSelector();
      }
    };
    get<HTMLButtonElement>('fullscreen-button').onclick = async () => {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    };

    let wasNarrow = window.innerWidth <= 760;
    window.addEventListener('resize', () => {
      const narrow = window.innerWidth <= 760;
      if (narrow && !wasNarrow && this.toolbarOpen) {
        this.setToolbarOpen(false);
      }
      wasNarrow = narrow;
    });

    window.addEventListener('keydown', (event) => {
      const key = event.key.toLowerCase();

      const typingTarget = event.target;
      if (
        typingTarget instanceof HTMLInputElement ||
        typingTarget instanceof HTMLTextAreaElement ||
        typingTarget instanceof HTMLSelectElement
      ) return;

      if ((event.ctrlKey || event.metaKey) && key === 'z') {
        event.preventDefault();
        this.undo();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && key === 'y') {
        event.preventDefault();
        this.redo();
        return;
      }

      const shortcutMap: Record<string, ToolKind> = {
        '1': 'wall1',
        '2': 'wall2',
        '3': 'wall3',
        '4': 'gate',
        '5': 'tower',
        '6': 'road',
        '7': 'cottage',
        '8': 'house',
        '9': 'manor',
        '0': 'villa',
        f: 'farm',
        w: 'windmill',
        y: 'appleOrchard',
        a: 'armyCamp',
        t: 'tree',
        n: 'mountain',
        m: 'mine',
        q: 'moat',
        r: 'river',
        l: 'land',
        p: 'keep',
        d: 'towerBridge',
        i: 'dirtRoad',
        o: 'stoneRoad',
        k: 'mountainRange',
        u: 'raise',
        j: 'lower',
        b: 'flatten',
        v: 'smooth',
        h: 'hill',
        c: 'cliff',
        x: 'erase',
      };

      const selected = shortcutMap[key];
      if (selected) this.selectTool(selected);
      if (event.key === '[') this.adjustSelectedHeight(-1);
      if (event.key === ']') this.adjustSelectedHeight(1);

      if (event.key === 'Escape') {
        help.hidden = true;
        templates.hidden = true;
        const layoutModal = document.getElementById('map-layout-modal');
        if (layoutModal) layoutModal.hidden = true;
        if (this.godModeOpen) this.closeGodMode();
        this.selectTool(null);
      }
    });
  }

  private syncWallSettingsSummary(): void {
    const summary = document.getElementById('build-settings-summary');
    if (!summary) return;
    const thickness = this.wallThickness.charAt(0).toUpperCase() + this.wallThickness.slice(1);
    const battlement = this.wallBattlement ? 'Battlement' : 'No Battlement';
    const walkway = this.wallWalkway ? 'Walkway' : 'No Walkway';
    summary.textContent = `${thickness} · ${battlement} · ${walkway}`;
  }

  private syncSelectedGateButton(): void {
    const button = document.getElementById('selected-gate-toggle') as HTMLButtonElement | null;
    if (!button) return;
    const point = this.selectedCell;
    const cell = point && this.services.state.getCell(point.x, point.y);
    button.hidden = !cell || cell.kind !== 'gate';
    button.disabled = !cell || cell.kind !== 'gate' || this.battleSystem.isActive();
    button.textContent = cell?.kind === 'gate' ? (cell.gateOpen === false ? 'Open Gate' : 'Close Gate') : 'Open Gate';
  }

  private syncSelectionActionUI(): void {
    const card = document.getElementById('selection-action-card');
    if (!card) return;

    const keep = this.selectedKeepId !== null ? this.services.keepSystem.get(this.selectedKeepId) : undefined;
    const cell = this.selectedCell
      ? this.services.state.getCell(this.selectedCell.x, this.selectedCell.y)
      : undefined;
    const bridgeSelected = this.selectedTowerBridgeId !== null && this.towerBridges.has(this.selectedTowerBridgeId);
    const hasSelection = Boolean(keep || cell || bridgeSelected);
    card.hidden = !hasSelection;

    const name = document.getElementById('selection-action-name');
    if (name) {
      name.textContent = keep
        ? `Keep · Level ${this.keepUpgradeLevel(keep)}`
        : bridgeSelected
          ? 'Tower Bridge'
          : cell?.kind === 'tower'
            ? `Tower · Level ${Math.max(1, Math.floor(cell.level ?? 1))}`
            : cell?.kind === 'gate'
              ? `Gate · Level ${Math.max(1, Math.floor(cell.level ?? 1))}`
              : 'Selected Building';
    }

    const rotate = document.getElementById('rotate-selected') as HTMLButtonElement | null;
    const remove = document.getElementById('remove-selected') as HTMLButtonElement | null;
    const rotatable = Boolean(keep || cell?.kind === 'gate' || cell?.kind === 'harbor' || cell?.kind === 'basilica');
    if (rotate) {
      rotate.hidden = !rotatable;
      rotate.disabled = !rotatable || this.battleSystem.isActive();
    }
    if (remove) remove.disabled = !hasSelection || this.battleSystem.isActive();
    this.syncSelectedGateButton();
  }

  private toggleSelectedGate(): void {
    const point = this.selectedCell;
    if (!point || this.battleSystem.isActive()) return;
    const cell = this.services.state.getCell(point.x, point.y);
    if (cell?.kind !== 'gate') return;
    const open = cell.gateOpen === false;
    this.recordHistory();
    this.services.state.updateCell(point.x, point.y, { gateOpen: open });
    this.services.gateSystem.setManualOpen(point.x, point.y, open);
    this.castleBlocksByCell = new Map(this.castleBlockSystem.build(
      this.services.state.entries(), this.stoneStyle, (x, y) => this.terrainElevation(x, y),
    ).blocks.map((block) => [this.key(block.x, block.y), block]));
    const rendered = this.buildObjectsByCell.get(this.key(point.x, point.y));
    if (rendered) rendered.userData.castleBlock = this.castleBlocksByCell.get(this.key(point.x, point.y));
    this.syncSelectedGateButton();
    this.scheduleSave();
    this.setStatus(open ? 'Gate opening' : 'Gate closing');
  }

  private applyWallSettingsToSelected(): void {
    if (!this.selectedCell) return;
    const cell = this.services.state.getCell(this.selectedCell.x, this.selectedCell.y);
    if (!cell || !WALL_KINDS.includes(cell.kind as WallKind)) return;

    this.recordHistory();
    this.services.state.updateCell(this.selectedCell.x, this.selectedCell.y, {
      thickness: this.wallThickness,
      battlement: this.wallBattlement,
      walkway: this.wallWalkway,
    });
    this.redrawCastleNeighborhood([this.selectedCell]);
    this.scheduleSave();
  }

  private towerStyleForLevel(level: number, gx: number, gy: number): { shape: TowerShape; top: TowerTop } {
    const normalized = Math.max(1, Math.min(FORTIFICATION_MAX_LEVEL, Math.floor(level)));
    const styleOffset: Record<StoneStyle, number> = {
      limestone: 0,
      darkStone: 1,
      sandstone: 2,
      frontier: 3,
      whitePlaster: 0,
      earthen: 3,
    };
    const progressions: readonly (readonly TowerShape[])[] = [
      ['round', 'round', 'octagonal', 'square'],
      ['square', 'round', 'square', 'octagonal'],
      ['round', 'octagonal', 'round', 'square'],
      ['watch', 'square', 'round', 'octagonal'],
    ];
    const progression = progressions[(styleOffset[this.stoneStyle] + ((gx + gy) & 1)) % progressions.length];
    const shape = progression[normalized - 1] ?? 'round';
    const requestedTop: TowerTop = normalized <= 2
      ? 'openBattlement'
      : normalized === 3
        ? (shape === 'square' || shape === 'corner' ? 'hipped' : 'conical')
        : (shape === 'square' || shape === 'corner' ? 'pyramidal' : 'conical');

    return { shape, top: this.compatibleTowerTop(shape, requestedTop) };
  }

  private compatibleTowerTop(shape: TowerShape, top: TowerTop): TowerTop {
    const squareLike = shape === 'square' || shape === 'corner';

    if (top === 'roof') return squareLike ? 'hipped' : 'conical';
    if (top === 'battlement') return 'openBattlement';

    if (squareLike && top === 'conical') return 'hipped';
    if (!squareLike && (top === 'hipped' || top === 'pyramidal')) {
      return 'conical';
    }

    return top;
  }

  private applyTowerSettingsToSelected(): void {
    if (!this.selectedCell) return;
    const cell = this.services.state.getCell(this.selectedCell.x, this.selectedCell.y);
    if (!cell || cell.kind !== 'tower') return;

    const compatibleTop = this.compatibleTowerTop(this.towerShape, this.towerTop);
    this.towerTop = compatibleTop;
    const topSelect = document.getElementById('tower-top') as HTMLSelectElement | null;
    if (topSelect) topSelect.value = compatibleTop;

    this.recordHistory();
    this.services.state.updateCell(this.selectedCell.x, this.selectedCell.y, {
      towerShape: this.towerShape,
      towerTop: compatibleTop,
    });
    this.redraw();
    this.scheduleSave();
  }

  private selectKeep(keep: KeepState): void {
    this.selectedKeepId = keep.id;
    this.selectedCell = null;
    this.selectedTowerBridgeId = null;
    this.syncArmyCampUpgradeUI();
    this.keepWidth = keep.width;
    this.keepDepth = keep.depth;
    this.keepFloors = keep.floors;
    this.keepRotation = keep.rotation;
    this.keepCornerTowers = keep.cornerTowers;
    this.keepRoof = keep.roof;
    this.keepBattlements = keep.battlements;

    const setSelect = (id: string, value: string): void => {
      const element = document.getElementById(id) as HTMLSelectElement | null;
      if (element) element.value = value;
    };
    const setCheck = (id: string, value: boolean): void => {
      const element = document.getElementById(id) as HTMLInputElement | null;
      if (element) element.checked = value;
    };

    setSelect('keep-width', String(keep.width));
    setSelect('keep-depth', String(keep.depth));
    setSelect('keep-floors', String(keep.floors));
    setSelect('keep-roof', keep.roof);
    setCheck('keep-corner-towers', keep.cornerTowers);
    setCheck('keep-battlements', keep.battlements);
    this.setStatus(`Selected Keep #${keep.id} · ${keep.width}×${keep.depth} · ${keep.floors} floors`);
  }

  private validateKeepDraft(
    draft: Omit<KeepState, 'id' | 'seed'>,
    ignoreKeepId?: number,
  ): { valid: boolean; reason?: string } {
    return this.services.keepSystem.validate(
      draft,
      SIZE,
      (x, y) => this.terrainAt(x, y),
      (x, y) => this.terrainElevation(x, y),
      (x, y) =>
        Boolean(this.services.state.getCell(x, y)) ||
        this.isStructureFootprintReserved(x, y),
      ignoreKeepId,
    );
  }

  private applyKeepSettingsToSelected(): void {
    if (this.selectedKeepId === null) return;
    const keep = this.services.keepSystem.get(this.selectedKeepId);
    if (!keep) return;

    const draft = {
      x: keep.x,
      y: keep.y,
      width: this.keepWidth,
      depth: this.keepDepth,
      floors: this.keepFloors,
      rotation: keep.rotation,
      cornerTowers: this.keepCornerTowers,
      roof: this.keepRoof,
      battlements: this.keepBattlements,
    };

    const validation = this.validateKeepDraft(draft, keep.id);
    if (!validation.valid) {
      this.setStatus(validation.reason ?? 'Keep update is not valid here');
      this.selectKeep(keep);
      return;
    }

    this.recordHistory();
    const updated = this.services.keepSystem.update(keep.id, draft);
    if (updated) {
      this.selectKeep(updated);
      this.redraw();
      this.scheduleSave();
    }
  }

  private adjustSelectedKeepFloors(delta: number): void {
    if (this.selectedKeepId === null) {
      this.keepFloors = THREE.MathUtils.clamp(this.keepFloors + delta, 1, 9);
      const floors = document.getElementById('keep-floors') as HTMLSelectElement | null;
      if (floors) floors.value = String(Math.min(9, this.keepFloors));
      this.setStatus(`Keep draft floors: ${this.keepFloors}`);
      return;
    }

    const keep = this.services.keepSystem.get(this.selectedKeepId);
    if (!keep) return;

    this.keepFloors = Math.max(1, keep.floors + delta);
    this.recordHistory();
    const updated = this.services.keepSystem.update(keep.id, { floors: this.keepFloors });
    if (updated) {
      this.selectKeep(updated);
      this.redraw();
      this.scheduleSave();
      this.setStatus(`Keep floors: ${updated.floors}`);
    }
  }

  private rotateSelectedKeep(): void {
    if (this.selectedKeepId === null) {
      this.keepRotation = (this.keepRotation + 1) % 4;
      this.setStatus(`Keep draft rotation: ${this.keepRotation * 90}°`);
      return;
    }

    const keep = this.services.keepSystem.get(this.selectedKeepId);
    if (!keep) return;

    const nextRotation = (keep.rotation + 1) % 4;
    const draft = {
      x: keep.x,
      y: keep.y,
      width: keep.width,
      depth: keep.depth,
      floors: keep.floors,
      rotation: nextRotation,
      cornerTowers: keep.cornerTowers,
      roof: keep.roof,
      battlements: keep.battlements,
    };
    const validation = this.validateKeepDraft(draft, keep.id);
    if (!validation.valid) {
      this.setStatus(validation.reason ?? 'Keep cannot rotate here');
      return;
    }

    this.recordHistory();
    const updated = this.services.keepSystem.update(keep.id, { rotation: nextRotation });
    if (updated) {
      this.selectKeep(updated);
      this.redraw();
      this.scheduleSave();
    }
  }

  private removeSelected(): void {
    if (this.battleSystem.isActive()) {
      this.setStatus('Finish or reset the battle before editing buildings');
      return;
    }

    if (this.selectedTowerBridgeId !== null) {
      this.removeSelectedTowerBridge();
      this.syncArmyCampUpgradeUI();
      return;
    }

    if (this.selectedKeepId !== null) {
      this.removeSelectedKeep();
      this.syncArmyCampUpgradeUI();
      return;
    }

    if (!this.selectedCell) {
      this.setStatus('Select a building first');
      return;
    }

    const point = this.selectedCell;
    const cell = this.services.state.getCell(point.x, point.y);
    if (!cell) {
      this.setStatus('Select a building first');
      this.syncArmyCampUpgradeUI();
      return;
    }

    this.recordHistory();
    if (cell.kind === 'tower') this.removeTowerBridgesAt(point.x, point.y);
    this.services.state.removeCell(point.x, point.y);
    this.selectedCell = null;
    this.redraw();
    this.scheduleSave();
    this.syncArmyCampUpgradeUI();
    audioEvents.emit({ action: 'play_sfx', assetId: 'building.destroyed' });
    this.setStatus('Building removed · Undo available');
  }

  private removeSelectedKeep(): void {
    if (this.selectedKeepId === null) {
      this.setStatus('Select a Keep first');
      return;
    }

    this.recordHistory();
    this.services.keepSystem.remove(this.selectedKeepId);
    this.selectedKeepId = null;
    this.redraw();
    this.scheduleSave();
    this.setStatus('Keep removed');
  }

  private keepUpgradeLevel(keep: KeepState): number {
    if (keep.floors >= 5 || keep.width >= 5 || keep.depth >= 5) return 4;
    if (keep.floors >= 4 || keep.width >= 4 || keep.depth >= 4) return 3;
    if (keep.floors >= 3) return 2;
    return 1;
  }

  private keepDraftForLevel(
    gx: number,
    gy: number,
    level: number,
    rotation = this.keepRotation,
  ): Omit<KeepState, 'id' | 'seed'> {
    const normalized = Math.max(1, Math.min(FORTIFICATION_MAX_LEVEL, Math.floor(level)));
    const preset = KEEP_UPGRADE_PRESETS[normalized - 1];
    return {
      x: gx,
      y: gy,
      width: preset.width,
      depth: preset.depth,
      floors: preset.floors,
      rotation,
      cornerTowers: preset.cornerTowers,
      roof: preset.roof,
      battlements: preset.battlements,
    };
  }

  private keepDraftForPlacement(gx: number, gy: number): Omit<KeepState, 'id' | 'seed'> {
    return this.keepDraftForLevel(gx, gy, 1);
  }

  private placeKeep(gx: number, gy: number): void {
    const existing = this.services.keepSystem.findAtCell(gx, gy);
    if (existing) {
      this.selectKeep(existing);
      return;
    }

    const draft = this.keepDraftForPlacement(gx, gy);

    const validation = this.validateKeepDraft(draft);
    if (!validation.valid) {
      this.setStatus(validation.reason ?? 'Invalid Keep placement');
      return;
    }

    const keepCostUnits = Math.max(1, Math.ceil((draft.width * draft.depth * draft.floors) / 6));
    if (!this.ensureConstructionAffordable('keep', keepCostUnits)) return;

    this.recordHistory();
    const keep = this.services.keepSystem.add(draft);
    this.spendConstructionCost('keep', keepCostUnits);
    this.selectKeep(keep);
    this.redraw();
    this.startConstruction(`keep:${keep.id}`, 1450);
    this.scheduleSave();
    this.setStatus(`Keep built · ${keep.width}×${keep.depth} · ${keep.floors} floors · details generated automatically`);
  }

  private fortificationLevelDefinition(kind: FortificationUpgradeKind, level: number): FortificationUpgradeLevel {
    const normalized = Math.max(1, Math.min(FORTIFICATION_MAX_LEVEL, Math.floor(level)));
    return FORTIFICATION_UPGRADE_LEVELS[kind][normalized - 1];
  }

  private syncFortificationUpgradeUI(): void {
    const card = document.getElementById('fortification-upgrade-card');
    if (!card) return;

    let kind: FortificationUpgradeKind | undefined;
    let level = 1;

    if (this.selectedTowerBridgeId !== null) {
      const bridge = this.towerBridges.get(this.selectedTowerBridgeId);
      if (bridge) {
        kind = 'towerBridge';
        level = Math.max(1, Math.min(FORTIFICATION_MAX_LEVEL, Math.floor(bridge.level ?? 1)));
      } else {
        this.selectedTowerBridgeId = null;
      }
    }

    if (!kind && this.selectedKeepId !== null) {
      const keep = this.services.keepSystem.get(this.selectedKeepId);
      if (keep) {
        kind = 'keep';
        level = this.keepUpgradeLevel(keep);
      } else {
        this.selectedKeepId = null;
      }
    }

    if (!kind && this.selectedCell) {
      const cell = this.services.state.getCell(this.selectedCell.x, this.selectedCell.y);
      if (cell?.kind === 'tower' || cell?.kind === 'gate') {
        kind = cell.kind;
        level = Math.max(1, Math.min(FORTIFICATION_MAX_LEVEL, Math.floor(cell.level ?? 1)));
      }
    }

    card.hidden = !kind;
    if (!kind) return;

    const definition = this.fortificationLevelDefinition(kind, level);
    const next = level < FORTIFICATION_MAX_LEVEL
      ? this.fortificationLevelDefinition(kind, level + 1)
      : undefined;
    const labels: Record<FortificationUpgradeKind, string> = {
      tower: 'Tower',
      gate: 'Gate',
      towerBridge: 'Tower Bridge',
      keep: 'Keep',
    };
    const eyebrowLabels: Record<FortificationUpgradeKind, string> = {
      tower: 'SELECTED TOWER',
      gate: 'SELECTED GATE',
      towerBridge: 'SELECTED TOWER BRIDGE',
      keep: 'SELECTED KEEP',
    };
    const type = document.getElementById('fortification-upgrade-type');
    const name = document.getElementById('fortification-upgrade-name');
    const badge = document.getElementById('fortification-upgrade-badge');
    const description = document.getElementById('fortification-upgrade-description');
    const button = document.getElementById('fortification-upgrade-button') as HTMLButtonElement | null;
    const removeButton = document.getElementById('fortification-remove-bridge-button') as HTMLButtonElement | null;

    if (type) type.textContent = eyebrowLabels[kind];
    if (name) name.textContent = `${definition.name} · Level ${level}`;
    if (badge) badge.textContent = `${level} / ${FORTIFICATION_MAX_LEVEL}`;
    if (description) {
      description.textContent = next
        ? `${definition.description} Next: ${next.name}.`
        : `${definition.description} Maximum upgrade level reached.`;
    }

    card.querySelectorAll<HTMLElement>('[data-fortification-level]').forEach((step) => {
      const stepLevel = Number(step.dataset.fortificationLevel ?? 0);
      step.classList.toggle('is-complete', stepLevel <= level);
      step.classList.toggle('is-current', stepLevel === level);
    });

    if (button) {
      button.disabled = !next || this.battleSystem.isActive();
      button.textContent = next
        ? `Upgrade ${labels[kind]} to Level ${next.level} · ${next.name}`
        : 'Maximum Level';
    }
    if (removeButton) {
      removeButton.hidden = kind !== 'towerBridge';
      removeButton.disabled = this.battleSystem.isActive();
    }
  }

  private upgradeSelectedFortification(): void {
    if (this.battleSystem.isActive()) {
      this.setStatus('Finish or reset the battle before upgrading fortifications');
      return;
    }

    if (this.selectedTowerBridgeId !== null) {
      const bridge = this.towerBridges.get(this.selectedTowerBridgeId);
      if (!bridge) {
        this.selectedTowerBridgeId = null;
        this.syncFortificationUpgradeUI();
        this.setStatus('Select a Tower Bridge first');
        return;
      }

      const currentLevel = Math.max(1, Math.min(FORTIFICATION_MAX_LEVEL, Math.floor(bridge.level ?? 1)));
      if (currentLevel >= FORTIFICATION_MAX_LEVEL) {
        this.setStatus('Tower Bridge is already at Level 4 · Royal Tower Bridge');
        this.syncFortificationUpgradeUI();
        return;
      }

      const nextLevel = currentLevel + 1;
      this.recordHistory();
      this.towerBridges.set(bridge.id, { ...bridge, level: nextLevel });
      this.redraw();
      this.scheduleSave();
      audioEvents.emit({ action: 'play_sfx', assetId: 'building.upgrade' });
      this.setStatus(`Tower Bridge upgraded to Level ${nextLevel} · ${this.fortificationLevelDefinition('towerBridge', nextLevel).name}`);
      return;
    }

    if (this.selectedKeepId !== null) {
      const keep = this.services.keepSystem.get(this.selectedKeepId);
      if (!keep) {
        this.selectedKeepId = null;
        this.syncArmyCampUpgradeUI();
        this.setStatus('Select a Keep first');
        return;
      }

      const currentLevel = this.keepUpgradeLevel(keep);
      if (currentLevel >= FORTIFICATION_MAX_LEVEL) {
        this.setStatus('Keep is already at Level 4 · Royal Keep');
        this.syncArmyCampUpgradeUI();
        return;
      }

      const nextLevel = currentLevel + 1;
      const draft = this.keepDraftForLevel(keep.x, keep.y, nextLevel, keep.rotation);
      const validation = this.validateKeepDraft(draft, keep.id);
      if (!validation.valid) {
        this.setStatus(validation.reason ?? 'Clear more space around the Keep before upgrading');
        return;
      }

      this.recordHistory();
      const updated = this.services.keepSystem.update(keep.id, draft);
      if (updated) {
        this.selectKeep(updated);
        this.redraw();
        this.scheduleSave();
        audioEvents.emit({ action: 'play_sfx', assetId: 'building.upgrade' });
      this.setStatus(`Keep upgraded to Level ${nextLevel} · ${this.fortificationLevelDefinition('keep', nextLevel).name}`);
      }
      return;
    }

    if (!this.selectedCell) {
      this.setStatus('Select a Tower, Gate, Keep, or Tower Bridge first');
      return;
    }

    const cell = this.services.state.getCell(this.selectedCell.x, this.selectedCell.y);
    if (!cell || (cell.kind !== 'tower' && cell.kind !== 'gate')) {
      this.setStatus('Select a Tower, Gate, Keep, or Tower Bridge first');
      this.syncFortificationUpgradeUI();
      return;
    }

    const kind = cell.kind as 'tower' | 'gate';
    const currentLevel = Math.max(1, Math.min(FORTIFICATION_MAX_LEVEL, Math.floor(cell.level ?? 1)));
    if (currentLevel >= FORTIFICATION_MAX_LEVEL) {
      this.setStatus(`${kind === 'tower' ? 'Tower' : 'Gate'} is already at Level 4 · ${this.fortificationLevelDefinition(kind, 4).name}`);
      this.syncFortificationUpgradeUI();
      return;
    }

    const nextLevel = currentLevel + 1;
    this.recordHistory();
    if (kind === 'tower') {
      const style = this.towerStyleForLevel(nextLevel, this.selectedCell.x, this.selectedCell.y);
      this.services.state.updateCell(this.selectedCell.x, this.selectedCell.y, {
        level: nextLevel,
        towerShape: style.shape,
        towerTop: style.top,
      });
    } else {
      this.services.state.setLevel(this.selectedCell.x, this.selectedCell.y, nextLevel);
    }
    this.redraw();
    this.scheduleSave();
    audioEvents.emit({ action: 'play_sfx', assetId: 'building.upgrade' });
    this.setStatus(
      `${kind === 'tower' ? 'Tower' : 'Gate'} upgraded to Level ${nextLevel} · ${this.fortificationLevelDefinition(kind, nextLevel).name}`,
    );
  }

  private removeSelectedTowerBridge(): void {
    if (this.battleSystem.isActive()) {
      this.setStatus('Finish or reset the battle before removing the Tower Bridge');
      return;
    }
    if (this.selectedTowerBridgeId === null || !this.towerBridges.has(this.selectedTowerBridgeId)) {
      this.selectedTowerBridgeId = null;
      this.syncFortificationUpgradeUI();
      this.setStatus('Select a Tower Bridge first');
      return;
    }

    this.recordHistory();
    this.towerBridges.delete(this.selectedTowerBridgeId);
    this.selectedTowerBridgeId = null;
    this.redraw();
    this.scheduleSave();
    audioEvents.emit({ action: 'play_sfx', assetId: 'building.destroyed' });
    this.setStatus('Tower Bridge removed · Undo available');
  }

  private carpenterLevelDefinition(level: number): (typeof CARPENTER_LEVELS)[number] {
    const normalized = Math.max(1, Math.min(CARPENTER_MAX_LEVEL, Math.floor(level)));
    return CARPENTER_LEVELS[normalized - 1];
  }

  private syncCarpenterUpgradeUI(): void {
    const card = document.getElementById('carpenter-upgrade-card');
    if (!card) return;

    const cell = this.selectedCell
      ? this.services.state.getCell(this.selectedCell.x, this.selectedCell.y)
      : undefined;
    const selected = cell?.kind === 'carpenter' ? cell : undefined;
    card.hidden = !selected;
    if (!selected) return;

    const level = Math.max(1, Math.min(CARPENTER_MAX_LEVEL, selected.level ?? 1));
    const definition = this.carpenterLevelDefinition(level);
    const next = level < CARPENTER_MAX_LEVEL ? this.carpenterLevelDefinition(level + 1) : undefined;
    const name = document.getElementById('carpenter-upgrade-name');
    const badge = document.getElementById('carpenter-upgrade-badge');
    const description = document.getElementById('carpenter-upgrade-description');
    const button = document.getElementById('carpenter-upgrade-button') as HTMLButtonElement | null;

    if (name) name.textContent = `${definition.name} · Level ${level}`;
    if (badge) badge.textContent = `${level} / ${CARPENTER_MAX_LEVEL}`;
    if (description) {
      const outputRate = (definition.inputPerSecond * definition.yieldRatio).toFixed(2);
      description.textContent = next
        ? `${definition.description} ${definition.workers} workers · up to ${outputRate} Wood/s. Next: ${next.name}.`
        : `${definition.description} ${definition.workers} workers · up to ${outputRate} Wood/s. Maximum building level reached.`;
    }

    card.querySelectorAll<HTMLElement>('[data-carpenter-level]').forEach((step) => {
      const stepLevel = Number(step.dataset.carpenterLevel ?? 0);
      step.classList.toggle('is-complete', stepLevel <= level);
      step.classList.toggle('is-current', stepLevel === level);
    });

    if (button) {
      button.disabled = !next || this.battleSystem.isActive();
      button.textContent = next ? `Upgrade to Level ${next.level} · ${next.name}` : 'Maximum Level';
    }
  }

  private upgradeSelectedCarpenter(): void {
    if (this.battleSystem.isActive()) {
      this.setStatus('Finish or reset the battle before upgrading the Carpenter Workshop');
      return;
    }
    if (!this.selectedCell) {
      this.setStatus('Select a Carpenter Workshop first');
      return;
    }

    const cell = this.services.state.getCell(this.selectedCell.x, this.selectedCell.y);
    if (!cell || cell.kind !== 'carpenter') {
      this.setStatus('Select a Carpenter Workshop first');
      this.syncCarpenterUpgradeUI();
      return;
    }

    const currentLevel = Math.max(1, Math.min(CARPENTER_MAX_LEVEL, cell.level ?? 1));
    if (currentLevel >= CARPENTER_MAX_LEVEL) {
      this.setStatus('Carpenter Workshop is already at Level 3 · Master Carpenter Guild');
      this.syncCarpenterUpgradeUI();
      return;
    }

    const nextLevel = currentLevel + 1;
    this.recordHistory();
    this.services.state.setLevel(this.selectedCell.x, this.selectedCell.y, nextLevel);
    this.services.populationSystem.reconcile(this.services.state.entries());
    this.redraw();
    this.syncEconomyUI();
    this.updatePopulationUI();
    this.scheduleSave();
    audioEvents.emit({ action: 'play_sfx', assetId: 'building.upgrade' });
      this.setStatus(`Carpenter Workshop upgraded to Level ${nextLevel} · ${this.carpenterLevelDefinition(nextLevel).name}`);
  }

  private harborLevelDefinition(level: number): (typeof HARBOR_LEVELS)[number] {
    const normalized = Math.max(1, Math.min(HARBOR_MAX_LEVEL, Math.floor(level)));
    return HARBOR_LEVELS[normalized - 1];
  }

  private syncHarborUpgradeUI(): void {
    const card = document.getElementById('harbor-upgrade-card');
    if (!card) return;

    const cell = this.selectedCell
      ? this.services.state.getCell(this.selectedCell.x, this.selectedCell.y)
      : undefined;
    const selectedHarbor = cell?.kind === 'harbor' ? cell : undefined;
    card.hidden = !selectedHarbor;
    if (!selectedHarbor) return;

    const level = Math.max(1, Math.min(HARBOR_MAX_LEVEL, selectedHarbor.level ?? 1));
    const definition = this.harborLevelDefinition(level);
    const next = level < HARBOR_MAX_LEVEL ? this.harborLevelDefinition(level + 1) : undefined;
    const name = document.getElementById('harbor-upgrade-name');
    const badge = document.getElementById('harbor-upgrade-badge');
    const description = document.getElementById('harbor-upgrade-description');
    const button = document.getElementById('harbor-upgrade-button') as HTMLButtonElement | null;

    if (name) name.textContent = `${definition.name} · Level ${level}`;
    if (badge) badge.textContent = `${level} / ${HARBOR_MAX_LEVEL}`;
    if (description) {
      description.textContent = next
        ? `${definition.description} Next: ${next.name}.`
        : `${definition.description} Maximum harbor level reached.`;
    }

    card.querySelectorAll<HTMLElement>('[data-harbor-level]').forEach((step) => {
      const stepLevel = Number(step.dataset.harborLevel ?? 0);
      step.classList.toggle('is-complete', stepLevel <= level);
      step.classList.toggle('is-current', stepLevel === level);
    });

    if (button) {
      button.disabled = !next || this.battleSystem.isActive();
      button.textContent = next
        ? `Upgrade to Level ${next.level} · ${next.name}`
        : 'Maximum Level';
    }
  }

  private upgradeSelectedHarbor(): void {
    if (this.battleSystem.isActive()) {
      this.setStatus('Finish or reset the battle before upgrading the Harbor');
      return;
    }
    if (!this.selectedCell) {
      this.setStatus('Select a Harbor first');
      return;
    }

    const cell = this.services.state.getCell(this.selectedCell.x, this.selectedCell.y);
    if (!cell || cell.kind !== 'harbor') {
      this.setStatus('Select a Harbor first');
      this.syncHarborUpgradeUI();
      return;
    }

    const currentLevel = Math.max(1, Math.min(HARBOR_MAX_LEVEL, cell.level ?? 1));
    if (currentLevel >= HARBOR_MAX_LEVEL) {
      this.setStatus('Harbor is already at Level 4 · Grand Harbor');
      this.syncHarborUpgradeUI();
      return;
    }

    const nextLevel = currentLevel + 1;
    this.recordHistory();
    this.services.state.updateCell(this.selectedCell.x, this.selectedCell.y, {
      level: nextLevel,
      shipKind: this.maritimeSystem.defaultShipForLevel(nextLevel),
    });
    this.redraw();
    this.scheduleSave();
    audioEvents.emit({ action: 'play_sfx', assetId: 'building.upgrade' });
      this.setStatus(`Harbor upgraded to Level ${nextLevel} · ${this.harborLevelDefinition(nextLevel).name}`);
  }

  private agricultureLevelDefinition(kind: AgricultureUpgradeKind, level: number): AgricultureUpgradeLevel {
    const normalized = Math.max(1, Math.min(AGRICULTURE_MAX_LEVEL, Math.floor(level)));
    return AGRICULTURE_UPGRADE_LEVELS[kind][normalized - 1];
  }

  private syncAgricultureUpgradeUI(): void {
    const card = document.getElementById('agriculture-upgrade-card');
    if (!card) return;

    const cell = this.selectedCell
      ? this.services.state.getCell(this.selectedCell.x, this.selectedCell.y)
      : undefined;
    const selectedBuilding =
      cell?.kind === 'farm' || cell?.kind === 'cowBarn'
        ? cell
        : undefined;

    card.hidden = !selectedBuilding;
    if (!selectedBuilding) return;

    const kind = selectedBuilding.kind as AgricultureUpgradeKind;
    const level = Math.max(1, Math.min(AGRICULTURE_MAX_LEVEL, selectedBuilding.level ?? 1));
    const definition = this.agricultureLevelDefinition(kind, level);
    const next = level < AGRICULTURE_MAX_LEVEL
      ? this.agricultureLevelDefinition(kind, level + 1)
      : undefined;
    const type = document.getElementById('agriculture-upgrade-type');
    const name = document.getElementById('agriculture-upgrade-name');
    const badge = document.getElementById('agriculture-upgrade-badge');
    const description = document.getElementById('agriculture-upgrade-description');
    const button = document.getElementById('agriculture-upgrade-button') as HTMLButtonElement | null;
    const buildingLabel = kind === 'farm' ? 'Farm' : 'Cow Barn';

    if (type) type.textContent = kind === 'farm' ? 'SELECTED FARM' : 'SELECTED COW BARN';
    if (name) name.textContent = `${definition.name} · Level ${level}`;
    if (badge) badge.textContent = `${level} / ${AGRICULTURE_MAX_LEVEL}`;
    if (description) {
      description.textContent = next
        ? `${definition.description} Next: ${next.name}.`
        : `${definition.description} Maximum building level reached.`;
    }
    card.querySelectorAll<HTMLElement>('[data-agriculture-level]').forEach((step) => {
      const stepLevel = Number(step.dataset.agricultureLevel ?? 0);
      step.classList.toggle('is-complete', stepLevel <= level);
      step.classList.toggle('is-current', stepLevel === level);
    });
    if (button) {
      button.disabled = !next || this.battleSystem.isActive();
      button.textContent = next
        ? `Upgrade ${buildingLabel} to Level ${next.level} · ${next.name}`
        : 'Maximum Level';
    }
  }

  private upgradeSelectedAgricultureBuilding(): void {
    if (this.battleSystem.isActive()) {
      this.setStatus('Finish or reset the battle before upgrading agriculture buildings');
      return;
    }
    if (!this.selectedCell) {
      this.setStatus('Select a Farm or Cow Barn first');
      return;
    }

    const cell = this.services.state.getCell(this.selectedCell.x, this.selectedCell.y);
    if (!cell || (cell.kind !== 'farm' && cell.kind !== 'cowBarn')) {
      this.setStatus('Select a Farm or Cow Barn first');
      this.syncAgricultureUpgradeUI();
      return;
    }

    const kind = cell.kind as AgricultureUpgradeKind;
    const currentLevel = Math.max(1, Math.min(AGRICULTURE_MAX_LEVEL, cell.level ?? 1));
    if (currentLevel >= AGRICULTURE_MAX_LEVEL) {
      this.setStatus(`${kind === 'farm' ? 'Farm' : 'Cow Barn'} is already at Level 4`);
      this.syncAgricultureUpgradeUI();
      return;
    }

    const nextLevel = currentLevel + 1;
    this.recordHistory();
    this.services.state.setLevel(this.selectedCell.x, this.selectedCell.y, nextLevel);
    this.redraw();
    this.scheduleSave();
    audioEvents.emit({ action: 'play_sfx', assetId: 'building.upgrade' });
    this.setStatus(
      `${kind === 'farm' ? 'Farm' : 'Cow Barn'} upgraded to Level ${nextLevel} · ${this.agricultureLevelDefinition(kind, nextLevel).name}`,
    );
  }

  private armyCampLevelDefinition(level: number): (typeof ARMY_CAMP_LEVELS)[number] {
    const normalized = Math.max(1, Math.min(ARMY_CAMP_MAX_LEVEL, Math.floor(level)));
    return ARMY_CAMP_LEVELS[normalized - 1];
  }

  private syncArmyCampUpgradeUI(): void {
    this.syncFortificationUpgradeUI();
    this.syncSelectionActionUI();
    this.syncAgricultureUpgradeUI();
    this.syncCarpenterUpgradeUI();
    this.syncHarborUpgradeUI();
    const card = document.getElementById('army-camp-upgrade-card');
    if (!card) return;

    const cell = this.selectedCell
      ? this.services.state.getCell(this.selectedCell.x, this.selectedCell.y)
      : undefined;
    const selectedCamp = cell?.kind === 'armyCamp' ? cell : undefined;
    card.hidden = !selectedCamp;
    if (!selectedCamp) return;

    const level = Math.max(1, Math.min(ARMY_CAMP_MAX_LEVEL, selectedCamp.level ?? 1));
    const definition = this.armyCampLevelDefinition(level);
    const next = level < ARMY_CAMP_MAX_LEVEL ? this.armyCampLevelDefinition(level + 1) : undefined;
    const name = document.getElementById('army-camp-upgrade-name');
    const badge = document.getElementById('army-camp-upgrade-badge');
    const description = document.getElementById('army-camp-upgrade-description');
    const button = document.getElementById('army-camp-upgrade-button') as HTMLButtonElement | null;

    if (name) name.textContent = `${definition.name} · Level ${level}`;
    if (badge) badge.textContent = `${level} / ${ARMY_CAMP_MAX_LEVEL}`;
    if (description) {
      description.textContent = next
        ? `${definition.description} Next: ${next.name}.`
        : `${definition.description} Maximum building level reached.`;
    }
    card.querySelectorAll<HTMLElement>('[data-camp-level]').forEach((step) => {
      const stepLevel = Number(step.dataset.campLevel ?? 0);
      step.classList.toggle('is-complete', stepLevel <= level);
      step.classList.toggle('is-current', stepLevel === level);
    });
    if (button) {
      button.disabled = !next || this.battleSystem.isActive();
      button.textContent = next ? `Upgrade to Level ${next.level} · ${next.name}` : 'Maximum Level';
    }
  }

  private upgradeSelectedArmyCamp(): void {
    if (this.battleSystem.isActive()) {
      this.setStatus('Finish or reset the battle before upgrading the Army Camp');
      return;
    }
    if (!this.selectedCell) {
      this.setStatus('Select an Army Camp first');
      return;
    }

    const cell = this.services.state.getCell(this.selectedCell.x, this.selectedCell.y);
    if (!cell || cell.kind !== 'armyCamp') {
      this.setStatus('Select an Army Camp first');
      this.syncArmyCampUpgradeUI();
      return;
    }

    const currentLevel = Math.max(1, Math.min(ARMY_CAMP_MAX_LEVEL, cell.level ?? 1));
    if (currentLevel >= ARMY_CAMP_MAX_LEVEL) {
      this.setStatus('Army Camp is already at Level 4');
      this.syncArmyCampUpgradeUI();
      return;
    }

    const nextLevel = currentLevel + 1;
    this.recordHistory();
    this.services.state.setLevel(this.selectedCell.x, this.selectedCell.y, nextLevel);
    if (nextLevel > this.militaryTier) {
      this.militaryTier = normalizeMilitaryTier(nextLevel);
      this.syncMilitaryUI();
    }
    this.redraw();
    this.scheduleSave();
    audioEvents.emit({ action: 'play_sfx', assetId: 'building.upgrade' });
      this.setStatus(`Army Camp upgraded to Level ${nextLevel} · ${this.armyCampLevelDefinition(nextLevel).name}`);
  }

  private adjustSelectedHeight(delta: number): void {
    if (this.selectedKeepId !== null) {
      this.adjustSelectedKeepFloors(delta);
      return;
    }

    if (!this.selectedCell) {
      this.setStatus('Click a wall or tower first');
      return;
    }

    const cell = this.services.state.getCell(this.selectedCell.x, this.selectedCell.y);
    if (!cell || (!WALL_KINDS.includes(cell.kind as WallKind) && cell.kind !== 'tower')) {
      this.setStatus(
        cell?.kind === 'armyCamp'
          ? 'Use the Army Camp Upgrade button in Build Settings'
          : cell?.kind === 'farm' || cell?.kind === 'cowBarn'
            ? 'Use the agriculture Upgrade button in Build Settings'
            : cell?.kind === 'harbor'
              ? 'Use the Harbor Upgrade button in Build Settings'
              : cell?.kind === 'carpenter'
                ? 'Use the Carpenter Upgrade button in Build Settings'
                : 'Selected tile is not a wall or tower',
      );
      return;
    }

    const currentLevel = Math.max(1, Math.floor(cell.level ?? 1));
    const nextLevel = cell.kind === 'tower'
      ? Math.max(1, Math.min(FORTIFICATION_MAX_LEVEL, currentLevel + delta))
      : Math.max(1, Math.min(MAX_WALL_LEVEL, currentLevel + delta));
    if (nextLevel === currentLevel) {
      this.setStatus(cell.kind === 'tower' ? 'Tower levels are limited to 1–4' : `Wall levels are limited to 1–${MAX_WALL_LEVEL}`);
      return;
    }

    this.recordHistory();
    this.services.state.setLevel(this.selectedCell.x, this.selectedCell.y, nextLevel);
    if (WALL_KINDS.includes(cell.kind as WallKind)) this.redrawCastleNeighborhood([this.selectedCell]);
    else this.redraw();
    this.scheduleSave();
    this.setStatus(`Height level: ${nextLevel}`);
  }

  private applyTemplate(template: string): void {
    const authoredLayoutTemplate = PLAYABLE_LAYOUT_TEMPLATES[template];
    const visualPreset = getTemplateVisualPreset(template);
    this.recordHistory();
    this.stoneStyle = visualPreset.stoneStyle;
    this.towerBridgeKind = visualPreset.towerBridgeKind;
    if (authoredLayoutTemplate) {
      this.worldSeed = authoredLayoutTemplate.seed;
      this.setMapLayoutId(authoredLayoutTemplate.layoutId);
    } else {
      this.worldSeed = 0;
      this.setMapLayoutId('island');
    }
    this.clearSettlementAgents();
    this.services.state.clear();
    this.services.keepSystem.clear();
    this.towerBridges.clear();
    this.nextTowerBridgeId = 1;
    this.selectedTowerBridgeId = null;
    this.towerBridgeStart = null;
    this.towerBridgeHover = null;
    this.clearGroup(this.wallPreviewLayer);
    this.selectedKeepId = null;
    this.terrainOverrides.clear();
    this.elevationOverrides.clear();
    this.moatTasks.clear();
    this.services.economySystem.reset();
    this.services.populationSystem.setState();
    this.missionSystem.reset();
    this.missionRefreshAccumulatorMs = 0;
    this.populationBattleCommitted = false;
    this.populationBattleStart = null;
    this.economySaveAccumulatorMs = 0;
    this.worldSeeded = true;

    const center = Math.floor(SIZE / 2);
    const place = (
      x: number,
      y: number,
      kind: TileKind,
      level = 1,
      options: Partial<GridCell> = {},
    ): void => {
      this.services.state.setCell(x, y, kind, level, options);
    };

    const placeKeepTemplate = (
      x: number,
      y: number,
      width: number,
      depth: number,
      floors: number,
      roof: KeepRoofStyle,
      cornerTowers: boolean,
      rotation = 0,
      battlements = true,
    ): void => {
      const draft = {
        x,
        y,
        width,
        depth,
        floors,
        rotation,
        cornerTowers,
        roof,
        battlements,
      };

      for (const footprintCell of this.services.keepSystem.footprint(draft)) {
        this.services.state.removeCell(footprintCell.x, footprintCell.y);
      }

      this.services.keepSystem.add(draft);
    };

    const prepareArea = (
      minX: number,
      minY: number,
      maxX: number,
      maxY: number,
      elevation = 0,
    ): void => {
      for (let y = Math.max(0, minY); y <= Math.min(SIZE - 1, maxY); y += 1) {
        for (let x = Math.max(0, minX); x <= Math.min(SIZE - 1, maxX); x += 1) {
          this.services.state.removeCell(x, y);
          this.terrainOverrides.set(this.key(x, y), 'plains');
          this.setAbsoluteElevation(x, y, elevation);
        }
      }
    };

    const prepareBuildableArea = (
      minX: number,
      minY: number,
      maxX: number,
      maxY: number,
      elevation = 0,
    ): void => {
      for (let y = Math.max(0, minY); y <= Math.min(SIZE - 1, maxY); y += 1) {
        for (let x = Math.max(0, minX); x <= Math.min(SIZE - 1, maxX); x += 1) {
          const baseTerrain = this.baseTerrainAt(x, y);
          if (baseTerrain === 'water' || baseTerrain === 'shore') continue;
          this.services.state.removeCell(x, y);
          this.terrainOverrides.set(this.key(x, y), 'plains');
          this.setAbsoluteElevation(x, y, elevation);
        }
      }
    };

    const placeWallRect = (
      minX: number,
      minY: number,
      maxX: number,
      maxY: number,
      kind: WallKind,
      level: number,
      options: Partial<GridCell>,
    ): void => {
      for (let x = minX; x <= maxX; x += 1) {
        place(x, minY, kind, level, options);
        place(x, maxY, kind, level, options);
      }
      for (let y = minY; y <= maxY; y += 1) {
        place(minX, y, kind, level, options);
        place(maxX, y, kind, level, options);
      }
    };

    const placeWallPath = (
      vertices: readonly GridPoint[],
      kind: WallKind,
      level: number,
      options: Partial<GridCell>,
      closed = false,
    ): GridPoint[] => {
      const path = rasterizeWallPath(vertices, closed);
      for (const point of path) {
        if (point.x < 0 || point.y < 0 || point.x >= SIZE || point.y >= SIZE) continue;
        place(point.x, point.y, kind, level, options);
      }
      return path;
    };

    const addTemplateBridge = (
      a: GridPoint,
      b: GridPoint,
      kind: TowerBridgeKind,
    ): void => {
      if (!this.validateTowerBridge(a, b).valid) return;
      const bridge: TowerBridgeState = {
        id: this.nextTowerBridgeId++,
        ax: a.x,
        ay: a.y,
        bx: b.x,
        by: b.y,
        kind,
        level: 1,
      };
      this.towerBridges.set(bridge.id, bridge);
    };

    const placeHarborTemplate = (
      level: number,
      shipKind: ShipKind,
      targetX: number,
      targetY: number,
    ): GridPoint | null => {
      const normalizedLevel = Math.max(1, Math.min(HARBOR_MAX_LEVEL, Math.floor(level)));
      const candidates: Array<{ point: GridPoint; rotation: number; score: number }> = [];
      for (let y = 1; y < SIZE - 1; y += 1) {
        for (let x = 1; x < SIZE - 1; x += 1) {
          if (this.services.state.getCell(x, y) || this.services.keepSystem.findAtCell(x, y)) continue;
          const coast = this.maritimeSystem.canPlace('harbor', x, y);
          if (!coast) continue;
          candidates.push({
            point: { x, y },
            rotation: coast.rotation,
            score: Math.hypot(x - targetX, y - targetY),
          });
        }
      }
      candidates.sort((a, b) => a.score - b.score);
      const choice = candidates[0];
      if (!choice) return null;

      this.services.state.removeCell(choice.point.x, choice.point.y);
      place(choice.point.x, choice.point.y, 'harbor', normalizedLevel, {
        rotation: choice.rotation,
        shipKind,
      });
      return choice.point;
    };

    if (template !== 'empty-land' && template !== 'urban-city-60x80') this.seedNaturalProps();

    if (template === 'empty-land') {
      for (let y = 0; y < SIZE; y += 1) {
        for (let x = 0; x < SIZE; x += 1) {
          if (this.baseTerrainAt(x, y) !== 'water') {
            this.terrainOverrides.set(this.key(x, y), 'plains');
          }
        }
      }
    } else if (template === 'urban-city-60x80') {
      for (const { x, y, kind, level, ...options } of createUrbanCityTemplate(SIZE)) {
        place(x, y, kind, level, options);
      }
    } else if (template === 'twin-fortresses-90x95') {
      // Two complete, editable fortresses with gates, keeps, roads, camps, and
      // dedicated food, wood, stone, and orchard resources.
      for (let y = 0; y < SIZE; y += 1) {
        for (let x = 0; x < SIZE; x += 1) {
          this.services.state.removeCell(x, y);
          this.terrainOverrides.set(this.key(x, y), 'plains');
          this.elevationOverrides.delete(this.key(x, y));
        }
      }

      const twin = createTwinFortressesTemplate();
      for (const { x, y, kind, level, ...options } of twin.cells) {
        place(x, y, kind, level, options);
      }
      for (const keep of twin.keeps) {
        for (const footprintCell of this.services.keepSystem.footprint(keep)) {
          this.services.state.removeCell(footprintCell.x, footprintCell.y);
        }
        this.services.keepSystem.add(keep);
      }
    } else if (template === 'mainland-frontier') {
      prepareBuildableArea(4, 6, 15, 17, 0.08);
      prepareBuildableArea(8, 18, 10, 20, 0.04);

      placeWallRect(6, 7, 13, 14, 'wall2', 2, {
        battlement: false,
        walkway: true,
        thickness: 'medium',
      });
      place(9, 14, 'gate');
      place(13, 10, 'gate');
      place(6, 7, 'tower', 2, { towerShape: 'watch', towerTop: 'timberRoof' });
      place(13, 7, 'tower', 2, { towerShape: 'square', towerTop: 'timberRoof' });
      place(6, 14, 'tower', 2, { towerShape: 'round', towerTop: 'openBattlement' });
      place(13, 14, 'tower', 2, { towerShape: 'watch', towerTop: 'openBattlement' });
      placeKeepTemplate(9, 10, 3, 3, 3, 'sloped', true);
      place(7, 12, 'cottage');
      place(11, 12, 'house');
      place(9, 12, 'market');
      place(4, 9, 'farm');
      place(4, 12, 'farm');
      place(4, 15, 'cowBarn');
      place(14, 8, 'armyCamp');
      for (let y = 15; y <= 20; y += 1) place(9, y, 'dirtRoad');
      for (let x = 14; x <= 16; x += 1) {
        if (this.baseTerrainAt(x, 10) !== 'water' && this.baseTerrainAt(x, 10) !== 'shore') {
          this.services.state.removeCell(x, 10);
          this.terrainOverrides.set(this.key(x, 10), 'plains');
          place(x, 10, 'dirtRoad');
        }
      }
      placeHarborTemplate(3, 'transportShip', SIZE - 4, center);
    } else if (template === 'coastal-peninsula') {
      prepareBuildableArea(7, 7, 16, 8, 0.16);
      prepareBuildableArea(8, 9, 14, 17, 0.12);

      for (let x = 7; x <= 16; x += 1) {
        place(x, 7, 'wall1', 2, { battlement: true, walkway: true, thickness: 'thick' });
      }
      place(11, 7, 'gate', 2);
      place(7, 7, 'tower', 3, { towerShape: 'round', towerTop: 'conical' });
      place(16, 7, 'tower', 3, { towerShape: 'round', towerTop: 'conical' });
      placeKeepTemplate(11, 11, 3, 3, 4, 'towered', true);
      place(9, 14, 'cottage');
      place(13, 14, 'house');
      place(11, 14, 'market');
      place(8, 16, 'farm');
      place(14, 16, 'farm');
      place(9, 16, 'windmill');
      for (let y = 8; y <= 17; y += 1) {
        if (!this.services.state.getCell(11, y) && !this.services.keepSystem.findAtCell(11, y)) {
          place(11, y, 'stoneRoad');
        }
      }
      placeHarborTemplate(2, 'fishingBoat', 5, center + 2);
      placeHarborTemplate(4, 'tradingBoat', SIZE - 5, center + 2);
    } else if (template === 'split-isles') {
      prepareBuildableArea(4, 8, 9, 12, 0.18);
      prepareBuildableArea(13, 10, 18, 15, 0.1);

      placeWallRect(4, 8, 9, 12, 'wall1', 2, {
        battlement: true,
        walkway: true,
        thickness: 'medium',
      });
      place(6, 12, 'gate');
      place(4, 8, 'tower', 2, { towerShape: 'round', towerTop: 'conical' });
      place(9, 8, 'tower', 2, { towerShape: 'round', towerTop: 'conical' });
      place(4, 12, 'tower', 2, { towerShape: 'square', towerTop: 'openBattlement' });
      place(9, 12, 'tower', 2, { towerShape: 'square', towerTop: 'openBattlement' });
      placeKeepTemplate(6, 10, 2, 2, 3, 'sloped', true);
      place(8, 10, 'armyCamp');
      place(8, 11, 'cottage');

      place(13, 11, 'cottage');
      place(17, 11, 'house');
      place(15, 12, 'market');
      place(13, 14, 'farm');
      place(17, 14, 'farm');
      place(15, 14, 'cowBarn');
      for (let x = 13; x <= 18; x += 1) {
        if (!this.services.state.getCell(x, 13)) place(x, 13, 'dirtRoad');
      }
      placeHarborTemplate(3, 'transportShip', 2, center);
      placeHarborTemplate(4, 'transportShip', SIZE - 3, center + 2);
    } else if (template === 'small-castle') {
      const min = center - 3;
      const max = center + 3;

      for (let x = min; x <= max; x += 1) {
        place(x, min, 'wall1', 2, { battlement: true, walkway: true, thickness: 'medium' });
        place(x, max, 'wall1', 2, { battlement: true, walkway: true, thickness: 'medium' });
      }
      for (let y = min; y <= max; y += 1) {
        place(min, y, 'wall1', 2, { battlement: true, walkway: true, thickness: 'medium' });
        place(max, y, 'wall1', 2, { battlement: true, walkway: true, thickness: 'medium' });
      }

      place(center, max, 'gate');
      place(min, min, 'tower', 2, { towerShape: 'round', towerTop: 'battlement' });
      place(max, min, 'tower', 2, { towerShape: 'square', towerTop: 'roof' });
      place(min, max, 'tower', 2, { towerShape: 'octagonal', towerTop: 'flag' });
      place(max, max, 'tower', 2, { towerShape: 'corner', towerTop: 'battlement' });
      placeKeepTemplate(center, center, 3, 3, 3, 'flatBattlement', true);
      place(center - 2, center, 'house');
      place(center + 2, center, 'cottage');

      for (let y = center + 2; y < max; y += 1) place(center, y, 'road');
    } else if (template === 'motte-bailey') {
      for (let y = center - 4; y <= center + 4; y += 1) {
        for (let x = center - 4; x <= center + 4; x += 1) {
          const distance = Math.hypot(x - center, y - (center - 1));
          if (distance <= 3.7) {
            this.setAbsoluteElevation(
              x,
              y,
              Math.max(this.terrainElevation(x, y), (1 - distance / 4.2) * 2.8),
            );
          }
        }
      }

      const minX = center - 5;
      const maxX = center + 5;
      const minY = center - 4;
      const maxY = center + 5;

      for (let x = minX; x <= maxX; x += 1) {
        place(x, minY, 'wall2', 1, { battlement: false, walkway: true, thickness: 'medium' });
        place(x, maxY, 'wall2', 1, { battlement: false, walkway: true, thickness: 'medium' });
      }
      for (let y = minY; y <= maxY; y += 1) {
        place(minX, y, 'wall2', 1, { battlement: false, walkway: true, thickness: 'medium' });
        place(maxX, y, 'wall2', 1, { battlement: false, walkway: true, thickness: 'medium' });
      }

      place(center, maxY, 'gate');
      placeKeepTemplate(center, center - 1, 2, 2, 5, 'towered', true);
      place(center - 3, center + 2, 'cottage');
      place(center + 3, center + 2, 'farm');
      place(center - 3, center - 2, 'farm');
    } else if (template === 'river-castle') {
      for (let y = 1; y < SIZE - 1; y += 1) {
        const x = center + Math.round(Math.sin(y * 0.45) * 1.15);
        this.terrainOverrides.set(this.key(x, y), 'river');
        if (x + 1 < SIZE) this.terrainOverrides.set(this.key(x + 1, y), 'river');
      }

      const left = center - 6;
      const right = center - 1;
      const top = center - 4;
      const bottom = center + 4;

      for (let x = left; x <= right; x += 1) {
        place(x, top, 'wall1', 2, { battlement: true, walkway: true, thickness: 'thick' });
        place(x, bottom, 'wall1', 2, { battlement: true, walkway: true, thickness: 'thick' });
      }
      for (let y = top; y <= bottom; y += 1) {
        place(left, y, 'wall1', 2, { battlement: true, walkway: true, thickness: 'thick' });
        place(right, y, 'wall1', 2, { battlement: true, walkway: true, thickness: 'thick' });
      }

      place(center - 3, bottom, 'gate');
      place(left, top, 'tower', 3, { towerShape: 'round', towerTop: 'roof' });
      place(right, top, 'tower', 3, { towerShape: 'octagonal', towerTop: 'flag' });
      place(left, bottom, 'tower', 2, { towerShape: 'corner', towerTop: 'battlement' });
      place(right, bottom, 'tower', 2, { towerShape: 'watch', towerTop: 'watch' });
      placeKeepTemplate(center - 4, center, 2, 3, 4, 'sloped', true);
      place(center - 5, center + 2, 'farm');
    } else if (template === 'mountain-valley') {
      this.applyMountainRange(
        { x: 3, y: 3 },
        { x: 5, y: SIZE - 4 },
        true,
      );
      this.applyMountainRange(
        { x: SIZE - 4, y: 3 },
        { x: SIZE - 6, y: SIZE - 4 },
        true,
      );

      for (let y = 4; y < SIZE - 3; y += 1) {
        for (let x = center - 3; x <= center + 3; x += 1) {
          const existing = this.services.state.getCell(x, y);
          if (
            existing &&
            (existing.kind === 'tree' ||
              existing.kind === 'rock' ||
              existing.kind === 'hut' ||
              existing.kind === 'mountain')
          ) {
            this.services.state.removeCell(x, y);
          }
          this.terrainOverrides.set(this.key(x, y), 'plains');
          this.setAbsoluteElevation(x, y, 0.12 + Math.sin((x + y) * 0.4) * 0.08);
        }
      }

      for (let y = 3; y < SIZE - 2; y += 1) {
        const x = center + Math.round(Math.sin(y * 0.52) * 0.7);
        this.services.state.removeCell(x, y);
        this.terrainOverrides.set(this.key(x, y), 'river');
        this.setAbsoluteElevation(x, y, Math.max(0, 0.55 - y * 0.018));
      }

      for (let y = 5; y < SIZE - 4; y += 2) {
        for (const x of [center - 5, center + 5]) {
          if (!this.services.state.getCell(x, y) && this.terrainAt(x, y) !== 'river') {
            place(x, y, 'tree', 1 + ((x + y) % 3));
          }
        }
      }
    } else if (template === 'coastal-kingdom') {
      for (let y = center - 5; y <= center + 5; y += 1) {
        for (let x = center - 4; x <= center + 4; x += 1) {
          if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) continue;
          const existing = this.services.state.getCell(x, y);
          if (
            existing &&
            (existing.kind === 'tree' ||
              existing.kind === 'rock' ||
              existing.kind === 'hut')
          ) {
            this.services.state.removeCell(x, y);
          }
          if (this.baseTerrainAt(x, y) !== 'water') {
            this.terrainOverrides.set(this.key(x, y), 'plains');
            this.setAbsoluteElevation(x, y, Math.max(0, Math.sin(x * 0.42 + y * 0.18) * 0.18));
          }
        }
      }

      for (let y = 3; y < SIZE - 3; y += 1) {
        for (let x = center + 5; x < SIZE; x += 1) {
          if (this.baseTerrainAt(x, y) !== 'shore') continue;
          const existing = this.services.state.getCell(x, y);
          if (
            existing &&
            (existing.kind === 'tree' ||
              existing.kind === 'rock' ||
              existing.kind === 'hut')
          ) {
            this.services.state.removeCell(x, y);
          }
          this.elevationOverrides.delete(this.key(x, y));
        }
      }

      for (let y = 4; y <= center + 3; y += 2) {
        for (let x = 3; x <= center - 4; x += 2) {
          if (!this.services.state.getCell(x, y) && this.terrainAt(x, y) !== 'water') {
            if ((x + y) % 3 !== 0) place(x, y, 'tree', 1 + ((x * 3 + y) % 3));
          }
        }
      }

      for (const hill of [
        { x: center - 4, y: center - 5, h: 1.2 },
        { x: center + 1, y: center - 6, h: 0.8 },
        { x: center - 5, y: center + 5, h: 1.0 },
      ]) {
        for (let oy = -2; oy <= 2; oy += 1) {
          for (let ox = -2; ox <= 2; ox += 1) {
            const distance = Math.hypot(ox, oy);
            if (distance > 2.35) continue;
            const x = hill.x + ox;
            const y = hill.y + oy;
            if (x < 1 || y < 1 || x >= SIZE - 1 || y >= SIZE - 1) continue;
            if (this.terrainAt(x, y) === 'water' || this.terrainAt(x, y) === 'river') continue;
            const height = hill.h * Math.max(0.12, 1 - distance / 2.6);
            this.setAbsoluteElevation(x, y, Math.max(this.terrainElevation(x, y), height));
          }
        }
      }
    } else if (template === 'highland-river') {
      this.applyMountainRange(
        { x: 3, y: 4 },
        { x: SIZE - 4, y: 6 },
        true,
      );

      for (let y = 4; y < SIZE - 1; y += 1) {
        const t = (y - 4) / Math.max(1, SIZE - 6);
        const x =
          center +
          2 +
          Math.round(Math.sin(y * 0.58 + 0.7) * 1.1 - t * 2.1);

        this.services.state.removeCell(x, y);
        this.terrainOverrides.set(this.key(x, y), 'river');
        this.setAbsoluteElevation(
          x,
          y,
          Math.max(0, 2.45 * (1 - t) + Math.sin(y * 0.35) * 0.08),
        );

        if (x + 1 < SIZE && y < center + 1 && y % 3 === 0) {
          this.services.state.removeCell(x + 1, y);
          this.terrainOverrides.set(this.key(x + 1, y), 'river');
          this.setAbsoluteElevation(x + 1, y, Math.max(0, 2.3 * (1 - t)));
        }
      }

      for (let y = center + 2; y <= center + 6; y += 1) {
        for (let x = center - 5; x <= center - 1; x += 1) {
          const existing = this.services.state.getCell(x, y);
          if (
            existing &&
            (existing.kind === 'tree' ||
              existing.kind === 'rock' ||
              existing.kind === 'hut' ||
              existing.kind === 'mountain')
          ) {
            this.services.state.removeCell(x, y);
          }
          this.terrainOverrides.set(this.key(x, y), 'plains');
          this.setAbsoluteElevation(x, y, 0.62 + Math.sin((x + y) * 0.5) * 0.12);
        }
      }

      for (let y = 8; y < SIZE - 4; y += 2) {
        for (const x of [4, 6, SIZE - 6, SIZE - 4]) {
          if (
            !this.services.state.getCell(x, y) &&
            this.terrainAt(x, y) !== 'water' &&
            this.terrainAt(x, y) !== 'river'
          ) {
            const kind = (x + y) % 5 === 0 ? 'rock' : 'tree';
            place(x, y, kind, 1 + ((x + y) % 2));
          }
        }
      }
    } else if (template === 'grand-citadel') {
      prepareArea(center - 9, center - 8, center + 9, center + 8, 0.18);

      const minX = center - 7;
      const maxX = center + 7;
      const minY = center - 6;
      const maxY = center + 6;
      placeWallRect(minX, minY, maxX, maxY, 'wall1', 3, {
        battlement: true,
        walkway: true,
        thickness: 'thick',
      });
      place(center, maxY, 'gate', 2);
      place(minX, minY, 'tower', 3, { towerShape: 'round', towerTop: 'conical' });
      place(maxX, minY, 'tower', 3, { towerShape: 'square', towerTop: 'hipped' });
      place(minX, maxY, 'tower', 3, { towerShape: 'octagonal', towerTop: 'openBattlement' });
      place(maxX, maxY, 'tower', 3, { towerShape: 'corner', towerTop: 'pyramidal' });

      placeKeepTemplate(center, center - 1, 4, 4, 5, 'towered', true, 0, true);

      place(center, center + 3, 'stoneRoad');
      place(center - 2, center + 2, 'manor');
      place(center + 2, center + 2, 'house');
      place(center - 3, center - 3, 'farm');
      place(center + 3, center - 3, 'villa');

      for (let y = center + 1; y < maxY; y += 1) place(center, y, 'stoneRoad');
    } else if (template === 'dark-fortress') {
      prepareArea(center - 10, center - 9, center + 10, center + 9, 0.55);

      for (let y = center - 7; y <= center + 7; y += 1) {
        for (let x = center - 8; x <= center + 8; x += 1) {
          const distance = Math.hypot(x - center, y - center);
          if (distance <= 8.7) {
            this.setAbsoluteElevation(
              x,
              y,
              0.42 + Math.max(0, 1.9 - distance * 0.2),
            );
          }
        }
      }

      placeWallRect(center - 6, center - 5, center + 6, center + 5, 'wall3', 4, {
        battlement: true,
        walkway: true,
        thickness: 'thick',
      });
      place(center, center + 5, 'gate', 3);
      place(center - 6, center - 5, 'tower', 4, { towerShape: 'corner', towerTop: 'pyramidal' });
      place(center + 6, center - 5, 'tower', 4, { towerShape: 'square', towerTop: 'hipped' });
      place(center - 6, center + 5, 'tower', 4, { towerShape: 'watch', towerTop: 'timberRoof' });
      place(center + 6, center + 5, 'tower', 4, { towerShape: 'octagonal', towerTop: 'openBattlement' });
      placeKeepTemplate(center, center - 1, 3, 4, 7, 'defensivePlatform', true, 1, true);

      for (let x = center - 7; x <= center + 7; x += 1) {
        if (x === center) continue;
        place(x, center + 7, 'moat');
      }

      place(center, center + 6, 'stoneRoad');
    } else if (template === 'sandstone-oasis') {
      prepareArea(center - 10, center - 8, center + 10, center + 8, 0.05);

      const minX = center - 7;
      const maxX = center + 7;
      const minY = center - 5;
      const maxY = center + 5;
      placeWallRect(minX, minY, maxX, maxY, 'wall1', 2, {
        battlement: true,
        walkway: true,
        thickness: 'thin',
      });
      place(center, maxY, 'gate');
      place(minX, minY, 'tower', 2, { towerShape: 'round', towerTop: 'conical' });
      place(maxX, minY, 'tower', 2, { towerShape: 'round', towerTop: 'conical' });
      place(minX, maxY, 'tower', 2, { towerShape: 'square', towerTop: 'hipped' });
      place(maxX, maxY, 'tower', 2, { towerShape: 'square', towerTop: 'pyramidal' });
      placeKeepTemplate(center, center - 1, 3, 3, 3, 'sloped', false, 0, false);

      for (let y = center - 2; y <= center + 2; y += 1) {
        this.terrainOverrides.set(this.key(center + 4, y), 'river');
      }
      place(center - 3, center + 1, 'cottage');
      place(center - 1, center + 2, 'farm');
      place(center + 2, center + 2, 'farm');
      place(center + 3, center - 2, 'hut');
      for (let x = center - 4; x <= center + 3; x += 1) {
        if (!this.services.state.getCell(x, center + 3)) place(x, center + 3, 'dirtRoad');
      }
    } else if (template === 'frontier-outpost') {
      prepareArea(center - 10, center - 8, center + 10, center + 8, 0.12);

      placeWallRect(center - 7, center - 5, center + 7, center + 5, 'wall2', 2, {
        battlement: false,
        walkway: true,
        thickness: 'medium',
      });
      place(center, center + 5, 'gate');
      place(center - 7, center - 5, 'tower', 2, { towerShape: 'watch', towerTop: 'timberRoof' });
      place(center + 7, center - 5, 'tower', 2, { towerShape: 'watch', towerTop: 'watch' });
      place(center - 7, center + 5, 'tower', 2, { towerShape: 'round', towerTop: 'timberRoof' });
      place(center + 7, center + 5, 'tower', 2, { towerShape: 'square', towerTop: 'flat' });
      placeKeepTemplate(center, center - 1, 2, 3, 3, 'towered', false, 1, false);

      place(center - 3, center + 1, 'hut');
      place(center - 1, center + 2, 'cottage');
      place(center + 2, center + 2, 'farm');
      place(center + 4, center - 1, 'tree', 2);
      place(center + 5, center - 2, 'rock', 2);
      for (let y = center + 1; y < center + 5; y += 1) place(center, y, 'dirtRoad');

    } else if (template === 'bridge-stronghold') {
      prepareArea(center - 11, center - 8, center + 11, center + 8, 0.22);

      const towers = [
        { x: center - 7, y: center - 4, shape: 'round' as TowerShape, top: 'conical' as TowerTop },
        { x: center, y: center - 4, shape: 'octagonal' as TowerShape, top: 'openBattlement' as TowerTop },
        { x: center + 7, y: center - 4, shape: 'round' as TowerShape, top: 'conical' as TowerTop },
        { x: center - 7, y: center + 4, shape: 'square' as TowerShape, top: 'hipped' as TowerTop },
        { x: center, y: center + 4, shape: 'corner' as TowerShape, top: 'pyramidal' as TowerTop },
        { x: center + 7, y: center + 4, shape: 'watch' as TowerShape, top: 'timberRoof' as TowerTop },
      ];
      for (const tower of towers) {
        place(tower.x, tower.y, 'tower', 3, {
          towerShape: tower.shape,
          towerTop: tower.top,
        });
      }

      addTemplateBridge(towers[0], towers[1], 'stone');
      addTemplateBridge(towers[1], towers[2], 'wood');
      addTemplateBridge(towers[3], towers[4], 'wood');
      addTemplateBridge(towers[4], towers[5], 'stone');

      placeWallRect(center - 9, center - 6, center + 9, center + 6, 'wall1', 2, {
        battlement: true,
        walkway: true,
        thickness: 'medium',
      });
      place(center, center + 6, 'gate');
      placeKeepTemplate(center, center, 3, 3, 4, 'flatBattlement', true);

      for (let y = center + 2; y < center + 6; y += 1) place(center, y, 'stoneRoad');
    } else if (template === 'siege-academy') {
      prepareArea(center - 12, center - 9, center + 12, center + 9, 0);

      placeWallRect(center - 7, center - 5, center + 7, center + 5, 'wall3', 3, {
        battlement: true,
        walkway: true,
        thickness: 'thick',
      });
      place(center, center + 5, 'gate', 2);
      place(center - 7, center - 5, 'tower', 3, { towerShape: 'round', towerTop: 'openBattlement' });
      place(center + 7, center - 5, 'tower', 3, { towerShape: 'square', towerTop: 'hipped' });
      place(center - 7, center + 5, 'tower', 3, { towerShape: 'corner', towerTop: 'openBattlement' });
      place(center + 7, center + 5, 'tower', 3, { towerShape: 'watch', towerTop: 'timberRoof' });
      placeKeepTemplate(center, center - 1, 3, 3, 5, 'defensivePlatform', true);

      for (let x = center - 9; x <= center + 9; x += 1) {
        if (Math.abs(x - center) <= 1) continue;
        place(x, center + 7, 'moat');
      }
      for (let y = center - 7; y <= center + 7; y += 1) {
        place(center - 9, y, 'moat');
        place(center + 9, y, 'moat');
      }

      for (let y = center + 6; y <= center + 9; y += 1) place(center, y, 'road');
    } else if (template === 'harbor-capital') {

      const harbor = placeHarborTemplate(4, 'tradingBoat', SIZE - 5, center);
      const pier = placeHarborTemplate(3, 'transportShip', SIZE - 6, center - 6);
      const fishing = placeHarborTemplate(2, 'fishingBoat', SIZE - 6, center + 6);
      const landingDock = placeHarborTemplate(1, 'fishingBoat', 5, center);

      const portPoints = [harbor, pier, fishing, landingDock].filter(
        (point): point is GridPoint => point !== null,
      );
      for (const point of portPoints) {
        this.services.state.removeCell(point.x - 1, point.y);
        if (this.terrainAt(point.x - 1, point.y) !== 'water') {
          place(point.x - 1, point.y, 'stoneRoad');
        }
      }

      prepareArea(center - 7, center - 5, center + 5, center + 6, 0.08);
      placeKeepTemplate(center - 2, center - 1, 3, 3, 4, 'sloped', true);
      place(center - 5, center - 3, 'manor');
      place(center - 2, center + 3, 'villa');
      place(center + 2, center + 3, 'house');
      place(center + 3, center - 2, 'cottage');
      for (let x = center - 6; x <= center + 4; x += 1) {
        if (!this.services.state.getCell(x, center + 1)) place(x, center + 1, 'stoneRoad');
      }
      for (let y = center - 4; y <= center + 5; y += 1) {
        if (!this.services.state.getCell(center, y)) place(center, y, 'road');
      }
    } else if (template === 'mountain-fortress') {
      prepareArea(center - 10, center - 9, center + 10, center + 9, 0.25);

      for (let y = center - 8; y <= center + 6; y += 1) {
        for (let x = center - 9; x <= center + 9; x += 1) {
          const dx = (x - center) / 8.5;
          const dy = (y - (center - 1)) / 6.8;
          const d = Math.hypot(dx, dy);
          if (d <= 1) {
            const ridge = Math.max(0, 3.8 * (1 - d) + Math.sin(x * 0.7 + y * 0.31) * 0.35);
            this.setAbsoluteElevation(x, y, 0.35 + ridge);
          }
        }
      }

      for (let y = center - 7; y <= center - 4; y += 1) {
        for (let x = center + 5; x <= center + 8; x += 1) {
          this.setAbsoluteElevation(x, y, 4.4);
        }
      }

      placeWallRect(center - 5, center - 4, center + 5, center + 4, 'wall1', 3, {
        battlement: true,
        walkway: true,
        thickness: 'thick',
      });
      place(center, center + 4, 'gate', 2);
      place(center - 5, center - 4, 'tower', 4, { towerShape: 'round', towerTop: 'conical' });
      place(center + 5, center - 4, 'tower', 4, { towerShape: 'octagonal', towerTop: 'conical' });
      place(center - 5, center + 4, 'tower', 3, { towerShape: 'corner', towerTop: 'pyramidal' });
      place(center + 5, center + 4, 'tower', 3, { towerShape: 'watch', towerTop: 'timberRoof' });
      placeKeepTemplate(center, center - 1, 3, 3, 5, 'towered', true);

      place(center + 7, center - 6, 'mountain', 4);
      place(center + 6, center - 5, 'mine');
      place(center - 8, center - 6, 'rock', 3);
      place(center - 7, center + 5, 'tree', 3);

      for (let y = center + 5; y <= center + 8; y += 1) place(center, y, 'stoneRoad');
    } else if (template === 'royal-city') {
      prepareArea(center - 11, center - 9, center + 11, center + 9, 0);

      placeWallRect(center - 9, center - 7, center + 9, center + 7, 'wall1', 2, {
        battlement: true,
        walkway: false,
        thickness: 'medium',
      });
      place(center, center + 7, 'gate');
      place(center - 9, center - 7, 'tower', 2, { towerShape: 'square', towerTop: 'hipped' });
      place(center + 9, center - 7, 'tower', 2, { towerShape: 'round', towerTop: 'conical' });
      place(center - 9, center + 7, 'tower', 2, { towerShape: 'octagonal', towerTop: 'openBattlement' });
      place(center + 9, center + 7, 'tower', 2, { towerShape: 'corner', towerTop: 'pyramidal' });

      placeKeepTemplate(center, center - 2, 4, 3, 4, 'sloped', true);
      place(center - 5, center - 3, 'manor');
      place(center + 5, center - 3, 'villa');
      place(center - 5, center + 1, 'house');
      place(center + 5, center + 1, 'cottage');
      place(center - 4, center + 5, 'farm');
      place(center + 4, center + 5, 'farm');

      for (let x = center - 7; x <= center + 7; x += 1) {
        if (!this.services.state.getCell(x, center + 3)) place(x, center + 3, 'road');
      }
      for (let y = center - 5; y <= center + 6; y += 1) {
        if (!this.services.state.getCell(center, y)) place(center, y, 'stoneRoad');
      }
      for (let y = center - 5; y <= center + 5; y += 1) {
        if (!this.services.state.getCell(center - 3, y)) place(center - 3, y, 'dirtRoad');
      }
    } else if (template === 'architecture-gallery') {
      prepareArea(center - 13, center - 10, center + 13, center + 10, 0.1);

      const galleryTowers: Array<{
        x: number;
        y: number;
        shape: TowerShape;
        top: TowerTop;
      }> = [
        { x: center - 10, y: center - 6, shape: 'round', top: 'conical' },
        { x: center - 5, y: center - 6, shape: 'square', top: 'hipped' },
        { x: center, y: center - 6, shape: 'corner', top: 'pyramidal' },
        { x: center + 5, y: center - 6, shape: 'octagonal', top: 'openBattlement' },
        { x: center + 10, y: center - 6, shape: 'watch', top: 'timberRoof' },
        { x: center - 7, y: center + 1, shape: 'square', top: 'flat' },
        { x: center, y: center + 1, shape: 'watch', top: 'watch' },
        { x: center + 7, y: center + 1, shape: 'octagonal', top: 'flag' },
      ];
      for (const tower of galleryTowers) {
        place(tower.x, tower.y, 'tower', 2 + (Math.abs(tower.x - center) % 2), {
          towerShape: tower.shape,
          towerTop: tower.top,
        });
      }

      addTemplateBridge(galleryTowers[0], galleryTowers[1], 'stone');
      addTemplateBridge(galleryTowers[1], galleryTowers[2], 'wood');
      addTemplateBridge(galleryTowers[2], galleryTowers[3], 'stone');
      addTemplateBridge(galleryTowers[3], galleryTowers[4], 'wood');

      placeKeepTemplate(center - 8, center + 7, 2, 2, 2, 'flatBattlement', true, 0, true);
      placeKeepTemplate(center - 3, center + 7, 2, 2, 2, 'sloped', false, 1, true);
      placeKeepTemplate(center + 3, center + 7, 2, 2, 2, 'defensivePlatform', true, 0, false);
      placeKeepTemplate(center + 8, center + 7, 2, 2, 3, 'towered', true, 1, true);

      place(center - 11, center + 4, 'wall1', 1, {
        battlement: true,
        walkway: true,
        thickness: 'thin',
      });
      place(center - 10, center + 4, 'wall2', 2, {
        battlement: false,
        walkway: true,
        thickness: 'medium',
      });
      place(center - 9, center + 4, 'wall3', 4, {
        battlement: true,
        walkway: true,
        thickness: 'thick',
      });

      const diagonal = WallSystem.createSnappedPath(
        { x: center + 5, y: center + 4 },
        { x: center + 9, y: center + 8 },
        SIZE,
      );
      for (const point of diagonal) {
        place(point.x, point.y, 'wall1', 3, {
          battlement: true,
          walkway: true,
          thickness: 'thick',
        });
      }
      this.linkWallPath(diagonal);

      // Terrain-editing showcase: lowered ground, smooth hill, raised plateau and cliff edge.
      for (let x = center - 2; x <= center + 2; x += 1) {
        this.setAbsoluteElevation(x, center + 4, -0.8 + Math.abs(x - center) * 0.12);
      }
      for (let y = center + 3; y <= center + 6; y += 1) {
        for (let x = center + 10; x <= center + 12; x += 1) {
          this.setAbsoluteElevation(x, y, y <= center + 4 ? 2.8 : 0.55);
        }
      }
    } else if (template === 'river-port-fort') {
      prepareArea(center - 9, center - 8, center + 8, center + 8, 0.08);

      for (let y = 2; y < SIZE - 2; y += 1) {
        const x = center + 4 + Math.round(Math.sin(y * 0.48) * 0.8);
        this.services.state.removeCell(x, y);
        this.terrainOverrides.set(this.key(x, y), 'river');
        if (y > center - 3 && y < center + 4) {
          this.services.state.removeCell(x + 1, y);
          this.terrainOverrides.set(this.key(x + 1, y), 'river');
        }
      }

      placeWallRect(center - 7, center - 5, center + 1, center + 5, 'wall1', 2, {
        battlement: true,
        walkway: true,
        thickness: 'medium',
      });
      place(center - 3, center + 5, 'gate');
      place(center - 7, center - 5, 'tower', 3, { towerShape: 'round', towerTop: 'conical' });
      place(center + 1, center - 5, 'tower', 3, { towerShape: 'octagonal', towerTop: 'openBattlement' });
      place(center - 7, center + 5, 'tower', 2, { towerShape: 'square', towerTop: 'hipped' });
      placeKeepTemplate(center - 3, center - 1, 3, 3, 4, 'sloped', true);

      place(center - 5, center + 2, 'house');
      place(center - 1, center + 2, 'cottage');
      place(center - 5, center - 3, 'farm');
      for (let y = center + 1; y < center + 5; y += 1) place(center - 3, y, 'stoneRoad');

      placeHarborTemplate(1, 'fishingBoat', SIZE - 4, center + 4);
      placeHarborTemplate(2, 'fishingBoat', SIZE - 5, center - 3);
    } else if (template === 'farming-duchy') {
      prepareArea(center - 11, center - 9, center + 11, center + 9, 0);

      placeWallRect(center - 6, center - 4, center + 6, center + 4, 'wall1', 1, {
        battlement: true,
        walkway: false,
        thickness: 'thin',
      });
      place(center, center + 4, 'gate');
      placeKeepTemplate(center, center - 1, 3, 2, 3, 'sloped', false);
      place(center - 5, center - 3, 'house');
      place(center + 5, center - 3, 'villa');
      place(center - 4, center + 1, 'cottage');
      place(center + 4, center + 1, 'house');

      const farms = [
        [center - 8, center - 6], [center - 4, center - 7], [center + 1, center - 7],
        [center + 7, center - 5], [center - 8, center + 6], [center - 3, center + 7],
        [center + 3, center + 7], [center + 8, center + 5],
      ] as Array<[number, number]>;
      for (const [x, y] of farms) place(x, y, 'farm');

      for (let x = center - 9; x <= center + 9; x += 1) {
        if (!this.services.state.getCell(x, center + 5)) place(x, center + 5, 'dirtRoad');
      }
      for (let y = center - 7; y <= center + 7; y += 1) {
        if (!this.services.state.getCell(center, y)) place(center, y, 'road');
      }
    } else if (template === 'twin-keep') {
      prepareArea(center - 11, center - 8, center + 11, center + 8, 0.15);

      placeWallRect(center - 9, center - 6, center + 9, center + 6, 'wall3', 3, {
        battlement: true,
        walkway: true,
        thickness: 'thick',
      });
      place(center, center + 6, 'gate', 2);
      placeKeepTemplate(center - 4, center - 1, 3, 3, 5, 'towered', true);
      placeKeepTemplate(center + 4, center - 1, 3, 3, 5, 'defensivePlatform', true);

      const t1={x:center-7,y:center-4}, t2={x:center+7,y:center-4};
      place(t1.x,t1.y,'tower',4,{towerShape:'square',towerTop:'pyramidal'});
      place(t2.x,t2.y,'tower',4,{towerShape:'square',towerTop:'pyramidal'});
      addTemplateBridge(t1,t2,'stone');

      place(center, center + 2, 'armyCamp');
      for (let y=center+1;y<center+6;y+=1) if(!this.services.state.getCell(center,y)) place(center,y,'stoneRoad');
    } else if (template === 'border-march') {
      prepareArea(center - 11, center - 9, center + 11, center + 9, 0.1);

      for (let y=center-8;y<=center+8;y+=1) {
        if(y===center+2) continue;
        place(center-7,y,'wall2',2,{battlement:false,walkway:true,thickness:'medium'});
      }
      place(center-7,center+2,'gate');
      place(center-7,center-8,'tower',2,{towerShape:'watch',towerTop:'timberRoof'});
      place(center-7,center+8,'tower',2,{towerShape:'watch',towerTop:'watch'});
      placeKeepTemplate(center-1,center-2,2,3,3,'flatBattlement',false);
      place(center+3,center-2,'armyCamp');
      place(center+3,center+2,'farm');
      place(center,center+3,'hut');
      place(center+5,center+4,'cottage');
      for(let x=center-6;x<=center+7;x+=1) if(!this.services.state.getCell(x,center+2)) place(x,center+2,'dirtRoad');

      for(let y=center-8;y<=center+8;y+=2) {
        if(!this.services.state.getCell(center+8,y)) place(center+8,y,'tree',1+(y%3+3)%3);
      }
    } else if (template === 'forest-citadel') {
      prepareArea(center - 9, center - 8, center + 9, center + 8, 0.12);

      for(let y=2;y<SIZE-2;y+=1){
        for(let x=2;x<SIZE-2;x+=1){
          const d=Math.hypot(x-center,y-center);
          if(d>7.5 && (x*17+y*29)%4!==0 && !this.services.state.getCell(x,y)) place(x,y,'tree',1+Math.abs((x+y)%3));
        }
      }

      placeWallRect(center-6,center-5,center+6,center+5,'wall1',3,{
        battlement:true,walkway:true,thickness:'medium'
      });
      place(center,center+5,'gate');
      place(center-6,center-5,'tower',3,{towerShape:'round',towerTop:'conical'});
      place(center+6,center-5,'tower',3,{towerShape:'octagonal',towerTop:'openBattlement'});
      place(center-6,center+5,'tower',3,{towerShape:'corner',towerTop:'pyramidal'});
      place(center+6,center+5,'tower',3,{towerShape:'watch',towerTop:'timberRoof'});
      placeKeepTemplate(center,center-1,3,3,4,'towered',true);
      place(center-3,center+2,'house');
      place(center+3,center+2,'farm');

    } else if (template === 'cliff-watch') {
      prepareArea(center - 10, center - 9, center + 10, center + 9, 0);

      for(let y=center-7;y<=center+5;y+=1){
        for(let x=center-8;x<=center+8;x+=1){
          const edge=x>center+3 ? 4.6 : x>center ? 2.6 : 0.7;
          this.setAbsoluteElevation(x,y,edge+Math.sin(y*0.45)*0.18);
        }
      }

      placeWallRect(center+1,center-5,center+7,center+4,'wall1',3,{
        battlement:true,walkway:true,thickness:'thick'
      });
      place(center+4,center+4,'gate',2);
      place(center+1,center-5,'tower',4,{towerShape:'round',towerTop:'conical'});
      place(center+7,center-5,'tower',4,{towerShape:'watch',towerTop:'watch'});
      place(center+1,center+4,'tower',3,{towerShape:'corner',towerTop:'openBattlement'});
      placeKeepTemplate(center+4,center-1,2,3,5,'defensivePlatform',true);

      place(center-3,center+1,'armyCamp');
      for(let y=center-2;y<=center+4;y+=1) if(!this.services.state.getCell(center,y)) place(center,y,'stoneRoad');
    } else if (template === 'moat-palace') {
      prepareArea(center - 11, center - 9, center + 11, center + 9, 0.05);

      placeWallRect(center-6,center-5,center+6,center+5,'wall1',2,{
        battlement:true,walkway:true,thickness:'medium'
      });
      place(center,center+5,'gate');
      placeKeepTemplate(center,center-1,4,3,4,'sloped',true);
      place(center-6,center-5,'tower',3,{towerShape:'round',towerTop:'conical'});
      place(center+6,center-5,'tower',3,{towerShape:'round',towerTop:'conical'});
      place(center-6,center+5,'tower',3,{towerShape:'square',towerTop:'hipped'});
      place(center+6,center+5,'tower',3,{towerShape:'square',towerTop:'hipped'});

      for(let x=center-8;x<=center+8;x+=1){
        if(Math.abs(x-center)>1){place(x,center-7,'moat');place(x,center+7,'moat');}
      }
      for(let y=center-6;y<=center+6;y+=1){place(center-8,y,'moat');place(center+8,y,'moat');}
      for(let y=center-1;y<=center+6;y+=1) if(!this.services.state.getCell(center,y)) place(center,y,'stoneRoad');

    } else if (template === 'merchant-republic') {
      prepareArea(center-11,center-9,center+11,center+9,0.04);

      placeWallRect(center-9,center-7,center+9,center+7,'wall1',2,{
        battlement:true,walkway:false,thickness:'medium'
      });
      place(center,center+7,'gate');
      placeKeepTemplate(center,center-4,3,2,3,'sloped',false);
      const districts=[
        [center-6,center-2,'manor'],[center-2,center-1,'house'],[center+2,center-1,'villa'],
        [center+6,center-2,'house'],[center-6,center+3,'cottage'],[center-2,center+3,'house'],
        [center+2,center+3,'manor'],[center+6,center+3,'villa']
      ] as Array<[number,number,TileKind]>;
      for(const [x,y,k] of districts) place(x,y,k);
      place(center-7,center+5,'farm');
      place(center+7,center+5,'farm');
      for(let x=center-8;x<=center+8;x+=1) if(!this.services.state.getCell(x,center+1)) place(x,center+1,'stoneRoad');
      for(let y=center-6;y<=center+6;y+=1) if(!this.services.state.getCell(center,y)) place(center,y,'road');
      placeHarborTemplate(1,'fishingBoat',SIZE-5,center+5);
    } else if (template === 'war-camp') {
      prepareArea(center-11,center-9,center+11,center+9,0.08);

      placeWallRect(center-8,center-6,center+8,center+6,'wall2',2,{
        battlement:false,walkway:true,thickness:'medium'
      });
      place(center,center+6,'gate');
      place(center-7,center-5,'armyCamp');
      place(center-3,center-5,'armyCamp');
      place(center+3,center-5,'armyCamp');
      place(center+7,center-5,'armyCamp');
      place(center-6,center+1,'hut');
      place(center-2,center+1,'hut');
      place(center+2,center+1,'hut');
      place(center+6,center+1,'hut');
      place(center-6,center+4,'farm');
      place(center+6,center+4,'farm');
      placeKeepTemplate(center,center-1,2,2,2,'flatBattlement',false);
      for(let x=center-7;x<=center+7;x+=1) if(!this.services.state.getCell(x,center+3)) place(x,center+3,'dirtRoad');
      for(let y=center-5;y<=center+5;y+=1) if(!this.services.state.getCell(center,y)) place(center,y,'road');
    } else if (template === 'himeji-castle') {
      // Present-day preserved Himeji core on the requested 46×90 authored plot.
      // The renderer uses the closest complete-cell raster for that footprint,
      // while the castle itself remains native, editable Castle Role state.
      const himejiBounds = himejiLandBounds(SIZE);
      const hx = (localX: number): number => himejiBounds.minX + localX;
      const hy = (localY: number): number => himejiBounds.minY + localY;
      const hp = (localX: number, localY: number): GridPoint => ({ x: hx(localX), y: hy(localY) });

      for (let y = 0; y < SIZE; y += 1) {
        for (let x = 0; x < SIZE; x += 1) {
          this.services.state.removeCell(x, y);
          const insidePlot =
            x >= himejiBounds.minX && x <= himejiBounds.maxX &&
            y >= himejiBounds.minY && y <= himejiBounds.maxY;

          if (!insidePlot) {
            this.terrainOverrides.delete(this.key(x, y));
            this.elevationOverrides.delete(this.key(x, y));
            continue;
          }

          this.terrainOverrides.set(this.key(x, y), 'plains');
          const localX = x - himejiBounds.minX;
          const localY = y - himejiBounds.minY;
          const keepDistance = Math.hypot((localX - 7) * 0.78, (localY - 6.5) * 0.5);
          const westBaileyDistance = Math.hypot((localX - 3.2) * 0.72, (localY - 11.5) * 0.42);
          const keepHill = Math.max(0, 3.2 - keepDistance * 0.68);
          const westBailey = Math.max(0, 1.35 - westBaileyDistance * 0.34);
          this.setAbsoluteElevation(x, y, 0.12 + Math.max(keepHill, westBailey));
        }
      }

      // Outer moat follows the long north-south plot instead of the previous square
      // mainland footprint. A single southern causeway preserves the approach.
      const outerMoat: GridPoint[] = [
        hp(2, 1), hp(8, 1), hp(10, 4), hp(10, 15), hp(9, 18),
        hp(7, 20), hp(3, 20), hp(1, 17), hp(1, 6),
      ];
      for (const point of rasterizeWallPath(outerMoat, true)) {
        this.services.state.removeCell(point.x, point.y);
        this.terrainOverrides.set(this.key(point.x, point.y), 'river');
        this.setAbsoluteElevation(point.x, point.y, 0);
      }

      // Bridge/causeway opening through the southern moat.
      for (const point of [hp(6, 20)]) {
        this.terrainOverrides.set(this.key(point.x, point.y), 'plains');
        this.setAbsoluteElevation(point.x, point.y, 0.1);
      }

      // Sangoku moat remains a distinct internal water defense.
      const sangokuMoat: GridPoint[] = [];
      for (let localY = 13; localY <= 14; localY += 1) {
        for (let localX = 7; localX <= 8; localX += 1) {
          const point = hp(localX, localY);
          sangokuMoat.push(point);
          this.services.state.removeCell(point.x, point.y);
          this.terrainOverrides.set(this.key(point.x, point.y), 'river');
          this.setAbsoluteElevation(point.x, point.y, 0);
        }
      }

      // Three nested defensive zones mirror the plan hierarchy: outer enceinte,
      // western Nishi-no-Maru enclosure, and the elevated inner tenshu precinct.
      const outerDefense: GridPoint[] = [
        hp(3, 3), hp(7, 2), hp(9, 4), hp(9, 14),
        hp(8, 17), hp(5, 18), hp(2, 16), hp(2, 7),
      ];
      const innerKeepDefense: GridPoint[] = [
        hp(5, 4), hp(7, 3), hp(9, 5), hp(9, 9),
        hp(7, 11), hp(5, 10), hp(4, 7),
      ];
      const westBaileyDefense: GridPoint[] = [
        hp(2, 6), hp(4, 5), hp(5, 7), hp(5, 13),
        hp(4, 15), hp(2, 15), hp(1, 12), hp(1, 8),
      ];

      placeWallPath(outerDefense, 'wall1', 2, {
        battlement: false,
        walkway: true,
        thickness: 'thick',
      }, true);
      placeWallPath(innerKeepDefense, 'wall1', 3, {
        battlement: false,
        walkway: true,
        thickness: 'thick',
      }, true);
      placeWallPath(westBaileyDefense, 'wall1', 2, {
        battlement: false,
        walkway: true,
        thickness: 'medium',
      }, true);

      const defensiveTowers: Array<[number, number, number, TowerShape, TowerTop]> = [
        [3, 3, 2, 'square', 'hipped'],
        [7, 2, 3, 'corner', 'pyramidal'],
        [9, 4, 3, 'square', 'hipped'],
        [9, 14, 2, 'watch', 'hipped'],
        [5, 18, 2, 'square', 'pyramidal'],
        [2, 16, 2, 'watch', 'hipped'],
        [5, 4, 3, 'square', 'hipped'],
        [9, 9, 3, 'corner', 'pyramidal'],
      ];
      for (const [localX, localY, level, towerShape, towerTop] of defensiveTowers) {
        place(hx(localX), hy(localY), 'tower', level, { towerShape, towerTop });
      }

      // Hishi Gate plus the i/ro/ha/ni/Bizen sequence keeps the historic
      // switchback approach legible even on the narrower 46-unit footprint.
      const authoredGates: Array<[number, number, number]> = [
        [6, 18, 2], // Hishi Gate
        [3, 15, 2], // I Gate
        [5, 14, 2], // Ro Gate
        [3, 12, 2], // Ha Gate
        [5, 10, 3], // Ni Gate
        [8, 10, 3], // Bizen Gate
      ];
      for (const [localX, localY, level] of authoredGates) {
        place(hx(localX), hy(localY), 'gate', level);
      }

      // Tenshu-gun: dominant six-floor main keep and three subsidiary keeps.
      placeKeepTemplate(hx(7), hy(6), 3, 3, 6, 'japaneseTiered', false, 0, false);
      placeKeepTemplate(hx(4), hy(6), 2, 2, 3, 'japaneseTiered', false, 0, false);
      placeKeepTemplate(hx(9), hy(6), 2, 2, 3, 'japaneseTiered', false, 1, false);
      placeKeepTemplate(hx(6), hy(9), 2, 2, 3, 'japaneseTiered', false, 0, false);

      // Nishi-no-Maru and its long gallery remain a low, elongated editable keep.
      placeKeepTemplate(hx(3), hy(11), 4, 2, 2, 'japaneseTiered', false, 0, false);

      const windingApproach: GridPoint[] = [
        hp(6, 21), hp(6, 18), hp(3, 17), hp(3, 15),
        hp(5, 15), hp(5, 13), hp(3, 13), hp(3, 11),
        hp(5, 11), hp(6, 10), hp(8, 10), hp(8, 8),
      ];
      for (const point of rasterizeWallPath(windingApproach)) {
        if (
          this.terrainAt(point.x, point.y) !== 'river' &&
          !this.services.state.getCell(point.x, point.y) &&
          !this.services.keepSystem.findAtCell(point.x, point.y)
        ) {
          place(point.x, point.y, 'stoneRoad');
        }
      }

      // Sparse vegetation frames the white keeps without hiding the plan.
      for (const point of [
        hp(0, 3), hp(4, 2), hp(11, 3), hp(10, 18),
        hp(2, 19), hp(0, 15), hp(4, 8), hp(2, 13),
      ]) {
        if (
          this.terrainAt(point.x, point.y) !== 'river' &&
          !this.services.state.getCell(point.x, point.y) &&
          !this.services.keepSystem.findAtCell(point.x, point.y)
        ) {
          place(point.x, point.y, 'tree', 2);
        }
      }
    } else if (template === 'carcassonne') {
      // Present-day fortified city after the Viollet-le-Duc restoration campaign:
      // two concentric enclosures, dense round towers, Narbonnaise/Aude gates,
      // the western Château Comtal and Saint-Nazaire basilica on the raised cité.
      for (let y = 0; y < SIZE; y += 1) {
        for (let x = 0; x < SIZE; x += 1) {
          this.services.state.removeCell(x, y);
          this.terrainOverrides.set(this.key(x, y), 'plains');
          const dx = (x - center) / 9.4;
          const dy = (y - center) / 10.4;
          const radial = Math.hypot(dx, dy);
          const plateau = radial < 0.72
            ? 1.75 + (0.72 - radial) * 0.55
            : Math.max(0.08, 1.75 - (radial - 0.72) * 3.1);
          const westApproach = x <= 4 ? Math.max(0.04, plateau * 0.38) : plateau;
          this.setAbsoluteElevation(x, y, westApproach);
        }
      }

      // The Aude runs below the western escarpment.
      for (let y = 0; y < SIZE; y += 1) {
        const riverX = 1 + Math.round((Math.sin(y * 0.34 + 0.8) + 1) * 0.5);
        for (const x of [riverX, riverX + 1]) {
          this.services.state.removeCell(x, y);
          this.terrainOverrides.set(this.key(x, y), 'river');
          this.setAbsoluteElevation(x, y, 0);
        }
      }

      const outerRampart: GridPoint[] = [
        { x: 6, y: 3 }, { x: 11, y: 2 }, { x: 15, y: 3 },
        { x: 18, y: 6 }, { x: 19, y: 11 }, { x: 17, y: 15 },
        { x: 14, y: 18 }, { x: 9, y: 19 }, { x: 5, y: 17 },
        { x: 3, y: 14 }, { x: 3, y: 9 }, { x: 4, y: 6 },
      ];
      const innerRampart: GridPoint[] = [
        { x: 8, y: 5 }, { x: 11, y: 4 }, { x: 14, y: 5 },
        { x: 16, y: 7 }, { x: 17, y: 11 }, { x: 15, y: 14 },
        { x: 13, y: 16 }, { x: 9, y: 16 }, { x: 6, y: 14 },
        { x: 5, y: 11 }, { x: 5, y: 8 }, { x: 7, y: 6 },
      ];

      placeWallPath(outerRampart, 'wall1', 2, {
        battlement: true,
        walkway: true,
        thickness: 'medium',
      }, true);
      placeWallPath(innerRampart, 'wall1', 3, {
        battlement: true,
        walkway: true,
        thickness: 'thick',
      }, true);

      const outerTowers: GridPoint[] = [
        { x: 6, y: 3 }, { x: 11, y: 2 }, { x: 15, y: 3 },
        { x: 18, y: 6 }, { x: 19, y: 11 }, { x: 17, y: 15 },
        { x: 14, y: 18 }, { x: 9, y: 19 }, { x: 5, y: 17 },
        { x: 3, y: 14 }, { x: 3, y: 9 }, { x: 4, y: 6 },
      ];
      const innerTowers: GridPoint[] = [
        { x: 8, y: 5 }, { x: 11, y: 4 }, { x: 14, y: 5 },
        { x: 16, y: 7 }, { x: 17, y: 11 }, { x: 15, y: 14 },
        { x: 13, y: 16 }, { x: 9, y: 16 }, { x: 6, y: 14 },
        { x: 5, y: 11 }, { x: 5, y: 8 }, { x: 7, y: 6 },
      ];
      for (const [index, point] of outerTowers.entries()) {
        place(point.x, point.y, 'tower', 2 + (index % 4 === 0 ? 1 : 0), {
          towerShape: 'round',
          towerTop: index % 5 === 0 ? 'openBattlement' : 'conical',
        });
      }
      for (const [index, point] of innerTowers.entries()) {
        place(point.x, point.y, 'tower', 3 + (index % 5 === 0 ? 1 : 0), {
          towerShape: index === 1 ? 'square' : 'round',
          towerTop: index === 1 ? 'hipped' : 'conical',
        });
      }

      // Porte Narbonnaise: twin-tower eastern entrance through both enclosures.
      place(19, 9, 'gate', 2);
      place(17, 9, 'gate', 3);
      place(18, 8, 'tower', 4, { towerShape: 'round', towerTop: 'conical' });
      place(18, 10, 'tower', 4, { towerShape: 'round', towerTop: 'conical' });

      // Porte d'Aude descends toward the river on the western/south-west side.
      place(3, 13, 'gate', 2);
      place(6, 13, 'gate', 3);
      place(4, 12, 'tower', 3, { towerShape: 'round', towerTop: 'conical' });
      place(5, 15, 'tower', 3, { towerShape: 'round', towerTop: 'conical' });

      // Château Comtal occupies the western sector of the inner enclosure.
      placeKeepTemplate(8, 10, 3, 3, 4, 'towered', true, 0, true);

      // Saint-Nazaire uses a dedicated landmark renderer, not a generic house.
      place(13, 12, 'basilica', 2, { rotation: 1 });

      const cityBuildings: Array<[number, number, TileKind, number]> = [
        [10, 7, 'manor', 1], [12, 7, 'house', 1], [14, 8, 'cottage', 1],
        [11, 10, 'market', 1], [14, 10, 'house', 1], [10, 13, 'villa', 1],
        [11, 14, 'house', 1], [14, 14, 'cottage', 1], [8, 14, 'cottage', 1],
      ];
      for (const [x, y, kind, level] of cityBuildings) {
        if (!this.services.state.getCell(x, y) && !this.services.keepSystem.findAtCell(x, y)) {
          place(x, y, kind, level);
        }
      }

      const roadPaths: GridPoint[][] = [
        [{ x: 19, y: 9 }, { x: 15, y: 9 }, { x: 11, y: 10 }, { x: 8, y: 10 }],
        [{ x: 12, y: 5 }, { x: 12, y: 10 }, { x: 13, y: 12 }, { x: 13, y: 15 }],
        [{ x: 3, y: 13 }, { x: 6, y: 13 }, { x: 9, y: 12 }, { x: 11, y: 10 }],
      ];
      for (const route of roadPaths) {
        for (const point of rasterizeWallPath(route)) {
          if (!this.services.state.getCell(point.x, point.y) && !this.services.keepSystem.findAtCell(point.x, point.y)) {
            place(point.x, point.y, 'stoneRoad');
          }
        }
      }

      // Sparse approach vegetation keeps the fortified hill silhouette readable.
      for (const point of [
        { x: 5, y: 4 }, { x: 17, y: 4 }, { x: 20, y: 15 },
        { x: 7, y: 20 }, { x: 16, y: 19 }, { x: 4, y: 18 },
      ]) {
        if (!this.services.state.getCell(point.x, point.y) && this.terrainAt(point.x, point.y) !== 'river') {
          place(point.x, point.y, 'tree', 2);
        }
      }
    } else if (template === 'crac-des-chevaliers') {
      // Hospitaller final construction phase, c. mid-13th century to 1271:
      // a lower outer enceinte surrounds a higher inner ward, with the eastern
      // entrance ramp, southern cistern/ditch, major flanking towers and barbican.
      for (let y = 0; y < SIZE; y += 1) {
        for (let x = 0; x < SIZE; x += 1) {
          this.services.state.removeCell(x, y);
          this.terrainOverrides.set(this.key(x, y), 'plains');

          const dx = (x - center) / 9.2;
          const dy = (y - center) / 10.2;
          const radial = Math.hypot(dx, dy);
          let height = Math.max(0.15, 3.25 - radial * 3.1);
          if (radial < 0.58) height += 0.72;
          if (x >= 17) height = Math.max(0.25, height - (x - 16) * 0.34);
          if (y >= 18) height = Math.max(0.32, height - (y - 17) * 0.2);
          this.setAbsoluteElevation(x, y, height);
        }
      }

      const outerEnceinte: GridPoint[] = [
        { x: 6, y: 3 }, { x: 11, y: 2 }, { x: 16, y: 4 },
        { x: 19, y: 7 }, { x: 19, y: 12 }, { x: 17, y: 16 },
        { x: 14, y: 18 }, { x: 9, y: 18 }, { x: 5, y: 16 },
        { x: 3, y: 12 }, { x: 3, y: 8 }, { x: 4, y: 5 },
      ];
      const innerEnceinte: GridPoint[] = [
        { x: 8, y: 5 }, { x: 12, y: 4 }, { x: 15, y: 5 },
        { x: 17, y: 8 }, { x: 17, y: 12 }, { x: 14, y: 16 },
        { x: 10, y: 16 }, { x: 7, y: 14 }, { x: 6, y: 10 },
        { x: 6, y: 7 },
      ];

      placeWallPath(outerEnceinte, 'wall1', 2, {
        battlement: true,
        walkway: true,
        thickness: 'medium',
      }, true);
      placeWallPath(innerEnceinte, 'wall3', 4, {
        battlement: true,
        walkway: true,
        thickness: 'thick',
      }, true);

      const outerTowers: GridPoint[] = [
        { x: 6, y: 3 }, { x: 11, y: 2 }, { x: 16, y: 4 },
        { x: 19, y: 7 }, { x: 19, y: 12 }, { x: 17, y: 16 },
        { x: 14, y: 18 }, { x: 9, y: 18 }, { x: 5, y: 16 },
        { x: 3, y: 12 }, { x: 3, y: 8 }, { x: 4, y: 5 },
      ];
      for (const [index, point] of outerTowers.entries()) {
        place(point.x, point.y, 'tower', index % 4 === 0 ? 3 : 2, {
          towerShape: 'round',
          towerTop: 'openBattlement',
        });
      }

      const innerTowers: Array<[number, number, number, TowerShape]> = [
        [8, 5, 4, 'round'], [12, 4, 4, 'round'], [15, 5, 4, 'round'],
        [17, 8, 4, 'round'], [17, 12, 4, 'round'],
        [14, 16, 5, 'round'], [10, 16, 5, 'round'],
        [7, 14, 5, 'round'], [6, 10, 4, 'round'], [6, 7, 4, 'round'],
      ];
      for (const [x, y, level, shape] of innerTowers) {
        place(x, y, 'tower', level, {
          towerShape: shape,
          towerTop: 'openBattlement',
        });
      }

      place(19, 9, 'gate', 2, { rotationMode: 'auto' });
      place(17, 9, 'gate', 4, { rotationMode: 'auto' });
      place(18, 7, 'tower', 3, { towerShape: 'round', towerTop: 'openBattlement' });
      place(18, 11, 'tower', 3, { towerShape: 'round', towerTop: 'openBattlement' });

      placeKeepTemplate(10, 12, 3, 3, 5, 'defensivePlatform', true, 0, true);

      // Chapel: use the reusable stone religious landmark, not a residence placeholder.
      place(12, 8, 'basilica', 1, { rotation: 1 });

      // Great hall / service ranges leave the central court open.
      for (const [x, y, kind] of [
        [14, 10, 'manor'],
        [14, 12, 'house'],
        [8, 9, 'manor'],
      ] as Array<[number, number, TileKind]>) {
        if (!this.services.state.getCell(x, y) && !this.services.keepSystem.findAtCell(x, y)) {
          place(x, y, kind, 1);
        }
      }

      // Mid-13th-century open cistern in the former southern ditch.
      for (let x = 9; x <= 14; x += 1) {
        if (!this.services.state.getCell(x, 17)) {
          this.terrainOverrides.set(this.key(x, 17), 'river');
          this.setAbsoluteElevation(x, 17, 1.05);
        }
      }

      const southBarbican: GridPoint[] = [
        { x: 8, y: 19 }, { x: 11, y: 21 }, { x: 15, y: 19 },
      ];
      placeWallPath(southBarbican, 'wall1', 2, {
        battlement: true,
        walkway: true,
        thickness: 'medium',
      }, true);
      place(11, 21, 'tower', 2, { towerShape: 'round', towerTop: 'openBattlement' });

      const routes: GridPoint[][] = [
        [{ x: 21, y: 8 }, { x: 19, y: 8 }, { x: 19, y: 9 }, { x: 17, y: 9 }, { x: 15, y: 10 }, { x: 12, y: 10 }],
        [{ x: 12, y: 6 }, { x: 12, y: 10 }, { x: 11, y: 13 }],
        [{ x: 11, y: 14 }, { x: 11, y: 16 }, { x: 11, y: 18 }, { x: 11, y: 20 }],
      ];
      for (const route of routes) {
        for (const point of rasterizeWallPath(route)) {
          if (
            !this.services.state.getCell(point.x, point.y) &&
            !this.services.keepSystem.findAtCell(point.x, point.y) &&
            this.terrainAt(point.x, point.y) !== 'river'
          ) {
            place(point.x, point.y, 'stoneRoad');
          }
        }
      }

      for (const point of [
        { x: 2, y: 5 }, { x: 20, y: 4 }, { x: 21, y: 14 },
        { x: 4, y: 19 }, { x: 18, y: 19 }, { x: 2, y: 16 },
      ]) {
        if (!this.services.state.getCell(point.x, point.y)) place(point.x, point.y, 'tree', 1);
      }
    } else if (template === 'arg-e-bam') {
      // Pre-earthquake Arg-e Bam, immediately before 26 December 2003.
      // The authored plan preserves the southern entrance, bazaar axis,
      // dense lower town, dry moat and raised governor's citadel to the north.
      for (let y = 0; y < SIZE; y += 1) {
        for (let x = 0; x < SIZE; x += 1) {
          this.services.state.removeCell(x, y);
          this.terrainOverrides.set(this.key(x, y), 'plains');
          const broadRise = Math.max(
            0,
            0.34 - Math.hypot((x - center) / 13, (y - center) / 14) * 0.22,
          );
          const citadelRise =
            x >= 7 && x <= 15 && y >= 4 && y <= 10
              ? 0.58 + Math.max(0, 10 - y) * 0.09
              : 0;
          this.setAbsoluteElevation(x, y, 0.05 + broadRise + citadelRise);
        }
      }

      const bamOuterRampart: GridPoint[] = [
        { x: 6, y: 5 }, { x: 15, y: 5 }, { x: 18, y: 8 },
        { x: 18, y: 16 }, { x: 15, y: 19 }, { x: 7, y: 19 },
        { x: 4, y: 17 }, { x: 4, y: 8 },
      ];
      placeWallPath(bamOuterRampart, 'wall1', 2, {
        battlement: true,
        walkway: true,
        thickness: 'thick',
      }, true);

      // Compressed tower rhythm represents the documented 38-tower enclosure.
      const bamOuterTowers: GridPoint[] = [
        { x: 6, y: 5 }, { x: 10, y: 5 }, { x: 15, y: 5 },
        { x: 18, y: 8 }, { x: 18, y: 12 }, { x: 18, y: 16 },
        { x: 15, y: 19 }, { x: 13, y: 19 }, { x: 9, y: 19 },
        { x: 7, y: 19 }, { x: 4, y: 17 }, { x: 4, y: 13 },
        { x: 4, y: 8 }, { x: 5, y: 6 },
      ];
      for (const [index, point] of bamOuterTowers.entries()) {
        place(point.x, point.y, 'tower', index % 5 === 0 ? 3 : 2, {
          towerShape: index % 4 === 0 ? 'round' : 'square',
          towerTop: 'openBattlement',
        });
      }

      // Main southern gate, aligned with the principal north-south route.
      place(11, 19, 'gate', 3, { rotation: 0 });
      place(10, 18, 'tower', 3, { towerShape: 'round', towerTop: 'openBattlement' });
      place(12, 18, 'tower', 3, { towerShape: 'round', towerTop: 'openBattlement' });

      // Higher governor's citadel / hakim-neshin in the north.
      const bamCitadelRampart: GridPoint[] = [
        { x: 8, y: 6 }, { x: 14, y: 6 }, { x: 15, y: 8 },
        { x: 14, y: 10 }, { x: 8, y: 10 }, { x: 7, y: 8 },
      ];
      placeWallPath(bamCitadelRampart, 'wall1', 3, {
        battlement: true,
        walkway: true,
        thickness: 'thick',
      }, true);
      for (const point of bamCitadelRampart) {
        place(point.x, point.y, 'tower', 3, {
          towerShape: 'square',
          towerTop: 'openBattlement',
        });
      }
      place(11, 10, 'gate', 3, { rotation: 0 });
      placeKeepTemplate(11, 7, 3, 3, 4, 'flatBattlement', true, 0, true);

      // Bazaar axis and principal circulation.
      for (let y = 11; y <= 18; y += 1) {
        if (!this.services.state.getCell(11, y) && !this.services.keepSystem.findAtCell(11, y)) {
          place(11, y, 'dirtRoad');
        }
      }
      place(11, 15, 'market', 1);
      place(11, 14, 'market', 1);

      for (const route of [
        [{ x: 6, y: 13 }, { x: 16, y: 13 }],
        [{ x: 6, y: 16 }, { x: 16, y: 16 }],
      ] as GridPoint[][]) {
        for (const point of rasterizeWallPath(route)) {
          if (!this.services.state.getCell(point.x, point.y) && !this.services.keepSystem.findAtCell(point.x, point.y)) {
            place(point.x, point.y, 'dirtRoad');
          }
        }
      }

      // Dedicated landmark instead of substituting a basilica or generic house.
      place(8, 13, 'mosque', 2, { rotation: 0 });

      // Dense earthen lower-town fabric.
      const bamResidential: Array<[number, number, TileKind, number, number]> = [
        [6, 11, 'cottage', 1, 0], [8, 11, 'house', 1, 1], [14, 11, 'house', 1, 3], [16, 11, 'cottage', 1, 0],
        [6, 14, 'house', 1, 1], [14, 14, 'manor', 1, 2], [16, 14, 'cottage', 1, 3],
        [6, 15, 'cottage', 1, 0], [8, 15, 'house', 1, 1], [14, 15, 'house', 1, 3], [16, 15, 'house', 1, 2],
        [6, 17, 'house', 1, 1], [8, 17, 'cottage', 1, 2], [14, 17, 'manor', 1, 3], [16, 17, 'cottage', 1, 0],
      ];
      for (const [x, y, kind, level, rotation] of bamResidential) {
        if (!this.services.state.getCell(x, y) && !this.services.keepSystem.findAtCell(x, y)) {
          place(x, y, kind, level, { rotation });
        }
      }

      // Service compounds stand in for barracks/stables using normal editable
      // settlement cells rather than a visually unrelated bespoke placeholder.
      for (const [x, y, kind, rotation] of [
        [15, 12, 'hut', 0],
        [16, 12, 'hut', 1],
        [7, 12, 'house', 0],
        [15, 9, 'hut', 0],
      ] as Array<[number, number, TileKind, number]>) {
        if (!this.services.state.getCell(x, y) && !this.services.keepSystem.findAtCell(x, y)) {
          place(x, y, kind, 1, { rotation });
        }
      }

      // Dry moat around the enclosure; keep the southern gate approach open.
      const bamMoat: GridPoint[] = [];
      for (let x = 6; x <= 15; x += 1) bamMoat.push({ x, y: 4 });
      for (let x = 7; x <= 15; x += 1) {
        if (x < 10 || x > 12) bamMoat.push({ x, y: 20 });
      }
      for (let y = 8; y <= 17; y += 1) bamMoat.push({ x: 3, y });
      for (let y = 8; y <= 16; y += 1) bamMoat.push({ x: 19, y });
      for (const point of bamMoat) {
        if (!this.services.state.getCell(point.x, point.y)) place(point.x, point.y, 'moat');
      }
    } else if (template === 'island-monastery') {
      prepareArea(center-8,center-8,center+8,center+8,0.32);

      for(let y=center-7;y<=center+7;y+=1){
        for(let x=center-7;x<=center+7;x+=1){
          const d=Math.hypot(x-center,y-center);
          if(d<6.8) this.setAbsoluteElevation(x,y,0.28+Math.max(0,1.3-d*0.12));
        }
      }

      placeWallRect(center-5,center-4,center+5,center+4,'wall1',1,{
        battlement:false,walkway:false,thickness:'thin'
      });
      place(center,center+4,'gate');
      placeKeepTemplate(center,center-1,3,3,3,'sloped',false,0,false);
      place(center-3,center+1,'cottage');
      place(center+3,center+1,'cottage');
      place(center-3,center+5,'farm');
      place(center+3,center+5,'farm');
      place(center-6,center-5,'tree',3);
      place(center+6,center-5,'tree',3);
      placeHarborTemplate(1,'fishingBoat',4,center);
    }

    this.selectedCell = null;
    this.selectedKeepId = null;
    const stoneSelect = document.getElementById('castle-stone-style') as HTMLSelectElement | null;
    if (stoneSelect) stoneSelect.value = this.stoneStyle;
    const bridgeSelect = document.getElementById('tower-bridge-kind') as HTMLSelectElement | null;
    if (bridgeSelect) bridgeSelect.value = this.towerBridgeKind;
    this.resetGameplayCameraReference();
    this.redraw();
    this.save();
    this.setStatus('Template loaded: ' + template);
  }

  private applyTerrainTemplate(template: string): void {
    this.recordHistory();
    this.clearSettlementAgents();
    this.services.state.clear();
    this.services.keepSystem.clear();
    this.towerBridges.clear();
    this.nextTowerBridgeId = 1;
    this.selectedTowerBridgeId = null;
    this.towerBridgeStart = null;
    this.towerBridgeHover = null;
    this.clearGroup(this.wallPreviewLayer);
    this.selectedKeepId = null;
    this.selectedCell = null;
    this.terrainOverrides.clear();
    this.elevationOverrides.clear();
    this.moatTasks.clear();
    this.services.economySystem.reset();
    this.services.populationSystem.setState();
    this.missionSystem.reset();
    this.missionRefreshAccumulatorMs = 0;
    this.populationBattleCommitted = false;
    this.populationBattleStart = null;
    this.economySaveAccumulatorMs = 0;
    this.worldSeeded = true;

    const center = Math.floor(SIZE / 2);
    const addProp = (x: number, y: number, kind: TileKind, level = 1): void => {
      if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
      const terrain = this.terrainAt(x, y);
      if (terrain === 'water' || terrain === 'river') return;
      if (!this.services.state.getCell(x, y)) this.services.state.setCell(x, y, kind, level);
    };

    const flattenLand = (): void => {
      for (let y = 0; y < SIZE; y += 1) {
        for (let x = 0; x < SIZE; x += 1) {
          const base = this.baseTerrainAt(x, y);
          if (base !== 'water') this.terrainOverrides.set(this.key(x, y), 'plains');
          if (base !== 'water') this.setAbsoluteElevation(x, y, 0);
        }
      }
    };

    if (template === 'rolling-plains') {
      flattenLand();
      for (let y = 2; y < SIZE - 2; y += 1) {
        for (let x = 2; x < SIZE - 2; x += 1) {
          if (this.terrainAt(x, y) === 'water') continue;
          const elevation =
            0.25 +
            Math.sin(x * 0.42) * 0.32 +
            Math.cos(y * 0.37) * 0.28 +
            Math.sin((x + y) * 0.18) * 0.16;
          this.setAbsoluteElevation(x, y, Math.max(0, elevation));
          if ((x * 17 + y * 23) % 29 === 0) addProp(x, y, 'tree', 1 + ((x + y) % 3));
        }
      }
    } else if (template === 'twin-rivers') {
      flattenLand();
      for (let y = 1; y < SIZE - 1; y += 1) {
        for (const baseX of [center - 5, center + 5]) {
          const x = baseX + Math.round(Math.sin(y * 0.47 + baseX) * 1.1);
          this.terrainOverrides.set(this.key(x, y), 'river');
          if (y % 5 < 3) this.terrainOverrides.set(this.key(x + 1, y), 'river');
        }
      }
      for (let y = 3; y < SIZE - 3; y += 2) {
        for (const x of [center - 9, center, center + 9]) {
          addProp(x, y, 'tree', 1 + ((x + y) % 2));
        }
      }
    } else if (template === 'alpine-basin') {
      flattenLand();
      this.applyMountainRange({ x: 3, y: 4 }, { x: 5, y: SIZE - 5 }, true);
      this.applyMountainRange({ x: SIZE - 4, y: 4 }, { x: SIZE - 6, y: SIZE - 5 }, true);
      this.applyMountainRange({ x: 5, y: 4 }, { x: SIZE - 6, y: 3 }, true);
      for (let y = center - 5; y <= center + 6; y += 1) {
        for (let x = center - 5; x <= center + 5; x += 1) {
          this.services.state.removeCell(x, y);
          this.terrainOverrides.set(this.key(x, y), 'plains');
          this.setAbsoluteElevation(x, y, 0.35 + Math.hypot(x-center,y-center)*0.025);
        }
      }
    } else if (template === 'coastal-cliffs') {
      flattenLand();
      for (let y = 1; y < SIZE - 1; y += 1) {
        for (let x = 1; x < SIZE - 1; x += 1) {
          const radial = Math.hypot(x-center,y-center);
          if (radial > SIZE * 0.36 && this.terrainAt(x,y) !== 'water') {
            this.setAbsoluteElevation(x,y,2.1+Math.max(0,radial-SIZE*0.36)*0.3);
            if ((x*11+y*7)%9===0) addProp(x,y,'rock',1+((x+y)%2));
          } else if (this.terrainAt(x,y) !== 'water') {
            this.setAbsoluteElevation(x,y,0.18);
          }
        }
      }
    } else if (template === 'forest-highlands') {
      flattenLand();
      for (let y = 2; y < SIZE - 2; y += 1) {
        for (let x = 2; x < SIZE - 2; x += 1) {
          if (this.terrainAt(x,y) === 'water') continue;
          const elevation = Math.max(0, 0.4 + Math.sin(x*0.31+y*0.17)*0.55 + Math.cos(y*0.41)*0.4);
          this.setAbsoluteElevation(x,y,elevation);
          const clearing = Math.hypot(x-center,y-center) < 5.5;
          if (!clearing && (x*13+y*19)%5!==0) addProp(x,y,'tree',1+Math.abs((x*3+y)%3));
          else if (!clearing && (x*23+y*7)%17===0) addProp(x,y,'rock',1);
        }
      }
    } else if (template === 'marsh-island') {
      flattenLand();
      for (let y = 2; y < SIZE - 2; y += 1) {
        for (let x = 2; x < SIZE - 2; x += 1) {
          if (this.terrainAt(x,y) === 'water') continue;
          this.setAbsoluteElevation(x,y,0.03+Math.sin((x+y)*0.35)*0.05);
          const wet =
            Math.sin(x*0.7)+Math.cos(y*0.63)+Math.sin((x-y)*0.32) > 1.35;
          if (wet && Math.hypot(x-center,y-center)>3.5) {
            this.services.state.removeCell(x,y);
            this.terrainOverrides.set(this.key(x,y),'river');
          } else if ((x*31+y*17)%13===0) {
            addProp(x,y,'tree',1);
          }
        }
      }
    } else if (template === 'terraced-hills') {
      flattenLand();
      for (let y = 2; y < SIZE - 2; y += 1) {
        for (let x = 2; x < SIZE - 2; x += 1) {
          if (this.terrainAt(x,y)==='water') continue;
          const distance = Math.hypot(x-center,y-center);
          const terrace = Math.floor(Math.max(0, 7.5-distance)/1.6)*0.62;
          this.setAbsoluteElevation(x,y,terrace);
          if (distance>6 && (x+y)%7===0) addProp(x,y,'tree',1+((x*y)%3));
        }
      }
    } else {
      this.setStatus('Unknown terrain template');
      return;
    }

    this.redraw();
    this.save();
    this.setStatus('Editable terrain template loaded: ' + template);
  }

  private adjustBattleSetup(field: keyof BattleSetup, delta: number): void {
    if (this.battleSystem.isActive()) {
      this.setStatus('Reset the current battle before changing army sizes');
      return;
    }

    this.setBattleSetupValue(field, this.battleSetup[field] + delta);
  }

  private setBattleSetupValue(field: keyof BattleSetup, value: number): void {
    // Only attacker unit counts are configurable. Army Camps determine every defender.
    if (String(field).startsWith('defender')) return;
    if (this.battleSystem.isActive()) {
      this.setStatus('Reset the current battle before changing army sizes');
      this.syncBattleSetupUI();
      return;
    }

    const normalized = THREE.MathUtils.clamp(
      Math.floor(Number.isFinite(value) ? value : 0),
      0,
      120,
    );
    this.battleSetup = { ...this.battleSetup, [field]: normalized };
    this.syncBattleSetupUI();
  }

  private syncBattleSetupUI(): void {
    const mappings: Array<[keyof BattleSetup, string]> = [
      ['attackerSwordsmen', 'battle-attacker-swordsmen'],
      ['attackerArchers', 'battle-attacker-archers'],
      ['attackerSpearmen', 'battle-attacker-spearmen'],
      ['attackerCrossbowmen', 'battle-attacker-crossbowmen'],
      ['attackerModernSoldiers', 'battle-attacker-modern-soldiers'],
    ];

    for (const [field, id] of mappings) {
      const element = document.getElementById(id);
      if (element instanceof HTMLInputElement) {
        element.value = String(this.battleSetup[field]);
      } else if (element) {
        element.textContent = String(this.battleSetup[field]);
      }
    }
  }

  private startBattleFromUI(): void {
    if (this.endlessDefenseActive) {
      if (this.endlessDefensePaused) {
        this.endlessDefensePaused = false;
        this.battleSystem.resume();
        this.updateBattleUI(this.battleSystem.status());
        this.setStatus('Endless Defense resumed');
      }
      return;
    }
    const current = this.battleSystem.status();
    if (current.mode === 'paused') {
      this.battleSystem.resume();
      this.setStatus('Battle resumed');
      return;
    }

    this.syncPopulationDefenseAssignments(this.services.state.entries());
    this.syncBattleSetupUI();

    const attackerTotal =
      this.battleSetup.attackerSwordsmen +
      this.battleSetup.attackerArchers +
      this.battleSetup.attackerSpearmen +
      this.battleSetup.attackerCrossbowmen +
      this.battleSetup.attackerModernSoldiers;
    const defenderTotal =
      this.battleSetup.defenderSwordsmen +
      this.battleSetup.defenderArchers +
      this.battleSetup.defenderSpearmen +
      this.battleSetup.defenderCrossbowmen +
      this.battleSetup.defenderModernSoldiers;

    if (attackerTotal <= 0) {
      this.setStatus('Add at least one Attacker before starting the battle');
      return;
    }

    if (defenderTotal <= 0) {
      this.setStatus('No Army Camp garrison available · attackers will attempt an immediate capture');
    }

    this.populationBattleCommitted = false;
    this.populationBattleStart = { ...this.battleSetup };
    this.services.populationSystem.setMilitiaMobilized(true);

    this.setViewMode('world3d');
    this.setToolbarOpen(false);
    this.workerLayer.visible = false;
    this.settlementLayer.visible = false;
    document.getElementById('game-shell')?.classList.add('battle-mode');
    this.services.gateSystem.setAttackState(true);
    if (this.settingsStore.get().gameplay.combatFeedback) {
      audioEvents.emit({ action: 'play_sfx', assetId: 'combat.battle-start' });
    }
    this.battleSystem.start(this.battleSetup, { militaryTier: this.militaryTier });
    this.setStatus('Battle started · Attackers are advancing on the castle');
  }

  private startEndlessDefenseFromUI(): void {
    if (this.battleSystem.isActive() && this.battleSystem.status().mode !== 'finished') {
      this.setStatus('Reset the current battle before starting Endless Defense');
      return;
    }

    this.syncPopulationDefenseAssignments(this.services.state.entries());
    this.syncBattleSetupUI();
    this.endlessDefenseActive = true;
    this.endlessDefensePaused = false;
    this.endlessDefenseWave = 0;
    this.endlessDefenseIntermissionMs = 0;
    this.endlessDefenseAwaitingNextWave = false;
    this.services.populationSystem.setMilitiaMobilized(true);
    this.setViewMode('world3d');
    this.setToolbarOpen(false);
    this.workerLayer.visible = false;
    this.settlementLayer.visible = false;
    document.getElementById('game-shell')?.classList.add('battle-mode');
    this.services.gateSystem.setAttackState(true);
    this.startEndlessDefenseWave(1);
  }

  private startEndlessDefenseWave(waveNumber: number): void {
    this.syncPopulationDefenseAssignments(this.services.state.entries());
    this.services.populationSystem.setMilitiaMobilized(true);
    const wave = getEndlessDefenseWave(waveNumber);
    const enemyTotal = endlessDefenseEnemyCount(wave.enemies);
    const setup: BattleSetup = {
      ...this.battleSetup,
      attackerSwordsmen: wave.enemies.swordsman ?? 0,
      attackerArchers: wave.enemies.archer ?? 0,
      attackerSpearmen: wave.enemies.spearman ?? 0,
      attackerCrossbowmen: wave.enemies.crossbowman ?? 0,
      attackerModernSoldiers: 0,
      defenderModernSoldiers: 0,
    };

    this.battleSetup = setup;
    this.populationBattleCommitted = false;
    this.populationBattleStart = { ...setup };
    this.endlessDefenseWave = waveNumber;
    this.endlessDefenseAwaitingNextWave = false;
    this.endlessDefenseIntermissionMs = 0;
    this.battleSystem.start(setup, {
      attackerSpawnInterval: wave.spawnInterval,
      attackerSpawnBatchSize: wave.spawnBatchSize,
      preserveSessionWallDamage: true,
      militaryTier: this.militaryTier,
    });
    this.syncBattleSetupUI();
    this.setStatus(`Endless Defense · Wave ${waveNumber} · ${enemyTotal} enemies`);
  }

  private updateEndlessDefense(deltaMs: number): void {
    if (!this.endlessDefenseActive || this.endlessDefensePaused) return;
    const status = this.battleSystem.status();
    if (status.mode !== 'finished') return;

    if (status.result?.winner === 'attacker') {
      this.endlessDefenseActive = false;
      this.endlessDefensePaused = false;
      this.endlessDefenseAwaitingNextWave = false;
      this.services.gateSystem.setAttackState(false);
      this.services.populationSystem.setMilitiaMobilized(false);
      document.getElementById('game-shell')?.classList.remove('battle-mode');
      this.workerLayer.visible = this.viewMode === 'world3d';
      this.settlementLayer.visible = this.viewMode === 'world3d';
      this.updateBattleUI(status);
      this.setStatus(`Endless Defense defeated on Wave ${this.endlessDefenseWave}`);
      return;
    }

    if (status.result?.winner !== 'defender') return;

    if (!this.endlessDefenseAwaitingNextWave) {
      const wave = getEndlessDefenseWave(this.endlessDefenseWave);
      this.endlessDefenseAwaitingNextWave = true;
      this.endlessDefenseIntermissionMs = wave.intermissionSeconds * 1000;
      this.setStatus(`Wave ${this.endlessDefenseWave} cleared · next wave incoming`);
      return;
    }

    this.endlessDefenseIntermissionMs = Math.max(0, this.endlessDefenseIntermissionMs - deltaMs);
    if (this.endlessDefenseIntermissionMs <= 0) {
      this.startEndlessDefenseWave(this.endlessDefenseWave + 1);
    }
  }

  private upgradeMilitaryTier(): void {
    if (this.battleSystem.isActive()) {
      this.setStatus('Reset the current battle before upgrading military technology');
      return;
    }
    if (this.militaryTier >= 4) return;
    this.recordHistory();
    this.militaryTier = normalizeMilitaryTier(this.militaryTier + 1);
    this.syncIdleDefenderGarrison(true);
    this.syncMilitaryUI();
    this.save();
    this.setStatus(`Military upgraded to Tier ${this.militaryTier}`);
  }

  private produceMissileFromUI(): void {
    const result = beginMissileProduction(
      this.services.state.getMissileState(),
      this.militaryTier,
      this.battleSystem.isActive(),
    );
    this.services.state.setMissileState(result.state);
    this.syncMilitaryMissileUI();
    if (result.ok) this.save(false);
    this.setStatus(result.message);
  }

  private launchMissileFromUI(): void {
    const state = this.services.state.getMissileState();
    if (!missilesUnlocked(this.militaryTier)) {
      this.setStatus(`Missiles unlock at Military Tier ${MISSILE_CONFIG.unlockTier}`);
      return;
    }
    if (!this.battleSystem.isRunning()) {
      this.setStatus('Start or resume the battle before launching a missile');
      return;
    }
    if (state.stock <= 0) {
      this.setStatus('No missiles in stock · produce one before the battle');
      return;
    }
    if (state.cooldownRemainingMs > 0) {
      this.setStatus(`Missile launcher cooling down · ${Math.ceil(state.cooldownRemainingMs / 1000)}s`);
      return;
    }

    const targetSelect = document.getElementById('military-missile-target') as HTMLSelectElement | null;
    const targetId = targetSelect?.value ?? '';
    if (!targetId) {
      this.setStatus('Select a valid hostile target');
      return;
    }

    const launch = this.battleSystem.launchMissile(targetId, {
      range: MISSILE_CONFIG.range,
      impactRadius: MISSILE_CONFIG.impactRadius,
      damage: MISSILE_CONFIG.damage,
    });
    if (!launch.ok) {
      this.setStatus(launch.message);
      this.syncMilitaryMissileUI();
      return;
    }

    this.services.state.setMissileState({
      ...state,
      stock: state.stock - 1,
      cooldownRemainingMs: MISSILE_CONFIG.cooldownMs,
    });
    this.save(false);
    this.syncMilitaryMissileUI();
    this.setStatus(`${launch.message} · missiles remaining ${state.stock - 1}`);
  }

  private updateMissileCapability(deltaMs: number): void {
    const current = this.services.state.getMissileState();
    const available = missilesUnlocked(this.militaryTier);
    const timersEnabled = !this.battleSystem.isUnderAttack() || this.battleSystem.isRunning();
    const tick = tickMissileState(
      current,
      deltaMs,
      available,
      !this.battleSystem.isActive(),
      timersEnabled,
    );
    this.services.state.setMissileState(tick.state);

    if (tick.produced || tick.supplyRestored || tick.cooldownReady) this.save(false);
    if (tick.produced) {
      this.setStatus(`Missile production complete · stock ${tick.state.stock}/${MISSILE_CONFIG.maxStock}`);
    }

    this.missileUiRefreshMs -= deltaMs;
    if (this.missileUiRefreshMs <= 0) {
      this.missileUiRefreshMs = 250;
      this.syncMilitaryMissileUI();
    }
  }

  private syncMilitaryMissileUI(): void {
    const section = document.getElementById('military-missiles');
    if (!section) return;

    const state = this.services.state.getMissileState();
    const unlocked = missilesUnlocked(this.militaryTier);
    section.hidden = false;

    const lock = document.getElementById('military-missile-lock');
    const stock = document.getElementById('military-missile-stock');
    const supply = document.getElementById('military-missile-supply');
    const production = document.getElementById('military-missile-production');
    const productionFill = document.getElementById('military-missile-production-fill') as HTMLElement | null;
    const cooldown = document.getElementById('military-missile-cooldown');
    const produce = document.getElementById('military-missile-produce') as HTMLButtonElement | null;
    const launch = document.getElementById('military-missile-launch') as HTMLButtonElement | null;
    const targetSelect = document.getElementById('military-missile-target') as HTMLSelectElement | null;
    const hint = document.getElementById('military-missile-hint');

    if (lock) lock.textContent = unlocked ? 'READY' : `LOCKED · TIER ${MISSILE_CONFIG.unlockTier}`;
    if (stock) stock.textContent = `${state.stock}/${MISSILE_CONFIG.maxStock}`;
    if (supply) supply.textContent = `${state.supply}/${MISSILE_CONFIG.maxSupply}`;
    const productionPercent = state.productionRemainingMs > 0
      ? 1 - state.productionRemainingMs / MISSILE_CONFIG.productionMs
      : 0;
    if (productionFill) productionFill.style.width = `${Math.round(productionPercent * 100)}%`;
    if (production) {
      production.textContent = state.productionRemainingMs > 0
        ? `${Math.ceil(state.productionRemainingMs / 1000)}s remaining`
        : 'Idle';
    }
    if (cooldown) {
      cooldown.textContent = state.cooldownRemainingMs > 0
        ? `${Math.ceil(state.cooldownRemainingMs / 1000)}s`
        : 'Ready';
    }

    if (produce) {
      produce.disabled =
        !unlocked ||
        this.battleSystem.isActive() ||
        state.productionRemainingMs > 0 ||
        state.stock >= MISSILE_CONFIG.maxStock ||
        state.supply < MISSILE_CONFIG.supplyCost;
      produce.textContent = state.productionRemainingMs > 0
        ? 'Producing Missile…'
        : `Produce Missile · ${MISSILE_CONFIG.supplyCost} Supply`;
    }

    let selectedTarget = targetSelect?.value ?? '';
    let selectedInRange = false;
    if (targetSelect) {
      const targets = this.battleSystem.getMissileTargets(MISSILE_CONFIG.range);
      targetSelect.innerHTML = '';
      if (targets.length === 0) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = this.battleSystem.isRunning() ? 'No hostile targets' : 'Start battle to acquire targets';
        targetSelect.append(option);
        selectedTarget = '';
      } else {
        for (const target of targets) {
          const option = document.createElement('option');
          option.value = target.id;
          option.disabled = !target.inRange;
          option.textContent =
            `${target.unitType} · ${Math.ceil(target.health)}/${Math.ceil(target.maxHealth)} HP · ${target.distance.toFixed(0)}m` +
            (target.inRange ? '' : ' · OUT OF RANGE');
          targetSelect.append(option);
        }
        const previous = targets.find((target) => target.id === selectedTarget && target.inRange);
        const firstValid = targets.find((target) => target.inRange);
        selectedTarget = previous?.id ?? firstValid?.id ?? '';
        targetSelect.value = selectedTarget;
        selectedInRange = Boolean(targets.find((target) => target.id === selectedTarget && target.inRange));
      }
    }

    if (launch) {
      launch.disabled =
        !unlocked ||
        !this.battleSystem.isRunning() ||
        state.stock <= 0 ||
        state.cooldownRemainingMs > 0 ||
        !selectedInRange;
    }

    if (hint) {
      hint.textContent = unlocked
        ? `Range ${MISSILE_CONFIG.range}m · radius ${MISSILE_CONFIG.impactRadius}m · ${MISSILE_CONFIG.cooldownMs / 1000}s cooldown. Production is disabled during battles; supply recharges over time.`
        : `Missiles are available in the unified game.`;
    }
  }

  private syncMilitaryUI(): void {
    const current = militaryTierDefinition(this.militaryTier);
    const next = MILITARY_TIERS[this.militaryTier];
    const tier = document.getElementById('military-tier-value');
    const name = document.getElementById('military-tier-name');
    const tech = document.getElementById('military-tier-tech');
    const nextText = document.getElementById('military-tier-next');
    const button = document.getElementById('military-upgrade') as HTMLButtonElement | null;
    if (tier) tier.textContent = `Tier ${this.militaryTier}`;
    if (name) name.textContent = current.name;
    if (tech) tech.textContent = `${current.technology}. Defenders +${Math.round((current.unitHealthMultiplier - 1) * 100)}% health, +${Math.round((current.unitDefenseMultiplier - 1) * 100)}% defense, +${Math.round((current.unitDamageMultiplier - 1) * 100)}% damage, +${Math.round((current.unitMoveSpeedMultiplier - 1) * 100)}% movement; walls +${Math.round((current.wallHealthMultiplier - 1) * 100)}% health; wall weapons +${Math.round((current.weaponDamageMultiplier - 1) * 100)}% damage and +${Math.round((current.weaponRangeMultiplier - 1) * 100)}% range.`;
    if (nextText) nextText.textContent = next ? `Next: upgrade an Army Camp to Level ${next.tier} in the Build panel · ${next.name}` : 'Maximum tier reached';
    if (button) { button.hidden = true; button.disabled = true; }
    this.syncMilitaryMissileUI();
  }

  private stopBattleFromUI(): void {
    if (this.endlessDefenseActive) {
      this.endlessDefensePaused = true;
      this.battleSystem.stop();
      this.updateBattleUI(this.battleSystem.status());
      this.setStatus('Endless Defense paused');
      return;
    }
    if (this.settingsStore.get().gameplay.combatFeedback) {
      audioEvents.emit({ action: 'play_sfx', assetId: 'combat.battle-stop' });
    }
    this.battleSystem.stop();
    this.setStatus('Battle stopped · press Start Battle to resume');
  }

  private resetBattleFromUI(): void {
    this.endlessDefenseActive = false;
    this.endlessDefensePaused = false;
    this.endlessDefenseWave = 0;
    this.endlessDefenseIntermissionMs = 0;
    this.endlessDefenseAwaitingNextWave = false;
    if (this.settingsStore.get().gameplay.combatFeedback) {
      audioEvents.emit({ action: 'play_sfx', assetId: 'combat.battle-reset' });
    }
    this.services.gateSystem.setAttackState(false);
    const preResetStatus = this.battleSystem.status();
    if (preResetStatus.mode !== 'idle') {
      this.commitPopulationBattleOutcome(preResetStatus, true);
    }
    this.battleSystem.reset();
    this.redraw();
    this.services.populationSystem.setMilitiaMobilized(false);
    this.populationBattleCommitted = false;
    this.populationBattleStart = null;
    this.syncPopulationDefenseAssignments(this.services.state.entries());
    this.reconcileSettlementAgents(this.services.state.entries());
    this.syncBattleSetupUI();
    this.syncIdleDefenderGarrison(true);
    document.getElementById('game-shell')?.classList.remove('battle-mode');
    this.workerLayer.visible = this.viewMode === 'world3d';
    this.settlementLayer.visible = this.viewMode === 'world3d';
    this.setStatus('Battle reset · castle damage remains');
  }

  private commitPopulationBattleOutcome(status: BattleStatus, force = false): void {
    if (
      this.populationBattleCommitted ||
      !this.populationBattleStart ||
      (!force && status.mode !== 'finished')
    ) {
      return;
    }

    const started = this.populationBattleStart;
    const alive = status.defenderAliveByType;
    this.services.populationSystem.applyProfessionalCasualties({
      swordsman: Math.max(0, started.defenderSwordsmen - alive.swordsman),
      archer: Math.max(0, started.defenderArchers - alive.archer),
      spearman: Math.max(0, started.defenderSpearmen - alive.spearman),
      crossbowman: Math.max(0, started.defenderCrossbowmen - alive.crossbowman),
    });
    this.services.populationSystem.setMilitiaMobilized(false);
    this.battleSetup = {
      ...this.battleSetup,
      defenderSwordsmen: alive.swordsman,
      defenderArchers: alive.archer,
      defenderSpearmen: alive.spearman,
      defenderCrossbowmen: alive.crossbowman,
      defenderModernSoldiers: 0,
    };
    this.populationBattleCommitted = true;
    this.populationBattleStart = null;
    this.syncBattleSetupUI();
    this.reconcileSettlementAgents(this.services.state.entries());
    this.updatePopulationUI();
    this.save(false);
  }


  private updateAdaptiveAudio(status: BattleStatus, deltaMs: number): void {
    if (status.mode === 'running') this.audioBattleRunningMs += Math.max(0, deltaMs);
    else this.audioBattleRunningMs = 0;

    const configuredDefenders = Math.max(
      1,
      this.battleSetup.defenderSwordsmen
        + this.battleSetup.defenderArchers
        + this.battleSetup.defenderSpearmen
        + this.battleSetup.defenderCrossbowmen
        + this.battleSetup.defenderModernSoldiers,
    );
    const defenderLossRatio = Math.min(
      1,
      Math.max(0, 1 - status.defendersAlive / configuredDefenders),
    );
    const directCombat =
      defenderLossRatio > 0.01
      || status.captureProgress > 0.01
      || this.audioBattleRunningMs > 4500;

    let intensity = 0;
    if (status.mode === 'running') {
      intensity = directCombat
        ? Math.min(2, 1.45 + defenderLossRatio * 0.35 + status.captureProgress * 0.25)
        : 0.78;
    } else if (status.mode === 'paused') {
      intensity = 0.48;
    }
    this.audioManager.setGameplayIntensity(intensity);

    if (status.mode === 'finished' && this.lastAudioBattleMode !== 'finished') {
      if (status.result?.winner === 'defender') {
        audioEvents.emit({ action: 'play_sfx', assetId: 'combat.victory', force: true });
      } else if (status.result?.winner === 'attacker') {
        audioEvents.emit({ action: 'play_sfx', assetId: 'combat.defeat', force: true });
      }
    }
    this.lastAudioBattleMode = status.mode;

    this.audioAmbientAccumulatorMs += Math.max(0, deltaMs);
    if (this.audioAmbientAccumulatorMs < 500) return;
    this.audioAmbientAccumulatorMs %= 500;

    const population = this.services.populationSystem.snapshot().totalPopulation;
    const layoutId = String(this.mapLayoutId);
    const water =
      layoutId.includes('island') || layoutId.includes('isle')
        ? 0.82
        : layoutId.includes('peninsula') || layoutId.includes('coast')
          ? 0.68
          : 0.28;
    const battleMix = status.mode === 'running'
      ? Math.min(1, 0.35 + intensity * 0.32)
      : 0;

    this.audioManager.setAmbientContext({
      wind: battleMix > 0 ? 0.62 : 0.48,
      birds: battleMix > 0 ? 0.08 : 0.52,
      water,
      settlement: Math.min(1, Math.max(0.12, population / 80)),
      fire: battleMix > 0 ? 0.08 : Math.min(0.45, 0.12 + population / 240),
      battle: battleMix,
    });
  }

  private updateBattleUI(status: BattleStatus): void {
    const panel = document.getElementById('battle-panel');
    if (panel) panel.dataset.battlePhase = status.mode;
    const mode = document.getElementById('battle-mode-status');
    const attackerAlive = document.getElementById('battle-attacker-alive');
    const defenderAlive = document.getElementById('battle-defender-alive');
    const captureLabel = document.getElementById('battle-capture-label');
    const captureFill = document.getElementById('battle-capture-fill');
    const result = document.getElementById('battle-result');
    const startButton = document.getElementById('battle-start') as HTMLButtonElement | null;
    const stopButton = document.getElementById('battle-stop') as HTMLButtonElement | null;
    const endlessButton = document.getElementById('battle-endless') as HTMLButtonElement | null;
    const battleSpeedLabel = document.getElementById('battle-speed-value');
    const battleSpeedDown = document.getElementById('battle-speed-down') as HTMLButtonElement | null;
    const battleSpeedUp = document.getElementById('battle-speed-up') as HTMLButtonElement | null;
    const battleSpeedReset = document.getElementById('battle-speed-reset') as HTMLButtonElement | null;

    if (mode) {
      mode.textContent =
        status.mode === 'running'
          ? 'BATTLE IN PROGRESS'
          : status.mode === 'paused'
            ? 'BATTLE STOPPED'
            : status.mode === 'finished'
              ? 'BATTLE COMPLETE'
              : 'SETUP';
    }

    if (attackerAlive) attackerAlive.textContent = String(status.attackersAlive);
    if (defenderAlive) defenderAlive.textContent = String(status.defendersAlive);
    if (status.mode === 'finished') this.commitPopulationBattleOutcome(status);
    this.updatePopulationUI();
    const missionPopulation = this.services.populationSystem.snapshot();
    const missionBattleChanged = this.missionSystem.observeBattle(status, missionPopulation.deadCivilians);
    if (missionBattleChanged || status.mode === 'finished') this.updateMissions(0, true, status);
    this.syncMilitaryMissileUI();

    if (captureLabel) {
      captureLabel.textContent =
        status.mode === 'idle'
          ? 'Castle capture inactive'
          : `Castle capture ${status.captureSeconds.toFixed(1)} / ${status.captureRequiredSeconds}s`;
    }

    if (captureFill) {
      (captureFill as HTMLElement).style.width = `${Math.round(status.captureProgress * 100)}%`;
    }

    if (startButton) {
      startButton.textContent = this.endlessDefensePaused ? 'Resume Endless Defense'
        : status.mode === 'paused' ? 'Resume Battle' : 'Start Battle';
      startButton.disabled = this.endlessDefenseActive ? !this.endlessDefensePaused
        : status.mode === 'running' || status.mode === 'finished';
    }

    if (stopButton) {
      stopButton.disabled = this.endlessDefenseActive ? this.endlessDefensePaused : status.mode !== 'running';
    }

    if (endlessButton) {
      endlessButton.textContent = this.endlessDefenseActive
        ? `Endless Defense · Wave ${Math.max(1, this.endlessDefenseWave)}`
        : 'Start Endless Defense';
      endlessButton.disabled = this.endlessDefenseActive || status.mode === 'running' || status.mode === 'paused';
    }

    if (battleSpeedLabel) battleSpeedLabel.textContent = `${status.battleSpeed}×`;
    const speedControlsEnabled = status.mode === 'running' || status.mode === 'paused';
    if (battleSpeedDown) battleSpeedDown.disabled = !speedControlsEnabled;
    if (battleSpeedUp) battleSpeedUp.disabled = !speedControlsEnabled;
    if (battleSpeedReset) battleSpeedReset.disabled = !speedControlsEnabled || status.battleSpeed === 1;

    // Battle status updates must never force the panel back open after the player dismisses it.
    // The panel is opened explicitly from the Battle/Military controls instead.

    if (!result) return;

    if (!status.result) {
      result.innerHTML = '';
      result.hidden = true;
      return;
    }

    const attackerWin = status.result.winner === 'attacker';
    result.hidden = false;
    result.innerHTML =
      '<strong>' +
      (attackerWin ? 'CASTLE CAPTURED' : 'CASTLE DEFENDED') +
      '</strong>' +
      '<span>Attackers remaining: ' +
      status.result.attackersRemaining +
      '</span>' +
      '<span>Defenders remaining: ' +
      status.result.defendersRemaining +
      '</span>' +
      '<span>Attackers killed: ' +
      status.result.attackersKilled +
      '</span>' +
      '<span>Defenders killed: ' +
      status.result.defendersKilled +
      '</span>' +
      '<span>Battle duration: ' +
      status.result.durationSeconds.toFixed(1) +
      's</span>';
  }

  private selectTool(tool: ToolKind | null): void {
    if (tool !== null && !this.isToolAvailable(tool)) {
      this.setStatus('Tool unavailable');
      return;
    }
    if (this.battleSystem.isActive()) {
      this.setStatus('Reset Battle before returning to construction');
      return;
    }

    this.buildPreviewKey = '';
    this.clearGroup(this.wallPreviewLayer);
    if (tool !== 'towerBridge') {
      this.towerBridgeStart = null;
      this.towerBridgeHover = null;
    }

    this.wallDragStart = null;
    this.wallDragEnd = null;
    this.roadDragStart = null;
    this.roadDragEnd = null;
    this.mountainRangeStart = null;
    this.mountainRangeEnd = null;
    this.terrainStrokeActive = false;
    this.terrainStrokeSnapshot = null;
    this.lastTerrainBrushKey = '';
    this.pointerStart = null;
    this.cancelLongPress();
    this.controls.enabled = true;
    this.selectedTool = tool;
    if (tool) audioEvents.emit({ action: 'play_sfx', assetId: 'ui.tool-select' });
    document.querySelectorAll('[data-tool]').forEach((element) => {
      const selected = tool !== null && (element as HTMLElement).dataset.tool === tool;
      element.classList.toggle('is-selected', selected);
      element.setAttribute('aria-pressed', String(selected));
    });
    const noneButton = document.querySelector('[data-build-none]');
    noneButton?.classList.toggle('is-selected', tool === null);
    noneButton?.setAttribute('aria-pressed', String(tool === null));

    if (tool !== null) {
      const category = GAME_DEFINITION.toolGroups.find((group) => group.toolIds.includes(tool));
      if (category) this.activeBuildCategory = category.label;
    }

    const activeLabel = document.getElementById('build-active-label');
    if (activeLabel) activeLabel.textContent = tool === null ? 'Inspect' : (document.querySelector<HTMLElement>('[data-tool="' + tool + '"] .tool-copy strong')?.textContent ?? tool);
    this.filterBuildTools();
    this.setStatus(tool === null ? 'Inspect mode · free camera / select objects' : 'Selected: ' + tool);
    for (const extension of this.extensions) extension.onToolSelected?.(tool);
  }

  private setStatus(text: string): void {
    const element = document.getElementById('save-status');
    if (element) element.textContent = text;
  }

  private resize(): void {
    const width = Math.max(1, this.root.clientWidth);
    const height = Math.max(1, this.root.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  private animate(time: number): void {
    const frameStartCpuMs = performance.now();
    const frameDeltaMs = this.lastFrameTime === 0 ? 16 : Math.max(0, time - this.lastFrameTime);
    const deltaMs = Math.min(50, frameDeltaMs);
    this.lastFrameTime = time;

    const settings = this.settingsStore.get();
    const cameraDistance = this.camera.position.distanceTo(this.controls.target);
    const completedConstruction = this.constructionAnimation.update(time, settings.interface.reducedMotion);
    if (completedConstruction.length > 0) {
      audioEvents.emit({ action: 'play_sfx', assetId: 'building.complete' });
    }
    const selectedProfile = this.adaptiveRenderProfile.resolve(settings.graphics.performanceMode);
    const renderProfile = this.performanceDebug.mobileBudgetEmulation ? 'performance' : selectedProfile;
    const visualBudget = this.distanceDetailBudget.update(
      this.scene,
      this.renderer,
      cameraDistance,
      settings,
      renderProfile,
    );
    if (!this.battleSystem.isActive()) {
      this.updateWorkers(deltaMs);
      this.updateSettlementAgents(deltaMs);
      for (const extension of this.extensions) extension.updateSettlement?.(deltaMs);
    }
    this.battleSystem.update(deltaMs, time);
    this.updateAdaptiveAudio(this.battleSystem.status(), deltaMs);
    this.updateEndlessDefense(deltaMs);
    this.updateEconomy(deltaMs);
    this.updateEnvironment(deltaMs);
    this.updateMissileCapability(deltaMs);
    this.updateMissions(deltaMs);
    this.updateLongPress(time);
    this.updateGodModeEffects(deltaMs);
    this.ambientFauna.update(deltaMs, time, {
      reducedMotion: settings.interface.reducedMotion,
      animationScale: visualBudget.budget.animationScale,
      cameraDistance: this.viewMode === 'plan2d' ? Infinity : cameraDistance,
      normalDistance: WORLD_STYLE.camera.referenceDistances.normalGameplay,
      strategicDistance: WORLD_STYLE.camera.referenceDistances.maximumStrategic,
    });
    const ambientScale = this.ambientMotion.update(deltaMs, time, {
      effectsEnabled: settings.graphics.effectsEnabled,
      reducedMotion: settings.interface.reducedMotion,
      quality: settings.graphics.quality,
      environmentDetail: settings.graphics.environmentDetail,
      performanceMode: renderProfile,
      cameraDistance,
      normalDistance: WORLD_STYLE.camera.referenceDistances.normalGameplay,
      strategicDistance: WORLD_STYLE.camera.referenceDistances.maximumStrategic,
      budgetScale: visualBudget.budget.animationScale,
    });
    if (ambientScale > 0) {
      this.services.windmillSystem.update((deltaMs / 1000) * ambientScale);
    }

    this.controls.update();
    this.enforceGameplayCameraBounds();
    const renderStartCpuMs = performance.now();
    this.performanceDebug.beginGpuFrame();
    this.renderer.render(this.scene, this.camera);
    this.performanceDebug.endGpuFrame();
    if (!this.performanceDebug.mobileBudgetEmulation && !document.hidden) {
      this.adaptiveRenderProfile.recordFrame(frameDeltaMs, settings.graphics.performanceMode);
    }
    this.performanceDebug.update(
      frameDeltaMs,
      renderStartCpuMs - frameStartCpuMs,
      performance.now() - renderStartCpuMs,
    );

    requestAnimationFrame((nextTime) => this.animate(nextTime));
  }
}
