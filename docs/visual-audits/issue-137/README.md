# Issue #137 — Final normal-zoom visual coherence QA

## Scope

This is the final integration/QA pass for the completed Visual Readability series.

Phases #134, #135, and #136 are complete and implemented on `main`:

- #134 — complete — centralized ambient world motion
- #135 — complete — deterministic seasonal/environment transitions with save/load state
- #136 — complete — distance-aware rendering budgets for desktop/mobile, shadow caps, raster scaling, and animation scaling

The final QA therefore validates these systems together rather than treating #135/#136 as deferred work.

## Authoritative camera references

The QA uses the shared `WORLD_STYLE` camera contract:

- Near inspection: 48
- Normal gameplay: 104
- Maximum strategic: 148

Normal gameplay remains the primary composition. Strategic zoom is captured separately and must activate the strategic distance budget without hiding silhouette-defining geometry.

## Deterministic scene matrix

The runner uses fixed save fixtures and seed `6001`.

| Fixture | Purpose |
| --- | --- |
| Starter | Small early settlement, roads/agriculture/basic defense |
| Dense | Mature medieval city and mixed building-family recognition |
| Castle | Large defensive composition with Keep, walls, towers, gate, and damage states |
| Farm | Level 1–4 Farm, Cattle Farm, Orchard, and Army Camp progression |
| Harbor | Unified Harbor Levels 1–4 |
| Mobile landscape | Starter settlement at 740×390 using touch controls |
| Castle battle | Deterministic active battle |
| Dense strategic | Dense city at maximum strategic camera distance |
| Dense autumn | Dense city with saved autumn environment state |
| Farm winter | Upgrade-heavy farm district with saved winter environment state |

## Living-world and season coverage

The final pass verifies the centralized ambient-motion route for windmills, water texture flow, flags, citizens, and workers. Reduced Motion and Effects gates remain part of the contract.

Seasonal coverage is now part of the final visual evidence. The QA injects saved environment progress values and verifies that the rendered game reports the expected active seasonal state. This confirms #135 participates in the same save/load + render path used by normal gameplay.

## Distance-aware performance coverage

The visual benchmark diagnostics now expose the active `DistanceDetailBudgetSystem` snapshot. Final QA verifies:

- Normal captures select the gameplay distance band.
- Strategic captures select the strategic band.
- Mobile landscape selects the mobile budget profile.
- Active shadow casters never exceed the current band cap.
- Active high-detail meshes never exceed the current band cap.
- Measured and estimated draw calls are validated against the active distance-band budget.
- Dense strategic scenes must be cheaper than dense normal scenes.
- Dense mobile normal/strategic fixtures select the stricter mobile profile.
- The active environment and budget state are stored in `metrics.json`.

The runner also continues recording frame time, draw calls, triangles, scene materials, redraw time, and UI coverage. Headless Chromium uses ANGLE/SwiftShader, so absolute frame-time numbers are regression evidence rather than physical-GPU FPS promises.

## Memory budget

The game now targets a **2 GiB maximum JavaScript heap budget**. The runtime distance/detail governor monitors browser heap telemetry when available and reduces rendering work as memory pressure approaches the ceiling:

- elevated pressure begins at 75% of the 2 GiB budget
- critical pressure begins at 90%
- Final Visual QA hard-fails any measured scenario above 2 GiB
- CI Chromium is launched with a 2048 MiB V8 old-space ceiling

This is an application/JavaScript heap budget; the browser process and GPU can use additional memory outside the page heap.

## Recorded integration thresholds

Desktop:

- P95 frame time ≤ 220 ms
- median draw calls ≤ 1800
- triangles ≤ 1,200,000
- scene materials ≤ 260
- initial redraw ≤ 1800 ms
- fixed/sticky UI coverage ≤ 32%
- measured JavaScript heap ≤ 2 GiB

Mobile landscape:

- P95 frame time ≤ 260 ms
- median draw calls ≤ 1800
- triangles ≤ 1,200,000
- scene materials ≤ 260
- initial redraw ≤ 2100 ms
- fixed/sticky UI coverage ≤ 44%
- measured JavaScript heap ≤ 2 GiB

UI obstruction and invalid active-budget state are hard failures. Performance measurements are retained in the artifact so any remaining production optimization defect can be filed as a focused follow-up rather than hidden inside a broad visual rewrite.

## Reference evidence

The `Final Visual Coherence QA` workflow stores:

- all reference screenshots
- `metrics.json`
- generated `summary.md`

The workflow now runs when the final-QA code changes and when the core seasonal, distance-budget, or main render integration paths change.

## Acceptance interpretation

The final pass is considered coherent when:

- all supported major building families remain recognizable at normal zoom
- Level 1–4 upgrade fixtures remain visually distinct
- battle damage and defensive silhouettes remain readable
- normal/strategic camera states activate the correct rendering budget
- mobile selects the mobile rendering profile without excessive UI obstruction
- autumn/winter fixtures render through the saved seasonal environment state
- ambient motion remains centralized and accessibility-gated
- reference screenshots and metrics are emitted for regression comparison
- any remaining measured performance defect is isolated into a focused follow-up issue

#158 is implemented on this branch: dense-scene draw-call and high-detail-mesh budgets are now actively enforced and validated by final QA.
