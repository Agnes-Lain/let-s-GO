# M6b-2 — 13×13 bot levels, dead-stone count and review, tuned

Status: DRAFT for PO approval (2026-10-25). Builds on `M6b-13x13-game.md` (§8, §9, §11, §12, §13), `M6-bot-levels.md` (§7, §12b),
`M6-beginner-friendly.md` (§6) and `M6-game-coaching.md` (review 复盘). Coaching notes and danger rings on 13×13 stay M6b-3.

## 1. Goal
A learner who has beaten a 9×9 bot meets a 13×13 bot that is clearly stronger than the 9×9 one at the same level, still beatable at
the suggested handicap, answers fast on a phone, ends the game with a sensible dead-stone proposal, and can open the post-game
review 复盘 after a 13×13 game.

## 2. User stories
- As a beginner who beat 9×9 Normal, I want 13×13 Normal to feel harder than the 9×9 one, so that the bigger board is a real step up.
- As a beginner, I want the suggested handicap on 13×13 to give me a fair game (about two wins in three), so that I am not crushed.
- As a beginner, I want the bot to answer within about two seconds, so that a 100-move game does not drag.
- As a beginner, I want the end-of-game count to propose the right dead stones, so that I only fix the odd one.
- As a beginner, I want the review 复盘 after a 13×13 game, so that I learn from the one or two moments that mattered.

## 3. Decisions in this spec (details in §11)
| # | Decision | Default |
|---|---|---|
| 1 | "Stronger than 9×9" targets | Sensible wins: Easy 80 %, Normal 40 %, Challenge 12 % (even game) |
| 2 | Handicap table | provisional Easy 2 / Normal 4 / Challenge 5, final value from the script |
| 3 | Phone speed | Challenge ≤ 2 s on mid-range Android = desktop p95 ≤ 330 ms |
| 4 | Review on 13×13 | on, same 1–3 moments, 40 playouts, plies cap 160 |
| 5 | Tuning run | `npm run tune:bot13`, seeded, not part of `npm test` |

## 4. Acceptance criteria

### 4.1 Win-rate targets (tuning player "Sensible" = level-1 rules, no mistakes, never fills own eyes; same definition as `tune:bot9`)
Sensible plays Black (even game: both colours, komi 6.5; handicap: Black, komi 0.5). Games = seeds 1–100 per row (L3 rows: seeds
1–50 for the daily run, 1–100 for the final confirmation; noise ±10 %, so the band, not the point, is the pass test).

| Row | 9×9 today (Sensible wins) | 13×13 target | Pass band (13×13) |
|---|---|---|---|
| Easy, even game | 92.5 % | 80 % | 70–88 % |
| Normal, even game | 57 % | 40 % | 30–50 % |
| Challenge, even game | 24–26 % | 12 % | 5–20 % |
| Easy, start handicap (2 stones) | 97 % (2) | 85 % | 75–92 % |
| Normal, start handicap (4 stones) | 83 % (4), 90 % (5) | 65 % | 50–78 % |
| Challenge, start handicap (5 stones) | 56 % (5, 25 seeds) | 35 % | 20–48 % |

1. Given the tuned constants, When `npm run tune:bot13` runs the six rows above, Then every row's Sensible win rate is inside its
   pass band **and** strictly lower than the 9×9 number of the same row (Easy < 92.5, Normal < 57, Challenge < 24).
2. Given even games, Then Sensible's win rate falls with the level: Easy > Normal > Challenge, each step at least 15 points.
3. Given handicap n = 2…5 for one level, Then the win rate does not fall by more than 8 points when n grows (report if it does).
4. Given bot vs bot on 13×13 (komi 6.5, both colours): L2 beats L1 ≥ 80 %, L3 beats L2 ≥ 65 %, L3 beats L1 ≥ 90 %.
5. Given the 9×9 constants and recorded 9×9 tests, Then nothing in 9×9 changes: `levels9`, `softer9`, `m6.edge` tests stay green
   and `npm run tune:bot9` numbers are unchanged (13×13 values live in separate `_13` constants).
6. Given the "Noob" player (level-1 rules, blunder 0.25, skipSave 0.25), When run at 13×13 handicap 2…5 vs each level, Then the rates are
   reported (no pass test); they feed the table in 4.2.

