# Android landscape QA

Castle Role always presents **landscape gameplay** on Android, without forcing the user to rotate their handset. The Android activity allows natural physical orientation. On a portrait touch device, the entire web application surface (3D canvas, HUD, menus, and controls) rotates 90° clockwise, with logical viewport width and height exchanged. Landscape devices render normally. Resize and orientation changes are handled automatically, and pointer/touch input is transformed into landscape coordinates. No rotate-device prompt or portrait gameplay mode is used.

Portrait QA: run `npx playwright test tests/software-landscape.spec.ts`. Confirm full physical-screen coverage at 390×844 and 412×915, interactive Settings and canvas, and restoration to an unrotated 915×412 view. Validate both orientations on actual Android hardware; browser emulation does not test native WebView/plugin interaction.

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
- Settings, including Save/Load opened through Game Actions
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
- the separate native Back regression closes both Save and Load through their delegated close buttons without minimizing the app, while preserving mandatory map-selection priority

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
npm run test:android-back-navigation
npx playwright test tests/android-landscape.spec.ts tests/mobile-touch-flows.spec.ts
```

The standard Capacitor Android build remains:

```bash
npm run build:android
npm run android:sync
```

The web game remains responsive on desktop; landscape locking applies only to the Android wrapper.
