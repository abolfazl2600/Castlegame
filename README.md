# Castle Role

Castle Role is a stylized 3D medieval fortress builder built with Three.js, TypeScript, and Vite.

**[Play Castle Role](https://abolfazl2600.github.io/Castlegame/)**

## Core design rule

The player builds the castle. The game architects the details.

Players control major architectural decisions such as wall layout, wall height/thickness/material, tower type, Keep dimensions/floors/roof, gates, terrain, and defensive layout. Secondary details such as windows, arrow slits, flags, Keep stairs, wall-access stairs/ladders, battlement spacing, and small structural supports are generated procedurally.

## Medieval visual overhaul

The fortress rendering now prioritizes silhouette, scale, material depth, and terrain integration instead of decorative cubes.

- Castle walls are taller and thicker relative to workers and houses.
- Stone walls use a shared procedural medieval masonry material with irregular block sizes, dark mortar, subtle tone variation, weathering, foundation dirt, and restrained moss.
- Wall bodies remain vertical on slopes. Terrain differences are absorbed by deeper/stepped foundations instead of rotating the entire wall.
- Battlements use continuous crenellated parapet geometry rather than rows of tiny decorative cubes.
- Tall and reinforced walls receive tapered structural buttresses at controlled intervals.
- Towers are wider, taller, and visually heavier than curtain walls, with expanded foundations, floor bands, arrow slits, and stronger corner structure.
- Tower roofs now include dark undersides/eaves and real overhang before the roof volume.
- Round/rounded defensive tops use continuous parapet rings and larger tapered merlons.
- Automatic wall corners now connect foundations, bodies, wall walks, and battlements with dedicated square, rounded, reinforced, turret, or buttressed architecture.
- Lighting uses stronger directional contrast, softer ambient fill, improved shadows, and filmic tone mapping so recesses and masonry depth read from the gameplay camera.
- Materials are shared across castle pieces for browser performance; major silhouette remains geometry-driven while small masonry/weathering is texture/shading-driven.

## Modular Keep Builder

Press **P** or choose **Modular Keep**.

Player-controlled Keep state:

- Width and depth: 2–6 tiles
- Floors: 1–9
- Position
- 90° rotation
- Corner towers on/off
- Flat Battlement, Medieval Sloped, Defensive Platform, or Towered roof
- Battlements on/off

Generated automatically:

- Medieval entrance and reinforced door
- Ground-floor defensive arrow slits
- Upper-floor windows and arrow slits
- Exterior entrance stairs when terrain requires them
- Corner-tower details
- Battlement spacing
- One primary flag and limited secondary flags on larger Keeps
- Logical internal floor-access metadata for future NPC navigation

The Keep foundation samples the terrain under its entire footprint. Moderate elevation differences are handled with a stone foundation; very steep new placements are rejected.

## Diagonal Wall System

Wall dragging now snaps to the nearest supported 45° angle.

Supported directions:

- 0°
- 45°
- 90°
- 135°
- 180°
- 225°
- 270°
- 315°

A cyan ghost preview displays the actual snapped path before placement.

Diagonal walls use continuous center-to-center geometry with:

- Foundations
- Wall thickness
- Walkways
- Double-sided parapets
- Battlements
- Procedural arrow slits
- Buttresses/supports
- Terrain-aware vertical slope adaptation

Existing orthogonal walls remain backward-compatible. New diagonal connections are saved through explicit wall-link metadata.

## Advanced Automatic Corners

Wall junctions are analyzed by a dedicated corner system.

Possible generated corner styles:

- Square Corner
- Rounded Corner
- Reinforced Corner
- Corner Turret
- Buttressed Corner

Selection considers connection angle, wall height, thickness, number of connected walls, and deterministic positional rules. Straight-to-diagonal transitions share a solid junction footprint so the rampart remains visually continuous.

## Automatic Castle Access

Manual Stone Stairs, Wooden Stairs, Ramp, and Ladder tools are no longer part of the primary Build menu.

The automatic access system analyzes connected fortification networks after architectural changes.

- Short walls can use connected tower/gate access.
- Long walkway networks receive one or more dedicated access points.
- Important towers/gates are preferred anchors.
- Stone stairs are preferred when there is enough space.
- Wooden stairs, ramps, or ladders are chosen when space/height requires them.
- Old saves containing manually placed access pieces still load and render.

Automatic access is derived from parent architecture and is not stored as hundreds of independent objects.

## Procedural Architectural Detail Generator

A shared deterministic generator drives secondary details.

Generated details include:

- Keep windows
- Keep and wall arrow slits
- Doors
- Automatic exterior stairs
- Automatic wall access
- Flags
- Battlement spacing
- Buttresses and defensive supports

Generation is deterministic. The same saved architectural state regenerates the same details after reload rather than moving windows/flags every time the scene is rebuilt.

## Modular Towers

Tower bases remain player-controlled:

- Square
- Round
- Octagonal
- Corner
- Watch Tower

Top styles:

- Battlement
- Roof
- Flat Platform
- Watch Platform

Arrow slits are generated automatically. Tall/important towers may receive a limited automatic flag. Legacy saves that used the old explicit Flag top remain supported.

## Terrain Editing

Brush tools remain available:

- Raise
- Lower
- Flatten
- Smooth
- Dig
- Create Hill
- Create Cliff
- Brush Size
- Strength

Buildings follow edited elevation, diagonal/straight wall connectors adapt to slopes, Keep foundations adapt to terrain, and automatic access is recalculated after redraws caused by terrain changes.

## Rivers, Moats, and Settlement

Existing systems remain intact:

- Animated flowing river with connected channel geometry
- Moats that flood when connected to rivers
- Cottage / House / Manor / Villa residential clusters
- Roads and farms
- Trees, rocks, huts
- Player-grown mountains and mines
- River / Land editing

## Save / Load and Undo / Redo

Save version is migrated forward without changing the browser-local save key.

Persistent architecture now includes:

- Cells and existing structures
- Explicit diagonal wall links
- Keep dimensions/configuration
- Terrain overrides
- Terrain elevation edits

Generated secondary details are rebuilt deterministically.

**Ctrl + Z** — Undo  
**Ctrl + Y** — Redo

Major Keep changes, wall changes, terrain edits, Move/Rotate/Delete, wall/tower height changes, and normal construction are restored as architectural states. Generated windows, flags, arrow slits, and automatic access do not create separate Undo entries.

## Architecture refactor

New systems are separated from the large game coordinator:

```text
src/
  building/
    KeepSystem.ts
    WallSystem.ts
    WallCornerSystem.ts
    CastleAccessSystem.ts
    CastleDetailGenerator.ts

  rendering/
    KeepRenderer.ts

  state/
    GameState.ts

  core/
    types.ts
    constants.ts

  ThreeGame.ts
```

`ThreeGame.ts` still coordinates legacy rendering and interaction, but new architectural rules are being moved into dedicated systems rather than adding all behavior directly to one file.

## Main controls

- **1 / 2 / 3** — Stone / Wooden / Reinforced Wall
- **4** — Gate
- **5** — Modular Tower
- **P** — Modular Keep
- **6** — Road
- **7 / 8 / 9 / 0** — Cottage Cluster / House Cluster / Manor Court / Villa Quarter
- **F** — Farm
- **T** — Tree
- **N** — Mountain
- **M** — Mine
- **Q** — Moat
- **R** — River
- **L** — Land
- **U / J** — Raise / Lower Terrain
- **B** — Flatten
- **V** — Smooth
- **G** — Dig
- **H** — Create Hill
- **C** — Create Cliff
- **X** — Remove
- **[ / ]** — Lower / raise selected wall, tower, or Keep
- **Ctrl + Z / Ctrl + Y** — Undo / Redo

When a Wall tool is active, left-drag builds a snapped straight/diagonal wall run. Terrain tools use left-drag brush strokes. Other tools retain normal left-drag camera rotation.
