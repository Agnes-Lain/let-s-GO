# Technical stack proposals

## Recommended: Expo (React Native) + TypeScript

| Layer | Choice | Why |
|---|---|---|
| App framework | **Expo SDK (React Native)**, TypeScript strict | One codebase → iOS + Android + **web**. Web build lets Claude Code preview and screenshot the UI inside a cloud session (no simulator there). |
| Navigation | expo-router | File-based routes: `app/lessons/[id].tsx` maps cleanly to the curriculum. |
| Board rendering | react-native-svg (upgrade to @shopify/react-native-skia only if animation perf is an issue) | A 9×9 / 19×19 grid is simple vector graphics; SVG is easy to test and works on web. |
| Rules engine | Own pure-TS module (`src/engine`) | Small (~500 lines), fully unit-testable, and lessons need custom hooks ("highlight liberties", "is this move atari?") that libraries don't expose. |
| Game records | SGF parsing via `@sabaki/sgf` | Import tsumego/problem sets in the standard format. |
| State | Zustand | Minimal boilerplate; fine for progress + current exercise. |
| Local persistence | react-native-mmkv (or expo-sqlite if progress gets relational) | Offline-first; progress, stars, unlocked lessons. |
| i18n | i18next + expo-localization | 中文 first, English second. |
| Animations | react-native-reanimated | Capture animations, stone drop, success feedback. |
| Sound | expo-audio | Stone click sounds matter for feel. |
| Beginner bot | Own TS bot: heuristics (capture > save atari > extend liberties > random-legal), later Monte-Carlo playouts for 9×9 | Runs on-device, no server. KataGo is far too strong/heavy for beginners. |
| Testing | Jest + React Native Testing Library; Maestro for E2E flows | Engine tests are the core safety net. |
| Lint/format | ESLint (expo config) + Prettier | |
| CI | GitHub Actions: lint, typecheck, test on every PR | Claude sessions can watch PR CI and fix failures. |
| Builds/release | EAS Build + EAS Submit; EAS Update for OTA lesson-content fixes | No Mac needed for iOS builds. |
| Backend (optional, later) | Supabase (auth + progress sync + leaderboard) | Skip for MVP; the app works fully offline. |

## Alternative A: Flutter (Dart)
- + Excellent custom-painting performance (CustomPainter for the board), single codebase, polished animations.
- − Web preview is heavier; smaller ecosystem for Go/SGF tooling; Claude Code is somewhat stronger in TS than Dart.
- Choose if you already know Flutter or want maximum animation smoothness.

## Alternative B: Native (SwiftUI + Kotlin/Compose)
- + Best platform feel and performance.
- − Two codebases, two rule engines (or a shared Kotlin Multiplatform engine). Hard to verify UI in a cloud session.
- Choose only if targeting one platform.

## Alternative C: PWA (Vite + React + TypeScript)
- + Fastest to build and test; installable on phones; zero store review.
- − Weaker store presence, limited offline audio/haptics on iOS.
- Good as a **prototype**: the `src/engine` and lesson JSON port directly into the Expo app later.

## Decision
Start with **Expo + TS**. Keep `src/engine`, `src/bot`, and `src/lessons` framework-free so they
can be reused by a web build, a backend, or a future rewrite.
