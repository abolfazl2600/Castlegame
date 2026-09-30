import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';

const root = resolve(import.meta.dirname, '..');
const read = path => readFileSync(resolve(root, path), 'utf8');
const sources = {
  './fa': ['fa.ts', 'PERSIAN_TRANSLATIONS'],
  './faGame': ['faGame.ts', 'GAME_TRANSLATIONS'],
  './faHelp': ['faHelp.ts', 'HELP_TRANSLATIONS'],
  './faTemplates': ['faTemplates.ts', 'TEMPLATE_TRANSLATIONS'],
  './faRuntime': ['faRuntime.ts', 'RUNTIME_TRANSLATIONS'],
  './faSave': ['faSave.ts', 'SAVE_TRANSLATIONS'],
  './faPrivacy': ['faPrivacy.ts', 'PRIVACY_TRANSLATIONS'],
  './faBattle': ['faBattle.ts', 'BATTLE_TRANSLATIONS'],
  './faUpgrades': ['faUpgrades.ts', 'UPGRADE_TRANSLATIONS'],
};
const dictionaries = Object.fromEntries(Object.entries(sources).map(([moduleName, [filename, exportName]]) => {
  const source = read('src/i18n/' + filename);
  const matches = source.match(/=\s*(\{[\s\S]*\});\s*$/);
  assert.ok(matches, filename + ' has a valid dictionary');
  return [moduleName, { [exportName]: JSON.parse(matches[1]) }];
}));

// Execute the actual translator body without relying on the TS 7 compiler API.
// Only erase the function's type signature and its single TypeScript assertion.
const translationSource = read('src/i18n/localization.ts');
const fromIndex = translationSource.indexOf('export function translate(');
const toIndex = translationSource.indexOf('\nconst translatableAttributes', fromIndex);
assert.ok(fromIndex >= 0 && toIndex > fromIndex, 'Translator function must exist');
const sourceFunction = translationSource.slice(fromIndex, toIndex)
  .replace("export function translate(message: string, locale: Locale = 'fa'): string {",
    "function translate(message, locale = 'fa') {")
  .replaceAll(' as Record<string, string>', '');
const dictionary = Object.assign({}, ...Object.values(dictionaries).map(module => Object.values(module)[0]));
const formatDigits = value => String(value).replace(/[0-9]/g, c => '۰۱۲۳۴۵۶۷۸۹'[Number(c)]);
const translate = runInNewContext(sourceFunction + '\ntranslate;', { dictionary, formatDigits });
assert.equal(translate('Save Slot 3', 'fa'), 'جایگاه ذخیره ۳');
assert.equal(translate('Overwrite Save Slot 4?', 'fa'), 'محتوای جایگاه ذخیره ۴ بازنویسی شود؟');
assert.equal(translate('Delete Save Slot 2? This cannot be undone.', 'fa'), 'جایگاه ذخیره ۲ حذف شود؟ این کار برگشت‌پذیر نیست.');
assert.equal(translate('5 buildings · 2 keeps', 'fa'), '۵ ساختمان · ۲ ارگ');
assert.equal(translate('Battle duration: 12.5s', 'fa'), 'مدت نبرد: ۱۲.۵ ثانیه');
assert.equal(translate('Castle capture 3.2 / 9s', 'fa'), 'تصرف قلعه ۳.۲ / ۹ ثانیه');
assert.equal(translate('Wave 6 cleared · next wave incoming', 'fa'), 'موج ۶ دفع شد · موج بعدی در راه است');
assert.equal(translate('Survival · Wave 7 · 45 enemies', 'fa'), 'بقا · موج ۷ · ۴۵ دشمن');
assert.equal(translate('Missile strike hit farm · damage 72%', 'fa'), 'موشک به مزرعه برخورد کرد · آسیب ۷۲٪');
assert.equal(translate('Army Camp · Level 2', 'fa'), 'اردوگاه ارتش · سطح ۲');
assert.equal(translate('Save Slot 3', 'en'), 'Save Slot 3');
assert.equal(translate('A custom player-provided castle name', 'fa'), 'A custom player-provided castle name');
console.log('Persian runtime translation contract: 12 representative dynamic cases passed.');
