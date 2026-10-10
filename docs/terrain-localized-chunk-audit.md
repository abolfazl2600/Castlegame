# Terrain chunk rebuild scope and localized-edit audit — Issue #304

## Confirmed behavior on `main` (before this change)

`ThreeGame.currentWorldLayoutSurfaceSignature()` incorporates the active map ID, grid dimensions, and **all** terrain overrides. Its caller `rebuildWorldLayoutSurface()` avoids work when the signature is unchanged, but a single water/land edit alters that signature. The previous implementation then invoked `TerrainChunkRenderer.rebuild()`, which removed **every** chunk mesh, disposed each retired `InstancedMesh` (the GPU lifecycle correction from #305), scanned every grid tile, and created all land chunk instance buffers again.

This rebuild was valid in output but wasteful in scope. The 50×89 Royal Valley map has 5×8 = **40 possible 12×12 chunks**; a single grass-to-shore edit needed only the edited chunk's surface arrays but recreated the other 39 chunks. The existing `ThreeGame.redraw()` also rebuilds terrain decorations and building visuals; those broader redraws are **separate from this issue** and are not changed here.

## Fix and ownership boundaries

- `TerrainChunkRenderer.update(context)` is used by `ThreeGame.rebuildWorldLayoutSurface()`. It tracks a compact per-cell surface classification (water/river = no surface, shore = shore, all other land = grass) and compares it with the latest terrain state.
- Only the chunk(s) containing **rendered classification changes** are replaced. A no-op edit, forest/plains swap, or river/water swap does not discard any instance buffers. Each dirty chunk still uses exactly the previous soil/grass/shore geometry, transforms, material references, shadows, and frustum culling.
- Old instance buffers for changed chunks are released via `InstancedMesh.dispose()` before removal. The three shared geometries and caller-owned seasonal materials remain alive; unaffected mesh identities and GPU allocations stay intact.
- Grid dimension/chunk-size changes, a first initialization, or changed shared material references trigger the original **full** rebuild. The explicit `rebuild(context)` entry point remains full-refresh-capable and retains the existing resource lifecycle tests.
- Chunk statistics count only active mesh instances; chunks removed by flooding are deducted. Chunk draw-object order is restored to the original row-major/soil-grass-shore ordering to avoid display nondeterminism.

## Executable verification

`npm run test:terrain-localized` tests real Three.js `InstancedMesh` objects with a 50×89/12-chunk surface and asserts:

- initial 40 chunks / 80 meshes / 8,900 instances;
- unchanged source data leaves mesh references intact;
- a single grass-to-shore edit retires only 2 of 80 existing meshes in 1 of 40 chunks, while the 39 unchanged chunk meshes remain the same objects;
- multi-chunk edits retire only affected chunks; all-water maps remove meshes and newly exposed land adds them correctly;
- terrain class equivalence (river/water, forest/plains) prevents unnecessary rebuilds;
- changing dimensions or material ownership forces a correct full refresh;
- incremental output (positions, matrices, ordering, material binding, shadows, culling and counts) matches a fresh full rebuild after mixed terrain edits.

The existing `npm run test:terrain-resource-lifecycle` continues to verify full rebuild and teardown semantics. Targeted QA runs the map-layout, visual budget and TypeScript contracts plus the Vite build.

## Performance interpretation and limitations

For the documented 50×89 all-land case, a single isolated shore edit reduces chunk replacement from **40 chunks to 1 chunk (97.5% fewer)**, and retires **2 mesh instance buffers rather than 80**. This is an operation-count improvement established by executable tests, **not a measured browser frame-time speedup**. The update still scans the grid (4,450 classifications), and the existing global override signature construction and `ThreeGame.redraw()` work are unchanged. Those are potential independent optimizations requiring profiling, not evidence of a remaining *chunk rebuild* defect.

For actual responsiveness benchmarks, compare repeated brush edits on a 50×89 loaded map with identical browser/device, graphics quality and camera. Record median/p95 `lastRedrawMs`, frame times, and driver memory if available. GPU-process memory figures should be interpreted separately from `renderer.info.memory`, which omits some instance attribute resources.
