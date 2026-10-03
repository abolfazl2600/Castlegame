# Crac des Chevaliers · Syria — template fidelity notes

## Reference state

The playable template represents the **mid-13th-century Hospitaller final construction phase, approximately the middle of the 13th century through 1271**, immediately before the Mamluk conquest.

This is a deliberate single-state choice. It captures the mature Hospitaller fortress with the second/outer enceinte, lower ward, southern open cistern, stables/service ranges, great hall, high inner defensive enclosure and the strengthened eastern entrance system. It **does not include later Mamluk architectural additions** such as the large later eastern quadrangular towers, Qalawun's later works, or the 14th-century rebuilt gate tower.

The current surviving monument contains multiple historical layers. The game follows the documented Hospitaller defensive hierarchy rather than copying every feature visible in present-day photographs.

## Authoritative source pack

- UNESCO World Heritage Centre — Crac des Chevaliers and Qal'at Salah El-Din: https://whc.unesco.org/en/list/1229
- UNESCO property maps / nomination documents: https://whc.unesco.org/en/list/1229/maps/
- UNESCO 2006 boundary plan: https://whc.unesco.org/en/documents/100875
- French Ministry of Culture archaeology portal — About the castle: https://archeologie.culture.gouv.fr/crac-chevaliers/en/about-castle
- French Ministry of Culture — Historical and geographical context: https://archeologie.culture.gouv.fr/crac-chevaliers/en/historical-and-geographical-context
- French Ministry of Culture — Strengthening of the fortifications in the 13th century: https://archeologie.culture.gouv.fr/crac-chevaliers/en/strengthening-fortifications-13th-century
- French Ministry of Culture — Final construction phase: https://archeologie.culture.gouv.fr/crac-chevaliers/en/final-construction-phase
- Guillaume Rey (1871), historic plan hosted by Wikimedia Commons: https://commons.wikimedia.org/wiki/File:Krak_des_chevaliers_-_plan.jpg

The French Ministry archaeology portal is the principal architectural reference because it separates the Hospitaller and later Mamluk phases and describes the entrance system, talus, outer enceinte and southern cistern explicitly.

## Documented geometry used by the template

The French Ministry describes the surviving castle as approximately **300 m long and 140 m wide**, with two concentric enceintes. The upper ward is a polygonal enclosure with towers of different shapes; the lower outer enceinte is also towered. The south and west fronts of the upper castle are marked by a massive talus, while the north/northeast use bedrock as a foundation. A ditch separates the south side from a rocky plateau and triangular barbican.

At game scale, the 22 × 22 board preserves the structural relationships rather than literal dimensions:

| Historic feature | Castle Role representation |
| --- | --- |
| High ridge controlling the Homs Gap | Elliptical hill/ridge profile, highest beneath the upper ward and descending on the eastern approach |
| Lower outer enceinte | Closed irregular wall1 circuit, Level 2, with repeated round flanking towers |
| Higher inner enceinte | Closed reinforced wall3 circuit, Level 4, visibly dominating the outer wall |
| South/west keep and talus | Highest inner towers plus a five-floor defensive-platform Keep mass on the south-west side |
| Eastern controlled entrance | Two gate stages connected by a bent ascending stone-road route |
| Southern ditch/open cistern | Recessed water strip between inner and outer southern defenses |
| Triangular southern barbican | Small closed triangular outwork on the southern plateau |
| Chapel | Existing reusable stone religious landmark placed in the upper ward |
| Great hall / service ranges | Medieval hall/residential masses around an open central court |
| Round flanking towers | Repeated round open-battlement towers, with taller inner strongpoints |

## Native gameplay architecture

The template intentionally uses normal editable game systems: GameState cells, rasterizeWallPath()/placeWallPath(), CastleBlockSystem topology, normal Gate behavior, normal Keep state, the existing religious renderer, and the ordinary save/load and undo/redo paths.

There is no separate static historical-scene mesh. After loading the template, every authored component is ordinary editable game state.

## Fidelity and scale compromises

- Wall lengths, tower spacing and courtyard widths are compressed while preserving the concentric hierarchy and elongated plan.
- The massive historical talus is represented by terrain elevation plus tall/thick inner defenses rather than a bespoke continuous sloped masonry shell.
- The upper ward's southern keep is represented by the modular Keep plus dominant inner towers so battle/navigation/editing remain native.
- The chapel uses the game's reusable medieval religious renderer; its real Romanesque proportions are simplified.
- The great hall and service ranges use the closest native medieval hall/residential masses and remain subordinate to the defensive plan.
- The southern open cistern is represented as a bounded native water strip, not interpreted as a geographic river.
- Later Mamluk additions are intentionally excluded even where they dominate some modern photographs.
- Tower count is compressed; the target is defensive rhythm and hierarchy rather than a one-to-one surveyed inventory.

## Matched-view comparison checklist

| Review view | Reference | Must match before final approval |
| --- | --- | --- |
| Top / plan | Rey plan + French Ministry descriptions | elongated concentric enclosures, higher inner ward, east access, southern cistern and outwork |
| East approach | French Ministry strengthening material | bent ascending access with layered gate control and inner defenses rising behind the lower wall |
| South / south-west | French Ministry keep/final-phase material | dominant high inner towers/keep, lower outer enceinte, ditch/cistern and southern outwork |
| Normal gameplay | UNESCO + French Ministry aerial/site views | pale limestone mass, round-tower rhythm, deep defensive layering and exposed ridge silhouette |

## Automated browser and matched-view QA

Issue #59 now has a dedicated WebGL QA path in addition to the static historical-template contract:

- `npm run test:crac-des-chevaliers-browser` loads the template through the real template picker, validates the authored eastern gates, chapel, Keep, tower rhythm, southern cistern, road route and elevation serialization, then verifies edit + Auto Save + reload + gate interaction through the normal UI.
- `npm run visual:crac-des-chevaliers-qa` captures deterministic plan, normal oblique, east-approach and south/south-west views from the live renderer.
- `.github/workflows/crac-des-chevaliers-template-qa.yml` runs the static contract, castle-access navigation regression, production build, browser QA and matched-view capture, then uploads `visual-baselines/issue-59/` as a review artifact.
- The evidence pack includes `summary.md` with authoritative comparison links and `metrics.json` with serialized structure counts and renderer/resource metrics.

The automation verifies live behavior and produces the comparison evidence. Historical visual fidelity still requires reviewing the four generated captures against the documented UNESCO, French Ministry and Rey references.

### Final visual review status

- [ ] Top-view screenshot compared with the historical plan.
- [ ] Eastern approach screenshot compared with entrance-system references.
- [ ] Southern/south-west screenshot checked against keep/talus references.
- [ ] Normal gameplay view confirms the inner enceinte is visibly higher than the outer enceinte.
- [ ] Southern cistern and triangular outwork remain legible without clipping.
- [ ] Save/load preserves the same authored structure and elevations.
- [ ] Post-load editing works on walls, gates, towers, roads and Keep.
- [ ] Battle/navigation can use the authored entrance route and connected fortification network.
- [ ] Dense-scene rendering remains within the project's active visual budget.

The screenshot- and live-runtime-dependent checks should be completed in a WebGL-capable review build before issue #59 is closed.
