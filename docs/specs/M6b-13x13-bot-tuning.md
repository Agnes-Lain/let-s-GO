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
    **Done 2026-10-25: the PO checked L3 on their phone — OK.**

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
22. **Accuracy over tuning endgames** (wording approved by the PO 2026-10-25). Given 30 final positions of L2-vs-L2 and 30
    of Sensible-vs-L2 games on 13×13 (seeds 1–30, both ended by two passes), Then no living stones are proposed dead (0 false
    kills) in the final positions; and when the script plants one lone opposite stone in the biggest single-colour empty
    region (≥ 15 points, at least two points from every stone), the planted stone is proposed dead in ≥ 90 % of the cases.
    Seeds make this repeatable.
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
Measured 2026-10-25 with `npm run tune:bot13` (desktop M3 Pro, Node 22). Seeds are honest counts: even rows = seeds × both
colours; L3 rows were split over processes with `TUNE_FIRST` (same games as one run).

### 12.1 Tuned constants (13×13 only; 9×9 dead stones changed in 12.8)
| Knob | 9×9 | 13×13 |
|---|---|---|
| `L1_BLUNDER_13` / `L1_SKIP_SAVE_13` / `L1_SKIP_ATARI_13` | 0.6 / 0.5 / 0.5 | 0.3 / 0.3 / 0.3 |
| `L2_SLIP_13` | 0.7 | 0.5 |
| `OPENING_MOVES_13` / `SETTLED_REGION_MAX_13` | 30 / 12 | 50 / 25 |
| `MC_TEMPERATURE_13` | 0.21 | 0.06 |
| `MC_PLAYOUTS_PER_CANDIDATE_13` / `MC_MAX_PLIES_13` / `MC_CANDIDATES` | 100 / 110 / 12 | 50 / 220 / 12 (unchanged) |
| `STARTING_HANDICAP_13` | 2 / 5 / 5 | **2 / 5 / 5** (was provisional 2 / 4 / 5) |

### 12.2 Win rates (AC 1–4)
| Row | Games | Sensible wins | Band | < 9×9 | OK |
|---|---|---|---|---|---|
| Easy, even | 200 (seeds 1–100 × 2) | 83.0 % | 70–88 | < 92.5 | yes |
| Normal, even | 200 | 47.5 % | 30–50 | < 57 | yes |
| Challenge, even | 200 | 17.0 % | 5–20 | < 24 | yes |
| Easy, handicap 2 | 100 | 89.0 % | 75–92 | < 97 | yes |
| Normal, handicap 5 | 100 | 60.0 % | 50–78 | < 90 (9×9 at 5) | yes |
| Challenge, handicap 5 | 100 | 31.0 % | 20–48 | < 56 | yes |

AC 2: 83.0 > 47.5 > 17.0 (steps 35.5 and 30.5). AC 4 (200 games each): L2 beats L1 87.0 %, L3 beats L2 96.0 %, L3 beats
L1 95.5 % (the L3 pairs and the 12.3 table were measured before the QA fix of 12.7; not rerun).
The table rows above are after the fixes of 12.7 and 12.8. Before tuning (13×13 with the 9×9 values): Sensible won 97 % / 69 % / 57 % even.

### 12.3 Handicap table (AC 3, 6, 7): Sensible / Noob wins, learner Black, komi 0.5
| n | Easy (100 seeds) | Normal (100 seeds) | Challenge (25 seeds) |
|---|---|---|---|
| 2 | 88 % / **66 %** | 48 % / 23 % | 16 % / 0 % |
| 3 | 92 % / 68 % | 50 % / 36 % | 12 % / 4 % |
| 4 | 96 % / 75 % | 54 % / 32 % | 12 % / 8 % |
| 5 | 94 % / 78 % | 60 % / 33 % | 32 % / 4 % |

Table by the 9×9 rule: Easy 2 (Noob 66 % ≥ 60), Normal 5 and Challenge 5 (Noob never reaches 60 %). AC 3: no fall over 8 points
(largest: Challenge 16 → 12, 4 points; 25 seeds, noisy). Note for the PO: handicap stones help the reference players much less
on 13×13 than on 9×9 (Normal 48 → 60 % from 2 to 5 stones), because Sensible / Noob scatter their moves; Noob loses to Normal
and Challenge even at 5 stones, so 5 is the honest start and auto-adjust cannot go further.

