import type { WebGLRenderer } from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { SettingsData } from './SettingsModel';

export function applyGraphicsSettings(renderer: WebGLRenderer, settings: SettingsData): void {
  const qualityScale = settings.graphics.quality === 'low' ? 0.75 : settings.graphics.quality === 'medium' ? 1 : 1.35;
  const performanceScale =
    settings.graphics.performanceMode === 'performance'
      ? 0.75
      : settings.graphics.performanceMode === 'quality'
        ? 1.15
        : 1;
  const maxPixelRatio = Math.min(window.devicePixelRatio, 2);
  renderer.setPixelRatio(Math.max(0.75, Math.min(maxPixelRatio, qualityScale * performanceScale)));
  renderer.shadowMap.enabled = settings.graphics.shadowsEnabled && settings.graphics.quality !== 'low';
}

export function applyInputSettings(controls: OrbitControls, settings: SettingsData): void {
  const sensitivity = settings.gameplay.controlScheme === 'touch' ? 0.85 : 1;
  controls.rotateSpeed = 0.75 * sensitivity;
  controls.zoomSpeed = 1.0 * sensitivity;
  controls.panSpeed = 0.8 * sensitivity;
}
