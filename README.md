# Castle Role

Castle Role is a stylized 3D island-fortress builder built with Three.js, TypeScript, and Vite.

**[Play Castle Role](https://abolfazl2600.github.io/Castlegame/)**

## Current world

- **20 × 20** playable grid — larger than the previous 16 × 16 version, while remaining lightweight
- Stylized island, water, coast, forests, trees, natural highlands, rocks, and soft real-time lighting
- Orbit/zoom/pan 3D camera
- Browser-local autosave, manual Save/Load, and Reset

## Building systems

### Fortifications

- **Wall I** — low stone wall
- **Wall II** — taller stone wall
- **Wall III** — reinforced wall
- Adjacent wall segments now extend to the tile edge so they visually connect without gaps
- Gates automatically orient toward connected wall lines
- Towers connect to neighboring fortifications

### Settlement

- Roads automatically connect to adjacent roads and gates
- Four house types: Cottage, House, Manor, Villa
- Farm plots with crop rows

### Terrain & resources

- Natural forest areas contain stylized 3D trees
- Natural mountain areas appear on the island
- A player **Mountain** tool can create mountains on buildable land
- Clicking the same player mountain repeatedly upgrades it from level 1 → 2 → 3
- Mines can be created from player-built mountains or natural mountain terrain

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
- **N** — Mountain
- **M** — Mine
- **X** — Remove

Mouse:
- Left drag — rotate camera
- Right drag — pan camera
- Mouse wheel — zoom
- Left click on terrain — build selected item

## Next useful milestone

Add economy and production: farm output, mine output, workers assigned to buildings, construction costs, and actual military guard posts connected to towers and gates.
