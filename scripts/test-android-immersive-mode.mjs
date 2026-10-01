import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [activity, bridge, main] = await Promise.all([
  readFile(new URL('../android/app/src/main/java/com/castlerole/game/MainActivity.java', import.meta.url), 'utf8'),
  readFile(new URL('../src/android/androidImmersiveMode.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/main.ts', import.meta.url), 'utf8'),
]);

assert.match(activity, /BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE/, 'Android 11+ must allow transient system bars by swipe');
assert.match(activity, /WindowInsets\.Type\.systemBars\(\)/, 'Android 11+ must hide both status and navigation bars');
assert.match(activity, /SYSTEM_UI_FLAG_IMMERSIVE_STICKY/, 'Android 7-10 must use immersive sticky mode');
assert.match(activity, /onResume\(\)/, 'Immersive mode must recover after resume');
assert.match(activity, /onWindowFocusChanged/, 'Immersive mode must recover after focus changes');
assert.match(activity, /onConfigurationChanged/, 'Immersive mode must recover after window/orientation changes');

assert.match(bridge, /Capacitor\.isNativePlatform\(\)/, 'Web bridge must be native-only');
assert.match(bridge, /Capacitor\.getPlatform\(\) === 'android'/, 'Web bridge must be Android-only');
assert.match(bridge, /visualViewport/, 'Visual viewport transitions must be observed');
assert.match(bridge, /appStateChange/, 'Capacitor app lifecycle must trigger viewport recovery');
assert.match(bridge, /visibilitychange/, 'Document resume visibility must trigger viewport recovery');
assert.match(bridge, /ANDROID_VIEWPORT_CHANGE_EVENT/, 'Viewport changes must expose a reusable integration event');
assert.match(bridge, /new Event\('resize'\)/, 'Existing resize listeners must be refreshed when viewport metrics change');

assert.match(main, /installAndroidImmersiveViewportBridge/, 'Android immersive viewport bridge must be installed during bootstrap');

console.log('Android immersive/fullscreen contract passed.');
