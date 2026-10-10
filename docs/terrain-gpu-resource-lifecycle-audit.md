# Terrain rendering GPU resource lifecycle audit — Issue #305

## Scope and observed ownership

- `ThreeGame.rebuildWorldLayoutSurface()` calls `TerrainChunkRenderer.rebuild()` when its map/size/terrain-override signature changes. `ThreeGame.redraw()` separately regenerates non-chunk terrain decoration during construction and terrain editing; map switches and save loading also go through these paths.
- `TerrainChunkRenderer` owns three `BoxGeometry` objects for its entire lifetime. The `soilMaterial`, `grassMaterial`, and `shoreMaterial` come from `ThreeGame.environmentMaterial()` and **are caller-owned and shared**, including seasonal color updates.
- Each chunk rebuild creates new `THREE.InstancedMesh` objects. Their per-instance `instanceMatrix` attributes have their own renderer-side GPU buffers once rendered. Calling `Group.clear()` removes object references from the scene graph but does **not** dispatch an instance's `dispose` event.
- `ThreeGame.clearGroup()`, used for frequently rebuilt terrain details and structures, previously disposed regular mesh geometry and non-shared materials, but did not dispatch `InstancedMesh.dispose()` when an instanced object was removed.
- Non-chunk terrain meshes recreate ordinary geometry on each redraw; the existing `clearGroup()` disposes these geometries. The permanent sky/river/ocean textures and cached environment/overlay materials are deliberately retained, not re-created for each terrain edit.

## Confirmed defect and impact

The chunk renderer's former `rebuild()` and `dispose()` both called `this.layer.clear()` without calling `dispose()` on outgoing `InstancedMesh` instances. Replacing a rendered map repeatedly could therefore orphan GPU buffers backing `instanceMatrix` (and any optional instance attributes) even when the old JavaScript meshes were no longer in the scene. The same omission applied to instanced meshes processed by `ThreeGame.clearGroup()`.

This is an **API-level GPU resource leak**, confirmed by the resource ownership and missing disposal calls. The precise amount of VRAM growth on a specific device was *not measured*. `renderer.info.memory.geometries` and `renderer.info.memory.textures` alone do not count all instanced attribute buffers, so flat values there would not refute this defect.

## Remediation

1. `TerrainChunkRenderer.clearChunks()` sends `dispose()` to each outgoing `InstancedMesh` before clearing the chunk group. Both `rebuild()` and final `dispose()` use it.
2. The three renderer-owned reusable geometries are disposed only at final teardown. Shared material instances are **never disposed by the chunk renderer**; rebuilding still produces the same matrices, mesh names, chunk bounds and shadow/culling settings.
3. `ThreeGame.clearGroup()` now calls `InstancedMesh.dispose()` before existing geometry/material disposal for regenerated terrain and building groups. All existing material-ownership exclusions remain intact.
4. `TerrainChunkRenderer.stats()` resets to zero on teardown. No rendering presets, colors, placement logic, map generation, or save schema changed.

## Automated validation

`npm run test:terrain-resource-lifecycle` exercises actual Three.js classes (without a WebGL context) and checks:

- identical rebuild output: matrices, mesh names, count, chunk metadata, material references;
- correct chunk count and draw-instance totals, mixed shore/land/water, all-water removal;
- 30 successive rebuilds with changing terrain and grid dimensions;
- exactly one outgoing `dispose` event for each retired instance, without early disposal of shared materials/geometries;
- final teardown disposes current instances and the three renderer-owned geometries;
- `ThreeGame.clearGroup()` retains the instanced-disposal contract, and unchanged world signatures skip redundant rebuilds.

The test is registered in `build`, `test:ci`, and `test:regression`; the dedicated **Terrain GPU Resource Lifecycle QA** workflow also type-checks and builds the project, alongside renderer and LOD integration checks.

## Browser and long-session follow-up

For device-level verification, use the normal map selector and terrain-edit tools to alternate map layouts, water/land edits, and repeated construction for an extended session. Compare warmed-up GPU-process memory and captured frame time at consistent camera/quality settings. With `?visualBaseline`, `window.__castleVisualMetrics()` provides scene geometry, renderer memory, and draw-call diagnostics, but does **not** expose all driver allocations or retired instanced attribute buffers. Capture Chrome GPU-process metrics and repeat after garbage collection and a settling period if attributing VRAM growth.

This fix closes a verified disposal gap and preserves source-level visual geometry. CI tests do not replace a real GPU-memory profiling run; the latter remains device-dependent.
