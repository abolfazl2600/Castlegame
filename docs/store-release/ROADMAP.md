# Roadmap مشترک انتشار Castle Role در Google Play، کافه‌بازار و مایکت

این Roadmap عمداً **shared-first** طراحی شده است. تا قبل از بسته‌بندی و submission، سه نسخه جدا از بازی نمی‌سازیم.

---

## Phase 0 — Product, Publisher & Store Account Freeze

**هدف:** تثبیت identity قبل از هر تصمیم برگشت‌ناپذیر.

تصمیم‌ها:

- نام نهایی app
- Publisher / Developer display name
- Package ID دائمی
- Personal vs Organization برای Google Play
- مدل درآمد v1
- orientation
- minSdk
- supported countries/languages
- support email
- privacy contact
- website/privacy hosting

Baseline v1:

- Free
- no Ads
- no Login
- no IAP
- no external Analytics
- Offline-first
- Landscape-first
- minimal permissions
- targetSdk 36

### کارهای account که می‌توانند همزمان شروع شوند

- Google Play developer account onboarding/verification
- Bazaar developer account
- Myket developer account

اگر Google Play account سازمانی است:
- D-U-N-S و website زود آماده شوند.

اگر Play personal account جدید است:
- closed-test requirement را از ابتدا در timeline لحاظ می‌کنیم.

**Deadline مهم:** از 2026-09-30 Play package registration requirement فعال است.

**Gate:** Product/Publisher identity و Package ID freeze شده باشند.

---

## Phase 1 — Common Android Foundation

**هدف:** تبدیل web game به Android app واقعی.

- Capacitor/native wrapper نهایی
- `android/`
- applicationId
- versionName/versionCode
- compileSdk / targetSdk / minSdk
- **targetSdk 36**
- local bundled Vite assets
- landscape
- fullscreen baseline
- adaptive icon baseline
- splash baseline
- debug APK
- release build skeleton
- AAB build skeleton

**Gate:** app بدون dev server روی device/emulator اجرا شود.

---

## Phase 2 — Android Runtime Integration

- Back button
- pause/resume
- background/foreground
- autosave on background
- audio focus/lifecycle
- screen lock/interruption
- WebView recreation
- safe areas/cutouts
- immersive mode
- touch/pointer
- update-safe save migration

**Gate:** kill/reopen/background/update state را خراب نکند.

---

## Phase 3 — Mobile UX

- Build
- Settings
- Templates
- Battle
- Military
- Population/Army sidebar
- minimap
- dialogs/modals
- touch target sizes
- no hover-only action
- no keyboard-only core action
- landscape small screen
- tablet

**Gate:** تمام gameplay اصلی touch-only قابل انجام باشد.

---

## Phase 4 — Performance, WebGL & 64-bit Compatibility

### Performance

- low/mid/high Android devices
- Adreno
- Mali
- Android 14/15/16
- low RAM
- dense settlement
- large battle
- long session
- thermal/battery
- context loss

### 64-bit

- APK/AAB native-library inventory
- arm64 compatibility
- third-party plugin ABI audit
- APK Analyzer check

**Gate:** release build روی device matrix بدون crash/freeze/blocker اجرا شود.

---

## Phase 5 — Cross-Store Signing & Package Ownership

**هدف:** یک signing identity برای هر سه store.

1. App Signing Key اصلی ایجاد شود.
2. دو backup امن ایجاد شود.
3. SHA-256 certificate ثبت شود.
4. Bazaar/Myket APK با آن key امضا شود.
5. Play App Signing با **همان key supplied by us** تنظیم شود.
6. Upload Key جدا برای Play ساخته شود.
7. Upload Key certificate در Play ثبت شود.
8. Package registration/verification انجام شود.

**ممنوع:** انتخاب تصادفی Google-generated Play signing key قبل از تصمیم multi-store.

**Gate:** APK local و Play-distributed artifact از app-signing identity مورد انتظار استفاده کنند.

---

## Phase 6 — Permission, Data, Privacy & Security Audit

Shared audit:

- AndroidManifest
- permissions
- network requests
- WebView settings
- localStorage/save
- SDK data behavior
- dependency audit
- secrets scan
- HTTPS usage
- privacy inventory
- retention/deletion

Outputs:

- public Privacy Policy
- in-app Privacy entry
- data inventory
- Google Play Data safety answers
- store privacy metadata

**Gate:** هر data flow و permission مستند باشد.

---

## Phase 7 — Content, Audience, Rating & Copyright

