# Castle Role

Castle Role is a lightweight 2D top-down fortress-building game built with Phaser, TypeScript, and Vite.

The core fantasy is building the walls of a growing castle settlement rather than placing a single finished castle.

## Current playable features

- 80 × 80 grid world using 40 px tiles
- Camera pan and zoom
- Connected stone wall construction
- Road building
- Three home types: Cottage, House, Manor
- Procedural river, mountain, and forest terrain
- Terrain-aware placement rules
- Ambient workers and patrolling soldiers
- Local browser save/load/reset

## Controls

- 1 — Wall
- 2 — Road
- 3 — Cottage
- 4 — House
- 5 — Manor
- 6 — Remove

## Architecture

Environment, construction, population, camera, grid, UI, and persistence are kept in separate systems so future terrain clearing, economy, pathfinding, towers, gates, and combat can grow without turning the scene into one large file.

## Known limitations

- Houses are currently decorative residences.
- Units are ambient and not persisted.
- Forest and mountain terrain are not yet clearable.
- No bridges or terrain resource extraction yet.
