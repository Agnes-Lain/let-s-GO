# Project status (handoff for new sessions)

Read this + `CLAUDE.md`, then continue. Keep it short; update it at the end of each milestone.

## Done (merged to `master`)
- **M0** project setup: Expo **SDK 57** (App Store Expo Go supports 57, not 58 — don't upgrade
  until it does), expo-router, i18n zh-CN/en/fr, theme tokens (`src/theme/tokens.ts`, incl.
  bamboo board tokens), CI on GitHub Actions. Spec: `docs/specs/M0-project-setup.md`.
- **M1** rules engine `src/engine` (pure TS, 441 tests): board/coordinates/ASCII, groups &
  liberties, play/checkMove/legalMoves, captures, suicide, simple ko, MoveFacts, pass/game end,
  `score()` Chinese area scoring. Spec + decisions D1–D9: `docs/specs/M1-rules-engine.md` §9.
- **M2** board UI (`src/board`, dev screen `/dev/board`): static board, touch preview/commit,
  feedback + a11y, motion + `expo-audio` stone sound (CC0 asset in `assets/sounds/`), web
  verification. Spec `docs/specs/M2-board-ui.md` (PO decisions §12). **Pending: the PO's iPhone
  check** — `docs/specs/M2-iphone-checklist.md` (AC 61; stone sound not yet heard on a device).
  - Web check: `npm run verify:web` (Playwright, 360×740, ACs 57–60; uses the global Playwright
    install, not a devDependency, and is not part of `npm test`/CI). Screenshots:
    `docs/screenshots/M2/`. Use `--rebuild` to force `expo export`.

- **M3** lesson framework (one PR): `src/lessons` (schema, validator that proves every exercise
  solvable with the engine, loader, stars/unlock pure functions; React-free), `src/store/progress`
  (Zustand + `StorageAdapter` on AsyncStorage — MMKV isn't in App Store Expo Go, swap one file in
  M6), lesson UI in `src/exercises/` (explanation player, runners tap-point/play-move/choice/count,
  leave sheet, result screen), home unit map `app/index.tsx`. Spec `docs/specs/M3-lesson-framework.md`
  (PO decisions §11). Dev sample lesson `u00-sample` shows only in `__DEV__` or with
  `EXPO_PUBLIC_DEV_LESSONS=1`. Web check: `npm run verify:web:m3`; screenshots `docs/screenshots/M3/`.
  **Pending: the PO's iPhone check** — `docs/specs/M3-iphone-checklist.md`.

- **M4 item 1** content units 1–5 (PR from branch `claude/m4-content-units-1-5`; merge pending):
  six lessons in `src/lessons/content/` (u01-board … u05-atari + checkpoint u05-review; 18 steps,
  46 exercises, zh-CN/en/fr), only Unit 6 "coming soon", badge under the title. Spec
  `docs/specs/M4-content-units-1-5.md` (PO decisions §12), mockup `docs/specs/M4-mockup.html`.
  Tests: `__tests__/m4-units-1-5.test.ts`, `__tests__/qa/m4-content-rules.test.ts`. Web check:
  `npm run verify:web:m4` (release build); screenshots `docs/screenshots/M4/`.
  **Pending: the PO's iPhone play-through of units 1–5.**

## Next
- **M4 item 2 — IN PROGRESS (handed over to local development, 2026-10-19).** Branch
  `claude/m4-second-half-kickoff-15r25e`. Spec `docs/specs/M4-bot-capture-go.md` is PO-approved
  (§15: all §14 defaults accepted), mockup `docs/specs/M4-bot-mockup.html`.
  - Done (committed): `src/bot` (seeded RNG, level-1 heuristic, Capture Go rules, analysis, tests).
  - Work in progress (committed as WIP, not reviewed): `play-bot` schema + validator
    (`validate.bot/runaway` tests), `src/exercises/botGame.ts` + `runners/PlayBotRunner.tsx`,
    `ExerciseTopBar.tsx`, Unit 6 JSON (`u06-capture-go`, `u06-checkpoint`), i18n, map/result changes,
    `__tests__/m4-unit-6.test.ts`. The developer stopped while writing content JSON + i18n strings.
  - State at handover: lint ✓, jest 71 suites / 1846 tests ✓, **typecheck ✗** — 2 errors in
    `src/exercises/runners/PlayBotRunner.test.tsx:160` (cast through `unknown`).
  - `src/bot/__scratch__/` = the developer's win-rate measurement/profiling tests (AC 64); turn
    into a proper script or delete before the PR.
  - Still to do: finish/check content + i18n against spec §8/§11, fix typecheck, AC 64 blunder
    tuning (report table to PO for approval), web check + screenshots (`docs/screenshots/M4/`),
    QA pass, tick roadmap, PR.

## Known follow-ups (minor, not scheduled)
- M4: `u05-atari` "atari-group" also accepts a1, which puts Black's own a1 stone in atari (c2 is
  the clean answer). Approved in the spec; consider dropping a1 or mentioning it in the explanation.
- M4: before an answer, choice/count screens show the reserved feedback card as an empty white box
  (M3 design); the M4 mockup drew it transparent.
- The no-JSX-text regex in `__tests__/qa/m2-board-quality.test.ts` is fragile (prefer
  `react/jsx-no-literals` or an AST check); its engine-call guard could also check imports from
  `@/engine`.
- Scenario chips scroll horizontally in fr/zh-CN (also in en: "Forbidden"/"Marks" are off-screen
  at 360 px).
- Web: react-native-web always reports a screen reader on, so `useScreenReader` returns false on web.

- M3: fr "Bientôt disponible" badge squeezes long unit titles at 360 px (shorter badge or badge
  under the title). zh-CN unit titles have no pinyin — confirm with the designer that this is intended.
- M3: §8 focus moves to text/feedback cards not done (only announcements); sound-off path waits
  for the M6 settings; QA's snapback goal test only checks "no throw".

## Product-owner preferences
- Approves every spec and every visual design before development.
- Design mood: 山水 · 茶 · 竹 — warm rice paper, misty sky, soft mountain ridges, bamboo board;
  **no leaves or petals**. App name "Let's GO" in all languages. Non-zh/fr locales → English.
- Not a programmer: PR descriptions show Go rules as ASCII diagrams with ✓; plain language.
- Tests on an iPhone with App Store Expo Go (`npm ci` then `npx expo start`).

## Agent models
- developer: Opus (`model: opus`); product-designer and qa: Sonnet (choice by the product owner).

## Environment notes (cloud sessions)
- Expo's online API is blocked by the proxy: use `EXPO_OFFLINE=1` for `npx expo install`.
- Web preview: `npx expo export --platform web` + static server; Chromium at
  `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`.
- Default branch is `master`.
