import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { MAX_ANDROID_VERSION_CODE, validateReleaseVersionCode } from './android/validate-release-version-code.mjs';
import { DEFAULT_MARKETPLACE_VERSION_CODE_BASE, MARKETPLACE_RUN_ATTEMPT_SLOTS, generateMarketplaceReleaseVersion } from './android/generate-marketplace-version.mjs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const script = fileURLToPath(new URL('./android/validate-release-version-code.mjs', import.meta.url));

for (const input of ['1', '2042', '250000001', String(MAX_ANDROID_VERSION_CODE)]) {
  assert.equal(validateReleaseVersionCode(input), Number(input));
}
for (const invalid of ['', '0', '-1', '1.0', '001', 'abc', '250_000_001',
  String(MAX_ANDROID_VERSION_CODE + 1), '9007199254740992', undefined, null]) {
  assert.throws(() => validateReleaseVersionCode(invalid), Error, 'Invalid version code must be rejected');
}

const temporary = mkdtempSync(join(tmpdir(), 'castle-release-version-'));
try {
  const envFile = join(temporary, 'github-env');
  const env = { ...process.env, GITHUB_ENV: envFile };
  execFileSync(process.execPath, [script, '250000001'], { env, stdio: 'pipe' });
  assert.equal(readFileSync(envFile, 'utf8'), 'ANDROID_VERSION_CODE=250000001\n');

  const invalid = spawnSync(process.execPath, [script, '0'], { env, encoding: 'utf8' });
  assert.notEqual(invalid.status, 0, 'Invalid release code must fail the workflow step');
  assert.equal(readFileSync(envFile, 'utf8'), 'ANDROID_VERSION_CODE=250000001\n',
    'Invalid code must not modify GitHub Actions environment');
} finally {
  rmSync(temporary, { recursive: true, force: true });
}

// Google Play still asks for a manually verified code; Bazaar/Myket do not.
for (const path of ['.github/workflows/android-signed-aab.yml']) {
  const content = read(path);
  const dispatch = content.slice(content.indexOf('on:'), content.indexOf('\npermissions:'));
  assert.match(dispatch, /workflow_dispatch:\s*\n\s+inputs:\s*\n\s+version_code:/,
    path + ' must request an explicit version code');
  assert.match(dispatch, /version_code:[\s\S]*?required: true/,
    path + ' must reject omitted version code');
  assert.doesNotMatch(dispatch, /default:/,
    path + ' must not prepopulate a value that may already be used');
  assert.match(content, /REQUESTED_VERSION_CODE: \$\{\{ inputs\.version_code \}\}/);
  assert.match(content, /node scripts\/android\/validate-release-version-code\.mjs "\$REQUESTED_VERSION_CODE"/);
  assert.match(content, /-PandroidVersionCode="\$ANDROID_VERSION_CODE"/);
  assert.doesNotMatch(content, /EPOCH_2020|date \+%s/,
    'Signed release must not derive versionCode from a timestamp');
}


const marketplaceWorkflow = read('.github/workflows/android-marketplace-apk.yml');
const marketplaceTrigger = marketplaceWorkflow.slice(
  marketplaceWorkflow.indexOf('on:'), marketplaceWorkflow.indexOf('\npermissions:'),
);
assert.match(marketplaceTrigger, /workflow_dispatch:/, 'Bazaar/Myket release remains owner-triggered');
assert.doesNotMatch(marketplaceTrigger, /version_code:|inputs:|(?:push|schedule|pull_request):/,
  'APK output must not require manual versions or run on commits automatically');
assert.match(marketplaceWorkflow, /generate-marketplace-version\.mjs/);
assert.match(marketplaceWorkflow, /vars\.ANDROID_MARKETPLACE_VERSION_CODE_BASE/);
assert.match(marketplaceWorkflow, /-PandroidVersionCode="\$ANDROID_VERSION_CODE"/);
assert.match(marketplaceWorkflow, /-PandroidVersionName="\$ANDROID_VERSION_NAME"/);
assert.match(marketplaceWorkflow, /node scripts\/android\/verify-marketplace-single-apk\.mjs/,
  'The marketplace release must validate the packaged APK before uploading');
