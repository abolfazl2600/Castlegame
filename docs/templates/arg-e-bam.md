# Arg-e Bam historic template

## Reference state

The template targets the **pre-earthquake reference state immediately before 26 December 2003**, anchored to the intact site recorded in pre-earthquake surveys and the QuickBird image captured on **30 September 2003**. This avoids mixing the largely destroyed post-earthquake fabric with later reconstruction phases.

The implementation is a gameplay-scale reconstruction, not a claim of one-cell-to-one-building survey accuracy. It preserves the documented urban hierarchy: a large fortified lower town, a south-to-north commercial spine, a separately fortified and elevated governor's citadel to the north, a perimeter moat, dense earthen residential fabric, and religious/civic landmarks.

## Authoritative and survey reference pack

- UNESCO World Heritage Centre — Bam and its Cultural Landscape: https://whc.unesco.org/en/list/1208/
- UNESCO — nomination file 1208bis, including the Arg-e Bam plans and measured property description: https://whc.unesco.org/uploads/nominations/1208bis.pdf
- UNESCO — documents and maps: https://whc.unesco.org/en/list/1208/documents/
- UNESCO — inscribed-property maps: https://whc.unesco.org/en/list/1208/maps/
- Digital Silk Road / National Institute of Informatics — Citadel and Major Buildings in Districts plan: https://dsr.nii.ac.jp/bam/plan/index.html.en
- Digital Silk Road — QuickBird satellite imagery before/after the earthquake; the pre-earthquake image is dated 30 September 2003: https://dsr.nii.ac.jp/bam/before-after.html.en
- Digital Silk Road — pre-earthquake photo collection including the stable and outer wall photographed in July 2000: https://dsr.nii.ac.jp/bam/collection/000131-000135.html.en
- NII — 3DCG reconstitution and virtual reality of UNESCO world heritage in danger: the Citadel of Bam: https://www.nii.ac.jp/pi/n5/5_99.pdf

The source images remain at their original sites. This repository links to them for matched-view review rather than redistributing source photographs with incompatible or restricted image licenses.

## Documented site hierarchy

UNESCO describes Arg-e Bam as a fortified earthen settlement on a natural eminence. The main fortified enclosure is a rough rectangle, approximately 430 m on the south side, 390 m to the north/north-east, 280 m to the east, and 540 m to the west. The enclosure is documented with **38 watch-towers** and a **10–15 m perimeter moat**. The citadel/governor's quarter occupies the higher northern area.

The pre-earthquake reconstruction literature describes the town as eight residential districts plus a governor's section. Immediately inside the principal entrance, a linear bazaar passes through the residential districts toward the higher administrative/defensive sector. Documented public buildings include a mosque, bazaar, tekkiyeh, caravanserai, school, bath and traditional sports building; the governor's section includes military/service functions such as stables and barracks.

## Game-scale plan

| Historic feature | Source evidence | Castle Role representation |
| --- | --- | --- |
| Rough rectangular fortified footprint | UNESCO nomination plan and dimensions | Irregular eight-point closed outer wall path, longer north/south frontage and compressed east/west sides |
| Earthen construction | UNESCO description of chineh / khesht construction | Reusable **earthen** architecture palette with a smoother adobe texture instead of visible stone blocks |
| 38 watch-towers | UNESCO nomination | Fourteen authored outer towers plus six citadel towers; tower density and rhythm are preserved while exact count is compressed |
| Perimeter moat | UNESCO nomination | Dry single-cell moat belt outside the walls, with the southern gate approach left open |
| Southern principal entrance | UNESCO / NII plan and reconstruction material | Level-3 south gate with paired defensive towers |
| Main bazaar axis | NII plan and reconstruction report | South-to-north dirt-road spine with two market cells on the lower-town route |
| Dense residential districts | NII plan and pre-earthquake survey material | Closely packed cottage/house/manor blocks on both sides of the principal streets |
| Great Mosque / religious landmark | NII plan and reconstruction material | Dedicated reusable **Courtyard Mosque** building with low prayer hall, open court and shallow domed bays |
| Governor's quarter / citadel | UNESCO nomination | Separate high northern wall circuit, inner gate, towers and a four-floor flat-battlement Keep |
| Barracks / stable / service sector | NII reconstruction literature | Compact editable hut/house service compounds below and beside the inner citadel |
| Desert setting and natural eminence | UNESCO World Heritage description | Sparse arid ground, no decorative forest seeding, broad terrain rise plus a stronger northern citadel elevation |

## Reusable capabilities added

### Earthen architecture family

