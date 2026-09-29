import * as THREE from 'three';
import type { VisualBudgetSnapshot } from '../rendering/DistanceDetailBudget';
import type { SettingsStore } from '../settings/SettingsStore';

interface PerformanceMemorySnapshot {
  usedJSHeapSize?: number;
  totalJSHeapSize?: number;
  jsHeapSizeLimit?: number;
}

interface PerformanceDebugOverlayOptions {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  getCameraDistance: () => number;
  getViewMode: () => string;
  getVisualBudget: () => VisualBudgetSnapshot;
  getRuntimeCounts?: () => {
    workers?: number;
    settlementAgents?: number;
    battleObjects?: number;
  };
}

interface SceneCounts {
  objects: number;
  meshes: number;
  visibleMeshes: number;
  instancedMeshes: number;
  lights: number;
}

const SAMPLE_WINDOW_MS = 500;

export class PerformanceDebugOverlay {
  private readonly element: HTMLElement;
  private readonly content: HTMLElement;
  private enabled = false;
  private accumulatedMs = 0;
  private frameCount = 0;
  private worstFrameMs = 0;
  private readonly gpuLabel: string;
  private readonly cpuCores: number | null;
  private readonly deviceMemoryGb: number | null;

  constructor(
    settingsStore: SettingsStore,
    private readonly options: PerformanceDebugOverlayOptions,
  ) {
    this.element = document.createElement('aside');
    this.element.id = 'debug-performance-overlay';
    this.element.className = 'debug-performance-overlay';
    this.element.hidden = true;
    this.element.setAttribute('aria-hidden', 'true');
    this.element.innerHTML = `
      <div class="debug-performance-header">
        <span>DEBUG PERFORMANCE</span>
        <strong data-debug-fps>— FPS</strong>
      </div>
      <div class="debug-performance-content"></div>
      <div class="debug-performance-note">
        Memory is browser JS heap when available. WebGL does not expose reliable VRAM usage.
      </div>
    `;
    this.content = this.element.querySelector<HTMLElement>('.debug-performance-content')!;
    document.body.appendChild(this.element);

    const gl = this.options.renderer.getContext();
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    const vendor = String(
      debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
    );
    const renderer = String(
      debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
    );
    this.gpuLabel = renderer && renderer !== vendor ? `${vendor} · ${renderer}` : renderer || vendor || 'Unavailable';

    this.cpuCores = typeof navigator.hardwareConcurrency === 'number'
      ? navigator.hardwareConcurrency
      : null;
    const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
    this.deviceMemoryGb = typeof deviceMemory === 'number' && Number.isFinite(deviceMemory)
      ? deviceMemory
      : null;

    settingsStore.subscribe((settings) => {
      this.setEnabled(settings.graphics.debugMode);
    });
  }

  update(frameDeltaMs: number): void {
    if (!this.enabled) return;

    const safeDelta = Number.isFinite(frameDeltaMs) && frameDeltaMs > 0 ? frameDeltaMs : 16.67;
    this.accumulatedMs += safeDelta;
    this.frameCount += 1;
    this.worstFrameMs = Math.max(this.worstFrameMs, safeDelta);

    if (this.accumulatedMs < SAMPLE_WINDOW_MS) return;

    const fps = this.frameCount * 1000 / this.accumulatedMs;
    const averageFrameMs = this.accumulatedMs / this.frameCount;
    this.render(fps, averageFrameMs, this.worstFrameMs);

    this.accumulatedMs = 0;
    this.frameCount = 0;
    this.worstFrameMs = 0;
  }

  private setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    this.element.hidden = !enabled;
    this.element.setAttribute('aria-hidden', String(!enabled));
    document.documentElement.toggleAttribute('data-debug-performance', enabled);

    this.accumulatedMs = 0;
    this.frameCount = 0;
    this.worstFrameMs = 0;

