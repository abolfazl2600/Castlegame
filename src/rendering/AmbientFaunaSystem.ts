import * as THREE from 'three';
import type { TerrainKind } from '../core/types';

export interface FaunaWorld {
  size: number;
  seed: number;
  terrainAt: (x: number, y: number) => TerrainKind;
  elevationAt: (x: number, y: number) => number;
  blockedAt: (x: number, y: number) => boolean;
  farmAt: (x: number, y: number) => boolean;
  toWorld: (x: number, y: number) => { x: number; z: number };
}

interface Llama {
  root: THREE.Group;
  head: THREE.Object3D;
  legs: THREE.Object3D[];
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  idleUntil: number;
  decisions: number;
  phase: number;
}

interface Bird {
  root: THREE.Group;
  left: THREE.Group;
  right: THREE.Group;
  centerX: number;
  centerZ: number;
  radius: number;
  phase: number;
  altitude: number;
}

function hash(seed: number, x: number, y: number, salt = 0): number {
  let value = Math.imul((seed | 0) ^ Math.imul(x + 47, 73856093) ^ Math.imul(y + 31, 19349663) ^ salt, 83492791);
  value = Math.imul(value ^ value >>> 16, 2246822519);
  return ((value ^ value >>> 13) >>> 0) / 4294967296;
}

/** Decorative only: no GameState writes, collision objects or pathfinding agents. */
export class AmbientFaunaSystem {
  readonly layer = new THREE.Group();
  private readonly llamas: Llama[] = [];
  private readonly birds: Bird[] = [];
  private readonly bodyGeometry = new THREE.BoxGeometry(0.9, 0.65, 1.25);
  private readonly neckGeometry = new THREE.BoxGeometry(0.32, 0.85, 0.34);
  private readonly headGeometry = new THREE.BoxGeometry(0.4, 0.32, 0.46);
  private readonly legGeometry = new THREE.BoxGeometry(0.16, 0.55, 0.16);
  private readonly earGeometry = new THREE.ConeGeometry(0.12, 0.38, 4);
  private readonly wingGeometry = new THREE.BoxGeometry(0.68, 0.06, 0.22);
  private readonly birdBodyGeometry = new THREE.ConeGeometry(0.18, 0.7, 4);
  private readonly llamaMaterial = new THREE.MeshStandardMaterial({ color: 0xc6ad88, roughness: 1 });
  private readonly llamaAccent = new THREE.MeshStandardMaterial({ color: 0x755844, roughness: 1 });
  private readonly birdMaterial = new THREE.MeshStandardMaterial({ color: 0x343e49, roughness: 1, side: THREE.DoubleSide });
  private world: FaunaWorld | null = null;
  private signature = '';

  get counts(): { llamas: number; birds: number } {
    return { llamas: this.llamas.length, birds: this.birds.length };
  }

  rebuild(world: FaunaWorld, quality: 'low' | 'medium' | 'high'): void {
    const valid: Array<{ x: number; y: number; score: number }> = [];
    let fingerprint = world.seed | 0;
    const farms: Array<{ x: number; y: number }> = [];
    for (let y = 2; y < world.size - 2; y += 1) {
      for (let x = 2; x < world.size - 2; x += 1) {
        if (world.farmAt(x, y)) farms.push({ x, y });
        if (!this.isValid(world, x, y)) continue;
        fingerprint = Math.imul(fingerprint ^ (x + y * world.size), 16777619);
        valid.push({ x, y, score: hash(world.seed, x, y) });
      }
    }
    const signature = `${world.seed}:${quality}:${fingerprint}:${farms.map((farm) => `${farm.x},${farm.y}`).join(';')}`;
    this.world = world;
    if (signature === this.signature) return;
    this.clear();
    this.signature = signature;
    valid.sort((a, b) => {
      const score = (point: typeof a) => point.score - (farms.some((farm) => Math.hypot(farm.x - point.x, farm.y - point.y) < 6) ? 0.4 : 0);
      return score(a) - score(b) || a.y - b.y || a.x - b.x;
    });
    const chosen: typeof valid = [];
    for (const candidate of valid) {
      if (chosen.length >= (quality === 'low' ? 2 : 4)) break;
      if (chosen.some((point) => Math.hypot(point.x - candidate.x, point.y - candidate.y) < 6)) continue;
      chosen.push(candidate);
      this.addLlama(world, candidate.x, candidate.y, chosen.length);
    }
    const birdCount = quality === 'low' ? 4 : 7;
    for (let i = 0; i < birdCount; i += 1) this.addBird(world, i);
  }

