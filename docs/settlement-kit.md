# Settlement rendering kit

`src/rendering/SettlementStyle.ts` defines the shared palette, four residence
layouts, and stable coordinate hash used by `ThreeGame.makeHouse`. A new home
uses an entry in `RESIDENCE_LAYOUTS`: compose a compact body and warm roof from
two or three clear masses, then set width, depth, height and `detailed` per
part. The layout fits inside one existing grid cell. Keep its front access and
the alleys between parts visible at the normal camera distance.

The hash uses tile coordinates, part index and family, so rebuilding a tile or
loading a save reproduces its wall/roof pairing, height, facing and chimney.
Variation is bounded; it does not alter the footprint, placement or simulation
state. House box geometry and materials are reused across cells. Add further
colors as semantic style roles, and keep purple for rare landmarks.

`farm`, `appleOrchard`, `market`, `windmill` and roads reference the same palette
roles where their materials overlap with homes. Fields keep legible crop rows,
orchards retain their seeded rows and open gate, and roads retain their existing
neighbor, bridge and slope rules. Farm worker allocation and movement are owned
by `FarmLifeSystem` and the settlement agent system; their state is independent
of this render kit.

For visual review, compare an isolated residence, farm and orchard and a dense
settlement at normal zoom and close zoom. Check corners, crossroads, mixed road
types, gate connections, slopes and bridges. Include render calls and frame
times from the same scene and graphics setting before merging further detail.
