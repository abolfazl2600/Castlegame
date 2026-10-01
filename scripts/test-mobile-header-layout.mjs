import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const mobileUi = readFileSync(new URL('../src/ui/MobileUI.ts', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
const game = readFileSync(new URL('../src/ThreeGame.ts', import.meta.url), 'utf8');
const settings = readFileSync(new URL('../src/settings/SettingsUI.ts', import.meta.url), 'utf8');
const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const missions = readFileSync(new URL('../src/missions/MissionUI.ts', import.meta.url), 'utf8');

const header = mobileUi.match(/<header class="mobile-header"[\s\S]*?<\/header>/)?.[0];
assert.ok(header, 'Mobile header markup must exist.');
assert.match(header, /data-mobile-proxy="toolbar-open"/, 'Build must appear in the mobile header.');
assert.match(header, /aria-controls="toolbar"/, 'Build must be associated with the build panel.');
assert.match(header, /aria-expanded="false"/, 'Build must have an accessible initial state.');
assert.doesNotMatch(header, /mobile-brand|Stronghold|CASTLE ROLE/,
  'Touch header must not display the game name.');
assert.doesNotMatch(header, /data-mobile-action="(?:save|load)"/,
  'Save and Load must not appear twice in the touch header.');
assert.doesNotMatch(header, /data-mobile-proxy="reset-button"/,
  'Reset must be accessed through Settings rather than the touch header.');
assert.match(header, /data-mobile-proxy="settings-button"/, 'Settings must remain reachable.');
assert.match(header, /data-mobile-proxy="missions-button"/, 'Mission Journal must appear as a compact mobile header action.');
assert.match(header, /data-mobile-proxy="missions-button"[\s\S]*?aria-controls="mission-journal"[\s\S]*?aria-expanded="false"/,
  'Mission Journal mobile action must start closed and reference the journal dialog.');
assert.match(index, /id="missions-button"[\s\S]*?aria-controls="mission-journal"[\s\S]*?aria-expanded="false"/,
  'Desktop header must expose a closed Mission Journal button.');
assert.doesNotMatch(missions, /document\.body\.appendChild\(tracker\)/,
  'Mission UI must not mount the old always-visible floating tracker.');
assert.match(missions, /modal\.hidden = true/,
  'Mission Journal dialog must be hidden when first mounted.');
assert.match(settings, /this\.actionButton\('save'/, 'Save must still be available in Settings.');
assert.match(settings, /this\.actionButton\('load'/, 'Load must still be available in Settings.');
assert.match(settings, /data-action="reset-world"/, 'Reset World must remain available in Settings.');
assert.match(settings, /this\.close\(\);\s*resetButton\.click\(\);/,
  'Settings must close before invoking the existing world-reset flow.');
assert.match(game, /get<HTMLButtonElement>\('reset-button'\)\.onclick/,
  'The existing reset button must retain its confirmation and game mode behavior.');
assert.doesNotMatch(mobileUi, /mobile-bottom-dock/, 'Mobile footer must no longer occupy screen space.');
assert.doesNotMatch(mobileUi, /mobile-status|data-mobile-status|save-status/,
  'Mobile UI must not render or mirror desktop status notifications.');
assert.doesNotMatch(css, /\.mobile-status(?:-dot)?\b/,
  'Mobile status notification styles must remain absent.');
assert.doesNotMatch(mobileUi, /data-mobile-proxy="view-3d-button"/, 'Redundant mobile 3D action must be removed.');
assert.match(mobileUi, /target instanceof HTMLButtonElement\)[\s\S]*?target\.click\(\)/,
  'Header actions must continue to proxy to the existing gameplay controls.');
assert.match(game, /mobileOpener\?\.setAttribute\('aria-expanded', String\(open\)\)/,
  'Opening and closing Build must update the mobile header button state.');
assert.match(css, /html\.mobile-ui-active \.mobile-build-action \{/,
  'Build must use touch-friendly mobile header styling.');

const dockHeights = [...css.matchAll(/--mobile-dock-height:\s*(\d+)px/g)].map((match) => Number(match[1]));
assert.ok(dockHeights.length >= 2, 'Mobile viewport rules must define dock spacing.');
assert.ok(dockHeights.every((height) => height === 0),
  'Neither portrait nor landscape mode may reserve space for a removed dock.');

console.log('Mobile header Build and footer removal regression checks passed.');
