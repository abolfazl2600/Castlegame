# Castle Role Visual Style Guide

**Status:** Project art direction and review standard  
**Reference:** User-provided screenshot of *Kingdoms and Castles* (1920 × 1080).  
**Applies to:** Every new or revised visual feature in Castle Role, including buildings, houses, roads, farms, props, units, terrain, water, effects, templates, and in-game UI.

## Visual identity

A readable, colorful, stylized 3D medieval world viewed from an elevated three-quarter camera. It combines simplified low-poly shapes, warm roofs and light masonry, angular vegetation, soft daylight, clear contact shadows, and dark strategy-game UI.

This is a **design language**, not a requirement to copy the reference game's models, icons, textures, interface layout, or exact colors. Build original Castle Role assets within a consistent visual system. An individual screenshot cannot reveal the reference game's exact camera, lighting, materials, polygon counts, or shaders; the values below are starting points to validate in our own scene.

## Non-negotiable rules for new content

1. **Silhouette first.** A player must recognize the asset at normal gameplay zoom before noticing surface detail. Start with two to five large masses and one distinctive feature.
2. **Clear visual hierarchy.** Terrain supports roads; roads organize blocks; ordinary houses support landmarks; castle, gates, towers, and important civic buildings remain focal points.
3. **Stylized, not photorealistic.** Use simple geometry, broad color planes, and selective functional details. Avoid photographic stone, wood, and grass textures, heavy normal maps, tiny random greebles, and mirror-like reflections.
4. **Details must survive gameplay zoom.** Doors, windows, roof edges, battlements, crop rows, and work animations should remain legible from the main camera. Details that collapse into shimmer or noise need to be enlarged, simplified, or removed.
5. **Shared visual grammar.** Related assets use common scale, roof pitch, window sizes, wall thickness, materials, lighting response, and decoration density. Variation is deliberate and seeded.
6. **World state owns appearance.** Aesthetic variation must be deterministic from stable world data; redraw and save/load must reproduce the same scene.
7. **Performance is part of style.** Prefer shared geometry/materials and batching or instancing for repeated elements. Add distance-aware detail when necessary and check dense settlements before merging.

## Shape language and proportions

| Family | Main volumes | Recognizable details |
| --- | --- | --- |
| Ordinary house | Compact pale body; high, warm pitched roof with modest overhang | Dark timber framing, visible door and windows, occasional chimney or awning |
| Manor and civic building | Larger coherent mass with one or two wings | Stronger entrance, height and roof hierarchy, a small number of deliberate ornaments |
| Castle wall and gate | Thick light-stone mass, large battlements, clear connection to adjacent pieces | Walkway, opening, doorway, buttresses where structurally justified |
| Tower | Strong vertical silhouette with a distinct cap or roof | Readable platforms/windows, clear connection to walls and ground |
| Tree | Slim trunk with clustered faceted/conical foliage | Two or three green values and modest shape/height variation |
| Farm and orchard | Visible planting rows and working spaces | Paths, tools, water cues, a worker when appropriate, limited fences and storage props |
| Road | Continuous readable strip with clean intersections | Surface identity, controlled edge variation, coherent bridge and slope transitions |
| Water | Bright blue/cyan broad shape | Legible coastline, limited broad highlights and restrained movement |

Use readable exaggeration where it helps: slightly taller roofs and towers, doors large enough to identify, and crop rows separated enough to see. Do not prescribe one numeric ratio for every building; create a shared reference scene and tune ratios against the main camera.

A building should typically have a body, roof, and one or two secondary accents. Use multiple house variants rather than adding every detail to every house. Place forests in clusters with varied heights and spacing, not a perfect repeated grid.

## Palette and material roles

These approximate HEX tokens were inferred from the screenshot and should be tuned under Castle Role lighting. They are **not measured original game assets**.

| Token | Starting HEX | Intended use |
| --- | --- | --- |
| Plaster / pale wall | #E6DDB5 | Homes and civic buildings |
| Light castle stone | #C8C9B2 | Fortifications and pale paving |
| Stone shadow | #8D927F | Foundations, recesses, shaded sides |
| Roof terracotta | #C96B3E | Common pitched roofs |
| Sunlit roof variant | #E28A4B | Roof variation and edges |
| Timber | #654531 | Frames, doors, rails |
| Sunlit grass | #9AB756 | Open land |
| Shaded grass | #65894A | Ground variation |
| Dark foliage | #264E35 | Tree masses and wooded backdrop |
| Shallow water | #77BDE1 | Bright coastal water |
| Landmark purple | #7043A5 | Rare important roofs and banners |
| UI navy | #102536 | Dark interface surfaces |
| UI blue | #3B84B6 | Selection and interaction states |

Balance broad natural/neutral surfaces with warm building accents; reserve purple and other saturated accents for rare landmarks. Do not turn every new building into a purple-roofed landmark. Use mostly matte to semimatte materials. Metal, glass, and emissive effects belong to specific objects, especially modern-era equipment.

Implement final tokens as centralized reusable material/style roles rather than copying raw color literals into new renderers. Keep the existing stone-style choices (limestone, dark stone, sandstone, frontier) usable within this visual language.

## Lighting, camera, and composition