### 4.2 Starting handicap (13×13, `STARTING_HANDICAP`)
7. Given the tuning output, Then the table is: smallest n in {2,3,4,5} where Noob wins ≥ 60 % vs that level, else 5 (the 9×9 rule,
   `M6-beginner-friendly` §6). Provisional values Easy 2 / Normal 4 / Challenge 5; the developer replaces them with the script's
   result and writes the Noob/Sensible rates for n = 2…5 into §12 of this spec.
8. Given a learner with a saved `bots13` handicap, Then the saved value is kept; only first-time suggestions change. Auto-adjust (±1
   after losses/wins, range 2–5), komi 0.5 and stone positions are unchanged.
9. Given the 13×13 picker, Then the suggestion for each level equals the table; no new string.

### 4.3 Tuning script and knobs
10. Given `npm run tune:bot13` (script `scripts/bot13-tuning.tune13.ts`, own Jest config like `tune:bot9`), When run with
    `TUNE_SEEDS`, `TUNE_PAIRS`, `TUNE_LEVELS`, `TUNE_HANDICAP`, `TUNE_BLUNDER`, `TUNE_SKIP_SAVE`, `TUNE_SKIP_ATARI`, `TUNE_SLIP`,
    `TUNE_TEMP`, `TUNE_PLAYOUTS` set, Then it plays seeded games (same seed, same result), ends them by two passes, counts with the
    bots' own dead-stone proposal and prints per row: games, wins, wins as Black/White, plies mean/max, ms per move (mean, p95, max)
    per level, hint ms, dead-stone-proposal ms. It fails only on a hard error (throw, illegal move, game over 400 plies, game not
    ended by two passes); win rates are a report plus the pass bands of 4.1 printed as OK / OUT.
11. Allowed knobs (13×13 only, new constants in `src/game9/config.ts` and `src/bot`, each with the 9×9 value kept):
    L1 `L1_BLUNDER_13`, `L1_SKIP_SAVE_13`, `L1_SKIP_ATARI_13`; L2 `L2_SLIP_13`, `OPENING_MOVES_13` (9×9: 30),
    `SETTLED_REGION_MAX_13` (9×9: 12; a 13×13 settled area is bigger, expect about 20–30); L3 `MC_TEMPERATURE_13` (9×9: 0.21),
    `MC_PLAYOUTS_PER_CANDIDATE_13` (now 50), `MC_MAX_PLIES_13` (now 220), `MC_CANDIDATES` (12). No other behaviour changes.
12. Given `src/bot`, Then it stays pure: no clock, timer, I/O, React; budgets are counts. The purity test passes. Timing exists
    only in the script and the speed tests.

### 4.4 Speed (desktop proxy; phone factor 4–6×, take 6× for the budget)
13. Given 20 positions from a 13×13 level-2 self-play, plies 0–200, When each level chooses a move in Jest, Then:
    - Level 3: mean ≤ 250 ms, **p95 ≤ 330 ms** (= 2.0 s at 6×), max ≤ 500 ms. (Measured now at 600 playouts: mean 154, p95 249.)
    - Levels 1 and 2: mean ≤ 5 ms, p95 ≤ 20 ms (phone ≤ 120 ms).
    - Hint: p95 ≤ 50 ms. Dead-stone proposal (ply ≥ 120): p95 ≤ 250 ms (phone ≤ 1.5 s); today 25 ms.
14. Given tuning needs more strength than the L3 budget allows, Then strength comes from `MC_TEMPERATURE_13` (lower = best move
    more often) or candidate selection, never from raising playouts above what keeps AC 13. If AC 13 fails after tuning, lower
    `MC_PLAYOUTS_PER_CANDIDATE_13` by steps of 10 and retune the temperature.
15. Given the UI, Then "Thinking…" appears after 0.5 s, Resign stays responsive, the UI yields between candidates (outside the bot).
    The phone check (PO, mid-range Android, one L3 game, no move longer than 2.5 s felt) is a manual step listed in the PR.

