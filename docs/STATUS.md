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

## In progress — M4 item 1: content units 1–5 (branch `claude/m4-content-units-1-5`, no PR yet)
Paused 2026-10-16 to save tokens. Resume in a new session on this branch.
- **Done:** spec `docs/specs/M4-content-units-1-5.md` + mockup `docs/specs/M4-mockup.html` —
  **approved by the PO** (all 7 decisions in spec §12). Developer started (commit "WIP M4"):
  six lesson JSON files in `src/lessons/content/` (u01-board … u05-atari, u05-review), registry +
  loader (`PLANNED_UNITS = [6]`), i18n texts in all three files, unit-map badge moved under the
  title (`src/exercises/UnitMap.tsx`). Typecheck passes.
- **Fixed (2nd pass):** fr non-breaking spaces (71 strings), M3 tests updated to the M4 map
  (units 1–5 real, only 6 "coming soon", Start learning → Unit 1 in production, sample → Next lesson),
  skeleton bars keep their fixed 72 px. **lint + typecheck + 1246 tests green.**
- **Left to build (developer):**
  1. Write tests for the new M4 acceptance criteria (spec §4 AC 1–18: counts, solutions table,
     text rules, play-through/unlock, stars, map states, result Next → `u05-review`).
  2. Web screenshots at 360×740 → `docs/screenshots/M4/` (unit map en/fr/zh-CN, longest step text
     per lesson, labelled-stone choices) — ACs 19–23.
- **Then:** qa agent (spec §4 → tests, web check) → developer/qa loop until READY → tick
  `docs/ROADMAP.md` → update this file → one PR (plain language, ASCII Go diagrams with ✓).
- Note: in a fresh cloud session the custom agents load only if the repo is attached at session
  start; otherwise run them as general-purpose agents told to follow `.claude/agents/<role>.md`.

## Next
- **M4 item 2:** beginner bot v1 (heuristic) + Capture Go 吃子棋 (Unit 6) — separate spec/PR.

## Known follow-ups (minor, not scheduled)
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
