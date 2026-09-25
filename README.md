# Castle Role

Castle Role is a stylized 3D island-fortress builder built with Three.js, TypeScript, and Vite.

**[Play Castle Role](https://abolfazl2600.github.io/Castlegame/)**

## Advanced wall system

- Drag from point A to B with a wall tool to create a continuous snapped wall line.
- Dragging across two axes creates an automatic orthogonal corner.
- Wall connectors reach the tile boundary and use slope-aware joins on uneven terrain.
- Three materials:
  - Stone Wall
  - Wooden Wall
  - Reinforced Wall
- Three thickness settings: Thin, Medium, Thick.
- Independent Battlement and Walkway toggles.
- Repeated clicks on the same wall add floors and increase height.
- Shift+click, the **− Height** button, or **[** decreases the selected wall height.
- **+ Height** or **]** increases the selected wall/tower height.
- Existing saves migrate older wall data into the new system.

## Modular tower builder

The Tower tool now uses modular settings rather than one fixed object.

Available bases:
- Square Tower
- Round Tower
- Octagonal Tower
- Corner Tower
- Watch Tower

Available tops:
- Battlement
- Roof
- Flat Platform
- Flag
- Watch Platform

Tower height is multi-floor and editable. Towers connect directly to neighboring wall/gate/tower segments.

## Existing systems

- 22 × 22 playable island grid
- Moats dug by workers and flooded by connected rivers
- Four house types
- Farms, trees, mountains, mines
- River and land editing
- Removable trees, rocks, huts, and construction
- Four starting templates
- Browser-local autosave, Save/Load, and Reset

## Main controls

- **1** — Stone Wall
- **2** — Wooden Wall
- **3** — Reinforced Wall
- **4** — Gate
- **5** — Modular Tower
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
- **[ / ]** — Decrease / increase selected wall or tower floor count

When a wall tool is active, left-drag is reserved for wall construction. With other tools, normal OrbitControls camera rotation remains available.

## Recommended next milestone

Add a proper selection/inspector mode with wall segment copy/paste, tower floor-by-floor module editing, wall gates with drawbridges, and construction/resource costs.
