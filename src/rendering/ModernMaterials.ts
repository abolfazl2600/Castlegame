import * as THREE from 'three';
import { MODERN_STYLE } from './ModernStyle';

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
  readonly warningStripe: THREE.MeshStandardMaterial;

  constructor() {
    const { palette, material } = MODERN_STYLE;
    this.reinforcedConcrete = new THREE.MeshStandardMaterial({
      color: palette.reinforcedConcrete,
      roughness: material.concreteRoughness,
      metalness: material.concreteMetalness,
    });
    this.structuralSteel = new THREE.MeshStandardMaterial({
      color: palette.structuralSteel,
      roughness: material.steelRoughness,
      metalness: material.steelMetalness,
    });
    this.armoredSteel = new THREE.MeshStandardMaterial({
      color: palette.armoredSteel,
      roughness: material.armorRoughness,
      metalness: material.armorMetalness,
    });
    this.compositePanel = new THREE.MeshStandardMaterial({
      color: palette.compositePanel,
      roughness: material.panelRoughness,
      metalness: material.panelMetalness,
    });
    this.reinforcedGlass = new THREE.MeshStandardMaterial({
      color: palette.reinforcedGlass,
      roughness: material.glassRoughness,
      metalness: material.glassMetalness,
      transparent: true,
      opacity: material.glassOpacity,
      emissive: palette.glassEmissive,
      emissiveIntensity: material.glassEmissiveIntensity,
    });
    this.industrialMetal = new THREE.MeshStandardMaterial({
      color: palette.industrialMetal,
      roughness: material.industrialRoughness,
      metalness: material.industrialMetalness,
    });
    this.modernConcreteFlooring = new THREE.MeshStandardMaterial({
      color: palette.concreteFlooring,
      roughness: material.floorRoughness,
      metalness: material.floorMetalness,
    });
    this.securityLight = new THREE.MeshStandardMaterial({
      color: palette.securityLight,
      roughness: material.lightRoughness,
      metalness: material.lightMetalness,
      emissive: palette.securityEmissive,
      emissiveIntensity: material.lightEmissiveIntensity,
    });
    this.warningStripe = new THREE.MeshStandardMaterial({
      color: palette.warningStripe,
      roughness: material.warningRoughness,
      metalness: material.warningMetalness,
    });
  }

  isSharedMaterial(material: THREE.Material): boolean {
    return (
      material === this.reinforcedConcrete ||
      material === this.structuralSteel ||
      material === this.armoredSteel ||
      material === this.compositePanel ||
      material === this.reinforcedGlass ||
      material === this.industrialMetal ||
      material === this.modernConcreteFlooring ||
      material === this.securityLight ||
      material === this.warningStripe
    );
  }

  dispose(): void {
    for (const material of [
      this.reinforcedConcrete,
      this.structuralSteel,
      this.armoredSteel,
      this.compositePanel,
      this.reinforcedGlass,
      this.industrialMetal,
      this.modernConcreteFlooring,
      this.securityLight,
      this.warningStripe,
    ]) {
      material.dispose();
    }
  }
}
