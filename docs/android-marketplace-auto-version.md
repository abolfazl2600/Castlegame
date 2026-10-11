# Automatic Bazaar / Myket APK versions

The **Build signed Android APK (Bazaar and Myket, manual)** GitHub Actions workflow
automatically sets both Android version fields. You no longer enter a
`version_code` when launching the APK workflow.

## Publishing an APK

1. Open **Actions → Build signed Android APK (Bazaar and Myket, manual)**.
2. Select **Run workflow**, branch **main** and confirm the run as the repository owner.
3. Approve the protected `android-release` environment if required.
4. Download the signed artifact from the completed run's **Artifacts**. It contains **exactly one universal APK**, named `castle-role-bazaar-myket-v...-code....apk`.
5. In **Cafe Bazaar's release editor**, create a new release or open the pending draft and **remove any previously attached APK with the same device configuration from that draft**. Attach only this new APK. Do **not** delete historic published versions.
6. Upload the one APK to Bazaar and/or Myket; the package ID and signing key are unchanged.

For new runs, `GITHUB_RUN_NUMBER` increases automatically. To avoid colliding
with the previous timestamp-based APK scheme, the default version range starts at
500,000,000:

```text
versionCode = 500000000 + (GITHUB_RUN_NUMBER × 100) + GITHUB_RUN_ATTEMPT − 1
versionName = 1.0.<GITHUB_RUN_NUMBER>.<GITHUB_RUN_ATTEMPT>
```

Example: workflow run 251, attempt 1 builds `versionCode=500025100`,
`versionName=1.0.251.1`. Run 252 creates `500025200` / `1.0.252.1`.
Re-running the same run increments `GITHUB_RUN_ATTEMPT`, reserving up to 100
attempts without repeating the code.


### Duplicate package configuration in Cafe Bazaar

A `versionCode` change alone cannot fix the message **«پیکربندی بسته‌ها نباید تکراری باشد»** if two APKs were attached to the same **pending release** with identical device targeting. This build produces and publishes as a GitHub artifact just **one universal APK**, and fails instead of uploading split/extra APKs. However, GitHub Actions cannot remove an APK already attached to a Bazaar release draft: remove the older attachment in Bazaar's developer panel before saving the new release. Leave previously published releases intact.

### First-release check (only if previous versions used unusually high codes)

Neither GitHub Actions nor the repository knows what codes were already
uploaded to a marketplace. **Before the first automatic APK upload**, check
that the newly generated `versionCode` is greater than the largest version code
already uploaded to **both** Bazaar and Myket (including unpublished releases).

If the previous maximum is already at or above the default generated value,
set the optional repository or protected `android-release` environment variable
`ANDROID_MARKETPLACE_VERSION_CODE_BASE` to a higher number. The generator adds
the workflow run number and attempt offset to this base. Do not lower the base
after publishing an APK. Android limits the final version code to 2,100,000,000.

Avoid re-running an *old* GitHub Actions run after publishing a newer one:
its code may be lower than a newer run's code. Start a **new Run workflow**
for every subsequent marketplace update.

The Google Play **signed AAB** workflow is intentionally independent and still
uses an explicitly confirmed `version_code` input. This APK workflow changes
neither the AAB release process nor debug build defaults.
