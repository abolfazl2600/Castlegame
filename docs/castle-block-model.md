# Castle Block Model Compatibility

The authoritative gameplay storage remains the existing grid cell state in `GameState`. Castle blocks are a deterministic structural projection of those cells, not a second mutable castle database.

## Legacy/current mapping

- `wall1`, `wall2`, `wall3` -> `CastleBlockState.kind = "wall"`
- `gate` -> `CastleBlockState.kind = "gate"`
- `tower` -> `CastleBlockState.kind = "tower"`
- `level` -> structural stack (walls 1–12; gates/towers 1–4), local top, and terrain-adjusted world top
- `damage` -> persistent normalized intact/cracked/heavy/partial-breach/collapsed state; collapsed walls become passable rubble
- `wallLinks` -> reciprocal diagonal connectivity; adjacent cardinal castle blocks connect automatically
- `gateOpen` -> saved manual gate preference (missing value means open); attack mode temporarily closes gates without erasing that preference
- `walkway` and gate semantics -> traversal metadata
- tower shape/top remain rendering metadata on the block

Stable block IDs are coordinate-derived (`castle-block:x:y`). Connected structures receive deterministic IDs based on the first grid cell in sorted order.

## Source of truth

Edits continue to mutate `GameState`. Rendering, navigation, siege, and future castle-block UX should consume `CastleBlockSystem.build(...)`. This prevents duplicate logical castles and keeps old saves compatible without a destructive migration.

## Connected editing and traversal

Wall geometry consumes the resolved `isolated`, `end`, `straight`, `corner`, `t-junction`, and `4-way` topology. Ordinary wall edits replace only the changed cell and its immediate neighbors; edits involving gates, towers, weapon mounts, or active battle use a complete redraw. The wall-drag preview builds a temporary projection with the same resolver.

The elevated navigation network uses reciprocal resolved links and height compatibility. Only wall platforms reachable from a tower or gate with an adjacent safe ground cell are used for defender assignments. Defenders enter on the ground, ascend at an access anchor, and move along the connected wall route. A lost route falls back to safe ground. Wall damage is committed through the world boundary to `GameState`, saved, and restored as the same stage after load.

Construction animation and ambient fauna remain presentation-only. Their temporary object positions are not serialized; saves contain the completed buildings and persistent castle damage.
