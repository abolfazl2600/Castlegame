import * as THREE from 'three';

const COW_BARN_LEVEL = 99;
const BARN_TOOL_ID = 'cowBarn';

type GameRuntime = {
  renderer: THREE.WebGLRenderer;
  buildLayer: THREE.Group;
  settlementLayer: THREE.Group;
  services: {
    state: {
      getCell(x: number, y: number): { kind: string; level?: number } | undefined;
      setCell(x: number, y: number, kind: string, level?: number): void;
      entries(): Array<{ x: number; y: number; kind: string; level?: number }>;
    };
  };
  selectedCell: { x: number; y: number } | null;
  selectedTool: unknown;
  gameMode: string;
  recordHistory(): void;
  redraw(): void;
  scheduleSave(): void;
  setStatus(message: string): void;
  pickGridCell(event: PointerEvent): { x: number; y: number } | null;
  gridToWorld(x: number, y: number): { x: number; z: number };
  terrainAt(x: number, y: number): string;
  terrainElevation(x: number, y: number): number;
  selectTool(tool: unknown): void;
  setToolbarOpen(open: boolean): void;
};

interface CowState {
  target: THREE.Vector3;
  phase: 'idle' | 'grazing' | 'walking';
  timerMs: number;
  seed: number;
  speed: number;
}

export class FarmLifeSystem {
  private static installed = false;
  private readonly game: GameRuntime;
  private active = false;
  private lastUpdate = 0;

  constructor(game: unknown) {
    this.game = game as GameRuntime;
    this.install();
  }

  private install(): void {
    if (FarmLifeSystem.installed) return;
    FarmLifeSystem.installed = true;

    this.patchBuildingRenderer();
    this.patchSettlementPerson();
    this.patchSettlementUpdate();
    this.patchToolSelection();
    this.patchBuildPanelRefresh();
    this.installBuildTool();
    this.installInputBridge();
  }

  private patchBuildingRenderer(): void {
    const prototype = Object.getPrototypeOf(this.game) as Record<string, unknown>;
    const original = prototype.makeBuilding as Function | undefined;
    if (!original) return;

    const system = this;
    prototype.makeBuilding = function (
      this: GameRuntime,
      cell: { x: number; y: number; kind: string; level?: number },
      floodedMoats: Set<string>,
    ): THREE.Group {
      if (cell.kind === 'farm' && cell.level === COW_BARN_LEVEL) {
        return system.makeCowBarn(this, cell.x, cell.y);
      }
      return original.call(this, cell, floodedMoats);
    };
  }

  private patchSettlementPerson(): void {
    const prototype = Object.getPrototypeOf(this.game) as Record<string, unknown>;
    const original = prototype.createSettlementPerson as Function | undefined;
    if (!original) return;

    prototype.createSettlementPerson = function (
      this: GameRuntime,
      role: 'citizen' | 'farmer',
      seed: number,
    ): THREE.Group {
      const group = original.call(this, role, seed) as THREE.Group;
      if (role !== 'farmer') return group;

      const armMaterial = new THREE.MeshStandardMaterial({ color: 0x6b6240, roughness: 0.96 });
      const basketMaterial = new THREE.MeshStandardMaterial({ color: 0x8a5f36, roughness: 1 });

      const arms: THREE.Mesh[] = [];
      for (const side of [-1, 1]) {
        const arm = new THREE.Mesh(
          new THREE.CylinderGeometry(0.028, 0.038, 0.34, 5),
          armMaterial,
        );
        arm.position.set(side * 0.16, 0.58, 0.02);
        arm.rotation.z = side * 0.18;
        arm.castShadow = true;
        group.add(arm);
        arms.push(arm);
      }

      const basket = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.24, 0.16, 0.2),
        basketMaterial,
      );
      body.position.y = 0.06;
      basket.add(body);
      basket.visible = false;
      basket.position.set(0, 0.55, 0.16);
      group.add(basket);

