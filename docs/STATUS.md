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

- **M5 item 1** Units 7–9 + checkpoint (branch `claude/m5-ko-ladders`): `u07-forbidden`,
  `u08-ko`, `u09-ladder`, `u09-review` (29 exercises, zh-CN/en/fr), new optional exercise field
  `prelude` (moves played before the exercise starts; carries the ko ban). Ladders taught with
  one-move exercises (Option B, no `sequence` runner yet); nets 枷 deferred. Spec
  `docs/specs/M5-ko-forbidden-ladders.md` (PO decisions §12a). Web check `npm run verify:web:m5`;
  screenshots `docs/screenshots/M5/`. 7×7 boards with coordinates have 41 px cells (PO: keep).
  PO checked units 7–9 (2026-10-20): all good. PR #14.

- **M5 item 2** SGF import (branch `claude/m5-sgf-import`, PO-approved spec, QA READY, 2337 tests):
  pure `src/sgf/` (parse/convert/expand), `sequence` exercise type + validator rules (SEQ_*; no
  runner, no shipped lesson — guarded by a test), `npm run import:sgf` (`scripts/import-sgf.ts`,
  own Jest config like `tune:bot`) turns `content-src/*.src.json` + SGF into lesson JSON
  (`generatedFrom`); drift test in `__tests__/sgf-pipeline.test.ts`. Spec `docs/specs/M5-sgf-import.md`.
  QA nits (later): one bad SGF used by N exercises prints N identical errors; validator errors
  point at `file:1:1` with the `exercises[i]` path in the message.

- **M5 item 3** life & death (branch `claude/m5-life-death`, PO-approved spec, QA READY, 2748 tests):
  `u10-eyes`, `u11-two-eyes`, `u11-vital`, `u11-review` (3 SGF kill problems via `import:sgf`), `sequence`
  runner (`src/exercises/sequence.ts`, `runners/SequenceRunner.tsx`), `UnitEntry.laterLessons` (2 lessons per unit),
  app-wide layout rule (instructions top / board / feedback bottom; explanation text card 120 px) and lighter bamboo
  tokens with a WCAG contrast test. Spec `docs/specs/M5-life-death.md` (§12a PO, §12b dev deviations). Web check
  `npm run verify:web:m5c`; screenshots `docs/screenshots/M5/20-*`–`22-*`. Unit 12 is "coming soon".
  Not verified: 9×9 layout only on `/dev/board`; screen reader may announce the opponent stone twice; no iPhone check.

