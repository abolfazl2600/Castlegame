# Android performance benchmark protocol

This is the reproducible device-validation procedure for Issue #116. Automated browser tests are not substitutes for these measurements.

## Build identity

For every run record:

- Git commit SHA
- build type (release/debug)
- Android device model
- Android version
- Android System WebView / Chrome version
- SoC / GPU (record Adreno or Mali explicitly)
- device RAM
- battery/charging state
- room/device starting temperature when available
- graphics quality preset
- render profile
- environment-detail setting
- shadows/effects settings

If a value cannot be measured, write `UNAVAILABLE`; do not infer it.

## Required scenes

Run all of these with the same save/template and camera position across comparable devices:

1. New world / near-empty map
2. Developed settlement
3. Dense population
4. Large castle
5. Large battle
6. Projectile-heavy battle
7. Terrain / foliage-heavy map

For each scene record entity/building/unit counts and the camera distance used.

## Capture procedure

1. Install a release build produced from the recorded SHA.
2. Reboot the app and load the target scene.
3. Allow 60 seconds for warm-up before recording.
4. Capture at least 180 seconds for each scene/preset pair.
5. Record FPS, median frame time, p95 frame time, long frames (>100 ms), JS heap when exposed, Android process memory when available, draw calls, active shadow casters and WebGL context-loss/crash events.
6. For thermal validation, run the most demanding representative scene continuously for at least 20 minutes and record the same metrics at the start, 10-minute point and end.
7. Repeat Low / Medium / High on at least one representative device. Use Auto render profile unless a run is specifically testing Performance/Balanced/Quality.
8. Repeat the release gate across low-, mid- and high-class Android hardware and include both Adreno and Mali when hardware is available.

## Release budgets

These are acceptance targets, not measured claims:

- no crash or WebGL context loss in any required run;
- no unbounded memory growth across repeated preset switches or the 20-minute thermal run;
- Low must sustain at least 30 FPS median in the required large-battle and projectile-heavy scenes on the selected lower-end release device;
- p95 frame time on that lower-end release device should remain at or below 50 ms after warm-up;
- long frames over 100 ms should remain exceptional rather than continuous;
- Medium/High must not alter simulation outcomes relative to Low when the same deterministic scenario is used;
- desktop High visual behavior must remain unchanged by mobile-specific validation work.

If a device/scene fails, record the failing measurement and fix it before marking that row PASS.

## Result table template

| SHA | Device | GPU | Android/WebView | Scene | Quality/Profile | Scene size | Median FPS | Median ms | p95 ms | >100 ms frames | JS heap | Process memory | Thermal notes | Context loss/crash | Result |
| --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- | --- | --- |
| TODO | TODO | TODO | TODO | New world | TODO | TODO | TODO | TODO | TODO | TODO | TODO | TODO | TODO | TODO | NOT RUN |
| TODO | TODO | TODO | TODO | Developed settlement | TODO | TODO | TODO | TODO | TODO | TODO | TODO | TODO | TODO | TODO | NOT RUN |
| TODO | TODO | TODO | TODO | Dense population | TODO | TODO | TODO | TODO | TODO | TODO | TODO | TODO | TODO | TODO | NOT RUN |
| TODO | TODO | TODO | TODO | Large castle | TODO | TODO | TODO | TODO | TODO | TODO | TODO | TODO | TODO | TODO | NOT RUN |
| TODO | TODO | TODO | TODO | Large battle | TODO | TODO | TODO | TODO | TODO | TODO | TODO | TODO | TODO | TODO | NOT RUN |
| TODO | TODO | TODO | TODO | Projectile-heavy battle | TODO | TODO | TODO | TODO | TODO | TODO | TODO | TODO | TODO | TODO | TODO | NOT RUN |
| TODO | TODO | TODO | TODO | Terrain/foliage-heavy | TODO | TODO | TODO | TODO | TODO | TODO | TODO | TODO | TODO | TODO | NOT RUN |

## Safe mobile default decision

The current new-settings default remains High quality + Auto render profile until representative lower-end measurements exist. Do not change the default based only on desktop emulation. If the lower-end release device fails the budgets above under the default, use the recorded data to choose a safer default and document the before/after runs.
