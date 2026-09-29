# Castle Block Model Compatibility

The authoritative gameplay storage remains the existing grid cell state in `GameState`. Castle blocks are a deterministic structural projection of those cells, not a second mutable castle database.

## Legacy/current mapping

- `wall1`, `wall2`, `wall3` -> `CastleBlockState.kind = "wall"`
- `gate` -> `CastleBlockState.kind = "gate"`
- `tower` -> `CastleBlockState.kind = "tower"`
- `level` -> block height/vertical stack metadata
- `damage` -> persistent normalized damage state
- `wallLinks` -> explicit connectivity; when absent, connectivity is inferred from adjacent castle cells
- `walkway` and gate semantics -> traversal metadata
- tower shape/top remain rendering metadata on the block

Stable block IDs are coordinate-derived (`castle-block:x:y`). Connected structures receive deterministic IDs based on the first grid cell in sorted order.

## Source of truth

Edits continue to mutate `GameState`. Rendering, navigation, siege, and future castle-block UX should consume `CastleBlockSystem.build(...)`. This prevents duplicate logical castles and keeps old saves compatible without a destructive migration.
