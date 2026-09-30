# Distance-aware visual performance budgets

Issue #136 introduces a camera-distance performance governor. It uses the shared camera reference distances from `WORLD_STYLE` and three hysteresis-aware bands so normal camera motion does not repeatedly flip quality state.

## Distance bands

- **Inspection**: close camera work where small detail and animation are most visible.
- **Gameplay**: the normal isometric play distance.
- **Strategic**: the widest gameplay zoom, where silhouette matters more than micro-detail.

Band boundaries are the midpoints between the existing camera reference distances with a 4-unit hysteresis margin. The governor never hides silhouette-defining building geometry.

## Desktop budgets

| Band | Draw calls target | Animated objects | Particles | Shadow casters | High-detail meshes | Pixel ratio scale |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Inspection | 950 | 180 | 160 | 220 | 520 | 1.00 |
| Gameplay | 760 | 120 | 96 | 150 | 360 | 0.92 |
| Strategic | 620 | 72 | 48 | 84 | 220 | 0.78 |

## Mobile budgets

| Band | Draw calls target | Animated objects | Particles | Shadow casters | High-detail meshes | Pixel ratio scale |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Inspection | 620 | 96 | 72 | 96 | 280 | 0.82 |
| Gameplay | 520 | 64 | 48 | 64 | 210 | 0.72 |
| Strategic | 430 | 40 | 24 | 36 | 140 | 0.62 |

The draw-call, particle, and high-detail-mesh values are explicit scene budgets for renderer authors and future instrumentation. The current governor actively enforces the raster/pixel-ratio budget, ambient animation scaling, and shadow-caster cap. Repeated geometry and material reuse should continue to be preferred as new assets are added.

## Silhouette stability

Shadow priority is biased toward defensive silhouette objects and landmark/readability objects. Geometry visibility is not switched off by the distance governor, which keeps walls, towers, keeps, fortresses, and building upgrade silhouettes stable at normal and strategic zoom.

## Independent render profiles (Graphics settings)

Input controls and viewport size do not select a render profile. Touch / Mobile only changes input and layout.

- **Auto (default for new settings)** starts Balanced and evaluates observed requestAnimationFrame intervals. Sustained slow frames (roughly 3 seconds above 29 ms smoothed) step down one preset; sustained fast frames (12 seconds below 18 ms) step up. A 12-second cooldown prevents visual oscillation. Long background/tab gaps are ignored. Frame pacing includes CPU and GPU delays but is not a direct GPU benchmark.
- **Performance** applies the former mobile/constrained budgets, with stricter pixel, animation, shadow and micro-detail limits even on desktop.
- **Balanced** interpolates the existing constrained and desktop budgets; decorative detail is not suppressed solely for having a touchscreen.
- **Quality** uses the desktop budgets, retaining decorative detail at ordinary gameplay distances unless strategic LOD, explicit Low quality or memory pressure calls for reduction.

The debug-only **Mobile rendering budget** switch overrides the active profile with Performance until disabled; it never emulates actual phone hardware. Auto sampling is paused during this override. Existing manual user settings continue to load unchanged. The 2 GiB JavaScript heap budget does not measure the phone's full RAM or VRAM.