- **M5 item 3b** sequence v2 (branch `claude/m5-sequence-v2`, stacked on #16; PO-approved spec, QA READY, 2883 tests):
  pure `src/bot/forcedCapture.ts` (bounded forced-capture search, defender policy `run`, node cap 3 000), additive
  `judge: {kind:'search'}` on `sequence` exercises + validator codes (SEQ_NOT_FORCED, SEQ_NODE_BUDGET, …), runner shows
  White's reply + facts on a wrong move, hint ring follows the position. Ladder play-along: `ladder-play`,
  `ladder-play-corner` (u09, now 9 exercises), `r-ladder-play` (review, 9). Spec `docs/specs/M5-sequence-v2.md`
  (§9a PO, §9b dev deviations). **Pending PO: the search also accepts the net 枷 at move 2 (e4/g6/e2) — correct Go,
  AC 2/27 text to amend.** Web check `npm run verify:web:m5d`; screenshots `docs/screenshots/M5/23-*`.

- **M5 item 4** territory & counting (branch `claude/m5-territory-counting`, PO-approved spec, QA READY, 3430 tests):
  `u12-territory`, `u13-counting`, `u14-end`, `u14-review` (28 exercises, zh-CN/en/fr). New `mark` exercise type
  (`mark: 'territory' | 'dead'`, validator MARK_*, dead groups proved by `forcedCapture`), `MarkRunner`, `count`
  `score` answer + two-digit entry pad (`CountEntryRunner`, typed wrong-count lines), `choice` `prove` (engine-proved
  owner / winner with komi). Revealed two-option choices now keep the wrong option's reason (all lessons).
  `PLANNED_UNITS = []`. Spec `docs/specs/M5-territory-counting.md` (§12a PO, §12b dev deviations). Web check
  `npm run verify:web:m5e` (needs Node 22); screenshots `docs/screenshots/M5/24-*`–`39-*`.
  **Pending: PO iPhone check** — `docs/specs/M5-territory-iphone-checklist.md`. Note: web a11y labels per point
  aren't exposed on web (covered by Jest only).

- **M6 item 1** bot levels 1–3 for 9×9 + end-of-game count (branch `claude/m6-bot-levels`, PO-approved spec, QA READY, 3651 tests):
  `src/bot` level 1 (`board9` option, Capture Go unchanged), level 2 (one-ply scoring), level 3 (flat Monte-Carlo, 1 200 seeded
  playouts on a mutable `playout.ts` board, softmax `MC_TEMPERATURE = 0.21`; ~170 ms/move desktop), `eyes.ts`, `board9.ts` (passing),
  `deadStones.ts` (forcedCapture + playouts). Pure `src/game9` (session reducer: play / pass / Count now / Resign / mark dead /
  dispute / Play on / count; `GAME_KOMI_9 = 5.5`), UI `src/game9/ui`, routes `app/game/`, Home card (≥1★ Unit 14) + Unit 14 result
  button, progress `bots`/`flags`, `game9.*` keys. Names 入门 Easy / 普通 Normal / 挑战 Challenge. Tuning `npm run tune:bot9`.
  Spec `docs/specs/M6-bot-levels.md` (§12a PO, §12b dev deviations + win rates). Web check `npm run verify:web:m6`; screenshots
  `docs/screenshots/M6/`. **Pending PO:** Normal is stronger than §7 says (Sensible wins 20 %, target 50–60 %); Challenge 24 %
  (target 25–35 %). Not covered by tests: AC 40 (screen-reader announcements), AC 41 (reduced-motion delay). No game save in v1.

- **M6 item 2** settings, onboarding, accessibility pass (branch `claude/m6-settings-onboarding-a11y-a32e0e`, PO-approved spec, QA READY, 4194 tests):
  settings store `src/store/settings.ts` (language persisted, sound gate, reduce motion = OS OR app switch), Settings screen (Atari warnings
  switch shared with the picker, erase progress with confirm sheet, `reset({keepFlags})`), 2-step intro `app/onboarding.tsx` (Welcome page +
  touch demo, `onboardingSeen`, skipped for learners with progress, replay from Settings), developer sample `u00-sample` removed (fixture copy
  in `src/lessons/__fixtures__/`), Home grouped in 3 collapsible modules (`src/lessons/modules.ts`), 9×9 card unlocked from the start (PO).
  A11y: each move/feedback announced once (`GoBoard announce={false}` where the screen speaks), `expectAccessible` audit helper, `textScale`
  caps, contrast tests, web `aria-*` on SwitchRow/module headers. Spec `docs/specs/M6-settings-onboarding-a11y.md` (§12a PO, §12b dev
  deviations). Web check `npm run verify:web:m6s`; screenshots `docs/screenshots/M6/60-*`–`82-*`. **Pending PO:** iPhone checklist
  `docs/specs/M6-a11y-device-checklist.md` (VoiceOver/TalkBack, Larger Text, OS Reduce Motion, sound).

## Next
- M6 items 1, 1b, 1c, 2 done. Next: M6 "EAS Build, TestFlight / Play internal testing" (incl. the MMKV swap). Later: nets 枷 and multi-answer tsumego on the
  search judge (revisit the libs > moves-left pruning, spec §9b).
- Minor (QA, M5): zh-CN `engine.illegal.suicide`/`.ko` contain pinyin; empty reserved feedback
  card under choice options (same as the M4 note below).

- **M6 item 1b** game coaching for 9×9 (branch `claude/m6-game-coaching`, PO-approved spec, QA READY, 3803 tests):
  pure `src/coach/` (move notes from MoveFacts, 提示 hint via level-2 `scoreMoves` — unlimited on Easy/Normal, 3 on Challenge, post-game
  review 复盘 with 1–3 key moments: big capture, lost group "in atari since move m", playout swing via `winRate()`).
  UI: note in the FeedbackCard, Hint row, `ReviewView` (chunked prep + Skip, chips, Prev/Next), board `diamond` marker.
  Spec `docs/specs/M6-game-coaching.md` (§12b dev deviations). Web check `npm run verify:web:m6c` (Node 22); screenshots
  `docs/screenshots/M6/40-*`, `50-*`–`58-*`. Shared feedback slot order agreed with the beginner-friendly branch
  (illegal > danger atari > coach note/hint > capture/pass; dedupe atari). Web/mouse: notes clear on next move, not on touch.
- **M6 item 1c** beginner-friendly 9×9 (branch `claude/m6-beginner-friendly`, PO-approved spec, QA READY, 3946 tests):
  handicap 让子 2–5 (pure `src/game9/handicap.ts`; White first, komi 0.5; picker row + Start; auto-adjust ±1 per level in
  progress `bots[L].handicap`, start Easy 2 / Normal 5 / Challenge 5 from tuning), take-back 悔棋 (Easy ∞ / Normal 3 / Challenge 1,
  reducer `history`), danger rings + atari line (`src/game9/danger.ts` `dangerOf`, dedupes coach atari/escape notes), softer Easy
  (blunder 0.6, skipSave/skipAtari 0.5) and Normal slip 0.7 (Sensible wins Easy 92.5 %, Normal 57 %). Fixed dev web warnings
  `accessible`/`collapsable` (icons.tsx, Landscape, Sheets, GoBoard `CircleNoCollapse`). Spec `docs/specs/M6-beginner-friendly.md`
  (§6 tuning, §14 dev deviations). Web check `e2e/verify-web-m6-beginner.mjs` (dev server :8099); screenshots `docs/screenshots/M6/20-*`–`30-*`.
  **Pending PO:** confirm start Normal 5 (= max, no step up after a loss); L3 handicap numbers are 25-seed and noisy.
- **M4 item 2 — PR #13 open (2026-10-19), QA READY, awaiting merge + PO iPhone check.** Branch
  `claude/m4-second-half-kickoff-15r25e`. Spec `docs/specs/M4-bot-capture-go.md` is PO-approved
  (§15: all §14 defaults accepted), mockup `docs/specs/M4-bot-mockup.html`.
  - Done (committed): `src/bot` (seeded RNG, level-1 heuristic, Capture Go rules, analysis, tests).
  - Developer pass done (2026-10-19, local): typecheck fixed, content + i18n checked against §8/§11,
    route tests for AC 55/62, score halves show the colour only (mockup; `game.score` removed), lose
    card with Skip fits 740 px. Bot tuning: `npm run tune:bot` (`scripts/bot-tuning.tune.ts`, own
    Jest config, not in `npm test`); report in spec §16 — blunder values PO-approved (2026-10-19).
    Web check `npm run verify:web:m4` covers Unit 6 (screenshots `docs/screenshots/M4/10-*`…`17-*`).
  - QA READY (+15 edge-case tests, 1859 tests total); roadmap ticked; PR #13.
  - Idea for later (PO): learner-selectable bot difficulty Easy / Normal / Challenge (Normal = §16
    values); spec it as its own roadmap item, aligned with M6 "Bot levels 1–3".
  - Local macOS: use Node 22 (`.nvmrc`); if watchman is broken run `npx jest --no-watchman`; web check
    with `CHROMIUM_PATH` (local Chrome) and `PLAYWRIGHT_PATH` (a `playwright-core` install).

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
