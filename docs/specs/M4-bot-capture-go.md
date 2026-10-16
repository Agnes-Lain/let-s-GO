# M4 item 2 — Beginner bot v1 + Capture Go 吃子棋 (Unit 6)

Second and last M4 roadmap item. Builds on `docs/specs/M3-lesson-framework.md` and
`docs/specs/M4-content-units-1-5.md` (same tone, same star rules, same map). Visual mockup for approval:
`docs/specs/M4-bot-mockup.html`.
Status: **draft for product-owner approval** (no code written). Open questions with my recommended
defaults are in §14.

## 0. In plain words (for the product owner)
- Unit 6 is the first time the learner plays **against a computer opponent**. The game is **Capture Go
  (吃子棋 chīzǐqí)**: no territory, no counting, whoever captures N stones first wins. It is the "can I use
  what I learned in Units 1–5 for real?" moment.
- Unit 6 has two map nodes, like Unit 5: a **lesson** (3 short explanation slides + 3 games on 5×5) and a
  **checkpoint** (2 games on 7×7, one of them playing White). Five games, about 4 + 5 minutes.
- The opponent is a small, honest **rule-of-thumb bot** (capture if it can, save its own stones, put you in
  atari, don't walk into atari, otherwise play near your stones). It also **makes mistakes on purpose** at a
  rate written in the lesson file, so a beginner wins most of the time but not for free. Later (M6) the same
  bot gets stronger levels 2 and 3 without changing the lessons.
- A game that is lost can be retried at once; the bot gets a little gentler after each loss; after three
  losses the learner may skip the game (1 star is still reachable). Every defeat explains **why**, using
  facts from the rules engine ("your stone on c3 had one liberty, c4, and White filled it").
- Everything works offline. The bot lives in `src/bot` (pure TypeScript, seeded randomness, so tests are
  repeatable). "Thinking" is a short pause drawn by the screen, never inside the bot.
- One small framework change: a new exercise type `play-bot` (data only, "lessons are data") and a relaxed
  exercise-count rule for sets made only of games (§7.3).
- I could not run code while writing this spec (no shell). Every diagram was checked by hand (§12); the
  win-rate targets in §6.5 are my estimates that the developer must measure and tune (they are data in the
  lesson JSON, not code).

## 1. Goal
A beginner who finishes Unit 6 can play and win a complete short game of Capture Go against a computer
opponent on 5×5 and 7×7, as Black or White, by capturing first, saving stones in atari and avoiding
self-atari.

## 2. User stories
- As a beginner, I want my first game to be almost impossible to lose, so that I learn the screen (my turn,
  the counter, the bot's reply) without pressure.
- As a beginner, I want to see at a glance **whose turn it is** and **how many stones each side still needs**,
  so that I never wonder what to do next.
- As a beginner, I want the bot to take a moment before answering, so that the game feels like a real
  opponent and I can follow what it played.
- As a beginner, I want a gentle warning when one of my groups is in atari, so that I learn to look at my
  own stones too.
- As a beginner who just lost, I want one clear sentence about **why** and a one-tap retry, so that I learn
  instead of feeling punished.
- As a beginner who is stuck, I want a hint that points at a real good move, so that I can keep going.
- As a beginner, I want the bot to play differently every time I retry, so that I cannot just memorise it,
  and slightly easier after I lost, so that I am not stuck forever.
- As a beginner who cannot win a game after several tries, I want to skip it and still progress.
- As a French- or English-speaking learner, I want the Chinese word 吃子棋 chīzǐqí explained once, so that I
  recognise it later; as a Chinese reader I want clean hanzi without pinyin (M4 decision 2).
- As a screen-reader user, I want turn changes, captures and the result announced.
- As the product owner, I want the bot to be a separate, deterministic, tested module that the 9×9 levels in
  M6 extend, so that nothing is thrown away.
- As the product owner, I want game difficulty tuned in lesson JSON, not in code.

## 3. Scope and curriculum mapping
| Node | Lesson id | kind | Steps | Games | Board | Source (`docs/CURRICULUM.md`) |
|---|---|---|---|---|---|---|
| Unit 6 吃子棋 | `u06-capture-go` | lesson | 3 | 3 | 5×5 | "Mini-games vs bot on 5×5" |
| Unit 6 checkpoint | `u06-checkpoint` | checkpoint | 0 | 2 | 7×7 | "Mini-games vs bot on 7×7" |

Games (full data in §8):
| # | id | Size | Start | You play | First to | Bot `blunder` (initial) |
|---|---|---|---|---|---|---|
| 1 | `first-capture` | 5 | B b3 c2 d3 / W c3 (White in atari) | Black, first | 1 | 0.7 |
| 2 | `crosscut-first` | 5 | cross-cut c3 d2 / d3 c2 | Black, first | 1 | 0.5 |
| 3 | `crosscut-two` | 5 | cross-cut b3 c2 / c3 b2 | Black, first | 2 | 0.4 |
| 4 | `seven-two` | 7 | cross-cut d4 e3 / e4 d3 | Black, first | 2 | 0.3 |
| 5 | `seven-white` | 7 | cross-cut c4 d3 / d4 c3 | **White**, bot opens | 3 | 0.2 |

Deviations from `CURRICULUM.md`: Unit 6 is split into a lesson and a checkpoint (so each sitting is
3–5 minutes) and one game has the learner play White. The bot's levels 1–3 for 9×9 stay in M6.

## 4. Acceptance criteria
Coordinates: letter = column (a–e on 5×5, a–g on 7×7, no "i"), number = row, row 1 at the bottom.
ASCII diagrams list row 5 (or 7) at the top, `X` Black, `O` White, `.` empty. "Bot tests" live in
`src/bot/*.test.ts`; "reducer tests" in `src/exercises/botGame.test.ts`; "content test" is
`src/lessons/content.test.ts`.

### A. Bot module `src/bot` (pure TS)
1. Given `src/bot`, then it imports only `@/engine` and itself (no React, RN, Expo, `Date`, `Math.random`,
   timers or I/O); the existing engine purity test pattern is extended to `src/bot` and passes.
2. Given the API in §6.1, then `chooseMove(state, { level: 1, blunder, rng })` returns `{ move, reason }`
   where `move` is always a legal `Move` for `state.toPlay` (a `play` that `checkMove` accepts, or a `pass`
   only when `legalMoves(state)` is empty) and never mutates `state`.
3. Given the same `state`, `blunder` and a fresh `createRng(seed)`, when `chooseMove` is called 100 times,
   then the result is identical every time; and `createRng(1)` and `createRng(2)` give different sequences.
4. Given `chooseMove`, then it consumes exactly **3** values from `rng` per call (documented, so that a
   change in the number of draws is a conscious break of recorded test games).
5. **Capture first.** Given White to move, `blunder = 0`:
   ```
        a b c d e
     5  . . . . .
     4  . . O . .
     3  . O X O .
     2  . . . . .
     1  . . . . .
   ```
   then the move is `c2` with reason `capture` (Black c3 has one liberty, c2).
6. **Largest capture.** Given White to move, `blunder = 0`:
   ```
        a b c d e
     5  . . . O .
     4  . . O X O
     3  . . O X .
     2  O . . O .
     1  X . . . .
   ```
   then the move is `e3` (captures the two stones d3 d4), not `b1` (captures one stone a1).
7. **Save own stone.** Given White to move, `blunder = 0`, no capture available:
   ```
        a b c d e
     5  . . . . .
     4  . . X . .
     3  . X O X .
     2  . . . . .
     1  . . . . .
   ```
   then the move is `c2` with reason `save`; the resulting White group has 3 liberties (b2 d2 c1).
8. **Atari the opponent.** Given White to move, `blunder = 0`, only Black a1 and White c3 on a 5×5 board,
   then the move is `a2` or `b1` (reason `atari`); never any other point; the played stone has ≥ 2
   liberties.
9. **No self-atari when avoidable.** Given 200 positions (seeds 1–200: a 5×5 or 7×7 board after 6 random
   legal moves), `blunder = 0`, when the chosen reason is `atari`, `pressure` or `random`, then
   `facts.selfAtari` is false unless every legal move is a self-atari.
10. **Never illegal.** Given the same 200 positions and `blunder` in {0, 0.5, 1}, then the chosen move is
    legal (never suicide, never the ko point, never an occupied point).
11. **Blunder.** Given the position of AC 7 and `blunder = 1`, over seeds 1–200 then the bot plays `c2` in
    fewer than 30% of the games (it misses the save most of the time) but still plays a legal move every
    time; with `blunder = 0` it plays `c2` in 200 of 200.
12. **Blunder never skips a legal-only rule.** Given AC 5 and `blunder = 0.5`, over seeds 1–200, then the
    bot captures in at least 70% (it misses a capture with probability `blunder / 2` = 25%, ±10 points).
13. **Pass.** Given `legalMoves` returns `[]` (tested with a mocked engine, because such a real position is
    practically unreachable), then the move is `{ type: 'pass' }` with reason `pass`.
14. **Ko.** Given the ko position below after Black plays `c3` (captures b3, `koPoint` = b3), White to move,
    then `chooseMove` never returns b3 (over seeds 1–50, `blunder` 0 and 1).
    ```
        a b c d
     4  . X O .
     3  X O . O
     2  . X O .
    ```
15. **Levels.** Given `level: 2` or `3` (M6), then v1 behaves as level 1 (documented fallback, no throw).
16. **Speed.** Given a 9×9 board with 20 stones, then `chooseMove` returns in under 50 ms on CI hardware.

### B. Game rules in the exercise layer (`src/exercises/botGame.ts`, pure reducer)
17. Given a `play-bot` exercise, when a game starts, then the engine state is
    `createGame(size, { setup, toPlay: first })` with `first` = `exercise.first ?? 'B'`, captures 0:0.
18. Given it is the learner's turn, when the learner plays a legal point, then the move is applied, the turn
    passes to the bot, and `status` becomes `'bot-thinking'` unless the game is over.
19. Given `win = { kind: 'captureN', n }`, when after any move `captures[learner] >= n`, then `status` is
    `'won'`; when `captures[bot] >= n`, then `'lost'`; the check runs after every move, so an overshoot (a
    2-stone capture when 1 more was needed) still counts.
20. Given game 1 `first-capture` (B b3 c2 d3 / W c3), when the learner plays `c4`, then White c3 is
    captured, `captures.B = 1`, status `'won'`, and **the bot does not move**.
21. Given the game reaches `maxMoves` plies (default `2 × size × size`) or both sides passed
    (`state.isOver`), then the winner is the side with more captures; equal captures → `'draw'`.
22. Given the learner has no legal move on their turn, then the reducer auto-passes for them (a `pass` move
    is applied) and sets the note `game.fb.noMoves`; given the bot also has no legal move, `isOver` becomes
    true and AC 21 applies.
23. Given a learner tap on an illegal point, then the board does not change, the turn does not change, no
    attempt is counted, and the note is `game.fb.illegal.suicide` (engine reason `suicide`),
    `game.fb.illegal.ko` (`ko`) or `game.fb.illegal.occupied` (`occupied`).
24. **Suicide that captures is legal.** Given learner Black to play, the position
    ```
        a b c d e
     3  . . . . .
     2  X O . . .
     1  O . O . .
    ```
    when the learner plays `b1`, then the move is accepted, White a1 is captured and `captures.B = 1`
    (b1 had no liberty before the capture, and has a1 after it).
25. **Suicide that captures nothing is rejected.** Given learner Black to play on
    ```
        a b c d e
     3  . . X . .
     2  O . . X .
     1  . O . . .
    ```
    when the learner taps `a1`, then the move is rejected with `game.fb.illegal.suicide`.
26. **Ko.** Given the ko position of AC 14 with the learner playing **White**, Black having just played
    `c3`, when the learner taps `b3`, then it is rejected with `game.fb.illegal.ko`, and after the learner
    plays elsewhere and the bot answers, `b3` is allowed again.
27. Given a game is won, then the reducer exposes `outcome` for the game: `clean` if no earlier loss/draw in
    this exercise and no hint was used; `solved` if won after a loss/draw or with a hint; `revealed` if the
    learner chose *Skip* after the 3rd loss.
28. Given a lost or drawn game, then `attempt` increases by 1, the bot `blunder` for the next try is
    `min(0.9, base + 0.15 × losses)`, and a new seed is used (so the next game differs).
29. Given 3 losses/draws in one exercise, then the lose card offers *Skip this game* in addition to *Try
    again*; tapping *Skip* gives `revealed` and moves on.
30. Given the game state, then a function `lossReason(state)` returns engine facts for the lose card: the
    learner's captured group's last liberty (`at`, `lib`) taken from the final `MoveFacts.captured` and the
    group's size, so the text is generated from facts, never from the board by guesswork.

### C. Schema and validator (`src/lessons`)
31. Given `schema.ts`, then `ExerciseType` and `EXERCISE_TYPES` include `'play-bot'` and the type is
    `PlayBotExercise` of §7.1; all existing lesson files still validate unchanged.
32. Given a play-bot exercise, then these are checked by `validateLesson` with the codes of §7.2:
    `BOT_NO_WIN`, `BOT_BAD_N`, `BOT_BAD_LEVEL`, `BOT_BAD_BLUNDER`, `BOT_BAD_PLAYER`, `BOT_HINTPOINTS`,
    `BOT_NO_MOVE`, `BOT_START_LOST`, `BOT_UNWINNABLE`, `BOT_RUNAWAY`; each has a failing fixture test.
33. Given a lesson whose exercises are **all** `play-bot`, then 2–6 exercises are valid; any other lesson
    keeps 5–10 (existing test unchanged); a lesson mixing games and other types needs 5–10.
34. Given `u06-capture-go` and `u06-checkpoint`, then both pass `validateLesson` with `hasText` over zh-CN,
    en, fr and `validateCatalog` is `{ ok: true }` with a lesson and a checkpoint for Unit 6.
35. Given the validator's playout check (§7.2), then for every play-bot exercise the reference learner wins
    at least 1 of 10 seeded playouts and no playout exceeds `maxMoves` or throws.
36. Given the validator, then it takes under 300 ms per play-bot exercise (10 playouts, 9×9 worst case).

### D. Content
37. Given the repo after this item, then `src/lessons/content/` additionally contains `u06-capture-go.json`
    and `u06-checkpoint.json`, both in `LESSON_FILES`.
38. Then step/exercise counts are 3 steps + 3 games and 0 steps + 2 games; ids are those of §8.
39. Then every text key used (titleKey, textKey, promptKey, hintKey, explainKey) exists in zh-CN, en and fr,
    zh-CN ≤ 70 characters, en/fr ≤ 160 (steps ≤ 135 en/fr), and all `game.*` keys of §11 exist in all three
    languages (i18n parity test passes).
40. Then no zh-CN lesson text contains pinyin; en/fr `u06-capture-go.s1` contains `吃子棋 chīzǐqí`.
41. Then each game's hand-verified start position of §8 holds in the engine: no group without liberties;
    for the four cross-cuts each of the four stones has exactly 2 liberties; for G1 White c3 has exactly 1
    liberty (`c4`) and the only capturing move for Black is `c4`.
42. Then every game has `hintKey` and `explainKey`; none has `hintPoints` (the hint point is computed, §5.5).

### E. Runner UI (web check at 360×740 in zh-CN, en, fr; `PlayBotRunner.tsx`)
43. Given a game starts with the learner first, then the turn pill reads *Your turn* (`game.turn.you`) and
    the board accepts input; given the bot first (G5), the pill reads *Bot is thinking…* and the bot's
    first stone appears after `BOT_DELAY_MS`.
44. Given the learner commits a move (touch-up), then the stone is on the board immediately, the pill
    switches to *Bot is thinking…* with three animated dots, input is ignored, and the bot's stone appears
    **no earlier than `BOT_DELAY_MS` = 700 ms** later (300 ms when reduce-motion is on), tested with fake
    timers.
45. Given the bot's move is computed, then it is computed at the moment the learner moves (synchronously) and
    applied by the screen after the delay; `src/bot` contains no delay; leaving the screen during the delay
    cancels the timer (no state update after unmount, no warning).
46. Given the learner's move wins, then there is no bot delay and no bot move; the capture fade plays and the
    win card appears 600 ms later.
47. Given the bot's move captures the learner's last needed stones, then the capture fade plays, the stones
    are shown as the dashed "gone" stones, and the lose card appears 600 ms later.
48. Given the score area, then it shows two halves *You · Black* and *Bot · White* (colours swap in G5); each
    has `n` slots filled by captured stones (white stones captured by Black are drawn white); the active
    side's half has the accent border; the a11y label reads "You have captured 1 of 2 stones".
49. Given the bot just played, then its stone has the small last-move dot; given a group of the learner's
    now has exactly one liberty, then the feedback card shows `game.fb.yourAtari` with `{at}` = a stone of the
    group and `{lib}` its liberty; given the learner's move put a bot group in atari, the card shows
    `game.fb.botAtari`. Both messages come from `MoveFacts` / `isAtari`, not from text parsing.
50. Given the learner captures, the card shows `game.fb.captured` ({n}); given the bot captures a group but
    the game continues, `game.fb.botCaptured`.
51. Given *Hint* is pressed, then (a) the card shows the lesson's `hintKey` text, (b) the best learner move
    by the bot's own rules (AC 5–8 run for the learner's colour with `blunder = 0`) pulses amber with the
    engine sentence `game.hint.capture` / `game.hint.save` / `game.hint.atari` / none for `pressure`; the
    hint is available only on the learner's turn and costs `clean`.
52. Given a win, then the win card shows `game.win.title`, `game.win.body` ({n}), the lesson's `explainKey`
    sentence and one primary button: *Next game* (or *Finish* on the last game).
53. Given a loss, then the lose card shows `game.lose.title`, `game.lose.body` and the fact sentence
    `game.lose.reason` (AC 30), the captured stones faded, and the primary button *Try again*; a draw shows
    `game.draw.title/body`. After the 3rd loss, a secondary button *Skip this game* is added.
54. Given *Try again*, then a fresh game of the same exercise starts (AC 28), with the pill and board reset
    and the step bar unchanged.
55. Given the ✕ button during a game, then the M3 leave sheet opens ("Leave? Progress in this set is lost");
    the game is not saved.
56. Given G1, when the learner taps `c4` (touch-down preview, touch-up commit) then White c3 fades, the
    counter shows 1 / 1, and the win card appears. Given G1 and the learner plays `a1` instead, then the bot
    answers (it saves with c4 unless it blunders, `blunder` 0.7) and the game continues.
57. Given the board in a game, then the M2 preview/commit rules apply and tap targets are ≥ 44 px (5×5 at
    328 px: 65 px per point; 7×7: 46 px per point).

### F. Map, stars and flow
58. Given production mode, then `getUnits()` lists Units 1–6 all with `lesson !== null`, Unit 6 with a
    `checkpoint`, and `PLANNED_UNITS` is `[]` (the footer "More units coming soon" stays).
59. Given 1★ on Unit 5, then Unit 6 is `available`; given 0★, it stays `locked`; the Unit 6 checkpoint is
    `available` after 1★ on Unit 6 and never gates anything. *Continue* walks 1…5, review, 6, checkpoint.
60. Given the lesson's three games, `computeStars` (unchanged `STAR_RULES`): 3 clean → 3★; 2 clean + 1
    solved → 2★; 3 solved → 2★; 2 solved + 1 revealed → 1★; 1 solved + 2 revealed → 0★.
    Given the checkpoint's two games: 2 clean → 3★; 1 clean + 1 solved → 2★; 1 clean + 1 revealed → 1★;
    2 revealed → 0★.
61. Given the result screen of `u05-review` with ≥ 1★, then the primary button is *Next lesson* →
    `u06-capture-go`; of `u06-capture-go` → `u06-checkpoint`; of `u06-checkpoint` → *Back to map*.
    (Supersedes M4 item 1 AC 18 for `u05-review`.)
62. Given a lesson made only of games, then the result subtitle uses `result.gamesFirstTry` ("2 of 3 games
    won on the first try") instead of the exercise wording.
63. Given Unit 6 on the map in fr, then "Jeu de capture · 吃子棋 chīzǐqí" shows in full (up to two lines), no
    horizontal scroll, no "soon" badge.

### G. Bot quality (tuning tests, deterministic seeds; `src/bot/tuning.test.ts`)
64. Given the five games of §8 and seeds 1–200 each, a *reference learner* **Sensible** (= bot level 1,
    `blunder = 0`, for the learner's colour) and **Noob** (captures when it can, otherwise a uniformly
    random legal move) play the real start positions with the lesson's `blunder` values. The measured win
    rates must lie in the ranges of §6.5. If a range fails, the developer changes `blunder` in the JSON
    (not the code) and records the final numbers in the PR; the PO approves them.
65. Given the same runs, then no game exceeds `maxMoves`, none throws, and the average game length is within
    ±30% of the estimates in §6.5.

### H. Accessibility and layout (web check)
66. Given a screen reader, when the bot has moved, then "Bot played d3" (`game.a11y.botMoved`) is
    announced; captures announce "N stones captured" ; the result card receives focus order after the
    board; the *Hint*, *Try again*, *Next game* buttons are labelled.
67. Given reduce-motion, then the dots do not animate, the capture fade is a 150 ms cross-fade and the delay
    is 300 ms.
68. Given 360×740 in zh-CN, en and fr, then the game screen fits without scrolling in every state of the
    mockup (your turn, thinking, illegal note, win card, lose card, lose card with *Skip*), nothing is cut
    off, board is 328 px wide on 5×5 and 7×7.
69. Given colour use, then state is never conveyed by colour alone (turn pill has a text and a stone icon;
    the capture slots have numbers in the a11y label).

## 5. Screen flow and UI
Mockup: `docs/specs/M4-bot-mockup.html`. Everything not named here is the approved M3 design.

### 5.1 Flow
```
Map: Unit 6 (available after 1★ Unit 5) -> explain 3 steps -> Game 1 -> Game 2 -> Game 3 -> Result
                                                           (each game: play -> win card -> next)
                                                                     -> Next lesson: checkpoint
Checkpoint: Game 4 -> Game 5 (you play White) -> Result -> Back to map
Lose: lose card -> Try again (same game, easier bot) ... after 3rd loss also Skip this game
```
The step bar at the top has one segment per game (3 and 2).

### 5.2 Game screen (360×740) — states
```
+----------------------------------+
| ✕   [==][  ][  ]          [Hint] |  topbar 52: leave, game segments, hint
|  +-----------+ +-----------+     |
|  | ● You     | | ○ Bot     |     |  score 56: stone icon, name, n slots
|  |  ○ ○      | |  ● ○      |     |  slots filled by captured stones
|  +-----------+ +-----------+     |
|        ( ● Your turn )           |  turn pill 36
|   +-----------------------+      |
|   |       board 328       |      |  5x5 / 7x7, no coordinates
|   +-----------------------+      |
|  +-------------------------+     |
|  | feedback card (72)      |     |  reserved; empty = transparent
|  +-------------------------+     |
|        Restart (text)            |  44 px, left empty on win/lose
+----------------------------------+
```
States:
- **Your turn**: pill "● Your turn"; own half of the score has the accent border; board active.
- **Bot thinking** (700 ms): pill "○ Bot is thinking …" with three dots; the learner's last stone shows the
  last-move dot; board ignores touches (no preview). No spinner, no blur.
- **Atari note** (feedback card, amber dot): "Atari! Your stones at c3 have one liberty left: c4."
- **Illegal move**: dashed rouge ring on the tapped point, card with rouge dot and the reason, no sound.
- **Hint**: amber pulsing ring on the suggested point + two lines (lesson tip, engine fact).
- **Win card** replaces the feedback card and the turn pill (see mockup): small green dot, "You win!",
  one-line fact, primary button *Next game*. The final captured stones are shown dashed.
- **Lose card**: rouge dot, "Not this time", the fact sentence, primary *Try again*; after the 3rd loss
  also a text button *Skip this game*. Draw: grey dot, "Nobody reached {{n}} captures." + *Try again*.
- No loading state (the bot answers instantly); no empty state.

### 5.3 Timing (constants in one file `src/exercises/botGame.ts`)
`BOT_DELAY_MS = 700`, `BOT_DELAY_REDUCED_MS = 300`, `END_BEAT_MS = 600` (after the final capture, before
the card). Sounds: existing stone "tock" for both sides (the bot's slightly later); captures use the M2/M3
capture fade; **no new audio assets** in v1 (win/lose are silent and calm). Haptics: none.

### 5.4 Reading help (Beginner support, all from the engine)
After every bot move: if any learner group is in atari → `game.fb.yourAtari`; else if the bot's move
captured → `game.fb.botCaptured`; else the card is empty. After every learner move: capture →
`game.fb.captured`; atari on a bot group → `game.fb.botAtari`; the learner's own stone left in atari
(`selfAtari`) → `fb.pm.selfAtari` (existing M3 key) appended. Only the most important line is shown (order:
capture, own atari, bot atari).

### 5.5 Hint
`suggest(state, learnerColor)` = `chooseMove(state, { level: 1, blunder: 0, rng: createRng(0) })` for the
learner's colour (same rules as AC 5–8). Reason → sentence: `capture` → `game.hint.capture`, `save` →
`game.hint.save`, `atari` → `game.hint.atari`, `pressure`/`random` → only the lesson tip. The first press
shows the tip and the pulse; there is no further level.

## 6. Bot v1 design and game design notes

### 6.1 API (`src/bot/index.ts`, plus `rng.ts`, `heuristic.ts`)
```ts
export type Rng = () => number;                    // [0, 1)
export function createRng(seed: number): Rng;      // mulberry32; same seed => same sequence
export type BotLevel = 1 | 2 | 3;                  // 2 and 3 arrive in M6
export type BotReason = 'capture' | 'save' | 'atari' | 'pressure' | 'random' | 'blunder' | 'pass';
export interface BotOptions { level: BotLevel; rng: Rng; blunder?: number /* 0..1, default 0 */ }
export interface BotChoice { move: Move; reason: BotReason }
export function chooseMove(state: GameState, opts: BotOptions): BotChoice;
```
`chooseMove` dispatches on `level` through a small table (`strategies[level]`); levels 2 and 3 are
unregistered in v1 and fall back to level 1. M6 adds `goal: 'capture' | 'score'` and the 9×9 strategies
behind the same signature. Randomness comes only from the injected `rng`; the screen creates the seed
(`lesson seed ?? random per attempt`) and may log it for bug reports.

### 6.2 The rules of thumb (level 1, in priority order)
Candidates = `legalMoves(state)` for `state.toPlay` (so suicide, ko and occupied points are never chosen).
Per candidate the bot runs `play()` once to read `MoveFacts`. "Exposed" = number of own stones in groups with
exactly 1 liberty after the move; `exposedBefore` = the same before the move.

The bot draws three numbers first: `r1`, `r2`, `r3`.
1. **Capture** (skipped when `r1 < blunder / 2`): choose the move capturing the most stones; ties by `r3`.
   Reason `capture`.
2. **Save** (skipped when `r2 < blunder`; only if `exposedBefore > 0`): choose the move that gives the
   smallest `exposed` (strictly lower than before), not a self-atari, then the most liberties for the played
   group; ties by `r3`. If no such move exists, continue. Reason `save`.
3. **Atari** (skipped when `r2 < blunder`): moves with `opponentAtari.length > 0`, not `selfAtari`, and
   `exposed <= exposedBefore`; prefer the largest endangered group (most stones); ties by `r3`. Reason `atari`.
4. **Blunder** (when `r2 < blunder`): a uniformly random legal move by `r3` (it may even be a self-atari).
   Reason `blunder`.
5. **Pressure / random**: among moves that are not `selfAtari` and with `exposed <= exposedBefore` (if none,
   among all legal moves) score `2 × (opponent groups touched) + min(liberties of the played group, 4)`
   minus 2 when on the first line without touching an opponent stone; pick uniformly among the best 3 scores
   by `r3`. Reason `pressure` (touches an opponent) or `random`.
6. **Pass**: only when there is no legal move. Reason `pass`.

Why these: they are exactly the three habits Units 4–5 teach (capture, escape, atari), plus "don't step into
atari", so beating the bot proves the learner has them. A 1-ply bot misses ladders, double ataris and nets,
which Unit 9 teaches later: a patient learner can set a trap, and that feels like progress.

### 6.3 Difficulty tuning
Two knobs, both data: `bot.blunder` per game (0.7 → 0.2) and the automatic ease `+0.15` per loss (cap 0.9).
Order of games is the curve: G1 forced win to learn the screen; G2 first-to-1 so a single atari decides;
G3 first-to-2 introduces "a capture is not the end"; G4 moves to 7×7 with less chance of luck; G5 swaps colours.

### 6.4 Rewards and failure
- Win: calm green dot, the capture fade, one sentence of what worked (`explainKey`), stars on the result.
- Lose: the fact sentence, never "wrong"; the last captured stones remain visible (dashed) behind the card.
- After 3 losses: *Skip this game* appears; the bot is by then at `base + 0.45` (very gentle) so Try again
  is usually a win.
- Hint costs `clean` but never blocks.
- Session length: lesson ≈ 4 min (3 slides 40 s + games 60 s / 80 s / 100 s), checkpoint ≈ 5 min.

### 6.5 Win-rate targets (measured by AC 64; my estimates, to be calibrated)
Seeds 1–200 per game, learner colour as in §3.
| Game | Sensible learner wins | Noob learner wins | Avg plies |
|---|---|---|---|
| 1 `first-capture` | ≥ 95% | ≥ 70% | 2–6 |
| 2 `crosscut-first` | ≥ 80% | 40–70% | 8–16 |
| 3 `crosscut-two` | ≥ 75% | 30–60% | 12–24 |
| 4 `seven-two` | 70–90% | 20–50% | 16–34 |
| 5 `seven-white` | 60–85% | 10–40% | 24–50 |
A real beginner sits between Noob and Sensible: roughly 75–85% on the first try in games 1–3 and 60–75% in
games 4–5, which is the "~80%" principle after one retry.

## 7. Schema additions and validator

### 7.1 Schema (`src/lessons/schema.ts`)
```ts
export type BotLevel = 1 | 2 | 3;
export type GameWin = { kind: 'captureN'; n: number };       // M6 adds { kind: 'score' }
export interface PlayBotExercise extends ExerciseBase {      // size, setup, promptKey, hintKey, explainKey
  type: 'play-bot';
  win: GameWin;
  bot: { level: BotLevel; blunder?: number; seed?: number }; // blunder default 0; seed: tests/replays only
  player?: Color;      // learner colour, default 'B'
  first?: Color;       // who moves first, default 'B'
  maxMoves?: number;   // safety net, default 2 * size * size
}
export type Exercise = TapPointExercise | PlayMoveExercise | ChoiceExercise | CountExercise | PlayBotExercise;
```
`EXERCISE_TYPES` gains `'play-bot'`. `hintPoints` is not allowed (the hint point is computed live). `promptKey`
is the goal sentence. No new `Goal` kind. `Solution`/`getSolution` do not apply to `play-bot` (the function
returns no solution; callers that switch on type get a compile error to handle it, which is wanted).

### 7.2 How the validator checks a game (it cannot prove "winnable" by search)
Structural (all return `LessonError` with the code):
| Code | Rule |
|---|---|
| `BOT_NO_WIN` / `BOT_BAD_N` | `win.kind === 'captureN'`, `n` integer 1–10 and ≤ stones that can exist (n ≤ size) |
| `BOT_BAD_LEVEL` | `bot.level` in 1–3 |
| `BOT_BAD_BLUNDER` | `blunder` finite, 0 ≤ b ≤ 1 |
| `BOT_BAD_PLAYER` | `player`, `first` in `B`/`W` |
| `BOT_HINTPOINTS` | `hintPoints` present |
| `BOT_NO_MOVE` | the side to move first has no legal move |
| `BOT_START_LOST` | when `n = 1` and the learner moves first: at least one legal learner move exists after which the bot has no capture (2-ply exhaustive, ≤ 81 × 81 plays); so the game is not lost before it starts |
Behavioural (**smoke playouts**, the pragmatic stand-in for a solvability proof):
- `BOT_UNWINNABLE`: run 10 deterministic playouts (seeds 1–10) of the *reference learner* (bot level 1,
  `blunder 0`, learner's colour) against the configured bot; if the learner wins none, report it. A winner
  exists in practice, so the win condition is reachable.
- `BOT_RUNAWAY`: any playout that exceeds `maxMoves`, throws, or plays an illegal move is an error.
Tuning ranges (AC 64) are **not** in the validator: they are slower, and failing them is a design change, not
a content error. The validator imports `@/bot` and `@/engine` only (no cycle: bot never imports lessons).

### 7.3 Counts rule
`exercises` length: 5–10, except when **all** exercises are `play-bot`: 2–6 (a game is worth about three
exercises). The 2–4 explanation-step rule and the checkpoint rule are unchanged. Error code stays
`EXERCISE_COUNT` with the new message.

### 7.4 Runner plug-in (developer notes)
- New `src/exercises/runners/PlayBotRunner.tsx`, rendered by `ExerciseView` for `exercise.type === 'play-bot'`
  with the usual `RunnerProps<PlayBotExercise>`.
- Pure logic in `src/exercises/botGame.ts` (reducer: `start`, `playerMove`, `botMove`, `skip`, `retry`;
  constants of §5.3; `lossReason`; `suggest`). It has Jest tests with fake timers for the screen and plain
  tests for the reducer. The runner holds the timer (`setTimeout` in an effect, cleaned up on unmount).
- The M3 `AttemptState` is move-based. Games keep their own small state (`attempt`, `losses`, `hintUsed`,
  `status`) and report one `Outcome` per game to the existing practice flow through `next`/`onFinish`;
  `attempts.ts` is not changed. `ExerciseView`'s hint button calls the runner's hint (the runner shows the
  hint; `hasHint` is true since `hintKey` exists).
- `ResultView`: `result.gamesFirstTry` variant (AC 62). `UnitMap`/`loader.ts`: `PLANNED_UNITS = []`.
- Existing tests that assume Unit 6 is "soon" (M4 item 1 AC 13–15, 18) are updated.

## 8. Content (lesson JSON + texts)
Schema 1 (+ `play-bot`). Texts in `src/i18n/{zh-CN,en,fr}.json` under `lesson.<id>.…`; zh-CN without pinyin.
The unit title key `unit.6.title` already exists ("Capture Go · 吃子棋 chīzǐqí"). Lesson title keys give the
node names.

### 8.1 Lesson `u06-capture-go` (`src/lessons/content/u06-capture-go.json`)
```json
{
  "schema":1,"id":"u06-capture-go","unit":6,"kind":"lesson","titleKey":"lesson.u06-capture-go.title",
  "explain":[
    {"board":{"size":5,"setup":{"B":["c4","b3","d3"],"W":["c3"]}},"moves":[{"color":"B","at":"c2"}],"textKey":"lesson.u06-capture-go.s1"},
    {"board":{"size":5,"setup":{"B":["c3"],"W":["b3","d3","c2"]}},"moves":[{"color":"W","at":"c4"}],"textKey":"lesson.u06-capture-go.s2"},
    {"board":{"size":5,"setup":{"B":["c3","d2"],"W":["d3","c2"]}},
     "highlights":[{"kind":"liberty","points":["b3","c4","e3","d4","b2","c1","e2","d1"]}],"textKey":"lesson.u06-capture-go.s3"}
  ],
  "exercises":[
    {"id":"first-capture","type":"play-bot","size":5,"setup":{"B":["b3","c2","d3"],"W":["c3"]},
     "win":{"kind":"captureN","n":1},"bot":{"level":1,"blunder":0.7},
     "promptKey":"lesson.u06-capture-go.e1.prompt","hintKey":"lesson.u06-capture-go.e1.hint","explainKey":"lesson.u06-capture-go.e1.explain"},
    {"id":"crosscut-first","type":"play-bot","size":5,"setup":{"B":["c3","d2"],"W":["d3","c2"]},
     "win":{"kind":"captureN","n":1},"bot":{"level":1,"blunder":0.5},
     "promptKey":"lesson.u06-capture-go.e2.prompt","hintKey":"lesson.u06-capture-go.e2.hint","explainKey":"lesson.u06-capture-go.e2.explain"},
    {"id":"crosscut-two","type":"play-bot","size":5,"setup":{"B":["b3","c2"],"W":["c3","b2"]},
     "win":{"kind":"captureN","n":2},"bot":{"level":1,"blunder":0.4},
     "promptKey":"lesson.u06-capture-go.e3.prompt","hintKey":"lesson.u06-capture-go.e3.hint","explainKey":"lesson.u06-capture-go.e3.explain"}
  ]
}
```
Step 1 ends with Black c2 capturing c3 (Black c4 b3 d3 around White c3, whose only liberty was c2; game 1 is the
mirror image, solution c4, so step 1 does not spoil it). Step 2 ends with White c4 capturing c3 (Black c3
had one liberty, c4).

### 8.2 Checkpoint `u06-checkpoint` (`src/lessons/content/u06-checkpoint.json`)
```json
{
  "schema":1,"id":"u06-checkpoint","unit":6,"kind":"checkpoint","titleKey":"lesson.u06-checkpoint.title",
  "exercises":[
    {"id":"seven-two","type":"play-bot","size":7,"setup":{"B":["d4","e3"],"W":["e4","d3"]},
     "win":{"kind":"captureN","n":2},"bot":{"level":1,"blunder":0.3},
     "promptKey":"lesson.u06-checkpoint.e1.prompt","hintKey":"lesson.u06-checkpoint.e1.hint","explainKey":"lesson.u06-checkpoint.e1.explain"},
    {"id":"seven-white","type":"play-bot","size":7,"setup":{"B":["c4","d3"],"W":["d4","c3"]},
     "player":"W","win":{"kind":"captureN","n":3},"bot":{"level":1,"blunder":0.2},
     "promptKey":"lesson.u06-checkpoint.e2.prompt","hintKey":"lesson.u06-checkpoint.e2.hint","explainKey":"lesson.u06-checkpoint.e2.explain"}
  ]
}
```

### 8.3 Texts (keys after `lesson.<id>.`)
`u06-capture-go`:
| Key | zh-CN | en | fr |
|---|---|---|---|
| title | 吃子棋 | Capture Go | Jeu de capture |
| s1 | 吃子棋：先吃到规定数量的棋子就赢。这里是 1 颗：黑棋下 c2，立刻获胜。 | In Capture Go (吃子棋 chīzǐqí) the first player to capture the set number of stones wins. Here it is 1: Black plays c2 and wins. | Au jeu de capture (吃子棋 chīzǐqí), le premier qui capture le nombre de pierres fixé gagne. Ici : 1. Les Noirs jouent c2 et gagnent. |
| s2 | 你执黑先行，机器人执白。也要保护自己的棋子：这里白棋下 c4，提走了黑子。 | You play Black and move first; the bot plays White. Guard your own stones too: here White plays c4 and captures. | Vous jouez les Noirs et commencez ; le robot joue les Blancs. Protégez aussi vos pierres : ici les Blancs jouent c4 et capturent. |
| s3 | 第 2、3 局从四颗棋子开始，每颗都有两口气。抢先叫吃对方的棋子。 | Games 2 and 3 start with four stones, each with two liberties. Be the first to put an enemy stone in atari. | Les parties 2 et 3 commencent avec quatre pierres ayant chacune deux libertés. Soyez le premier à mettre une pierre adverse en atari. |
| e1.prompt | 提走白子就赢。 | Capture the white stone to win. | Capturez la pierre blanche pour gagner. |
| e1.hint | 白子只剩一口气，把它填上。 | The white stone has one liberty left. Fill it. | La pierre blanche n'a plus qu'une liberté. Remplissez-la. |
| e1.explain | 填上最后一口气，白子被提走，你赢了。 | You filled the last liberty, so the stone was captured. | Vous avez rempli la dernière liberté : la pierre est capturée. |
| e2.prompt | 先提到 1 颗子的人获胜。 | The first to capture 1 stone wins. | Le premier qui capture 1 pierre gagne. |
| e2.hint | 白子各有两口气。拿掉其中一口，让它叫吃。 | Each white stone has two liberties. Take one away to put it in atari. | Chaque pierre blanche a deux libertés. Prenez-en une pour la mettre en atari. |
| e2.explain | 先叫吃对方，对方就得先去救。 | Putting a stone in atari first made the bot defend. | Mettre une pierre en atari en premier oblige le robot à se défendre. |
| e3.prompt | 先提到 2 颗子的人获胜。 | The first to capture 2 stones wins. | Le premier qui capture 2 pierres gagne. |
| e3.hint | 叫吃对方的同时，数一数自己棋子的气。 | Atari the bot, but count your own stones' liberties too. | Faites un atari, mais comptez aussi les libertés de vos pierres. |
| e3.explain | 你比机器人先提到两颗子。 | You captured two stones before the bot did. | Vous avez capturé deux pierres avant le robot. |
`u06-checkpoint`:
| Key | zh-CN | en | fr |
|---|---|---|---|
| title | 吃子棋对局 | Capture Go games | Parties de capture |
| e1.prompt | 7×7 棋盘，先提到 2 颗子的人获胜。 | 7×7 board. The first to capture 2 stones wins. | Plateau 7×7. Le premier qui capture 2 pierres gagne. |
| e1.hint | 落子前先数双方的气。 | Count both sides' liberties before you play. | Comptez les libertés des deux camps avant de jouer. |
| e1.explain | 数清双方的气，你抢先提了子。 | Counting liberties let you capture first. | En comptant les libertés, vous avez capturé le premier. |
| e2.prompt | 这局你执白，机器人先走。先提到 3 颗子的人获胜。 | You play White; the bot moves first. The first to capture 3 stones wins. | Vous jouez les Blancs ; le robot commence. Le premier qui capture 3 pierres gagne. |
| e2.hint | 先看机器人的落子，再决定攻还是守。 | Look at the bot's move first, then decide: attack or defend. | Regardez d'abord le coup du robot, puis attaquez ou défendez. |
| e2.explain | 执白也一样：看气，抢先叫吃。 | It works as White too: count liberties, atari first. | Avec les Blancs aussi : comptez les libertés, atari en premier. |

Terms and pinyin: 吃子棋 chīzǐqí (first text `u06-capture-go.s1`, en and fr). 叫吃 jiàochī and 提子 tízǐ
were introduced in Units 4–5 and are not repeated with pinyin. "Bot" is 机器人 in zh-CN and *robot* in fr.
Ko and suicide are **not** named in Unit 6 text (they are Units 7–8): the notes describe them in plain words.

## 9. Edge cases
| Case | Behaviour |
|---|---|
| Learner passes | No Pass button in Unit 6 (open question 3). |
| Learner has no legal move | Auto-pass, note `game.fb.noMoves`; if the bot also cannot move, game ends by AC 21. |
| Bot has no legal move | Bot passes (reason `pass`); note `game.fb.botPass`; the learner keeps playing. |
| Both pass / `maxMoves` | More captures wins; equal = draw (draw card, counts as a loss for retry/ease). |
| Ko | Engine rejects the immediate retake; learner note `game.fb.illegal.ko`; the bot's legal list already excludes it. |
| Suicide | Rejected unless it captures (AC 24, 25). Note says why in plain words. |
| Occupied point | Soft note `game.fb.illegal.occupied`; no counted attempt. |
| Capture overshoot | Counts (AC 19). |
| App backgrounded in the delay | Timer resumes on foreground; the bot move is never lost or applied twice (reducer is idempotent per ply). |
| Leave / ✕ mid-game | M3 leave sheet; the game is not saved; restart from game 1 of the set only if the set is restarted (resume mid-set is out of scope as in M3). |
| Fast second tap during thinking | Ignored. |

## 10. Accessibility and i18n
- Board interaction and labels: M2. Added: turn pill is a live region (polite): "Your turn" / "Bot is
  thinking"; bot move: `game.a11y.botMoved` ("Bot played {{at}}"); captures: `game.a11y.captured`
  ("{{n}} stones captured"); score halves labelled with `game.a11y.score` ("You have captured {{n}} of
  {{total}} stones"); result cards announce their title and fact line.
- Contrast and tap targets as M3; the *Skip this game* text button is 44 px high.
- All text via i18n, all three languages, parity test.

## 11. i18n keys (new, besides `lesson.u06-*`)
| Key | en |
|---|---|
| `game.you` / `game.bot` | You / Bot (zh-CN 你 / 机器人; fr Vous / Robot) |
| `game.black` / `game.white` | Black / White (existing words reused if present) |
| `game.turn.you` / `game.turn.bot` | Your turn / Bot is thinking |
| `game.score` | {{n}} / {{total}} |
| `game.fb.yourAtari` | Atari! Your stones at {{at}} have one liberty left: {{lib}}. |
| `game.fb.botAtari` | The white stones at {{at}} are in atari: one liberty left. |
| `game.fb.captured` | You captured {{n}}. |
| `game.fb.botCaptured` | The bot captured {{n}}. |
| `game.fb.noMoves` | You have no legal move, so you pass. |
| `game.fb.botPass` | The bot has no legal move and passes. |
| `game.fb.illegal.suicide` | Not allowed: that stone would have no liberties and capture nothing. |
| `game.fb.illegal.ko` | Not allowed right now: it would repeat the last position. Play elsewhere first. |
| `game.fb.illegal.occupied` | That point is taken. |
| `game.hint.capture` / `.save` / `.atari` | You can capture at {{at}}. / Your stones are in atari: extend at {{at}}. / Play {{at}} to put a white group in atari. |
| `game.win.title` / `game.win.body` | You win! / You captured {{n}} first. |
| `game.lose.title` / `game.lose.body` | Not this time / The bot captured {{n}} first. |
| `game.lose.reason` | Your stones at {{at}} had one liberty ({{lib}}) and the bot filled it. |
| `game.draw.title` / `game.draw.body` | Draw / Nobody reached {{n}} captures. |
| `game.retry` / `game.next` / `game.finish` / `game.skip` / `game.restart` | Try again / Next game / Finish / Skip this game / Restart |
| `game.a11y.botMoved` / `.captured` / `.score` | see §10 |
| `result.gamesFirstTry` | {{n}} of {{total}} games won on the first try |
| `lesson.u06-*` | §8.3 |
fr and zh-CN follow the same keys; the developer drafts them, the designer reviews wording in the first PR.

## 12. Correctness check (done by the designer by hand; no code could be run)
All positions use orthogonal neighbours only.
- **G1** B b3 c2 d3 / W c3: White c3 neighbours b3 B, d3 B, c2 B, c4 empty, so exactly one liberty (c4); Black
  c4 has libs b4 d4 c5, captures c3. No group starts without liberties. The only capturing move is c4.
- **Cross-cuts** (all four stones 2 liberties): G2 B c3 d2 / W d3 c2: c3 {b3,c4}, d2 {e2,d1}, d3 {e3,d4},
  c2 {b2,c1}. G3 B b3 c2 / W c3 b2: b3 {a3,b4}, c2 {d2,c1}, c3 {c4,d3}, b2 {a2,b1}. G4 (7×7) B d4 e3 /
  W e4 d3: d4 {c4,d5}, e3 {f3,e2}, e4 {f4,e5}, d3 {c3,d2}. G5 (7×7) B c4 d3 / W d4 c3: c4 {b4,c5},
  d3 {e3,d2}, d4 {d5,e4}, c3 {b3,c2}. In each, a first atari (e.g. G2 Black e3 leaves White d3 only d4) is
  legal and safe.
- **Step 1**: B c4 b3 d3 / W c3, Black c2 captures (c2 has b2 d2 c1). **Step 2**: B c3 / W b3 d3 c2,
  Black c3 has only c4; White c4 has b4 d4 c5 and captures c3. **Step 3** liberties listed in the highlight
  are exactly the eight liberties of the four stones.
- **AC diagrams**: AC 5 (W c4 b3 d3 around B c3, lib c2; capturing c2 is legal, c2 has b2 d2 c1). AC 6 (B d3 d4
  group libs: only e3 because c3 c4 e4 d5 d2 are White; W e3 has e2; B a1 lib b1 only, so b1 captures 1; W
  a2 keeps a3 b2). AC 7 (W c3 only lib c2; after c2 the group has b2 d2 c1). AC 8 (B a1 libs a2 b1; W a2
  has a3 b2; W b1 has c1 b2). AC 14 ko: before Black c3, White b3 has the single liberty c3; after Black c3
  captures it, Black c3 has the single liberty b3 and White may not retake at once (simple ko). AC 24: W a1
  neighbours a2 B, b1: single liberty b1; W c1 libs d1; B a2 lib a3. Black b1 has no liberty before the
  capture, takes a1, and then has a1: legal. AC 25: W a2 {a3,b2}, W b1 {c1,b2}; a1 has neighbours a2, b1 both
  White and captures nothing: suicide, illegal.
- **Stars** arithmetic uses `count × 100 ≥ total × round(fraction × 100)`: 3 games → 3★ needs 3 clean, 2★
  needs 3 solved, 1★ needs 2 solved; 2 games → 3★ needs 2 clean, 2★ needs 2 solved, 1★ needs 1 solved.
- **Not verified by running**: bot win-rate ranges (§6.5) and playout lengths. They are targets for the
  developer's tuning test (AC 64).

## 13. Out of scope
Territory scoring and `score` win condition, bot levels 2–3 and 9×9 games (M6); handicap; undo/take-back;
saving a game in progress; Pass button; difficulty setting in the UI; bot avatar or name; sound or haptic
for win/lose; AI tutor explanations (M7, the `BotReason`/`lossReason` facts are the hook); online play;
Units 7+; new board features.

## 14. Open questions for the PO (recommended default in bold)
1. Should the learner **play White once** (game 5)? **Yes**: it checks they understand the game, not just
   "my stones are black".
2. **Undo / take-back**? **No in v1** (retry is one tap and the lose card explains). Revisit if testers
   rage-quit.
3. **No Pass button** in Unit 6? **Yes, none**; auto-pass only when the learner has no legal move.
4. Relax the exercise-count rule to **2–6 for sets made only of games** (§7.3)? **Yes**. Alternative: pad
   with 3 extra quick play-move exercises per node, which would repeat Units 4–5.
5. Split into a **lesson (3 games) + checkpoint (2 games)** rather than one 5-game lesson? **Split**
   (3–5 minute sessions).
6. A loss then a win gives **at most 2★** (`solved`), because the star rules are unchanged. Keep? **Keep**
   (consistent with every other unit).
7. **Automatic ease** after losses (+0.15 blunder, cap 0.9)? **Yes**, invisible to the learner.
8. A **Hint** in a game costs the first-try credit and shows the engine's best move? **Yes**.
9. Bot name: plain **"Bot" / 机器人 / Robot**, no avatar? **Yes** (calm, no characters).
10. **No new sounds or haptics** for win/lose in v1 (M6 audio pass)? **Yes**.
11. After 3 losses, **Skip this game** (counts as `revealed`)? **Yes**; a learner who skips both checkpoint
    games gets 0★ but nothing is locked behind it.
12. Bot delay **700 ms** (300 ms with reduce-motion) and **600 ms** end beat OK? **Yes**; one constant each.
13. `PLANNED_UNITS = []` after Unit 6 (no Unit 7 "coming soon" row, only the footer)? **Yes**, until M5
    content exists.
14. Draw/limit rule: **more captures wins at the move limit, equal = draw** (draw is a retry)? **Yes**.
15. The five `blunder` values (0.7, 0.5, 0.4, 0.3, 0.2) are provisional. **Developer measures with AC 64,
    PO approves the final numbers from the report** before merge.
