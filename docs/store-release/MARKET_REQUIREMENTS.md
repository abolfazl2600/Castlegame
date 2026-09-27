# مقایسه الزامات کافه‌بازار و مایکت

> این فایل الزامات پایدار و مواردی را که باید در روز submission دوباره از پنل تأیید شوند جدا می‌کند.

## بسته انتشار

| مورد | کافه‌بازار | مایکت | تصمیم Castle Role |
|---|---|---|---|
| APK | پشتیبانی | مسیر اصلی مستند انتشار | تولید شود |
| AAB | پشتیبانی رسمی اعلام شده | در راهنمای فعلی انتشار APK ذکر شده | برای Bazaar اختیاری |
| TWA/PWA | پشتیبانی رسمی اعلام شده | مسیر مستند اصلی نیست | برای v1 انتخاب نشود |
| Android shell | قابل انتشار | قابل انتشار | مسیر پیشنهادی |

## Package identity

- Package name باید دائمی و یکتا باشد.
- مایکت امکان رزرو شناسه قبل از آماده شدن APK را مستند کرده است.
- برای هر دو مارکت از همان applicationId استفاده می‌کنیم مگر دلیل فنی مستند برای flavor متفاوت وجود داشته باشد.
- signing identity باید برای updateهای آینده حفظ شود.

## Target SDK

### مایکت
اعلام رسمی ۱۴۰۵/۰۴/۲۱:

- از **۱ آبان ۱۴۰۵** برنامه جدید یا update با `targetSdk < 34` قابل انتشار نیست.

### کافه‌بازار
در این تحقیق requirement عددی جدیدی که به‌اندازه اطلاعیه مایکت قابل استناد باشد پیدا نشد؛ قبل از submission از پیشخان/قوانین جاری بازار دوباره بررسی شود.

### تصمیم پیشنهادی پروژه
- هدف: API 36 در صورت compatibility کامل
- hard floor فعلی برای Myket بعد از deadline: API 34

## Signing

Android release APK باید امضاشده باشد.

قواعد داخلی پروژه:

- keystore هرگز commit نشود
- backup امن داشته باشد
- certificate fingerprint ثبت شود
- updateها با همان signing identity ساخته شوند

## Permissions

مایکت صراحتاً اعلام می‌کند permission باید مرتبط با عملکرد واقعی برنامه باشد و permission غیرمرتبط می‌تواند مانع انتشار شود.

برای v1 Castle Role هدف:

- بدون Camera
- بدون Location
- بدون Microphone
- بدون Contacts
- بدون SMS
- بدون Phone
- بدون broad storage access

هر permission اضافه باید در Release Audit توضیح داشته باشد.

## Privacy & Security

مایکت:

- app توسط ابزارهای امنیتی/آنتی‌ویروس بررسی می‌شود
- داده کاربران باید با permission و policy متناسب مدیریت شود
- SDKها و WebView باید از نظر امنیت بررسی شوند

Castle Role:

- Privacy Policy حتی در حالت data-minimal ساخته شود
- data inventory نوشته شود
- مشخص شود save فقط local است یا sync/network هم وجود دارد
- remote URLs و SDKهای شخص ثالث audit شوند

## Quality & Functionality

مایکت:

- برنامه روی دستگاه‌های Android نصب و تست می‌شود
- crash، force close، freeze و loading گیرکرده می‌توانند موجب رد شوند
- دکمه/feature بدون عملکرد باید حذف شود یا واضحاً «به‌زودی» باشد
- incompatibilityهای شناخته‌شده باید شفاف اعلام شوند

Castle Role:

- mobile QA باید قبل از submission اجباری باشد
- هر placeholder یا button ناقص باید حذف/label شود

## Store Listing — Myket

طبق راهنمای رسمی فعلی:

- نوع برنامه/بازی
- category
- icon
- عنوان فارسی و انگلیسی
- توضیحات
- contact information
- email اجباری
- pricing
- version changelog اجباری
- screenshots
- حداقل 3 screenshot واقعی از داخل app/game
- optional video از Aparat

## Store Listing — Bazaar

موارد دقیق UI پیشخان ممکن است تغییر کند؛ در مرحله submission از پنل جاری برداشت نهایی انجام می‌شود.

دارایی مشترک از قبل آماده خواهد شد:

- icon
- title FA/EN
- descriptions
- contact/support
- screenshots
- release notes
- privacy URL
- category/content declarations

## Content

مایکت قوانین محتوایی صریح دارد و نمایش محتوای خشونت‌آمیز حساس است.

برای Castle Role:

- battle به‌صورت stylized نگه داشته شود
- gore اضافه نشود
- store screenshots روی build/strategy تمرکز کنند
- missile/weapon نباید به آموزش استفاده واقعی تبدیل شود
- از نمادهای ممنوع و محتوای گروه‌های تروریستی اجتناب شود

## Copyright

مایکت صراحتاً مالکیت/مجوز محتوا، نام‌ها، تصاویر، صوت و open-source licenseها را بررسی می‌کند.

قبل از submission باید inventory داشته باشیم برای:

- code libraries
- textures
- fonts
- music
- sound effects
- icons
- images
- 3D/reference assets
- historical visual material

## Monetization

### Myket
برای محصولات/خدمات دیجیتال:

- پرداخت باید از Myket IAP باشد
- مسیر پرداخت موازی/خارجی برای محصول دیجیتال پذیرفته نیست
- اگر app رایگان منتشر شود، همان listing بعداً قابل تبدیل به paid app نیست

### Bazaar
اگر IAP اضافه شود، flavor بازار باید integration بازار را داشته باشد و قوانین جاری پرداخت بازار در زمان implementation دوباره بررسی شود.

### پیشنهاد v1
Free + no IAP.

## Review / Release Controls

مایکت:
- manual publish option بعد از approval دارد
- در مستند فعلی سقف اعلام‌شده بررسی تا 3 روز کاری است

بازار:
- staged rollout در پیشخان اعلام شده
- auto-update publishing برای بسیاری از updateها اعلام شده
- SLA یا زمان review را در Roadmap ثابت نکرده‌ایم چون اطلاعیه‌های قدیمی قابل اتکای بلندمدت نیستند

## Android Developer Verification

Android از 2026 rollout منطقه‌ای verification را شروع کرده و برای 2027 گسترش جهانی به تمام اپ‌های دستگاه‌های certified را برنامه‌ریزی کرده است.

برای توزیع خارج Google Play:

- developer identity
- package registration
- signed APK / signing ownership

باید در برنامه بلندمدت release در نظر گرفته شود.

این مورد در 2026 برای بازار/مایکت blocker فوری اثبات‌شده نیست، اما نباید تا 2027 نادیده گرفته شود.
