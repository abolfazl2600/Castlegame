import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { formatTouchQaIssueComment, TOUCH_QA_SCENARIOS } from '../src/input/TouchQaEvidence.ts';

const sample = {
  capturedAt: '2026-10-01T12:00:00.000Z',
  buildSha: 'abc123',
  appVersion: '0.2.0',
  androidVersionCode: '1',
  androidVersionName: '1.0',
  userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7; wv) Version/4.0 Chrome/153.0.0.0 Mobile Safari/537.36',
  platform: 'Linux armv8l',
  language: 'fa-IR',
  maxTouchPoints: 5,
  viewportWidth: 915,
  viewportHeight: 412,
  screenWidth: 1080,
  screenHeight: 2400,
  devicePixelRatio: 2.625,
  orientation: 'landscape-primary',
  detectedAndroidVersion: '14',
  detectedWebViewChromium: '153.0.0.0',
};

const report = formatTouchQaIssueComment(sample);
assert.match(report, /Build SHA: `abc123`/);
assert.match(report, /Android versionCode: `1`/);
assert.match(report, /System WebView\/Chromium.*153\.0\.0\.0/);
assert.match(report, /Device model: \*\*FILL ON DEVICE\*\*/);
assert.match(report, /Android navigation mode: \*\*FILL/);
assert.match(report, /maxTouchPoints: `5`/);
assert.equal(TOUCH_QA_SCENARIOS.length, 10);
for (const scenario of TOUCH_QA_SCENARIOS) {
  assert.ok(report.includes(`- [ ] ${scenario}`), `Missing physical scenario: ${scenario}`);
}

const vite = await readFile(new URL('../vite.config.ts', import.meta.url), 'utf8');
for (const marker of ['__BUILD_SHA__', '__APP_VERSION__', '__ANDROID_VERSION_CODE__', '__ANDROID_VERSION_NAME__']) {
  assert.ok(vite.includes(marker), `Vite build metadata is missing ${marker}`);
}
assert.match(vite, /process\.env\.GITHUB_SHA/);
assert.match(vite, /android\/app\/build\.gradle/);

const settings = await readFile(new URL('../src/settings/SettingsUI.ts', import.meta.url), 'utf8');
assert.match(settings, /data-action="copy-touch-qa" hidden/);
assert.match(settings, /touchQaButton\.hidden = !settings\.graphics\.debugMode/);
assert.match(settings, /formatTouchQaIssueComment\(collectTouchQaEvidence\(\)\)/);

const docs = await readFile(new URL('../docs/android-touch-gestures.md', import.meta.url), 'utf8');
assert.match(docs, /Copy touch QA report/);
assert.match(docs, /device model/i);
assert.match(docs, /navigation mode/i);

console.log('Touch QA evidence report contract checks passed.');
