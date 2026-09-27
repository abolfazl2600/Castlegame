# Castle Role — Android Store Release Program

این فولدر مسیر آماده‌سازی و انتشار **Castle Role** در سه کانال اصلی Android را نگه می‌دارد:

- Google Play
- کافه‌بازار
- مایکت

> وضعیت تحقیق: 2026-09-27  
> هدف این مستندات: یک مسیر **مشترک و قابل تکرار** تا حد ممکن، با انشعاب فقط در بخش‌هایی که هر فروشگاه الزام متفاوت دارد.

## اصل معماری

Castle Role نباید سه اپ جداگانه شود.

مسیر پیشنهادی:

- یک codebase
- یک Android project
- یک `applicationId` / Package ID
- یک `versionCode` و `versionName` برای هر release
- یک **App Signing Key اصلی مشترک** برای هر سه فروشگاه
- یک Upload Key جدا برای Google Play
- یک privacy/data inventory مشترک
- یک مجموعه QA مشترک
- یک مجموعه master store assets
- خروجی `AAB` برای Google Play
- خروجی `APK` برای Myket
- خروجی `APK` یا `AAB` برای Bazaar بر اساس requirement جاری پیشخان

Google صراحتاً توصیه می‌کند اگر قرار است یک app در چند store با قابلیت cross-store update توزیع شود، هنگام تنظیم Play App Signing **کلید signing خودمان را ارائه کنیم** و نگذاریم Google یک app-signing key مستقل بسازد.

## وضعیت فعلی

Castle Role اکنون یک Vite + TypeScript + Three.js web game است. Android project هنوز ساخته نشده است.

## ساختار این فولدر

- [ROADMAP.md](./ROADMAP.md) — ترتیب مشترک از صفر تا انتشار در هر سه فروشگاه
- [COMMON_RELEASE_STRATEGY.md](./COMMON_RELEASE_STRATEGY.md) — تصمیم‌های مشترک و نقاطی که نباید store-specific شوند
- [CURRENT_STATUS.md](./CURRENT_STATUS.md) — وضعیت فعلی repo و gapها
- [MARKET_REQUIREMENTS.md](./MARKET_REQUIREMENTS.md) — مقایسه Google Play / Bazaar / Myket
- [GOOGLE_PLAY_REQUIREMENTS.md](./GOOGLE_PLAY_REQUIREMENTS.md) — الزامات اختصاصی فعلی Google Play
- [SOURCES.md](./SOURCES.md) — منابع رسمی و تاریخ بررسی

## Baseline مشترک نسخه 1.0

تا زمانی که در Phase 0 خلافش تصویب نشود:

- Free
- بدون Ads
- بدون Login
- بدون IAP
- بدون Analytics شخص ثالث
- Offline-first
- Landscape-first
- `targetSdk = 36`
- حداقل permission ممکن
- local bundled web assets داخل Android shell

## Secrets

هیچ مورد زیر نباید وارد Git شود:

- app-signing `.jks` / keystore
- upload-key keystore
- key passwords
- signing passwords
- Play Console service credentials
- Bazaar/Myket credentials
- billing secrets
- private API credentials

## Definition of Done نهایی

انتشار زمانی کامل است که:

1. یک release source revision برای هر سه store استفاده شود.
2. Package ID در هر سه store یکسان باشد.
3. final installed APKها با app-signing certificate مورد انتظار سازگار باشند.
4. AAB Google Play و APK ایرانی‌ها از همان version ساخته شوند.
5. save/load پس از kill و upgrade حفظ شود.
6. privacy/data declarations با رفتار واقعی app تطابق داشته باشند.
7. هیچ sensitive permission غیرضروری وجود نداشته باشد.
8. content/copyright review تکمیل شده باشد.
9. store listingهای هر سه فروشگاه با build واقعی هماهنگ باشند.
10. Google Play production requirements، Bazaar review و Myket review بدون blocker طی شوند.
11. نسخه production از خود هر سه store نصب و smoke-test شود.
12. update/rollback/release process برای نسخه بعدی مستند باشد.
