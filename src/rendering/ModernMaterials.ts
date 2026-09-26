import * as THREE from 'three';

/** Shared material palette for Modern/Futuristic architecture. */
export class ModernMaterials {
  readonly reinforcedConcrete: THREE.MeshStandardMaterial;
  readonly structuralSteel: THREE.MeshStandardMaterial;
  readonly armoredSteel: THREE.MeshStandardMaterial;
  readonly compositePanel: THREE.MeshStandardMaterial;
  readonly reinforcedGlass: THREE.MeshStandardMaterial;
  readonly industrialMetal: THREE.MeshStandardMaterial;
  readonly modernConcreteFlooring: THREE.MeshStandardMaterial;
  readonly securityLight: THREE.MeshStandardMaterial;

  constructor() {
    this.reinforcedConcrete = new THREE.MeshStandardMaterial({ color: 0x7c8588, roughness: 0.82, metalness: 0.04 });
    this.structuralSteel = new THREE.MeshStandardMaterial({ color: 0x3f4a52, roughness: 0.38, metalness: 0.82 });
    this.armoredSteel = new THREE.MeshStandardMaterial({ color: 0x59666f, roughness: 0.27, metalness: 0.9 });
    this.compositePanel = new THREE.MeshStandardMaterial({ color: 0x263139, roughness: 0.3, metalness: 0.68 });
    this.reinforcedGlass = new THREE.MeshStandardMaterial({
      color: 0x79d6df, roughness: 0.12, metalness: 0.25, transparent: true, opacity: 0.72,
      emissive: 0x0b4c55, emissiveIntensity: 0.8,
    });
    this.industrialMetal = new THREE.MeshStandardMaterial({ color: 0x20282e, roughness: 0.52, metalness: 0.76 });
    this.modernConcreteFlooring = new THREE.MeshStandardMaterial({ color: 0x515b60, roughness: 0.94, metalness: 0.02 });
    this.securityLight = new THREE.MeshStandardMaterial({
      color: 0xa6f8ff, roughness: 0.16, metalness: 0.12, emissive: 0x32d8e5, emissiveIntensity: 2.0,
    });
  }

  dispose(): void {
    for (const material of [
      this.reinforcedConcrete, this.structuralSteel, this.armoredSteel, this.compositePanel,
      this.reinforcedGlass, this.industrialMetal, this.modernConcreteFlooring, this.securityLight,
    ]) material.dispose();
  }
}
