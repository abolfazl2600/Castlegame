# وضعیت فعلی Castle Role برای انتشار Android

بررسی شده روی `main` در تاریخ 2026-09-27.

## آنچه اکنون وجود دارد

- Vite
- TypeScript
- Three.js
- production web build
- browser-based save/load
- responsive/mobile CSS در بخش‌هایی از UI
- regression scripts
- visual baseline tooling
- GitHub Pages deployment

## آنچه هنوز وجود ندارد

### Android platform
- `android/` project
- Capacitor / native wrapper
- AndroidManifest
- applicationId
- compileSdk / targetSdk / minSdk
- APK
- AAB
- 64-bit/native-library audit
- lifecycle bridge
- Android Back handling
- immersive mode
- adaptive icon / splash

### Release identity
- shared app-signing key
- Google Play upload key
- signing configuration
- certificate fingerprint record
- versionCode release policy

### Compliance
- public privacy policy
- in-app privacy entry
- data inventory
- Play Data safety declaration
- Google Play App content declarations
- IARC content rating questionnaire
- permission audit
- dependency/SDK audit
- copyright/license inventory

### Store preparation
- Google Play Console app
- Play package registration
- Play App Signing configuration
- Bazaar app entry
- Myket app entry
- final store icon exports
- Google Play feature graphic
- production screenshots
- localized store descriptions
- release notes package
- common release workflow

## Google Play deadline-sensitive items

در تاریخ این بررسی:

- از **2026-08-31** app جدید/update در Google Play باید Android 16 / API 36 یا بالاتر را target کند.
- از **2026-09-30** Play packageها باید با Android developer verification requirements ثبت شوند.
- اگر Play Console account شخصی بعد از 2023-11-13 ساخته شده باشد، قبل از production access باید closed test با حداقل 12 tester به مدت 14 روز پیوسته انجام شود.

## نتیجه

پروژه هنوز **Android app قابل submission نیست**، ولی معماری فعلی برای تبدیل با یک wrapper مشترک مناسب است.

## ریسک‌های ویژه Castle Role

### WebGL / GPU
Three.js به Android System WebView/GPU وابسته است؛ Adreno/Mali و context-loss باید تست شوند.

### Performance
NPC، Battle، terrain، shadows و settlementهای متراکم روی دستگاه‌های موبایل باید profile شوند.

### 64-bit
اگر dependency آینده native library اضافه کند، ABIهای آن باید 64-bit compatible باشند.

### Mobile UX
تمام flowهای اصلی باید touch-only قابل استفاده باشند.

### Save persistence
save باید در app kill، WebView recreation و app update پایدار بماند.

### Audio lifecycle
background/interruption نباید باعث ادامه ناخواسته موسیقی یا SFX شود.

### Content rating
Battle / siege / missile روی IARC و store presentation اثر دارد و باید صادقانه declare شود.

### Copyright
music، SFX، font، texture، icon، model و reference assets باید license روشن داشته باشند.

## Baseline نسخه 1.0

- Free
- no ads
- no login
- no IAP
- no external analytics
- offline-first
- landscape-first
- targetSdk 36
- minimal permissions
- same package ID and app-signing identity across all stores
