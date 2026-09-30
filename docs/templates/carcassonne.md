# Carcassonne historic template

## Reference state

The template models the **present-day fortified city as documented in 2025**, including the medieval defensive fabric and the visible nineteenth-century restoration campaign associated with Eugène Viollet-le-Duc. This avoids mixing a hypothetical single medieval construction phase with restored roofs and crownings that define the monument's current silhouette.

The game representation follows the documented spatial hierarchy rather than attempting a one-cell-to-one-building survey. The map is 22 × 22 cells, so tower count, street blocks and wall lengths are compressed while the double enclosure, gate positions, western castle, Saint-Nazaire landmark and raised approach remain legible.

## Authoritative source pack

- UNESCO World Heritage Centre — Historic Fortified City of Carcassonne: https://whc.unesco.org/en/list/345
- UNESCO property maps and boundary documents: https://whc.unesco.org/en/list/345/maps/
- Centre des monuments nationaux — History of the monument: https://www.remparts-carcassonne.fr/en/discover/history-of-the-monument
- Centre des monuments nationaux — An iconic silhouette: https://www.remparts-carcassonne.fr/en/discover/an-iconic-silhouette
- Centre des monuments nationaux — 2025 press kit / complete ramparts tour: https://www.remparts-carcassonne.fr/en/content/download/9866306/file/PRESS%20KIT%20GB_2025_14022025.pdf?inLanguage=eng-GB&version=34
- Centre des monuments nationaux — official visitor-plan PDF: https://www.remparts-carcassonne.fr/var/cmn_inter/storage/original/application/04c4ac49032d69b1d28487e75f935011.pdf

The sources use different tower totals depending on counting scope and date. The template therefore treats **tower density and distribution** as the fidelity target rather than claiming that the compressed game count reproduces an official inventory number.

## Game-scale plan

| Historic feature | Source evidence | Castle Role representation |
| --- | --- | --- |
| Raised fortified cité above the Aude | UNESCO description and official site views | Elliptical hill plateau with lower western approach and a separate Aude river channel |
| Two fortified enclosures and lices | UNESCO and CMN history | Two independent closed irregular wall paths with a clear band between them |
| Dense round-tower rhythm | UNESCO / CMN monument descriptions | Twenty-four authored rampart vertices plus four gate-flanking towers, mainly round/conical |
| Porte Narbonnaise | CMN silhouette and plan | East-side two-stage gate through both enclosures with paired tall round towers |
| Porte d'Aude | UNESCO / official plan | West/south-west two-stage gate descending toward the Aude |
| Château Comtal | UNESCO / official plan | Towered multi-floor Keep in the western sector of the inner enclosure |
| Basilica of Saint-Nazaire and Saint-Celse | UNESCO / visitor plan | Dedicated reusable `basilica` building with nave, transept, apse, tower and pitched roofs |
| Principal internal circulation | Official visitor plan | East-west route between Narbonnaise and Château Comtal plus north-south and Aude approaches |
| Intramural settlement | UNESCO description | Bounded residential/market blocks inside the inner enclosure; lices remain mostly open |

## Reusable capabilities added

- `rasterizeWallPath()` converts authored polylines into cardinally connected wall cells. This preserves the existing wall renderer, gate behavior, navigation and battle systems while allowing irregular/curved-looking defensive plans.
- `BasilicaRenderer` and the `basilica` building kind provide a reusable medieval church landmark instead of substituting a visually unrelated residence.

## Fidelity and scale compromises

- The real ramparts extend for kilometres and contain many more towers than fit on a 22 × 22 board. The game keeps the relative density and double-ring silhouette, not the exact inventory count.
- The Narbonnaise gate complex, barbicans and bridge works are compressed into two gate cells plus flanking towers.
- Château Comtal is represented through the existing editable Keep system, preserving its western placement and fortress-within-a-fortress role rather than reproducing every courtyard wing.
- Saint-Nazaire is a dedicated landmark, but its detailed Gothic/Romanesque fabric is simplified to the project's low-poly scale.
- The Aude is moved close enough to the western escarpment to read at gameplay zoom; the Bastide Saint-Louis and modern city are outside this template's scope.
- Roof restoration details are intentionally consistent with the chosen present-day monument state.

## Matched-view comparison checklist

Use the source pack above and capture the game in both **Top / Plan** and **normal 3D gameplay** views.

| Review view | Reference to compare | Must match before approval |
| --- | --- | --- |
| Top / plan | UNESCO property map + CMN visitor plan | elongated double enclosure; open lices; castle west; basilica south/east of centre; Narbonnaise east; Aude gate west/south-west |
| East approach | CMN Narbonnaise photographs | dominant paired entrance towers and dense roof/tower skyline behind them |
| West / Aude approach | CMN silhouette/site photographs | raised fortified hill above the river approach and western castle mass |
| Normal gameplay | CMN aerial/oblique views | pale masonry, repeated conical tower roofs, double-wall depth and recognisable internal landmarks |

## Automated browser and matched-view QA

Issue #56 now has a dedicated WebGL QA path in addition to the static template contract:

- `npm run test:carcassonne-browser` loads the template through the real template UI, verifies the authored landmark/gate state, rotates Saint-Nazaire through the normal selection controls, confirms Auto Save + reload persistence, and toggles Porte Narbonnaise through the normal gate UI.
- `npm run visual:carcassonne-qa` captures deterministic plan, normal oblique, east/Narbonnaise, and west/Aude views from the live renderer.
- `.github/workflows/carcassonne-template-qa.yml` runs the static contract, castle navigation regression, production build, browser QA, and matched-view capture, then uploads `visual-baselines/issue-56/` as a review artifact.
- The capture artifact includes `summary.md` with the authoritative comparison links and `metrics.json` with the serialized landmark/tower/river checks and renderer resource snapshot.

The automation deliberately does not mark historical visual fidelity as approved by itself. A reviewer still needs to compare the four generated views against the authoritative UNESCO/CMN sources before the final visual-review boxes below are checked.

### Final visual review status

- [ ] Top-view screenshot compared with the official plan.
- [ ] East Narbonnaise screenshot compared with the official site photograph.
- [ ] West/Aude screenshot compared with the official site photograph.
- [ ] Normal gameplay screenshot checked for double-wall readability.
- [ ] Save/load and post-load editing confirmed in a browser build.
- [ ] Navigation through Narbonnaise and Aude gate paths confirmed in live gameplay.

These capture-dependent items should be completed on a WebGL-capable build before closing issue #56.
