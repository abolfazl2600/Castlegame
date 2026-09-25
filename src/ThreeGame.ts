import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GameState } from './state/GameState';
import { SAVE_KEY, SAVE_VERSION, TILE_SIZE, WORLD_COLS } from './core/constants';
import { KeepSystem } from './building/KeepSystem';
import { WallSystem } from './building/WallSystem';
import { WallCornerSystem } from './building/WallCornerSystem';
import { CastleAccessSystem } from './building/CastleAccessSystem';
import { CastleDetailGenerator } from './building/CastleDetailGenerator';
import { KeepRenderer } from './rendering/KeepRenderer';
import type {
  AccessKind,
  GridCell,
  KeepRoofStyle,
  KeepState,
  SavedGame,
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
const BUILDING_KINDS: TileKind[] = [
  'wall1',
  'wall2',
  'wall3',
  'gate',
  'tower',
  'road',
  'cottage',
  'house',
  'manor',
  'villa',
  'farm',
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
];

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

interface HistorySnapshot {
  cells: ReturnType<GameState['entries']>;
  keeps: KeepState[];
  terrain: Array<[string, TerrainOverrideKind]>;
  elevations: Array<[string, number]>;
}

const TOOL_GROUPS: Array<{ label: string; tools: ToolDefinition[] }> = [
  {
    label: 'Advanced Walls',
    tools: [
      { id: 'wall1', icon: '🪨', label: 'Stone Wall', detail: 'Drag A → B · stack floors', shortcut: '1' },
      { id: 'wall2', icon: '🪵', label: 'Wooden Wall', detail: 'Drag A → B · timber defense', shortcut: '2' },
      { id: 'wall3', icon: '🛡️', label: 'Reinforced Wall', detail: 'Drag A → B · heavy defense', shortcut: '3' },
      { id: 'gate', icon: '🚪', label: 'Gate', detail: 'Snaps into fortification lines', shortcut: '4' },
      { id: 'tower', icon: '🏰', label: 'Modular Tower', detail: '5 bases · 5 top modules', shortcut: '5' },
      { id: 'keep', icon: '🏯', label: 'Modular Keep', detail: 'Width · depth · floors · roof', shortcut: 'P' },
      { id: 'moat', icon: '💧', label: 'Moat', detail: 'Workers excavate queued tiles', shortcut: 'Q' },
    ],
  },
  {
    label: 'Settlement',
    tools: [
      { id: 'road', icon: '🛣️', label: 'Road', detail: 'Auto-connects edge to edge', shortcut: '6' },
      { id: 'cottage', icon: '🏠', label: 'Cottage Cluster', detail: '3 small cottages + village props', shortcut: '7' },
      { id: 'house', icon: '🏡', label: 'House Cluster', detail: '4 connected village homes', shortcut: '8' },
      { id: 'manor', icon: '🏯', label: 'Manor Court', detail: 'Main hall + service houses', shortcut: '9' },
      { id: 'villa', icon: '🏘️', label: 'Villa Quarter', detail: '3 detailed homes + courtyard', shortcut: '0' },
      { id: 'farm', icon: '🌾', label: 'Farm', detail: 'Cultivated crop field', shortcut: 'F' },
    ],
  },
  {
    label: 'Nature & Resources',
    tools: [
      { id: 'tree', icon: '🌲', label: 'Tree', detail: 'Plant a detailed tree', shortcut: 'T' },
      { id: 'mountain', icon: '⛰️', label: 'Mountain', detail: 'Repeated clicks grow it', shortcut: 'N' },
      { id: 'mine', icon: '⛏️', label: 'Mine', detail: 'Natural or built mountain', shortcut: 'M' },
      { id: 'river', icon: '🌊', label: 'River', detail: 'Carve connected flowing water', shortcut: 'R' },
      { id: 'land', icon: '🌱', label: 'Land', detail: 'Fill water into buildable land', shortcut: 'L' },
      { id: 'raise', icon: '⬆️', label: 'Raise', detail: 'Raise terrain with brush', shortcut: 'U' },
      { id: 'lower', icon: '⬇️', label: 'Lower', detail: 'Lower terrain with brush', shortcut: 'J' },
      { id: 'flatten', icon: '▰', label: 'Flatten', detail: 'Level terrain to brush center', shortcut: 'B' },
      { id: 'smooth', icon: '〰️', label: 'Smooth', detail: 'Blend nearby terrain heights', shortcut: 'V' },
      { id: 'dig', icon: '⛏️', label: 'Dig', detail: 'Excavate deep ground', shortcut: 'G' },
      { id: 'hill', icon: '⛰️', label: 'Create Hill', detail: 'Build a rounded hill', shortcut: 'H' },
      { id: 'cliff', icon: '🗻', label: 'Create Cliff', detail: 'Create a sharp raised plateau', shortcut: 'C' },
      { id: 'erase', icon: '⌫', label: 'Remove', detail: 'Trees, rocks, huts & builds', shortcut: 'X' },
    ],
  },
];

export class ThreeGame {
  private readonly root: HTMLElement;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(48, 1, 0.1, 700);
  private readonly renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  private readonly controls: OrbitControls;
  private readonly state = new GameState();
  private readonly keepSystem = new KeepSystem();
  private readonly wallCornerSystem = new WallCornerSystem();
  private readonly castleAccessSystem = new CastleAccessSystem();
  private readonly detailGenerator = new CastleDetailGenerator();
  private readonly keepRenderer = new KeepRenderer(this.detailGenerator);
  private readonly terrainOverrides = new Map<string, TerrainOverrideKind>();
  private readonly elevationOverrides = new Map<string, number>();
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly terrainLayer = new THREE.Group();
  private readonly buildLayer = new THREE.Group();
  private readonly wallPreviewLayer = new THREE.Group();
  private readonly workerLayer = new THREE.Group();
  private readonly groundHit = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD, WORLD),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  private readonly moatTasks = new Map<string, MoatTask>();
  private readonly workers: WorkerAgent[] = [];
  private readonly riverTexture: THREE.CanvasTexture;
  private readonly riverWaterMaterial: THREE.MeshStandardMaterial;

  private selectedTool: ToolKind = 'wall1';
  private selectedCell: GridPoint | null = null;
  private wallThickness: WallThickness = 'medium';
  private wallBattlement = true;
  private wallWalkway = false;
  private towerShape: TowerShape = 'round';
  private towerTop: TowerTop = 'battlement';
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

  private readonly undoStack: HistorySnapshot[] = [];
  private readonly redoStack: HistorySnapshot[] = [];
  private terrainStrokeActive = false;
  private terrainStrokeChanged = false;
  private terrainStrokeSnapshot: HistorySnapshot | null = null;
  private lastTerrainBrushKey = '';

  private wallDragStart: GridPoint | null = null;
  private wallDragEnd: GridPoint | null = null;
  private pointerStart: { x: number; y: number } | null = null;

  private saveTimer: number | null = null;
  private worldSeeded = false;
  private lastFrameTime = 0;

  constructor(root: HTMLElement) {
    const hadSave = localStorage.getItem(SAVE_KEY) !== null;
    this.root = root;
    this.riverTexture = this.createRiverTexture();
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
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    root.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(0x071b2a);
    this.scene.fog = new THREE.Fog(0x071b2a, 98, 225);
    this.camera.position.set(68, 80, 76);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.minDistance = 34;
    this.controls.maxDistance = 150;
    this.controls.maxPolarAngle = Math.PI * 0.47;
    this.controls.target.set(0, 0, 0);

    this.addLights();
    this.createWorld();

    this.scene.add(this.terrainLayer);
    this.scene.add(this.buildLayer);
    this.scene.add(this.wallPreviewLayer);
    this.scene.add(this.workerLayer);

    this.groundHit.rotation.x = -Math.PI / 2;
    this.groundHit.position.y = 2.05;
    this.scene.add(this.groundHit);

    this.load();
    if (!this.worldSeeded) {
      this.seedNaturalProps();
      this.worldSeeded = true;
      this.save(false);
    }

    this.createWorkers();
    this.redraw();
    this.bindUI();
    if (!hadSave) {
      const templates = document.getElementById('templates-modal');
      if (templates) templates.hidden = false;
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

  private addLights(): void {
    this.scene.add(new THREE.HemisphereLight(0xbbeeff, 0x23384d, 2.25));

    const sun = new THREE.DirectionalLight(0xffe5c8, 4.2);
    sun.position.set(42, 90, 30);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -78;
    sun.shadow.camera.right = 78;
    sun.shadow.camera.top = 78;
    sun.shadow.camera.bottom = -78;
    this.scene.add(sun);

    const rim = new THREE.PointLight(0x4cc9ff, 62, 130);
    rim.position.set(-46, 30, -40);
    this.scene.add(rim);
  }

  private createWorld(): void {
    const water = new THREE.Mesh(
      new THREE.CircleGeometry(WORLD * 0.78, 80),
      new THREE.MeshStandardMaterial({ color: 0x0b7897, roughness: 0.22, metalness: 0.07 }),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.y = -0.8;
    water.receiveShadow = true;
    this.scene.add(water);

    const island = new THREE.Mesh(
      new THREE.CylinderGeometry(WORLD * 0.49, WORLD * 0.55, 2.6, 80),
      new THREE.MeshStandardMaterial({ color: 0x7e9f55, roughness: 0.95 }),
    );
    island.receiveShadow = true;
    island.castShadow = true;
    this.scene.add(island);

    const grass = new THREE.Mesh(
      new THREE.CylinderGeometry(WORLD * 0.46, WORLD * 0.49, 1.2, 80),
      new THREE.MeshStandardMaterial({ color: 0xb3c968, roughness: 0.9 }),
    );
    grass.position.y = 1.55;
    grass.receiveShadow = true;
    this.scene.add(grass);

    const grid = new THREE.GridHelper(WORLD, SIZE, 0xe8f7ff, 0x7eb8bd);
    grid.position.y = 2.18;
    (grid.material as THREE.Material).opacity = 0.1;
    (grid.material as THREE.Material).transparent = true;
    this.scene.add(grid);
  }

  private baseTerrainAt(x: number, y: number): TerrainKind {
    if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return 'water';

    const nx = x / SIZE - 0.5;
    const ny = y / SIZE - 0.5;
    const radial = Math.sqrt(nx * nx + ny * ny);
    const noise =
      Math.sin(x * 0.19) * 0.03 +
      Math.cos(y * 0.16) * 0.04 +
      Math.sin((x + y) * 0.11) * 0.02;
    const islandValue = 0.43 - radial + noise;

    if (islandValue < -0.04) return 'water';
    if (islandValue < 0.015) return 'shore';

    const riverCenter = SIZE * 0.48 + Math.sin(y * 0.58) * 1.0 + Math.cos(y * 0.21) * 0.45;
    if (y > 3 && y < SIZE - 3 && Math.abs(x - riverCenter) < 0.58 && islandValue > 0.07) {
      return 'river';
    }

    const mountainZone = x > SIZE * 0.62 && y < SIZE * 0.4;
    if (mountainZone && Math.sin(x * 0.62) + Math.cos(y * 0.48) > 0.48) return 'mountain';

    const forestZone =
      (x < SIZE * 0.34 && y > SIZE * 0.4) ||
      (x > SIZE * 0.64 && y > SIZE * 0.58);
    if (forestZone && Math.sin(x * 0.53) + Math.cos(y * 0.47) > 0.35) return 'forest';

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
        if (this.state.getCell(x, y)) continue;

        const terrain = this.baseTerrainAt(x, y);
        const hash = (x * 37 + y * 61 + x * y * 7) % 29;

        if (terrain === 'forest' && hash % 3 !== 0) {
          this.state.setCell(x, y, 'tree', 1 + (hash % 3));
        } else if ((terrain === 'shore' || terrain === 'mountain') && hash === 4) {
          this.state.setCell(x, y, 'rock', 1 + ((x + y) % 2));
        } else if (terrain === 'plains' && (hash === 8 || hash === 19) && x > 3 && y > 3) {
          this.state.setCell(x, y, 'hut', 1);
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
          if (item !== this.riverWaterMaterial) item.dispose();
        }
      } else if (material && material !== this.riverWaterMaterial) {
        material.dispose();
      }
    });
    group.clear();
  }

  private redraw(): void {
    this.clearGroup(this.terrainLayer);
    this.clearGroup(this.buildLayer);
    this.renderTerrain();

    const floodedMoats = this.computeFloodedMoats();
    const cells = this.state.entries();

    for (const cell of cells) {
      this.buildLayer.add(this.makeBuilding(cell, floodedMoats));
    }

    for (const keep of this.keepSystem.entries()) {
      this.buildLayer.add(
        this.keepRenderer.render(keep, {
          tileSize: TILE,
          toWorld: (x, y) => this.gridToWorld(x, y),
          elevationAt: (x, y) => this.terrainElevation(x, y),
          terrainAt: (x, y) => this.terrainAt(x, y),
          kindAt: (x, y) => this.kindAt(x, y),
        }),
      );
    }

    const generatedAccess = this.castleAccessSystem.generate(
      cells,
      this.keepSystem.entries(),
      {
        size: SIZE,
        getCell: (x, y) => {
          const cell = this.state.getCell(x, y);
          return cell ? { x, y, ...cell } : undefined;
        },
        terrainBuildable: (x, y) => {
          const terrain = this.terrainAt(x, y);
          return terrain !== 'water' && terrain !== 'river';
        },
        isOccupied: (x, y) =>
          Boolean(this.state.getCell(x, y)) ||
          Boolean(this.keepSystem.findAtCell(x, y)),
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

    this.animatedFlags = [];
    this.buildLayer.traverse((object) => {
      if (object instanceof THREE.Mesh && object.userData.castleFlag) {
        this.animatedFlags.push(object);
      }
    });
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
          this.renderRiverTile(group, x, y);
          this.terrainLayer.add(group);
          continue;
        }

        if (this.terrainOverrides.get(this.key(x, y)) === 'plains' && (base === 'water' || base === 'river')) {
          const soil = new THREE.MeshStandardMaterial({ color: 0x7e9f55, roughness: 1 });
          const grass = new THREE.MeshStandardMaterial({ color: 0xb3c968, roughness: 0.92 });
          this.addBox(group, TILE, 0.5, TILE, soil, 0, 1.87, 0);
          this.addBox(group, TILE, 0.14, TILE, grass, 0, 2.19, 0);
        }

        if (edited) {
          this.renderElevationPatch(group, elevation);
        }

        const occupying = this.state.getCell(x, y)?.kind;
        const hidesMountain =
          occupying !== undefined &&
          (this.isWallFamily(occupying) || occupying === 'mine' || occupying === 'tower' || occupying === 'gate');

        if (terrain === 'mountain' && !hidesMountain) {
          const mountainGroup = new THREE.Group();
          mountainGroup.position.y = this.elevationOverrides.get(this.key(x, y)) ?? 0;
          this.addNaturalMountain(mountainGroup, x, y);
          group.add(mountainGroup);
        }

        if (group.children.length > 0) this.terrainLayer.add(group);
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

    const riverBed = new THREE.MeshStandardMaterial({ color: 0x5e5548, roughness: 1 });
    const wetEarth = new THREE.MeshStandardMaterial({ color: 0x756850, roughness: 1 });
    const bank = new THREE.MeshStandardMaterial({ color: 0x8f7f59, roughness: 0.98 });
    const grass = new THREE.MeshStandardMaterial({ color: 0x9eb95f, roughness: 0.94 });
    const foam = new THREE.MeshBasicMaterial({
      color: 0xcdf8ff,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });

    this.addBox(group, TILE, 0.26, TILE, wetEarth, 0, 1.96, 0);
    this.addBox(group, 2.75, 0.12, 2.75, riverBed, 0, 2.02, 0);

    const centerGeometry = new THREE.CircleGeometry(1.42, 28);
    centerGeometry.rotateX(-Math.PI / 2);
    const centerWater = new THREE.Mesh(centerGeometry, this.riverWaterMaterial);
    centerWater.position.y = 2.08;
    group.add(centerWater);

    const connectorLength = TILE / 2 + 0.44;
    const connectorWidth = 2.48;

    if (left) this.addRiverSurface(group, connectorLength, connectorWidth, -1.24, 0, Math.PI / 2);
    if (right) this.addRiverSurface(group, connectorLength, connectorWidth, 1.24, 0, Math.PI / 2);
    if (up) this.addRiverSurface(group, connectorWidth, connectorLength, 0, -1.24);
    if (down) this.addRiverSurface(group, connectorWidth, connectorLength, 0, 1.24);

    if (!left && !right && !up && !down) {
      this.addRiverSurface(group, 2.5, TILE + 0.08, 0, 0);
    }

    const addBank = (
      width: number,
      depth: number,
      x: number,
      z: number,
      foamWidth: number,
      foamDepth: number,
      foamX: number,
      foamZ: number,
    ): void => {
      this.addBox(group, width, 0.48, depth, bank, x, 2.18, z);
      this.addBox(group, width * 0.92, 0.08, depth * 0.92, grass, x, 2.46, z);

      const foamGeometry = new THREE.PlaneGeometry(foamWidth, foamDepth);
      foamGeometry.rotateX(-Math.PI / 2);
      const foamMesh = new THREE.Mesh(foamGeometry, foam);
      foamMesh.position.set(foamX, 2.095, foamZ);
      group.add(foamMesh);
    };

    if (!left) addBank(0.62, TILE, -1.69, 0, 0.16, 3.2, -1.36, 0);
    if (!right) addBank(0.62, TILE, 1.69, 0, 0.16, 3.2, 1.36, 0);
    if (!up) addBank(TILE, 0.62, 0, -1.69, 3.2, 0.16, 0, -1.36);
    if (!down) addBank(TILE, 0.62, 0, 1.69, 3.2, 0.16, 0, 1.36);

    const stoneMaterial = new THREE.MeshStandardMaterial({ color: 0x8d887e, roughness: 1 });
    const pebbleCount = 1 + ((gx * 7 + gy * 11) % 3);
    for (let i = 0; i < pebbleCount; i += 1) {
      const pebble = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.12 + ((gx + gy + i) % 3) * 0.05, 0),
        stoneMaterial,
      );
      const side = (gx + gy + i) % 2 === 0 ? -1 : 1;
      pebble.position.set(side * (1.36 + i * 0.08), 2.31, -0.9 + i * 0.78);
      pebble.scale.y = 0.55;
      pebble.castShadow = true;
      group.add(pebble);
    }
  }

  private renderElevationPatch(group: THREE.Group, elevation: number): void {
    const side = new THREE.MeshStandardMaterial({ color: 0x78644b, roughness: 1 });
    const grass = new THREE.MeshStandardMaterial({ color: 0xa9c864, roughness: 0.94 });
    const earth = new THREE.MeshStandardMaterial({ color: 0x51453a, roughness: 1 });

    if (elevation > 0.03) {
      this.addBox(group, TILE * 0.98, elevation, TILE * 0.98, side, 0, 2.2 + elevation / 2, 0);
      this.addBox(group, TILE * 0.98, 0.12, TILE * 0.98, grass, 0, 2.2 + elevation + 0.05, 0);
      return;
    }

    if (elevation < -0.03) {
      const depth = Math.min(1.55, Math.abs(elevation));
      this.addBox(group, TILE * 0.94, 0.08, TILE * 0.94, earth, 0, 2.215, 0);
      this.addBox(group, TILE * 0.98, 0.16 + depth * 0.12, 0.22, side, 0, 2.25, -TILE * 0.43);
      this.addBox(group, TILE * 0.98, 0.16 + depth * 0.12, 0.22, side, 0, 2.25, TILE * 0.43);
      this.addBox(group, 0.22, 0.16 + depth * 0.12, TILE * 0.78, side, -TILE * 0.43, 2.25, 0);
      this.addBox(group, 0.22, 0.16 + depth * 0.12, TILE * 0.78, side, TILE * 0.43, 2.25, 0);
    }
  }

  private addNaturalMountain(group: THREE.Group, gx: number, gy: number): void {
    const variation = 0.9 + ((gx * 5 + gy * 3) % 4) * 0.09;
    const rockA = new THREE.MeshStandardMaterial({ color: 0x80746b, roughness: 1, flatShading: true });
    const rockB = new THREE.MeshStandardMaterial({ color: 0x9b8c7e, roughness: 1, flatShading: true });
    const snow = new THREE.MeshStandardMaterial({ color: 0xdad4cd, roughness: 1, flatShading: true });

    const main = new THREE.Mesh(new THREE.ConeGeometry(1.7 * variation, 5.2 * variation, 7), rockA);
    main.position.set(-0.25, 4.75, 0.15);
    main.rotation.y = 0.35;
    main.castShadow = true;
    main.receiveShadow = true;
    group.add(main);

    const ridge = new THREE.Mesh(new THREE.ConeGeometry(1.05 * variation, 3.6 * variation, 6), rockB);
    ridge.position.set(1.05, 3.85, 0.65);
    ridge.rotation.y = -0.28;
    ridge.castShadow = true;
    group.add(ridge);

    const shoulder = new THREE.Mesh(new THREE.DodecahedronGeometry(0.78 * variation, 0), rockB);
    shoulder.position.set(-1.15, 2.8, -0.65);
    shoulder.scale.y = 0.72;
    shoulder.castShadow = true;
    group.add(shoulder);

    if ((gx + gy) % 2 === 0) {
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.55 * variation, 1.25 * variation, 7), snow);
      cap.position.set(-0.25, 6.75, 0.15);
      cap.castShadow = true;
      group.add(cap);
    }
  }

  private makeBuilding(cell: ReturnType<GameState['entries']>[number], floodedMoats: Set<string>): THREE.Group {
    const group = new THREE.Group();
    const position = this.gridToWorld(cell.x, cell.y);
    group.position.set(position.x, this.terrainElevation(cell.x, cell.y), position.z);

    if (cell.kind === 'road') this.makeRoad(group, cell.x, cell.y);
    else if (WALL_KINDS.includes(cell.kind as WallKind)) {
      this.makeWall(group, cell.kind as WallKind, cell.x, cell.y, cell);
    } else if (cell.kind === 'gate') this.makeGate(group, cell.x, cell.y);
    else if (cell.kind === 'tower') this.makeTower(group, cell.x, cell.y, cell);
    else if (cell.kind === 'farm') this.makeFarm(group);
    else if (cell.kind === 'mine') this.makeMine(group);
    else if (cell.kind === 'mountain') this.makeMountain(group, cell.level ?? 1);
    else if (cell.kind === 'tree') this.makeTree(group, cell.level ?? 1);
    else if (cell.kind === 'rock') this.makeRock(group, cell.level ?? 1);
    else if (cell.kind === 'hut') this.makeHut(group);
    else if (cell.kind === 'moat') this.makeMoat(group, floodedMoats.has(this.key(cell.x, cell.y)));
    else if (['stoneStairs', 'woodenStairs', 'ramp', 'ladder'].includes(cell.kind)) {
      this.makeAccess(group, cell.kind as AccessKind, cell.x, cell.y, cell);
    } else {
      this.makeHouse(group, cell.kind as 'cottage' | 'house' | 'manor' | 'villa');
    }

    if (!this.isWallFamily(cell.kind) && cell.kind !== 'road' && cell.kind !== 'moat') {
      group.rotation.y = (cell.rotation ?? 0) * Math.PI / 2;
    }

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
    return this.state.getCell(x, y)?.kind;
  }

  private isWallFamily(kind: TileKind | undefined): boolean {
    return kind === 'wall1' || kind === 'wall2' || kind === 'wall3' || kind === 'gate' || kind === 'tower';
  }

  private isRoadFamily(kind: TileKind | undefined): boolean {
    return kind === 'road' || kind === 'gate';
  }

  private makeRoad(group: THREE.Group, gx: number, gy: number): THREE.Group {
    const road = new THREE.MeshStandardMaterial({ color: 0x8b6d55, roughness: 0.95 });
    const edge = new THREE.MeshStandardMaterial({ color: 0x70523f, roughness: 1 });

    const left = this.isRoadFamily(this.kindAt(gx - 1, gy));
    const right = this.isRoadFamily(this.kindAt(gx + 1, gy));
    const up = this.isRoadFamily(this.kindAt(gx, gy - 1));
    const down = this.isRoadFamily(this.kindAt(gx, gy + 1));

    this.addBox(group, 1.72, 0.16, 1.72, road, 0, 2.25, 0);

    if (left) this.addBox(group, TILE / 2 + 0.1, 0.16, 1.72, road, -TILE / 4 - 0.45, 2.25, 0);
    if (right) this.addBox(group, TILE / 2 + 0.1, 0.16, 1.72, road, TILE / 4 + 0.45, 2.25, 0);
    if (up) this.addBox(group, 1.72, 0.16, TILE / 2 + 0.1, road, 0, 2.25, -TILE / 4 - 0.45);
    if (down) this.addBox(group, 1.72, 0.16, TILE / 2 + 0.1, road, 0, 2.25, TILE / 4 + 0.45);

    if (!left && !right && !up && !down) {
      this.addBox(group, 3.35, 0.16, 1.72, road, 0, 2.25, 0);
    }

    this.addBox(group, 1.82, 0.05, 1.82, edge, 0, 2.16, 0);
    return group;
  }

  private wallThicknessValue(kind: WallKind, thickness: WallThickness): number {
    const base = kind === 'wall1' ? 1.45 : kind === 'wall2' ? 1.5 : 1.72;
    const multiplier = thickness === 'thin' ? 0.74 : thickness === 'thick' ? 1.34 : 1;
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

    const config = {
      wall1: {
        color: 0xcdbb9f,
        dark: 0x8d7a62,
        accent: 0xe2d3bc,
        baseHeight: 3.45,
        walkway: 0xa98f72,
      },
      wall2: {
        color: 0x8b5e3b,
        dark: 0x4f3423,
        accent: 0xb77c4d,
        baseHeight: 3.7,
        walkway: 0x68462e,
      },
      wall3: {
        color: 0xa7b0b8,
        dark: 0x5c6670,
        accent: 0xc7d0d6,
        baseHeight: 4.3,
        walkway: 0x58636f,
      },
    }[kind];

    const height = config.baseHeight + Math.max(0, level - 1) * 1.8;
    const topY = 2.22 + height;
    const wallMaterial = new THREE.MeshStandardMaterial({ color: config.color, roughness: 0.88 });
    const darkMaterial = new THREE.MeshStandardMaterial({ color: config.dark, roughness: 0.97 });
    const accentMaterial = new THREE.MeshStandardMaterial({ color: config.accent, roughness: 0.86 });
    const walkwayMaterial = new THREE.MeshStandardMaterial({ color: config.walkway, roughness: 0.92 });
    const metalMaterial = new THREE.MeshStandardMaterial({
      color: 0x535e67,
      metalness: 0.3,
      roughness: 0.58,
    });
    const slitMaterial = new THREE.MeshStandardMaterial({ color: 0x292621, roughness: 1 });

    let junctionThickness = thickness;
    for (const direction of links) {
      const vector = WallSystem.vector(direction);
      const neighbor = this.state.getCell(gx + vector.x, gy + vector.y);
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

    this.addBox(
      group,
      junctionThickness * 1.12,
      height,
      junctionThickness * 1.12,
      wallMaterial,
      0,
      2.22 + height / 2,
      0,
    );
    this.addBox(
      group,
      junctionThickness * 1.38,
      0.5,
      junctionThickness * 1.38,
      darkMaterial,
      0,
      2.47,
      0,
    );

    if (links.length === 0) {
      this.addDirectionalWallArm(
        group,
        'E',
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
        true,
      );
      this.addDirectionalWallArm(
        group,
        'W',
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
        true,
      );
    } else {
      for (const direction of links) {
        const vector = WallSystem.vector(direction);
        const neighbor = this.state.getCell(gx + vector.x, gy + vector.y);
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

    const corner = this.wallCornerSystem.analyze(cell, links, gx, gy);
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
        junctionThickness + 0.72,
        0.22,
        junctionThickness + 0.72,
        walkwayMaterial,
        0,
        topY - 0.25,
        0,
      );
    }

    const visibleFloorLines = Math.min(Math.max(0, level - 1), 14);
    for (let floor = 1; floor <= visibleFloorLines; floor += 1) {
      this.addBox(
        group,
        junctionThickness * 1.18,
        0.13,
        junctionThickness * 1.18,
        darkMaterial,
        0,
        2.22 + config.baseHeight + floor * 1.8 - 0.9,
        0,
      );
    }

    if (kind === 'wall3') {
      this.addBox(group, junctionThickness + 0.42, 0.34, junctionThickness + 0.42, metalMaterial, 0, 3.15, 0);
      for (const offset of [-junctionThickness * 0.53, junctionThickness * 0.53]) {
        this.addBox(group, 0.2, height * 0.72, junctionThickness + 0.5, metalMaterial, offset, 2.22 + height / 2, 0);
      }
    }

    const shouldFlag = links.some((direction) =>
      this.detailGenerator.wallPlan(
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
      this.addAutomaticFlag(group, topY + 0.2, gx, gy, accentMaterial);
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
    const run = (TILE * diagonalScale) / 2 + 0.18;
    const rise = elevationDelta / 2;
    const slope = Math.atan2(rise, run);
    const arm = new THREE.Group();
    arm.rotation.y = WallSystem.worldAngle(direction);
    group.add(arm);

    const length = Math.sqrt(run * run + rise * rise);
    const body = this.addBox(
      arm,
      thickness,
      height,
      length,
      wallMaterial,
      0,
      2.22 + height / 2 + rise / 2,
      run / 2,
    );
    body.rotation.x = -slope;

    const foundation = this.addBox(
      arm,
      thickness * 1.24,
      0.52,
      length + 0.08,
      darkMaterial,
      0,
      2.48 + rise / 2,
      run / 2,
    );
    foundation.rotation.x = -slope;

    if (walkway) {
      const walk = this.addBox(
        arm,
        Math.max(0.72, thickness - 0.24),
        0.22,
        length,
        walkwayMaterial,
        0,
        2.22 + height - 0.25 + rise / 2,
        run / 2,
      );
      walk.rotation.x = -slope;
    }

    if (battlement) {
      const sideOffset = Math.max(0.34, thickness / 2 - 0.05);
      for (const side of [-1, 1]) {
        const beam = this.addBox(
          arm,
          0.22,
          0.34,
          length,
          wallMaterial,
          side * sideOffset,
          2.22 + height + 0.1 + rise / 2,
          run / 2,
        );
        beam.rotation.x = -slope;

        const count = Math.max(2, Math.floor(run / 0.7));
        for (let i = 0; i < count; i += 1) {
          const t = count === 1 ? 0.5 : i / (count - 1);
          const merlon = this.addBox(
            arm,
            0.4,
            0.62,
            0.42,
            wallMaterial,
            side * sideOffset,
            2.22 + height + 0.48 + rise * t,
            0.12 + t * (run - 0.18),
          );
          merlon.rotation.x = -slope;
        }
      }
    }

    const detailPlan = this.detailGenerator.wallPlan(
      gx,
      gy,
      level,
      kind,
      direction,
      run,
      importantConnection,
    );

    const slitY = 2.22 + Math.min(height * 0.56, 2.25 + Math.max(0, level - 1) * 0.22);
    for (const offset of detailPlan.slitOffsets) {
      const z = run / 2 + offset;
      for (const side of [-1, 1]) {
        this.addBox(
          arm,
          0.08,
          0.64,
          0.15,
          slitMaterial,
          side * (thickness / 2 + 0.045),
          slitY + rise * (z / Math.max(run, 0.01)),
          z,
        );
      }
    }

    const buttressCount = kind === 'wall3' ? 2 : importantConnection ? 1 : 0;
    for (let i = 0; i < buttressCount; i += 1) {
      const z = run * (0.4 + i * 0.28);
      for (const side of [-1, 1]) {
        this.addBox(
          arm,
          0.34,
          Math.min(2.3, height * 0.55),
          0.48,
          accentMaterial,
          side * (thickness / 2 + 0.16),
          3.25 + rise * (z / Math.max(run, 0.01)),
          z,
        );
      }
    }
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
    const radius = thickness * 0.88;

    if (kind === 'rounded' || kind === 'turret') {
      const extra = kind === 'turret' ? 1.25 : 0.25;
      const cylinder = new THREE.Mesh(
        new THREE.CylinderGeometry(radius, radius * 1.05, height + extra, 12),
        wallMaterial,
      );
      cylinder.position.y = 2.22 + (height + extra) / 2;
      cylinder.castShadow = true;
      cylinder.receiveShadow = true;
      group.add(cylinder);

      if (kind === 'turret' && battlement) {
        const count = 8;
        for (let i = 0; i < count; i += 1) {
          const angle = (i / count) * Math.PI * 2;
          this.addBox(
            group,
            0.36,
            0.62,
            0.36,
            wallMaterial,
            Math.cos(angle) * radius,
            topY + extra + 0.3,
            Math.sin(angle) * radius,
          );
        }
      }
    } else {
      const scale = kind === 'reinforced' ? 1.48 : kind === 'buttressed' ? 1.38 : 1.2;
      this.addBox(
        group,
        thickness * scale,
        height,
        thickness * scale,
        wallMaterial,
        0,
        2.22 + height / 2,
        0,
      );

      if (kind === 'reinforced' || kind === 'buttressed') {
        for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
          const support = new THREE.Group();
          support.rotation.y = angle;
          group.add(support);
          this.addBox(
            support,
            thickness * 0.46,
            Math.min(2.6, height * 0.58),
            0.58,
            kind === 'reinforced' ? darkMaterial : accentMaterial,
            0,
            3.35,
            thickness * 0.9,
          );
        }
      }
    }

    if (walkway) {
      const platform = new THREE.Mesh(
        new THREE.CylinderGeometry(radius * 1.04, radius * 1.04, 0.22, kind === 'rounded' || kind === 'turret' ? 12 : 4),
        walkwayMaterial,
      );
      platform.position.y = topY - 0.25;
      if (kind !== 'rounded' && kind !== 'turret') platform.rotation.y = Math.PI / 4;
      group.add(platform);
    }
  }

  private addAutomaticFlag(
    group: THREE.Group,
    topY: number,
    gx: number,
    gy: number,
    clothMaterial: THREE.Material,
  ): void {
    const mast = new THREE.MeshStandardMaterial({ color: 0x5d4633, roughness: 0.9 });
    this.addBox(group, 0.08, 2.2, 0.08, mast, 0, topY + 1.1, 0);
    const flag = this.addBox(group, 1.0, 0.46, 0.055, clothMaterial, 0.52, topY + 1.82, 0);
    flag.userData.castleFlag = { phase: (gx * 0.71 + gy * 0.37) % (Math.PI * 2) };
  }

  private makeGate(group: THREE.Group, gx: number, gy: number): THREE.Group {
    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0xe8d7c0, roughness: 0.78 });
    const woodMaterial = new THREE.MeshStandardMaterial({ color: 0x9a5c35, roughness: 0.88 });
    const darkWood = new THREE.MeshStandardMaterial({ color: 0x573722, roughness: 1 });

    const horizontalNeighbors =
      Number(this.isWallFamily(this.kindAt(gx - 1, gy))) +
      Number(this.isWallFamily(this.kindAt(gx + 1, gy)));
    const verticalNeighbors =
      Number(this.isWallFamily(this.kindAt(gx, gy - 1))) +
      Number(this.isWallFamily(this.kindAt(gx, gy + 1)));
    const vertical = verticalNeighbors > horizontalNeighbors;

    const core = new THREE.Group();
    this.addBox(core, 0.72, 4.35, 2.05, wallMaterial, -1.25, 4.4, 0);
    this.addBox(core, 0.72, 4.35, 2.05, wallMaterial, 1.25, 4.4, 0);
    this.addBox(core, 3.2, 0.72, 2.08, wallMaterial, 0, 6.25, 0);
    this.addBox(core, 1.7, 2.85, 0.28, woodMaterial, 0, 3.7, -1.08);
    this.addBox(core, 0.12, 2.7, 0.35, darkWood, -0.48, 3.7, -1.12);
    this.addBox(core, 0.12, 2.7, 0.35, darkWood, 0.48, 3.7, -1.12);
    this.addMerlons(core, 0, 6.92, 0, 'x', 3.25, wallMaterial);

    if (vertical) core.rotation.y = Math.PI / 2;
    group.add(core);

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
      this.addSlopedWallArm(group, spec.axis, spec.sign, elevationDelta, 3.7, 1.6, wallMaterial);
    }

    return group;
  }

  private makeTower(group: THREE.Group, gx: number, gy: number, cell: GridCell): THREE.Group {
    const level = cell.level ?? 1;
    const shape = cell.towerShape ?? 'round';
    const top = cell.towerTop ?? 'battlement';
    const height = (shape === 'watch' ? 4.5 : 5.3) + Math.max(0, level - 1) * 1.8;
    const topY = 2.22 + height;

    const stone = new THREE.MeshStandardMaterial({ color: 0xe4d4c1, roughness: 0.74 });
    const darkStone = new THREE.MeshStandardMaterial({ color: 0xa59688, roughness: 0.86 });
    const roofMaterial = new THREE.MeshStandardMaterial({ color: 0x8d5b69, roughness: 0.7 });
    const wood = new THREE.MeshStandardMaterial({ color: 0x76513c, roughness: 0.92 });
    const metal = new THREE.MeshStandardMaterial({ color: 0x69747d, metalness: 0.35, roughness: 0.55 });

    if (shape === 'square' || shape === 'corner') {
      this.addBox(group, shape === 'corner' ? 2.95 : 2.75, height, shape === 'corner' ? 2.95 : 2.75, stone, 0, 2.22 + height / 2, 0);

      if (shape === 'corner') {
        this.addBox(group, 0.65, height * 0.82, 3.45, darkStone, -1.55, 2.22 + height * 0.41, 0);
        this.addBox(group, 3.45, height * 0.82, 0.65, darkStone, 0, 2.22 + height * 0.41, 1.55);
      }
    } else {
      const segments = shape === 'octagonal' ? 8 : shape === 'watch' ? 10 : 16;
      const radius = shape === 'watch' ? 1.18 : 1.58;
      const body = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius + 0.16, height, segments), stone);
      body.position.y = 2.22 + height / 2;
      body.castShadow = true;
      body.receiveShadow = true;
      group.add(body);

      if (shape === 'watch') {
        this.addBox(group, 3.1, 0.28, 3.1, wood, 0, topY - 0.25, 0);
        for (const [x, z] of [[-1.25, -1.25], [1.25, -1.25], [-1.25, 1.25], [1.25, 1.25]] as Array<[number, number]>) {
          this.addBox(group, 0.13, 1.25, 0.13, wood, x, topY + 0.34, z);
        }
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
        Math.min(height, 4.2),
        stone,
      );
    }

    const openingMaterial = new THREE.MeshStandardMaterial({ color: 0x252321, roughness: 1 });
    const radius = shape === 'watch' ? 1.18 : shape === 'square' || shape === 'corner' ? 1.38 : 1.58;
    for (let floor = 0; floor < Math.max(1, level); floor += 1) {
      const y = 3.25 + floor * 1.7;
      if (y > topY - 0.7) break;

      this.addBox(group, 0.16, 0.68, 0.08, openingMaterial, 0, y, -radius - 0.03);
      this.addBox(group, 0.16, 0.68, 0.08, openingMaterial, 0, y, radius + 0.03);
      this.addBox(group, 0.08, 0.68, 0.16, openingMaterial, -radius - 0.03, y, 0);
      this.addBox(group, 0.08, 0.68, 0.16, openingMaterial, radius + 0.03, y, 0);
    }

    this.addTowerTop(group, shape, top, topY, stone, roofMaterial, wood, metal);

    const autoFlag =
      level >= 4 &&
      (shape === 'watch' || shape === 'corner' || Math.abs(gx * 31 + gy * 17 + level) % 5 === 0);
    if (autoFlag && top !== 'flag') {
      this.addBox(group, 0.08, 2.45, 0.08, wood, 0, topY + 1.25, 0);
      const flag = this.addBox(group, 1.05, 0.48, 0.055, roofMaterial, 0.56, topY + 2.02, 0);
      flag.userData.castleFlag = { phase: gx * 0.41 + gy * 0.29 + level };
    }

    return group;
  }

  private addTowerWallConnector(
    group: THREE.Group,
    direction: WallDirection,
    elevationDelta: number,
    height: number,
    material: THREE.Material,
  ): void {
    const vector = WallSystem.vector(direction);
    const run = (TILE * Math.hypot(vector.x, vector.y)) / 2 + 0.2;
    const rise = elevationDelta / 2;
    const length = Math.sqrt(run * run + rise * rise);
    const connector = new THREE.Group();
    connector.rotation.y = WallSystem.worldAngle(direction);
    group.add(connector);

    const body = this.addBox(
      connector,
      1.62,
      height,
      length,
      material,
      0,
      2.22 + height / 2 + rise / 2,
      run / 2,
    );
    body.rotation.x = -Math.atan2(rise, run);
  }

  private addTowerTop(
    group: THREE.Group,
    shape: TowerShape,
    top: TowerTop,
    topY: number,
    stone: THREE.Material,
    roof: THREE.Material,
    wood: THREE.Material,
    metal: THREE.Material,
  ): void {
    const squareLike = shape === 'square' || shape === 'corner';

    if (top === 'battlement') {
      const span = shape === 'watch' ? 3.2 : 3.45;
      this.addBox(group, span, 0.2, span, stone, 0, topY + 0.08, 0);

      for (const px of [-1.35, -0.45, 0.45, 1.35]) {
        this.addBox(group, 0.42, 0.62, 0.48, stone, px, topY + 0.45, -span / 2 + 0.22);
        this.addBox(group, 0.42, 0.62, 0.48, stone, px, topY + 0.45, span / 2 - 0.22);
      }

      for (const pz of [-0.9, 0, 0.9]) {
        this.addBox(group, 0.48, 0.62, 0.42, stone, -span / 2 + 0.22, topY + 0.45, pz);
        this.addBox(group, 0.48, 0.62, 0.42, stone, span / 2 - 0.22, topY + 0.45, pz);
      }
      return;
    }

    if (top === 'roof') {
      const segments = squareLike ? 4 : shape === 'octagonal' ? 8 : 12;
      const roofMesh = new THREE.Mesh(new THREE.ConeGeometry(shape === 'watch' ? 2.0 : 2.25, 2.2, segments), roof);
      roofMesh.position.y = topY + 1.08;
      if (squareLike) roofMesh.rotation.y = Math.PI / 4;
      roofMesh.castShadow = true;
      group.add(roofMesh);
      return;
    }

    const platformSize = shape === 'watch' ? 3.35 : 3.15;
    this.addBox(group, platformSize, 0.24, platformSize, top === 'watch' ? wood : stone, 0, topY + 0.08, 0);

    if (top === 'flag') {
      this.addBox(group, 0.1, 3.2, 0.1, metal, 0, topY + 1.72, 0);
      const flag = this.addBox(group, 1.35, 0.65, 0.08, roof, 0.72, topY + 2.65, 0);
      flag.position.x += 0.06;
      flag.userData.castleFlag = { phase: topY * 0.37 };
      return;
    }

    if (top === 'watch') {
      for (const [x, z] of [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]] as Array<[number, number]>) {
        this.addBox(group, 0.12, 1.55, 0.12, wood, x, topY + 0.82, z);
      }
      const canopy = new THREE.Mesh(new THREE.ConeGeometry(2.15, 1.3, 4), roof);
      canopy.rotation.y = Math.PI / 4;
      canopy.position.y = topY + 1.78;
      canopy.castShadow = true;
      group.add(canopy);
    }
  }

  private fortificationTopLocal(cell: GridCell): number {
    if (WALL_KINDS.includes(cell.kind as WallKind)) {
      const base = cell.kind === 'wall1' ? 3.45 : cell.kind === 'wall2' ? 3.7 : 4.3;
      return 2.22 + base + Math.max(0, (cell.level ?? 1) - 1) * 1.8;
    }

    if (cell.kind === 'tower') {
      const base = (cell.towerShape ?? 'round') === 'watch' ? 4.5 : 5.3;
      return 2.22 + base + Math.max(0, (cell.level ?? 1) - 1) * 1.8;
    }

    if (cell.kind === 'gate') return 6.95;
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
      const neighbor = this.state.getCell(gx + candidate.dx, gy + candidate.dy);
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
    const neighbor = this.state.getCell(gx + direction.dx, gy + direction.dy);

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

  private makeHouse(group: THREE.Group, kind: 'cottage' | 'house' | 'manor' | 'villa'): THREE.Group {
    const pathMaterial = new THREE.MeshStandardMaterial({ color: 0xa98d70, roughness: 1 });
    const fenceMaterial = new THREE.MeshStandardMaterial({ color: 0x7c583d, roughness: 1 });
    const grassPatch = new THREE.MeshStandardMaterial({ color: 0x93b75c, roughness: 0.96 });

    // A residential placement is now a small neighborhood instead of one oversized house.
    this.addBox(group, 3.5, 0.08, 0.5, pathMaterial, 0, 2.25, 0.12);
    this.addBox(group, 0.5, 0.08, 3.35, pathMaterial, -0.15, 2.25, 0);
    this.addBox(group, 3.65, 0.06, 3.65, grassPatch, 0, 2.2, 0);

    if (kind === 'cottage') {
      this.addMiniHouse(group, -0.92, -0.76, -0.08, 1.2, 1.02, 1.55, 0xd7a17c, 0x8b5a43, false);
      this.addMiniHouse(group, 0.86, -0.52, 0.12, 1.12, 0.96, 1.42, 0xd9b08a, 0x83533d, false);
      this.addMiniHouse(group, 0.55, 0.96, Math.PI, 1.05, 0.9, 1.34, 0xc99474, 0x78513d, false);
      this.addVillageWell(group, -0.82, 0.85);
    } else if (kind === 'house') {
      this.addMiniHouse(group, -0.96, -0.84, -0.05, 1.18, 1.02, 1.85, 0xc6aadf, 0x735d98, true);
      this.addMiniHouse(group, 0.9, -0.82, 0.06, 1.18, 1.02, 1.75, 0xb99bd6, 0x6a568f, true);
      this.addMiniHouse(group, -0.92, 0.92, Math.PI + 0.04, 1.12, 0.98, 1.68, 0xd0b7e4, 0x8067a4, false);
      this.addMiniHouse(group, 0.9, 0.88, Math.PI - 0.05, 1.08, 0.96, 1.6, 0xbca1d4, 0x684f8b, false);
    } else if (kind === 'manor') {
      this.addMiniHouse(group, 0, -0.42, 0, 1.78, 1.34, 2.45, 0xd77b8f, 0x8b4f5f, true);
      this.addMiniHouse(group, -1.15, 0.9, Math.PI, 1.0, 0.9, 1.42, 0xd9a0ab, 0x80515a, false);
      this.addMiniHouse(group, 1.12, 0.88, Math.PI, 1.0, 0.9, 1.5, 0xce8f9e, 0x754852, false);
      this.addVillageWell(group, 0, 1.12);

      for (const x of [-1.62, 1.62]) {
        this.addBox(group, 0.1, 0.72, 3.1, fenceMaterial, x, 2.57, 0);
      }
    } else {
      this.addMiniHouse(group, -0.95, -0.62, -0.08, 1.28, 1.08, 1.92, 0x79c1ba, 0x467e78, true);
      this.addMiniHouse(group, 0.92, -0.55, 0.1, 1.28, 1.08, 1.82, 0x6fb0ab, 0x3d716d, true);
      this.addMiniHouse(group, 0, 0.98, Math.PI, 1.5, 1.1, 2.05, 0x86c9c2, 0x4f8983, true);

      const garden = new THREE.Mesh(new THREE.CircleGeometry(0.65, 18), grassPatch);
      garden.rotation.x = -Math.PI / 2;
      garden.position.set(0, 2.255, 0.08);
      group.add(garden);
      this.addVillageWell(group, 0, 0.06);
    }

    // Fences and tiny service props make the tile read as a lived-in village block.
    for (const z of [-1.72, 1.72]) {
      this.addBox(group, 3.55, 0.08, 0.08, fenceMaterial, 0, 2.52, z);
      for (const x of [-1.65, -0.55, 0.55, 1.65]) {
        this.addBox(group, 0.09, 0.68, 0.09, fenceMaterial, x, 2.5, z);
      }
    }

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

    const wall = new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.78 });
    const roof = new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.82 });
    const wood = new THREE.MeshStandardMaterial({ color: 0x704b35, roughness: 0.96 });
    const stone = new THREE.MeshStandardMaterial({ color: 0xb5aa9f, roughness: 1 });
    const glass = new THREE.MeshStandardMaterial({
      color: 0x9feafa,
      emissive: 0x174c5a,
      emissiveIntensity: 0.42,
      roughness: 0.3,
    });

    this.addBox(house, width + 0.1, 0.18, depth + 0.1, stone, 0, 2.3, 0);
    this.addBox(house, width, height, depth, wall, 0, 2.32 + height / 2, 0);

    const roofMesh = new THREE.Mesh(new THREE.ConeGeometry(width * 0.74, 0.86 + height * 0.22, 4), roof);
    roofMesh.position.y = 2.32 + height + (0.86 + height * 0.22) / 2;
    roofMesh.rotation.y = Math.PI / 4;
    roofMesh.castShadow = true;
    house.add(roofMesh);

    this.addBox(house, width * 0.23, Math.min(0.9, height * 0.52), 0.08, wood, 0, 2.72, -depth / 2 - 0.05);

    const windowY = 2.75 + height * 0.33;
    for (const sx of [-width * 0.28, width * 0.28]) {
      this.addBox(house, width * 0.18, 0.34, 0.06, glass, sx, windowY, -depth / 2 - 0.04);
      this.addBox(house, width * 0.21, 0.05, 0.08, wood, sx, windowY - 0.2, -depth / 2 - 0.07);
    }

    const chimney = this.addBox(
      house,
      0.18,
      0.72,
      0.18,
      stone,
      width * 0.28,
      2.32 + height + 0.48,
      depth * 0.12,
    );
    chimney.castShadow = true;

    if (detailed) {
      this.addBox(house, width * 0.78, 0.1, 0.36, wood, 0, 2.34, -depth / 2 - 0.2);

      for (const side of [-1, 1]) {
        const flower = new THREE.Mesh(
          new THREE.SphereGeometry(0.11, 7, 5),
          new THREE.MeshStandardMaterial({
            color: side === -1 ? 0xe9ad68 : 0xd783a1,
            roughness: 0.9,
          }),
        );
        flower.position.set(side * width * 0.34, 2.55, -depth / 2 - 0.16);
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
    const soil = new THREE.MeshStandardMaterial({ color: 0x8b6847, roughness: 1 });
    const cropA = new THREE.MeshStandardMaterial({ color: 0xc7c85c, roughness: 0.9 });
    const cropB = new THREE.MeshStandardMaterial({ color: 0x76a95a, roughness: 0.9 });
    const wood = new THREE.MeshStandardMaterial({ color: 0x8d6b4d, roughness: 1 });

    this.addBox(group, 3.55, 0.16, 3.55, soil, 0, 2.24, 0);

    for (let i = -2; i <= 2; i += 1) {
      this.addBox(group, 0.26, 0.32, 2.95, i % 2 === 0 ? cropA : cropB, i * 0.6, 2.46, 0);
    }

    for (const x of [-1.76, 1.76]) {
      this.addBox(group, 0.12, 0.75, 3.58, wood, x, 2.58, 0);
    }

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

  private makeMountain(group: THREE.Group, level: number): THREE.Group {
    const safeLevel = Math.max(1, level);
    const growth = Math.min(safeLevel, 12) * 1.12 + Math.max(0, safeLevel - 12) * 0.28;
    const mainHeight = 3.4 + growth;
    const radius = 1.25 + Math.min(safeLevel, 10) * 0.12;

    const rockA = new THREE.MeshStandardMaterial({ color: 0x756b64, roughness: 1, flatShading: true });
    const rockB = new THREE.MeshStandardMaterial({ color: 0x918379, roughness: 1, flatShading: true });
    const rockC = new THREE.MeshStandardMaterial({ color: 0x625b57, roughness: 1, flatShading: true });
    const snow = new THREE.MeshStandardMaterial({ color: 0xe3ddd6, roughness: 1, flatShading: true });

    const main = new THREE.Mesh(new THREE.ConeGeometry(radius, mainHeight, 7), rockA);
    main.position.set(-0.25, 2.2 + mainHeight / 2, 0.15);
    main.rotation.y = 0.26;
    main.castShadow = true;
    main.receiveShadow = true;
    group.add(main);

    const ridge = new THREE.Mesh(new THREE.ConeGeometry(radius * 0.68, mainHeight * 0.68, 6), rockB);
    ridge.position.set(radius * 0.82, 2.2 + mainHeight * 0.34, 0.55);
    ridge.rotation.y = -0.33;
    ridge.castShadow = true;
    group.add(ridge);

    const rear = new THREE.Mesh(new THREE.ConeGeometry(radius * 0.55, mainHeight * 0.55, 7), rockC);
    rear.position.set(-radius * 0.72, 2.2 + mainHeight * 0.28, 0.72);
    rear.rotation.y = 0.61;
    rear.castShadow = true;
    group.add(rear);

    if (safeLevel >= 3) {
      const cap = new THREE.Mesh(new THREE.ConeGeometry(radius * 0.36, mainHeight * 0.22, 7), snow);
      cap.position.set(-0.25, 2.2 + mainHeight * 0.89, 0.15);
      cap.castShadow = true;
      group.add(cap);
    }

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

    for (const cell of this.state.entries()) {
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
      cells: this.state.entries().map((cell) => ({
        ...cell,
        wallLinks: cell.wallLinks ? [...cell.wallLinks] : undefined,
      })),
      keeps: this.keepSystem.entries(),
      terrain: Array.from(this.terrainOverrides.entries()),
      elevations: Array.from(this.elevationOverrides.entries()),
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
    this.state.replace(snapshot.cells);
    this.keepSystem.replace(snapshot.keeps ?? []);
    this.terrainOverrides.clear();
    this.elevationOverrides.clear();

    for (const [key, value] of snapshot.terrain) this.terrainOverrides.set(key, value);
    for (const [key, value] of snapshot.elevations) this.elevationOverrides.set(key, value);

    this.selectedCell = null;
    this.selectedKeepId = null;
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
    if (!this.isTerrainTool(tool)) return;

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
      const keep = this.keepSystem.get(this.selectedKeepId);
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
      const updated = this.keepSystem.update(keep.id, { x: draft.x, y: draft.y });
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

    const source = this.state.getCell(this.selectedCell.x, this.selectedCell.y);
    if (!source) {
      this.setStatus('Selected tile has no structure');
      return;
    }

    const nx = this.selectedCell.x + dx;
    const ny = this.selectedCell.y + dy;
    if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE || this.state.getCell(nx, ny)) {
      this.setStatus('Cannot move there');
      return;
    }

    const destinationTerrain = this.terrainAt(nx, ny);
    if (destinationTerrain === 'water' || destinationTerrain === 'river') {
      this.setStatus('Cannot move onto water');
      return;
    }

    this.recordHistory();

    const { kind, level, ...options } = source;
    this.state.removeCell(this.selectedCell.x, this.selectedCell.y);
    this.state.setCell(nx, ny, kind, level ?? 1, options);
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

    const cell = this.state.getCell(this.selectedCell.x, this.selectedCell.y);
    if (!cell) {
      this.setStatus('Selected tile has no structure');
      return;
    }

    this.recordHistory();
    this.state.updateCell(this.selectedCell.x, this.selectedCell.y, {
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

        if (this.isWallTool(this.selectedTool)) {
          const cell = this.pickGridCell(event);
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

        if (this.isTerrainTool(this.selectedTool)) {
          const cell = this.pickGridCell(event);
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

        if (this.wallDragStart) {
          const end = this.pickGridCell(event) ?? this.wallDragEnd ?? this.wallDragStart;
          const start = this.wallDragStart;

          this.wallDragStart = null;
          this.wallDragEnd = null;
          this.controls.enabled = true;

          if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
          this.buildWallDrag(start, end, event.shiftKey);

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
      const currentCell = this.state.getCell(current.x, current.y);
      const nextCell = this.state.getCell(next.x, next.y);

      if (currentCell && this.isWallFamily(currentCell.kind)) {
        this.state.updateCell(current.x, current.y, {
          wallLinks: WallSystem.addLink(currentCell, direction),
        });
      }

      if (nextCell && this.isWallFamily(nextCell.kind)) {
        this.state.updateCell(next.x, next.y, {
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
      const cell = this.state.getCell(point.x, point.y);

      if (single && cell?.kind === wallKind) {
        const nextLevel = decrease
          ? Math.max(1, (cell.level ?? 1) - 1)
          : (cell.level ?? 1) + 1;

        this.state.updateCell(point.x, point.y, {
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

      this.state.setCell(point.x, point.y, wallKind, cell?.level ?? 1, {
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

    const cell = this.state.getCell(gx, gy);
    const current = cell?.kind;
    const terrain = this.terrainAt(gx, gy);
    const overrideKey = this.key(gx, gy);
    const keepAtPoint = this.keepSystem.findAtCell(gx, gy);

    if (this.selectedTool === 'erase') {
      if (keepAtPoint) {
        this.recordHistory();
        this.keepSystem.remove(keepAtPoint.id);
        if (this.selectedKeepId === keepAtPoint.id) this.selectedKeepId = null;
        this.finishBuild();
        this.setStatus('Keep removed');
        return;
      }
      if (current) {
        this.recordHistory();
        this.state.removeCell(gx, gy);
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

    if (keepAtPoint) {
      this.selectKeep(keepAtPoint);
      return;
    }

    this.selectedKeepId = null;

    if (this.selectedTool === 'river' || this.selectedTool === 'land') {
      if (current || this.moatTasks.has(overrideKey)) return;
      this.recordHistory();
      this.terrainOverrides.set(overrideKey, this.selectedTool === 'river' ? 'river' : 'plains');
      this.finishBuild();
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
        this.state.setLevel(gx, gy, (cell?.level ?? 1) + 1);
        this.finishBuild();
        return;
      }

      if (!current && (terrain === 'plains' || terrain === 'shore')) {
        this.recordHistory();
        this.state.setCell(gx, gy, 'mountain', 1);
        this.finishBuild();
      }
      return;
    }

    if (this.selectedTool === 'mine') {
      if (current === 'mountain') {
        this.recordHistory();
        this.state.setCell(gx, gy, 'mine', 1);
        this.finishBuild();
        return;
      }

      if (!current && terrain === 'mountain') {
        this.recordHistory();
        this.state.setCell(gx, gy, 'mine', 1);
        this.finishBuild();
      }
      return;
    }

    if (this.selectedTool === 'tree') {
      if (!current && (terrain === 'plains' || terrain === 'shore' || terrain === 'forest')) {
        this.recordHistory();
        this.state.setCell(gx, gy, 'tree', 1 + ((gx + gy) % 3));
        this.finishBuild();
      }
      return;
    }

    if (this.selectedTool === 'tower') {
      if (current === 'tower') {
        const nextLevel = event.shiftKey
          ? Math.max(1, (cell?.level ?? 1) - 1)
          : (cell?.level ?? 1) + 1;

        this.recordHistory();
        this.state.updateCell(gx, gy, {
          level: nextLevel,
          towerShape: this.towerShape,
          towerTop: this.towerTop,
        });
        this.finishBuild();
        return;
      }

      if (current && !this.isWallFamily(current)) return;
      if (!current && !this.canBuildFortificationOnTerrain(terrain)) return;

      this.recordHistory();
      this.state.setCell(gx, gy, 'tower', cell?.level ?? 1, {
        towerShape: this.towerShape,
        towerTop: this.towerTop,
      });
      this.finishBuild();
      return;
    }

    const selectedTile = this.selectedTool as TileKind;
    const selectedFortification = selectedTile === 'gate';
    const currentFortification = current ? this.isWallFamily(current) : false;

    if (current) {
      if (selectedFortification && currentFortification) {
        this.recordHistory();
        this.state.setCell(gx, gy, selectedTile, cell?.level ?? 1);
        this.finishBuild();
      }
      return;
    }

    if (!this.canBuildOnTerrain(this.selectedTool, terrain)) return;
    this.recordHistory();
    this.state.setCell(gx, gy, selectedTile, 1);
    this.finishBuild();
  }

  private canBuildOnTerrain(tool: ToolKind, terrain: TerrainKind): boolean {
    if (tool === 'gate' || tool === 'tower') return this.canBuildFortificationOnTerrain(terrain);
    if (terrain === 'water' || terrain === 'river') return false;
    if (terrain === 'mountain') return tool === 'mine';
    if (terrain === 'forest') return tool === 'tree';
    if (tool === 'farm') return terrain === 'plains';
    return terrain === 'plains' || terrain === 'shore';
  }

  private finishBuild(): void {
    this.redraw();
    this.scheduleSave();
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
        this.state.setCell(task.x, task.y, 'moat', 1);
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
    const terrain = Array.from(this.terrainOverrides.entries()).map(([key, kind]) => {
      const [x, y] = key.split(',').map(Number);
      return { x, y, kind };
    });

    const elevations = Array.from(this.elevationOverrides.entries()).map(([key, value]) => {
      const [x, y] = key.split(',').map(Number);
      return { x, y, value };
    });

    const data: SavedGame = {
      version: SAVE_VERSION,
      updatedAt: Date.now(),
      cells: this.state.entries(),
      keeps: this.keepSystem.entries(),
      terrain,
      elevations,
      worldSeeded: this.worldSeeded,
    };

    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    if (updateStatus) this.setStatus('Saved');
  }

  private load(): void {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;

    try {
      const data = JSON.parse(raw) as {
        version?: number;
        cells?: Array<{
          x: number;
          y: number;
          kind: string;
          level?: number;
          thickness?: WallThickness;
          battlement?: boolean;
          walkway?: boolean;
          towerShape?: TowerShape;
          towerTop?: TowerTop;
          rotation?: number;
          wallLinks?: WallDirection[];
        }>;
        keeps?: KeepState[];
        terrain?: Array<{ x: number; y: number; kind: TerrainOverrideKind }>;
        elevations?: Array<{ x: number; y: number; value: number }>;
        worldSeeded?: boolean;
      };

      const cells: Array<ReturnType<GameState['entries']>[number]> = [];

      for (const cell of data.cells ?? []) {
        if (cell.x < 0 || cell.y < 0 || cell.x >= SIZE || cell.y >= SIZE) continue;

        const migration = this.migrateKind(cell.kind, cell.level ?? 1);
        if (!migration) continue;

        cells.push({
          x: cell.x,
          y: cell.y,
          kind: migration.kind,
          level: migration.level,
          thickness: cell.thickness,
          battlement: cell.battlement,
          walkway: cell.walkway,
          towerShape: cell.towerShape,
          towerTop: cell.towerTop,
          rotation: cell.rotation,
          wallLinks: cell.wallLinks,
        });
      }

      this.state.replace(cells);
      this.keepSystem.replace(data.keeps ?? []);
      this.terrainOverrides.clear();
      this.elevationOverrides.clear();

      for (const terrainCell of data.terrain ?? []) {
        if (terrainCell.x < 0 || terrainCell.y < 0 || terrainCell.x >= SIZE || terrainCell.y >= SIZE) continue;
        if (terrainCell.kind !== 'plains' && terrainCell.kind !== 'river') continue;
        this.terrainOverrides.set(this.key(terrainCell.x, terrainCell.y), terrainCell.kind);
      }

      for (const elevationCell of data.elevations ?? []) {
        if (elevationCell.x < 0 || elevationCell.y < 0 || elevationCell.x >= SIZE || elevationCell.y >= SIZE) continue;
        if (!Number.isFinite(elevationCell.value)) continue;
        this.elevationOverrides.set(
          this.key(elevationCell.x, elevationCell.y),
          THREE.MathUtils.clamp(elevationCell.value, -6, 6),
        );
      }

      this.worldSeeded = Boolean(data.worldSeeded);
      this.setStatus('Loaded');
    } catch {
      this.setStatus('Could not load save');
    }
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

    const toolHtml = TOOL_GROUPS.map((group) => {
      const buttons = group.tools
        .map(
          (tool) =>
            '<button class="tool-button' +
            (tool.id === 'wall1' ? ' is-selected' : '') +
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

      return '<div class="tool-section-label">' + group.label + '</div>' + buttons;
    }).join('');

    toolbar.innerHTML =
      '<div class="toolbar-title"><span>Build</span><small>Modular engineering</small></div>' +
      toolHtml +
      '<div class="builder-settings">' +
      '<div class="settings-title">Wall Settings</div>' +
      '<label class="settings-row"><span>Thickness</span><select id="wall-thickness">' +
      '<option value="thin">Thin</option><option value="medium" selected>Medium</option><option value="thick">Thick</option>' +
      '</select></label>' +
      '<label class="settings-check"><input id="wall-battlement" type="checkbox" checked /><span>Battlement</span></label>' +
      '<label class="settings-check"><input id="wall-walkway" type="checkbox" /><span>Top Walkway</span></label>' +
      '<div class="settings-actions"><button id="selected-down" type="button">− Height</button><button id="selected-up" type="button">+ Height</button></div>' +
      '<div class="settings-title">Tower Builder</div>' +
      '<label class="settings-row"><span>Base</span><select id="tower-shape">' +
      '<option value="square">Square Tower</option><option value="round" selected>Round Tower</option>' +
      '<option value="octagonal">Octagonal Tower</option><option value="corner">Corner Tower</option>' +
      '<option value="watch">Watch Tower</option></select></label>' +
      '<label class="settings-row"><span>Top</span><select id="tower-top">' +
      '<option value="battlement">Battlement</option><option value="roof">Roof</option>' +
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

    toolbar.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach((button) => {
      button.onclick = () => this.selectTool(button.dataset.tool as ToolKind);
    });

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
      this.applyTowerSettingsToSelected();
    };

    const towerTop = get<HTMLSelectElement>('tower-top');
    towerTop.onchange = () => {
      this.towerTop = towerTop.value as TowerTop;
      this.applyTowerSettingsToSelected();
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

    get<HTMLButtonElement>('help-button').onclick = () => {
      help.hidden = false;
    };
    get<HTMLButtonElement>('help-close-button').onclick = () => {
      help.hidden = true;
    };
    get<HTMLButtonElement>('templates-button').onclick = () => {
      templates.hidden = false;
    };
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
      if (confirm('Reset the entire island?')) {
        this.recordHistory();
        this.state.clear();
        this.keepSystem.clear();
        this.selectedKeepId = null;
        this.terrainOverrides.clear();
        this.elevationOverrides.clear();
        this.moatTasks.clear();
        this.worldSeeded = false;
        this.seedNaturalProps();
        this.worldSeeded = true;
        this.redraw();
        this.save();
      }
    };
    get<HTMLButtonElement>('fullscreen-button').onclick = async () => {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    };

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
        t: 'tree',
        n: 'mountain',
        m: 'mine',
        q: 'moat',
        r: 'river',
        l: 'land',
        p: 'keep',
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
      }
    });
  }

  private applyWallSettingsToSelected(): void {
    if (!this.selectedCell) return;
    const cell = this.state.getCell(this.selectedCell.x, this.selectedCell.y);
    if (!cell || !WALL_KINDS.includes(cell.kind as WallKind)) return;

    this.recordHistory();
    this.state.updateCell(this.selectedCell.x, this.selectedCell.y, {
      thickness: this.wallThickness,
      battlement: this.wallBattlement,
      walkway: this.wallWalkway,
    });
    this.redraw();
    this.scheduleSave();
  }

  private applyTowerSettingsToSelected(): void {
    if (!this.selectedCell) return;
    const cell = this.state.getCell(this.selectedCell.x, this.selectedCell.y);
    if (!cell || cell.kind !== 'tower') return;

    this.recordHistory();
    this.state.updateCell(this.selectedCell.x, this.selectedCell.y, {
      towerShape: this.towerShape,
      towerTop: this.towerTop,
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
    return this.keepSystem.validate(
      draft,
      SIZE,
      (x, y) => this.terrainAt(x, y),
      (x, y) => this.terrainElevation(x, y),
      (x, y) => Boolean(this.state.getCell(x, y)),
      ignoreKeepId,
    );
  }

  private applyKeepSettingsToSelected(): void {
    if (this.selectedKeepId === null) return;
    const keep = this.keepSystem.get(this.selectedKeepId);
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
    const updated = this.keepSystem.update(keep.id, draft);
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

    const keep = this.keepSystem.get(this.selectedKeepId);
    if (!keep) return;

    this.keepFloors = Math.max(1, keep.floors + delta);
    this.recordHistory();
    const updated = this.keepSystem.update(keep.id, { floors: this.keepFloors });
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

    const keep = this.keepSystem.get(this.selectedKeepId);
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
    const updated = this.keepSystem.update(keep.id, { rotation: nextRotation });
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
    this.keepSystem.remove(this.selectedKeepId);
    this.selectedKeepId = null;
    this.redraw();
    this.scheduleSave();
    this.setStatus('Keep removed');
  }

  private placeKeep(gx: number, gy: number): void {
    const existing = this.keepSystem.findAtCell(gx, gy);
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
    const keep = this.keepSystem.add(draft);
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

    const cell = this.state.getCell(this.selectedCell.x, this.selectedCell.y);
    if (!cell || (!WALL_KINDS.includes(cell.kind as WallKind) && cell.kind !== 'tower')) {
      this.setStatus('Selected tile is not a wall or tower');
      return;
    }

    this.recordHistory();
    this.state.setLevel(
      this.selectedCell.x,
      this.selectedCell.y,
      Math.max(1, (cell.level ?? 1) + delta),
    );
    this.redraw();
    this.scheduleSave();
    this.setStatus(`Height level: ${Math.max(1, (cell.level ?? 1) + delta)}`);
  }

  private applyTemplate(template: string): void {
    this.recordHistory();
    this.state.clear();
    this.keepSystem.clear();
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
      this.state.setCell(x, y, kind, level, options);
    };

    const placeKeepTemplate = (
      x: number,
      y: number,
      width: number,
      depth: number,
      floors: number,
      roof: KeepRoofStyle,
      cornerTowers: boolean,
    ): void => {
      const draft = {
        x,
        y,
        width,
        depth,
        floors,
        rotation: 0,
        cornerTowers,
        roof,
        battlements: true,
      };

      for (const footprintCell of this.keepSystem.footprint(draft)) {
        this.state.removeCell(footprintCell.x, footprintCell.y);
      }

      this.keepSystem.add(draft);
    };

    if (template !== 'empty-land') this.seedNaturalProps();

    if (template === 'empty-land') {
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
    }

    this.selectedCell = null;
    this.selectedKeepId = null;
    this.redraw();
    this.save();
    this.setStatus('Template loaded: ' + template);
  }

  private selectTool(tool: ToolKind): void {
    this.selectedTool = tool;
    document.querySelectorAll('[data-tool]').forEach((element) => {
      element.classList.toggle('is-selected', (element as HTMLElement).dataset.tool === tool);
    });
    this.setStatus('Selected: ' + tool);
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

    this.updateWorkers(deltaMs);
    this.riverTexture.offset.y -= deltaMs * 0.00028;
    this.riverTexture.offset.x += deltaMs * 0.000025;

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
