# M6 — Settings, onboarding, accessibility pass

Status: PO-approved 2026-10-23 (§12a). Roadmap line 50. One small PR. Out of scope: the MMKV swap (next item, EAS Build).

## 0. In plain words
Five things that make the app feel finished (items 4–6 added after PO feedback, see §14):
1. **Settings that stick.** The language you choose is remembered after you close the app. New switches: stone sound, reduce motion, atari warnings. An "Erase progress" button that first asks for confirmation (one confirm sheet).
2. **A 2-screen intro** the very first time the app opens: a Welcome page (what the app is, what Go is, a "Start learning" button) and a practice screen for the one gesture (touch shows a faint preview, lifting the finger places the stone). Skippable, shown once, replayable from Settings.
3. **An accessibility pass:** screen-reader labels checked on every screen, the two untested game announcements now tested, the "stone announced twice" bug fixed, every button at least 44 px, text contrast measured, big-text behaviour decided.
4. **Welcome page** (merged into the intro, see item 2; no second welcome screen on Home).
5. **No more developer sample** at the start of the learning path (the "Sample (developer)" unit 0).
6. **Three modules on Home**, each a collapsible group of units: The basics (units 1–5), Playing an opponent (6–9), Winning a game (10–14).

## 1. Goal
A total beginner opens the app for the first time, understands in under a minute what Go is and how to place a stone, starts lesson 1, and can later change language, sound and motion (all remembered), while someone using VoiceOver/TalkBack hears each move once and can reach every control.

## 2. User stories
1. As a French-speaking beginner, I want the language I picked to still be there tomorrow so that I do not have to change it every launch.
2. As a learner on a train, I want to switch the stone sound off so that I do not disturb others.
3. As a learner who gets dizzy from animation, I want a reduce-motion switch so that stones and tips appear without moving effects, even if I never found the phone setting.
4. As a learner who finds the red rings and atari line noisy, I want to turn them off from Settings, not only from the game picker.
5. As a learner who wants a fresh start, I want to erase my progress, but only after a clear confirmation so that I cannot do it by accident.
6. As a total beginner, I want a short intro that tells me what Go is and how a tap places a stone so that the first lesson is not a surprise.
7. As an impatient or returning learner, I want to skip the intro (and never see it again unless I ask) so that I get to play at once.
8. As a screen-reader user, I want every control labelled and each move announced once, in my language, so that I can follow a game.
9. As a user with low vision, I want readable contrast and text that grows with my phone's text size without breaking the board screen.
10. As a first-time visitor, I want the first screen to tell me what this app is and what Go is, with one obvious button, so that I know in 10 seconds whether it is for me.
11. As a learner, I want the learning path to show only real lessons so that I am not confused by a "Sample (developer)" entry.
12. As a learner facing 14 units, I want them grouped in three named modules that I can open and close so that the home screen feels short and I see which stage I am in.
13. As a learner, I want each module to show how far I am (for example "3 of 6 done") and which later modules are still locked so that I know what is next.
14. As a screen-reader user, I want each module header announced as a button that is expanded or collapsed so that I can skip a module I have finished.

## 3. Decisions taken in this spec (defaults; PO may overturn, see §12)
| Topic | Decision |
|---|---|
| Where settings live | New store `src/store/settings.ts`, own storage key `settings`, version 1, same `StorageAdapter` (so the MMKV swap changes one file). Fields: `language: 'system'\|'zh-CN'\|'en'\|'fr'` (default `system`), `sound: boolean` (default true), `reduceMotion: boolean` (default false). |
| Atari warnings | Stay the existing progress flag `flags.atariHintsOff` (no migration). Settings and the 9×9 picker show the **same** switch. |
| Handicap | Stays on the 9×9 picker only. It is a per-game, per-level suggestion that auto-adjusts (`bots[L].handicap`); a global default in Settings would fight the auto-adjust. |
| Reduce motion | App switch is **added to** the phone setting: effective = phone setting OR app switch. The app can never switch motion back on against the phone. When the phone setting is on, the switch shows on and disabled with an explanation line. |
| Sound | A stone sound already exists (`src/board/sound.ts`, `expo-audio`, respects the silent switch). Today `GoBoard` plays it by default and `ResultView` plays it; most runners and the 9×9 game pass `sound={false}`. The new switch gates `playStoneSound()` centrally (`setSoundEnabled`, wired once at start-up). Turning sound on in more places is out of scope. |
| Onboarding flag | New progress flag `flags.onboardingSeen` (set when the intro is left by Finish, Skip or system Back; not when the app is killed mid-way). An existing player (any lesson stars or any `bots` record) is treated as "seen" without writing anything. |
| Reset | `Erase progress` clears lessons, bot records, handicap suggestions and the one-time-tip flags, but **keeps** `atariHintsOff`, `onboardingSeen` and all of `settings`. Needs a new `reset({ keepFlags })` option (today `reset()` clears every flag). |
| Welcome page (PO) | **Recommended: the Welcome page is step 1 of the intro**, not a separate Home banner. Home stays the map. Intro is 2 steps: Welcome, then the touch demo whose button opens lesson 1. |
| Sample removal (PO) | The unit-0 lesson `u00-sample` ("Sample (developer)") is removed from the app's lesson registry, the Home map and the app's i18n files. It only ever showed in dev builds (Expo Go and `EXPO_PUBLIC_DEV_LESSONS=1` web checks); release builds already hid it. Details in §4.7. |
| Modules (PO) | Pure table `src/lessons/modules.ts`: module 1 = units 1–5, module 2 = units 6–9, module 3 = units 10–14. Home draws one collapsible group per module; unlock rules (stars) are unchanged. Details in §4.8. |
| Start-up | Root layout shows only the background colour until both stores are hydrated (cap 1 s, then defaults) so the first frame is never in the wrong language. |

## 4. Acceptance criteria
Tags: **J** = Jest (RNTL / pure), **W** = web check at 360×740 (`e2e/verify-web-m6-settings.mjs`, dev server), **D** = PO device check (VoiceOver/TalkBack/iPhone), in `docs/specs/M6-a11y-device-checklist.md` (QA writes). Web cannot detect a screen reader (react-native-web always reports one on; `useScreenReader` returns false on web), so every announcement AC is J or D, never W.

### 4.1 Settings store and persistence
1. **J** Given an empty storage, when the settings store hydrates, then state is `{language:'system', sound:true, reduceMotion:false}`, `hydrated:true`.
2. **J** Given storage key `settings` holds `{"v":1,"language":"fr","sound":false,"reduceMotion":true}`, when a new store is created over it, then those three values load.
3. **J** Given a corrupt value (`not json`), a wrong version (`"v":2`), `language:"de"`, or `sound:"yes"`, then each bad field falls back to its default and the others that are valid are kept; nothing throws.
4. **J** Given the learner calls `setLanguageChoice('fr')`, then i18n language is `fr` immediately, the store writes `settings` with `language:'fr'`, and a second store/i18n started over the same storage resolves `fr` (simulated restart). Same for `'zh-CN'` and `'en'`.
5. **J** Given `language:'system'` and the device language is `de`, then the UI language is `en` (fallback unchanged, D2); with device `zh-Hans` it is `zh-CN`.
6. **J** Given the learner changes a setting before hydration finished, then the change wins over the stored value and is saved (same rule as progress).
7. **J** The M0 test that says the language is "not persisted" (AC 27 of M0) is replaced by AC 4 above; no other M0 test changes.
8. **W** Given Settings with French chosen, when the page is reloaded, then Settings and Home are in French from the first painted frame (screenshot 74).

