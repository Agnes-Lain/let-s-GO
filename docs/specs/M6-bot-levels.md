# M6 — Bot levels 1–3 for 9×9 + end-of-game count

Status: DRAFT for PO approval. Roadmap item: "Bot levels 1–3 for 9×9 (Monte-Carlo playouts for level 3)" with the two
PO sub-notes (2026-10-21): end-of-game count after two passes; "Count now" and Resign 认输.
Reads: `src/bot` (heuristic L1, `forcedCapture`, `captureGo`), `src/engine` (`pass`, `score`, `isOver`),
M5 spec (`mark` dead runner, Unit 13 count), M4 spec §14–16 (blunder tuning, Easy/Normal/Challenge idea).

## 0. In plain words
After Unit 14 the learner can play a whole 9×9 game against a bot. They pick one of three levels, play, pass 弃权 when
nothing is left to do, mark the dead stones together with the bot, and see a count (stones + territory + komi) that
says who won. At any time they can also ask "Count now" or Resign 认输. Level 3 "thinks" by playing many quick random
games in its head (Monte-Carlo); the others use rules of thumb.

## 1. Goal
After this item the learner can play a complete 9×9 game against a bot of their chosen strength, end it correctly
(pass, dead stones, count) and understand why they won or lost.

## 2. User stories
1. As a beginner, I want to choose an easy opponent first so that my first whole game is not crushing.
2. As a beginner, I want a stronger bot when I get better so that I keep improving.
3. As a beginner, I want to pass when I think the game is over so that I practise Unit 14 for real.
4. As a beginner, I want to mark dead stones and see whether the bot agrees, so that I learn what "dead" means in a real game.
5. As a beginner, I want to see the count with stones, territory and komi so that I trust the result.
6. As a beginner, I want "Count now" so that I can see where I stand without waiting for the bot to run out of moves.
7. As a beginner, I want to Resign 认输 a lost game without shame and, if I wish, see the would-be score so that I learn.
8. As a beginner, I want the bot to answer quickly (< ~1 s) so that the game feels calm, not laggy.
9. As a parent/teacher, I want the app to remember which levels were beaten so that I can see progress.

## 3. Decisions in this spec (details in §12 "Open decisions")
- Board 9×9, Chinese rules (area scoring, simple ko), komi **5.5** default (explicit in `createGame`, not engine default 7.5).
- Learner plays **Black**, no handicap in this item. Level names shown to the learner: 入门 Easy / 普通 Normal / 挑战 Challenge
  = levels 1 / 2 / 3.
- The end-of-game count flow ships **in this item** (the bot is useless without a way to end the game).
- Entry: a "Play 9×9 · 九路对弈" card on Home that unlocks when Unit 14 (lesson `u14-end`) has ≥ 1 star; also reachable from the
  Unit 14 result screen's Next action.

## 4. Acceptance criteria
Notation: coordinates are engine vertices (column letter without I, row from the bottom: `a1` bottom-left). "Bot" = the
engine-driven opponent. All bot ACs use a fixed seed.

### 4.1 Bot API and purity (src/bot, no React)
1. Given `BotLevel` is `1|2|3`, When `chooseMove(state, {level, rng})` runs for any legal 9×9 position, Then it returns a legal
   move (`checkMove` ok) or a pass; it never throws and never returns an illegal point. Levels 2 and 3 are registered (no
   silent fallback to level 1).
2. Given the same state, level and seed, When called twice, Then the result is identical (determinism, all levels). The bot
   module imports no clock (`Date`, `performance`), timers or `Math.random` (existing purity test extended).
3. Given a position where one move captures stones and the capture is safe, When level 1/2/3 play it, Then level 2 and 3 always
   capture (level 3 over 20 seeds); level 1 captures unless its blunder roll fires (existing `blunder` semantic).
4. Given the §10 fixture (White `d5 d6` in atari, only liberty `d7`; Black `c5 c6 e5 e6 d4`) with White to move, When level 2 or 3
   to move, Then it saves the group (extends to a point with ≥ 2 liberties: `d7`, 3 liberties) rather than playing elsewhere. (ASCII
   fixture in tests; the first wording "Black stones e5 e6 … a single liberty each side" was muddled, §12b.)
5. Given a White single-point eye (`.` at `a1` surrounded by `a2 b1 b2` White stones and the group has a second eye), When any
   level chooses a move for White, Then it never plays `a1` (no self-eye filling) unless it is the only legal move (then pass is
   preferred: bot passes instead of filling).
6. Given level 3, When choosing in the opening position (empty board) and in a 40-ply midgame fixture, Then the number of playouts
   equals the constant `MC_PLAYOUTS = 1200` (spread over at most 12 candidate points, 100 each; cap 110 plies per playout) and the
   result is seed-reproducible. The budget is a count, never time-based.
7. Given the developer's timing script on the CI Node (documented in the report), When level 3 chooses a midgame move, Then it
   takes < 400 ms on desktop Node (leaves ≥ 2.5× margin for a mid-range phone → target < 1 s); if the script shows > 400 ms,
   `MC_PLAYOUTS` is lowered and this AC's constant changes (PO sees the number in the report).
8. Given the tuning script `npm run tune:bot9` (own Jest config like `tune:bot`, not in `npm test`), When it plays seeds 1–100
   per pairing as Black and as White (komi 5.5), Then it prints win rates; targets: L2 beats L1 ≥ 80 %, L3 beats L2 ≥ 65 %,
   L3 beats L1 ≥ 90 %; and a "Sensible" scripted learner (L1 with blunder 0 + never fills own eyes) beats L1 ≥ 70 %, loses to L3
   ≥ 60 %. Failing numbers are reported, not hidden; PO approves final constants (as in M4 §16).
9. Given 100 complete bot-vs-bot games of every pairing, When they finish, Then none throws, none exceeds 200 plies (hard cap:
   at ply 200 the bot passes), and all end by two consecutive passes.

### 4.2 Bot passing
10. Given any state where the learner has just passed and the bot is level 2 or 3, When it chooses, Then it passes if
    `score()` (after its own dead-stone proposal, §4.5) shows it ahead, otherwise it plays the best move (at most 3 such "play on"
    answers in a row per game, then it passes, so a lost game cannot loop).
