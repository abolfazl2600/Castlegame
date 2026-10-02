import { Capacitor, registerPlugin } from '@capacitor/core';
import type * as THREE from 'three';

interface AndroidScreenshotPlugin {
  shareImage(options: { data: string; filename: string }): Promise<{ shared: boolean }>;
}

export interface ScreenshotCaptureResult {
  filename: string;
  width: number;
  height: number;
  destination: 'download' | 'share';
}

const AndroidScreenshot = registerPlugin<AndroidScreenshotPlugin>('GameScreenshot');

function timestampedFilename(now = new Date()): string {
  const pad = (value: number): string => String(value).padStart(2, '0');
  return [
    'castle-role',
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    '-',
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
    '.png',
  ].join('');
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob || blob.type !== 'image/png') {
        reject(new Error('Screenshot canvas did not produce a PNG image.'));
        return;
      }
      resolve(blob);
    }, 'image/png');
  });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Unable to encode screenshot for Android sharing.'));
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Unable to encode screenshot for Android sharing.'));
        return;
      }
      const comma = reader.result.indexOf(',');
      resolve(comma >= 0 ? reader.result.slice(comma + 1) : reader.result);
    };
    reader.readAsDataURL(blob);
  });
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Capture the exact current Three.js scene with the existing renderer/camera.
 *
 * The renderer canvas contains no DOM HUD, so the PNG is a clean scene capture
 * without creating a second WebGL renderer or mutating gameplay/save state.
 */
export async function captureGameScreenshot(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
): Promise<ScreenshotCaptureResult> {
  renderer.render(scene, camera);

  const canvas = renderer.domElement;
  const blob = await canvasToPngBlob(canvas);
  const filename = timestampedFilename();

  if (Capacitor.getPlatform() === 'android') {
    const data = await blobToBase64(blob);
    await AndroidScreenshot.shareImage({ data, filename });
    return {
      filename,
      width: canvas.width,
      height: canvas.height,
      destination: 'share',
    };
  }

  downloadBlob(blob, filename);
  return {
    filename,
    width: canvas.width,
    height: canvas.height,
    destination: 'download',
  };
}
