import assert from 'node:assert/strict';
import { appendFileSync, copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Only one universal release APK is supported per Bazaar/Myket upload.
 * ABI/density splits require mutually exclusive store targeting, which this
 * app does not configure. Reject extras instead of uploading overlapping APKs.
 */
export function listApks(directory) {
  if (!existsSync(directory)) throw new Error('APK release output directory is missing: ' + directory);
  const files = [];
  const visit = (path) => {
    for (const item of readdirSync(path, { withFileTypes: true })) {
      const filename = join(path, item.name);
      if (item.isDirectory()) visit(filename);
      else if (item.isFile() && item.name.endsWith('.apk')) files.push(filename);
    }
  };
  visit(directory);
  return files.sort();
}

export function parseApkBadging(output) {
  const packageLine = output.split(/\r?\n/).find(line => line.startsWith('package: '));
  if (!packageLine) throw new Error('aapt did not return APK package metadata');
  const attribute = (name) => packageLine.match(new RegExp("(?:^|\\s)" + name + "='([^']*)'"))?.[1];
  return {
    applicationId: attribute('name'),
    versionCode: attribute('versionCode'),
    versionName: attribute('versionName'),
    splitName: attribute('split'),
  };
}

export function verifyUniversalMarketplaceApk({ files, badging, versionCode, versionName }) {
  if (files.length !== 1 || basename(files[0] ?? '') !== 'app-release.apk') {
    throw new Error(
      'Bazaar/Myket requires exactly one universal app-release.apk. ' +
      'Found: ' + (files.map(path => basename(path)).join(', ') || '(none)') +
      '. Do not upload split/duplicate APK configurations to a single release.'
    );
  }
  if (badging.applicationId !== 'com.castlerole.game') {
    throw new Error('Unexpected Android application ID: ' + badging.applicationId);
  }
  if (badging.splitName) {
    throw new Error('Split APK detected (' + badging.splitName + '). Only one universal APK can be uploaded.');
  }
  if (badging.versionCode !== versionCode || badging.versionName !== versionName) {
    throw new Error(
      'Signed APK version does not match the generated values: ' +
      JSON.stringify({ expectedCode: versionCode, actualCode: badging.versionCode,
        expectedName: versionName, actualName: badging.versionName })
    );
  }
  return files[0];
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const directory = process.argv[2];
    const versionCode = process.env.ANDROID_VERSION_CODE;
    const versionName = process.env.ANDROID_VERSION_NAME;
    const androidHome = process.env.ANDROID_HOME;
    const runnerTemp = process.env.RUNNER_TEMP;
    const githubEnv = process.env.GITHUB_ENV;
    if (!directory || !versionCode || !versionName || !androidHome || !runnerTemp || !githubEnv) {
      throw new Error('Release output directory, Android SDK, generated versions and GitHub Actions environment are required.');
    }
    if (!/^[1-9]\d*$/.test(versionCode) || !/^\d+(?:\.\d+){2,3}$/.test(versionName)) {
      throw new Error('Invalid generated APK version code or name.');
    }
    const aapt = join(androidHome, 'build-tools', '36.0.0', 'aapt');
    const files = listApks(directory);
    if (files.length !== 1 || basename(files[0] ?? '') !== 'app-release.apk') {
      verifyUniversalMarketplaceApk({ files, badging: {}, versionCode, versionName });
    }
    const apk = files[0];
    const packageMetadata = execFileSync(aapt, ['dump', 'badging', apk], { encoding: 'utf8' });
    const badging = parseApkBadging(packageMetadata);
    verifyUniversalMarketplaceApk({ files, badging, versionCode, versionName });
    if (statSync(apk).size === 0) throw new Error('Signed release APK is empty.');

    // Stage exactly one APK: the GitHub artifact can never include stale or
    // architecture-specific APKs from earlier or unrelated Gradle outputs.
    const stage = join(runnerTemp, 'castle-role-marketplace-release');
    mkdirSync(stage, { recursive: true });
    const stagedApk = join(stage, `castle-role-bazaar-myket-v${versionName}-code${versionCode}.apk`);
    copyFileSync(apk, stagedApk);
    appendFileSync(githubEnv, `MARKETPLACE_APK_PATH=${stagedApk}\n`, 'utf8');
    console.log(`Verified single universal APK: ${badging.applicationId} · ${versionName} (code ${versionCode})`);
    console.log('Exactly one APK has been staged for Bazaar/Myket distribution.');
  } catch (error) {
    console.error('::error::' + (error instanceof Error ? error.message : String(error)));
    process.exitCode = 1;
  }
}
