# Architecture boundaries

Castle Role currently ships as a browser game. Keep gameplay state and rules separate from browser input, Three.js objects, and storage so future packages can reuse the same rules.

- `GameState` owns authored grid cells. A rendered mesh or an animated person is derived runtime state and must not become the save format.
- `SaveSystem` receives a `SaveStorage` adapter. The web entry point passes browser storage; another shell can supply its own implementation of `getItem`, `setItem`, and `removeItem`. Maintain save migrations when adding durable fields.
- `ThreeGame` owns the browser scene, UI, and animation loop. Optional visual systems register through `GameExtension` callbacks instead of replacing methods on its prototype. `GameExtension` is a renderer integration API, not a platform-independent gameplay API.
- New gameplay rules should live outside `ThreeGame`, take explicit state and dependencies, and be testable without WebGL. A platform-specific shell should translate input and storage and host the renderer.

Next boundaries to extract, in order: construction transactions (validation, undo, save notification), deterministic simulation time and world events, blueprint serialization, and portable world import/export. Keep each extraction compatible with existing saves and validate it in the browser before targeting other packages.
