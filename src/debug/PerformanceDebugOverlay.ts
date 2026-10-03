import * as THREE from 'three';
import type { VisualBudgetSnapshot } from '../rendering/DistanceDetailBudget';
import type { SettingsStore } from '../settings/SettingsStore';
import type { AudioDiagnostics } from '../audio/types';

interface PerformanceMemorySnapshot {
  usedJSHeapSize?: number;
  totalJSHeapSize?: number;
  jsHeapSizeLimit?: number;
}

interface PerformanceDebugOverlayOptions {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  getCameraDistance: () => number;
  getVisualBudget: () => VisualBudgetSnapshot;
  getRenderLayers?: () => Array<{ name: string; root: THREE.Object3D }>;
  getRuntimeCounts?: () => {
    workers?: number;
    settlementAgents?: number;
    battleObjects?: number;
  };
  getAudioDiagnostics?: () => AudioDiagnostics;
}

interface SceneCounts {
  objects: number;
  meshes: number;
  visibleMeshes: number;
  instancedMeshes: number;
  batchedBoxInstances: number;
  batchedBoxDrawCallsSaved: number;
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
  private accumulatedUpdateCpuMs = 0;
  private accumulatedRenderCpuMs = 0;
  private readonly recentFrameMs: number[] = [];
  public mobileBudgetEmulation = false;
  private gpuFrameMs: number | null = null;
  private readonly gpuTimer: {
    gl: WebGL2RenderingContext;
    ext: { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number };
    query: WebGLQuery | null;
    active: boolean;
  } | null;
  private readonly gpuLabel: string;
  private readonly cpuCores: number | null;
  private readonly deviceMemoryGb: number | null;

