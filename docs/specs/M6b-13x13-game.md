# M6b-1 — 13×13 game vs the bot

Status: DRAFT for PO approval. Roadmap: `docs/ROADMAP.md` M6b item 1. Builds on `M6-bot-levels.md`,
`M6-beginner-friendly.md`, `M6-game-coaching.md`. Rules: Chinese (area scoring 数子法), simple ko.

## 1. Goal
After this item a learner who has played 9×9 can choose the 13×13 board, pick a bot level and a handicap, and play a
complete, correctly scored game on a 360×740 phone with reliable stone placement.

## 2. User stories
1. As a beginner who beat the 9×9 bot, I want a bigger board so that I can practise more than one corner fight.
2. As a beginner, I want to pick the board size next to the level so that I know what I am starting.
3. As a beginner, I want handicap stones on the right points of the bigger board so that the game is fair.
4. As a beginner with thick fingers, I want to see where my stone will land before it is placed so that I do not misplay.
5. As a beginner, I want the bot to answer within a couple of seconds so that the game does not feel stuck.
6. As a beginner, I want hint, take-back, danger rings and the end-of-game count to work as on 9×9.
7. As a returning learner, I want 13×13 and 9×9 progress kept separately so that a 13×13 loss does not change my 9×9 handicap.

## 3. Decisions in this spec (details in section 11, defaults accepted unless the PO changes them)
| Topic | Default |
|---|---|
| Komi even game | 6.5 (`GAME_KOMI_13`); handicap game 0.5 (as 9×9) |
| Handicap | 0, 2, 3, 4, 5; order d4, k10, k4, d10, g7 |
| Suggested start | Easy 2, Normal 4, Challenge 5 (provisional, tuned in M6b-2) |
| Auto-adjust | ±1 per result, separate from 9×9 |
| Size picker | segmented control "9×9 / 13×13" on top of the opponent screen `app/game/index.tsx` |
| Lock | 13×13 unlocked once the learner has beaten any 9×9 level once |
| Touch | existing preview + crosshair + coordinate tag, slide to adjust, lift off board = cancel; no magnifier; optional "Confirm each move" switch (default off) |
| Bot speed | count-based budget, target ≤ 2 s per move (p95 ≤ 3 s) on a mid-range Android; "Thinking…" after 0.5 s |
| Take-back, hint, danger rings, coaching notes, count | ON (same rules as 9×9) |
| Post-game review 复盘 | OFF for 13×13 in this item (hidden); comes in M6b-2 |

## 4. Acceptance criteria
Board coordinates: columns a–h, j–n (no "i"), rows 1–13, a1 bottom-left, as in `src/board/geometry.ts`.

### 4.1 Size picker and unlocking
1. **Given** the opponent screen `/game`, **when** it opens, **then** a size control with two segments "9×9" and "13×13" shows above
   the level cards; "9×9" is selected the first time; the last chosen size is remembered between launches (`flags.gameSize`).
2. **Given** no 9×9 level is beaten (`bots[1..3].beaten` all false), **when** the screen opens, **then** the "13×13" segment is
   shown dimmed with a lock icon, tapping it shows the note `game.size.locked` (no navigation, no size change).
3. **Given** at least one 9×9 level is beaten, **when** the screen opens, **then** "13×13" is selectable.
4. **Given** 13×13 is selected, **when** the level cards show, **then** each card shows the 13×13 "Beaten" badge from `bots13`
   (independent of the 9×9 badges), and the handicap row shows the 13×13 suggestion (4.3).
5. **Given** 13×13 and a level are chosen, **when** the learner taps Start, **then** `/game/play` opens with `size=13`, level,
   handicap; a missing or invalid `size` param falls back to 9 (existing 9×9 links keep working unchanged).
6. **Given** the Home/Learn 9×9 card, **when** unchanged, **then** it still opens the 9×9 flow (card title "9×9 game" unchanged;
   the size can be switched on the next screen).

### 4.2 Komi, handicap, setup
7. **Given** an even 13×13 game, **when** it starts, **then** the engine game is `createGame(13, {komi: 6.5})`, Black (the learner)
   moves first, the board is empty, header shows "Komi 6.5".
