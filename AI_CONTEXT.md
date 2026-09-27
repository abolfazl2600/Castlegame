# Castle Role (`Castlegame`) — AI Context & Architecture Map

> **Purpose**: This document provides a high-density, token-efficient reference map for AI assistants (and developers) working on the Castle Role codebase. It outlines core architecture boundaries, system entry points, directory maps, and modification rules so agents can locate files and plan edits without reading the entire repository.

---

## 1. Project Overview & Tech Stack

* **Name / Title**: Castle Role (`Castlegame`)
* **Type**: In-browser 3D grid-based settlement builder and castle siege defense simulation.
* **Core Technologies**:
  * **Engine**: [Three.js](https://threejs.org/) (`^0.180.0`) with WebGL renderer and `OrbitControls`.
  * **Language & Bundler**: TypeScript (`^7.0.2`), Vite (`^8.3.1`).
  * **Testing**: Node.js headless assertion scripts (`scripts/test-*.mjs`), Playwright E2E (`@playwright/test` in `tests/`).
  * **Target**: Single-page application deployable to GitHub Pages (base path `/Castlegame/`).

---

## 2. Core Architectural Boundaries & Invariants

Maintain strict decoupling between **authored state**, **headless domain services**, **rendering**, and **UI**:

1. **State vs. Visual Representation (`GameState` vs `ThreeGame`)**:
   * `src/state/GameState.ts` owns the 2D authored grid cells (`x, y, kind, level, options`).
   * Meshes, particle effects, animated workers, and Three.js scene graphs are **derived runtime state** and must NEVER be stored in `GameState` or serialized into saves.
2. **Headless Domain Logic (`src/core/GameDomainServices.ts`)**:
   * Gameplay rules, wall connection algorithms, keep bounding calculations, damage ratios, and population math live in headless service classes testable without WebGL or DOM.
3. **Save System & Migrations (`src/core/SaveSystem.ts`)**:
   * Save storage is decoupled via `SaveStorage` interface (`getItem`, `setItem`, `removeItem`).
   * When adding durable fields, update `SAVE_VERSION` and add a backward-compatible migration handler in `SaveSystem`.
4. **Isolated Application Bootstrap (`src/main.ts`)**:
   * UI shells (`SettingsUI`, `MobileUI`) initialize first synchronously.
   * Heavy 3D modules (`ThreeGame`, `FarmLifeSystem`) load dynamically in an isolated error boundary (`import('./ThreeGame')`) so the page and settings remain accessible even if WebGL fails.
5. **Extension Hooks (`src/core/GameExtension.ts`)**:
   * Auxiliary systems register via `GameExtension` callbacks rather than monkeypatching `ThreeGame` methods.

---

## 3. Directory & File Index

### `src/` (Source Code)

#### Entry Points & Core Scene
* `src/main.ts`: Application bootstrap; loads settings and dynamic runtime boundary.
* `src/ThreeGame.ts`: Central 3D game coordinator; controls WebGL renderer, camera, lighting, terrain mesh generation, user interaction, placement previews, undo/redo history, and main render loop.
* `src/SandboxGameMode.ts`: Free-build mode implementation with unlimited tools.
* `src/SurvivalGameMode.ts`: Objective-based survival mode with resource constraints and timed siege waves.
* `src/style.css`: Unified UI styling, HUD overlays, build sidebars, modal dialogues, and responsive mobile rules.

#### `src/core/` (Foundations & Services)
* `GameDomainServices.ts`: Composes headless domain services (`keepSystem`, `wallCornerSystem`, `castleAccessSystem`, `gateSystem`, etc.) for clean injection.
* `GameMode.ts`: Mode definitions (`medieval`, `sandbox`, `survival`), building/tool availability validators.
* `GameModeFoundation.ts`: Shared lifecycle and mode interface contracts.
* `GameSession.ts`: Session lifecycle management and tracking.
* `SaveSystem.ts`: Serializes grid state, elevations, overrides, and bridges; handles version migrations and JSON import/export.
* `GameExtension.ts`: Extension lifecycle and render hooks for modular features.
* `PrivacyLegalUI.ts`: Legal notice modal and data clearing actions.
* `constants.ts`: Grid size constants (`WORLD_COLS`, `TILE_SIZE`), storage keys, and save version.
* `types.ts`: TypeScript definitions for grid cells, tile kinds, bridge states, terrain types, and tools.

#### `src/state/` (Data Store)
* `GameState.ts`: In-memory grid cell database (`Map<string, GridCell>`), cell CRUD, layer queries, and state snapshots.

#### `src/building/` (Construction & Structural Logic)
* `WallSystem.ts`: Wall connection directions, elevation delta stepping, and link bitmasks.
* `WallCornerSystem.ts`: Automatic corner detection and tower/buttress placement.
* `WallPath.ts`: Bresenham-style grid path calculation for drag-building walls.
* `ConnectedWallNetwork.ts`: Graph analysis for continuous fortification perimeters.
* `GateSystem.ts`: Gatehouse placement, door rotation, and passability flags.
* `KeepSystem.ts`: Multi-tile Keep placement, footprint occupancy, and orientation.
* `CastleAccessSystem.ts`: Walkable route generation (stairs, elevated walkways, door connections).
* `CastleDetailGenerator.ts`: Procedural architectural accents (crenels, machicolations, corbels).
* `DestructibleBuildingSystem.ts`: Health tracking, damage ratios, and procedural fracture visualization.
* `StructureFootprints.ts`: Collision bounds and occupied tiles for large multi-cell structures.

#### `src/battle/` (Combat, Sieges & Objectives)
* `BattleSystem.ts`: Attacker/defender simulation, siege weapons (catapults/archers), wave management, target selection, and combat resolution.
* `BattleNavigation.ts`: Pathfinding across terrain, breaches, and open gates.
* `MilitaryProgression.ts`: 4-tier military progression and defense buffs.
* `MissileCapability.ts`: Modern missile production, hostile-only target locking, cooldowns, and silos.
* `FactionRelations.ts`: Faction stances (allied, neutral, hostile).
* `types.ts`: Battle status, attacker stats, and weapon parameters.
* `src/battle/objectives/`:
  * `BattleObjectiveDefinitions.ts`: Predefined objective goals (survival, defense, time targets).
  * `BattleObjectiveEvents.ts`: Event triggers dispatched upon objective updates.
  * `BattleObjectiveRegistry.ts`: Active and completed objective store.
  * `BattleObjectiveSystem.ts`: Evaluation engine checking win/loss conditions.
  * `BattleObjectiveUI.ts`: On-screen HUD displaying active objectives.

#### `src/systems/` (Living World & Economy)
* `FarmLifeSystem.ts`: Animated farmer routines, livestock (cows), barns, and crop cycles.
* `OrchardSystem.ts`: Apple orchard growth cycles, harvesting, and seasonal visuals.
* `WindmillSystem.ts`: Windmill blade rotation and flour milling animation.
* `MaritimeSystem.ts`: Waterway navigation, ships, and docks.
* `PopulationSystem.ts`: Settlement population calculation based on housing and food production.

#### `src/rendering/` (Visual Styles & Procedural Meshes)
* `CastleArchitectureStyle.ts`: Style token registry for castle components.
* `MedievalMaterials.ts`: PBR materials and shaders for stone, timber, slate, and thatch.
* `ModernMaterials.ts`: Materials for reinforced concrete, glass, steel, and composites.
* `ModernArchitecture.ts` & `ModernStyle.ts`: Modern fortress procedural mesh generators.
* `KeepRenderer.ts`: Multi-floor castle keep renderer.
* `BasilicaRenderer.ts`: Medieval cathedral / basilica procedural generator.
* `FuturisticCastleRenderer.ts`: Sci-fi fortress procedural generator.
* `SettlementStyle.ts`, `TemplateVisualStyle.ts`, `WorldStyle.ts`: Unified color palettes and material configs.

#### `src/settings/` (User Configuration)
* `SettingsModel.ts`: Typed configuration model (audio volumes, graphics presets, camera speed).
* `SettingsStore.ts`: Reactive settings store backed by localStorage.
* `SettingsUI.ts`: Modal settings dialog and control bindings.
* `SettingsSubsystems.ts`: Subsystem coordinator for settings application.

#### `src/audio/` (Sound & Music)
* `AudioManager.ts`: Web Audio API manager for sound effects and music loops.
* `AudioEventBus.ts`: Decoupled sound event emitter.
* `AudioAssets.ts`: Audio file registries and synthetic tone fallbacks.
* `AudioSettingsUI.ts`: Audio slider controls.

#### `src/world/` (Terrain & Maps)
* `MapLayouts.ts`: Procedural heightmaps, river generation, and preset templates (e.g. Carcassonne).

#### `src/godmode/` (Developer / Sandbox Cheats)
* `GodModeSystem.ts`: Sandbox cheat commands (instant resources, airstrikes, instant repair).

#### `src/ui/` (Presentation & Mobile)
* `MobileUI.ts`: Responsive touch controls, bottom drawer, and mobile header proxies.
* `src/app/applicationActions.ts` & `applicationMetadata.ts`: Global application actions and metadata.

---

### Root Configuration & Tooling
* `index.html`: Web page shell, HUD buttons, canvas container, and modal DOM templates.
* `vite.config.ts`: Vite build configuration (sets base path to `/Castlegame/`).
* `tsconfig.json`: TypeScript compiler configuration.
* `playwright.config.ts`: End-to-end testing setup on port 4173.
* `package.json`: Scripts and dependencies (`three`, `@playwright/test`, `vite`, `typescript`).

---

### `scripts/` (Fast Node.js Regression Contracts)
Execute via `npm run test:regression` or individually with `node scripts/<script>.mjs`:
* `test-battle-state-boundary.mjs`: Ensures battle simulation does not mutate non-battle state.
* `test-build-sidebar-ux.mjs`: Validates build sidebar tool selection and accessibility.
* `test-build-tool-registry.mjs`: Ensures all tools defined in `GameMode` exist in UI toolbars.
* `test-castle-access-navigation.mjs`: Verifies elevated walkway and stair connectivity.
* `test-castle-architecture-style.mjs`: Tests material and architectural token propagation.
* `test-cross-mode-save-loading.mjs`: Tests save portability across game modes.
* `test-farm-worker-visibility.mjs`: Verifies farmer and cow spawn rules.
* `test-gate-orientation.mjs`: Verifies gate alignment with adjacent walls.
* `test-god-mode.mjs`: Tests god mode cheat state invariants.
* `test-map-layouts.mjs`: Verifies river generation and map boundary rules.
* `test-military-progression.mjs`: Verifies 4-tier military progression calculation.
* `test-missile-capability.mjs`: Verifies missile production, cooldowns, and targeting restrictions.
* `test-modern-fortress-terrain-protection.mjs`: Ensures multi-tile footprints lock terrain elevation.
* `test-orchard-visual-contract.mjs`: Tests orchard visual stages and harvesting.
* `test-playable-layout-templates.mjs`: Validates preset template tile placements.
* `test-river-water-visibility.mjs`: Verifies water elevation and shader uniform synchronization.
* `test-save-mode-ui-sync.mjs`: Verifies UI synchronization after loading saved games.
* `test-settings-bootstrap-order.mjs`: Asserts settings UI initializes before ThreeGame.
* `test-settlement-lifecycle.mjs`: Verifies population growth, food consumption, and limits.
* `test-visual-phase5-audit.mjs` & `test-visual-style-integration.mjs`: Visual audit benchmarks.

---

## 4. Development Workflow & Commands

* **Run dev server**: `npm run dev`
* **Run regression tests**: `npm run test:regression`
* **Run type-check & build**: `npm run build`
* **Run Playwright UI tests**: `npm run test:ui`

---

## 5. How to Add Features Without Breaking Architecture

1. **Adding a New Building / Structure**:
   * Add the structure key to `TileKind` in `src/core/types.ts`.
   * If multi-tile, specify its width, depth, and footprint in `src/building/StructureFootprints.ts`.
   * Add placement and availability rules to `src/core/GameMode.ts`.
   * Implement mesh construction in `src/rendering/` or `ThreeGame.ts:makeBuilding`.
   * Add a headless test script under `scripts/test-<feature>.mjs` and register it in `package.json` under `test:regression`.
2. **Adding a New Gameplay System**:
   * Create a dedicated class in `src/systems/` or `src/building/`.
   * Inject it via `createGameDomainServices` in `src/core/GameDomainServices.ts`.
   * Keep state inside `GameState` and listen to updates via callbacks or extension hooks.
