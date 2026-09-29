import * as THREE from 'three';
import type { SettingsData } from '../settings/SettingsModel';
import { WORLD_STYLE } from './WorldStyle';

export type DistanceDetailBand = 'inspection' | 'gameplay' | 'strategic';
export type MemoryPressureLevel = 'normal' | 'elevated' | 'critical';

export const GAME_MEMORY_BUDGET_BYTES = 2 * 1024 * 1024 * 1024;
const MEMORY_ELEVATED_RATIO = 0.75;
const MEMORY_CRITICAL_RATIO = 0.9;

export interface VisualPerformanceBudget {
  drawCalls: number;
  animatedObjects: number;
  particles: number;
  shadowCasters: number;
  highDetailMeshes: number;
  pixelRatioScale: number;
  animationScale: number;
}

export interface VisualBudgetSnapshot {
  band: DistanceDetailBand;
  mobile: boolean;
  budget: VisualPerformanceBudget;
  activeShadowCasters: number;
  baselineShadowCasters: number;
  activeHighDetailMeshes: number;
  baselineHighDetailMeshes: number;
  suppressedHighDetailMeshes: number;
  estimatedDrawCalls: number;
  baselineEstimatedDrawCalls: number;
  suppressedEstimatedDrawCalls: number;
  memoryBudgetBytes: number;
  heapBytes: number | null;
  memoryPressure: MemoryPressureLevel;
}

const DESKTOP_BUDGETS: Record<DistanceDetailBand, VisualPerformanceBudget> = {
  inspection: {
    drawCalls: 950,
    animatedObjects: 180,
    particles: 160,
    shadowCasters: 220,
    highDetailMeshes: 520,
    pixelRatioScale: 1,
    animationScale: 1,
  },
  gameplay: {
    drawCalls: 760,
    animatedObjects: 120,
    particles: 96,
    shadowCasters: 150,
    highDetailMeshes: 360,
    pixelRatioScale: 0.92,
    animationScale: 0.78,
  },
  strategic: {
    drawCalls: 620,
    animatedObjects: 72,
    particles: 48,
    shadowCasters: 84,
    highDetailMeshes: 220,
    pixelRatioScale: 0.78,
    animationScale: 0.48,
  },
};

const MOBILE_BUDGETS: Record<DistanceDetailBand, VisualPerformanceBudget> = {
  inspection: {
    drawCalls: 620,
    animatedObjects: 96,
    particles: 72,
    shadowCasters: 96,
    highDetailMeshes: 280,
    pixelRatioScale: 0.82,
    animationScale: 0.72,
  },
  gameplay: {
    drawCalls: 520,
    animatedObjects: 64,
    particles: 48,
    shadowCasters: 64,
    highDetailMeshes: 210,
    pixelRatioScale: 0.72,
    animationScale: 0.56,
  },
  strategic: {
    drawCalls: 430,
    animatedObjects: 40,
    particles: 24,
    shadowCasters: 36,
    highDetailMeshes: 140,
    pixelRatioScale: 0.62,
    animationScale: 0.34,
  },
};

const BAND_HYSTERESIS = 4;
const GENERIC_MICRO_DETAIL_RADIUS = 2.4;
const PROP_HEAVY_MICRO_DETAIL_RADIUS = 3.4;
const PRIORITY_MICRO_DETAIL_RADIUS = 2.6;

