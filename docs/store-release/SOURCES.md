# منابع رسمی تحقیق انتشار

آخرین بررسی: **2026-09-27**

## Google Play / Android — منابع رسمی

### Target API requirement
https://developer.android.com/google/play/requirements/target-sdk

نکته فعلی:
- از 2026-08-31 app جدید/update باید Android 16 / API 36+ را target کند.

### Android App Bundle
https://developer.android.com/guide/app-bundle

نکته:
- از August 2021 appهای جدید Google Play باید با AAB منتشر شوند.

### App signing / multi-store key
https://developer.android.com/studio/publish/app-signing

https://developer.android.com/guide/app-bundle/faq

نکته:
- برای استفاده از یک signing key در چند store، Google توصیه می‌کند app-signing key خود developer به Play App Signing ارائه شود.

### Play App Signing
https://support.google.com/googleplay/android-developer/answer/9842756

### 64-bit requirement
https://developer.android.com/google/play/requirements/64-bit

### Create and set up app / listing text
https://support.google.com/googleplay/android-developer/answer/9859152

- app name <= 30 chars
- short description <= 80
- full description <= 4000

### Preview assets
https://support.google.com/googleplay/android-developer/answer/9866151

- Play icon 512×512 PNG
- feature graphic 1024×500
- min 2 screenshots
- games: 3× 1920×1080 landscape screenshots for relevant recommendation surfaces

### Data safety / User Data / Privacy Policy
https://support.google.com/googleplay/android-developer/answer/10144311

### Prepare app for review / App content
https://support.google.com/googleplay/android-developer/answer/9859455

### Content rating / IARC
https://support.google.com/googleplay/android-developer/answer/9898843

### Target audience
https://support.google.com/googleplay/android-developer/answer/9867159

### Sensitive permission declarations
https://support.google.com/googleplay/android-developer/answer/9214102

### Personal-account testing requirement
https://support.google.com/googleplay/android-developer/answer/14151465

- personal account created after 2023-11-13
- >=12 opted-in testers
- continuous >=14 days
- then production-access application

### Developer account information
https://support.google.com/googleplay/android-developer/answer/13628312

### Account type
https://support.google.com/googleplay/android-developer/answer/13634885

### Identity verification
https://support.google.com/googleplay/android-developer/answer/10841920

### Play Console Requirements
https://support.google.com/googleplay/android-developer/answer/10788890

### Package registration / Android developer verification
https://support.google.com/googleplay/android-developer/answer/16984799

نکته:
- از 2026-09-30 Play packages باید registered باشند.

### Payments policy
https://support.google.com/googleplay/android-developer/answer/9858738

https://support.google.com/googleplay/android-developer/answer/10281818

### Publishing/review status
https://support.google.com/googleplay/android-developer/answer/9859751

---

## Myket — منابع رسمی

### راهنمای انتشار
https://myket.ir/kb/pages/app-release/

### حساب توسعه‌دهنده
https://myket.ir/kb/pages/signup-account-fa/

### Target SDK 34
https://myket.ir/kb/pages/target-sdk-34/

### Permissions
https://myket.ir/kb/pages/permissions/

### Privacy / Security
https://myket.ir/kb/pages/privacy-security-access-info-fa/

### Payment rules
https://myket.ir/kb/pages/in-app-purchase-and-sale-rules-fa/

### Package name
https://myket.ir/kb/pages/select-package-name/

### Screenshots
https://myket.ir/kb/pages/choose-screenshots-for-your-app/

### Icon
https://myket.ir/kb/pages/choose-icon-for-your-app/

### Content
https://myket.ir/kb/pages/content-fa/

### App quality
https://myket.ir/kb/pages/app-quality-fa/

### App performance
https://myket.ir/kb/pages/app-performance-fa/

### Copyright
https://myket.ir/kb/pages/content-copyright-fa/

### Store page details
https://myket.ir/kb/pages/app-page-details-fa/

---

## Cafe Bazaar — منابع رسمی

### Policy updates entry point
https://developers.cafebazaar.ir/fa/app-publish-guidelines/policy-updates/

> بخشی از سایت developer بازار client-rendered است. requirementهای متغیر باید در روز submission مستقیم از پیشخان/سایت جاری تأیید شوند.

### Official developer channel
https://t.me/s/CafeBazaarDevelopers

اطلاعیه‌های استفاده‌شده:
- Android App Bundle support
- TWA/PWA support
- staged rollout
- review/update/security announcements

### AAB / TWA announcements
https://t.me/s/CafeBazaarDevelopers?before=261

---

## مواردی که قبل از submission هر release دوباره بررسی می‌شوند

### Google Play
- latest target API deadline
- latest Play policy declarations
- Play Billing version if monetized
- testing requirement applicability to account
- developer/package verification status

### Bazaar
- current account fee/contract
- current target SDK rule
- current APK/AAB policy
- exact graphics constraints
- current billing SDK/rules

### Myket
- current package format/size limit
- current target SDK rule
- current billing SDK/rules
- current listing fields

### مشترک
- Android Developer Verification changes
- store policy changes
- content/rating rules
- privacy/data disclosure requirements
