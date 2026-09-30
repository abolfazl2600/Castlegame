import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const mobileUi = readFileSync(new URL('../src/ui/MobileUI.ts', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
const game = readFileSync(new URL('../src/ThreeGame.ts', import.meta.url), 'utf8');

const header = mobileUi.match(/<header class="mobile-header"[\s\S]*?<\/header>/)?.[0];
assert.ok(header, 'Mobile header markup must exist.');
assert.match(header, /data-mobile-proxy="toolbar-open"/, 'Build must appear in the mobile header.');
assert.match(header, /aria-controls="toolbar"/, 'Build must be associated with the build panel.');
assert.match(header, /aria-expanded="false"/, 'Build must have an accessible initial state.');
assert.doesNotMatch(mobileUi, /mobile-bottom-dock/, 'Mobile footer must no longer occupy screen space.');
assert.doesNotMatch(mobileUi, /data-mobile-proxy="view-3d-button"/, 'Redundant mobile 3D action must be removed.');
assert.match(mobileUi, /target instanceof HTMLButtonElement\) target\.click\(\)/,
  'Build must continue to proxy to the existing gameplay control.');
assert.match(game, /mobileOpener\?\.setAttribute\('aria-expanded', String\(open\)\)/,
  'Opening and closing Build must update the mobile header button state.');
assert.match(css, /html\.mobile-ui-active \.mobile-build-action \{/,
  'Build must use touch-friendly mobile header styling.');

const dockHeights = [...css.matchAll(/--mobile-dock-height:\s*(\d+)px/g)].map((match) => Number(match[1]));
assert.ok(dockHeights.length >= 2, 'Mobile viewport rules must define dock spacing.');
assert.ok(dockHeights.every((height) => height === 0),
  'Neither portrait nor landscape mode may reserve space for a removed dock.');

console.log('Mobile header Build and footer removal regression checks passed.');