function currentHeapBytes(): number | null {
  const memory = (performance as Performance & {
    memory?: { usedJSHeapSize?: number };
  }).memory;
  const value = memory?.usedJSHeapSize;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function resolveMemoryPressure(heapBytes: number | null): MemoryPressureLevel {
  if (heapBytes === null) return 'normal';
  const ratio = heapBytes / GAME_MEMORY_BUDGET_BYTES;
  if (ratio >= MEMORY_CRITICAL_RATIO) return 'critical';
  if (ratio >= MEMORY_ELEVATED_RATIO) return 'elevated';
  return 'normal';
}

function memoryAdjustedBudget(
  budget: VisualPerformanceBudget,
  pressure: MemoryPressureLevel,
): VisualPerformanceBudget {
  if (pressure === 'normal') return budget;
  const scale = pressure === 'critical' ? 0.48 : 0.72;
  const rasterScale = pressure === 'critical' ? 0.72 : 0.86;
  return {
    ...budget,
    drawCalls: Math.max(1, Math.floor(budget.drawCalls * scale)),
    animatedObjects: Math.max(1, Math.floor(budget.animatedObjects * scale)),
    particles: Math.max(0, Math.floor(budget.particles * scale)),
    shadowCasters: Math.max(0, Math.floor(budget.shadowCasters * scale)),
    highDetailMeshes: Math.max(0, Math.floor(budget.highDetailMeshes * scale)),
    pixelRatioScale: budget.pixelRatioScale * rasterScale,
    animationScale: budget.animationScale * scale,
  };
}

function settingsPixelRatioScale(settings: SettingsData): number {
  const quality =
    settings.graphics.quality === 'low' ? 0.75 :
    settings.graphics.quality === 'medium' ? 1 :
    1.35;
  const performance =
    settings.graphics.performanceMode === 'performance' ? 0.75 :
    settings.graphics.performanceMode === 'quality' ? 1.15 :
    1;
  return quality * performance;
}

function parentHasReadabilityPriority(object: THREE.Object3D): boolean {
  let current: THREE.Object3D | null = object;
  while (current) {
    if (
      current.userData.defenseSilhouette ||
      current.userData.settlementReadabilityClass === 'landmark' ||
      current.userData.cellKind === 'keep' ||
      current.userData.distanceDetailPriority === 'silhouette'
    ) return true;
    current = current.parent;
  }
  return false;
}

function parentHasPropHeavyContext(object: THREE.Object3D): boolean {
  let current: THREE.Object3D | null = object;
  while (current) {
    if (
      current.userData.activeFarm ||
      current.userData.cowBarnLevel ||
      current.userData.harborLevel ||
      current.userData.armyCampLevel
    ) return true;
    current = current.parent;
  }
  return false;
}

function estimatedDrawCost(object: THREE.Object3D): number {
  if (!(object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Points)) return 0;
  const material = object.material;
  return Array.isArray(material) ? Math.max(1, material.length) : 1;
}

function worldRadius(mesh: THREE.Mesh): number {
  if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
  const radius = mesh.geometry.boundingSphere?.radius ?? Number.POSITIVE_INFINITY;
  const scale = new THREE.Vector3();
  mesh.getWorldScale(scale);
  return radius * Math.max(Math.abs(scale.x), Math.abs(scale.y), Math.abs(scale.z));
}

function detailBudgetRoot(object: THREE.Object3D): THREE.Object3D | null {
  let current: THREE.Object3D | null = object.parent;
  while (current && !(current instanceof THREE.Scene)) {
    if (
      current.userData.cellKey ||
      current.userData.defenseSilhouette ||
      current.userData.settlementReadabilityClass === 'landmark' ||
      current.userData.visualRefs
    ) return current;
    current = current.parent;
  }
  return null;
}

function isSuppressibleMicroDetail(mesh: THREE.Mesh): boolean {
  if (mesh instanceof THREE.InstancedMesh || mesh instanceof THREE.SkinnedMesh) return false;
  if (mesh.userData.distanceDetailPriority === 'silhouette') return false;
  if (mesh.userData.distanceDetailPriority === 'micro') return true;
  if (mesh.userData.waterLayer || mesh.userData.godModeMarker) return false;

  const threshold = parentHasReadabilityPriority(mesh)
    ? PRIORITY_MICRO_DETAIL_RADIUS
    : parentHasPropHeavyContext(mesh)
      ? PROP_HEAVY_MICRO_DETAIL_RADIUS
      : GENERIC_MICRO_DETAIL_RADIUS;
  return worldRadius(mesh) <= threshold;
}

function coreMeshesPerRoot(band: DistanceDetailBand, mobile: boolean): number {
  if (band === 'inspection') return mobile ? 2 : 3;
  return 1;
}

function detailDrawAllowance(
  budget: VisualPerformanceBudget,
  band: DistanceDetailBand,
  mobile: boolean,
): number {
  const fraction =
    band === 'inspection'
      ? (mobile ? 0.25 : 0.42)
      : band === 'gameplay'
        ? (mobile ? 0.18 : 0.35)
        : (mobile ? 0.05 : 0.12);
  return Math.max(0, Math.floor(budget.drawCalls * fraction));
}

interface DetailBudgetResult {
  activeHighDetailMeshes: number;
  baselineHighDetailMeshes: number;
  suppressedHighDetailMeshes: number;
  estimatedDrawCalls: number;
  baselineEstimatedDrawCalls: number;
  suppressedEstimatedDrawCalls: number;
}

/**
 * Camera-distance performance governor.
 *
 * Silhouette-defining geometry is never removed. The governor suppresses only
 * stable, small micro-detail meshes at band transitions, while also reducing
 * raster cost, ambient animation work and active shadow casters. Hysteresis
 * keeps normal camera movement from rapidly toggling detail around thresholds.
 */
export class DistanceDetailBudgetSystem {
  private band: DistanceDetailBand = 'gameplay';
  private readonly baseShadowCaster = new WeakMap<THREE.Object3D, boolean>();
  private readonly detailHidden = new WeakSet<THREE.Object3D>();
  private lastProfileKey = '';
  private lastSnapshot: VisualBudgetSnapshot = {
    band: 'gameplay',
    mobile: false,
    budget: DESKTOP_BUDGETS.gameplay,
    activeShadowCasters: 0,
    baselineShadowCasters: 0,
    activeHighDetailMeshes: 0,
    baselineHighDetailMeshes: 0,
    suppressedHighDetailMeshes: 0,
    estimatedDrawCalls: 0,
    baselineEstimatedDrawCalls: 0,
    suppressedEstimatedDrawCalls: 0,
    memoryBudgetBytes: GAME_MEMORY_BUDGET_BYTES,
    heapBytes: null,
    memoryPressure: 'normal',
  };

  update(
    scene: THREE.Scene,
    renderer: THREE.WebGLRenderer,
    cameraDistance: number,
    settings: SettingsData,
    mobile: boolean,
  ): VisualBudgetSnapshot {
    this.band = this.resolveBand(cameraDistance);
    const heapBytes = currentHeapBytes();
    const memoryPressure = resolveMemoryPressure(heapBytes);
    const baseBudget = (mobile ? MOBILE_BUDGETS : DESKTOP_BUDGETS)[this.band];
    const budget = memoryAdjustedBudget(baseBudget, memoryPressure);

    const profileKey = [
      this.band,
      mobile ? 'mobile' : 'desktop',
      settings.graphics.quality,
      settings.graphics.performanceMode,
      settings.graphics.shadowsEnabled ? 'shadows' : 'no-shadows',
      memoryPressure,
    ].join(':');

    const previousFrameOverBudget = renderer.info.render.calls > budget.drawCalls;
    if (profileKey !== this.lastProfileKey || previousFrameOverBudget) {
      const maxPixelRatio = Math.min(window.devicePixelRatio, 2);
      const ratio = THREE.MathUtils.clamp(
        settingsPixelRatioScale(settings) * budget.pixelRatioScale,
        0.6,
        maxPixelRatio,
      );
      renderer.setPixelRatio(ratio);
      renderer.shadowMap.enabled =
        settings.graphics.shadowsEnabled &&
        settings.graphics.quality !== 'low' &&
        budget.shadowCasters > 0;

      const detail = this.applyDetailBudget(scene, budget, this.band, mobile);
      const shadow = this.applyShadowBudget(scene, budget.shadowCasters, renderer.shadowMap.enabled);
      const estimatedDrawCalls = detail.estimatedDrawCalls + shadow.activeShadowCasters;
      const baselineEstimatedDrawCalls =
        detail.baselineEstimatedDrawCalls + shadow.baselineShadowCasters;
      this.lastSnapshot = {
        band: this.band,
        mobile,
        budget,
        ...detail,
        ...shadow,
        estimatedDrawCalls,
        baselineEstimatedDrawCalls,
        suppressedEstimatedDrawCalls: Math.max(0, baselineEstimatedDrawCalls - estimatedDrawCalls),
        memoryBudgetBytes: GAME_MEMORY_BUDGET_BYTES,
        heapBytes,
        memoryPressure,
      };
      scene.userData.visualPerformanceBudget = {
        band: this.band,
        mobile,
        ...budget,
        activeHighDetailMeshes: detail.activeHighDetailMeshes,
        estimatedDrawCalls: this.lastSnapshot.estimatedDrawCalls,
        memoryBudgetBytes: GAME_MEMORY_BUDGET_BYTES,
        heapBytes,
        memoryPressure,
      };
      this.lastProfileKey = profileKey;
    }

    return this.lastSnapshot;
  }

  snapshot(): VisualBudgetSnapshot {
    return this.lastSnapshot;
  }

  invalidate(): void {
    this.lastProfileKey = '';
  }

  private resolveBand(distance: number): DistanceDetailBand {
    const refs = WORLD_STYLE.camera.referenceDistances;
    const inspectionBoundary = (refs.nearInspection + refs.normalGameplay) / 2;
    const strategicBoundary = (refs.normalGameplay + refs.maximumStrategic) / 2;

    if (this.band === 'inspection') {
      if (distance > inspectionBoundary + BAND_HYSTERESIS) {
        return distance > strategicBoundary + BAND_HYSTERESIS ? 'strategic' : 'gameplay';
      }
      return 'inspection';
    }

    if (this.band === 'strategic') {
      if (distance < strategicBoundary - BAND_HYSTERESIS) {
        return distance < inspectionBoundary - BAND_HYSTERESIS ? 'inspection' : 'gameplay';
      }
      return 'strategic';
    }

    if (distance < inspectionBoundary - BAND_HYSTERESIS) return 'inspection';
    if (distance > strategicBoundary + BAND_HYSTERESIS) return 'strategic';
    return 'gameplay';
  }

  private restoreSuppressedDetail(scene: THREE.Scene): void {
    scene.traverse((object) => {
      if (!this.detailHidden.has(object)) return;
      object.visible = true;
      this.detailHidden.delete(object);
    });
  }

  private applyDetailBudget(
    scene: THREE.Scene,
    budget: VisualPerformanceBudget,
    band: DistanceDetailBand,
    mobile: boolean,
  ): DetailBudgetResult {
    this.restoreSuppressedDetail(scene);
    scene.updateMatrixWorld(true);

    type DetailCandidate = {
      mesh: THREE.Mesh;
      radius: number;
      drawCost: number;
      order: number;
    };

    const candidates: DetailCandidate[] = [];
    const rootedMeshes = new Map<THREE.Object3D, DetailCandidate[]>();
    let traversalOrder = 0;
    let baselineEstimatedDrawCalls = 0;
    let protectedDrawCalls = 0;

    scene.traverse((object) => {
      if (!object.visible) return;
      const drawCost = estimatedDrawCost(object);
      if (drawCost <= 0) return;
      baselineEstimatedDrawCalls += drawCost;

      if (!(object instanceof THREE.Mesh)) {
        protectedDrawCalls += drawCost;
        traversalOrder += 1;
        return;
      }

      const candidate: DetailCandidate = {
        mesh: object,
        radius: worldRadius(object),
        drawCost,
        order: traversalOrder,
      };
      const root = detailBudgetRoot(object);
      if (root) {
        const group = rootedMeshes.get(root) ?? [];
        group.push(candidate);
        rootedMeshes.set(root, group);
      } else if (isSuppressibleMicroDetail(object)) {
        candidates.push(candidate);
      } else {
        protectedDrawCalls += drawCost;
      }
      traversalOrder += 1;
    });

    const perRootCore = coreMeshesPerRoot(band, mobile);
    for (const group of rootedMeshes.values()) {
      group.sort((a, b) => {
        const aPriority = a.mesh.userData.distanceDetailPriority === 'silhouette' ? 1 : 0;
        const bPriority = b.mesh.userData.distanceDetailPriority === 'silhouette' ? 1 : 0;
        return bPriority - aPriority || b.radius - a.radius || a.order - b.order;
      });
      for (let index = 0; index < group.length; index += 1) {
        const entry = group[index];
        if (index < perRootCore) protectedDrawCalls += entry.drawCost;
        else candidates.push(entry);
      }
    }

    candidates.sort((a, b) => b.radius - a.radius || a.order - b.order);

    const availableDrawCalls = detailDrawAllowance(budget, band, mobile);
    const maxDetailMeshes = Math.min(
      Math.max(0, budget.highDetailMeshes),
      availableDrawCalls,
    );
    let activeHighDetailMeshes = 0;
    let activeDetailDrawCalls = 0;

    for (const candidate of candidates) {
      const withinMeshBudget = activeHighDetailMeshes < maxDetailMeshes;
      const withinDrawBudget = activeDetailDrawCalls + candidate.drawCost <= availableDrawCalls;
      const keep = withinMeshBudget && withinDrawBudget;

      if (keep) {
        activeHighDetailMeshes += 1;
        activeDetailDrawCalls += candidate.drawCost;
      } else {
        candidate.mesh.visible = false;
        this.detailHidden.add(candidate.mesh);
      }
    }

    const estimatedDrawCalls = protectedDrawCalls + activeDetailDrawCalls;
    return {
      activeHighDetailMeshes,
      baselineHighDetailMeshes: candidates.length,
      suppressedHighDetailMeshes: candidates.length - activeHighDetailMeshes,
      estimatedDrawCalls,
      baselineEstimatedDrawCalls,
      suppressedEstimatedDrawCalls: Math.max(0, baselineEstimatedDrawCalls - estimatedDrawCalls),
    };
  }

  private applyShadowBudget(
    scene: THREE.Scene,
    maxShadowCasters: number,
    shadowsEnabled: boolean,
  ): Pick<VisualBudgetSnapshot, 'activeShadowCasters' | 'baselineShadowCasters'> {
    const candidates: THREE.Mesh[] = [];
    scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh) || !object.visible) return;
      if (!this.baseShadowCaster.has(object)) this.baseShadowCaster.set(object, object.castShadow);
      if (this.baseShadowCaster.get(object)) candidates.push(object);
    });

    candidates.sort((a, b) => Number(parentHasReadabilityPriority(b)) - Number(parentHasReadabilityPriority(a)));
    const allowed = shadowsEnabled ? Math.max(0, maxShadowCasters) : 0;
    for (let i = 0; i < candidates.length; i += 1) {
      candidates[i].castShadow = i < allowed;
    }

    return {
      activeShadowCasters: Math.min(candidates.length, allowed),
      baselineShadowCasters: candidates.length,
    };
  }
}

export function visualPerformanceBudgets(mobile = false): Readonly<Record<DistanceDetailBand, VisualPerformanceBudget>> {
  return mobile ? MOBILE_BUDGETS : DESKTOP_BUDGETS;
}
