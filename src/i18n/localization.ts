import type { SettingsStore } from '../settings/SettingsStore';
import { PERSIAN_TRANSLATIONS } from './fa';
import { GAME_TRANSLATIONS } from './faGame';
import { HELP_TRANSLATIONS } from './faHelp';
import { TEMPLATE_TRANSLATIONS } from './faTemplates';
import { RUNTIME_TRANSLATIONS } from './faRuntime';
import { SAVE_TRANSLATIONS } from './faSave';
import { PRIVACY_TRANSLATIONS } from './faPrivacy';
import { BATTLE_TRANSLATIONS } from './faBattle';
import { UPGRADE_TRANSLATIONS } from './faUpgrades';
import { MISSION_TRANSLATIONS } from './faMissions';

/**
 * Central localization layer for the existing DOM-driven game UI.
 * Only user-facing DOM text and accessibility attributes are translated:
 * game-state IDs, save keys, data attributes, hotkeys and WebGL objects are untouched.
 */
const dictionary: Readonly<Record<string, string>> = {
  ...PERSIAN_TRANSLATIONS,
  ...GAME_TRANSLATIONS,
  ...HELP_TRANSLATIONS,
  ...TEMPLATE_TRANSLATIONS,
  ...RUNTIME_TRANSLATIONS,
  ...SAVE_TRANSLATIONS,
  ...PRIVACY_TRANSLATIONS,
  ...BATTLE_TRANSLATIONS,
  ...UPGRADE_TRANSLATIONS,
  ...MISSION_TRANSLATIONS,
};
export type Locale = 'en' | 'fa';
let currentLocale: Locale = 'en';

/** Translate imperative browser dialogs and other non-DOM text using the active UI locale. */
export function t(message: string): string {
  return translate(message, currentLocale);
}

export function getCurrentLocale(): Locale {
  return currentLocale;
}
const farsiDigits = '۰۱۲۳۴۵۶۷۸۹';
const formatDigits = (text: string): string => text.replace(/[0-9]/g, digit => farsiDigits[Number(digit)]);

export function resolveLocale(language: 'system' | 'en' | 'fa'): Locale {
  if (language === 'system') {
    return /^fa(?:-|$)/i.test(navigator.language) ? 'fa' : 'en';
  }
  return language;
}

