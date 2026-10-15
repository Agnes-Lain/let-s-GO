# Roadmap

One checkbox ≈ one Claude Code session ≈ one PR. Paste the suggested prompt into a new session.

## M0 — Project setup
- [ ] Scaffold Expo + TS app, expo-router, ESLint/Prettier, Jest, folder layout from CLAUDE.md
  > Prompt: "Scaffold the project per CLAUDE.md and docs/TECH_STACK.md. Add npm scripts lint, typecheck, test. Add a GitHub Actions workflow running them on PRs. Open a PR."
- [ ] GitHub Actions CI (lint, typecheck, test)

## M1 — Rules engine (`src/engine`)
- [ ] Board model, coordinates, ASCII board helper for tests
- [ ] Groups & liberties
- [ ] Move legality: occupied, suicide, simple ko; captures
- [ ] Pass / game end, Chinese area scoring + komi
- [ ] SGF import for problem sets
  > Prompt: "Implement <item> in src/engine test-first, using ASCII boards in tests. No React imports."

## M2 — Board UI (`src/board`)
- [ ] `<GoBoard size stones onPlay highlights markers/>` with SVG, star points, coordinates
- [ ] Touch preview + commit, last-move marker, capture animation, stone sound
- [ ] Verify on web via `npx expo start --web` + Playwright screenshot at 360×740

## M3 — Lesson framework
- [ ] Lesson JSON schema + validator + loader
- [ ] Explanation player (step-through boards with text)
- [ ] Exercise runners: tap-point, play-move, choice, count
- [ ] Progress store (stars, unlocks) with MMKV
- [ ] Home / unit map screen

## M4 — Content units 1–6 (through 吃子棋 Capture Go)
- [ ] Units 1–5 content (zh + en)
- [ ] Beginner bot v1 (heuristic) + Capture Go mini-game

## M5 — Units 7–14
- [ ] Ko, forbidden points, ladders/nets
- [ ] Eyes, life & death (`sequence` runner for tsumego)
- [ ] Territory & counting exercises

## M6 — Full games & release
- [ ] Bot levels 1–3 for 9×9 (Monte-Carlo playouts for level 3)
- [ ] Settings, onboarding, accessibility pass
- [ ] EAS Build, TestFlight / Play internal testing
