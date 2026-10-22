# M6 — Beginner-friendly 9×9 (handicap, take-back, atari rings, softer Easy)

Status: DRAFT for PO approval. Builds on `docs/specs/M6-bot-levels.md` (called "bot-levels spec" below; its §12b has the
measured win rates). Chinese rules (area scoring), simple ko. Pure logic stays in `src/game9` / `src/bot` (no React in them).

## 0. In plain words
The PO played 9×9 and even Easy was too hard, and nothing told them why a move was bad. This item makes the first games
winnable and teaches while playing: (1) the learner starts with extra black stones (让子 ràngzǐ, handicap), (2) they can take
back a move (悔棋 huǐqí), (3) groups with one breath left get a ring and one sentence, (4) Easy plays softer, (5) one
web-console warning is removed.

## 1. Goal
After this, a learner who finished Unit 14 can win a first 9×9 game against Easy, can undo a slip, and sees at once which
groups are in atari (叫吃 jiàochī, one liberty 气 qì left).

## 2. User stories
- As a beginner, I want to start with 3–4 stones already on the board so that I can win my first game and learn how it feels.
- As a beginner, I want to be given fewer stones after I win (and more after I lose) so that the game stays fair without my setting it up.
- As a beginner, I want to take back my last move and the bot's reply so that one slip does not spoil a 15-minute game.
- As a beginner, I want my stones in atari marked and explained so that I notice danger before the bot captures.
- As a beginner, I want to see which White stones I can capture so that I learn to look for chances.
- As a beginner, I want Easy to make real mistakes so that I can see how to beat a bot.

## 3. Rules of handicap (checked by hand, then by the engine)
Board 9×9; columns a b c d e f g h j (no i), rows 1 (bottom) to 9. Standard points (星位 xīngwèi): C3 G3 C7 G7 E5.
`handicapStones(n)` returns, for n = 2…5 (0 = even game, 1 is not offered — on 9×9 one stone is just "Black moves first"):

```
n=2        n=3        n=4        n=5
  a b c d e f g h j   (rows 9..1; X = Black stone)
9 . . . . . . . . .   9 . . . . . . . . .   9 . . . . . . . . .   9 . . . . . . . . .
8 . . . . . . . . .   8 . . . . . . . . .   8 . . . . . . . . .   8 . . . . . . . . .
7 . . . . . . X . .   7 . . . . . . X . .   7 . . X . . . X . .   7 . . X . . . X . .
6 . . . . . . . . .   6 . . . . . . . . .   6 . . . . . . . . .   6 . . . . . . . . .
5 . . . . . . . . .   5 . . . . . . . . .   5 . . . . . . . . .   5 . . . . X . . . .
4 . . . . . . . . .   4 . . . . . . . . .   4 . . . . . . . . .   4 . . . . . . . . .
3 . . X . . . . . .   3 . . X . . . . . .   3 . . X . . . X . .   3 . . X . . . X . .
2 . . . . . . . . .   2 . . . . . . . . .   2 . . . . . . . . .   2 . . . . . . . . .
1 . . . . . . . . .   1 . . . . . . . . .   1 . . . . . . . . .   1 . . . . . . . . .
 2: C3 G7              3: C3 G7 G3           4: C3 G7 G3 C7        5: C3 G7 G3 C7 E5
```
Checked: every point is empty, no stone touches another, every group has 4 liberties (C3: b3 d3 c2 c4 etc.) — all placements
are legal and nothing is captured. Order of adding stones is fixed as above (n=3 adds G3, n=4 adds C7, n=5 adds E5).
- **White moves first** after the handicap (`createGame(9, { setup: { B }, toPlay: 'W', komi })`); the bot's move appears
  after the usual 700 ms thinking pause.
- **Komi.** Even game (n=0): 5.5 as today. Handicap game: **0.5** (PO). Why 0.5 and not zero: no draws, and the learner reads
  "White wins by 0.5" as "so close". Chinese-rule note: area scoring counts the handicap stones as Black points, and Chinese
  practice gives White back about half a point per stone (N/2). We deliberately skip that: this is a teaching bot, the
  stones are a gift, and a flat 0.5 is easy to explain. (Alternative in §13.)
- Scoring unchanged: `score(board, {komi, deadStones})`; prisoners never count.

