# M5 item 3 — Eyes, life & death, and the `sequence` runner (Units 10–11, zh-CN + en + fr)

Covers the third M5 roadmap item. Builds on `M5-sgf-import.md` (the `sequence` exercise type, the importer, validator codes
`SEQ_*`) and `M5-ko-forbidden-ladders.md` (format, key naming, text limits, star rules). Mockup for approval:
`docs/specs/M5-life-death-mockup.html` (4 runner states at 360×740).
Status: **draft for product-owner approval** (no code written).

## 0. In plain words (for the product owner)
- **New screen behaviour: the multi-move problem.** You play a stone, the opponent answers by itself after a short pause, you
  play again, until the problem is solved ("Move 2 of 3" shows where you are). A wrong move shows the opponent's best answer,
  says why, and lets you try again. It is the same exercise screen as before, with one extra line (the move counter).
- **Four new lessons**, all on the same tiny 5×5 corner pictures:
  Unit 10 **眼 Eyes** (what an eye is; real eye 真眼 vs false eye 假眼), Unit 11 **两眼活 Two eyes live** (one eye dies, two eyes
  live), **要点 The vital point** (straight three and bent three; the multi-move kill problems live here), and a **checkpoint
  Review 3** that mixes Units 4, 5, 7 with eyes. 25 exercises, 9 explanation steps, 3 of the exercises are multi-move.
- **Ladders (the "play the whole ladder" idea of the previous spec) are deferred**, and this matters: I found that a ladder has
  *two* correct ataris at almost every step (checked by hand, §10), but a `sequence` exercise has exactly one correct line.
  Accepting only one would mark a correct move "wrong". The right fix is a small search inside the runner; that is a separate
  item (§12, decision 2). Unit 9 stays exactly as you approved it.
- **Every position was checked by hand**, and §10 lists the claims QA must re-prove with the real engine (including a
  test-only exhaustive search for each "kill" and "live" claim). I could not run code in this session.
- **Two app-wide changes from your feedback** (§5.6, §5.7, AC 39–50): every screen with a board now reads top to bottom as
  instruction, board, feedback and buttons (the explanation steps and Capture Go change), and the bamboo grain is fainter with
  a darker white-stone edge so grid and stones stay legible.
- Questions for you are at the end (§12), each with my default.

## 1. Goal
A beginner who finishes Units 10–11 can tell a real eye (真眼 zhēnyǎn) from a false eye (假眼 jiǎyǎn), knows that a group with two
real eyes is alive (活 huó) and a group with one eye is dead (死 sǐ), and can find the vital point (要点 yàodiǎn) of a three-point
eye space — both to live and to kill — in zh-CN, en or fr.

## 2. User stories
- As a beginner, I want to see why an empty point inside my stones is safe, so that "eye" is a picture, not a definition.
- As a beginner, I want to be shown a false eye being captured, so that I stop trusting every enclosed point.
- As a beginner, I want to watch one eye die and two eyes live, so that "two eyes" feels necessary, not arbitrary.
- As a beginner, I want to play a short kill problem with the opponent answering, so that I feel I am really fighting.
- As a beginner, I want a wrong move to show the opponent's good answer and one sentence of reason, so that I learn the point
  and can retry without starting the lesson over.
- As a beginner, I want to know how far I am in a problem ("Move 2 of 3"), so that I am never lost.
- As a player using a screen reader or reduced motion, I want the opponent's replies announced and not animated.
- As the product owner, I want the course to stay calm: one idea per lesson, small boards, no new colour or art.

## 3. Scope, curriculum mapping, key decisions
| Unit | Lesson id | Steps | Exercises | Authoring | `CURRICULUM.md` source |
|---|---|---|---|---|---|
| 10 眼 | `u10-eyes` | 3 | 6 | hand JSON | "Identify real eyes" |
| 11 死活 | `u11-two-eyes` | 3 | 6 | hand JSON | "Two eyes = alive" |
| 11 死活 | `u11-vital` | 3 | 6 (2 `sequence`) | `content-src/` + SGF | "Make two eyes / prevent two eyes" |
| 11 checkpoint | `u11-review` (`kind: checkpoint`) | 0 | 7 (1 `sequence`) | `content-src/` + SGF | mixes Units 4, 5, 7, 10, 11 |

Total 9 steps, 25 exercises. Types: tap-point, choice, count, play-move, **sequence** (new runner). Boards: 5×5 for everything
except one 7×7 (`u10-eyes` e4). Coordinates on (texts name points).
Deviations from `CURRICULUM.md`, on purpose: Unit 11 has two lessons plus a checkpoint (three nodes on the map, as Unit 9 has
two); "make two eyes / prevent two eyes" are one-move *and* two-move problems; the unit-10 "identify real eyes" includes
false eyes; centre eyes (four diagonals) are not taught (§11). Unit 12 (地 Territory) becomes the "coming soon" unit.
Stars: M3 constants, as in Units 7–9. Unlock: existing rule (a unit unlocks at 1★ on the closest earlier unit).

Decisions made in this spec (PO may overrule, §12): (1) sequence feedback uses engine facts only plus one authored `whyKey` per
listed wrong first move; (2) ladder play-along deferred; (3) authors guarantee one correct move per ply and QA proves it with a
search (the validator cannot); (4) "Try again" undoes only the mistaken move when it was a later move in the line.

## 4. Acceptance criteria
Coordinates: letter = column (no `i`), number = row, row 1 at the bottom. "Content test" = `src/lessons/content.test.ts`.
A "line" is replayed from the exercise setup with the real engine. QA turns each criterion into a test.

**A. Files and validity**
1. Given the repo after this item, then `src/lessons/content/` additionally holds `u10-eyes.json`, `u11-two-eyes.json`,
   `u11-vital.json`, `u11-review.json`, each named after its `id` and registered; `u11-vital.json` and `u11-review.json` carry
   `generatedFrom` and come from `content-src/u11-vital.src.json` and `content-src/u11-review.src.json` (SGF files in
   `content-src/u11-vital/` and `content-src/u11-review/`); `npm run import:sgf` reproduces them byte for byte (drift test).
2. When the content test runs, then every file passes `validateLesson` with `hasText` over zh-CN, en and fr and `validateCatalog`
   is `{ ok: true }` (Units 1–11 each have a lesson; Unit 12 is planned).
3. Then step and exercise counts are 3/3/3/0 steps and 6/6/6/7 exercises with the ids of §7, and exactly three `sequence`
   exercises exist in shipped content (`kill-straight`, `kill-bent`, `r-kill`).
4. Then `getSolution` of every exercise equals the "Right answer" column of §7 (one parametrised test; sets for tap-point).
5. Then every text key exists in zh-CN, en and fr within limits (zh-CN ≤ 70, en/fr ≤ 160 characters; step texts ≤ 135 in en/fr),
   i18n parity holds, no existing key is removed, and `unit.10.title`, `unit.11.title`, `unit.12.title` and the
   `sequence.*` keys of §5.4 exist in all three files.
6. Then every wrong `choice` option has a `whyKey`; every `sequence` has a `hintKey`, an `explainKey`, and a `whyKey` on each
   listed wrong branch; `hintPoints` are among the solution points; all four lessons have `"coordinates": true`.
7. Then `PLANNED_UNITS = [12]`; the map shows Unit 12 as "coming soon"; tests that assumed Unit 10 is planned are updated.
8. Then the registry guard of M5 item 2 ("no shipped lesson contains a `sequence`") is replaced by: every shipped `sequence` is
   playable by the runner (AC 14–38 run against all three).

**B. Content correctness (proved by the engine, test-only code allowed)**
9. Given each `sequence` of §7, when `line` is replayed, then every move is legal, colours alternate, and the goal
   `capture` target is captured by the last move (the whole black group, including the scripted reply stone: `kill-straight` 6
   stones, `kill-bent` 6, `r-kill` 6).
10. Given each `wrong` branch of the three sequences, then its moves are legal and, afterwards, **no White sequence of up to 6
    plies captures the black group** (exhaustive test-only search over all legal moves and passes) — i.e. the refutation really
    gives Black two eyes.
11. Given the first move of each `line`, then after Black's scripted reply **and after every other legal Black reply, including a
    pass**, White captures the target within 4 further plies (exhaustive search). This proves the kill.
12. Given the starting position of each kill problem, then the only White first moves inside the eye space that capture within 6
    plies are the line's first move (a1/c1 fail for `kill-straight`; e2/d1 fail for `kill-bent`). This proves uniqueness at ply 0.
13. Given each `tap-point`, `choice`, `count` of §7, then the stated answer is true by the checks of §10 (parametrised test,
    one assertion per claim: eye enclosure, "White move is illegal", "White move captures N", liberty counts, eye counts) and
    for each "make two eyes / vital point" answer Black has no legal reply that captures within 6 plies, while the other two
    inner points do not give two eyes (`u11-two-eyes` e3, `u11-vital` v1 and v3).

**C. Runner: flow** (`src/exercises/runners/SequenceRunner.tsx`; pure logic in `src/exercises/sequence.ts`)
Let `m = ceil(line.length / 2)` be the number of learner moves.
14. Given a `sequence` exercise, when it starts, then the board shows the setup (after `prelude`), the learner's colour is
    `toPlay`, the progress row reads "Move 1 of m", no feedback is shown and the Hint button is enabled.
15. Given the learner taps a legal point that equals `line[k].at` (k even), when committed, then the stone is placed with the
    usual sound, the board locks, the status reads "<Opponent> replies…", and after **500 ms** the stone `line[k+1]` is placed
    automatically (stone sound; capture fade if it captures), the board unlocks and the progress reads "Move (k/2)+2 of m".
