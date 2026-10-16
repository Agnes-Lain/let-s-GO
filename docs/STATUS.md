# Project status (handoff for new sessions)

Read this + `CLAUDE.md`, then continue. Keep it short; update it at the end of each milestone.

## Done (merged to `master`)
- **M0** project setup: Expo **SDK 57** (App Store Expo Go supports 57, not 58 — don't upgrade
  until it does), expo-router, i18n zh-CN/en/fr, theme tokens (`src/theme/tokens.ts`, incl.
  bamboo board tokens), CI on GitHub Actions. Spec: `docs/specs/M0-project-setup.md`.
- **M1** rules engine `src/engine` (pure TS, 441 tests): board/coordinates/ASCII, groups &
  liberties, play/checkMove/legalMoves, captures, suicide, simple ko, MoveFacts, pass/game end,
  `score()` Chinese area scoring. Spec + decisions D1–D9: `docs/specs/M1-rules-engine.md` §9.

## In progress
- **M2** board UI — spec `docs/specs/M2-board-ui.md` + mockup `docs/specs/M2-mockup.html` approved
  (PO decisions in spec §12). PRs 1–3 done (static board; touch/feedback/a11y; motion + `expo-audio`
  stone sound, synthesized CC0 asset in `assets/sounds/`). Next: **PR 4 — web verification**
  (spec §10 item 4, ACs 57–61: Playwright at 360×740, screenshots in `docs/screenshots/M2/`).
- Known minor follow-ups: the no-JSX-text regex in `__tests__/qa/m2-board-quality.test.ts` is fragile
  (prefer `react/jsx-no-literals` or an AST check); the engine-call guard there could also check
  imports from `@/engine`; scenario chips scroll horizontally in fr/zh-CN.
- Web note: react-native-web always reports a screen reader on, so `useScreenReader` returns false on web.
- Stone sound not yet heard on a real device — PO to confirm on iPhone.

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
