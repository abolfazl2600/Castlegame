# Castle Role

Castle Role is a stylized 3D island-fortress builder built with Three.js, TypeScript, and Vite.

**[Play Castle Role](https://abolfazl2600.github.io/Castlegame/)**

## River redesign

The river system has been rebuilt to look and behave more like a real medieval strategy-game river rather than flat blue grid tiles.

- Connected river tiles form one continuous visual channel.
- The riverbed is lower than surrounding ground.
- Natural dirt/grass banks appear where the river does not continue into a neighboring tile.
- Small stones and shoreline details break up the grid look.
- The water uses an animated procedural texture so the surface visibly flows.
- River editing and moat flooding still work with the redesigned river.

## Castle wall redesign

Walls have a heavier, more believable castle silhouette.

- Stone Wall uses masonry courses, foundations, buttresses, parapets, merlons, and rampart walkways.
- Wooden Wall reads more like a timber defensive wall with repeated vertical structural details.
- Reinforced Wall adds heavier supports and metal bracing.
- Adjacent segments still snap without intentional gaps.
- Corners and junctions receive solid central piers/platforms so walls read as one continuous fortification.
- Battlements now run along both sides of the wall top instead of appearing like a single decorative row.
- Multi-floor wall height, thickness, battlement toggle, walkway toggle, and terrain-aware sloped connections remain supported.

## Residential clusters

Housing tools now build small neighborhoods rather than one oversized house.

- **Cottage Cluster** creates several small cottages plus a village well.
- **House Cluster** creates four compact family homes.
- **Manor Court** creates a larger main residence with smaller service houses and fencing.
- **Villa Quarter** creates multiple detailed homes around a landscaped courtyard.
- Individual mini-houses include doors, windows, chimneys, roof variation, porch details, and small decorative props.
- Each cluster still occupies one logical build tile, so existing save/selection logic remains lightweight.

## Terrain editing

The world includes a brush-based terrain editor:

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
- Roads, farms, trees, mountains, and mines
- River and land editing
- Local autosave, Save/Load, and Reset
- 22 × 22 playable island grid

## Controls

- **1 / 2 / 3** — Stone / Wooden / Reinforced Wall
- **4** — Gate
- **5** — Modular Tower
- **6** — Road
- **7 / 8 / 9 / 0** — Cottage Cluster / House Cluster / Manor Court / Villa Quarter
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
