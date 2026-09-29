# Issue #137 — Final normal-zoom visual coherence QA

## Scope

This is the final integration/QA pass for the currently implemented visual systems.

The user explicitly requested execution of #137 while #134, #135, and #136 are still open. Those three issues are therefore treated as **focused follow-up work**, not silently marked complete and not folded into this issue.

- #134 — broader ambient world-motion layer
- #135 — seasonal/environment-state transitions
- #136 — distance-aware detail / LOD / formal visual performance budgets

The final QA verifies the systems that already exist and records those remaining areas as focused follow-ups rather than reopening a broad visual rewrite.

## Authoritative camera references

The final QA uses the shared camera contract from `WORLD_STYLE`:

- Near inspection: 48
- Normal gameplay: 104
- Maximum strategic: 148

Normal gameplay is the primary composition. Strategic zoom is checked separately for usefulness and scene readability.

## Deterministic scene matrix

The final runner uses fixed save fixtures and seed `6001`.

| Fixture | Purpose |
| --- | --- |
| Starter | Small early settlement, basic roads/agriculture/defense |
| Dense | Mature medieval settlement and mixed building-family recognition |
| Castle | Large defensive composition, Keep, Wall 1/2/3, towers, gate, persistent wall-damage states |
| Farm | Level 1–4 Farm, Cattle Farm, Orchard and Army Camp progression in one scene |
| Harbor | Unified Harbor Levels 1–4 plus nearby settlement landmarks |
| Modern | Modern Mode using the currently supported Futuristic Castle architecture |
| Mobile landscape | Starter settlement at 740×390 with touch controls |
| Castle battle | Castle fixture with a deterministic large battle started before capture |
| Dense strategic | Dense settlement at the maximum strategic camera reference |

## Existing living-world motion checked in this phase

The currently implemented ambient-motion path remains active when visual effects are enabled and Reduced Motion is off:

- Windmill rotation
- River texture movement
- Ocean texture movement
- Castle flag movement
- Settlement/citizen and worker movement where applicable

This does **not** claim #134 is complete. #134 remains the focused task for a broader ambient-motion layer such as foliage sway, smoke, harbor bobbing/activity and additional state-aware environmental motion.

## Seasons/environment states

There is no complete saved seasonal/environment-state system yet.

That is intentionally left to #135 and is **not marked complete by #137**. The current QA verifies the present world palette/material coherence only.

## Distance-aware detail / LOD

The game already has shared camera references and graphics-quality settings, but the dedicated distance-aware LOD/budget system remains #136.

#137 therefore measures and stores current dense-scene costs, while #136 remains the focused optimization task.

## Performance and UI budgets

The headless CI runner uses Chromium ANGLE/SwiftShader, so the absolute frame-time values are software-renderer regression budgets rather than physical-GPU FPS promises.

Desktop Normal/Strategic/Battle checks enforce:

- P95 frame time ≤ 220 ms
- median draw calls ≤ 1800
- triangles ≤ 1,200,000
- scene materials ≤ 260
- initial redraw ≤ 1800 ms
- fixed/sticky UI screen coverage ≤ 32%

Mobile landscape checks enforce:

- P95 frame time ≤ 260 ms
- median draw calls ≤ 1800
- triangles ≤ 1,200,000
- scene materials ≤ 260
- initial redraw ≤ 2100 ms
- fixed/sticky UI screen coverage ≤ 44%

The values are intentionally conservative for software-rendered CI. They are meant to catch major regressions and scene explosions while #136 defines more aggressive distance-aware production budgets.

## Reference evidence

The workflow `Final Visual Coherence QA` stores an artifact containing:

- all final reference screenshots
- `metrics.json`
- generated `summary.md`

Artifact screenshots:

- `starter-normal-desktop.png`
- `dense-normal-desktop.png`
- `castle-normal-desktop.png`
- `farm-normal-desktop.png`
- `harbor-normal-desktop.png`
- `modern-normal-desktop.png`
- `dense-strategic-desktop.png`
- `castle-battle-normal-desktop.png`
- `starter-normal-mobile-landscape.png`

The artifact/run identifier is added to this document and to issue #137 after the workflow succeeds.

## Acceptance interpretation

This phase is complete when:

- all supported major building families are represented in the deterministic QA fixtures
- the Farm/Cattle/Orchard/Army Camp Level 1–4 strips remain present in the final fixture
- the Harbor Level 1–4 progression remains present
- defensive damage and battle are captured
- Modern Mode has a dedicated capture using actually supported modern content
- desktop Normal and Strategic captures pass the enforced budgets
- mobile landscape passes its UI/performance budget
- final screenshots and metrics are stored as a workflow artifact
- remaining broad future visual systems are represented by focused issues rather than hidden inside #137

#134, #135, and #136 remain open and are **not marked complete** by this QA pass.
