# Issue 132 — Settlement four-level visual readability audit

This audit verifies the settlement application of the shared four-level visual language at the authoritative **normal gameplay zoom**.

## Strip layout

The capture script builds one deterministic comparison scene:

- top row: Cottage → House → Manor → Villa
- crop farm: Levels 1 → 4
- cattle farm: Levels 1 → 4
- apple orchard: Levels 1 → 4
- army camp: Levels 1 → 4
- harbor: Levels 1 → 4
- left-side fixed landmarks: Market, Windmill, Basilica

The intent is to judge **large-form silhouette first**, not crate/barrel counts.

## Expected evidence

- `before-main.png` — same deterministic scene rendered from the pre-#132 main implementation.
- `after-132.png` — same scene rendered from the #132 implementation.

Both captures use the shared normal gameplay camera reference from `WorldStyle.ts`.

## What changed

- Residential family is formally mapped to visual Levels 1–4.
- Villa gains a cupola landmark so the final residential tier has an unmistakable skyline feature.
- Apple Orchard expands from three visual sizes to four maturity levels.
- Orchard Level 3 adds a visible entrance trellis.
- Orchard Level 4 adds a dedicated packing shed and larger 5×4 planting mass.
- Market, Basilica, and Windmill are preserved as fixed-role landmarks instead of receiving fake upgrade mechanics.
- Existing Farm, Cattle Farm, Army Camp, and Harbor progression remains gameplay-compatible and continues to use the shared `upgradeVisualProfile`.

## Regression rules

- no footprint/economy/pathfinding changes are required for the visual tier mapping
- small props cannot be the primary level signal
- fixed landmarks remain fixed-role buildings
- save/load continues to consume existing `cell.level` values
- orchard Level 4 must degrade safely to the same cell representation used by earlier sizes

## Reproduce

Build the game, then run:

```bash
npm run visual:upgrade-strips -- --out docs/visual-audits/issue-132 --name after-132
```

For the before image, run the same command on the pre-#132 main revision with `--name before-main`.