11. Given level 1 and the learner just passed, When no capture/save/atari rule applies, Then it passes (level 1 never plays on to
    chase a lost game).
12. Given no legal move exists except filling own eyes / self-atari that kills the group, When any level chooses, Then it passes
    (reason `pass`).
13. Given a game after both pass (`isOver`), When the learner taps the board, Then nothing is placed (engine `game-over`).

### 4.3 Game screen flow
14. Given the Home screen with Unit 14 ≥ 1★, When opened, Then a card "Play 9×9" is visible and tappable (≥ 44 px) and opens
    `/game` (level picker). Given Unit 14 has 0★, Then the card is shown disabled with the line "Finish Unit 14 first" and tapping it shows
    the existing locked snackbar (no navigation).
15. Given the level picker, When shown, Then three rows (Easy 入门 / Normal 普通 / Challenge 挑战) each ≥ 64 px tall, with a
    one-line description and a "won" tick for a beaten level; level 2 is pre-selected unless the learner has never won (then Easy). Tap a
    row → game starts at once (no extra confirm).
16. Given a new game, When started, Then the board is 9×9 with no stones, Black (learner) to play, komi 5.5 shown in the status
    line, header shows the level name. Given the learner taps a legal point, Then the existing M2 preview/commit applies and after
    commit the bot answers after the delay (700 ms; 300 ms with reduce-motion; at least this delay even if the bot is faster).
17. Given the bot is thinking (level 3 up to ~1 s), Then the status line shows "Bot is thinking…" (static text, no spinner animation
    that the busy JS thread would freeze), the board ignores taps and the buttons Pass/Count now/Resign are disabled.
18. Given the learner taps an illegal point (occupied / suicide / ko), Then the existing engine message appears in the feedback
    card and no move is made (Unit 7/8 wording reused).
