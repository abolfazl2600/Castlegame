# Great Keep architectural redesign

## Asset brief
The Keep is the largest player-authored stone stronghold landmark, readable from the game's normal three-quarter camera as well as top-down inspection. The **existing 3×3–5×5 tile footprint, height by floor count, and rotation** remain authoritative. A recognizable great-hall roofline, flanking defensive turrets, and substantial entrance should distinguish it from residential and temple landmarks.

## Visual language
- Main medieval variants have an articulated stone great-hall core, foundation plinth, capped corner piers, projecting support buttresses, cornices and floor bands. Materials derive from the player's existing stone-style selection.
- The primary entrance keeps the current terrain-aware side selection, access threshold and steps, with a framed double-leaf timber door and readable iron straps.
- The **sloped** variant uses a true rectangular gable ridge (not a scaled 4-sided cone). The **towered** variant adds a raised watch chamber with its own gabled cap. **Flat battlement** and **defensive platform** variants retain open defensive decks; the latter gains a modest lookout dais.
- Optional corner towers are faceted, founded stone turrets with narrow arrow slits, machicolation collars, and either clay caps or crenellations. The Japanese tiered variant preserves its distinct historic roof family and gains stronger overhanging timber eaves.
- Heraldry uses a new shared, matte fabric material rather than the roof tile texture. Glazed openings have dark recessed tones instead of bright turquoise glow.

## Gameplay and compatibility
The rework stays entirely in `KeepRenderer` plus a shared visual-only cloth material. It does **not** alter `KeepState`, collision or occupancy footprints, Keep upgrades, navigation, damage, save/load format, terrain editing, or the 3D camera. Redraws remain deterministic from saved Keep state and world coordinates. No new animations, lights or textures are downloaded.

## Performance and review
Meshes are created only during Keep scene rebuild, never every animation frame; color materials reuse the existing style kit. The regression script checks the geometry of all five roof variants, optional towers, rotation, foundation terrain contact, vertical floor progression, deterministic redraw, and a conservative per-Keep mesh budget. The dedicated QA workflow builds the game and exercises its existing Keep save/load browser scenarios.

Screenshots from the browser regression are uploaded as GitHub Actions artifacts. The historical templates (Himeji/Crac) should retain their authored layout and saved architectural flags rather than being converted into a generic western castle.

## Follow-up visual acceptance
Review the Keep from ordinary gameplay zoom, near inspection, and top-down; confirm rooflines, steps, and battlements do not obstruct adjacent walls, roads or camera controls. Inspect both low graphics and high graphics presets, as well as landscape mobile. The renderer's visual redesign is not a substitute for this real-device visual review.
