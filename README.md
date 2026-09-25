# Castle Role

Castle Role is a lightweight 2D top-down castle-building game built with Phaser, TypeScript, and Vite.

The player is not placing complete castles. The core construction fantasy is building the **castle walls piece by piece**, laying roads, and gradually growing a living stronghold around them.

## Current playable features

- 80 × 80 grid world using 40 px tiles
- Camera pan with WASD, arrow keys, or middle/right mouse drag
- Mouse-wheel zoom centered around the pointer
- Connected-looking stone castle-wall construction
- Road drawing by click/drag
- Remove tool
- Selected-tile hover feedback
- 8 ambient workers who move between construction areas and pause to work
- 5 soldiers who patrol around the developing stronghold
- Manual load/save, debounced automatic save, load-on-start, and reset
- Backward-compatible loading: old `castle` tiles are migrated to `wall`
- `localStorage` persistence for construction
- Procedural graphics only; no external art pipeline yet

## Controls

- **WASD / arrow keys** — pan camera
- **Middle or right mouse drag** — pan camera
- **Mouse wheel** — zoom
- **Left click / drag** — apply selected build tool
- **1** — Wall
- **2** — Road
- **3** — Remove

## Architecture

```text
src/
  core/       Shared constants and game types
  scenes/     Phaser scenes and orchestration
  state/      Serializable construction state
  systems/
    BuildSystem.ts       Wall/road placement and rendering
    CameraController.ts  Pan and zoom
    GridSystem.ts        World grid and selection
    PopulationSystem.ts  Workers and soldiers
    SaveSystem.ts        Browser persistence
  ui/         DOM-based build toolbar
```

Construction state and population simulation are intentionally separate. Workers and soldiers are currently lightweight ambient agents rather than persisted units. This keeps the prototype simple while giving us a clean place to add jobs, homes, barracks, enemies, orders, combat, and pathfinding later.

## Run locally

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
npm run preview
```

## Known limitations

- Workers currently choose simple local destinations rather than using pathfinding.
- Soldiers patrol but do not yet receive commands or fight.
- Population is recreated on page load; only construction is saved.
- Walls and roads still use one grid layer and cannot overlap.
- No gates, towers, houses, resources, economy, jobs, barracks, or enemies yet.

## Recommended next milestone

Add **gates + towers + a small house/workplace system**. Then workers can have real jobs and destinations, and soldiers can be tied to barracks and wall/gate guard posts before combat is introduced.
