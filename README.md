# Castle Role

Castle Role is a small 2D top-down castle-building game prototype built with Phaser, TypeScript, and Vite.

Version 0.1 focuses on the core interaction loop: navigate a grid, place castle tiles and roads, remove structures, and persist the map locally in the browser.

## MVP features

- 80 × 80 grid world using 40 px tiles
- Camera pan with WASD, arrow keys, or middle/right mouse drag
- Mouse-wheel zoom centered around the pointer
- Castle tile placement
- Road drawing by click/drag
- Remove tool
- Selected-tile hover feedback
- Compact build toolbar with keyboard shortcuts
- Manual load/save, debounced automatic save, load-on-start, and reset
- `localStorage` save format with an explicit version number
- Procedural/basic graphics only; no art pipeline yet

## Run locally

Requirements: a current Node.js release supported by your installed Vite version.

```bash
npm install
npm run dev
```

Then open the local URL printed by Vite.

For a production build:

```bash
npm run build
npm run preview
```

## Controls

- **WASD / arrow keys** — pan camera
- **Middle or right mouse drag** — pan camera
- **Mouse wheel** — zoom
- **Left click / drag** — apply selected build tool
- **1** — Castle tool
- **2** — Road tool
- **3** — Remove tool

## Project structure

```text
src/
  core/       Shared constants and game types
  scenes/     Phaser scenes and orchestration
  state/      Serializable game state
  systems/    Grid, building, camera, and persistence systems
  ui/         DOM-based build toolbar
  main.ts     Phaser bootstrap
  style.css   Lightweight game shell/UI styling
```

## Architecture notes

The MVP keeps persistent game data separate from Phaser rendering. `GameState` owns serializable cells; `BuildSystem` renders them; `SaveSystem` only handles persistence. This makes future systems such as costs, workers, pathfinding, buildings with footprints, or multiple tile layers easier to add without coupling them directly to storage or UI.

`localStorage` is intentionally used for v0.1 because the save is a very small JSON payload. IndexedDB can be introduced later if saves grow to include large maps, NPC state, generated worlds, replays, or binary data.

## Known limitations

- One structure layer per grid cell; roads and castle tiles cannot overlap.
- No construction costs, economy, terrain types, NPCs, combat, or pathfinding.
- Castle tiles are decorative single-cell placeholders, not multi-cell buildings.
- Saves are local to the current browser/profile and have no export/import UI yet.
- No automated test suite yet; the MVP is intentionally kept lightweight.

## Suggested next milestone

Add a small building catalog with typed definitions and footprints (for example wall, tower, gate, keep), plus placement validation and a basic resource cost model. That expands gameplay without forcing a premature simulation architecture.
