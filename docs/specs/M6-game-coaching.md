# M6 — Game coaching for 9×9 (move notes, 提示 hint, post-game review)

Status: APPROVED by PO 2026-10-22 (all §9 defaults). Roadmap item: "Game coaching for 9×9". Builds on `docs/specs/M6-bot-levels.md`
(session `src/game9/session.ts`, screen `src/game9/ui/GameScreen.tsx`, bot `src/bot/level2.ts`, `level3.ts`, `playout.ts`,
`analysis.ts`). Offline, no AI: the engine computes facts, the text is templated i18n.

## 0. In plain words
Today the learner plays a game and nobody says whether a move was good. This item adds three small helpers:
1. A **one-line note** under the board, only when something happened ("You captured 2 stones", "Your group at E4 is in atari").
2. A **提示 tíshì hint** button that shows one good move with a one-word reason. Limited per game.
3. A **review** after the game: 2–3 key moments you can step through, each with a fact line.

Boundary with the parallel session "9×9 for beginners": that session owns on-board danger rings for groups in atari, take-back
and handicap. Here the note is **text only**: no ring, glow, or colour on stones. The only board marks added here are the hint
marker (§5.2) and the replay moment marker (§5.3). If both ship, a ring may appear on the board *and* the note names the same
group; that is accepted (text says it, ring shows it).

## 1. Goal
After a game the learner can say what happened at the important moments and, during the game, knows when they captured,
rescued or endangered stones, and can ask for a nudge when stuck.

## 2. User stories
1. As a beginner, I want to be told when I captured or got captured so that I notice things I might miss.
2. As a beginner, I want a warning when I leave my own group in atari so that I learn to look before I tap.
3. As a beginner, I want to know what the bot just did to me so that its reply is not a mystery.
4. As a beginner, I want a hint when I am stuck so that I do not quit, but not so many that I stop thinking.
5. As a beginner, I want to know *why* the hint move is good so that I learn the idea, not just the point.
6. As a beginner, I want to see the 2–3 moments that decided the game so that I know what to improve.
7. As a beginner, I want to step through the game with Prev / Next so that I can see the moment in context.
8. As a parent/teacher, I want the coaching to be calm and short so that it does not feel like being scolded.

## 3. Module layout (pure TS, no React, no clock, no `Math.random`)
- `src/coach/facts.ts` — `moveNote(before: GameState, move: Move, after: GameState, facts: MoveFacts | null): CoachFact[]`
  and `pickNote(facts: CoachFact[]): Note | null`. `CoachFact` = `{kind, color, point, size?, count?}`.
- `src/coach/hint.ts` — `hintFor(state, level): {point: Point | null; category: HintCategory; count?: number}` using `scoreMoves` from level2.
- `src/coach/review.ts` — `buildReview(moves, komi, seed): ReviewMoment[]` (pure, seeded, count-based budget).
- Session additions (`GameSession`): `coach: { notes: Note[]; hintsLeft: number; hint: HintView | null }`, `history` is
  `game.moves` (already there; replay re-plays them with the engine, no extra storage).

## 4. Acceptance criteria
Notation as in the bots spec: engine vertices, `a1` bottom-left, column letters without `i`. All boards 9×9, komi 5.5.

### 4.1 Move facts (src/coach/facts.ts)
Facts are computed for the mover's colour `c`, opponent `o`, from `before`/`after` states and `MoveFacts`.
| kind | Definition |
|---|---|
| `capture` | `facts.captured` non-empty; `count` = total stones |
| `selfAtari` | `facts.selfAtari` and no capture (a capture can leave the new stone in atari: still reported, kind `selfAtari`, lower priority than `capture`) |
| `atari` | `facts.opponentAtari` non-empty; `size` = largest group, `point` = that group's liberty-nearest stone (first by column, row) |
| `escape` | a `c` group in atari in `before` (touching the played stone) that has ≥ 2 liberties in `after` and was not captured |
| `exposed` | a `c` group **other than the played group** with exactly 1 liberty in `after`, that existed with ≥ 2 liberties in `before` (a move elsewhere cannot cause this except by the opponent's move, so this fires mainly for the opponent's reply) |

