# Roadmap انتشار Castle Role در کافه‌بازار و مایکت

این Roadmap ترتیب انجام کار را مشخص می‌کند. در مرحله بعد هر Phase به taskهای دقیق فنی و عملیاتی شکسته خواهد شد.

---

## Phase 0 — Freeze تصمیم‌های انتشار

**هدف:** جلوگیری از تغییر تصمیم‌های پایه در میانه انتشار.

تصمیم‌هایی که باید نهایی شوند:

- نام نهایی محصول: Castle Role یا نام فارسی/بازاری متفاوت
- Publisher / Developer display name
- Package ID دائمی
- مدل درآمد نسخه 1.0
- حداقل Android پشتیبانی‌شده
- orientation اصلی بازی
- سیاست online/offline
- اینکه نسخه 1.0 تبلیغ، login، analytics یا IAP داشته باشد یا خیر

**پیشنهاد فعلی برای v1:**

- Free
- بدون تبلیغ
- بدون Login
- بدون IAP
- بدون Analytics شخص ثالث
- Offline-first
- Landscape-first
- حداقل permission ممکن

**Gate خروج:** Product identity و Package ID دیگر تغییر نکنند.

---

## Phase 1 — Android Foundation

**هدف:** تبدیل پروژه فعلی به یک Android app واقعی.

کارهای سطح بالا:

- اضافه کردن Android shell
- انتخاب و تثبیت Capacitor/native wrapper
- ساخت پروژه Android
- تنظیم applicationId
- تنظیم versionName / versionCode
- تنظیم compileSdk / targetSdk / minSdk
- تنظیم orientation و fullscreen
- اضافه کردن app icon و splash پایه
- تولید اولین debug APK
- تست اجرا بدون اتصال به dev server

**Target SDK strategy:**

- محدودیت رسمی اعلام‌شده مایکت از ۱ آبان ۱۴۰۵: کمتر از API 34 قابل انتشار نیست.
- هدف فنی پروژه بهتر است جدیدتر از minimum باشد؛ در زمان implementation، API 36 را به‌عنوان target پیشنهادی بررسی می‌کنیم و فقط در صورت incompatibility مستندشده پایین‌تر می‌آییم.

**Gate خروج:** APK مستقل و قابل نصب که بازی را از assetهای local اجرا کند.

---

## Phase 2 — Android Runtime Integration

**هدف:** بازی در Android مانند یک اپ واقعی رفتار کند، نه صرفاً یک WebView بسته‌بندی‌شده.

موارد اصلی:

- Android Back behavior
- lifecycle: pause / resume / background / foreground
- autosave هنگام background
- audio pause/resume
- handling screen lock / interruption
- safe areas / cutouts / navigation bars
- immersive fullscreen
- touch/pointer رفتار صحیح
- جلوگیری از refresh/reload ناخواسته
- persistence مطمئن save data
- update-safe storage migration

**Gate خروج:** kill/reopen/background/update موجب از دست رفتن save یا شکستن state نشود.

---

## Phase 3 — Mobile UX & Device Compatibility

**هدف:** UI بازی واقعاً مناسب موبایل باشد.

بررسی:

- Build sidebar
- Settings
- Templates
- Battle
- Military
- minimap
- modals
- touch targets
- landscape sizes
- low-resolution phones
- tablets
- notch/cutout
- keyboard assumptions
- hover-only interactions

**Gate خروج:** هیچ قابلیت اصلی فقط با mouse/keyboard قابل استفاده نباشد.

---

## Phase 4 — Performance & Stability

**هدف:** عبور از بررسی واقعی مارکت و کاهش crash/freeze.

ماتریس تست:

- Android نسخه‌های قدیمی‌ترِ پشتیبانی‌شده
- Android 14 / 15 / 16
- Adreno
- Mali
- دستگاه RAM پایین
- settlement سنگین
- battle سنگین
- تغییر mode
- load/save مکرر
- long session
- app background/foreground
- install / update / reinstall scenarios

شاخص‌ها:

- startup time
- FPS
- frame spikes
- memory
- crash / force close
- freeze
- WebGL context loss
- battery/thermal behavior در session طولانی

