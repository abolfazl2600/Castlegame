# Mobile render profiling and first-pass castle draw-call reduction

## Priority and scope
The current desktop debug screenshot shows ~7,310 draw calls, 8,463 visible meshes, ~178k triangles, 26 FPS and ~56.7 MB JS heap. The main first-pass target is the excessive draw submissions, **not triangle count or JS heap**.

### Included in this branch
1. **Static castle box instancing**: adjacent opaque, metadata-free BoxGeometry meshes sharing the same material and render state are replaced with a single InstancedMesh **inside each original parent**. It runs for castle wall cells and keep roots on full rebuild, and for affected wall cells on neighborhood replacement. It intentionally does not touch gates, transparent materials, flags, arbitrary shapes or animated objects. Visual shape, materials, per-instance transforms and shadow settings are preserved.
2. **CPU frame breakdown**: independent averages for gameplay/update CPU and synchronous renderer submit CPU, along with the pre-existing requestAnimationFrame interval and FPS. GPU execution time is not inferred from CPU submit time.
3. **Optional GPU elapsed time**: uses `EXT_disjoint_timer_query_webgl2` asynchronous timer queries if supported; otherwise reports Unavailable. A missing result does not mean the GPU is idle.
4. **Scene hot spots**: counts visible renderable objects by terrain, buildings/castle, ambient, NPCs and battle. These are **estimates**, not exact per-layer WebGL calls (multipass rendering, shadows and multi-material geometry can differ).
5. **Desktop mobile-budget comparison**: Debug Performance has a toggle to exercise the game's existing mobile LOD/render budget (including pixel and shadow constraints) without pretending that desktop hardware has a phone's CPU, GPU, thermal or system-memory limits.
6. **Metrics transparency**: reports instanced castle box counts and estimated submissions saved; explicitly separates JS heap, full RAM and VRAM. Browser JS heap is not a 2 GB total-RAM certification.

## How to evaluate
1. Enable Debug Mode in Settings.
2. Load the **same dense castle template** on the base branch and this branch, with the same camera angle, zoom, render scale and browser window.
3. Wait several seconds and record FPS, 500 ms mean/worst frame interval, CPU update and render-submit times, GPU elapsed time (when available), draw calls, render pixels and instancing counts.
4. Toggle `Mobile rendering budget` ON and repeat. This is a render-budget test, *not* a hardware benchmark.
5. Zoom, pan, build, damage and repair walls; verify there is no lost detail, altered textures, broken selection, new gaps or incorrect shadow geometry.
6. Benchmark on real Android midrange hardware with Android Chrome remote debugging and thermal throttling monitoring. Capture median and p95 frame times and full process memory with device-side tools; WebGL cannot report total VRAM.

## Follow-up P0
Cross-structure instancing, geometry/material reuse and terrain chunk rendering may be necessary to reduce the remaining draw calls. This stage intentionally limits batch scope to preserve per-cell editing, building selection, wall destruction and construction-animation behavior.

## Checks
- `npm run test:mobile-render-performance`
- `npm run build` (runs the added test and TypeScript compile)

**No FPS improvement is claimed without before/after measurements on identical scenes and real Android devices.**
