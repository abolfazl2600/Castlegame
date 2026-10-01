import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const html = read('../index.html');
const mobile = read('../src/ui/MobileUI.ts');
const game = read('../src/ThreeGame.ts');
const css = read('../src/style.css');

// One visible action must open the shared battle/military panel on mobile.
assert.equal((mobile.match(/data-mobile-proxy="battle-button"/g) ?? []).length, 1);
assert.doesNotMatch(mobile, /data-mobile-proxy="military-button"/);
assert.match(html, /id="military-button"[^>]*hidden/);
assert.match(game, /get<HTMLButtonElement>\('battle-button'\)\.onclick/);
assert.match(game, /get<HTMLButtonElement>\('military-button'\)\.onclick/);

// The full military UI stays in the DOM and is available under mobile disclosure.
assert.match(html, /<details class="battle-advanced" open>/);
assert.match(html, /<summary>Military &amp; advanced options<\/summary>/);
const advanced = html.split('<details class="battle-advanced" open>')[1]?.split('</details>')[0];
assert.ok(advanced, 'advanced battle section must be present');
assert.match(advanced, /id="military-tier-value"/);
assert.match(advanced, /id="military-missile-produce"/);
assert.match(advanced, /class="battle-hint"/);
assert.match(mobile, /if \(advanced\) advanced\.open = !active/);

// Core combat controls and live feedback must remain wired to the existing system.
for (const id of ['battle-start', 'battle-stop', 'battle-reset', 'battle-speed-up', 'battle-speed-down', 'battle-attacker-swordsmen', 'battle-attacker-spearmen', 'battle-attacker-archers', 'battle-attacker-crossbowmen', 'battle-attacker-modern-soldiers']) {
  assert.ok(html.includes(`id="${id}"`), `missing battle control: ${id}`);
}
assert.match(game, /panel\.dataset\.battlePhase = status\.mode/);
assert.match(css, /html\.mobile-ui-active \.battle-advanced > summary/);
assert.match(css, /html\.mobile-ui-active \.battle-actions \{/);
assert.match(css, /html\.mobile-ui-active \.battle-panel\[data-battle-phase="idle"\]/);
console.log('mobile battle UI contract: ok');
