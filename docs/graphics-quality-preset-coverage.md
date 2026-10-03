# Graphics quality preset coverage

Issue #116 requires Low / Medium / High to be a coherent presentation system rather than scattered per-feature checks.

The canonical contract is `src/rendering/GraphicsQualityPreset.ts`. Render profile (Auto / Performance / Balanced / Quality) remains independent and continues to control device/runtime pressure. Graphics quality controls the user's requested presentation level.

## Coverage matrix

| Dimension | Low | Medium | High | Runtime path |
| --- | --- | --- | --- | --- |
| Resolution | 0.75 quality scale | 1.00 | 1.35 | `SettingsSubsystems` + distance budget raster scale |
| Dynamic shadows | Off | On, 70% caster budget | On, full caster budget | renderer + `DistanceDetailBudget` |
| Particles / decorative effects | Disabled for battle decorative effects; 35% general particle budget | 70% general particle budget | Full budget | `DistanceDetailBudget` + `BattleSystem` |
| Missile trail particles | 0 | 24 concurrent | 48 concurrent | decorative only; missile simulation is unchanged |
| Missile explosion effects | 0 | 4 concurrent | 6 concurrent | decorative only |
| Impact flashes | 0 | 10 concurrent | 16 concurrent | decorative only |
| Wall-collapse effect groups | 0 | 4 concurrent | 6 concurrent | decorative only; wall damage is unchanged |
| Micro-detail / foliage-facing detail | 55% high-detail budget; foliage scale 0.60 | 80%; foliage scale 0.85 | Full | distance-detail budget; foliage scale is the canonical target for foliage systems |
| Animation presentation budget | 55% | 80% | Full | distance/ambient presentation budget |
| NPC presentation target | 0.70 | 0.90 | 1.00 | canonical target; see limitation below |

## Simulation invariants

Graphics quality must not change gameplay outcomes.

- Core arrow and missile arrays are not capped by graphics quality.
- Damage, projectile hit resolution, AI, pathfinding, spawn counts, movement, economy and battle timing are unchanged.
- Only decorative trail/explosion/impact/collapse visuals are capped.
- High preserves the existing desktop caps and appearance contract.

## NPC presentation limitation

`BattleSystem.animateUnit()` currently contains both pose animation and a small amount of unit state progression (for example attack visual progression/state handoff). Skipping or throttling that function based on quality could change battle behavior.

For that reason this change does **not** throttle combat-unit simulation or hide combat units. The preset now defines `npcPresentationScale` as the central target, but a battle-specific NPC animation cadence should only be applied after pose rendering is separated from state progression. Until then, large-battle Android benchmarks must explicitly measure NPC-heavy scenes and record this as a remaining optimization if it fails the release budget.

## Switching presets

The preset is read dynamically from Settings. Decorative effect queues are bounded and remove old scene objects when their cap is exceeded. Repeated switching still requires runtime memory/context-loss validation on real Android hardware; automated tests only verify the contract and bounded queues.
