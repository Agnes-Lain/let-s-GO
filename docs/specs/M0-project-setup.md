# M0 — Project setup (scaffold + CI)

Covers both M0 roadmap items in one PR: Expo + TS scaffold (expo-router, ESLint/Prettier, Jest,
folder layout) and GitHub Actions CI.

## 1. Goal
A learner can open the app (web or phone) in their own language (中文, English or Français), see a calm home
screen with a "Unit 1" entry, open a placeholder lesson, and switch language in Settings. The team
gets a green lint/typecheck/test pipeline to build every later milestone on.

## 2. User stories
- As a beginner, I want the app to open in my phone's language so I can read it immediately.
- As a beginner, I want one obvious thing to tap on the home screen so I know where to start.
- As a multilingual learner, I want to switch between 中文, English and Français in Settings.
- As a developer, I want `npm install && npm test` to work on a fresh clone so I can start on M1.
- As a reviewer, I want CI to run lint, typecheck and tests on every PR so broken code can't merge.

## 3. Acceptance criteria

### Tooling and repo
1. **Given** a fresh clone with the pinned Node version, **when** `npm ci` runs, **then** it exits 0
   (`package-lock.json` is committed).
2. **Given** the repo, **then** `.nvmrc` contains `24` (Node 24 LTS) and `package.json` has
   `"engines": { "node": ">=24 <25" }`.
3. **Given** `package.json`, **then** it defines scripts `start` (`expo start`), `web`
   (`expo start --web`), `lint` (`eslint . --max-warnings 0`), `typecheck` (`tsc --noEmit`),
   `test` (`jest`), `format` (`prettier --write .`), `format:check` (`prettier --check .`).
4. **When** `npm run lint`, `npm run typecheck`, `npm test` and `npm run format:check` run, **then**
   each exits 0 with no warnings.
5. **Given** `tsconfig.json`, **then** it extends `expo/tsconfig.base` with `"strict": true` and a
   path alias `@/*` → `src/*`.
6. **Given** ESLint config (flat config, `eslint-config-expo` + `eslint-config-prettier`), **when** a
   file under `src/engine/` or `src/bot/` imports `react`, `react-native`, or anything matching
   `expo*`, **then** `npm run lint` fails with a `no-restricted-imports` error. (QA: add a temporary
   file to verify, then remove it.)
7. **Given** the repo tree, **then** these exist exactly (placeholders export nothing yet:
   `export {};` plus a one-line comment naming the milestone that fills it):
   - `src/engine/index.ts` (M1), `src/board/index.ts` (M2), `src/lessons/index.ts` (M3),
     `src/exercises/index.ts` (M3), `src/store/index.ts` (M3), `src/bot/index.ts` (M4)
   - `src/i18n/index.ts`, `src/i18n/zh-CN.json`, `src/i18n/en.json`, `src/i18n/fr.json` (real, see §4)
   - `src/theme/tokens.ts` (real, see §6) — the only addition to the CLAUDE.md layout
   - `app/_layout.tsx`, `app/index.tsx`, `app/settings.tsx`, `app/lesson/[id].tsx`,
     `app/practice/[id].tsx`, `app/+not-found.tsx`
   - No `src/lessons/schema.ts` yet (M3 owns it).
8. **Given** `app/**`, **then** no screen contains a hard-coded user-facing string; all text comes
   from `t('<key>')`. (QA: grep for CJK characters or quoted English sentences in `app/` → none.)

### i18n
9. **Given** `zh-CN.json`, `en.json` and `fr.json`, **then** they have identical key sets and every value is a
   non-empty string (Jest test `src/i18n/i18n.test.ts`).
10. **Given** the device locale (expo-localization `getLocales()[0].languageCode`) is `zh`
    (e.g. `zh-Hans-CN`, `zh-Hant-TW`), **when** the app initialises i18n, **then** language is `zh-CN`.
