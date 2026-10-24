# Let's GO on Android — your checklist (PO)

Written from `docs/specs/M6-eas-build.md` §6. Follow the steps in order. Each step says who does
it, what to type or click, and what the questions on the screen mean. Menu names in Google Play
Console change a little from time to time; if a name differs, look for the closest one.

> **The rule:** Claude never types your passwords, 2FA codes, ID documents or card details, and
> never runs `eas build` or `eas submit` unless you say "go" in the same conversation. Checks like
> tests, `expo-doctor` and `prebuild` are free and Claude may run them any time.

## What to prepare (before any build)

- An **Android phone** to test on (yours, borrowed, or a tester's). An iPhone cannot install it;
  your iPhone keeps working with Expo Go as today.
- A **Google account** for the Play Console (your Gmail, or a separate one).
- **25 USD** one-time fee (bank card) and a **government ID** for Google's identity check
  (from a few hours to a few days).
- Account type: **personal** (no company papers needed). New personal accounts must run a
  **closed test with at least 12 testers for 14 days** before a public release. This does **not**
  affect internal testing, which is what this checklist does.
- A **support email** that will be shown publicly (in the store and the privacy page). A new
  Gmail just for the app is fine. Below it is written `<support email>`.
- The **Google account emails** of your testers (up to 100).

## Part A — Expo account and a first test app (free)

### 1. Create a free Expo account (you)
Open <https://expo.dev/signup>, sign up, confirm the email. Free plan is enough.

### 2. Log in from the terminal (you type the password)
In the project folder, run:

```sh
npx eas-cli login
```

It asks for your Expo **email or username** and **password**. Type them yourself (the password
stays invisible while you type). Check with `npx eas-cli whoami`: it prints your username.

### 3. Link the project to Expo (you run it, Claude commits the result)

```sh
npx eas-cli init
```

- "Would you like to create a project for @your-name/lets-go?" → **Yes**.
- It writes `extra.eas.projectId` into `app.json`. Tell Claude; Claude commits this change.

### 4. Quick test build: an APK you install directly (after your "go")

```sh
eas build -p android --profile preview
```

(`eas` is the same as `npx eas-cli`.) Questions you may see:

- "Generate a new Android Keystore?" → **Yes**. Expo creates and keeps the signing key for you;
  you never handle it and cannot lose it.
- If it offers to install or configure **expo-updates** / EAS Update → **No** (not part of this
  item).
- The build runs on Expo's servers (about 10–20 minutes; the free plan has a limited number of
  builds per month). At the end it prints a **link** and a QR code.

Install on the Android phone: open the link on the phone (or scan the QR code) → **Install** →
if Android says "For your security, your phone is not allowed to install unknown apps from this
source", tap **Settings** → turn on **Allow from this source** → back → **Install**.

## Part B — Google Play Console (25 USD once)

### 5. Create the developer account (you)
Open <https://play.google.com/console/signup>, choose **Yourself** (personal account), fill in your
name and the `<support email>` as contact, pay the 25 USD fee, and complete the **identity
verification** with your ID. Wait for Google's confirmation email.

### 6. Create the app (you)
Play Console → **Home** → **Create app**:
- App name: `Let's GO`
- Default language: **English (United States) – en-US** (Chinese and French are added as
  translations later)
- App or game: **App** · Free or paid: **Free**
- Tick the declarations (Developer Program Policies, US export laws) → **Create app**.

### 7. Publish the privacy page (you, free, about 10 minutes)
The app repository is private, so the policy goes into a tiny **public** repository with GitHub
Pages.

1. Open <https://github.com/new>. Owner: **Agnes-Lain**. Repository name: `lets-go-privacy`.
   Visibility: **Public**. Tick **Add a README file**. → **Create repository**.
2. In the new repository: **Add file** → **Create new file**. File name: `index.md`.
3. Copy the whole text of `docs/privacy-policy.md` from the app repository into it. Replace every
   `<support email>` with your real support email. Delete the lines between `<!--` and `-->`.
   → **Commit changes…** → **Commit changes**.
4. **Settings** (top of the repository) → **Pages** (left menu) → **Build and deployment** →
   Source: **Deploy from a branch** → Branch: **main**, folder **/ (root)** → **Save**.
5. Wait 1–2 minutes, then open <https://agnes-lain.github.io/lets-go-privacy/>. You should see the
   policy in 中文, English and Français. This is the **privacy URL** you paste in step 8.

### 8. Fill "App content" (you; answers below are all true for this app)
Play Console → your app → **Policy and programs** → **App content** (older menu: **Policy** →
**App content**). Complete each card:

