import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');

const main = read('src/main.ts');
const controller = read('src/ui/SafeAreaController.ts');
const styles = read('src/style.css');
const index = read('index.html');
const activity = read('android/app/src/main/java/com/castlerole/game/MainActivity.java');
const plugin = read('android/app/src/main/java/com/castlerole/game/SafeAreaPlugin.java');
const theme = read('android/app/src/main/res/values/styles.xml');

const checks = [
  ['viewport-fit=cover is enabled', index.includes('viewport-fit=cover')],
  ['SafeAreaController is installed', main.includes('new SafeAreaController()')],
  ['shared top token exists', styles.includes('--safe-area-top:')],
  ['shared right token exists', styles.includes('--safe-area-right:')],
  ['shared bottom token exists', styles.includes('--safe-area-bottom:')],
  ['shared left token exists', styles.includes('--safe-area-left:')],
  ['mobile safe area aliases shared tokens', styles.includes('--mobile-safe-top: var(--safe-area-top)')],
  ['orientation changes trigger recalculation', controller.includes('orientationchange')],
  ['fullscreen changes trigger recalculation', controller.includes('fullscreenchange')],
  ['resume/visibility triggers native refresh', controller.includes('visibilitychange') && controller.includes('refreshNativeInsets')],
  ['visual viewport changes trigger recalculation', controller.includes('visualViewport') && controller.includes("addEventListener('resize'")],
  ['native plugin is registered', activity.includes('registerPlugin(SafeAreaPlugin.class)')],
  ['native system bars are included', plugin.includes('WindowInsetsCompat.Type.systemBars()')],
  ['native display cutouts are included', plugin.includes('WindowInsetsCompat.Type.displayCutout()')],
  ['native gesture zones are included', plugin.includes('WindowInsetsCompat.Type.systemGestures()') && plugin.includes('WindowInsetsCompat.Type.mandatorySystemGestures()')],
  ['Android content draws edge-to-edge', activity.includes('WindowCompat.setDecorFitsSystemWindows(getWindow(), false)')],
  ['display cutouts are allowed on short edges', theme.includes('windowLayoutInDisplayCutoutMode')],
];

const failures = checks.filter((entry) => !entry[1]);
for (const [label, ok] of checks) {
  console.log((ok ? 'PASS ' : 'FAIL ') + label);
}

if (failures.length > 0) {
  process.exitCode = 1;
}
