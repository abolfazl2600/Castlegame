# Castle Role

Castle Role is a stylized 3D island-fortress builder built with Three.js, TypeScript, and Vite.

**[Play Castle Role](https://abolfazl2600.github.io/Castlegame/)**

## Current world

- **22 × 22** playable grid
- Stylized island, water, coast, river, forests, trees, natural mountain zones, rocks, and huts
- Orbit/zoom/pan 3D camera
- Browser-local autosave, manual Save/Load, and Reset
- Four ready-made world templates

## Fortifications

- Three wall materials: Wall I, Wall II, Wall III
- Adjacent wall segments connect visually without gaps
- Clicking the same wall repeatedly adds more vertical floors and height
- Gates orient toward nearby wall lines
- Towers connect into fortification lines

## Defensive engineering

- A **Moat** tool assigns workers to excavate selected land
- Three workers walk to queued moat jobs and complete the excavation
- Moat tiles flood automatically when a connected moat network reaches a river

## Settlement

- Roads connect edge-to-edge automatically
- Four detailed house designs: Cottage, House, Manor, Villa
- Houses include doors, windows, chimneys, porches, planters, and extra details
- Farms provide visible crop plots

## Nature & resources

- Player-placeable trees
- Removable trees, rocks, huts, and player construction
- Player-placeable mountains that grow each time the same tile is clicked
- More detailed multi-part mountain geometry with ridges, rocks, vegetation, and snow
- Mines work on both natural mountain terrain and player-built mountains
- Player-editable rivers
- A Land tool fills user-made rivers or water areas back into buildable land

## Templates

- Blank Island
- River Citadel
- Mountain Hold
- Farming Village

Use the **Templates** button in the top bar to load one.

## Controls

- **1** — Wall I
- **2** — Wall II
- **3** — Wall III
- **4** — Gate
- **5** — Tower
- **6** — Road
- **7** — Cottage
- **8** — House
- **9** — Manor
- **0** — Villa
- **F** — Farm
- **T** — Tree
- **N** — Mountain
- **M** — Mine
- **Q** — Moat
- **R** — River
- **L** — Land
- **X** — Remove

Mouse:
- Left drag — rotate camera
- Right drag — pan
- Mouse wheel — zoom
- Short left click — build selected item

## Next useful milestone

Add an economy and production loop: workers assigned to farms and mines, resource costs for construction, military recruitment, tower guard posts, and upgrade requirements for taller walls.