8. **Given** a handicap game of n ∈ {2,3,4,5}, **when** it starts, **then** komi is 0.5, White moves first, and Black stones
   stand exactly on the first n of `d4, k10, k4, d10, g7`:
   - n=2: d4, k10. n=3: + k4. n=4: + d10. n=5: + g7.
   - All are on the 4th line (star points 星位 xīngwèi); `g7` is 天元 tiānyuán, the centre.
9. **Given** the handicap chips, **when** 13×13 is selected, **then** the chips are Even, 2, 3, 4, 5 (1 is not offered; 6–9 not
   offered in this item) and the explain line uses the right komi: `game.picker.explain` / `explainEven` take `{{komi}}`
   (no hard-coded "5.5").
10. **Given** the engine, **when** `handicapStones(13, n)` is called with n outside {0,2,3,4,5}, **then** it throws; for
    `handicapStones(9, n)` the result is identical to today (regression test: c3, g7, g3, c7, e5).
11. **Given** a 13×13 game, **when** it is over by two passes and counted, **then** the score is area scoring with the session's
    komi: Black = stones + enclosed empty points, White = stones + territory + komi; the total is on a 169-point board
    (Black + White raw area = 169 with no dame left unaccounted: neutral points count for nobody).
    Example: Black 90, White 79 raw area, komi 6.5 -> White 85.5, **Black wins by 4.5**.
12. **Given** a handicap game, **when** counted, **then** the rows use komi 0.5 and the result text says "half a point" like 9×9.

### 4.3 Suggested handicap and auto-adjust
13. **Given** nothing stored in `bots13`, **when** the picker opens, **then** the suggested chip (marked "advised") is Easy 2,
    Normal 4, Challenge 5. The tag text is the same `game9.picker.suggested`.
14. **Given** a finished 13×13 game with handicap h at level L, **when** it ends, **then** `bots13[L].handicap` = h-1 step on a win,
    h+1 step on a loss or resignation (steps 5→4→3→2→0 and back, same as 9×9), and `bots[L]` (9×9) is untouched.
15. **Given** the learner wins at handicap 0 (even) on 13×13, **then** `bots13[L].beaten = true`, shown as "Beaten" on that card.
16. **Given** a 9×9 result, **when** stored, **then** `bots13` is untouched (no seeding from 9×9; see open decision 4).
17. **Given** an old save with no `bots13`, **when** the app starts, **then** it loads with defaults and no data of 9×9 is lost
    (storage migration test).

### 4.4 Game screen and touch
18. **Given** a 13×13 game at 360×740, **when** it renders, **then** the whole screen fits without scrolling: header, board,
    feedback line, one button row; the board is square and as wide as the screen minus 12 px side padding (336 px).
    With coordinates, cell ≈ 23.3 px (margin 1.2 cells); without, ≈ 25.5 px. The whole play screen needs no vertical scroll;
    the count view may scroll.
19. **Given** the board cell is below 44 px, **when** the learner touches the board, **then** on touch-down a ghost stone appears
    at the nearest intersection, a crosshair (row + column lines) and the coordinate tag (e.g. "G7") appear 56 px above the
    point (already in `GoBoard`: `crosshairOn = cell < 44`), and the stone is placed only on touch-up.
20. **Given** a preview is showing, **when** the finger slides to another intersection, **then** the preview, crosshair and tag
    follow; **when** the finger lifts outside the board or on an illegal point, **then** nothing is placed. Illegal points show the
    existing dashed red ring and the engine reason (occupied, suicide, ko).
21. **Given** a touch that lands between two intersections, **when** lifting, **then** the nearest intersection (rounded)
    is used; the hit area per intersection is the full cell, no dead gaps (test: every pixel inside the grid maps to a point).
22. **Given** the "Confirm each move" switch is on (picker screen, per game, default off), **when** the learner lifts the finger on
    a legal point, **then** the stone stays as a preview and a Play button (≥ 44 px high) appears in the button row; tapping another
    point moves the preview; tapping Play commits. Off: lift commits.
23. **Given** the interactive 13×13 board, **when** touched, **then** the stones, tags and the last-move marker stay readable:
    stone diameter ≥ 21 px, last-move marker visible, atari rings (danger) visible without hiding the stone.