### 4.5 Dead-stone proposal on 13×13 (`proposeDead`, coordinates a–n without i, row 13 on top)
Fixtures are hand-checked: every stone has ≥ 1 liberty; no group is already capturable by rule; the expected dead set follows
from correct play. The developer confirms with the engine; a fixture the engine disagrees with is reported, not silently changed.

Base position **W** (two walls; both sides alive with huge territory; 13 stones each):
```
   a b c d e f g h j k l m n
13 . . . . . . . . . . . . .
12 . . . . . . . . . . . . .
11 . . . . . . . . . . . . .
10 . . . . . . . . . . . . .
 9 . . . . . . . . . . . . .
 8 . . . . . . . . . . . . .
 7 O O O O O O O O O O O O O
 6 X X X X X X X X X X X X X
 5 . . . . . . . . . . . . .
 4 . . . . . . . . . . . . .
 3 . . . . . . . . . . . . .
 2 . . . . . . . . . . . . .
 1 . . . . . . . . . . . . .
```
16. Given **W**, When `proposeDead` runs (any seed 1–20), Then it returns no stones (a position with nothing dead is not touched).
17. Given **W** plus White g3 and Black g11 (one lone invader in each big territory, 4 liberties each), Then the proposal is exactly
    {g3, g11}.
18. Given **W** plus White a3, Black a2 and Black a4, with b3 empty (White a3 is in atari on the edge: its only liberty is b3),
    Then the proposal is exactly {a3}.
19. Given **W** plus the two-stone White pair g3, h3 inside Black's area, Then the proposal is exactly {g3, h3}.
20. Given the bottom-left corner position **E** (Black alive with two eyes at a1 and c1; White stones around), Then no Black stone is
    proposed; White stones may be proposed or left undecided (not asserted):
```
   a b c d e f g h j k l m n
 4 . . . . . . . . . . . . .
 3 O O O O . . . . . . . . .
 2 X X X X O . . . . . . . .
 1 . X . X O . . . . . . . .
```
    Black = a2 b2 c2 d2 b1 d1 (one group, 2 eyes: a1 touches a2 b1 only; c1 touches b1 d1 c2 only). White playing a1 or c1 is
    suicide. White = a3 b3 c3 d3 (libs a4 b4 c4 d4 e3) and e1 e2 (libs f1 f2 e3). Everything not shown is empty.
21. Given any group with two or more real eyes, or a group the learner could not capture by rule, Then it is never proposed dead
    (0 false kills in the fixtures above and in 22).
22. **Accuracy over tuning endgames.** Given 30 final positions of L2-vs-L2 and 30 of Sensible-vs-L2 games on 13×13 (seeds 1–30,
    both ended by two passes), When the script plants one lone opposite stone in the biggest single-colour empty region (≥ 15
    points, at least two points from every stone), Then: planted stone proposed dead ≥ 90 % of the cases; stones proposed dead
    in the unplanted positions ≤ 1 per game on average; and the area score changes by ≤ 2 points in ≥ 90 % of the games when the
    proposal is applied. Seeds make this repeatable.
