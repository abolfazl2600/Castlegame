export interface TouchQaEvidence {
  capturedAt: string;
  buildSha: string;
  appVersion: string;
  androidVersionCode: string;
  androidVersionName: string;
  userAgent: string;
  platform: string;
  language: string;
  maxTouchPoints: number;
  viewportWidth: number;
  viewportHeight: number;
  screenWidth: number;
  screenHeight: number;
  devicePixelRatio: number;
  orientation: string;
  detectedAndroidVersion: string;
  detectedWebViewChromium: string;
}

export const TOUCH_QA_SCENARIOS = [
  'Rapid tap → pan, return to origin, then a fresh tap',
  'Two-finger pan/pinch through minimum and maximum zoom',
  '1 → 2 → 1, 2 → 3 → 2, and repeated second-finger additions/removals',
  'Wall/road/mountain drag → pinch with no placement or resource spend',
  'Terrain stroke → pinch/cancel with elevation restored and Undo unchanged',
  'Long-press → pan/pinch with no premature removal',
  'Pinch near UI, UI-first touch, and opening a panel mid-stroke',
  'Home/resume, lock/unlock, and interruption mid-gesture',
  'God targeting and active/paused Battle navigation',
  'Repeated gestures during a long session with no stuck preview/drag',
] as const;

function detectAndroidVersion(userAgent: string): string {
  return userAgent.match(/Android\s+([^;\)]+)/i)?.[1]?.trim() || 'not detected';
}

function detectWebViewChromium(userAgent: string): string {
  const looksLikeWebView = /;\s*wv\)/i.test(userAgent) || /Version\/4\.0/i.test(userAgent);
  if (!looksLikeWebView) return 'not detected';
  return userAgent.match(/Chrome\/([\d.]+)/i)?.[1] || 'detected, version unavailable';
}

export function collectTouchQaEvidence(): TouchQaEvidence {
  const userAgent = navigator.userAgent || '';
  return {
    capturedAt: new Date().toISOString(),
    buildSha: __BUILD_SHA__,
    appVersion: __APP_VERSION__,
    androidVersionCode: __ANDROID_VERSION_CODE__,
    androidVersionName: __ANDROID_VERSION_NAME__,
    userAgent,
    platform: navigator.platform || 'unknown',
    language: navigator.language || 'unknown',
    maxTouchPoints: navigator.maxTouchPoints || 0,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    devicePixelRatio: window.devicePixelRatio || 1,
    orientation: window.screen.orientation?.type || (window.innerWidth >= window.innerHeight ? 'landscape' : 'portrait'),
    detectedAndroidVersion: detectAndroidVersion(userAgent),
    detectedWebViewChromium: detectWebViewChromium(userAgent),
  };
}

export function formatTouchQaIssueComment(evidence: TouchQaEvidence): string {
  const lines = [
    '## Android physical touch QA — #112',
    '',
    '### Build and device evidence',
    `- Captured: ${evidence.capturedAt}`,
    `- Build SHA: \`${evidence.buildSha}\``,
    `- App version: \`${evidence.appVersion}\``,
    `- Android versionCode: \`${evidence.androidVersionCode}\``,
    `- Android versionName: \`${evidence.androidVersionName}\``,
    '- Device model: **FILL ON DEVICE**',
    `- Android version (UA detected): \`${evidence.detectedAndroidVersion}\``,
    `- System WebView/Chromium (UA detected): \`${evidence.detectedWebViewChromium}\``,
    '- Android navigation mode: **FILL: gesture / 3-button / other**',
    `- Viewport: \`${evidence.viewportWidth}×${evidence.viewportHeight}\` CSS px`,
    `- Screen: \`${evidence.screenWidth}×${evidence.screenHeight}\` px`,
    `- Device pixel ratio: \`${evidence.devicePixelRatio}\``,
    `- Orientation: \`${evidence.orientation}\``,
    `- maxTouchPoints: \`${evidence.maxTouchPoints}\``,
    `- Platform: \`${evidence.platform}\``,
    `- Language: \`${evidence.language}\``,
    '',
    '### Physical acceptance scenarios',
    ...TOUCH_QA_SCENARIOS.map((scenario) => `- [ ] ${scenario} — Result/device notes: `),
    '',
    '### Interruption / recovery notes',
    '- [ ] Cancelled terrain strokes leave no Undo entry and restore elevation.',
    '- [ ] A completed terrain stroke creates exactly one Undo entry.',
    '- [ ] Fresh gestures work immediately after every cancellation/interruption.',
    '- [ ] Desktop mouse/wheel behavior was sanity-checked before release.',
    '',
    '### Raw user agent',
    `\```text\n${evidence.userAgent}\n\````,
  ];
  return lines.join('\n');
}