24. **Given** all buttons on the screen (Pass, Count now, Resign, Hint, Take back, Play, menu), **then** each has a hit area ≥ 44×44 px
    (the board points are the only exception, covered by 19–21).

### 4.5 Playing, bot, speed
25. **Given** a 13×13 session, **when** the learner plays and passes, **then** the reducer uses the engine with size 13: legal-move
    checks, capture, ko, suicide and pass rules are identical to 9×9; a test replays the same scripted game on 9 and 13.
26. **Given** the maximum game length, **when** plies reach `MAX_PLIES_13 = 400`, **then** the game ends as the 9×9 cap does
    (cap scales with area: 200 × 169/81 ≈ 417, rounded to 400).
27. **Given** the bot at level 1, 2 or 3, **when** it must move on 13×13, **then** it returns a legal move or pass; level 1 and 2 use
    the same rules as 9×9 with `board9` options generalised (section 8).
28. **Given** level 3 on 13×13, **when** it thinks, **then** the playout budget is `MC_PLAYOUTS_13 = 600` (12 candidates × 50),
    `MC_MAX_PLIES_13 = 220`; the budget is a count, never a clock (same seed -> same move, as AC 6 of M6-bot-levels).
29. **Given** a mid-range Android phone, **when** a level 3 move is computed, **then** it finishes in ≤ 2 s on average and ≤ 3 s at
    p95 (manual device check by the PO; Jest asserts only the count and a desktop smoke bound of ≤ 1.5 s). Level 1 and 2: ≤ 0.3 s.
30. **Given** the bot thinks more than 0.5 s, **when** it still has no move, **then** the status line shows `game.thinking`
    ("Thinking…"), the board is locked, and the buttons Resign and Menu stay enabled; it never shows before 0.5 s (no flicker).
31. **Given** the bot is computing, **when** the learner leaves the screen, **then** the result is dropped without error.

### 4.6 Features kept on 13×13
32. **Take-back 悔棋** — same allowance per level as 9×9 (Easy unlimited, Normal 3, Challenge 1); taking back removes the bot reply
    and the learner's move; works with handicap and after a pass.
33. **Hint 提示** — works on 13×13 with level-2 `scoreMoves`; unlimited on Easy/Normal, 3 on Challenge; the hint is shown as the
    `diamond` marker; time ≤ 0.3 s.
34. **Danger rings and atari line** — `dangerOf` runs with size 13 and uses the right coordinate labels (e.g. "K10", no "I").
35. **Coaching notes** — shown on 13×13 using the same engine facts; if a note cannot be built it is simply absent. Quality on the
    bigger board is checked in M6b-3.
36. **Count now / dead-stone marking** — works with size 13: the bot proposes dead groups (forcedCapture + scaled playouts), the
    learner taps a group to toggle it, the table shows stones + land + komi = total. The proposal's *quality* is tuned in M6b-2.
37. **Post-game review 复盘** — the Review button is hidden on 13×13 (shown on 9×9 as today).
38. **Resign** — works; counts as a loss for auto-adjust.

### 4.7 Regression and i18n
39. **Given** 9×9, **when** the whole 9×9 flow runs, **then** every existing 9×9 test passes unchanged (komi 5.5, stones c3…e5).
40. **Given** the three language files, **when** tests run, **then** every key in section 7 exists in zh-CN, en and fr and has the same
    `{{params}}`; the existing i18n parity test passes.
41. **Given** the screen-reader setting, **when** a stone is placed, **then** the announcement uses the 13×13 label (e.g. "Black K10").
    Reduced motion and sound settings behave as on 9×9.

## 5. Screen flow
```
Learn / Home --(9×9 card)--> /game (opponent) --Start--> /game/play?size=13&level=2&handicap=4 --> count --> result
                             [size control] [level cards] [handicap chips] [Confirm each move] [Start]
```