### 4.2 Sound and reduced motion
9. **J** Given `sound:false`, when a stone is placed on a `<GoBoard sound>` or the result screen would play the tock, then `playStoneSound` does not call the player (mock `expo-audio`: `createAudioPlayer` and `play` not called). Given `sound:true` it is called once per placed stone.
10. **J** Toggling sound in Settings takes effect for the next stone without restart and is saved.
11. **J** `useReduceMotion()` returns true when the OS reports reduce-motion, or when `settings.reduceMotion` is true; false only when both are false. Before the OS answers it still returns true (current behaviour, unchanged).
12. **J** Given OS reduce-motion on, then the Settings switch is rendered checked, `accessibilityState.disabled=true`, and the line `settings.motion.osOn` is visible; pressing it changes nothing.
13. **J** Given the app switch on and OS off, then a board using `<GoBoard>` renders placement without the 120 ms animation and capture without the 300 ms fade (reuse the existing GoBoard motion tests with the setting instead of the mocked OS value) and `ExplainPlayer`/`ResultView` skip their motion.
14. **J (closes M6 bot-levels AC 41)** Given reduce-motion true and a learner move in a 9×9 game, then the bot replies after `BOT_DELAY_REDUCED_MS` (300 ms) and not before (fake timers: nothing at 299 ms, one move at 300 ms); given false, after `BOT_DELAY_MS` (700 ms).
15. **W** Toggle Reduce motion on, place one stone on the onboarding demo board: the stone appears in the very next frame (no intermediate opacity). Screenshot 64 shows the switch on.

### 4.3 Settings screen
16. **J** Settings renders, in this order: Language (4 radio rows, existing), "Sound and motion" (Stone sound switch, Reduce motion switch), "Games" (Atari warnings switch), "Help" (Show the intro again), "Progress" (Erase progress), then Version. In `__DEV__` the dev row stays after Progress.
17. **J** Each switch row is one `Pressable` (`accessibilityRole="switch"`, `accessibilityState.checked`, label = row title, hint = description) of height ≥ 52; pressing anywhere on the row toggles it.
18. **J** The Atari warnings switch reads and writes `flags.atariHintsOff` (inverted); changing it in Settings is reflected on the 9×9 picker switch and vice versa. A game started afterwards uses it (`startSession(..., !atariHintsOff)`).
19. **J** There is no handicap control in Settings.
20. **J** Given the learner presses Erase progress, then a confirm sheet opens (title `settings.reset.title`, body, buttons Keep / Erase) and nothing is erased yet; Keep is the first and visually primary button; Android back and tapping the dim area close the sheet without erasing.
21. **J** Given the sheet is open, when Erase is pressed, then `lessons`, `bots` and the flags `passExplained`, `easierTipShown`, `takebackExplained` are cleared and the storage key is rewritten without them; `atariHintsOff`, `onboardingSeen` and `settings` are unchanged; the sheet closes and the line `settings.reset.done` shows (announced to screen readers); Home afterwards shows lesson 1 as the Continue card with 0 stars.
22. **J** The sheet traps screen-reader focus (`accessibilityViewIsModal`), as the game sheets do.
23. **W** Settings at 360×740: scrolls vertically, no horizontal scroll, all rows ≥ 52 px high, back button ≥ 44 px; screenshots 60–63 in en, fr, zh-CN; long fr lines wrap (≤ 3 lines), nothing is cut.

### 4.4 Onboarding
24. **J** Pure `shouldShowOnboarding({flags, lessons, bots, hydrated})` is true only when hydrated, `onboardingSeen` is not set, and there are no lesson records and no bot records. False while not hydrated. A leftover `lessons['u00-sample']` entry does not count as progress (AC 51).
25. **J** Given a fresh install, when the app starts (both stores hydrated), then the route is `/onboarding` instead of Home. Given `onboardingSeen`, or any existing progress, the route is Home and no flag is written.
26. **J** The intro has exactly 2 steps (§5.2): Welcome, then the touch demo. "Start learning" on step 1 goes to step 2; the system Back on step 2 goes to step 1; on step 1 it behaves as Skip.
27. **J** Skip (top right, every step) and system Back on step 1 set `onboardingSeen`, replace the route with Home; Back from Home does not return to the intro.
28. **J** "Go to lesson 1" on step 2 sets `onboardingSeen` and opens `/lesson/u01-board` (replacing the intro; Back from the lesson goes to Home). In replay mode (§5.4) the final button reads Done and returns to Settings.
29. **J** The step 2 demo uses `<GoBoard size={5}>` with the real touch handling: touch-down on `c3` shows the ghost preview and no stone; touch-up on the same point places a Black stone at `c3` and shows `onboarding.2.done`; touch-down then sliding off the board and lifting places nothing. (Verify the slide-off behaviour in GoBoard before writing the sentence; if the board does not cancel on slide-off, drop that sentence, not the behaviour.)
30. **J** A second tap on an occupied point shows the standard illegal-move message from the engine (no new copy); play alternates White/Black so the demo can be tried more than once; no stone ever becomes unplayable because of a hidden rule (the demo board is left empty at start, so the first stone is always legal).
31. **J** Step 2 never blocks: "Go to lesson 1" is enabled before and after the demo is used.
32. **J** Every step announces its title (and "Step n of 2") to the screen reader on change; the demo board has the label `onboarding.a11y.demo`.
33. **W** At 360×740 step 2 fits without scrolling and step 1 shows its button pinned (the text may scroll above it) in en, zh-CN and fr; all buttons and Skip ≥ 44 px; the demo board is ≥ 280 px wide and the welcome board 200 px (screenshots 65–69). **W** The demo with mouse: mouse-down on c3 shows the ghost (screenshot 67), mouse-up shows the stone (68).
34. **D** On iPhone: finger down shows the faint stone, sliding to another crossing moves it, lifting places it.

### 4.5 Accessibility pass
35. **J (audit helper)** A shared test helper `expectAccessible(tree)` fails when any element with `onPress` lacks `accessibilityRole` or a non-empty `accessibilityLabel`/text, or has a computed min height or width under 44 (reading `minHeight`/`height`/`width`/`hitSlop`). It runs on: Home, Settings (+ reset sheet), Onboarding (3 steps), 9×9 picker, 9×9 game (playing, mark, result), `ExplainPlayer`, one runner of each type, `ResultView`. Known violations to fix: the picker's `chipTag` 10 px text (AC 40), the picker `Switch` (native switch is ≈ 31 px high; the row becomes the pressable, as in AC 17).
36. **J** Each screen has exactly one element with `accessibilityRole="header"` as its title (Home, Settings, Onboarding steps, picker, result).
37. **J (closes M6 bot-levels AC 40)** In a 9×9 game with the screen reader mocked on: playing Black at `E5` calls `AccessibilityInfo.announceForAccessibility` once with `game9.a11y.played.B` ("Black played E5"); the bot's reply once with `…played.W`; a capture of 2 stones appends `game9.a11y.captured` count 2 in the same call; a pass uses `…passed.*`; a take-back's restored move is not announced; the phase change to marking announces `game9.a11y.over`; the result announces the status text once. Run in en, fr, zh-CN (text differs, call count is the same).
38. **J (fixes "opponent stone announced twice")** Root cause: `GoBoard` announces a new stone itself when a screen reader is on (`board.a11y.played`), and `GameScreen` announces the same move (`game9.a11y.played`). Fix: new `GoBoard` prop `announce?: boolean` (default true); `GameScreen`, `PlayBotRunner` and any screen that announces moves itself pass `announce={false}`. Test: with a screen reader on, one learner move plus the bot's reply produce exactly 2 announcements in the 9×9 game and in a Capture Go bot exercise, and `GoBoard` alone (e.g. dev board) still announces once per stone.
39. **J** Exercise feedback is announced once: `ExerciseFrame` has `accessibilityLiveRegion="polite"` and `ExerciseView` also calls `announceForAccessibility`. Test the answer feedback produces one announcement on iOS (announce) and no second Android live-region duplicate; if both fire, drop the live region on the card or the announce on Android (`Platform.OS` guard), developer's choice, test proves one.
40. **J** No text is rendered below 12 px in Settings, Onboarding, picker, game HUD (the picker `game9.picker.suggested` tag becomes 12 px; if it no longer fits in fr, use the shorter label in §6).
41. **J (contrast, extends `src/theme/contrast.test.ts`)** Target ratios: normal text ≥ 4.5:1, text ≥ 18.66 px bold/24 px and UI parts (switch tracks, selected borders, check marks, icons) ≥ 3:1. Pairs asserted: textPrimary, textSecondary, hint, error, success on background and surface; onAccent on accent; onBadge on badge; accent track vs surface; the stone ring/diamond colours on bamboo. My hand estimates all pass (textSecondary on background about 4.9, hint on surface about 5.1, success about 5.0, error about 5.8, onAccent on accent about 6.5); if any real value falls short the developer proposes the nearest darker token to the PO, no silent colour change.
42. **J** Text scale: all HUD `Text` in the 9×9 game and exercise instruction/feedback cards set `maxFontSizeMultiplier={1.3}` so the board never gets pushed off the screen; `Settings`, `Onboarding`, `Home`, picker and sheets allow up to 2.0 and scroll (their roots are `ScrollView`). Mechanism free (default prop in `_layout` plus HUD override).
43. **D** iPhone Larger Text at the largest accessibility size: Settings, Onboarding step 1–3 and Home are fully readable by scrolling, no overlapping or cut text; 9×9 game at the default plus two steps still shows the whole board and the Pass / Resign buttons.
44. **D** VoiceOver (iPhone) and TalkBack (Android): with Settings → every control is reachable by swiping and read with role and state ("Stone sound, switch, on"); lesson 1 first exercise is completable by double-tapping a labelled point; a 9×9 game hears each move once; the reset sheet keeps focus inside.
45. **W** Keyboard (web): Tab reaches every Settings row, switch toggles with Space/Enter, sheet closes with Escape; focus ring visible. No new console warnings (log saved as `75-no-console-warning.txt`).