StoneStyle now includes earthen. The castle material system gives this family warm mud-brick/chineh colors and a smoother mottled adobe surface rather than reusing the masonry-block texture. The same style is persisted by save/load and selected through the shared template visual registry.

Residential clusters react to the earthen style as well: green village ground is replaced with dry packed-earth yards, pitched European roofs become flat parapeted roofs, and richer cells can use a shallow earthen dome. Existing limestone, dark-stone, sandstone and frontier templates remain on their previous rendering path.

### Courtyard Mosque

A reusable mosque building kind is available to medieval, survival and sandbox modes. It uses the active castle material family and renders a low prayer hall, open courtyard/arcades and shallow domed bays. It deliberately avoids a generic tall minaret so it can represent low-rise fortified desert settlements without importing an unrelated silhouette.

## Fidelity and scale compromises

- The game board is 22 × 22 cells. The real enclosure dimensions and 38-tower inventory are therefore represented proportionally, not literally.
- The moat is compressed to a one-cell dry defensive belt. Water-filled defensive conditions are not asserted for this reference state.
- The governor's residence and Chāhārfasl/Four-Seasons complex are represented through the editable Keep system rather than bespoke room-by-room reconstruction.
- Residential districts are represented as clustered earthen cells instead of surveyed parcel boundaries.
- Bazaar functions are represented with the existing Market building; individual caravanserai, bath, school, tekkiyeh and zoorkhaneh structures are not substituted with visually unrelated buildings.
- The documented yakhchāl outside the enclosure is omitted because the game has no reusable icehouse primitive yet.
- Qanāts, the wider palm cultivation landscape and the broader seasonal water system are outside the compressed fortress board and are not faked with visible surface rivers.
- Exact decorative mud-brick motifs visible on individual pre-earthquake buildings are outside the current low-poly detail budget.
- This template represents the intact pre-earthquake state and does **not** claim to represent the current reconstructed condition.

## Feature-by-feature fidelity checklist

| Feature | Implementation check | Status |
| --- | --- | --- |
| Dedicated template picker entry | data-template=arg-e-bam | Complete |
| Deterministic authored world | Mainland layout, seed 5701 | Complete |
| Earthen wall/keep material family | StoneStyle = earthen + adobe texture | Complete |
| Earthen flat-roof residential family | Shared residence renderer style branch | Complete |
| Outer enclosure | Closed authored wall path | Complete |
| Tower rhythm | Authored outer/citadel towers | Complete at compressed scale |
| Southern gate | Gate plus paired towers | Complete |
| Dry defensive moat | Perimeter moat cells | Complete at compressed scale |
| Bazaar spine | Main N–S route + markets | Complete |
| Mosque landmark | Dedicated courtyard-mosque renderer | Complete |
| Raised governor's citadel | Elevated inner enclosure + Keep | Complete |
| Barracks/service zone | Editable normal settlement cells | Complete at compressed scale |
| Current/post-earthquake reconstruction | Not part of selected reference state | Intentionally out of scope |

## Matched-view comparison checklist

Use the linked source material beside game captures; do not copy source images into the repository unless their license explicitly permits redistribution.

| Review view | Source to compare | Required visual relationship |
| --- | --- | --- |
| Top / plan | NII district plan + 30 Sep 2003 QuickBird image | rough rectangular enclosure; south entrance; central spine; denser lower town; elevated north citadel |
| South entrance | Pre-earthquake NII photographs / reconstruction material | dominant fortified entry feeding directly into bazaar circulation |
| North citadel | UNESCO nomination figures + NII reconstruction | visibly higher and separately defensible governor's compound |
| Outer wall | July 2000 NII outer-wall photo | continuous warm earthen mass, repeated defensive towers, no limestone/European roof language |
| Normal gameplay | UNESCO and NII pre-earthquake views | coherent monochrome earthen settlement with flat roofscape and hierarchical rise toward the citadel |

### Final review status

- [x] Historical reference state is explicit and source-backed.
- [x] Template uses normal editable game state.
- [x] Shared earthen material support is implemented.
- [x] Dedicated mosque support is implemented.
- [x] Deterministic template regression coverage is included.
- [ ] Capture a top/plan game screenshot beside the NII plan.
- [ ] Capture a south-gate gameplay view beside a pre-earthquake reference.
- [ ] Capture a north-citadel gameplay view beside a pre-earthquake reference.
- [ ] Confirm save → load → edit in a WebGL browser session.

The unchecked items require rendered browser captures and are intentionally kept as visual-QA gates rather than being marked complete from static source inspection.
