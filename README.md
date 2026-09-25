# Castle Role

## Castle architecture expansion

The castle system now treats foundations, defensive details, roof silhouettes, stone language, elevated bridges, and vertical access as one architecture layer.

- **Automatic foundations:** walls remain vertical while foundations extend down to local terrain. Steeper changes add deterministic stepped masonry, and the same idea is used by towers and Stair Towers. Because architecture redraws from state, foundations update automatically after terrain or height edits.
- **Tower roof variety:** tower tops now support Conical Roof, Hipped Roof, Pyramidal Roof, Open Battlement, and Timber Roof in addition to compatible legacy platform/watch options. Square/corner towers reject conical-only geometry by normalizing to a compatible roof; round/octagonal/watch towers likewise avoid square-only hipped/pyramidal geometry.
- **Automatic machicolations:** taller, reinforced, corner, watch, and otherwise important defensive sections receive projecting masonry and corbel supports without adding a manual placement tool.
- **Contextual buttresses:** wall supports select among Simple, Heavy, Stepped, and Angled forms based on height, thickness, wall material, connections, and deterministic local variation.
- **Global castle stone styles:** Limestone, Dark Stone, Sandstone, and Rough Frontier styles recolor/retexture walls, gates, towers, foundations, battlements, Stair Towers, Keeps, and stone Tower Bridges without changing structural geometry.
- **Tower Bridges:** select Tower Bridge (D), choose the first main tower, then a second compatible tower. Distance, alignment, platform height, and intervening structures are validated. Stone bridges use masonry decks/parapets/supports; Wooden bridges use planks, beams, posts, and rails.
- **Stair Towers:** Stair Tower (E) snaps to an adjacent wall with an active Top Walkway, stores the detected access height, and regenerates a narrow tower with foundation, door, arrow slits, implied internal stairs, and a small defensive roof/platform.
- **Elevated navigation:** Wall Walks, tower platforms, Tower Bridges, and Stair Towers are connected in the battle navigation graph. Swordsmen can use Stair Towers to transition between ground and elevated combat, while valid bridges connect separated tower platforms.
- **Persistence and history:** Stone Style, Tower Bridges, Stair Towers, roof choices, and access heights are saved. Undo/Redo snapshots include the global style and bridge connections; automatic supports remain part of their parent structure rather than generating separate history operations.
- Procedural architectural variation is deterministic, and shared materials are reused to avoid thousands of independent masonry assets.


## Template collection

Castle Role now includes **17 starting templates**: the original seven plus ten new showcase worlds. The new set is intentionally distributed so every major build family and architecture variant appears in at least one ready-to-play world.

- **Grand Citadel** — limestone, thick Wall Walks, advanced tower roofs, Stair Tower access, Keep, farms, houses, and stone roads.
- **Dark Fortress** — Dark Stone style, reinforced walls, tall defensive towers, moat, and Defensive Platform Keep.
- **Sandstone Oasis** — Sandstone style, thin walls, oasis river, farms, Conical/Hipped/Pyramidal roofs, and a Keep without battlements.
- **Frontier Outpost** — Rough Frontier style, timber walls, Timber Roof and Watch towers, dirt roads, huts, farm, and Stair Tower.
- **Bridge Stronghold** — both Stone and Wooden Tower Bridges connecting multiple elevated tower platforms.
- **Siege Academy** — moat, heavy walls, Wall Walks, Stair Tower, Stone Stairs, Wooden Stairs, Ramp, Ladder, gate, and a battle-ready Keep.
- **Harbor Capital** — Small Dock, Wooden Pier, Harbor, Fishing Dock, Fishing Boat, Trading Boat, and Transport Ship.
- **Mountain Fortress** — steep edited terrain, stepped foundations, cliff-like plateau, Mountain, Mine, Rock, Tree, and high defensive structures.
- **Royal City** — Cottage, House, Manor, Villa, Farm, Road, Dirt Road, and Stone Road inside a walled city.
- **Architecture Gallery** — Square/Round/Octagonal/Corner/Watch towers; Conical/Hipped/Pyramidal/Open Battlement/Timber Roof plus Flat/Watch/Flag tops; all four Keep roof modes; all three wall families and thicknesses; diagonal walls; both bridge materials; Stair Tower; lowered terrain, hills, plateau, and cliff-like height changes.

Together with the original templates, the collection includes Stone, Timber, and Reinforced walls; thin/medium/thick profiles; battlements on/off; Wall Walks on/off; the four global castle stone styles; all settlement building families; mountains/mines/nature props; river and land edits; maritime construction; elevated castle access; and siege-oriented layouts.


## Battle, mountains, coast & templates update

This update extends the existing systems rather than replacing them.

### Battle behavior

