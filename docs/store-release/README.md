# Castle Role — Bazaar & Myket Release Program

این فولدر مسیر آماده‌سازی و انتشار **Castle Role** در **کافه‌بازار** و **مایکت** را نگه می‌دارد.

> وضعیت تحقیق: 2026-09-27  
> این مستندات «نقشه راه سطح بالا» هستند. جزئیات اجرایی هر مرحله در مرحله بعدی تکمیل می‌شوند.

## هدف

رسیدن از وضعیت فعلی پروژه — یک بازی وب مبتنی بر Vite + TypeScript + Three.js — به یک نسخه Android پایدار، امضاشده و قابل انتشار در هر دو مارکت.

## تصمیم معماری پیشنهادی

برای مسیر مشترک بازار و مایکت:

- **Android shell با Capacitor**
- bundle شدن خروجی Vite داخل APK/AAB
- عدم وابستگی نسخه اول به یک وب‌سایت remote برای اجرای بازی
- یک Package ID ثابت برای هر دو مارکت
- یک signing identity پایدار برای تمام آپدیت‌های آینده
- خروجی APK برای مایکت
- APK یا AAB برای بازار، پس از تأیید نهایی در پیشخان

این انتخاب در این مرحله «پیشنهاد اجرایی» است و قبل از implementation نهایی در Phase 1 تثبیت می‌شود.

## ساختار این فولدر

- [ROADMAP.md](./ROADMAP.md) — ترتیب مراحل از وضعیت فعلی تا انتشار
- [CURRENT_STATUS.md](./CURRENT_STATUS.md) — وضعیت فعلی repo و gapهای انتشار
- [MARKET_REQUIREMENTS.md](./MARKET_REQUIREMENTS.md) — تفاوت‌ها و الزامات بازار/مایکت
- [SOURCES.md](./SOURCES.md) — منابع رسمی و تاریخ بررسی

## اصل مهم

هیچ secret انتشار نباید وارد Git شود:

- keystore / .jks
- keystore password
- signing key passwords
- Bazaar/Myket API tokens
- billing secrets / private credentials

این موارد باید خارج از repo یا در Secret Store/CI Secrets نگهداری شوند.

## Definition of Done نهایی

انتشار فقط زمانی «آماده» محسوب می‌شود که:

1. release APK روی چند دستگاه واقعی Android نصب و اجرا شود.
2. save/load پس از kill و update حفظ شود.
3. هیچ permission غیرضروری وجود نداشته باشد.
4. privacy/content/copyright review تکمیل شده باشد.
5. Store listing و screenshots با نسخه واقعی هماهنگ باشند.
6. package ID و signing key نهایی و backup شده باشند.
7. نسخه نهایی در هر دو پنل بدون blocker ارسال شود.
8. بعد از انتشار، مسیر update/rollback مشخص باشد.
