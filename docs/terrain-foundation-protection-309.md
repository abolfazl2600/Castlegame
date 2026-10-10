# Issue #309 — Terrain edits versus existing foundations

## Root-cause assessment

The original `ThreeGame.canEditTerrainAt()` returned the inverse of `isStructureFootprintReserved()`. That helper correctly protects queued moat excavation and multi-cell building footprints such as the Market's 3×3 area, but deliberately does **not** consider ordinary single-cell building anchors or Keep objects. The terrain brush already calls `canEditTerrainAt()` for every affected point; therefore Raise/Lower/Smooth/Hill/Cliff/Flatten could alter the elevation under a Keep's rotated footprint or a placed Cottage, Wall, Tower or Market anchor after placement.

This is a gameplay/geometry consistency risk, not just an inaccurate visual preview. `KeepSystem.validate()` rejects foundation elevation spans greater than **2.8**, but that check only runs for construction, upgrade and relocation. `KeepRenderer.render()` re-reads all foundation cell elevations on redraw to choose foundation bottom/top and stair heights. Mutating existing support cells could therefore change the Keep's foundation geometry without invoking its placement constraints. Ordinary structures are also rendered relative to their current elevation; allowing brushes to modify their support tiles can shift them unexpectedly. The elevation map is included in undo snapshots and saves, so unsupported heights could persist across Undo/Redo and reload.

## Targeted correction

`canEditTerrainAt()` now requires three simultaneous conditions:

1. There is **no** occupied `GameState` cell at the target.
2. The cell does **not** fall inside any Keep foundation, including rotated rectangular Keeps, as determined by the authoritative `KeepSystem.findAtCell()` / `footprint()`.
3. The cell is not otherwise reserved by a multi-cell structure or pending moat operation.

The fix keeps `applyTerrainBrush()`'s existing per-cell guard. A mixed brush can still change unoccupied free land while skipping occupied cells, and a brush hitting only protected cells makes no changes, history records or autosave writes. Demolishing a Keep/building or clearing the corresponding reserved footprint immediately permits edits again, because checks consult live state instead of a stale reservation cache.

We intentionally **do not** rewrite elevation values from historical saves or Undo snapshots. Historical authored templates and save files may legitimately contain terrain heights around structures. Reinterpreting them during load would alter existing visuals, gameplay and backwards compatibility. This fix prevents *new* invalid terrain strokes without modifying old game data.

## Validation

The dedicated `Terrain Foundation Protection QA` workflow runs the existing Keep/build/edit, Market footprint, river visibility, terrain resource lifecycle and chunk tests, plus TypeScript and Vite build. `tests/terrain-foundation-protection.spec.ts` drives the actual game using Chromium:

- a non-square rotated Keep, ordinary Cottage anchor, Market anchor and Market satellite;
- repeated Raise attempts, asserting that blocked cells do not create an elevation override or an Undo entry;
- a nearby free cell accepts the same terrain tool, and its height survives Undo, Redo and save reload while protected cells remain unchanged;
- demolishing the Keep releases its formerly protected foundation cell; Undo restores the Keep and therefore restores editing protection.

These checks validate logical elevation protection in the actual browser, with normal runtime rendering and save/loading. Pixel-by-pixel comparisons or validation of malformed historical saves are not claimed. The Keep renderer and save format remain unchanged.

## Review boundary

This issue is independent of localized chunk GPU lifecycle and river-elevation restoration issues. No regression in the validity of previously placed Keeps is expected; existing layout/template construction and upgrades retain their previous validation rules.