11. **Given** device locale `en-US` or `en-GB`, **then** language is `en`.
12. **Given** device locale `fr-FR`, `fr-CA` or `fr-BE`, **then** language is `fr`.
    **Given** device locale `de-DE` (or `getLocales()` returns `[]`), **then** language is `en`
    (fallback for any other locale — decided by the product owner).
13. **Given** language is `en`, **when** `t('app.name')` is called, **then** it returns `Let's GO`;
    for `zh-CN` and `fr` it also returns `Let's GO` (same brand name in all languages).
14. Locale detection is a pure function `resolveLanguage(languageCode: string | null): 'zh-CN' | 'en' | 'fr'`
    exported from `src/i18n/index.ts` and unit-tested for ACs 10–12.

### Home screen (`/`)
15. **Given** language `zh-CN`, **when** Home renders (RNTL test `app/__tests__/index.test.tsx`),
    **then** it shows `Let's GO`, the subtitle `home.subtitle`, the section title `学习路线`, and a
    card with `第 1 单元 · 棋盘与棋子` and `即将开放`.
16. **Given** language `en`, **then** the same test shows `Let's GO` and `Unit 1 · Board & stones`;
    **given** `fr`, it shows `Let's GO` and `Unité 1 · Le goban et les pierres`.
17. **When** the user taps the Unit 1 card, **then** the router navigates to `/lesson/u01-board`.
18. **When** the user taps the settings button (accessibility label `settings.open`), **then** the
    router navigates to `/settings`.
19. Every pressable on Home has a hit area ≥ 44×44 px and an `accessibilityRole="button"` and
    `accessibilityLabel` from i18n.

### Placeholder screens
20. **Given** `/lesson/u01-board`, **then** the screen shows `placeholder.lesson.title`, the id
    `u01-board`, the body `placeholder.comingSoon`, and a back button (`common.back`) that returns
    to `/`.
21. **Given** `/practice/abc`, **then** the screen shows `placeholder.practice.title`, the id `abc`,
    `placeholder.comingSoon` and a back button returning to the previous screen (or `/` if none).
22. **Given** an unknown route `/nope`, **then** `+not-found` shows `notFound.title` and a
    `notFound.home` button that navigates to `/`.

### Settings (`/settings`)
23. **Given** Settings, **then** it shows a language list with four options:
    `跟随系统 / Use device language / Langue de l'appareil`, `中文（简体）`, `English`, `Français`; the current choice shows a check mark
    and has `accessibilityState={{ selected: true }}`. Default selection is "Use device language".
24. **Given** UI language `zh-CN`, **when** the user taps `English`, **then** all visible text on
    Settings switches to English immediately (no restart), and navigating back shows Home in English. Same for `Français` → French.
25. **When** the user taps "Use device language", **then** the language becomes `resolveLanguage`
    of the device locale.
26. Settings shows `settings.version` followed by the version from `app.json` (e.g. `0.1.0`).
27. The language choice is **not** persisted in M0; after a reload it follows the device again.

### Web and CI
28. **Given** `npx expo start --web` and a Playwright viewport 360×740, **then** Home renders with
    the title visible, no horizontal scroll (`document.documentElement.scrollWidth <= 360`), and no
    console errors. QA attaches a screenshot of Home and Settings in both languages.
29. **Given** `.github/workflows/ci.yml`, **then** it triggers on `pull_request` (any branch) and
    `push` to `master`, runs on `ubuntu-latest`, uses `actions/setup-node` with
    `node-version-file: .nvmrc` and npm cache, then runs `npm ci`, `npm run lint`,
    `npm run typecheck`, `npm run format:check`, `npm test -- --ci` as separate named steps.
30. **Given** a PR that introduces a type error, **then** the CI job fails at the `typecheck` step.
    (QA verifies by reasoning about the workflow or a throwaway branch; not required to merge.)

## 4. Screen flow & UI

