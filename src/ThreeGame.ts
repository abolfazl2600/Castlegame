import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GameState } from './state/GameState';
import { SAVE_KEY, SAVE_VERSION, TILE_SIZE, WORLD_COLS } from './core/constants';
import type { MountainKind, TileKind, ToolKind, TerrainKind, WallKind } from './core/types';

const SIZE = WORLD_COLS;
const TILE = TILE_SIZE;
const WORLD = SIZE * TILE;

const WALL_KINDS: WallKind[] = ['wall1', 'wall2', 'wall3'];
const MOUNTAIN_KINDS: MountainKind[] = ['mountain1', 'mountain2', 'mountain3'];

const COLORS: Record<TileKind, number> = {
  wall1: 0xd8c1a5,
  wall2: 0xe8d7c0,
  wall3: 0xaeb8c1,
  gate: 0x9a5c35,
  tower: 0xe4d4c1,
  road: 0x8b6d55,
  cottage: 0xc98362,
  house: 0xb79bd8,
  manor: 0xd8758a,
  villa: 0x71b9b2,
  farm: 0xb99355,
  mine: 0x6d625a,
  mountain1: 0x887c72,
  mountain2: 0x7a7069,
  mountain3: 0x6d655f,
};

interface ToolDefinition {
  id: ToolKind;
  icon: string;
  label: string;
  detail: string;
  shortcut: string;
}

const TOOL_GROUPS: Array<{ label: string; tools: ToolDefinition[] }> = [
  {
    label: 'Fortifications',
    tools: [
      { id: 'wall1', icon: '🧱', label: 'Wall I', detail: 'Low stone wall', shortcut: '1' },
      { id: 'wall2', icon: '🧱', label: 'Wall II', detail: 'Tall stone wall', shortcut: '2' },
      { id: 'wall3', icon: '🛡️', label: 'Wall III', detail: 'Reinforced wall', shortcut: '3' },
      { id: 'gate', icon: '🚪', label: 'Gate', detail: 'Connects into walls', shortcut: '4' },
      { id: 'tower', icon: '🏰', label: 'Tower', detail: 'Wall-linked defense tower', shortcut: '5' },
    ],
  },
  {
    label: 'Settlement',
    tools: [
      { id: 'road', icon: '🛣️', label: 'Road', detail: 'Auto-connects to roads', shortcut: '6' },
      { id: 'cottage', icon: '🏠', label: 'Cottage', detail: 'Small home', shortcut: '7' },
      { id: 'house', icon: '🏡', label: 'House', detail: 'Family house', shortcut: '8' },
      { id: 'manor', icon: '🏯', label: 'Manor', detail: 'Large residence', shortcut: '9' },
      { id: 'villa', icon: '🏘️', label: 'Villa', detail: 'Wide premium house', shortcut: '0' },
      { id: 'farm', icon: '🌾', label: 'Farm', detail: 'Cultivated crop field', shortcut: 'F' },
    ],
  },
  {
    label: 'Terrain & resources',
    tools: [
      { id: 'mountain', icon: '⛰️', label: 'Mountain', detail: 'Click repeatedly to grow', shortcut: 'N' },
      { id: 'mine', icon: '⛏️', label: 'Mine', detail: 'Build on a mountain', shortcut: 'M' },
      { id: 'erase', icon: '⌫', label: 'Remove', detail: 'Remove a structure', shortcut: 'X' },
    ],
  },
];

