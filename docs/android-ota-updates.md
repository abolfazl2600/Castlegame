# Android OTA web updates

Castle Role's Android live-update path is **web-layer only**. It lets an installed Capacitor Android app replace its packaged HTML/CSS/JavaScript/game-data bundle without reinstalling the APK.

## Published files

Every trusted `main` deployment builds a dedicated Capacitor-compatible bundle with:

```bash
npm run build:android-update
```

That command uses Vite's relative base (`--base=./`) and writes to `dist-android-update`. The Pages workflow validates that `index.html` contains relative `./assets/` references and rejects GitHub Pages-style `/Castlegame/assets/` references.

The workflow packages the verified bundle as a versioned ZIP and publishes it with:

```text
https://abolfazl2600.github.io/Castlegame/android-updates/android-update.json
https://abolfazl2600.github.io/Castlegame/android-updates/castlegame-web-update-<main-commit-sha>.zip
```

The manifest has this contract:

```json
{
  "version": 1,
  "buildId": "<main commit SHA>",
  "createdAt": "<ISO-8601 timestamp>",
  "url": "https://.../castlegame-web-update-<main commit SHA>.zip",
  "sha256": "<64-character SHA-256>"
}
```

GitHub Actions artifacts are not used as the production update endpoint. The Android app contains no GitHub PAT, Actions token, or repository credential.

## Client verification and activation

`GameUpdaterPlugin`:

1. downloads the public manifest over HTTPS with caching disabled;
2. validates `buildId`, HTTPS package URL, and SHA-256 format;
3. returns `updated: false` if that build is already active;
4. downloads the ZIP with a 100 MiB compressed-size ceiling;
5. recalculates SHA-256 and rejects a mismatch before extraction;
6. extracts into an app-private staging directory with ZIP path-traversal protection, a 250 MiB expanded-size ceiling, and an entry-count limit;
7. requires root `index.html`, relative `./assets/` paths, and the referenced `assets/` directory;
8. atomically renames the validated staging directory into its final bundle directory;
9. switches Capacitor's server base path only after all verification has passed;
10. records `installedBuild` only after activation;
11. keeps the active bundle and the previous valid OTA bundle, while removing older inactive bundles and ZIP downloads.

The settings UI reloads the WebView after a successful activation. Failed downloads, hash checks, extraction, or validation leave the currently working bundle and the APK-packaged assets untouched.

The client exposes separate user-facing states for network, manifest/server, integrity, invalid-package, and activation failures. Technical detail is still logged with `console.error`.

## Recovery boundary

The updater never overwrites the APK's packaged assets. A new bundle is staged and validated before the active path changes. The previous valid OTA bundle is retained during cleanup for recovery/rollback work.

A package that is corrupt, has the wrong SHA-256, contains unsafe ZIP paths, lacks `index.html`, or contains `/Castlegame/assets/` is rejected.

## Native compatibility boundary

OTA updates cannot deliver native Android changes. A new signed APK/AAB is still required for any change involving:

- Java/Kotlin code;
- Capacitor plugin registration or native plugin code;
- `AndroidManifest.xml`;
- Android permissions;
- Gradle dependencies or native SDK versions;
- app signing;
- `applicationId`;
- `versionCode` or `versionName`.

In other words, OTA is for HTML, CSS, JavaScript, Vite-bundled assets, and game data included in the web bundle. Native binary changes remain normal Play Store releases.

## CI verification

`npm run test:android-ota-contract` statically verifies the updater and workflow contracts. During the Pages deployment, the same test is run again with `ANDROID_OTA_ARTIFACT_DIR=dist/android-updates`, which additionally verifies:

- manifest fields;
- public HTTPS package URL;
- ZIP SHA-256 against the manifest;
- root `index.html` inside the ZIP;
- relative Android asset paths;
- absence of GitHub Pages asset paths.

A real-device upgrade from an older APK remains a release QA step because CI cannot prove WebView persistence across an actual Android process restart.
