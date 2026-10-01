import { MathUtils, PerspectiveCamera, Spherical, Vector3 } from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { TouchCameraDelta } from './TouchGestureSession';

/** Touch uses the same camera/target, bounds and sensitivity as desktop controls,
 * but never feeds a partial pointer sequence into OrbitControls. */
export function applyTouchCameraDelta(
  camera: PerspectiveCamera, controls: OrbitControls, delta: TouchCameraDelta, height: number,
): void {
  if (!controls.enabled || height <= 0) return;
  const offset = camera.position.clone().sub(controls.target);
  if (delta.fingers === 1 && controls.enableRotate) {
    const spherical = new Spherical().setFromVector3(offset);
    spherical.theta = MathUtils.clamp(spherical.theta - 2 * Math.PI * delta.dx / height * controls.rotateSpeed,
      controls.minAzimuthAngle, controls.maxAzimuthAngle);
    spherical.phi = MathUtils.clamp(spherical.phi - 2 * Math.PI * delta.dy / height * controls.rotateSpeed,
      controls.minPolarAngle, controls.maxPolarAngle);
    spherical.makeSafe();
    offset.setFromSpherical(spherical);
  } else if (controls.enablePan) {
    camera.updateMatrix();
    const units = 2 * offset.length() * Math.tan(MathUtils.degToRad(camera.fov / 2)) / height * controls.panSpeed;
    const right = new Vector3().setFromMatrixColumn(camera.matrix, 0);
    const up = controls.screenSpacePanning
      ? new Vector3().setFromMatrixColumn(camera.matrix, 1)
      : new Vector3().crossVectors(camera.up, right);
    controls.target.addScaledVector(right, -delta.dx * units).addScaledVector(up, delta.dy * units);
  }
  if (delta.fingers === 2 && controls.enableZoom && Number.isFinite(delta.scale) && delta.scale > 0) {
    offset.setLength(MathUtils.clamp(offset.length() / Math.pow(delta.scale, controls.zoomSpeed),
      controls.minDistance, controls.maxDistance));
  }
  camera.position.copy(controls.target).add(offset);
  camera.lookAt(controls.target);
  controls.update();
}