export class ThreeGame {
  private readonly root: HTMLElement;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(48, 1, 0.1, 600);
  private readonly renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  private readonly controls: OrbitControls;
  private readonly state = new GameState();
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly buildLayer = new THREE.Group();
  private readonly groundHit = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD, WORLD),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  private selectedTool: ToolKind = 'wall1';
  private saveTimer: number | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.65));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    root.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(0x071b2a);
    this.scene.fog = new THREE.Fog(0x071b2a, 90, 205);
    this.camera.position.set(62, 72, 68);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.minDistance = 32;
    this.controls.maxDistance = 135;
    this.controls.maxPolarAngle = Math.PI * 0.47;
    this.controls.target.set(0, 0, 0);

    this.addLights();
    this.createWorld();
    this.scene.add(this.buildLayer);
    this.groundHit.rotation.x = -Math.PI / 2;
    this.groundHit.position.y = 2.05;
    this.scene.add(this.groundHit);
    this.load();
    this.redraw();
    this.bindUI();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.renderer.domElement.addEventListener('pointerdown', (event) => this.onPointer(event));
    requestAnimationFrame((time) => this.animate(time));
  }

  private addLights(): void {
    this.scene.add(new THREE.HemisphereLight(0xbbeeff, 0x23384d, 2.25));

    const sun = new THREE.DirectionalLight(0xffe5c8, 4.25);
    sun.position.set(38, 82, 26);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -72;
    sun.shadow.camera.right = 72;
    sun.shadow.camera.top = 72;
    sun.shadow.camera.bottom = -72;
    this.scene.add(sun);

    const rim = new THREE.PointLight(0x4cc9ff, 58, 120);
    rim.position.set(-42, 28, -36);
    this.scene.add(rim);
  }

  private createWorld(): void {
    const water = new THREE.Mesh(
      new THREE.CircleGeometry(WORLD * 0.76, 72),
      new THREE.MeshStandardMaterial({ color: 0x0b7897, roughness: 0.22, metalness: 0.07 }),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.y = -0.8;
    water.receiveShadow = true;
    this.scene.add(water);

    const island = new THREE.Mesh(
      new THREE.CylinderGeometry(WORLD * 0.49, WORLD * 0.55, 2.6, 72),
      new THREE.MeshStandardMaterial({ color: 0x7e9f55, roughness: 0.95 }),
    );
    island.receiveShadow = true;
    island.castShadow = true;
    this.scene.add(island);

    const grass = new THREE.Mesh(
      new THREE.CylinderGeometry(WORLD * 0.46, WORLD * 0.49, 1.2, 72),
      new THREE.MeshStandardMaterial({ color: 0xb3c968, roughness: 0.9 }),
    );
    grass.position.y = 1.55;
    grass.receiveShadow = true;
    this.scene.add(grass);

    const grid = new THREE.GridHelper(WORLD, SIZE, 0xe8f7ff, 0x7eb8bd);
    grid.position.y = 2.18;
    (grid.material as THREE.Material).opacity = 0.12;
    (grid.material as THREE.Material).transparent = true;
    this.scene.add(grid);

    for (let gy = 0; gy < SIZE; gy += 1) {
      for (let gx = 0; gx < SIZE; gx += 1) {
        const terrain = this.terrainAt(gx, gy);
        const position = this.gridToWorld(gx, gy);

        if (terrain === 'forest' && (gx * 7 + gy * 11) % 3 !== 0) {
          this.addTree(position.x, position.z, (gx + gy) % 3);
        }

        if (terrain === 'mountain' && (gx * 5 + gy * 3) % 2 === 0) {
          this.addNaturalMountain(position.x, position.z, 0.9 + ((gx + gy) % 3) * 0.12);
        }
      }
    }

    for (let i = 0; i < 18; i += 1) {
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(THREE.MathUtils.randFloat(0.45, 1.0)),
        new THREE.MeshStandardMaterial({ color: 0x74766d, roughness: 1 }),
      );
      const angle = Math.random() * Math.PI * 2;
      const radius = THREE.MathUtils.randFloat(WORLD * 0.34, WORLD * 0.47);
      rock.position.set(Math.cos(angle) * radius, 2.1, Math.sin(angle) * radius);
      rock.scale.y = 0.65;
      rock.castShadow = true;
      this.scene.add(rock);
    }
  }

  private addTree(x: number, z: number, variant: number): void {
    const group = new THREE.Group();
    const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x75533c, roughness: 1 });
    const foliageMaterial = new THREE.MeshStandardMaterial({
      color: [0x729d51, 0x81ad5e, 0x668e49][variant],
      roughness: 0.9,
    });

    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 1.25, 7), trunkMaterial);
    trunk.position.y = 2.8;
    trunk.castShadow = true;
    group.add(trunk);

    const lower = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.7, 8), foliageMaterial);
    lower.position.y = 3.9;
    lower.castShadow = true;
    group.add(lower);

    const upper = new THREE.Mesh(new THREE.ConeGeometry(0.68, 1.45, 8), foliageMaterial);
    upper.position.y = 4.75;
    upper.castShadow = true;
    group.add(upper);

    group.position.set(x + ((variant - 1) * 0.28), 0, z + (variant === 2 ? 0.24 : -0.12));
    this.scene.add(group);
  }

  private addNaturalMountain(x: number, z: number, scale: number): void {
    const material = new THREE.MeshStandardMaterial({ color: 0x81766d, roughness: 1, flatShading: true });
    const snow = new THREE.MeshStandardMaterial({ color: 0xd9d4cd, roughness: 1, flatShading: true });

    const mountain = new THREE.Mesh(new THREE.ConeGeometry(1.75 * scale, 4.6 * scale, 7), material);
    mountain.position.set(x, 4.45, z);
    mountain.castShadow = true;
    mountain.receiveShadow = true;
    this.scene.add(mountain);

    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.68 * scale, 1.25 * scale, 7), snow);
    cap.position.set(x, 6.35 * scale, z);
    cap.castShadow = true;
    this.scene.add(cap);
  }

  private terrainAt(x: number, y: number): TerrainKind {
    const nx = x / SIZE - 0.5;
    const ny = y / SIZE - 0.5;
    const radial = Math.sqrt(nx * nx + ny * ny);
    const noise = Math.sin(x * 0.19) * 0.03 + Math.cos(y * 0.16) * 0.04 + Math.sin((x + y) * 0.11) * 0.02;
    const value = 0.43 - radial + noise;

    if (value < -0.04) return 'water';
    if (value < 0.015) return 'shore';

    const mountainZone = x > SIZE * 0.61 && y < SIZE * 0.39;
    if (mountainZone && Math.sin(x * 0.62) + Math.cos(y * 0.48) > 0.55) return 'mountain';

    const forestZone = (x < SIZE * 0.34 && y > SIZE * 0.40) || (x > SIZE * 0.64 && y > SIZE * 0.58);
    if (forestZone && Math.sin(x * 0.53) + Math.cos(y * 0.47) > 0.45) return 'forest';

    return 'plains';
  }

  private gridToWorld(gx: number, gy: number): { x: number; z: number } {
    return {
      x: (gx - SIZE / 2 + 0.5) * TILE,
      z: (gy - SIZE / 2 + 0.5) * TILE,
    };
  }

  private redraw(): void {
    this.buildLayer.clear();
    for (const cell of this.state.entries()) {
      this.buildLayer.add(this.makeBuilding(cell.kind, cell.x, cell.y));
    }
  }

  private makeBuilding(kind: TileKind, gx: number, gy: number): THREE.Group {
    const group = new THREE.Group();
    const position = this.gridToWorld(gx, gy);
    group.position.set(position.x, 0, position.z);

    if (kind === 'road') return this.makeRoad(group, gx, gy);
    if (WALL_KINDS.includes(kind as WallKind)) return this.makeWall(group, kind as WallKind, gx, gy);
    if (kind === 'gate') return this.makeGate(group, gx, gy);
    if (kind === 'tower') return this.makeTower(group, gx, gy);
    if (kind === 'farm') return this.makeFarm(group);
    if (kind === 'mine') return this.makeMine(group);
    if (MOUNTAIN_KINDS.includes(kind as MountainKind)) return this.makeMountain(group, kind as MountainKind);
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
    const roadMaterial = new THREE.MeshStandardMaterial({ color: COLORS.road, roughness: 0.95 });
    const edgeMaterial = new THREE.MeshStandardMaterial({ color: 0x70523f, roughness: 1 });

    this.addBox(group, 2.35, 0.16, 2.35, roadMaterial, 0, 2.25, 0);
    this.addBox(group, 2.42, 0.05, 2.42, edgeMaterial, 0, 2.16, 0);

    const connectors: Array<[number, number, number, number]> = [
      [-1, 0, -1.52, 0],
      [1, 0, 1.52, 0],
      [0, -1, 0, -1.52],
      [0, 1, 0, 1.52],
    ];

    for (const [dx, dy, px, pz] of connectors) {
      if (!this.isRoadFamily(this.kindAt(gx + dx, gy + dy))) continue;
      if (dx !== 0) this.addBox(group, 1.75, 0.17, 1.62, roadMaterial, px, 2.25, pz);
      else this.addBox(group, 1.62, 0.17, 1.75, roadMaterial, px, 2.25, pz);
    }

    return group;
  }

  private makeWall(group: THREE.Group, kind: WallKind, gx: number, gy: number): THREE.Group {
    const config = {
      wall1: { color: 0xd8c1a5, dark: 0x9a8067, height: 3.55, thickness: 1.45 },
      wall2: { color: 0xe8d7c0, dark: 0xb09273, height: 4.3, thickness: 1.62 },
      wall3: { color: 0xaeb8c1, dark: 0x68737d, height: 4.95, thickness: 1.8 },
    }[kind];

    const wallMaterial = new THREE.MeshStandardMaterial({ color: config.color, roughness: 0.8 });
    const darkMaterial = new THREE.MeshStandardMaterial({ color: config.dark, roughness: 0.9 });
    const topY = 2.22 + config.height;

    this.addBox(group, config.thickness, config.height, config.thickness, wallMaterial, 0, 2.22 + config.height / 2, 0);

    const neighbors = [
      { dx: -1, dy: 0, axis: 'x' as const, sign: -1 },
      { dx: 1, dy: 0, axis: 'x' as const, sign: 1 },
      { dx: 0, dy: -1, axis: 'z' as const, sign: -1 },
      { dx: 0, dy: 1, axis: 'z' as const, sign: 1 },
    ];

    let connections = 0;
    for (const neighbor of neighbors) {
      if (!this.isWallFamily(this.kindAt(gx + neighbor.dx, gy + neighbor.dy))) continue;
      connections += 1;
      const length = TILE / 2 + config.thickness / 2;
      const offset = neighbor.sign * (TILE / 4 - config.thickness / 4);

      if (neighbor.axis === 'x') {
        this.addBox(group, length, config.height, config.thickness, wallMaterial, offset, 2.22 + config.height / 2, 0);
        this.addMerlons(group, offset, topY + 0.28, 0, 'x', length, wallMaterial);
      } else {
        this.addBox(group, config.thickness, config.height, length, wallMaterial, 0, 2.22 + config.height / 2, offset);
        this.addMerlons(group, 0, topY + 0.28, offset, 'z', length, wallMaterial);
      }
    }

    if (connections === 0) {
      this.addBox(group, TILE * 0.88, config.height, config.thickness, wallMaterial, 0, 2.22 + config.height / 2, 0);
      this.addMerlons(group, 0, topY + 0.28, 0, 'x', TILE * 0.88, wallMaterial);
    }

    this.addBox(group, config.thickness + 0.16, 0.3, config.thickness + 0.16, darkMaterial, 0, topY + 0.05, 0);

    if (kind === 'wall3') {
      const braceMaterial = new THREE.MeshStandardMaterial({ color: 0x5d6871, metalness: 0.18, roughness: 0.58 });
      this.addBox(group, config.thickness + 0.28, 0.32, config.thickness + 0.28, braceMaterial, 0, 3.2, 0);
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
    const wallMaterial = new THREE.MeshStandardMaterial({ color: COLORS.wall2, roughness: 0.78 });
    const woodMaterial = new THREE.MeshStandardMaterial({ color: COLORS.gate, roughness: 0.88 });
    const darkWood = new THREE.MeshStandardMaterial({ color: 0x573722, roughness: 1 });

    const horizontalNeighbors = Number(this.isWallFamily(this.kindAt(gx - 1, gy))) + Number(this.isWallFamily(this.kindAt(gx + 1, gy)));
    const verticalNeighbors = Number(this.isWallFamily(this.kindAt(gx, gy - 1))) + Number(this.isWallFamily(this.kindAt(gx, gy + 1)));
    const vertical = verticalNeighbors > horizontalNeighbors;

    const core = new THREE.Group();
    const left = this.addBox(core, 0.72, 4.35, 2.05, wallMaterial, -1.25, 4.4, 0);
    const right = this.addBox(core, 0.72, 4.35, 2.05, wallMaterial, 1.25, 4.4, 0);
    left.castShadow = right.castShadow = true;
    this.addBox(core, 3.2, 0.72, 2.08, wallMaterial, 0, 6.25, 0);
    this.addBox(core, 1.7, 2.85, 0.28, woodMaterial, 0, 3.7, -1.08);
    this.addBox(core, 0.12, 2.7, 0.35, darkWood, -0.48, 3.7, -1.12);
    this.addBox(core, 0.12, 2.7, 0.35, darkWood, 0.48, 3.7, -1.12);
    this.addMerlons(core, 0, 6.92, 0, 'x', 3.25, wallMaterial);

    if (vertical) core.rotation.y = Math.PI / 2;
    group.add(core);

    const armMaterial = wallMaterial;
    const links = vertical
      ? [
          { dx: 0, dy: -1, z: -1.55 },
          { dx: 0, dy: 1, z: 1.55 },
        ]
      : [
          { dx: -1, dy: 0, x: -1.55 },
          { dx: 1, dy: 0, x: 1.55 },
        ];

    for (const link of links) {
      if (!this.isWallFamily(this.kindAt(gx + link.dx, gy + link.dy))) continue;
      if ('x' in link) this.addBox(group, 1.8, 3.7, 1.6, armMaterial, link.x ?? 0, 4.05, 0);
      else this.addBox(group, 1.6, 3.7, 1.8, armMaterial, 0, 4.05, link.z ?? 0);
    }

    return group;
  }

  private makeTower(group: THREE.Group, gx: number, gy: number): THREE.Group {
    const stoneMaterial = new THREE.MeshStandardMaterial({ color: COLORS.tower, roughness: 0.74 });
    const roofMaterial = new THREE.MeshStandardMaterial({ color: 0x8d5b69, roughness: 0.7 });

    const body = new THREE.Mesh(new THREE.CylinderGeometry(1.58, 1.78, 5.25, 12), stoneMaterial);
    body.position.y = 4.85;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.0, 2.1, 12), roofMaterial);
    roof.position.y = 8.45;
    roof.castShadow = true;
    group.add(roof);

    const neighborSpecs = [
      { dx: -1, dy: 0, x: -1.62, z: 0, w: 1.8, d: 1.55 },
      { dx: 1, dy: 0, x: 1.62, z: 0, w: 1.8, d: 1.55 },
      { dx: 0, dy: -1, x: 0, z: -1.62, w: 1.55, d: 1.8 },
      { dx: 0, dy: 1, x: 0, z: 1.62, w: 1.55, d: 1.8 },
    ];

    for (const spec of neighborSpecs) {
      if (!this.isWallFamily(this.kindAt(gx + spec.dx, gy + spec.dy))) continue;
      this.addBox(group, spec.w, 3.8, spec.d, stoneMaterial, spec.x, 4.15, spec.z);
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

    const wallMaterial = new THREE.MeshStandardMaterial({ color: config.color, roughness: 0.74 });
    const roofMaterial = new THREE.MeshStandardMaterial({ color: config.roofColor, roughness: 0.78 });
    const windowMaterial = new THREE.MeshStandardMaterial({ color: 0x8de7ff, emissive: 0x155a68, emissiveIntensity: 0.55 });

    this.addBox(group, config.width, config.height, config.depth, wallMaterial, 0, 2.2 + config.height / 2, 0);

    const roof = new THREE.Mesh(new THREE.ConeGeometry(config.width * 0.78, config.roof, 4), roofMaterial);
    roof.position.y = 2.2 + config.height + config.roof / 2;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    group.add(roof);

    for (const sx of [-0.75, 0.75]) {
      const window = this.addBox(group, 0.5, 0.7, 0.08, windowMaterial, sx, 3.05 + config.height * 0.25, -config.depth / 2 - 0.045);
      window.castShadow = false;
    }

    if (kind === 'villa') {
      const awning = this.addBox(group, 2.5, 0.18, 0.85, roofMaterial, 0, 3.45, -2.0);
      awning.rotation.x = -0.08;
    }

    return group;
  }

  private makeFarm(group: THREE.Group): THREE.Group {
    const soil = new THREE.MeshStandardMaterial({ color: 0x8b6847, roughness: 1 });
    const cropA = new THREE.MeshStandardMaterial({ color: 0xc7c85c, roughness: 0.9 });
    const cropB = new THREE.MeshStandardMaterial({ color: 0x76a95a, roughness: 0.9 });
    const wood = new THREE.MeshStandardMaterial({ color: 0x8d6b4d, roughness: 1 });

    this.addBox(group, 3.45, 0.16, 3.45, soil, 0, 2.24, 0);

    for (let i = -2; i <= 2; i += 1) {
      this.addBox(group, 0.26, 0.32, 2.8, i % 2 === 0 ? cropA : cropB, i * 0.58, 2.46, 0);
    }

    for (const x of [-1.72, 1.72]) {
      this.addBox(group, 0.12, 0.75, 3.55, wood, x, 2.58, 0);
    }

    return group;
  }

  private makeMountain(group: THREE.Group, kind: MountainKind): THREE.Group {
    const level = MOUNTAIN_KINDS.indexOf(kind) + 1;
    const rock = new THREE.MeshStandardMaterial({ color: COLORS[kind], roughness: 1, flatShading: true });
    const snow = new THREE.MeshStandardMaterial({ color: 0xd9d4cd, roughness: 1, flatShading: true });

    const mainHeight = 3.4 + level * 1.45;
    const radius = 1.2 + level * 0.32;

    const mountain = new THREE.Mesh(new THREE.ConeGeometry(radius, mainHeight, 7), rock);
    mountain.position.y = 2.2 + mainHeight / 2;
    mountain.castShadow = true;
    mountain.receiveShadow = true;
    group.add(mountain);

    if (level >= 2) {
      const shoulder = new THREE.Mesh(new THREE.ConeGeometry(radius * 0.62, mainHeight * 0.62, 7), rock);
      shoulder.position.set(radius * 0.78, 2.2 + mainHeight * 0.31, 0.35);
      shoulder.castShadow = true;
      group.add(shoulder);
    }

    if (level === 3) {
      const cap = new THREE.Mesh(new THREE.ConeGeometry(radius * 0.35, mainHeight * 0.25, 7), snow);
      cap.position.y = 2.2 + mainHeight * 0.88;
      cap.castShadow = true;
      group.add(cap);
    }

    return group;
  }

  private makeMine(group: THREE.Group): THREE.Group {
    const rock = new THREE.MeshStandardMaterial({ color: COLORS.mine, roughness: 1, flatShading: true });
    const dark = new THREE.MeshStandardMaterial({ color: 0x241f1b, roughness: 1 });
    const timber = new THREE.MeshStandardMaterial({ color: 0x795238, roughness: 1 });

    const mound = new THREE.Mesh(new THREE.ConeGeometry(1.65, 4.6, 7), rock);
    mound.position.y = 4.5;
    mound.castShadow = true;
    mound.receiveShadow = true;
    group.add(mound);

    this.addBox(group, 1.3, 1.65, 0.35, dark, 0, 3.0, -1.34);
    this.addBox(group, 0.18, 1.95, 0.45, timber, -0.72, 3.05, -1.36);
    this.addBox(group, 0.18, 1.95, 0.45, timber, 0.72, 3.05, -1.36);
    this.addBox(group, 1.65, 0.18, 0.45, timber, 0, 3.95, -1.36);

    return group;
  }

  private onPointer(event: PointerEvent): void {
    if (event.button !== 0) return;

    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);

    const hit = this.raycaster.intersectObject(this.groundHit, false)[0];
    if (!hit) return;

    const gx = Math.floor(hit.point.x / TILE + SIZE / 2);
    const gy = Math.floor(hit.point.z / TILE + SIZE / 2);
    if (gx < 0 || gy < 0 || gx >= SIZE || gy >= SIZE) return;

    const terrain = this.terrainAt(gx, gy);
    const current = this.state.getCell(gx, gy)?.kind;

    if (this.selectedTool === 'erase') {
      if (!current) return;
      this.state.removeCell(gx, gy);
      this.finishBuild();
      return;
    }

    if (this.selectedTool === 'mountain') {
      if (current === 'mountain1') this.state.setCell(gx, gy, 'mountain2');
      else if (current === 'mountain2') this.state.setCell(gx, gy, 'mountain3');
      else if (current === 'mountain3') return;
      else if (!current && (terrain === 'plains' || terrain === 'shore')) this.state.setCell(gx, gy, 'mountain1');
      else return;

      this.finishBuild();
      return;
    }

    if (this.selectedTool === 'mine') {
      if (current && MOUNTAIN_KINDS.includes(current as MountainKind)) {
        this.state.setCell(gx, gy, 'mine');
      } else if (!current && terrain === 'mountain') {
        this.state.setCell(gx, gy, 'mine');
      } else {
        return;
      }

      this.finishBuild();
      return;
    }

    const selectedTile = this.selectedTool as TileKind;
    const selectedIsWall = WALL_KINDS.includes(selectedTile as WallKind);
    const currentIsWall = current ? WALL_KINDS.includes(current as WallKind) : false;
    const selectedFortification = selectedIsWall || selectedTile === 'gate' || selectedTile === 'tower';
    const currentFortification = currentIsWall || current === 'gate' || current === 'tower';

    if (current) {
      if (selectedFortification && currentFortification) {
        this.state.setCell(gx, gy, selectedTile);
        this.finishBuild();
      }
      return;
    }

    if (!this.canBuildOnTerrain(this.selectedTool, terrain)) return;

    this.state.setCell(gx, gy, selectedTile);
    this.finishBuild();
  }

  private canBuildOnTerrain(tool: ToolKind, terrain: TerrainKind): boolean {
    if (terrain === 'water' || terrain === 'forest') return false;
    if (terrain === 'mountain') return tool === 'mine';
    if (tool === 'farm') return terrain === 'plains';
    return terrain === 'plains' || terrain === 'shore';
  }

  private finishBuild(): void {
    this.redraw();
    this.scheduleSave();
  }

  private scheduleSave(): void {
    if (this.saveTimer !== null) window.clearTimeout(this.saveTimer);
    this.setStatus('Unsaved changes…');
    this.saveTimer = window.setTimeout(() => {
      this.save();
      this.saveTimer = null;
    }, 450);
  }

  private save(): void {
    localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({
        version: SAVE_VERSION,
        updatedAt: Date.now(),
        cells: this.state.entries(),
      }),
    );
    this.setStatus('Saved');
  }

  private load(): void {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;

    try {
      const data = JSON.parse(raw) as { cells?: Array<{ x: number; y: number; kind: string }> };
      const cells: Array<{ x: number; y: number; kind: TileKind }> = [];

      for (const cell of data.cells ?? []) {
        if (cell.x < 0 || cell.y < 0 || cell.x >= SIZE || cell.y >= SIZE) continue;

        const migratedKind = cell.kind === 'wall' ? 'wall1' : cell.kind;
        if (!this.isKnownTileKind(migratedKind)) continue;

        cells.push({ x: cell.x, y: cell.y, kind: migratedKind });
      }

      this.state.replace(cells);
      this.setStatus('Loaded');
    } catch {
      this.setStatus('Could not load save');
    }
  }

  private isKnownTileKind(kind: string): kind is TileKind {
    return [
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
      'mountain1',
      'mountain2',
      'mountain3',
    ].includes(kind);
  }

  private bindUI(): void {
    const get = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
    const toolbar = get<HTMLElement>('toolbar');

    toolbar.innerHTML =
      '<div class="toolbar-title"><span>Build</span><small>Connected 3D settlement</small></div>' +
      TOOL_GROUPS.map((group) => {
        const buttons = group.tools
          .map(
            (tool) =>
              `<button class="tool-button${tool.id === 'wall1' ? ' is-selected' : ''}" data-tool="${tool.id}">
                <span class="tool-icon">${tool.icon}</span>
                <span class="tool-copy"><strong>${tool.label}</strong><small>${tool.detail}</small></span>
                <kbd>${tool.shortcut}</kbd>
              </button>`,
          )
          .join('');

        return `<div class="tool-section-label">${group.label}</div>${buttons}`;
      })
        .join('');

    toolbar.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach((button) => {
      button.onclick = () => this.selectTool(button.dataset.tool as ToolKind);
    });

    const help = get<HTMLElement>('help-modal');
    get<HTMLButtonElement>('help-button').onclick = () => {
      help.hidden = false;
    };
    get<HTMLButtonElement>('help-close-button').onclick = () => {
      help.hidden = true;
    };
    get<HTMLButtonElement>('save-button').onclick = () => this.save();
    get<HTMLButtonElement>('load-button').onclick = () => {
      this.load();
      this.redraw();
    };
    get<HTMLButtonElement>('reset-button').onclick = () => {
      if (confirm('Reset the entire island?')) {
        this.state.clear();
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
        m: 'mine',
        n: 'mountain',
        x: 'erase',
      };

      const selected = shortcutMap[event.key.toLowerCase()];
      if (selected) this.selectTool(selected);
      if (event.key === 'Escape') help.hidden = true;
    });
  }

  private selectTool(tool: ToolKind): void {
    this.selectedTool = tool;
    document.querySelectorAll('[data-tool]').forEach((element) => {
      element.classList.toggle('is-selected', (element as HTMLElement).dataset.tool === tool);
    });
    this.setStatus(`Selected: ${tool}`);
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

  private animate(_time: number): void {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame((time) => this.animate(time));
  }
}