**Gate خروج:** release candidate روی چند دستگاه واقعی بدون blocker اجرا شود.

---

## Phase 5 — Signing, Identity & Release Security

**هدف:** هویت نسخه انتشار پایدار شود.

کارها:

- ایجاد release keystore
- backup امن حداقل در دو محل
- مستندسازی alias و ownership بدون ذخیره password در Git
- build signing config
- release APK امضاشده
- بررسی certificate fingerprint
- تثبیت versionCode policy
- تثبیت release naming
- رزرو Package ID در پنل‌ها در صورت امکان

**نکته آینده‌نگر:** Android Developer Verification برای توزیع خارج Google Play در حال گسترش جهانی تا 2027 است؛ بنابراین package name و signing identity باید از ابتدا دائمی و قابل اثبات باشند.

**Gate خروج:** APK release قابل update با همان signature باشد.

---

## Phase 6 — Permissions, Privacy & Security Audit

**هدف:** حداقل‌سازی ریسک رد شدن و ریسک امنیتی.

کارها:

- audit کامل AndroidManifest
- حذف permissionهای غیرضروری
- audit dependency/SDK
- بررسی WebView security
- بررسی network calls
- تعیین دقیق داده‌هایی که جمع‌آوری/ذخیره/ارسال می‌شوند
- ساخت Privacy Policy
- افزودن Privacy/About داخل بازی در صورت نیاز
- malware / Play Protect sanity check
- dependency license audit

برای v1 ترجیح این است که بازی نیاز نداشته باشد به:

- Camera
- Microphone
- Location
- Contacts
- SMS
- Phone
- broad storage permissions

**Gate خروج:** هر permission و هر data flow دلیل مستند داشته باشد.

---

## Phase 7 — Content, Rating & Copyright Review

**هدف:** محتوای بازی با قوانین انتشار سازگار باشد.

Castle Role به‌دلیل battle/siege/missile به بررسی جداگانه نیاز دارد:

- پرهیز از gore و خشونت واقع‌گرایانه
- عدم استفاده از نماد یا محتوای گروه‌های ممنوع
- عدم ارائه آموزش واقعی ساخت/استفاده غیرقانونی سلاح
- بررسی متن‌ها، نام‌ها و تصاویر تاریخی
- بررسی تمام موسیقی/صدا/فونت/texture/icon از نظر مجوز
- ثبت attribution لازم برای open-source assets/libraries
- بررسی screenshotهای فروشگاه از نظر محتوای حساس

**Gate خروج:** هیچ asset یا محتوای مشکوک به مالکیت شخص ثالث بدون مجوز/منبع باقی نماند.

---

## Phase 8 — Store Identity & Marketing Assets

**هدف:** آماده کردن صفحه فروشگاه همگام با build واقعی.

دارایی‌ها:

- App icon نهایی
- Android adaptive icon
- عنوان فارسی
- عنوان انگلیسی
- توضیح کوتاه / tagline
- توضیحات کامل فارسی
- توضیحات انگلیسی
- support email
- website در صورت استفاده
- release notes
- حداقل 3 screenshot واقعی برای مایکت
- مجموعه screenshot بهتر برای هر دو مارکت
- optional promo video
- category انتخاب‌شده

روایت پیشنهادی screenshotها:

1. ساخت قلعه
2. شهر زنده و NPCها
3. Battle / Siege
4. Historical Templates
5. Terrain / Map Layout
6. Modern Mode
7. Mobile Build UX

**Gate خروج:** Store listing دقیقاً ویژگی‌هایی را نشان دهد که در build وجود دارند.

---

## Phase 9 — Monetization Decision

**هدف:** قبل از submission تکلیف اقتصاد محصول مشخص شود.

اگر v1 رایگان و بدون IAP باشد:
- هیچ SDK billing اضافه نمی‌شود.

اگر محصول دیجیتال فروخته شود:
- Myket flavor باید Myket billing داشته باشد.
- Bazaar flavor باید Bazaar billing داشته باشد.
- یک abstraction مشترک داخل game/app ساخته می‌شود.
- purchase verification و restore flow طراحی می‌شود.

