# Himeji Castle historic template

## Reference state

The template models the **present-day preserved core complex as documented in 2026**, rather than attempting to reconstruct every vanished Edo-period outer fortification. The surviving castle is principally the early-seventeenth-century complex associated with Ikeda Terumasa's rebuilding (1601–1609), with the surviving Nishi-no-Maru / West Bailey fabric added in the subsequent Honda period represented because it is part of the present monument.

This reference choice prevents a hypothetical full Edo town plan from being mixed with the modern surviving castle. The gameplay map focuses on the extant castle hill, tenshu group, baileys, gates, walls, moats and visitor-recognisable approaches.

## Authoritative source pack

- UNESCO World Heritage Centre — Himeji-jo: https://whc.unesco.org/en/list/661
- ICOMOS / UNESCO advisory-body evaluation: https://whc.unesco.org/archive/advisory_body_evaluation/661.pdf
- Official Himeji Castle — history: https://www.himejicastle.jp/en/guide/history/
- Official Himeji Castle — photo library / aerial and matched-view references: https://www.himejicastle.jp/en/guide/photo/
- Himeji City — official castle visit route and named gates/keeps: https://www.city.himeji.lg.jp/castle/0000007738.html
- Himeji City repair drawings — main keep, Inui/East subsidiary keeps and connecting structures: https://www.city.himeji.lg.jp/castle/0000015616.html
- Himeji City repair drawings — Nishi-no-Maru / West Bailey: https://www.city.himeji.lg.jp/castle/0000015639.html
- Himeji City repair drawings — Hishi Gate: https://www.city.himeji.lg.jp/castle/0000015648.html
- Himeji City repair drawings — castle gates: https://www.city.himeji.lg.jp/castle/0000015651.html

The UNESCO description establishes the white-plastered defensive architecture, layered roofs, hill-castle organization and central tenshu group. The Himeji City repair drawings are used for the relative relationship of principal surviving structures, while the official photo library is the visual reference for silhouette and matched viewpoints.

## Game-scale plan

| Historic feature | Reference evidence | Castle Role representation |
| --- | --- | --- |
| Himeyama hill setting | UNESCO / official photographs | Continuous inland terrain with a raised main-tenshu hill and a lower western bailey |
| White exterior | UNESCO description and official imagery | Reusable `whitePlaster` castle stone style used by walls, gates, towers and Keeps |
| Main tenshu | UNESCO / Himeji City drawings | Six-floor 3 × 3 editable Keep using the reusable `japaneseTiered` roof language |
| Three subsidiary keeps | UNESCO advisory evaluation / repair drawings | Three smaller Japanese-tiered Keeps around the main tenshu |
| Layered tiled roofs | Official photos and repair drawings | Per-floor shallow grey-tile roof tiers with broad eaves and tapered upper massing |
| Hishi Gate | Official route / Hishi Gate drawings | Authored southern principal gate on the winding approach |
| i / ro / ha / ni gates | Official visitor route | Sequential gate cells that force an indirect route toward the tenshu |
| Bizen Gate / Bizen-maru approach | Official route | Inner defensive gate before the main keep precinct |
| Nishi-no-Maru and long gallery | Official route / West Bailey drawings | Low elongated editable Japanese Keep inside a distinct western bailey |
| Concentric defensive hierarchy | UNESCO / plan drawings | Outer enclosure, western-bailey enclosure and inner keep enclosure using native linked walls |
| Moats | UNESCO / official plan context | Continuous outer water-defense line plus an internal Sangoku-moat pool |
| Winding access | Official route and plan drawings | Authored stone-road switchbacks from the southern approach through the gate chain |

## Reusable capabilities added

- `japaneseTiered` is a normal `KeepRoofStyle`. It can be selected for any player-built Keep and is serialized through the existing Keep state.
- `whitePlaster` is a normal `StoneStyle`, exposed in the Castle Architecture editor and accepted by save/load validation.
- `japaneseRoofTile` is a shared grey ceramic roof material used by Japanese-tiered Keeps.
- No Himeji-only building kind or non-editable landmark mesh is introduced. The template remains native game state.

## Fidelity and scale compromises

- The 22 × 22 gameplay grid cannot reproduce every surviving wall turn, gate, corridor, turret or historical outer moat. The model prioritizes the defensive hierarchy and approach sequence over one-cell-to-one-building survey accuracy.
- The main keep is represented as six gameplay floors to preserve its dominant height and tier rhythm; real internal/visible storey counting and roof composition are more complex than the game's floor abstraction.
- The three subsidiary keeps are separated enough to remain readable and editable. Their connecting corridors are implied by the compact inner precinct rather than reproduced as dedicated roofed gallery geometry.
- Nishi-no-Maru's long gallery is compressed into a low elongated Japanese Keep so it remains editable and visually related to the castle instead of substituting a generic European residence.
- Moat widths are compressed to one-cell defensive lines except Sangoku moat, which is widened into a small pool for gameplay readability.
- Existing gate and tower systems retain their gameplay collision, navigation and combat behavior. Their massing is arranged to match Himeji's defensive sequence, while fine Japanese gate roof carpentry remains below the project's current geometry scale.
- The template intentionally omits vanished outer castle-town defenses rather than combining multiple historical periods.

## Matched-view comparison checklist

Use the official photo library, Himeji City drawings and UNESCO material above. Capture both plan and normal 3D views.

| Review view | Reference to compare | Must match before approval |
| --- | --- | --- |
| Top / plan | Himeji City repair drawings + official route | main tenshu in elevated inner precinct; western Nishi-no-Maru; layered enclosures; south approach; moat separation |
| South approach | Hishi Gate drawings / official photographs | Hishi Gate foreground, white defensive walls and rising tenshu beyond |
| West Bailey | Nishi-no-Maru drawings / official photographs | long low western mass with the main keep rising to the east/north-east |
| Tenshu oblique | Official photo library aerial/oblique views | dominant white main keep, three subordinate keeps and repeated grey roof tiers |
| Normal gameplay | Official aerial photographs | recognisable white Japanese castle silhouette without European conical towers or battlement crown on the tenshu |

### Final visual review status

- [ ] Top-view screenshot compared with Himeji City plan/drawing references.
- [ ] South/Hishi Gate screenshot compared with official Hishi Gate imagery.
- [ ] Nishi-no-Maru screenshot compared with official West Bailey imagery.
- [ ] Tenshu oblique screenshot compared with official aerial/oblique imagery.
- [ ] Winding approach tested through authored gate sequence in a browser build.
- [ ] Save/load confirms `whitePlaster` and all `japaneseTiered` Keeps survive round-trip.
- [ ] Undo/redo and normal post-template editing confirmed in a browser build.

The capture-dependent checks require a WebGL-capable browser session and should be recorded in the final review for issue #58.