export function translate(message: string, locale: Locale = 'fa'): string {
  if (locale === 'en') return message;
  const exact = dictionary[message];
  if (exact !== undefined) return formatDigits(exact);
  // Dynamic quantities are matched by their stable source-language unit names.
  const labelledCount = message.match(/^(.+?)(:\s*|\s+)(-?\d[\d,.]*(?:\s*\/\s*\d+)?)$/);
  if (labelledCount) {
    const heading = dictionary[labelledCount[1]] || dictionary[labelledCount[1] + ':'];
    if (heading) return heading.replace(/[:：]$/, '') + (labelledCount[2].includes(':') ? ': ' : ' ') + formatDigits(labelledCount[3]);
  }
  const level = message.match(/^(.+?)\s*·\s*Level\s+(\d+)$/);
  if (level) {
    const name = dictionary[level[1]];
    if (name) return name + ' · سطح ' + formatDigits(level[2]);
  }
  const tier = message.match(/^Tier\s+(\d+)$/);
  if (tier) return 'رده ' + formatDigits(tier[1]);
  const upgrade = message.match(/^Upgrade to Level\s+(\d+)$/);
  if (upgrade) return 'ارتقا به سطح ' + formatDigits(upgrade[1]);
  const countWithLabel = message.match(/^(Population|Army|Available|Farmers|Builders|Production\/Service|Militia|Professional|Logs|Wood|Stone|Grain|Apples|Flour|Food|Storage|Missiles)\s*(:)?\s*(\d[\d,./\s]*)$/);
  if (countWithLabel) {
    const title = dictionary[countWithLabel[1]] || ({
      Population: 'جمعیت', Army: 'ارتش', Available: 'آزاد', Farmers: 'کشاورزان',
      Builders: 'سازندگان', 'Production/Service': 'تولید/خدمات',
      Militia: 'شبه‌نظامیان', Professional: 'حرفه‌ای‌ها', Logs: 'الوار', Wood: 'چوب', Stone: 'سنگ',
      Grain: 'غله', Apples: 'سیب', Flour: 'آرد', Food: 'خوراک', Storage: 'انبار',
      Missiles: 'موشک‌ها',
    } as Record<string, string>)[countWithLabel[1]];
    return title + (countWithLabel[2] ? ':' : '') + ' ' + formatDigits(countWithLabel[3]);
  }
  const tiles = message.match(/^(\d+) tiles?$/);
  if (tiles) return formatDigits(tiles[1]) + ' خانه';
  const floors = message.match(/^(\d+) floors?$/);
  if (floors) return formatDigits(floors[1]) + ' طبقه';
  // Upgrade cards compose a translated level description with dynamic progression text.
  // Translate both parts so Persian UI never falls back to an English composite sentence.
  let match = message.match(/^(.+\.) Next: (.+)\.$/);
  if (match) return translate(match[1], locale) + ' مرحله بعد: ' + translate(match[2], locale) + '.';
  match = message.match(/^(.+\.) Maximum (harbor|building|fortification) level reached\.$/);
  if (match) {
    const maximumLabel = match[2] === 'harbor'
      ? 'بندر به بالاترین سطح رسیده است.'
      : match[2] === 'fortification'
        ? 'استحکامات به بالاترین سطح رسیده‌اند.'
        : 'ساختمان به بالاترین سطح رسیده است.';
    return translate(match[1], locale) + ' ' + maximumLabel;
  }
  match = message.match(/^Uses (.+)\.$/);
  if (match) return 'از ' + translate(match[1], locale) + ' استفاده می‌کند.';

  // Common status patterns with variable levels, costs and coordinates.
  match = message.match(/^LOCKED · TIER (\d+)$/);
  if (match) return 'قفل است · رده ' + formatDigits(match[1]);
  match = message.match(/^(.+?) (?:upgraded to|changed to) Level (\d+) · (.+)$/);
  if (match) return translate(match[1], locale) + ' به سطح ' + formatDigits(match[2]) + ' ارتقا یافت · ' + translate(match[3], locale);
  match = message.match(/^(.+?) is already at Level (\d+)(?: · (.+))?$/);
  if (match) return translate(match[1], locale) + ' هم‌اکنون در سطح ' + formatDigits(match[2]) + (match[3] ? ' · ' + translate(match[3], locale) : '') + ' است';
  match = message.match(/^Upgrade to Level (\d+) · (.+)$/);
  if (match) return 'ارتقا به سطح ' + formatDigits(match[1]) + ' · ' + translate(match[2], locale);
  match = message.match(/^Next: upgrade an Army Camp to Level (\d+) in the Build panel · (.+)$/);
  if (match) return 'بعدی: اردوگاه ارتش را در پنل ساخت به سطح ' + formatDigits(match[1]) + ' ارتقا دهید · ' + translate(match[2], locale);
  match = message.match(/^Military upgraded to Tier (\d+)$/);
  if (match) return 'نیروهای نظامی به رده ' + formatDigits(match[1]) + ' ارتقا یافتند';
  match = message.match(/^Missiles unlock at Military Tier (\d+)$/);
  if (match) return 'موشک‌ها در رده نظامی ' + formatDigits(match[1]) + ' آزاد می‌شوند';
  match = message.match(/^Missile launcher cooling down · (\d+)s$/);
  if (match) return 'پرتابگر موشک در حال آماده‌سازی · ' + formatDigits(match[1]) + ' ثانیه';
  match = message.match(/^Missile production complete · stock (\d+)\/(\d+)$/);
  if (match) return 'تولید موشک کامل شد · موجودی ' + formatDigits(match[1] + '/' + match[2]);
  match = message.match(/^Apple Orchard (?:visual level|placed · size): (\d+)$/);
  if (match) return 'سطح ظاهری باغ سیب: ' + formatDigits(match[1]);
  match = message.match(/^Apple Orchard visual level: (\d+)$/);
  if (match) return 'سطح ظاهری باغ سیب: ' + formatDigits(match[1]);
  match = message.match(/^Apple Orchard placed · size (\d+)$/);
  if (match) return 'باغ سیب ساخته شد · اندازه ' + formatDigits(match[1]);
  match = message.match(/^Brush size: (\d+)$/);
  if (match) return 'اندازه قلم‌مو: ' + formatDigits(match[1]);
  match = message.match(/^Height level: (\d+)$/);
  if (match) return 'سطح ارتفاع: ' + formatDigits(match[1]);
  match = message.match(/^Wall levels are limited to 1–(\d+)$/);
  if (match) return 'سطح دیوار به ۱ تا ' + formatDigits(match[1]) + ' محدود است';
  match = message.match(/^Road drag: (\d+) tiles · release to build$/);
  if (match) return 'جاده: ' + formatDigits(match[1]) + ' خانه · برای ساخت رها کنید';
  match = message.match(/^Built (\d+) connected road tiles · preview confirmed$/);
  if (match) return formatDigits(match[1]) + ' خانه جاده متصل ساخته شد · پیش‌نمایش تأیید شد';
  match = message.match(/^Mountain Range: (\d+) ridge nodes · release to generate$/);
  if (match) return 'رشته‌کوه: ' + formatDigits(match[1]) + ' نقطه خط‌الرأس · برای ساخت رها کنید';
  match = message.match(/^Selected: (.+)$/);
  if (match) return 'انتخاب‌شده: ' + translate(match[1], locale);
  match = message.match(/^Move (.+) · choose a valid destination · Esc cancels$/);
  if (match) return 'جابه‌جایی ' + translate(match[1], locale) + ' · مقصد معتبری انتخاب کنید · Esc لغو می‌کند';
  match = message.match(/^(.+) moved · Undo available$/);
  if (match) return translate(match[1], locale) + ' جابه‌جا شد · امکان بازگردانی وجود دارد';
  match = message.match(/^(.+) demolished · Undo available$/);
  if (match) return translate(match[1], locale) + ' تخریب شد · امکان بازگردانی وجود دارد';
  match = message.match(/^Invalid placement · (.+)$/);
  if (match) return 'مکان ساخت نامعتبر است · ' + translate(match[1], locale);
  match = message.match(/^Selected Keep #(\d+) · (\d+)×(\d+) · (\d+) floors$/);
  if (match) return 'ارگ شماره ' + formatDigits(match[1]) + ' انتخاب شد · ' + formatDigits(match[2] + '×' + match[3]) + ' · ' + formatDigits(match[4]) + ' طبقه';
  match = message.match(/^Keep (?:draft floors|floors): (\d+)$/);
  if (match) return 'طبقات ارگ: ' + formatDigits(match[1]);
  match = message.match(/^Keep draft rotation: (\d+)°$/);
  if (match) return 'چرخش پیش‌نویس ارگ: ' + formatDigits(match[1]) + ' درجه';
  match = message.match(/^Keep built · (\d+)×(\d+) · (\d+) floors · details generated automatically$/);
  if (match) return 'ارگ ساخته شد · ' + formatDigits(match[1] + '×' + match[2]) + ' · ' + formatDigits(match[3]) + ' طبقه · جزئیات به‌طور خودکار ایجاد شدند';
  match = message.match(/^Map sector (\d+), (\d+); (.*)$/);
  if (match) return 'بخش نقشه ' + formatDigits(match[1] + '، ' + match[2]) + '؛ ' + (match[3] === 'press Enter to move camera' ? 'برای جابه‌جایی دوربین Enter را بزنید' : 'با کلیدهای جهت‌دار بخش را انتخاب کنید و با Enter دوربین را جابه‌جا کنید');
  match = message.match(/^Viewing sector (\d+), (\d+)$/);
  if (match) return 'نمایش بخش ' + formatDigits(match[1] + '، ' + match[2]);
  match = message.match(/^Hold to remove (\d+)%$/);
  if (match) return 'برای حذف نگه دارید: ' + formatDigits(match[1]) + '٪';
  match = message.match(/^Terrain: (\S+) · brush (\d+) · strength ([\d.]+)$/);
  if (match) return 'زمین: ' + translate(match[1], locale) + ' · قلم‌مو ' + formatDigits(match[2]) + ' · شدت ' + formatDigits(match[3]);
  match = message.match(/^Not enough resources · need (\d+) wood \+ (\d+) stone$/);
  if (match) return 'منابع کافی نیست · نیاز به ' + formatDigits(match[1]) + ' چوب و ' + formatDigits(match[2]) + ' سنگ';
  match = message.match(/^Not enough resources · need (\d+) (wood|stone)$/);
  if (match) return 'منابع کافی نیست · نیاز به ' + formatDigits(match[1]) + ' ' + (match[2] === 'wood' ? 'چوب' : 'سنگ');
  match = message.match(/^Not enough resources · need (.+)$/);
  if (match) return 'منابع کافی نیست · نیاز به ' + formatDigits(match[1]);
  match = message.match(/^Castle stone style: (.+)$/);
  if (match) return 'سبک سنگ قلعه: ' + translate(match[1], locale);
  match = message.match(/^Tower bridge material: (.+)$/);
  if (match) return 'مصالح پل برج‌ها: ' + translate(match[1], locale);
  match = message.match(/^(.+?) is unavailable in (.+)$/);
  if (match) return translate(match[1], locale) + ' در حالت ' + translate(match[2], locale) + ' در دسترس نیست';
  match = message.match(/^(.+?) loaded: (.+)$/);
  if (match) return translate(match[1], locale) + ' بارگذاری شد: ' + match[2];

  // Variable save slot numbers, report counters and construction state.
  match = message.match(/^Save Slot (\d+)$/);
  if (match) return 'جایگاه ذخیره ' + formatDigits(match[1]);
  match = message.match(/^Saved to Slot (\d+)$/);
  if (match) return 'در جایگاه ' + formatDigits(match[1]) + ' ذخیره شد';
  match = message.match(/^Overwrite Save Slot (\d+)\?$/);
  if (match) return 'محتوای جایگاه ذخیره ' + formatDigits(match[1]) + ' بازنویسی شود؟';
  match = message.match(/^Delete Save Slot (\d+)\? This cannot be undone\.$/);
  if (match) return 'جایگاه ذخیره ' + formatDigits(match[1]) + ' حذف شود؟ این کار برگشت‌پذیر نیست.';
  match = message.match(/^(\d+) buildings · (\d+) keeps$/);
  if (match) return formatDigits(match[1]) + ' ساختمان · ' + formatDigits(match[2]) + ' ارگ';
  match = message.match(/^Battle duration: (\d+(?:\.\d+)?)s$/);
  if (match) return 'مدت نبرد: ' + formatDigits(match[1]) + ' ثانیه';
  match = message.match(/^Castle capture ([\d.]+) \/ ([\d.]+)s$/);
  if (match) return 'تصرف قلعه ' + formatDigits(match[1] + ' / ' + match[2]) + ' ثانیه';
  match = message.match(/^(\d+)s remaining$/);
  if (match) return formatDigits(match[1]) + ' ثانیه باقی مانده';
  match = message.match(/^(\d+)s$/);
  if (match) return formatDigits(match[1]) + ' ثانیه';
  match = message.match(/^Need (\d+) ordnance supply to produce a missile$/);
  if (match) return 'برای تولید موشک به ' + formatDigits(match[1]) + ' واحد تدارکات نیاز است';
  match = message.match(/^Missile production started · cost (\d+) supply$/);
  if (match) return 'تولید موشک آغاز شد · هزینه ' + formatDigits(match[1]) + ' تدارکات';
  match = message.match(/^Missile launched at (.+)$/);
  if (match) return 'موشک به سمت ' + translate(match[1], locale) + ' شلیک شد';
  match = message.match(/^(.+?) · missiles remaining (\d+)(?:\/(\d+))?$/);
  if (match) return translate(match[1], locale) + ' · موشک‌های باقی‌مانده ' + formatDigits(match[2] + (match[3] ? '/' + match[3] : ''));
  match = message.match(/^Produce Missile · (\d+) Supply$/);
  if (match) return 'تولید موشک · ' + formatDigits(match[1]) + ' تدارکات';
  match = message.match(/^Range ([\d.]+)m · radius ([\d.]+)m · ([\d.]+)s cooldown\. Production is disabled during battles; supply recharges over time\.$/);
  if (match) return 'برد ' + formatDigits(match[1]) + ' متر · شعاع ' + formatDigits(match[2]) + ' متر · آماده‌سازی ' + formatDigits(match[3]) + ' ثانیه. تولید هنگام نبرد غیرفعال است و تدارکات به‌مرور بازیابی می‌شود.';
  match = message.match(/^([a-zA-Z]+) · ([\d.]+)\/([\d.]+) HP · ([\d.]+)m( · OUT OF RANGE)?$/);
  if (match) return translate(match[1], locale) + ' · ' + formatDigits(match[2] + '/' + match[3]) + ' سلامت · ' + formatDigits(match[4]) + ' متر' + (match[5] ? ' · خارج از برد' : '');
  match = message.match(/^(.+) ready · select a building$/);
  if (match) return translate(match[1], locale) + ' آماده است · ساختمانی انتخاب کنید';
  match = message.match(/^(.+) is unavailable in (.+)$/);
  if (match) return translate(match[1], locale) + ' در حالت ' + translate(match[2], locale) + ' در دسترس نیست';
  match = message.match(/^Template loaded: (.+)$/);
  if (match) return 'الگو بارگذاری شد: ' + translate(match[1], locale);
  match = message.match(/^Editable terrain template loaded: (.+)$/);
  if (match) return 'الگوی زمین قابل ویرایش بارگذاری شد: ' + translate(match[1], locale);
  match = message.match(/^Tower Bridge selected · Level (\d+) · upgrade or remove it from Build Settings$/);
  if (match) return 'پل برج‌ها انتخاب شد · سطح ' + formatDigits(match[1]) + ' · از تنظیمات ساخت ارتقا دهید یا حذف کنید';
  match = message.match(/^(.+)\. Defenders \+(\d+)% health, \+(\d+)% defense, \+(\d+)% damage, \+(\d+)% movement; walls \+(\d+)% health; wall weapons \+(\d+)% damage and \+(\d+)% range\.$/);
  if (match) return translate(match[1], locale) + '. مدافعان: سلامت +' + formatDigits(match[2]) + '٪، دفاع +' + formatDigits(match[3]) + '٪، آسیب +' + formatDigits(match[4]) + '٪، حرکت +' + formatDigits(match[5]) + '٪؛ دیوارها: سلامت +' + formatDigits(match[6]) + '٪؛ سلاح‌های دیواری: آسیب +' + formatDigits(match[7]) + '٪ و برد +' + formatDigits(match[8]) + '٪.';
  match = message.match(/^([A-Za-z]+) · (\d+)\/(\d+) HP · (\d+)m$/);
  if (match) return translate(match[1], locale) + ' · ' + formatDigits(match[2] + '/' + match[3]) + ' سلامت · ' + formatDigits(match[4]) + ' متر';
  // Less frequent God Mode actions, Endless Defense waves, and battle targeting details.
  match = message.match(/^Endless Defense · Wave (\d+)$/);
  if (match) return 'دفاع بی‌پایان · موج ' + formatDigits(match[1]);
  match = message.match(/^Endless Defense defeated on Wave (\d+)$/);
  if (match) return 'دفاع بی‌پایان در موج ' + formatDigits(match[1]) + ' شکست خورد';
  match = message.match(/^Wave (\d+) cleared · next wave incoming$/);
  if (match) return 'موج ' + formatDigits(match[1]) + ' دفع شد · موج بعدی در راه است';
  match = message.match(/^Endless Defense · Wave (\d+) · (\d+) enemies$/);
  if (match) return 'دفاع بی‌پایان · موج ' + formatDigits(match[1]) + ' · ' + formatDigits(match[2]) + ' دشمن';
  match = message.match(/^Target: ([\w]+) · anchor (\d+),(\d+) · (\d+) tile footprint$/);
  if (match) return 'هدف: ' + translate(match[1], locale) + ' · مختصات ' + formatDigits(match[2] + '، ' + match[3]) + ' · محدوده ' + formatDigits(match[4]) + ' خانه';
  match = message.match(/^Missile strike destroyed ([\w]+) · occupancy cleared$/);
  if (match) return 'حمله موشکی ' + translate(match[1], locale) + ' را نابود کرد · فضای اشغال‌شده آزاد شد';
  match = message.match(/^Missile strike hit ([\w]+) · damage ([\d.]+)%$/);
  if (match) return 'موشک به ' + translate(match[1], locale) + ' برخورد کرد · آسیب ' + formatDigits(match[2]) + '٪';
  match = message.match(/^(\d+) wood$/);
  if (match) return formatDigits(match[1]) + ' چوب';
  match = message.match(/^(\d+) stone$/);
  if (match) return formatDigits(match[1]) + ' سنگ';
  return message;
}

const translatableAttributes = ['aria-label', 'title', 'placeholder', 'aria-description'] as const;
const skipTags = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'CODE', 'KBD']);

