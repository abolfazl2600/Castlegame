import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

const html = read('index.html');
const game = read('src/ThreeGame.ts');
const mobile = read('src/ui/MobileUI.ts');
const capture = read('src/capture/ScreenshotCapture.ts');
const css = read('src/style.css');
const mainActivity = read('android/app/src/main/java/com/castlerole/game/MainActivity.java');
const nativePlugin = read('android/app/src/main/java/com/castlerole/game/GameScreenshotPlugin.java');
const manifest = read('android/app/src/main/AndroidManifest.xml');
const docs = read('docs/screenshot-capture.md');

assert.match(
  html,
  /id="screenshot-button"[\s\S]*?aria-label="Take screenshot"[\s\S]*?Take screenshot \(F9\)/,
  'Desktop HUD must expose a discoverable screenshot button.',
);
assert.match(html, /id="screenshot-feedback"[\s\S]*?aria-live="polite"/);
assert.match(
  mobile,
  /data-mobile-proxy="screenshot-button"[\s\S]*?class="mobile-action"/,
  'Mobile header must proxy the same screenshot action.',
);

assert.match(capture, /renderer\.render\(scene, camera\);/,
  'Capture must render the current scene with the existing renderer/camera.');
assert.match(capture, /const canvas = renderer\.domElement;/,
  'Capture must use the actual renderer canvas.');
assert.match(capture, /canvas\.toBlob\([\s\S]*?'image\/png'/,
  'Capture must encode a PNG.');
assert.doesNotMatch(capture, /new THREE\.WebGLRenderer/,
  'Screenshot capture must not create a second WebGL renderer.');
assert.match(capture, /width: canvas\.width/);
assert.match(capture, /height: canvas\.height/);
assert.match(capture, /castle-role[\s\S]*?\.png/,
  'Screenshot filenames must be timestamped PNG names.');
assert.match(capture, /Capacitor\.getPlatform\(\) === 'android'/);
assert.match(capture, /AndroidScreenshot\.shareImage\(\{ data, filename \}\)/);
assert.match(capture, /URL\.createObjectURL\(blob\)/);
assert.match(capture, /link\.download = filename/);

const captureMethod = game.match(/private async captureScreenshot\(\): Promise<void> \{[\s\S]*?\n  \}\n\n  private resize\(\): void \{/ )?.[0] ?? '';
assert.ok(captureMethod, 'ThreeGame captureScreenshot method must exist.');
assert.match(captureMethod, /captureGameScreenshot\(this\.renderer, this\.scene, this\.camera\)/);
assert.doesNotMatch(captureMethod, /this\.save\(|scheduleSave|recordHistory|updateCell|setCell/,
  'Screenshot capture must not mutate gameplay or save state.');
assert.match(game, /get<HTMLButtonElement>\('screenshot-button'\)\.onclick/);
assert.match(game, /if \(key === 'f9'\)/);
assert.doesNotMatch(
  game,
  /new THREE\.WebGLRenderer\(\{[^}]*preserveDrawingBuffer:\s*true/,
  'Screenshot support must not impose persistent preserveDrawingBuffer overhead.',
);

assert.match(css, /\.screenshot-feedback/);
assert.match(css, /screenshot-capture-flash/);
assert.match(css, /top: calc\(var\(--mobile-safe-top\) \+ var\(--mobile-header-height\) \+ 8px\)/);

assert.match(mainActivity, /registerPlugin\(GameScreenshotPlugin\.class\)/);
assert.match(nativePlugin, /@CapacitorPlugin\(name = "GameScreenshot"\)/);
assert.match(nativePlugin, /Intent\.ACTION_SEND/);
assert.match(nativePlugin, /FileProvider\.getUriForFile/);
assert.match(nativePlugin, /FLAG_GRANT_READ_URI_PERMISSION/);
assert.match(nativePlugin, /MAX_PNG_BYTES = 32L \* 1024L \* 1024L/);
assert.match(nativePlugin, /0x89, 0x50, 0x4E, 0x47/,
  'Android bridge must reject non-PNG payloads.');
assert.doesNotMatch(manifest, /WRITE_EXTERNAL_STORAGE|READ_MEDIA_IMAGES/,
  'Screenshot sharing must not add gallery/storage permissions.');

assert.match(docs, /actual Three\.js renderer canvas/i);
assert.match(docs, /DOM HUD is not part of the captured PNG/i);
assert.match(docs, /Android Sharesheet/i);
assert.match(docs, /does not modify save-game state/i);

console.log('Screenshot/photo-mode capture contract passed.');
