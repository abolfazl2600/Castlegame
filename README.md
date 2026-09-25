# Castle Role

Castle Role is a stylized 3D island-fortress builder built with Three.js, TypeScript, and Vite.

**[Play Castle Role](https://abolfazl2600.github.io/Castlegame/)**

## Terrain editing

The world now has a brush-based terrain editor:

- Raise
- Lower
- Flatten
- Smooth
- Dig
- Create Hill
- Create Cliff
- Adjustable Brush Size
- Adjustable Strength

Buildings and fortifications follow edited elevations. Adjacent wall sections calculate their connection slope from the terrain under each tile, making hill forts and mountain strongholds possible.

## Castle access

Access pieces snap beside fortifications and calculate the height they need to reach:

- Stone Stairs
- Wooden Stairs
- Ramp
- Ladder

If the neighboring wall or tower is made taller, the access piece adapts when the scene redraws.

## Advanced walls

- Drag A → B to build a continuous snapped wall line
- Automatic orthogonal corners
- Stone / Wooden / Reinforced wall materials
- Thin / Medium / Thick wall settings
- Optional Battlement
- Optional top Walkway
- Multi-floor height editing
- Terrain-aware connections

## Modular towers

Tower bases:

- Square
- Round
- Octagonal
- Corner
- Watch Tower

Tower tops:

- Battlement
- Roof
- Flat Platform
- Flag
- Watch Platform

Towers are multi-floor and connect directly into the wall network.

## Undo / Redo

- **Ctrl + Z** — Undo
- **Ctrl + Y** — Redo

History covers building, deleting, moving, rotating, terrain editing, wall/tower height changes, and most construction settings.

## Starting templates

New saves automatically open the template selector:

- Empty Land
- Small Castle
- Motte & Bailey
- River Castle

The selector can also be reopened from the top bar.

## Other systems

- Worker-dug moats that flood when connected to rivers
- Roads, farms, four house types
- Trees, mountains, mines
- River and land editing
- Local autosave, Save/Load, and Reset
- 22 × 22 playable island grid

## Controls

- **1 / 2 / 3** — Stone / Wooden / Reinforced Wall
- **4** — Gate
- **5** — Modular Tower
- **6** — Road
- **7 / 8 / 9 / 0** — Cottage / House / Manor / Villa
- **A** — Stone Stairs
- **S** — Wooden Stairs
- **D** — Ramp
- **K** — Ladder
- **F** — Farm
- **T** — Tree
- **N** — Mountain
- **M** — Mine
- **Q** — Moat
- **R** — River
- **L** — Land
- **U** — Raise Terrain
- **J** — Lower Terrain
- **B** — Flatten
- **V** — Smooth
- **G** — Dig
- **H** — Create Hill
- **C** — Create Cliff
- **X** — Remove
- **[ / ]** — Lower / raise selected wall or tower
- **Ctrl + Z / Ctrl + Y** — Undo / Redo

When a Wall or Terrain tool is active, left-drag is reserved for construction/editing. Other tools retain normal left-drag camera rotation.
