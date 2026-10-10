# Issue #317: Persistent over-budget LOD review

## Findings in the existing implementation

`DistanceDetailBudgetSystem.update()` used the measured `renderer.info.render.calls > budget.drawCalls` condition as an unconditional reason to re-run the complete LOD pass. For performance mode, the nominal ceiling is 500 calls, and some castle silhouettes, instanced meshes, and other non-micro meshes cannot be suppressed safely. This means an unchanged scene could permanently exceed the cap while triggering `restoreSuppressedDetail()`, two full scene traversals, matrix updates, and candidate sorting each frame. The second detail pass could also run even if the first pass had already suppressed every optional high-detail mesh.

This finding follows directly from the update condition and the protected-geometry rules. The CPU cost for a particular Android phone remains hardware-dependent and has **not** been measured here.

## Targeted change

- Full budgeting still runs immediately when the detail band, render profile, quality, shadow settings, memory-pressure class, or scene invalidation changes.
- For otherwise unchanged scenes already over budget, one initial follow-up evaluation is permitted. Subsequent evaluations occur only after a significant additional increase in draw calls (at least 16 or 4% of the cap, with a 750 ms cooldown) or a 10-second periodic safety recheck. A return to or below the cap resets the gate.
- Once no optional high-detail meshes survive the first pass, a second suppression pass cannot reduce the remaining draw-call estimate and is skipped.
- The performance overlay reports cumulative LOD scene recalculations and over-budget retries. These counters make profiling repeatable and distinguish remaining GPU pressure from CPU work caused by the governor.

This change does **not** remove protected geometry, change nominal draw-call caps, alter adaptive profile selection, or guarantee that total renderer calls can fall under the cap.

## Reproducible validation

- `npm run test:lod-recheck` tests the recheck gate using a deterministic simulated sequence. In its static overload stress case, 600 frame checks request **1** retry rather than the original unconditional **600**.
- The same test suite bundles the production governor and exercises a real Three.js scene with protected silhouettes, an InstancedMesh, and micro-detail. It asserts that repeat calls with unchanged measured over-budget draw counts do not re-traverse the scene, but explicit invalidation and profile changes do.
- `npm run test:distance-detail-budget`, `npm run test:mobile-render-performance`, `npm run test:adaptive-render-profile`, and TypeScript checks remain relevant regressions.
- The dedicated `LOD Performance Regression QA` workflow runs on affected pull requests.

The synthetic stress result is an **operation-count comparison**, not a real-device FPS claim.

## On-device follow-up profiling

Use the existing performance overlay in a large, dense castle on lower-end Android devices. Compare stable camera/gameplay conditions before/after this patch at the same scene, quality settings, camera distance, and battle state. Observe `LOD scene recalculations` over 30–60 seconds alongside `FPS`, `CPU game update`, `Draw calls`, and GPU frame time where available. Then add/edit buildings, change the camera band, switch performance profiles, and trigger battle activity. LOD passes should remain rare for steady over-budget pressure and should resume when scene or quality state changes. Do not assume that an unchanged over-budget draw count indicates zero GPU workload.