  update(deltaMs: number, timeMs: number, options: {
    reducedMotion: boolean; animationScale: number; cameraDistance: number;
    normalDistance: number; strategicDistance: number;
  }): void {
    if (!this.world) return;
    const motion = options.reducedMotion ? 0.08 : Math.max(0.12, options.animationScale);
    this.layer.visible = options.cameraDistance < (options.normalDistance + options.strategicDistance) / 2 + 6;
    if (!this.layer.visible) return;
    for (const llama of this.llamas) {
      if (timeMs >= llama.idleUntil && llama.x === llama.targetX && llama.y === llama.targetY) {
        this.chooseDestination(llama, timeMs);
      }
      const target = this.world.toWorld(llama.targetX, llama.targetY);
      const dx = target.x - llama.root.position.x;
      const dz = target.z - llama.root.position.z;
      const distance = Math.hypot(dx, dz);
      const moving = distance > 0.05 && motion > 0.1;
      if (moving) {
        const step = Math.min(distance, deltaMs * 0.00042 * motion);
        llama.root.position.x += dx / distance * step;
        llama.root.position.z += dz / distance * step;
        llama.root.position.y += (this.world.elevationAt(llama.targetX, llama.targetY) + 2.18 - llama.root.position.y) * Math.min(1, step / distance);
        llama.root.rotation.y = Math.atan2(dx, dz);
      } else if (distance <= 0.05) {
        llama.root.position.x = target.x;
        llama.root.position.z = target.z;
        if (llama.x !== llama.targetX || llama.y !== llama.targetY) {
          llama.idleUntil = Math.max(llama.idleUntil, timeMs + 1400 +
            hash(this.world.seed, llama.targetX, llama.targetY, llama.decisions) * 3200);
        }
        llama.x = llama.targetX;
        llama.y = llama.targetY;
      }
      const gait = moving ? Math.sin(timeMs * 0.007 * motion + llama.phase) * 0.22 : 0;
      llama.legs.forEach((leg, index) => { leg.rotation.x = gait * (index % 2 ? -1 : 1); });
      llama.head.rotation.x = moving ? 0 : 0.14 + Math.sin(timeMs * 0.0012 + llama.phase) * 0.12;
    }
    for (const bird of this.birds) {
      const angle = timeMs * 0.00012 * motion + bird.phase;
      bird.root.position.set(
        bird.centerX + Math.cos(angle) * bird.radius,
        bird.altitude + Math.sin(angle * 2.3) * 1.1,
        bird.centerZ + Math.sin(angle) * bird.radius * 0.7,
      );
      bird.root.rotation.y = -angle;
      const flap = Math.sin(timeMs * 0.011 * motion + bird.phase * 4) * 0.52;
      bird.left.rotation.z = flap;
      bird.right.rotation.z = -flap;
    }
  }

  clear(): void {
    this.layer.clear();
    this.llamas.length = 0;
    this.birds.length = 0;
    this.signature = '';
  }

  dispose(): void {
    this.clear();
    for (const geometry of [this.bodyGeometry, this.neckGeometry, this.headGeometry, this.legGeometry,
      this.earGeometry, this.wingGeometry, this.birdBodyGeometry]) geometry.dispose();
    this.llamaMaterial.dispose();
    this.llamaAccent.dispose();
    this.birdMaterial.dispose();
  }

