<div align="center">

# Castle Role

**Build the fortress. Shape the land. Defend the kingdom.**

[![Play Castle Role](https://img.shields.io/badge/PLAY%20CASTLE%20ROLE-LIVE-2ea44f?style=for-the-badge)](https://abolfazl2600.github.io/Castlegame/)

A stylized 3D medieval fortress builder with settlement simulation, terrain editing, and castle battles.

**Three.js · TypeScript · Vite · Capacitor**

</div>

---

## About

Castle Role is a browser-first medieval strategy sandbox focused on building and defending editable castles.

You design the important architecture — walls, towers, Keeps, gates, terrain, roads, settlements, and defenses — while the game generates many secondary architectural details automatically.

## Highlights

- **Modular castle building** — walls, gates, towers, Keeps, bridges, battlements, wall walks, and automatic access.
- **Editable terrain** — raise, lower, flatten, smooth, create hills and cliffs, draw rivers, and reshape coastlines.
- **Living settlement** — housing, farms, orchards, workers, civilians, resources, storage, and food production.
- **Castle battles** — Attackers vs Defenders with melee units, ranged units, navigation, breaches, ladders, and capture objectives.
- **Procedural medieval detail** — foundations, arrow slits, windows, buttresses, stairs, flags, and other architecture are generated from the castle state.
- **3D-only world** — build and inspect in one WebGL world, with 45° and top-down camera presets instead of a separate 2D renderer.
- **Templates and sandbox play** — start from prepared castle, settlement, and terrain layouts or build from scratch.
- **Persistence** — Save / Load, Undo / Redo, and deterministic regeneration of procedural details.
- **Web and Android** — the game runs in the browser and includes a Capacitor-based Android project.

## Play Online

### [▶ Play Castle Role](https://abolfazl2600.github.io/Castlegame/)

The live build is deployed through GitHub Pages.

## Run Locally

```bash
npm install
npm run dev
```

Create a production build:

```bash
npm run build
npm run preview
```

Sync the web build into the Android project:

```bash
npm run android:sync
```

## Main Controls

| Key | Action |
| --- | --- |
| **1 / 2 / 3** | Stone / Wooden / Reinforced Wall |
| **4** | Gate |
| **5** | Modular Tower |
| **P** | Modular Keep |
| **6** | Road |
| **F** | Farm |
| **T** | Tree |
| **N** | Mountain |
| **M** | Mine |
| **Q** | Moat |
| **R** | River |
| **U / J** | Raise / Lower Terrain |
| **X** | Remove |
| **Ctrl + Z / Ctrl + Y** | Undo / Redo |

When a wall tool is active, drag to create a snapped wall run. Terrain tools use brush strokes.

## Tech Stack

- **Three.js** — 3D rendering
- **TypeScript** — game and UI logic
- **Vite** — development and production builds
- **Capacitor** — Android packaging
- **Playwright** — browser UI testing

## Project Structure

```text
src/
  building/    Castle construction systems
  rendering/   3D rendering and visual systems
  systems/     Economy, population, environment, and simulation
  core/        Shared game state and services
  settings/    Settings and platform UI
  ui/          Responsive/mobile UI
  world/       Map layouts and world generation

android/       Capacitor Android project
tests/         Browser integration tests
scripts/       Validation, regression, and visual QA scripts
```

## Documentation

- [Visual Style Guide](VISUAL_STYLE_GUIDE.md)
- [Visual Reference & Baseline Workflow](docs/visual-reference.md)
- [Google Play Release Requirements](docs/store-release/GOOGLE_PLAY_REQUIREMENTS.md)
- [Android OTA Web Updates](docs/android-ota-updates.md)
- [Screenshot / Photo Capture](docs/screenshot-capture.md)
- [Store Release Roadmap](docs/store-release/ROADMAP.md)

---

<div align="center">

**Castle Role** — build, simulate, and defend your own medieval stronghold.

[Play the game](https://abolfazl2600.github.io/Castlegame/) · [Back to top](#castle-role)

</div>
