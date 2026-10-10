# Issue #310 — Construction redraw scope and geometry retention audit

## Finding

**Confirmed unnecessary reconstruction:** `ThreeGame.redraw()` cleared and disposed the entire `buildLayer`, including the geometry and GPU buffers of unrelated road and residential meshes, every time construction or a building edit requested a scene refresh. Road drags, fortification upgrades, Keep placement and relocation all entered that path. The existing `redrawCastleNeighborhood()` accelerates selected wall topology edits but deliberately falls back for gates, towers, non-wall buildings and mounted wall weapons; it does not solve frequent non-wall construction. Terrain chunk and decoration caching from issues #304/#306 was separate and did not preserve buildings.

The broad redraw is **still necessary for correctness** for certain systems: castle topology/automatic stairs, destructible damage, gate/windmill registration, Keep and bridge meshes, construction animation bindings, population/settlement/missions, ambient fauna and the minimap. Simply skipping the entire routine after an edit would make game systems inconsistent. The correction narrows expensive **render reconstruction** while retaining the authoritative gameplay synchronization.

## Implemented correction

- Opt-in `redraw(preserveStableBuildings, terrainChangedCells)` for local construction operations. Global operations, terrain brushes, save load, undo/redo and settings changes continue to use full refresh.
- Only immutable, standalone visual categories are candidates for mesh reuse: `road`, `dirtRoad`, `stoneRoad`, `cottage`, `house`, `manor`, `villa`, `tree`, `rock` and `hut`. Other objects, including all gates, towers, walls, moats, farms, dynamic cow barns, Keeps, bridges, wall-mounted weapons and construction previews, are still regenerated as before.
- Existing group objects are detached **before** `clearGroup(buildLayer)` so Three.js geometries and instanced GPU buffers are not unnecessarily disposed. All retained groups are returned to the build layer. Removed/changed groups still follow the existing disposal path. Scene flags/sways, construction bindings, renderer budgets and game systems rebind normally.
- A reusable cell signature includes persisted cell fields, stone style, layout dimensions, world seed, graphics detail, effective terrain and height. Road models additionally fingerprint their four cardinal neighboring road/gate connections: laying a road next to another road **does** replace affected neighbor meshes, while distant road and residential objects retain their original identities.
- `FarmLifeSystem`, registered by the normal app startup, declares that its `createBuilding()` hook only owns `farm` and `cowBarn`. The reusable kinds above are not overridden. Extensions with **unknown override scope** or any override of these kinds force the old full rebuild. This is an explicit safety contract in `GameExtension.buildingKinds`.
- On known local construction edits, the existing terrain-decoration cache now scans only the changed cell(s) and the four adjacent cells, instead of recalculating all 4,450 signatures in Royal Valley. An incomplete cache, changes of map/seed/render settings, and unspecified edits still force the full authoritative scan. No terrain geometry, material parameters, scene ordering, map template or save schema changed.

## Measured validation in CI

Setup: real Three.js/WebGL game in headless Chromium on GitHub-hosted Ubuntu. The automated fixture loads a developed **50×89** Royal Valley map with over **150** persisted buildings (roads, cottages and a Tower). Graphics are **Low**, in the **Performance** profile, with effects and shadows disabled. Tests use actual canvas/UI input for connected road placement, Tower fortification upgrade and Cottage relocation; they assert successful gameplay state mutations, Undo/Redo and save reload.

[Validated browser and TypeScript workflow](https://github.com/abolfazl2600/Castlegame/actions/runs/38052464876) — both Playwright tests passed. A single hosted CI run produced:

| Operation | Preserved existing building objects | Rebuilt building objects | Last synchronous redraw (ms) |
| --- | ---: | ---: | ---: |
| New road connection | 156 | 4 | 275.4 |
| Tower upgrade | 158 | 1 | 258.3 |
| Cottage relocation | 157 | 2 | 273.8 |

The test verifies that the new road and its connected neighbor have fresh appropriate scene objects, while remote roads and cottages preserve their **same UUIDs**. The visual-scene geometry count stays **6,756** when comparing an unchanged final scene through the full and retained-object paths. The affected road operation scans **at most 5** terrain cells; Tower upgrade scans at most 5 and relocation at most 10. These are asserted properties, not unverified speedup estimates.

**Same-scene A/B measurement on one hosted run:**

| Measurement | Full reconstruction | Retain stable meshes / no terrain change |
| --- | ---: | ---: |
| Synchronous `redraw()` | 288.5 ms | 245.5 ms |
| Terrain cell signatures examined | 4,450 | 0 |
| Preserved building groups | 0 | 159 |
| Rebuilt building groups | 160 | 1 |

In this one synthetic run, the 43.0 ms difference equals approximately **14.9%** less synchronous rebuild time. The experiment only measures a single hosted Chromium run and is not a statistically robust FPS improvement or a guarantee for low-end Android hardware. Timing of road editing includes other gameplay systems and need not match the A/B result. An earlier run without the local terrain scan optimization measured **376.2 ms full vs 373.7 ms retained** on a separate host; those absolute times should **not** be compared across runs. The small earlier delta motivated reducing the redundant terrain-signature scan rather than attributing a broad performance benefit to mesh reuse alone.

A **second independent hosted CI run**, after adding GPU/draw/heap logging, also passed: [run 38052948503](https://github.com/abolfazl2600/Castlegame/actions/runs/38052948503). For the same-scene A/B, it measured **228.2 ms full** versus **212.8 ms retained** (15.4 ms, approximately **6.7%** in that single run). It confirmed **1,191 GPU geometries**, **1,292 draw calls**, **6,756 scene geometries** and **76.6 MB exposed JS heap** for **both** routes after rendering. These equal steady-state numbers are expected: the optimization is about construction-related recreation work, not changing the final mesh/draw budget. The two runs are not statistically sufficient to promise a fixed CPU improvement; their observed A/B differences range from **6.7% to 14.9%**.

The QA metrics also collect WebGL geometry counters, draw-call counts and JavaScript heap when exposed. Retaining objects reduces geometry allocation/disposal **churn**, not necessarily steady-state GPU memory or render draw calls; matching scene geometry counts do **not** prove pixel equality. No GPU-timer throughput, native PSS, device temperature or physical-device memory profile was measured here.

## Safety and remaining review

The following authoritative paths remain unmodified: castle block recomputation, automatic stairs, gate/windmill systems, destructible visuals, Keep/bridge rebuilds, moat construction, settlement-agent navigation, player selection, the minimap, construction workers/animations, save serialization and battle simulation. Active battles force the original full building rebuild. Unknown extensions cannot silently reuse stale overridden building meshes.

The dedicated `Construction Scene Rebuild QA` workflow executes existing building/edit UX, construction animation and worker projects, Market footprint, terrain chunk/resource lifecycle, renderer budget, TypeScript and Vite build, then browser interaction and A/B assertions. None of this replaces a long-session physical Android GPU/memory test, and an extended device memory/leak assessment remains a separate release-validation task.

**Assessment:** The root cause was verified and an incremental, explicitly scoped reduction in build-layer GPU allocation churn and redundant terrain scanning was validated. Global reconstruction remains deliberately available where correctness requires it.
