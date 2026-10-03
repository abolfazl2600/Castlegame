import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const game = await readFile(new URL('../src/ThreeGame.ts', import.meta.url), 'utf8');
const css = await readFile(new URL('../src/style.css', import.meta.url), 'utf8');
const settings = await readFile(new URL('../src/settings/SettingsUI.ts', import.meta.url), 'utf8');
const localization = await readFile(new URL('../src/i18n/localization.ts', import.meta.url), 'utf8');
const templatesFa = await readFile(new URL('../src/i18n/faTemplates.ts', import.meta.url), 'utf8');
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const audit = await readFile(new URL('../docs/touch-accessibility-audit.md', import.meta.url), 'utf8');

assert.ok(game.includes("const layoutMessage = t(`Uses ${targetLayout?.label ?? targetLayoutId}.`);"));
assert.ok(game.includes("layoutInfo.className = 'template-layout-info';"));
assert.ok(game.includes("button.setAttribute('aria-describedby', layoutInfo.id);"));
assert.ok(css.includes('.template-layout-info {'));

const mobileToolCopy = css.indexOf('html.mobile-ui-active .tool-copy small {');
assert.notEqual(mobileToolCopy, -1);
assert.ok(css.slice(mobileToolCopy, mobileToolCopy + 260).includes('display: block;'));
assert.ok(css.slice(mobileToolCopy, mobileToolCopy + 260).includes('white-space: normal;'));
assert.ok(game.includes('<span class="tool-copy"><strong>'));

assert.ok(css.includes('html.mobile-ui-active .settings-hint { display: block; }'));
assert.ok(css.includes('html.mobile-ui-active .minimap-hint { display: block; }'));
assert.ok(html.includes('<span class="minimap-hint">Tap to move camera</span>'));

assert.ok(!settings.includes('privacyButton.title ='));
assert.ok(settings.includes("'Data & Privacy is unavailable'"));
assert.ok(settings.includes("privacyButton.querySelector<HTMLElement>('small')"));
assert.ok(localization.includes("message.match(/^Uses (.+)\\.$/)"));

for (const label of ['Classic Island', 'Mainland Coast', 'Peninsula', 'Twin Isles', 'Three Isles 100×100']) {
  assert.ok(templatesFa.includes(`\"${label}\":`), `Missing Persian map-layout label: ${label}`);
}

assert.ok(html.includes('class="battle-hint"'));
assert.match(html, /data-god-action="flood"[\s\S]*?<small>Coming soon/);
assert.match(html, /data-god-action="earthquake"[\s\S]*?<small>Coming soon/);

for (const section of ['Templates', 'Build and context details', 'Battle', 'Minimap', 'Settings', 'God Mode', 'Hover / pointer audit']) {
  assert.ok(audit.includes(section), `Touch accessibility audit is missing section: ${section}`);
}

console.log('Touch-accessible hints regression checks passed.');
