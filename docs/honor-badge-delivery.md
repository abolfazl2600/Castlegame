# Honor Badge Delivery — phase 1

This change is download/cache infrastructure only. No badge artwork, Royal Credit spending, unlock conditions or gallery UI is added yet.

## GitHub hosting

Remote manifest:
https://raw.githubusercontent.com/abolfazl2600/Castlegame/main/honor-badges/catalog.v1.json

Artwork directory: honor-badges/assets/ at the repository ROOT, outside the Vite /public/, /src/assets/, /android/ and /dist/ trees.

The runtime resolves only HTTPS paths under this GitHub repository. No badge art is packaged into the web build or Android APK/AAB. Any first display of a badge image therefore requires explicit download. GitHub assets are public: this is not DRM, encryption or an access control mechanism.

## Manifest schema

The version 1 manifest has schemaVersion = 1 and badges = [] initially.

Each badge will have:
- id: stable lowercase slug (2–48 chars)
- name and description: separate fa and en strings (1–100 chars)
- assetPath: assets/<slug>.png or assets/<slug>.webp
- mimeType: image/png or image/webp
- sha256: exact lowercase hex SHA-256 hash of the artwork

Example (NOT yet published):
{
  "schemaVersion": 1,
  "badges": [{
    "id": "royal-architect",
    "name": { "fa": "معمار سلطنتی", "en": "Royal Architect" },
    "description": { "fa": "توضیح", "en": "Description" },
    "assetPath": "assets/royal-architect.webp",
    "mimeType": "image/webp",
    "sha256": "(64 lowercase hexadecimal characters)"
  }]
}

Once actual artwork is added, compute its hash with:
sha256sum honor-badges/assets/royal-architect.webp

The service enforces at most 100 entries, a <=256KiB catalog, <=2MiB images, no redirects to other folders or origins, permitted file signatures, and per-file SHA-256 integrity. SVG and HTML are intentionally forbidden.

## App API (src/honors/HonorBadgeRepository.ts)

- loadCatalog(): fetches GitHub each time; if offline, returns a cached catalog (or source='unavailable', catalog=null).
- download(id): fetches a verified image only when not already cached at its current SHA. Returns status 'cached' or 'downloaded'.
- getDownloaded(id) / listDownloaded(): return only downloaded Blob records from IndexedDB for offline rendering.
- HonorBadgeError.code: catalog_unavailable, badge_unknown, invalid_catalog, download_unavailable, integrity_failed or storage_unavailable.

IndexedDB database castle-role-honor-badges-v1 survives app restarts and has separate assets/catalog stores, independent of world save slots. UI must create a short-lived URL.createObjectURL(image) from a downloaded blob, and revoke the URL when done. A cached manifest entry is NOT an already-downloaded image, and a download does NOT grant an achievement, purchase, or entitlement.

After clearing Android app data, browser site data, uninstalling, or storage eviction, the downloaded assets may disappear. This cache is NOT cloud backup.

## Phase 2 (next conversation)

1. Add PNG/WebP badges and publish their manifest records.
2. Define actual badge earning / spending and persist entitlements separately, compatible with older saves.
3. Integrate an accessible Honor Gallery into the game with locked, download-required, downloaded, offline, and retry states.
4. Test first-time download and offline display on a real Android WebView. Ensure badges not yet downloaded never display their artwork.

Never copy honor-badges assets into Vite static assets or Android assets. Keep this distinction in future changes.