### 12.4 Speed (AC 13, 27) and game length (AC 32)
`npm run test:speed` (Jest alone on the machine; time per position = fastest of 3 runs of the same seeded work):
Level 3 mean 146 ms, p95 243 ms, max 246 ms (phone ≈ 1.5 s at 6×); levels 1–2 and hint < 1 ms (Jest's clock is whole ms);
dead-stone proposal (ply ≥ 120) p95 43 ms; review of a 100-move game 297 ms in all, largest chunk 53 ms.
In the tuning runs (8–10 processes in parallel) level 3 measured mean 156–211 ms, p95 255–351 ms; dead-stone proposal p95
40–53 ms; hint p95 1–2 ms. Plies: mean 155–198 per pairing, longest game 274 (cap 400, 80 % = 320): the cap stays.

### 12.5 Dead stones (AC 16–23)
- All six fixtures (W, W+g3+g11, W+a3, W+g3h3, E, a 13×13 seki) were checked with the engine (liberties, groups, eyes); the
  spec diagrams are correct, none was changed.
- **Behaviour added (deviation):** random playouts alone do not meet AC 17 / 19: a lone invader in W's 65-point area was
  captured in only ~50 % of playouts (`DEAD_RATE` needs 80 %), with any playout length. On 13×13 and bigger, `judgeGroups`
  now also calls a group dead when it is a small invader in an enclosed area: flood from it over empty points and own stones;
  the area touches only opponent stones, every opponent group on its border is alive by playouts (so a seki, whose other
  group is undecided, never counts), it holds ≤ 6 own stones and no own eye, and is at most half the board. 9×9 is untouched.
- AC 22 (seeds 1–30 per pairing): planted stone proposed dead 4/4 (L2–L2) and 4/4 (Sensible–L2). Only 4 of 30 final
  positions per pairing have a single-colour region ≥ 15 points (the bots fill most areas); the plant point is the one
  farthest from every stone by Manhattan distance (≥ 2, touching no stone) — the spec's "two points" read this way.
  Unplanted positions: 5.9 (L2–L2) and 3.2 (Sensible–L2) stones proposed dead per game; area score changed by ≤ 2 in 57 %
  and 83 % of games. These missed the first AC 22 numbers because the bots pass when ahead and real dead groups stay on
  the board; the PO reworded AC 22 to "0 false kills; planted ≥ 90 %" (2026-10-25). Current numbers: §12.8.
- `DEAD_PLAYOUT_PLIES` for 13×13 unchanged (300).

### 12.6 Other deviations
- Review on 13×13: `planReview` / `buildReview` take `size` (default 9) **and the handicap stones** (default none). The
  review used to replay every game from an empty board with Black first, so a **9×9 handicap game's review was wrong**
  (handicap stones missing, colours swapped). `ReviewView` now passes `handicapStones(size, handicap)`; even 9×9 games are
  unchanged. Point names keep the 9×9 style, upper case ("K10").
- The M6b AC 37 test "no Review button on 13×13" is replaced by the M6b-2 AC 24 tests (shown at ≥ 10 moves, hidden below).
  The M6b test of the provisional table (Normal 4) now checks the tuned 5.
- `BotOptions.playoutsPerCandidate` / `temperature` (level 3) and `level3Search(state, seed, tuning)` exist only so the script
  can try `TUNE_PLAYOUTS` / `TUNE_TEMP`; the app never sets them. `TUNE_FIRST` was added to split long runs.
- Speed tests: inside the full `npm test` about ten Jest workers share the CPU and level 3's p95 reached 344–425 ms, so the
  bounds get 1.5× slack there; `npm run test:speed` checks the spec's exact numbers.
- AC 34: take-back only restores an earlier, shorter position. A learner can still play on after ply 400 (the bot answers
  each move with a pass), as on 9×9 after 200; the game ends when the learner passes too.
- AC 15 (phone check): done by the PO on their phone 2026-10-25 — Challenge OK (≤ 2 s per move felt).
- Web check at 360×740: the 13×13 review fits without scrolling (`docs/screenshots/M6b/20-review-13-en.jpg`).

### 12.7 QA round 1 fixes
- **AC 21 false kill (L2–L2 seed 2):** two White groups on the right edge sharing the liberties m7 and n6 (both suicide for
  Black) were proposed dead, because random playouts fill such shared eyes. New sure-alive check on 13×13 (Benson-style with
  one-point eyes): an eye is an empty point whose neighbours are all stones of the remaining own groups; groups touching fewer
  than two eyes are dropped until nothing changes; the rest are always "alive" and never proposed. QA's `it.failing` is now a
  passing test. **9×9 kept identical** by gating it to 13×13: without the gate, `tune:bot9` changed (8 seeds: Noob–L1 75 → 69 %,
  Sensible–L2 50 → 56 %), i.e. the same false kill happens on 9×9 too; enabling it there is a PO decision (fewer false kills,
  new recorded 9×9 numbers).
- **fr count line cut** ("…des deux …" next to "Effacer"): same on 9×9 (shared component). While marking, the count and
  Clear now sit on their own row under the prompt (row height reserved, so the board does not move at the first mark); the
  prompt uses the full card width and fits in two lines (fr checked on 9×9 and 13×13 at 360×740, no page scroll,
  `docs/screenshots/M6b/26-count-marked-13-fr-fixed.jpg`).

### 12.8 PO decisions 2026-10-25
- **AC 22 reworded** (see §4.5): 0 false kills, planted ≥ 90 %. `tune:bot13` now checks every proposed-dead group: proved
  dead by `proposeDead`, or captured by force with a bigger reading budget (opponent first, 6 moves, 20 000 nodes); the
  rest are listed for a check by hand. Seeds 1–30: L2–L2 177 stones proposed dead, 0 unproved; Sensible–L2 89 stones,
  0 unproved; planted 4/4 and 4/4 → OK. The first version of this check found one more false kill (Sensible–L2 seed 1):
  six Black stones around a **straight four** n1–n4 in the corner (alive), called dead by the small-invader rule. Fix: the
  invader rule also needs ≥ 3 empty points per own stone + 6 in the area (`INVADER_SPACE_PER_STONE`, `INVADER_SPACE_EXTRA`),
  so a group sitting in its own eye space is left to the playouts; fixture test added (`deadStones13.test.ts`). 13×13 rows
  re-measured after it: unchanged except Challenge even 16.5 → 17.0 %.
- **Sure-alive rule on 9×9 too** (gate removed). No 9×9 unit test changed (none had a group with two one-point eyes proposed
  dead). `tune:bot9` with the same seeds as the recorded numbers (L1/L2 rows 1–100, L3 rows 1–25), old (M6-beginner-friendly
  §6) → new; all targets still met, start table unchanged (Easy 2 / Normal 5 / Challenge 5):

| 9×9 row | old | new |
|---|---|---|
| Sensible vs Easy, even | 92.5 % | 92.5 % |
| Noob vs Easy, even | 80 % | 80.5 % |
| Sensible vs Normal, even | 57 % | 58 % |
| Noob vs Normal, even | 28 % | 28.5 % |
| Sensible vs Challenge, even (25 seeds) | 26 % | 28 % |
| Noob vs Challenge, even (25 seeds) | 4 % | 6 % |
| Easy handicap 2/3/4/5: Sensible / Noob | 97/95/99/97 / 87/92/93/96 % | 97/97/99/97 / 87/92/93/96 % |
| Normal handicap 2/3/4/5: Sensible / Noob | 71/81/83/90 / 38/47/51/64 % | 73/82/84/90 / 42/47/54/65 % |
| Challenge handicap 2/3/4/5 (25 seeds): Sensible / Noob | 40/64/32/56 / 16/28/24/48 % | 40/64/40/64 / 16/32/24/48 % |
| L2 vs L1 / L3 vs L2 / L3 vs L1 | 90 / 82 / 98 % | 90 / 82 / 98 % |

  The changes are games where a bot's count (pass decision or final count) no longer removes a two-eyed group; by the
  rule's construction only false kills disappear. (M6-bot-levels §12b numbers predate the beginner-friendly constants and
  were superseded by M6-beginner-friendly §6, so the comparison uses §6.)
- **AC 15:** the PO checked Challenge on their phone — OK.

## PO approval (2026-10-25)
PO approved the spec with all open-decision defaults. Follow-up decisions on PR #29: §12.8.
