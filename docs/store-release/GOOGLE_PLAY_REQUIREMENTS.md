# الزامات اختصاصی Google Play برای Castle Role

آخرین بررسی: **2026-09-27**

این فایل از مستندات رسمی Android Developers و Play Console Help تهیه شده است.

## 1. Developer account

Google Play دو account type دارد:

### Personal
نیازمند اطلاعات هویتی و contact verification.

اگر account شخصی **بعد از 2023-11-13** ساخته شده باشد، قبل از production access باید:

- یک Closed Test اجرا شود.
- حداقل 12 tester opt-in باشند.
- این 12 tester حداقل 14 روز پیوسته opt-in بمانند.
- سپس Production Access request ارسال شود و سوالات testing/readiness پاسخ داده شوند.

### Organization
نیازمند مواردی از جمله:

- D-U-N-S number
- organization name/address
- organization website
- contact information
- developer public contact information
- identity/organization verification documents در صورت درخواست

D-U-N-S ممکن است تا حدود 30 روز زمان ببرد؛ اگر Publisher سازمانی است باید زود شروع شود.

## 2. Package registration deadline

از **2026-09-30** تمام Play packageها باید با Android developer verification requirements ثبت شوند.

برای Castle Role:

- Package ID باید قبل از این مرحله freeze شده باشد.
- identity verification باید کامل باشد.
- package ownership/signing certificate باید ثبت شود.

## 3. Target API

از **2026-08-31**:

- app جدید و update باید Android 16 / API 36 یا بالاتر را target کند.

بنابراین Castle Role:

- `targetSdk = 36` baseline مشترک.
- compile SDK مناسب API 36.
- اگر API requirement بعداً افزایش پیدا کرد، release checklist باید آن را detect کند.

## 4. Android App Bundle

از August 2021 appهای جدید Google Play باید با **Android App Bundle (AAB)** منتشر شوند.

AAB قابل نصب مستقیم نیست؛ Play از آن device-specific APK تولید می‌کند.

Castle Role release build باید هر بار هر دو artifact را تولید کند:

- `.aab` برای Play
- `.apk` برای Bazaar/Myket و device QA

## 5. Play App Signing و multi-store signing

برای app جدید، Play App Signing بخشی از مسیر AAB است.

Google دو نقش کلید دارد:

### App Signing Key
کلیدی که APK نصب‌شده روی device با آن امضا می‌شود.

### Upload Key
کلیدی که developer با آن AAB را برای upload به Play امضا می‌کند.

برای Castle Role چون در چند store منتشر می‌شود:

- App Signing Key را خودمان ایجاد می‌کنیم.
- همان key را برای Bazaar/Myket APK نگه می‌داریم.
- هنگام Play App Signing، copy همان App Signing Key را به Google ارائه می‌کنیم.
- یک Upload Key جدا برای Play می‌سازیم.

Google صراحتاً می‌گوید اگر می‌خواهید همان signing key را در چند store استفاده کنید، key خودتان را به Play بدهید و Google-generated app signing key را انتخاب نکنید.

**این تصمیم باید قبل از open testing یا production Play نهایی باشد.**

## 6. 64-bit

Google Play apps باید 64-bit architecture support داشته باشند.

اگر APK/AAB native library داشته باشد:

- ARM 32-bit `armeabi-v7a` باید counterpart `arm64-v8a` داشته باشد.
- native x86 باید x86_64 compatibility داشته باشد.

Castle Role اکنون JavaScript/Three.js است، اما Capacitor plugins یا SDKهای آینده ممکن است `.so` وارد کنند؛ RC باید APK Analyzer/native-lib audit داشته باشد.

## 7. Privacy Policy

Google Play برای همه appها Privacy Policy می‌خواهد، حتی appی که personal/sensitive user data جمع نمی‌کند.

Policy باید:

- public URL داشته باشد
- active باشد
- non-geofenced باشد
- PDF نباشد
- داخل app هم قابل دسترسی باشد
- app/developer identity را مشخص کند
- data access/collection/use/sharing را توضیح دهد
- retention/deletion policy داشته باشد
- privacy contact داشته باشد

## 8. Data safety

برای هر app باید Data safety section تکمیل و دقیق نگهداری شود.

Developer مسئول declaration تمام data collection/sharing است، از جمله data جمع‌آوری‌شده توسط SDKهای third-party.

برای Castle Role قبل از تکمیل form باید inventory داشته باشیم:

- local save data
- device/app identifiers
- crash reporting اگر اضافه شد
- analytics اگر اضافه شد
- network requests
- billing data اگر اضافه شد
- SDK data behavior

