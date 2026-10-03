import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const workflow = read('.github/workflows/android-signed-aab.yml');
const gradle = read('android/app/build.gradle');
const verify = read('scripts/android/verify-signed-aab.sh');
const gitignore = read('.gitignore');

const uncommentedWorkflow = workflow
  .split('\n')
  .filter((line) => !line.trimStart().startsWith('#'))
  .join('\n');

const triggerStart = uncommentedWorkflow.indexOf('on:');
const permissionsStart = uncommentedWorkflow.indexOf('\npermissions:');
assert.ok(triggerStart >= 0 && permissionsStart > triggerStart, 'signed workflow trigger block is missing');
const triggerBlock = uncommentedWorkflow.slice(triggerStart, permissionsStart);
assert.match(triggerBlock, /workflow_dispatch:/, 'signed release must remain manually triggered');
assert.doesNotMatch(triggerBlock, /^\s*(push|pull_request|pull_request_target|schedule):/m,
  'signed release must not run from push, PR, pull_request_target, or schedule');

assert.match(uncommentedWorkflow, /^permissions:\s*\n\s+contents:\s*read\s*$/m,
  'release workflow token permissions must stay contents: read');
assert.match(uncommentedWorkflow,
  /github\.repository == 'abolfazl2600\/Castlegame'.*github\.ref == 'refs\/heads\/main'.*github\.actor == 'abolfazl2600'/,
  'release signing job must remain locked to repository owner on main');
assert.match(uncommentedWorkflow, /environment:\s*\n\s+name:\s*android-release/,
  'release signing must use the protected android-release environment');
assert.doesNotMatch(uncommentedWorkflow, /^\s*set\s+-x\s*$/m,
  'release workflow must never enable shell xtrace while signing');

const uses = [...uncommentedWorkflow.matchAll(/^\s*uses:\s*([^\s#]+).*$/gm)].map((match) => match[1]);
assert.ok(uses.length > 0, 'release workflow must declare immutable external Actions');
for (const action of uses) {
  const at = action.lastIndexOf('@');
  assert.ok(at > 0, `Action is missing an immutable ref: ${action}`);
  const ref = action.slice(at + 1);
  assert.match(ref, /^[a-f0-9]{40}$/i, `Action must be pinned to a full commit SHA: ${action}`);
}

for (const secretName of [
  'ANDROID_KEYSTORE_BASE64',
  'ANDROID_KEYSTORE_PASSWORD',
  'ANDROID_KEY_ALIAS',
  'ANDROID_KEY_PASSWORD',
]) {
  assert.match(workflow, new RegExp(`secrets\\.${secretName}\\b`), `missing protected secret reference: ${secretName}`);
}
assert.match(workflow, /vars\.ANDROID_EXPECTED_UPLOAD_SHA256\b/,
  'owner-approved public upload certificate fingerprint must be pinned as an environment variable');
assert.match(workflow, /KEY_DIR="\$RUNNER_TEMP\/castle-role-upload"/,
  'temporary keystore must live under RUNNER_TEMP');
assert.match(workflow, /chmod 600 "\$KEY_DIR\/upload\.jks"/,
  'temporary keystore must use restrictive file permissions');
assert.match(workflow, /- name: Remove temporary keystore \(best effort\)[\s\S]*?if: always\(\)/,
  'temporary keystore cleanup must run even after failures');
assert.match(workflow, /path:\s*android\/app\/build\/outputs\/bundle\/release\/app-release\.aab/,
  'artifact upload must target only the signed AAB');
assert.doesNotMatch(workflow, /path:\s*.*(?:\.jks|\.keystore|castle-role-upload)/i,
  'artifact upload must never target signing material');

for (const envName of [
  'ANDROID_KEYSTORE_PATH',
  'ANDROID_KEYSTORE_PASSWORD',
  'ANDROID_KEY_ALIAS',
  'ANDROID_KEY_PASSWORD',
]) {
  assert.match(gradle, new RegExp(`['"]${envName}['"]`), `Gradle signing input is missing: ${envName}`);
}
assert.match(gradle, /System\.getenv\(key\)/, 'Gradle signing credentials must come from environment variables');
assert.doesNotMatch(gradle, /storePassword\s+['"][^'"]+['"]/,
  'Gradle file must not hard-code a keystore password');
assert.doesNotMatch(gradle, /keyPassword\s+['"][^'"]+['"]/,
  'Gradle file must not hard-code a key password');

assert.match(verify, /jarsigner -verify -verbose/, 'AAB JAR signature verification is required');
assert.match(verify, /keytool -printcert -jarfile/, 'signed AAB certificate extraction is required');
assert.match(verify, /ANDROID_EXPECTED_UPLOAD_SHA256/, 'verification must compare the owner-approved fingerprint');
assert.match(
  verify,
  /if \[\[ "\$signed_fingerprint" != "\$upload_fingerprint" \|\| "\$signed_fingerprint" != "\$expected" \]\]/,
  'verification must bind signed bundle, keystore certificate, and expected fingerprint',
);

for (const ignorePattern of ['*.jks', '*.keystore', 'android/key.properties', 'android/**/key.properties']) {
  assert.ok(gitignore.includes(ignorePattern), `.gitignore must block signing material: ${ignorePattern}`);
}

const tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean);
const sensitiveTracked = tracked.filter((path) =>
  /(?:^|\/)(?:key\.properties|[^/]+\.(?:jks|keystore)(?:\.base64)?)$/i.test(path),
);
assert.deepEqual(sensitiveTracked, [], `private signing material is tracked: ${sensitiveTracked.join(', ')}`);

console.log('android protected release-signing contract: ok');
