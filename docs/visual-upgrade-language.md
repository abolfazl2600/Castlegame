# Four-Level Visual Upgrade Language

This is the shared visual progression contract for upgradeable CastleGame buildings.

## Level language

| Level | Name | Large-form rule | Secondary rule |
| --- | --- | --- | --- |
| 1 | Basic | smallest/simple primary mass | minimal props and activity |
| 2 | Established | visibly larger mass plus one defining architectural feature | modest work-area/activity increase |
| 3 | Advanced | stronger verticality, secondary mass, richer roof/function silhouette | mature materials and bounded activity |
| 4 | Landmark | unmistakable final silhouette with a crown/tower/silo/gallery/major superstructure | premium materials and strongest bounded activity |

The primary recognition order is **silhouette → proportion/material → activity → props**. A color swap or extra crates alone never qualifies as an upgrade.

## Shared code contract

`src/rendering/UpgradeVisualLanguage.ts` owns:

- massing and verticality scales
- work-area growth
- roof/material complexity
- landmark strength
- secondary-prop budget
- ambient-animation budget
- silhouette-element budget
- activity multiplier
- medieval and modern era guidance

Budgets grow sub-linearly and have hard caps. Level 4 is allowed more detail, but cannot scale render cost without bounds.

## Medieval guidance

Progress from rough timber toward reinforced timber/stone, mature masonry, and premium masonry/metal. Landmark vocabulary should come from visible architecture: canopies, secondary roofs, silos, galleries, command halls, formal gates, crowns, or standards.

## Modern guidance

Progress from utility concrete toward reinforced panels, steel/glass systems, and premium armor. Controlled emissive/security accents may support Level 4, but only after the silhouette is already different.

## Representative existing families

- Crop Farm: shed → irrigation/work canopy → granary → estate storehouse/formal gate.
- Cattle Farm: cattle shed → reinforced barn → twin-building stockyard → royal stockyard with silo/formal gate.
- Army Camp: field tents → reinforced siege camp → command camp → semi-permanent fortified war camp.
- Harbor: landing dock → fishing wharf → merchant pier/warehouse/crane → grand harbor with twin arms, office and second crane.

These families attach the shared `upgradeVisualProfile` to their render group so diagnostics and future LOD/activity systems can read one consistent progression contract.

## Performance rule

Large silhouette geometry is protected at normal gameplay zoom. Secondary props, animated elements, particles and emissive accents must respect the profile budgets and may be reduced by future distance/quality systems without erasing the level identity.


## Settlement application (#132)

The shared progression language is now applied across the settlement layer without forcing every civic building into a fake upgrade mechanic.

### Residential progression

The residential family intentionally reads as one four-step visual ladder:

**Cottage → House → Manor → Villa**

- Cottage = Level 1 / Basic: low loose hamlet massing.
- House = Level 2 / Established: denser block with a taller central dwelling.
- Manor = Level 3 / Advanced: dominant hall, formal court, stronger vertical hierarchy.
- Villa = Level 4 / Landmark: open court plus a crowned corner pavilion/cupola that stays recognizable at normal gameplay zoom.

These remain separate build choices for compatibility; the mapping is a visual-language contract, not an economy rewrite.

### Apple Orchard progression

Apple Orchard now supports four visual maturity levels:

1. **Young Grove** — smaller 3×3 planting language with a deliberately open entrance.
2. **Working Orchard** — broader 4×3 rows plus visible produce handling.
3. **Mature Orchard** — 4×4 canopy mass plus a taller entrance trellis.
4. **Estate Orchard** — 5×4 mature planting mass with a dedicated packing shed landmark.

The final tier gains a new architectural mass rather than relying on more apples, crates, or color changes.

### Existing upgradeable settlement families

Crop Farm, Cattle Farm, Army Camp, and Harbor continue to consume the shared `upgradeVisualProfile` at Levels 1–4. Their existing gameplay values, save semantics, worker assignment, and pathfinding remain unchanged by this visual pass.

### Fixed-role landmarks

**Market, Basilica, and Windmill remain fixed-role landmarks** rather than receiving artificial four-level upgrade mechanics. They are explicitly tagged as settlement landmarks so readability/LOD systems can preserve their dominant silhouettes.

### Activity rule

Visible activity should reinforce an already-readable silhouette. Simulation-owned workers, livestock, ships, smoke, flags, tools, and other activity cues may increase with progression, but small props are never the primary level signal.
