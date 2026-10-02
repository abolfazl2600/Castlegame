# Screenshot / Photo Capture

Castle Role provides a built-in camera action on both desktop and mobile HUDs.

## Capture behavior

The screenshot action captures the **actual Three.js renderer canvas** using the current scene and camera. It does not reconstruct the world with a second renderer. Before encoding, the existing renderer draws the current scene once with the current camera, so the image reflects the active camera position, zoom, rotation, lighting, terrain, buildings, citizens, battle units, effects, and current view mode.

The DOM HUD is not part of the captured PNG because HUD controls are layered above the WebGL canvas. This gives every capture a clean scene-only result without hiding or rebuilding gameplay UI.

The capture uses the renderer canvas's real backing dimensions, so device-pixel-ratio sizing already applied by Three.js is preserved. PNG encoding is requested only when the player captures an image; the normal renderer does not enable `preserveDrawingBuffer` and no second WebGL renderer or persistent screenshot framebuffer is created.

Screenshot capture does not modify save-game state, construction history, world state, or camera state.

## Desktop / web

On web and desktop browsers:

1. press the camera button in the main HUD, or use **F9**;
2. the current renderer canvas is encoded as `image/png`;
3. a timestamped file such as `castle-role-20261002-183501.png` is downloaded through the browser;
4. a short capture flash and status message confirm success.

## Mobile / Android

The mobile header contains the same camera action with a 44 px touch target and existing safe-area behavior.

In the Capacitor Android app, the web layer converts the captured PNG blob to a temporary Base64 payload and calls the native `GameScreenshot` plugin. The native bridge:

- rejects missing, oversized, or non-PNG data;
- writes only to the app cache;
- exposes the temporary PNG through the existing `FileProvider`;
- opens the Android Sharesheet with `Intent.ACTION_SEND` and read-only URI permission.

No gallery/storage permission is added. The player can choose a compatible Android destination from the system share flow. The cache file is not part of game save data.

## Performance

Normal gameplay does not pay a persistent screenshot cost. PNG allocation and Base64 conversion happen only during a user-triggered capture. Android payload size is capped at 32 MiB. The screenshot button is temporarily disabled while a capture is in progress to prevent overlapping allocations.

## Native compatibility

The browser capture service is isolated in `src/capture/ScreenshotCapture.ts`; Android sharing is isolated in `GameScreenshotPlugin.java`. Future native gallery-save behavior can be added behind the same bridge without changing rendering or gameplay state.