- Attackers keep the castle objective as their strategic destination but now prioritize Defenders who are attacking them, blocking the advance, or guarding the entrance/objective area.
- Attackers drop targets that pull them too far away from the castle and resume their original advance immediately after the local threat is gone.
- Friendly movement uses a softer personal-space model across neighboring spatial buckets instead of hard collision.
- Ground units track progress while moving. Units that fail to make progress trigger automatic recovery: path recalculation for attackers, temporary side-steering, reduced separation pressure, and a new local approach.
- Swordsmen use distributed melee approach slots around a target. Extra attackers form a second ring or select another Defender instead of all forcing the same point.
- Target focus penalties limit unnecessary combat clumping while still allowing an immediate threat to be answered.

### Mountains and mountain ranges

- The single Mountain tool now shapes nearby terrain into broad foothills before raising irregular rock formations.
- Mountain geometry uses overlapping foothills, slopes, shoulders, cliff faces, ridges, and weathered upper peaks instead of one stretched square/vertical block.
- Lower mountain levels keep vegetation accents; high slopes and peaks become increasingly rocky.
- New **Mountain Range (K)** uses the same A → B workflow as walls/roads.
- The generated range bends slightly around the chosen direction and creates a major ridge, secondary heights, small valleys, rocky details, smooth surrounding elevation, foothill trees, and sparse high-elevation vegetation.
- Terrain elevation patches use overlapping rounded geometry so mountain terrain blends across multiple cells instead of exposing obvious square columns.

### Coastline

The coastal transition is now deliberately readable as:

**Grassland → coastal vegetation → sand/rock → wet shoreline → shallow water → deep ocean**

Beach width and material vary by location. Rocky sections can contain low cliffs and stone groups, while sandy sections can contain restrained driftwood, grass, shell-like details, and foam. Harbor validation remains based on usable land beside ocean water, so improved beach visuals do not lock out maritime construction.

### New editable templates

Existing templates remain available, with three additional starting worlds:

- **Mountain Valley** — two mountain ranges, forested foothills, a central river, and a broad open valley for castle construction.
- **Coastal Kingdom** — a cleared harbor-friendly coast, visible beaches, inland forest, open castle land, and gentle hills.
- **Highland River** — a rugged ridge, elevated highlands, a descending editable river, forest/rock groups, and an open castle shelf.

All templates remain normal editable game state: terrain, rivers, walls, roads, trees, Harbors, Keeps, and Battle Mode continue to work normally.


## World, Water, Roads & Harbor expansion

The island environment now has a richer medieval-world layer while preserving castle building and battle mode.

### Water and coastline

- The surrounding ocean now uses an animated procedural surface texture with slow wave motion, color variation, stronger highlights, separate shallow/deep water layers, and a softer coastal transition.
- The island silhouette is no longer a mathematically perfect circle; the base geometry uses controlled radial variation.
- Shore tiles gain deterministic sand/rock patches, coastal stones, occasional small cliffs, vegetation, and subtle foam where shoreline tiles meet ocean water.
- Rivers use a lower wet riverbed, variable channel width, blended circular junctions/connectors, uneven banks, wet earth, grass, edge stones, and faster directional surface flow.
- Connected river pieces merge visually without exposing hard open seams at ordinary gameplay distance.
- Moat flooding still uses the river network.
- Roads crossing river terrain automatically render as lightweight bridges.

### Harbor and shipping

A new **Harbor & Shipping** build category contains:

- Small Dock
- Wooden Pier
- Harbor
- Fishing Dock

Maritime placement validates the coastline and automatically rotates the structure toward ocean water. Larger piers/harbors require deeper open water. River tiles are not accepted as harbor coast.

Dock details include timber decks, support posts, ropes, barrels, crates, and fishing equipment. Each structure can also generate a small docked vessel:

- Fishing Boat
- Small Trading Boat
- Transport Ship

The maritime code uses extensible harbor/ship types so more vessel classes can be introduced later.

### Road construction

The road system now mirrors wall construction:

1. Select Standard Road, Dirt Road, or Stone Road.
2. Press/drag from point A to point B.
3. Preview the complete route.
4. Release to confirm.

Road paths use orthogonal connected tiles with automatic corners, T-junctions, and intersections. Each tile follows local terrain elevation, and connections slope toward neighboring road elevations instead of floating.

Road styles:

- Standard Road — existing general-purpose route.
- Dirt Road — packed earth with wheel tracks.
- Stone Road — heavier medieval paving and visible joints.

### Long-press removal

Holding directly on a removable object for approximately **3 seconds** removes it without switching to the Remove tool.

- A circular red progress indicator appears at the pointer/touch location.
- Moving more than a small gesture threshold cancels the hold.
- Short taps and normal camera movement do not delete objects.
- Walls, towers, roads, buildings, decorations, Keeps, and harbor structures use the same behavior.
- Removal records an Undo snapshot.

### Population foundation

