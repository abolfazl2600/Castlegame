# Ambient world motion

Issue #134 adds one lightweight render-only motion layer for the settlement world.

## Design rule

Ambient motion must make the map feel alive without becoming gameplay state. It may move render objects, texture offsets, or decorative effects, but it must not create workers, resources, soldiers, production, or pathfinding results.

Real farmer and citizen movement remains owned by the settlement simulation. The ambient system does not fabricate replacement NPC activity.

## Motion channels

`AmbientMotionSystem` owns the shared budget and update cadence for:

- river and ocean texture flow
- castle and Army Camp flag flutter
- restrained tree and orchard-canopy sway
- chimney smoke drift
- docked harbor ship bobbing
- slow cloud drift
- small decorative idle motion such as Army Camp fire sway

Windmill rotation consumes the same returned motion scale so it respects the same accessibility, quality, and camera-distance rules.

## Camera-distance behavior

The shared camera references in `WorldStyle.ts` are authoritative.

- At or inside **normal gameplay** distance, ambient motion keeps its configured strength.
- Between normal gameplay and **maximum strategic** distance, amplitude/speed is progressively reduced.
- At maximum strategic distance, only a small fraction of the normal motion budget remains.

This keeps the world alive without making the strategic view visually noisy.

## Graphics and accessibility

Motion scale combines:

- Effects enabled/disabled
- Reduced Motion
- graphics quality
- environment detail
- performance mode
- camera distance

Reduced Motion or disabled effects returns a zero decorative-motion scale. Scene-bound transforms are restored to their baseline pose, water texture flow stops, clouds stop drifting, and windmill rotation receives no ambient delta.

Low-detail/performance modes also lower animation cadence so dense settlements do not pay the same per-frame transform cost as high-quality mode.

## Lifecycle and cleanup

Scene-bound registrations are cleared before `buildLayer` is destroyed during `redraw()`.

This prevents stale references when:

- buildings are removed
- a save is loaded
- a template replaces the settlement
- an upgrade rebuilds a structure
- the scene redraws after terrain/build edits

Persistent channels such as clouds and shared water textures survive build redraws.

## Operational state

Ambient effects only mirror state where the game already has a meaningful source:

- real farmers/citizens continue using settlement simulation
- docked ships bob only when a harbor actually renders a ship
- chimney smoke appears only on detailed homes that already render a chimney
- windmills rotate only while their rendered rotor exists
- Army Camp fire/flags exist only for rendered camp variants

Future production-state systems can gate these registrations more strictly without changing the ambient-motion API.
