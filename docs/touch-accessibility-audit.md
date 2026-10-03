# Touch accessibility audit — Issue #113

Audit baseline: `main` at `aea2fe9160098bb2c4068255cefdad1b04bd75b4` (2026-10-03), after the unified Build flow from PR #233 and later 3D-only changes.

The original Issue #113 review targeted an older `main`. This audit re-checks the current UI and avoids restoring obsolete mode-specific behavior.

## Templates

- Previous gap: `syncTemplateAvailability()` stored authored-layout information only in `button.title`.
- Touch alternative now: every template card receives visible `.template-layout-info` text and an `aria-describedby` relationship. Desktop `title` remains only as an enhancement.
- The layout message is localized through `t()`. Persian labels were added for Classic Island, Mainland Coast, Peninsula, Twin Isles, and Three Isles 100×100.
- Template information stays inline in the modal, so it dismisses with the modal and remains inside the modal safe-area container.

## Build and context details

- Build tools already render their description in `.tool-copy small`; the `title` attribute duplicates this copy rather than being its only source.
- Compact CSS previously hid `.tool-copy small` and exposed it only after selection/focus. In `html.mobile-ui-active`, descriptions are now always visible, wrap normally, and can expand the scrollable Build panel.
- `.settings-hint` is now always visible in touch UI rather than depending on `:hover` / `:focus-within`.
- Building selection/context actions (Upgrade, Move, Rotate, Demolish and Deselect) are explicit buttons. Upgrade cards keep descriptive text adjacent to their buttons, including disabled/max-level states.

## Battle

- Battle controls are ordinary tap targets with visible labels.
- Setup guidance is visible in `.battle-hint`; unit fields use visible labels and stepper buttons.
- Battle status, alive counts, capture state, speed and result text are visible in the panel; no battle action requires hover.
- Disabled/hidden military progression is explained by surrounding progression copy and missile hints rather than a title tooltip.

## Minimap

- The minimap is a button and supports tap/click camera movement.
- The visible `Tap to move camera` hint is no longer hidden in touch UI, so the action is discoverable without hover or keyboard input.
- The minimap remains positioned using mobile safe-area variables.

## Settings

- Settings controls use visible labels/copy and mobile touch target sizing.
- The optional Data & Privacy failure path previously changed only `button.title`. It now replaces the button's visible `small` description with a localized unavailable reason.
- Settings modal layout and scrolling already use the safe-area-aware mobile container.

## God Mode

- God Mode action buttons contain visible `strong` labels and `small` descriptions.
- Disabled Flood/Earthquake controls visibly say `Coming soon`; their reason is not title-only.
- Missile target instructions, target feedback, capacity, Cancel and Fire controls are visible and touch-operable.
- Closing God Mode hides the panel and clears target marker/state.

## Hover / pointer audit

Important hover/pointer paths reviewed in the current runtime:

- CSS `:hover` rules for standard buttons, Build tabs/tools, template cards, upgrade buttons, Settings buttons, minimap, Help, save/load cards and selection actions are visual enhancements. The underlying actions remain visible tap/click controls.
- The compact Build exception was `.settings-hint` (hover/focus disclosure); touch mode now keeps it visible.
- The compact Build tool-description exception was `.tool-copy small`; touch mode now keeps it visible and wrapping.
- `pointerleave` in `ThreeGame.ts` clears relocation/build preview state. It does not expose a hidden action or information path.
- Remaining static `title` attributes (Undo, Screenshot and camera view controls) duplicate an `aria-label` or visible button text. Camera view controls are hidden in the mobile touch layout.
- The template layout `title` is retained only as desktop enhancement; the same information is now visible inline.
- The Settings privacy fallback no longer uses a title-only disabled-state explanation.

## Persian / RTL

- Touch-visible template layout metadata is localized at runtime.
- Missing map-layout labels used by that message were added to the Persian template dictionary.
- Existing RTL rules for template cards, Build copy, Settings and mobile panels continue to apply.

## Safe-area and dismissal behavior

- Template details live inside the template modal, Build details inside the scrollable toolbar, Settings reasons inside the Settings modal, and God/Battle details inside their panels.
- These details disappear naturally when their owning panel closes; no detached tooltip/overlay is introduced.
- Existing `--mobile-safe-*` positioning remains authoritative, so this change adds no floating controls outside safe areas or over adjacent actions.

## Regression coverage

Automated contract: `npm run test:touch-accessible-hints`.

The contract checks visible template metadata, mobile Build descriptions, Settings/minimap hints, localized disabled-state copy, Persian map labels, and visible Battle/God explanations.

### Physical touch-only release check still required

A real Android/WebView run is required before Issue #113 can be closed. Record device model, Android/WebView version, orientation, and results for:

1. Open Templates with touch only and confirm every card shows its layout line in English and Persian.
2. On a narrow landscape phone, open Build and confirm every tool description can be read without hover/keyboard.
3. Select buildings at different upgrade states and verify upgrade/context explanations remain visible and buttons are reachable.
4. Open Battle, Minimap, Settings and God Mode using touch only; verify disabled states/instructions are visible.
5. Close each panel and confirm its details disappear, stay within safe areas, and never cover adjacent controls.
6. Sanity-check desktop mouse hover and keyboard focus after the touch pass.

Do not mark these physical checks as passed unless they were run on an actual touch device.