Population is now split into separate, visible counters:

- **Population** — civilian population derived from settlement/economic structures.
- **Army** — the configured Defender military when idle, or living Defender military during a battle.

The population system already exposes additional internal groups such as workers, farmers, miners, sailors, and merchants so later systems can expand without replacing the current foundation.

### Natural terrain zones and denser forests

Procedural terrain now emphasizes distinct but blended zones:

- Open plains
- Dense/medium forest
- Rocky highlands
- Riverbanks
- Coast

Deterministic environmental details add clustered trees, bushes, wild grass, rocks, occasional fallen logs, clearings, dirt/grass variation, shoreline stones, and small coastal cliffs. Existing saves are enriched when migrating to save version 6 without overwriting occupied build cells.


Castle Role is a stylized 3D medieval fortress builder built with Three.js, TypeScript, and Vite.

**[Play Castle Role](https://abolfazl2600.github.io/Castlegame/)**

## Castle siege: breach & ladders

The battle layer now reacts to the actual player-built fortification instead of assuming one universal entry plan.

- Attackers first resolve nearby Defenders that threaten or block the advance.
- Shared siege planning then prefers a reachable open entrance, an existing breach, an existing ladder, a practical new ladder position, and finally a new wall breach.
- Route analysis considers reachability, Wall Walk availability, wall height, nearby Defenders, structural health, and existing siege routes.
- Battle-only wall health varies by wall material, thickness, and height. Damage progresses from visible cracks to heavy masonry damage and rubble before a true breach is created.
- Breached wall coordinates become temporary ground navigation links immediately; the original saved castle is never changed.
- Nearby Defender Swordsmen are redirected toward an important breach instead of pulling the entire defending army away from its positions.
- Automatic ladder carriers visually carry lightweight ladders to valid Wall Walk segments. Ladders reject water, towers, steep/impossible approaches, and unusable wall tops.
- Ladder length adapts to the actual wall height. Once raised, the ladder stays for the rest of the battle.
- Only one attacker occupies the climbing section at a time. Other soldiers wait in spaced queue positions or use another ladder.
- Attackers reaching the top become Wall Walk combatants, can fight Defenders, move across connected wall/tower nodes, secure the rampart, and descend toward useful internal ground.
- Some Defender Swordsmen now deploy on the rampart so ladder assaults can produce melee combat on top of walls.
- Larger attacking armies can create multiple separated ladders without stacking them at nearly the same wall coordinate.
- Battle completion and Reset Battle remove rubble, breaches, ladder navigation, and ladder models while restoring hidden wall geometry exactly.

Advanced siege engines such as Rams, Siege Towers, Trebuchets, Catapults, and Cavalry are intentionally not part of this update.

## Castle battle system

The game now includes a first playable **Attackers vs Defenders** battle mode built around the castle the player actually constructed.

- Two extensible factions are currently configured: Attacker and Defender.
- Swordsman and Archer are the first reusable unit types.
- Battle Setup configures army sizes independently for both factions.
- Defender Archers prefer wall walks, towers, and elevated defensive positions.
- Defender Swordsmen deploy inside the castle near the strategic center.
- Attackers form outside the castle and navigate toward valid entrances and the Keep / Castle Center.
- Ground navigation is generated from the current terrain, buildings, rivers, walls, gates, and Keep footprint.
- Melee combat uses cooldown-based damage and local separation.
- Archers fire visible projectiles; damage is applied when an arrow reaches its target.
- Elevated defenders can fire down from wall and tower positions.
- The Castle Center has a contested 10-second capture objective.
- Results report winner, survivors, casualties, and battle duration.
- Start / Stop / Reset Battle are available; Reset removes battle state only and never edits the player's castle.
- Construction controls are disabled while Battle Mode is active.
- Low-poly soldiers use shared geometries/materials and batched target decisions to keep larger groups practical in the browser.

Advanced siege weapons are intentionally not part of this first battle version.

## 2D planning workflow

Castle Role now supports a dedicated top-down planning mode.

- **2D Plan** hides the 3D structures and renders the same game state as a clean top-down plan.
- Terrain, river, roads, walls, diagonal wall links, gates, towers, housing, farms, resources, and Keeps receive readable plan symbols/colors.
- Building in 2D changes the real game state immediately.
- Switching to **3D View** shows the resulting fortress without conversion or a separate save step.
- New saves begin in 2D Plan so players can lay out the castle first; existing saves still open in 3D.
- The 2D camera stays overhead, supports pan/zoom, and prevents accidental camera rotation.

## Responsive Build panel

The Build panel is now collapsible on every screen size.

- Close it with the × button in the Build header.
- Reopen it with the floating **Build** button.
- On mobile, the panel starts collapsed and automatically closes after a tool is selected.
- Mobile sizing uses most of the available height without covering half the play area permanently.

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