### 5.1 Opponent screen (360×740, scrolls if needed)
```
┌──────────────────────────────────┐
│ <  Choose your opponent          │ 48 px header
│                                  │
│  Board size · 棋盘 qípán         │
│  ┌──────────────┬─────────────┐  │ segmented, 48 px high, each ≥ 44 px wide
│  │   9×9    ✓   │  13×13  🔒  │  │
│  └──────────────┴─────────────┘  │
│  (locked) Win a 9×9 game to      │ note, 14 px, only when locked or 13×13 chosen
│  unlock 13×13.                   │
│  ┌────────────────────────────┐  │
│  │ 入门 Easy           Beaten │  │ level cards as today (3)
│  └────────────────────────────┘  │
│  ...                              │
│  Handicap · 让子 ràngzǐ           │
│  [Even][ 2 ][ 3 ][ 4 ][ 5 ]      │ chips 44 px; "advised" tag under suggested
│  You play Black with 4 stones... │
│  [ ] Confirm each move           │ switch, only when 13×13
│  [          Start             ]  │
└──────────────────────────────────┘
```
States: locked, 13×13 selected, size switch keeps the chosen level but resets handicap to that size's suggestion.

### 5.2 Game screen (13×13)
```
┌────────── 360 ───────────┐
│ Normal · 4 stones · Komi 0.5  ⋯  │ 44 px header (menu = Resign / Leave)
│ ┌──────────────────────────────┐ │
│ │ 336×336 board (≈ 23 px cell)  │ │ y 52–388
│ └──────────────────────────────┘ │
│  Your move, Black.   [Thinking…] │ feedback/status card, min 64 px  y 396–460
│ [Hint] [Take back] [Pass] [Count]│ one row, each ≥ 44 px high    y 472–524 (+12 padding)
└──────────────────────────────────┘ (~200 px spare for the Confirm / Play button and text scale)
```
States: your turn, preview, preview+confirm (Play button replaces Hint's slot only when the switch is on: row becomes
[Play] [Take back] [Pass] [Count]), bot thinking, illegal-move ring + reason, atari note, hint, game-over -> count view (table
and Resign/Play on as on 9×9), result. With large system font the feedback card may grow; the board never shrinks below 336 px.

## 6. Game design notes
- A 13×13 game is about 25–45 moves per side, around 10–15 minutes: longer than the 3–5 minute rule, so the opponent screen says so
  (`game.size.time13`) and a game can be left at any time (no save in v1, as 9×9; leaving = loss for no one, no auto-adjust).
- Difficulty: the bigger board favours the stronger player; handicap defaults are provisional (open decision 3).
- Feedback moments as 9×9: stone sound, soft capture animation, danger ring, win card; no new art. Failure (loss) shows the engine
  fact line; after a loss the next suggestion rises one stone. After 3 losses in a row at the top handicap nothing more is added
  (same as 9×9 cap; offer Easy via the card).
- Stars/rewards: "Beaten" badge only; no new stars.

## 7. i18n keys (new; existing `game9.*` keys are reused, two are parametrised)
zh-CN first use gets pinyin; en and fr follow.
| key | zh-CN | en | fr |
|---|---|---|---|
| `game.size.title` | 棋盘 qípán 大小 | Board size | Taille du plateau |
| `game.size.9` | 9×9 | 9×9 | 9×9 |
| `game.size.13` | 13×13 | 13×13 | 13×13 |
| `game.size.locked` | 先赢一盘 9×9，就能解锁 13×13。 | Win a 9×9 game to unlock 13×13. | Gagnez une partie 9×9 pour débloquer le 13×13. |
| `game.size.time13` | 更大的棋盘，约 10–15 分钟。 | A bigger board: about 10–15 minutes. | Un plus grand plateau : environ 10 à 15 minutes. |
| `game.confirm.label` | 每步确认 | Confirm each move | Confirmer chaque coup |
| `game.confirm.desc` | 先预览，再点“落子” | Preview first, then tap Play | Aperçu d'abord, puis touchez Jouer |
| `game.confirm.play` | 落子 | Play | Jouer |
| `game.thinking` | 对手思考中… | Thinking… | L'adversaire réfléchit… |
| `game.header.size` | {{size}}路 · {{level}} · {{n}}子 · 贴目 {{komi}} | {{size}}×{{size}} · {{level}} · {{n}} stones · Komi {{komi}} | {{size}}×{{size}} · {{level}} · {{n}} pierres · Komi {{komi}} |
| `game9.picker.explain` | (existing) komi now `{{komi}}` | (existing) | (existing) |
| `game9.picker.explainEven` | (existing) komi now `{{komi}}` | (existing) | (existing) |
| `game.a11y.sizeSelected` | 已选 {{size}} 路棋盘 | {{size}}×{{size}} board selected | Plateau {{size}}×{{size}} sélectionné |
Terms: 路 lù is how Chinese counts board lines ("十三路盘 shísān lù pán" = 13×13 board); 贴目 tiēmù and 让子 ràngzǐ keep
their existing pinyin from 9×9. The 9×9 header key stays as is.

