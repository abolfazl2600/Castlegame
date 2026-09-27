# استراتژی مشترک انتشار در Google Play، کافه‌بازار و مایکت

## اصل اول: یک محصول، نه سه fork

Castle Role باید تا جای ممکن یک binary family داشته باشد.

### Shared

- source code
- Android project
- applicationId
- minSdk / targetSdk / compileSdk
- app-signing identity
- versionCode
- versionName
- local game assets
- save schema
- permissions
- privacy policy
- data inventory
- content rating facts
- core screenshots
- QA matrix

### Store-specific

- output format
- Play App Signing upload workflow
- store listing fields
- billing provider در صورت اضافه شدن IAP
- store-specific release tracks/rollout
- store-specific policy questionnaires

## Package ID

یک Package ID برای تمام فروشگاه‌ها انتخاب می‌شود.

نمونه ساختار:

`com.<publisher>.castlerole`

پس از اولین انتشار تغییر Package ID معادل ساخت app جدید است؛ بنابراین در Phase 0 freeze می‌شود.

## Signing strategy — تصمیم بحرانی

Android update فقط زمانی می‌تواند روی install موجود قرار بگیرد که certificate سازگار باشد.

بنابراین برای پشتیبانی صحیح چند فروشگاه:

1. یک **App Signing Key اصلی** توسط خودمان ایجاد می‌شود.
2. Bazaar/Myket APK با همین App Signing Key امضا می‌شوند.
3. هنگام تنظیم Google Play App Signing، copy همین App Signing Key را به Google ارائه می‌کنیم.
4. برای upload به Play یک **Upload Key جدا** می‌سازیم.
5. Google AAB را با Upload Key می‌پذیرد و APKهای Play را با App Signing Key اصلی توزیع می‌کند.

نتیجه:

- certificate identity در هر سه channel هماهنگ می‌ماند.
- cross-store update از نظر Android signature ممکن می‌ماند.
- گم‌شدن Upload Key Play قابل reset است بدون تغییر app-signing identity.

**نباید** برای app جدید اجازه دهیم Play یک signing identity مستقل بسازد، مگر اینکه آگاهانه بخواهیم Play install با دو store دیگر signature-compatible نباشد.

## Build outputs

برای یک release واحد:

```
Source revision
  ├── release AAB  -> Google Play
  └── release APK  -> Myket + Bazaar
```

اگر Bazaar در زمان submission AAB را ترجیح داد، AAB همان release نیز قابل استفاده است؛ تصمیم نهایی با requirement جاری پیشخان گرفته می‌شود.

## API baseline

به دلیل الزام Google Play از 2026-08-31:

- **targetSdk = 36 حداقل مشترک پروژه برای submission جدید**
- compileSdk باید با target انتخاب‌شده سازگار باشد.
- Myket minimum اعلام‌شده از 1 Aban 1405 برابر API 34 است، اما مسیر مشترک ما 36 خواهد بود.
- requirement بازار قبل از submission دوباره بررسی می‌شود؛ مسیر مشترک نباید target را برای بازار پایین بیاورد.

## Architecture / 64-bit

Google Play apps باید 64-bit support داشته باشند.

Capacitor/Java/Kotlin shell به‌خودی‌خود مانع نیست، اما هر dependency دارای native `.so` باید audit شود:

- اگر `armeabi-v7a` وجود دارد، `arm64-v8a` counterpart لازم است.
- اگر x86 native libraries وارد build شوند، x86_64 compatibility بررسی شود.
- APK/AAB Analyzer در RC استفاده شود.

این audit به نفع Myket و Bazaar هم هست و مشترک اجرا می‌شود.

## Store asset strategy

Master assets یک‌بار تولید می‌شوند.

### مشترک

- source icon: حداقل 1024×1024
- Android adaptive icon foreground/background
- 7 screenshot master در landscape
- title FA / EN
- description FA / EN
- support email
- privacy URL
- release notes

### Google Play export

- Play icon: 512×512 PNG
- Feature graphic: 1024×500 JPEG/PNG
- حداقل 2 screenshot برای publish
- برای game discovery بهتر: حداقل 3 landscape screenshot با 1920×1080 یا بالاتر
- حداکثر 8 screenshot per supported device type

### تصمیم Castle Role

Master screenshotها را **1920×1080 landscape** می‌گیریم تا هم requirement/recommendation Play را پوشش دهد و هم از همان source برای دو مارکت ایرانی export کنیم.

## Privacy strategy

یک Privacy Policy عمومی برای هر سه store.

Google Play حتی برای app بدون personal/sensitive data نیز privacy policy می‌خواهد و Data safety form هم باید تکمیل شود.

بنابراین privacy work از ابتدا مشترک است:

- data inventory
- local storage inventory
- network inventory
- SDK inventory
- retention/deletion statement
- contact point
- public HTTPS privacy page
- in-app Privacy entry

## Account strategy

Store accounts مستقل‌اند اما باید زود شروع شوند چون verification ممکن است زمان‌بر باشد.

### Google Play

- Personal یا Organization باید در Phase 0 مشخص شود.
- Organization نیازمند D-U-N-S و website است.
- identity/contact verification لازم است.
- برای personal accounts ایجادشده بعد از 2023-11-13، production access نیازمند closed test با حداقل 12 tester برای 14 روز پیوسته است.

### Bazaar / Myket

ثبت‌نام/احراز هویت و قراردادها همزمان با مراحل فنی شروع شوند تا انتهای QA blocker اداری نداشته باشیم.

## Monetization architecture

v1 بدون IAP است.

اگر بعداً IAP اضافه شود، یک interface مشترک ساخته می‌شود و provider در build/store channel انتخاب می‌شود:

- Google Play -> Google Play Billing
- Bazaar -> Bazaar Billing
- Myket -> Myket Billing

core gameplay نباید مستقیماً به SDK یک store وابسته شود.

## Release identity

هر release یک رکورد مشترک دارد:

- Git commit SHA
- versionName
- versionCode
- package ID
- app-signing SHA-256
- APK SHA-256
- AAB SHA-256
- privacy-policy revision
- store metadata revision

این رکورد مرجع هر سه submission خواهد بود.
