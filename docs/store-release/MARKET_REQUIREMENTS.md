# مقایسه الزامات Google Play، کافه‌بازار و مایکت

> آخرین بررسی: 2026-09-27. موارد پویا در روز submission دوباره از console/panel رسمی بررسی می‌شوند.

## بسته انتشار

| مورد | Google Play | کافه‌بازار | مایکت | تصمیم Castle Role |
|---|---|---|---|---|
| APK برای production | app جدید با AAB منتشر می‌شود | پشتیبانی | مسیر مستند فعلی | APK برای ایرانی‌ها |
| AAB | **الزام app جدید** | پشتیبانی رسمی اعلام‌شده | راهنمای فعلی روی APK متمرکز است | AAB برای Play |
| TWA/PWA | ممکن، ولی مسیر ما نیست | پشتیبانی رسمی اعلام‌شده | مسیر اصلی مستند نیست | استفاده نشود |
| Android shell | لازم | قابل انتشار | قابل انتشار | Capacitor/local bundle |
| 64-bit | **الزام** | بهتر/سازگار | بهتر/سازگار | audit مشترک |

## Package ID

همه storeها:

- یک Package ID دائمی و یکتا.
- تغییر package بعد از انتشار عملاً app جدید ایجاد می‌کند.

Google Play:

- از 2026-09-30 package registration بخشی از Android developer verification است.
- package name و signing ownership باید ثبت/تأیید شود.

Myket:

- امکان رزرو package name قبل از APK مستند شده است.

Castle Role:

- **یک applicationId برای هر سه store**.

## Target SDK

### Google Play
از **2026-08-31**:

- app جدید و update باید Android 16 / **API 36+** را target کنند.

### Myket
از **1 Aban 1405**:

- `targetSdk < 34` برای app جدید/update پذیرفته نمی‌شود.

### Bazaar
آخرین requirement عددی باید در روز submission از قوانین/پیشخان جاری بررسی شود.

### Baseline مشترک
- **targetSdk 36**
- downgrade برای یکی از storeها انجام نمی‌دهیم.

## Signing

### Google Play
- app جدید AAB از Play App Signing استفاده می‌کند.
- AAB با Upload Key upload می‌شود.
- Google APK توزیعی را با App Signing Key امضا می‌کند.
- Google رسماً می‌گوید برای استفاده از همان signing key در چند store باید **اپ signing key خودمان را به Play ارائه کنیم**.

### Bazaar / Myket
- APK release با App Signing Key خودمان امضا می‌شود.

### Castle Role
دو key role:

1. **Cross-store App Signing Key** — بسیار حساس، دائمی، backup شده.
2. **Google Play Upload Key** — جدا و قابل reset در Play.

## Google Play developer account

دو نوع account:

### Personal
- legal identity/contact verification
- developer email عمومی
- برای accountهای ایجادشده بعد از 2023-11-13: حداقل **12 closed testers برای 14 روز پیوسته** قبل از درخواست production access.

### Organization
- D-U-N-S
- organization identity/address
- organization website
- contact information
- verification documents

انتخاب Personal/Organization باید در Phase 0 بر اساس وضعیت واقعی Publisher انجام شود.

## Permissions

Google Play:
- permissionهای high-risk/sensitive ممکن است Permissions Declaration و approval بخواهند.
- app بدون نیاز واقعی نباید sensitive permission درخواست کند.

Myket:
- permission باید مرتبط با core functionality باشد.

Castle Role v1:
- no Camera
- no Location
- no Microphone
- no Contacts
- no SMS
- no Call Log / Phone
- no broad external storage permission

## Privacy

### Google Play
برای **تمام appها**:

- Privacy Policy URL عمومی، فعال، non-geofenced و غیر PDF
- privacy policy داخل خود app
- تکمیل و به‌روز نگه داشتن Data safety
- disclosure تمام data access/collection/sharing شامل SDKها
- retention/deletion policy
- developer/app identification و privacy contact