## 8. Engine and bot notes (pure TS, no React in `src/engine`, `src/bot`)
- Engine already supports `BoardSize` 13 and `defaultKomi`; nothing new in rules. Add `GAME_KOMI_13 = 6.5` in `config.ts`.
- Generalise from 9 to N: `createGameSession(size, ...)`, `parseVertex/toVertex(.., size)` in `countView.ts`, `danger.ts`,
  `LevelPicker.tsx`, `ReviewView.tsx`, `GameScreen.tsx` (all hard-code 9 today), `handicapStones(size, n)`, `STARTING_HANDICAP` per
  size, `MAX_PLIES`, `board9.ts` helpers (`board9` option -> `boardN` with the same behaviour on 9; keep Capture Go exports
  unchanged). Keeping the `src/game9` folder name is acceptable for this PR; a rename is a separate refactor.
- Level 3: `MC_PLAYOUTS`, `MC_MAX_PLIES`, candidate count become functions of size (table: 9 -> 1 200 / 110, 13 -> 600 / 220).
  Cost estimate: a playout is ~2× longer and each step ~1.5× dearer, so roughly 4–5× per playout; at half the playouts about 2×
  the desktop 170 ms, i.e. ~350 ms desktop, ~1–2 s on a mid-range phone. If the phone check fails, lower the playouts, never
  add a timer inside `src/bot`. The UI should yield to the event loop between candidates (outside the bot) so "Thinking…" and
  Resign stay responsive.
- Store: `bots13: Record<'1'|'2'|'3', {beaten, handicap}>` and `flags.gameSize`, persisted with a default for old saves.
- Dead-stone proposal, `winRate()`, `eyes.ts`: must accept size without crashing; correctness on 13×13 is tested only for the
  basic cases here (a settled corner, seki-free), strength/accuracy tuned in M6b-2.
- Handicap diagram (13×13, 5 stones; X = Black; checked: all five points on empty intersections, on the 4th line from each edge,
  centre g7):
```
   a b c d e f g h j k l m n
13 . . . . . . . . . . . . .
12 . . . . . . . . . . . . .
11 . . . . . . . . . . . . .
10 . . . X . . . . . X . . .   d10 k10
 9 . . . . . . . . . . . . .
 8 . . . . . . . . . . . . .
 7 . . . . . . X . . . . . .   g7
 6 . . . . . . . . . . . . .
 5 . . . . . . . . . . . . .
 4 . . . X . . . . . X . . .   d4 k4
 3 . . . . . . . . . . . . .
 2 . . . . . . . . . . . . .
 1 . . . . . . . . . . . . .
```
  With n=2 only d4 and k10; n=3 adds k4; n=4 adds d10; n=5 adds g7. Each stone has 4 liberties: no capture or atari at start.

## 9. Deferred
- **M6b-2**: bot strength and win-rate targets per level on 13×13 (as `tune:bot9`), final handicap start table, dead-stone proposal
  accuracy, count tuning, post-game review 复盘 on 13×13, speed tuning on real phones, game-length cap check.
- **M6b-3**: coaching notes and danger rings audited on the bigger board (wording, false alarms, many groups at once).

## 10. Out of scope
19×19, board zoom/pan, magnifier loupe (see decision 5), game save/resume, handicap 6–9, 7×7 games, rematch counters, online play,
new art, new sounds, changes to lessons or the learning path.

## 11. Open decisions (plain language, with recommended default)
1. **Komi 贴目 (points White gets to make up for moving second).** Chinese rules for 19×19 give about 7.5. On 9×9 we use 5.5. For
   13×13 I recommend **6.5**, a half point so there is never a draw. In handicap games keep **0.5** like 9×9.
   Alternative: 7.5 (sounds standard but is harsh for a beginner playing Black).