      group.userData.farmerAnimation = {
        arms,
        tool: group.children[6] as THREE.Object3D | undefined,
        legs: [group.children[2], group.children[3]] as THREE.Object3D[],
        body: group.children[0] as THREE.Object3D,
        head: group.children[1] as THREE.Object3D,
        basket,
      };
      return group;
    };
  }

  private patchSettlementUpdate(): void {
    const prototype = Object.getPrototypeOf(this.game) as Record<string, unknown>;
    const original = prototype.updateSettlementAgents as Function | undefined;
    if (!original) return;

    const system = this;
    prototype.updateSettlementAgents = function (this: GameRuntime, deltaMs: number): void {
      original.call(this, deltaMs);
      system.updateCows(deltaMs);
      system.updateFarmers(deltaMs);
    };
  }

  private patchToolSelection(): void {
    const prototype = Object.getPrototypeOf(this.game) as Record<string, unknown>;
    const original = prototype.selectTool as Function | undefined;
    if (!original) return;

    const system = this;
    prototype.selectTool = function (this: GameRuntime, tool: unknown): void {
      if (tool !== null) system.active = false;
      original.call(this, tool);
      system.syncToolButton();
    };
  }

  private patchBuildPanelRefresh(): void {
    const prototype = Object.getPrototypeOf(this.game) as Record<string, unknown>;
    const original = prototype.refreshBuildPanelForMode as Function | undefined;
    if (!original) return;

    const system = this;
    prototype.refreshBuildPanelForMode = function (this: GameRuntime): void {
      original.call(this);
      system.updateToolVisibility();
    };
  }

  private installBuildTool(): void {
    const toolbar = document.getElementById('toolbar');
    if (!toolbar) return;

    const agriculture = toolbar.querySelector<HTMLElement>('.tool-category[data-category="Agriculture"] .tool-category-items');
    if (!agriculture || agriculture.querySelector('[data-cow-barn]')) return;

    const button = document.createElement('button');
    button.className = 'tool-button';
    button.type = 'button';
    button.dataset.cowBarn = 'true';
    button.innerHTML =
      '<span class="tool-icon">🐄</span>' +
      '<span class="tool-copy"><strong>Cow Barn</strong><small>Medieval cattle barn · fenced yard · livestock</small></span>' +
      '<kbd>—</kbd>';

    button.addEventListener('click', () => {
      this.active = true;
      this.game.selectTool(null);
      this.syncToolButton();
      this.game.setStatus('Cow Barn selected · place on open plains');
      if (window.matchMedia('(max-width: 760px)').matches) this.game.setToolbarOpen(false);
    });

    agriculture.appendChild(button);
    this.updateToolVisibility();
  }

  private installInputBridge(): void {
    const canvas = this.game.renderer.domElement;

    canvas.addEventListener('pointerup', (event) => {
      if (!this.active || event.button !== 0) return;

      const point = this.game.pickGridCell(event);
      if (!point) return;

      const cell = this.game.services.state.getCell(point.x, point.y);
      if (cell?.kind === 'farm' && cell.level === COW_BARN_LEVEL) {
        this.game.selectedCell = point;
        this.game.setStatus('Selected: Cow Barn');
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }

      if (cell) {
        this.game.setStatus('Cow Barn requires an empty tile');
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }

      const terrain = this.game.terrainAt(point.x, point.y);
      if (terrain !== 'plains') {
        this.game.setStatus('Cow Barn requires open plains');
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }

      this.game.recordHistory();
      this.game.services.state.setCell(point.x, point.y, 'farm', COW_BARN_LEVEL);
      this.game.selectedCell = point;
      this.game.redraw();
      this.game.scheduleSave();
      this.game.setStatus('Cow Barn placed · livestock yard active');
      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        this.active = false;
        this.syncToolButton();
      }
    }, true);
  }

  private updateToolVisibility(): void {
    const button = document.querySelector<HTMLElement>('[data-cow-barn]');
    if (!button) return;
    button.hidden = this.game.gameMode === 'modern';
    if (button.hidden) this.active = false;
    this.syncToolButton();
  }

  private syncToolButton(): void {
    const button = document.querySelector<HTMLElement>('[data-cow-barn]');
    button?.classList.toggle('is-selected', this.active);
  }

  private makeCowBarn(game: GameRuntime, gx: number, gy: number): THREE.Group {
    const group = new THREE.Group();
    const position = game.gridToWorld(gx, gy);
    group.position.set(position.x, game.terrainElevation(gx, gy), position.z);
    group.userData.cowBarn = true;

    const wood = new THREE.MeshStandardMaterial({ color: 0x795238, roughness: 0.94 });
    const woodDark = new THREE.MeshStandardMaterial({ color: 0x4b3427, roughness: 1 });
    const timber = new THREE.MeshStandardMaterial({ color: 0x5e402e, roughness: 0.9 });
    const roof = new THREE.MeshStandardMaterial({ color: 0x593b31, roughness: 0.96 });
    const roofLight = new THREE.MeshStandardMaterial({ color: 0x754d3b, roughness: 0.94 });
    const hay = new THREE.MeshStandardMaterial({ color: 0xc39a4b, roughness: 1 });
    const dirt = new THREE.MeshStandardMaterial({ color: 0x76563d, roughness: 1 });
    const fence = new THREE.MeshStandardMaterial({ color: 0x69462f, roughness: 1 });

    const addBox = (w: number, h: number, d: number, material: THREE.Material, x: number, y: number, z: number): THREE.Mesh => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      return mesh;
    };

    addBox(3.35, 0.18, 3.05, dirt, 0, 2.3, 0.12);
    addBox(2.55, 1.95, 2.05, wood, 0, 3.2, -0.38);

    for (const x of [-1.12, 1.12]) addBox(0.18, 2.35, 0.18, timber, x, 3.42, -0.38);
    addBox(2.4, 0.18, 0.18, timber, 0, 4.48, -0.38);

    const roofMesh = new THREE.Mesh(new THREE.ConeGeometry(2.15, 1.25, 4), roof);
    roofMesh.rotation.y = Math.PI / 4;
    roofMesh.position.set(0, 5.02, -0.38);
    roofMesh.scale.z = 0.86;
    roofMesh.castShadow = true;
    group.add(roofMesh);

    const roofRidge = addBox(2.85, 0.16, 0.2, roofLight, 0, 5.56, -0.38);
    roofRidge.rotation.z = 0.02;

    // Large barn entrance.
    addBox(1.22, 1.55, 0.09, woodDark, 0, 3.02, -1.45);
    for (const x of [-0.5, 0.5]) addBox(0.08, 1.55, 0.08, timber, x, 3.02, -1.51);
    addBox(1.15, 0.08, 0.08, timber, 0, 3.76, -1.51);

    // Hay loft, ladder and bales.
    addBox(1.72, 0.1, 0.72, timber, 0, 4.03, 0.52);
    for (const x of [-0.62, 0, 0.62]) {
      const bale = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.5, 8), hay);
      bale.rotation.z = Math.PI / 2;
      bale.position.set(x, 4.32, 0.5);
      bale.castShadow = true;
      group.add(bale);
    }

    for (let i = 0; i < 4; i += 1) {
      const rung = addBox(0.58, 0.06, 0.07, timber, 1.18, 2.66 + i * 0.28, 0.5);
      rung.rotation.z = -0.16;
    }
    addBox(0.07, 1.45, 0.07, timber, 0.92, 3.25, 0.5);
    addBox(0.07, 1.45, 0.07, timber, 1.44, 3.25, 0.5);

    // Fenced cattle yard.
    addBox(2.65, 0.08, 0.08, fence, -0.35, 2.62, 1.7);
    addBox(0.08, 0.08, 1.7, fence, -1.65, 2.62, 0.84);
    addBox(0.08, 0.08, 1.7, fence, 1.65, 2.62, 0.84);
    for (const x of [-1.65, -0.85, 0, 0.85, 1.65]) addBox(0.09, 0.62, 0.09, fence, x, 2.55, 1.7);

    // Trough, hay pile and water bucket.
    addBox(1.05, 0.24, 0.34, timber, 0.35, 2.52, 1.05);
    addBox(0.82, 0.12, 0.22, hay, 0.35, 2.7, 1.05);
    const troughWater = new THREE.MeshStandardMaterial({ color: 0x5c9ba1, roughness: 0.25, metalness: 0.02 });
    addBox(0.34, 0.08, 0.28, troughWater, -1.05, 2.52, 1.1);

    this.addCows(group, gx, gy);
    return group;
  }

  private addCows(group: THREE.Group, gx: number, gy: number): void {
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0xd6d0c0, roughness: 0.95 });
    const patchMaterial = new THREE.MeshStandardMaterial({ color: 0x6c5c50, roughness: 1 });
    const darkMaterial = new THREE.MeshStandardMaterial({ color: 0x352a24, roughness: 1 });
    const hornMaterial = new THREE.MeshStandardMaterial({ color: 0xbba47c, roughness: 0.95 });

    const spots = [0.2, -0.35, 0.55];
    for (let index = 0; index < 3; index += 1) {
      const cow = new THREE.Group();
      const seed = Math.abs(gx * 31 + gy * 17 + index * 97);
      const x = -1.05 + index * 0.88;
      const z = 0.78 + (index % 2) * 0.48;

      const body = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.38, 0.9), bodyMaterial);
      body.position.y = 0.42;
      body.castShadow = true;
      cow.add(body);

      const patch = new THREE.Mesh(new THREE.SphereGeometry(0.22, 7, 5), patchMaterial);
      patch.scale.set(1.1, 0.8, 0.7);
      patch.position.set(spots[index], 0.5, 0.05);
      cow.add(patch);

      const head = new THREE.Group();
      head.position.set(0, 0.55, -0.53);
      cow.add(head);

      const headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.4), bodyMaterial);
      headMesh.castShadow = true;
      head.add(headMesh);

      for (const side of [-1, 1]) {
        const horn = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.2, 5), hornMaterial);
        horn.position.set(side * 0.13, 0.22, -0.03);
        horn.rotation.z = side * 0.45;
        head.add(horn);
      }

      for (const side of [-1, 1]) {
        for (const legX of [-0.18, 0.18]) {
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.3, 5), darkMaterial);
          leg.position.set(legX, 0.16, side * 0.25);
          cow.add(leg);
        }
      }

      const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.028, 0.38, 5), darkMaterial);
      tail.position.set(0, 0.5, 0.52);
      tail.rotation.z = Math.PI * 0.2;
      cow.add(tail);

      cow.position.set(x, 2.38, z);
      cow.userData.cow = {
        target: new THREE.Vector3(x, 2.38, z),
        phase: 'idle' as CowState['phase'],
        timerMs: 700 + (seed % 1300),
        seed,
        speed: 0.32 + (seed % 5) * 0.045,
      } satisfies CowState;
      cow.userData.cowHead = head;
      cow.userData.cowTail = tail;
      cow.userData.cowLegs = cow.children.filter((child) => child instanceof THREE.Mesh).slice(2, 6);
      group.add(cow);
    }
  }

  private updateCows(deltaMs: number): void {
    if (deltaMs <= 0) return;
    const root = this.game.buildLayer;
    const barnGroups: THREE.Group[] = [];
    root.traverse((object) => {
      if (object instanceof THREE.Group && object.userData.cowBarn) barnGroups.push(object);
    });

    for (const barn of barnGroups) {
      barn.traverse((object) => {
        const cow = object as THREE.Group;
        const state = cow.userData.cow as CowState | undefined;
        if (!state) return;

        state.timerMs -= deltaMs;
        const phaseTime = Math.max(0, state.timerMs);
        const head = cow.userData.cowHead as THREE.Object3D | undefined;
        const tail = cow.userData.cowTail as THREE.Object3D | undefined;
        const legs = cow.userData.cowLegs as THREE.Object3D[] | undefined;

        if (state.phase === 'walking') {
          const delta = state.target.clone().sub(cow.position);
          const distance = Math.hypot(delta.x, delta.z);
          if (distance < 0.05) {
            state.phase = 'grazing';
            state.timerMs = 1200 + (state.seed % 2200);
          } else {
            const step = Math.min(distance, state.speed * deltaMs / 1000);
            cow.position.x += delta.x / distance * step;
            cow.position.z += delta.z / distance * step;
            cow.rotation.y = Math.atan2(delta.x, delta.z);
            const walk = Math.sin((performance.now() * 0.012) + state.seed);
            legs?.forEach((leg, index) => { leg.rotation.x = walk * (index % 2 === 0 ? 0.35 : -0.35); });
          }
        } else if (state.timerMs <= 0) {
          state.phase = state.seed % 3 === 0 ? 'walking' : 'grazing';
          state.timerMs = state.phase === 'walking' ? 3000 + (state.seed % 2500) : 1800 + (state.seed % 2800);
          if (state.phase === 'walking') {
            state.target.set(-1.2 + (state.seed % 21) * 0.12, 2.38, 0.62 + (state.seed % 12) * 0.07);
          }
        }

        if (state.phase === 'grazing') {
          const graze = Math.sin((performance.now() * 0.0025) + state.seed);
          if (head) head.rotation.x = 0.22 + Math.max(0, graze) * 0.18;
          if (tail) tail.rotation.y = Math.sin((performance.now() * 0.004) + state.seed) * 0.22;
        } else {
          if (head) head.rotation.x = Math.sin((performance.now() * 0.002) + state.seed) * 0.05;
          if (tail) tail.rotation.y = Math.sin((performance.now() * 0.006) + state.seed) * 0.12;
        }

        cow.position.y = 2.38 + Math.sin((performance.now() * 0.004) + state.seed) * 0.008;
        void phaseTime;
      });
    }
  }

  private updateFarmers(deltaMs: number): void {
    const agents = (this.game as unknown as { settlementAgents?: Array<{
      role: string;
      view: THREE.Group;
      phase: string;
      targetGrid: { x: number; y: number };
      anim: number;
    }> }).settlementAgents;
    if (!agents) return;

    for (const agent of agents) {
      if (agent.role !== 'farmer') continue;
      const animation = agent.view.userData.farmerAnimation as {
        arms: THREE.Mesh[];
        tool?: THREE.Object3D;
        legs: THREE.Object3D[];
        body?: THREE.Object3D;
        head?: THREE.Object3D;
        basket: THREE.Object3D;
      } | undefined;
      if (!animation) continue;

      const target = this.game.services.state.getCell(agent.targetGrid.x, agent.targetGrid.y);
      const atBarn = target?.kind === 'farm' && target.level === COW_BARN_LEVEL;
      const moving = agent.phase !== 'work';
      const time = performance.now() * 0.001 + agent.anim * 0.1;

      if (moving) {
        const swing = Math.sin(time * 9) * 0.42;
        animation.legs.forEach((leg, index) => { leg.rotation.x = index === 0 ? swing : -swing; });
        animation.arms.forEach((arm, index) => { arm.rotation.z = (index === 0 ? -1 : 1) * 0.2 + Math.sin(time * 9 + index) * 0.16; });
        if (animation.tool) animation.tool.rotation.z = -0.55 + Math.sin(time * 9) * 0.08;
        if (animation.basket) animation.basket.visible = false;
        continue;
      }

      const actionSeed = agent.id ?? Math.floor(agent.anim);
      const actionIndex = Math.floor((agent.anim + actionSeed) / 2.6) % (atBarn ? 3 : 5);
      if (atBarn) {
        if (actionIndex === 0) {
          this.setFarmerAction(animation, 'feed', time);
        } else if (actionIndex === 1) {
          this.setFarmerAction(animation, 'barn-work', time);
        } else {
          this.setFarmerAction(animation, 'rest', time);
        }
      } else {
        if (actionIndex === 0) this.setFarmerAction(animation, 'plant', time);
        else if (actionIndex === 1) this.setFarmerAction(animation, 'harvest', time);
        else if (actionIndex === 2) this.setFarmerAction(animation, 'water', time);
        else if (actionIndex === 3) this.setFarmerAction(animation, 'carry', time);
        else this.setFarmerAction(animation, 'rest', time);
      }
    }
  }

  private setFarmerAction(
    animation: {
      arms: THREE.Mesh[];
      tool?: THREE.Object3D;
      basket: THREE.Object3D;
      body?: THREE.Object3D;
      head?: THREE.Object3D;
    },
    action: 'feed' | 'barn-work' | 'plant' | 'harvest' | 'water' | 'carry' | 'rest',
    time: number,
  ): void {
    const bob = Math.sin(time * 2.4) * 0.018;
    const working = action !== 'rest' && action !== 'carry';

    animation.basket.visible = action === 'carry';
    if (animation.basket.visible) {
      animation.basket.rotation.z = Math.sin(time * 2) * 0.08;
    }

    if (action === 'plant' || action === 'harvest') {
      animation.body && (animation.body.rotation.x = 0.12 + Math.sin(time * 2.8) * 0.05);
      animation.arms[0].rotation.z = -0.62 + Math.sin(time * 4.2) * 0.18;
      animation.arms[1].rotation.z = 0.62 - Math.sin(time * 4.2) * 0.18;
      if (animation.tool) animation.tool.rotation.z = -1.0 + Math.sin(time * 4.2) * 0.25;
    } else if (action === 'water') {
      animation.body && (animation.body.rotation.x = 0.08);
      animation.arms[0].rotation.z = -0.25 + Math.sin(time * 3.2) * 0.12;
      animation.arms[1].rotation.z = 0.48 + Math.sin(time * 3.2) * 0.12;
      if (animation.tool) animation.tool.rotation.z = -0.35 + Math.sin(time * 3.2) * 0.18;
    } else if (action === 'feed') {
      animation.body && (animation.body.rotation.x = 0.18 + Math.sin(time * 2.2) * 0.04);
      animation.arms[0].rotation.z = -0.55 + Math.sin(time * 2.8) * 0.14;
      animation.arms[1].rotation.z = 0.35 + Math.sin(time * 2.8) * 0.12;
      if (animation.tool) animation.tool.rotation.z = -0.12;
    } else if (action === 'barn-work') {
      animation.body && (animation.body.rotation.x = 0.1 + Math.sin(time * 3) * 0.04);
      animation.arms[0].rotation.z = -0.4 + Math.sin(time * 3.8) * 0.16;
      animation.arms[1].rotation.z = 0.4 - Math.sin(time * 3.8) * 0.16;
      if (animation.tool) animation.tool.rotation.z = -0.7 + Math.sin(time * 3.8) * 0.18;
    } else if (action === 'carry') {
      animation.body && (animation.body.rotation.x = 0.02);
      animation.arms[0].rotation.z = -0.2;
      animation.arms[1].rotation.z = 0.2;
      if (animation.tool) animation.tool.rotation.z = -0.35;
    } else {
      animation.body && (animation.body.rotation.x = Math.sin(time * 1.8) * 0.02);
      animation.arms[0].rotation.z = -0.12 + Math.sin(time * 1.6) * 0.04;
      animation.arms[1].rotation.z = 0.12 - Math.sin(time * 1.6) * 0.04;
      if (animation.tool) animation.tool.rotation.z = -0.55;
    }

    if (animation.head) animation.head.rotation.x = bob;
    animation.basket.position.y = 0.55 + bob;
    if (!working && action !== 'carry') animation.basket.visible = false;
  }
}