    if (enabled) this.render(0, 0, 0);
  }

  private render(fps: number, averageFrameMs: number, worstFrameMs: number): void {
    const { renderer, scene } = this.options;
    const renderInfo = renderer.info.render;
    const memoryInfo = renderer.info.memory;
    const budget = this.options.getVisualBudget();
    const runtime = this.options.getRuntimeCounts?.() ?? {};
    const sceneCounts = this.countScene(scene);
    const drawingBuffer = new THREE.Vector2();
    renderer.getDrawingBufferSize(drawingBuffer);

    const heap = (performance as Performance & {
      memory?: PerformanceMemorySnapshot;
    }).memory;
    const heapUsed = this.validNumber(heap?.usedJSHeapSize);
    const heapTotal = this.validNumber(heap?.totalJSHeapSize);
    const heapLimit = this.validNumber(heap?.jsHeapSizeLimit);

    const drawCallsOverBudget = renderInfo.calls > budget.budget.drawCalls;
    this.element.dataset.pressure = budget.memoryPressure;
    this.element.dataset.drawBudget = drawCallsOverBudget ? 'over' : 'ok';

    const fpsElement = this.element.querySelector<HTMLElement>('[data-debug-fps]');
    if (fpsElement) fpsElement.textContent = fps > 0 ? `${fps.toFixed(0)} FPS` : '— FPS';

    this.content.innerHTML = [
      this.section('Performance', [
        this.row('FPS', fps > 0 ? fps.toFixed(1) : 'Sampling…'),
        this.row('Frame avg', averageFrameMs > 0 ? `${averageFrameMs.toFixed(2)} ms` : 'Sampling…'),
        this.row('Frame max', worstFrameMs > 0 ? `${worstFrameMs.toFixed(2)} ms` : 'Sampling…'),
        this.row('View / LOD', `${this.options.getViewMode()} · ${budget.band}`),
        this.row('Camera distance', `${this.options.getCameraDistance().toFixed(1)}`),
      ]),
      this.section('Rendering', [
        this.row('Draw calls', `${renderInfo.calls} / ${budget.budget.drawCalls}`, drawCallsOverBudget),
        this.row('Triangles', this.formatInteger(renderInfo.triangles)),
        this.row('GPU geometries', this.formatInteger(memoryInfo.geometries)),
        this.row('GPU textures', this.formatInteger(memoryInfo.textures)),
        this.row('Scene meshes', `${sceneCounts.visibleMeshes} visible / ${sceneCounts.meshes}`),
        this.row('Instanced meshes', this.formatInteger(sceneCounts.instancedMeshes)),
        this.row('Scene objects', this.formatInteger(sceneCounts.objects)),
        this.row('Lights', this.formatInteger(sceneCounts.lights)),
        this.row('Pixel ratio', renderer.getPixelRatio().toFixed(2)),
        this.row('Render buffer', `${Math.round(drawingBuffer.x)}×${Math.round(drawingBuffer.y)}`),
      ]),
      this.section('LOD & Memory', [
        this.row('Detail suppression', budget.detailSuppressionActive ? 'ACTIVE' : 'OFF', budget.detailSuppressionActive),
        this.row('High-detail meshes', `${budget.activeHighDetailMeshes} / ${budget.baselineHighDetailMeshes}`),
        this.row('Suppressed meshes', this.formatInteger(budget.suppressedHighDetailMeshes)),
        this.row('Shadow casters', `${budget.activeShadowCasters} / ${budget.baselineShadowCasters}`),
        this.row('Memory pressure', budget.memoryPressure.toUpperCase(), budget.memoryPressure !== 'normal'),
        this.row('JS heap used', heapUsed === null ? 'Unavailable' : this.formatBytes(heapUsed)),
        this.row('JS heap total', heapTotal === null ? 'Unavailable' : this.formatBytes(heapTotal)),
        this.row('JS heap limit', heapLimit === null ? 'Unavailable' : this.formatBytes(heapLimit)),
        this.row('Game memory target', this.formatBytes(budget.memoryBudgetBytes)),
      ]),
      this.section('Runtime & System', [
        this.row('Workers', runtime.workers === undefined ? '—' : this.formatInteger(runtime.workers)),
        this.row('Settlement agents', runtime.settlementAgents === undefined ? '—' : this.formatInteger(runtime.settlementAgents)),
        this.row('Battle objects', runtime.battleObjects === undefined ? '—' : this.formatInteger(runtime.battleObjects)),
        this.row('CPU logical cores', this.cpuCores === null ? 'Unavailable' : String(this.cpuCores)),
        this.row('Device memory', this.deviceMemoryGb === null ? 'Unavailable' : `${this.deviceMemoryGb} GB reported`),
        this.row('GPU', this.gpuLabel),
      ]),
    ].join('');
  }

  private countScene(scene: THREE.Scene): SceneCounts {
    const counts: SceneCounts = {
      objects: 0,
      meshes: 0,
      visibleMeshes: 0,
      instancedMeshes: 0,
      lights: 0,
    };

    scene.traverse((object) => {
      counts.objects += 1;
      if (object instanceof THREE.Light) counts.lights += 1;
      if (object instanceof THREE.Mesh) {
        counts.meshes += 1;
        if (object.visible) counts.visibleMeshes += 1;
        if (object instanceof THREE.InstancedMesh) counts.instancedMeshes += 1;
      }
    });

    return counts;
  }

  private section(title: string, rows: string[]): string {
    return `
      <section class="debug-performance-section">
        <h3>${title}</h3>
        <div class="debug-performance-grid">${rows.join('')}</div>
      </section>
    `;
  }

  private row(label: string, value: string, warning = false): string {
    return `<span>${label}</span><strong${warning ? ' class="is-warning"' : ''}>${value}</strong>`;
  }

  private validNumber(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
  }

  private formatInteger(value: number): string {
    return Math.max(0, Math.round(value)).toLocaleString('en-US');
  }

  private formatBytes(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes < 0) return 'Unavailable';
    const gb = bytes / (1024 ** 3);
    if (gb >= 1) return `${gb.toFixed(2)} GB`;
    const mb = bytes / (1024 ** 2);
    return `${mb.toFixed(1)} MB`;
  }
}
