# Android Audio Lifecycle Integration

Issue #115 adds a web-side lifecycle bridge that keeps the browser build independent of any specific Android wrapper while still accepting native app and audio-focus signals.

## Web behavior

The audio engine automatically reacts to:

- `document.visibilitychange`
- `pagehide` / `pageshow`
- Page Lifecycle `freeze`
- wrapper-style `pause` / `resume` document events

Suspension is source-based and idempotent. If more than one lifecycle source is inactive, audio resumes only after every active blocker has recovered.

When suspended, the engine:

- pauses music without creating a second music instance
- stops procedural ambience
- clears active HTML SFX voices instead of leaving stale sounds queued
- stops scheduled procedural oscillators
- suspends the AudioContext
- rejects new SFX until the lifecycle is active again

## Android wrapper API

The page exposes:

```ts
window.CastleRoleAudioLifecycle?.setAppActive(false);
window.CastleRoleAudioLifecycle?.setAppActive(true);

window.CastleRoleAudioLifecycle?.setAudioFocus(false);
window.CastleRoleAudioLifecycle?.setAudioFocus(true);

window.CastleRoleAudioLifecycle?.setInterrupted(true);
window.CastleRoleAudioLifecycle?.setInterrupted(false);
```

A wrapper may also call `pause()` / `resume()` for app lifecycle changes.

The Android host should forward Activity/WebView lifecycle and audio-focus callbacks to this API. This keeps Google Play, Bazaar and Myket builds on the same web implementation.

## Event alternative

Wrappers that prefer event injection can dispatch:

```js
window.dispatchEvent(new CustomEvent('castle-role:android-lifecycle', {
  detail: { state: 'background' } // active | foreground | resumed | inactive | background | paused | interrupted
}));

window.dispatchEvent(new CustomEvent('castle-role:android-audio-focus', {
  detail: { hasFocus: false }
}));
```

## Persistent preferences

The shared SettingsStore remains on the stable `castle-role.settings.v2` key so normal application updates do not intentionally reset preferences. Audio persistence now includes:

- master volume
- music enabled
- music volume
- SFX enabled
- SFX volume
- mute all

Older stored settings that do not contain the two enabled flags inherit the safe default `true`.

## Device validation

Before closing the release gate, exercise at least 10 repeated cycles on a real Android build:

1. start audio
2. Home/background
3. resume
4. lock/unlock
5. app switch
6. toggle music and SFX
7. kill the process
8. reopen
9. confirm preferences
10. repeat during an active battle with frequent SFX

Also verify audio-focus loss/recovery using an incoming interruption or another app that requests audio focus.
