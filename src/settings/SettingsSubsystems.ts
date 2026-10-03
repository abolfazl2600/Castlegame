import type { Scene, WebGLRenderer } from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { SettingsData } from './SettingsModel';
import { graphicsQualityPreset } from '../rendering/GraphicsQualityPreset';

export function applyGraphicsSettings(renderer: WebGLRenderer, settings: SettingsData): void {
  const qualityPreset = graphicsQualityPreset(settings.graphics.quality);
  const qualityScale = qualityPreset.resolutionScale;
  const performanceScale =
    settings.graphics.performanceMode === 'performance'
      ? 0.75
      : settings.graphics.performanceMode === 'quality'
        ? 1.15
        : 1;

  const maxPixelRatio = Math.min(window.devicePixelRatio, 2);
  renderer.setPixelRatio(Math.max(0.75, Math.min(maxPixelRatio, qualityScale * performanceScale)));
  renderer.shadowMap.enabled = settings.graphics.shadowsEnabled && qualityPreset.allowDynamicShadows;
}

export function applySceneGraphicsSettings(scene: Scene, settings: SettingsData): void {
  const detailFar =
    settings.graphics.environmentDetail === 'low'
      ? 150
      : settings.graphics.environmentDetail === 'medium'
        ? 205
        : 280;

  if (scene.fog && 'far' in scene.fog) scene.fog.far = detailFar;
  scene.traverse((object) => {
    object.userData.settingsEnvironment = true;
  });
}

export function applyInputSettings(controls: OrbitControls, settings: SettingsData): void {
  const schemeMultiplier = settings.gameplay.controlScheme === 'touch' ? 0.85 : 1;
  const sensitivity = settings.gameplay.cameraSensitivity;
  controls.rotateSpeed = 0.75 * schemeMultiplier * sensitivity;
  controls.zoomSpeed = 1.0 * schemeMultiplier * sensitivity;
  controls.panSpeed = 0.8 * schemeMultiplier * sensitivity;
}
