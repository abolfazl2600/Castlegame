# Bazaar & Myket: signed Android APK

Castle Role has a **separate, manual-only, protected GitHub Actions** workflow for an APK that can be submitted to the Cafe Bazaar and Myket review systems. It deliberately reuses the **same upload JKS** and four secrets that sign the Google Play AAB; **no second private key** or Android Studio installation is required.

## Run in GitHub

1. **Merge the PR to main** after review. The workflow cannot be manually dispatched from the Actions UI until the workflow exists on the default branch.
2. Ensure the GitHub Actions environment named **`android-release`** allows only the protected `main` branch. Reuse its existing environment secrets:
   - `ANDROID_KEYSTORE_BASE64`
   - `ANDROID_KEYSTORE_PASSWORD`
   - `ANDROID_KEY_ALIAS`
   - `ANDROID_KEY_PASSWORD`
   
   Reuse the environment variable `ANDROID_EXPECTED_UPLOAD_SHA256` holding the **public** SHA-256 of the approved signing certificate.
3. Open [Actions → Build signed Android APK (Bazaar and Myket, manual)](https://github.com/abolfazl2600/Castlegame/actions/workflows/android-marketplace-apk.yml).
4. Choose **Run workflow**, select **`main`**, and complete environment approval if required.
5. After success, download the Artifact named like `castle-role-signed-marketplace-apk-v1.0-code1-runN`. Extract its ZIP to obtain **`app-release.apk`**.
6. Install and test that exact signed APK on real target Android devices before submitting it to the stores. Each store may require a developer account, screenshots, description, privacy declarations, ratings and review.

## What CI checks

- Only **`workflow_dispatch`** runs production signing, restricted to `abolfazl2600` on `main` and the `android-release` environment; no PR, fork, scheduled or push trigger. Token only gets `contents: read`, dependencies use locked npm and pinned GitHub Actions.
- Node 22, JDK 21, Android SDK build-tools 36, Gradle dependency caching (read-only), Vite's **relative WebView** build, Capacitor Android sync and native assets verification.
- Keystore Base64 decoded only in the GitHub runner temporary folder with file mode `0600`, not in Git, Gradle properties, Actions artifacts or build caches. The Gradle release signing configuration uses **environment variables** and disables Gradle build and configuration caches.
- Runs `./gradlew --no-daemon --no-build-cache --no-configuration-cache assembleRelease`.
- `scripts/android/verify-signed-apk.sh` uses **Android apksigner** to cryptographically verify the APK, requires verified APK Signature Scheme v2, requires exactly one signing certificate, and compares its SHA-256 fingerprint with both the JKS alias certificate and the owner-approved `ANDROID_EXPECTED_UPLOAD_SHA256` value. An incorrect certificate **fails closed before upload**.
- The only uploaded Artifact payload is the verified signed `app-release.apk` (14-day retention); temporary JKS is removed with a best-effort `always()` cleanup step. A public certificate fingerprint and APK file hash in logs are **not private key material**.

## Compatibility and signing identity

- Package name / application ID: **`com.castlerole.game`**.
- Native version: currently **`versionName 1.0`** and **`versionCode 1`** in `android/app/build.gradle`. Increment versionCode for each update, keeping the package name and certificate stable.
- APK is signed with the **same JKS currently used for Google Play AAB uploads**. Google Play App Signing can use a **different app distribution signing key** from this *upload key*, so an APK installed from Bazaar/Myket might not update seamlessly to an APK served by Google Play. Choose a cross-store certificate strategy **before** the first public release. Do not change the signing key for Bazaar/Myket upgrades after publication without understanding update incompatibility.
- This APK does **not** use Google Play's app-signing service. It is directly signed by the owner's JKS, therefore this private key is **a distribution-signing key for Bazaar/Myket**: maintain an encrypted offline backup and tightly restrict its use.
- Keystore contents, Base64 encoding, or passwords **must never** be pasted into PRs, tickets, chat, logs, or committed files. See [secure Android signing](./android-release-signing.md).
- The existing Play Store AAB and Pages workflows are **unchanged**; this workflow produces only the marketplace APK and does not upload to either store automatically.

## Failure troubleshooting

- No Run workflow button: merge the workflow to the default branch first.
- Job skipped: ensure the owner triggered from main.
- Secret missing or key decode fails: review the **environment** secrets and macOS Base64 transport (never disclose the values).
- Gradle signing fails: check alias/password consistency in the protected environment; do not put passwords in command lines or logs.
- Certificate mismatch: do not release. Check `ANDROID_EXPECTED_UPLOAD_SHA256` against the trusted original JKS, and investigate before rotating a key.
- Rejected by the store: consult the store's current package and metadata requirements; a verified signature is not proof of store acceptance.
