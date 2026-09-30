# Android packaging: Capacitor foundation

Castle Role remains a Vite/TypeScript web game. Capacitor packages the **built** web assets into an Android WebView; it does not replace the normal GitHub Pages deployment.

## Configuration

- `capacitor.config.ts` sets `appId: com.castlerole.game`, `appName: Castle Role`, and `webDir: dist`.
- `@capacitor/core` is the runtime dependency; `@capacitor/cli` is used for packaging commands.
- The web build continues to use Vite's `/Castlegame/` base from `vite.config.ts` so GitHub Pages URLs are unchanged.
- The separate Android build uses `vite build --base=./` so generated JavaScript, CSS, and other build assets resolve **relative to the local WebView document** instead of requesting `/Castlegame/` from the device. This is a build-time switch, not a runtime environment variable.
- The Capacitor configuration deliberately does **not** set `server.url`. Production content must come from the bundled `dist` folder, not a remote development server.

## Commands

```bash
npm ci                    # install the exact locked dependencies
npm run build             # existing checks + GitHub Pages web build (unchanged)
npm run build:android     # typecheck + local-asset Vite build into dist
```

**After Issue #181 adds and commits the native Android project** (including the matching `@capacitor/android` package), run:

```bash
npm run android:sync      # rebuild Android web assets, then cap sync android
npm run android:copy      # rebuild Android web assets, then cap copy android
```

`android:sync` updates native dependencies/plugins as well as copying built assets; `android:copy` only copies web assets and configuration. Both intentionally target **Android only** and fail until the native project exists. Run `npm run build` again when preparing a Pages deployment because both Vite build modes write to `dist`.

## Scope and next steps

This issue adds only the Capacitor configuration, JavaScript packages, and scripts. It does **not** generate `android/`, an APK/AAB, a signing keystore, or publishing automation. Those are separate steps: [#181](https://github.com/abolfazl2600/Castlegame/issues/181) (native project), [#182](https://github.com/abolfazl2600/Castlegame/issues/182) (manual AAB build), and [#183](https://github.com/abolfazl2600/Castlegame/issues/183) (release signing). Never commit signing secrets or keystores.
