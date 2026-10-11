import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { MAX_ANDROID_VERSION_CODE, validateReleaseVersionCode } from './android/validate-release-version-code.mjs';

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

for (const path of [
  '.github/workflows/android-signed-aab.yml',
  '.github/workflows/android-marketplace-apk.yml',
]) {
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
console.log('Android release versionCode input and workflow validation: ok');
