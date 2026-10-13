import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = (relativePath) => readFileSync(new URL(relativePath, import.meta.url), 'utf8');
const main = source('../src/main.ts');
const fallback = source('../src/ui/StartupErrorUI.ts');
const css = source('../src/style.css');
const translations = source('../src/i18n/fa.ts');

assert.match(main, /catch \(error\) \{[\s\S]*?showStartupError\(\)/,
  'Failed game initialization must show its own visible recovery panel.');
assert.match(fallback, /getElementById\('game-shell'\) \?\? document\.body/,
  'Startup error belongs in the game surface even if the 3D game never initializes.');
assert.match(fallback, /role', 'alert'/);
assert.match(fallback, /aria-labelledby/);
assert.match(fallback, /aria-describedby/);
assert.match(fallback, /\[data-startup-retry\]/);
assert.match(fallback, /window\.location\.reload\(\)/);
assert.match(css, /\.game-startup-error\s*\{[\s\S]*?z-index:\s*110;/);
assert.match(css, /\.game-startup-error\s*\{[\s\S]*?--safe-area-top/);
assert.match(css, /html\.mobile-ui-active \.tool-copy small,[\s\S]*?font-size:\s*max\(12px,/);
assert.match(css, /html\.mobile-ui-active \.tool-copy strong,[\s\S]*?font-size:\s*max\(14px,/);
assert.match(css, /html\.mobile-ui-active #settings-modal :is\([\s\S]*?\.settings-control-copy small,[\s\S]*?font-size:\s*max\(12px,/);
assert.match(css, /html\.mobile-ui-active #settings-modal \.settings-control-copy strong,[\s\S]*?font-size:\s*max\(14px,/);
for (const label of ['Game could not start', 'The 3D world could not be loaded.', 'Try again']) {
  assert.ok(translations.includes(label), 'Missing Persian recovery translation: ' + label);
}

console.log('Mobile readability and startup recovery contracts passed.');