16. Given the learner plays the last move of `line` (or the opponent's last scripted move when `line.length` is even), then
    the exercise is `correct`, the board locks, the last stone gets the green ring, and the `explainKey` text shows. For
    `goal.kind: 'capture'` the feedback also shows `sequence.captured` with the engine's count of captured stones.
17. Given the learner taps an illegal point (occupied, suicide, ko), then the engine sentence shows (`illegalFeedback`), nothing
    is placed and no try is lost.
18. Given the learner's move at ply 0 equals the first move of `wrong[i]`, when committed, then it is placed, then the replies of
    `wrong[i].line` are played automatically (500 ms apart), the board stays locked, the feedback card shows `wrong[i].whyKey`
    (or `sequence.wrong.refuted` if none), the mistaken stone gets a dashed rouge ring, one try is spent, and the button reads
    *Try again*.
19. Given the learner's move at ply 0 is legal but not in `line` or `wrong`, then it is placed, no reply is played, one try is
    spent, the feedback card shows `sequence.wrong.liberties` when the exercise has a `capture` goal and the target group still
    has ≥ 2 liberties after that move (the engine count is the parameter), otherwise `sequence.wrong.notLine`; dashed rouge
    ring; button *Try again*.
20. Given the learner's move at ply k ≥ 2 is legal but not `line[k].at`, then the same as AC 19 applies, but the button reads
    *Undo*, and pressing it restores the position before that move **with the progress kept** ("Move k/2+1 of m").
21. Given *Try again* at ply 0 (or after a refutation), then the board returns to the start position, the progress reads
    "Move 1 of m", the feedback clears, the rouge ring disappears.
22. Given a locked board (opponent replying, wrong state, correct, revealed), when the learner taps it, then nothing happens
    (no preview ghost, no sound).
23. Given three mistakes in one exercise (the counter is for the whole exercise, not per ply; reducer unchanged), then the
    exercise is `revealed`: the board resets to the start position and the correct `line` is played automatically, 800 ms
    apart, with the last-move mark; then *Next*; the `explainKey` text shows; outcome `revealed`. (Reduced motion: AC 31.)
24. Given outcome rules unchanged: no mistake and no hint → `clean`; otherwise `solved`; revealed → `revealed`.
25. Given the learner leaves the screen (✕ or back) while a reply or a replay is scheduled, then the leave sheet appears as
    usual, and no timer fires after unmount (test with fake timers: no state update after unmount).
26. Given a `sequence` exercise with a `prelude`, then the moves of AC 15–23 are judged from the position after the prelude.

**D. Runner: hints**
27. Given the learner presses Hint, then `hintKey` text shows, `hintUsed` is set (no `clean`), and an amber ring pulses on the
    **point of the next expected learner move** (`line[k].at` for the current ply; at ply 0 it equals `hintPoints`). The hint opens
    by itself after the 2nd mistake (as other types).
28. Given the opponent is replying (AC 15), when Hint is pressed, then the hint text opens and the pulse starts only once the
    board unlocks (no ring on a stale ply).

**E. Runner: layout, a11y, motion**
29. Given 360×740, a 5×5 sequence exercise (prompt of 2 lines) fits without scrolling: top bar, prompt card, progress row
    (28 px), board 328 px, feedback card (min 72 px), button row (48 px). Verified by web screenshots of the four states of the
    mockup (`npm run verify:web:m5` extended or a new `verify:web:m5c`).
30. Then every pressable (Hint, Try again/Undo, Next) is ≥ 44 px high and ≥ 44 px wide; Hint and Try again are side by side with
    12 px gap when both are visible.
31. Given the OS "reduce motion" setting, then stones appear without animation, the opponent's reply delay is 250 ms (still
    sequential), the refutation replies 250 ms apart, the revealed answer is shown **at once** as the final position with the last
    move marked (no step-by-step replay), and the hint ring does not pulse (steady ring).
32. Given a screen reader, then the progress row has `accessibilityLabel` "Move n of m" (translated); each automatic stone is
    announced with `AccessibilityInfo.announceForAccessibility` ("White plays b1"); wrong/correct feedback is announced; the
    board's own labels (M2) are unchanged; no state is conveyed by colour alone (the mistaken stone has a dashed ring, the
    correct stone a solid ring).
33. Given a locked board, then the Hint and Try again/Undo/Next buttons stay reachable and the screen is not blocked.

**F. Texts**
34. Then `sequence.*` keys (§5.4) exist in zh-CN, en, fr; `sequence.wrong.liberties` and `sequence.captured` use i18next plurals
    in en and fr (`_one`/`_other`); zh-CN has no pinyin in any new text; en/fr give Chinese term + pinyin at first use (§8).

**G. Quality**
35. `src/exercises/sequence.ts` imports nothing from `react`, `react-native`, `expo` (purity test extended); the judge is a pure
    function `judgeSequence(exercise, progress, move) → {kind, replies, facts}` with unit tests for AC 15–21, 23, 26 (no timers).
36. `npm run lint`, `typecheck`, `format:check`, `test` green; no new dependency; the Maestro/web verification screenshots of the
    four runner states and of one lesson from each unit are saved to `docs/screenshots/M5/` (names `20-*` …).
37. Given the existing exercise types, then their behaviour is unchanged (existing runner tests pass untouched).
38. Given a `sequence` exercise whose `line` has odd length and a learner who plays it perfectly, then the opponent never moves
    after the last learner move (no stray reply).

**H. App-wide layout rule (§5.6)** — tests use the test IDs `lesson-text-card`, `practice-prompt`, `lesson-board`, `practice-board`, `practice-feedback`.
39. Given an explanation step, when rendered, then the text card's top edge is above the board's top edge (y(`lesson-text-card`) <
    y(`lesson-board-area`)), and Back/Next stay at the bottom; the Replay button (when shown) is below the board.
40. Given the explanation text card, then it is 96 px high in every step of every lesson (no layout jump between steps) and
    scrolls inside if the text needs more.
41. Given a tap-point, play-move, choice, count or sequence exercise, then y(`practice-prompt`) < y(`practice-board`) < y(`practice-feedback`)
    (a layout test over a fixture of each type; choice options render below the board).
42. Given a Capture Go game (`play-bot`), then a goal card with the exercise's `promptKey` text is above the score row and the board for
    the whole game (before and after the first move), and the feedback card below the board no longer repeats the goal.
43. Given 360×740 and boards of 5×5, 7×7 (with coordinates) and 9×9, then for the explanation step, one exercise of every type and the
    Capture Go game, every control is on screen without scrolling the page (screenshots in `docs/screenshots/M5/`, names `21-*`).
44. Given any screen with a board, then no instruction text is rendered between the board and the bottom buttons except the feedback card
    (a source check: instructions only come from `textKey`/`promptKey` cards above the board).

