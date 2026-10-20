# M5 item 4 — Sequence v2: search-judged `sequence` + ladder play-along

Builds on `M5-life-death.md` §4 (runner, AC 14–38) and `M5-ko-forbidden-ladders.md` §13 (Option A, now chosen).
Coordinates: letter = column (no `i`), number = row, row 1 at the bottom.

## 0. In plain words (for the product owner)
- Today a `sequence` problem has exactly one right move per turn. A ladder does not: in the middle of the chase there are
  often **two** good ataris (on 5×5, after B c4 W d3, both e3 and d4 capture). The old judge calls the second one wrong. That is
  unfair to a learner who understood the lesson.
- New judge: the app **plays out the position** (a small, fast search, no AI, always the same answer). A move is right if,
  whatever White does to run away, Black still captures within the allowed number of moves. A wrong move shows what White does
  and a fact ("after the reply the group has 3 liberties").
- You get three ladder exercises where the learner plays **the whole chase**: `ladder-play` (5×5, in Unit 9 after "finish"),
  `ladder-play-corner` (7×7, last in Unit 9) and `r-ladder-play` (5×5 flipped, last in the Unit 9 review). Old Unit 9 exercises
  stay. Unit 9 grows from 7 to 9 exercises (about 5 minutes).
- Nothing changes for the existing life-and-death problems. The same design will later serve nets (枷) and problems with several
  answers; those are not built now.
- One thing I found while checking by hand: the second atari is **not always as good**. On 5×5 after B c4 W d3 B e3 W d4, the atari
  e4 looks fine but needs one move more (and one follow-up, e5, even loses to a White capture on e2). The new judge says "not in
  time" and shows the fact; the learner presses *Undo* and finds d5. Details in §3.

## 1. Goal
The learner plays a whole ladder move by move on a small board, can use either correct atari where two exist, and sees why a wrong
chase move lets White get away.

## 2. User stories
- As a beginner, I want any atari that really works to be accepted, so that I am not punished for a correct idea.
- As a beginner, I want to see what White does after my wrong move and how many liberties it gets, so that I understand why the ladder broke.
- As a beginner, I want the hint to point to a move that works from where I am now, so that I can always continue.
- As a content author, I want the validator to prove that the problem is solvable and that my scripted answer is a real answer, so that no unsolvable exercise ships.

## 3. Design decisions
**3.1 Where the search lives:** `src/bot/forcedCapture.ts` (pure TS; imports only `@/engine`; no React, no timers, no randomness).
Not in `src/exercises`, because the lesson validator (`src/lessons`) needs it and `src/exercises` already imports `src/lessons`
(avoids a cycle). `src/bot` already holds board analysis. The engine stays untouched.

**3.2 The question the search answers.** `forcedCapture(state, {attacker, target, maxMoves})`: *can the attacker capture the group that
contains `target` with at most `maxMoves` attacker moves, against every defence?* ("Move" = one stone of the attacker; a defender pass costs nothing.)

**3.3 Defence, exactly (`opponent: "run"`).** After each attacker move, if the target point is empty the target is captured (attacker wins).
Otherwise let G be the target group. The defender's candidate replies C are all **legal** moves (engine rules, simple ko included) of two kinds:
(a) a liberty of G (extend, also joins other stones); (b) a move that captures at least one attacker group that touches G
(capture to escape). The attacker wins the node only if it wins after **every** c in C.
- 1 candidate: that is the reply (the ladder case: "White extends on the only liberty").
- 0 candidates (e.g. the only liberty is suicide): the defender passes and the attacker moves again.
- ≥ 2 candidates: all must lose. The **displayed** reply is chosen deterministically: first the replies that survive the budget (if any),
  else the reply with the longest resistance (most attacker moves needed); then most liberties of G after the reply; then lowest column letter;
  then lowest row number. Same input, same output, always.
- Not modelled (documented limit): defender tenuki to make a bigger threat elsewhere, snapback tricks beyond (b). Ladder judgement is
  therefore "White cannot escape by running or by capturing a chaser".

**3.4 Attacker moves inside the proof** are only the legal liberties of G (and captures of G). The **learner's own move** is judged on *any* legal
point, then the proof follows with the restricted set. Nets and tsumego will widen the set later through one extra option (§3.8).

