# Issue #306 — Royal Valley large-map runtime performance audit

## Conclusion and evidence boundary

The 50×89 Royal Valley is materially more demanding than the baseline 23×23 layout on a constrained **Linux Chromium** run. Before the correction, even a one-cell construction or terrain edit caused `ThreeGame.redraw()` to dispose and regenerate all the per-cell terrain decoration geometry. This was a confirmed unnecessary rebuild, and the targeted cache correction materially reduced measured synchronous redraw time without changing terrain meshes or the map/save schemas.

**No physical low-end Android device was available or tested.** Browser/device emulation does not establish real Android GPU throughput, thermal throttling, RAM pressure, WebView stability, or on-device FPS compliance. The observations below are concrete *hosted-runner measurements*, not physical-Android performance certifications. The already published `docs/android-performance-benchmark.md` protocol remains the device release gate.

## Reproducible benchmark setup

- Source: `scripts/benchmark-royal-valley-android.mjs`.
- CI: GitHub Actions **Royal Valley Android Performance Evidence** workflow, Ubuntu 24.04, Node 22, headless Chromium with ANGLE SwiftShader Vulkan software WebGL and `--max-old-space-size=2048`.
- Viewport: **915×412** landscape with touch-capable mobile page, 1× device scale, Low graphics, Performance render profile, disabled shadows/effects, reduced motion and silent audio.
- Chromium CPU throttling: **2×** (`Emulation.setCPUThrottlingRate`). This is a synthetic browser slowdown; it cannot emulate Mali, Adreno, Android power management or an actual 2 GB/3 GB phone.
- Fixtures: stable seeded save files, built with the current `SAVE_VERSION`, for a **23×23** mainland and a **50×89** Royal Valley. Both use a central cleared editing district and a deterministic developed settlement.
- Scenarios in order: warm-up and idle render; real OrbitControls pointer camera drag and wheel input; build a Cottage via the game's construction tool; carve a river via the terrain tool. Both interactions are asserted against game state/status, rather than inferred from synthetic geometry.
- Samples: up to 35 requestAnimationFrame intervals per phase with a 10-second sampling cap. Record median/p95 frame interval, draw calls, triangles, GPU geometry/texture counters, scene geometries, `performance.memory.usedJSHeapSize` where present, last synchronous redraw duration, and any runtime console errors.
- Benchmark output `artifacts/royal-valley-306/metrics.json` is uploaded as a downloadable GitHub Actions artifact on success or failure.

## Before/after readings

