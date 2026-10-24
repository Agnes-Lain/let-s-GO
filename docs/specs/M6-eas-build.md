# M6 — EAS Build, Play internal testing (Android first)

Status: **PO-approved 2026-10-24** with all §10 defaults (package `com.agneslain.letsgo`, support email = placeholder `<support email>` the PO fills in before submitting, target audience 13+). **PO change 2026-10-24: Google Play only for now; no Apple App Store / TestFlight (Apple's 99 USD/year is too much for a beta).** iOS keeps only harmless config so it can be added later. Last M6 roadmap item (`docs/ROADMAP.md` line 51).

## 0. In plain words
Today the app runs only inside Expo Go. After this item it is a real Android app ("Let's GO" with
its own icon and splash) that you and invited testers install from **Google Play internal
testing** (or, even sooner, from a direct APK link). Along the way the app gets its permanent
store identity (package name), fast on-device storage (MMKV), a proper splash screen, a privacy
page and the Play store texts. Some steps only you can do (accounts, payment, passwords, ID
check). Claude never types your passwords and never runs `eas build` / `eas submit` without
your explicit "go". Your iPhone keeps working with Expo Go as today.

## 1. Goal
The PO and invited testers install a signed "Let's GO" build on Android phones from Play
internal testing, and every lesson, game and setting works offline with progress saved on the
device.

## 2. User stories
1. As the PO, I want to install the real app on an Android phone (APK link first, then Play
   internal testing) so that testers can try it without Expo Go.
2. As the PO, I want to keep testing in Expo Go on my iPhone, with nothing broken.
3. As the PO, I want a step-by-step checklist of what only I can do (Google account, 25 USD fee,
   identity check, Play Console forms) so that I am never blocked or surprised by a fee.
4. As a tester, I want to join with a link from my Google account and install from the Play
   Store app, and get updates automatically.
5. As a beginner, I want a calm splash and my progress kept after closing the app.
6. As a privacy-minded learner or parent, I want a plain page saying the app collects nothing,
   in 中文 / English / Français.
7. As the PO, I want Play store texts ready in three languages so that I only copy and paste.
8. As the PO, I want nothing spent, submitted or published by accident.

## 3. Decisions taken in this spec (defaults; see §10 to overturn)
- Package name: `com.agneslain.letsgo` (Android; the same id is written for iOS for later).
- Android only for builds and store work. Portrait only; light only. iOS config is kept
  minimal (`bundleIdentifier`, `supportsTablet: false`, encryption flag) and never built.
- Android: a `preview` APK for quick installs (no Play account needed), then a `production`
  AAB uploaded to Play **internal testing**.
- EAS-managed credentials (signing keys kept by Expo, you do not handle certificates).
- Privacy policy: text kept in the repo (`docs/privacy-policy.md`); because this repo is private, it is published from a tiny separate **public** repo `Agnes-Lain/lets-go-privacy` with GitHub Pages (free).
- Category: Education (secondary: Board games, optional).

## 4. Acceptance criteria
Tags: [J] Jest test, [F] file/command check by QA, [PO] only the PO can verify.

### 4.1 EAS configuration (`eas.json`)
1. [F/J] `eas.json` exists at the repo root, valid JSON, with `cli.version` set to a `>=`
   constraint (developer writes the current major, checked with `eas --version`) and
   `cli.appVersionSource` = `"remote"`.
2. [J] Profile `development`: `developmentClient: true`, `distribution: "internal"`,
   Android `buildType: "apk"`.
3. [J] Profile `preview`: `distribution: "internal"`, Android `buildType: "apk"`, no
   `developmentClient`; channel `preview`.
4. [J] Profile `production`: `autoIncrement: true`, `distribution` store (default), Android
   `buildType: "app-bundle"`; channel `production`.
5. [J] `submit.production.android` has `track: "internal"` and `releaseStatus: "draft"`,
   and no secret is committed: no password, no service-account
   JSON in the repo (`.gitignore` lists `*service-account*.json`); no `ios` submit block.
6. [F] `expo-dev-client` is a dependency (needed by `development`); the developer states why in
   the PR description (CLAUDE.md rule 8).

### 4.2 `app.json`
7. [J] `expo.android.package` and (for later) `expo.ios.bundleIdentifier` both equal the id chosen in §10
   (default `com.agneslain.letsgo`); both match `^[a-z][a-z0-9]*(\.[a-z][a-z0-9_]*)+$`.
8. [J] `expo.version` = `0.1.0`. With `appVersionSource: "remote"` and `autoIncrement`, EAS
   raises Android `versionCode` (Play rejects a repeated one) on each production build; it is
   not written in `app.json`, nor is iOS `buildNumber`; neither is
   written in `app.json` (test: keys absent). Version number rule: bump `version` only for a
   visible release (0.1.0 → 0.2.0 …); build numbers are never edited by hand.
9. [J] `expo.ios.infoPlist.ITSAppUsesNonExemptEncryption` is `false` (harmless now; saves a
   question if iOS is added later). Android: `expo.android.permissions` is an empty list, so
   the Play listing shows no extra permissions (the app is offline).
10. [J] `expo.ios.supportsTablet` is `false` (default decision, §10) and `expo.orientation`
    is `"portrait"`, `userInterfaceStyle` is `"light"`.
11. [J] `scheme` stays `letsgo`; `name` stays "Let's GO"; `slug` stays `lets-go`.
12. [F] `extra.eas.projectId` is added by `eas init` (PO-run step); until then the file is
    still valid and `npx expo-doctor` does not fail because of it.

### 4.3 Storage: MMKV with safe fallbacks
13. [J] New `src/store/storageSelect.ts` exports `selectStorageAdapter(env)` where `env`
    is injected (`{ platform, executionEnvironment, mmkvAvailable }`) so it is testable:
    - Given `platform: 'web'` -> returns the AsyncStorage adapter.
    - Given `executionEnvironment: 'storeClient'` (App Store Expo Go) -> AsyncStorage adapter,
      and MMKV is never required (the `require` of `react-native-mmkv` is not executed).
    - Given a standalone / dev-client build with MMKV loadable -> MMKV adapter.
    - Given a native build where loading MMKV throws -> AsyncStorage adapter (no crash).
14. [J] The MMKV adapter implements `StorageAdapter` (`get/set/remove`) exactly as in
    `src/store/storage.ts`; existing store tests still pass unchanged with the memory adapter.
15. [J] `src/store/asyncStorage.ts` stays the single place that exports the app's adapter
    (it now delegates to `selectStorageAdapter`); no store file imports MMKV directly.
16. [J] **Migration copies once.** Given MMKV empty and AsyncStorage holding the progress,
    settings and onboarding keys, when the app starts on MMKV, then every key is copied to
    MMKV with identical values and the flag `migration.mmkv.v1 = "done"` is set in MMKV.
17. [J] **No data loss on failure.** Given a `set` into MMKV throws on the 2nd key, then no
    AsyncStorage key is removed, the flag is not set, and the app keeps working on
    AsyncStorage for this launch (or retries next launch).
18. [J] **Idempotent.** Given the flag is `done`, when migration runs again, then nothing is
    copied or overwritten, even if AsyncStorage still has older values.
19. [J] **No overwrite.** Given MMKV already holds a key, migration does not replace it.
20. [J] Old AsyncStorage keys are not deleted by this item (a later cleanup item may). 
21. [F] Honest note in the PR and in the PO checklist: a fresh Play install starts with
    empty progress because Expo Go keeps its data in its own sandbox. The migration is a safety
    net (e.g. later switching an existing AsyncStorage install to MMKV), not a way to carry
    Expo Go progress to the new app.
22. [PO] On the Android build: finish lesson 1, force-close, reopen -> progress and
    language/sound settings are still there (Android build). In Expo Go on the iPhone the same
    still works (AsyncStorage).

### 4.4 Splash screen
23. [F] `assets/icon-source/splash.svg` exists (stones only: the two-stone logo, no ridges,
    no text, colours from tokens) and `assets/splash-icon.png` is exported from it (1024x1024,
    transparent), replacing the Expo template image.
24. [J] `app.json` plugins contain `expo-splash-screen` with
    `{ "image": "./assets/splash-icon.png", "imageWidth": 200, "resizeMode": "contain",
    "backgroundColor": "#F4F1EA" }` and no `dark` entry; no top-level legacy `splash` key.
25. [J] The splash background equals `colors.background` (`#F4F1EA`) from
    `src/theme/tokens.ts` (test reads both and compares).
26. [PO] On the installed build the splash shows the stones on rice paper for a moment, then
    the landing page, without a white or black flash.

### 4.5 Project health (CNG)
27. [F] `npx expo-doctor` reports no failing check (warnings about the not-yet-created
    `projectId` are acceptable only if listed in the PR).
28. [F] `npx expo prebuild --no-install --platform android` succeeds in a scratch copy of the repo
    (or with `--clean` and the folders removed afterwards). Then `ios/` and `android/` are
    absent from `git status`, and `.gitignore` lists `/ios` and `/android`.
29. [F] `npm run lint`, `npm run typecheck`, `npm test`, `npx prettier --check .` (CI
    `format:check`) are all green; Expo Go start (`npx expo start`) still opens the app.
30. [F] The privacy policy, the store texts and the PO checklist exist at the paths in §6–§8
    and every locale has every key (zh-CN, en, fr), with store-text lengths within the §8 limits
    (a small Jest test counts characters).

### 4.6 Privacy and compliance content
31. [F] `docs/privacy-policy.md` exists in zh-CN, en and fr and states: no account, no
    analytics, no ads, no tracking, no network use, progress stored only on the device,
    deleting the app deletes the data, contact email (§10).
32. [F] Nothing in `package.json`/`app.json` adds analytics, ads, crash-reporting or network
    SDKs (grep list in the PR). Required answers in §7 are therefore true.

## 5. How the PO will experience it (no screens change)
No gameplay screen changes. The only visible differences: new splash, app name and icon on the
home screen, and the app opening from the phone instead of Expo Go.

```
  tap icon  ->  splash (#F4F1EA, two stones, 200 px wide)  ->  landing page
```
Splash: stones centred, nothing else; no loading bar, no text. It hides when the first screen is
ready (existing behaviour; the developer keeps `SplashScreen.preventAutoHideAsync` out unless
fonts/storage need it).

## 6. PO-only steps (Claude cannot do these)
Rule: Claude never enters passwords, 2FA codes, ID documents or payment details, and never runs
`eas build` or `eas submit` unless the PO says "go" in the same conversation. Dry runs
(`prebuild`, `expo-doctor`, tests) are free and allowed.

**What to prepare (before any build):**
- An **Android phone** to test on (yours, borrowed, or a tester's). Your iPhone cannot install it.
- A **Google account** for the Play Console (can be your Gmail; a separate one is fine).
- **25 USD** one-time fee (card) and a **government ID** for Google's identity check (takes
  from hours to a few days).
- Personal vs organisation account: a **personal** account is the default (no company needed).
  Note: new personal accounts must run a **closed test with at least 12 testers for 14 days**
  before Google allows a public release. This does **not** affect internal testing (this item).
- A **support email** shown publicly (§10 #4).
- Tester list: the Google account emails of up to 100 internal testers.

| # | Step | Who | Cost |
|---|---|---|---|
| 1 | Create a free Expo account at expo.dev | PO | free |
| 2 | `npx eas-cli login` in the terminal (PO types password) | PO | free |
| 3 | `npx eas-cli init` (links the project, adds `projectId`; Claude commits the change) | PO runs | free |
| 4 | Quick test: `eas build -p android --profile preview` after a "go"; open the link on the Android phone, install the APK (allow "install unknown apps") | PO, or Claude with "go" | EAS free tier: limited builds/month |
| 5 | Create the Google Play Console developer account, pay, verify identity | PO | 25 USD once |
| 6 | Play Console: Create app (name "Let's GO", default language, App, Free) | PO | - |
| 7 | Fill "App content" (privacy URL, ads: no, app access: all open, content rating, target audience, data safety, government/financial/health: no) with §7 answers | PO | - |
| 8 | `eas build -p android --profile production` after a "go" -> download the `.aab` | PO, or Claude with "go" | - |
| 9 | Testing -> Internal testing -> Create release -> upload the `.aab` **by hand** (Google requires the first upload to be manual); release notes; Save -> Review -> Start rollout | PO | - |
| 10 | Internal testing -> Testers: create an email list, copy the opt-in link, send it to testers; they accept and install from Play | PO | - |
| 11 | Optional later: a Google service account key so `eas submit -p android` uploads new builds (kept as an EAS secret, never in the repo) | PO | - |
| 12 | Updates: new `production` build (step 8) -> new internal release (step 9); testers get it automatically | PO | - |

**`docs/specs/M6-eas-build-po-checklist.md`** (written by the developer from this spec, plain
language, numbered, no screenshots) must contain: the "what to prepare" box above; each step
with the exact command or the exact menu path in Play Console and what each prompt means
(e.g. EAS asks "Generate a new Android Keystore?" -> Yes); how testers join and install; how to
update; a "something went wrong" section (build failed: send the log URL; "Version code already
used": rebuild, EAS raises it; APK blocked: allow unknown apps); the migration honesty note
(AC 21); the privacy URL and support email to paste; what comes after (closed test 12 testers /
14 days, then production); and the "Claude never runs build/submit without your go" rule.

## 7. Privacy and data-safety answers
- **Google Play Data safety:** "No data collected" and "No data shared"; data is not encrypted
  in transit because nothing is transmitted; no data deletion request needed (no account).
  Declare: no ads.
- **Privacy policy URL** (required by both stores). Default: `docs/privacy-policy.md`
  copied by the PO into a new public repo `Agnes-Lain/lets-go-privacy` (this app repo is private, and free GitHub Pages needs a public repo), giving
  `https://agnes-lain.github.io/lets-go-privacy/` (the checklist gives exact clicks).
  Free, no server. Alternative: a plain Notion/Google Sites page with the same text.
- **Policy text (short, three languages in one page):**
  - en: "Let's GO collects no personal data. There is no account, no advertising, no analytics
    and no tracking. The app works offline. Your lesson progress and settings are stored only
    on your device and disappear when you delete the app. Questions: <support email>."
  - fr: "Let's GO ne collecte aucune donnée personnelle. Pas de compte, pas de publicité, pas
    d'analyse, pas de suivi. L'app fonctionne hors ligne. Votre progression et vos réglages
    restent sur votre appareil et sont supprimés avec l'app. Contact : <e-mail>."
  - zh-CN: "Let's GO 不收集任何个人信息。没有账号、广告、数据分析或跟踪。应用可离线使用。学习进度和设置只保存在你的设备上，卸载应用即删除。联系方式：<邮箱>。"
- **Content rating (IARC questionnaire):** category "Reference, News, or Educational"; all
  answers "No" (no violence, gambling, user content, chat, location sharing, purchases)
  -> Everyone / PEGI 3.
- **Target audience:** recommended **13 and over** (§10 #6). Choosing ages under 13 puts the
  app in Google's Families policy (extra review and rules); the app still works for any age.
- **App access:** "All functionality is available without special access".
- **Ads:** "No, my app does not contain ads".
- **Content rights / ads / IAP:** no ads, no purchases, no third-party content (Go is public
  domain; all text and art original).

## 8. Store listing (copy-paste ready; limits checked)
| Field | Limit | zh-CN | en | fr |
|---|---|---|---|---|
| App name | Play 30 | Let's GO | Let's GO | Let's GO |
| Short description (Play) | 80 | 从零开始学围棋：短课程、友好的对手、无广告。(22) | Learn Go (围棋) from zero with short lessons, a friendly bot and no ads. (70) | Apprenez le Go (围棋) pas à pas : leçons courtes, bot amical, sans pub. (69) |
| Category | - | 教育 | Education | Éducation |
| Tags (Play, pick up to 5) | - | - | Board, Educational, Strategy | - |

Full description (Play limit 4000; keep it to three short paragraphs):
- en: "Let's GO teaches Go (围棋 wéiqí) from zero. Each lesson explains one rule — liberties,
  capture, the ko rule, counting territory — and gives you a few small exercises on a tiny
  board. Short sessions of three to five minutes.\n\nWhen a move is not allowed or a try fails,
  the app tells you why, in plain words. At the end you play full 9×9 games against a gentle
  practice bot.\n\nEverything works offline. No account, no ads, no tracking. Available in
  English, 中文 and Français."
- fr: "Let's GO vous apprend le Go (围棋 wéiqí) depuis zéro. Chaque leçon explique une seule règle
  — libertés, capture, règle du ko, décompte du territoire — puis propose quelques petits
  exercices sur un mini-plateau. Sessions courtes de trois à cinq minutes.\n\nQuand un coup est
  interdit ou un essai échoue, l'app explique pourquoi, simplement. À la fin, vous jouez de
  vraies parties 9×9 contre un robot d'entraînement indulgent.\n\nTout fonctionne hors ligne.
  Pas de compte, pas de publicité, pas de suivi. Disponible en français, English et 中文."
- zh-CN: "Let's GO 带你从零学围棋。每节课只讲一条规则——气、提子、劫、数子——再配几道小棋盘上的练习，
  每次三到五分钟。\n\n落子不合规或尝试失败时，应用会用简单的话告诉你原因。最后你可以在 9×9 棋盘上和温和的陪练机器人完整对弈。
  \n\n全部内容可离线使用，无需账号，无广告，无跟踪。支持中文、English、Français。"
  (The developer checks the exact lesson topics against `docs/CURRICULUM.md` before pasting;
  remove any topic not yet in the app.)

**Graphics needed** (Play):
- For **internal testing** only the app name, short description, icon and privacy URL are
  needed; Play may still ask for the graphics below before the first rollout — prepare them in
  this item so it never blocks.
- App icon 512×512 PNG (export from `assets/icon-source/icon.svg`).
- Feature graphic 1024×500 PNG (rice paper, ridges, two stones, "Let's GO"; source SVG in
  `assets/icon-source/feature-graphic.svg`).
- Phone screenshots: at least 2 (recommended 4: landing, a lesson with a stone preview, the
  learning page, a 9×9 game), 9:16, 1080×1920, from the real app in en (fr and zh-CN optional).
  The developer takes them on web at 360×640 scaled ×3 and stores them in `docs/store/`.

Contact email: see §10 (Play requires one, shown publicly).

## 9. Done checks (QA runs, in order)
`npx expo-doctor` -> `npx expo prebuild --no-install --platform android` in a scratch copy ->
`git status` shows no `ios/` `android/` -> lint, typecheck, `npm test`, prettier check ->
`npx expo start` opens in Expo Go (AsyncStorage path) -> web export still works.
PO-only confirmation (not blocking the PR): AC 22 and 26 on the real build.

## 10. Open decisions (recommended default first)
| # | Decision | Recommended default | Plain trade-off |
|---|---|---|---|
| 1 | Package name | `com.agneslain.letsgo` | Permanent once uploaded to Play; a domain is not required. |
| 2 | Play account type | Personal | No company papers; but public release later needs the 12-tester / 14-day closed test. An organisation account skips that but needs a D-U-N-S number. |
| 3 | Privacy policy host | A small public repo `lets-go-privacy` with GitHub Pages (text kept in `docs/privacy-policy.md`) | This app repo is private, so its own Pages need a paid plan. Alternatives: Google Sites or a public Notion page. |
| 4 | Support contact | A PO-owned email (a new Gmail is fine) | Shown publicly in the store and the policy. |
| 5 | Category | Education | Board games gets more game browsers; Education fits "learn". |
| 6 | Target audience | 13+ | Under-13 adds Google Families rules and review; can change later. |
| 7 | Test path | `preview` APK link first, then Play internal testing | APK needs no Play account and works today; Play internal gives auto-updates. |
| 8 | Signing key | EAS-managed | Easiest; you cannot lose the key. Play App Signing is on by default too. |
| 9 | iOS | Not built now; config kept so it can be added later | Apple costs 99 USD/year. |

## 11. Out of scope
Apple App Store, TestFlight and any iOS build; Play closed/open testing and production release, paid features, in-app purchases, push notifications, crash
reporting or analytics, accounts/backend, OTA updates (`expo-updates` channels may be set but
no update is published), iPad layout, dark mode, Android tablet layout, localized store
screenshots beyond the basics, automated CI builds, deleting old AsyncStorage keys, Apple
Watch/web publishing, store-name trademark checks.
