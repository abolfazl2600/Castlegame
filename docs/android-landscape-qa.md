# Android landscape QA

Castle Role is landscape-first on Android. The native wrapper pins the main activity to landscape with `android:screenOrientation="landscape"` in `android/app/src/main/AndroidManifest.xml`.

## Supported representative viewports

The Android landscape browser QA covers the following CSS viewport sizes:

- 915×412 — narrow landscape phone
- 960×540 — small landscape phone
- 1280×720 — 720p-class landscape
- 1280×800 — landscape tablet

Touch/Mobile controls are forced during this suite so the same compact Android presentation is exercised consistently regardless of the test runner's desktop defaults.

## Panels covered

For every representative viewport the test opens, validates, dismisses, and re-checks the major gameplay surfaces:

- mobile top action bar
- Build Sidebar
- Population / Army summary
- upgrade controls inside Build
- Settings
- Battle panel
- God Mode
- minimap
- template selection
- destructive-action confirmation flow

The suite also verifies:

- no horizontal page overflow
- visible overlays remain inside the viewport
- panels use internal scrolling when their content exceeds available height
- Build, Battle, God Mode, Settings, and Templates can be dismissed
- the Reset World confirmation can be cancelled without opening the new-game selector
- desktop layout remains available at 1440×900

## Screenshot evidence

Each Android viewport captures evidence for:

- unobstructed world/HUD
- Build + Population/Army + upgrade UI
- Settings
- Battle
- Templates

GitHub Actions uploads these screenshots with the Playwright test results so release QA can inspect narrow phone, small phone, 720p, and tablet layouts without committing generated screenshots to the repository.

## Running locally

```bash
npm ci
npx vite build
npx playwright install chromium
npx playwright test tests/android-landscape.spec.ts
```

The standard Capacitor Android build remains:

```bash
npm run build:android
npm run android:sync
```

The web game remains responsive on desktop; landscape locking applies only to the Android wrapper.
