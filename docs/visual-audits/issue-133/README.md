# Issue #133 — Defensive Silhouette Readability Audit

Reference distances are shared with the gameplay camera:

- Near inspection: 48
- Normal gameplay: 104
- Maximum strategic: 148

The defensive readability order is **silhouette → opening/role → damage state → material/detail**.

## Defensive family language

| Family | Primary normal/strategic read |
| --- | --- |
| Wall 1 | clean medium stone curtain with regular crenellations |
| Wall 2 | lower/lighter timber palisade with sparse pointed post crown |
| Wall 3 | thick reinforced bulwark with broad shoulder cap, heavy buttresses and bastion-like top blocks |
| Gate / Gatehouse | wide dark entry opening between two raised crowned piers; higher levels strengthen the gatehouse rather than making it resemble another wall |
| Watch Tower | slender body with a clear observation collar/crown |
| Round Tower | broad cylindrical body and circular defensive platform |
| Octagonal Tower | faceted body/gallery |
| Square Tower | broad rectilinear mass and square defensive crown |
| Corner Tower | reinforced square mass with strong corner shoulders |
| Keep | dominant multi-cell vertical core with roof/battlement crown and optional corner towers |

All new skyline accents are deliberately bounded. Wall tops must not become a dense field of props.

## Wall damage readability

The existing detailed destruction system is preserved. The visual stages now have explicit large-form cues:

1. **Healthy** — continuous top line.
2. **Damaged** — large upper cracks and a few displaced crest stones.
3. **Heavy** — visible upper-wall notch, broken parapet rhythm and rubble.
4. **Partial breach** — much deeper top-edge loss, larger cavity and fallen slabs.
5. **Breached** — the intact wall disappears and is replaced by low broken stubs plus a dense rubble gap.

Heavy and Partial cavities are positioned relative to the wall's real fortification height rather than a fixed world height, so taller/upgraded walls remain readable from the bounded camera distances.

## Gameplay invariants

This pass changes renderer geometry and battle-only damage overlays only.

It does **not** change:

- grid footprints
- wall health values
- gate passability
- collision
- battle navigation
- siege-ladder behavior
- build validation
- save schema
- wall level/thickness semantics

The previously removed wall-connected architecture stairs/ramps/ladders remain removed. No bulky external access geometry is reintroduced.

## Existing systems intentionally preserved

- Detailed procedural wall collapse particles/debris
- Four-level Tower and Gate progression
- Tower Bridge progression
- Keep renderer configuration
- Army Camp military progression
- Siege ladders used by attackers
