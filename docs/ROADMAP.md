# Roadmap

One checkbox ≈ one Claude Code session ≈ one PR. Paste the suggested prompt into a new session.

## M0 — Project setup
- [x] Scaffold Expo + TS app, expo-router, ESLint/Prettier, Jest, folder layout from CLAUDE.md
  > Prompt: "Scaffold the project per CLAUDE.md and docs/TECH_STACK.md. Add npm scripts lint, typecheck, test. Add a GitHub Actions workflow running them on PRs. Open a PR."
- [x] GitHub Actions CI (lint, typecheck, test)

## M1 — Rules engine (`src/engine`)
- [x] Board model, coordinates, ASCII board helper for tests
- [x] Groups & liberties
- [x] Move legality: occupied, suicide, simple ko; captures
- [x] Move facts after each move (captures, atari, liberties) — needed by M3 feedback and M7 tutor
- [x] Pass / game end, Chinese area scoring + komi
  > Prompt: "Implement <item> in src/engine test-first, using ASCII boards in tests. No React imports."

## M2 — Board UI (`src/board`)
- [x] `<GoBoard size stones onPlay highlights markers/>` with SVG, star points, coordinates
- [x] Touch preview + commit, last-move marker, capture animation, stone sound
- [x] Verify on web via `npx expo start --web` + Playwright screenshot at 360×740

## M3 — Lesson framework
- [x] Lesson JSON schema + validator + loader
- [x] Explanation player (step-through boards with text)
- [x] Exercise runners: tap-point, play-move, choice, count
- [x] Progress store (stars, unlocks) — AsyncStorage behind an adapter; MMKV at the EAS build (M6)
- [x] Home / unit map screen

## M4 — Content units 1–6 (through 吃子棋 Capture Go)
- [x] Units 1–5 content (zh + en + fr)
- [x] Beginner bot v1 (heuristic) + Capture Go mini-game

## M5 — Units 7–14
- [x] Ko, forbidden points, ladders (nets deferred)
- [x] SGF import for problem sets (moved from M1)
- [x] Eyes, life & death (`sequence` runner for tsumego)
- [ ] Territory & counting exercises

## M6 — Full games & release
- [ ] Bot levels 1–3 for 9×9 (Monte-Carlo playouts for level 3)
- [ ] Settings, onboarding, accessibility pass
- [ ] EAS Build, TestFlight / Play internal testing

---

# Backlog (after MVP)

## M7 — AI tutor 问老师 "Ask the teacher" (needs a small backend)
Optional button on exercises and finished games that explains *why* a move was good or bad.
- [ ] Engine "facts" API: `describePosition(state, move)` returns structured facts (groups, liberties,
      atari, captures, illegal-move reason, missed capture/escape point). Pure TS, unit-tested. Useful offline too.
- [ ] Server function (Supabase Edge Function or Cloudflare Worker) holding the Claude API key.
      The key is **never** shipped in the app.
- [ ] Auth + per-user rate limit / daily quota; log token usage.
- [ ] Prompt: "patient Go teacher", answer in the user's language, short (≤ 3 sentences),
      use only the provided engine facts, never invent board analysis.
- [ ] App UI: "问老师" button, loading state, graceful offline message, report-bad-answer button.
- [ ] Eval set: ~50 positions with expected key points; check answers mention the right facts.

## M8 — Accounts & sync (optional)
- [ ] Supabase auth; sync progress across devices
- [ ] Post-game review: engine finds the biggest mistakes, AI tutor explains them
- [ ] Play online vs friends (9×9)
