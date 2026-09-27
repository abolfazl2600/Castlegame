# Visual reference and performance baseline

Use `npm run visual:baseline -- --out visual-baselines/after` after `npm run build` to generate a fixed medieval scene, screenshots and `metrics.json`. Playwright Chromium must be installed (`npx playwright install chromium`) and WebGL must work on the runner. The script starts a local Vite preview; set `VISUAL_BASE_URL` only when comparing an already running build. Generated files are local review artifacts and should be attached to the relevant visual PR. Run the same command against the parent revision with `--out visual-baselines/before` for before/after comparisons. Do not label metrics from two different devices as a direct performance comparison.

The saved scene generator is [`scripts/visual-reference-scene.mjs`](../scripts/visual-reference-scene.mjs), fixed seed **6001** on a 22 × 22 Mainland Coast map. It uses one house of each family, farm, orchard, barn, market, windmill, stone and standard roads, castle wall/gate/tower/keep, trees, native shoreline and water, and residents derived from homes and farms. The dense variant adds bounded homes, farms, trees and roads in the same map; the empty variant holds the same map with no buildings. Coordinates, stone style and world seed do not depend on the clock. The scene uses the save/load path, so changes to save schema must also update the fixture generator.

| Capture | Viewport | Camera position → target | Purpose |
| --- | --- | --- | --- |
| Normal desktop | 1365 × 900 | (68, 80, 76) → (0, 0, 0) | Standard gameplay comparison |
| Near desktop | 1365 × 900 | (43, 50, 48) → (0, 0, 0) | Door, crop and wall detail |
| Far desktop | 1365 × 900 | (91, 108, 102) → (0, 0, 0) | Hierarchy and density |
| Normal mobile | 390 × 844 | (68, 80, 76) → (0, 0, 0) | Screen coverage and controls |

Camera projection and limits are defined in [`WorldStyle.ts`](../src/rendering/WorldStyle.ts). The directional sun starts at `#ffd7a3` with intensity `3.05`; sky fill is `#91c1cf` at `0.7`, ambient sky is `#c4e1e7`, fog is `#89a6a2` from 132 to 270 world units. The benchmark freezes optional motion, leaves effects and shadows enabled, and tests Low, Medium and High graphics quality. It samples 120 animation frames after warmup and reports median and 95th percentile frame time, estimated FPS, median draw calls, triangles, unique scene geometry/material counts, GPU geometry/texture counts, initial redraw time, and JS heap size where Chrome exposes it. Results vary by device; record browser, OS, GPU, resolution and graphics quality when reviewing a PR.

## Shared roles

The current reviewed *starting palette* is maintained in code, not copied into each renderer. Tune it in the reference scene before promoting a palette change. `SETTLEMENT_STYLE` controls plaster, warm roofs, timber, foundation and roads; `CASTLE_STONE_PALETTES` preserves limestone, dark stone, sandstone and frontier; `WORLD_STYLE.palette` controls ground, foliage and water. UI colors are CSS custom properties at the end of [`style.css`](../src/style.css).

| Role | Starting color | Source |
| --- | --- | --- |
| House plaster | `#E6DDB5` | `SETTLEMENT_STYLE.plaster[0]` |
| Roof terracotta | `#C96B3E` | `SETTLEMENT_STYLE.roof[0]` |
| Timber | `#654531` | `SETTLEMENT_STYLE.timber` |
| Castle stone | `#C8C9B2` | `CASTLE_STONE_PALETTES.limestone.body` |
| Ground, shaded ground | `#9AB756`, `#65894A` | `WORLD_STYLE.palette` |
| Dark foliage | `#264E35` | `WORLD_STYLE.palette.foliageDark` |
| Shallow water | `#77BDE1` | `WORLD_STYLE.palette.shallowWater` |
| UI navy, interactive blue | `#102536`, `#3B84B6` | `--ui-navy`, `--ui-blue` |

Material ownership: `MedievalMaterials` tracks and disposes its shared materials and textures, while generated building geometries/materials belong to the scene lifecycle and are released on redraw. Do not dispose shared materials from a single building, and do not allocate new materials per frame. Document color/geometry changes and attach this reference scene's before/after outputs to visual PRs. See the [Visual Style Guide](../VISUAL_STYLE_GUIDE.md) and [settlement kit](settlement-kit.md).
