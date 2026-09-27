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

- `android/` project
- Capacitor / Cordova / TWA setup
- AndroidManifest
- applicationId
- compileSdk / targetSdk / minSdk
- APK
- AAB
- release signing
- keystore
- Android lifecycle bridge
- Android Back handling
- app icon resource set
- adaptive icon
- splash screen
- privacy policy artifact
- store listing package
- Bazaar/Myket release workflow

## نتیجه

پروژه در وضعیت فعلی **وب‌اپ** است، نه Android app قابل submission.

## ریسک‌های ویژه Castle Role

### 1. WebGL / GPU
Three.js به سازگاری WebView/GPU وابسته است؛ تست Adreno/Mali ضروری است.

### 2. حافظه و performance
NPCها، Battle، terrain، shadows و settlementهای متراکم می‌توانند روی موبایل فشار ایجاد کنند.

### 3. Mobile UX
بخش‌هایی از UI ابتدا برای desktop ساخته شده‌اند و باید روی touch-only review شوند.

### 4. Save persistence
Save فعلی باید در Android wrapper در برابر app kill، upgrade و WebView lifecycle تست شود.

### 5. Audio lifecycle
موسیقی/SFX باید در background یا interruption ادامه ناخواسته نداشته باشند.

### 6. Content review
Battle، siege، missile و destruction باید در Store presentation و رده‌بندی محتوا با احتیاط نمایش داده شوند.

### 7. Copyright
هر asset صوتی/تصویری/فونت/مدل/texture باید مالکیت یا license روشن داشته باشد.

## پیشنهاد baseline نسخه 1.0

برای کاهش ریسک اولین انتشار:

- بدون account/login
- بدون ads
- بدون analytics خارجی
- بدون IAP
- بدون sensitive permissions
- offline-first
- landscape-first

پس از انتشار پایدار v1 می‌توان monetization و telemetry را به‌صورت مرحله جدا اضافه کرد.