  constructor(
    private readonly settingsStore: SettingsStore,
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
      <div class="debug-performance-controls">
        <button type="button" data-debug-mobile-budget aria-pressed="false">Mobile rendering budget: OFF</button>
        <small>Applies mobile LOD, shadow and pixel budgets; does not emulate phone hardware.</small>
      </div>
      <div class="debug-performance-content"></div>
      <div class="debug-performance-note">
        JS heap is not total device memory. Render submit is CPU time, not GPU time.
        GPU timer is shown only when supported; GPU VRAM is not exposed by WebGL.
      </div>
    `;
    this.content = this.element.querySelector<HTMLElement>('.debug-performance-content')!;
    this.element.querySelector<HTMLButtonElement>('[data-debug-mobile-budget]')?.addEventListener('click', () => {
      this.mobileBudgetEmulation = !this.mobileBudgetEmulation;
      this.render(0, 0, 0, 0, 0);
    });
    document.body.appendChild(this.element);

    const gl = this.options.renderer.getContext();
    const webgl2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext
      ? gl : null;
    const timerExt = webgl2?.getExtension('EXT_disjoint_timer_query_webgl2') as
      | { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number }
      | null
      | undefined;
    this.gpuTimer = webgl2 && timerExt ? {
      gl: webgl2,
      ext: timerExt,
      query: null,
      active: false,
    } : null;
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

  /** Timer queries report asynchronous GPU elapsed time only when the extension is available. */
  beginGpuFrame(): void {
    if (!this.enabled || !this.gpuTimer) return;
    this.pollGpuTimer();
    const { gl, ext } = this.gpuTimer;
    if (this.gpuTimer.query || this.gpuTimer.active) return;
    const query = gl.createQuery();
    if (!query) return;
    try {
      gl.beginQuery(ext.TIME_ELAPSED_EXT, query);
      this.gpuTimer.query = query;
      this.gpuTimer.active = true;
    } catch {
      gl.deleteQuery(query);
    }
  }

  endGpuFrame(): void {
    if (!this.gpuTimer?.active) return;
    try {
      this.gpuTimer.gl.endQuery(this.gpuTimer.ext.TIME_ELAPSED_EXT);
    } finally {
      this.gpuTimer.active = false;
    }
  }

  private pollGpuTimer(): void {
    if (!this.gpuTimer?.query || this.gpuTimer.active) return;
    const { gl, ext, query } = this.gpuTimer;
    if (!gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)) return;
    const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT);
    this.gpuFrameMs = disjoint ? null : Number(gl.getQueryParameter(query, gl.QUERY_RESULT)) / 1e6;
    gl.deleteQuery(query);
    this.gpuTimer.query = null;
  }

  update(frameDeltaMs: number, updateCpuMs = 0, renderCpuMs = 0): void {
    if (!this.enabled) return;
    this.pollGpuTimer();

    const safeDelta = Number.isFinite(frameDeltaMs) && frameDeltaMs > 0 ? frameDeltaMs : 16.67;
    this.accumulatedMs += safeDelta;
    this.frameCount += 1;
    this.worstFrameMs = Math.max(this.worstFrameMs, safeDelta);
    this.recentFrameMs.push(safeDelta);
    if (this.recentFrameMs.length > 300) this.recentFrameMs.shift();
    this.accumulatedUpdateCpuMs += Math.max(0, updateCpuMs);
    this.accumulatedRenderCpuMs += Math.max(0, renderCpuMs);

    if (this.accumulatedMs < SAMPLE_WINDOW_MS) return;

    const fps = this.frameCount * 1000 / this.accumulatedMs;
    const averageFrameMs = this.accumulatedMs / this.frameCount;
    const orderedFrames = [...this.recentFrameMs].sort((a, b) => a - b);
    const p95FrameMs = orderedFrames[Math.max(0, Math.ceil(orderedFrames.length * 0.95) - 1)] ?? 0;
    this.render(
      fps, averageFrameMs, this.worstFrameMs,
      this.accumulatedUpdateCpuMs / this.frameCount,
      this.accumulatedRenderCpuMs / this.frameCount,
      p95FrameMs,
    );

    this.accumulatedMs = 0;
    this.frameCount = 0;
    this.worstFrameMs = 0;
    this.accumulatedUpdateCpuMs = 0;
    this.accumulatedRenderCpuMs = 0;
  }

  private setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    // A hidden debug overlay must never leave the game on an emulated budget.
    if (!enabled) this.mobileBudgetEmulation = false;
    this.element.hidden = !enabled;
    this.element.setAttribute('aria-hidden', String(!enabled));
    document.documentElement.toggleAttribute('data-debug-performance', enabled);

    this.accumulatedMs = 0;
    this.frameCount = 0;
    this.worstFrameMs = 0;
    this.accumulatedUpdateCpuMs = 0;
    this.accumulatedRenderCpuMs = 0;
    this.recentFrameMs.length = 0;

    if (enabled) this.render(0, 0, 0, 0, 0);
  }

  private render(
    fps: number, averageFrameMs: number, worstFrameMs: number,
    updateCpuMs: number, renderCpuMs: number, p95FrameMs = 0,
  ): void {
    const { renderer, scene } = this.options;
    const renderInfo = renderer.info.render;
    const memoryInfo = renderer.info.memory;
    const budget = this.options.getVisualBudget();
    const runtime = this.options.getRuntimeCounts?.() ?? {};
    const audio = this.options.getAudioDiagnostics?.();
    const sceneCounts = this.countScene(scene);
    const layers = this.options.getRenderLayers?.() ?? [];
    const layerCounts = layers.map(({ name, root }) => ({
      name,
      count: this.countPotentialDrawables(root),
    })).sort((a, b) => b.count - a.count);
    const mobileButton = this.element.querySelector<HTMLButtonElement>('[data-debug-mobile-budget]');
    if (mobileButton) {
      mobileButton.textContent = `Mobile rendering budget: ${this.mobileBudgetEmulation ? 'ON' : 'OFF'}`;
      mobileButton.setAttribute('aria-pressed', String(this.mobileBudgetEmulation));
    }
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
        this.row('FPS', fps > 0 ? fps.toFixed(1) : 'Sampling…', fps > 0 && fps < 30),
        this.row('Frame avg', averageFrameMs > 0 ? `${averageFrameMs.toFixed(2)} ms` : 'Sampling…'),
        this.row('Frame max', worstFrameMs > 0 ? `${worstFrameMs.toFixed(2)} ms` : 'Sampling…'),
        this.row('Frame p95 (last 300)', p95FrameMs > 0 ? `${p95FrameMs.toFixed(2)} ms` : 'Sampling…'),
        this.row('CPU game update', updateCpuMs > 0 ? `${updateCpuMs.toFixed(2)} ms` : 'Sampling…'),
        this.row('CPU render submit', renderCpuMs > 0 ? `${renderCpuMs.toFixed(2)} ms` : 'Sampling…'),
        this.row('GPU frame time', this.gpuFrameMs === null ? 'Unavailable' : `${this.gpuFrameMs.toFixed(2)} ms (async)`),
        this.row('Graphics selection', this.settingsStore.get().graphics.performanceMode.toUpperCase()),
        this.row('Active render profile', budget.renderProfile.toUpperCase()),
        this.row('LOD band', budget.band),
        this.row('Camera distance', `${this.options.getCameraDistance().toFixed(1)}`),
      ]),
      this.section('Rendering', [
        this.row('Draw calls', `${renderInfo.calls} / ${budget.budget.drawCalls}`, drawCallsOverBudget),
        this.row('Triangles', this.formatInteger(renderInfo.triangles)),
        this.row('GPU geometries', this.formatInteger(memoryInfo.geometries)),
        this.row('GPU textures', this.formatInteger(memoryInfo.textures)),
        this.row('Scene meshes', `${sceneCounts.visibleMeshes} visible / ${sceneCounts.meshes}`),
        this.row('Instanced meshes', this.formatInteger(sceneCounts.instancedMeshes)),
        this.row('Batched castle boxes', this.formatInteger(sceneCounts.batchedBoxInstances)),
        this.row('Castle calls saved (est.)', this.formatInteger(sceneCounts.batchedBoxDrawCallsSaved)),
        this.row('Scene objects', this.formatInteger(sceneCounts.objects)),
        this.row('Lights', this.formatInteger(sceneCounts.lights)),
        this.row('Pixel ratio', renderer.getPixelRatio().toFixed(2)),
        this.row('Render buffer', `${Math.round(drawingBuffer.x)}×${Math.round(drawingBuffer.y)}`),
        this.row('Render pixels', `${(drawingBuffer.x * drawingBuffer.y / 1e6).toFixed(2)} MP`),
      ]),
      this.section('Scene hot spots (visible drawables, est.)', [
        ...layerCounts.map(({ name, count }) => this.row(name, this.formatInteger(count))),
      ]),
      this.section('LOD & Memory', [
        this.row('Detail suppression', budget.detailSuppressionActive ? 'ACTIVE' : 'OFF', budget.detailSuppressionActive),
        this.row('High-detail meshes', `${budget.activeHighDetailMeshes} / ${budget.baselineHighDetailMeshes}`),
        this.row('Suppressed meshes', this.formatInteger(budget.suppressedHighDetailMeshes)),
        this.row('Shadow casters active', this.formatInteger(budget.activeShadowCasters)),
        this.row('Shadow casters baseline', this.formatInteger(budget.baselineShadowCasters)),
        this.row('Building / Castle shadows active', this.formatInteger(budget.activeBuildingShadowCasters)),
        this.row('Building / Castle shadows baseline', this.formatInteger(budget.baselineBuildingShadowCasters)),
        this.row('Minor building shadows suppressed', this.formatInteger(budget.suppressedMinorBuildingShadowCasters)),
        this.row('Memory pressure', budget.memoryPressure.toUpperCase(), budget.memoryPressure !== 'normal'),
        this.row('JS heap used', heapUsed === null ? 'Unavailable' : this.formatBytes(heapUsed)),
        this.row('JS heap total', heapTotal === null ? 'Unavailable' : this.formatBytes(heapTotal)),
        this.row('JS heap limit', heapLimit === null ? 'Unavailable' : this.formatBytes(heapLimit)),
        this.row('JS heap budget (not RAM)', this.formatBytes(budget.memoryBudgetBytes)),
        this.row('Full RAM / VRAM', 'Unavailable via WebGL'),
      ]),
      this.section('Audio', [
        this.row('AudioContext', audio?.contextState ?? 'Unavailable'),
        this.row('Audio unlocked', audio ? (audio.unlocked ? 'YES' : 'NO') : 'Unavailable'),
        this.row('Music state', audio?.musicState.toUpperCase() ?? 'Unavailable'),
        this.row('Music intensity', audio ? audio.intensity.toFixed(2) : 'Unavailable'),
        this.row('Active section', audio?.activeSection ?? 'Unavailable'),
        this.row('Active stems', audio ? String(audio.activeStemCount) : 'Unavailable'),
        this.row('Pending music state', audio?.pendingMusicState?.toUpperCase() ?? 'None'),
        this.row('SFX voices', audio ? `${audio.activeSfxVoices} / ${audio.voiceLimit}` : 'Unavailable'),
        this.row('Ambient layers', audio ? (audio.activeAmbientLayers.join(', ') || 'None') : 'Unavailable'),
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
      batchedBoxInstances: 0,
      batchedBoxDrawCallsSaved: 0,
      lights: 0,
    };

    const walk = (object: THREE.Object3D, ancestorsVisible: boolean): void => {
      counts.objects += 1;
      if (object instanceof THREE.Light) counts.lights += 1;
      const effectiveVisible = ancestorsVisible && object.visible;
      if (object instanceof THREE.Mesh) {
        counts.meshes += 1;
        if (effectiveVisible) counts.visibleMeshes += 1;
        if (object instanceof THREE.InstancedMesh) counts.instancedMeshes += 1;
        const instances = effectiveVisible ? Number(object.userData.castleBoxBatch?.instances ?? 0) : 0;
        if (instances > 0) {
          counts.batchedBoxInstances += instances;
          counts.batchedBoxDrawCallsSaved += instances - 1;
        }
      }
      for (const child of object.children) walk(child, effectiveVisible);
    };
    walk(scene, true);
    return counts;
  }

  private countPotentialDrawables(root: THREE.Object3D): number {
    let total = 0;
    const walk = (object: THREE.Object3D, parentVisible: boolean): void => {
      if (!parentVisible || !object.visible) return;
      if (object instanceof THREE.Mesh || object instanceof THREE.Line ||
          object instanceof THREE.Points || object instanceof THREE.Sprite) total += 1;
      for (const child of object.children) walk(child, true);
    };
    walk(root, true);
    return total;
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
