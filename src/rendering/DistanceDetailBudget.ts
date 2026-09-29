import * as THREE from 'three';
import type { SettingsData } from '../settings/SettingsModel';
import { WORLD_STYLE } from './WorldStyle';

export type DistanceDetailBand = 'inspection' | 'gameplay' | 'strategic';

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
      current.userData.cellKind === 'futuristicCastle'
    ) return true;
    current = current.parent;
  }
  return false;
}

/**
 * Camera-distance performance governor.
 *
 * It never removes silhouette-defining geometry. Instead it reduces raster cost,
 * ambient animation work, and the number of active shadow casters as the camera
 * moves toward strategic zoom. Shadow changes happen only after hysteresis-aware
 * band transitions, which prevents rapid toggling around distance thresholds.
 */
export class DistanceDetailBudgetSystem {
  private band: DistanceDetailBand = 'gameplay';
  private readonly baseShadowCaster = new WeakMap<THREE.Object3D, boolean>();
  private lastProfileKey = '';
  private lastSnapshot: VisualBudgetSnapshot = {
    band: 'gameplay',
    mobile: false,
    budget: DESKTOP_BUDGETS.gameplay,
    activeShadowCasters: 0,
    baselineShadowCasters: 0,
  };

  update(
    scene: THREE.Scene,
    renderer: THREE.WebGLRenderer,
    cameraDistance: number,
    settings: SettingsData,
    mobile: boolean,
  ): VisualBudgetSnapshot {
    this.band = this.resolveBand(cameraDistance);
    const budget = (mobile ? MOBILE_BUDGETS : DESKTOP_BUDGETS)[this.band];

    const profileKey = [
      this.band,
      mobile ? 'mobile' : 'desktop',
      settings.graphics.quality,
      settings.graphics.performanceMode,
      settings.graphics.shadowsEnabled ? 'shadows' : 'no-shadows',
    ].join(':');

    if (profileKey !== this.lastProfileKey) {
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

      this.lastSnapshot = {
        band: this.band,
        mobile,
        budget,
        ...this.applyShadowBudget(scene, budget.shadowCasters, renderer.shadowMap.enabled),
      };
      scene.userData.visualPerformanceBudget = {
        band: this.band,
        mobile,
        ...budget,
      };
      this.lastProfileKey = profileKey;
    }

    return this.lastSnapshot;
  }

  snapshot(): VisualBudgetSnapshot {
    return this.lastSnapshot;
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

  private applyShadowBudget(
    scene: THREE.Scene,
    maxShadowCasters: number,
    shadowsEnabled: boolean,
  ): Pick<VisualBudgetSnapshot, 'activeShadowCasters' | 'baselineShadowCasters'> {
    const candidates: THREE.Mesh[] = [];
    scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
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