## 9. App Content

Play Console قبل از review declarationهای مختلف می‌خواهد.

برای Castle Role حداقل:

- Privacy Policy
- Ads: No برای v1
- App access: no restricted login برای v1
- Target audience and content
- Data safety
- Content rating
- sensitive permissions declaration فقط اگر بعداً permission حساس اضافه شود

## 10. IARC Content Rating

تمام appها در Google Play باید content rating داشته باشند.

Play Console questionnaire باید صادقانه پاسخ داده شود.

برای Castle Role موارد مرتبط:

- fantasy/stylized battle
- siege
- projectile combat
- missile/destruction
- عدم gore در baseline v1

Target audience بعد از پاسخ به content facts تعیین می‌شود؛ نباید صرفاً برای rating پایین‌تر گزینه‌های نادرست انتخاب شوند.

## 11. Store Listing

### Text

- App name: max 30 characters
- Short description: max 80 characters
- Full description: max 4000 characters

Metadata نباید:

- misleading باشد
- keyword spam داشته باشد
- ranking claim مثل #1/Best داشته باشد
- price/promotion claim نامناسب داشته باشد

### Icon

- 512×512
- 32-bit PNG with alpha
- max 1024 KB

### Feature graphic

الزامی برای publish Store Listing:

- 1024×500
- JPEG یا 24-bit PNG بدون alpha

### Screenshots

- حداقل 2 screenshot برای publish
- JPEG یا 24-bit PNG
- min dimension: 320 px
- max dimension: 3840 px
- max dimension نباید بیش از 2 برابر min dimension باشد
- تا 8 screenshot برای هر supported device type

برای game recommendation surfaces:

- حداقل 3 landscape screenshots
- حداقل 1920×1080
- actual gameplay

تصمیم Castle Role: 7 screenshot واقعی 1920×1080 landscape.

### Preview video

اختیاری ولی برای games توصیه شده:

- YouTube URL
- public یا unlisted
- embeddable
- بدون age restriction
- monetization/ads خاموش
- gameplay واقعی در ابتدای video

## 12. Target Audience

Target audience declaration اجباری است.

اگر children جزو target audience باشند، Families Policy الزامات اضافی ایجاد می‌کند.

Castle Role باید age target را بر اساس محتوای واقعی و positioning نهایی انتخاب کند؛ تصمیم آن در Content Review گرفته می‌شود.

## 13. Sensitive permissions

اگر bundle permissionهای high-risk/sensitive مثل SMS/Call Log بخواهد، Play می‌تواند Permissions Declaration Form، supported use-case و حتی video demonstration بخواهد.

Baseline v1 Castle Role چنین permissionهایی ندارد.

## 14. Billing

اگر Play build بعداً digital goods یا قابلیت دیجیتال بفروشد:

- Google Play Billing باید استفاده شود مگر exception/program رسمی قابل اعمال باشد.

برای v1:

- app رایگان
- no IAP
- no Play Billing dependency

## 15. Testing tracks

پیشنهاد مسیر Play:

1. Internal testing
2. Closed testing
3. Production access اگر account مشمول rule personal-account باشد
4. Production

Play Store listing across test tracks مشترک است، پس metadata باید حتی برای testing قابل قبول باشد.

## 16. Production review

قبل از review:

- app metadata کامل
- privacy + Data safety کامل
- IARC کامل
- audience declaration کامل
- access instructions دقیق
- AAB targetSdk 36
- Play App Signing صحیح
- versionCode جدید
- 64-bit compatible
- بدون debug/dev endpoint

Google اعلام می‌کند برخی reviewها ممکن است تا 7 روز یا بیشتر در شرایط استثنایی طول بکشند؛ release planning نباید روی review فوری فرض کند.

## 17. Castle Role Google Play Gate

قبل از production:

- [ ] Play developer account verified
- [ ] Package ID registered
- [ ] targetSdk 36+
- [ ] AAB generated
- [ ] shared app-signing key supplied to Play
- [ ] separate upload key registered
- [ ] 64-bit audit passed
- [ ] Privacy Policy live + in-app
- [ ] Data safety completed
- [ ] Ads declaration completed
- [ ] App access declaration completed
- [ ] Target audience completed
- [ ] IARC rating completed
- [ ] Store Listing complete
- [ ] 512×512 Play icon
- [ ] 1024×500 feature graphic
- [ ] production screenshots
- [ ] personal-account closed-test requirement satisfied if applicable
- [ ] release AAB installed/tested through Play testing track
