# Let's GO — 围棋 learning app

Mobile app that teaches Go (围棋 / Weiqi) from zero. Each lesson explains **one** rule,
then gives a practice set for that rule. Later lessons combine earlier rules, ending
in full 9×9 games against a beginner bot.

Read before starting work:
- `docs/TECH_STACK.md` — chosen stack and why
- `docs/CURRICULUM.md` — the lesson sequence and exercise types
- `docs/ROADMAP.md` — milestones; pick the next unchecked item

## Stack (summary)
Expo (React Native) + TypeScript, expo-router, react-native-svg board,
Zustand state, MMKV for progress, i18next — languages zh-CN (primary), en, fr; other locales fall back to en.
Tests: Jest (+ React Native Testing Library). E2E: Maestro (later).

## Repository layout
```
app/                 expo-router screens (UI only, no game logic)
src/engine/          pure TS Go rules engine — NO React/RN imports
src/board/           <GoBoard/> SVG component + interaction hooks
src/lessons/         lesson + exercise JSON content, loaders, validators
src/exercises/       exercise runners (place-stone, capture-race, tsumego, play-bot)
src/bot/             beginner AI opponent (pure TS)
src/store/           Zustand stores (progress, settings)
src/theme/           design tokens (colors, typography, spacing)
src/i18n/            zh-CN.json, en.json, fr.json
__tests__/ or *.test.ts next to the code
```

## Commands
- `npm install` — install deps
- `npx expo start --web` — run in browser (use this in cloud sessions to screenshot UI with Playwright)
- `npm test` — Jest
- `npm run lint` / `npm run typecheck` — must pass before every commit

## Rules for Claude
1. **Engine first, test-first.** Every rule in `src/engine` (liberties, capture, suicide,
   ko, scoring) gets unit tests with explicit board diagrams before UI uses it.
   Write boards in tests as ASCII (`.` empty, `X` black, `O` white) for readability.
2. **Engine is pure.** No React, no timers, no I/O in `src/engine` and `src/bot`. Immutable
   board state; functions return new states.
3. **Rules = Chinese rules** (area scoring 数子法, komi 7.5 for 19×19 / configurable for 9×9,
   positional superko not required — simple ko is enough for beginners).
4. **Lessons are data, not code.** Add a lesson by adding JSON in `src/lessons/` that
   validates against the schema in `src/lessons/schema.ts`. Don't hardcode lesson text in screens.
5. **All user-facing text through i18n, in all three languages (zh-CN, en, fr).** Chinese term + pinyin
   on first use (e.g. 气 qì — liberty / liberté). Every key must exist in every language file.
6. **Small PRs.** One roadmap item per branch/PR. Run lint, typecheck, test before pushing.
7. **Mobile-first UI.** Board must fit a 360px-wide screen; tap targets ≥ 44px; stone placement
   shows a preview on touch-down and commits on touch-up.
8. Don't add dependencies without noting why in the PR description.
9. **No backend in the MVP.** The app works fully offline: in-app bot (`src/bot`), lesson text
   from JSON, and engine-generated feedback messages.
10. **AI tutor (backlog M7): the engine computes facts, the AI only phrases them.** Never ask a
    language model to read the board by itself — send it engine facts (liberties, atari,
    captures, legal-move reasons). The API key lives only in the server function, never in the app.

## Team workflow (subagents in `.claude/agents/`)
For each roadmap item, the main session coordinates three agents in order:
1. **product-designer** (PO + UX/UI + game design) → writes `docs/specs/<milestone>-<name>.md`
   with user stories, acceptance criteria, screen flow, lesson content, game-design notes.
   Show the spec to the user for approval before development.
2. **developer** → implements the spec test-first; lint/typecheck/tests green.
3. **qa** → maps every acceptance criterion to a test, adds edge-case tests, checks the UI on
   web at 360×740, reports READY / NOT READY with bugs.
   If NOT READY → back to **developer** with the bug list, then **qa** again.
4. Optional: **product-designer** reviews the result from the learner's view.
5. Main session ticks the item in `docs/ROADMAP.md`, commits and opens one PR.

Example prompt: "Do the next roadmap item with the team: product-designer spec → my approval →
developer → qa loop until READY → PR."