**3.5 Pruning (what keeps it cheap).** At an attacker node with r moves left, if libs(G) > r the node fails at once (every move removes at most
one liberty). Transposition table keyed by (board, side to move, ko point, r). Node = one engine move application.
Budget: **3 000 nodes** per search (hard cap; hitting it counts as "not forced", and the validator rejects any shipped exercise that hits it).
Expected: ≤ 700 nodes for the three shipped exercises (the proof from the start), ≤ 150 for one learner tap.
Phone guideline: ≤ 0.1 ms per node on a mid-range phone, so a tap never needs more than ~0.3 s worst case; it runs inside the tap handler and
the stone is drawn first. Reference: a 7×7 ladder that runs to the far edge (16 plies, 8 learner moves; ko spec §12b) must stay under the cap.

**3.6 Schema (additive).** `SequenceExercise` gets one optional field:
```ts
judge?: { kind: 'line' }                                        // default: today's behaviour, nothing changes
      | { kind: 'search'; opponent: 'run'; maxMoves?: number }  // maxMoves = learner moves; default ceil(line.length / 2)
```
`line` stays required and means "the canonical answer": it is the revealed answer and the first hint. `wrong` is not allowed with `kind: 'search'`.
Search judging needs `goal.kind: 'capture'`. Existing exercises have no `judge` and judge exactly as before.

**3.7 Slow-but-working moves.** Default `maxMoves` = canonical length, so equally short alternatives pass and a longer detour fails with a fact.
Authors may raise `maxMoves` when a detour is a genuine teaching alternative. For these three exercises it stays at 4: the detour e4 at ply 4 (§6) is shape-poor.

**3.8 Extension points** (nothing built now): `opponent` gets more values (`"any"`: all legal replies in a region, for tsumego); an optional
`attackerMoves` field widens the proof set (nets). Both are union additions; the search takes the two move generators as arguments.

## 4. Acceptance criteria
"Replay" = apply moves with the real engine from the setup (+ prelude). Test files: `src/bot/forcedCapture.test.ts`,
`src/lessons/validate.sequence.test.ts`, `__tests__/m5-sequence-v2.test.ts`, runner tests next to `SequenceRunner`.

**A. Search**
1. Given 5×5 B b3 c2 d2, W c3, B to play, target c3, maxMoves 4, when `forcedCapture` runs, then it returns forced = true, and the winning first
   moves are exactly {c4}; d3 is not winning (after W c4 the group c3-c4 has liberties b4 c5 d4 = 3, and every further atari lets White extend again).