2. **Which handicap stones.** Recommend the classic positions: lower-left, upper-right, lower-right, upper-left, then centre, on the 4th
   line. Offer 2–5 only (same chips as 9×9). Alternative: also 6–9 later.
3. **Suggested handicap per level at the start.** Recommend Easy 2, Normal 4, Challenge 5. These are educated guesses; real bot
   testing in M6b-2 will correct them. A stone is worth less on a bigger board, so Normal needs more than 9×9 would suggest.
4. **Does the 9×9 handicap carry over?** Recommend **no**: 13×13 keeps its own suggestion and own ±1 adjustments, so a loss
   on one board never changes the other. Alternative: start 13×13 one stone higher than the current 9×9 level.
5. **Placing stones with a finger on a 26 px grid.** A fingertip covers about 40 px, so a stone under the finger is hidden and easy to
   misplace. Recommend: keep what we already built (preview on touch-down, crosshair lines, big coordinate tag above the finger,
   slide to adjust, lift off the board to cancel) plus an optional **"Confirm each move" switch** (default off). No magnifier now.
   After your Android test we decide whether the switch should default to on for 13×13, or whether a magnifier is needed in M6b-2.
6. **Where the size picker lives, and is 13×13 locked?** Recommend: a "9×9 | 13×13" switch at the top of the opponent screen; 13×13
   unlocks after beating any 9×9 level once, with a friendly lock note. Alternative: no lock (easier to try, but a first-timer may
   meet a 15-minute game too early).
7. **Bot thinking time.** Recommend a fixed amount of thinking (not a clock, so games can be replayed): about 2 seconds or less on a
   mid-range Android for Challenge, quick for Easy and Normal, and a "Thinking…" message after half a second. Alternative: fewer
   playouts (faster, weaker Challenge).
8. **Review after the game.** Recommend hiding 复盘 on 13×13 in this item (it is slow and untested there) and enabling it in M6b-2.
   Take-back, hint, danger rings, coaching notes and Count are on now.
9. **Game length.** A 13×13 game takes 10–15 minutes and there is no save. Recommend accepting this for now and showing the time
   hint on the card. Alternative: add game save/resume as its own item first.

## PO approval (2026-10-24)
PO approved the spec with all open-decision defaults (komi 6.5 / 0.5 handicap; d4,k10,k4,d10,g7; start Easy 2 / Normal 4 / Challenge 5; separate 13×13 auto-adjust; preview + optional confirm switch off; picker locked until a 9×9 win; L3 600 playouts; review hidden until M6b-2; no game save).

## 12. Dev deviations (developer, 2026-10-24)
1. **Board width 328 px, not 336** (AC 18): the app's `Screen` gutter is 16 px (as on 9×9), so the 13×13 board is
   328 px; cell 22.8 px with coordinates (24.8 without), stone diameter 21.4 px (≥ 21, AC 23). Fits 740 px with room
   to spare (board + fixed rows = 672 px).
2. **"Thinking…" (AC 30)**: the 9×9 status line already says `game9.turn.bot` ("Bot is thinking…") at once. On 13×13
   the same line switches to `game.thinking` once the bot's turn lasts > 0.5 s (no second tag, so the message is not
   shown twice). 9×9 is unchanged. Resign stays enabled while the bot thinks on 13×13 only (9×9 tests require it
   locked); the reducer accepts `resign` while thinking only for size 13 (`canResignWhileThinking`).
3. **Even-game header**: `game.header.size` has `{{n}} stones`; an even 13×13 game uses the extra key
   `game.header.sizeEven` ("13×13 · Easy · Komi 6.5"). The 13×13 header may wrap to 2 lines (the 1-line version cut
   the komi off at 360 px).
4. **"Beaten" on 13×13** uses the 9×9 rule (any win at that level, `wins > 0`), stored in `bots13` with the same
   record shape as `bots` (games / wins / lossStreak / handicap); no separate `beaten` field. The lock (AC 2) uses the
   same 9×9 rule. `flags.gameSize` is stored only as `13` (absent = 9×9); Erase progress clears it and `bots13`.
