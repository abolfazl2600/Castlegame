# Issue #130 — Normal-Zoom Building Silhouette Audit

Reference viewing distances come from `WORLD_STYLE.camera.referenceDistances` and are shared with the gameplay camera:

- Near inspection: 48
- Normal gameplay: 104
- Maximum strategic: 148

The normal-gameplay view is the authoritative distance for silhouette decisions. Small props are secondary and must not carry the building identity.

## Audit result

| Family | Primary silhouette read | Action in this pass |
| --- | --- | --- |
| Cottage | loose, low hamlet with open yard | reduced roof count and kept all masses low |
| House | dense residential roof block | added a clearly taller central dwelling |
| Manor | formal court | strengthened one dominant central hall with lower side wings |
| Villa | open courtyard residence | changed to an asymmetric U-shaped court with a taller corner pavilion |
| Farm | open field rows + granary | retained; already dominated by field geometry and granary mass |
| Cattle farm | barn + stockyard | retained; four-level barn/yard massing is already explicit |
| Market | open canopy square + market hall | retained; open-vs-enclosed composition is distinctive |
| Windmill | vertical mill + four-sail rotor | retained; landmark silhouette is already unique |
| Army Camp | tent/command compound + standards | retained; level progression changes the main mass |
| Harbor | long shore-to-water axis + cranes | retained; progression changes pier width/length and skyline |
| Basilica | nave/transept + bell tower/cross | retained; strong civic landmark |
| Keep | fortified vertical core | retained for this pass; defense-specific refinement belongs to #133 |
| Modern Fortress | wide fortified campus + corner towers/spire | retained; already visually isolated from medieval families |

## Regression scene

`scripts/visual-reference-scene.mjs` now derives Near / Normal / Strategic cameras directly from `WorldStyle.ts`. This prevents screenshot comparisons from silently using an obsolete camera after gameplay camera tuning.

Use the existing visual reference and dense scenes for comparison. The dense scene is intentionally the harder recognition case.

## Constraints preserved

- No gameplay footprint changes were made.
- No economy or placement values changed.
- No save schema change is required.
- Silhouette changes are deterministic and do not add per-frame simulation work.
- Defense-specific silhouette changes remain scoped to #133 so this pass does not overlap that phase.


## Before / after evidence

Final comparison workflow: [Actions run #36551298873](https://github.com/abolfazl2600/Castlegame/actions/runs/36551298873)

Artifact: `issue-130-normal-zoom-before-after-f11be06b034fd53014d681c875a581c07045c091`

The artifact contains the same deterministic dense settlement at the shared Normal gameplay camera for both revisions:

- `before/dense-normal-desktop.png`
- `after/dense-normal-desktop.png`
- `before/dense-normal-mobile.png`
- `after/dense-normal-mobile.png`

The before revision is `34e06d331da0df4b8ada8936cddbfb0f8823d231` (phase-1 camera complete, before silhouette changes). The after revision is the current silhouette pass. Both builds use the same current camera fixture; the before capture runs on an isolated preview port so it cannot accidentally reuse the after build.

A pixel-level sanity check confirms the captures are materially different rather than rendering noise:

- desktop: 24,699 pixels differ by more than 10 RGB levels (about 2.01% of the frame)
- mobile: 19,602 pixels differ by more than 10 RGB levels (about 5.96% of the frame)

The visible change is concentrated in settlement rooflines and residential massing, while terrain, roads, castle footprint, placement and gameplay state remain unchanged.