### 4.6 Welcome page (step 1 of the intro; PO feedback)
46. **J** Step 1 shows, in this order: the title `onboarding.1.title`, the concept paragraph `onboarding.1.concept` (the app teaches Go from zero, one rule per lesson, short exercises, finishing with 9×9 games against a bot), the "what is Go" paragraph `onboarding.1.body`, the static 5×5 example (label `onboarding.a11y.board1`), then one primary button whose label is `home.start` ("Start learning").
47. **J** The Welcome page is not shown on Home: Home contains no new welcome banner. For a learner with no progress the Home Continue card still reads "Start learning" and opens lesson 1; for a learner with progress, nothing changes.
48. **J** Step 1 contains no second primary button; Skip is the only other control (AC 27).
49. **W** Screenshots 65 (en, fr, zh-CN) show title, both paragraphs, board and button in one 360×740 view, or with the text scrolled and the button still visible; no text under 12 px.

### 4.7 Remove the developer sample (unit 0)
What it is: lesson `u00-sample` (`src/lessons/content/u00-sample.json`, imported in `src/lessons/registry.ts`), shown on Home as unit 0 with the label "Sample (developer)" (`home.sample.label`) and titled by `lesson.u00-sample.title`. It is only listed when `__DEV__` is true (Expo Go, which is how the PO sees it on the iPhone) or the web export is made with `EXPO_PUBLIC_DEV_LESSONS=1`. Release builds already hide it, so a store user never saw it. Unit 1 stays open from the start (it was never gated by the sample).
50. **J** The registry (`LESSON_FILES`, `LESSON_TEXTS`) contains no lesson with `unit: 0`; `listLessons()` and `getUnits()` return the same lessons with `includeDev` true or false; the first Home row is unit 1 "Board & stones", in `__DEV__` too. The Home map shows no row whose caption is `home.sample.label`.
51. **J** Existing progress: a saved `lessons['u00-sample']` (possible only for people who used Expo Go) is dropped when the store hydrates and is not rewritten; every other lesson id, `bots`, `flags` and the storage version (1) are unchanged. A save containing only `u00-sample` counts as "no progress" for `shouldShowOnboarding` and for the module summaries. No other storage key was ever written for the sample.
52. **J** Unused code is removed or reduced to what tests need: the `home.sample.label` key and the `lesson.u00-sample.*` texts leave the three app i18n files (the key-set test still passes); `SAMPLE_UNIT` branches in `map.ts`, `loader.ts` and `unlock.ts` are deleted unless a test still needs a generic fixture; `includeDev`/`isDevBuild` are removed with the sample.
53. **J** Tests that used the sample as a ready-made lesson keep a test-only copy: move the lesson JSON and its texts to `src/lessons/__fixtures__/` (the fixtures file already imports it) and feed it through `createLessonLoader([...])` or a Jest mock of the registry. Affected: `src/lessons/{loader,unlock,map,content,validate}.test.ts`, `src/lessons/__fixtures__/fixtures.ts`, `__tests__/m4-units-1-5.test.ts` (file list and `includeDev` asserts at lines about 57 and 452), `__tests__/app/{index,lesson,practice,lesson-gate,layout-rule}.test.tsx`, `src/store/progress.test.ts` (only uses the id as a string, may stay). No test is deleted without an equivalent that covers the same rule.
54. **W** `scripts/verify-web-m3.mjs` (uses `EXPO_PUBLIC_DEV_LESSONS=1` and `lesson.u00-sample.s1`) is switched to unit 1 or retired; the Settings dev "Board demo" row is unaffected (not part of the learning path).

