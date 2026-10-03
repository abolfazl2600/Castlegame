# Android touch gestures — release gate #112

This implementation is shared by Google Play, Bazaar and Myket. Desktop mouse,
wheel and keyboard continue using OrbitControls. Canvas touch pointers have one
owner, `TouchGestureSession`; they never feed a partial stream to OrbitControls.
The touch camera updates the same camera/target, sensitivity and release bounds.

## Gesture contract

| Context | One finger | Two fingers |
| --- | --- | --- |
| Inspect / single-placement tools | Tap selects/places; drag past 6 CSS pixels navigates (3D rotates, 2D pans). A drag that returns to its origin is still not a tap. | Pan + bounded pinch zoom |
| Wall / Road / Mountain Range | Drag previews, release commits one edit | Cancel unfinished edit, rebase, then pan/pinch |
| Raise / Lower / Flatten / other terrain brushes | Drag edits elevation provisionally; release creates one Undo/save entry | Roll elevation back, then pan/pinch; do not rewind live population/economy |
| God targeting | Tap chooses target; moving past the threshold navigates without choosing a target | Pan/pinch without choosing/firing a target |
| Active Battle | Camera navigation, no construction | Pan/pinch, no construction |
| UI / dialogs | UI action; a touch starting on UI never enters world input | UI-owned touches do not join the world gesture |

Adding/removing fingers rebases position/span before the next camera delta. The
remaining finger may navigate, but cannot become a fresh build/target tap until
all fingers are lifted. Three-or-more-finger motion is ignored until the count
returns to one/two, with a fresh baseline. Coincident fingers cannot cause infinite
zoom. Existing camera bounds and sensitivity settings apply.

The long-press timer is cancelled by navigation, a second finger, UI interaction
or interruption. A removal already deliberately completed after the full hold is
an ordinary committed edit with Undo; later navigation does not undo it.

Pointer cancellation/unexpected capture loss, blur, hidden page, pagehide,
wrapper pause and native Capacitor background events cancel provisional edits.
Autosaves made by other live systems read committed elevation, excluding the
provisional stroke. Late releases after interruption cannot commit. Normal pointer-up releases capture
without rolling back the committed stroke. A new touch sequence works immediately.

## Automated validation

- `npm run test:touch-gestures`: executes the actual session, camera math and
  extracted production ThreeGame event handlers using real Three.js/OrbitControls
  and substituted renderer/world services. Covers finger-count transitions,
  stroke cancellation/commit, capture loss, background/resume, UI ownership,
  God targeting, Battle, zoom limits, and desktop mouse/wheel behavior. `test:unified-gameplay` also executes real
  SaveSystem serialization to verify provisional elevations cannot leak to saves.
- `npm run test:touch-gestures-ui`: Playwright + Chromium CDP native touch events
  exercise the packaged browser game in a 915×412 Android-style landscape viewport.
  Tests drag→pinch, cancellation/rollback, return-to-origin suppression, zoom bounds
  and UI exclusion. These are emulation, not physical Android validation.
- Both are included in Android Landscape QA. The fast executable suite also runs
  in build and test:ci. CI publishes traces and result JSON under its SHA artifact.
- `?touchQA` enables a read-only diagnostic snapshot for browser assertions; it
  preserves normal release camera bounds. It is absent without that query flag.

## Required physical Android acceptance record

Do not close #112 solely because browser/Node tests pass. Run the installed Android
build on a real multi-touch device and record the build SHA/versionCode, device,
Android version, System WebView version, navigation mode and viewport. Use at least
one narrow landscape phone and repeat on a tablet/larger device where available.

### Device evidence helper

The installed build can prepare the issue comment so device metadata is not copied
by hand. Enable **Settings → Graphics → Debug mode**, then open
**Settings → Data → Copy touch QA report**. Paste the generated Markdown into #112.
It includes the source build SHA injected by CI, app version, Android versionCode
and versionName, viewport/screen/DPR, max touch points, orientation, raw user agent,
and detected Android/WebView Chromium versions. Fill the device model and Android
navigation mode on the physical device, then mark each scenario only after testing it.

If the Clipboard API is unavailable in the Android WebView, the game uses a local
textarea copy fallback. This helper records evidence only; it does not turn browser
emulation into physical-device acceptance.

| Scenario | Result / device evidence |
| --- | --- |
| Rapid tap→pan, return to origin, fresh tap afterward | Pending physical device validation |
| Two-finger pan/pinch, minimum/maximum zoom | Pending physical device validation |
| 1→2→1, 2→3→2, repeated second-finger additions/removals | Pending physical device validation |
| Wall/road/mountain drag→pinch; no placement/resources spent | Pending physical device validation |
| Terrain stroke→pinch/cancel; elevation restored, Undo unchanged | Pending physical device validation |
| Long-press→pan/pinch; no premature removal | Pending physical device validation |
| Pinch near UI, UI-first touch, open panel mid-stroke | Pending physical device validation |
| Home/resume, lock/unlock, incoming interruption mid-gesture | Pending physical device validation |
| God targeting and active/paused Battle navigation | Pending physical device validation |
| Repeated gestures during a long session; no stuck preview/drag | Pending physical device validation |

Attach results and failures to #112. Use Undo to check a completed terrain stroke
has exactly one entry. Cancelled strokes must have none. Verify fresh gestures work
after every cancellation, and compare desktop mouse/wheel controls before release.
