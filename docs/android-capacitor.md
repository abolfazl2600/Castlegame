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

**The native Android project is committed in Issue #181.** The repository now includes the matching `@capacitor/android` package and the Android App plugin. Run:

```bash
npm run android:sync      # rebuild Android web assets, then cap sync android
npm run android:copy      # rebuild Android web assets, then cap copy android
npm run android:debug     # sync and assemble the local debug APK
```

`npm run android:debug` performs the same sync and then builds a debug APK with Gradle; JDK 21 and Android SDK 36 are required in a clean Linux CI environment. Android is landscape-first, loads bundled assets without a remote server, and routes system Back through the game's dialog handlers. The initial game-mode dialog requires a selection; Back cannot dismiss it.

`android:sync` updates native dependencies/plugins as well as copying built assets; `android:copy` only copies web assets and configuration. Both intentionally target **Android only** and fail until the native project exists. Run `npm run build` again when preparing a Pages deployment because both Vite build modes write to `dist`.

## Scope and next steps

Issue #180 added the Capacitor foundation, and Issue #181 commits the native Android wrapper. A debug build produces `android/app/build/outputs/apk/debug/app-debug.apk`, which uses a development/debug signing key and is **not** a Google Play release artifact. Native Gradle caches and generated assets stay out of version control. Next steps are [#182](https://github.com/abolfazl2600/Castlegame/issues/182) (manual release AAB build) and [#183](https://github.com/abolfazl2600/Castlegame/issues/183) (secure production signing). Never commit signing secrets or keystores.
