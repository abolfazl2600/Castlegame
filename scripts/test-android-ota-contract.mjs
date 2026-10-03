import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

const packageJson = JSON.parse(read('package.json'));
const workflow = read('.github/workflows/deploy.yml');
const nativeUpdater = read('android/app/src/main/java/com/castlerole/game/GameUpdaterPlugin.java');
const updateUi = read('src/settings/AndroidUpdateUI.ts');
const docs = read('docs/android-ota-updates.md');
const manifestGenerator = read('scripts/create-android-update-manifest.mjs');

assert.match(
  packageJson.scripts['build:android-update'],
  /(?:^|&&\s*)tsc --noEmit && vite build --base=\.\/ --outDir dist-android-update --emptyOutDir$/,
  'Android OTA must keep its dedicated relative-base build command, while allowing pre-build validation.',
);
assert.match(
  packageJson.scripts['build:android-update'],
  /npm run test:3d-only-renderer/,
  'Android OTA builds must enforce the 3D-only renderer contract before packaging.',
);
assert.match(workflow, /npm run build:android-update/);
assert.match(workflow, /dist-android-update\/index\.html/);
assert.match(workflow, /\/Castlegame\/assets\//);
assert.match(workflow, /grep -q '\.\/assets\/'/);
assert.match(workflow, /dist\/android-updates\/android-update\.json/);
assert.match(workflow, /castlegame-web-update-\$\{GITHUB_SHA\}\.zip/);
assert.match(workflow, /github\.ref == 'refs\/heads\/main'/);
assert.doesNotMatch(
  workflow,
  /actions\/upload-artifact@[\s\S]*castlegame-web-update/,
  'Android OTA must be published through Pages, not Actions artifact storage.',
);

assert.match(manifestGenerator, /buildId/);
assert.match(manifestGenerator, /sha256/);
assert.match(manifestGenerator, /https:\/\//);

assert.doesNotMatch(nativeUpdater, /api\.github\.com/);
assert.doesNotMatch(nativeUpdater, /actions\/artifacts/);
assert.doesNotMatch(nativeUpdater, /archive_download_url/);
assert.match(
  nativeUpdater,
  /https:\/\/abolfazl2600\.github\.io\/Castlegame\/android-updates\/android-update\.json/,
);
assert.match(nativeUpdater, /manifest\.sha256\.equalsIgnoreCase\(actualDigest\)/);
assert.match(nativeUpdater, /Downloaded update failed SHA-256 verification/);
assert.match(nativeUpdater, /safeResolve\(targetDir, entry\.getName\(\)\)/);
assert.match(nativeUpdater, /MAX_ARTIFACT_BYTES = 100L \* 1024L \* 1024L/);
assert.match(nativeUpdater, /MAX_EXTRACTED_BYTES = 250L \* 1024L \* 1024L/);
assert.match(nativeUpdater, /\.staging-/);
assert.match(nativeUpdater, /stagingDir\.renameTo\(targetDir\)/);
assert.match(nativeUpdater, /validateBundle\(stagingDir\)/);
assert.match(nativeUpdater, /setServerBasePath\(bundleRoot\.getAbsolutePath\(\)\)/);
assert.match(nativeUpdater, /putString\("installedBuild", buildId\)/);
assert.match(nativeUpdater, /putString\("previousBuild"/);
assert.match(nativeUpdater, /cleanupOldUpdates/);
assert.match(nativeUpdater, /"https"\.equalsIgnoreCase/);
assert.doesNotMatch(nativeUpdater, /Authorization|Bearer|github_pat|ghp_/i);

assert.match(updateUi, /case 'NETWORK'/);
assert.match(updateUi, /case 'INTEGRITY'/);
assert.match(updateUi, /case 'PACKAGE'/);
assert.match(updateUi, /case 'MANIFEST'/);
assert.match(updateUi, /بازی شما به‌روز است/);
assert.match(updateUi, /window\.location\.reload\(\)/);
assert.match(updateUi, /console\.error\('Android game update failed'/);

assert.match(docs, /web-layer only/i);
assert.match(docs, /Java\/Kotlin/);
assert.match(docs, /APK\/AAB/);
assert.match(docs, /SHA-256/);
assert.match(docs, /previous valid OTA bundle/i);

const artifactDirValue = process.env.ANDROID_OTA_ARTIFACT_DIR;
if (artifactDirValue) {
  const artifactDir = resolve(artifactDirValue);
  const manifestPath = join(artifactDir, 'android-update.json');
  assert.ok(existsSync(manifestPath), 'android-update.json must exist in the published OTA directory.');

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  assert.equal(manifest.version, 1);
  assert.ok(typeof manifest.buildId === 'string' && manifest.buildId.length >= 7, 'Manifest buildId is required.');
  assert.ok(typeof manifest.url === 'string' && manifest.url.startsWith('https://'), 'Manifest URL must use HTTPS.');
  assert.match(manifest.sha256, /^[0-9a-f]{64}$/, 'Manifest sha256 must be a lowercase SHA-256 digest.');

  const zipPath = join(artifactDir, basename(new URL(manifest.url).pathname));
  assert.ok(existsSync(zipPath), 'The ZIP named by the manifest URL must exist.');

  const actualDigest = createHash('sha256').update(readFileSync(zipPath)).digest('hex');
  assert.equal(actualDigest, manifest.sha256, 'Published ZIP SHA-256 must match android-update.json.');

  const listing = execFileSync('unzip', ['-Z1', zipPath], { encoding: 'utf8' })
    .split(/\r?\n/)
    .filter(Boolean);
  assert.ok(listing.includes('index.html'), 'Android OTA ZIP must contain root index.html.');

  const indexHtml = execFileSync('unzip', ['-p', zipPath, 'index.html'], { encoding: 'utf8' });
  assert.doesNotMatch(indexHtml, /\/Castlegame\/assets\//, 'OTA index.html must not contain GitHub Pages asset paths.');
  assert.match(indexHtml, /\.\/assets\//, 'OTA index.html must contain relative asset paths.');
}

console.log(
  artifactDirValue
    ? 'Android OTA source, manifest, digest, ZIP, and asset-path contracts passed.'
    : 'Android OTA source contracts passed (artifact checks run during Pages deployment).',
);
