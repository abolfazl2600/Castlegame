import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  listApks, parseApkBadging, verifyUniversalMarketplaceApk,
} from './android/verify-marketplace-single-apk.mjs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const sampleBadge = "package: name='com.castlerole.game' versionCode='500025000' versionName='1.0.250.1'\n";
const valid = parseApkBadging(sampleBadge);
assert.deepEqual(valid, {
  applicationId: 'com.castlerole.game', versionCode: '500025000',
  versionName: '1.0.250.1', splitName: undefined,
});
assert.throws(() => parseApkBadging('nothing to parse'), /metadata/);
const goodFile = '/tmp/app-release.apk';
const check = (badging, files = [goodFile]) =>
  verifyUniversalMarketplaceApk({ files, badging, versionCode: '500025000', versionName: '1.0.250.1' });
assert.equal(check(valid), goodFile);
for (const files of [[], [goodFile, '/tmp/app-arm64.apk'], ['/tmp/app-arm64.apk']]) {
  assert.throws(() => check(valid, files), /exactly one universal/);
}
assert.throws(() => check({ ...valid, applicationId: 'org.other.game' }), /application ID/);
assert.throws(() => check({ ...valid, versionCode: '42' }), /version does not match/);
assert.throws(() => check({ ...valid, versionName: '1.0' }), /version does not match/);
assert.throws(() => check(parseApkBadging(sampleBadge.trimEnd() + " split='config.arm64_v8a'\n")),
  /Split APK detected/);

const directory = mkdtempSync(join(tmpdir(), 'castle-bazaar-qa-'));
try {
  const output = join(directory, 'outputs', 'apk', 'release');
  const sdk = join(directory, 'sdk');
  const toolDir = join(sdk, 'build-tools', '36.0.0');
  const runner = join(directory, 'runner');
  const envFile = join(directory, 'github-env');
  mkdirSync(output, { recursive: true });
  mkdirSync(toolDir, { recursive: true });
  mkdirSync(runner, { recursive: true });
  const apkFile = join(output, 'app-release.apk');
  const mockAapt = join(toolDir, 'aapt');
  writeFileSync(apkFile, 'mock APK bytes');
  writeFileSync(mockAapt, '#!/bin/sh\nprintf "package: name=\'com.castlerole.game\' versionCode=\'500025000\' versionName=\'1.0.250.1\'\\n"\n');
  chmodSync(mockAapt, 0o755);
  assert.deepEqual(listApks(output), [apkFile]);

  const script = fileURLToPath(new URL('./android/verify-marketplace-single-apk.mjs', import.meta.url));
  const env = {
    ...process.env, ANDROID_HOME: sdk, RUNNER_TEMP: runner,
    GITHUB_ENV: envFile, ANDROID_VERSION_CODE: '500025000',
    ANDROID_VERSION_NAME: '1.0.250.1',
  };
  const run = () => spawnSync(process.execPath, [script, output], { encoding: 'utf8', env });
  const ok = run();
  assert.equal(ok.status, 0, ok.stderr);
  const stagedFile = readFileSync(envFile, 'utf8').match(/^MARKETPLACE_APK_PATH=(.+)$/m)?.[1];
  assert.ok(stagedFile);
  assert.equal(basename(stagedFile), 'castle-role-bazaar-myket-v1.0.250.1-code500025000.apk');
  assert.equal(readFileSync(stagedFile, 'utf8'), 'mock APK bytes');

  // Simulate an ABI split accidentally introduced by a Gradle plugin.
  const duplicate = join(output, 'app-arm64-v8a-release.apk');
  writeFileSync(duplicate, 'split APK bytes');
  assert.equal(listApks(output).length, 2);
  const rejected = run();
  assert.notEqual(rejected.status, 0, 'Multiple APKs must fail before artifact upload');
  assert.match(rejected.stderr, /exactly one universal/);
  rmSync(duplicate);
  const wrongVersion = spawnSync(process.execPath, [script, output], {
    encoding: 'utf8', env: { ...env, ANDROID_VERSION_CODE: '500025001' },
  });
  assert.notEqual(wrongVersion.status, 0);
  assert.match(wrongVersion.stderr, /version does not match/);
} finally {
  rmSync(directory, { recursive: true, force: true });
}

const workflow = read('.github/workflows/android-marketplace-apk.yml');
assert.match(workflow, /node scripts\/android\/verify-marketplace-single-apk\.mjs android\/app\/build\/outputs\/apk\/release/);
assert.match(workflow, /path: \$\{\{ env\.MARKETPLACE_APK_PATH \}\}/,
  'Only the verified APK should reach release artifacts');
assert.doesNotMatch(workflow, /path: android\/app\/build\/outputs\/apk\/release\/\*\.apk/);
const gradle = read('android/app/build.gradle');
assert.match(gradle, /splits\s*\{\s*abi\s*\{\s*enable false\s*\}\s*density\s*\{\s*enable false\s*\}/,
  'Device-specific APK splits must remain disabled');
console.log('Bazaar single universal APK verification and packaging contract: ok');