Before the terrain decoration cache: [run 38048830499](https://github.com/abolfazl2600/Castlegame/actions/runs/38048830499), code at `bd41c0b5cd53c7f983cb4ea92a8fba39a1e3b799`.

After cache and invalidation metrics: [run 38049126185](https://github.com/abolfazl2600/Castlegame/actions/runs/38049126185), code at `2ee71106eecda989486b894069c3d3b0653b5878`.

| Layout / phase | Before redraw (ms) | After redraw (ms) | Relative reduction |
| --- | ---: | ---: | ---: |
| 23×23 — Cottage construction | 266.1 | 111.6 | 58% |
| 23×23 — River terrain edit | 186.4 | 93.2 | 50% |
| 50×89 — Cottage construction | 1829.1 | 675.6 | 63% |
| 50×89 — River terrain edit | 1706.8 | 719.6 | 58% |

The 50×89 cache retained **4,450** tile signatures; the Cottage build regenerated **one** terrain decoration tile and the river edit regenerated **five**, including affected neighboring river banks. This directly verifies local invalidation instead of a full 4,450-cell decoration rebuild. The existing chunk surface renderer's local changes (issue #304) and instanced-buffer disposal (issue #305) remain intact.

| Scene / phase | Before median frame (ms) | After median frame (ms) | Before p95 (ms) | After p95 (ms) |
| --- | ---: | ---: | ---: | ---: |
| 23×23 idle | 166.6 | 83.4 | 383.2 | 166.7 |
| 23×23 camera | 199.9 | 83.4 | 350.0 | 150.0 |
| 50×89 idle | 316.6 | 183.3 | 616.6 | 349.9 |
| 50×89 camera | 300.0 | 166.7 | 600.0 | 349.9 |

The rAF intervals vary strongly with CI host load, SwiftShader CPU rendering, and throttling; the before/after frame-time deltas are **observations from separate hosted runs**, not a reliable quantification of the speedup of a specific Android GPU. By contrast, the reduced number of invalidated terrain tiles and lowered redraw work are causally supported by implementation and live instrumentation.

## Root cause and correction

On the previous implementation, `ThreeGame.redraw()` called `clearGroup(terrainLayer)` on **every** building or editing redraw, then `renderTerrain()` rebuilt all 4,450 logical tiles' decorations. The 50×89 constrained run counted roughly 8,500 unique scene geometries and 1,150 draw calls at the tested camera and profile. Reallocating the full terrain decoration tree for each Cottage or river click created avoidable synchronous work and frame stalls.

The corrected `renderTerrain()` caches each cell's decoration group alongside a signature of effective terrain, base terrain, elevation/edited state, occupancy and all four neighbors' terrain/elevations. Unchanged tiles retain their **same Three.js mesh objects**; changed tiles have their outgoing geometry correctly disposed via `clearGroup()`. Neighbors update for bank/cliff geometry, preserving visual topology. Context changes (map/layout dimensions, seed, quality/detail/effects) invalidate and rebuild the cache. Tile groups are restored to deterministic row-major order so transparent river ordering stays stable. This only changes **reconstruction scope**, not terrain generation, materials, geometry parameters or save files. The existing runtime render-budget and adaptive-quality mechanisms remain in effect.

The browser benchmark asserts the actual game loads the expected map/cells; build and river changes complete; all 529/4,450 terrain tiles are represented in the cache; and each local edit invalidates fewer than 10 tiles, preventing a regression to all-cell rebuilds. TypeScript, Vite build and existing renderer/map QA run in CI.

## Remaining cost and unverified Android conditions

- Royal Valley's software-renderer draw calls remained around **818–1,161**, often above the Performance-profile nominal **500** draw-call cap. That cap does not guarantee suppression of necessary silhouette geometry. The GPU-side frame cost is not fixed by caching CPU redraw objects.
- During the post-fix browser run, recorded JS heap was about **87 MiB** in Royal Valley versus **about 58 MiB** in the pre-fix run. This is a point-in-time measurement affected by garbage collection, asset caching and host load; it does not demonstrate a memory leak or guarantee Android RAM headroom. Real native process PSS and GPU allocations were unavailable.
- The run covers four short phases, **not** a 20-minute steady thermal session, extended repeated editing, Android lifecycle/background/foreground cycles, or context loss under real system-memory pressure.
- No measured Adreno or Mali device, Android model, OS/WebView version, temperature, process RAM, on-device FPS or long-session crash count exists. Device-level release budget status is **NOT RUN**, not PASS or FAIL.

## Required physical-device validation

Use the **same release commit** and `docs/android-performance-benchmark.md`. On a low-end Android phone record SoC/GPU, RAM, Android & WebView versions, thermals/charging, Low/Medium/High setting, and fixed camera distance. Load the Royal Valley (50×89) fixture or the actual authored template, then measure: (a) idle and camera pan/zoom; (b) a repeated Cottage/road construction sequence; (c) repeated river/land/height edits; (d) save/load and a **20-minute** thermal/memory session. After 60-second warm-up, record 180 seconds/phase, median/p95 frame, >100ms long frames, draw calls, JavaScript heap, native process PSS, GPU memory (if available), and context-loss/crash events. Apply the published lower-end p95 **≤50 ms** and relevant FPS release targets only to **device** results. If measured failures remain, profile remaining draw calls, terrain decoration density and update cost before changing defaults or suppressing visuals.

**Release conclusion:** production code has a validated reconstruction-scope improvement and a repeatable CI assessment, but the Issue #306 lower-end *physical Android* performance gate is still unverified.