- **Daylight:** warm directional sun plus soft ambient fill. Preserve enough contrast for roof shapes, tree clusters, walls, and stairs to read. Avoid crushed black shadows and overexposed pale stone.
- **Shadows:** soft but distinct silhouettes and subtle contact darkening. Every major asset should visually sit on the terrain.
- **Effects:** use restrained tone mapping, haze, AO, bloom, and water highlights. Strong cinematic grading, deep depth of field, or oversized glow must not obscure construction.
- **Camera:** elevated three-quarter view with a mild perspective or carefully tuned orthographic projection. Show roofs and façades together. Verify at near, normal, and far zoom rather than relying on a beauty close-up.
- **Landscape:** keep the map readable as a miniature world: larger color regions, faceted slopes, intentional shoreline transitions, and open space between dense blocks.
- **UI:** dark navy panels with light text, clear hierarchy, simple original icons, obvious selected/disabled states, a legible minimap, and controls that do not cover the construction area on mobile.

Do not mandate a particular camera type or light intensity from one screenshot. Set these in the reference scene, then document measured in-game values after validation.

## Asset-specific rules

### Houses and districts
Make three to five compatible base silhouettes before proliferating unique houses. Vary roof orientation, height, framing, doors, chimneys, and small yards within a controlled range. Keep streets and alleys legible. Dense neighborhoods should appear alive through a bounded number of agents and props.

### Castle architecture
Walls, gates, towers, walks, foundations, stairs, and bridges must join without gaps or floating pieces across terrain heights. Battlements should be visible at normal zoom. Variants should preserve recognizable structural function and the chosen castle stone style.

### Agriculture, roads, and props
A farm should show worked soil, crop stages, clear access, and visible activity; an orchard should show rows and recognizable fruit. Roads should have distinct dirt/standard/stone surfaces with stable variation and clean intersections. Small props add evidence of use but must not bury crop rows, block movement, or multiply draw calls excessively. Coordinate with #44, #48, and #49.

### Characters and combat
Use small but distinguishable silhouettes, faction colors, and readable action poses. Attacks and destruction should communicate target, impact, and result without long-lived particle noise. Effects should be short, legible, and scaled to the miniature scene.

### Modern era
Keep the shared camera, simplified forms, material reuse, and readable silhouettes, but use a separate modern palette and architecture: concrete, cool metal, limited emissive accents. Do not add medieval tiled roofs, timber framing, or landmark purple by default.

### Historically accurate templates
For Carcassonne, Arg-e Bam, Himeji, Crac des Chevaliers, and other real sites, **documented plan, scale relationships, materials, and landmark forms take precedence** over generic fantasy motifs. Match the chosen period and real architecture; apply the shared lighting, readability, and performance principles without changing a historical silhouette to fit a house kit.

## Implementation contract for every new feature

Before implementation:
1. State the asset family, role in the world, normal viewing distance, approximate footprint, and one silhouette requirement.
2. Reuse the shared palette/material roles and an existing family kit; identify any genuinely new style token or geometry primitive.
3. Note which neighbor connections, terrain slopes, collision, navigation, damage state, save/load state, and camera modes apply.
4. Identify a representative scene containing other existing assets for visual comparison.

During implementation:
1. Build the largest forms first; validate the asset at normal zoom before adding details.
2. Give repeated details deterministic variation derived from stable world state.
3. Reuse mesh materials and geometry; group or instance high-frequency props where it reduces rendering cost without breaking selection.
4. Support quality and reduced-motion settings when introducing effects or animation.
5. Keep state and simulation outside renderer-only data so redraw and loading are reliable.

Before merging:
- [ ] Include screenshots at normal zoom and close-up, plus a dense neighborhood or equivalent context; compare with the project's approved reference scene.
- [ ] The silhouette, proportions, palette, material roughness, shadow contact, and detail density fit adjacent assets.
- [ ] Inspect 3D and 2D plan views, supported screen sizes, and at least two graphics quality settings.
- [ ] Check redraw, undo/redo where relevant, save/load, terrain slopes, and neighboring structures.
- [ ] Check a dense scene for render calls, frame time, and memory regressions; document any known cost.
- [ ] For a historic site, include plan/photo references and a list of deliberate deviations.

A new building or prop is incomplete until this review is done. Where an existing renderer conflicts with the guide, the new feature should use the target style and the migration work should address the neighboring legacy elements in planned phases; avoid a one-off isolated look.

## Phased migration of the current game

1. **Reference and tokens:** produce one representative style scene, centralize palette/material roles and screenshot/performance baselines. No mass redesign yet.
2. **World foundation:** tune camera, daylight, terrain, shoreline, water, foliage, and environmental detail.
3. **Castle kit:** walls, gates, towers, keep, stairs, bridges, foundations, and connection quality.
4. **Settlement kit:** houses, civic buildings, farms, orchards, roads, props, and active workers.
5. **Actors, effects, and UI:** people, military silhouettes, battle/destruction feedback, panel and minimap styling.
6. **Integration:** review existing templates and modern-era assets, fill gaps, verify multiple graphics quality levels and mobile, and document final tokens.

Each phase gets an issue with before/after captures and a measurable acceptance checklist. Migrate by system or kit to avoid a half-updated asset family.

## Short brief for future requests

> Design and implement [feature] using the Castle Role Visual Style Guide. Maintain the stylized low-poly three-quarter miniature-world look: clear silhouettes at normal zoom, controlled warm/cool palette, pale stone and warm roofs where appropriate, faceted vegetation, soft daylight and contact shadows, restrained functional details, deterministic variation, and shared materials. Check neighboring assets, 2D/3D views, save/load, and dense-scene performance. For a real historic site, prioritize its documented architecture over generic fantasy motifs.