- violence/battle facts
- gore check
- missile/destruction presentation
- historical references
- trademark/name check
- music/SFX/font/texture/icon/model licenses
- open-source attributions
- Google Play IARC questionnaire facts
- Google Play target audience decision
- Bazaar/Myket content declarations

**Gate:** rating answers و asset ownership قابل دفاع باشند.

---

## Phase 8 — Shared Store Identity & Asset Production

Master package:

- brand/app name
- master icon >= 1024×1024
- adaptive icon
- FA title
- EN title
- FA description
- EN description
- short description
- support email
- privacy URL
- release notes
- 7 real gameplay screenshots 1920×1080 landscape

Play-specific export:

- icon 512×512
- feature graphic 1024×500
- screenshot alt text
- optional YouTube gameplay trailer

**Gate:** هیچ screenshot یا text قابلیت غیرواقعی نشان ندهد.

---

## Phase 9 — Monetization Architecture Decision

v1:
- no billing SDK

اگر آینده IAP:

- shared PurchaseProvider interface
- Play flavor -> Google Play Billing
- Bazaar flavor -> Bazaar Billing
- Myket flavor -> Myket Billing
- same gameplay entitlement model

**Gate:** build هر store policy payment خودش را رعایت کند.

---

## Phase 10 — Common Release Candidate

از یک Git SHA:

- signed release APK
- release AAB
- same package ID
- same versionCode/versionName
- no debug flag
- no dev URL
- no secrets
- local assets only
- install smoke test
- upgrade smoke test
- save migration
- signature verification
- APK/AAB analysis
- SHA-256 artifacts recorded

**Gate:** RC freeze شود؛ هر code change نیازمند RC جدید است.

---

## Phase 11 — Google Play Preparation & Testing

### Account
- developer verification
- package registration
- account type requirements

### App setup
- create app
- configure Play App Signing with our cross-store key
- register separate Upload Key

### App content
- Privacy Policy
- Data safety
- Ads declaration
- App access
- Target audience
- IARC content rating
- permission declarations if applicable

### Listing
- 30-char name
- 80-char short description
- 4000-char full description
- Play icon
- feature graphic
- screenshots
- optional trailer

### Testing
- Internal test
- Closed test
- اگر personal account مشمول rule است: 12 tester / 14 continuous days
- request production access

**Gate:** Play Console production submission unlocked و AAB validation clean.

---

## Phase 12 — Cafe Bazaar Preparation

- account/contract verification
- app entry
- package identity
- current target/API rule recheck
- current package format recheck
- APK یا AAB upload
- listing
- privacy/contact
- rating/content forms
- rollout settings

**Gate:** Bazaar validation clean.

---

## Phase 13 — Myket Preparation

- account/identity
- package reservation/registration
- APK upload
- Game/category
- icon
- FA/EN titles
- description
- support email
- pricing
- changelog
- >=3 real screenshots
- optional Aparat video
- final review fields

**Gate:** Myket validation clean.

---

## Phase 14 — Parallel Submission & Review

هر سه submission باید به یک release record اشاره کنند.

ثبت می‌کنیم:

- store
- submitted artifact
- versionCode
- SHA
- submission time
- review state
- rejection reason
- corrective action

اگر binary عوض شود:

- versionCode جدید
- RC جدید
- artifact hashes جدید
- سه-store impact review

**Gate:** approval در هر سه channel یا exception مستند.

---

## Phase 15 — Launch

- controlled/manual rollout where available
- production install از خود Google Play
- production install از Bazaar
- production install از Myket
- verify package/signature/version
- smoke gameplay
- save/update check
- listing check
- support channel check

**Gate:** هر سه production path سالم.

---

## Phase 16 — Post-Launch Operations

- versionCode automation
- common release checklist
- Play target API annual review
- Android developer verification review
- privacy/Data safety updates
- screenshot/listing sync
- key backup audit
- dependency updates
- staged rollout/rollback
- crash/feedback triage
- billing flavors if monetization starts

---

# Critical Shared Path

**Identity → Package ID → Android Foundation → Runtime → Mobile QA → Performance/64-bit → Shared Signing → Privacy/Data → Content/Rating → Assets → Common RC**

فقط بعد از این نقطه مسیرها جدا می‌شوند:

```
                         ┌─ Google Play: AAB + Play Console/Test tracks
Common Release Candidate ├─ Bazaar: APK/AAB + Pishkhan
                         └─ Myket: APK + Myket panel
```

هدف این است که هیچ fix فنی برای یک store به fork دائمی gameplay تبدیل نشود.
