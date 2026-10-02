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