23. Given the count screen (existing), Then the learner can still add or remove marks; the proposal never blocks scoring; a seki
    fixture stays "undecided" (the learner's marks stand), as on 9×9. `DEAD_PLAYOUT_PLIES` for 13×13 (300) may be changed only
    inside AC 13's time limit.

### 4.6 Post-game review 复盘 on 13×13
24. Given a finished 13×13 game (count or resignation) with ≥ 10 moves, Then the result screen shows the Review 复盘 button as on
    9×9 (the 13×13 hiding is removed); under 10 moves it is hidden. Existing buttons stay.
25. Given `buildReview(moves, komi, seed, learner, size)` (new `size` argument, default 9 so old calls are unchanged), Then it
    replays with `createGame(size, …)`, points are written with `toVertex(point, size)` (column letters a–n without i), moments
    are 1–3, sorted by ply, deterministic for the same input and seed, no clock inside.
26. Given a 13×13 game, Then the moment rules are those of 9×9: bigCapture ≥ 2 stones, lostGroup ≥ 3 stones, swing when the
    learner's win chance drops ≥ 0.30. Budget: ≤ 24 learner positions sampled evenly (after ply 6), **40 playouts each, playout cap
    160 plies** (9×9: 80), chunks of 4 positions per tick in the UI layer. If none qualifies, "A quiet game. No big moments."
27. Given the speed rules, Then desktop total for a 100-move game ≤ 600 ms (phone ≈ 3.6 s at 6×) and each chunk ≤ 100 ms
    (phone ≤ 600 ms); the static "Preparing the review…" line and the Skip link show during preparation, Skip shows capture
    moments only.
28. Given `ReviewView` on a 13×13 game, Then the board is a read-only 13×13 `GoBoard` 328 px wide (cell ≈ 22.8 px as in the game
    screen), no preview, taps ignored; Prev/Next and the chips "1 2 3" are ≥ 44 px; the whole view fits 360×740 without scrolling;
    the key-point marker, last-move marker and "position just before the moment" behaviour match 9×9 (AC 32 of M6-game-coaching).
29. Given step k, Then the board equals the engine position after k moves (13×13 replay test with captures); screen reader text
    "Move {n} of {N}, {Black|White} at {pt}" uses 13×13 coordinates (e.g. "k10", never "i").
30. Given a 9×9 game, Then review behaves exactly as before (existing review tests unchanged).
31. Given the review on 13×13, Then no new key is needed: reuse `coach.review.*` and `coach.*` fact keys (zh-CN without pinyin;
    en/fr keep 复盘 fùpán). The i18n parity test stays green.

### 4.7 Game-length cap
32. Given the tuning games (≥ 100 per pairing, both colours), Then no game reaches the cap `MAX_PLIES_13 = 400`; plies mean/max are
    reported per pairing; the longest game ≤ 320 (80 % of the cap) — expected mean ≈ 150–200. If the longest is over 320, the cap
    is raised (not the bots changed) and the new cap noted in §12.
33. Given a synthetic position at ply 400, Then the bot passes (same rule as the 9×9 cap at 200) and the game can be counted.
34. Given a learner who plays on and uses take-back, Then take-back never lets the ply count pass the cap by more than the bot's pass.

## 5. Screen flow and UI
No new screen. Changes: the result screen of a 13×13 game shows the existing Review 复盘 button; `ReviewView` draws a 13×13 board
(wireframe, 360×740):
```
┌──────────────────────────────┐
│ ✕  Review 复盘      Hints 1  │
│ ┌──────────────────────────┐ │
│ │   13×13 board, 328 px    │ │  read-only, last move + key point
│ │   (shows position before │ │
│ │    the moment)           │ │
│ └──────────────────────────┘ │
│  [1] [2] [3]  (chips ≥44px)  │
│  Move 62: White captured 3   │
│  stones at k10.              │
│  [◀ Prev]          [Next ▶]  │
└──────────────────────────────┘
```
States: preparing ("Preparing the review…" + Skip), ready, quiet game, skipped (captures only). Same copy as 9×9.

## 6. Game design notes
- Curve for a learner who beat 9×9: Easy ≈ 4 wins in 5, Normal ≈ 2 wins in 5 (a real step up), Challenge ≈ 1 win in 8 even; at the
  suggested handicap the learner should win about 85 % / 65 % / 35 % so progress is possible; handicap stones are the dial, not
  hidden bot weakness. Auto-adjust (±1) keeps the learner near 2 wins in 3.
- Easy stays forgiving (it is the first 13×13 level); the PO's "stronger than 9×9" shows in its smaller blunder rate and in a
  larger board where the bot fills territory carefully. Normal gets a larger settled-region number and fewer slips so it does not
  waste moves on a wide board. Challenge reaches the strength limit of 600 playouts by a lower temperature.
- Feedback unchanged: stone sound, calm result card, "Next time: …" suggestion. Loss reason uses engine facts (unchanged).
- Review is a reward, never a score: no percentages, "Your chances dropped a lot after this move."
- After 3 losses at a level the existing easier-tip applies; nothing is locked.

## 7. Engine and bot notes
- Add `_13` constants next to the 9×9 ones and select by `size` (`mcBudget(size)` pattern). Do not edit 9×9 values.
- `scoreMoves` uses `OPENING_MOVES` and `SETTLED_REGION_MAX`: make them parameters by size with the 9×9 defaults.
- `buildReview` / `ReviewView` / `evaluatePosition`: pass `size`; remove the literal `9` in `replay`, `toVertex`, playout cap.
- Playout cap in review: a function of size (80 / 160). Everything else pure and seeded.
- The script reuses helpers of `bot9-tuning.tune9.ts`; shared code may move to `scripts/tuneCommon.ts` (no change in 9×9 output).
- Running time: L3 rows are slow (about 20–25 s per game). Daily run: L3 rows 50 seeds; final run overnight with 100 seeds.

## 8. i18n
No new user-facing text. If one is unavoidable, it is added in zh-CN (no pinyin), en and fr (Chinese term + pinyin), and the parity
test stays green.

## 9. Deferred / out of scope
- Coaching notes, danger rings and atari line on 13×13 (M6b-3).
- 19×19, game save, magnifier, new sounds/art, 7×7, handicap 6–9, hint quality changes, learner skill estimate, server AI.
- Review on weak devices beyond the chunking above; a hardware benchmark farm.

## 10. Correctness check (designer, by hand)
**W**: row 6 Black wall (13 stones, one group) has liberties along row 5; row 7 White wall along row 8; no stone is adjacent to
an empty point only on one side that could be filled for a capture (walls touch each other, each keeps 13 liberties); legal,
nothing in atari. g3 / g11 / g3+h3 are inside a 65-point area (rows 1–5) with the wall above, so each invader has ≥ 4 liberties
(g3) and cannot make two eyes against correct play. a3 with a2, a4 Black: neighbours a4 X, a2 X, b3 empty → exactly one liberty
(atari); a2 has liberties a1, b2; a4 has a5, b4. **E**: eyes a1 (neighbours a2, b1: both Black) and c1 (neighbours b1, d1, c2:
all Black); the six Black stones are connected (a2-b2-c2-d2, b1-b2, d1-d2); White a1/c1 would have zero liberties and capture
nothing (the other eye stays), so illegal; Black is alive. White e1-e2 and a3-d3 are not connected (e3 and d3-e2 diagonal), each has
liberties as listed.

## 11. Open decisions (plain language, recommended default first)
1. **How much stronger is "stronger"?** Recommended targets, for a careful beginner-level player: Easy beaten 4 times in 5
   (9×9: 9 in 10), Normal 2 in 5 (9×9: 3 in 5), Challenge 1 in 8 (9×9: 1 in 4). Alternative: a bigger step (Normal 1 in 3,
   Challenge 1 in 15) — risk: learners stall and quit; or smaller (Normal 1 in 2).
2. **Handicap table.** Keep Easy 2 / Normal 4 / Challenge 5 as the starting guess; the script's result replaces it. If the script says
   Normal needs 5, accept it (a stronger bot means more stones). Alternative: keep 4 and let auto-adjust raise it after a loss.
3. **Challenge cannot get much stronger on a phone.** Its strength is limited by thinking time (about 2 seconds). Recommended:
   make it stronger by letting it pick its best move more often, not by thinking longer. Alternative: allow up to 3 seconds on
   fast phones only (more code, uneven experience).
4. **Review after 13×13 games.** Recommended: same rules as 9×9 (1–3 moments, shown only for games of 10+ moves), preparing time up
   to about 4 seconds on a phone with a Skip link. Alternative: fewer positions checked (faster, may miss a mistake).
5. **How the tuning is judged.** Recommended: pass bands (e.g. Normal 30–50 %) because 50–100 games are noisy; a final overnight
   run with 100 games per row confirms. Alternative: exact numbers (would need thousands of games, hours of waiting).
6. **Dead-stone proposal.** Recommended: it only marks stones it is sure about (80 % of random endgames agree) and leaves doubtful
   groups to the learner; the learner can always change marks. Alternative: mark more aggressively (fewer taps, more wrong guesses).
7. **Game-length cap.** Keep 400 moves unless the tuning games come near 320; then raise the cap rather than change the bots.

## 12. Dev deviations and measurements (developer fills)
(empty)

## PO approval (2026-10-25)
PO approved the spec with all open-decision defaults.
