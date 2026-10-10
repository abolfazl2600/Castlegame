import type * as THREE from 'three';
import type { CellEntry } from '../state/GameState';

/** Explicit integration points for optional gameplay systems. */
export interface GameExtension {
  createBuilding?(cell: CellEntry): THREE.Group | undefined;
  /** Explicit override scope. Absent means arbitrary cell types may be overridden. */
  buildingKinds?: readonly CellEntry['kind'][];
  decoratePerson?(person: THREE.Group, role: string, seed: number): void;
  updateSettlement?(deltaMs: number): void;
  onToolSelected?(tool: string | null): void;
  onBuildPanelRefreshed?(): void;
}