19. Given it is the learner's turn, When they tap *Pass 弃权*, Then a pass is played (engine `pass`), the board shows "You passed" and the
    bot replies per §4.2. The first Pass shows a one-time explainer sheet ("Pass when you believe nothing useful is left. Two passes
    in a row end the game."). Shown once, stored in settings.
20. Given the learner passed and the bot passed (`isOver` and `consecutivePasses === 2`), Then the screen goes to the *Mark dead
    stones* state (§4.5). Given the bot passed first and the learner has not, Then the game goes on and the status says "Bot passed.
    If you also pass, the game ends."
21. Given the learner taps *Count now*, When the game is not over, Then a confirm sheet appears ("Ask the bot to pass and count the
    board?" [Count now] [Keep playing]). On confirm the learner's pass is played, the bot's pass is forced (it always agrees), and the
    flow continues as in AC 20. Given any group of either colour is in atari, Then the sheet adds the line "Some stones are in atari;
    mark them dead only if they cannot be saved."
22. Given the learner taps *Resign 认输*, Then a confirm sheet appears ([Resign] [Keep playing]); on confirm the game ends with
    result "White wins by resignation" (no count screen is forced) and the result card has the secondary action *Show the count*
    (see AC 33). Resigning counts as a loss for progress (no star-like credit) but does not lock anything.
23. Given the game has fewer than 6 moves, Then *Count now* is hidden (nothing to count) and *Resign* stays available.
24. Given a game is in progress and the learner leaves (✕ / system back), Then the existing leave sheet appears; the game is
    **not** saved (v1: one game = one session, 3–5 min target; a game may take longer — see §13 risk). Leaving counts as nothing.

### 4.4 Marking dead stones (reuse Unit 14 `mark` dead runner)
25. Given the game is over by two passes, When the mark state opens, Then the board is the final position, the prompt is "Tap the
    dead stones of both sides. Then tap Done.", status row "Marked: 0 [Clear]", the Unit 14 `MarkRunner` (`mark: 'dead'`) UI
    is reused: tap toggles a whole group (dead overlay: 45 % opacity + cross), tap is reversible, no touch preview. *Done* is always
    enabled (marking nothing is valid).
26. Given the learner marks stones, When they tap *Done*, Then `judgeDeadMarks` runs (bot-side, §6) and returns either `agreed`
    or a list of `disputes`; there are no Wrong/Revealed states and no 3-mistake rule in this runner mode (it is a negotiation,
    not an exercise). Hint button hidden.
27. Given the learner's marks equal the bot's proposal (as sets of whole groups), When Done, Then the bot says "Agreed." and the
    count screen opens (AC 30).
28. Given the learner marked a group that the engine can show is alive (see §6.3: cannot be captured by `forcedCapture` with the
    opponent to move AND has two real eyes in the playout test), When Done, Then the bot answers with a fact: "The group at {point} has
    two eyes — it is alive." and highlights it; the mark is removed; the learner stays in mark state (no penalty).
29. Given the bot proposes a group dead that the learner did not mark, When Done, Then the bot shows its proposal (those stones dimmed with a
    cross) and the sheet "I think these stones are dead: {points}. [Accept] [Play on]". *Accept* adds them to the marks and goes to the
    count; *Play on* resumes the game (AC 31). If a disagreement is on a group that the bot cannot prove dead (playouts only, §6.3), the
    sheet says "I am not sure about {point}" and the learner's choice wins: *Accept* is not needed — the learner's marks stand and the
    count opens. (The learner is never forced to accept a bot opinion that is not proved.)
30. Given the dead set is agreed, When the count screen opens, Then it shows (reusing the Unit 13 count presentation): the board with dead
    stones removed and territory squares coloured, a table Black: stones S + territory T = total; White: stones S + territory T + komi
    5.5 = total, and the winner line produced from `score(board, {komi, deadStones})`: "Black wins by 3.5" / "White wins by 1.5". Numbers
    are `ScoreResult` fields, never recomputed in the UI. Draw is impossible with komi x.5 (the engine returns `winner:null` only
    for integer komi; still render "Draw").
31. Given *Play on*, When tapped, Then the dead marks are discarded and the game resumes with the learner to move (state is the
    last position before the passes: pass records are removed from the position's `consecutivePasses`; implement by replaying
    moves minus the trailing passes through the engine). The status says "Play on — the stones are not settled."
32. Given a disagreement round happens twice in a game, When the second *Play on* is tapped, Then the message "Capture the stones
    on the board to settle it" is shown (teaches that disputed stones are settled by playing); no limit on further rounds.

### 4.5 Result, resign and progress
33. Given a resigned game, When the result card shows, Then it says "You resigned. White wins." and a secondary button "Show the
    count": it opens the same count screen using `score()` on the current board with the dead set = the bot's proposal (labelled "If we had
    counted now"); no winner is assigned by this count. Skipping it is one tap (Done → back).
34. Given the learner wins a game (by count), When the result card shows, Then it shows "You win!" plus margin, the level
    name, a calm sound/animation (existing success feedback; no confetti), and records `wins[level] += 1`, `games[level] += 1`.
    Given a loss or resignation, Then `games[level] += 1`, no win, and the card gives one engine fact (§8 loss reasons) and
    the buttons [Play again] [Change level]. Given the bot level 3 is beaten once, Then the badge "Challenge beaten" appears on the picker.
35. Given progress, When the app restarts, Then `bots` progress (wins and games per level, `firstWinAt`) is restored; the schema is
    additive, progress `version` stays readable (old saves load with `bots` empty).
36. Given a win at level 1, Then level 2 becomes the pre-selected level in the picker next time; nothing is locked (all three levels
    are selectable from the start; unlocking would frustrate a learner who already knows Go).
37. Given a loss at the same level three times in a row, Then the picker shows a gentle tip once ("Try Easy for a warm-up?") — never
    changes bot strength silently (unlike Capture Go's auto-ease; here the learner chose the level).

### 4.6 UI quality
38. Given 360×740, When any game state shows, Then no vertical scroll is needed, the board is 328×328, buttons ≥ 44 px high,
    and the order is: instructions top / board / feedback bottom (project layout rule).
39. Given zh-CN, en, fr, When any screen shows, Then every string comes from i18n keys listed in §9, exists in all three files and
    nothing overflows at 360 px (fr longest).
40. Given screen readers, When a move is made, Then the announcement states the colour and vertex of each move, pass, capture count and
    the state changes ("Game over. Mark dead stones." / "Black wins by 3.5").
41. Given `prefers-reduced-motion`, Then bot delay is 300 ms and no animation other than the fade.

## 5. Screen flow and UI
```
Home --(Play 9x9 card)--> Level picker --(tap level)--> Game
Game --Pass x2 / Count now--> Mark dead --Done--> [agree] Count --> Result
                                        \--[dispute]--> sheet: Accept / Play on --> Game
Game --Resign--> Result (resigned) --> optional Count ("if we had counted now")
Result: [Play again] [Change level] [Home]
```
New routes: `app/game/index.tsx` (picker), `app/game/play.tsx?level=` (game, mark, count, result are states of one screen).
Logic lives in `src/game9/` (pure reducer: `GameSession`, `step(session, event)`), screens only render; no engine calls in `app/`.

### 5.1 Level picker (360×740)
```
┌──────────────────────────────┐
│ <-   Play 9x9 · 九路对弈      │ 56 top bar
│  Choose your opponent        │ prompt
│ ┌──────────────────────────┐ │
│ │ ● 入门 Easy      ✓ won   │ │ 72  row, one-line description
│ │   Plays simply, forgives │ │
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │ ●● 普通 Normal           │ │ 72  (pre-selected = tea-green border)
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │ ●●● 挑战 Challenge       │ │ 72
│ └──────────────────────────┘ │
│  You play Black. Komi 5.5.   │ caption
│  A mountain-and-mist backdrop│
└──────────────────────────────┘
```
### 5.2 Game (playing)
```
┌──────────────────────────────┐
│ ✕  Normal · Komi 5.5   Move 14│ 56
│ ┌──────────────────────────┐ │
│ │ Your turn (Black).       │ │ 56 status / instruction card
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │      9x9 board 328       │ │ 328, coordinates on
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │ feedback (min 72)        │ │ captures, illegal reasons, bot passed
│ └──────────────────────────┘ │
│ [ Pass 弃权 ][Count now][Resign]│ 48, three equal buttons, secondary style
└──────────────────────────────┘
```
Height ≈ 56+56+8+328+8+72+8+48+16 = 600 (fits 740 with room for the safe area).
### 5.3 States
| State | Board | Status | Feedback card | Buttons |
|---|---|---|---|---|
| Playing, learner turn | interactive | Your turn | last event | Pass, Count now (≥ 6 moves), Resign |
| Bot thinking | locked | Bot is thinking… | — | all disabled |
| Bot passed | interactive | Bot passed. | Pass to end, or keep playing | same |
| Mark dead | final position, mark runner | Marked: n [Clear] | empty / bot answers | Done |
| Dispute | marks + bot's dimmed proposal | — | bot reason | Accept / Play on (sheet) |
| Count | dead removed, territory squares | table | winner line | Done |
| Result | board kept | You win / lose | fact + margin | Play again, Change level, Home |
| Resigned | board kept | You resigned | — | Show the count, Play again |
No loading state beyond "thinking"; no error state (bot cannot fail; a thrown bot error falls back to a legal random move and logs).
### 5.4 Count screen
```
┌──────────────────────────────┐
│ ✕  Count                     │
│ Black wins by 3.5            │ headline
│ ┌──────────────────────────┐ │
│ │ board: dead removed,     │ │
│ │ ■ black / □ white terr.  │ │
│ └──────────────────────────┘ │
│  Black   stones 27 + land 14 = 41 │
│  White   stones 20 + land  8 + komi 5.5 = 33.5 │
│  Neutral (单官): 2           │
│ [           Done           ] │
└──────────────────────────────┘
```
Uses Unit 13's tokens and territory square drawing (M5 §5.5); no entry pad here (the learner already practised counting; optional later).

## 6. Bot design
Common: pure TS in `src/bot`, immutable, seeded `Rng` (existing `botRng(seed, ply)`), move list from `legalMoves`. New shared helpers:
`isOwnEye(board, p, color)` (single-point eye: all orthogonal neighbours own stones, diagonal rule: ≥ 3 of 4 diagonals own or
off-board, ≥ 4 on the edge/corner), `ownGroupsInAtari`, `randomPlayout`.

### 6.1 Level 1 — 入门 Easy
The existing heuristic (capture > save > atari > pressure, M4 §6), adapted to normal 9×9:
- Blunder value for 9×9 Easy: start at **0.5** (capture 0.25), tune with AC 8 so that Sensible beats it ≥ 70 % and Noob 30–60 %.
- New: never fill own eye (AC 5); pass when only such moves are left (AC 12); pass reply per AC 11.
- Opening: if no rule applies, play random among legal points not on the first line while the board has > 40 empty points
  (otherwise it hugs edges and looks silly); otherwise the existing "pressure" point.
- Keeps the 3 rng draws (AC 4 of M4 stays valid for Capture Go; the 9×9 mode uses the same function so recorded Capture Go games do not change).
### 6.2 Level 2 — 普通 Normal (stronger heuristic, one-ply look-ahead, no blunder)
Score every legal point (not own eye), pick the highest, ties by rng:
1. Capture (+10 per stone, +5 more if it removes the only atari threat). Reject if it leaves the capturing group in atari with a 2-stone reply capture (checked by one `play()` of the best reply).
2. Save own atari group by extending (+8) only if the extension has ≥ 2 liberties; otherwise try to capture the attacker (+9); a ladder that the engine proves unescapable (`forcedCapture` on the own group, bounded) is not "saved" — play elsewhere.
3. Atari on an opponent group (+4) if the atari stone has ≥ 2 liberties and the group is not ladder-escapable (cheap check: the 1-liberty extension would have ≥ 3 liberties → +1 only).
4. Connect own stones that are cut-able (+3), block/hane next to an opponent stone on the 3rd line (+2), extend own groups (+1).
5. Line preference: 3rd/4th line +1.5, 1st line −3, 2nd line −1 until move 30.
6. Self-atari −12, filling own eye −∞, point adjacent only to dead-ish stones 0.
Passes per AC 10/12. Level 2 never blunders on purpose; expected skill: avoids losing stones in atari, wins territory by contact moves.
### 6.3 Level 3 — 挑战 Challenge (flat Monte-Carlo, seeded)
- Candidates: the top **12** level-2 scored points, plus every capture / save move (cap 14); plus pass when the learner has passed.
- Per candidate: **100** playouts → total `MC_PLAYOUTS = 1200` (a constant; PO-visible; AC 6). Playout policy: after the candidate, alternate
  colours choosing uniformly among legal points that are not own eyes; if a capture of ≥ 1 stone exists, take it with p = 0.5;
  end on two passes (when no non-eye move) or 110 plies. Playout rng = `deriveSeed(seed, ply, candidateIndex, playoutIndex)`.
- Evaluate each playout with `score(board, {komi})` and no dead removal (playouts fill dame, leaving few dead stones); win for the bot colour if
  `winner === botColor`. Candidate value = wins / 100 + 0.002 × mean margin (breaks ties toward bigger wins).
- Choose by a seeded softmax over the values (PO 2026-10-21, §12b): candidate i with probability ∝ exp((value_i − max) / `MC_TEMPERATURE`),
  `MC_TEMPERATURE = 0.21`, one draw from the move's seed. A clearly better move still wins almost every draw; near-equal ones are mixed.
  Even if all candidates < 0.12 win probability it still plays (never resigns; the learner decides).
- Budget: 1200 playouts × ≤ 110 plies. Measured by AC 7; **target < 1 s per move on a mid-range phone, < 400 ms on desktop Node.** If too slow,
  lower playouts to 800 or cap to 90 plies (the developer reports). The UI runs level 3 inside one `setTimeout(…, 0)` after the delay so the
  "thinking" text is painted first; an optional later improvement is a chunked search generator.
- No opening book; at move 1 playouts favour the centre naturally. Corner/side first moves are not coded.
### 6.4 Dead-stone judgement (`src/bot/deadStones.ts`)
`proposeDead(state, rng): Point[]` — group-level:
1. For every group with ≤ 2 liberties: ask `forcedCapture` (opponent to move, bounded 3 000 nodes, defender policy `run`). If it captures
   the group → **proved dead**. If the defender (group owner) to move cannot be captured either way → keep as undecided.
2. For other groups: run **200** playouts from the final position (same playout policy, 60 plies, no passing out early). A group is **dead
   by playouts** if it has been captured (removed) or sits in an area scored for the opponent in ≥ 80 % of playouts; **alive** if the stones
   remain in ≥ 80 %; otherwise undecided (treated as alive).
3. `judgeDeadMarks(state, marks)` compares sets: unmarked proved-dead groups → dispute `bot-proposes` with a fact; marked groups whose playout
   alive-rate ≥ 80 % and which `forcedCapture` cannot capture → dispute `alive` with the fact "the group at {p} has {n} liberties/two eyes";
   playout-only opinions → `unsure` disputes where the learner's marking wins (AC 29). All reasons are engine facts (liberties, eyes count,
   capture sequence length), never prose from a model.
   Budget: ≤ 300 ms on desktop Node total.
4. Resolved facts have text keys (§9).
Chinese rules note: dead stones are removed only for scoring; `score()` already takes `deadStones` (whole groups, D6). Prisoners never count.

### 6.5 Who passes first, and Count now
- Bot at level 1: passes when it has no useful rule (AC 11). Level 2/3: pass when ahead after its own dead proposal (AC 10).
- Count now: learner pass + forced bot pass (AC 21). It is a teaching shortcut, not "the bot agrees the game is over": the dead-stone
  negotiation still happens, so an unsettled position can be disputed (AC 29) and played on.
- Hard stop: ply 200 → the bot passes every turn (AC 9).

## 7. Game design notes
- Difficulty curve: Easy ≈ 85 % learner wins for someone who finished Unit 14 (measure with Sensible); Normal ≈ 50–60 %;
  Challenge ≈ 25–35 % for a Sensible learner. Beginners should be able to see a win within 2–3 games.
- Session length: a 9×9 game is 25–45 learner moves — longer than a 3–5 min lesson. Mitigations: Count now; Resign; no
  forced continuation; result screen is one tap away. The bot delay is short (700 ms).
- Hints: none in v1 (Capture Go's hint stays only there). Optional later: "Ask the teacher" (M7).
- Feedback moments: stone sound on each move (existing `expo-audio`), capture sound as in M4, a brief "pass" bell? (**none**, reuse stone-off sound
  — no new asset). Win: success tone + calm fade of the board to the mountain backdrop (existing win feedback), no confetti.
  Loss: soft tone, never red full-screen.
- Loss reason (one line, engine facts): "{n} of your stones were captured" / "White's land is larger: 33.5 vs 31" / "You lost by 0.5 — komi
  decided it." (when `margin === komi - 0.5` style: black total (no komi) > white total without komi → komi decided).
- After 3 consecutive losses at a level: the tip in AC 37; the game itself is never altered. No "3 failures" lock.
- Stars: games do not produce lesson stars (not an exercise). Home shows "Beaten: Easy ✓ Normal ✓" under the card.
- Progress/store: `ProgressState.bots?: Record<'1'|'2'|'3', { games: number; wins: number; firstWinAt?: string }>` additive to the
  Zustand store; `PROGRESS_VERSION` stays 1 with a tolerant parser (missing `bots` → `{}`); one selector `botWins(level)`.
  No unlock rules; the pre-selection rule is AC 15/36.

## 8. Content
Not a lesson, but the engine facts and copy need these keys. No lesson JSON for this item.
Optional follow-up (not now): lesson `u15-first-game` as a thin wrapper node on the map (`play-bot` with `score` win) that opens `/game`.

## 9. i18n keys (all three languages; first use = Chinese term + pinyin)
| Key | zh-CN | en | fr |
|---|---|---|---|
| game.entry.title | 九路对弈 | Play 9×9 · 九路对弈 jiǔlù duìyì | Jouer en 9×9 · 九路对弈 jiǔlù duìyì |
| game.entry.locked | 先完成第 14 课 | Finish Unit 14 first | Terminez d'abord l'unité 14 |
| game.picker.title | 选择对手 | Choose your opponent | Choisissez votre adversaire |
| game.level.1 | 入门 | Easy · 入门 rùmén | Facile · 入门 rùmén |
| game.level.2 | 普通 | Normal · 普通 pǔtōng | Normal · 普通 pǔtōng |
| game.level.3 | 挑战 | Challenge · 挑战 tiǎozhàn | Défi · 挑战 tiǎozhàn |
| game.level.1.desc | 下得简单，会原谅你的错 | Plays simply and forgives mistakes | Joue simplement et pardonne les erreurs |
| game.level.2.desc | 会救自己的子，也会吃你的子 | Saves its stones and captures yours | Sauve ses pierres et capture les vôtres |
| game.level.3.desc | 会在脑中试下许多局 | Tries many games in its head | Essaie beaucoup de parties dans sa tête |
| game.level.beaten | 已战胜 | Beaten | Battu |
| game.tip.easier | 先和入门热热身？ | Try Easy for a warm-up? | Un échauffement en Facile ? |
| game.youBlack | 你执黑，贴目 {{komi}} | You play Black. Komi {{komi}}. | Vous jouez Noir. Komi {{komi}}. |
| game.header | {{level}} · 贴目 {{komi}} | {{level}} · Komi {{komi}} | {{level}} · Komi {{komi}} |
| game.move | 第 {{n}} 手 | Move {{n}} | Coup {{n}} |
| game.turn.you | 轮到你（黑） | Your turn (Black). | À vous (Noir). |
| game.turn.bot | 机器人在思考… | Bot is thinking… | Le robot réfléchit… |
| game.bot.passed | 机器人弃权。你也弃权，对局就结束。 | Bot passed. If you also pass, the game ends. | Le robot passe. Si vous passez aussi, la partie se termine. |
| game.you.passed | 你弃权了。 | You passed. | Vous avez passé. |
| game.btn.pass | 弃权 | Pass | Passer |
| game.pass.title (pass explainer sheet title; first use of the term) | 弃权 | Pass · 弃权 qìquán | Passer · 弃权 qìquán |
| game.btn.count | 现在数子 | Count now | Compter maintenant |
| game.btn.resign | 认输 | Resign | Abandonner |
| game.passExplain | 觉得没有有用的点了，就弃权。双方连续弃权，对局结束。 | Pass when you think nothing useful is left. Two passes in a row end the game. | Passez quand il ne reste rien d'utile. Deux passes de suite terminent la partie. |
| game.countNow.ask | 请机器人也弃权并数子？ | Ask the bot to pass and count the board? | Demander au robot de passer et compter le plateau ? |
| game.countNow.atari | 有些棋子被叫吃；只有确定救不活才标为死子。 | Some stones are in atari; mark them dead only if they cannot be saved. | Certaines pierres sont en atari ; ne les marquez mortes que si on ne peut pas les sauver. |
| game.resign.ask | 确定认输吗？ | Resign · 认输 rènshū: end this game? | Abandonner · 认输 rènshū : arrêter cette partie ? |
| game.keepPlaying | 继续下 | Keep playing | Continuer |
| game.mark.prompt | 点出双方的死子，然后点“完成”。 | Tap the dead stones of both sides. Then tap Done. | Touchez les pierres mortes des deux camps, puis « Terminé ». |
| game.mark.done | 完成 | Done | Terminé |
| game.mark.agreed | 同意。 | Agreed. | D'accord. |
| game.dispute.alive | {{point}} 那块棋有两只眼，是活的。 | The group at {{point}} has two eyes: it is alive. | Le groupe en {{point}} a deux yeux : il est vivant. |
| game.dispute.liberties | {{point}} 那块棋还有 {{count}} 口气，不能证明已死。 | The group at {{point}} still has {{count}} liberties; it is not proved dead. | Le groupe en {{point}} a encore {{count}} libertés ; il n'est pas prouvé mort. |
| game.dispute.propose | 我觉得这些子已死：{{points}} | I think these stones are dead: {{points}} | Je pense que ces pierres sont mortes : {{points}} |
| game.dispute.unsure | 我对 {{point}} 不确定，按你的标记算。 | I am not sure about {{point}}; your marks stand. | Je ne suis pas sûr pour {{point}} ; vos marques restent. |
| game.dispute.accept | 接受 | Accept | Accepter |
| game.dispute.playOn | 继续下 | Play on | Continuer à jouer |
| game.dispute.playOn.status | 继续下——这些子还没定。 | Play on — the stones are not settled. | Continuez — les pierres ne sont pas réglées. |
| game.dispute.captureHint | 把有争议的子在棋盘上提掉来解决。 | Capture the stones on the board to settle it. | Capturez les pierres sur le plateau pour trancher. |
| game.count.title | 数子 | Count · 数子 shùzǐ | Compter · 数子 shùzǐ |
| game.count.row | 子 {{stones}} + 地 {{territory}} | stones {{stones}} + land {{territory}} | pierres {{stones}} + territoire {{territory}} |
| game.count.row.komi | 子 {{stones}} + 地 {{territory}} + 贴目 {{komi}} | stones {{stones}} + land {{territory}} + komi {{komi}} | pierres {{stones}} + territoire {{territory}} + komi {{komi}} |
| game.count.neutral | 单官：{{count}} | Neutral (单官 dānguān): {{count}} | Neutres (单官 dānguān) : {{count}} |
| game.result.blackWins | 黑胜 {{margin}} 目 | Black wins by {{margin}} | Noir gagne de {{margin}} |
| game.result.whiteWins | 白胜 {{margin}} 目 | White wins by {{margin}} | Blanc gagne de {{margin}} |
| game.result.draw | 和棋 | Draw | Égalité |
| game.result.win | 你赢了！ | You win! | Vous gagnez ! |
| game.result.lose | 这盘输了。 | You lost this one. | Vous avez perdu cette partie. |
| game.result.resigned | 你认输了，白胜。 | You resigned. White wins. | Vous avez abandonné. Blanc gagne. |
| game.result.showCount | 看看如果现在数子 | Show the count | Voir le décompte |
| game.result.hypothetical | 若此时数子 | If we had counted now | Si nous avions compté maintenant |
| game.result.fact.captured | 你有 {{count}} 子被提。 | {{count}} of your stones were captured. | {{count}} de vos pierres ont été capturées. |
| game.result.fact.land | 白的地更大：{{white}} 比 {{black}}。 | White's area is larger: {{white}} to {{black}}. | L'aire de Blanc est plus grande : {{white}} contre {{black}}. |
| game.result.fact.komi | 差在贴目：不算贴目你多 {{margin}}。 | Komi decided it: you led by {{margin}} without it. | Le komi a décidé : vous meniez de {{margin}} sans lui. |
| game.btn.again | 再下一盘 | Play again | Rejouer |
| game.btn.level | 换个对手 | Change level | Changer de niveau |
| game.leave.title | 离开对局？ | Leave this game? | Quitter cette partie ? |
Fr decimals use a comma ("5,5"). zh-CN uses 目 as the unit of margin only after the learner met it in Unit 13/14 (otherwise "子"
— developer: check the unit text and pick the same word). `game.level.*` names are the Easy/Normal/Challenge names (PO idea, M4 §16).

## 10. Correctness check (done by the designer by hand)
Eye test used by every level (9×9, `.` empty):
```
 a b c
3 O O .      '.' at c3?  not an eye.
2 O . O      b2: neighbours a2 O, c2 O, b1 O, b3 O -> orthogonal all own.
1 O O O      diagonals a1 O, c1 O, a3 O, c3 '.'  -> corner/edge rule applies only on the edge;
             b2 is an interior point: needs >= 3 of 4 diagonals own -> 3 of 4 (a1,c1,a3) -> real eye. OK
```
```
 a b c        Edge eye at b1: neighbours a1 O, c1 O, b2 O; edge rule needs both on-board diagonals (a2, c2) own.
2 O O O       a2 O, c2 O -> real eye.  If c2 were empty -> false-ish eye (opponent can play c2 if it is not suicide) -> not an eye.
1 O . O
```
(Dev check, §12b: both diagrams verified with `parseBoard` + `isOwnEye` in `src/bot/eyes.test.ts`; the only error was the
column header "a b c d" over three columns in the second diagram, now "a b c".)
Atari-save fixture for AC 4: White `d5`,`d6`; Black `c5 c6 e5 e6 d4`; White's group has one liberty `d7`; White to move. Extending to `d7` gives
the group {d5 d6 d7} liberties c7, e7, d8 = 3 (>= 2, not self-atari) -> saves. Ladder caution: if d8/c7/e7 were Black, the extend would be atari again.
Komi: Black total − White total (without komi) = `x`; Black wins when `x > 5.5`, so margin is always x.5 (no draws).
Playouts end only on two passes or the ply cap; the final board can contain dead groups, which is an accepted bias (area score
still counts them as stones). I did not run the code; the developer must verify the fixtures with `parseBoard`/`checkMove`.

## 11. Out of scope
Handicap games (curriculum Unit 15 says "then handicap games" — later item); Learner as White; 13×13/19×19; time controls; undo/take-back;
saving a game in progress; online play; "Ask the teacher" tutor (M7); pondering/MCTS tree search with UCT (flat MC only); opening book;
settings screen for komi (M6 settings item will expose komi 5.5/7.5 later); rating/Elo display; new sounds; superko.

## 12. Open decisions for the PO (recommended default first)
a. **Count / Count now / Resign flow in this item or split?** Default: **in this item.** The bot is unusable without a defined end;
   the mark runner and count UI are reused, so cost is moderate. Splitting leaves a game that cannot finish. If the PO prefers to
   split: this item ships picker + play + two passes + automatic count with the bot's dead proposal only (no dispute UI), and the
   dispute/Play on/Resign-count go to a follow-up roadmap item.
b. **Is "Easy / Normal / Challenge" the same as levels 1–3?** Default: **yes, same.** Level 1 = Easy (the M4 values become the
   starting point), 2 = Normal, 3 = Challenge. Note the M4 "Normal" (the §16 blunder values) is a *Capture Go* difficulty, not a 9×9
   level; Capture Go stays unchanged and keeps its automatic ease. Separate selectable difficulty inside Capture Go = a later item.
c. **Komi on 9×9:** Default **5.5** (explicit in the game config; fair for a weaker bot and a learner playing Black; engine `defaultKomi(9)`
   stays 7.5 because many tournaments use 7). Alternative 7.5 (matches the engine default and `CLAUDE.md`), harder for the learner. Make it a
   constant `GAME_KOMI_9 = 5.5` so the future settings item can change it. Lessons use 0.5 on small boards, so there is no contradiction.
d. **Learner colour / handicap:** Default **learner = Black, no handicap, even game.** Colour choice and handicap (curriculum "then handicap
   games") become a follow-up item once Easy is beaten reliably.
e. **Dead-stone disagreement:** Default **the engine decides when it can prove, otherwise the learner's marks stand; "Play on" resumes the
   game** (§4.4, AC 28–32). The bot never lies: every refusal states a fact (liberties, two eyes). Alternative: always let the learner win
   disputes (simpler, teaches less) or always require Play on (strict, slower).
f. **Entry point:** Default **Home card "Play 9×9" unlocked by ≥ 1★ on Unit 14, plus a button on the Unit 14 result screen.** Alternative:
   a map node after Unit 14 ("Unit 15 First full games"); lighter for the layout but ties games to the lesson path. No lock for the three levels.
g. (extra) **Level 3 budget:** Default 1 200 playouts (≈ 100 × 12 candidates), 110-ply cap; the developer measures time and may reduce.
h. (extra) **Resign counts as a loss, quitting counts as nothing; no game save in v1.** Default yes.

## 12a. PO decisions (2026-10-21)
The PO approved the spec as written: all defaults a–h accepted.
- PO 2026-10-21: weaken Challenge to ~25–35 % Sensible wins (keep L3 vs L2 ≥ 65 %, L3 vs L1 ≥ 90 %). Done with a seeded softmax pick, §6.3 / §12b.

## 12b. Dev deviations and measurements (developer, 2026-10-21)
**Level 3 speed (AC 7).** Measured first with the immutable engine: 1 200 random 9×9 playouts with `legalMoves` + `play` took
**≈ 8.6 s** per move on desktop Node 22 (Apple M3 Pro). So the playouts run on a new **mutable playout board**
(`src/bot/playout.ts`, pure, no I/O; `playout.test.ts` checks legality, captures, ko, eyes, capture lists and the area score
against the engine on thousands of random positions). Result with the full budget (`MC_PLAYOUTS = 1200`, 12 × 100, 110 plies),
`TUNE_SEEDS=10 TUNE_PAIRS=L3-L2 npm run tune:bot9`, one process: **level 3 mean 170 ms, p95 238 ms, max 270 ms per move**
(< 400 ms → budget kept, no reduction). Under 5 parallel tuning processes: mean 133–179 ms, p95 ≤ 248 ms, max 636 ms (the
max includes the after-pass dead-stone check). Levels 1–2: < 1 ms mean, ≤ 40 ms max.

**Tuning (AC 8–9)**, `npm run tune:bot9`, seeds 1–100 × both colours (200 games per row), komi 5.5, L1 blunder 0.5.
First run (level 3 always played its best value): L3 vs L2 99.0 %, L3 vs L1 100.0 %, Sensible vs L3 **0.5 %**.

**Weakened Challenge (PO 2026-10-21).** The budget is unchanged (`MC_PLAYOUTS = 1200`, 12 × 100, 110 plies, prior 0.01). Only the
final pick changed: a seeded softmax over the candidate values with `MC_TEMPERATURE = 0.21` (`softmaxPick`, one draw from
`deriveSeed(plySeed, 0x5eed)`, so a move still replays from its seed). Urgent captures / saves remain the only candidates when they
exist, so AC 3–4 hold. Temperature sweep (Sensible vs L3 / L3 vs L2): 0.03 → 0 / 95 % and 0.10 → 10 / 90 % (20 seeds);
0.17 → 20 / 82 %, 0.22 → 21 / 64 % (50 seeds); 0.20 → 22 / 70 %, **0.21 → 24 / 68 %** (100 seeds). Higher temperatures push
L3 vs L2 under 65 %, so 0.21 is the closest to §7 that keeps AC 8.

| Pairing (A vs B) | A wins | A as Black | A as White | Plies mean / max | Target | OK |
|---|---|---|---|---|---|---|
| L2 vs L1 | 98.0 % | 97/100 | 99/100 | 90 / 127 | ≥ 80 % | yes |
| L3 vs L2 | 68.0 % | 61/100 | 75/100 | 71 / 100 | ≥ 65 % | yes |
| L3 vs L1 | 96.0 % | 95/100 | 97/100 | 88 / 133 | ≥ 90 % | yes |
| Sensible vs L1 | 88.0 % | 84/100 | 92/100 | 99 / 142 | ≥ 70 % | yes |
| Sensible vs L2 | 20.0 % | 12/100 | 28/100 | 81 / 107 | report only (§7: 50–60 %) | far off |
| Sensible vs L3 | 24.0 % | 23/100 | 25/100 | 84 / 114 | Sensible loses ≥ 60 %; §7 25–35 % | yes / ≈ |

(L2 vs L1 and Sensible vs L1 do not involve level 3: unchanged.) Level 3 time per move with the softmax, 6 tuning processes in
parallel: mean 147–178 ms, p95 ≤ 258 ms, max 445 ms (the max includes the after-pass dead-stone check under load); one process
earlier: mean 170 ms, p95 238 ms → AC 7 holds, the pick itself costs nothing measurable.

No game threw, none passed 142 plies, all ended by two passes (the hard cap 200 never triggered). **For the PO:** Easy matches §7
(88 % ≈ 85 %). Challenge is now 24 %, one point under the 25–35 % band: the band and AC 8's L3 vs L2 ≥ 65 % pull against each other
because **Normal is already harder for Sensible (20 %) than §7's 50–60 %** — Sensible beats Normal less often than the band asks of
Challenge. Normal was not changed (PO instruction); retuning Normal or a learner model closer to a real beginner is a later decision.

**Deviations**
1. `§10` / AC 4: both eye diagrams verified with the engine (`eyes.test.ts`); only the header of diagram 2 was wrong ("a b c d"
   over three columns). AC 4's first wording was muddled; it now points to the §10 fixture (verified: `d7` gives 3 liberties).
2. Level 3 candidates: when a safe capture or a save exists, **only** those are candidates (else 100 random playouts cannot see a
   2-stone save and AC 3–4 failed for some seeds); at most 12 candidates (not 14) so AC 6's 1 200 stays exact. Candidate value
   adds a prior `MC_PRIOR_WEIGHT = 0.01 ×` level-2 score. No "pass" candidate: passing is the AC 10 rule (ahead after the bot's
   own dead-stone proposal, max 3 play-on answers), shared with level 2.
3. Dead-stone playouts run to the end of the game (two passes, cap `DEAD_PLAYOUT_PLIES = 150`) instead of 60 plies: with 60,
   lone invaders were only ≈ 55 % captured (undecided). ≤ 2-liberty groups that `forcedCapture` cannot capture take their
   playout status (alive / undecided) instead of always "undecided" (gives the AC 28 "two eyes" fact). A seki fixture is
   `undecided` (learner's marks stand). Note: a 2-stone inner group sharing 2 liberties with a ring is *not* seki (after the
   capture the attacker kills the bent three) — the engine proof found that; the test uses a 4-stone inner group.
4. Level 2 (§6.2) concrete rules: quiet moves inside a *settled* region (empty region bordered by one colour, ≤ 12 points) are
   not candidates (own territory is useless under area scoring, opponent's is a hopeless invasion); captures, saves and ataris
   still are. The bot passes when nothing is left or the best score is below −6 (only self-atari left, AC 12). Ladder check for
   a 2-liberty save: `forcedCapture`, 8 moves, 800 nodes.
5. Level 1 `board9` (§6.1): passes when every non-eye move is a non-capturing self-atari (AC 12); the AC 11 check (after an
   opponent pass, play only capture / save / atari) ignores the blunder roll; still exactly 3 rng draws; Capture Go unchanged.
   The M4 test "levels 2 and 3 fall back to level 1" (M4 AC 15) was replaced by M6 AC 1 (levels registered).
6. i18n keys use the namespace `game9.*` (not `game.*`): `game.turn.you`, `game.turn.bot` already exist for Capture Go. Extra
   keys: `game9.entry.beaten`, `game9.level.{1,2,3}.short`, `game9.picker.challengeBeaten`, `game9.passExplain.ok`,
   `game9.btn.home`, `game9.leave.body`, `game9.leave.confirm`, `game9.a11y.*`, `game9.black`, `game9.white`; the count rows
   show "= total". zh-CN margin unit is 点 (Unit 13 wording: "黑胜 2.5 点"), not 目. Illegal-move and capture lines reuse the
   Capture Go keys `game.fb.illegal.*`, `game.fb.captured`, `game.fb.botCaptured`.
7. "Shown once, stored in settings" (AC 19, 37): there is no settings store, so the flags `passExplained` / `easierTipShown`
   live in the progress store (`flags`, additive like `bots`). The easier tip is shown once ever. The explainer sheet has
   [Got it] (passes) and [Keep playing].
8. *Play on* when the **bot** passed first: replaying the moves minus the passes would give the bot the move, so its pass is
   kept and the learner is to move (AC 31 "learner to move").
9. Pre-selection: any win at any level → Normal (AC 15/36 literally); nothing locked.
10. Unit 14 result: a secondary button "Play 9×9" on `u14-end`'s result (the *Next* button still opens the next lesson).
11. Not done: a win/loss sound or fade beyond the existing stone sound (no new asset; AC 34 "existing success feedback" is the
    result card's green dot); a thrown bot error falls back to a random legal move but is not logged (no `console` in pure code).

## 13. Risks
- Level 3 speed on a phone: the engine is immutable (array copies per move). 1 200 × ~80 plies ≈ 100 k plays; if `play()` costs ~5 µs on
  desktop Node it is ≈ 0.5 s, on a phone possibly 2–3 s. The developer MUST measure first (AC 7) and, if needed, add a mutable
  playout board inside `src/bot` (still pure, still tested against the engine) or cut playouts.
- Flat Monte-Carlo can play odd moves and over-value filling dame; it is "Challenge" for a beginner, not strong Go.
- Dead-stone judgement by playouts can disagree with human judgement in seki/ko positions; the "learner's marks stand when unsure" rule
  limits harm, and "Play on" lets the board decide.
- A 9×9 game is longer than a lesson (see §7).
- Level 1 must never fill its own eyes, otherwise games end in silly deaths; this changes the `level1` path used by Capture Go. Keep Capture
  Go recorded games stable by guarding the new rules behind a `board9` option (default off), tested by the existing M4 AC 4 replay.
- `PLAYOUT` and `proposeDead` use the same code, so a bug appears in both; test them with ASCII fixtures first.

## 14. Testability notes
- All logic is in pure TS (`src/bot/{level2,level3,playout,deadStones}.ts`, `src/game9/session.ts`): Jest with ASCII boards (`.` `X` `O`), fixed seeds.
- Required unit tests: eye detection (corner/edge/centre, false eye), level 2 priorities (each rule in §6.2 one fixture), level 3 determinism and
  playout count, pass decisions (AC 10–12), `proposeDead`/`judgeDeadMarks` (proved dead group in atari, two-eye alive group, ko/seki "unsure"),
  `session` reducer (pass×2 → mark; Count now; Resign; Play on replays moves minus the trailing passes), progress `bots` round trip.
- `npm run tune:bot9`: bot-vs-bot and scripted-learner win rates (AC 8) and per-level time table (AC 7). Not in `npm test`; the
  report is appended to this spec (as M4 §16).
- Web check `npm run verify:web:m6` at 360×740: picker, playing, mark, dispute sheet, count, result, resigned (screenshots
  `docs/screenshots/M6/`), like the earlier milestones. iPhone checklist `docs/specs/M6-iphone-checklist.md` (bot time, sound, layout).