## 4. Acceptance criteria
### 4.1 Handicap (pure `src/game9/handicap.ts`, session, picker)
1. Given `handicapStones(n)` for n = 2,3,4,5, Then it returns exactly the point lists of §3 (as vertices, e.g. `['c3','g7']`), each a prefix of the next; `handicapStones(0)` returns `[]`; any other n (1, 6, -1, 2.5) throws.
2. Given `startSession(level, seed, 4)`, Then `game.board` has Black at c3 g7 g3 c7 and nothing else, `game.toPlay === 'W'`, `game.komi === 0.5`, `game.moves` is empty, `session.handicap === 4`, `thinking === true` (the screen then sends `bot` after the delay and White's first move is legal).
3. Given `startSession(level, seed, 0)`, Then the board is empty, Black to play, komi 5.5, `thinking === false` (as before; existing tests unchanged).
4. Given a handicap game, When the bot is to move at ply 0 and the learner presses nothing, Then the buttons Pass, Count now, Resign and Take back are disabled (thinking), as for any bot turn.
5. Given a handicap game where both sides passed, When the learner picks Play on, Then the replayed game still contains the handicap stones, komi 0.5 and the correct player to move (the `beforePasses` replay must use the same setup; regression test with n = 3).
6. Given handicap n and a count, Then the score table shows the handicap stones as Black stones, komi 0.5 on White's row, and Black total = Black stones + Black land.
7. Given the level picker, When it opens, Then there are three level rows (radio style, one selected), a "Handicap 让子 ràngzǐ" row of 5 chips `Even · 2 · 3 · 4 · 5` (each ≥ 44×44 px, exactly one selected), a one-line explanation, a mini board preview showing the selected stones, and a primary button [Start]. Tapping a level row only selects it (no longer starts the game).
8. Given the picker, When the learner selects a level, Then the handicap chip jumps to that level's stored suggestion (§4.2 / §4.1 item 9); When they tap another chip, Then the preview shows exactly `handicapStones(n)`; the choice is used for this game only (the stored suggestion changes only after a result, AC 11).
9. Given no stored suggestion for a level, Then the starting suggestion is **Easy 3, Normal 4, Challenge 5** (fallback table; the developer replaces the numbers with the tuning result of §6 and states them in §6).
10. Given the picker is opened and the PO had played before this item, Then old saves load (`bots[level].handicap` is optional; missing or invalid → the starting suggestion).
11. Given a finished game (count result or resignation) played at handicap h on level L, Then the progress store sets `bots[L].handicap` to: win → `stepDown(h)`; loss or resignation → `stepUp(h)`, where the ladder is `0 ↔ 2 ↔ 3 ↔ 4 ↔ 5` (`stepDown(0)=0`, `stepUp(5)=5`, `stepDown(2)=0`, `stepUp(0)=2`). A game left unfinished (✕, app closed) changes nothing.
12. Given the result screen, Then it shows one line "Next time: 3 stones" (or "Next time: even game") using the new suggestion, and [Play again] starts a game at that suggestion on the same level. A win at handicap 0 on Easy/Normal keeps the existing "try the next level" pre-selection (bot-levels spec AC 15/36).
13. Given the game screen, Then the header shows level, handicap and komi (`Easy · 3 stones · Komi 0.5`; even: `Easy · Komi 5.5`), and nothing else about the screen changes.
14. Given the route `app/game/play?level=1&handicap=3`, When `handicap` is missing, malformed or not in {0,2,3,4,5}, Then it falls back to 0 (no crash); `levelParam` has tests.

### 4.2 Take-back 悔棋 huǐqí (pure, in the session reducer)
Model: before every learner action (`play` or `pass`) the reducer pushes a snapshot of `{game, last, note}` onto `history`. A take-back pops one snapshot, so the learner's last move **and** the bot's reply (or the bot's pass) disappear and it is the learner's turn again. Ko is restored with the snapshot (`game.koPoint`).
Limits per game: **Easy unlimited; Normal 3; Challenge 1** (`takebacksLeft: number | null`; null = unlimited). Handicap does not change the limits. A take-back is not refunded by Play on or by anything else.
15. Given a learner move at e5 and the bot's reply at f5, When the learner presses Take back, Then the board is exactly the position before e5 (same stones, captures, `koPoint`, `toPlay`), `thinking === false`, the last-move marker is the previous one, and the feedback slot shows "Taken back." (first time ever: with 悔棋 huǐqí, see keys).
16. Given a learner move that captured, When taken back, Then the captured stones are back and the capture counters are restored.
17. Given a ko: Black captured at e5 and White's reply was forbidden at that point, When Black's move is taken back, Then the position before the ko capture is restored with its own `koPoint` (null if none).
18. Given the learner passed and the bot replied (move or pass), When Take back, Then both are undone and the learner has the move.
19. Given the bot is thinking (`thinking === true`), or phase is not `playing` (mark, count, result, resigned), or `history` is empty (new game; handicap game before the learner's first move), Then Take back is disabled and the reducer ignores the event (returns the same session object).
20. Given Normal with 0 take-backs left, Then the button is disabled and reads "Take back (0)"; the reducer ignores the event. Given Easy, Then the label has no number.
21. Given Normal after one take-back, Then the label reads "Take back (2)".
22. Given Play on after two passes, Then `history` is emptied (the learner cannot undo into the finished game); the next learner move starts a new history. The used count stays used.
23. Given Resign, Then nothing can be taken back afterwards. Given Count now, Then it works like Pass (AC 22 applies).
24. Given the session is reset with `new`, Then `history` is empty and `takebacksLeft` is the level's full allowance.
25. Given a taken-back position, Then the atari rings and line (§4.3) are recomputed for it, and the bot's next reply to the *same* position may differ (it uses `botRng(seed, moves.length)`; same position → same reply, which is allowed and is deterministic; test that).

### 4.3 Danger rings and the atari line (pure `src/game9/danger.ts`)
Facts come only from `groupAt` / engine group data: a group is "in atari" iff `group.liberties.length === 1`. No heuristic, no bot code, no model.
26. `dangerOf(game): DangerGroup[]` returns for every group with exactly one liberty `{ color, stones: Point[] (sorted column, row), liberty: Point }`, ordered by the priority rule: (1) Black (the learner's) groups before White groups, (2) more stones first, (3) lower first-stone column, then row. Groups with 0 or ≥ 2 liberties are never returned.
27. Given the §7 diagram A (Black D4 surrounded by White C4 E4 D5), Then `dangerOf` returns exactly one group `{B, [d4], liberty d3}`.
28. Given diagram B (White G7, Black F7 G8 H7), Then exactly `{W, [g7], liberty g6}`.
29. Given a Black group of 3 stones with 1 liberty and a lone Black stone with 1 liberty, Then the 3-stone group is first; given a Black and a White group in atari, Then Black is first even if the White group is bigger.
30. Given phase `playing`, learner to move, `dangerOf` non-empty, Then every stone of every listed group has a ring on the board (own = solid ring, token `color.error`; White = dashed ring, token `color.success`; ring is drawn just outside the stone edge, width 2.5, no glow, no pulse) and each such group's single liberty point has a small diamond mark in the same colour.
31. Given the colours, Then a Jest test checks contrast ≥ 3:1 (non-text UI, WCAG 1.4.11) of `error` and `success` against both bamboo strip colours (`bambooStripLight`, `bambooStripDark`) (the ring sits outside the stone, so no contrast against the stone colour is needed). If `success` fails, use `color.accent` instead (the test decides). Also a test that the two ring styles differ by dash pattern (colour is not the only cue).
32. Given phases `mark`, `count`, `result`, or `thinking === true`, Then no rings and no atari line are shown (so the bot's reply is not announced before it appears; they come back once the learner is to move).
33. Given the learner's turn and a non-empty `dangerOf`, Then the feedback slot (one slot under the board, §5) shows the line of the first group:
   - own, 1 stone: "Your stone at D4 is in atari 叫吃 — one liberty left at D3." (key `game9.atari.you.one`)
   - own, several: "Your stones at D4, D5 are in atari — one liberty left at D3." (`…you.many`; at most 3 points listed, then "…")
   - White: "White's stone at G7 can be captured at G6." / "White's stones at G7, G8 can be captured at G6." (`…bot.one/many`)
   - more groups: the suffix " +2 more in atari." (`game9.atari.more`) is appended to the same line (rings show all groups).
   The coordinates are the engine's formatted points (uppercase letter + row number from the bottom, same as the board labels).
34. Given an illegal-move reason is active (the learner just tapped an illegal point), Then it replaces the atari line until the next tap or move; otherwise the atari line beats the capture note ("You captured 2" / "The bot captured 1") and the "bot passed" note. (This is the slot priority both specs must agree on, §8.)
35. Given a screen reader, Then the atari line is announced politely (live region) when it appears, and the stone point labels of stones in a danger group end with "in atari" (`game9.a11y.atari`).
36. Given the 3 ring colours and mood, Then no new colour token is added; rings use only `src/theme/tokens.ts`; no leaf/petal motif; reduced motion has no effect (rings are static).

### 4.4 Softer Easy (tuning, `src/bot`, `src/game9/config.ts`)
Level 1 on 9×9 (option `board9`) gets two new mistakes, both only when `board9` is true (Capture Go behaviour and its recorded games must not change; the 3-rng-draw rule of the bot-levels spec §6.1 stays for Capture Go; in board9 the extra decisions use a derived rng so the first three draws are identical):
- `L1_SKIP_SAVE_9` (start 0.35): when one of its own groups is in atari, with this probability it does **not** extend/save and plays another normal move (it "does not see" the danger).
- `L1_SKIP_ATARI_9` (start 0.35): with this probability it skips rule 3 (putting an opponent group in atari). Captures of a stone already in atari stay as today (blunder/2 miss chance).
- `L1_BLUNDER_9` is re-tuned together (start 0.5; the developer may raise it).
37. Given `TUNE_SEEDS=100 npm run tune:bot9`, Sensible (scripted learner, even game, komi 5.5) beats Easy **90–95 %** (200 games). Above 95 % Easy is too soft to teach anything: lower the numbers.
38. Given the same run with the weak reference player Noob (defined in the tune script, report the definition), Noob beats Easy at least 50 % in an even game and at least 85 % with 4 handicap stones.
39. Given Normal (level 2), the target for Sensible is **50–60 %** (original spec §7). Proposal: a seeded "slip" in level 2 — with probability `L2_SLIP_9` (start 0.15) it picks the 2nd or 3rd best scored point instead of the best (never when a capture or a save exists, so bot-levels spec AC 3–4 hold). This item is **successful if Sensible vs Normal is ≥ 40 %; 50–60 % is the goal**. If not reachable without breaking L2 vs L1 ≥ 80 %, the developer reports the best compromise (PO decides, §13).
40. Challenge (level 3) is not changed in this item; its tuning rows are re-run and reported (L3 vs L2 ≥ 65 % may rise because Normal got softer; Sensible vs L3 ≤ 40 %).
41. Given handicap n ∈ {2,3,4,5}, Then `TUNE_HANDICAP=n` makes the tune script start games with the §3 stones, White first, komi 0.5, and reports Sensible and Noob win rates per level (table in §6); the first-time suggestion table (AC 9) is the smallest n where Noob wins ≥ 60 % per level (Noob vs L3: report even if never reached → 5).
42. Given any tuning change, Then all existing bot tests still pass: no game throws, all end by two passes, Easy < 1 ms mean per move, level 3 unchanged speed.

### 4.5 Console warning
43. Given the app running on web in development, When the home screen, any lesson screen with the leave sheet, a 9×9 game with any sheet and a themed screen with the landscape backdrop are opened, Then the console shows no warning "Received `false` for a non-boolean attribute `accessible`". Fix at `src/theme/Landscape.tsx:28`, `src/game9/ui/Sheet.tsx:46`, `src/exercises/LeaveSheet.tsx:32`: do not pass `accessible={false}` to elements that react-native-web renders as DOM nodes; hide the decorative backdrop / the dismiss area from the screen reader with `importantForAccessibility="no-hide-descendants"` / `accessibilityElementsHidden` / `aria-hidden` (or drop the prop where the element is a pure `View` with no handler). Native screen-reader behaviour stays as before (backdrop not announced; the dismiss area not a button stop). `npm run verify:web:m6` records console messages and fails on this text.

## 5. Screen flow & UI (360×740)
Home → Picker → Game → (Mark → Count →) Result. The only new screens are changes to the Picker, the button area and the feedback slot.

### 5.1 Picker (replaces one-tap start; AC 7–8)
```
┌──────────────────────────────┐
│ <-  Play 9×9 · 九路对弈      │ 56
│  Choose your opponent        │ 32
│ (o) 入门 Easy        ✓ won   │ 64  selected = accent border
│ ( ) 普通 Normal              │ 64
│ ( ) 挑战 Challenge           │ 64
│  Handicap · 让子 ràngzǐ      │ 24
│ [Even][ 2 ][ 3 ][ 4 ][ 5 ]   │ 48  chips 59×48
│ You get 3 stones, White      │ 72  text (left) + mini board 96×96
│ moves first. Komi 0.5.  [▦]  │
│ [          Start          ]  │ 52
└──────────────────────────────┘
```
Height ≈ 56+32+3×64+8×3+24+48+8+96+8+52+16 = 548. The suggested chip carries a small tag "suggested" under/inside (text, not colour only). Locked/unlocked and "beaten" states unchanged.

### 5.2 Game screen
```
┌──────────────────────────────┐
│ ✕  Easy · 3 stones · Komi 0.5│ 56   header (ellipsis if long)
│ [ Your turn (Black).      ]  │ 56
│ ┌ 9×9 board 328, rings ────┐ │ 328
│ └──────────────────────────┘ │
│ [ feedback slot (atari line) ] 72  (one slot, shared, §8)
│ [ Take back (2) ][  Pass    ]│ 48
│ [ Count now     ][ Resign   ]│ 48
└──────────────────────────────┘
```
Height ≈ 56+56+8+328+8+72+8+48+8+48+16 = 656 ≤ 740 minus safe area. Count now is hidden before 6 moves (its cell stays empty). All buttons ≥ 44 px high, secondary style; Take back first in reading order (left), because it is the "I made a slip" reflex. State table:

| State | Rings | Slot | Take back |
|---|---|---|---|
| Learner turn, nothing in danger | none | last event note or empty | enabled if history and allowance |
| Learner turn, atari | on | atari line | same |
| Bot thinking | none | none | disabled |
| Handicap, bot's first move | none | none | disabled (history empty) |
| Normal, 0 left | as state | as state | disabled, "(0)" |
| Mark/Count/Result | none | unchanged | hidden |

### 5.3 Atari examples (A: own stone in atari; B: White stone capturable). Verified by hand: A — D4 neighbours C4 E4 D5 are White, D3 empty, so 1 liberty; each White stone has 3 liberties. B — G7 neighbours F7 G8 H7 are Black, G6 empty, so 1 liberty; Black stones have ≥ 3.
```
A: ring on D4, diamond on D3          B: dashed ring on G7, diamond on G6
    b c d e f                             e f g h j
  5 . . O . .                           8 . . X . .
  4 . O (X) O .   Black D4 atari        7 . X (O) X .   White G7 capturable
  3 . . ◇ . .                           6 . . ◇ . .
```

### 5.4 Result screen
Adds one line under the margin: "Next time: 3 stones." and the button [Play again] stays first.

## 6. Tuning results (developer fills; keep rows short)
`npm run tune:bot9`, seeds 1–100 × both colours, komi 5.5 (even) / 0.5 (handicap).
| Player vs bot | handicap | Sensible wins | Noob wins | target | OK |
|---|---|---|---|---|---|
| vs Easy | 0 | _ | _ | 90–95 % / Noob ≥ 50 % | |
| vs Easy | 2,3,4,5 | _ | _ | Noob(4) ≥ 85 % | |
| vs Normal | 0 | _ | _ | 50–60 % (≥ 40 % minimum) | |
| vs Normal | 2,3,4,5 | _ | _ | report | |
| vs Challenge | 0 / 4,5 | _ | _ | Sensible ≤ 40 % at 0 | |
Final constants: `L1_BLUNDER_9 =`, `L1_SKIP_SAVE_9 =`, `L1_SKIP_ATARI_9 =`, `L2_SLIP_9 =`; first-time handicap table: Easy _, Normal _, Challenge _. Noob definition: _. Time per move: _ (unchanged expected).

## 7. Game design notes
- Curve: handicap is the main difficulty dial, the bot level the second. A real first game should be ~80 % winnable with the suggested stones; each win removes one rung (5→4→3→2→even), each loss adds one. Beating Easy even is the "I can play Go" moment; Normal and Challenge follow the same ladder.
- Take-back is a teaching tool, not a cheat: unlimited on Easy (no pressure), 3 on Normal (you must read), 1 on Challenge (a safety net). Wins with take-backs count as wins (no asterisk).
- Atari line is the only coaching in this item: it states what the board shows. It never suggests a move. (Move notes / hints belong to the sibling spec.)
- Feedback: take-back plays the soft stone-off sound already in the app, no new asset; rings appear without animation; no sound for rings. After 3 losses in a row the existing easier-tip applies (bot-levels spec AC 37); the next suggestion also gets one stone more, so the tip and the ladder agree.

## 8. Coordination with `claude/m6-game-coaching` (move notes, hint button, game review)
Both specs use **one shared feedback slot under the board** (the existing 72 px card). Slot priority, highest first: illegal-move reason > **atari line (this spec)** > the sibling's move note / hint text > capture and pass notes. Both specs must state this order; the atari line is only ever the sentence of §4.3 (facts, no advice). Rings and the line are computed by `dangerOf` (new file `src/game9/danger.ts`); the sibling reuses it rather than recomputing. Button row: this spec uses two rows (Take back, Pass / Count now, Resign); a Hint button from the sibling goes into the empty Count-now cell before move 6 or a third row if the sibling needs it — whoever merges second rebases and re-checks the 740 px height (≤ 740 − safe area). Conflict-prone files: `GameScreen.tsx`, `session.ts`, `en/fr/zh-CN.json` (append keys at the end of the `game9.*` block).

## 9. i18n keys (zh-CN / en / fr; first use = Chinese term + pinyin)
| key | zh-CN | en | fr |
|---|---|---|---|
| `game9.picker.handicap` | 让子 ràngzǐ | Handicap · 让子 ràngzǐ | Handicap · 让子 ràngzǐ |
| `game9.picker.even` | 平分（不让子） | Even | Égal |
| `game9.picker.stones` | {{n}} 子 | {{n}} | {{n}} |
| `game9.picker.suggested` | 推荐 | suggested | conseillé |
| `game9.picker.explain` | 你执黑，棋盘上先有 {{n}} 个黑子，白先走。贴目 0.5。 | You play Black with {{n}} stones already placed. White moves first. Komi 0.5. | Vous jouez Noir avec {{n}} pierres déjà posées. Blanc joue en premier. Komi 0,5. |
| `game9.picker.explainEven` | 你执黑先走。贴目 5.5。 | You play Black and move first. Komi 5.5. | Vous jouez Noir et commencez. Komi 5,5. |
| `game9.picker.start` | 开始 | Start | Commencer |
| `game9.header.handicap` | {{level}} · 让 {{n}} 子 · 贴目 {{komi}} | {{level}} · {{n}} stones · Komi {{komi}} | {{level}} · {{n}} pierres · Komi {{komi}} |
| `game9.btn.takeback` | 悔棋 | Take back | Annuler |
| `game9.btn.takebackN` | 悔棋 ({{n}}) | Take back ({{n}}) | Annuler ({{n}}) |
| `game9.takeback.done` | 已悔棋。轮到你了。 | Taken back. Your turn. | Coup annulé. À vous. |
| `game9.takeback.first` | 悔棋 huǐqí：你的上一手和白棋的回应都撤销了。 | Take-back 悔棋 huǐqí: your last move and White's reply are undone. | Annulation 悔棋 huǐqí : votre dernier coup et la réponse de Blanc sont annulés. |
| `game9.atari.you.one` | 你的黑子 {{where}} 被叫吃，只剩 1 口气，在 {{lib}}。 | Your stone at {{where}} is in atari — one liberty left at {{lib}}. | Votre pierre en {{where}} est en atari — il lui reste une liberté en {{lib}}. |
| `game9.atari.you.many` | 你的黑子 {{where}} 被叫吃，只剩 1 口气，在 {{lib}}。 | Your stones at {{where}} are in atari — one liberty left at {{lib}}. | Vos pierres en {{where}} sont en atari — il leur reste une liberté en {{lib}}. |
| `game9.atari.bot.one` | 白子 {{where}} 只剩 1 口气，可在 {{lib}} 提掉。 | White's stone at {{where}} can be captured at {{lib}}. | La pierre blanche en {{where}} peut être capturée en {{lib}}. |
| `game9.atari.bot.many` | 白子 {{where}} 只剩 1 口气，可在 {{lib}} 提掉。 | White's stones at {{where}} can be captured at {{lib}}. | Les pierres blanches en {{where}} peuvent être capturées en {{lib}}. |
| `game9.atari.more` | 另有 {{n}} 处也被叫吃。 | +{{n}} more in atari. | +{{n}} autre(s) en atari. |
| `game9.a11y.atari` | 被叫吃 | in atari | en atari |
| `game9.result.next` | 下次：让 {{n}} 子。 | Next time: {{n}} stones. | La prochaine fois : {{n}} pierres. |
| `game9.result.nextEven` | 下次：平分对局。 | Next time: an even game. | La prochaine fois : partie égale. |
Pinyin policy: 让子 ràngzǐ and 悔棋 huǐqí carry pinyin at their first appearance (picker label, first take-back note; the
buttons themselves are short). 叫吃 jiàochī / 气 qì were taught in Unit 5, so the atari line (zh-CN) has no pinyin; the English
line keeps "atari" once with the term "叫吃" only in the a11y/help text if the developer wants a visual teach — not required.
Every key exists in all three files; a test compares key sets.

## 10. Web check (extends `npm run verify:web:m6`, 360×740) and screenshots in `docs/screenshots/M6/` (new numbers, en + fr + zh-CN each)
`20-picker-handicap` (Easy selected, 3 chips, preview) · `21-picker-handicap-5` (5 stones preview) · `22-game-handicap-white-first` (4 stones, White's first move shown) · `23-atari-own` (ring + line, diagram A) · `24-atari-white` (dashed ring + line, diagram B) · `25-atari-both` (priority: own line, 2 sets of rings) · `26-takeback-done` (note after take-back, Easy) · `27-takeback-limit` (Normal, "(0)", disabled) · `28-result-next-handicap` · `29-no-console-warning` (a text log, not an image: console messages of the run). Checks: no horizontal scroll, board 328 px, all buttons ≥ 44 px, rings visible in the screenshots, the long fr lines wrap (≤ 3 lines) without cutting.

## 11. Correctness check (designer, by hand)
Handicap diagrams: points lie on the 3rd/7th lines and the centre of a 9×9 board, nothing adjacent, nothing capturable. Atari A/B: liberties counted above. Komi 0.5: Black wins only if its area total exceeds White's area plus 0.5, so an equal board goes to White by 0.5 (Black 40 vs White 40 + 0.5 → White wins by 0.5; Black 41 vs 40.5 → Black wins by 0.5). Draws are impossible. Take-back / ko: the snapshot holds `koPoint`, so the ban is restored exactly.

## 12. Out of scope
Move notes, hint button, game review (sibling spec); free handicap placement by the learner; 1-stone handicap; handicap on 13×13/19×19; White (bot) handicap or learner as White; saving a game in progress; take-back in Capture Go (M4) or lessons; take-back of more than one move; a separate "undo to any move"; rating/ELO; Chinese-rule N/2 compensation (see §13); AI-phrased text; new sounds/art; changing Challenge strength.

## 13. Open decisions for the PO (default first)
1. **Handicap choice screen.** Default: the picker gets a "Handicap" row (Even, 2–5 stones) with a small preview; you pick a level and a number, then press Start. Alternative: no choice, always the suggested number. (Default is more flexible, one extra tap.)
2. **Which points.** Default: the five classic star points — 2 stones: C3 and G7; 3: add G3; 4: add C7; 5: add the centre E5. Four stones is the corners.
3. **Starting stones for a new player.** Default: Easy 3, Normal 4, Challenge 5 (the developer will correct these from the tuning). Alternative: Easy 4 if you still find 3 too hard.
4. **Komi in handicap games.** Default: 0.5 (nobody ties). Real Chinese-rule practice gives White about half a point per handicap stone (3 stones → 1.5, so komi 2). Default skips that to keep it simple; say if you want the accurate version.
5. **Auto adjustment.** Default: win → one stone fewer next time (…4, 3, 2, even); loss or resign → one more (max 5); you can always change it before starting. Alternative: only fewer after a win, never more.
6. **Take-back allowance.** Default: Easy unlimited, Normal 3 per game, Challenge 1 per game. Take-back undoes your move and the bot's answer together.
7. **Atari colours.** Default: your stones in danger get a solid reddish ring (the app's "rouge"), White stones you can capture get a dashed green ring (the app's "tea green"), plus a small diamond on the single remaining breathing point. Shape differs so colour-blind players are fine. If you want fewer rings, alternative: only your own stones.
8. **Which line wins when several groups are in atari.** Default: your own stones first (safety), then the bigger group; every ring is still drawn, the line adds "+2 more in atari".
9. **Softer Easy / Normal.** Default: Easy ignores a danger to its own stones 35 % of the time and misses a chance to attack 35 % of the time; goal "a competent beginner beats Easy 90–95 % of even games". Normal gets a 15 % "slip" to move from 20 % toward your original 50–60 % goal (success = at least 40 %). Alternative: leave Normal as it is.
10. **Wins with take-backs.** Default: they count as wins and lower the handicap like any win.