5. **Bot generalisation**: option `boardN` added; `board9` is kept as an alias (same behaviour) so recorded tests
   stay unchanged. Level 1's "avoid the first line in the opening" threshold scales with the area
   (`openingEmptyPoints`: 40 on 9×9, 83 on 13×13); dead-stone playouts use 300 plies on 13×13 (150 on 9×9), still
   200 playouts. Level 2 scoring numbers (opening 30 moves, settled region 12) are unchanged on 13×13 (tune in M6b-2).
6. **`handicapStones(size, n)`**: the 9×9 test calls were updated mechanically to `handicapStones(9, n)` (same
   assertions). The 9×9 picker test now checks the rendered explanation text ("… Komi 5.5.") because the key now
   carries `{{komi}}`.
7. **Confirm each move** (AC 22): the Play button takes the Hint slot as §5.2 says, so Hint is not available in
   that mode. The pending stone is drawn by a new optional `GoBoard` prop `pending`.
8. **Review 复盘** stays 9×9-only: `ReviewView` / `src/coach/review.ts` still assume 9×9 (hidden on 13×13, M6b-2).
9. **Picker title** follows the size: `game.entry.title13` ("Play 13×13" / 十三路对弈 / "Jouer en 13×13") when 13×13 is
   selected, `game9.entry.title` otherwise; the Home/Learn card is unchanged (AC 6). `game.confirm.desc` now also says
   that Hint is not available in "Confirm each move" mode (deviation 7).

Measured desktop (Jest, Apple silicon), ms per move on 13×13 positions from a level-2 self-play (20 samples, plies
0–160): L1 ≤ 1, L2 ≤ 1, **L3 mean 154 / p95 249 / max 249** (600 playouts); hint ≤ 1; dead-stone judgement at ply
160: 25 ms. 9×9 L3 for comparison: mean 132 / p95 205. Phone check (AC 29) is for the PO.

## 13. PO change 2026-10-25
Learners did not find 13×13 inside the 9×9 flow. Changes (they replace the parts of §4.1, §5 and §12 they contradict):
- **Learn page**: a separate card **"Play 13×13"** (`game.entry.card13`: 十三路对弈 / Play 13×13 / Jouer en 13×13) right
  below the 9×9 card (same `Game9Card` component with `size={13}`). Locked until any 9×9 win (`isSize13Unlocked`):
  lock icon, the note `game.size.locked` as its second line, not tappable, a11y state disabled. Unlocked: opens
  `/game?size=13`; the second line lists the levels beaten on 13×13 (`bots13`).
- **Picker**: the 9×9 | 13×13 size control is removed. The size comes from the route (`parseSize`): the 9×9 card opens
  `/game` (9×9), the 13×13 card `/game?size=13`. A locked `/game?size=13` falls back to 9×9. Title, komi, time note and
  the Confirm switch follow the route's size. "Change level" after a 13×13 game returns to `/game?size=13`; Close /
  Home return to `/learn` as for 9×9.
- **Store**: `flags.gameSize` and `setGameSize` are removed; an old save that still has it loads normally (the field
  is ignored). Unused keys `game.size.title`, `game.size.9`, `game.size.13`, `game.a11y.sizeSelected` were removed.
- **zh-CN without pinyin** (PO): the zh-CN strings added in this branch carry no pinyin (十三路对弈, 棋盘大小 removed with
  the control); en/fr keep the "Chinese term + pinyin" style where they use a Chinese term.

Affected ACs: **AC 1** now reads "the Learn page shows a 9×9 card and a 13×13 card below it; the size is chosen by the
card (no remembered size)". **AC 2** "with no 9×9 win the 13×13 card is dimmed with a lock icon and the lock note, and
cannot be opened; `/game?size=13` falls back to 9×9". **AC 3** "after a 9×9 win the 13×13 card opens
`/game?size=13`". **AC 4** "on `/game?size=13` the level cards show the `bots13` badges and the 13×13 suggestion".
**AC 6** "the 9×9 card is unchanged and opens `/game` (9×9)". §5 flow: Learn --(9×9 card)--> /game;
Learn --(13×13 card)--> /game?size=13 --Start--> /game/play?size=13&…; §5.1 loses the size segments and the lock note.
Deviation 9 (§12) is superseded: the picker title follows the route's size.
Web check `npm run verify:web:m6b`: Learn page screenshots `docs/screenshots/M6b/00-learn-13-{locked,unlocked}-{zh-CN,en,fr}.png`.