2. Given the position after B c4 W d3 (4 → 3 moves left), then winning moves are exactly {e3, d4}.
3. Given the position after c4 d3 e3 d4 (2 left), then winning = {d5}; e4 is not winning (after W d5 the group has 2 liberties c5 e5, 1 move left).
4. Given the position after c4 d3 d4 e3 (2 left), then winning = {e4, e2}.
5. Given the position after c4 d3 e3 d4 e4 d5 (3 Black moves played, maxMoves 5, so 2 left), then B e5 is **not** winning (W e2 captures e3 e4 e5 and escapes) and B c5 is
   winning (White's only liberty e5 is suicide, so White passes, B e5 captures). Proves rule (b) and the pass rule.
6. Given a defender with 0 legal candidates, then the search treats it as a pass; given the same input twice (and in reversed move order),
   then the displayed reply is identical (tie-break of §3.3, tested with a position with two equal replies).
7. Given a 7×7 ladder to the far edge (u09 e6 position without f5 and b6, maxMoves 8), then forced = true and nodes ≤ 3 000; given the cap set to 50,
   then the result is `capped: true`, forced = false (never throws, never loops).
8. `src/bot/forcedCapture.ts` imports nothing from `react`, `react-native`, `expo` and has no `Math.random`, `Date` or timers (purity test extended).

**B. Schema and validator** (`validateLesson`)
9. Given a `sequence` without `judge`, then validation and judging are byte-for-byte as before (all existing sequence tests pass untouched).
10. Given `judge.kind: 'search'` with a `goal.kind: 'line'` → `SEQ_SEARCH_NEEDS_CAPTURE`; with `wrong` present → `SEQ_SEARCH_NO_WRONG`;
    with an unknown `kind`/`opponent` or `maxMoves` not an integer in `ceil(line.length/2)..8` → `SEQ_BAD_JUDGE`; with an even `line` length → `SEQ_SEARCH_LINE_END`.
11. Given a search exercise, then for every learner move `line[k]` the search must accept it from the replayed position (else `SEQ_NOT_FORCED`, path `line[k]`),
    and the engine's displayed reply must equal `line[k+1]` (else `SEQ_REPLY_MISMATCH`). So the canonical line is itself a proven answer.
12. Given a search exercise whose proof needs more than 3 000 nodes in total → `SEQ_NODE_BUDGET`. Validation of all shipped lessons stays under 2 s in Jest.
13. Given `import:sgf`, a `.src.json` exercise with a `judge` field is copied unchanged into the lesson JSON (drift test unchanged for existing files).

**C. Runner** (search-judged exercises; every other behaviour of M5-life-death AC 14–38 stays)
14. Given a search exercise at the start, then the progress row reads "Move 1 of M" with M = `maxMoves` (default canonical count) and the Hint button is enabled.
15. Given the learner plays a legal move that the search accepts and the target is not yet captured, then the stone is placed, the board locks ("White replies…"),
    after 500 ms the **displayed reply** is placed, the board unlocks and progress is "Move n+1 of M". Progress counts learner moves played.
16. Given the learner's accepted move captures the target, then the exercise is `correct`, the captured stones fade, the last stone gets the green ring, feedback shows
    `explainKey` and `sequence.captured` (count from the engine). No reply is played.
17. Given a legal move the search rejects, then the stone is placed, the **displayed reply** is placed after 500 ms (if the defender has one), the board stays locked,
    one try is spent, the mistaken stone has the dashed rouge ring, and the feedback shows the facts of AC 18. Button: *Try again* at move 1, *Undo* afterwards;
    *Undo* removes the learner's stone and the reply, and keeps the progress.
18. Wrong-move facts, computed from the engine, in this order (all that apply): (i) if the learner's move left the target group in atari (1 liberty) →
    `sequence.wrong.atariButEscapes`; (ii) if the reply captured k ≥ 1 learner stones → `sequence.wrong.chaserCaptured` (count k), else if the reply group has n liberties →
    `sequence.wrong.afterReply` (count n); (iii) if there was no reply → the existing `sequence.wrong.liberties` (count after the move).
    Examples: 5×5 `ladder-play`, first move d3 → "atari but can still escape" + "After the reply, the group has 3 liberties" (reply W c4);
    at move 3 (after c4 d3 e3 d4) move e4 → "atari…" + "…2 liberties" (reply W d5).
19. Given a legal move that the search accepts but that is not `line[k]` (e.g. d4 at move 2), then it is treated exactly like a line move (AC 15); the learner is never told
    "wrong". Given then B e4 W e2 B e1 (the b1 line) the exercise is solved with 4 captured stones.
20. Given the Hint button (or the 2nd mistake), then the ring pulses on `line[k]` **if the position so far equals the canonical line**, otherwise on the first winning move of
    the search at the current position (order: fewest moves to capture, then lowest column, then lowest row). Hint text = `hintKey`; `hintUsed` set. Example: after c4 d3 d4 e3 the ring is on e2.
21. Given three mistakes, then the board resets to the start and the canonical `line` plays automatically (800 ms apart), then *Next*; outcome `revealed`.
    The `explainKey` text names the alternative only where relevant (§6). Reduced motion: as AC 31 of M5-life-death.
22. Given an illegal tap (occupied, suicide, ko), then the engine sentence shows, nothing is placed, no try is lost (AC 17 of M5-life-death).
23. Given the learner leaves the screen while a reply is scheduled, then no timer fires after unmount (fake-timer test).
24. Judging a tap runs the search synchronously: ≤ 3 000 nodes, test asserts nodes ≤ 150 for every move of every shipped exercise (all legal first moves at each reachable position).

**D. Content** (`src/lessons/content/u09-ladder.json`, `u09-review.json`; all hand-checked in §7)
25. Then `u09-ladder` has 9 exercises in the order of §7, ids `liberties-after, first-atari, chase-on, finish, ladder-play, ladder-breaker, find-breaker, corner-ladder, ladder-play-corner`;
    `u09-review` has 9 exercises, last id `r-ladder-play`; all three new exercises are `sequence` with `judge: {kind:"search", opponent:"run"}`.
26. Then each new exercise has `promptKey`, `hintKey`, `hintPoints` (the first move), `explainKey`; all text keys exist in zh-CN, en, fr within limits (zh ≤ 70, en/fr ≤ 160 characters);
    the five new `sequence.wrong.*` keys of §5 exist in all three files with the plural suffixes of `sequence.wrong.liberties`.
27. Then the accepted-move sets are exactly (test pins them, per position reached along the line and along the d4/f6/e3-flip branches):
    `ladder-play`: move 1 {c4}; move 2 {e3, d4}; move 3 after e3 {d5}, after d4 {e4, e2}; move 4 {e5} / {e1} / {e5}.
    `ladder-play-corner`: move 1 {e6}; 2 {g5, f6}; 3 after g5 {f7}, after f6 {g6, g4}; 4 {g7} / {g3} / {g7}.
    `r-ladder-play`: move 1 {c2}; 2 {e3, d2}; 3 after e3 {d1}, after d2 {e2, e4}; 4 {e1} / {e5} / {e1}.
28. Then every existing test that counts Unit 9 or review exercises (7 / 8) is updated; Unit 9 and the review still unlock and score by the unchanged M3 star rules (`STAR_RULES`).

**E. Quality**
29. `lint`, `typecheck`, `format:check`, `test` green; no new dependency; web screenshots (360×740) of the four runner states for `ladder-play-corner`
    (start, mid-ladder, wrong with reply, solved) in `docs/screenshots/M5/` (`23-*`).

## 5. Screen flow and UI
No new screen. The runner of M5-life-death §5 is unchanged: instructions card on top, board, feedback card below, Hint / Undo(Try again) / Next row (≥ 44 px).
States: start; waiting for reply ("White replies…", locked); mid-ladder; wrong (stones + reply shown, dashed ring, facts, *Undo*); correct (green ring, captured count,
explanation); revealed. 7×7 with coordinates: cells 41 px (PO decision kept). The wrong-state feedback card may hold two short lines; min height 72 px as before (a test for the
two-line case at 360 px, 5×5 and 7×7).
```
 [x]  Unit 9 · Ladder          9/9
 ┌ Chase the white stone all the way and capture it. ┐
   Move 3 of 4                                   (28px)
   5 . . . . .
   4 . . X O .     board 328 px, coordinates on
   3 . X O O .
   2 . . X X .
   1 . . . . .
 ┌ That is an atari, but the group can still escape. ┐
 │ After the reply, the group has 2 liberties.       │
 [ Hint ]                       [ Undo ]
```
New copy keys (zh-CN / en / fr):
| Key | zh-CN | en | fr |
|---|---|---|---|
| sequence.wrong.atariButEscapes | 这是叫吃，但白棋还能逃出。 | That is an atari, but the group can still escape. | C'est un atari, mais le groupe peut encore s'échapper. |
| sequence.wrong.afterReply_one / _other | 对方应一手后，这块棋有 {{count}} 口气。 | After the reply, the group has {{count}} liberty. / liberties. | Après la réponse, le groupe a {{count}} liberté. / libertés. |
| sequence.wrong.chaserCaptured_one / _other | 对方提掉了你 {{count}} 颗子，这块棋脱困了。 | The reply captured {{count}} of your stones and the group is free. (one: "…captured your stone…") | La réponse a capturé {{count}} de vos pierres : le groupe est libre. (one: "…capturé une de vos pierres…") |
"White/Black" is never named in these lines (the opponent may be either colour).

## 6. Game design notes
- Difficulty: `ladder-play` is the first time the learner plays a whole chase; Unit 9 e1–e4 scaffold it (liberty count, first atari, one chase step, the finish). The corner exercise
  repeats it on 7×7 as the capstone and the review once more, flipped vertically, so the learner cannot rely on "the staircase goes up-right".
- Success target ~80%: the only common mistakes are the first atari (d3/f5/c2-mirror: tested by Unit 9 e2 first) and the slow second atari (e4/g6/e2-flip at move 3 after the first branch).
  Both show a fact and *Undo*/*Try again* (one try each).
- Hint policy: hint button any time; opens by itself after the 2nd mistake; the ring never shows a move that fails. Three mistakes → revealed canonical line (one of two valid ones; this is
  fine, the explanation says "atari after atari" and does not claim uniqueness).
- Rewards: unchanged (stone sound, capture fade, green ring, captured count). No new sound or animation.
- Stars: unchanged rule. A clean `ladder-play` needs no hint and no mistake.
- Teaching the "slow atari": shown only through facts after a mistake ("atari, but the group can still escape", "the group has 2 liberties"). The detour e4 (and e5 after it) is not explained in text:
  it is a shape point for later (Unit 12+).

## 7. Content (lesson JSON)
Hand-check (done by the designer, positions replayed move by move; the developer test AC 1–5, 27 re-proves them with the real engine):

**L1 `ladder-play`, 5×5, setup B b3 c2 d2, W c3** (c3 liberties d3 c4; b3 c2 are Black).
- Line: B c4 (c3 → lib d3) · W d3 (group c3 d3: libs e3 d4) · B e3 (lib d4) · W d4 (c3 d3 d4: libs e4 d5) · B d5 (lib e4) · W e4 (libs e5 only) · B e5 captures c3 d3 d4 e4 (4).
- Move 1: d3 is also an atari but W c4 gives c3 c4 libs b4 c5 d4 = 3; no capture in 3 more moves: wrong. Only c4 works.
- Move 2 alternative B d4 (c3 d3 lib e3) · W e3 (c3 d3 e3: libs e2 e4) · then either B e4 · W e2 (libs e1 only; d2 c2 keep b2 c1 d1) · B e1 captures 4; or B e2 · W e4 (lib e5 only) · B e5 captures 4. Both are 4 moves.
- Move 3 after e3/d4: d5 as above. B e4 instead (lib d5): W d5 (libs c5 e5), 2 liberties with 1 move left: wrong in budget 4. (Beyond budget: B e5 W e2 captures e3 e4 e5 → White escapes; B c5, White's only liberty e5 is suicide, B e5 captures: 5 moves.)
- White's capture-to-escape (rule b) never applies on the main line: no black stone touching the white group has 1 liberty when White moves (e3: e2 e4; d5: c5 e5; c4: b4 c5 d4).
**L2 `ladder-play-corner`, 7×7** = L1 shifted +2 columns, +2 rows (B d5 e4 f4, W e5; edges are the board edges; extra empty space only gives Black stones more liberties).
- Line: B e6 · W f5 · B g5 · W f6 · B f7 · W g6 · B g7 captures e5 f5 f6 g6 (4). Alternative move 2 B f6 · W g5 · then B g6 · W g4 · B g3 (g4 libs: g3 only) or B g4 · W g6 (lib g7) · B g7. Move 1 f5 fails (W e6: e5 e6 libs d6 f6 e7 = 3).
**L3 `r-ladder-play`, 5×5 = L1 flipped vertically** (B b3 c4 d4, W c3): B c2 · W d3 · B e3 · W d2 · B d1 · W e2 · B e1 captures c3 d3 d2 e2 (4). Alternative move 2 B d2 (W e3, libs e2 e4) → B e2 · W e4 · B e5, or B e4 · W e2 · B e1.
Checked: all moves legal (no suicide, no ko); every White extension has ≥ 1 liberty; each Black stone has ≥ 1 liberty after its move.

```json
{"id":"ladder-play","type":"sequence","size":5,"setup":{"B":["b3","c2","d2"],"W":["c3"]},"toPlay":"B",
 "goal":{"kind":"capture","target":"c3"},"judge":{"kind":"search","opponent":"run"},
 "line":[{"color":"B","at":"c4"},{"color":"W","at":"d3"},{"color":"B","at":"e3"},{"color":"W","at":"d4"},{"color":"B","at":"d5"},{"color":"W","at":"e4"},{"color":"B","at":"e5"}],
 "promptKey":"lesson.u09-ladder.e8.prompt","hintKey":"lesson.u09-ladder.e8.hint","hintPoints":["c4"],"explainKey":"lesson.u09-ladder.e8.explain"}
{"id":"ladder-play-corner","type":"sequence","size":7,"setup":{"B":["d5","e4","f4"],"W":["e5"]},"toPlay":"B",
 "goal":{"kind":"capture","target":"e5"},"judge":{"kind":"search","opponent":"run"},
 "line":[{"color":"B","at":"e6"},{"color":"W","at":"f5"},{"color":"B","at":"g5"},{"color":"W","at":"f6"},{"color":"B","at":"f7"},{"color":"W","at":"g6"},{"color":"B","at":"g7"}],
 "promptKey":"lesson.u09-ladder.e9.prompt","hintKey":"lesson.u09-ladder.e9.hint","hintPoints":["e6"],"explainKey":"lesson.u09-ladder.e9.explain"}
{"id":"r-ladder-play","type":"sequence","size":5,"setup":{"B":["b3","c4","d4"],"W":["c3"]},"toPlay":"B",
 "goal":{"kind":"capture","target":"c3"},"judge":{"kind":"search","opponent":"run"},
 "line":[{"color":"B","at":"c2"},{"color":"W","at":"d3"},{"color":"B","at":"e3"},{"color":"W","at":"d2"},{"color":"B","at":"d1"},{"color":"W","at":"e2"},{"color":"B","at":"e1"}],
 "promptKey":"lesson.u09-review.e9.prompt","hintKey":"lesson.u09-review.e9.hint","hintPoints":["c2"],"explainKey":"lesson.u09-review.e9.explain"}
```
Order: `ladder-play` is inserted after `finish`; `ladder-play-corner` is appended after `corner-ladder`; `r-ladder-play` is appended to the review. New text keys are numbered e8/e9 (the
existing e1–e7 keys are not renumbered).

| Key | zh-CN | en | fr |
|---|---|---|---|
| u09-ladder.e8.prompt | 把白棋一路追到边上，全部提掉。 | Chase the white stone all the way and capture it. | Poursuivez la pierre blanche jusqu'au bord et capturez-la. |
| u09-ladder.e8.hint | 每一手都叫吃，把白棋赶向棋盘边。 | Atari every time, driving White toward the edge. | Mettez en atari à chaque coup, en poussant les Blancs vers le bord. |
| u09-ladder.e8.explain | 征子成功：一路叫吃，白棋在边上被提。中途有时两种叫吃都行。 | The ladder works: atari after atari, and White is captured at the edge. Sometimes two ataris work. | L'échelle réussit : atari après atari, capture au bord. Parfois deux ataris conviennent. |
| u09-ladder.e9.prompt | 这个征子追向角落。追打并提掉白棋。 | This ladder runs into the corner. Chase and capture. | Cette échelle va vers le coin. Poursuivez et capturez. |
| u09-ladder.e9.hint | 先叫吃，把白棋赶向角。 | Start with the atari that drives White toward the corner. | Commencez par l'atari qui pousse les Blancs vers le coin. |
| u09-ladder.e9.explain | 追到角上，白棋没有退路，被提。 | In the corner White has no way out and is captured. | Dans le coin, les Blancs n'ont plus d'issue et sont capturés. |
| u09-review.e9.prompt | 这次白棋向下逃。一路叫吃，提掉白棋。 | This time White runs downward. Chase and capture. | Cette fois les Blancs fuient vers le bas. Poursuivez et capturez. |
| u09-review.e9.hint | 从会把白棋赶向棋盘边的一侧叫吃。 | Atari from the side that drives White toward the edge. | Mettez en atari du côté qui pousse les Blancs vers le bord. |
| u09-review.e9.explain | 征子又成功了：叫吃到边上，提掉白棋。 | The ladder works again: atari to the edge, then capture. | L'échelle réussit encore : atari jusqu'au bord, puis capture. |
Terms: 征子 zhēngzi was introduced in Unit 9 steps; no new term, no new pinyin.

## 8. Out of scope
Nets 枷 and double atari; multi-answer tsumego and `opponent: "any"`; ko threats inside the search (simple ko is respected, nothing more); scripted `wrong` branches together with search judging;
a defender that tenukis; showing a second valid line in the revealed answer; changing existing exercises' judging; new sounds, animations, screens or SGF syntax; any AI or randomness.

## 9. Open decisions for the product owner (default in bold)
1. Keep Unit 9 e3 "chase-on" and e4 "finish" and add the two sequences (9 exercises, ~5 min) — **yes**; alternative: drop e3+e4, which `ladder-play` replaces (7 exercises).
2. `maxMoves` = canonical length (4) so the slower atari (e4/g6) is "not in time" — **yes, strict**; alternative: allow +1 and tell the learner nothing (risks accepting the shape-poor e4 followed by a losing e5).
3. Review exercise is the **vertical flip** (White runs downward) rather than the left-right mirror of ko spec §13 — **vertical** (more new-looking); mirror alternative is easy (setup B d3 c2 b2).
4. Wrong move shows White's reply stone and the liberty fact, then *Undo* — **yes**; alternative: no reply stone, only the fact.
5. Hint ring follows the position (not always the canonical line) — **yes**.
6. Node cap 3 000 and "judge on the tap handler" — **yes**; revisit only if the iPhone check feels slow (then defer the search by one frame).
7. Search lives in `src/bot/forcedCapture.ts` — **yes**; alternative `src/engine/` (rules-adjacent, but engine stays rule-only today).

## 9a. PO decisions (2026-10-20)
The product owner approved the spec ("approve"): all §9 defaults accepted — keep u09 e3/e4 and add the two
play-alongs (9 exercises); strict `maxMoves` = canonical length; review exercise is the vertical flip; wrong move
shows White's reply + fact then *Undo*; hint ring follows the position; node cap 3 000 judged on the tap handler;
search in `src/bot/forcedCapture.ts`.

## 9b. Developer deviations (2026-10-20)
1. **The net move is also accepted at move 2 (AC 2, 27).** The real engine proves that after B c4 W d3 the non-atari
   B e4 (a net 枷) captures in the same 3 remaining moves: W d4 · B d5 · W e3 · B e2, or W e3 · B d4 (or e2) · W e2 (d4) ·
   B e1 (d5). By the judge rule of §3.2/§3.4 ("any legal point … whatever White does") it is right, so the accepted sets
   at move 2 are `ladder-play` {d4, e3, **e4**}, `ladder-play-corner` {f6, g5, **g6**}, `r-ladder-play` {d2, e3, **e2**}.
   Follow-ups pinned in `__tests__/m5-sequence-v2.test.ts`: after the net the displayed reply is d4 / f6 / d2 (equal
   resistance, lower column), then {d5} / {f7} / {d1}, then {e2} / {g4} / {e4}. No content change; the line, the hint
   (the line while on it) and the revealed answer never show the net. AC 1 and AC 3–5 hold exactly as written.
2. **zh-CN `sequence.wrong.atariButEscapes`** is 这是叫吃，但这块棋还能逃出。 (the §5 table had 白棋, which breaks the
   rule "White/Black is never named in these lines").
3. **fr texts** use a non-breaking space before ":" (`e8.explain`, `review.e9.explain`, `chaserCaptured_*`), as the
   French typography test requires.
4. **Pruning note (§3.5):** "libs(G) > r fails at once" assumes the defender never has to reduce its own liberties; a
   position where every reply self-reduces could be judged "not forced" although it is. Never the case in a ladder;
   revisit with nets/tsumego (§3.8).
5. **Hint off the line (AC 20)** searches the proof set (the liberties of the target group), not every board point.
6. Validator: `ValidationContext.searchNodes` (tests only) overrides the 3 000-node budget so `SEQ_NODE_BUDGET` can be
   tested. The proof runs even when `SEQ_GOAL_NOT_MET` is reported, so `SEQ_NOT_FORCED` points at the first bad move.
7. Measured: the three shipped proofs need 11 nodes each; the worst learner tap 27 nodes; the 7×7 far-edge ladder
   (8 moves) 886 nodes (~25 ms in Jest on a Mac). Web check: `npm run verify:web:m5d` (screenshots `23-corner-*`).
