# Gameplay event feedback

The game now plays short, event-driven cues and renders short-lived world-space effects for four moments:

| Event | Audio ID | Visual |
| --- | --- | --- |
| Placement / construction completion | `building.place`, `building.started`, `building.complete` | Amber construction ring with rising glints |
| Unit or wall hit | `combat.melee-hit`, `combat.projectile-impact`, `combat.wall-hit` | Quick warm impact sparks |
| Demolition / breached wall | `building.destroyed`, `combat.wall-destroyed` | Brown dust and debris burst |
| Successful defense | `combat.victory` | Two widening gold rings and a larger celebration burst |

## Ownership and integration

- `src/audio/AudioAssets.ts` remains the manifest for logical cues. The existing `AudioManager` owns audio unlock, audio focus, sound enable/mute, per-bus volume, voice caps and cooldowns.
- `src/rendering/GameplayFeedbackSystem.ts` owns **only** temporary Three.js meshes. Call `spawn(kind, x, y, z, quality)` after a valid gameplay event and `update(deltaMs, enabled)` from the render loop.
- `ThreeGame` converts grid positions to world coordinates and respects **Effects enabled**, **Reduced motion** and visual benchmark mode.
- `BattleSystem` uses an optional `onVisualFeedback` callback to announce unit hits, wall hits and breached walls. No visual objects, audio preferences or save data enter the battle domain.
- Reset/load/new-world paths clear active transient meshes. Gameplay remains unchanged when effects are disabled.

## Performance and accessibility

- Maximum live feedback meshes: **36 Low**, **86 Medium**, **144 High**. Additional bursts are dropped at capacity.
- Shared geometry and material objects are reused for all bursts; meshes expire during normal frame updates. There are no setTimeout loops or per-frame material allocations.
- Reduced motion or disabled graphics effects clears all bursts immediately; the existing independently controlled audio SFX remain available.
- Procedural SFX avoid adding external downloads and are subject to per-asset cooldowns and voice limits. They do not override the user's mute or SFX settings.

## Verify before release

Run:

```bash
npm run test:gameplay-feedback
npm run test:adaptive-audio
npm run test:battle-state-boundary
npm run test:construction-animation
npm run build
npm run build:android
```

On a **physical Android device**, test a series of rapid placements, worker completions, many simultaneous melee hits, wall breach/destruction and defender victory. Repeat in Low/Medium/High quality with reduced motion on/off, sound muted/unmuted and app background/resume. Check frame pacing, overlay visibility, memory stability, and sound overlaps. Do not mark device validation complete from browser-only tests.
