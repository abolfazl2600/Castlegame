# Manual Android AAB build (Issue #182)

Castle Role can build an Android App Bundle entirely using GitHub Actions without a local Android Studio installation.

## Run from the browser

1. Merge this workflow into `main`. GitHub only makes `workflow_dispatch` available when the workflow file exists on the default branch.
2. Navigate to [Actions → Build Android AAB (manual, unsigned)](https://github.com/abolfazl2600/Castlegame/actions/workflows/android-aab.yml).
3. Click **Run workflow** and select `main` (or another ref after the workflow exists on the default branch).
4. When the run succeeds, download the `castle-role-unsigned-aab-v1.0-code1-runN` artifact under **Artifacts**.
5. Unzip the artifact archive to obtain `app-release.aab`.

## Pipeline

The workflow is **manual-only**; there are no push, pull request, or schedule triggers. It checks out the repository, configures Node.js 22, JDK 21, Gradle cache, and the Android 36 SDK, then runs:

```bash
npm ci
npm run build:android
npx cap sync android
cd android && ./gradlew --no-daemon bundleRelease
```

The workflow checks that the native project exists, that Vite assets use relative paths when copied into the native project, and that `android/app/build/outputs/bundle/release/app-release.aab` exists and is a valid ZIP archive before uploading it. Artifact names include `versionName` and `versionCode` from `android/app/build.gradle`, plus the GitHub Actions run number. Update both Android version fields for a new release. Artifacts have a 30-day retention setting (subject to repository policy).

## Signing limitation

**This workflow intentionally creates an unsigned AAB and cannot be used for Google Play submission.** For a signed upload bundle, use the separate [protected manual workflow and owner-operated key setup](./android-release-signing.md) (Issue [#183](https://github.com/abolfazl2600/Castlegame/issues/183)). The unsigned job remains secret-free.

Existing GitHub Pages deployment is unchanged. Nothing is uploaded to Google Play automatically.

## Troubleshooting

If **Run workflow** is not visible, merge this workflow to the default branch first. If the native project check fails, ensure Issue #181 is merged. If an AAB is missing, inspect the Gradle bundle step in the run log. Neither Android Studio nor a local Android SDK is needed for this process.
