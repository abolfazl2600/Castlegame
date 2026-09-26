import * as THREE from 'three';

const ROTATION_SPEED = 0.32;

export class WindmillSystem {
  private readonly rotors: THREE.Object3D[] = [];

  private readonly bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x8b6a4d, roughness: 0.9 });
  private readonly bodyDarkMaterial = new THREE.MeshStandardMaterial({ color: 0x5b402f, roughness: 0.95 });
  private readonly timberMaterial = new THREE.MeshStandardMaterial({ color: 0x6d472f, roughness: 0.88 });
  private readonly timberLightMaterial = new THREE.MeshStandardMaterial({ color: 0xa37a4e, roughness: 0.86 });
  private readonly roofMaterial = new THREE.MeshStandardMaterial({ color: 0x49352c, roughness: 0.92 });
  private readonly roofAccentMaterial = new THREE.MeshStandardMaterial({ color: 0x6a4935, roughness: 0.9 });
  private readonly windowMaterial = new THREE.MeshStandardMaterial({ color: 0x25201c, roughness: 1 });

  private readonly bodyGeometry = new THREE.CylinderGeometry(1.75, 2.15, 5.3, 8);
  private readonly roofGeometry = new THREE.ConeGeometry(2.28, 1.8, 8);
  private readonly roofBandGeometry = new THREE.CylinderGeometry(2.18, 2.18, 0.18, 8);
  private readonly beamGeometry = new THREE.BoxGeometry(0.22, 4.75, 0.24);
  private readonly crossBeamGeometry = new THREE.BoxGeometry(3.15, 0.2, 0.22);
  private readonly windowGeometry = new THREE.BoxGeometry(0.32, 0.72, 0.12);
  private readonly sailGeometry = new THREE.BoxGeometry(0.3, 2.65, 0.14);
  private readonly sailClothGeometry = new THREE.BoxGeometry(0.08, 2.15, 0.08);
  private readonly hubGeometry = new THREE.CylinderGeometry(0.34, 0.34, 0.58, 12);

  create(group: THREE.Group): void {
    const body = new THREE.Mesh(this.bodyGeometry, this.bodyMaterial);
    body.position.y = 2.65;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    const roof = new THREE.Mesh(this.roofGeometry, this.roofMaterial);
    roof.position.y = 6.2;
    roof.rotation.y = Math.PI / 8;
    roof.castShadow = true;
    group.add(roof);

    const roofBand = new THREE.Mesh(this.roofBandGeometry, this.roofAccentMaterial);
    roofBand.position.y = 5.42;
    roofBand.castShadow = true;
    group.add(roofBand);

    for (const rotation of [0, Math.PI / 2]) {
      const beam = new THREE.Mesh(this.beamGeometry, this.timberMaterial);
      beam.position.y = 2.72;
      beam.rotation.y = rotation;
      beam.castShadow = true;
      group.add(beam);
    }

    for (const rotation of [Math.PI / 4, -Math.PI / 4]) {
      const beam = new THREE.Mesh(this.crossBeamGeometry, this.bodyDarkMaterial);
      beam.position.y = 2.7;
      beam.rotation.z = rotation;
      beam.castShadow = true;
      group.add(beam);
    }

    for (const y of [2.15, 3.55]) {
      const window = new THREE.Mesh(this.windowGeometry, this.windowMaterial);
      window.position.set(0, y, -2.08);
      window.castShadow = true;
      group.add(window);
    }

    const rotor = new THREE.Group();
    rotor.position.set(0, 4.1, -2.18);
    rotor.userData.windmillRotor = true;
    group.add(rotor);

    const hub = new THREE.Mesh(this.hubGeometry, this.bodyDarkMaterial);
    hub.rotation.x = Math.PI / 2;
    hub.castShadow = true;
    rotor.add(hub);

    for (let index = 0; index < 4; index += 1) {
      const blade = new THREE.Group();
      blade.rotation.z = index * Math.PI / 2;

      const timber = new THREE.Mesh(this.sailGeometry, this.timberMaterial);
      timber.position.y = 1.35;
      timber.castShadow = true;
      blade.add(timber);

      const cloth = new THREE.Mesh(this.sailClothGeometry, this.timberLightMaterial);
      cloth.position.set(0.18, 1.35, 0.02);
      cloth.castShadow = true;
      blade.add(cloth);

      rotor.add(blade);
    }

    this.rotors.push(rotor);
  }

  clear(): void {
    this.rotors.length = 0;
  }

  update(deltaSeconds: number): void {
    if (deltaSeconds <= 0 || this.rotors.length === 0) return;
    const step = Math.min(deltaSeconds, 0.05);
    const rotationDelta = ROTATION_SPEED * step;
    for (const rotor of this.rotors) rotor.rotation.z += rotationDelta;
  }
}