### Myket
privacy/security/data handling باید با رفتار app متناسب باشد.

### Castle Role
یک Privacy Policy مشترک و یک data inventory مشترک.

## App content declarations — Google Play

قبل از review موارد زیر باید تکمیل شوند:

- Privacy Policy
- Ads declaration
- App access instructions
- Target audience and content
- sensitive permission declarations در صورت وجود
- Data safety
- Content rating / IARC
- سایر declarationهایی که Play Console برای app نشان می‌دهد

Castle Role v1:
- Ads: No
- Login/App access restriction: No
- Target audience باید بعد از content review تعیین شود
- Battle/Siege/Missile باید در IARC questionnaire دقیق اعلام شود

## Store listing

### Google Play
Product text:
- App name: max 30 chars
- Short description: max 80 chars
- Full description: max 4000 chars

Graphics:
- app icon: 512×512 PNG, max 1024 KB
- feature graphic: 1024×500 JPEG یا 24-bit PNG
- حداقل 2 screenshot برای publish
- حداکثر 8 screenshot برای هر device type
- برای game discovery: حداقل 3 landscape screenshots با حداقل 1920×1080 توصیه/شرط نمایش در برخی recommendation surfaces
- preview video اختیاری، ولی برای game توصیه می‌شود

### Myket
طبق راهنمای رسمی:
- Game type/category
- icon
- FA/EN titles
- description
- contact/email
- pricing
- version changelog
- حداقل 3 screenshot واقعی
- optional Aparat video

### Bazaar
فیلدها و asset constraints جاری در پیشخان دوباره بررسی می‌شوند.

### Master asset decision
برای Castle Role:
- master icon >= 1024×1024
- 7 screenshot master در 1920×1080 landscape
- Play feature graphic 1024×500
- localized FA/EN text set

## Content Rating

Google Play:
- تمام appها باید IARC content rating داشته باشند.
- questionnaire باید با محتوای واقعی تطبیق داشته باشد.

Castle Role:
- battle، siege، missile، destruction declare می‌شوند.
- gore/graphic violence برای v1 هدف نیست.

## Quality

Google Play:
- store listing باید دقیقاً قابلیت واقعی app را نشان دهد.
- اگر login/restricted content وجود داشته باشد review credentials لازم است.

Myket:
- crash/freeze/broken functionality می‌تواند موجب rejection شود.

Castle Role:
- یک QA gate مشترک قبل از هر سه submission.

## Monetization

### Google Play
برای digital goods/services در Play-distributed build، Google Play Billing لازم است مگر exception/program قانونی مربوط اعمال شود.

### Myket
digital goods -> Myket billing.

### Bazaar
در صورت IAP -> Bazaar billing طبق قوانین جاری.

### v1
Free + no IAP؛ پس billing SDK وارد build نمی‌شود.

## Review / Testing

### Google Play
- Internal testing اختیاری ولی توصیه‌شده.
- Closed testing برای personal accounts جدید طبق rule بالا ممکن است prerequisite production باشد.
- Open testing بعد از production access برای آن account scenario در دسترس است.
- review برخی accountها ممکن است تا 7 روز یا بیشتر در شرایط استثنایی طول بکشد؛ زمان را guarantee نمی‌کنیم.

### Myket
- review/install testing طبق فرایند رسمی.
- manual publish بعد از approval در راهنمای فعلی ذکر شده.

### Bazaar
- staged rollout اعلام شده.
- زمان review را در Roadmap hardcode نمی‌کنیم.

## Android Developer Verification

Google Play:

- از **2026-09-30** package registration requirement فعال است.
- identity verification + package registration باید انجام شود.

توزیع خارج Play:
- Android developer verification rollout برای certified devices در حال اجرا/گسترش است و در 2027 وسیع‌تر می‌شود.

بنابراین signing/package ownership از ابتدا cross-store مستند می‌شود.