### 4.8 Modules on Home (collapsible groups)
Membership (pure, `src/lessons/modules.ts`): **Module 1 = units 1–5**, **Module 2 = units 6–9**, **Module 3 = units 10–14**. A map row (unit lesson, later lesson or checkpoint) belongs to the module of its `unit`; the number of rows per module is whatever `mapRows` returns (checkpoints and Unit 11's second lesson included).
55. **J** `moduleOf(unit)` returns 1 for 1–5, 2 for 6–9, 3 for 10–14. A test fails when any unit returned by `getUnits()` is not in exactly one module (a future unit 15 must be added to the table on purpose).
56. **J** Home renders three module headers in order, each followed by its rows only when expanded. Rows keep their current content, order, stars, checkpoint rows and states (done / available / locked / soon); only the grouping is new. Unit and checkpoint labels keep the global numbers (Unit 6 stays "Unit 6" inside module 2).
57. **J (default state)** On open: the module that holds the Continue target (the same row the Continue card opens: the first row that is `available`) is expanded; all others are collapsed. A new learner sees module 1 expanded. When everything is done all three are collapsed. While progress is still loading (not hydrated) module 1 is expanded as a skeleton, then the default is applied once, without moving what the learner toggled.
58. **J** Tapping a header toggles only that module (several can be open). The state lives in the screen, is not saved, and resets on the next app start (AC 57 applies again). A finished lesson returning to Home keeps the toggles the learner set in this session.
59. **J (summary)** Each header shows the unit range (`home.module.units`, e.g. "Units 1–5") and the progress `home.module.progress` = number of rows with state `done` (at least 1 star) of the number of rows in the module, counting lessons and checkpoints but not "soon" rows; plus a thin progress bar (decorative, hidden from screen readers). A module with zero done shows "0 of N done".
60. **J (locked)** A module is locked when its first row is `locked`. Its header shows a lock icon and the text `home.module.locked`; it is collapsed by default but can be opened to preview (its rows show their usual locked state, tapping one shows the existing snackbar `home.locked.hint`). Locked modules never navigate.
61. **J (9×9 card)** The 9×9 game card (`Game9Card`) is not inside a module. It sits directly below module 3, always visible (collapsed or not). **PO 2026-10-23: it is unlocked from the start** (no longer needs ≥1★ on Unit 14), so someone who already knows the rules can play right away; the locked state and its snackbar are removed, and the route `app/game/` no longer guards on Unit 14. The "Continue" card stays above the modules.
62. **J (screen reader)** Each header is one `Pressable` with `accessibilityRole="button"`, `accessibilityState={{expanded}}` (plus `disabled` never set), label built from `home.module.a11y` = "Module {n}, {title}, {units}, {progress}" (and "locked" when locked). The chevron, lock icon and bar are hidden from the tree. Rows inside a collapsed module are not rendered, so they cannot be focused.
63. **J (tap targets)** Header height ≥ 64 px, full width, whole header pressable. Unit rows keep their present height (already ≥ 44).
64. **J** Expanding or collapsing is instant (no height animation), so reduce motion needs no extra branch; only the chevron turns 90° (instantly when `useReduceMotion()` is true, a 120 ms rotate otherwise). After a toggle the screen reader announces nothing extra (the state change of the button is read by the OS).
65. **W** Home at 360×740 in en, fr, zh-CN: collapsed (three headers in one view with the Continue card and, on a finished profile, the 9×9 card), module 1 expanded, module 2 locked, module 3 expanded (the longest list; scrolls inside the page); no horizontal scroll; headers ≥ 64 px high; long fr titles wrap in ≤ 2 lines; keyboard Tab/Enter toggles a header; screenshots 76–81.

## 5. Screen flow & UI (360×740)
Tokens only: `color.*`, `spacing.*`, `radius.*`, `typography.*`, `tapTarget.min`. Calm, lots of space, no leaf or petal art; the intro uses the existing `Landscape` backdrop (`<Screen backdrop="home">`).

### 5.1 Settings
```
┌──────────────────────────────┐ 360
│ ←  Settings                  │ TopBar 56
│                              │
│ Language                     │ caption, header
│ ┌──────────────────────────┐ │
│ │ Use device language    ✓ │ │ rows 52
│ │ 中文（简体）             │ │
│ │ English                  │ │
│ │ Français                 │ │
│ └──────────────────────────┘ │
│ Sound and motion             │
│ ┌──────────────────────────┐ │
│ │ Stone sound        [ ●─] │ │ switch rows, desc under title
│ │ A soft tock when a stone │ │
│ │ lands.                   │ │
│ │ Reduce motion      [─● ] │ │
│ │ Fewer moving and fading… │ │
│ └──────────────────────────┘ │
│ Games                        │
│ ┌──────────────────────────┐ │
│ │ Atari warnings     [ ●─] │ │
│ └──────────────────────────┘ │
│ Help                         │
│ ┌──────────────────────────┐ │
│ │ Show the intro again   > │ │
│ └──────────────────────────┘ │
│ Progress                     │
│ ┌──────────────────────────┐ │
│ │ Erase progress  (rouge)  │ │
│ └──────────────────────────┘ │
│ Version 1.0.0                │
└──────────────────────────────┘  scrolls (about 1.3 screens)
```
States: switch on = `color.accent` track; off = `color.border`. Reduce motion when the phone setting is on: switch on and dimmed (disabled) plus the line `settings.motion.osOn` in `textSecondary`. Erase row: label in `color.error`, chevron none. After erase: `settings.reset.done` appears as a calm line under the Progress row for 4 s (live region). No loading state (the settings load before the first frame, §3).

Reset sheet (reuse the game9 `Sheet`; move it to `src/theme/Sheet.tsx` if the import direction `app → game9` is unwanted):
```
┌──────────────────────────────┐
│ dim                          │
│ ┌──────────────────────────┐ │
│ │ Erase all progress?      │ │
│ │ Your stars, game record  │ │
│ │ and handicap suggestions │ │
│ │ will be deleted from     │ │
│ │ this phone. This cannot  │ │
│ │ be undone. Your settings │ │
│ │ stay.                    │ │
│ │ [  Keep my progress   ]  │ │ primary (accent)
│ │ [  Erase              ]  │ │ outline, error colour
│ └──────────────────────────┘ │
└──────────────────────────────┘
```

### 5.2 Onboarding (route `app/onboarding.tsx`, 2 steps, one screen component with a step state)
Revised after PO feedback (§14): step 1 is now the **Welcome page** (concept + what Go is + CTA), step 2 the touch demo. The old step 3 "Where to start" is gone; its job is done by the welcome text and by step 2's button. The Home screen is not duplicated: Home stays the learning-path map (its Continue card already reads "Start learning" for a new learner).
Common frame: Skip top right (44×44 min, text button), content, step dots (2 small circles, current filled `accent`; also text "1 / 2" for a11y), one primary button pinned at the bottom (`Button`, full width, 52 px).

Step 1 Welcome (static 5×5 board, 200 px, no touch; content may scroll on a small phone, the button stays pinned):
```
┌──────────────────────────────┐
│                      Skip    │ 56
│  Learn Go (围棋 wéiqí)        │ title (display)
│  from zero                   │
│  Step by step: each lesson   │ concept, 3 lines
│  teaches one rule, then a    │
│  few short exercises. At     │
│  the end you play 9×9 games  │
│  against a friendly bot.     │
│  Go is a game for two: Black │ what is Go, 3 lines
│  and White take turns placing│
│  stones on the crossings;    │
│  surround more space to win. │
│     a b c d e                │
│  5  + + + + +                │ 5×5 board 200 px
│  4  + + O + +                │
│  3  + X X O +                │
│  2  + + + + +                │
│  1  + + + + +                │
│            ● ○               │ dots
│  [     Start learning     ]  │ 52, pinned
└──────────────────────────────┘
```
Step 2 "Try placing a stone" (live 5×5 board, 300 px). Instruction at top, board, feedback line below (same top/board/bottom layout rule as lessons). States: empty (instruction + hint "Not the right spot? Slide to another crossing before you lift."), finger down (ghost), placed (`onboarding.2.done` in `color.success`, calm check icon, no confetti), illegal on occupied point (engine message). Primary button "Go to lesson 1" (replay mode: "Done"). Always enabled.

### 5.3 Demo diagram (tap to place), all legal
```
 finger down on c3        finger lifted
   a b c d e                a b c d e
 5 + + + + +              5 + + + + +
 4 + + + + +              4 + + + + +
 3 + + ○ + +   ○ = faint  3 + + ● + +   ● = Black stone
 2 + + + + +     preview  2 + + + + +
 1 + + + + +              1 + + + + +
```
Step 1's static position (checked by hand): Black b3, c3 (group liberties a3, b4, b2, c2 = 4; d3 and c4 are White); White c4 (liberties b4, d4, c5 = 3), White d3 (liberties d4, e3, d2 = 3). Two stones each, so Black is to move; no stone is in atari, nothing is capturable, the position is reachable by legal play.

### 5.4 Entry points
First launch: root layout redirects to `/onboarding` when `shouldShowOnboarding`. Replay: Settings → Help → "Show the intro again" pushes `/onboarding?replay=1`; Done returns to Settings; Skip too; neither changes any progress.

### 5.5 Home with modules (replaces the flat "Learning path" list; header, logo, title, subtitle and Continue card are unchanged)
Header row 64 px, whole row pressable. Chevron ▾ expanded, ▸ collapsed (drawn with the existing `ChevronIcon`). Colours: surface card, `border` outline, progress bar track `border` and fill `accent`; locked header text `textSecondary` with a lock icon. No decoration beyond the existing Landscape backdrop.

New learner (nothing done): module 1 open, others collapsed and locked.
```
┌──────────────────────────────┐
│                          ⚙   │
│            ●○                │
│           Let's GO           │
│  Learn Go (围棋 wéiqí) from  │
│  zero, one rule at a time    │
│ ┌──────────────────────────┐ │
│ │ Start learning        >  │ │ Continue card
│ └──────────────────────────┘ │
│ Learning path                │
│ ┌──────────────────────────┐ │
│ │ ▾ Module 1               │ │ header 64
│ │   The basics             │ │
│ │   Units 1–5 · 0 of 6 done│ │
│ │   ▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭   │ │ bar 4 px
│ ├──────────────────────────┤ │
│ │  Unit 1 Board & stones   │ │ rows as today
│ │  Unit 2 Liberties  🔒    │ │
│ │  …                       │ │
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │ ▸ Module 2   🔒 Locked   │ │
│ │   Playing an opponent    │ │
│ │   Units 6–9 · 0 of 8 done│ │
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │ ▸ Module 3   🔒 Locked   │ │
│ │   How to win a game      │ │
│ │   Units 10–14 · 0 of … │ │
│ └──────────────────────────┘ │
│  (9×9 game card, locked)     │ below module 3
│  More units coming soon      │
└──────────────────────────────┘
```
The "0 of 6" and "0 of 8" numbers in the diagram are examples; real totals come from `mapRows`.
Learner mid-way (finished module 1, in module 2): module 1 collapsed with "6 of 6 done" and a check mark; module 2 open; module 3 collapsed and locked.
States: loading (module 1 header and skeleton rows, as the current skeleton); empty (not possible, the modules always have content); success (all done: all collapsed, `home.allDone` caption stays); locked (above); soon rows are not expected after unit 14 (`PLANNED_UNITS` is empty).

## 6. Copy keys (zh-CN / en / fr)
Copy rule (PO 2026-10-23): en/fr show Chinese + pinyin only for Weiqi terms taught in lessons (here only Go 围棋 wéiqí, already used in `home.subtitle`); everyday labels plain; zh-CN buttons have no pinyin; chip labels short. Existing keys reused: `settings.title`, `settings.language*`, `settings.version`, `dev.board.sound` (not reused, new key below), `game9.picker.atariHints`, `game9.picker.atariHintsDesc`.
| key | zh-CN | en | fr |
|---|---|---|---|
| `settings.section.sound` | 声音与动画 | Sound and motion | Son et animations |
| `settings.sound` | 落子声音 | Stone sound | Son des pierres |
| `settings.sound.desc` | 落子时发出轻轻的一声。 | A soft tock when a stone lands. | Un petit « toc » quand une pierre se pose. |
| `settings.motion` | 减少动画 | Reduce motion | Réduire les animations |
| `settings.motion.desc` | 减少移动和渐变效果。 | Fewer moving and fading effects. | Moins de mouvements et de fondus. |
| `settings.motion.osOn` | 手机的“减弱动态效果”已开启，这里同步生效。 | Your phone's reduce-motion setting is on, so this is on too. | Le réglage « réduire les animations » de votre téléphone est activé, celui-ci l'est donc aussi. |
| `settings.section.games` | 对局 | Games | Parties |
| `settings.section.help` | 帮助 | Help | Aide |
| `settings.intro` | 再看一遍入门介绍 | Show the intro again | Revoir l'introduction |
| `settings.section.progress` | 学习记录 | Progress | Progression |
| `settings.reset` | 清除学习记录 | Erase progress | Effacer la progression |
| `settings.reset.title` | 清除所有学习记录？ | Erase all progress? | Effacer toute la progression ? |
| `settings.reset.body` | 星星、对局记录和让子建议都会从这台手机上删除，无法恢复。语言等设置不变。 | Your stars, game record and handicap suggestions will be deleted from this phone. This cannot be undone. Your settings stay. | Vos étoiles, votre historique de parties et vos suggestions de handicap seront supprimés de ce téléphone. C'est irréversible. Vos réglages restent. |
| `settings.reset.keep` | 保留 | Keep my progress | Garder ma progression |
| `settings.reset.confirm` | 清除 | Erase | Effacer |
| `settings.reset.done` | 学习记录已清除。 | Progress erased. | Progression effacée. |
| `onboarding.skip` | 跳过 | Skip | Passer |
| `onboarding.start` | 去第一课 | Go to lesson 1 | Aller à la leçon 1 |
| `onboarding.done` | 完成 | Done | Terminé |
| `onboarding.step` | 第 {{n}} 步，共 {{total}} 步 | Step {{n}} of {{total}} | Étape {{n}} sur {{total}} |
| `onboarding.1.title` | 从零开始学围棋 | Learn Go (围棋 wéiqí) from zero | Apprenez le Go (围棋 wéiqí) à partir de zéro |
| `onboarding.1.concept` | 一步一步来：每一课只学一个规则，再做几道小练习，拿星星。学完之后，在 9×9 的小棋盘上和友好的电脑对弈。 | Step by step: each lesson teaches one rule, then a few short exercises and stars. At the end you play games on a small 9×9 board against a friendly bot. | Pas à pas : chaque leçon enseigne une règle, puis quelques exercices courts et des étoiles. À la fin, vous jouez sur un petit plateau 9×9 contre un robot sympathique. |
| (button, step 1) | reuse `home.start` | reuse `home.start` ("Start learning") | reuse `home.start` |
| `onboarding.1.body` | 围棋是两个人下的游戏：黑和白轮流把棋子放在线的交叉点上。围住比对手更多的地方，就能获胜。 | Go is a game for two players: Black and White take turns placing stones on the crossings of the lines. Surround more space than your opponent to win. | Le Go se joue à deux : Noir et Blanc posent à tour de rôle une pierre sur les croisements des lignes. Entourez plus d'espace que votre adversaire pour gagner. |
| `onboarding.2.title` | 试着放一颗棋子 | Try placing a stone | Essayez de poser une pierre |
| `onboarding.2.body` | 手指按在一个交叉点上，会先出现浅色的预览；手指抬起，棋子才落下。 | Touch a crossing to see a faint preview. The stone lands when you lift your finger. | Touchez un croisement pour voir un aperçu pâle. La pierre se pose quand vous levez le doigt. |
| `onboarding.2.hint` | 位置不对？抬起之前滑到别的交叉点就行。 | Not the right spot? Slide to another crossing before you lift. | Pas le bon endroit ? Glissez vers un autre croisement avant de lever le doigt. |
| `onboarding.2.done` | 很好！下一手棋就这么简单。 | Nicely done. That is all it takes to play a move. | Bien joué. C'est tout ce qu'il faut pour jouer un coup. |
| `onboarding.a11y.demo` | 练习棋盘，5 乘 5。双击一个交叉点来放黑子。 | Practice board, 5 by 5. Double-tap a crossing to place a stone. | Plateau d'essai, 5 par 5. Touchez deux fois un croisement pour poser une pierre. |
| `onboarding.a11y.board1` | 示例棋盘：黑 b3、c3；白 c4、d3。 | Example board: Black b3, c3; White c4, d3. | Plateau d'exemple : Noir b3, c3 ; Blanc c4, d3. |
Home modules (new; module names are everyday labels, so en/fr carry no Chinese and zh-CN no pinyin; the unit titles inside keep their existing pinyin):
| key | zh-CN | en | fr |
|---|---|---|---|
| `home.module.1.title` | 基础入门 | The basics | Les bases |
| `home.module.2.title` | 和对手下棋 | Playing an opponent | Jouer face à un adversaire |
| `home.module.3.title` | 怎样赢棋 | How to win a game | Comment gagner une partie |
| `home.module.label` | 模块 {{n}} | Module {{n}} | Module {{n}} |
| `home.module.units` | 第 {{from}}–{{to}} 单元 | Units {{from}}–{{to}} | Unités {{from}}–{{to}} |
| `home.module.progress` | 已完成 {{done}}/{{total}} | {{done}} of {{total}} done | {{done}} sur {{total}} faits |
| `home.module.locked` | 未解锁 | Locked | Verrouillé |
| `home.module.a11y` | {{label}}，{{title}}，{{units}}，{{progress}} | {{label}}, {{title}}, {{units}}, {{progress}} | {{label}}, {{title}}, {{units}}, {{progress}} |
| `home.module.a11y.locked` | 未解锁，先完成上一个模块 | locked, finish the previous module first | verrouillé, terminez d'abord le module précédent |
Removed keys: `home.sample.label`, all `lesson.u00-sample.*`, `onboarding.next`, `onboarding.3.*`. Reused: `home.start`, `home.locked.hint`.
Chip label (picker): `game9.picker.suggested` fr "conseillé" at 12 px; if it overflows a chip at 360 px, drop the visible tag and keep the selected style plus the a11y label "suggested" (AC 40 still holds; the PO sees screenshot 71 first). Every key exists in all three files; the existing key-set comparison test covers this.

## 7. Game design notes
- Intro length: 2 steps, about 30 s, one obvious action per screen. The only interactive moment is step 2, deliberately the same gesture as lesson 1 so the first exercise is not a surprise. Success is guaranteed (empty board, any point is legal); no stars, no sound requirement, no failure state. Reward: the quiet green check line; the stone sound if sound is on.
- Hint policy and failures: none; an illegal tap on an occupied point shows the standard engine message and the learner can retry unlimited times. No "3 failures" path.
- Settings are not gamified. Erase uses a safe default (Keep is first and primary).
- Accessibility must not change difficulty or rewards: reduce motion shortens the bot delay (already 300 ms) and removes movement only.

## 8. Planned screenshots (`docs/screenshots/M6/`, 360×740, en + fr + zh-CN unless noted)
60-settings-top · 61-settings-bottom (scrolled) · 62-settings-reset-sheet · 63-settings-after-reset · 64-settings-reduce-motion-on (en only; OS-on variant is Jest) · 65-onboarding-1-welcome · 66-onboarding-2-empty · 67-onboarding-2-ghost (mouse down) · 68-onboarding-2-placed · 69-lesson-1-after-intro (en) · 70-home-after-skip · 71-picker-suggested-tag-12px · 72-tap-target-report.txt (list of all pressables with box sizes, none < 44) · 73-contrast-report.txt (ratio table) · 74-language-persisted-after-reload-fr · 75-no-console-warning.txt · 76-home-modules-new-learner (module 1 open, 2 and 3 locked) · 77-home-modules-all-collapsed (a finished profile, with the 9×9 card below) · 78-home-module-2-open-midway · 79-home-module-locked-peek (locked module opened, snackbar after tapping a row; en only) · 80-home-module-3-open · 81-home-module-header-focus (keyboard focus ring; en only) · 82-home-rows.txt (list of Home rows in order, no "Sample (developer)").
Add to `npm run verify:web:m6*` as a new `e2e/verify-web-m6-settings.mjs`.

## 9. Correctness check (designer, by hand)
- Step 1 diagram: see §5.3; liberties counted there; Black to move (2 stones each, Black first); nothing in atari, so it implies no capture rule yet. Orthogonal neighbours only.
- Demo board is empty at start; the first stone is always legal; later illegal cases (occupied point, suicide, ko) come from the engine, not hand-written text. A single stone on 5×5 can never be a ko or suicide. Alternating colours on the demo can create a capture; the board and message handle it with existing code, no new copy.
- Handicap is not touched by this item; reset clears `bots[L].handicap` so suggestions return to the starting table (Easy 2 / Normal 5 / Challenge 5).

## 10. Dev notes (non-binding)
Files likely touched: `src/i18n/index.ts` (persist, hydrate), new `src/store/settings.ts` (+ test), `src/store/progress.ts` (`onboardingSeen` flag, `reset({keepFlags})`), `src/board/sound.ts` (`setSoundEnabled`), `src/board/useReduceMotion.ts`, `src/board/GoBoard.tsx` (`announce` prop), `src/game9/ui/GameScreen.tsx`, `src/game9/ui/LevelPicker.tsx` (chip tag size, switch row), `src/exercises/runners/PlayBotRunner.tsx`, `app/_layout.tsx` (hydration gate, redirect), `app/settings.tsx`, new `app/onboarding.tsx`, `src/theme/contrast.test.ts`, i18n files. M0 persistence test replaced (AC 7). The two i18n modules stay React-free outside the hook.

Added for PO feedback: new `src/lessons/modules.ts` (+ test), `src/exercises/UnitMap.tsx` / `app/index.tsx` (module headers, default expansion), `src/lessons/{registry,loader,map,unlock}.ts` (sample removal), `src/store/progress.ts` (drop `u00-sample` on hydrate), `__fixtures__` and the tests listed in AC 53, `scripts/verify-web-m3.mjs`.

## 11. Out of scope
MMKV swap (next item, EAS Build); an in-app font-size slider; dark mode; haptics; sound for 9×9 moves or new sound assets; per-lesson sound; saving a game in progress; cloud sync / account; a general "default handicap" setting; changing colour tokens (only reported); translating the app into more languages; the nets/tsumego items; the pending iPhone checks of earlier milestones (the new device checklist covers only this item); saving which modules are open; a separate welcome banner on Home; new lessons or reordering of units; removing the Settings dev "Board demo" row (dev-only, not on the learning path); a module-level star or badge reward.

## 14. Change log
2026-10-23 (PO feedback, same PR): intro reduced from 3 to 2 steps with a Welcome page as step 1 (AC 26, 28, 31–33 changed; AC 46–49, decisions 1, 2, 4 changed, 13–14 new); developer sample removed (AC 50–54, decision 15); Home grouped in three collapsible modules (AC 55–65, decisions 16–18); screenshots 65 renamed, 76–82 added; keys `onboarding.next`, `onboarding.3.*` removed.

## 12c. PO changes after review (2026-10-24) — supersede §4.4/§4.6/§5.2/§5.4 where they differ
1. **Home = landing page** (route `/`): logo, app name, a short plain intro (1–2 sentences: learn Go from zero, step by step), one primary CTA "Start learning" (`home.start`), Settings entry. Shown on every launch. No unit list here.
2. **Learning page** (new route, e.g. `/learn`): the 3 collapsible modules, the Continue card and the 9×9 card (everything §5.5 put on Home). Lessons, results and the 9×9 game return here, not to the landing page.
3. **CTA flow:** first time (`onboardingSeen` false and no progress) "Start learning" → intro page 1 (the Welcome content, button **Next**) → intro page 2 (touch demo, button **Done**) → learning page. Skip on either page also → learning page. After that, "Start learning" goes straight to the learning page. The intro never opens lesson 1 directly.
4. The app no longer redirects to the intro on launch; the landing page always shows first. Replay from Settings ends on the learning page too.
5. Defaults (main session): Back/hardware back on the learning page → landing page; the intro texts stay as written, only the step-1 button becomes "Next" and step 2's "Go to lesson 1" becomes "Done" (zh-CN 下一步 / 完成, fr Suivant / Terminé).

### Landing design (approved layout, pending PO look at the final mockup)
**PO decision 2026-10-24: variant A layout plus a board; variant B rejected; fr button stays "Commencer".** Final positions on 360x740 (phone y, from the top edge; the 56 px top bar holds the 44x44 gear): logo box y 148-192 (drawn 1.35x, unchanged from A), app name y 200-234, intro (one line of copy, `home.intro`, text block 312 px wide) from y 246: en and fr wrap to 2 lines (ends y 294), at most 3 lines (ends y 318); **board** 180x180, centred, **y 324-504** (5x5 bamboo, black c3 and d4, white d3 and c2, decorative: not touchable, hidden from screen readers), **CTA** full width (24 px side margins), 52 high, **y 528-580** (thumb reach). **Ridges below about y 600 stay uncovered** (the far ridge peaks at about y 605). Second PO change 2026-10-24: single intro line, CTA raised; the PO's rough numbers (board y300-480, CTA y510-562) were moved down 24 px so a 3-line fr intro never touches the board. With large text (up to 200 %) the content scrolls; order stays logo, name, intro, board, CTA. Text below is the earlier A/B analysis, superseded by this paragraph where it differs. Mockup: `docs/specs/M6-home-landing-mockup.html` (en / fr / zh-CN side by side, 360x740, real tokens, system font).
- **Common layout (top to bottom):** mist gradient and rice-paper background; top bar with the 44x44 gear (`settings.open`) at the right; two-stone logo (existing mark); app name `app.name` (display 28/34); intro (`home.intro`, body 16/24, `textSecondary`), then the board, then one full-width primary button (52 px high, `accent`). No other buttons, no unit list, no progress. Nothing under 16 px except none; the only text is name, intro, CTA.
- **Final = variant A** (the existing `Landscape variant="home"`: mist plus two ridges, 150 px, at the bottom; logo enlarged about 1.35x) **plus the board** from B (4 legal stones: black c3 and d4, white d3 and c2). Variant B was rejected.
- **States:** one state only (no loading: no stored data is needed to draw it; `onboardingSeen` is read only on CTA press). Press = opacity 0.7. Text scaling up to 200 % (`textScale.page`): the content scrolls; the CTA stays after the intro.
- **A11y:** logo and landscape hidden from screen readers; app name is the one header; CTA label `home.start`; gear label `settings.open`.
- **Copy keys** (new: `home.intro` only, PO-approved text; reused: `app.name`, `home.start`, `settings.open`; `home.subtitle` is no longer shown on the landing page and may be reused on the learning page or removed):

| key | zh-CN | en | fr |
|---|---|---|---|
| `home.intro` | 从零开始，一步一步学会下围棋。 | Learn GO (围棋 wéiqí) from zero with short lessons. | Apprenez le GO (围棋 wéiqí) pas à pas, avec des leçons courtes. |
| `home.start` (exists) | 开始学习 | Start learning | Commencer |
| `settings.open` (exists) | 打开设置 | Open settings | Ouvrir les réglages |

Copy rule check: "Go (围棋 wéiqí)" appears once, in the intro; the buttons carry no Chinese/pinyin in en/fr and no pinyin in zh-CN. The fr CTA stays "Commencer" (PO). "GO" is written in capitals as the PO wrote it.

### App icon (A approved by PO, 2026-10-24; build the exports below from variant A)
Mockup: `docs/specs/M6-app-icon-mockup.html`; sources: `assets/icon-source/icon.svg` (1024, opaque, full-bleed, square corners) and `assets/icon-source/adaptive-foreground.svg` (transparent, inside the inner 66 % circle). Current state: `app.json` has `icon`, `android.adaptiveIcon` (foreground, background, monochrome PNGs, backgroundColor `#F4F1EA`) and `web.favicon`; there is no `splash` entry; the PNGs in `assets/` are the Expo template files.
- **A (recommended):** mist-to-paper gradient, two ridges, the two-stone logo large in the middle; calm and the same look as Home.
- **B:** bamboo board with two stones on grid crossings; most "Go", but busy at 29 px.
- **C:** solid green-mountain (`accent`) with the two stones; strongest on light wallpapers, least mood.
- No text on the icon (the phone shows "Let's GO" below). Stones stay in the central 640 px; no leaves or petals; colours only from tokens.
- **PNG exports after approval (developer):** `assets/icon.png` 1024x1024 no alpha; `assets/android-icon-foreground.png` 1024x1024 transparent (from adaptive-foreground.svg); `assets/android-icon-background.png` 1024x1024 solid `#DCE6EA` (set `adaptiveIcon.backgroundColor` to `#DCE6EA` too); `assets/android-icon-monochrome.png` 1024x1024 the two circles in one colour on transparent; `assets/favicon.png` 48x48 (from icon.svg, or stones only with no ridge if unreadable); splash: optional, not needed (no splash configured); if added, use the stones on `#F4F1EA` (`splash-icon.png` 1024 transparent, stones only).
- **Done (developer, 2026-10-24):** all five PNGs are exported from the SVG sources with Chrome (scratchpad playwright-core, no project dependency). `icon.png`, `android-icon-background.png` and `favicon.png` have no alpha; `adaptiveIcon.backgroundColor` is `#DCE6EA`; no splash was added. The monochrome layer has its own source, `assets/icon-source/monochrome.svg` (see §12b item 25).

## 12a. PO decisions (2026-10-23)
Approved: all recommended defaults 1–18 (13: Welcome page is step 1 of the intro, not a permanent Home banner). Change: the 9×9 card is unlocked by default (AC 61).

## 12b. Dev deviations (developer, 2026-10-24)
No new dependency. Changes against the text above, all small:
1. **AC 29 slide-off:** checked in `GoBoard` (`pointFromLocation` returns null off the board; release then places nothing). The sentence stays and is tested.
2. **Redirect place (AC 25):** the fresh-install redirect is a `<Redirect href="/onboarding">` in Home (`app/index.tsx`), not in the root layout; deep links (e.g. `/settings`) are never hijacked. The root layout only covers the first frame: the Stack is mounted under a background-coloured cover (hidden from touch and screen readers) until both stores are read (cap 1 s), because expo-router needs the navigator mounted.
3. **System Back (AC 26):** Android hardware back (`BackHandler`). On a fresh launch the intro is the only screen, so there is no iOS swipe-back to intercept.
4. **Sound gate:** `setSoundEnabled` lives in `src/board/soundSetting.ts` (re-exported from `sound.ts`), so the start-up wiring still works in tests that mock `@/board/sound`.
5. **One header per screen (AC 36):** the Settings section captions, Home's "Learning path" and the picker's handicap prompt are plain text now (they were headers).
6. **Switch off-track (AC 41):** off = `color.border` fill plus a `textSecondary` outline and thumb border; `border` on `surface` alone is 1.33:1, under the 3:1 for UI parts. No token changed. All asserted text pairs pass (lowest: success on background 4.56:1).
7. **Announcements (AC 37, 38):** `GameScreen`, `PlayBotRunner` and `SequenceRunner` pass `announce={false}` and say every stone themselves. PlayBotRunner now also says the learner's stone (`board.a11y.played.*`, the text the board used to say); SequenceRunner says the learner's stone and the reveal stones (`sequence.a11y.plays.*`). The bot pass that ends a 9×9 game is not said separately: the phase change says `game9.a11y.over`.
8. **Feedback once (AC 39):** the card drops its live region where the screen announces (`FeedbackCard liveRegion={false}` in `ExerciseFrame` and `SequenceRunner`), on both platforms, instead of a `Platform.OS` guard. The 9×9 status line has no live region in the count and result phases (the screen announces them).
9. **Text caps (AC 42):** new token `textScale` (`page: 2`, `hud: 1.3`) set per `Text`/`Button` (React 19 has no `defaultProps` for function components). Sheet lines scroll (`maxHeight 90 %`).
10. **Intro step 2 fit (AC 33):** step 2 title uses `typography.title` (22 px) instead of display, with 8 px gaps and a 24 px feedback slot, so the fr copy plus the 300 px board fit 740 px. Step 1 keeps the display title.
11. **Sample removal (AC 50, 52–54):** `includeDev`, `ListOptions`, `isDevBuild` and `SAMPLE_UNIT` are gone, so AC 50 is tested as "the one `listLessons()`/`getUnits()` has no unit 0". The sample JSON and texts live in `src/lessons/__fixtures__/` (`registryWithSample()` mock). `scripts/verify-web-m3.mjs` (sample-only) is retired with its npm script.
12. **9×9 card (AC 61):** `Game9Card` has no `onLocked`; key `game9.entry.locked` removed. `UNLOCK_LESSON` stays for the Unit 14 result button ("Play 9×9").
13. **Tests:** app tests start as a returning learner (`setFlag('onboardingSeen')` after `reset()`); the M0 "not persisted" test is replaced by a reload test (AC 7); the picker atari test presses the row instead of the native switch; `__tests__/qa/i18n-content.test.ts` counts `titleKey: '…'` as a use and leaves the §6 keys to `__tests__/m6-settings-copy.test.ts`.
14. **Not done here (W/D, for QA/PO):** `e2e/verify-web-m6-settings.mjs` and screenshots 60–82, the device checklist, keyboard/Escape checks (AC 45). Older web scripts (`verify-web-m4…m6c`) start from empty storage, so they now meet the intro first and may need `onboardingSeen` seeded.
15. **QA fixes (AC 38, 40, 45):** the review board passes `announce={false}`; en `game9.picker.suggested` is "advised" (the 12 px "suggested" was cut to "suggest…"; fr "conseillé" and zh-CN "推荐" fit); `SwitchRow` passes `aria-checked` and toggles on Space on web, module headers pass `aria-expanded` (react-native-web 0.21 renders neither from `accessibilityState`); the chevron uses the native driver off web only.
16. **§12c routes:** `/` = landing page, `/learn` = learning page (`app/learn.tsx`, the former Home). The launch redirect is gone, so item 2 above no longer applies. "Start learning" checks `shouldShowOnboarding` when it is pressed: `/onboarding` the first time, `/learn` otherwise. AC 25 now reads that way.
17. **Landing placeholder (coordinator):** `src/home/Landing.tsx` has the logo, the app name (the one header), one intro line reusing `home.subtitle` (no new copy key), the CTA (`home.start`, 52 px) and the gear. Visuals are left for the PO-approved design.
18. **Keys:** `onboarding.next` added (下一步 / Next / Suivant). `onboarding.start` was removed because the orphan-key test fails on unused keys. Step 2 uses `onboarding.done` in both modes.
19. **Learning page:** the top bar has Back (pops to `/`, or replaces with `/` when there is no history) and the gear. "Learning path" is now the page's one header. The logo, app name and subtitle appear only on the landing page.
20. **Returns:** `useGoToLearning` (`src/exercises/navigation.ts`) pops to `/learn` when it is in the history and otherwise replaces the screen with it. It is used for lesson ✕, results, the error "Back to map", the 9×9 leave and the picker's Back (new `LevelPicker`/`TopBar` `onBack` prop). Not-found "home" and Settings Back without history go to the landing page.
21. **Replay:** Skip now also ends on the learning page (§5.4 said Settings), following §12c.4. Done and Skip replace the intro with `/learn`. The on-screen Back then goes to the landing page; Android hardware back returns to Settings. Android system Back on step 1 is still Skip, so it also goes to `/learn`.
22. **Web scripts:** the map checks open `/learn` directly. `e2e/verify-web-m6-settings.mjs` goes landing → CTA → intro. Screenshots: new `64-landing-*`; 69 and 70 are renamed `69-learn-after-intro-en` and `70-learn-after-skip-*`. QA has not regenerated the screenshots.
23. **Landing design (§12c, PO 2026-10-24):** `src/home/Landing.tsx` follows the final positions. The intro sits in a fixed 3-line slot (72 px), so the board stays at y 324–504 and the CTA at y 528–580 in every language. Measured on web at 360×740 (en, fr, zh-CN): intro 246–318, board 324–504, CTA 528–580, no page scroll. The board is a static `GoBoard` without coordinates in a wrapper that is `pointerEvents="none"` and hidden from screen readers.
24. **Copy:** `home.intro` (one line; "GO" in capitals as the PO wrote it) replaces `home.subtitle`. The subtitle key is removed, because nothing else uses it and the orphan-key test fails on unused keys. `home.intro2` was never added.
25. **Monochrome icon:** filling both circles in one colour would merge them into one blob, so the black stone is cut back by a 16 px transparent gap around the white one (`assets/icon-source/monochrome.svg`).

## 12. Open decisions for the PO (plain language, recommended default first)
1. **(changed) How long is the intro?** Recommended: two short screens: a Welcome page (what the app is, what Go is, "Start learning") and "Try placing a stone", about 30 seconds. The old third screen "Where to start" is folded into the Welcome text. Alternative: only the Welcome page, whose button opens lesson 1 directly (shortest; lesson 1 itself then teaches the touch gesture).
2. **(changed) Where does the intro end?** Recommended: the practice screen's button "Go to lesson 1" opens lesson 1 "The board" (one obvious next step); Skip anywhere goes to the home map. Alternative: always end on the home map, where the same lesson waits under "Continue".
3. **Practice stone.** Recommended: a real 5×5 board on screen 2 where you press, see a faint stone, and lift to place it:
```
 finger down on c3        finger lifted
   a b c d e                a b c d e
 5 + + + + +              5 + + + + +
 4 + + + + +              4 + + + + +
 3 + + ○ + +              3 + + ● + +
 2 + + + + +              2 + + + + +
 1 + + + + +              1 + + + + +
 ○ = faint preview        ● = stone placed
```
   Alternative: just a drawing with words, no touching. Touching teaches the gesture best and cannot fail.
4. **(unchanged) People who already have progress.** Recommended: they never see the intro automatically (they can replay it from Settings). Alternative: show it once to everyone after the update. The Welcome page is part of the intro, so it follows the same rule.
5. **Reduce motion.** Recommended: a switch in Settings that adds to the phone's own "reduce motion" setting (if the phone says reduce, the switch is on and locked). Alternative: no switch, only follow the phone.
6. **Atari warnings and handicap.** Recommended: the red-ring warnings get a switch in Settings (same switch as on the game picker); handicap stays only on the game picker because the app adjusts it by itself after each game. Alternative: put both in Settings.
7. **Sound.** Recommended: one on/off switch, on by default; it follows the iPhone silent switch as today. Today the stone sound is only heard in a few places (for example the result screen); making it play in 9×9 games is a separate decision, not part of this item.
8. **Erase progress.** Recommended: one confirmation sheet; "Keep my progress" is the first, highlighted button, "Erase" is red outline. Erase clears stars, game record, handicap suggestions and one-time tips, but keeps your language/sound/motion choices and does not show the intro again. Alternative: also require typing a word, or erase everything including settings.
9. **First frame.** Recommended: show only the paper-coloured background for a blink (under about 0.3 s) until the saved language is read, so you never see English flash before French. Alternative: show Home at once and switch language a moment later.
10. **Big text.** Recommended: Settings, intro, Home and the picker follow your phone's text size up to 200% and scroll; game and lesson screens grow only up to 130% so the board and buttons stay on screen. Alternative: follow the phone fully everywhere (the board may then need scrolling).
11. **Smallest text.** Recommended: nothing smaller than 12 px; the tiny "suggested" label on the handicap chips grows from 10 to 12 px, and in French may be replaced by a short mark if it does not fit. Alternative: leave it at 10 px.
12. **Contrast.** Recommended: keep the present colours if the measured ratios pass (text 4.5:1, icons and borders 3:1; my estimate says they do); if one fails, I come back with the nearest darker shade for your approval instead of changing it silently.

New decisions after your feedback (13–18)
13. **Welcome page and the intro.** Recommended: the Welcome page IS screen 1 of the intro (so it appears once, on the first launch, and can be replayed from Settings). The home screen stays the learning map, so nothing is said twice. Alternative: also keep a permanent welcome banner at the top of Home (repeats the same text every time; I advise against it).
14. **Welcome button.** Recommended: "Start learning" leads to the practice-stone screen, whose button then opens lesson 1. Alternative: "Start learning" opens lesson 1 at once and the practice-stone screen is dropped (see decision 1).
15. **The developer sample.** It is the "Sample (developer)" lesson shown as unit 0 at the very top of the learning path. Only the developer build (Expo Go on your iPhone) showed it; store builds never did. Recommended: delete it completely from the app. If you ever opened it, its saved stars are quietly ignored and cleaned. The tests that borrowed it keep a private copy. Alternative: hide it but keep it in the files (leaves clutter, not recommended).
16. **Module names.** Recommended: "The basics" (units 1–5), "Playing an opponent" (units 6–9), "How to win a game" (units 10–14); in French "Les bases", "Jouer face à un adversaire", "Comment gagner une partie"; in Chinese 基础入门 / 和对手下棋 / 怎样赢棋. Plain everyday words, no pinyin (the unit names inside keep theirs). Other options: "First steps / Fighting / Counting" or "Learn the rules / Play a game / Finish a game".
17. **Which modules start open.** Recommended: only the module you are working in is open; the others are closed. A brand-new learner sees module 1 open. Each header says how far you are ("3 of 6 done") with a thin bar. Locked modules show a lock and can still be opened to peek, but their lessons stay locked. Your open/closed choices are not remembered after you close the app. Alternative: remember them; or open everything.
18. **Where the 9×9 game card sits.** Recommended: just below the third module, outside the groups, always visible (it is a game, not a lesson). Alternative: as the last row inside module 3 (hidden when that module is closed).
