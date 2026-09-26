import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createGameDomainServices } from './core/GameDomainServices';
import { SaveSystem } from './core/SaveSystem';
import type { GameState } from './state/GameState';
import { SAVE_KEY, SAVE_VERSION, TILE_SIZE, WORLD_COLS } from './core/constants';
import { WallSystem } from './building/WallSystem';
import { KeepRenderer } from './rendering/KeepRenderer';
import { MedievalMaterials } from './rendering/MedievalMaterials';
import { BattleSystem } from './battle/BattleSystem';
import type { BattleSetup, BattleStatus } from './battle/types';
import { MaritimeSystem } from './systems/MaritimeSystem';
import type { GameMode } from './core/GameMode';
import { getGameModeDefinition, isBuildingAvailable, isGameMode, isToolAvailable } from './core/GameMode';
import { audioEvents } from './audio/AudioEventBus';
import { AudioManager } from './audio/AudioManager';
import { FuturisticCastleRenderer } from './rendering/FuturisticCastleRenderer';
import type { SettingsStore } from './settings/SettingsStore';
import { applyGraphicsSettings, applyInputSettings } from './settings/SettingsSubsystems';
import type {
  AccessKind,
  GridCell,
  HarborKind,
  KeepRoofStyle,
  MarketBuildingKind,
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
const HARBOR_KINDS: HarborKind[] = ['smallDock', 'woodenPier', 'harbor', 'fishingDock'];
const BUILDING_KINDS: TileKind[] = [
  'wall1',
  'wall2',
  'wall3',
  'gate',
  'tower',
  'stairTower',
  'road',
  'dirtRoad',
  'stoneRoad',
  'smallDock',
  'woodenPier',
  'harbor',
  'fishingDock',
  'cottage',
  'house',
  'manor',
  'villa',
  'farm',
  'appleOrchard',
  'armyCamp',
  'marketStall',
  'smallMarket',
  'marketHall',
  'windmill',
  'mine',
  'mountain',
  'tree',
  'rock',
  'hut',
  'moat',
  'stoneStairs',
  'woodenStairs',
  'ramp',
  'ladder',
  'futuristicCastle',
];

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
}

interface SettlementAgent {
  id: number;
  role: 'citizen' | 'farmer';
  view: THREE.Group;
  home: GridPoint;
  work?: GridPoint;
  position: THREE.Vector3;
  target: THREE.Vector3;
  targetGrid: GridPoint;
  waitMs: number;
  phase: 'home' | 'work' | 'wander';
  speed: number;
  anim: number;
}

interface HistorySnapshot {
  cells: ReturnType<GameState['entries']>;
  keeps: KeepState[];
  terrain: Array<[string, TerrainOverrideKind]>;
  elevations: Array<[string, number]>;
  stoneStyle: StoneStyle;
  towerBridges: TowerBridgeState[];
}

const TOOL_GROUPS: Array<{ label: string; tools: ToolDefinition[] }> = [
  {
    label: 'Castle & Defense',
    tools: [
      { id: 'wall1', icon: '🪨', label: 'Stone Wall', detail: 'Drag A → B · stack floors', shortcut: '1' },
      { id: 'wall2', icon: '🪵', label: 'Wooden Wall', detail: 'Drag A → B · timber defense', shortcut: '2' },
      { id: 'wall3', icon: '🛡️', label: 'Reinforced Wall', detail: 'Drag A → B · heavy defense', shortcut: '3' },
      { id: 'gate', icon: '🚪', label: 'Gate', detail: 'Snaps into fortification lines', shortcut: '4' },
      { id: 'tower', icon: '🏰', label: 'Modular Tower', detail: '5 bases · medieval roof modules', shortcut: '5' },
      { id: 'stairTower', icon: '🗼', label: 'Stair Tower', detail: 'Ground ↕ Wall Walk access', shortcut: 'E' },
      { id: 'towerBridge', icon: '🌉', label: 'Tower Bridge', detail: 'Select two compatible towers', shortcut: 'D' },
      { id: 'keep', icon: '🏯', label: 'Modular Keep', detail: 'Width · depth · floors · roof', shortcut: 'P' },
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
      { id: 'marketStall', icon: '🪵', label: 'Market Stall', detail: 'Timber stall · counter · crates & goods', shortcut: '-' },
      { id: 'smallMarket', icon: '🏪', label: 'Small Market', detail: 'Covered market · multiple vendor stands', shortcut: '-' },
      { id: 'marketHall', icon: '🏛️', label: 'Market Hall', detail: 'Large trading hall · stalls & storage', shortcut: '-' },
    ],
  },
  {
    label: 'Agriculture',
    tools: [
      { id: 'farm', icon: '🌾', label: 'Farm', detail: 'Cultivated crop field', shortcut: 'F' },
      { id: 'appleOrchard', icon: '🍎', label: 'Apple Orchard', detail: 'Procedural apple trees · orchard plot', shortcut: 'Y' },
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
      { id: 'mountain', icon: '⛰️', label: 'Mountain', detail: 'Repeated clicks grow natural peaks', shortcut: 'N' },
      { id: 'mountainRange', icon: '🏔️', label: 'Mountain Range', detail: 'Drag A → B · ridge + foothills', shortcut: 'K' },
      { id: 'river', icon: '🌊', label: 'River', detail: 'Carve connected flowing water', shortcut: 'R' },
      { id: 'land', icon: '🌱', label: 'Land', detail: 'Fill water into buildable land', shortcut: 'L' },
      { id: 'raise', icon: '⬆️', label: 'Raise', detail: 'Raise terrain with brush', shortcut: 'U' },
      { id: 'lower', icon: '⬇️', label: 'Lower', detail: 'Lower terrain with brush', shortcut: 'J' },
      { id: 'flatten', icon: '▰', label: 'Flatten', detail: 'Level terrain to brush center', shortcut: 'B' },
      { id: 'smooth', icon: '〰️', label: 'Smooth', detail: 'Blend nearby terrain heights', shortcut: 'V' },
      { id: 'dig', icon: '⛏️', label: 'Dig', detail: 'Excavate deep ground', shortcut: 'G' },
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
      { id: 'armyCamp', icon: '⛺', label: 'Army Camp', detail: 'Large command tent · defender rally point', shortcut: 'A' },
    ],
  },
  {
    label: 'Harbor & Shipping',
    tools: [
      { id: 'smallDock', icon: '🛶', label: 'Small Dock', detail: 'Coast only · fishing boat', shortcut: '-' },
      { id: 'woodenPier', icon: '⚓', label: 'Wooden Pier', detail: 'Deep coast · transport dock', shortcut: '-' },
      { id: 'harbor', icon: '⛵', label: 'Harbor', detail: 'Deep coast · trading vessel', shortcut: '-' },
      { id: 'fishingDock', icon: '🎣', label: 'Fishing Dock', detail: 'Coast only · fishing gear', shortcut: '-' },
    ],
  },
];

export class ThreeGame {
  private readonly root: HTMLElement;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(48, 1, 0.1, 700);
  private readonly renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  private readonly controls: OrbitControls;
  /** Domain state and gameplay services are composed here, away from rendering/UI concerns. */
  private readonly services = createGameDomainServices();
  private readonly maritimeSystem = new MaritimeSystem({
    size: SIZE,
    terrainAt: (x, y) => this.terrainAt(x, y),
  });
    private readonly medievalMaterials = new MedievalMaterials();
  private readonly keepRenderer = new KeepRenderer(this.services.detailGenerator, this.medievalMaterials);
  private readonly futuristicCastleRenderer = new FuturisticCastleRenderer();
  private saveSystem!: SaveSystem;
  private readonly terrainOverrides = new Map<string, TerrainOverrideKind>();
  private readonly elevationOverrides = new Map<string, number>();
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly terrainLayer = new THREE.Group();
  private readonly buildLayer = new THREE.Group();
  private readonly planLayer = new THREE.Group();
  private readonly wallPreviewLayer = new THREE.Group();
  private readonly workerLayer = new THREE.Group();
  private readonly settlementLayer = new THREE.Group();
  private readonly battleLayer = new THREE.Group();
  private readonly planMaterials = new Map<string, THREE.MeshBasicMaterial>();
  private readonly environmentMaterials = new Map<string, THREE.MeshStandardMaterial>();
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
  private readonly riverTexture: THREE.CanvasTexture;
  private readonly riverWaterMaterial: THREE.MeshStandardMaterial;
  private readonly oceanTexture: THREE.CanvasTexture;
  private readonly oceanWaterMaterial: THREE.MeshStandardMaterial;
  private readonly shallowWaterMaterial: THREE.MeshStandardMaterial;
  private readonly settingsStore: SettingsStore;
  private readonly audioManager: AudioManager;

  private selectedTool: ToolKind | null = 'wall1';
  private selectedCell: GridPoint | null = null;
  private viewMode: ViewMode = 'world3d';
  private toolbarOpen = window.innerWidth > 760;
  private readonly saved3DCameraPosition = new THREE.Vector3(68, 80, 76);
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
  private keepWidth = 3;
  private keepDepth = 3;
  private keepFloors = 3;
  private keepRotation = 0;
  private keepCornerTowers = true;
  private keepRoof: KeepRoofStyle = 'flatBattlement';
  private keepBattlements = true;
  private selectedKeepId: number | null = null;
  private animatedFlags: THREE.Mesh[] = [];
  private brushSize = 2;
  private brushStrength = 1;
  private battleSetup: BattleSetup = {
    attackerSwordsmen: 30,
    attackerArchers: 20,
    attackerSpearmen: 12,
    attackerCrossbowmen: 8,
    defenderSwordsmen: 10,
    defenderArchers: 15,
    defenderSpearmen: 8,
    defenderCrossbowmen: 6,
  };

  private readonly undoStack: HistorySnapshot[] = [];
  private readonly redoStack: HistorySnapshot[] = [];
  private terrainStrokeActive = false;
  private terrainStrokeChanged = false;
  private terrainStrokeSnapshot: HistorySnapshot | null = null;
  private lastTerrainBrushKey = '';

  private wallDragStart: GridPoint | null = null;
  private wallDragEnd: GridPoint | null = null;
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
  private worldSeeded = false;
  private loadedSaveVersion = 0;
  private lastFrameTime = 0;
  private cameraTransitionFrame: number | null = null;

