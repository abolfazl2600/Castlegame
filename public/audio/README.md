# Audio asset layout

The runtime audio API is centralized in `src/audio/AudioManager.ts` and the logical sound manifest lives in `src/audio/AudioAssets.ts`.

The current baseline intentionally uses procedural Web Audio sources so the game has functional music, ambience, UI, building, and combat feedback without shipping placeholder media. When authored media replaces a procedural entry, keep the same logical asset ID so gameplay code does not change.

Recommended production layout:

```
public/audio/
  music/
    calm/
    tension/
    combat/
    stingers/
  ambient/
    wind/
    birds/
    water/
    settlement/
    fire/
    battle/
  sfx/
    ui/
    building/
    combat/
    destruction/
```

Short SFX should use `preload: 'preload'`. Long music or ambience files should use `preload: 'stream'` so HTML audio elements request metadata first rather than decoding every long track at startup. Mobile voice limits, cooldowns, priorities, and per-asset concurrency are controlled by the central manifest/manager rather than gameplay systems.


## Startup silence policy

Do not use procedural oscillators or generated noise as an automatic fallback for long-running music or ambience.

Until authored music/ambient loops are registered, the game intentionally stays quiet after audio unlock. Only short, event-driven UI/building/combat SFX are allowed to play. This avoids a synthetic startup tone or a faint continuous background drone.

When real loop assets are added, route them through the existing Music/Ambient buses and use a gentle fade-in/crossfade rather than starting at full level.