| Card | Answer |
|---|---|
| Privacy policy | `https://agnes-lain.github.io/lets-go-privacy/` |
| Ads | **No, my app does not contain ads** |
| App access | **All functionality is available without special access** |
| Content rating | Start questionnaire → email `<support email>` → category **Reference, News, or Educational** → answer **No** to every question (no violence, gambling, user content, chat, location sharing, purchases) → result Everyone / PEGI 3 |
| Target audience | **13–15, 16–17, 18 and over** (do not tick any age under 13: that adds Google's Families rules); "appeal to children": **No** |
| Data safety | "Does your app collect or share any of the required user data types?" → **No**. Result: "No data collected", "No data shared". (Encryption in transit: nothing is transmitted; deletion request: not needed, there is no account.) |
| Government apps / Financial features / Health | **No** / **My app doesn't provide any financial features** / **No** |
| News app | **No** |

Then **Grow users → Store presence → Main store listing**: paste the texts from
`docs/store/listing.md` (name, short and full description, en-US; then **Manage translations** →
**Add your own translations** → Chinese (Simplified) zh-CN and French fr-FR), upload
`docs/store/icon-512.png` (app icon), `docs/store/feature-graphic.png` (feature graphic) and the
`docs/store/screenshot-*.png` files (phone screenshots). Category: **Education**; contact email:
`<support email>`. **Save**.

### 9. Build the store version (after your "go")

```sh
eas build -p android --profile production
```

This makes an `.aab` file (the format Play wants). Expo raises the build number by itself. At the
end, open the link and **download the .aab** to your computer.

### 10. First upload to Internal testing (you, by hand)
Google requires the very first upload to be manual.

Play Console → your app → **Test and release** → **Testing** → **Internal testing** (older menu:
**Release** → **Testing** → **Internal testing**) → **Create new release**:
- "Play App Signing": accept the default (**Google manages the app signing key**).
- **App bundles** → **Upload** → choose the `.aab` from step 9.
- Release name: keep the suggested one (e.g. `1 (0.1.0)`). Release notes, for example:
  `<en-US>First internal test.</en-US>`
- **Next** (or **Save**) → read the warnings (warnings are OK, errors must be fixed) → **Save and
  publish** / **Start rollout to Internal testing**.

### 11. Invite testers (you)
**Internal testing** → **Testers** tab → **Create email list** → name it (e.g. "Let's GO
testers") → paste the testers' Google account emails → **Save** → tick the list → **Save**.
Then **Copy link** (under "How testers join your test") and send it to your testers.

**How a tester joins:** open the link on the Android phone while signed in with the invited
Google account → **Accept invite** → **Download it on Google Play** → **Install** in the Play
Store app. Updates then arrive automatically like any app.

## Part C — Updates and later

### 12. Each new version
1. Claude prepares the change; you say "go" for `eas build -p android --profile production`.
2. Download the new `.aab` → **Internal testing** → **Create new release** → upload → release
   notes → **Save and publish**. Testers get it automatically.
3. Only for a visible release Claude bumps `version` in `app.json` (0.1.0 → 0.2.0); build
   numbers are never edited by hand.

Optional later: a Google **service account key** lets `eas submit -p android` upload builds for
you. It is stored as an EAS secret, **never** in the repository (files named
`*service-account*.json` are ignored by git).

### After internal testing
To publish to everyone: run a **closed test with at least 12 testers for 14 days** (Play
Console → Testing → Closed testing), then apply for **Production** access. That is a later
roadmap item.

## Your progress on the new app (honest note)
A fresh install from Play **starts with empty progress**. Expo Go keeps its data in its own
sandbox, so lessons finished in Expo Go do not move to the new app. The app's own storage (MMKV)
copies old data only when an existing installation of the same app switches storage; it is a
safety net, not a transfer from Expo Go. Your iPhone with Expo Go keeps its progress as before.

## Something went wrong?

| Problem | What to do |
|---|---|
| Build failed | Copy the **build page URL** (expo.dev/…/builds/…) and send it to Claude. |
| Play says "**Version code** 1 has already been used" | Run the production build again; EAS raises the number by itself. Never type a number by hand. |
| Android blocks the APK | Allow "Install unknown apps" for the browser or Files app (step 4). |
| Play asks for screenshots or a feature graphic | They are in `docs/store/` (step 8). |
| Tester cannot see the app | Check the tester's email is in the list and they opened the link with **that** Google account; it can take a few minutes after "Save". |
| `eas` asks you to log in | Run `npx eas-cli login` again (you type the password). |

## What to paste where (summary)

- Privacy URL: `https://agnes-lain.github.io/lets-go-privacy/`
- Support email: `<support email>` (yours)
- Package name (shown in Play, permanent): `com.agneslain.letsgo`
- Store texts: `docs/store/listing.md`
- Graphics: `docs/store/`
