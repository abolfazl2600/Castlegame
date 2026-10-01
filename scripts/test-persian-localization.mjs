import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = path => readFileSync(resolve(root, path), 'utf8');
const dictionaryFiles = ['fa.ts', 'faGame.ts', 'faHelp.ts', 'faTemplates.ts', 'faRuntime.ts', 'faSave.ts', 'faPrivacy.ts', 'faBattle.ts', 'faUpgrades.ts', 'faMissions.ts'];
const dictionary = Object.create(null);

for (const name of dictionaryFiles) {
  const source = read('src/i18n/' + name);
  const json = source.match(/Readonly<Record<string, string>> =\s*(\{[\s\S]*\});/);
  assert.ok(json, name + ': missing JSON-compatible translation object');
  for (const [english, persian] of Object.entries(JSON.parse(json[1]))) {
    assert.ok(english.trim() && persian.trim(), name + ': empty translation key or value');
    assert.ok(/[\u0600-\u06ff]/.test(persian), name + ': translation has no Persian text: ' + english);
    dictionary[english] = persian;
  }
}

const html = read('index.html');
const decode = s => s.replaceAll('&amp;', '&').replaceAll('&nbsp;', ' ');
const texts = [...html.matchAll(/>([^<>\n]+)</g)]
  .map(m => decode(m[1].trim()))
  .filter(s => /[A-Za-z]{2}/.test(s) && !/[\$\{\}]/.test(s));
const attributes = [...html.matchAll(/(?:aria-label|title|placeholder)="([^"]+)"/g)]
  .map(m => decode(m[1]));
const untranslated = [...new Set([...texts, ...attributes])]
  .filter(text => !Object.hasOwn(dictionary, text));
assert.deepEqual(untranslated, [], 'Static main screen has untranslated English strings');

assert.match(read('src/settings/SettingsModel.ts'), /language: 'fa'/, 'Persian must be default');
assert.match(read('src/settings/SettingsModel.ts'), /'system' \| 'en' \| 'fa'/);
assert.match(read('src/main.ts'), /installLocalization\(settingsStore\)/);
assert.match(read('src/settings/SettingsUI.ts'), /value="fa"/);
assert.match(read('src/i18n/localization.ts'), /MutationObserver/);
assert.match(read('src/i18n/localization.ts'), /document\.documentElement\.dir/);

const privacySource = read('src/core/PrivacyLegalUI.ts');
const privacyTemplate = privacySource.split("section.innerHTML = `")[1]?.split("`;")[0];
assert.ok(privacyTemplate, 'Privacy & Legal template must be available');
const skipTechnicalNames = new Set(['TypeScript', 'Vite', 'three ^0.180.0', 'Three.js · TypeScript · Vite']);
const privacyMarkup = privacyTemplate.replace(/<code>[\s\S]*?<\/code>/g, '<code></code>');
const privacyText = [...privacyMarkup.matchAll(/>([^<>\n]+)</g)]
  .map(m => m[1].trim())
  .filter(text => /[A-Za-z]{3}/.test(text) && !text.includes('${') && !skipTechnicalNames.has(text));
assert.deepEqual([...new Set(privacyText)].filter(text => !Object.hasOwn(dictionary, text)), [],
  'Privacy & Legal contains untranslated text');
const save = read('src/core/SaveSystem.ts');
assert.match(save, /confirm\(t\(/, 'Save actions must show native confirms in the active locale');
assert.match(save, /prompt\(t\('Save name'\)/, 'Save name prompts must be localized');
assert.match(save, /getCurrentLocale\(\)/, 'Saved timestamps must use the active locale');
assert.match(privacySource, /window\.confirm\(t\(/, 'Privacy confirmations must be translated');
console.log('Save/Privacy translation coverage: ' + privacyText.length + ' privacy text segments audited.');
const threeGame = read('src/ThreeGame.ts');
assert.match(threeGame, /document\.documentElement\.lang = resolveLocale\(settings\.interface\.language\)/,
  'Game runtime must not overwrite the selected Persian locale with navigator.language');
const upgradeAndActionDescriptions = [...threeGame.matchAll(/description: '([^']+)'/g)]
  .map(match => match[1]);
assert.deepEqual([...new Set(upgradeAndActionDescriptions)].filter(text => !Object.hasOwn(dictionary, text)), [],
  'Every building upgrade and God Mode description must have a Persian translation');
const literalStatuses = [...threeGame.matchAll(/this\.setStatus\('([^']+)'\)/g)]
  .map(match => match[1]).filter(text => !text.endsWith(' '));
assert.deepEqual([...new Set(literalStatuses)].filter(text => !Object.hasOwn(dictionary, text)), [],
  'Every literal game status must have a Persian translation');
console.log('Gameplay status coverage: ' + literalStatuses.length + ' statuses; ' +
  upgradeAndActionDescriptions.length + ' upgrade/action descriptions.');

const missionUISource = read('src/missions/MissionUI.ts');
const missionSystemSource = read('src/missions/MissionSystem.ts');
const missionUiLiterals = [...missionUISource.matchAll(/\bt\('([^']+)'\)/g)].map(match => match[1]);
const missionDefinitionLiterals = [...missionSystemSource.matchAll(/(?:title|description|progressLabel): '([^']+)'/g)]
  .map(match => match[1]);
const missingMissionTranslations = [...new Set([...missionUiLiterals, ...missionDefinitionLiterals])]
  .filter(text => !Object.hasOwn(dictionary, text));
assert.deepEqual(missingMissionTranslations, [],
  'Mission Journal or mission definitions contain untranslated English text');
assert.match(missionUISource, /getCurrentLocale\(\)/,
  'Mission Journal progress values must format digits for the active locale');
assert.match(read('src/missions/missions.css'), /html\[dir="rtl"\] \.mission-journal/,
  'Mission Journal must define explicit RTL layout rules');
console.log('Mission Journal localization coverage: ' + missionUiLiterals.length + ' UI strings; ' +
  missionDefinitionLiterals.length + ' mission-definition strings.');

const mobileSource = read('src/ui/MobileUI.ts');
const mobileMarkup = mobileSource.match(/layer\.innerHTML = `([\s\S]*?)`;/)?.[1];
assert.ok(mobileMarkup, 'Mobile presentation markup must be available');
const mobileTexts = [...mobileMarkup.matchAll(/>([^<>\n]+)</g)]
  .map(match => match[1].trim()).filter(value => /[A-Za-z]{2}/.test(value));
const mobileAttributes = [...mobileMarkup.matchAll(/(?:aria-label|title|placeholder)="([^"]+)"/g)]
  .map(match => match[1]);
assert.deepEqual([...new Set([...mobileTexts, ...mobileAttributes])]
  .filter(value => !Object.hasOwn(dictionary, value)), [],
  'Mobile labels and accessibility descriptions contain untranslated English text');
console.log('Mobile localization coverage: ' + mobileTexts.length + ' text nodes, ' +
  mobileAttributes.length + ' accessible labels.');
console.log('Persian localization: ' + Object.keys(dictionary).length + ' entries; ' +
  texts.length + ' source nodes and ' + attributes.length + ' main-screen attributes covered.');
