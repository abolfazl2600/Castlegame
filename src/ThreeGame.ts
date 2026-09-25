import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GameState } from './state/GameState';
import { SAVE_KEY, SAVE_VERSION, TILE_SIZE, WORLD_COLS } from './core/constants';
import type { SavedGame, TerrainKind, TerrainOverrideKind, TileKind, ToolKind, WallKind } from './core/types';

const SIZE = WORLD_COLS;
const TILE = TILE_SIZE;
const WORLD = SIZE * TILE;

const WALL_KINDS: WallKind[] = ['wall1', 'wall2', 'wall3'];
const BUILDING_KINDS: TileKind[] = [
  'wall1', 'wall2', 'wall3', 'gate', 'tower', 'road',
  'cottage', 'house', 'manor', 'villa', 'farm', 'mine',
  'mountain', 'tree', 'rock', 'hut', 'moat',
];

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

const TOOL_GROUPS: Array<{ label: string; tools: ToolDefinition[] }> = [
  {
    label: 'Fortifications',
    tools: [
      { id: 'wall1', icon: '🧱', label: 'Wall I', detail: 'Click again to add floors', shortcut: '1' },
      { id: 'wall2', icon: '🧱', label: 'Wall II', detail: 'Tall stone wall', shortcut: '2' },
      { id: 'wall3', icon: '🛡️', label: 'Wall III', detail: 'Reinforced wall', shortcut: '3' },
      { id: 'gate', icon: '🚪', label: 'Gate', detail: 'Connects into wall lines', shortcut: '4' },
      { id: 'tower', icon: '🏰', label: 'Tower', detail: 'Wall-linked defense tower', shortcut: '5' },
      { id: 'moat', icon: '💧', label: 'Moat', detail: 'Assign workers to dig', shortcut: 'Q' },
    ],
  },
  {
    label: 'Settlement',
    tools: [
      { id: 'road', icon: '🛣️', label: 'Road', detail: 'Auto-connects edge to edge', shortcut: '6' },
      { id: 'cottage', icon: '🏠', label: 'Cottage', detail: 'Detailed small home', shortcut: '7' },
      { id: 'house', icon: '🏡', label: 'House', detail: 'Family residence', shortcut: '8' },
      { id: 'manor', icon: '🏯', label: 'Manor', detail: 'Large noble home', shortcut: '9' },
      { id: 'villa', icon: '🏘️', label: 'Villa', detail: 'Wide premium house', shortcut: '0' },
      { id: 'farm', icon: '🌾', label: 'Farm', detail: 'Cultivated crop field', shortcut: 'F' },
    ],
  },
  {
    label: 'Nature & resources',
    tools: [
      { id: 'tree', icon: '🌲', label: 'Tree', detail: 'Plant a detailed tree', shortcut: 'T' },
      { id: 'mountain', icon: '⛰️', label: 'Mountain', detail: 'Repeated clicks grow it', shortcut: 'N' },
      { id: 'mine', icon: '⛏️', label: 'Mine', detail: 'Natural or built mountain', shortcut: 'M' },
      { id: 'river', icon: '🌊', label: 'River', detail: 'Carve a water channel', shortcut: 'R' },
      { id: 'land', icon: '🌱', label: 'Land', detail: 'Fill water into buildable land', shortcut: 'L' },
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
  private readonly terrainOverrides = new Map<string, TerrainOverrideKind>();
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly terrainLayer = new THREE.Group();
  private readonly buildLayer = new THREE.Group();
  private readonly workerLayer = new THREE.Group();
  private readonly groundHit = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD, WORLD),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  private readonly moatTasks = new Map<string, MoatTask>();
  private readonly workers: WorkerAgent[] = [];

  private selectedTool: ToolKind = 'wall1';
  private saveTimer: number | null = null;
  private worldSeeded = false;
  private lastFrameTime = 0;
  private pointerStart: { x: number; y: number } | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
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
    this.resize();

    window.addEventListener('resize', () => this.resize());
    this.renderer.domElement.addEventListener('pointerdown', (event) => {
      this.pointerStart = { x: event.clientX, y: event.clientY };
    });
    this.renderer.domElement.addEventListener('pointerup', (event) => this.onPointerUp(event));

    requestAnimationFrame((time) => this.animate(time));
  }

  private key(x: number, y: number): string {
    return String(x) + ',' + String(y);
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
    const override = this.terrainOverrides.get(this.key(x, y));
    return override ?? this.baseTerrainAt(x, y);
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
        for (const item of material) item.dispose();
      } else if (material) {
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
    for (const cell of this.state.entries()) {
      this.buildLayer.add(this.makeBuilding(cell.kind, cell.x, cell.y, cell.level ?? 1, floodedMoats));
    }

    for (const task of this.moatTasks.values()) {
      const pending = new THREE.Group();
      const position = this.gridToWorld(task.x, task.y);
      pending.position.set(position.x, 0, position.z);
      const markerMaterial = new THREE.MeshStandardMaterial({
        color: 0xe6bb74,
        transparent: true,
        opacity: 0.48,
        roughness: 1,
      });
      this.addBox(pending, 3.5, 0.12, 3.5, markerMaterial, 0, 2.22, 0);
      this.buildLayer.add(pending);
    }
  }

  private renderTerrain(): void {
    for (let y = 0; y < SIZE; y += 1) {
      for (let x = 0; x < SIZE; x += 1) {
        const terrain = this.terrainAt(x, y);
        const base = this.baseTerrainAt(x, y);
        const position = this.gridToWorld(x, y);
        const group = new THREE.Group();
        group.position.set(position.x, 0, position.z);

        if (terrain === 'river') {
          const bank = new THREE.MeshStandardMaterial({ color: 0x9a865d, roughness: 1 });
          const water = new THREE.MeshStandardMaterial({
            color: 0x2aa7c4,
            roughness: 0.2,
            metalness: 0.04,
            transparent: true,
            opacity: 0.9,
          });
          this.addBox(group, TILE, 0.18, TILE, bank, 0, 2.09, 0);
          this.addBox(group, TILE * 0.84, 0.1, TILE * 0.84, water, 0, 2.18, 0);
          this.terrainLayer.add(group);
          continue;
        }

        if (this.terrainOverrides.get(this.key(x, y)) === 'plains' && (base === 'water' || base === 'river')) {
          const soil = new THREE.MeshStandardMaterial({ color: 0x7e9f55, roughness: 1 });
          const grass = new THREE.MeshStandardMaterial({ color: 0xb3c968, roughness: 0.92 });
          this.addBox(group, TILE, 0.5, TILE, soil, 0, 1.87, 0);
          this.addBox(group, TILE, 0.14, TILE, grass, 0, 2.19, 0);
          this.terrainLayer.add(group);
          continue;
        }

        if (terrain === 'mountain' && this.state.getCell(x, y)?.kind !== 'mine') {
          this.addNaturalMountain(group, x, y);
          this.terrainLayer.add(group);
        }
      }
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

  private makeBuilding(
    kind: TileKind,
    gx: number,
    gy: number,
    level: number,
    floodedMoats: Set<string>,
  ): THREE.Group {
    const group = new THREE.Group();
    const position = this.gridToWorld(gx, gy);
    group.position.set(position.x, 0, position.z);

    if (kind === 'road') return this.makeRoad(group, gx, gy);
    if (WALL_KINDS.includes(kind as WallKind)) return this.makeWall(group, kind as WallKind, gx, gy, level);
    if (kind === 'gate') return this.makeGate(group, gx, gy);
    if (kind === 'tower') return this.makeTower(group, gx, gy);
    if (kind === 'farm') return this.makeFarm(group);
    if (kind === 'mine') return this.makeMine(group);
    if (kind === 'mountain') return this.makeMountain(group, level);
    if (kind === 'tree') return this.makeTree(group, level);
    if (kind === 'rock') return this.makeRock(group, level);
    if (kind === 'hut') return this.makeHut(group);
    if (kind === 'moat') return this.makeMoat(group, floodedMoats.has(this.key(gx, gy)));

    return this.makeHouse(group, kind as 'cottage' | 'house' | 'manor' | 'villa');
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

    if (left) this.addBox(group, TILE / 2, 0.16, 1.72, road, -TILE / 4 - 0.43, 2.25, 0);
    if (right) this.addBox(group, TILE / 2, 0.16, 1.72, road, TILE / 4 + 0.43, 2.25, 0);
    if (up) this.addBox(group, 1.72, 0.16, TILE / 2, road, 0, 2.25, -TILE / 4 - 0.43);
    if (down) this.addBox(group, 1.72, 0.16, TILE / 2, road, 0, 2.25, TILE / 4 + 0.43);

    if (!left && !right && !up && !down) {
      this.addBox(group, 3.35, 0.16, 1.72, road, 0, 2.25, 0);
    }

    this.addBox(group, 1.82, 0.05, 1.82, edge, 0, 2.16, 0);
    return group;
  }

  private makeWall(group: THREE.Group, kind: WallKind, gx: number, gy: number, level: number): THREE.Group {
    const config = {
      wall1: { color: 0xd8c1a5, dark: 0x9a8067, baseHeight: 3.45, thickness: 1.38 },
      wall2: { color: 0xe8d7c0, dark: 0xb09273, baseHeight: 4.0, thickness: 1.58 },
      wall3: { color: 0xaeb8c1, dark: 0x68737d, baseHeight: 4.45, thickness: 1.78 },
    }[kind];

    const extraFloors = Math.max(0, level - 1);
    const height = config.baseHeight + extraFloors * 1.8;
    const wallMaterial = new THREE.MeshStandardMaterial({ color: config.color, roughness: 0.8 });
    const darkMaterial = new THREE.MeshStandardMaterial({ color: config.dark, roughness: 0.9 });
    const topY = 2.22 + height;

    this.addBox(group, config.thickness, height, config.thickness, wallMaterial, 0, 2.22 + height / 2, 0);

    const neighborSpecs = [
      { dx: -1, dy: 0, axis: 'x' as const, sign: -1 },
      { dx: 1, dy: 0, axis: 'x' as const, sign: 1 },
      { dx: 0, dy: -1, axis: 'z' as const, sign: -1 },
      { dx: 0, dy: 1, axis: 'z' as const, sign: 1 },
    ];

    let connections = 0;
    for (const neighbor of neighborSpecs) {
      if (!this.isWallFamily(this.kindAt(gx + neighbor.dx, gy + neighbor.dy))) continue;
      connections += 1;
      const offset = neighbor.sign * TILE / 4;

      if (neighbor.axis === 'x') {
        this.addBox(group, TILE / 2 + 0.08, height, config.thickness, wallMaterial, offset, 2.22 + height / 2, 0);
        this.addMerlons(group, offset, topY + 0.28, 0, 'x', TILE / 2 + 0.08, wallMaterial);
      } else {
        this.addBox(group, config.thickness, height, TILE / 2 + 0.08, wallMaterial, 0, 2.22 + height / 2, offset);
        this.addMerlons(group, 0, topY + 0.28, offset, 'z', TILE / 2 + 0.08, wallMaterial);
      }
    }

    if (connections === 0) {
      this.addBox(group, TILE, height, config.thickness, wallMaterial, 0, 2.22 + height / 2, 0);
      this.addMerlons(group, 0, topY + 0.28, 0, 'x', TILE, wallMaterial);
    }

    this.addBox(group, config.thickness + 0.16, 0.3, config.thickness + 0.16, darkMaterial, 0, topY + 0.05, 0);

    const visibleFloorLines = Math.min(extraFloors, 8);
    for (let floor = 1; floor <= visibleFloorLines; floor += 1) {
      this.addBox(
        group,
        config.thickness + 0.24,
        0.16,
        config.thickness + 0.24,
        darkMaterial,
        0,
        2.22 + config.baseHeight + floor * 1.8 - 0.9,
        0,
      );
    }

    if (kind === 'wall3') {
      const braceMaterial = new THREE.MeshStandardMaterial({ color: 0x5d6871, metalness: 0.18, roughness: 0.58 });
      this.addBox(group, config.thickness + 0.3, 0.34, config.thickness + 0.3, braceMaterial, 0, 3.2, 0);
    }

    return group;
  }

  private addMerlons(
    group: THREE.Group,
    x: number,
    y: number,
    z: number,
    axis: 'x' | 'z',
    span: number,
    material: THREE.Material,
  ): void {
    const count = Math.max(2, Math.floor(span / 0.72));
    for (let i = 0; i < count; i += 1) {
      const t = count === 1 ? 0 : i / (count - 1) - 0.5;
      const offset = t * Math.max(0.5, span - 0.45);
      this.addBox(
        group,
        axis === 'x' ? 0.42 : 0.62,
        0.58,
        axis === 'x' ? 0.62 : 0.42,
        material,
        x + (axis === 'x' ? offset : 0),
        y,
        z + (axis === 'z' ? offset : 0),
      );
    }
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

    const specs = vertical
      ? [
          { dx: 0, dy: -1, x: 0, z: -TILE / 4, w: 1.6, d: TILE / 2 + 0.08 },
          { dx: 0, dy: 1, x: 0, z: TILE / 4, w: 1.6, d: TILE / 2 + 0.08 },
        ]
      : [
          { dx: -1, dy: 0, x: -TILE / 4, z: 0, w: TILE / 2 + 0.08, d: 1.6 },
          { dx: 1, dy: 0, x: TILE / 4, z: 0, w: TILE / 2 + 0.08, d: 1.6 },
        ];

    for (const spec of specs) {
      if (!this.isWallFamily(this.kindAt(gx + spec.dx, gy + spec.dy))) continue;
      this.addBox(group, spec.w, 3.7, spec.d, wallMaterial, spec.x, 4.05, spec.z);
    }

    return group;
  }

  private makeTower(group: THREE.Group, gx: number, gy: number): THREE.Group {
    const stone = new THREE.MeshStandardMaterial({ color: 0xe4d4c1, roughness: 0.74 });
    const roofMaterial = new THREE.MeshStandardMaterial({ color: 0x8d5b69, roughness: 0.7 });

    const body = new THREE.Mesh(new THREE.CylinderGeometry(1.58, 1.78, 5.25, 12), stone);
    body.position.y = 4.85;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.0, 2.1, 12), roofMaterial);
    roof.position.y = 8.45;
    roof.castShadow = true;
    group.add(roof);

    const specs = [
      { dx: -1, dy: 0, x: -TILE / 4, z: 0, w: TILE / 2 + 0.08, d: 1.55 },
      { dx: 1, dy: 0, x: TILE / 4, z: 0, w: TILE / 2 + 0.08, d: 1.55 },
      { dx: 0, dy: -1, x: 0, z: -TILE / 4, w: 1.55, d: TILE / 2 + 0.08 },
      { dx: 0, dy: 1, x: 0, z: TILE / 4, w: 1.55, d: TILE / 2 + 0.08 },
    ];

    for (const spec of specs) {
      if (!this.isWallFamily(this.kindAt(gx + spec.dx, gy + spec.dy))) continue;
      this.addBox(group, spec.w, 3.8, spec.d, stone, spec.x, 4.15, spec.z);
    }

    return group;
  }

  private makeHouse(group: THREE.Group, kind: 'cottage' | 'house' | 'manor' | 'villa'): THREE.Group {
    const config = {
      cottage: { width: 3.0, depth: 2.8, height: 3.25, roof: 2.05, color: 0xc98362, roofColor: 0x8d5e4f },
      house: { width: 3.1, depth: 2.9, height: 4.5, roof: 2.25, color: 0xb79bd8, roofColor: 0x745f9c },
      manor: { width: 3.25, depth: 3.0, height: 5.9, roof: 2.55, color: 0xd8758a, roofColor: 0x8f4e5e },
      villa: { width: 3.55, depth: 3.25, height: 4.1, roof: 1.8, color: 0x71b9b2, roofColor: 0x477f7b },
    }[kind];

    const wall = new THREE.MeshStandardMaterial({ color: config.color, roughness: 0.74 });
    const roofMaterial = new THREE.MeshStandardMaterial({ color: config.roofColor, roughness: 0.78 });
    const wood = new THREE.MeshStandardMaterial({ color: 0x76513c, roughness: 0.95 });
    const windowMaterial = new THREE.MeshStandardMaterial({
      color: 0x8de7ff,
      emissive: 0x155a68,
      emissiveIntensity: 0.55,
    });
    const stone = new THREE.MeshStandardMaterial({ color: 0xb9aea3, roughness: 1 });
    const green = new THREE.MeshStandardMaterial({ color: 0x6f9f55, roughness: 0.9 });

    this.addBox(group, config.width + 0.18, 0.28, config.depth + 0.18, stone, 0, 2.31, 0);
    this.addBox(group, config.width, config.height, config.depth, wall, 0, 2.2 + config.height / 2, 0);

    const roof = new THREE.Mesh(new THREE.ConeGeometry(config.width * 0.78, config.roof, 4), roofMaterial);
    roof.position.y = 2.2 + config.height + config.roof / 2;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    group.add(roof);

    const door = this.addBox(group, 0.66, 1.25, 0.12, wood, 0, 2.84, -config.depth / 2 - 0.07);
    door.castShadow = false;

    for (const sx of [-0.82, 0.82]) {
      const window = this.addBox(
        group,
        0.52,
        0.72,
        0.08,
        windowMaterial,
        sx,
        3.35 + config.height * 0.22,
        -config.depth / 2 - 0.05,
      );
      window.castShadow = false;
      this.addBox(group, 0.6, 0.08, 0.12, wood, sx, window.position.y - 0.42, -config.depth / 2 - 0.11);
    }

    const chimney = this.addBox(
      group,
      0.42,
      1.25,
      0.42,
      stone,
      config.width * 0.28,
      2.2 + config.height + config.roof * 0.62,
      0.2,
    );
    chimney.castShadow = true;

    const porch = this.addBox(group, 1.65, 0.16, 0.78, wood, 0, 2.27, -config.depth / 2 - 0.4);
    porch.castShadow = false;

    const planterLeft = this.addBox(group, 0.68, 0.24, 0.35, wood, -1.03, 2.36, -config.depth / 2 - 0.3);
    const planterRight = this.addBox(group, 0.68, 0.24, 0.35, wood, 1.03, 2.36, -config.depth / 2 - 0.3);
    planterLeft.castShadow = planterRight.castShadow = false;

    for (const px of [-1.03, 1.03]) {
      const shrub = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), green);
      shrub.position.set(px, 2.7, -config.depth / 2 - 0.3);
      shrub.scale.y = 0.7;
      shrub.castShadow = true;
      group.add(shrub);
    }

    if (kind === 'manor' || kind === 'villa') {
      const balcony = this.addBox(group, 1.8, 0.14, 0.65, stone, 0, 4.65, -config.depth / 2 - 0.35);
      balcony.castShadow = true;
      for (const px of [-0.75, -0.25, 0.25, 0.75]) {
        this.addBox(group, 0.08, 0.55, 0.08, wood, px, 4.98, -config.depth / 2 - 0.66);
      }
    }

    if (kind === 'villa') {
      this.addBox(group, 3.5, 0.12, 0.12, wood, 0, 2.72, 2.05);
      for (const px of [-1.65, -0.55, 0.55, 1.65]) {
        this.addBox(group, 0.1, 0.78, 0.1, wood, px, 2.55, 2.05);
      }
    }

    return group;
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

    const lower = new THREE.Mesh(new THREE.ConeGeometry(1.05, 2.05, 8), foliage);
    lower.position.y = 4.25;
    lower.castShadow = true;
    group.add(lower);

    const upper = new THREE.Mesh(new THREE.ConeGeometry(0.78, 1.65, 8), foliage);
    upper.position.y = 5.3;
    upper.castShadow = true;
    group.add(upper);

    const top = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.25, 8), foliage);
    top.position.y = 6.05;
    top.castShadow = true;
    group.add(top);

    return group;
  }

  private makeRock(group: THREE.Group, level: number): THREE.Group {
    const material = new THREE.MeshStandardMaterial({ color: level % 2 === 0 ? 0x7a766f : 0x8a8379, roughness: 1, flatShading: true });

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
    const moss = new THREE.MeshStandardMaterial({ color: 0x778b55, roughness: 1 });

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

    const boulderA = new THREE.Mesh(new THREE.DodecahedronGeometry(radius * 0.38, 0), rockB);
    boulderA.position.set(-radius * 0.95, 2.55, -0.7);
    boulderA.scale.y = 0.68;
    boulderA.castShadow = true;
    group.add(boulderA);

    const boulderB = new THREE.Mesh(new THREE.DodecahedronGeometry(radius * 0.28, 0), rockC);
    boulderB.position.set(radius * 0.95, 2.48, -0.5);
    boulderB.scale.y = 0.62;
    boulderB.castShadow = true;
    group.add(boulderB);

    if (safeLevel >= 3) {
      const cap = new THREE.Mesh(new THREE.ConeGeometry(radius * 0.36, mainHeight * 0.22, 7), snow);
      cap.position.set(-0.25, 2.2 + mainHeight * 0.89, 0.15);
      cap.castShadow = true;
      group.add(cap);
    }

    for (const x of [-0.85, 0.65]) {
      const shrub = new THREE.Mesh(new THREE.SphereGeometry(0.28, 7, 5), moss);
      shrub.position.set(x, 2.55, 1.0);
      shrub.scale.y = 0.65;
      shrub.castShadow = true;
      group.add(shrub);
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
    this.addBox(group, 1.25, 0.42, 0.82, timber, 0, 2.68, -2.55);

    for (const x of [-0.5, 0.5]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.1, 10), metal);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, 2.48, -2.55);
      group.add(wheel);
    }

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
    const queue: Array<{ x: number; y: number }> = [];

    for (const cell of this.state.entries()) {
      if (cell.kind !== 'moat') continue;

      const neighbors = [
        [cell.x - 1, cell.y],
        [cell.x + 1, cell.y],
        [cell.x, cell.y - 1],
        [cell.x, cell.y + 1],
      ];

      if (neighbors.some(([x, y]) => this.terrainAt(x, y) === 'river')) {
        const cellKey = this.key(cell.x, cell.y);
        flooded.add(cellKey);
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

  private onPointerUp(event: PointerEvent): void {
    if (event.button !== 0 || !this.pointerStart) {
      this.pointerStart = null;
      return;
    }

    const movement = Math.hypot(event.clientX - this.pointerStart.x, event.clientY - this.pointerStart.y);
    this.pointerStart = null;
    if (movement > 6) return;

    this.handleBuildClick(event);
  }

  private handleBuildClick(event: PointerEvent): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);

    const hit = this.raycaster.intersectObject(this.groundHit, false)[0];
    if (!hit) return;

    const gx = Math.floor(hit.point.x / TILE + SIZE / 2);
    const gy = Math.floor(hit.point.z / TILE + SIZE / 2);
    if (gx < 0 || gy < 0 || gx >= SIZE || gy >= SIZE) return;

    const cell = this.state.getCell(gx, gy);
    const current = cell?.kind;
    const terrain = this.terrainAt(gx, gy);
    const overrideKey = this.key(gx, gy);

    if (this.selectedTool === 'erase') {
      if (current) {
        this.state.removeCell(gx, gy);
        this.finishBuild();
        return;
      }

      if (this.terrainOverrides.has(overrideKey)) {
        this.terrainOverrides.delete(overrideKey);
        this.finishBuild();
      }
      return;
    }

    if (this.selectedTool === 'river' || this.selectedTool === 'land') {
      if (current || this.moatTasks.has(overrideKey)) return;
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
        this.state.setLevel(gx, gy, (cell?.level ?? 1) + 1);
        this.finishBuild();
        return;
      }

      if (!current && (terrain === 'plains' || terrain === 'shore')) {
        this.state.setCell(gx, gy, 'mountain', 1);
        this.finishBuild();
      }
      return;
    }

    if (this.selectedTool === 'mine') {
      if (current === 'mountain') {
        this.state.setCell(gx, gy, 'mine', 1);
        this.finishBuild();
        return;
      }

      if (!current && terrain === 'mountain') {
        this.state.setCell(gx, gy, 'mine', 1);
        this.finishBuild();
      }
      return;
    }

    if (this.selectedTool === 'tree') {
      if (!current && (terrain === 'plains' || terrain === 'shore' || terrain === 'forest')) {
        this.state.setCell(gx, gy, 'tree', 1 + ((gx + gy) % 3));
        this.finishBuild();
      }
      return;
    }

    const selectedTile = this.selectedTool as TileKind;
    const selectedIsWall = WALL_KINDS.includes(selectedTile as WallKind);
    const currentIsWall = current ? WALL_KINDS.includes(current as WallKind) : false;
    const selectedFortification = selectedIsWall || selectedTile === 'gate' || selectedTile === 'tower';
    const currentFortification = currentIsWall || current === 'gate' || current === 'tower';

    if (current) {
      if (selectedIsWall && current === selectedTile) {
        this.state.setLevel(gx, gy, (cell?.level ?? 1) + 1);
        this.finishBuild();
        return;
      }

      if (selectedFortification && currentFortification) {
        this.state.setCell(gx, gy, selectedTile, cell?.level ?? 1);
        this.finishBuild();
      }
      return;
    }

    if (!this.canBuildOnTerrain(this.selectedTool, terrain)) return;

    this.state.setCell(gx, gy, selectedTile, 1);
    this.finishBuild();
  }

  private canBuildOnTerrain(tool: ToolKind, terrain: TerrainKind): boolean {
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

    const data: SavedGame = {
      version: SAVE_VERSION,
      updatedAt: Date.now(),
      cells: this.state.entries(),
      terrain,
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
        cells?: Array<{ x: number; y: number; kind: string; level?: number }>;
        terrain?: Array<{ x: number; y: number; kind: TerrainOverrideKind }>;
        worldSeeded?: boolean;
      };

      const cells: Array<{ x: number; y: number; kind: TileKind; level?: number }> = [];

      for (const cell of data.cells ?? []) {
        if (cell.x < 0 || cell.y < 0 || cell.x >= SIZE || cell.y >= SIZE) continue;

        const migration = this.migrateKind(cell.kind, cell.level ?? 1);
        if (!migration) continue;

        cells.push({
          x: cell.x,
          y: cell.y,
          kind: migration.kind,
          level: migration.level,
        });
      }

      this.state.replace(cells);
      this.terrainOverrides.clear();

      for (const terrainCell of data.terrain ?? []) {
        if (terrainCell.x < 0 || terrainCell.y < 0 || terrainCell.x >= SIZE || terrainCell.y >= SIZE) continue;
        if (terrainCell.kind !== 'plains' && terrainCell.kind !== 'river') continue;
        this.terrainOverrides.set(this.key(terrainCell.x, terrainCell.y), terrainCell.kind);
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

    toolbar.innerHTML =
      '<div class="toolbar-title"><span>Build</span><small>Engineering & settlement</small></div>' +
      TOOL_GROUPS.map((group) => {
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

    toolbar.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach((button) => {
      button.onclick = () => this.selectTool(button.dataset.tool as ToolKind);
    });

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
      this.redraw();
    };
    get<HTMLButtonElement>('reset-button').onclick = () => {
      if (confirm('Reset the entire island?')) {
        this.state.clear();
        this.terrainOverrides.clear();
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
        x: 'erase',
      };

      const selected = shortcutMap[event.key.toLowerCase()];
      if (selected) this.selectTool(selected);
      if (event.key === 'Escape') {
        help.hidden = true;
        templates.hidden = true;
      }
    });
  }

  private applyTemplate(template: string): void {
    this.state.clear();
    this.terrainOverrides.clear();
    this.moatTasks.clear();
    this.worldSeeded = true;
    this.seedNaturalProps();

    const center = Math.floor(SIZE / 2);
    const place = (x: number, y: number, kind: TileKind, level = 1): void => {
      this.state.setCell(x, y, kind, level);
    };

    if (template === 'blank') {
      this.state.clear();
      this.worldSeeded = true;
    } else if (template === 'river-citadel') {
      for (let y = 2; y < SIZE - 2; y += 1) {
        const x = center + Math.round(Math.sin(y * 0.48));
        this.terrainOverrides.set(this.key(x, y), 'river');
      }

      for (let x = center - 4; x <= center + 4; x += 1) {
        place(x, center - 4, 'wall2', 2);
        place(x, center + 4, 'wall2', 2);
      }
      for (let y = center - 4; y <= center + 4; y += 1) {
        place(center - 4, y, 'wall2', 2);
        place(center + 4, y, 'wall2', 2);
      }

      place(center, center + 4, 'gate');
      place(center - 4, center - 4, 'tower');
      place(center + 4, center - 4, 'tower');
      place(center - 4, center + 4, 'tower');
      place(center + 4, center + 4, 'tower');

      for (let y = center; y <= center + 3; y += 1) place(center, y, 'road');
      place(center - 2, center, 'house');
      place(center + 2, center, 'manor');
      place(center - 2, center + 2, 'farm');
    } else if (template === 'mountain-hold') {
      for (let x = center - 4; x <= center + 3; x += 1) {
        place(x, center + 3, 'wall3', 3);
      }
      for (let y = center - 2; y <= center + 3; y += 1) {
        place(center - 4, y, 'wall3', 3);
        place(center + 3, y, 'wall3', 3);
      }
      place(center, center + 3, 'gate');
      place(center - 4, center - 2, 'tower');
      place(center + 3, center - 2, 'tower');

      place(center + 1, center - 2, 'mountain', 4);
      place(center + 3, center - 3, 'mountain', 5);
      place(center + 2, center, 'mine');
      place(center - 1, center, 'villa');
      place(center - 2, center + 1, 'house');
    } else if (template === 'farming-village') {
      for (let x = center - 5; x <= center + 5; x += 1) place(x, center, 'road');
      for (let y = center - 4; y <= center + 4; y += 1) place(center, y, 'road');

      place(center - 2, center - 2, 'cottage');
      place(center + 2, center - 2, 'house');
      place(center - 2, center + 2, 'house');
      place(center + 2, center + 2, 'villa');
      place(center - 4, center - 2, 'farm');
      place(center - 4, center + 2, 'farm');
      place(center + 4, center - 2, 'farm');
      place(center + 4, center + 2, 'farm');
    }

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
    this.controls.update();
    this.renderer.render(this.scene, this.camera);

    requestAnimationFrame((nextTime) => this.animate(nextTime));
  }
}