  constructor(root: HTMLElement, settingsStore: SettingsStore) {
    const hadSave = localStorage.getItem(SAVE_KEY) !== null;
    this.root = root;
    this.settingsStore = settingsStore;
    this.audioManager = new AudioManager();
    this.saveSystem = new SaveSystem({
      state: this.services.state,
      keepSystem: this.services.keepSystem,
      terrainOverrides: this.terrainOverrides,
      elevationOverrides: this.elevationOverrides,
      towerBridges: this.towerBridges,
      getGameMode: () => this.gameMode,
      getStoneStyle: () => this.stoneStyle,
      getWorldSeeded: () => this.worldSeeded,
      setWorldSeeded: (value) => { this.worldSeeded = value; },
      setLoadedSaveVersion: (value) => { this.loadedSaveVersion = value; },
      setStoneStyle: (value) => { this.stoneStyle = value; },
      migrateKind: (kind, level) => this.migrateKind(kind, level),
      isBuildingAvailable: (kind) => this.isBuildingAvailable(kind as TileKind),
      key: (x, y) => this.key(x, y),
      updateGameModeUI: () => this.updateGameModeUI(),
      syncTemplateAvailability: () => this.syncTemplateAvailability(),
      setStatus: (message) => this.setStatus(message),
    });
    this.riverTexture = this.createRiverTexture();
    this.oceanTexture = this.createOceanTexture();
    this.riverWaterMaterial = new THREE.MeshStandardMaterial({
      color: 0x55b9ca,
      map: this.riverTexture,
      roughness: 0.16,
      metalness: 0.08,
      transparent: true,
      opacity: 0.92,
      emissive: 0x0b4050,
      emissiveIntensity: 0.16,
    });
    this.oceanWaterMaterial = new THREE.MeshStandardMaterial({
      color: 0x0b7897,
      map: this.oceanTexture,
      roughness: 0.25,
      metalness: 0.08,
      transparent: true,
      opacity: 0.95,
      emissive: 0x062d42,
      emissiveIntensity: 0.12,
    });
    this.shallowWaterMaterial = new THREE.MeshStandardMaterial({
      color: 0x4aaeb6,
      map: this.oceanTexture,
      roughness: 0.34,
      metalness: 0.02,
      transparent: true,
      opacity: 0.78,
      emissive: 0x123b43,
      emissiveIntensity: 0.08,
    });
    applyGraphicsSettings(this.renderer, this.settingsStore.get());
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    root.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(0x718c91);
    this.scene.fog = new THREE.Fog(0x718c91, 112, 235);
    this.camera.position.set(68, 80, 76);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.minDistance = 34;
    this.controls.maxDistance = 150;
    this.controls.maxPolarAngle = Math.PI / 2;
    this.controls.target.set(0, 0, 0);
    applyInputSettings(this.controls, this.settingsStore.get());
    this.settingsStore.subscribe((settings) => {
      applyGraphicsSettings(this.renderer, settings);
      this.renderer.toneMappingExposure = settings.graphics.effectsEnabled ? 1.08 : 1;
      applyInputSettings(this.controls, settings);
      this.audioManager.setMasterVolume(settings.audio.masterVolume);
      this.audioManager.setMusicVolume(settings.audio.musicVolume);
      this.audioManager.setSfxVolume(settings.audio.sfxVolume);
      this.audioManager.setMuted(settings.audio.muted);
      document.documentElement.style.setProperty('--castle-ui-scale', String(settings.interface.uiScale));
      document.documentElement.toggleAttribute('data-reduced-motion', settings.interface.reducedMotion);
      document.documentElement.toggleAttribute('data-high-contrast', settings.interface.highContrast);
    });

    this.addLights();
    this.createWorld();

    this.scene.add(this.terrainLayer);
    this.scene.add(this.buildLayer);
    this.scene.add(this.planLayer);
    this.scene.add(this.wallPreviewLayer);
    this.scene.add(this.workerLayer);
    this.scene.add(this.settlementLayer);
    this.scene.add(this.battleLayer);
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
        keeps: () => this.services.keepSystem.entries(),
        towerBridges: () => Array.from(this.towerBridges.values()).map((bridge) => ({ ...bridge })),
        setWallBattleVisibility: (x, y, visible) => this.setBattleWallVisibility(x, y, visible),
        buildingDamageAt: (x, y) => this.services.state.getCell(x, y)?.damage ?? 0,
        setBuildingDamage: (x, y, damageRatio) => this.setBuildingDamage(x, y, damageRatio),
        gatePassable: (x, y) => this.services.gateSystem.isGatePassable(x, y),
      },
      (status) => this.updateBattleUI(status),
    );

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

    if (this.gameMode === 'medieval') this.createWorkers();
    this.redraw();
    this.bindUI();
    // Keep the construction tool initialized during world creation/redraw, then enter the neutral mode only after UI binding.
    this.selectTool(null);
    this.setToolbarOpen(this.toolbarOpen);
    this.setViewMode(hadSave ? 'world3d' : 'plan2d');
    this.updateGameModeUI();
    this.syncTemplateAvailability();
    audioEvents.emit({ action: 'set_mode', mode: this.gameMode });
    if (!hadSave) {
      const modeModal = document.getElementById('game-mode-modal');
      if (modeModal) modeModal.hidden = false;
    }
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

  private isToolAvailable(tool: ToolKind): boolean {
    return isToolAvailable(this.gameMode, tool);
  }

  private isBuildingAvailable(kind: TileKind): boolean {
    return isBuildingAvailable(this.gameMode, kind);
  }

  private updateGameModeUI(): void {
    const label = document.getElementById('game-mode-label');
    const button = document.getElementById('game-mode-button');
    const config = getGameModeDefinition(this.gameMode);
    if (label) label.textContent = config.label;
    if (button) button.setAttribute('aria-label', 'Current game mode: ' + config.label);
    const battleButton = document.getElementById('battle-button');
    if (battleButton) battleButton.hidden = this.gameMode === 'modern';
  }

  private syncTemplateAvailability(): void {
    document.querySelectorAll<HTMLButtonElement>('[data-template]').forEach((button) => {
      const template = button.dataset.template;
      button.hidden = this.gameMode === 'modern'
        ? template !== 'futuristic-castle'
        : template === 'futuristic-castle';
    });
  }

  private refreshBuildPanelForMode(): void {
    const toolbar = document.getElementById('toolbar');
    if (!toolbar) return;

    toolbar.querySelectorAll<HTMLElement>('.tool-category').forEach((category) => category.remove());

    const modeConfig = getGameModeDefinition(this.gameMode);
    const toolDefinitions = new Map(
      TOOL_GROUPS.flatMap((group) => group.tools.map((tool) => [tool.id, tool] as const)),
    );
    const noneButton = toolbar.querySelector<HTMLElement>('[data-build-none]');
    const settings = toolbar.querySelector<HTMLElement>('.builder-settings');
    if (!settings) return;

    const toolHtml = modeConfig.toolGroups.map((group) => {
      const buttons = group.toolIds
        .map((toolId) => toolDefinitions.get(toolId))
        .filter((tool): tool is ToolDefinition => Boolean(tool))
        .map(
          (tool) =>
            '<button class="tool-button' +
            (tool.id === this.selectedTool ? ' is-selected' : '') +
            '" data-tool="' + tool.id + '">' +
            '<span class="tool-icon">' + tool.icon + '</span>' +
            '<span class="tool-copy"><strong>' + tool.label + '</strong><small>' + tool.detail + '</small></span>' +
            '<kbd>' + tool.shortcut + '</kbd></button>',
        )
        .join('');

      return (
        '<section class="tool-category" data-category="' + group.label + '">' +
        '<button class="tool-category-header" type="button" aria-expanded="false">' +
        '<span>' + group.label + '</span>' +
        '<span class="tool-category-chevron" aria-hidden="true">▶</span>' +
        '</button>' +
        '<div class="tool-category-items">' + buttons + '</div>' +
        '</section>'
      );
    }).join('');

    settings.insertAdjacentHTML('beforebegin', toolHtml);
    settings.hidden = this.gameMode === 'modern';

    toolbar.querySelectorAll<HTMLButtonElement>('.tool-category-header').forEach((header) => {
      header.onclick = () => {
        const category = header.closest<HTMLElement>('.tool-category');
        if (!category) return;
        const open = category.classList.toggle('is-open');
        header.setAttribute('aria-expanded', String(open));
      };
    });

    toolbar.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach((button) => {
      button.onclick = () => {
        toolbar.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach((item) => {
          item.classList.toggle('is-selected', item === button);
        });
        this.selectTool(button.dataset.tool as ToolKind);
        if (window.matchMedia('(max-width: 760px)').matches) this.setToolbarOpen(false);
      };
    });

    noneButton?.classList.toggle('is-selected', this.selectedTool === null);
    noneButton?.setAttribute('aria-pressed', String(this.selectedTool === null));
  }

  private openGameModeSelector(): void {
    const modal = document.getElementById('game-mode-modal');
    if (modal) modal.hidden = false;
  }

  private startNewGameWithMode(mode: GameMode): void {
    this.services.state.setGameMode(mode);
    audioEvents.emit({ action: 'set_mode', mode });
    this.services.state.clear();
    this.services.keepSystem.clear();
    this.towerBridges.clear();
    this.nextTowerBridgeId = 1;
    this.towerBridgeStart = null;
    this.towerBridgeHover = null;
    this.clearGroup(this.wallPreviewLayer);
    this.selectedCell = null;
    this.selectedKeepId = null;
    this.terrainOverrides.clear();
    this.elevationOverrides.clear();
    this.moatTasks.clear();
    this.clearGroup(this.workerLayer);
    this.clearGroup(this.settlementLayer);
    this.workers.length = 0;
    this.settlementAgents.length = 0;
    this.nextSettlementAgentId = 1;
    this.battleSystem.stop();
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    this.worldSeeded = false;
    this.seedNaturalProps();
    this.worldSeeded = true;
    this.selectedTool = null;
    this.updateGameModeUI();
    this.syncTemplateAvailability();
    this.refreshBuildPanelForMode();
    this.redraw();
    this.save(false);
    const modeModal = document.getElementById('game-mode-modal');
    if (modeModal) modeModal.hidden = true;
    const templates = document.getElementById('templates-modal');
    if (templates) templates.hidden = false;
    this.selectTool(null);
    this.setStatus('Mode selected: ' + getGameModeDefinition(mode).label);
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
    const sky = new THREE.HemisphereLight(0xb8d9e5, 0x2f2a24, 1.15);
    this.scene.add(sky);

    const sun = new THREE.DirectionalLight(0xffddb4, 4.65);
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

    const coolFill = new THREE.DirectionalLight(0x7eb8c8, 0.56);
    coolFill.position.set(-50, 34, -42);
    this.scene.add(coolFill);

    const warmBounce = new THREE.PointLight(0xd2a56f, 8, 95, 2);
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

    const shallowWater = new THREE.Mesh(
      new THREE.RingGeometry(WORLD * 0.43, WORLD * 0.65, 112),
      this.shallowWaterMaterial,
    );
    shallowWater.rotation.x = -Math.PI / 2;
    shallowWater.position.y = 0.95;
    shallowWater.receiveShadow = true;
    shallowWater.userData.waterLayer = 'shallow';
    this.scene.add(shallowWater);

    const islandGeometry = this.createIrregularIslandGeometry(
      WORLD * 0.49,
      WORLD * 0.55,
      2.6,
      112,
    );
    const island = new THREE.Mesh(
      islandGeometry,
      new THREE.MeshStandardMaterial({ color: 0x79694c, roughness: 1 }),
    );
    island.receiveShadow = true;
    island.castShadow = true;
    this.scene.add(island);

    const grassGeometry = this.createIrregularIslandGeometry(
      WORLD * 0.46,
      WORLD * 0.49,
      1.2,
      112,
    );
    const grass = new THREE.Mesh(
      grassGeometry,
      new THREE.MeshStandardMaterial({ color: 0x94aa58, roughness: 0.94 }),
    );
    grass.position.y = 1.55;
    grass.receiveShadow = true;
    this.scene.add(grass);

    const grid = new THREE.GridHelper(WORLD, SIZE, 0xe8f7ff, 0x7eb8bd);
    grid.position.y = 2.18;
    (grid.material as THREE.Material).opacity = 0.075;
    (grid.material as THREE.Material).transparent = true;
    this.scene.add(grid);
  }

  private createIrregularIslandGeometry(
    topRadius: number,
    bottomRadius: number,
    height: number,
    segments: number,
  ): THREE.CylinderGeometry {
    const geometry = new THREE.CylinderGeometry(
      topRadius,
      bottomRadius,
      height,
      segments,
      1,
      false,
    );
    const position = geometry.attributes.position;

    for (let i = 0; i < position.count; i += 1) {
      const x = position.getX(i);
      const z = position.getZ(i);
      const radius = Math.hypot(x, z);
      if (radius < 0.01) continue;

      const angle = Math.atan2(z, x);
      const variation =
        1 +
        Math.sin(angle * 5 + 0.7) * 0.022 +
        Math.cos(angle * 9 - 1.1) * 0.014 +
        Math.sin(angle * 13 + 2.4) * 0.009;
      position.setX(i, x * variation);
      position.setZ(i, z * variation);
    }

    position.needsUpdate = true;
    geometry.computeVertexNormals();
    return geometry;
  }

  private baseTerrainAt(x: number, y: number): TerrainKind {
    if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return 'water';

    const nx = (x + 0.5) / SIZE - 0.5;
    const ny = (y + 0.5) / SIZE - 0.5;
    const radial = Math.sqrt(nx * nx * 0.94 + ny * ny * 1.04);
    const coastNoise =
      Math.sin(x * 0.73 + y * 0.19) * 0.018 +
      Math.cos(y * 0.61 - x * 0.17) * 0.022 +
      Math.sin((x + y) * 0.31) * 0.014 +
      Math.cos((x - y) * 0.24) * 0.011;
    const islandValue = 0.43 - radial + coastNoise;

    if (islandValue < -0.035) return 'water';
    if (islandValue < 0.02) return 'shore';

    const riverCenter =
      SIZE * 0.48 +
      Math.sin(y * 0.54) * 1.18 +
      Math.sin(y * 0.18 + 1.2) * 0.42;
    const riverWidth =
      0.48 +
      (Math.sin(y * 0.37 + 0.8) + 1) * 0.16 +
      (y > SIZE * 0.62 ? 0.12 : 0);
    if (
      y > 2 &&
      y < SIZE - 2 &&
      Math.abs(x - riverCenter) < riverWidth &&
      islandValue > 0.055
    ) {
      return 'river';
    }

    const rockyNoise =
      Math.sin(x * 0.47 + y * 0.22) +
      Math.cos(y * 0.53 - x * 0.18);
    const mountainZone =
      (x > SIZE * 0.61 && y < SIZE * 0.43) ||
      (x > SIZE * 0.7 && y > SIZE * 0.46 && y < SIZE * 0.7);
    if (mountainZone && rockyNoise > 0.48) return 'mountain';

    const forestNoise =
      Math.sin(x * 0.61) +
      Math.cos(y * 0.49) +
      Math.sin((x + y) * 0.33);
    const denseForest =
      (x < SIZE * 0.37 && y > SIZE * 0.35) ||
      (x > SIZE * 0.62 && y > SIZE * 0.56) ||
      (x < SIZE * 0.28 && y < SIZE * 0.34);
    if (denseForest && forestNoise > -0.25) return 'forest';

    return 'plains';
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

  private setAbsoluteElevation(x: number, y: number, absolute: number): void {
    const clamped = THREE.MathUtils.clamp(absolute, -1.6, 6);
    const offset = clamped - this.baseTerrainElevation(x, y);
    if (Math.abs(offset) < 0.02) this.elevationOverrides.delete(this.key(x, y));
    else this.elevationOverrides.set(this.key(x, y), offset);
  }

  private isTerrainTool(tool: ToolKind): tool is TerrainToolKind {
    return ['raise', 'lower', 'flatten', 'smooth', 'dig', 'hill', 'cliff'].includes(tool);
  }

  private gridToWorld(gx: number, gy: number): { x: number; z: number } {
    return {
      x: (gx - SIZE / 2 + 0.5) * TILE,
      z: (gy - SIZE / 2 + 0.5) * TILE,
    };
  }

  private seedNaturalProps(): void {
    for (let y = 0; y < SIZE; y += 1) {
      for (let x = 0; x < SIZE; x += 1) {
        if (this.services.state.getCell(x, y)) continue;

        const terrain = this.baseTerrainAt(x, y);
        const h1 = Math.abs((x * 92821 + y * 68917 + x * y * 137) % 997);
        const h2 = Math.abs((x * 53 + y * 97 + x * y * 11) % 101);

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
          if (this.gameMode === 'medieval' && h1 % 31 === 5 && x > 3 && y > 3) {
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
      this.workers.push({ id: i, view, homeX, homeZ });
    }
  }

  private clearGroup(group: THREE.Group): void {
    group.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();

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

  private redraw(): void {
    this.clearGroup(this.terrainLayer);
    this.clearGroup(this.buildLayer);
    this.services.gateSystem.clear();
    this.services.windmillSystem.clear();
    this.buildObjectsByCell.clear();
    this.clearGroup(this.planLayer);
    this.renderTerrain();

    const floodedMoats = this.computeFloodedMoats();
    const cells = this.services.state.entries();

    for (const cell of cells) {
      const building = this.makeBuilding(cell, floodedMoats);
      building.userData.cellKey = this.key(cell.x, cell.y);
      building.userData.cellKind = cell.kind;
      this.buildObjectsByCell.set(this.key(cell.x, cell.y), building);
      this.buildLayer.add(building);
    }

    for (const keep of this.services.keepSystem.entries()) {
      this.buildLayer.add(
        this.keepRenderer.render(keep, {
          tileSize: TILE,
          toWorld: (x, y) => this.gridToWorld(x, y),
          elevationAt: (x, y) => this.terrainElevation(x, y),
          terrainAt: (x, y) => this.terrainAt(x, y),
          kindAt: (x, y) => this.kindAt(x, y),
          stoneStyle: this.stoneStyle,
        }),
      );
    }

    for (const bridge of this.towerBridges.values()) {
      this.buildLayer.add(this.makeTowerBridge(bridge));
    }

    const generatedAccess = this.services.castleAccessSystem.generate(
      cells,
      this.services.keepSystem.entries(),
      {
        size: SIZE,
        getCell: (x, y) => {
          const cell = this.services.state.getCell(x, y);
          return cell ? { x, y, ...cell } : undefined;
        },
        terrainBuildable: (x, y) => {
          const terrain = this.terrainAt(x, y);
          return terrain !== 'water' && terrain !== 'river';
        },
        isOccupied: (x, y) =>
          Boolean(this.services.state.getCell(x, y)) ||
          Boolean(this.services.keepSystem.findAtCell(x, y)),
      },
    );

    for (const access of generatedAccess) {
      const group = new THREE.Group();
      const position = this.gridToWorld(access.x, access.y);
      group.position.set(position.x, this.terrainElevation(access.x, access.y), position.z);
      this.makeAccess(group, access.kind, access.x, access.y, {
        kind: access.kind,
        rotation: access.rotation,
      });
      this.buildLayer.add(group);
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
    this.refreshSettlementAgents(cells);
    this.updatePopulationUI();

    this.animatedFlags = [];
    this.buildLayer.traverse((object) => {
      if (object instanceof THREE.Mesh && object.userData.castleFlag) {
        this.animatedFlags.push(object);
      }
    });
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
      water: 0x2a6d86,
      shore: 0xc7b889,
      plains: 0x87a85d,
      river: 0x4baec4,
      mountain: 0x857a70,
      forest: 0x4f784c,
    };

    for (let y = 0; y < SIZE; y += 1) {
      for (let x = 0; x < SIZE; x += 1) {
        const position = this.gridToWorld(x, y);
        const terrain = this.terrainAt(x, y);
        const elevation = this.terrainElevation(x, y);
        const tone = THREE.MathUtils.clamp(1 + elevation * 0.025, 0.86, 1.12);
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
      stairTower: 0xa89d8a,
      road: 0x9a7658,
      dirtRoad: 0x8a6142,
      stoneRoad: 0xa9a195,
      smallDock: 0x765137,
      woodenPier: 0x6d4931,
      harbor: 0x57402f,
      fishingDock: 0x805a3d,
      cottage: 0xd69f78,
      house: 0xb899ce,
      manor: 0xc97888,
      villa: 0x70b4ac,
      farm: 0xc2ad54,
      appleOrchard: 0x9c6d3e,
      armyCamp: 0x8f6b4d,
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

      if (cell.kind === 'tower' || cell.kind === 'stairTower') {
        const radius =
          cell.kind === 'stairTower'
            ? 1.35
            :
          (cell.towerShape ?? 'round') === 'watch' ? 1.7 : 2.08;
        const tower = new THREE.Mesh(
          new THREE.CircleGeometry(
            radius,
            cell.kind === 'stairTower'
              ? 10
              : (cell.towerShape ?? 'round') === 'octagonal'
                ? 8
                : 20,
          ),
          this.planMaterial(color),
        );
        tower.rotation.x = -Math.PI / 2;
        tower.position.set(position.x, 10.3, position.z);
        tower.renderOrder = 44;
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

    if (planMode) {
      this.camera.up.set(0, 1, 0);
      this.camera.position.set(0, 118, 0.001);
      this.controls.target.set(0, 0, 0);
      this.controls.enableRotate = false;
      this.controls.enablePan = true;
      this.controls.minDistance = 52;
      this.controls.maxDistance = 155;
      this.setStatus('2D Plan mode · design first, then switch to 3D');
    } else {
      this.camera.up.set(0, 1, 0);
      this.camera.position.copy(this.saved3DCameraPosition);
      this.controls.target.copy(this.saved3DTarget);
      this.controls.enableRotate = true;
      this.controls.enablePan = true;
      this.controls.minDistance = 34;
      this.controls.maxDistance = 150;
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
          group.position.y = elevation;
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
    if (hash % 5 !== 0) return;

    const color =
      terrain === 'forest'
        ? hash % 2 === 0 ? 0x718f4b : 0x5f7f46
        : hash % 3 === 0 ? 0xa6b966 : 0x94aa5b;
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
      const earth = this.environmentMaterial('terrain-dig-earth', 0x51453a, 1);
      const side = this.environmentMaterial('terrain-dig-side', 0x78644b, 1);
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
    const group = new THREE.Group();
    const position = this.gridToWorld(cell.x, cell.y);
    group.position.set(position.x, this.terrainElevation(cell.x, cell.y), position.z);

    if (ROAD_KINDS.includes(cell.kind as RoadKind)) this.makeRoad(group, cell.x, cell.y, cell.kind as RoadKind);
    else if (HARBOR_KINDS.includes(cell.kind as HarborKind)) this.makeHarbor(group, cell.kind as HarborKind, cell.x, cell.y, cell);
    else if (WALL_KINDS.includes(cell.kind as WallKind)) {
      this.makeWall(group, cell.kind as WallKind, cell.x, cell.y, cell);
    } else if (cell.kind === 'gate') this.makeGate(group, cell.x, cell.y);
    else if (cell.kind === 'tower') this.makeTower(group, cell.x, cell.y, cell);
    else if (cell.kind === 'stairTower') this.makeStairTower(group, cell.x, cell.y, cell);
    else if (cell.kind === 'farm') this.makeFarm(group);
    else if (cell.kind === 'marketStall' || cell.kind === 'smallMarket' || cell.kind === 'marketHall') {
      this.makeMarketBuilding(group, cell.kind as MarketBuildingKind);
    }
    else if (cell.kind === 'appleOrchard') this.services.orchardSystem.create(group, cell.level ?? 1, cell.x * 97 + cell.y * 53);
    else if (cell.kind === 'armyCamp') this.makeArmyCamp(group);
    else if (cell.kind === 'futuristicCastle') group.add(this.futuristicCastleRenderer.render(cell.x * 97 + cell.y * 53));
    else if (cell.kind === 'windmill') this.services.windmillSystem.create(group);
    else if (cell.kind === 'mine') this.makeMine(group);
    else if (cell.kind === 'mountain') this.makeMountain(group, cell.level ?? 1, cell.x, cell.y);
    else if (cell.kind === 'tree') this.makeTree(group, cell.level ?? 1);
    else if (cell.kind === 'rock') this.makeRock(group, cell.level ?? 1);
    else if (cell.kind === 'hut') this.makeHut(group);
    else if (cell.kind === 'moat') this.makeMoat(group, floodedMoats.has(this.key(cell.x, cell.y)));
    else if (['stoneStairs', 'woodenStairs', 'ramp', 'ladder'].includes(cell.kind)) {
      this.makeAccess(group, cell.kind as AccessKind, cell.x, cell.y, cell);
    } else {
      this.makeHouse(group, cell.kind as 'cottage' | 'house' | 'manor' | 'villa');
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

  private setBuildingDamage(x: number, y: number, damageRatio: number): void {
    const cell = this.services.state.getCell(x, y);
    if (!cell || !this.services.destructibleBuildingSystem.isDestructible(cell.kind)) return;

    const nextDamage = this.services.destructibleBuildingSystem.setDamageRatio(damageRatio);
    if (Math.abs((cell.damage ?? 0) - nextDamage) < 0.0001) return;
    this.services.state.updateCell(x, y, { damage: nextDamage });
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
          ? this.environmentMaterial('road-stone', 0x9b9487, 0.98)
          : this.environmentMaterial('road-standard', 0x8b6d55, 0.95);
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
          ? this.environmentMaterial('bridge-stone', 0x918a7d, 1)
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
      this.addBox(group, 0.15, 0.025, 1.6, track, -0.42, 2.37, 0);
      this.addBox(group, 0.15, 0.025, 1.6, track, 0.42, 2.37, 0);
    } else if (kind === 'stoneRoad') {
      const joint = this.environmentMaterial('road-joint', 0x5b5751, 1);
      for (let i = -1; i <= 1; i += 1) {
        this.addBox(group, 1.62, 0.025, 0.055, joint, 0, 2.38, i * 0.5);
      }
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
    kind: HarborKind,
    _gx: number,
    _gy: number,
    cell: GridCell,
  ): THREE.Group {
    const timber = this.environmentMaterial('harbor-timber', 0x6c4a32, 0.98);
    const timberDark = this.environmentMaterial('harbor-timber-dark', 0x493224, 1);
    const rope = this.environmentMaterial('harbor-rope', 0xb29a68, 1);
    const crate = this.environmentMaterial('harbor-crate', 0x855f3d, 1);
    const barrel = this.environmentMaterial('harbor-barrel', 0x70482f, 1);
    const stone = this.environmentMaterial('harbor-stone', 0x777168, 1);

    const pierLength =
      kind === 'smallDock' ? 4.9 :
      kind === 'fishingDock' ? 5.7 :
      kind === 'woodenPier' ? 7.0 :
      7.8;
    const pierWidth =
      kind === 'harbor' ? 2.7 :
      kind === 'woodenPier' ? 1.65 :
      kind === 'fishingDock' ? 1.55 :
      1.35;

    const shoreDeck = this.addBox(
      group,
      pierWidth + (kind === 'harbor' ? 1.9 : 0.55),
      0.28,
      2.1,
      kind === 'harbor' ? stone : timber,
      0,
      2.42,
      -0.45,
    );
    shoreDeck.castShadow = true;

    this.addBox(
      group,
      pierWidth,
      0.24,
      pierLength,
      timber,
      0,
      2.36,
      -pierLength / 2 - 0.6,
    );

    const supportCount = Math.max(3, Math.floor(pierLength / 1.45));
    for (let i = 0; i < supportCount; i += 1) {
      const z = -1.35 - i * ((pierLength - 0.8) / Math.max(1, supportCount - 1));
      for (const x of [-pierWidth * 0.42, pierWidth * 0.42]) {
        this.addBox(group, 0.14, 2.6, 0.14, timberDark, x, 1.2, z);
      }
    }

    if (kind === 'harbor' || kind === 'fishingDock') {
      const side = kind === 'harbor' ? 1.7 : 1.05;
      this.addBox(group, side, 0.22, 2.4, timber, pierWidth / 2 + side / 2 - 0.08, 2.38, -pierLength + 0.65);
      this.addBox(group, side, 0.22, 2.4, timber, -pierWidth / 2 - side / 2 + 0.08, 2.38, -pierLength + 0.65);
    }

    const postMaterial = timberDark;
    for (const x of [-pierWidth * 0.55, pierWidth * 0.55]) {
      this.addBox(group, 0.13, 1.0, 0.13, postMaterial, x, 2.82, -1.5);
      this.addBox(group, 0.13, 1.0, 0.13, postMaterial, x, 2.82, -pierLength + 0.25);
    }

    const ropeMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, pierLength - 1.8, 5), rope);
    ropeMesh.rotation.x = Math.PI / 2;
    ropeMesh.position.set(pierWidth * 0.58, 3.0, -pierLength / 2 - 0.58);
    group.add(ropeMesh);

    const detailZ = -1.45;
    this.addBox(group, 0.62, 0.55, 0.62, crate, -0.45, 2.75, detailZ);
    this.addBox(group, 0.48, 0.68, 0.48, barrel, 0.48, 2.78, detailZ - 0.18);

    if (kind === 'fishingDock') {
      const mast = this.addBox(group, 0.08, 1.8, 0.08, timberDark, -0.42, 3.35, -2.4);
      mast.rotation.z = -0.18;
      this.addBox(group, 0.85, 0.05, 0.05, rope, -0.72, 4.05, -2.4);
    }

    const shipKind = cell.shipKind ?? this.maritimeSystem.defaultShip(kind);
    if (shipKind) {
      this.makeDockedShip(group, shipKind, -pierLength - 1.35, kind === 'harbor' ? 1.6 : -1.15);
    }

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
  }

  private wallThicknessValue(kind: WallKind, thickness: WallThickness): number {
    const base = kind === 'wall1' ? 1.85 : kind === 'wall2' ? 1.65 : 2.05;
    const multiplier = thickness === 'thin' ? 0.78 : thickness === 'thick' ? 1.3 : 1;
    return base * multiplier;
  }

  private wallConnections(gx: number, gy: number, cell: GridCell): WallDirection[] {
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
    const battlement = cell.battlement ?? true;
    const walkway = cell.walkway ?? false;
    const links = this.wallConnections(gx, gy, cell);

    const baseHeight = kind === 'wall1' ? 5.2 : kind === 'wall2' ? 4.7 : 5.8;
    const height = baseHeight + Math.max(0, level - 1) * 2.15;
    const topY = 2.58 + height;

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
    const foundationHeight = 0.72 + foundationDrop;

    this.addBox(
      group,
      junctionThickness * 1.52,
      foundationHeight,
      junctionThickness * 1.52,
      darkMaterial,
      0,
      2.22 - foundationHeight / 2 + 0.24,
      0,
    );
    this.addBox(
      group,
      junctionThickness * 1.3,
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
          walkway,
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
          walkway,
          links.length >= 2 || neighbor.kind === 'tower' || neighbor.kind === 'gate',
        );
      }
    }

    const corner = this.services.wallCornerSystem.analyze(cell, links, gx, gy);
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
        walkway,
        walkwayMaterial,
      );
    } else if (walkway) {
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
    const visibleFloorLines = Math.min(Math.max(0, level - 1), 10);
    for (let floor = 1; floor <= visibleFloorLines; floor += 1) {
      this.addBox(
        group,
        junctionThickness * 1.16,
        0.16,
        junctionThickness * 1.16,
        darkMaterial,
        0,
        2.58 + baseHeight + floor * 2.15 - 1.05,
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
    const bodyLength = run + 0.24;
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
    const foundationDepth = 0.82 + terrainDrop * 0.8 + Math.abs(elevationDelta) * 0.2;
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
        Math.max(1.05, thickness - 0.32),
        0.3,
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

  private addCrenellatedParapet(
    group: THREE.Group,
    span: number,
    sideOffset: number,
    y: number,
    material: THREE.Material,
    endInset = 0,
  ): void {
    const merlonWidth = 0.68;
    const crenelWidth = 0.48;
    const baseHeight = 0.42;
    const merlonHeight = 0.92;
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
      depth: 0.34,
      bevelEnabled: true,
      bevelSize: 0.04,
      bevelThickness: 0.035,
      bevelSegments: 1,
      curveSegments: 1,
    });
    geometry.rotateY(Math.PI / 2);
    geometry.translate(-0.17, 0, 0);

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

  private makeGate(group: THREE.Group, gx: number, gy: number): THREE.Group {
    const wallMaterial = this.medievalMaterials.castleStone(this.stoneStyle, 'body', gx, gy);
    const foundation = this.medievalMaterials.castleStone(this.stoneStyle, 'foundation', gx, gy);
    const woodMaterial = this.medievalMaterials.timber;
    const darkWood = this.medievalMaterials.timberDark;
    const shadow = this.medievalMaterials.arrowVoid;

    const horizontalNeighbors =
      Number(this.isWallFamily(this.kindAt(gx - 1, gy))) +
      Number(this.isWallFamily(this.kindAt(gx + 1, gy)));
    const verticalNeighbors =
      Number(this.isWallFamily(this.kindAt(gx, gy - 1))) +
      Number(this.isWallFamily(this.kindAt(gx, gy + 1)));
    const vertical = verticalNeighbors > horizontalNeighbors;

    const core = new THREE.Group();
    const door = new THREE.Group();
    this.addBox(core, 3.75, 0.8, 2.55, foundation, 0, 2.15, 0);
    this.addBox(core, 0.92, 5.25, 2.38, wallMaterial, -1.42, 5.2, 0);
    this.addBox(core, 0.92, 5.25, 2.38, wallMaterial, 1.42, 5.2, 0);
    this.addBox(core, 3.75, 1.0, 2.42, wallMaterial, 0, 7.25, 0);

    this.addBox(door, 1.95, 3.35, 0.2, shadow, 0, 4.18, -1.22);
    this.addBox(door, 1.78, 3.2, 0.24, woodMaterial, 0, 4.16, -1.34);
    for (const x of [-0.58, 0.58]) {
      this.addBox(door, 0.14, 3.05, 0.34, darkWood, x, 4.16, -1.39);
    }
    for (const y of [3.25, 4.15, 5.05]) {
      this.addBox(door, 1.8, 0.12, 0.34, darkWood, 0, y, -1.39);
    }
    core.add(door);

    this.addBox(core, 3.95, 0.28, 2.62, this.medievalMaterials.castleStone(this.stoneStyle, 'walkway', gx, gy), 0, 7.72, 0);
    this.addTowerCrenellatedEdge(core, 3.55, 0, -1.0, 7.78, 0, wallMaterial);
    this.addTowerCrenellatedEdge(core, 3.55, 0, 1.0, 7.78, Math.PI, wallMaterial);

    if (vertical) core.rotation.y = Math.PI / 2;
    group.add(core);
    this.services.gateSystem.registerGate(gx, gy, group, door, vertical);

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
    const level = cell.level ?? 1;
    const shape = cell.towerShape ?? 'round';
    const top = cell.towerTop ?? 'battlement';
    const height = (shape === 'watch' ? 6.4 : 7.4) + Math.max(0, level - 1) * 2.15;
    const bodyBase = 2.58;
    const topY = bodyBase + height;

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
    const width = shape === 'corner' ? 4.15 : shape === 'square' ? 3.85 : 0;
    const radius = shape === 'watch' ? 1.72 : shape === 'octagonal' ? 2.0 : 2.08;

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

  private findStairTowerSnap(
    gx: number,
    gy: number,
  ): { rotation: number; accessHeight: number; wall: GridPoint } | null {
    const candidates = [
      { dx: 0, dy: -1 },
      { dx: 1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: -1, dy: 0 },
    ];

    for (const candidate of candidates) {
      const wx = gx + candidate.dx;
      const wy = gy + candidate.dy;
      const wall = this.services.state.getCell(wx, wy);
      if (!wall || !WALL_KINDS.includes(wall.kind as WallKind)) continue;
      if (wall.walkway !== true) continue;

      const targetWorldTop =
        this.terrainElevation(wx, wy) +
        this.fortificationTopLocal(wall);
      const localAccessHeight =
        targetWorldTop - this.terrainElevation(gx, gy);

      if (localAccessHeight < 5.2 || localAccessHeight > 18) continue;

      return {
        rotation: this.accessRotationForNeighbor(candidate.dx, candidate.dy),
        accessHeight: localAccessHeight,
        wall: { x: wx, y: wy },
      };
    }

    return null;
  }

  private makeStairTower(
    group: THREE.Group,
    gx: number,
    gy: number,
    cell: GridCell,
  ): THREE.Group {
    const topY = Math.max(7.2, cell.accessHeight ?? 8.1);
    const bodyBase = 2.58;
    const bodyHeight = Math.max(4.6, topY - bodyBase);
    const width = 2.35;
    const ownElevation = this.terrainElevation(gx, gy);
    const neighborElevations = [
      this.terrainElevation(gx + 1, gy),
      this.terrainElevation(gx - 1, gy),
      this.terrainElevation(gx, gy + 1),
      this.terrainElevation(gx, gy - 1),
    ];
    const localLow = Math.min(ownElevation, ...neighborElevations);
    const foundationDrop = THREE.MathUtils.clamp(ownElevation - localLow, 0, 2.8);
    const foundationHeight = 0.72 + foundationDrop;

    const stone = this.medievalMaterials.castleStone(this.stoneStyle, 'body', gx, gy);
    const accent = this.medievalMaterials.castleStone(this.stoneStyle, 'alt', gx, gy);
    const foundation = this.medievalMaterials.castleStone(this.stoneStyle, 'foundation', gx, gy);
    const walkway = this.medievalMaterials.castleStone(this.stoneStyle, 'walkway', gx, gy);
    const shadow = this.medievalMaterials.arrowVoid;
    const wood = this.medievalMaterials.timberDark;

    this.addBox(
      group,
      width + 0.6,
      foundationHeight,
      width + 0.6,
      foundation,
      0,
      2.22 - foundationHeight / 2 + 0.22,
      0,
    );
    this.addBox(group, width + 0.28, 0.28, width + 0.28, accent, 0, 2.62, 0);
    this.addBox(group, width, bodyHeight, width, stone, 0, bodyBase + bodyHeight / 2, 0);

    this.addBox(group, 0.88, 1.62, 0.12, shadow, 0, 3.28, -width / 2 - 0.035);
    this.addBox(group, 0.72, 1.48, 0.16, wood, 0, 3.24, -width / 2 - 0.1);

    const slitCount = Math.max(2, Math.floor(bodyHeight / 2.2));
    for (let i = 0; i < slitCount; i += 1) {
      const y = 4.35 + i * 1.75;
      if (y > topY - 1) break;
      const side = i % 2 === 0 ? -1 : 1;
      this.addBox(
        group,
        0.1,
        0.72,
        0.16,
        shadow,
        side * (width / 2 + 0.035),
        y,
        i % 3 === 0 ? -0.38 : 0.35,
      );

      const stairStep = this.addBox(
        group,
        0.92,
        0.13,
        0.42,
        accent,
        side * 0.36,
        y - 0.38,
        0,
      );
      stairStep.rotation.y = i % 2 === 0 ? 0.18 : -0.18;
    }

    this.addBox(group, width + 0.25, 0.3, width + 0.25, walkway, 0, topY - 0.12, 0);
    const edge = width / 2 - 0.08;
    this.addTowerCrenellatedEdge(group, width - 0.18, 0, -edge, topY + 0.02, 0, stone);
    this.addTowerCrenellatedEdge(group, width - 0.18, 0, edge, topY + 0.02, Math.PI, stone);

    const cap = new THREE.Mesh(
      new THREE.ConeGeometry(width * 0.72, 1.25, 4),
      this.medievalMaterials.roofTile,
    );
    cap.rotation.y = Math.PI / 4;
    cap.position.y = topY + 1.28;
    cap.castShadow = true;
    group.add(cap);

    group.userData.castleAccess = {
      groundConnected: true,
      wallWalkConnected: true,
      topY,
    };

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
      this.setStatus('Tower Bridge: select the second compatible tower');
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
      this.recordHistory();
      this.towerBridges.delete(existing.id);
      this.towerBridgeStart = null;
      this.towerBridgeHover = null;
      this.clearGroup(this.wallPreviewLayer);
      this.finishBuild();
      this.setStatus('Tower Bridge removed · Undo available');
      return;
    }

    const validation = this.validateTowerBridge(start, point);
    if (!validation.valid) {
      this.setStatus(validation.reason ?? 'Invalid Tower Bridge');
      this.renderTowerBridgePreview(start, point);
      return;
    }

    this.recordHistory();
    const bridge: TowerBridgeState = {
      id: this.nextTowerBridgeId++,
      ax: start.x,
      ay: start.y,
      bx: point.x,
      by: point.y,
      kind: this.towerBridgeKind,
    };
    this.towerBridges.set(bridge.id, bridge);
    this.towerBridgeStart = null;
    this.towerBridgeHover = null;
    this.clearGroup(this.wallPreviewLayer);
    this.finishBuild();
    this.setStatus(
      bridge.kind === 'stone'
        ? 'Stone Tower Bridge built'
        : 'Wooden Tower Bridge built',
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

      this.addBridgeBeamBetween(group, start, end, 1.9, 0.34, walkway);
      for (const sign of [-1, 1]) {
        const offset = side.clone().multiplyScalar(sign * 0.82);
        const railStart = start.clone().add(offset).add(new THREE.Vector3(0, 0.38, 0));
        const railEnd = end.clone().add(offset).add(new THREE.Vector3(0, 0.38, 0));
        this.addBridgeBeamBetween(group, railStart, railEnd, 0.26, 0.68, stone);
      }

      const supportCount = Math.max(1, Math.floor(span / 6));
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
        this.addBridgeBeamBetween(group, p0, p1, 1.75, 0.18, wood);
      }

      for (const sign of [-1, 1]) {
        const offset = side.clone().multiplyScalar(sign * 0.78);
        const railStart = start.clone().add(offset).add(new THREE.Vector3(0, 0.62, 0));
        const railEnd = end.clone().add(offset).add(new THREE.Vector3(0, 0.62, 0));
        this.addBridgeBeamBetween(group, railStart, railEnd, 0.11, 0.11, dark);
      }

      const postCount = Math.max(3, Math.floor(span / 2.2));
      for (let i = 0; i <= postCount; i += 1) {
        const t = i / postCount;
        const center = start.clone().lerp(end, t);
        for (const sign of [-1, 1]) {
          const offset = side.clone().multiplyScalar(sign * 0.78);
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

    group.userData.towerBridge = { ...bridge };
    return group;
  }

  private removeTowerBridgesAt(x: number, y: number): void {
    for (const [id, bridge] of this.towerBridges) {
      if (
        (bridge.ax === x && bridge.ay === y) ||
        (bridge.bx === x && bridge.by === y)
      ) {
        this.towerBridges.delete(id);
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
      1.92,
      height,
      run + 0.3,
      material,
      0,
      2.58 + height / 2,
      run / 2,
    );

    const terrainDrop = Math.max(0, -elevationDelta);
    const foundationHeight = 0.82 + terrainDrop * 0.8 + Math.abs(elevationDelta) * 0.2;
    this.addBox(
      connector,
      2.35,
      foundationHeight,
      run + 0.44,
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
    if (WALL_KINDS.includes(cell.kind as WallKind)) {
      const base = cell.kind === 'wall1' ? 5.2 : cell.kind === 'wall2' ? 4.7 : 5.8;
      return 2.58 + base + Math.max(0, (cell.level ?? 1) - 1) * 2.15;
    }

    if (cell.kind === 'tower') {
      const base = (cell.towerShape ?? 'round') === 'watch' ? 6.4 : 7.4;
      return 2.58 + base + Math.max(0, (cell.level ?? 1) - 1) * 2.15;
    }

    if (cell.kind === 'stairTower') {
      return THREE.MathUtils.clamp(cell.accessHeight ?? 8.1, 7.2, 20);
    }

    if (cell.kind === 'gate') return 7.85;
    return 5.9;
  }

  private accessDirection(rotation: number): { dx: number; dy: number } {
    const normalized = ((rotation % 4) + 4) % 4;
    if (normalized === 0) return { dx: 0, dy: -1 };
    if (normalized === 1) return { dx: -1, dy: 0 };
    if (normalized === 2) return { dx: 0, dy: 1 };
    return { dx: 1, dy: 0 };
  }

  private accessRotationForNeighbor(dx: number, dy: number): number {
    if (dx === 0 && dy === -1) return 0;
    if (dx === -1 && dy === 0) return 1;
    if (dx === 0 && dy === 1) return 2;
    return 3;
  }

  private findAccessSnap(gx: number, gy: number): { rotation: number; rise: number } | null {
    const candidates = [
      { dx: 0, dy: -1 },
      { dx: 1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: -1, dy: 0 },
    ];

    for (const candidate of candidates) {
      const neighbor = this.services.state.getCell(gx + candidate.dx, gy + candidate.dy);
      if (!neighbor || !this.isWallFamily(neighbor.kind)) continue;

      const targetWorldTop =
        this.terrainElevation(gx + candidate.dx, gy + candidate.dy) +
        this.fortificationTopLocal(neighbor);
      const ownGroundWorld = this.terrainElevation(gx, gy) + 2.22;

      return {
        rotation: this.accessRotationForNeighbor(candidate.dx, candidate.dy),
        rise: THREE.MathUtils.clamp(targetWorldTop - ownGroundWorld, 1.4, 15),
      };
    }

    return null;
  }

  private accessRiseForRotation(gx: number, gy: number, rotation: number): number {
    const direction = this.accessDirection(rotation);
    const neighbor = this.services.state.getCell(gx + direction.dx, gy + direction.dy);

    if (neighbor && this.isWallFamily(neighbor.kind)) {
      const targetWorldTop =
        this.terrainElevation(gx + direction.dx, gy + direction.dy) +
        this.fortificationTopLocal(neighbor);
      const ownGroundWorld = this.terrainElevation(gx, gy) + 2.22;
      return THREE.MathUtils.clamp(targetWorldTop - ownGroundWorld, 1.4, 15);
    }

    return this.findAccessSnap(gx, gy)?.rise ?? 3.8;
  }

  private makeAccess(
    group: THREE.Group,
    kind: AccessKind,
    gx: number,
    gy: number,
    cell: GridCell,
  ): THREE.Group {
    const rise = this.accessRiseForRotation(gx, gy, cell.rotation ?? 0);
    const stone = new THREE.MeshStandardMaterial({ color: 0xb7afa4, roughness: 0.92 });
    const wood = new THREE.MeshStandardMaterial({ color: 0x815b3d, roughness: 0.94 });
    const metal = new THREE.MeshStandardMaterial({ color: 0x66737b, metalness: 0.34, roughness: 0.58 });
    const material = kind === 'woodenStairs' || kind === 'ladder' ? wood : stone;

    if (kind === 'ramp') {
      const run = 3.35;
      const ramp = this.addBox(group, 1.7, 0.3, Math.sqrt(run * run + rise * rise), stone, 0, 2.28 + rise / 2, 0);
      ramp.rotation.x = -Math.atan2(rise, run);
      return group;
    }

    if (kind === 'ladder') {
      const railHeight = Math.max(2.2, rise);
      this.addBox(group, 0.11, railHeight, 0.11, wood, -0.48, 2.22 + railHeight / 2, -1.52);
      this.addBox(group, 0.11, railHeight, 0.11, wood, 0.48, 2.22 + railHeight / 2, -1.52);

      const rungCount = Math.max(5, Math.ceil(railHeight / 0.48));
      for (let i = 0; i <= rungCount; i += 1) {
        const y = 2.3 + (i / rungCount) * (railHeight - 0.18);
        this.addBox(group, 1.02, 0.08, 0.1, metal, 0, y, -1.52);
      }
      return group;
    }

    const steps = Math.max(7, Math.ceil(rise / 0.48));
    const run = 3.25;
    const stepDepth = run / steps + 0.05;
    const stepMaterial = material;

    for (let i = 0; i < steps; i += 1) {
      const t = (i + 1) / steps;
      const z = run / 2 - t * run;
      const y = 2.24 + t * rise;
      this.addBox(group, 1.75, 0.24, stepDepth, stepMaterial, 0, y, z);
    }

    const railMaterial = kind === 'woodenStairs' ? wood : stone;
    for (const x of [-0.93, 0.93]) {
      const rail = this.addBox(group, 0.12, 0.12, Math.sqrt(run * run + rise * rise), railMaterial, x, 2.35 + rise / 2, 0);
      rail.rotation.x = -Math.atan2(rise, run);
    }

    return group;
  }

  private makeMarketBuilding(group: THREE.Group, kind: MarketBuildingKind): THREE.Group {
    const timber = this.environmentMaterial('market-timber', 0x65452f, 0.98);
    const timberLight = this.environmentMaterial('market-timber-light', 0x8a623d, 0.96);
    const woodDark = this.environmentMaterial('market-wood-dark', 0x473022, 1);
    const plaster = this.environmentMaterial('market-plaster', 0xc7ad82, 0.98);
    const stone = this.environmentMaterial('market-stone', 0x8d8272, 1);
    const roof = this.environmentMaterial('market-roof', 0x5a4032, 0.98);
    const roofLight = this.environmentMaterial('market-roof-light', 0x72503a, 0.98);
    const cloth = this.environmentMaterial('market-cloth', 0xb45f3e, 0.92);
    const crate = this.environmentMaterial('market-crate', 0x9a6b3d, 1);
    const goods = this.environmentMaterial('market-goods', 0x7c9b5a, 0.95);
    const metal = this.environmentMaterial('market-metal', 0x6f675c, 0.7);

    const addBarrel = (x: number, z: number, scale = 1): void => {
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.25 * scale, 0.28 * scale, 0.58 * scale, 10), woodDark);
      barrel.position.set(x, 2.55 + 0.29 * scale, z);
      barrel.castShadow = true;
      group.add(barrel);
      for (const y of [2.4, 2.7]) {
        const band = new THREE.Mesh(new THREE.TorusGeometry(0.255 * scale, 0.025 * scale, 6, 10), metal);
        band.position.set(x, y + 0.04 * scale, z);
        band.rotation.x = Math.PI / 2;
        band.castShadow = true;
        group.add(band);
      }
    };

    const addCrate = (x: number, z: number, width = 0.55, height = 0.48): void => {
      this.addBox(group, width, height, 0.58, crate, x, 2.42 + height / 2, z);
      this.addBox(group, width + 0.02, 0.045, 0.08, woodDark, x, 2.46 + height, z - 0.22);
      this.addBox(group, 0.055, height + 0.04, 0.055, woodDark, x - width / 2 + 0.06, 2.42 + height / 2, z);
      this.addBox(group, 0.055, height + 0.04, 0.055, woodDark, x + width / 2 - 0.06, 2.42 + height / 2, z);
    };

    const addVendorTable = (x: number, z: number, width: number, clothColor = cloth): void => {
      this.addBox(group, width, 0.12, 0.68, timber, x, 2.86, z);
      for (const legX of [-width / 2 + 0.12, width / 2 - 0.12]) {
        this.addBox(group, 0.09, 0.58, 0.09, timber, x + legX, 2.57, z - 0.22);
        this.addBox(group, 0.09, 0.58, 0.09, timber, x + legX, 2.57, z + 0.22);
      }
      this.addBox(group, width + 0.04, 0.08, 0.74, clothColor, x, 2.94, z);
      for (const offset of [-0.22, 0.04, 0.3]) {
        const goodsMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.16, 8), goods);
        goodsMesh.position.set(x + offset, 3.08, z);
        goodsMesh.castShadow = true;
        group.add(goodsMesh);
      }
    };

    if (kind === 'marketStall') {
      this.addBox(group, 3.45, 0.06, 3.45, this.environmentMaterial('market-ground', 0x9b875f, 1), 0, 2.2, 0);
      for (const x of [-1.35, 1.35]) {
        for (const z of [-1.15, 1.15]) this.addBox(group, 0.14, 2.15, 0.14, timber, x, 3.28, z);
      }
      const canopy = new THREE.Mesh(new THREE.ConeGeometry(2.0, 0.72, 4), roofLight);
      canopy.position.set(0, 5.05, 0);
      canopy.rotation.y = Math.PI / 4;
      canopy.scale.set(1.0, 1, 0.78);
      canopy.castShadow = true;
      group.add(canopy);
      this.addBox(group, 2.85, 0.16, 0.78, timberLight, 0, 3.02, -0.78);
      addVendorTable(0, -0.82, 2.65);
      addCrate(-1.12, 0.72, 0.58, 0.55);
      addCrate(1.12, 0.72, 0.5, 0.44);
      addBarrel(-1.18, -0.05, 0.9);
      addBarrel(1.18, -0.05, 0.9);
      this.addBox(group, 0.72, 0.42, 0.08, cloth, 0, 4.02, -0.79);
      return group;
    }

    if (kind === 'smallMarket') {
      this.addBox(group, 3.62, 0.08, 3.62, stone, 0, 2.22, 0);
      this.addBox(group, 3.22, 1.75, 2.78, plaster, 0, 3.18, 0.08);
      for (const x of [-1.62, 1.62]) {
        this.addBox(group, 0.16, 2.15, 0.16, timber, x, 3.38, 0.08);
        this.addBox(group, 0.16, 2.15, 0.16, timber, x, 3.38, -1.25);
      }
      for (const x of [-0.82, 0, 0.82]) this.addBox(group, 0.12, 2.05, 0.12, timberLight, x, 3.34, -1.3);
      for (const x of [-1.45, 0, 1.45]) this.addBox(group, 0.12, 2.05, 0.12, timberLight, x, 3.34, 1.38);
      const roofMesh = new THREE.Mesh(new THREE.ConeGeometry(2.45, 1.25, 4), roof);
      roofMesh.position.set(0, 5.18, 0);
      roofMesh.rotation.y = Math.PI / 4;
      roofMesh.scale.set(1.0, 1, 0.78);
      roofMesh.castShadow = true;
      group.add(roofMesh);
      this.addBox(group, 3.55, 0.18, 0.22, timber, 0, 4.08, -1.47);
      this.addBox(group, 3.25, 0.1, 0.72, cloth, 0, 3.95, -1.54);
      addVendorTable(-0.85, -0.72, 1.25);
      addVendorTable(0.85, -0.72, 1.25, this.environmentMaterial('market-cloth-alt', 0x587d75, 0.92));
      addCrate(-1.22, 0.88, 0.62, 0.52);
      addCrate(1.2, 0.88, 0.55, 0.64);
      addBarrel(-1.35, -0.1);
      addBarrel(1.35, -0.1);
      this.addBox(group, 0.72, 0.55, 0.08, timber, 0, 3.75, -1.59);
      this.addBox(group, 0.56, 0.08, 0.46, goods, 0, 3.88, -1.62);
      return group;
    }

    this.addBox(group, 3.72, 0.14, 3.72, stone, 0, 2.3, 0);
    this.addBox(group, 3.28, 2.0, 3.08, plaster, 0, 3.32, 0.08);
    for (const x of [-1.63, -0.82, 0.82, 1.63]) {
      this.addBox(group, 0.16, 2.45, 0.16, timber, x, 3.54, -1.47);
      this.addBox(group, 0.16, 2.45, 0.16, timber, x, 3.54, 1.5);
    }
    for (const z of [-1.48, 1.5]) this.addBox(group, 3.3, 0.16, 0.16, timber, 0, 4.72, z);
    const hallRoof = new THREE.Mesh(new THREE.ConeGeometry(2.62, 1.42, 4), roof);
    hallRoof.position.set(0, 5.45, 0);
    hallRoof.rotation.y = Math.PI / 4;
    hallRoof.scale.set(1.0, 1, 0.82);
    hallRoof.castShadow = true;
    group.add(hallRoof);
    this.addBox(group, 3.15, 0.16, 0.24, timber, 0, 4.02, -1.62);
    this.addBox(group, 2.95, 0.1, 0.78, cloth, 0, 3.88, -1.68);
    addVendorTable(-0.95, -0.75, 1.28);
    addVendorTable(0.95, -0.75, 1.28, this.environmentMaterial('market-cloth-alt2', 0x6b6f92, 0.92));
    addVendorTable(0, 0.62, 1.9, this.environmentMaterial('market-cloth-gold', 0x9a7541, 0.92));
    addCrate(-1.25, 1.1, 0.65, 0.58);
    addCrate(1.24, 1.08, 0.6, 0.72);
    addBarrel(-1.38, -0.02, 1.05);
    addBarrel(1.38, -0.02, 1.05);
    addCrate(0, 1.35, 0.5, 0.42);
    this.addBox(group, 0.9, 0.6, 0.1, timber, 0, 3.62, -1.76);
    this.addBox(group, 0.7, 0.08, 0.52, goods, 0, 3.76, -1.81);
    for (const x of [-1.35, 1.35]) {
      const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), metal);
      lantern.position.set(x, 4.25, -1.7);
      lantern.castShadow = true;
      group.add(lantern);
    }
    return group;
  }

  private makeHouse(
    group: THREE.Group,
    kind: 'cottage' | 'house' | 'manor' | 'villa',
  ): THREE.Group {
    const pathMaterial = this.environmentMaterial('village-path', 0xa98d70, 1);
    const pathDark = this.environmentMaterial('village-path-dark', 0x826b55, 1);
    const fenceMaterial = this.environmentMaterial('village-fence', 0x6f4e37, 1);
    const grassPatch = this.environmentMaterial('village-grass', 0x93b75c, 0.96);
    const yardMaterial = this.environmentMaterial('village-yard', 0xa7b967, 0.98);

    // Each residential cell is a compact lived-in medieval block rather than
    // one oversized house. Narrow alleys keep silhouettes readable from the
    // isometric camera while supporting more visible residents.
    this.addBox(group, 3.72, 0.055, 3.72, grassPatch, 0, 2.2, 0);
    this.addBox(group, 3.5, 0.065, 0.34, pathMaterial, 0, 2.26, 0.04);
    this.addBox(group, 0.34, 0.065, 3.42, pathMaterial, -0.08, 2.265, 0);
    this.addBox(group, 1.4, 0.04, 1.12, yardMaterial, 0.82, 2.245, 0.82);

    if (kind === 'cottage') {
      this.addMiniHouse(group, -1.18, -1.03, -0.05, 0.84, 0.72, 1.28, 0xd7a17c, 0x8b5a43, false);
      this.addMiniHouse(group, -0.15, -1.08, 0.04, 0.78, 0.7, 1.18, 0xd9b08a, 0x83533d, false);
      this.addMiniHouse(group, 1.03, -0.96, 0.11, 0.86, 0.72, 1.3, 0xc99474, 0x78513d, true);
      this.addMiniHouse(group, -1.12, 1.02, Math.PI + 0.04, 0.8, 0.7, 1.18, 0xd5aa83, 0x845740, false);
      this.addMiniHouse(group, 0.05, 1.08, Math.PI - 0.03, 0.78, 0.68, 1.12, 0xcfa17d, 0x76503c, false);
      this.addVillageWell(group, 1.02, 0.92);
    } else if (kind === 'house') {
      const houses: Array<[number, number, number, number, number, number, number, number, boolean]> = [
        [-1.2, -1.02, -0.04, 0.88, 0.74, 1.48, 0xc6aadf, 0x735d98, true],
        [-0.12, -1.1, 0.05, 0.82, 0.72, 1.38, 0xb99bd6, 0x6a568f, true],
        [1.08, -0.96, 0.1, 0.9, 0.76, 1.52, 0xd0b7e4, 0x8067a4, true],
        [-1.16, 1.02, Math.PI + 0.04, 0.84, 0.72, 1.34, 0xbca1d4, 0x684f8b, false],
        [-0.06, 1.08, Math.PI, 0.8, 0.7, 1.3, 0xc9afe0, 0x72558f, true],
        [1.08, 1.0, Math.PI - 0.05, 0.84, 0.72, 1.4, 0xb99ed1, 0x614b82, false],
      ];
      for (const house of houses) this.addMiniHouse(group, ...house);
    } else if (kind === 'manor') {
      this.addMiniHouse(group, 0, -0.8, 0, 1.34, 1.0, 2.05, 0xd77b8f, 0x8b4f5f, true);
      this.addMiniHouse(group, -1.24, -0.95, -0.06, 0.72, 0.68, 1.22, 0xd9a0ab, 0x80515a, true);
      this.addMiniHouse(group, 1.24, -0.95, 0.06, 0.72, 0.68, 1.26, 0xce8f9e, 0x754852, true);
      this.addMiniHouse(group, -1.16, 1.05, Math.PI, 0.82, 0.72, 1.28, 0xc98697, 0x754b56, false);
      this.addMiniHouse(group, 1.14, 1.04, Math.PI, 0.82, 0.72, 1.3, 0xe0a5b0, 0x85525e, false);
      this.addVillageWell(group, 0, 0.8);

      for (const x of [-1.68, 1.68]) {
        this.addBox(group, 0.08, 0.64, 3.08, fenceMaterial, x, 2.52, 0);
      }
    } else {
      this.addMiniHouse(group, -1.18, -0.95, -0.08, 0.92, 0.78, 1.55, 0x79c1ba, 0x467e78, true);
      this.addMiniHouse(group, -0.02, -1.05, 0.02, 0.86, 0.74, 1.42, 0x6fb0ab, 0x3d716d, true);
      this.addMiniHouse(group, 1.12, -0.9, 0.1, 0.92, 0.78, 1.5, 0x86c9c2, 0x4f8983, true);
      this.addMiniHouse(group, -1.08, 1.0, Math.PI + 0.04, 0.84, 0.72, 1.38, 0x78bbb4, 0x456f6b, true);
      this.addMiniHouse(group, 0.08, 1.08, Math.PI, 0.84, 0.72, 1.44, 0x91d1ca, 0x507f79, false);

      const garden = new THREE.Mesh(new THREE.CircleGeometry(0.46, 16), yardMaterial);
      garden.rotation.x = -Math.PI / 2;
      garden.position.set(1.05, 2.27, 0.98);
      group.add(garden);
      this.addVillageWell(group, 1.04, 0.92);
    }

    // Edge fences, benches, barrels and market-like clutter give the block a
    // believable inhabited scale without overwhelming the single cell.
    for (const z of [-1.76, 1.76]) {
      this.addBox(group, 3.55, 0.07, 0.07, fenceMaterial, 0, 2.5, z);
      for (const x of [-1.62, -0.54, 0.54, 1.62]) {
        this.addBox(group, 0.075, 0.58, 0.075, fenceMaterial, x, 2.48, z);
      }
    }

    this.addBox(group, 0.52, 0.16, 0.22, pathDark, 1.18, 2.37, -0.08);
    this.addBox(group, 0.08, 0.42, 0.08, fenceMaterial, 1.38, 2.55, -0.08);
    this.addBox(group, 0.08, 0.42, 0.08, fenceMaterial, 0.98, 2.55, -0.08);

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
  ): void {
    const house = new THREE.Group();
    house.position.set(x, 0, z);
    house.rotation.y = rotation;
    parent.add(house);

    const wall = new THREE.MeshStandardMaterial({
      color: wallColor,
      roughness: 0.84,
    });
    const wallShade = new THREE.MeshStandardMaterial({
      color: new THREE.Color(wallColor).multiplyScalar(0.82),
      roughness: 0.9,
    });
    const roof = new THREE.MeshStandardMaterial({
      color: roofColor,
      roughness: 0.9,
    });
    const roofDark = new THREE.MeshStandardMaterial({
      color: new THREE.Color(roofColor).multiplyScalar(0.7),
      roughness: 0.96,
    });
    const wood = this.environmentMaterial('house-timber', 0x684733, 0.98);
    const stone = this.environmentMaterial('house-stone', 0xa79d91, 1);
    const glass = this.environmentMaterial('house-window', 0x6ba5ae, 0.45);

    this.addBox(house, width + 0.14, 0.18, depth + 0.14, stone, 0, 2.3, 0);
    this.addBox(house, width, height, depth, wall, 0, 2.32 + height / 2, 0);

    // Slightly projecting upper timber floor on richer houses.
    if (detailed) {
      this.addBox(
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
        this.addBox(house, 0.055, height * 0.72, 0.055, wood, sx, 2.38 + height * 0.5, -depth / 2 - 0.035);
      }
      this.addBox(house, width * 0.82, 0.055, 0.055, wood, 0, 2.58 + height * 0.58, -depth / 2 - 0.04);
    }

    const roofHeight = 0.68 + height * 0.2;
    const eave = this.addBox(
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

    this.addBox(
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
      this.addBox(house, width * 0.16, 0.28, 0.055, glass, sx, windowY, -depth / 2 - 0.045);
      this.addBox(house, width * 0.19, 0.045, 0.075, wood, sx, windowY - 0.17, -depth / 2 - 0.065);
    }

    // Side window and small sill improve readability at isometric angles.
    this.addBox(
      house,
      0.055,
      0.26,
      depth * 0.18,
      glass,
      width / 2 + 0.035,
      windowY,
      0.1,
    );
    this.addBox(
      house,
      0.075,
      0.045,
      depth * 0.22,
      wood,
      width / 2 + 0.055,
      windowY - 0.16,
      0.1,
    );

    const chimney = this.addBox(
      house,
      0.14,
      0.58,
      0.14,
      stone,
      width * 0.28,
      2.32 + height + 0.38,
      depth * 0.12,
    );
    chimney.castShadow = true;

    if (detailed) {
      const awning = this.addBox(
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
    const stone = new THREE.MeshStandardMaterial({ color: 0xaaa39a, roughness: 1 });
    const wood = new THREE.MeshStandardMaterial({ color: 0x71503a, roughness: 1 });

    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.38, 12), stone);
    ring.position.set(x, 2.42, z);
    ring.castShadow = true;
    group.add(ring);

    this.addBox(group, 0.08, 0.82, 0.08, wood, x - 0.38, 2.76, z);
    this.addBox(group, 0.08, 0.82, 0.08, wood, x + 0.38, 2.76, z);
    this.addBox(group, 0.9, 0.08, 0.08, wood, x, 3.14, z);
  }

  private makeFarm(group: THREE.Group): THREE.Group {
    const soil = this.environmentMaterial('farm-soil', 0x77563d, 1);
    const wetSoil = this.environmentMaterial('farm-wet-soil', 0x59483a, 1);
    const cropGreen = this.environmentMaterial('farm-crop-green', 0x6f9c4f, 0.96);
    const cropGold = this.environmentMaterial('farm-crop-gold', 0xc8b95d, 0.94);
    const cropYoung = this.environmentMaterial('farm-crop-young', 0x8db95d, 0.94);
    const wood = this.environmentMaterial('farm-wood', 0x77543a, 1);
    const woodDark = this.environmentMaterial('farm-wood-dark', 0x4f392b, 1);
    const hay = this.environmentMaterial('farm-hay', 0xc69d4d, 1);
    const water = this.environmentMaterial('farm-water', 0x4e95a3, 0.38);

    this.addBox(group, 3.7, 0.14, 3.7, soil, 0, 2.23, 0);

    // Alternating crop beds with visible furrows and slight height variation.
    const rows = [-1.28, -0.72, -0.16, 0.4, 0.96, 1.45];
    rows.forEach((x, index) => {
      const crop =
        index % 3 === 0 ? cropGold : index % 3 === 1 ? cropGreen : cropYoung;
      this.addBox(group, 0.22, 0.22 + (index % 2) * 0.05, 2.62, crop, x, 2.44, -0.18);
      this.addBox(group, 0.08, 0.04, 2.78, wetSoil, x + 0.22, 2.34, -0.18);
    });

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
      this.environmentMaterial('farm-roof', 0x6c4b35, 1),
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

    // Perimeter fence with a deliberate gate opening toward the road.
    for (const x of [-1.78, 1.78]) {
      this.addBox(group, 0.09, 0.62, 3.46, wood, x, 2.52, 0);
    }
    this.addBox(group, 2.54, 0.08, 0.08, wood, -0.58, 2.51, -1.78);
    this.addBox(group, 0.72, 0.08, 0.08, wood, 1.42, 2.51, -1.78);

    return group;
  }

  private makeArmyCamp(group: THREE.Group): THREE.Group {
    const canvas = this.environmentMaterial('army-canvas', 0x9b7653, 0.96);
    const canvasDark = this.environmentMaterial('army-canvas-dark', 0x6f5039, 1);
    const wood = this.environmentMaterial('army-camp-wood', 0x62452f, 1);
    const rope = this.environmentMaterial('army-camp-rope', 0xb49b6b, 1);
    const crate = this.environmentMaterial('army-camp-crate', 0x7e5939, 1);
    const iron = this.environmentMaterial('army-camp-iron', 0x555d61, 0.72);
    const fire = this.environmentMaterial('army-camp-fire', 0xd97832, 0.72);
    const ground = this.environmentMaterial('army-camp-ground', 0x7b6a50, 1);

    this.addBox(group, 3.72, 0.06, 3.72, ground, 0, 2.22, 0);

    // Large command tent.
    this.addBox(group, 2.72, 1.42, 2.45, canvas, 0, 3.0, -0.18);
    const tentRoof = new THREE.Mesh(
      new THREE.ConeGeometry(2.02, 1.65, 4),
      canvasDark,
    );
    tentRoof.rotation.y = Math.PI / 4;
    tentRoof.scale.z = 0.78;
    tentRoof.position.set(0, 4.5, -0.18);
    tentRoof.castShadow = true;
    tentRoof.receiveShadow = true;
    group.add(tentRoof);

    this.addBox(group, 0.08, 2.9, 0.08, wood, 0, 3.78, -0.18);
    this.addBox(group, 0.9, 1.04, 0.08, canvasDark, 0, 2.86, -1.43);

    // Guy ropes and pegs.
    for (const sign of [-1, 1]) {
      const ropeMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.018, 0.018, 1.85, 5),
        rope,
      );
      ropeMesh.position.set(sign * 1.66, 2.88, 0.1);
      ropeMesh.rotation.z = sign * 0.72;
      group.add(ropeMesh);
      this.addBox(group, 0.08, 0.42, 0.08, wood, sign * 1.86, 2.39, 0.1);
    }

    // Supply corner.
    this.addBox(group, 0.62, 0.55, 0.62, crate, -1.35, 2.52, 1.28);
    this.addBox(group, 0.52, 0.45, 0.52, crate, -0.78, 2.47, 1.48);
    this.addBox(group, 0.68, 0.08, 0.22, iron, 1.22, 2.45, 1.34);
    this.addBox(group, 0.08, 0.82, 0.08, iron, 1.22, 2.82, 1.34);

    // Campfire with three stones.
    for (let i = 0; i < 3; i += 1) {
      const angle = (i / 3) * Math.PI * 2;
      const stone = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.16, 0),
        this.environmentMaterial('army-camp-stone', 0x69625b, 1),
      );
      stone.position.set(
        0.95 + Math.cos(angle) * 0.28,
        2.38,
        0.7 + Math.sin(angle) * 0.28,
      );
      group.add(stone);
    }
    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.18, 0.52, 7),
      fire,
    );
    flame.position.set(0.95, 2.67, 0.7);
    group.add(flame);

    // Command banner.
    this.addBox(group, 0.07, 2.4, 0.07, wood, 1.58, 3.33, -0.88);
    const banner = this.addBox(group, 0.92, 0.48, 0.04, canvasDark, 2.0, 4.16, -0.88);
    banner.userData.castleFlag = { phase: 1.7 };

    group.userData.armyCamp = true;
    return group;
  }

  private makeTree(group: THREE.Group, level: number): THREE.Group {
    const variant = Math.max(1, level);
    const trunk = new THREE.MeshStandardMaterial({ color: 0x75533c, roughness: 1 });
    const foliage = new THREE.MeshStandardMaterial({
      color: [0x729d51, 0x81ad5e, 0x668e49][(variant - 1) % 3],
      roughness: 0.9,
    });

    const trunkMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 1.6, 7), trunk);
    trunkMesh.position.y = 3.0;
    trunkMesh.castShadow = true;
    group.add(trunkMesh);

    for (const [radius, y] of [[1.05, 4.25], [0.78, 5.3], [0.5, 6.05]] as Array<[number, number]>) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(radius, radius * 1.95, 8), foliage);
      cone.position.y = y;
      cone.castShadow = true;
      group.add(cone);
    }

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
      cells: this.services.state.entries().map((cell) => ({
        ...cell,
        wallLinks: cell.wallLinks ? [...cell.wallLinks] : undefined,
      })),
      keeps: this.services.keepSystem.entries(),
      terrain: Array.from(this.terrainOverrides.entries()),
      elevations: Array.from(this.elevationOverrides.entries()),
      stoneStyle: this.stoneStyle,
      towerBridges: Array.from(this.towerBridges.values()).map((bridge) => ({ ...bridge })),
    };
  }

  private pushUndoSnapshot(snapshot: HistorySnapshot): void {
    this.undoStack.push(snapshot);
    if (this.undoStack.length > 60) this.undoStack.shift();
    this.redoStack.length = 0;
  }

  private recordHistory(): void {
    this.pushUndoSnapshot(this.captureSnapshot());
  }

  private restoreSnapshot(snapshot: HistorySnapshot): void {
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

    this.selectedCell = null;
    this.selectedKeepId = null;
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
      this.setStatus('Nothing to undo');
      return;
    }

    this.redoStack.push(this.captureSnapshot());
    this.restoreSnapshot(snapshot);
    this.setStatus('Undo');
  }

  private redo(): void {
    const snapshot = this.redoStack.pop();
    if (!snapshot) {
      this.setStatus('Nothing to redo');
      return;
    }

    this.undoStack.push(this.captureSnapshot());
    this.restoreSnapshot(snapshot);
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
      const terrain = this.terrainAt(point.x, point.y);
      if (terrain === 'water' || terrain === 'river') continue;

      const current = oldValues.get(this.key(point.x, point.y)) ?? this.terrainElevation(point.x, point.y);
      let next = current;
      const scaled = this.brushStrength * point.weight;

      if (tool === 'raise') next = current + 0.32 * scaled;
      else if (tool === 'lower') next = current - 0.32 * scaled;
      else if (tool === 'dig') next = current - 0.58 * scaled;
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

  private moveSelected(dx: number, dy: number): void {
    if (this.selectedKeepId !== null) {
      const keep = this.services.keepSystem.get(this.selectedKeepId);
      if (!keep) return;

      const draft = {
        x: keep.x + dx,
        y: keep.y + dy,
        width: keep.width,
        depth: keep.depth,
        floors: keep.floors,
        rotation: keep.rotation,
        cornerTowers: keep.cornerTowers,
        roof: keep.roof,
        battlements: keep.battlements,
      };
      const validation = this.validateKeepDraft(draft, keep.id);
      if (!validation.valid) {
        this.setStatus(validation.reason ?? 'Cannot move Keep there');
        return;
      }

      this.recordHistory();
      const updated = this.services.keepSystem.update(keep.id, { x: draft.x, y: draft.y });
      if (updated) {
        this.selectKeep(updated);
        this.redraw();
        this.scheduleSave();
        this.setStatus('Moved Keep');
      }
      return;
    }

    if (!this.selectedCell) {
      this.setStatus('Click a structure first');
      return;
    }

    const source = this.services.state.getCell(this.selectedCell.x, this.selectedCell.y);
    if (!source) {
      this.setStatus('Selected tile has no structure');
      return;
    }

    const nx = this.selectedCell.x + dx;
    const ny = this.selectedCell.y + dy;
    if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE || this.services.state.getCell(nx, ny)) {
      this.setStatus('Cannot move there');
      return;
    }

    const destinationTerrain = this.terrainAt(nx, ny);
    if (destinationTerrain === 'water' || destinationTerrain === 'river') {
      this.setStatus('Cannot move onto water');
      return;
    }

    this.recordHistory();

    const sourceX = this.selectedCell.x;
    const sourceY = this.selectedCell.y;
    if (source.kind === 'tower') this.removeTowerBridgesAt(sourceX, sourceY);

    const { kind, level, ...options } = source;
    this.services.state.removeCell(sourceX, sourceY);
    this.services.state.setCell(nx, ny, kind, level ?? 1, options);
    this.selectedCell = { x: nx, y: ny };

    this.redraw();
    this.scheduleSave();
    this.setStatus('Moved selected structure');
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
    });
    this.redraw();
    this.scheduleSave();
    this.setStatus('Rotated selected structure');
  }

  private bindPointerInput(): void {
    const canvas = this.renderer.domElement;

    canvas.addEventListener(
      'pointerdown',
      (event) => {
        if (event.button !== 0) return;
        if (this.battleSystem.isActive()) return;

        const cell = this.pickGridCell(event);
        if (cell && this.selectedTool !== null && this.selectedTool !== 'towerBridge') this.beginLongPress(event, cell);

        if (this.selectedTool !== null && this.isWallTool(this.selectedTool)) {
          if (!cell) return;
          this.wallDragStart = cell;
          this.wallDragEnd = cell;
          this.controls.enabled = false;
          canvas.setPointerCapture(event.pointerId);
          this.renderWallPreview([cell]);
          this.setStatus('Wall drag: choose end point · snaps to 45°');
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
        this.cancelLongPressOnMovement(event);

        if (this.wallDragStart) {
          const cell = this.pickGridCell(event);
          if (cell) {
            this.wallDragEnd = cell;
            const path = this.wallPath(this.wallDragStart, cell);
            this.renderWallPreview(path);
            this.setStatus(`Wall drag: ${path.length} segments · preview is final path`);
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

        if (movement <= 6) this.handleBuildClick(event);
      },
      true,
    );

    canvas.addEventListener(
      'pointercancel',
      () => {
        this.cancelLongPress();
        this.longPressTriggered = false;
        this.wallDragStart = null;
        this.wallDragEnd = null;
        this.roadDragStart = null;
        this.roadDragEnd = null;
        this.mountainRangeStart = null;
        this.mountainRangeEnd = null;
        this.terrainStrokeActive = false;
        this.terrainStrokeSnapshot = null;
        this.pointerStart = null;
        this.clearGroup(this.wallPreviewLayer);
        this.controls.enabled = true;
      },
      true,
    );
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
      this.setStatus('Long-press removal · Keep removed · Undo available');
    } else if (cell) {
      if (cell.kind === 'tower') this.removeTowerBridgesAt(point.x, point.y);
      this.services.state.removeCell(point.x, point.y);
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
    const color =
      roadKind === 'dirtRoad' ? 0xb17d4f :
      roadKind === 'stoneRoad' ? 0xb8b0a2 :
      0xc39a70;
    const material = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.14,
      transparent: true,
      opacity: 0.52,
      depthWrite: false,
    });

    for (const point of path) {
      const position = this.gridToWorld(point.x, point.y);
      const preview = new THREE.Mesh(
        new THREE.BoxGeometry(2.25, 0.12, 2.25),
        material,
      );
      preview.position.set(
        position.x,
        2.34 + this.terrainElevation(point.x, point.y),
        position.z,
      );
      preview.castShadow = false;
      this.wallPreviewLayer.add(preview);
    }
  }

  private buildRoadDrag(start: GridPoint, end: GridPoint): void {
    const roadKind = this.selectedTool as RoadKind;
    const path = this.roadPath(start, end);
    const before = this.captureSnapshot();
    let changed = 0;

    for (const point of path) {
      const terrain = this.terrainAt(point.x, point.y);
      const current = this.services.state.getCell(point.x, point.y);

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

  private renderWallPreview(path: GridPoint[]): void {
    this.clearGroup(this.wallPreviewLayer);
    if (path.length === 0) return;

    const material = new THREE.MeshStandardMaterial({
      color: 0x72e4ff,
      emissive: 0x164c5c,
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 0.48,
      depthWrite: false,
    });

    for (let i = 0; i < path.length; i += 1) {
      const point = path[i];
      const position = this.gridToWorld(point.x, point.y);
      const marker = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.22, 0.18, 10),
        material,
      );
      marker.position.set(
        position.x,
        2.38 + this.terrainElevation(point.x, point.y),
        position.z,
      );
      marker.castShadow = false;
      this.wallPreviewLayer.add(marker);

      if (i === 0) continue;

      const previous = path[i - 1];
      const previousWorld = this.gridToWorld(previous.x, previous.y);
      const currentWorld = position;
      const dx = currentWorld.x - previousWorld.x;
      const dz = currentWorld.z - previousWorld.z;
      const length = Math.hypot(dx, dz);
      const y1 = 2.38 + this.terrainElevation(previous.x, previous.y);
      const y2 = 2.38 + this.terrainElevation(point.x, point.y);
      const rise = y2 - y1;
      const beamLength = Math.sqrt(length * length + rise * rise);

      const beam = new THREE.Mesh(
        new THREE.BoxGeometry(0.42, 0.25, beamLength),
        material,
      );
      beam.position.set(
        (previousWorld.x + currentWorld.x) / 2,
        (y1 + y2) / 2,
        (previousWorld.z + currentWorld.z) / 2,
      );
      beam.rotation.y = Math.atan2(dx, dz);
      beam.rotation.x = -Math.atan2(rise, length);
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
    const before = this.captureSnapshot();
    let changed = false;

    for (const point of path) {
      const terrain = this.terrainAt(point.x, point.y);
      const cell = this.services.state.getCell(point.x, point.y);

      if (single && cell?.kind === wallKind) {
        const nextLevel = decrease
          ? Math.max(1, (cell.level ?? 1) - 1)
          : (cell.level ?? 1) + 1;

        this.services.state.updateCell(point.x, point.y, {
          level: nextLevel,
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
      this.redraw();
      this.scheduleSave();
      this.setStatus(
        single
          ? 'Wall segment updated'
          : `Built ${path.length} snapped wall segments · 45° angles supported`,
      );
    }
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

    const cell = this.services.state.getCell(gx, gy);
    const current = cell?.kind;
    const terrain = this.terrainAt(gx, gy);
    const overrideKey = this.key(gx, gy);
    const keepAtPoint = this.services.keepSystem.findAtCell(gx, gy);

    if (this.selectedTool === null) {
      if (keepAtPoint) {
        this.selectKeep(keepAtPoint);
      } else {
        this.selectedKeepId = null;
        this.setStatus(current ? `Selected: ${current}` : 'No Build Tool Selected');
      }
      return;
    }

    if (this.selectedTool === 'erase') {
      if (keepAtPoint) {
        this.recordHistory();
        this.services.keepSystem.remove(keepAtPoint.id);
        if (this.selectedKeepId === keepAtPoint.id) this.selectedKeepId = null;
        this.finishBuild();
        this.setStatus('Keep removed');
        return;
      }
      if (current) {
        this.recordHistory();
        if (current === 'tower') this.removeTowerBridgesAt(gx, gy);
        this.services.state.removeCell(gx, gy);
        this.finishBuild();
        return;
      }

      if (this.terrainOverrides.has(overrideKey)) {
        this.recordHistory();
        this.terrainOverrides.delete(overrideKey);
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

    if (this.selectedTool === 'river' || this.selectedTool === 'land') {
      if (this.moatTasks.has(overrideKey)) return;

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
        this.setStatus(
          this.selectedTool === 'harbor' || this.selectedTool === 'woodenPier'
            ? 'This structure needs a valid coast with deeper open water'
            : 'Dock placement requires a valid coastline next to ocean water',
        );
        return;
      }

      this.recordHistory();
      this.services.state.setCell(gx, gy, this.selectedTool, 1, {
        rotation: direction.rotation,
        shipKind: this.maritimeSystem.defaultShip(this.selectedTool) ?? undefined,
      });
      this.finishBuild();
      this.setStatus('Maritime structure placed · orientation matched to coastline');
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
        this.recordHistory();
        this.services.state.setCell(gx, gy, 'mine', 1);
        this.finishBuild();
        return;
      }

      if (!current && terrain === 'mountain') {
        this.recordHistory();
        this.services.state.setCell(gx, gy, 'mine', 1);
        this.finishBuild();
      }
      return;
    }

    if (this.selectedTool === 'appleOrchard') {
      if (current === 'appleOrchard') {
        const nextSize = event.shiftKey
          ? Math.max(1, (cell?.level ?? 1) - 1)
          : Math.min(3, (cell?.level ?? 1) + 1);
        if (nextSize === (cell?.level ?? 1)) {
          this.setStatus(event.shiftKey ? 'Apple Orchard is already at minimum size' : 'Apple Orchard is already at maximum size');
          return;
        }
        this.recordHistory();
        this.services.state.setCell(gx, gy, 'appleOrchard', nextSize);
        this.finishBuild();
        this.setStatus(`Apple Orchard size: ${nextSize}`);
        return;
      }
      if (!current && terrain === 'plains') {
        this.recordHistory();
        const size = 1 + ((gx * 7 + gy * 11) % 3);
        this.services.state.setCell(gx, gy, 'appleOrchard', size);
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

    if (this.selectedTool === 'stairTower') {
      if (current) {
        this.setStatus('Stair Tower needs an empty tile beside a Wall Walk');
        return;
      }
      if (!this.canBuildFortificationOnTerrain(terrain)) {
        this.setStatus('Stair Tower needs stable ground');
        return;
      }

      const snap = this.findStairTowerSnap(gx, gy);
      if (!snap) {
        this.setStatus('Place Stair Tower directly beside a wall with Top Walkway enabled');
        return;
      }

      this.recordHistory();
      this.services.state.setCell(gx, gy, 'stairTower', 1, {
        rotation: snap.rotation,
        accessHeight: snap.accessHeight,
      });
      this.finishBuild();
      this.setStatus('Stair Tower connected Ground ↕ Wall Walk');
      return;
    }

    if (this.selectedTool === 'tower') {
      if (current === 'tower') {
        const nextLevel = event.shiftKey
          ? Math.max(1, (cell?.level ?? 1) - 1)
          : (cell?.level ?? 1) + 1;

        this.recordHistory();
        const compatibleTop = this.compatibleTowerTop(this.towerShape, this.towerTop);
        this.towerTop = compatibleTop;
        this.services.state.updateCell(gx, gy, {
          level: nextLevel,
          towerShape: this.towerShape,
          towerTop: compatibleTop,
        });
        this.finishBuild();
        return;
      }

      if (current && !this.isWallFamily(current)) return;
      if (!current && !this.canBuildFortificationOnTerrain(terrain)) return;

      this.recordHistory();
      const compatibleTop = this.compatibleTowerTop(this.towerShape, this.towerTop);
      this.towerTop = compatibleTop;
      this.services.state.setCell(gx, gy, 'tower', cell?.level ?? 1, {
        towerShape: this.towerShape,
        towerTop: compatibleTop,
      });
      this.finishBuild();
      return;
    }

    const selectedTile = this.selectedTool as TileKind;
    if (!this.isBuildingAvailable(selectedTile)) {
      this.setStatus('This building is unavailable in ' + getGameModeDefinition(this.gameMode).label);
      return;
    }
    const selectedFortification = selectedTile === 'gate';
    const currentFortification = current ? this.isWallFamily(current) : false;

    if (current) {
      if (selectedFortification && currentFortification) {
        this.recordHistory();
        this.services.state.setCell(gx, gy, selectedTile, cell?.level ?? 1);
        this.finishBuild();
      }
      return;
    }

    if (!this.canBuildOnTerrain(this.selectedTool, terrain)) return;
    this.recordHistory();
    this.services.state.setCell(gx, gy, selectedTile, 1);
    this.finishBuild();
  }

  private canBuildOnTerrain(tool: ToolKind, terrain: TerrainKind): boolean {
    if (tool === 'gate' || tool === 'tower') return this.canBuildFortificationOnTerrain(terrain);
    if (terrain === 'water' || terrain === 'river') return false;
    if (terrain === 'mountain') return tool === 'mine';
    if (terrain === 'forest') return tool === 'tree';
    if (tool === 'farm' || tool === 'appleOrchard') return terrain === 'plains';
    if (tool === 'windmill') return terrain === 'plains' || terrain === 'shore';
    return terrain === 'plains' || terrain === 'shore';
  }

  private finishBuild(): void {
    audioEvents.emit({ action: 'play_sfx', assetId: 'building.place' });
    this.redraw();
    this.scheduleSave();
  }

  private refreshSettlementAgents(
    cells: ReturnType<GameState['entries']>,
  ): void {
    this.clearGroup(this.settlementLayer);
    this.settlementAgents.length = 0;
    this.nextSettlementAgentId = 1;

    const homes = cells.filter((cell) =>
      cell.kind === 'cottage' ||
      cell.kind === 'house' ||
      cell.kind === 'manor' ||
      cell.kind === 'villa',
    );
    const farms = cells.filter((cell) => cell.kind === 'farm' || cell.kind === 'appleOrchard');

    const maxVisibleAgents = 40;

    for (const home of homes) {
      if (this.settlementAgents.length >= maxVisibleAgents) break;
      const desired =
        home.kind === 'manor'
          ? 4
          : home.kind === 'house'
            ? 3
            : home.kind === 'villa'
              ? 3
              : 2;

      for (let i = 0; i < desired; i += 1) {
        if (this.settlementAgents.length >= maxVisibleAgents) break;
        this.spawnSettlementAgent(
          'citizen',
          { x: home.x, y: home.y },
          undefined,
          home.x * 97 + home.y * 53 + i * 17,
        );
      }
    }

    for (const farm of farms) {
      if (this.settlementAgents.length >= maxVisibleAgents) break;

      let homePoint: GridPoint = { x: farm.x, y: farm.y };
      let best = Number.POSITIVE_INFINITY;
      for (const home of homes) {
        const distance = Math.hypot(home.x - farm.x, home.y - farm.y);
        if (distance < best) {
          best = distance;
          homePoint = { x: home.x, y: home.y };
        }
      }

      this.spawnSettlementAgent(
        'farmer',
        homePoint,
        { x: farm.x, y: farm.y },
        farm.x * 131 + farm.y * 71,
      );

      if (this.settlementAgents.length < maxVisibleAgents && homes.length > 0) {
        this.spawnSettlementAgent(
          'farmer',
          homePoint,
          { x: farm.x, y: farm.y },
          farm.x * 149 + farm.y * 83 + 11,
        );
      }
    }

    this.settlementLayer.visible =
      this.viewMode === 'world3d' && !this.battleSystem.isActive();
  }

  private spawnSettlementAgent(
    role: SettlementAgent['role'],
    home: GridPoint,
    work: GridPoint | undefined,
    seed: number,
  ): void {
    const id = this.nextSettlementAgentId++;
    const view = this.createSettlementPerson(role, seed);
    const world = this.gridToWorld(home.x, home.y);
    const offsetX = ((id % 3) - 1) * 0.42;
    const offsetZ = ((Math.floor(id / 3) % 3) - 1) * 0.38;
    const y = 2.24 + this.terrainElevation(home.x, home.y);
    const position = new THREE.Vector3(
      world.x + offsetX,
      y,
      world.z + offsetZ,
    );
    view.position.copy(position);
    this.settlementLayer.add(view);

    const agent: SettlementAgent = {
      id,
      role,
      view,
      home: { ...home },
      work: work ? { ...work } : undefined,
      position: position.clone(),
      target: position.clone(),
      targetGrid: { ...home },
      waitMs: 350 + Math.abs(seed % 900),
      phase: 'home',
      speed: role === 'farmer' ? 1.55 : 1.25 + (Math.abs(seed) % 4) * 0.08,
      anim: Math.abs(seed % 1000) * 0.013,
    };

    this.settlementAgents.push(agent);
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
    } else {
      const cap = new THREE.Mesh(
        new THREE.ConeGeometry(0.15, 0.16, 6),
        clothDark,
      );
      cap.position.y = 1.08;
      group.add(cap);
    }

    group.scale.setScalar(0.92);
    group.userData.settlementRole = role;
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
    agent.targetGrid = { ...point };
    agent.target.copy(this.settlementTargetPosition(agent, point));
  }

  private updateSettlementAgents(deltaMs: number): void {
    for (const agent of this.settlementAgents) {
      agent.anim += deltaMs * 0.001;

      if (agent.waitMs > 0) {
        agent.waitMs = Math.max(0, agent.waitMs - deltaMs);
        const idleBob = Math.sin(agent.anim * 3.2 + agent.id) * 0.012;
        agent.view.position.y = agent.position.y + idleBob;

        if (agent.waitMs === 0) {
          if (agent.role === 'farmer' && agent.work) {
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

        if (agent.role === 'farmer') {
          agent.waitMs = agent.phase === 'work' ? 2200 + (agent.id % 4) * 280 : 1200;
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

  private updatePopulationUI(): void {
    const battleStatus = this.battleSystem.status();
    const configuredMilitary =
      this.battleSetup.defenderSwordsmen +
      this.battleSetup.defenderArchers +
      this.battleSetup.defenderSpearmen +
      this.battleSetup.defenderCrossbowmen;
    const military =
      battleStatus.mode === 'running' ||
      battleStatus.mode === 'paused' ||
      battleStatus.mode === 'finished'
        ? battleStatus.defendersAlive
        : configuredMilitary;
    const groups = this.services.populationSystem.calculate(this.services.state.entries(), military);

    const population = document.getElementById('city-population');
    const army = document.getElementById('military-population');
    if (population) population.textContent = `Population: ${groups.civilians}`;
    if (army) army.textContent = `Army: ${groups.military}`;
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
    const dx = targetX - worker.view.position.x;
    const dz = targetZ - worker.view.position.z;
    const distance = Math.hypot(dx, dz);

    if (distance < 0.28) return true;

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

  private migrateKind(kind: string, level: number): { kind: TileKind; level: number } | null {
    if (kind === 'wall') return { kind: 'wall1', level };
    if (kind === 'mountain1') return { kind: 'mountain', level: 1 };
    if (kind === 'mountain2') return { kind: 'mountain', level: 2 };
    if (kind === 'mountain3') return { kind: 'mountain', level: 3 };
    if (!BUILDING_KINDS.includes(kind as TileKind)) return null;
    return { kind: kind as TileKind, level: Math.max(1, level) };
  }

  private bindUI(): void {
    const get = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
    const toolbar = get<HTMLElement>('toolbar');

    const noneHtml =
      '<button class="tool-button tool-button-none is-selected" data-build-none="true" type="button" aria-pressed="true">' +
      '<span class="tool-icon">✕</span>' +
      '<span class="tool-copy"><strong>None</strong><small>No build tool · free camera / inspect</small></span>' +
      '<kbd>Esc</kbd></button>';

    const modeConfig = getGameModeDefinition(this.gameMode);
    const toolDefinitions = new Map(TOOL_GROUPS.flatMap((group) => group.tools.map((tool) => [tool.id, tool] as const)));
    const toolHtml = modeConfig.toolGroups.map((group, index) => {
      const isDefaultOpen = index === 0;
      const buttons = group.toolIds
        .map((toolId) => toolDefinitions.get(toolId))
        .filter((tool): tool is ToolDefinition => Boolean(tool))
        .map(
          (tool) =>
            '<button class="tool-button' +
            (tool.id === this.selectedTool ? ' is-selected' : '') +
            '" data-tool="' +
            tool.id +
            '">' +
            '<span class="tool-icon">' +
            tool.icon +
            '</span>' +
            '<span class="tool-copy"><strong>' +
            tool.label +
            '</strong><small>' +
            tool.detail +
            '</small></span>' +
            '<kbd>' +
            tool.shortcut +
            '</kbd></button>',
        )
        .join('');

      return (
        '<section class="tool-category' +
        (isDefaultOpen ? ' is-open' : '') +
        '" data-category="' +
        group.label +
        '">' +
        '<button class="tool-category-header" type="button" aria-expanded="' +
        (isDefaultOpen ? 'true' : 'false') +
        '">' +
        '<span>' +
        group.label +
        '</span>' +
        '<span class="tool-category-chevron" aria-hidden="true">▶</span>' +
        '</button>' +
        '<div class="tool-category-items">' +
        buttons +
        '</div>' +
        '</section>'
      );
    }).join('');

    toolbar.innerHTML =
      '<div class="toolbar-title"><div><span>Build</span><small>Modular engineering</small></div><button id="toolbar-close" class="toolbar-close" type="button" aria-label="Close build panel">×</button></div>' +
      noneHtml +
      toolHtml +
      '<div class="builder-settings">' +
      '<div class="settings-title">Wall Settings</div>' +
      '<label class="settings-row"><span>Thickness</span><select id="wall-thickness">' +
      '<option value="thin">Thin</option><option value="medium" selected>Medium</option><option value="thick">Thick</option>' +
      '</select></label>' +
      '<label class="settings-check"><input id="wall-battlement" type="checkbox" checked /><span>Battlement</span></label>' +
      '<label class="settings-check"><input id="wall-walkway" type="checkbox" /><span>Top Walkway</span></label>' +
      '<div class="settings-actions"><button id="selected-down" type="button">− Height</button><button id="selected-up" type="button">+ Height</button></div>' +
      '<div class="settings-title">Castle Architecture</div>' +
      '<label class="settings-row"><span>Stone Style</span><select id="castle-stone-style">' +
      '<option value="limestone" selected>Limestone</option><option value="darkStone">Dark Stone</option>' +
      '<option value="sandstone">Sandstone</option><option value="frontier">Rough Frontier</option>' +
      '</select></label>' +
      '<label class="settings-row"><span>Tower Bridge</span><select id="tower-bridge-kind">' +
      '<option value="stone" selected>Stone Bridge</option><option value="wood">Wooden Bridge</option>' +
      '</select></label>' +
      '<div class="settings-hint">Foundations, buttresses and machicolations are generated automatically from height, terrain and structure importance.</div>' +
      '<div class="settings-title">Tower Builder</div>' +
      '<label class="settings-row"><span>Base</span><select id="tower-shape">' +
      '<option value="square">Square Tower</option><option value="round" selected>Round Tower</option>' +
      '<option value="octagonal">Octagonal Tower</option><option value="corner">Corner Tower</option>' +
      '<option value="watch">Watch Tower</option></select></label>' +
      '<label class="settings-row"><span>Top</span><select id="tower-top">' +
      '<option value="openBattlement" selected>Open Battlement</option>' +
      '<option value="conical">Conical Roof</option><option value="hipped">Hipped Roof</option>' +
      '<option value="pyramidal">Pyramidal Roof</option><option value="timberRoof">Timber Roof</option>' +
      '<option value="flat">Flat Platform</option><option value="watch">Watch Platform</option></select></label>' +
      '<div class="settings-title">Modular Keep</div>' +
      '<label class="settings-row"><span>Width</span><select id="keep-width">' +
      '<option value="2">2 tiles</option><option value="3" selected>3 tiles</option><option value="4">4 tiles</option><option value="5">5 tiles</option><option value="6">6 tiles</option>' +
      '</select></label>' +
      '<label class="settings-row"><span>Depth</span><select id="keep-depth">' +
      '<option value="2">2 tiles</option><option value="3" selected>3 tiles</option><option value="4">4 tiles</option><option value="5">5 tiles</option><option value="6">6 tiles</option>' +
      '</select></label>' +
      '<label class="settings-row"><span>Floors</span><select id="keep-floors">' +
      '<option value="1">1 floor</option><option value="2">2 floors</option><option value="3" selected>3 floors</option><option value="4">4 floors</option><option value="5">5 floors</option><option value="6">6 floors</option><option value="7">7 floors</option><option value="8">8 floors</option><option value="9">9 floors</option>' +
      '</select></label>' +
      '<label class="settings-row"><span>Roof</span><select id="keep-roof">' +
      '<option value="flatBattlement">Flat Battlement</option><option value="sloped">Medieval Sloped</option><option value="defensivePlatform">Defensive Platform</option><option value="towered">Towered Roof</option>' +
      '</select></label>' +
      '<label class="settings-check"><input id="keep-corner-towers" type="checkbox" checked /><span>Corner Towers</span></label>' +
      '<label class="settings-check"><input id="keep-battlements" type="checkbox" checked /><span>Keep Battlements</span></label>' +
      '<div class="settings-actions"><button id="keep-floor-down" type="button">− Keep Floor</button><button id="keep-floor-up" type="button">+ Keep Floor</button></div>' +
      '<div class="settings-actions"><button id="keep-rotate" type="button">↻ Keep 90°</button><button id="keep-remove" type="button">Remove Keep</button></div>' +
      '<div class="settings-hint">Keep details are automatic: entrance, windows, arrow slits, stairs, flags and internal floor-access metadata.</div>' +
      '<div class="settings-title">Terrain Brush</div>' +
      '<label class="settings-row"><span>Brush Size</span><select id="brush-size">' +
      '<option value="1">1 tile</option><option value="2" selected>2 tiles</option><option value="3">3 tiles</option><option value="4">4 tiles</option>' +
      '</select></label>' +
      '<label class="settings-row"><span>Strength</span><span class="range-wrap"><input id="brush-strength" type="range" min="0.25" max="2" step="0.25" value="1" /><b id="brush-strength-value">1.00</b></span></label>' +
      '<div class="settings-title">Selection</div>' +
      '<div class="move-pad"><button id="move-up" type="button">↑</button><button id="move-left" type="button">←</button><button id="move-down" type="button">↓</button><button id="move-right" type="button">→</button></div>' +
      '<div class="settings-actions"><button id="rotate-selected" type="button">↻ Rotate</button><button id="undo-button" type="button">Undo</button></div>' +
      '<div class="settings-actions"><button id="redo-button" type="button">Redo</button><button id="select-clear" type="button">Clear Select</button></div>' +
      '<div class="settings-hint">Walls: drag A→B. Terrain tools also support drag strokes. Ctrl+Z / Ctrl+Y undo and redo.</div>' +
      '</div>';

    const builderSettings = toolbar.querySelector<HTMLElement>('.builder-settings');
    if (builderSettings) builderSettings.hidden = this.gameMode === 'modern';

    toolbar.querySelectorAll<HTMLButtonElement>('.tool-category-header').forEach((header) => {
      header.onclick = () => {
        const category = header.closest<HTMLElement>('.tool-category');
        if (!category) return;
        const open = category.classList.toggle('is-open');
        header.setAttribute('aria-expanded', String(open));
      };
    });

    document.querySelector<HTMLButtonElement>('[data-build-none]')?.addEventListener('click', () => this.selectTool(null));

    toolbar.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach((button) => {
      button.onclick = () => {
        toolbar.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach((item) => {
          item.classList.toggle('is-selected', item === button);
        });
        this.selectTool(button.dataset.tool as ToolKind);
        if (window.matchMedia('(max-width: 760px)').matches) {
          this.setToolbarOpen(false);
        }
      };
    });

    get<HTMLButtonElement>('toolbar-close').onclick = () => this.setToolbarOpen(false);
    get<HTMLButtonElement>('toolbar-open').onclick = () => this.setToolbarOpen(true);
    get<HTMLButtonElement>('view-2d-button').onclick = () => this.setViewMode('plan2d');
    get<HTMLButtonElement>('view-3d-button').onclick = () => this.setViewMode('world3d');
    get<HTMLButtonElement>('camera-45-button').onclick = () => this.setCameraView('45');
    get<HTMLButtonElement>('camera-top-button').onclick = () => this.setCameraView('top');

    const wallThickness = get<HTMLSelectElement>('wall-thickness');
    wallThickness.onchange = () => {
      this.wallThickness = wallThickness.value as WallThickness;
      this.applyWallSettingsToSelected();
    };

    const wallBattlement = get<HTMLInputElement>('wall-battlement');
    wallBattlement.onchange = () => {
      this.wallBattlement = wallBattlement.checked;
      this.applyWallSettingsToSelected();
    };

    const wallWalkway = get<HTMLInputElement>('wall-walkway');
    wallWalkway.onchange = () => {
      this.wallWalkway = wallWalkway.checked;
      this.applyWallSettingsToSelected();
    };

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

    get<HTMLButtonElement>('keep-floor-down').onclick = () => this.adjustSelectedKeepFloors(-1);
    get<HTMLButtonElement>('keep-floor-up').onclick = () => this.adjustSelectedKeepFloors(1);
    get<HTMLButtonElement>('keep-rotate').onclick = () => this.rotateSelectedKeep();
    get<HTMLButtonElement>('keep-remove').onclick = () => this.removeSelectedKeep();

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

    get<HTMLButtonElement>('move-up').onclick = () => this.moveSelected(0, -1);
    get<HTMLButtonElement>('move-left').onclick = () => this.moveSelected(-1, 0);
    get<HTMLButtonElement>('move-down').onclick = () => this.moveSelected(0, 1);
    get<HTMLButtonElement>('move-right').onclick = () => this.moveSelected(1, 0);
    get<HTMLButtonElement>('rotate-selected').onclick = () => this.rotateSelected();
    get<HTMLButtonElement>('undo-button').onclick = () => this.undo();
    get<HTMLButtonElement>('redo-button').onclick = () => this.redo();
    get<HTMLButtonElement>('select-clear').onclick = () => {
      this.selectedCell = null;
      this.selectedKeepId = null;
      this.setStatus('Selection cleared');
    };

    const help = get<HTMLElement>('help-modal');
    const templates = get<HTMLElement>('templates-modal');
    const battlePanel = get<HTMLElement>('battle-panel');

    get<HTMLButtonElement>('battle-button').onclick = () => {
      battlePanel.hidden = false;
      this.syncBattleSetupUI();
      this.updateBattleUI(this.battleSystem.status());
    };
    get<HTMLButtonElement>('battle-close').onclick = () => {
      battlePanel.hidden = true;
    };

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
    get<HTMLButtonElement>('battle-stop').onclick = () => this.stopBattleFromUI();
    get<HTMLButtonElement>('battle-reset').onclick = () => this.resetBattleFromUI();
    this.syncBattleSetupUI();
    this.updateBattleUI(this.battleSystem.status());

    get<HTMLButtonElement>('help-button').onclick = () => {
      help.hidden = false;
    };
    get<HTMLButtonElement>('help-close-button').onclick = () => {
      help.hidden = true;
    };
    get<HTMLButtonElement>('templates-button').onclick = () => {
      this.syncTemplateAvailability();
      templates.hidden = false;
    };
    get<HTMLButtonElement>('game-mode-button').onclick = () => {
      if (confirm('Start a new game and choose a game mode? Current changes will be replaced.')) this.openGameModeSelector();
    };
    document.querySelectorAll<HTMLButtonElement>('[data-game-mode]').forEach((button) => {
      button.onclick = () => {
        const requested = button.dataset.gameMode;
        if (isGameMode(requested)) this.startNewGameWithMode(requested);
      };
    });
    get<HTMLButtonElement>('templates-close-button').onclick = () => {
      templates.hidden = true;
    };

    document.querySelectorAll<HTMLButtonElement>('[data-template]').forEach((button) => {
      button.onclick = () => {
        const template = button.dataset.template;
        if (!template) return;
        this.applyTemplate(template);
        templates.hidden = true;
      };
    });

    document.querySelectorAll<HTMLButtonElement>('[data-terrain-template]').forEach((button) => {
      button.onclick = () => {
        const template = button.dataset.terrainTemplate;
        if (!template) return;
        this.applyTerrainTemplate(template);
        templates.hidden = true;
      };
    });

    get<HTMLButtonElement>('save-button').onclick = () => this.save();
    get<HTMLButtonElement>('load-button').onclick = () => {
      this.load();
      this.selectedCell = null;
      this.selectedKeepId = null;
      this.undoStack.length = 0;
      this.redoStack.length = 0;
      this.redraw();
    };
    get<HTMLButtonElement>('reset-button').onclick = () => {
      if (confirm('Reset the entire island and choose a game mode?')) {
        this.openGameModeSelector();
      }
    };
    get<HTMLButtonElement>('fullscreen-button').onclick = async () => {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    };

    window.addEventListener('resize', () => {
      if (window.innerWidth <= 760 && this.toolbarOpen) {
        this.setToolbarOpen(false);
      }
    });

    window.addEventListener('keydown', (event) => {
      const key = event.key.toLowerCase();

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

      const typingTarget = event.target;
      if (
        typingTarget instanceof HTMLInputElement ||
        typingTarget instanceof HTMLTextAreaElement ||
        typingTarget instanceof HTMLSelectElement
      ) {
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
        e: 'stairTower',
        i: 'dirtRoad',
        o: 'stoneRoad',
        k: 'mountainRange',
        u: 'raise',
        j: 'lower',
        b: 'flatten',
        v: 'smooth',
        g: 'dig',
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
        this.selectTool(null);
      }
    });
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
    this.redraw();
    this.scheduleSave();
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
      (x, y) => Boolean(this.services.state.getCell(x, y)),
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

  private placeKeep(gx: number, gy: number): void {
    const existing = this.services.keepSystem.findAtCell(gx, gy);
    if (existing) {
      this.selectKeep(existing);
      return;
    }

    const draft = {
      x: gx,
      y: gy,
      width: this.keepWidth,
      depth: this.keepDepth,
      floors: this.keepFloors,
      rotation: this.keepRotation,
      cornerTowers: this.keepCornerTowers,
      roof: this.keepRoof,
      battlements: this.keepBattlements,
    };

    const validation = this.validateKeepDraft(draft);
    if (!validation.valid) {
      this.setStatus(validation.reason ?? 'Invalid Keep placement');
      return;
    }

    this.recordHistory();
    const keep = this.services.keepSystem.add(draft);
    this.selectKeep(keep);
    this.redraw();
    this.scheduleSave();
    this.setStatus(`Keep built · ${keep.width}×${keep.depth} · ${keep.floors} floors · details generated automatically`);
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
      this.setStatus('Selected tile is not a wall or tower');
      return;
    }

    this.recordHistory();
    this.services.state.setLevel(
      this.selectedCell.x,
      this.selectedCell.y,
      Math.max(1, (cell.level ?? 1) + delta),
    );
    this.redraw();
    this.scheduleSave();
    this.setStatus(`Height level: ${Math.max(1, (cell.level ?? 1) + delta)}`);
  }

  private applyTemplate(template: string): void {
    if (template === 'futuristic-castle' && this.gameMode !== 'modern') {
      this.setStatus('Futuristic Castle is only available in Modern Mode');
      return;
    }
    if (template !== 'futuristic-castle' && this.gameMode === 'modern') {
      this.setStatus('Medieval templates are unavailable in Modern Mode');
      return;
    }
    this.recordHistory();
    this.services.state.clear();
    this.services.keepSystem.clear();
    this.towerBridges.clear();
    this.nextTowerBridgeId = 1;
    this.towerBridgeStart = null;
    this.towerBridgeHover = null;
    this.clearGroup(this.wallPreviewLayer);
    this.selectedKeepId = null;
    this.terrainOverrides.clear();
    this.elevationOverrides.clear();
    this.moatTasks.clear();
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
      };
      this.towerBridges.set(bridge.id, bridge);
    };

    const addTemplateStairTower = (x: number, y: number): void => {
      const snap = this.findStairTowerSnap(x, y);
      if (!snap) return;
      place(x, y, 'stairTower', 1, {
        rotation: snap.rotation,
        accessHeight: snap.accessHeight,
      });
    };

    const placeHarborTemplate = (
      kind: HarborKind,
      shipKind: ShipKind,
      targetX: number,
      targetY: number,
    ): GridPoint | null => {
      const candidates: Array<{ point: GridPoint; rotation: number; score: number }> = [];
      for (let y = 1; y < SIZE - 1; y += 1) {
        for (let x = 1; x < SIZE - 1; x += 1) {
          if (this.services.state.getCell(x, y) || this.services.keepSystem.findAtCell(x, y)) continue;
          const coast = this.maritimeSystem.canPlace(kind, x, y);
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
      place(choice.point.x, choice.point.y, kind, 1, {
        rotation: choice.rotation,
        shipKind,
      });
      return choice.point;
    };

    if (template !== 'empty-land') this.seedNaturalProps();

    if (template === 'futuristic-castle') {
      this.stoneStyle = 'darkStone';
      prepareArea(center - 10, center - 10, center + 10, center + 10, 0.05);
      place(center, center, 'futuristicCastle');
    } else if (template === 'empty-land') {
      for (let y = 0; y < SIZE; y += 1) {
        for (let x = 0; x < SIZE; x += 1) {
          if (this.baseTerrainAt(x, y) !== 'water') {
            this.terrainOverrides.set(this.key(x, y), 'plains');
          }
        }
      }
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
      this.stoneStyle = 'limestone';
      this.towerBridgeKind = 'stone';
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
      addTemplateStairTower(minX + 1, center);
      place(center, center + 3, 'stoneRoad');
      place(center - 2, center + 2, 'manor');
      place(center + 2, center + 2, 'house');
      place(center - 3, center - 3, 'farm');
      place(center + 3, center - 3, 'villa');

      for (let y = center + 1; y < maxY; y += 1) place(center, y, 'stoneRoad');
    } else if (template === 'dark-fortress') {
      this.stoneStyle = 'darkStone';
      this.towerBridgeKind = 'stone';
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
      addTemplateStairTower(center - 5, center);
      place(center, center + 6, 'stoneRoad');
    } else if (template === 'sandstone-oasis') {
      this.stoneStyle = 'sandstone';
      this.towerBridgeKind = 'stone';
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
      this.stoneStyle = 'frontier';
      this.towerBridgeKind = 'wood';
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
      addTemplateStairTower(center - 6, center);
    } else if (template === 'bridge-stronghold') {
      this.stoneStyle = 'limestone';
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
      addTemplateStairTower(center - 8, center);
      for (let y = center + 2; y < center + 6; y += 1) place(center, y, 'stoneRoad');
    } else if (template === 'siege-academy') {
      this.stoneStyle = 'darkStone';
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

      addTemplateStairTower(center - 6, center);
      place(center + 6, center, 'stoneStairs', 1, { rotation: 3 });
      place(center - 5, center + 6, 'woodenStairs', 1, { rotation: 0 });
      place(center + 5, center + 6, 'ramp', 1, { rotation: 0 });
      place(center, center - 6, 'ladder', 1, { rotation: 2 });
      for (let y = center + 6; y <= center + 9; y += 1) place(center, y, 'road');
    } else if (template === 'harbor-capital') {
      this.stoneStyle = 'limestone';
      this.towerBridgeKind = 'wood';

      const harbor = placeHarborTemplate('harbor', 'tradingBoat', SIZE - 5, center);
      const pier = placeHarborTemplate('woodenPier', 'transportShip', SIZE - 6, center - 6);
      const fishing = placeHarborTemplate('fishingDock', 'fishingBoat', SIZE - 6, center + 6);
      const smallDock = placeHarborTemplate('smallDock', 'fishingBoat', 5, center);

      const portPoints = [harbor, pier, fishing, smallDock].filter(
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
      this.stoneStyle = 'frontier';
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
      addTemplateStairTower(center - 4, center);
      for (let y = center + 5; y <= center + 8; y += 1) place(center, y, 'stoneRoad');
    } else if (template === 'royal-city') {
      this.stoneStyle = 'sandstone';
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
      this.stoneStyle = 'limestone';
      this.towerBridgeKind = 'stone';
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
      addTemplateStairTower(center - 8, center + 4);

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
      this.stoneStyle = 'limestone';
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
      addTemplateStairTower(center - 6, center);

      place(center - 5, center + 2, 'house');
      place(center - 1, center + 2, 'cottage');
      place(center - 5, center - 3, 'farm');
      for (let y = center + 1; y < center + 5; y += 1) place(center - 3, y, 'stoneRoad');

      placeHarborTemplate('smallDock', 'fishingBoat', SIZE - 4, center + 4);
      placeHarborTemplate('fishingDock', 'fishingBoat', SIZE - 5, center - 3);
    } else if (template === 'farming-duchy') {
      this.stoneStyle = 'sandstone';
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
      this.stoneStyle = 'darkStone';
      this.towerBridgeKind = 'stone';
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
      addTemplateStairTower(center - 8, center);
      place(center, center + 2, 'armyCamp');
      for (let y=center+1;y<center+6;y+=1) if(!this.services.state.getCell(center,y)) place(center,y,'stoneRoad');
    } else if (template === 'border-march') {
      this.stoneStyle = 'frontier';
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
      this.stoneStyle = 'limestone';
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
      addTemplateStairTower(center-5,center);
    } else if (template === 'cliff-watch') {
      this.stoneStyle = 'darkStone';
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
      addTemplateStairTower(center+2,center);
      place(center-3,center+1,'armyCamp');
      for(let y=center-2;y<=center+4;y+=1) if(!this.services.state.getCell(center,y)) place(center,y,'stoneRoad');
    } else if (template === 'moat-palace') {
      this.stoneStyle = 'sandstone';
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
      addTemplateStairTower(center-5,center);
    } else if (template === 'merchant-republic') {
      this.stoneStyle = 'limestone';
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
      placeHarborTemplate('smallDock','fishingBoat',SIZE-5,center+5);
    } else if (template === 'war-camp') {
      this.stoneStyle = 'frontier';
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
    } else if (template === 'island-monastery') {
      this.stoneStyle = 'limestone';
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
      placeHarborTemplate('smallDock','fishingBoat',4,center);
    }

    this.selectedCell = null;
    this.selectedKeepId = null;
    const stoneSelect = document.getElementById('castle-stone-style') as HTMLSelectElement | null;
    if (stoneSelect) stoneSelect.value = this.stoneStyle;
    const bridgeSelect = document.getElementById('tower-bridge-kind') as HTMLSelectElement | null;
    if (bridgeSelect) bridgeSelect.value = this.towerBridgeKind;
    this.redraw();
    this.save();
    this.setStatus('Template loaded: ' + template);
  }

  private applyTerrainTemplate(template: string): void {
    this.recordHistory();
    this.services.state.clear();
    this.services.keepSystem.clear();
    this.towerBridges.clear();
    this.nextTowerBridgeId = 1;
    this.towerBridgeStart = null;
    this.towerBridgeHover = null;
    this.clearGroup(this.wallPreviewLayer);
    this.selectedKeepId = null;
    this.selectedCell = null;
    this.terrainOverrides.clear();
    this.elevationOverrides.clear();
    this.moatTasks.clear();
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

  private setBattleSetupValue(
    field: keyof BattleSetup,
    value: number,
  ): void {
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
    this.battleSetup = {
      ...this.battleSetup,
      [field]: normalized,
    };
    this.syncBattleSetupUI();
    this.updatePopulationUI();
  }

  private syncBattleSetupUI(): void {
    const mappings: Array<[keyof BattleSetup, string]> = [
      ['defenderSwordsmen', 'battle-defender-swordsmen'],
      ['defenderArchers', 'battle-defender-archers'],
      ['defenderSpearmen', 'battle-defender-spearmen'],
      ['defenderCrossbowmen', 'battle-defender-crossbowmen'],
      ['attackerSwordsmen', 'battle-attacker-swordsmen'],
      ['attackerArchers', 'battle-attacker-archers'],
      ['attackerSpearmen', 'battle-attacker-spearmen'],
      ['attackerCrossbowmen', 'battle-attacker-crossbowmen'],
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
    const current = this.battleSystem.status();
    if (current.mode === 'paused') {
      this.battleSystem.resume();
      this.setStatus('Battle resumed');
      return;
    }

    const attackerTotal =
      this.battleSetup.attackerSwordsmen +
      this.battleSetup.attackerArchers +
      this.battleSetup.attackerSpearmen +
      this.battleSetup.attackerCrossbowmen;
    const defenderTotal =
      this.battleSetup.defenderSwordsmen +
      this.battleSetup.defenderArchers +
      this.battleSetup.defenderSpearmen +
      this.battleSetup.defenderCrossbowmen;

    if (attackerTotal <= 0) {
      this.setStatus('Add at least one Attacker before starting the battle');
      return;
    }

    if (defenderTotal <= 0) {
      this.setStatus('No Defenders configured · attackers will attempt an immediate capture');
    }

    this.setViewMode('world3d');
    this.setToolbarOpen(false);
    this.workerLayer.visible = false;
    this.settlementLayer.visible = false;
    document.getElementById('game-shell')?.classList.add('battle-mode');
    this.services.gateSystem.setAttackState(true);
    audioEvents.emit({ action: 'play_sfx', assetId: 'combat.battle-start' });
    this.battleSystem.start(this.battleSetup);
    this.setStatus('Battle started · Attackers are advancing on the castle');
  }

  private stopBattleFromUI(): void {
    audioEvents.emit({ action: 'play_sfx', assetId: 'combat.battle-stop' });
    this.battleSystem.stop();
    this.setStatus('Battle stopped · press Start Battle to resume');
  }

  private resetBattleFromUI(): void {
    audioEvents.emit({ action: 'play_sfx', assetId: 'combat.battle-reset' });
    this.services.gateSystem.setAttackState(false);
    this.battleSystem.reset();
    document.getElementById('game-shell')?.classList.remove('battle-mode');
    this.workerLayer.visible = this.viewMode === 'world3d';
    this.settlementLayer.visible = this.viewMode === 'world3d';
    this.setStatus('Battle reset · castle restored unchanged');
  }

  private updateBattleUI(status: BattleStatus): void {
    if (status.mode === 'finished') {
      this.redraw();
      this.save(false);
    }
    const panel = document.getElementById('battle-panel');
    const mode = document.getElementById('battle-mode-status');
    const attackerAlive = document.getElementById('battle-attacker-alive');
    const defenderAlive = document.getElementById('battle-defender-alive');
    const captureLabel = document.getElementById('battle-capture-label');
    const captureFill = document.getElementById('battle-capture-fill');
    const result = document.getElementById('battle-result');
    const startButton = document.getElementById('battle-start') as HTMLButtonElement | null;
    const stopButton = document.getElementById('battle-stop') as HTMLButtonElement | null;

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
    this.updatePopulationUI();

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
      startButton.textContent = status.mode === 'paused' ? 'Resume Battle' : 'Start Battle';
      startButton.disabled = status.mode === 'running' || status.mode === 'finished';
    }

    if (stopButton) {
      stopButton.disabled = status.mode !== 'running';
    }

    if (panel && status.mode !== 'idle') panel.removeAttribute('hidden');

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
      this.setStatus('Tool unavailable in ' + getGameModeDefinition(this.gameMode).label);
      return;
    }
    if (this.battleSystem.isActive()) {
      this.setStatus('Reset Battle before returning to construction');
      return;
    }

    if (tool !== 'towerBridge') {
      this.towerBridgeStart = null;
      this.towerBridgeHover = null;
      this.clearGroup(this.wallPreviewLayer);
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
      element.classList.toggle('is-selected', tool !== null && (element as HTMLElement).dataset.tool === tool);
    });
    const noneButton = document.querySelector('[data-build-none]');
    noneButton?.classList.toggle('is-selected', tool === null);
    noneButton?.setAttribute('aria-pressed', String(tool === null));
    this.setStatus(tool === null ? 'No Build Tool Selected · free camera / inspect' : 'Selected: ' + tool);
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
    const deltaMs = this.lastFrameTime === 0 ? 16 : Math.min(50, time - this.lastFrameTime);
    this.lastFrameTime = time;

    if (!this.battleSystem.isActive()) {
      this.updateWorkers(deltaMs);
      this.updateSettlementAgents(deltaMs);
    }
    this.battleSystem.update(deltaMs, time);
    this.services.windmillSystem.update(deltaMs / 1000);
    this.updateLongPress(time);
    this.riverTexture.offset.y -= deltaMs * 0.00032;
    this.riverTexture.offset.x += deltaMs * 0.000035;
    this.oceanTexture.offset.x += deltaMs * 0.000018;
    this.oceanTexture.offset.y -= deltaMs * 0.000012;

    for (const flag of this.animatedFlags) {
      const phase = Number(flag.userData.castleFlag?.phase ?? 0);
      const wave = Math.sin(time * 0.0032 + phase);
      flag.rotation.y = wave * 0.08;
      flag.scale.x = 0.94 + Math.abs(wave) * 0.09;
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);

    requestAnimationFrame((nextTime) => this.animate(nextTime));
  }
}