# Honor Badges — GitHub-only artwork and in-game Mission Journal

## Four achievement awards (phase 2)

The public catalog contains four actual transparent WebP artworks:

| Badge | Existing mission required |
|---|---|
| royal-architect — معمار سلطنتی | growth-ten-homes (build 10 homes) |
| harvest-steward — نگهبان برداشت | growth-three-farms (build 3 farms) |
| stone-bastion — معمار دژ سنگی | fortress-ten-walls (build 10 wall segments) |
| prosperous-realm — فرمانروای آبادانی | growth-population-100 (reach 100 population) |

Earning a badge is based on the **already saved completed mission** for the
current game world, via `src/honors/HonorAwards.ts`. No Royal Credits are
charged and no gameplay power/benefit is given. Future changes may add
additional art and rules, but should not change existing award IDs.

## Remote-only storage

The manifest and all four transparent artworks are stored in the repository
root, outside of Vite `public/` and `src/assets/`:

- `honor-badges/catalog.v1.json`
- `honor-badges/assets/*.webp`

Fetch base: `https://raw.githubusercontent.com/abolfazl2600/Castlegame/main/honor-badges/`

Each image is subject to manifest SHA-256 verification, PNG/WebP signature
and size validation in `HonorBadgeRepository`. All artwork must be published
to GitHub **before** updating the manifest checksum in `main`. The base URL
always resolves `main`, so a PR preview can test by mocking the network
catalog, and production uses the merged files.

The first time a badge is earned, the Journal shows its name and a Download
button **without image artwork**. The image is never requested automatically.
Only a click by the player downloads and validates the file. Successful
downloads are stored in IndexedDB `castle-role-honor-badges-v1`. The next time
the Journal opens offline, a saved Blob is used for an `img` with a
`blob:` URL. No remote `src`, no prefetch, and no artwork embedded in the
Android APK/AAB or web bundle.

Cached metadata alone does not show an image. Users can browse public GitHub
files directly, so this is availability control in-game, not DRM.

Offline behavior: before any successful download the image is unavailable.
After a successful download the image is accessible offline until browser/app
storage is cleared, the Android app is uninstalled, or storage is evicted.
Game save slots retain their original mission state, unaffected by this
artwork cache. Artwork cached in another save can be viewed again; unlocking
the **download action** still requires finishing its mission in the currently
loaded save.

## Quality assurance and release

`node scripts/test-honor-badge-delivery.mjs` validates the manifest,
actual artwork signatures and SHA-256 digests, and forbids putting the images
in bundled asset directories. Playwright validates first-time online download,
SHA verification, unearned lock, actual gallery image only as `blob:`,
and display of previously downloaded assets when offline.

To make these changes available on Android, build and release a new APK/AAB
from `main`. Uploading artwork to GitHub alone does not add the in-game
Gallery UI to an already-installed binary. After releasing the gallery,
additional future artwork can be added to the remote catalog without
repackaging the Android app, provided the schema and earning rules are
supported by the installed version.