1. Given fixture A (§10: White `d5`, Black `c5 d4 d6`, Black plays `e5`), When `moveNote` runs, Then it returns one `capture` fact with `count 1`, point `d5`.
2. Given a move that captures two separate groups (1 + 2 stones), Then `capture` has `count 3`.
3. Given fixture B (§10: White `b1`, Black plays `a1`, `a2` empty), Then fact `selfAtari` for Black at `a1`, `size 1`.
4. Given Black plays next to White `e5 e6` leaving them with exactly 1 liberty, Then fact `atari`, `size 2`, point `e5`.
5. Given Black `d5` has only liberty `d6` and Black plays `d6` which gives the chain `d5 d6` three liberties, Then fact `escape` for Black.
6. Given White replies by taking the second-to-last liberty of a Black group elsewhere on the board, Then fact `exposed` (Black, group size, point) is attached to White's move.
7. Given a move with none of the above, Then `moveNote` returns `[]` and `pickNote` returns `null` (no note, area hidden, AC 10).
8. Given a pass, Then no facts and no note (the existing "You passed" status stays).
9. Each of AC 1–8 is a Jest test with the ASCII diagram in the test; I checked every fixture's liberties by hand (listed in §10).

### 4.2 Choosing the note (one combined note, priority, length)
Decision: **one line per ply, at most two lines on screen** (line 1 = the learner's move, line 2 = the bot's reply), each line
shows only the **single highest-priority fact** of that ply. Priority (high to low): `capture` > `selfAtari` > `exposed` >
`atari` > `escape`. Counting stones, not listing them.
10. Given a ply with no fact, Then no line is created for that ply; if both plies are empty the note area is not rendered
    (the board does not jump: the area has a fixed 2-line reserve only while a note is showing; see §5.1).
11. Given the learner's move has fact A and the bot's reply fact B, When the bot has answered, Then both lines show, learner's first,
    each ≤ 60 characters in en/fr and ≤ 28 characters in zh-CN (checked in a test over the three i18n files with a worst-case
    point and count).
12. Given the learner plays, Then line 1 appears at once at commit (before the bot's 700 ms delay) and line 2 appears when the bot's
    stone lands. Line 1 stays; both are cleared when the learner starts the next turn (first touch preview) or on a pass/phase change.
13. Given the bot's reply captures the learner's stones, Then the line is "The bot captured {n} of your stones." and nothing else for
    that ply (capture beats everything).
14. Given `selfAtari` for the learner, Then the line reads "Careful: your stone at {pt} has only one liberty left." (never
    "mistake"; no red). The move is not blocked and no confirm is shown.
15. Given the notes are shown, Then they are text only: the board layer receives no new prop from notes (test: `GoBoard` props
    unchanged; no ring/glow/overlay). Coordinates come from the same `{point}` formatter as the existing dispute messages.
16. Given reduce-motion or screen reader, Then the note area is `accessibilityLiveRegion="polite"` and has no animation other than a
    150 ms fade (none under reduce-motion).

### 4.3 Hint 提示 tíshì
Hint count per game by level: **Easy 3, Normal 2, Challenge 1.** (Easy has more because it is the first game.)
17. Given the learner's turn in `playing`, When they tap *Hint 提示*, Then the engine computes `scoreMoves(state)` (level-2 scorer,
    deterministic, no randomness) and the best-scored move is shown: a marker on that point and one reason line. `hintsLeft` drops by 1.
18. Given the hint is showing, When the learner taps Hint again, Then nothing changes and no use is consumed (the hint stays).
19. Given the hint is showing, When the learner commits any move (the hinted one or another) or passes, Then the marker disappears.
    The learner is **free to ignore it**.
20. Given `hintsLeft = 0`, Then the button shows "Hint · 0" disabled (still ≥ 44 px tall) with an accessibility label "No hints left".
    Given the bot is thinking or the phase is not `playing`, Then the button is disabled and no use is consumed.
