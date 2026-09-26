import * as THREE from 'three';

export type GateState = 'open' | 'closing' | 'closed' | 'opening';

interface GateRuntime {
  key: string;
  root: THREE.Group;
  door: THREE.Group;
  state: GateState;
  progress: number;
  targetClosed: boolean;
  guards: THREE.Group[];
}

export class GateSystem {
  private readonly gates = new Map<string, GateRuntime>();
  private attackActive = false;
  private readonly guardBody = new THREE.MeshStandardMaterial({
    color: 0x4d5660,
    roughness: 0.88,
    metalness: 0.08,
  });
  private readonly guardWood = new THREE.MeshStandardMaterial({
    color: 0x5e402d,
    roughness: 0.94,
  });
  private readonly guardSkin = new THREE.MeshStandardMaterial({
    color: 0xb98567,
    roughness: 0.9,
  });

  constructor() {}

  clear(): void {
    this.gates.clear();
  }

  registerGate(
    x: number,
    y: number,
    root: THREE.Group,
    door: THREE.Group,
    vertical: boolean,
  ): void {
    const key = this.key(x, y);
    const existing = this.gates.get(key);
    if (existing) return;

    const guards = this.createGuards(root, vertical);
    const runtime: GateRuntime = {
      key,
      root,
      door,
      state: 'open',
      progress: 0,
      targetClosed: this.attackActive,
      guards,
    };

    if (runtime.targetClosed) {
      runtime.state = 'closing';
      runtime.progress = 0;
    }

    this.gates.set(key, runtime);
  }

  setAttackState(active: boolean): void {
    if (this.attackActive === active) return;
    this.attackActive = active;

    for (const gate of this.gates.values()) {
      if (gate.targetClosed === active) continue;
      gate.targetClosed = active;
      gate.state = active ? 'closing' : 'opening';
    }

  }

  isGatePassable(x: number, y: number): boolean {
    const gate = this.gates.get(this.key(x, y));
    if (!gate) return !this.attackActive;
    return gate.state === 'open';
  }

  stateAt(x: number, y: number): GateState {
    return this.gates.get(this.key(x, y))?.state ?? (this.attackActive ? 'closing' : 'open');
  }

  update(deltaSeconds: number): void {
    const step = Math.min(1, Math.max(0, deltaSeconds) / 1.15);

    for (const gate of this.gates.values()) {
      if (gate.targetClosed && gate.progress < 1) {
        gate.progress = Math.min(1, gate.progress + step);
        gate.door.position.y = -this.easeInOut(gate.progress) * 3.25;
        if (gate.progress >= 1) {
          gate.state = 'closed';
          gate.door.position.y = -3.25;
              }
      } else if (!gate.targetClosed && gate.progress > 0) {
        gate.progress = Math.max(0, gate.progress - step);
        gate.door.position.y = -this.easeInOut(gate.progress) * 3.25;
        if (gate.progress <= 0) {
          gate.state = 'open';
          gate.door.position.y = 0;
              }
      }

      for (const guard of gate.guards) {
        const threat = gate.targetClosed ? 1 : 0;
        guard.userData.gateGuardThreat = threat;
        guard.rotation.y += (gate.targetClosed ? 0.35 : 0.08) * deltaSeconds;
      }
    }
  }

  private createGuards(root: THREE.Group, vertical: boolean): THREE.Group[] {
    const result: THREE.Group[] = [];
    const offsets = vertical
      ? [
          { x: -1.9, z: 0 },
          { x: 1.9, z: 0 },
        ]
      : [
          { x: 0, z: -1.9 },
          { x: 0, z: 1.9 },
        ];

    for (const offset of offsets) {
      const guard = new THREE.Group();
      guard.position.set(offset.x, 2.22, offset.z);

      const body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.85, 0.32), this.guardBody);
      body.position.y = 0.48;
      body.castShadow = true;
      guard.add(body);

      const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), this.guardSkin);
      head.position.y = 1.08;
      head.castShadow = true;
      guard.add(head);

      const helmet = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.23, 0.16, 8), this.guardBody);
      helmet.position.y = 1.22;
      helmet.castShadow = true;
      guard.add(helmet);

      const spear = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 1.9, 6), this.guardWood);
      spear.position.set(0.42, 0.9, 0.05);
      spear.rotation.z = -0.14;
      spear.castShadow = true;
      guard.add(spear);

      root.add(guard);
      result.push(guard);
    }

    return result;
  }

  private easeInOut(value: number): number {
    return value * value * (3 - 2 * value);
  }

  private key(x: number, y: number): string {
    return `${x},${y}`;
  }
}