**نکته مهم مایکت:** برنامه‌ای که رایگان منتشر شده، بعداً نمی‌تواند همان listing را به برنامه پولی تبدیل کند؛ مدل درآمد باید قبل از اولین انتشار آگاهانه انتخاب شود.

**Gate خروج:** هیچ مسیر پرداخت خارجی ناسازگار با قوانین مارکت در build وجود نداشته باشد.

---

## Phase 10 — Bazaar Preparation

**هدف:** آماده‌سازی submission کافه‌بازار.

- تکمیل/تأیید حساب توسعه‌دهنده و قراردادهای جاری پیشخان
- بررسی هزینه/اشتراک جاری پیشخان در همان زمان
- ایجاد app entry
- ثبت package identity
- آپلود release package
- تکمیل listing
- تکمیل content/rating declarations موجود در پنل
- تکمیل privacy/contact information
- انتخاب روش release
- در صورت نیاز staged rollout

بازار پشتیبانی از APK/AAB و همچنین TWA/PWA را اعلام کرده است؛ برای Castle Role مسیر مشترک Android shell همچنان گزینه پیشنهادی است.

**Gate خروج:** release در Bazaar بدون validation error آماده ارسال برای review باشد.

---

## Phase 11 — Myket Preparation

**هدف:** آماده‌سازی submission مایکت.

- تکمیل حساب توسعه‌دهنده و اطلاعات هویتی
- رزرو/ثبت package name
- بارگذاری APK
- تعیین نوع: Game
- category مناسب
- آیکون
- عنوان فارسی و انگلیسی
- توضیحات
- ایمیل پشتیبانی
- pricing
- version changelog
- حداقل 3 screenshot واقعی
- optional Aparat video
- final review
- انتخاب publish mode
- ارسال برای بررسی

**Gate خروج:** تمام فیلدهای اجباری پنل مایکت کامل و package قابل نصب باشد.

---

## Phase 12 — Pre-Submission Release Candidate

**هدف:** همان فایلی که ارسال می‌شود، قبل از upload تأیید شود.

RC checklist:

- clean release build
- signed correctly
- correct package ID
- correct versionCode/versionName
- no debug flags
- no dev URLs
- no local secrets
- no broken buttons
- no placeholder features بدون برچسب
- privacy policy reachable
- screenshots match UI
- save/load works
- new install works
- update from previous signed test release works
- Play Protect check
- antivirus sanity check

**Gate خروج:** checksum و نسخه RC ثبت شود و بعد از آن code change بدون RC جدید ممنوع باشد.

---

## Phase 13 — Submission & Review

**هدف:** ارسال کنترل‌شده به هر دو مارکت.

ترتیب پیشنهادی:

1. Myket submission
2. Bazaar submission
3. ثبت نسخه/زمان/نتیجه بررسی
4. پاسخ به rejection فقط با تغییر مستند
5. ساخت RC جدید در صورت تغییر binary
6. عدم جایگزینی binary بدون افزایش versionCode

این ترتیب الزام نیست؛ برای v1 فقط مدیریت feedback را ساده می‌کند.

---

## Phase 14 — Launch

**هدف:** انتشار با امکان کنترل ریسک.

- انتشار کنترل‌شده در صورت وجود ابزار staged/manual release
- تست صفحه store بعد از انتشار
- نصب نسخه production از خود مارکت
- تست update path
- بررسی crash/feedback
- ثبت known issues

---

## Phase 15 — Post-Launch Operations

**هدف:** تبدیل انتشار به یک فرایند تکرارپذیر.

- release checklist برای هر update
- versionCode automation
- release notes template
- store screenshots update policy
- backup signing key audit
- dependency/targetSdk periodic review
- 2027 Android Developer Verification readiness
- billing flavors در صورت اضافه شدن monetization
- rollout/rollback plan

---

# ترتیب بحرانی

مسیر بحرانی انتشار:

**Product Identity → Android Shell → Runtime Integration → Mobile QA → Signing → Privacy/Security → Content/Copyright → Store Assets → RC → Myket/Bazaar Submission**

تا Phase 5 بهتر است هیچ اقدام برگشت‌ناپذیر مانند انتشار عمومی یا گم‌کردن کنترل signing identity انجام نشود.
