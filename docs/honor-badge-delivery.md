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

## In-game presentation (player-facing)

The Journal shows **all four** awards at all times, including unavailable
ones. An earned award is highlighted in gold, with its full-color image and
"Unlocked" / "آزاد شده". Unfinished awards are displayed in a grayscale,
dimmed state with an unobtrusive lock mark. If one is earned, it becomes the
larger featured card and the remaining three stay in the grid.

The UI never mentions downloading, cached files, being offline or internet
requirements. It has **no download button**. The artwork is a purely
technical detail managed by the game:

- When the Journal opens it reads any locally verified Blob artwork first.
- The game then retrieves the remote catalog and fetches **all four** images
  in the background (including art for locked awards), in batches of two.
- Validated images are persisted to IndexedDB `castle-role-honor-badges-v1`.
- The Journal only ever uses locally generated `blob:` image URLs. No artwork
  is bundled with the application or requested directly as an HTML image URL.
- If the player opens the Journal without any cached artwork and GitHub is
  unreachable, neutral placeholders appear, never fabricated badge art.
- A badge is unlocked **only** when its associated mission is recorded as
  completed for that game save; having cached its picture is not ownership.

The cached image survives subsequent offline sessions until browser/app
storage is cleared, the Android app is uninstalled, or storage is evicted.
There is no cross-device backup for these technical cache entries.
Users can browse the public GitHub files directly, so artwork delivery is
not a DRM or access-control mechanism.

## Quality assurance and release

`node scripts/test-honor-badge-delivery.mjs` validates the manifest,
actual artwork signatures and SHA-256 digests, and forbids putting the images
in bundled asset directories. Playwright validates first-time background retrieval, SHA verification,
all locked badges dimmed with no technical messaging, a featured earned
badge, `blob:`-only image sources and persistence for offline reopening.

To make these changes available on Android, build and release a new APK/AAB
from `main`. Uploading artwork to GitHub alone does not add the in-game
Gallery UI to an already-installed binary. After releasing the gallery,
additional future artwork can be added to the remote catalog without
repackaging the Android app, provided the schema and earning rules are
supported by the installed version.
