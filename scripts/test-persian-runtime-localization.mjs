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
assert.equal(translate('Endless Defense · Wave 7 · 45 enemies', 'fa'), 'دفاع بی‌پایان · موج ۷ · ۴۵ دشمن');
assert.equal(translate('Missile strike hit farm · damage 72%', 'fa'), 'موشک به مزرعه برخورد کرد · آسیب ۷۲٪');
assert.equal(translate('Army Camp · Level 2', 'fa'), 'اردوگاه ارتش · سطح ۲');
assert.equal(translate('Move House Cluster · choose a valid destination · Esc cancels', 'fa'),
  'جابه‌جایی مجموعه خانه‌ها · مقصد معتبری انتخاب کنید · Esc لغو می‌کند');
assert.equal(translate('House Cluster moved · Undo available', 'fa'), 'مجموعه خانه‌ها جابه‌جا شد · امکان بازگردانی وجود دارد');
assert.equal(translate('House Cluster demolished · Undo available', 'fa'), 'مجموعه خانه‌ها تخریب شد · امکان بازگردانی وجود دارد');
assert.equal(translate('Save Slot 3', 'en'), 'Save Slot 3');
assert.equal(translate('A custom player-provided castle name', 'fa'), 'A custom player-provided castle name');
assert.equal(translate('Endless Defense · Wave 2', 'fa'), 'دفاع بی‌پایان · موج ۲');
assert.equal(translate('Endless Defense defeated on Wave 3', 'fa'), 'دفاع بی‌پایان در موج ۳ شکست خورد');
// Confirmed Issue #320 gaps: runtime concatenation must localize resource names,
// standalone selection levels, composed upgrade buttons, and economy output.
assert.equal(translate('12 wood + 8 stone', 'fa'), '۱۲ چوب + ۸ سنگ');
assert.equal(translate('Upgrade to Level 2 · Improved Mosque · 12 wood + 8 stone', 'fa'),
  'ارتقا به سطح ۲ · مسجد بهبودیافته · ۱۲ چوب + ۸ سنگ');
assert.equal(translate('Upgrade Tower to Level 2 · Reinforced Tower · 12 wood + 8 stone', 'fa'),
  'ارتقای برج به سطح ۲ · برج تقویت‌شده · ۱۲ چوب + ۸ سنگ');
assert.equal(translate('Not enough resources to upgrade · need 12 wood + 8 stone', 'fa'),
  'منابع برای ارتقا کافی نیست · نیاز به ۱۲ چوب + ۸ سنگ');
assert.equal(translate('Not enough resources · need 12 wood + 8 stone', 'fa'),
  'منابع کافی نیست · نیاز به ۱۲ چوب و ۸ سنگ');
assert.equal(translate('Level 3', 'fa'), 'سطح ۳');
assert.equal(translate('Storage cap 200 per resource', 'fa'), 'ظرفیت انبار ۲۰۰ برای هر منبع');
assert.equal(translate('+1.25/s', 'fa'), '+۱.۲۵/ثانیه');
assert.equal(translate('-0.50/s', 'fa'), '-۰.۵۰/ثانیه');
assert.equal(translate('Upgrade to Level 2 · House Cluster · free build', 'fa'),
  'ارتقا به سطح ۲ · مجموعه خانه‌ها · ساخت رایگان');
assert.equal(translate('Upgrade to Level 2 · House Cluster · no material cost', 'fa'),
  'ارتقا به سطح ۲ · مجموعه خانه‌ها · بدون هزینه مصالح');
assert.equal(translate('no new cost', 'fa'), 'بدون هزینه تازه');
assert.equal(translate(
  'A small open carpenter yard that processes Logs into construction-ready Wood. 2 workers · up to 1.50 Wood/s. Next: Advanced Woodworking Yard.',
  'fa'),
  'محوطه‌ای کوچک و باز برای نجاری که الوار را به چوب آماده ساخت تبدیل می‌کند. ۲ کارگر · حداکثر ۱.۵۰ چوب/ثانیه. مرحله بعد: محوطه نجاری پیشرفته.');
assert.equal(translate(
  'A functional timber gate set into a compact stone gateway. Maximum upgrade level reached.',
  'fa'),
  'دروازه چوبی کاربردی در ورودی سنگی جمع‌وجور. به بالاترین سطح ارتقا رسیده است.');
assert.equal(translate('Map sector 4, 7; press Enter to move camera', 'fa'),
  'بخش نقشه ۴، ۷؛ برای جابه‌جایی دوربین Enter را بزنید');
for (const source of [
  'Upgrade Tower to Level 2 · Reinforced Tower · 12 wood + 8 stone',
  'Upgrade to Level 2 · Improved Mosque · 12 wood + 8 stone',
  'Not enough resources to upgrade · need 12 wood + 8 stone',
  'Storage cap 200 per resource',
  'Level 3',
]) {
  assert.equal(translate(source, 'en'), source, 'English language must preserve runtime source text');
}
console.log('Issue #320: 15 dynamic Persian cases and 5 English reversibility checks passed.');

console.log('Persian runtime translation contract: 15 representative dynamic cases passed.');