Routes (expo-router, Stack navigator, header hidden — each screen draws its own top bar):
```
/                 Home / unit map (M3 replaces the placeholder list)
/lesson/[id]      Lesson player placeholder (M3)
/practice/[id]    Practice set placeholder (M3)
/settings         Settings stub (M6 expands)
+not-found
```
Flow: Home → (Unit 1 card) → Lesson placeholder → Back → Home. Home → (gear) → Settings → Back.

States: M0 has no loading/data. Only "default" for every screen; Unit 1 card is in a
"coming soon" state (tappable, shows badge). No error states beyond not-found.

Home, 360×740 (16px side padding, content width 328):
```
┌────────────────────────────────────┐
│ [safe area]                        │
│                              [⚙ ]  │  gear: 44×44, label settings.open
│                                    │
│            ●○                      │  logo: two overlapping stones, 56px
│          Let's GO                  │  display 28/34 bold
│  从零开始，一步一步学会下围棋        │  body 16/24, textSecondary, centered
│                                    │
│  学习路线                           │  title 22/28
│ ┌────────────────────────────────┐ │
│ │ ●  第 1 单元 · 棋盘与棋子    ›  │ │  card min-height 72, radius 12,
│ │    [即将开放]                   │ │  whole card is the tap target
│ └────────────────────────────────┘ │
│  更多单元即将上线                    │  caption 13/18, textSecondary
│                                    │
└────────────────────────────────────┘
```
Settings:
```
┌────────────────────────────────────┐
│ [‹ 返回]        设置                │  back: 44×44 min, title centered
│                                    │
│  语言                               │  section caption
│ ┌────────────────────────────────┐ │
│ │ 跟随系统                    ✓  │ │  rows: min-height 52, full-width tap
│ │ 中文（简体）                    │ │
│ │ English                        │ │
│ │ Français                       │ │
│ └────────────────────────────────┘ │
│  版本 0.1.0                         │  caption
└────────────────────────────────────┘
```
Placeholder (lesson / practice / not-found): top bar with back, centered title, id in caption,
body text, nothing else. Language names `中文（简体）`, `English` and `Français` are always shown in their own
language regardless of UI language.

Copy keys (zh-CN / en / fr). French uses a non-breaking space before `!`, `?`, `:` and `;`.

| Key | zh-CN | en | fr |
|---|---|---|---|
| app.name | Let's GO | Let's GO | Let's GO |
| home.subtitle | 从零开始，一步一步学会下围棋 | Learn Go (围棋 wéiqí) from zero, one rule at a time | Apprenez le go (围棋 wéiqí) à partir de zéro, une règle à la fois |
| home.path.title | 学习路线 | Learning path | Parcours d'apprentissage |
| home.unit1.title | 第 1 单元 · 棋盘与棋子 | Unit 1 · Board & stones | Unité 1 · Le goban et les pierres |
| home.unit.comingSoon | 即将开放 | Coming soon | Bientôt disponible |
| home.moreSoon | 更多单元即将上线 | More units coming soon | D'autres unités arrivent bientôt |
| settings.open | 打开设置 | Open settings | Ouvrir les réglages |
| settings.title | 设置 | Settings | Réglages |
| settings.language | 语言 | Language | Langue |
| settings.language.system | 跟随系统 | Use device language | Langue de l'appareil |
| settings.language.zh | 中文（简体） | 中文（简体） | 中文（简体） |
| settings.language.en | English | English | English |
| settings.language.fr | Français | Français | Français |
| settings.version | 版本 | Version | Version |
| common.back | 返回 | Back | Retour |
| placeholder.lesson.title | 课程 | Lesson | Leçon |
| placeholder.practice.title | 练习 | Practice | Exercices |
| placeholder.comingSoon | 这里很快就会有内容，敬请期待！ | This part is coming soon. Stay tuned! | Cette partie arrive bientôt. Restez à l'écoute ! |
| notFound.title | 找不到这个页面 | Page not found | Page introuvable |
| notFound.home | 回到首页 | Back to home | Retour à l'accueil |

## 5. Content
None (no lessons in M0). Unit 1 title matches `docs/CURRICULUM.md` (棋盘与棋子 Board & stones).