**I. Lighter bamboo board (§5.7)**
45. Then `tokens.ts` has the values of the §5.7 table (`bambooStripLight` #EBD8A8, `bambooStripDark` #E3CD98, `bambooNode` #D9C288,
    `stone.whiteEdge` #6B675C; others unchanged).
46. Given the WCAG relative-luminance contrast function (test helper), then: `board.line` vs `board.bamboo` ≥ 4.5:1; `stone.black` vs
    `board.bamboo` ≥ 3:1; `stone.whiteEdge` vs `board.bamboo` ≥ 3:1 (non-text contrast, WCAG 1.4.11); and `stone.whiteEdge` vs
    `stone.white` ≥ 3:1.
47. Then the grain is low contrast: contrast of `bambooStripLight` vs `bambooStripDark` ≤ 1.15:1, and of `bambooNode` vs each strip ≤ 1.2:1,
    and of every strip colour vs `board.bamboo` ≤ 1.15:1.
48. Then the highlight, hint, error and success rings (`color.hint`, `color.error`, `color.success`) keep ≥ 3:1 against the board base (test
    helper over the same function); if one falls below, the spec value stays and a thicker ring (3 px) is required.
49. Given `GoBoard`, then it uses only `board.*` / `stone.*` tokens for grain and stones (the existing "no literal colours" test passes) and
    the same component is used by the lesson, exercise, sequence and Capture Go screens (no per-screen board colours).
50. Given the web screenshots at 360×740, the grid lines and white stones are clearly legible on the new board (designer review of
    `docs/screenshots/M5/22-*`), with before/after crops of one 9×9 position attached to the PR.

## 5. Screen flow and UI
Two app-wide design rules from PO feedback are specified in §5.6 (one layout for every board screen) and §5.7 (lighter bamboo board);
AC 39–50.
### 5.1 Screens
No new route. `ExerciseView` dispatches `type: 'sequence'` to `SequenceRunner`. Everything else (unit map, explanation player,
exercise frame, leave sheet, result screen) is unchanged. The map gets nodes for Units 10–11 and "coming soon" for Unit 12.

### 5.2 Wireframe (360×740, 5×5 board without coordinates; with coordinates the board is the same size)
```
┌──────────────────────────────┐
│ ✕   ● ● ● ○ ○ ○   (set)      │ 56  existing top bar: progress through the 6 exercises
│ ┌──────────────────────────┐ │
│ │ White to play and kill   │ │ ~72 prompt card (2 lines max)
│ │ the black group.         │ │
│ └──────────────────────────┘ │
│ Move 1 of 2  ○ ○     Your move│ 28  sequence progress row (text + small dots)
│ ┌──────────────────────────┐ │
│ │        board 328 × 328   │ │
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │ feedback card (min 72)   │ │ reasons, hint text, "captured 6 stones"
│ └──────────────────────────┘ │
│ [   Hint   ] [ Try again ]   │ 48  (Next replaces them when done)
└──────────────────────────────┘
```
Total ≈ 56 + 72 + 28 + 328 + 72 + 48 + gaps ≈ 650 px. The move dots are small rings (not tappable) in `textSecondary`, filled when
done, so they cannot be confused with the set dots of the top bar (accent colour). The right side of the progress row shows
"Your move" or "<Colour> replies…".

### 5.3 States
| State | Board | Progress row | Feedback card | Buttons |
|---|---|---|---|---|
| Learner's turn | interactive | "Move n of m", "Your move" | empty (reserved) | Hint |
| Opponent replying | locked | same n, "<Colour> replies…" | empty | Hint (dimmed look, still works) |
| Hint open | interactive | — | `hintKey` text, amber ring on next point | Hint (hintSoft) |
| Wrong (any of AC 18–20) | locked, dashed rouge ring on the mistaken stone (+ refutation stones visible) | "Move n of m" | reason (`whyKey` or engine fact), rouge border | Hint, **Try again** (ply 0 / after refutation) or **Undo** (later ply) |
| Correct | locked, green ring on last stone, captures faded | "Move m of m", "Done" | `sequence.captured` + `explainKey`, tea-green border | **Next** |
| Revealed | answer line played (or final position with reduced motion) | "Answer" | `explainKey` | **Next** |
No loading state (everything local). Empty = the first state.

### 5.4 Copy keys (new, global)
| Key | zh-CN | en | fr |
|---|---|---|---|
| sequence.progress | 第 {{n}} 手，共 {{m}} 手 | Move {{n}} of {{m}} | Coup {{n}} sur {{m}} |
| sequence.yourTurn | 轮到你 | Your move | À vous |
| sequence.replies.B | 黑棋应手… | Black replies… | Les Noirs répondent… |
| sequence.replies.W | 白棋应手… | White replies… | Les Blancs répondent… |
| sequence.answer | 正解 | Answer | Solution |
| sequence.done | 完成 | Done | Terminé |
| sequence.undo | 撤回 | Undo | Annuler |
| sequence.wrong.refuted | 对方有好的应对。再试一次。 | The opponent has a good answer. Try again. | L'adversaire a une bonne réponse. Réessayez. |
| sequence.wrong.liberties_one / _other | 这一手之后，目标棋子还有 {{count}} 口气。 | After that move the target group still has {{count}} liberty. / liberties. | Après ce coup, le groupe visé a encore {{count}} liberté. / libertés. |
| sequence.wrong.notLine | 这一手不是本题的答案。撤回再看看。 | That is not the move for this problem. Look again. | Ce n'est pas le coup de ce problème. Regardez encore. |
| sequence.captured_one / _other | 提掉 {{count}} 子。 | You captured {{count}} stone. / stones. | Vous avez capturé {{count}} pierre. / pierres. |
| sequence.a11y.plays.B | 黑棋下在 {{point}} | Black plays {{point}} | Les Noirs jouent {{point}} |
| sequence.a11y.plays.W | 白棋下在 {{point}} | White plays {{point}} | Les Blancs jouent {{point}} |
(zh-CN has no plural; use the same string for `_one`/`_other` if the i18n setup needs both.)
Map titles: `unit.10.title` 眼 / "Eyes · 眼 yǎn" / "Les yeux · 眼 yǎn"; `unit.11.title` 死活 / "Life and death · 死活 sǐhuó" / "Vie et
mort · 死活 sǐhuó"; `unit.12.title` (planned) 地 / "Territory · 地 dì" / "Le territoire · 地 dì".

### 5.5 Interaction details
- Touch-down preview, commit on touch-up (M2) unchanged; the opponent's stone is placed without preview.
- The learner's colour is always `toPlay`; for White-to-play kill problems the board shows the "last move" mark only on stones
  placed during the exercise (not on the setup).
- A wrong refutation is shown in full so the learner *sees* the reason; it never takes longer than 2 stones × 500 ms.
- *Undo* at ply ≥ 2 is a button, not a gesture; only the mistaken move is removed (the learner keeps the progress made).
- Wrong feedback card for later-ply mistakes never says a move "also works" or "is wrong because …" beyond what the engine
  knows; it only gives the liberty fact or the neutral `notLine` text.

### 5.6 App-wide rule 1 — one layout for every screen with a board (PO feedback 2026-10-20)
**Rule (default): instructions on top, board in the middle, feedback / answer options / actions at the bottom.** Order, top to bottom:
top bar → instruction card (explanation text, exercise prompt, or game goal) → [status row: score / turn / "Move n of m"] → board →
feedback card and answer options → buttons (Hint, Try again/Undo, Back/Next, Replay). The learner always reads first, looks at the
board second, acts last.
Audit of the current code (read `src/exercises/`, not run):
| Screen | Today | Change |
|---|---|---|
| Exercise prompt (`ExerciseView`) for tap-point, play-move, choice, count | prompt above board, feedback/options/actions below | none (already the rule) |
| New sequence runner | prompt above, progress row, board, feedback, buttons | none (designed to the rule) |
| Explanation player (`ExplainPlayer`) | **board first, text card below it**, Replay under the text, Back/Next at the bottom | **change**: text card above the board (fixed 96 px slot so the board does not jump between steps); Replay moves directly under the board; Back/Next unchanged |
| Capture Go game (`PlayBotRunner`) | score row and turn pill above the board; the goal sentence only appears in the feedback card **below** the board before the first move, and disappears after it | **change**: a one-line goal card ("Capture 3 stones first.", the existing `promptKey`) stays on top for the whole game; the feedback card below keeps only reactions and hints |
| End-of-game card (`EndCard`), result screen | below / full screen | none (actions at the bottom) |
| Hint button | in the top bar for exercises and games | none (kept; the sequence runner and the games use it as today) |
| `/dev/board` (developer screen) | not a learner screen | none |
Fit at 360×740 (heights in px): explanation step 56 top bar + 96 text + 8 + 328 board + 44 Replay + 12 + 48 buttons + 24 margin ≈ 616
(5×5, 7×7, 9×9 all use the same 328 square board; 7×7 with coordinates draws 41 px cells, 9×9 36 px cells). Capture Go 9×9: 56 + 48
goal card + 8 + 36 score row + 28 turn pill + 328 board + 8 + 72 feedback + 48 buttons + gaps ≈ 650. Both ≤ 740 with ≥ 90 px to spare
on a 740 px screen; the explanation text card scrolls inside its slot if a language needs more than 4 lines (as today).

### 5.7 App-wide rule 2 — lighter bamboo board (PO feedback, accessibility)
The bamboo look stays, but the grain must not compete with the grid and the stones. Target tokens in `src/theme/tokens.ts` (`board`, `stone`):
| Token | Today | New |
|---|---|---|
| `board.bamboo` (base) | #E8D3A0 | #E8D3A0 (unchanged) |
| `board.bambooStripLight` | #EEDCAE | #EBD8A8 |
| `board.bambooStripDark` | #DEC68C | #E3CD98 |
| `board.bambooNode` | #CDB277 | #D9C288 |
| `board.line` | #33281B | #33281B (unchanged) |
| `stone.black` | #22252A | #22252A (unchanged) |
| `stone.white` | #F7F5EE | #F7F5EE (unchanged) |
| `stone.whiteEdge` | #8F8C80 | **#6B675C** (darker: the old edge is only about 2.2:1 against the board) |
Measured by hand with the WCAG formula (QA re-computes): grid line vs base ≈ 9:1; black stone vs base ≈ 10:1; white-stone edge vs base
≈ 3.6:1 (was ≈ 2.2:1); light strip vs dark strip ≈ 1.11:1; node vs strip ≈ 1.12:1 (today about 1.2–1.3:1). The white stone's fill is
separated from the board by its edge ring, which is why the edge, not the fill, carries the 3:1 requirement. Node marks stay 1–2 px
and never touch intersections' lines more than the grid does. Applies to `GoBoard` and therefore to explanation boards, all exercise
runners, the sequence runner and Capture Go; no other colours change.

## 6. Game design notes
**Curve.** Unit 10: e1 find the eye (almost certain) → e2 plain real corner eye → e3 the false eye (first twist) → e4 two eyes
side by side on 7×7 (the test) → e5 find the capturable stone → e6 repair the false eye by capturing. Unit 11 two-eyes: e1 count
2 → e2 one eye dies → e3 make two eyes → e4 why nobody can fill them → e5 adjacent points are one eye (trap) → e6 after White's
vital move there is no second eye. Vital point: v1 live (tap) → v2 kill (multi-move, same shape = contrast) → v3 live bent
(tap) → v4 kill bent (tap) → v5 kill bent mirrored (multi-move) → v6 four in a row (hard negative: you cannot kill it). The
review mixes Unit 4 (capture), 5 (atari), 7 (illegal move), 10 (real/false eye, count) and ends with one kill problem.
**Length:** 3 steps (~25 s) + 6 exercises (~30 s each, sequences ~45 s) ≈ 3–4 minutes per lesson; review ≈ 4 minutes.
**Stars:** M3 constants. A sequence is one exercise; its outcome is `clean`/`solved`/`revealed` as in AC 24.
**Hints:** Hint always visible; opens after the 2nd mistake; the amber ring points at the *next* correct move, not the whole
line. **After 3 mistakes:** the answer is played (AC 23), `explainKey`, *Next*, outcome `revealed`. Lessons never block (1★ needs
4 of 6 solved, M3 rule).
**Feedback / reward:** stone "tock" for both colours, capture fade 300 ms, green ring on success, rouge dashed ring on the mistake;
no extra sound or confetti. Refusals (illegal moves) are not mistakes.
**Rule of authoring (new):** a `sequence` has exactly one correct move for the learner at every ply; if two moves work (as in
every ladder) it must not be authored as a `sequence` (§9, §12 decision 2). The importer cannot check this, QA does (AC 12).

## 7. Content
Positions use the names below (`S`, `L`, `Lm`). All stones are listed as engine coordinates. Texts: prefix
`lesson.<id>.`; zh-CN never shows pinyin (as M4/M5); en/fr show Chinese + pinyin at first use (§8).
```
S  (5×5)  straight three, bottom-left        L  (5×5) bent three, bottom-left      Lm (5×5) bent three, bottom-right
5 . . . . .                                  5 . . . . .                           5 . . . . .
4 . . . . .   B a2 b2 c2 d2 d1               4 O O O . .   B a3 b3 b2 c2 c1       4 . . O O O   B e3 d3 d2 c2 c1
3 O O O O O   W a3 b3 c3 d3 e3 e2 e1         3 X X O O .   W a4 b4 c4 c3 d3 d2 d1 3 . O O X X   W e4 d4 c4 c3 b3 b2 b1
2 X X X X O   space a1 b1 c1                 2 . X X O .   space a1 b1 a2         2 . O X X .   space e1 d1 e2
1 . . . X O                                  1 . . X O .                           1 . O X . .
  a b c d e                                    a b c d e                             a b c d e
```
(X = Black, O = White. The stone lists are authoritative; the diagrams are for reading. The empty points inside the Black wall
are the eye space.)

### 7.1 Unit 10 — 眼 Eyes (`u10-eyes.json`, hand JSON)
Concept: an eye is an empty point enclosed by one group; White cannot play there. Real eye vs false eye (the enemy stone on the
diagonal that can capture a wall stone). Steps 3, exercises 6.
| # | id | Type | Position (size) | Right answer (hand-checked) |
|---|---|---|---|---|
| 1 | e1 `find-eye` | tap-point one | 5×5 B b1 b2 c2 d2 d1; W c3 | c1 |
| 2 | e2 `real-corner` | choice (2) | 5×5 B a2 b2 b1; W c2 c3; marker triangle a1 | "Real eye" |
| 3 | e3 `false-edge` | choice (2) | 5×5 B b1 c2 d2 d1; W a1 a2 b2; marker triangle c1 | "False eye" |
| 4 | e4 `which-real` | choice (2) | 7×7 B a2 b2 b1 d1 e2 f1; W c1 c2 d2; labels A a1, B e1 | "A" |
| 5 | e5 `weak-stone` | tap-point one | 5×5 B d1 c2 b2 b1; W e1 e2 d2 | d1 |
| 6 | e6 `capture-cutter` | play-move capture | 5×5 B a2 b1 c2 d1 d2; W b2; Black to play | b3 |
Steps: s1 (board 5×5 B b1 b2 c2 d2 d1, W c3, triangle on c1); s2 (board 5×5 B b1 c2 d2 d1, W a1 a2 b2, moves `W c1`, triangle c1);
s3 (board 5×5 B a2 b2 b1, W c1 c2, triangle on b2).
```json
{"schema":1,"id":"u10-eyes","unit":10,"kind":"lesson","titleKey":"lesson.u10-eyes.title","coordinates":true,
 "explain":[
  {"board":{"size":5,"setup":{"B":["b1","b2","c2","d2","d1"],"W":["c3"]}},"markers":[{"kind":"triangle","at":"c1"}],"textKey":"lesson.u10-eyes.s1"},
  {"board":{"size":5,"setup":{"B":["b1","c2","d2","d1"],"W":["a1","a2","b2"]}},"moves":[{"color":"W","at":"c1"}],"markers":[{"kind":"triangle","at":"c1"}],"textKey":"lesson.u10-eyes.s2"},
  {"board":{"size":5,"setup":{"B":["a2","b2","b1"],"W":["c1","c2"]}},"markers":[{"kind":"triangle","at":"b2"}],"textKey":"lesson.u10-eyes.s3"}],
 "exercises":[
  {"id":"find-eye","type":"tap-point","size":5,"setup":{"B":["b1","b2","c2","d2","d1"],"W":["c3"]},"mode":"one","answer":{"points":["c1"]},"promptKey":"lesson.u10-eyes.e1.prompt","hintKey":"lesson.u10-eyes.e1.hint","hintPoints":["c1"],"explainKey":"lesson.u10-eyes.e1.explain"},
  {"id":"real-corner","type":"choice","size":5,"setup":{"B":["a2","b2","b1"],"W":["c2","c3"]},"options":[{"textKey":"lesson.u10-eyes.o.real","correct":true},{"textKey":"lesson.u10-eyes.o.false","whyKey":"lesson.u10-eyes.e2.w2"}],"markers":[{"kind":"triangle","at":"a1"}],"promptKey":"lesson.u10-eyes.e2.prompt","explainKey":"lesson.u10-eyes.e2.explain"},
  {"id":"false-edge","type":"choice","size":5,"setup":{"B":["b1","c2","d2","d1"],"W":["a1","a2","b2"]},"options":[{"textKey":"lesson.u10-eyes.o.real","whyKey":"lesson.u10-eyes.e3.w1"},{"textKey":"lesson.u10-eyes.o.false","correct":true}],"markers":[{"kind":"triangle","at":"c1"}],"promptKey":"lesson.u10-eyes.e3.prompt","explainKey":"lesson.u10-eyes.e3.explain"},
  {"id":"which-real","type":"choice","size":7,"setup":{"B":["a2","b2","b1","d1","e2","f1"],"W":["c1","c2","d2"]},"options":[{"textKey":"lesson.u10-eyes.e4.o1","correct":true},{"textKey":"lesson.u10-eyes.e4.o2","whyKey":"lesson.u10-eyes.e4.w2"}],"markers":[{"kind":"label","at":"a1","text":"A"},{"kind":"label","at":"e1","text":"B"}],"promptKey":"lesson.u10-eyes.e4.prompt","explainKey":"lesson.u10-eyes.e4.explain"},
  {"id":"weak-stone","type":"tap-point","size":5,"setup":{"B":["d1","c2","b2","b1"],"W":["e1","e2","d2"]},"mode":"one","answer":{"points":["d1"]},"promptKey":"lesson.u10-eyes.e5.prompt","hintKey":"lesson.u10-eyes.e5.hint","hintPoints":["d1"],"explainKey":"lesson.u10-eyes.e5.explain"},
  {"id":"capture-cutter","type":"play-move","size":5,"setup":{"B":["a2","b1","c2","d1","d2"],"W":["b2"]},"toPlay":"B","goal":{"kind":"capture"},"promptKey":"lesson.u10-eyes.e6.prompt","hintKey":"lesson.u10-eyes.e6.hint","hintPoints":["b3"],"explainKey":"lesson.u10-eyes.e6.explain"}]}
```
Checked (by hand): e1 — c1 neighbours b1 d1 c2, all Black; a1 (neighbour a2 empty), a2, e1 (neighbour e2 empty) are not
enclosed; White c3 has libs b3 d3 c4. e2 — White a1 would have no liberty and the group a2 b2 b1 keeps a3 b3 (illegal); the
diagonal b2 is Black. e3 — b1 has neighbours a1(W) b2(W) c1: one liberty; c2 d2 d1 are one group with ≥ 4 liberties; White c1
(legal: it captures b1 and then has liberty b1). e4 — A: group a2 b2 b1 has libs a1 a3 b3, White a1 is illegal; B: d1 has
neighbours c1(W) d2(W) e1: one liberty, White e1 captures it (legal); every stone has ≥ 1 liberty at the start (e2: e1 f2 e3;
f1: e1 g1 f2; the White group c1 c2 d2 has libs c3 d3). e5 — d1 neighbours c1 e1(W) d2(W): one liberty; b1 b2 c2 group
libs a1 a2 b3 c3 c1. e6 — b2 neighbours a2 b1 c2 (Black) and b3: one liberty; b3 is the only capture; after it White cannot
re-enter b2 (no liberty, no capture).

**Texts** (`lesson.u10-eyes.`)
| Key | zh-CN | en | fr |
|---|---|---|---|
| title | 眼 | Eyes | Les yeux |
| s1 | 被自己棋子围住的空点叫眼。白棋下不进去：没有气。 | An empty point enclosed by one group's own stones is an eye (眼 yǎn). White cannot play there: it would have no liberty. | Un point vide entouré par les pierres d'un même groupe est un œil (眼 yǎn). Les Blancs ne peuvent pas y jouer : plus de liberté. |
| s2 | 这里白子在斜角上，b1 只剩一口气：白 c1 提掉它。这是假眼。 | Here a white stone sits on the diagonal. b1 has one liberty: White c1 captures it. A false eye (假眼 jiǎyǎn). | Ici une pierre blanche touche la diagonale. b1 n'a qu'une liberté : c1 la capture. Un faux œil (假眼 jiǎyǎn). |
| s3 | 眼的斜角都是自己的棋，就是真眼。a1 的斜角 b2 是黑棋。 | If the diagonal points of an eye are your own stones, it is a real eye (真眼 zhēnyǎn). The diagonal of a1 is b2, Black's. | Si les diagonales d'un œil sont vos pierres, c'est un vrai œil (真眼 zhēnyǎn). La diagonale de a1 est b2, noire. |
| o.real | 真眼 | Real eye | Vrai œil |
| o.false | 假眼 | False eye | Faux œil |
| e1.prompt | 点出黑棋的眼。 | Tap the black group's eye. | Touchez l'œil du groupe noir. |
| e1.hint | 找一个四周都是黑子的空点。 | Look for an empty point with only black stones around it. | Cherchez un point vide entouré seulement de pierres noires. |
| e1.explain | c1 被黑棋围住，白棋下不进去。 | c1 is enclosed by Black: White cannot play there. | c1 est entouré par les Noirs : les Blancs ne peuvent pas y jouer. |
| e2.prompt | 标记的 a1 是真眼还是假眼？ | Is the marked point a1 a real or a false eye? | Le point marqué a1 est-il un vrai ou un faux œil ? |
| e2.w2 | 斜角 b2 是黑棋自己的子，白棋进不去：它是真眼。 | The diagonal b2 is Black's own stone, so White cannot get in: it is a real eye. | La diagonale b2 est noire : les Blancs ne peuvent pas entrer. C'est un vrai œil. |
| e2.explain | a1 是真眼：白棋下不进去。 | a1 is a real eye: White cannot play there. | a1 est un vrai œil : les Blancs ne peuvent pas y jouer. |
| e3.prompt | 标记的 c1 是真眼还是假眼？ | Is the marked point c1 a real or a false eye? | Le point marqué c1 est-il un vrai ou un faux œil ? |
| e3.w1 | 白 c1 能提掉只剩一口气的 b1，所以 c1 是假眼。 | White c1 captures b1, which has one liberty, so c1 is a false eye. | Les Blancs c1 capturent b1, qui n'a qu'une liberté : c1 est un faux œil. |
| e3.explain | 白棋能在 c1 提子，所以 c1 是假眼。 | White can capture on c1, so it is a false eye. | Les Blancs peuvent capturer en c1 : c'est un faux œil. |
| e4.prompt | A 和 B 哪一个是真眼？ | Which is the real eye, A or B? | Lequel est le vrai œil, A ou B ? |
| e4.o1 / e4.o2 | A / B | A / B | A / B |
| e4.w2 | 白 e1 能提掉只剩一口气的 d1，所以 B 是假眼。 | White e1 captures d1, which has one liberty, so B is a false eye. | Les Blancs e1 capturent d1, qui n'a qu'une liberté : B est un faux œil. |
| e4.explain | A 是真眼，B 是假眼。 | A is a real eye and B is a false eye. | A est un vrai œil et B un faux œil. |
| e5.prompt | 白棋想破 c1 这只眼。点出会被提掉的黑子。 | White wants to break the eye c1. Tap the black stone White can capture. | Les Blancs veulent détruire l'œil c1. Touchez la pierre noire qu'ils peuvent capturer. |
| e5.hint | 哪颗黑子只剩一口气？ | Which black stone has only one liberty? | Quelle pierre noire n'a plus qu'une liberté ? |
| e5.explain | d1 只剩 c1 一口气，白 c1 就能提掉它。 | d1 has only the liberty c1; White c1 captures it. | d1 n'a que la liberté c1 ; les Blancs c1 la capturent. |
| e6.prompt | 白 b2 让 c1 成了假眼。提掉它。 | The white stone on b2 makes c1 a false eye. Capture it. | La pierre blanche b2 fait de c1 un faux œil. Capturez-la. |
| e6.hint | 它只剩一口气。 | It has only one liberty. | Il ne lui reste qu'une liberté. |
| e6.explain | 提掉 b2 后，c1 的两个斜角都是黑棋：真眼。 | After b2 is captured both diagonals of c1 are Black's: a real eye. | Après la capture de b2, les deux diagonales de c1 sont noires : un vrai œil. |

### 7.2 Unit 11 — 两眼活 Two eyes live (`u11-two-eyes.json`, hand JSON)
Concept: one eye dies, two real eyes live; adjacent empty points are one eye. Steps 3, exercises 6.
| # | id | Type | Position | Right answer |
|---|---|---|---|---|
| 1 | e1 `count-eyes` | count | `S` + B b1; marker triangle a2 | 2 |
| 2 | e2 `one-eye` | choice (2) | 5×5 B a2 b2 b1; W a3 b3 c2; marker triangle a2 | "Yes, it can" |
| 3 | e3 `make-two` | tap-point one | `S` | b1 |
| 4 | e4 `cannot-play` | tap-point all | `S` + B b1 | a1, c1 |
| 5 | e5 `one-big-eye` | count | `S` + B a1 | 1 |
| 6 | e6 `after-vital` | choice (2) | `S` + W b1; Black to play | "No" |
Steps: s1 (board 5×5 B a2 b2 b1, W a3 b3 c2; moves `W c1`, `B e5`, `W a1`; B e5 is a harmless move elsewhere so colours
alternate); s2 (board `S`, moves `B b1`, triangle b1); s3 (continues, markers triangle a1 and c1).
```json
{"schema":1,"id":"u11-two-eyes","unit":11,"kind":"lesson","titleKey":"lesson.u11-two-eyes.title","coordinates":true,
 "explain":[
  {"board":{"size":5,"setup":{"B":["a2","b2","b1"],"W":["a3","b3","c2"]}},"moves":[{"color":"W","at":"c1"},{"color":"B","at":"e5"},{"color":"W","at":"a1"}],"textKey":"lesson.u11-two-eyes.s1"},
  {"board":{"size":5,"setup":{"B":["a2","b2","c2","d2","d1"],"W":["a3","b3","c3","d3","e3","e2","e1"]}},"moves":[{"color":"B","at":"b1"}],"textKey":"lesson.u11-two-eyes.s2"},
  {"markers":[{"kind":"triangle","at":"a1"},{"kind":"triangle","at":"c1"}],"textKey":"lesson.u11-two-eyes.s3"}],
 "exercises":[
  {"id":"count-eyes","type":"count","size":5,"setup":{"B":["a2","b2","c2","d2","d1","b1"],"W":["a3","b3","c3","d3","e3","e2","e1"]},"answer":2,"markers":[{"kind":"triangle","at":"a2"}],"promptKey":"lesson.u11-two-eyes.e1.prompt","hintKey":"lesson.u11-two-eyes.e1.hint","explainKey":"lesson.u11-two-eyes.e1.explain"},
  {"id":"one-eye","type":"choice","size":5,"setup":{"B":["a2","b2","b1"],"W":["a3","b3","c2"]},"options":[{"textKey":"lesson.u11-two-eyes.e2.o1","correct":true},{"textKey":"lesson.u11-two-eyes.e2.o2","whyKey":"lesson.u11-two-eyes.e2.w2"}],"markers":[{"kind":"triangle","at":"a2"}],"promptKey":"lesson.u11-two-eyes.e2.prompt","explainKey":"lesson.u11-two-eyes.e2.explain"},
  {"id":"make-two","type":"tap-point","size":5,"setup":{"B":["a2","b2","c2","d2","d1"],"W":["a3","b3","c3","d3","e3","e2","e1"]},"mode":"one","answer":{"points":["b1"]},"promptKey":"lesson.u11-two-eyes.e3.prompt","hintKey":"lesson.u11-two-eyes.e3.hint","hintPoints":["b1"],"explainKey":"lesson.u11-two-eyes.e3.explain"},
  {"id":"cannot-play","type":"tap-point","size":5,"setup":{"B":["a2","b2","c2","d2","d1","b1"],"W":["a3","b3","c3","d3","e3","e2","e1"]},"mode":"all","answer":{"points":["a1","c1"]},"promptKey":"lesson.u11-two-eyes.e4.prompt","hintKey":"lesson.u11-two-eyes.e4.hint","explainKey":"lesson.u11-two-eyes.e4.explain"},
  {"id":"one-big-eye","type":"count","size":5,"setup":{"B":["a2","b2","c2","d2","d1","a1"],"W":["a3","b3","c3","d3","e3","e2","e1"]},"answer":1,"markers":[{"kind":"triangle","at":"a2"}],"promptKey":"lesson.u11-two-eyes.e5.prompt","hintKey":"lesson.u11-two-eyes.e5.hint","explainKey":"lesson.u11-two-eyes.e5.explain"},
  {"id":"after-vital","type":"choice","size":5,"setup":{"B":["a2","b2","c2","d2","d1"],"W":["a3","b3","c3","d3","e3","e2","e1","b1"]},"options":[{"textKey":"lesson.u11-two-eyes.e6.o1","whyKey":"lesson.u11-two-eyes.e6.w1"},{"textKey":"lesson.u11-two-eyes.e6.o2","correct":true}],"promptKey":"lesson.u11-two-eyes.e6.prompt","explainKey":"lesson.u11-two-eyes.e6.explain"}]}
```
Checked (by hand): `S`: every stone has ≥ 1 liberty; White's chain a3-e3-e2-e1 has libs a4…e4; Black's libs are a1 b1 c1 only (d2/d1
touch e2/e1 White). With b1: eyes a1 (neighbours a2 b1) and c1 (b1 c2 d1); White a1 or c1 is illegal because Black keeps the other
liberty. With a1: b1 and c1 touch: one eye (b1 neighbours a1 b2 c1; c1 neighbours b1 c2 d1). e2: Black a2 b2 b1 libs a1 c1; after
White c1 Black has only a1, Black a1 would be suicide, White a1 then captures 3 stones. e6: after Black a1 White b1 has liberty c1
only, but White c1 takes Black's last liberty and captures; after Black c1 White a1 does the same; passing loses too (§10).

**Texts** (`lesson.u11-two-eyes.`)
| Key | zh-CN | en | fr |
|---|---|---|---|
| title | 两眼活 | Two eyes live | Deux yeux, vivant |
| s1 | 只有一只眼的棋会死：白棋先填外面的气，再下进眼里提子。 | A group with one eye dies: White fills the outside liberties, then plays inside the eye and captures. | Un groupe à un seul œil meurt : les Blancs remplissent les libertés extérieures, puis jouent dans l'œil et capturent. |
| s2 | 黑 b1 把三个空点分成两只眼（两眼 liǎngyǎn）：a1 和 c1。 | Black b1 splits the three empty points into two eyes (两眼 liǎngyǎn): a1 and c1. | Les Noirs b1 séparent les trois points vides en deux yeux (两眼 liǎngyǎn) : a1 et c1. |
| s3 | 有两只真眼，白棋永远提不掉：这块棋活了。一只眼或没有眼就是死。 | Two real eyes can never be filled: the group is alive (活 huó). One eye or none: dead (死 sǐ). That is 死活 sǐhuó. | Deux vrais yeux ne peuvent jamais être remplis : le groupe est vivant (活 huó). Un œil ou aucun : mort (死 sǐ). C'est 死活 sǐhuó. |
| e1.prompt | 标记的黑棋有几只眼？ | How many eyes does the marked black group have? | Combien d'yeux a le groupe noir marqué ? |
| e1.hint | 数四周都是黑子的空点。 | Count the empty points enclosed by Black. | Comptez les points vides entourés par les Noirs. |
| e1.explain | a1 和 c1 是两只真眼。 | a1 and c1 are two real eyes. | a1 et c1 sont deux vrais yeux. |
| e2.prompt | 白先。白棋能提掉这块黑棋吗？ | White to play. Can White capture the black group? | Aux Blancs. Peuvent-ils capturer le groupe noir ? |
| e2.o1 / o2 | 能提掉 / 不能，已经活了 | Yes, it can / No, it is alive | Oui / Non, il est vivant |
| e2.w2 | 只有一只眼：白 c1 后，a1 就能提掉。 | One eye only: after White c1, a1 captures the group. | Un seul œil : après c1, les Blancs capturent en a1. |
| e2.explain | 一只眼活不了。 | One eye is not enough to live. | Un seul œil ne suffit pas pour vivre. |
| e3.prompt | 黑先。点出能做成两只眼的点。 | Black to play. Tap the point that makes two eyes. | Aux Noirs. Touchez le point qui fait deux yeux. |
| e3.hint | 把三个空点从中间分开。 | Split the three empty points in the middle. | Séparez les trois points vides par le milieu. |
| e3.explain | b1 留下 a1 和 c1 两只眼。 | b1 leaves a1 and c1: two eyes. | b1 laisse a1 et c1 : deux yeux. |
| e4.prompt | 黑棋有两只眼。点出所有白棋不能下的空点。 | Black has two eyes. Tap every empty point where White may not play. | Les Noirs ont deux yeux. Touchez tous les points vides où les Blancs ne peuvent pas jouer. |
| e4.hint | 白子下进去会没有气。 | A white stone there would have no liberty. | Une pierre blanche n'y aurait aucune liberté. |
| e4.explain | a1 和 c1 都没有气，又提不掉黑棋。 | a1 and c1 have no liberty and capture nothing. | a1 et c1 n'ont pas de liberté et ne capturent rien. |
| e5.prompt | 黑棋下了 a1。这块棋现在有几只眼？ | Black played a1. How many eyes does the group have now? | Les Noirs ont joué a1. Combien d'yeux a le groupe maintenant ? |
| e5.hint | b1 和 c1 挨在一起。 | b1 and c1 touch each other. | b1 et c1 se touchent. |
| e5.explain | b1、c1 相连，只算一只眼。 | b1 and c1 are connected: one eye only. | b1 et c1 sont reliés : un seul œil. |
| e6.prompt | 白棋下了 b1。黑先，还能做成两只眼吗？ | White played b1. Black to play: can Black still make two eyes? | Les Blancs ont joué b1. Aux Noirs : peuvent-ils encore faire deux yeux ? |
| e6.o1 / o2 | 能 / 不能 | Yes / No | Oui / Non |
| e6.w1 | 黑 a1 后白 c1 提掉全部；黑 c1 后白 a1 提掉全部。 | After Black a1, White c1 captures all; after Black c1, White a1 does. | Après a1 noir, c1 blanc capture tout ; après c1 noir, a1 blanc capture tout. |
| e6.explain | 白 b1 破了眼位，黑棋做不成两只眼。 | White b1 ruined the eye space: no second eye. | b1 blanc a ruiné l'espace des yeux : pas de deuxième œil. |

### 7.3 Unit 11 — 要点 The vital point (`content-src/u11-vital.src.json` + SGF → `u11-vital.json`)
Concept: in a row of three (or an L of three) the middle point decides; the same point lives for Black and kills for White.
Steps 3, exercises 6 (2 multi-move).
| # | id | Type | Position | Right answer |
|---|---|---|---|---|
| 1 | v1 `live-straight` | tap-point one | `S`; Black to play | b1 |
| 2 | v2 `kill-straight` | **sequence** (SGF) | `S`; White to play | W b1, (B a1), W c1 — captures 6 |
| 3 | v3 `live-bent` | tap-point one | `L`; Black to play | a1 |
| 4 | v4 `kill-bent-tap` | tap-point one | `L`; White to play | a1 |
| 5 | v5 `kill-bent` | **sequence** (SGF) | `Lm`; White to play | W e1, (B e2), W d1 — captures 6 |
| 6 | v6 `straight-four` | choice (2) | 5×5 B a2 b2 c2 d2 e2 e1; W a3 b3 c3 d3 e3 | "No, it lives" |
Steps: s1 (board `S`, triangle b1); s2 (board `S`, moves `W b1`, `B a1`, `W c1`); s3 (board `L`, triangle a1, moves `B a1`).
Source for the importer (`content-src/u11-vital.src.json`, other fields as in 7.1):
```json
{"id":"u11-vital","unit":11,"kind":"lesson","coordinates":true, "explain":[ "... s1 s2 s3 as above ..." ],
 "exercises":[
  {"id":"live-straight","type":"tap-point","size":5,"setup":{"B":["a2","b2","c2","d2","d1"],"W":["a3","b3","c3","d3","e3","e2","e1"]},"mode":"one","answer":{"points":["b1"]},"promptKey":"lesson.u11-vital.v1.prompt","hintKey":"lesson.u11-vital.v1.hint","hintPoints":["b1"],"explainKey":"lesson.u11-vital.v1.explain"},
  {"id":"kill-straight","type":"sequence","sgf":"u11-vital/kill-straight.sgf","goal":{"kind":"capture","target":"a2"},"whyKeys":{"a1":"lesson.u11-vital.v2.w1","c1":"lesson.u11-vital.v2.w1"},"promptKey":"lesson.u11-vital.v2.prompt","hintKey":"lesson.u11-vital.v1.hint","hintPoints":["b1"],"explainKey":"lesson.u11-vital.v2.explain"},
  {"id":"live-bent","type":"tap-point","size":5,"setup":{"B":["a3","b3","b2","c2","c1"],"W":["a4","b4","c4","c3","d3","d2","d1"]},"mode":"one","answer":{"points":["a1"]},"promptKey":"lesson.u11-vital.v1.prompt","hintKey":"lesson.u11-vital.v1.hint","hintPoints":["a1"],"explainKey":"lesson.u11-vital.v3.explain"},
  {"id":"kill-bent-tap","type":"tap-point","size":5,"setup":{"B":["a3","b3","b2","c2","c1"],"W":["a4","b4","c4","c3","d3","d2","d1"]},"mode":"one","answer":{"points":["a1"]},"promptKey":"lesson.u11-vital.v4.prompt","hintKey":"lesson.u11-vital.v1.hint","hintPoints":["a1"],"explainKey":"lesson.u11-vital.v4.explain"},
  {"id":"kill-bent","type":"sequence","sgf":"u11-vital/kill-bent.sgf","goal":{"kind":"capture","target":"e3"},"whyKeys":{"e2":"lesson.u11-vital.v5.w1","d1":"lesson.u11-vital.v5.w1"},"promptKey":"lesson.u11-vital.v2.prompt","hintKey":"lesson.u11-vital.v1.hint","hintPoints":["e1"],"explainKey":"lesson.u11-vital.v5.explain"},
  {"id":"straight-four","type":"choice","size":5,"setup":{"B":["a2","b2","c2","d2","e2","e1"],"W":["a3","b3","c3","d3","e3"]},"options":[{"textKey":"lesson.u11-vital.v6.o1","whyKey":"lesson.u11-vital.v6.w1"},{"textKey":"lesson.u11-vital.v6.o2","correct":true}],"promptKey":"lesson.u11-vital.v6.prompt","explainKey":"lesson.u11-vital.v6.explain"}]}
```
SGF files (hand-converted with the table of `M5-sgf-import` §4: `x` = column letter, `y` = letter of `5 − row` counted from `a`; QA's
importer test re-derives the vertices):
```
kill-straight.sgf  (;GM[1]FF[4]SZ[5]PL[W]AB[ad][bd][cd][dd][de]AW[ac][bc][cc][dc][ec][ed][ee](;W[be];B[ae];W[ce])(;W[ae];B[be])(;W[ce];B[be]))
kill-bent.sgf      (;GM[1]FF[4]SZ[5]PL[W]AB[ec][dc][dd][cd][ce]AW[eb][db][cb][cc][bc][bd][be](;W[ee];B[ed];W[de])(;W[ed];B[ee])(;W[de];B[ee]))
```
Hand check, `kill-straight` (`S`, White to play). Start: Black libs a1 b1 c1; White group libs a4–e4. **W b1**: b1 has libs a1 c1.
Black replies: *B a1* → Black libs c1 only; **W c1** (neighbours b1 W, d1 B, c2 B) takes Black's last liberty: legal, captures
a1 a2 b2 c2 d2 d1 (6). *B c1* → Black libs a1 only; W a1 captures 6 the same way. *Pass/elsewhere* → White a1 leaves {a1,b1} with the single
liberty c1; Black c1 captures them but is left with one two-point eye (a1 b1), which White reduces and then fills. Black never
gets two eyes (AC 11 proves it by search).
Wrong first moves: **W a1** (liberty b1) → **B b1** captures a1 (legal), Black has eyes a1 and c1 (two real eyes, alive).
**W c1** (liberty b1) → **B b1** captures c1: eyes a1 and c1. Other White moves (row 4/5) leave Black free to play b1.
Hand check, `kill-bent` (`Lm`, mirror of `L`): space e1 d1 e2; Black libs d1 e2 only. **W e1** libs d1 e2. *B e2* → Black libs d1
only, W e1 has d1: **W d1** captures 5 (legal: takes Black's last liberty). *B d1* → Black libs e2 only; W e2 captures. Wrong:
**W e2** (lib e1) → **B e1** captures e2 → eyes e2 and d1 (two eyes); **W d1** (lib e1) → **B e1** captures d1 → eyes d1, e2.
Hand check, `v6`: B libs a1 b1 c1 d1 only. W a1 → B b1 captures a1 → eyes a1, and c1-d1. W d1 → B c1 captures d1 → eyes d1, and
a1-b1. W b1 → B c1 (b1 has liberty a1 only); White has no legal move inside (a1: no liberty, Black keeps d1; d1: no liberty,
Black keeps a1); Black then captures with a1 → eyes b1 and d1. W c1 → B b1, symmetric. So Black always lives.

**Texts** (`lesson.u11-vital.`)
| Key | zh-CN | en | fr |
|---|---|---|---|
| title | 要点 | The vital point | Le point vital |
| s1 | 三个空点连成一排，中间的 b1 是要点：谁先下，谁就占优。 | In a row of three empty points the middle one (b1) is the vital point (要点 yàodiǎn): whoever plays it first wins. | Dans une rangée de trois points vides, le point du milieu (b1) est le point vital (要点 yàodiǎn) : qui le joue en premier gagne. |
| s2 | 白先下 b1：黑 a1 后，白 c1 提掉全部。黑棋做不成两只眼。 | If White plays b1 first, Black a1 is answered by White c1, which captures everything. No two eyes. | Si les Blancs jouent b1 en premier, a1 noir est suivi de c1 blanc qui capture tout. Pas de deux yeux. |
| s3 | 拐角的三个空点也一样：中间的 a1 是要点。黑 a1 做成 a2 和 b1 两只眼。 | A bent three works the same: the middle point a1 is vital. Black a1 makes two eyes, a2 and b1. | Un trois coudé fonctionne pareil : a1, au milieu, est vital. Les Noirs a1 font deux yeux, a2 et b1. |
| v1.prompt | 黑先活。点出要点。 | Black to play and live. Tap the vital point. | Aux Noirs : vivre. Touchez le point vital. |
| v1.hint | 下在三个空点的中间。 | Play in the middle of the three points. | Jouez au milieu des trois points. |
| v1.explain | b1 做成 a1 和 c1 两只眼。 | b1 makes two eyes: a1 and c1. | b1 fait deux yeux : a1 et c1. |
| v2.prompt | 白先杀黑棋。 | White to play and kill the black group. | Aux Blancs : tuer le groupe noir. |
| v2.w1 | 黑 b1 提掉你的子，做成两只眼，活了。 | Black b1 captures your stone and makes two eyes: alive. | b1 noir capture votre pierre et fait deux yeux : vivant. |
| v2.explain | b1 是要点：黑棋做不成两只眼。 | b1 is the vital point: Black cannot make two eyes. | b1 est le point vital : les Noirs ne peuvent pas faire deux yeux. |
| v3.explain | a1 做成 a2 和 b1 两只眼。 | a1 makes two eyes: a2 and b1. | a1 fait deux yeux : a2 et b1. |
| v4.prompt | 白先杀。点出要点。 | White to play and kill. Tap the vital point. | Aux Blancs : tuer. Touchez le point vital. |
| v4.explain | a1 是要点：黑棋活不了。 | a1 is the vital point: Black cannot live. | a1 est le point vital : les Noirs ne peuvent pas vivre. |
| v5.w1 | 黑 e1 提掉你的子，做成两只眼，活了。 | Black e1 captures your stone and makes two eyes: alive. | e1 noir capture votre pierre et fait deux yeux : vivant. |
| v5.explain | e1 是要点：黑棋活不了。 | e1 is the vital point: Black cannot live. | e1 est le point vital : les Noirs ne peuvent pas vivre. |
| v6.prompt | 白先。白棋能杀死这块黑棋吗？ | White to play. Can White kill this group? | Aux Blancs. Peuvent-ils tuer ce groupe ? |
| v6.o1 / o2 | 能 / 不能，黑棋活了 | Yes / No, it lives | Oui / Non, il vit |
| v6.w1 | 四个空点连成一排：无论白怎么下，黑棋都能做出两只眼。 | Four in a row: whatever White plays, Black can make two eyes. | Quatre d'affilée : quoi que jouent les Blancs, les Noirs font deux yeux. |
| v6.explain | 一排四个空点是活棋。 | Four empty points in a row are alive. | Quatre points vides en ligne : vivant. |

### 7.4 Unit 11 checkpoint — 综合复习（三）Review 3 (`content-src/u11-review.src.json` + SGF → `u11-review.json`)
Checkpoint, no steps, unlocked by 1★ on `u11-vital`, gates nothing. One exercise each for Units 4, 5, 7, two for Unit 10, one for Unit 11 counts, one kill.
| # | id | Type | Position | Right answer |
|---|---|---|---|---|
| 1 | r-find-eye | tap-point one | 5×5 B e2 d2 d1; W c2 c3 | e1 |
| 2 | r-false | choice (2) | 5×5 B b5 c4 d4 d5; W a5 a4 b4; triangle c5 | "False eye" |
| 3 | r-count | count | 5×5 B a4 b4 c4 d4 d5 b5; W a3 b3 c3 d3 e3 e4 e5; triangle a4 | 2 |
| 4 | r-capture | play-move capture | 5×5 B b3 d3 c4; W c3 | c2 |
| 5 | r-cannot | choice (2) | `S` + B b1; label A on a1 | "No, no liberty" |
| 6 | r-atari | play-move atari | 5×5 B b3 d3; W c3; Black to play | c2 or c4 |
| 7 | r-kill | **sequence** (SGF) | 5×5 B a4 b4 c4 d4 d5; W a3 b3 c3 d3 e3 e4 e5; White to play | W b5, (B a5), W c5 — captures 6 |
`r-kill.sgf` (`S` flipped vertically; space a5 b5 c5; target a4):
`(;GM[1]FF[4]SZ[5]PL[W]AB[ab][bb][cb][db][da]AW[ac][bc][cc][dc][ec][eb][ea](;W[ba];B[aa];W[ca])(;W[aa];B[ba])(;W[ca];B[ba]))`
Checked: r1 — e1 has neighbours d1 e2, both Black, and is the only enclosed point; the White group c2 c3 has libs c1 b2 b3 c4 d3. r2 — vertical mirror of
`u10-eyes` e3 (row r → 6−r). r3 — vertical mirror of `S` + b1: eyes a5 and c5. r4 — c3 has the single liberty c2. r5 — White a1 has no liberty
and Black keeps c1. r6 — c3 has libs c2 c4 only; either fills one and leaves one. r7 — vertical mirror of `kill-straight` (a1 → a5,
b1 → b5, c1 → c5); hand check as in 7.3. Texts and the JSON of r1–r6 follow the patterns of 7.1/7.2 (same sentences, new keys under
`lesson.u11-review.`); the developer takes the zh/en/fr strings from the table below.
| Key | zh-CN | en | fr |
|---|---|---|---|
| title | 综合复习（三） | Review 3 | Révision 3 |
| r1.prompt / hint / explain | 点出黑棋的眼。 / 找一个被黑子围住的空点。 / e1 被黑棋围住，是真眼。 | Tap the black group's eye. / Look for an empty point enclosed by black stones. / e1 is enclosed by Black: a real eye. | Touchez l'œil du groupe noir. / Cherchez un point vide entouré de pierres noires. / e1 est entouré par les Noirs : un vrai œil. |
| r2.prompt | 标记的 c5 是真眼还是假眼？ | Is the marked point c5 a real or a false eye? | Le point marqué c5 est-il un vrai ou un faux œil ? |
| r2.o1 / o2 / w1 | 真眼 / 假眼 / 白 c5 能提掉只剩一口气的 b5：假眼。 | Real eye / False eye / White c5 captures b5, which has one liberty: a false eye. | Vrai œil / Faux œil / Les Blancs c5 capturent b5, qui n'a qu'une liberté : un faux œil. |
| r2.explain | 假眼：白棋能在 c5 提子。 | A false eye: White can capture on c5. | Un faux œil : les Blancs peuvent capturer en c5. |
| r3.prompt / hint / explain | 标记的黑棋有几只眼？ / 数四周都是黑子的空点。 / a5 和 c5 是两只真眼。 | How many eyes does the marked black group have? / Count the empty points enclosed by Black. / a5 and c5 are two real eyes. | Combien d'yeux a le groupe noir marqué ? / Comptez les points vides entourés par les Noirs. / a5 et c5 sont deux vrais yeux. |
| r4.prompt / hint / explain | 提走白子。 / 它只剩一口气。 / c2 填掉最后一口气，白子被提。 | Capture the white stone. / It has only one liberty. / c2 fills the last liberty and captures. | Capturez la pierre blanche. / Il ne lui reste qu'une liberté. / c2 remplit la dernière liberté et capture. |
| r5.prompt | 白棋可以下在 A 吗？ | Can White play on A? | Les Blancs peuvent-ils jouer en A ? |
| r5.o1 / o2 / w1 | 可以 / 不可以，没有气 / A 没有气，也提不掉黑棋：不能下。 | Yes / No, it has no liberty / A has no liberty and captures nothing: White may not play there. | Oui / Non, aucune liberté / A n'a aucune liberté et ne capture rien : interdit aux Blancs. |
| r5.explain | 眼里白棋下不进去。 | White cannot play inside a real eye. | Les Blancs ne peuvent pas jouer dans un vrai œil. |
| r6.prompt / hint / explain | 让白子叫吃。 / 白子有两口气，填掉其中一口。 / 白子只剩一口气。 | Put the white stone in atari. / It has two liberties. Fill one of them. / The stone has one liberty left. | Mettez la pierre blanche en atari. / Elle a deux libertés. Remplissez-en une. / Il ne reste qu'une liberté. |
| r7.prompt / hint / explain | 白先杀黑棋。 / 下在三个空点的中间。 / b5 是要点：黑棋活不了。 | White to play and kill the black group. / Play in the middle of the three points. / b5 is the vital point: Black cannot live. | Aux Blancs : tuer le groupe noir. / Jouez au milieu des trois points. / b5 est le point vital : les Noirs ne peuvent pas vivre. |
| r7.w1 | 黑 b5 提掉你的子，做成两只眼，活了。 | Black b5 captures your stone and makes two eyes: alive. | b5 noir capture votre pierre et fait deux yeux : vivant. |
Source JSON of the review follows the schema of 7.1 (`"kind":"checkpoint"`, `"unit":11`, ids and answers per the table; r7 has
`"whyKeys":{"a5":"lesson.u11-review.r7.w1","c5":"lesson.u11-review.r7.w1"}`, `"hintPoints":["b5"]`, goal `capture` target `a4`).

## 8. Terms and pinyin (first use)
zh-CN never shows pinyin; en/fr show it in the first text using the term.
| Term | pinyin | First text | Meaning |
|---|---|---|---|
| 眼 | yǎn | `u10-eyes.s1` (and `unit.10.title`) | eye |
| 假眼 | jiǎyǎn | `u10-eyes.s2` | false eye |
| 真眼 | zhēnyǎn | `u10-eyes.s3` | real eye |
| 两眼 | liǎngyǎn | `u11-two-eyes.s2` | two eyes |
| 活 / 死 | huó / sǐ | `u11-two-eyes.s3` | alive / dead |
| 死活 | sǐhuó | `unit.11.title`, `u11-two-eyes.s3` | life and death |
| 要点 | yàodiǎn | `u11-vital.s1` | vital point |
| 地 | dì | `unit.12.title` only | territory (planned) |

## 9. Framework gaps and developer notes
1. **Runner** (this item): `SequenceRunner` + pure `judgeSequence`; `ExerciseView` dispatch; `getSolution` for `sequence`
   (returns the learner's first move; `hintPoints` rule unchanged); `exerciseGame` already applies `prelude`.
2. **Authoring rule, no machine check:** one correct move per ply. Ladders break it (checked: in `M5-ko-forbidden-ladders` §13's
   5×5 warm-up, after B b3 c2 d2 c4 / W c3 d3, Black d4 W e3, B e4 W e2, B e1 also captures, so d4 is as good as e3). Deferred.
3. **Tap-point wrong feedback is generic** for `answer.points` exercises (v1, v3, v4, e3); acceptable because the hint and the
   explanation follow after three tries. A per-point reason would need a schema change (out of scope).
4. **Explanation `moves` with a tenuki** (`u11-two-eyes` s1 uses B e5) is the only way to keep colours alternating in a step;
   if the explanation player already accepts two moves of the same colour the tenuki can be dropped.
5. Reveal replay needs a "last move" mark that follows the replay; reduced motion shows the final position.
6. Tests that assume "only Units 1–9 exist" or "Unit 10 is planned" are updated (AC 7).

## 10. Correctness check (done by the designer, by hand)
I recomputed, point by point and orthogonal neighbours only: every starting position has no group without a liberty; every
"illegal for White" claim (no liberty and no capture); every capture claim (the stated stone has exactly one liberty); eye
counts (two adjacent empty points = one eye); and, for each kill/live claim, **all** legal first moves inside the eye space and
**all** replies (including pass). Findings: (a) straight three and bent three (and the 5×5 variants with a solid White outside)
die to the middle point and live if Black plays it; the two outer points fail; (b) four in a row lives against every first move;
(c) the false-eye positions are false because the stone next to the diagonal enemy stone has one liberty, not because of a
general rule I could not prove for the centre, so the centre is not taught; (d) `u11-two-eyes` e5 (Black a1 leaves one
two-point eye) is dead after White's correct play, so "1 eye" is consistent with life and death; (e) ladders are *not*
single-line problems (§9.2). Not proved by hand and therefore required of QA with the real engine: AC 9–13, and that the three
SGF strings convert to the vertex lists of the tables (a mistake in an SGF letter changes the position; the position, not the
test, would then be wrong). If any of AC 9–13 fails, the position is wrong, not the test.

## 11. Out of scope
Ladders and nets as sequence problems (needs a search-judged runner); problems with several correct branches or with deeper
variations; centre eyes and the four-diagonal rule; seki; ko inside life and death; bigger eye spaces (five in a row, bulky
five, rabbity six) and the corner-wall variations; "tesuji" naming; hints that point at the whole line; auto-generated
problems; timers and rating; progress of a half-finished problem when the app is closed; an AI tutor (M7); 9×9 problems;
settings for the opponent's reply speed (M6); any new colour, sound or art.

## 12. Open decisions for the product owner (with my default)
1. **Runner mistakes at a later move: undo only that move, or restart the problem?** Default: **undo only the mistaken move**
   (the learner keeps progress); a wrong first move or a refuted first move restarts.
2. **Ladder play-along (`M5-ko-forbidden-ladders` §13): defer, or build a search-judged runner now?** Default: **defer** (one
   correct line per ply is a property of the format; a ladder has two). A follow-up item "sequence v2: bounded-search judge"
   would also unlock bigger tsumego, ladders and nets.
3. **Lesson split.** Default: **two lessons in Unit 11 plus a checkpoint** (`u11-two-eyes`, `u11-vital`, `u11-review`). Alternative:
   one Unit 11 lesson of 12 exercises (too long for 3–5 minutes).
4. **Only three multi-move problems in shipped content.** Default: **yes** — enough to prove the runner and the contrast "same
   shape, other colour"; more problems need hand proofs. Alternative: add two more 3-ply kill problems (5×5, a second shape) before
   merging.
5. **Reveal after 3 mistakes: replay the line stone by stone (800 ms), or show the final position?** Default: **replay**; the
   final position under reduced motion.
6. **Wrong-move feedback wording at later plies** is neutral ("That is not the move for this problem") because the engine cannot
   judge; default: **neutral text**, plus the liberty fact when the goal is a capture and the target still has ≥ 2 liberties.
7. **Centre eyes** (the 4-diagonal rule) not taught; default: **not taught** (edge and corner eyes only).
8. **Terms:** 真眼/假眼/两眼/死活/要点 and fr "vrai œil", "faux œil", "point vital". Default: **as written**. Please also confirm
   `unit.12.title` "Territory · 地 dì" as the planned unit.
10. **One layout rule for every board screen (PO feedback).** Option A: instructions on top, board in the middle, feedback / options /
    actions at the bottom. Option B: everything below the board. Default: **A** — it already holds for all exercises, only the
    explanation player (text moves above the board) and Capture Go (goal card stays on top) change, and both fit 360×740 (§5.6).
    B would move the prompt of every exercise under the board and push the board to the top, where fingers cover feedback.
11. **Lighter bamboo (PO feedback).** Default: **the §5.7 values** (grain about 1.1:1, white-stone edge darkened to #6B675C for
    3:1). Alternative: drop the strips and keep only a flat base with a faint node line (even calmer, loses the bamboo look).
9. **Mockup:** `docs/specs/M5-life-death-mockup.html` shows the four states plus frames E (explanation) and F (Capture Go 9×9); default: the move counter is text + small rings (no
   new colour). Alternative: a thin 4 px progress bar under the prompt.

## 12a. PO decisions (2026-10-20)
All defaults approved: 1 undo only the mistaken move · 2 ladder play-along deferred · 3 two Unit 11 lessons + checkpoint ·
4 three multi-move problems · 5 replay at 800 ms (final position under reduced motion) · 6 neutral text + liberty fact ·
7 centre eyes not taught · 8 terms as written, Unit 12 "Territory · 地 dì" · 9 text + small rings · 10 layout A
(instructions top, board middle, feedback/actions bottom) · 11 the §5.7 bamboo values.

## 12b. Developer engine check (2026-10-20)
Every claim of §7/§10 was re-proved with the real engine (`__tests__/m5-life-death.test.ts`, search helper
`src/lessons/__fixtures__/lifeDeath.ts`: exhaustive minimax over all legal moves and a pass). All 25 positions and the three
SGF strings are correct as written; no problem had to change. Corrections to the spec, not to the content:
1. **AC 11 bound: 5 plies, not 4.** After White's vital move and a Black pass (or a move elsewhere), White needs W, B, W, B, W
   (make the two-point area, let Black capture, fill it). The scripted reply still loses at once (1 ply). Proved for all three.
2. **AC 12 bound: 7 plies, not 6.** From the start the kill takes 7 plies (the line move, a Black pass, then the 5 above). With
   that bound, only the line's first move kills; the other two inner points are refuted by the middle point (proved).
3. **§5.7 `board.bambooNode` is #DDC690, not #D9C288.** #D9C288 is 1.24:1 against the light strip, above AC 47's 1.2:1; #DDC690
   is 1.19:1 / 1.07:1 against the strips and 1.14:1 against the base. All other §5.7 values are as written and pass AC 46–48
   (white-stone edge 3.83:1 on the board, 5.18:1 on the white fill; rings 3.49–4.0:1).
4. **zh-CN `lesson.u11-two-eyes.s2`** drops the "（两眼 liǎngyǎn）" of the §7.2 table: AC 34 forbids pinyin in zh-CN.
5. **SGF paths in the source** are relative to the lesson's SGF folder (`"sgf": "kill-straight.sgf"`, file in
   `content-src/u11-vital/`), as the importer of M5 item 2 requires; §7.3 wrote `u11-vital/kill-straight.sgf`.
6. **Several lessons per unit** (§3, decision 3) needed a framework change: `UnitEntry.laterLessons`; a later lesson of a unit
   opens at 1★ on the lesson before it, the checkpoint and the next unit at 1★ on the unit's last lesson; the map shows it as its
   own row ("Unit 11 · The vital point"); `validateCatalog` now allows several lessons (still one checkpoint per unit).
7. **Hint button of the sequence runner** is in the bottom row next to *Try again* / *Undo* (AC 30 and the mockup), not in the
   top bar (§5.6 table); the top bar keeps an empty slot.
8. **Capture Go goal card** is replaced by the end card once the game is over (the board keeps its 328 px at 360×740).
9. **Explanation text card: 120 px, not 96 px (AC 40).** 96 px holds 3 lines of body text (24 px + 12 px padding); with 96 px the
   web check found 6 en/fr steps of Units 10–11 cut after line 3 with no visible scroll cue. 120 px (4 lines, the M3 height) shows
   every step in full; the card is still above the board and the same in every step; 360×740 still fits (≈ 640 px).