  private isValid(world: FaunaWorld, x: number, y: number): boolean {
    if (x < 1 || y < 1 || x >= world.size - 1 || y >= world.size - 1) return false;
    const terrain = world.terrainAt(x, y);
    if (terrain !== 'plains' && terrain !== 'forest' && terrain !== 'shore') return false;
    if (world.blockedAt(x, y)) return false;
    const elevation = world.elevationAt(x, y);
    return [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dy]) =>
      Math.abs(elevation - world.elevationAt(x + dx, y + dy)) < 1.2);
  }

  private addLlama(world: FaunaWorld, x: number, y: number, index: number): void {
    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);
    const add = (geometry: THREE.BufferGeometry, material: THREE.Material, px: number, py: number, pz: number) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(px, py, pz);
      mesh.castShadow = false;
      body.add(mesh);
      return mesh;
    };
    add(this.bodyGeometry, this.llamaMaterial, 0, 1.05, 0);
    add(this.neckGeometry, this.llamaMaterial, 0, 1.58, 0.46);
    const head = add(this.headGeometry, this.llamaMaterial, 0, 2.03, 0.53);
    add(this.earGeometry, this.llamaAccent, -0.15, 2.37, 0.5);
    add(this.earGeometry, this.llamaAccent, 0.15, 2.37, 0.5);
    const legs: THREE.Object3D[] = [];
    for (const px of [-0.3, 0.3]) for (const pz of [-0.42, 0.42]) {
      legs.push(add(this.legGeometry, this.llamaAccent, px, 0.5, pz));
    }
    const position = world.toWorld(x, y);
    root.position.set(position.x, world.elevationAt(x, y) + 2.18, position.z);
    this.layer.add(root);
    this.llamas.push({ root, head, legs, x, y, targetX: x, targetY: y, idleUntil: index * 900,
      decisions: 0, phase: hash(world.seed, x, y, 9) * Math.PI * 2 });
  }

  private chooseDestination(llama: Llama, timeMs: number): void {
    if (!this.world) return;
    llama.decisions += 1;
    const seed = this.world.seed;
    const roll = hash(seed, llama.x, llama.y, llama.decisions);
    if (roll < 0.4) {
      llama.idleUntil = timeMs + 1000 + roll * 6500;
      return;
    }
    for (let i = 0; i < 8; i += 1) {
      const direction = Math.floor(hash(seed, llama.x, llama.decisions, i * 2) * 4);
      const dx = [1, -1, 0, 0][direction];
      const dy = [0, 0, 1, -1][direction];
      const x = llama.x + dx;
      const y = llama.y + dy;
      if (!this.isValid(this.world, x, y)) continue;
      llama.targetX = x;
      llama.targetY = y;
      llama.idleUntil = timeMs + 1800 + roll * 2800;
      return;
    }
    llama.idleUntil = timeMs + 2500;
  }

  private addBird(world: FaunaWorld, index: number): void {
    const root = new THREE.Group();
    const body = new THREE.Mesh(this.birdBodyGeometry, this.birdMaterial);
    body.rotation.x = Math.PI / 2;
    root.add(body);
    const left = new THREE.Group();
    const right = new THREE.Group();
    const leftWing = new THREE.Mesh(this.wingGeometry, this.birdMaterial);
    const rightWing = new THREE.Mesh(this.wingGeometry, this.birdMaterial);
    leftWing.position.x = -0.36;
    rightWing.position.x = 0.36;
    left.add(leftWing);
    right.add(rightWing);
    root.add(left, right);
    const center = world.toWorld(Math.floor(world.size / 2), Math.floor(world.size / 2));
    const phase = hash(world.seed, index, 0, 73) * Math.PI * 2;
    this.birds.push({ root, left, right, centerX: center.x, centerZ: center.z,
      radius: 17 + index * 3, phase, altitude: 19 + index * 1.4 });
    this.layer.add(root);
  }
}