21. Reason categories (from the `MoveKind` and facts of the hinted move; one line, no coordinates beyond the marker):
    | Condition | Category | en text |
    |---|---|---|
    | kind `capture` | `capture` | "This captures {n} stone(s)." |
    | kind `save` | `save` | "This saves your group in atari." |
    | kind `atari` | `atari` | "This puts {n} white stone(s) in atari." |
    | none of the above and the move adds ≥ 1 liberty to a learner group with ≤ 2 liberties | `liberties` | "This gives your weak group more room (liberties)." |
    | otherwise | `territory` | "This claims space on the board (territory)." |
22. Given the best move is a pass (`PASS_BELOW`), Then the hint shows no marker and the line "Nothing urgent here. If you think the
    game is over, you can pass." and **no use is consumed**.
23. Given the same position, level and call, Then the hint is identical (test: 20 calls equal). Hint text never names a *bad*
    alternative. The hinted move is always legal (`checkMove` ok); property test over 100 random positions.
24. Given the learner uses the hint, Then the game result and the "won" tick on the level picker are **unchanged** (no penalty in
    this item; hints used is stored in the session for the review header, "Hints used: 1").

### 4.4 Post-game review
Entry: result screen (count or resignation) gets a primary action *Review the game 复盘 fùpán* (when `game.moves.length ≥ 10`;
fewer moves: the button is hidden). Existing actions (New game, Home) stay and remain reachable.
Moment types: `bigCapture` (largest capture by either side, ≥ 2 stones), `lostGroup` (largest learner group captured, ≥ 3 stones,
may coincide with `bigCapture` → show once), `swing` (largest drop in the learner's estimated win chance after one of the
learner's moves). Show **at most 3, at least 1**; if no moment qualifies, show "A quiet game. No big moments." with Prev/Next only.
25. Given a finished game, When `buildReview(moves, komi, seed)` runs, Then it replays the moves with the engine and returns moments
    sorted by ply; same input and seed give the same output (determinism test). The module contains no clock/timer.
26. Given a game where the bot captured 4 stones at ply 31 and no other capture ≥ 2, Then `bigCapture` = ply 31, 4 stones, and
    `lostGroup` is the same ply, so one moment of kind `lostGroup` is shown.
27. **Swing budget (cheap, count-based):** only positions *after the learner's own moves* are evaluated, at most **24** of them
    (if more, the first 24 after ply 6 sampled evenly), with **40 playouts each** (random-playout from `playout.ts`, cap **80** plies),
    plus one baseline position → total ≤ 1000 playouts, ≈ one Level-3 move (< 400 ms on desktop Node per M6-bot-levels AC 7; a
    mid-range phone ≈ 1–2 s). It runs in chunks of 4 positions per tick (`setTimeout 0` in the UI layer, not in the module) so the
    screen never freezes, behind the static line "Preparing the review…" and a *Skip* link that shows only the capture moments.
28. Given win chances `p_i` (fraction of playouts the learner wins by area score + komi), Then a `swing` moment is created only
    when `p_{i-1} − p_i ≥ 0.30` (40 playouts have ≈ ±8 % noise, so 30 points is the safe threshold). The moment is the learner's move
    at ply `i`. The words never show percentages: "Your chances dropped a lot after this move."
29. Given no learner move drops by ≥ 0.30, Then no `swing` moment is created (not a failure; capture moments still show).
30. Given a resigned game, Then `swing` is evaluated the same way and the header shows "Game ended by resignation".
31. **Fact line per moment** (engine facts only, 1–2 sentences, no judgement of a move as "bad"):
    - `bigCapture` : "Move {n}: {Black|White} captured {k} stones at {pt}."
    - `lostGroup`  : "Move {n}: a group of {k} of your stones was captured. It had {m} liberties one move before." (m ≥ 1 from the position before)
    - `swing`      : "Move {n}: after your move at {pt}, {fact of the bot's next reply}" — reuse the §4.1 text of the *bot's reply* fact
      (e.g. "the bot captured 3 of your stones"). If the bot's reply has no fact, "the bot gained the upper hand elsewhere."
32. **Replay:** the review board is read-only (no preview, taps ignored), shows stones for the current step, a last-move marker and
    the key point of the current moment (same marker as the hint, different colour token). *Prev* / *Next* move one ply; *Prev* is
    disabled at step 0, *Next* at the last ply. Chips "1 2 3" jump to a moment: the board shows the position **just before** the
    moment's ply with Next revealing it (so the learner can think first).
33. Given the replay is at step k, Then the board equals the engine position after the first k moves (test: replay of a recorded
    game equals `play` sequence; captures included).
34. Given review closes (✕), Then the result screen returns with its previous state. Review is not saved and not shown again after
    leaving the screen (v1).
35. Given a screen reader, Then each step announces "Move {n} of {N}, {Black|White} at {pt}".

### 4.5 i18n, theme, layout
36. All new text exists as keys under `coach.*` in `zh-CN.json`, `en.json`, `fr.json` (parity test); Chinese term + pinyin on first
    use: 提示 tíshì, 复盘 fùpán, 气 qì (liberty). No hard-coded strings.
37. Only tokens from `src/theme/tokens.ts`; no new colours; no leaf/petal shapes; tap targets ≥ 44 px at 360×740.

## 5. Screen flow & UI (360×740)

### 5.1 Playing, with note and hint (board 9×9 ≈ 336 px square)
```
┌──────────────────────────────┐
│ ✕   Normal 普通        komi 5.5│
├──────────────────────────────┤
│                              │
│        [ 9×9 board ]         │  336 px
│                              │
├──────────────────────────────┤
│ You: you put 2 stones in atari│  note, 2 lines max (reserved
│ Bot: your group at E4 is in   │  only while shown), tea-ink text,
│      atari                    │  muted
├──────────────────────────────┤
│ [Pass] [Hint 提示 · 2] [Count] │  row 44 px; Resign in overflow/
│ [Resign]                      │  existing place
└──────────────────────────────┘
```
Layout rule: the note area sits between board and buttons. To avoid the board jumping, the status line (existing) and the note
share one fixed 56 px slot: when a note shows it replaces the second line of the status area; the board never moves.

### 5.2 Hint shown
```
board: a soft ring-less marker = small bamboo-green diamond on the point (token: success-soft), pulsing 1x
below: "Hint 提示: This puts 1 white stone in atari."   [x]
```
The marker is a filled diamond (not a ring) so it cannot be confused with the danger rings of the parallel session.

### 5.3 Review
```
┌──────────────────────────────┐
│ ✕  Review 复盘     Hints used 1│
│ [1 Capture] [2 Lost group] [3]│  chips ≥ 44 px, scroll if needed
│        [ board, read-only ]  │
│ Move 31 of 54                │
│ Move 31: a group of 4 of your │
│ stones was captured. It had 1 │
│ liberty one move before.      │
│  [◀ Prev]          [Next ▶]  │
└──────────────────────────────┘
```
States: preparing (static text + Skip), ready, no moments ("A quiet game…"), error in playouts (fallback to capture moments only,
no error shown). Result screen shows primary *Review 复盘*, secondary *New game*.

### 5.4 Copy keys (excerpt; full set in the three json files)
| key | zh-CN | en | fr |
|---|---|---|---|
| `coach.you.capture` | 你吃掉了{{n}}子 | You captured {{n}} stone(s). | Vous avez capturé {{n}} pierre(s). |
| `coach.bot.capture` | 对手吃掉了你{{n}}子 | The bot captured {{n}} of your stones. | Le bot a capturé {{n}} de vos pierres. |
| `coach.you.atari` | 你打吃了{{pt}}处的{{n}}子 | You put {{n}} stone(s) at {{pt}} in atari. | Vous mettez {{n}} pierre(s) en atari en {{pt}}. |
| `coach.bot.atari` | 对手打吃了你{{pt}}处的子 | The bot put your stones at {{pt}} in atari. | Le bot met vos pierres en {{pt}} en atari. |
| `coach.you.selfAtari` | 小心:{{pt}}只剩一口气 | Careful: your stone at {{pt}} has one liberty (气 qì) left. | Attention : votre pierre en {{pt}} n'a plus qu'une liberté (气 qì). |
| `coach.you.escape` | 你的子逃出了叫吃 | Your group escaped the atari. | Votre groupe a échappé à l'atari. |
| `coach.you.exposed` | 你{{pt}}处的子只剩一口气 | Your group at {{pt}} has one liberty left. | Votre groupe en {{pt}} n'a plus qu'une liberté. |
| `coach.hint.button` | 提示 tíshì · {{n}} | Hint 提示 tíshì · {{n}} | Indice 提示 tíshì · {{n}} |
| `coach.hint.capture` | 这手能吃{{n}}子 | This captures {{n}} stone(s). | Ce coup capture {{n}} pierre(s). |
| `coach.hint.save` | 这手救出被叫吃的棋 | This saves your group in atari. | Ce coup sauve votre groupe en atari. |
| `coach.hint.territory` | 这手占地盘 | This claims space (territory). | Ce coup prend du terrain. |
| `coach.review.button` | 复盘 fùpán | Review 复盘 fùpán | Revue 复盘 fùpán |
| `coach.review.quiet` | 这盘很平静,没有大事件 | A quiet game. No big moments. | Une partie calme. Pas de grand moment. |
| `coach.review.swing` | 第{{n}}手:你在{{pt}}落子后,{{reply}} | Move {{n}}: after your move at {{pt}}, {{reply}} | Coup {{n}} : après votre coup en {{pt}}, {{reply}} |
Plurals via i18next `_one/_other` (fr/en); zh has none.

## 6. Game design notes
- **Tone:** facts, never verdicts: no "mistake", "blunder", red, or sound of failure. Notes use the muted ink token; the only
  sound is none (silent), the capture fade already plays.
- **Frequency:** notes appear on roughly 1 ply in 3; if a note appears 6 plies in a row the learner is in a fight, that is fine.
- **Hints:** Easy 3 / Normal 2 / Challenge 1; unused hints give nothing (no hoarding reward). After a hint is used and the
  learner ignores it, nothing happens. No "3 failures" rule in a game; the learner is never blocked.
- **Review rewards:** one calm closing line "You noticed {n} moments. Next game, look for liberties first." (static text).
  No stars from the review; opening it is optional.
- **Difficulty fit:** at Easy the bot mostly makes capture/atari facts, so notes teach the basics; at Challenge notes mostly warn
  about exposed groups.

## 7. Out of scope
On-board danger rings, take-back/undo, handicap (all owned by "9×9 for beginners"); win-rate graph or numeric score estimate;
AI-written commentary; saving games or reviews; hints that read ladders deeper than `scoreMoves` already does; review for
non-9×9 boards; sounds for notes.

## 8. Risks
- The level-2 scorer can pick a hint a strong player dislikes. Mitigation: reason categories are limited to what the engine proves.
- 40 playouts are noisy; the 30-point threshold and "at most 3 moments" make false positives rare. Tuning script
  `npm run tune:coach` (own Jest config) reports how often a known-bad move (self-atari in the opening) triggers a swing.
- A zh note ≤ 28 chars may truncate "{pt}" long text on 360 px; the test in AC 11 covers it.

## 9. Open decisions (PO: approve the defaults in one pass)
| # | Decision | Recommended default |
|---|---|---|
| 1 | Note structure | One line per ply, highest priority only, max 2 lines (yours, bot's), cleared on next touch |
| 2 | Note priority | capture > self-atari > exposed > atari > escape |
| 3 | Hints per game | Easy 3 / Normal 2 / Challenge 1; no penalty for using |
| 4 | Hint when best move is pass | Say "nothing urgent", no use consumed |
| 5 | Hint marker | Filled diamond (not a ring) to avoid clashing with danger rings |
| 6 | Review budget | ≤ 24 learner-move positions × 40 playouts, cap 80 plies, 4 positions per tick, Skip link |
| 7 | Swing threshold | 30 points of win chance, shown in words only (no percentages) |
| 8 | Number of moments | 1–3; none -> "quiet game" |
| 9 | Review availability | Games with ≥ 10 moves, count or resignation; not saved |
| 10 | Replay chip behaviour | Chip shows the position before the moment; Next reveals it |
| 11 | Hints and the "won" tick | No effect on the tick; "hints used" only in the review header |
| 12 | Point naming | Same `{point}` format as existing dispute messages (e.g. E4) |

## 10. Fixture checks (liberties verified by hand)
- A, capture: White `d5` has neighbours `c5 d4 d6` Black and `e5` empty. Black `e5` removes the last liberty -> 1 stone captured. Legal.
- B, self-atari: Black plays `a1` with White `b1`, `a2` empty -> liberties = {`a2`} (1). No capture. Legal (not suicide).
- C, atari: White `e5 e6` with Black `d5 d6 f5 f6 e7`; the only liberty `e4`. Black `e7` last played -> atari size 2.
- D, escape: Black `d5` with White `c5 e5 d4`, liberty `d6`; Black `d6` joins and gets `c6 e6 d7` = 3 liberties.
- E, exposed: Black `c3 c4` with White `b3 b4 d3`, liberties `c2 d4 c5`; White `c5` leaves `c2 d4`; White `d4` next leaves `c2` (one). The
  fact fires on the move that leaves exactly 1.

## 12b. Dev deviations (developer, 2026-10-22)
1. **`exposed` vs `atari` (§4.1).** On a 9×9 board a move can only take a liberty of a group it touches, so "a group of the mover,
   other than the played group, that lost liberties" cannot happen. Implemented as AC 6 describes it: `exposed` = an **opponent**
   group the move left with 1 liberty after ≥ 2 before (`color` = the group's owner). It is the same group as the mover's `atari`
   fact seen from the other side, so the note uses it only for the learner's groups (bot ply → "Your group at e4 has one liberty
   left."; learner ply → the `atari` line). `coach.bot.atari` is therefore only a fallback.
2. **Note slot.** The notes and the hint reason use the existing feedback card under the board (fixed 96 px, two lines; status line
   unchanged) instead of sharing the 56 px status slot — same "between board and buttons", the board never moves. The hint
   button is its own full-width row above Pass / Count now / Resign. Touching the board clears the notes via `onTouchStart` on the
   board wrapper (native touch; with a mouse on web they clear at the next commit). Using a hint also clears the notes.
3. **Copy.** App wording kept: zh 叫吃 / 提 / 机器人, fr « robot » (spec excerpt had 打吃 / 吃掉 / 对手 / bot); plurals use
   `{{count}}` (`_one/_other`). Points are lowercase (`e4`) like the dispute messages (AC 15). fr self-atari reads « n'a qu'une
   liberté » to stay ≤ 60 characters.
4. **Signatures.** `hintFor(state)` (the level only sets the count, `HINTS_PER_GAME`); `pickNote(facts, learner, mover)`;
   `buildReview(moves, komi, seed, learner = 'B')`, plus `planReview` / `evaluatePosition` / `reviewMoments` so the UI can run 4
   positions per tick. Win chance: new `winRate()` in `src/bot/playout.ts`.
5. **Swing sampling.** Learner moves after ply 6 are evaluated (all of them when ≤ 24, else 24 evenly sampled); the baseline is the
   position just before the first one.
6. **Not built (small):** the hint marker's single pulse and the hint line's [x]; the 150 ms note fade (no animation at all); the
   `npm run tune:coach` script (§8 risk note, no AC). Result screen with a review: [Review 复盘][Play again] then text buttons
   [Change level][Home], so the result fits 740 px.
7. **Web check:** `npm run verify:web:m6c` (QA script, Node 22); first manual screenshots `docs/screenshots/M6/40-*`–`42-*` (en).
8. **Lost-group line (QA round 1).** "It had {m} liberties one move before" was always 1, so the line now says when the group
   became weak: walking back from the move before the capture while the same stones are one group with one liberty →
   "It was in atari since move {m}." (`coach.review.lostGroup.since`), or "It was in atari one move before."
   (`coach.review.lostGroup.oneMove`) when m = n − 1 (`atariSince` in `src/coach/review.ts`).
9. **QA round 1 fixes.** Integer note params stay numbers (`formatParams`), so i18next picks `_one/_other` (plural coach texts
   showed raw keys). fr review caption shortened to « Partie abandonnée » and allowed to wrap.