## 6. Visual foundation (`src/theme/tokens.ts`)
**Mood: 水墨山水 · 茶 · 竹 — an ink-wash painting: misty peaks, celadon sky, tea and bamboo.** Go is a game of calm
and reflection; the app should feel like a quiet tea moment in front of an ink-wash (水墨) landscape.
Soft, low-saturation colors, lots of empty space (留白), no bright or alarming tones — even errors
are a gentle rouge, never a loud red. Light mode only in M0 (dark "night mountain" theme deferred to M6).

| Token | Value | Name | Use |
|---|---|---|---|
| color.background | `#EEF2EE` | 雾 mist | app background (cool, misty celadon-white) |
| color.sky | `#D6E2DE` | 青天 celadon sky | top-of-screen gradient (→ background) |
| color.surface | `#FBFCF9` | 素绢 silk | cards, rows (92% opacity over the painting on Home) |
| color.border | `#E3DDD0` | 淡墨 pale ink | card/row dividers |
| color.textPrimary | `#26292B` | 墨 ink | main text (13:1 on background) |
| color.textSecondary | `#56646A` | 远山 distant mountain | subtitles, captions (5.4:1) |
| color.accent | `#3E6461` | 青山 green mountain | primary buttons, check marks, links (6.6:1 with white) |
| color.onAccent | `#FFFFFF` | | text on accent |
| color.success | `#56764A` | 茶 tea green | correct answer (M3+) (5.1:1) |
| color.error | `#A8443F` | 胭脂 rouge | wrong answer (M3+), gentle not alarming (5.8:1) |
| color.hint | `#9A5F22` | 琥珀茶 amber tea | hint highlight (M3+) (5.1:1) |
| color.badge | `#E4ECD8` | 嫩芽 tea sprout | "coming soon" badge background |
| color.onBadge | `#3F5A35` | | badge text (6.3:1) |
| ink.bambooFront | `#2F4A45` | 浓墨 dense ink | front bamboo stalk + leaves — decorative only |
| ink.bambooMid | `#6F8C86` | 中墨 mid ink | middle bamboo — decorative only |
| ink.bambooBack | `#A9BDB7` | 淡墨 pale ink | back bamboo, fading into mist — decorative only |
| ink.mountainFar | `#B7C8C3` | 远山 far range | decorative, gradient to transparent |
| ink.mountainMid | `#8FA7A1` | 中山 mid range | decorative |
| ink.mountainNear | `#5F7D77` | 近山 near peak | decorative, top of the tall peak |
| ink.hill | `#3F5B55` | 墨林 ink hill | small dark hill at the peak's foot (55% opacity) |
| board.bamboo | `#E8D3A0` | 竹板 bamboo | board base color (M2) |
| board.bambooStripLight | `#EEDCAE` | | alternating light strip |
| board.bambooStripDark | `#DEC68C` | | alternating darker strip |
| board.bambooNode | `#CDB277` | 竹节 node | thin horizontal node marks on strips |
| board.line | `#33281B` | | grid lines, star points (M2) |
| stone.black | `#22252A` | 墨玉 ink jade | black stone (slightly blue-black, like ink) |
| stone.white | `#F7F5EE` | 贝 shell | white stone fill |
| stone.whiteEdge | `#8F8C80` | | 1px outline so white stones read on wood |

All text colors meet WCAG AA (≥ 4.5:1) on background and surface.

**Decorative landscape — 水墨山水 ink-wash painting** (`src/theme/Landscape.tsx`,
react-native-svg, full-screen behind Home content). Style reference: a traditional ink-wash
landscape provided by the product owner (it is a watermarked stock image, so it is **not** shipped;
we recreate the style as vector art). Composition on a 360×740 screen:
- **Sky:** vertical gradient `sky` → `background`.
- **Mountains (top band, y≈30–215):** a tall peak on the left (`mountainNear`) with a shoulder
  (`mountainMid`) and a far range on the right (`mountainFar`), each filled with a vertical
  gradient fading to transparent at its base, like ink bleeding into mist. A small dark ink hill
  (`hill`) sits at the peak's foot. Soft mist clouds (radial gradients, no hard edges) float across
  the bases, and the band fades fully into `background` by y≈215.
