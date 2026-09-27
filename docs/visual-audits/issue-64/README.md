# Issue #64 visual acceptance evidence

This folder records the remaining acceptance evidence for **Visual style migration 5/6: people, combat effects, and interface**.

## Captures

| Capture | Purpose |
| --- | --- |
| `before-reference.webp` | Gameplay capture from commit `153f4760`, the `main` base immediately before the phase-5 actor/effects/UI implementation in PR #85. |
| `after-reference.webp` | Same deterministic reference save on current `main`; shows the phase-5 minimap and revised world/UI presentation. |
| `after-dense.webp` | Current dense settlement at normal gameplay zoom for resident/worker and UI readability review. |
| `after-combat.webp` | Current representative 32-attacker / 30-defender battle for faction silhouettes, action feedback, objectives and interface review. |
| `after-mobile.webp` | Current 390×844 mobile layout with Build panel and minimap visible. |

The before/after captures were rendered from the successful GitHub Pages artifacts for workflow runs `36322972254` and `36324784016`, rather than a working-tree build.

## Performance snapshot

`metrics.json` records dense-scene and combat measurements from the current Pages artifact at 1365×900, High quality. The audit used Chromium 144 under Xvfb with ANGLE/Vulkan SwiftShader, so the absolute FPS is intentionally **not** treated as a hardware target. It does make the scene complexity and measurement method explicit:

- Dense scene: 9,888 draw calls, 239,354 triangles, 11 sampled frame intervals; median 1,133.3 ms in software rendering.
- Combat scene: 32 attackers / 30 defenders, 2,650 draw calls, 69,748 triangles, 21 sampled frame intervals; median 900.0 ms in software rendering.

For normal review hardware, run `npm run visual:baseline -- --out visual-baselines/issue-64`. The phase-5 extension now captures dense settlement, combat, mobile battle UI, Low/Medium/High graphics quality, effects-disabled, and reduced-motion cases while retaining the 120-frame benchmark sample.

## Acceptance mapping

- **People/factions/actions:** dense and combat captures include visible residents/workers plus blue defenders and red attackers in an active battle.
- **Bounded effects:** PR #88 ties wall-weapon/missile feedback to battle lifecycle and graphics/reduced-motion settings; the extended baseline runs both reduced-motion and effects-disabled combat cases.
- **Desktop/mobile UI and minimap:** reference and mobile captures exercise the navy/blue UI and minimap; Playwright coverage checks mouse, keyboard and touch-oriented behavior.
- **Evidence:** this folder keeps review captures and metrics with the repository so future visual phases can compare against the same deterministic scene.
