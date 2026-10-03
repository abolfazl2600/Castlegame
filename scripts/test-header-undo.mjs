import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const game = readFileSync(new URL('../src/ThreeGame.ts', import.meta.url), 'utf8');
const mobileUi = readFileSync(new URL('../src/ui/MobileUI.ts', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');

const desktopHeader = html.match(/<header class="topbar">[\s\S]*?<\/header>/)?.[0];
assert.ok(desktopHeader, 'Desktop main header must exist.');
assert.match(
  desktopHeader,
  /id="header-undo-button"[\s\S]*?aria-label="Undo"[\s\S]*?disabled/,
  'Desktop header must expose an accessible Undo icon that starts disabled.',
);
assert.match(
  desktopHeader,
  /id="header-undo-button"[\s\S]*?<span aria-hidden="true">↶<\/span>/,
  'Desktop Undo control must render as an icon rather than a text-only action.',
);

const mobileHeader = mobileUi.match(/<header class="mobile-header"[\s\S]*?<\/header>/)?.[0];
assert.ok(mobileHeader, 'Mobile header markup must exist.');
assert.match(
  mobileHeader,
  /data-mobile-proxy="header-undo-button"[\s\S]*?aria-label="Undo"[\s\S]*?disabled/,
  'Mobile header must proxy the same desktop Undo command and start disabled.',
);
assert.match(
  css,
  /\.mobile-action \{[^}]*min-width:44px;[^}]*min-height:44px;/,
  'Mobile Undo inherits the minimum 44px touch target from mobile actions.',
);
assert.match(
  mobileUi,
  /proxy\.disabled = !isButton \|\| target\.disabled;/,
  'Mobile proxies must mirror the canonical desktop control disabled state.',
);
assert.match(
  mobileUi,
  /attributeFilter: \['hidden', 'disabled', 'aria-expanded'\]/,
  'Mobile proxy state must react when the canonical Undo button becomes enabled or disabled.',
);

assert.match(
  game,
  /get<HTMLButtonElement>\('header-undo-button'\)\.onclick = \(\) => this\.undo\(\);/,
  'Desktop header Undo must use the existing canonical undo method.',
);
assert.match(
  game,
  /get<HTMLButtonElement>\('undo-button'\)\.onclick = \(\) => this\.undo\(\);/,
  'Build-panel Undo must continue to use the same canonical undo method.',
);
assert.match(
  game,
  /\(event\.ctrlKey \|\| event\.metaKey\) && key === 'z'[\s\S]*?this\.undo\(\);/,
  'Keyboard Undo must continue to use the same canonical undo method.',
);

const undoMethod = game.match(/private undo\(\): void \{[\s\S]*?\n  \}\n\n  private redo\(\): void \{/ )?.[0];
assert.ok(undoMethod, 'Undo implementation must exist.');
assert.match(
  undoMethod,
  /const snapshot = this\.undoStack\.pop\(\);/,
  'Undo must consume exactly one history snapshot.',
);
assert.match(
  undoMethod,
  /this\.redoStack\.push\(this\.captureSnapshot\(\)\);[\s\S]*?this\.restoreSnapshot\(snapshot\);/,
  'Undo must preserve the current state for redo and restore one previous snapshot.',
);
assert.doesNotMatch(
  undoMethod,
  /while\s*\(|for\s*\(/,
  'A single Undo activation must not iterate through multiple history entries.',
);

assert.match(
  game,
  /syncButton\('header-undo-button', this\.undoStack\.length === 0\);/,
  'Desktop header Undo must disable when the undo stack is empty.',
);
assert.match(
  game,
  /private pushUndoSnapshot\([\s\S]*?this\.syncHistoryActions\(\);/,
  'A new undoable action must immediately refresh Undo availability.',
);
assert.match(
  game,
  /this\.undoStack\.length = 0;[\s\S]*?this\.redoStack\.length = 0;[\s\S]*?this\.syncHistoryActions\(\);/,
  'Clearing history for reset/load must immediately disable the Undo action.',
);

console.log('Desktop/mobile header Undo regression checks passed.');