- **Logo, title and subtitle start below the band** (logo top ≈ y 190), so text never sits on a
  mountain; the gear button sits on a 70%-opaque `surface` square for contrast.
- **Bamboo (bottom-right corner):** three segmented stalks rising from the bottom edge (front
  `bambooFront` ~8.5px wide, middle `bambooMid`, back `bambooBack`), with clusters of 5–8 long,
  slender, drooping leaves at the nodes. The front stalk is darkest; the back one fades into the mist.
  Leaves stay below the content (top ≈ y 480) and to the right of x≈220, so they never cover text.
- **Water:** 3–4 faint horizontal ink lines bottom-left.
- Decorative only: `accessible={false}`, `pointerEvents="none"`. Static in M0 (later: very slow mist
  drift and a gentle bamboo sway, disabled when "reduce motion" is on).
- Only gradients, paths and opacity — no blur filters or image files — so it renders identically
  on iOS, Android and web.
Other screens use only the `sky` → `background` gradient at the top (≈72px), keeping them calm.

**Bamboo board** (built in M2, tokens defined now): the board looks like a laminated bamboo
board (竹制棋盘): vertical strips ~1/12 of the board width alternating `bambooStripLight` /
`bambooStripDark`, with a few thin `bambooNode` marks at irregular heights. Drawn with
react-native-svg (pattern or rects) — no image files. The texture must stay subtle: grid lines
(`board.line`) and stones must remain perfectly readable; contrast of `board.line` on every strip
and node color ≥ 7:1 (checked: 7.0–10.6:1).

Generous line height and spacing for a calm feel.
Spacing scale: `4, 8, 12, 16, 24, 32`. Radius: `sm 8`, `md 12`, `pill 999` (soft, pebble-like corners).
`tapTarget.min = 44` (all pressables use `minWidth/minHeight` or `hitSlop` to reach it).
The logo (two overlapping stones) is drawn with plain Views/circles using stone tokens — not the board.

## 7. Game design notes
No gameplay in M0. Design decisions that set up later milestones:
- Home is already the "learning path" so M3 only swaps the list for the real unit map; the Unit 1
  card is the single obvious next action.
- "Coming soon" cards stay tappable (never a dead tap) and lead to a friendly placeholder.
- No sounds, animations or stars yet; tokens for success/error/hint exist so feedback in M3 is
  consistent.

## 8. Out of scope
Go rules/engine logic, board rendering, lessons/exercises/schema, progress or settings persistence
(MMKV), the bot, sounds, animations, dark mode, onboarding, app icon/splash art beyond Expo
defaults, EAS builds, Maestro E2E, any backend.

## 9. Correctness note
No Go diagrams in this spec, so there are no liberties, captures or legality claims to check.
The Unit 1 title and terminology match `docs/CURRICULUM.md`.

## 10. Product-owner decisions
- D1 App name is `Let's GO` in both languages.
- D2 Device languages other than zh/en fall back to English; zh-CN stays the primary language.
- D3 `src/theme/` is added to the CLAUDE.md folder layout.
- D4 Node 24 LTS pinned (Node 22 if the Expo SDK at scaffold time doesn't support 24 yet).
- D5 Visual design (mockup `docs/specs/M0-mockup.html`) must be approved before development.
- D6 French (`fr`) is a full app language alongside zh-CN and en; `fr*` locales → `fr`.
- D7 Visual mood 山水 · 茶 · 竹 (mountains, mist, tea, bamboo); palette in §6.
- D8 Board uses a laminated bamboo texture (竹制棋盘).
- D9 Home background is an ink-wash 水墨 landscape (misty peaks top-left, bamboo bottom-right) in the
  style of the product owner's reference image; recreated as vector art, the reference itself is not shipped.