export function installLocalization(store: SettingsStore): () => void {
  let locale: Locale = 'en';
  const originalText = new WeakMap<Text, string>();
  const renderedText = new WeakMap<Text, string>();
  const originalAttributes = new WeakMap<Element, Map<string, { original: string; rendered: string }>>();
  const originalTitle = document.title;

  function localizeNode(node: Text): void {
    if (node.parentElement && (skipTags.has(node.parentElement.tagName) || node.parentElement.closest('[data-no-localize]'))) return;
    const current = node.nodeValue || '';
    if (renderedText.get(node) !== current) originalText.set(node, current);
    const source = originalText.get(node) ?? current;
    const content = source.trim();
    if (!content) return;
    const translated = translate(content, locale);
    const result = source.replace(content, translated);
    if (result !== current) {
      renderedText.set(node, result);
      node.nodeValue = result;
    } else {
      renderedText.set(node, current);
    }
  }

  function localizeAttributes(element: Element): void {
    let records = originalAttributes.get(element);
    if (!records) {
      records = new Map();
      originalAttributes.set(element, records);
    }
    for (const attr of translatableAttributes) {
      const current = element.getAttribute(attr);
      if (current === null) continue;
      const prior = records.get(attr);
      const original = prior && prior.rendered === current ? prior.original : current;
      const translated = translate(original, locale);
      records.set(attr, { original, rendered: translated });
      if (translated !== current) element.setAttribute(attr, translated);
    }
  }

  function walk(node: Node): void {
    if (node.nodeType === Node.TEXT_NODE) {
      localizeNode(node as Text);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE && node.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;
    if (node instanceof Element) {
      if (skipTags.has(node.tagName) || node.hasAttribute('data-no-localize')) return;
      localizeAttributes(node);
    }
    for (const child of Array.from(node.childNodes)) walk(child);
  }

  const observer = new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'characterData') {
        localizeNode(record.target as Text);
      } else if (record.type === 'attributes') {
        localizeAttributes(record.target as Element);
      } else {
        for (const node of Array.from(record.addedNodes)) walk(node);
      }
    }
  });

  observer.observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: [...translatableAttributes],
  });

  const unsubscribe = store.subscribe(settings => {
    const next = resolveLocale(settings.interface.language);
    if (next === locale) return;
    locale = next;
    currentLocale = next;
    document.documentElement.lang = next;
    document.documentElement.dir = next === 'fa' ? 'rtl' : 'ltr';
    document.title = translate(originalTitle, locale);
    walk(document.body);
  });

  return () => {
    unsubscribe();
    observer.disconnect();
  };
}
