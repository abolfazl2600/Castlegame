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