assert.match(read('scripts/android/verify-marketplace-single-apk.mjs'),
  /execFileSync\(aapt, \['dump', 'badging', apk\]/,
  'The APK validator must inspect actual package metadata with aapt');
assert.doesNotMatch(marketplaceWorkflow, /inputs\.version_code|REQUESTED_VERSION_CODE/,
  'No manual versionCode should be requested for APK releases');

const first = generateMarketplaceReleaseVersion({ runNumber: '200', runAttempt: '1' });
const retry = generateMarketplaceReleaseVersion({ runNumber: '200', runAttempt: '2' });
const maxRetry = generateMarketplaceReleaseVersion({ runNumber: '200', runAttempt: String(MARKETPLACE_RUN_ATTEMPT_SLOTS) });
const next = generateMarketplaceReleaseVersion({ runNumber: '201', runAttempt: '1' });
assert.equal(first.code, DEFAULT_MARKETPLACE_VERSION_CODE_BASE + 200 * MARKETPLACE_RUN_ATTEMPT_SLOTS);
assert.equal(first.name, '1.0.200.1');
assert.equal(retry.code, first.code + 1);
assert.equal(retry.name, '1.0.200.2');
assert.equal(next.code, maxRetry.code + 1, 'Each newer run must exceed all attempts on the previous run');
assert.equal(next.name, '1.0.201.1');
assert.equal(
  generateMarketplaceReleaseVersion({ runNumber: '200', runAttempt: '1', base: '700000000' }).code,
  700000000 + 200 * MARKETPLACE_RUN_ATTEMPT_SLOTS,
  'Store owners can raise the baseline above previously published version codes once',
);
for (const props of [
  { runNumber: '', runAttempt: '1' },
  { runNumber: '0', runAttempt: '1' },
  { runNumber: '1.5', runAttempt: '1' },
  { runNumber: '01', runAttempt: '1' },
  { runNumber: '1', runAttempt: '0' },
  { runNumber: '1', runAttempt: '101' },
  { runNumber: '1', runAttempt: '1', base: '-1' },
  { runNumber: '1', runAttempt: '1', base: '2100000000' },
  { runNumber: '9007199254740992', runAttempt: '1' },
]) assert.throws(() => generateMarketplaceReleaseVersion(props), Error, 'Unsafe automatic APK version must be rejected');

const releaseDir = mkdtempSync(join(tmpdir(), 'castle-marketplace-version-'));
try {
  const envFile = join(releaseDir, 'github-env');
  execFileSync(process.execPath, [fileURLToPath(new URL('./android/generate-marketplace-version.mjs', import.meta.url))], {
    env: {
      ...process.env,
      GITHUB_ENV: envFile,
      GITHUB_RUN_NUMBER: '250',
      GITHUB_RUN_ATTEMPT: '1',
      ANDROID_MARKETPLACE_VERSION_CODE_BASE: '',
    },
    stdio: 'pipe',
  });
  assert.equal(
    readFileSync(envFile, 'utf8'),
    'ANDROID_VERSION_CODE=500025000\\nANDROID_VERSION_NAME=1.0.250.1\\n'.replaceAll('\\n', '\n'),
    'GitHub Actions must receive both automatically generated APK version properties',
  );
} finally {
  rmSync(releaseDir, { recursive: true, force: true });
}
const gradleSource = read('android/app/build.gradle');
assert.match(gradleSource, /project\.findProperty\('androidVersionName'\)/);
assert.match(gradleSource, /versionName resolvedAndroidVersionName/,
  'Gradle must embed the workflow versionName instead of a fixed 1.0 label');

console.log('Android release versionCode input and workflow validation: ok');
