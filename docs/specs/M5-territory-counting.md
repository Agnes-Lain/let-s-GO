# M5 item 4 — Territory, counting and end of game (Units 12–14, zh-CN + en + fr)

Covers the last M5 roadmap item "Territory & counting exercises". Builds on `M5-life-death.md` (layout rule §5.6, `UnitEntry.laterLessons`,
key naming, text limits, star rules), `M3-lesson-framework.md` (runners, attempts, hints) and `M1-rules-engine.md` (`score()`, passes).
Status: **draft for product-owner approval** (no code written). Decisions the PO must take are in §12, each with my default.

## 0. In plain words (for the product owner)
- **Three short lessons and one checkpoint**: Unit 12 **地 Territory** (empty points that only one colour surrounds), Unit 13 **数子
  Counting** (Chinese rules: your stones plus your territory, then komi 贴目), Unit 14 **终局 End of game** (two passes end the game;
  dead stones 死子 are taken off before counting) and a checkpoint **Review 4** that mixes the three. 28 exercises, 9 explanation steps.
  I recommend keeping Unit 14 in this item (§12 decision 1): once the "mark" screen exists, dead stones cost almost nothing extra.
- **One new screen behaviour: "mark".** You tap the points you think are Black's (or White's) territory, or tap the stones you think are
  dead, then press *Check*. Wrong marks flash and are removed with a plain reason ("these two points touch both colours: neutral");
  correct marks stay. Territory is drawn the traditional way: a small square in the owner's colour.
- **The counting screen gets a number pad.** Until now the count screen only had the digits 0–9. Areas go up to 45, so the pad now types
  two digits (with a delete key). If you type a typical mistake, the app says which one ("that is only the stones — add the territory").
- **Every answer is proved by the engine, not by me.** The validator computes the territory, the areas and the winner with the real
  `score()` and refuses a lesson whose answer differs. Dead stones are proved by the capture search from the previous item, plus an
  exhaustive test (QA) that the walls around them are alive. I checked every board by hand too (§10).
- Boards are deliberately tidy (straight walls, 5×5 first, one 7×7 and one 9×9 at the end). Real, wiggly positions come with the full
  games in M6.
- ASCII wireframes are in §5; an HTML mockup can be added before development if you want one.

## 1. Goal
A beginner who finishes Units 12–14 can point out the territory 地 dì of each side and the neutral points 单官 dānguān, count a finished
5×5, 7×7 or 9×9 position under Chinese rules (stones + territory, plus komi 贴目 tiēmù for White), tell when a game is over (two passes in
a row), and take dead stones 死子 sǐzǐ off the board before counting — in zh-CN, en or fr.

## 2. User stories
- As a beginner, I want to see territory as "empty points only I surround", so that scoring is a picture, not a formula.
- As a beginner, I want to tap the territory myself and be told which taps were wrong and why, so that I learn the border between mine,
  theirs and neutral.
- As a beginner, I want to know that neutral points (touching both colours) belong to nobody, so that I do not count them.
- As a beginner, I want to add my stones and my territory with a number pad and get a hint when I made a typical mistake, so that
  counting becomes a habit.
- As a beginner, I want komi explained with one concrete example where it decides the game, so that "White gets extra points" makes sense.
- As a beginner, I want to know exactly when a game ends (two passes in a row), so that I am never unsure whether I may still play.
- As a beginner, I want to learn that a lonely stone inside the enemy's area is dead and is simply taken off, so that I count a
  finished game the way a referee does.
- As a beginner who is tired of counting 45 points, I want to put small dots on the points I already counted, so that I do not lose my place.
- As a player using a screen reader or reduced motion, I want marks and results announced in words and no required animation.
- As the product owner, I want the course to stay calm: no new colours, sounds or art; one idea per lesson.

## 3. Scope, curriculum mapping, key decisions
| Unit | Lesson id | Kind | Steps | Exercises | Types | `CURRICULUM.md` source |
|---|---|---|---|---|---|---|
| 12 地 | `u12-territory` | lesson | 3 | 7 | mark ×5 (2 with a neutral-point trap), choice ×1, count ×1 | "Mark the territory of each side" |
| 13 数子 | `u13-counting` | lesson | 3 | 7 | count ×5 (score), choice ×2 (winner) | "Count a finished 7×7 / 9×9 position" |
| 14 终局 | `u14-end` | lesson | 3 | 7 | choice ×2 (passes), mark-dead ×3, count ×2 (with dead stones) | "Decide when the game is over; remove dead stones" |
| 14 checkpoint | `u14-review` | checkpoint | 0 | 7 | mark ×2, choice ×3, count ×2 | mixes 12–14 |
Total 9 steps, 28 exercises. Hand-written JSON (no SGF). Boards: 5×5 for everything except R1 and R3 (7×7) and R4 (9×9). Coordinates on.
Unit 12 is exactly: e1–e3 and e5–e6 `mark`, e4 `choice`, e7 `count` (§7 is authoritative).

Decisions made in this spec (PO may overrule, §12): (1) Unit 14 is part of this item; (2) a new exercise type `mark`, not a mode of
`tap-point`; (3) `count` gets a `score` answer computed by the engine and a two-digit entry pad; (4) `choice` gets an engine-proved
`prove` (owner of a point / winner with komi); (5) neutral points are taught in Unit 12 (step 3), not later; (6) no decimal entry:
komi is handled by a "who wins?" choice; (7) one colour per territory exercise; (8) pass term 弃权 qìquán.

Deviations from `CURRICULUM.md`, on purpose: the units are 3 lessons + one shared checkpoint on the map (Unit 14 has two nodes, like
Unit 9 and 11); the "9×9" counting is in the checkpoint (r4–r5), 5×5 and 7×7 carry the lessons; seki and "who is alive?" judgments on
real positions are not taught (§11). Stars: M3 constants. Unlock: existing rule (a unit unlocks at 1★ on the closest earlier unit;
a later lesson / checkpoint opens at 1★ on the lesson before it).

## 4. Acceptance criteria
Coordinates: letter = column (no `i`), number = row, row 1 at the bottom. Position names (T1, A, C, C2, P3, D, R1, R3, R4, K0, K, K2, N)
are defined in §7.0. "Content test" = `src/lessons/content.test.ts`. QA turns each criterion into a test. Komi in every check is the
one printed in the exercise (0.5 on 5×5/7×7, 7.5 on 9×9).

**A. Files and validity**
1. Given the repo after this item, then `src/lessons/content/` additionally holds `u12-territory.json`, `u13-counting.json`,
   `u14-end.json`, `u14-review.json` (named after their `id`, registered, no `generatedFrom`).
2. When the content test runs, then every file passes `validateLesson` with `hasText` over zh-CN, en and fr and `validateCatalog`
   is `{ ok: true }` (Units 1–14 each have a lesson, Unit 14 also a checkpoint). `PLANNED_UNITS` is `[]`; no unit on the map shows
   "coming soon"; the existing footer "More units coming soon" stays.
3. Then step counts are 3/3/3/0 and exercise counts 7/7/7/7 with the ids and types of §7.
4. Then `getSolution` of every new exercise equals the "Right answer" column of §7 (one parametrised test; sets for `mark`).
5. Then every text key exists in zh-CN, en and fr within limits (zh-CN ≤ 70 characters, en/fr ≤ 160; step texts ≤ 135 en/fr),
   i18n parity holds, no existing key is removed, and `unit.13.title`, `unit.14.title` and the keys of §5.4 exist in all three files.
6. Then every wrong `choice` option has a `whyKey`; every `mark` has `hintKey`, `hintPoints` (a subset of its solution) and `explainKey`;
   every `mark` of kind `dead` whose position has an alive group has `whyKeys` for it; all four lessons have `"coordinates": true`.
7. Then tests that assumed "Unit 12 is planned" are updated, and no existing lesson file changes.
8. Regression: `count` exercises with a numeric or `libertiesOf` answer (Units 2, 5, 10, 11) keep the 0–9 chip screen unchanged.

**B. Content correctness (proved by the engine)**
9. Given each `mark` of kind `territory`, then its solution equals the set of empty points whose `score(board, {komi}).ownership`
   equals `side`: A/B = {a1,a2,a3,a4,a5}; C/B = {a1,a2,b1,b2,c1,d1,e1}; C2/W = {a5,b5,c5,d4,d5,e4,e5}; P3/B = {a1..a5}; D/B = {a1,a2,b1,b2,c1,d1,e1};
   D/W = {a5,b5,c5,d5,e5}.
10. Given each `count` with a `score` answer, then its value equals the engine: D: B stones 6, B territory 7, B area 13, W area 10,
    dame {d3,e3}; C: W area 12, B area 13; R1: B territory 11; R3: B area 25, W area 24; R4: B area 45, W area 36; K with dead c1: B area 10;
    N with dead {c1,c5}: B area 10, W area 15.
11. Given each `choice` with `prove`, then exactly the option whose `outcome` equals the engine's answer has `correct: true`:
    P3 owner of c3 = none; D owner of d3 = none; P3 winner (komi 0.5) = W by 0.5; R3 winner (0.5) = B by 0.5; R4 winner (7.5) = B by 1.5;
    N winner (0.5, dead c1,c5) = W by 5.5.
12. Given every starting position of §7.0, then `createGame` accepts it (no group without liberties) and it contains stones of both colours.
13. Given the dead-stone problems (`K`, `K2`, `N`), then (a) the bounded capture search (`src/bot/forcedCapture.ts`, defender policy `run`)
    shows that the owner of the walls captures each marked stone/group; (b) a test-only exhaustive search (as `lifeDeath.ts` in M5 item 3)
    shows that the walls cannot be captured even when the dead stones' owner moves first: B row 2 in `K`/`N`, W row 4 in `K2`, W row 3 in `N`.
14. Given `u14-end` e1/e2 and the engine `pass` API, then Black pass + White pass gives `isOver === true`, and Black pass + White move
    + Black pass gives `isOver === false`.
15. Given each explanation step with numbers (u13 s1–s3, u14 s3), then the numbers in the text equal the engine's (6+7=13, 5+5=10,
    13 vs 10.5, 5+5=10, 5+10=15).

**C. Validator rules** (`src/lessons/validate.ts`; new codes, each with a negative test)
16. `MARK_BAD_KIND` (`mark` not `territory`/`dead`); `MARK_NO_SIDE` (territory without `side`); `MARK_FIELD` (`side` on a dead exercise, or
    `dead` on a territory exercise); `MARK_ONE_COLOR` (territory exercise whose setup has stones of one colour only: the whole board would be territory).
17. `MARK_EMPTY_ANSWER` (territory solution empty); `MARK_DEAD_NOT_STONE` (a `dead` vertex has no stone); `MARK_TERRITORY_DEAD` (a position
    with territory marking must not need dead stones: the territory is computed with no dead stones).
18. `MARK_DEAD_NOT_PROVEN` when the bounded search cannot capture a marked group (node cap raised for this rule to 20 000 if needed, or the
    result is "unknown" → error); `MARK_WHYKEY` when a `whyKeys` key is not a stone of an unmarked group.
19. `SCORE_BAD` (`of` not `stones`/`territory`/`area`; `side` not `B`/`W`), `SCORE_BAD_DEAD` (dead vertex is not a stone), `SCORE_RANGE`
    (value < 1 or > 99).
20. `CHOICE_PROVE_MISMATCH` (the option with the engine's outcome is not the only `correct` one), `CHOICE_PROVE_OPTIONS` (an option lacks
    `outcome`, or the outcomes are not unique), `CHOICE_PROVE_DRAW` (winner problem that ends in a draw), `CHOICE_PROVE_KOMI` (komi not a
    multiple of 0.5).
21. The validator never relies on text: all of the above use only positions, vertices and the engine.

**D. `mark` runner — flow** (`src/exercises/runners/MarkRunner.tsx`; pure logic `src/exercises/mark.ts`)
22. Given a `territory` exercise, when it opens, then the board is interactive, no point is marked, the status row reads "Marked: 0"
    (`practice.mark.count`), *Check* is disabled.
23. When the learner taps an empty point, then a territory square in the colour of `side` appears on it (black square for B; white square with
    the `stone.whiteEdge` outline for W), the counter increases, *Check* becomes enabled; tapping it again removes the square.
24. When the learner taps a stone in a territory exercise, then no mark is made, the feedback card shows `fb.mark.extra.stone`
    ("Stones are not territory…") and **no mistake is counted**.
25. When the learner presses *Check* with exactly the solution marked, then the outcome is correct (clean/solved by M3 rules), the squares
    get the success ring, `explainKey` appears, *Next* replaces *Check*.
26. When the learner presses *Check* with a wrong set, then one mistake is counted; correct marks stay; every extra mark flashes the
    error ring for `FLASH_MS` and is removed; the feedback card shows at most two lines, in this order:
    (a) `fb.mark.extra.dame` if at least one extra point is neutral in the engine ({points} = their vertices, e.g. "c1, c3"), (b)
    `fb.mark.extra.other` if at least one extra point is the other side's territory, (c) `fb.mark.missing` with the number of
    solution points not yet marked (a number, never the points).
27. Given P3/B (e5) and the learner marks a1..a5 and c3, then *Check* → one mistake, c3 is removed, line `fb.mark.extra.dame` with "c3",
    the five a-marks stay, and the missing line is not shown (nothing missing).
28. Given C/B (e2) and the learner marks only a1, a2, then *Check* → one mistake, no extras, line `fb.mark.missing` with count 5, marks stay.
29. Hint: the Hint button follows the M3 policy (visible always; opens automatically after the 2nd mistake); it shows `hintKey` and the
    hint ring pulses on `hintPoints` only.
30. After the 3rd mistake, then the solution is drawn (success squares/dimmed stones), `explainKey` is shown, outcome is `revealed`,
    *Next* is the only action.
31. When a `dead` exercise opens, then the board is interactive and tapping a stone marks its **whole group** (engine `groupAt`, decision D6):
    every stone of the group is dimmed to 45 % with the `dead` marker (cross); tapping any stone of it again unmarks the group.
32. When the learner taps an empty point in a dead exercise, then nothing is marked, the feedback card shows `fb.mark.empty` ("Tap a stone."),
    **no mistake is counted**.
33. Given N (e5) and the learner marks c1 and a2 (a black wall stone), then *Check* → one mistake, the black wall group is unmarked with an
    error flash, the feedback shows `whyKeys["a2"]`'s text ("This black wall is alive…"), c1 stays marked, and `fb.mark.missing` (1) is added.
34. Given a dead exercise and an extra group without a `whyKeys` entry, then the generic `fb.mark.extra.alive` with the point is shown.
35. The *Clear* button (≥ 44 px) appears when ≥ 1 mark exists; pressing it removes all marks and counts no mistake.
36. When the learner leaves and returns to an exercise, then marks start empty (no persistence), and an unfinished exercise is not a mistake.
37. Every tap and its result are announced for screen readers: `practice.mark.a11y.territory.B|W` ("c3 marked as Black territory"),
    `.dead` ("a2 group marked as dead"), `.removed` ("… mark removed"); the check result uses the feedback card text.
38. Reduced motion: flashes and the success ring are replaced by static rings; no information depends on animation.

**E. `count` runner — score entry**
39. Given a `count` with a `score` answer (all of Unit 13, Unit 12 e7, Unit 14 e6–e7, review r3, r4), when it opens, then the screen shows an
    entry display (right-aligned, placeholder "—"), keys 0–9, a delete key ⌫, and the *Check* button next to the display; the board is
    display-only except for scratch dots (AC 45). Numeric / `libertiesOf` answers keep the old chips (AC 8).
40. When the learner taps digits, then they append (max 2 digits; a leading 0 is replaced by the next digit); ⌫ removes the last digit;
    *Check* is enabled with ≥ 1 digit. Each key is ≥ 44 × 44 px.
41. When the typed number equals the value, then correct (success ring on the display, the asked side's territory shown with
    territory squares, `explainKey`, *Next*).
42. When it differs, then one mistake and exactly one feedback line, by this priority (the first rule whose value equals the typed number
    and differs from the right one): `fb.count.score.deadKept` (dead stones were not removed), `stonesOnly`, `territoryOnly`, `withDame`
    (area + number of neutral points), `otherSide` (same quantity for the other colour), else `fb.count.score.wrong`.
    Example D, B area asked (13): typing 6 → stonesOnly; 7 → territoryOnly; 15 → withDame; 10 → otherSide; 14 → generic.
    Example K, B area asked with dead c1 (10): typing 5 → `deadKept` (stones 5 + territory 0 when c1 stays).
43. Hint (M3 policy) shows `hintKey`. After the 3rd mistake: the right number is shown in the display, the asked side's territory is drawn,
    and the feedback card shows `fb.count.score.reveal` with {stones}, {territory}, {total} from the engine (e.g. "6 stones + 7 points = 13."),
    outcome `revealed`.
44. When `answer.score.dead` is set, then every dead stone shows the `dead` marker (dimmed + cross) from the start, without the learner doing
    anything, and the prompt says it is dead.
45. Scratch dots: in entry mode a tap on any board point toggles a small neutral dot (ring in `textSecondary`, 40 % of the cell), not judged,
    not saved, cleared on the next exercise; it never changes the answer or the feedback; with scratch dots the learner cannot place stones.
46. Reduced motion / screen reader: the display has an `accessibilityLabel` "Your answer: 13"; keys have labels (`practice.count.chip.a11y`,
    `practice.count.backspace`).

**F. `choice` with `prove`**
47. Given a choice with `prove` (u12 e4, u13 e5/e7, u14 review r2/r5/r7), then it plays exactly like M3 `choice` (options, a wrong option shows its
    `whyKey`, `explainKey` on success); `outcome` and `prove` are never shown to the learner.

**G. Explanation player**
48. Given a step with `highlights` of kind `territoryB` / `territoryW`, then the points show the territory squares (as in AC 23) from the
    start of the step (and after Replay); a step marker `{kind:'dead'}` shows the stone dimmed with a cross; `circle` markers on neutral
    points stay as before.
49. Given u12 s3 (P3), then the a-column shows black squares, the e-column white squares and the c-column shows five circle markers (neutral).

**H. Map, progress, stars**
50. Given a fresh install, then Unit 12 is unlocked after 1★ on Unit 11's last lesson (existing rule), Unit 13 after 1★ on Unit 12, Unit 14's
    lesson after 1★ on Unit 13, `u14-review` after 1★ on `u14-end`; the map shows Unit 14 as two rows (lesson, "Review 4").
51. Stars use M3 constants (1★ ≥ 4 of 7 solved, 3★ all 7 with no revealed and ≤ 1 mistake in total — as already in `src/lessons/stars.ts`);
    a `mark` or `count` with 3 mistakes is `revealed`; lessons never block.

**I. Layout (360×740)**
52. Mark screens: top bar 56 + prompt card ≤ 72 + status row 36 + board 328 + feedback card (min 72) + action 48 + gaps ≤ 660 px; no scroll.
53. Count-entry screens at 9×9 (r4): top bar 56 + prompt ≤ 72 + board 328 + entry row 44 + key rows 2×44 + feedback (min 72) ≤ 740 − 16 px;
    no scroll in zh-CN, en and fr (the fr prompt is the longest). If it does not fit, the board may shrink to 296 px (then cells are
    32 px; allowed because board taps are only scratch dots there).
54. Every button and key has a hit area ≥ 44 × 44 px; marks on 5×5 boards (65 px cells) and on 7×7 with coordinates (41 px cells, count only) are fine.
55. All text uses i18n; no new colour: territory squares use `stone.black`, `stone.white` + `stone.whiteEdge`; flash `error`; success
    `success`; scratch dots `textSecondary`. Contrast of the territory squares vs the board ≥ 3:1 (black square ≈ 10:1; white square
    outline ≥ 3.8:1 — QA recomputes with the existing contrast helper).

## 5. Screen flow and UI

### 5.1 Screens
No new route. `ExerciseView` dispatches `type: 'mark'` to the new `MarkRunner`; `CountRunner` gains the entry mode; `ChoiceRunner` is
unchanged. The explanation player, leave sheet, result screen and map are unchanged except for the new nodes. Order of one session:
map → (explanation 3 steps) → 7 exercises → result → next node.

### 5.2 Wireframes (360×740)
Mark (territory), 5×5 with coordinates, one mark placed:
```
┌──────────────────────────────┐
│ ✕   ● ● ● ○ ○ ○ ○   (set)    │ 56  existing top bar
│ ┌──────────────────────────┐ │
│ │ Tap Black's territory.   │ │ ~64 prompt card
│ └──────────────────────────┘ │
│ Marked: 5            [Clear] │ 36  status row (Clear >= 44 px tall hit area)
│ ┌──────────────────────────┐ │
│ │ 5  ■ . X O . .           │ │
│ │ 4  ■ . X O . .  board    │ │ 328 x 328, squares = territory marks
│ │ ...                      │ │
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │ feedback card (min 72)   │ │
│ └──────────────────────────┘ │
│ [          Check           ] │ 48  (Next after the answer)
└──────────────────────────────┘
```
Count with score entry, 9×9 (r4):
```
┌──────────────────────────────┐
│ ✕   ● ● ● ○ ○ ○ ○            │ 56
│ 9x9: what is Black's total?  │ ~56 prompt card
│ ┌──────────────────────────┐ │
│ │       9x9 board 328      │ │ scratch dots on tap
│ └──────────────────────────┘ │
│ [      45       ][⌫][ Check ]│ 44  display flex, backspace 56, Check 100
│ [0][1][2][3][4]              │ 44
│ [5][6][7][8][9]              │ 44
│ feedback card (min 72)       │ 72
└──────────────────────────────┘
```
Height ≈ 56 + 56 + 8 + 328 + 8 + 44 + 8 + 96 + 8 + 72 + 16 = 700. After the answer, *Check* becomes *Next* in the same slot.
Count (single-digit answers as old chips) and choice: unchanged.

### 5.3 States — mark
| State | Board | Status row | Feedback card | Buttons |
|---|---|---|---|---|
| Empty | interactive, no marks | Marked: 0 | empty (reserved) | Hint (top bar), *Check* disabled |
| Marking | marks as tapped | Marked: n, *Clear* | empty or the non-mistake notes (AC 24, 32) | *Check* enabled |
| Wrong | extras flash `error`, then removed; correct marks stay | Marked: n | AC 26 lines, rouge border | Hint, *Check* |
| Hint open | amber ring pulses on `hintPoints` | — | `hintKey` | *Check* |
| Correct | marks with success ring, board locked | — | `explainKey`, tea-green border | *Next* |
| Revealed (3 mistakes) | solution drawn, board locked | — | `explainKey` | *Next* |
No loading state. Dead variant: marks are dimmed stones with a cross instead of squares.

### 5.4 Copy keys (new, global)
| Key | zh-CN | en | fr |
|---|---|---|---|
| practice.mark.count | 已标记 {{count}} 处 | Marked: {{count}} | Marqués : {{count}} |
| practice.mark.clear | 清除 | Clear | Effacer |
| practice.mark.a11y.territory.B | {{point}} 标为黑棋的地 | {{point}} marked as Black territory | {{point}} marqué : territoire de Noir |
| practice.mark.a11y.territory.W | {{point}} 标为白棋的地 | {{point}} marked as White territory | {{point}} marqué : territoire de Blanc |
| practice.mark.a11y.dead | {{point}} 所在的棋块标为死子 | The group at {{point}} marked as dead | Le groupe en {{point}} marqué comme mort |
| practice.mark.a11y.removed | {{point}} 的标记已取消 | Mark at {{point}} removed | Marque en {{point}} retirée |
| fb.mark.extra.stone | 棋子不算地，请点空点。 | Stones are not territory. Tap empty points. | Les pierres ne sont pas du territoire. Touchez des points vides. |
| fb.mark.empty | 请点棋子。 | Tap a stone. | Touchez une pierre. |
| fb.mark.extra.dame | {{points}} 同时碰到两种颜色，是单官，不是地。 | {{points}} touch both colors: neutral, not territory. | {{points}} touchent les deux couleurs : neutre, pas du territoire. |
| fb.mark.extra.other | {{points}} 属于对方。 | {{points}} belong to the other side. | {{points}} appartiennent à l'autre camp. |
| fb.mark.extra.alive | {{point}} 这块棋是活的，不能点。 | The group at {{point}} is alive. | Le groupe en {{point}} est vivant. |
| fb.mark.missing_one / _other | 还有 {{count}} 处没点到。 | {{count}} still to find. | Il en reste {{count}} à trouver. |
| practice.count.backspace | 删除 | Delete | Effacer |
| practice.count.entry.a11y | 你的答案：{{value}} | Your answer: {{value}} | Votre réponse : {{value}} |
| practice.count.entry.empty | 还没有输入 | Nothing typed yet | Rien de saisi |
| practice.count.scratch.a11y | {{point}} 点上标记 | Dot on {{point}} | Point sur {{point}} |
| fb.count.score.wrong | 不对。把棋子和空点分开数。 | Not quite. Count stones and empty points separately. | Pas tout à fait. Comptez séparément les pierres et les points vides. |
| fb.count.score.stonesOnly | 这只是棋子数，还要加上地。 | That is only the stones. Add the territory. | Ce ne sont que les pierres. Ajoutez le territoire. |
| fb.count.score.territoryOnly | 这只是地，还要加上棋子。 | That is only the territory. Add the stones. | Ce n'est que le territoire. Ajoutez les pierres. |
| fb.count.score.withDame | 你把单官也算进去了。 | You counted the neutral points too. | Vous avez compté aussi les points neutres. |
| fb.count.score.otherSide | 这是对方的数。 | That is the other side's number. | C'est le total de l'autre camp. |
| fb.count.score.deadKept | 死子要先拿掉再数。 | Take the dead stones off first. | Retirez d'abord les pierres mortes. |
| fb.count.score.reveal | {{stones}} 子 + {{territory}} 点 = {{total}}。 | {{stones}} stones + {{territory}} points = {{total}}. | {{stones}} pierres + {{territory}} points = {{total}}. |
| unit.13.title | 数子 | Counting · 数子 shùzǐ | Compter · 数子 shùzǐ |
| unit.14.title | 终局 | End of game · 终局 zhōngjú | Fin de partie · 终局 zhōngjú |
(`unit.12.title` exists: 地 / Territory · 地 dì / Le territoire · 地 dì. zh-CN has no plural; `_one` = `_other`. fr uses a decimal comma
in numbers: "0,5", "10,5".) Lesson titles: `lesson.u12-territory.title` 地 / Territory / Le territoire; `lesson.u13-counting.title` 数子 / Counting /
Compter; `lesson.u14-end.title` 终局与死子 / End of game and dead stones / Fin de partie et pierres mortes; `lesson.u14-review.title`
综合复习（四） / Review 4 / Révision 4.

### 5.5 Interaction details
- Touch-down preview / commit-on-release (M2) is **not** used for marking: a tap toggles at once (marking is reversible; a preview would
  slow it down). The pointer ring of the existing board is kept on touch-down so the finger does not hide the target.
- Marks are drawn under the stone layer for territory (empty points) and as an overlay for dead groups. The "last move" mark is not drawn
  in mark exercises (there is no move).
- Mark exercises add no sound; success uses the existing success feedback; no confetti.
- Territory squares: 36 % of the cell, centred, `stone.black`; white: `stone.white` fill with a 1.5 px `stone.whiteEdge` outline. Dead stones:
  45 % opacity plus a cross on the stone in its contrast colour (white cross on a black stone, dark cross on a white stone).
- The status counter never shows how many marks are expected.
- Count entry: the display shows at most 2 digits; the key row layout and sizes are in §5.2; ⌫ is disabled when empty.

### 5.6 Schema additions (all additive; `schema: 1` stays)
```ts
export interface MarkExercise extends ExerciseBase {
  type: 'mark';
  mark: 'territory' | 'dead';
  /** territory only: whose territory the learner marks. */
  side?: Color;
  /** dead only: one vertex per dead group (any stone of it); the answer is every stone of those groups. */
  dead?: Vertex[];
  /** dead only: stone vertex of an ALIVE group -> text shown when the learner marks it. */
  whyKeys?: Record<Vertex, TextKey>;
}
export interface ScoreAnswer {
  of: 'stones' | 'territory' | 'area';   // area = stones + territory (komi never included)
  side: Color;
  dead?: Vertex[];                       // groups removed before counting
}
// CountExercise.answer: number | LibertiesOf | { score: ScoreAnswer }
export type Outcome = 'B' | 'W' | 'none';
// ChoiceOption.outcome?: Outcome   (only with prove)
export type ChoiceProof =
  | { kind: 'owner'; at: Vertex }                                  // outcome: B | W | none
  | { kind: 'winner'; komi: number; dead?: Vertex[] };             // outcome: B | W
// ChoiceExercise.prove?: ChoiceProof
// HighlightKind += 'territoryB' | 'territoryW';  MarkerDef += { kind: 'dead'; at: Vertex }
```
`EXERCISE_TYPES` gets `'mark'`. `getSolution(mark)` returns `{points}` (territory: sorted empty owned points; dead: sorted stones of the
dead groups). `getSolution(count with score)` returns `{value}` computed with `score(board, {komi: 0.5, deadStones})` (komi does not enter).
Example (JSON):
```json
{ "id": "mark-b-edge", "type": "mark", "size": 5, "mark": "territory", "side": "B",
  "setup": { "B": ["b1","b2","b3","b4","b5"], "W": ["c1","c2","c3","c4","c5"] },
  "promptKey": "lesson.u12-territory.e1.prompt", "hintKey": "lesson.u12-territory.e1.hint",
  "hintPoints": ["a3"], "explainKey": "lesson.u12-territory.e1.explain" }
{ "id": "dead-both", "type": "mark", "size": 5, "mark": "dead", "dead": ["c1","c5"],
  "setup": { "B": ["a2","b2","c2","d2","e2","c5"], "W": ["a3","b3","c3","d3","e3","c1"] },
  "whyKeys": { "a2": "lesson.u14-end.e5.w.black", "a3": "lesson.u14-end.e5.w.white" }, "...": "..." }
{ "id": "area-b", "type": "count", "size": 5, "answer": { "score": { "of": "area", "side": "B" } }, "...": "..." }
{ "id": "komi-tie", "type": "choice", "size": 5, "prove": { "kind": "winner", "komi": 0.5 },
  "options": [ { "textKey": "...", "outcome": "B", "whyKey": "..." }, { "textKey": "...", "outcome": "W", "correct": true } ], "...": "..." }
```

## 6. Game design notes
**Curve.** Unit 12: e1 single wall, 5 points (almost certain) → e2 bottom-left stair, 7 points → e3 White's top-right stair (colour switch) → e4 *choice* "who
owns ▲?" with neutral as the third option (first twist) → e5 neutral column trap (same board as e4, now they must act) → e6 neutral
points at a contact (hard) → e7 count 11 on 7×7 (transfer to counting). Unit 13: e1 count stones → e2 count territory → e3 add both
(13) → e4 White's total on another board (12) → e5 komi decides a tie → e6 7×7 area 25 → e7 7×7 winner by half a point. Unit 14: e1/e2 passes (concept
only) → e3 one dead stone, easiest → e4 a dead stone of the other colour → e5 two dead stones + two alive walls (trap) → e6/e7 count with
dead stones removed. Review 4: territory (W) → owner → area → 9×9 area (45) → 9×9 winner → dead stones → winner with dead stones.
**Length.** 3 steps (~30 s) + 7 exercises (~25–40 s each, counts ~45 s) ≈ 4 minutes per lesson; review ≈ 5 minutes.
**Stars.** M3 constants (AC 51). A `mark`/`count` is one exercise: `clean` (right on the first Check), `solved` (right after ≥ 1 mistake),
`revealed` (3 mistakes).
**Hints.** Hint always visible, opens automatically after the 2nd mistake; the ring points at one correct point (a `hintPoints` subset),
never at the whole answer. The hint text names the rule (touches only black stones), not the answer.
**After 3 mistakes.** The answer is drawn, `explainKey` explains the border, *Next*; lessons never block. A mark exercise is judged on the
whole set, so the feedback gives *classes of error* (neutral / other side / missing) with the offending points only for extras, never the
list of missing points.
**Feedback and reward.** Wrong extras flash the error ring 600 ms and vanish; correct marks stay (so retries are cheap). Success: the marks
get the green ring; nothing else. No new sound, no confetti, no timers.
**Ending the lesson.** The result screen shows the usual stars; Unit 14's second node ("Review 4") appears with *Next*. After Unit 14 the
learner meets the "More units coming soon" footer; the games arrive in M6 (Unit 15).
**Authoring rules (new).** (1) Every territory position has stones of both colours. (2) Neutral points appear only after step 3 of Unit 12.
(3) Counting never mixes komi into the typed number (decimals are avoided); komi is a *choice*. (4) Positions are tidy: straight walls first,
a stair/L-shape only when it is the lesson.

## 7. Content
Texts: prefix `lesson.<id>.`; zh-CN never shows pinyin (as M4/M5); en/fr show Chinese + pinyin at first use (§8). X = Black, O = White,
`.` = empty. Stone lists are authoritative; diagrams are for reading. Hints/`hintPoints` are subsets of the solution.

### 7.0 Position library (hand-checked, §10)
```
T1 (5x5)               A (5x5)                C (5x5)               C2 (5x5)               P3 (5x5)
  a b c d e              a b c d e              a b c d e             a b c d e              a b c d e
5 . . X O .            5 . X O . .            5 . . . . .           5 . . . . .            5 . X . O .
4 . . X O .            4 . X O . .            4 O O O O .           4 O O O . .            4 . X . O .
3 . . X O .            3 . X O . .            3 X X X O O           3 X X O O O            3 . X . O .
2 . . X O .            2 . X O . .            2 . . X X X           2 . X X X X            2 . X . O .
1 . . X O .            1 . X O . .            1 . . . . .           1 . . . . .            1 . X . O .
B c1-c5, W d1-d5       B b1-b5, W c1-c5       B a3 b3 c3 c2 d2 e2   B a3 b3 b2 c2 d2 e2    B b1-b5, W d1-d5
                                              W a4 b4 c4 d4 d3 e3   W a4 b4 c4 c3 d3 e3
(C and C2 replaced in §12b: the first versions held a dead squared four.)
D (5x5)                R1 (7x7)                          R3 (7x7)                       R4 (9x9)
  a b c d e              a b c d e f g                     a b c d e f g                 rows 1-4 empty
5 . . . . .            7 . . . . . . .                   7 . . . . . . .               row 5  X X X X X X X X X  (a5-i5)
4 O O O O O            6 O O O O . . .                   6 . . . . . . .               row 6  O O O O O O O O O  (a6-i6)
3 X X X . .            5 X X X O O . .                   5 O O O O O . .               rows 7-9 empty
2 . . X X X            4 . . X X O . .                   4 X X X X O O O
1 . . . . .            3 . . . X O . .                   3 . . . X X X X
B a3 b3 c3 c2 d2 e2    2 . . . X O . .                   2 . . . . . . .
W a4 b4 c4 d4 e4       1 . . . X O . .                   1 . . . . . . .
                       B a5 b5 c5 c4 d4 d3 d2 d1         B a4 b4 c4 d4 d3 e3 f3 g3
                       W a6 b6 c6 d6 d5 e5 e4 e3 e2 e1   W a5 b5 c5 d5 e5 e4 f4 g4
K0 (5x5)               K (5x5)                K2 (5x5)               N (5x5)
5 . . . . .            5 . . . . .            5 . . X . .            5 . . X . .
4 . . . . .            4 . . . . .            4 O O O O O            4 . . . . .
3 O O O O O            3 O O O O O            3 X X X X X            3 O O O O O
2 X X X X X            2 X X X X X            2 . . . . .            2 X X X X X
1 . . . . .            1 . . O . .            1 . . . . .            1 . . O . .
B a2-e2, W a3-e3      K0 + W c1 (dead)       B a3-e3, W a4-e4       B a2-e2 + c5, W a3-e3 + c1
                                              + B c5 (dead)          (c1 and c5 dead)
```
Engine facts per position (computed by hand, QA re-proves; "dame" = neutral):
| Pos | B stones / territory / area | W stones / territory / area | Dame | Notes |
|---|---|---|---|---|
| T1 | 5 / 10 / 15 | 5 / 5 / 10 | none | territory B = a,b columns; W = e column |
| A | 5 / 5 / 10 | 5 / 10 / 15 | none | B terr a1-a5; W terr d1-e5 |
| C | 6 / 7 / 13 | 6 / 6 / 12 | none | B terr a1 a2 b1 b2 c1 d1 e1; W terr row 5 + e4 |
| C2 | 6 / 6 / 12 | 6 / 7 / 13 | none | W terr row 5 + d4 e4; B terr row 1 + a2 |
| P3 | 5 / 5 / 10 | 5 / 5 / 10 | c1-c5 | komi 0.5 → W wins by 0.5 |
| D | 6 / 7 / 13 | 5 / 5 / 10 | d3, e3 | komi 0.5 → B wins by 2.5 |
| R1 | 8 / 11 / 19 | 10 / 20 / 30 | none | |
| R3 | 8 / 17 / 25 | 8 / 16 / 24 | none | komi 0.5 → B wins by 0.5 |
| R4 | 9 / 36 / 45 | 9 / 27 / 36 | none | komi 7.5 → B wins by 1.5 |
| K (dead c1 removed) | 5 / 5 / 10 | 5 / 10 / 15 | none | with c1 kept: B 5 / 0 / 5 (rows-1 regions touch both) |
| N (dead c1, c5 removed) | 5 / 5 / 10 | 5 / 10 / 15 | none | komi 0.5 → W wins by 5.5 |
(K, K2 and N list the stone counts without the dead stones; K's total of 25 points = 5 + 5 + 5 + 10.)

### 7.1 Unit 12 — 地 Territory (`u12-territory.json`)
**Steps**
| # | Board | Highlights / markers | zh-CN | en | fr |
|---|---|---|---|---|---|
| s1 | T1 | `territoryB` a1–b5 (10 points) | 黑棋围住的空点，只有黑棋能用，叫黑棋的地。这里黑地有 10 点。 | Empty points that only Black surrounds are Black's territory (地 dì). Here Black has 10 points. | Les points vides que seul Noir entoure sont le territoire (地 dì) de Noir. Ici, Noir en a 10. |
| s2 | T1 (continues) | + `territoryW` e1–e5 | 白棋围住右边一列，白地是 5 点。地只算空点，不算棋子。 | White surrounds the right column: 5 points of territory. Only empty points count, not stones. | Blanc entoure la colonne de droite : 5 points de territoire. Seuls les points vides comptent, pas les pierres. |
| s3 | P3 | `territoryB` a1–a5, `territoryW` e1–e5, `circle` markers on c1–c5 | 中间一列两边都挨着，谁也不拥有，叫单官。单官不算地。 | The middle column touches both colors. Nobody owns it: neutral points (单官 dānguān). | La colonne du milieu touche les deux couleurs. Personne ne la possède : points neutres (单官 dānguān). |

**Exercises** (all 5×5 unless stated; keys `lesson.u12-territory.eN.prompt|hint|explain`)
| # | id | Type, position | Task and right answer | prompt (zh / en / fr) | hint (zh / en / fr) | explain (zh / en / fr) |
|---|---|---|---|---|---|---|
| e1 | `mark-b-edge` | mark territory B, A | a1 a2 a3 a4 a5; hintPoints a3 | 点出黑棋的地。 / Tap Black's territory. / Touchez le territoire de Noir. | 找只被黑子围住的空点。 / Look for empty points that only black stones surround. / Cherchez les points vides entourés seulement par des pierres noires. | 左边一列 5 个空点都归黑棋。 / The 5 empty points in the left column are Black's. / Les 5 points vides de la colonne de gauche sont à Noir. |
| e2 | `mark-b-corner` | mark territory B, C | a1 a2 b1 b2 c1 d1 e1; hintPoints a1 | 点出黑棋的地。 / (same) / (same) | 黑棋的墙围着左下方。 / Black's wall closes off the bottom left. / Le mur noir ferme le bas à gauche. | 黑棋围住了左下方 7 个空点。 / Black surrounds 7 empty points at the bottom left. / Noir entoure 7 points vides en bas à gauche. |
| e3 | `mark-w-corner` | mark territory W, C2 | a5 b5 c5 d4 d5 e4 e5; hintPoints e5 | 点出白棋的地。 / Tap White's territory. / Touchez le territoire de Blanc. | 白棋的墙在右上。 / White's wall is in the top-right. / Le mur blanc est en haut à droite. | 白棋围住右上方 7 个点；下面的地是黑棋的。 / White surrounds 7 points at the top right. The area at the bottom is Black's. / Blanc entoure 7 points en haut à droite. La zone du bas est à Noir. |
| e4 | `who-owns` | choice, P3, triangle on c3, `prove` owner c3 | right: "nobody" (outcome none) | ▲ 这个点是谁的？ / Who owns the marked point? / À qui est le point marqué ? | (none) | 两边的子都碰到它：单官。 / Both colors touch it: neutral. / Les deux couleurs le touchent : neutre. |
| e5 | `mark-b-dame` | mark territory B, P3 | a1 a2 a3 a4 a5; hintPoints a1 | 点出黑棋的地（别点单官）。 / Tap Black's territory. Skip neutral points. / Touchez le territoire de Noir. Ignorez les points neutres. | 黑地只有左边一列。 / Black's territory is the left column only. / Le territoire de Noir, c'est seulement la colonne de gauche. | 中间一列是单官，不算。 / The middle column is neutral: it does not count. / La colonne du milieu est neutre : elle ne compte pas. |
| e6 | `mark-b-contact` | mark territory B, D | a1 a2 b1 b2 c1 d1 e1; hintPoints a1 | 点出黑棋的地（别点单官）。 / (same as e5) / (same) | 有两个点同时碰到白子，不算。 / Two points touch a white stone: they are neutral. / Deux points touchent une pierre blanche : ils sont neutres. | d3、e3 碰到白子，是单官；其余 7 点是黑地。 / d3 and e3 touch White: neutral. The other 7 points are Black's. / d3 et e3 touchent Blanc : neutres. Les 7 autres points sont à Noir. |
| e7 | `count-terr` | count `{score:{of:territory,side:B}}`, R1 (7×7) | 11 | 数一数黑棋的地有多少点。 / Count Black's territory points. / Comptez les points de territoire de Noir. | 先数每一列的空点，再相加。 / Count each column's empty points, then add. / Comptez les points vides de chaque colonne, puis additionnez. | 4 + 4 + 3 = 11 点。 / 4 + 4 + 3 = 11 points. / 4 + 4 + 3 = 11 points. |
`who-owns` options (global to the lesson): `o.black` 黑棋的地 / Black's territory / Territoire de Noir; `o.white` 白棋的地 / White's territory / Territoire de
Blanc; `o.none` 谁的也不是（单官） / Nobody's (neutral) / À personne (neutre). Wrong-option reasons: black → 它也挨着白子 d3，不只被黑棋围住。 / It also touches the white stone d3,
so Black alone does not surround it. / Il touche aussi la pierre blanche d3 : Noir ne l'entoure pas seul. White → 它也挨着黑子 b3。 / It also touches the black stone b3. / Il touche
aussi la pierre noire b3. (c3 neighbours: b3 X, d3 O, c2, c4.)
Right answers by exercise: e1 {a1..a5}; e2 {a1,a2,b1,b2,c1,d1,e1}; e3 {a5,b5,c5,d4,d5,e4,e5}; e4 none; e5 {a1..a5}; e6 {a1,a2,b1,b2,c1,d1,e1}; e7 11.

### 7.2 Unit 13 — 数子 Counting (`u13-counting.json`)
**Steps**
| # | Board | Highlights / markers | zh-CN | en | fr |
|---|---|---|---|---|---|
| s1 | D | `territoryB` (7 points) | 中国规则数“子”：自己的棋子加自己的地。黑棋 6 子 + 7 点 = 13。 | Chinese rules count area (数子 shùzǐ): your stones plus your territory. Black: 6 stones + 7 points = 13. | Les règles chinoises comptent l'aire (数子 shùzǐ) : vos pierres plus votre territoire. Noir : 6 pierres + 7 points = 13. |
| s2 | D (continues) | + `territoryW` a5–e5, `circle` on d3, e3 | 白棋 5 子 + 5 点 = 10。单官 d3、e3 谁也不算。 | White: 5 stones + 5 points = 10. The neutral points d3 and e3 count for nobody. | Blanc : 5 pierres + 5 points = 10. Les points neutres d3 et e3 ne comptent pour personne. |
| s3 | D (continues) | same | 黑棋先走占便宜，白棋加贴目。这里贴目 0.5：白 10.5，黑 13，黑胜 2.5 点。 | Black moves first, so White gets komi (贴目 tiēmù). Here komi is 0.5: White 10.5, Black 13. Black wins by 2.5. | Noir joue en premier : Blanc reçoit le komi (贴目 tiēmù). Ici 0,5 : Blanc 10,5, Noir 13. Noir gagne de 2,5. |
**Exercises** (keys `lesson.u13-counting.eN.*`)
| # | id | Type, position | Right answer | prompt | hint | explain |
|---|---|---|---|---|---|---|
| e1 | `stones-b` | count score stones B, D | 6 | 黑棋有几颗棋子？ / How many black stones are on the board? / Combien de pierres noires sur le plateau ? | 一颗一颗数，不要漏掉。 / Count them one by one. / Comptez-les une par une. | 黑棋 6 子。 / Black has 6 stones. / Noir a 6 pierres. |
| e2 | `terr-b` | count score territory B, D | 7 | 黑棋的地有几点？（单官不算） / How many points of Black territory? (Neutral points do not count.) / Combien de points de territoire pour Noir ? (Les points neutres ne comptent pas.) | 只数只被黑子围住的空点。 / Count only empty points that Black alone surrounds. / Ne comptez que les points vides entourés par Noir seul. | 7 点：a1 a2 b1 b2 c1 d1 e1。 / 7 points: a1 a2 b1 b2 c1 d1 e1. / 7 points : a1 a2 b1 b2 c1 d1 e1. |
| e3 | `area-b` | count score area B, D | 13 | 黑棋一共多少点？（棋子 + 地） / What is Black's total? (stones + territory) / Quel est le total de Noir ? (pierres + territoire) | 6 子加上 7 点。 / Add 6 stones and 7 points. / Additionnez 6 pierres et 7 points. | 6 + 7 = 13。 / 6 + 7 = 13. / 6 + 7 = 13. |
| e4 | `area-w` | count score area W, C | 12 | 白棋一共多少点？ / What is White's total? / Quel est le total de Blanc ? | 先数白子，再数白地。 / Count White's stones first, then White's territory. / Comptez d'abord les pierres blanches, puis le territoire. | 6 子 + 6 点 = 12。 / 6 stones + 6 points = 12. / 6 pierres + 6 points = 12. |
| e5 | `komi-tie` | choice, P3, `prove` winner komi 0.5 | White | 黑白都是 10 点，贴目 0.5。谁赢？ / Black and White both have 10. Komi is 0.5. Who wins? / Noir et Blanc ont 10 chacun. Le komi est de 0,5. Qui gagne ? | 把贴目加到白棋上。 / Add the komi to White. / Ajoutez le komi à Blanc. | 没有平局：白棋以 0.5 点获胜。 / No draws: White wins by 0.5. / Pas de nulle : Blanc gagne de 0,5. |
| e6 | `area-b-7` | count score area B, R3 (7×7) | 25 | 黑棋一共多少点？ / What is Black's total? / Quel est le total de Noir ? | 黑棋 8 子；再数下面的空点。 / Black has 8 stones; now count the empty points below. / Noir a 8 pierres ; comptez maintenant les points vides en dessous. | 8 + 17 = 25。 / 8 + 17 = 25. / 8 + 17 = 25. |
| e7 | `winner-7` | choice, R3, `prove` winner komi 0.5 | Black | 白棋有 24 点，贴目 0.5。谁赢？ / White has 24. Komi is 0.5. Who wins? / Blanc a 24. Le komi est de 0,5. Qui gagne ? | 比较 25 和 24.5。 / Compare 25 with 24.5. / Comparez 25 et 24,5. | 黑棋 25，白棋 24.5：黑棋胜 0.5 点。 / Black 25, White 24.5: Black wins by 0.5. / Noir 25, Blanc 24,5 : Noir gagne de 0,5. |
Choice options (e5, e7): `o.black` 黑棋 / Black / Noir (outcome B); `o.white` 白棋 / White / Blanc (outcome W). Wrong-option reasons: e5 black → 白棋是 10 + 0.5 = 10.5，比黑棋多。 /
White has 10 + 0.5 = 10.5, more than Black. / Blanc a 10 + 0,5 = 10,5, plus que Noir.; e7 white → 白棋是 24 + 0.5 = 24.5，比黑棋的 25 少。 / White has 24 + 0.5 = 24.5, less than
Black's 25. / Blanc a 24 + 0,5 = 24,5, moins que les 25 de Noir. The `count` exercises' wrong answers get the engine lines of AC 42.

### 7.3 Unit 14 — 终局 End of game (`u14-end.json`)
**Steps**
| # | Board | Highlights / markers | zh-CN | en | fr |
|---|---|---|---|---|---|
| s1 | K0 | none | 双方都没有好棋可下时，就弃权。连续两次弃权，对局结束。 | When neither side has a useful move left, players pass (弃权 qìquán). Two passes in a row end the game (终局 zhōngjú). | Quand aucun camp n'a de coup utile, on passe (弃权 qìquán). Deux passes de suite terminent la partie (终局 zhōngjú). |
| s2 | K | `triangle` c1 | 白棋 c1 这颗子救不活了，叫死子。终局时把它拿掉，不算提子。 | The white stone on c1 cannot live: it is a dead stone (死子 sǐzǐ). At the end it is simply taken off the board. | La pierre blanche en c1 ne peut pas vivre : c'est une pierre morte (死子 sǐzǐ). À la fin, on la retire simplement du plateau. |
| s3 | K | `dead` marker c1, `territoryB` a1 b1 d1 e1, `territoryW` a4–e5 (10 points) | 拿掉死子后，c1 变成黑棋的地。黑棋 5 子 + 5 点 = 10，白棋 5 + 10 = 15。 | Once removed, c1 is Black's territory. Black: 5 stones + 5 points = 10. White: 5 + 10 = 15. | Une fois retirée, c1 devient territoire de Noir. Noir : 5 pierres + 5 points = 10. Blanc : 5 + 10 = 15. |
(s3: c1 itself gets no square because the stone is still drawn, dimmed; the text counts it.)
**Exercises** (keys `lesson.u14-end.eN.*`)
| # | id | Type, position | Right answer | prompt | hint | explain |
|---|---|---|---|---|---|---|
| e1 | `two-passes` | choice, K0 | "The game ends" | 黑棋弃权，白棋也弃权。接下来怎样？ / Black passes, then White passes. What happens? / Noir passe, puis Blanc passe. Que se passe-t-il ? | (none) | 连续两次弃权，对局结束，开始数子。 / Two passes in a row end the game. Then we count. / Deux passes de suite terminent la partie. Ensuite, on compte. |
| e2 | `one-pass` | choice, K0 | "No, it takes two passes in a row" | 黑棋弃权，白棋下了一子。对局结束了吗？ / Black passes, then White plays a stone. Is the game over? / Noir passe, puis Blanc joue une pierre. La partie est-elle finie ? | (none) | 白棋下了子，弃权就不连续了。 / White played, so the passes were not in a row. / Blanc a joué : les passes ne sont pas consécutives. |
| e3 | `dead-1` | mark dead, K, `dead: [c1]` | c1 | 点出死子。 / Tap the dead stone. / Touchez la pierre morte. | 它孤身一子，陷在黑棋的地里。 / It is alone inside Black's area. / Elle est seule dans la zone de Noir. | c1 的白子在黑地里，做不出两只眼，是死子。 / The white stone on c1 is alone in Black's area and cannot make two eyes: dead. / La pierre blanche en c1 est seule dans la zone de Noir et ne peut pas faire deux yeux : morte. |
| e4 | `dead-2` | mark dead, K2, `dead: [c5]` | c5 | 点出死子。 / (same) / (same) | 看白棋的地盘里有没有黑子。 / Look for a black stone inside White's area. / Cherchez une pierre noire dans la zone de Blanc. | c5 的黑子困在白地里，是死子。 / The black stone on c5 is trapped in White's area: dead. / La pierre noire en c5 est piégée dans la zone de Blanc : morte. |
| e5 | `dead-both` | mark dead, N, `dead: [c1, c5]` | c1, c5 | 点出所有死子。 / Tap all dead stones. / Touchez toutes les pierres mortes. | 两片地里各有一颗孤子。 / There is one lone stone in each area. / Il y a une pierre seule dans chaque zone. | c1、c5 都是死子；两道墙都是活的。 / c1 and c5 are dead; both walls are alive. / c1 et c5 sont mortes ; les deux murs sont vivants. |
| e6 | `area-dead-b` | count score area B, K, `dead: [c1]` | 10 | c1 的白子是死子。黑棋一共多少点？ / The white stone on c1 is dead. What is Black's total? / La pierre blanche en c1 est morte. Quel est le total de Noir ? | 拿掉死子后，c1 也是黑棋的地。 / Take the dead stone off: c1 is Black's territory. / Retirez la pierre morte : c1 est territoire de Noir. | 5 子 + 5 点 = 10。 / 5 stones + 5 points = 10. / 5 pierres + 5 points = 10. |
| e7 | `area-dead-w` | count score area W, N, `dead: [c1, c5]` | 15 | c1、c5 是死子。白棋一共多少点？ / c1 and c5 are dead. What is White's total? / c1 et c5 sont mortes. Quel est le total de Blanc ? | 白棋 5 子，再加上上面两行 10 点。 / White has 5 stones plus the 10 points above. / Blanc a 5 pierres plus les 10 points au-dessus. | 5 + 10 = 15。 / 5 + 10 = 15. / 5 + 10 = 15. |
e1/e2 options: e1 "对局结束 / The game ends. / La partie se termine." (correct), "黑棋必须再下一手 / Black must play again. / Noir doit rejouer." (why: 连续两次弃权就终局了。/ Two passes in a row end the game. / Deux passes de suite terminent la partie.);
e2 "没有，要连续两次弃权 / No: it takes two passes in a row. / Non : il faut deux passes de suite." (correct), "结束了 / Yes, it is over. / Oui, elle est finie." (why: 弃权被一手棋隔开，不算连续。/ A move came between the passes. / Un coup s'est glissé entre les passes.).
e5 `whyKeys`: a2 (black wall) → 这道黑墙是活的，有地方做两只眼。 / This black wall is alive: it has room for two eyes. / Ce mur noir est vivant : il a la place pour deux yeux.;
a3 (white wall) → 这道白墙是活的，上面有大片空地做眼。 / This white wall is alive: lots of room above for two eyes. / Ce mur blanc est vivant : beaucoup de place au-dessus pour deux yeux.
e3 and e4 have no alive-group `whyKeys` (the generic `fb.mark.extra.alive` is used).

### 7.4 Unit 14 checkpoint — 综合复习（四）Review 4 (`u14-review.json`, `kind: checkpoint`, `unit: 14`)
Keys `lesson.u14-review.rN.*`. Shown order = table order.
| # | id | Type, position | Right answer | prompt | hint | explain |
|---|---|---|---|---|---|---|
| r1 | `r-terr-w` | mark territory W, D | a5 b5 c5 d5 e5; hintPoints a5 | 点出白棋的地。 / Tap White's territory. / Touchez le territoire de Blanc. | 白地在最上面一行。 / White's territory is the top row. / Le territoire de Blanc, c'est la rangée du haut. | 上面一行 5 点是白地；d3、e3 是单官。 / The top row (5 points) is White's; d3 and e3 are neutral. / La rangée du haut (5 points) est à Blanc ; d3 et e3 sont neutres. |
| r2 | `r-owner` | choice, D, triangle d3, `prove` owner d3 | nobody | ▲ 这个点是谁的？ / Who owns the marked point? / À qui est le point marqué ? | (none) | 黑子和白子都碰到它：单官。 / Black and White both touch it: neutral. / Noir et Blanc le touchent : neutre. |
| r3 | `r-area-w` | count score area W, D | 10 | 白棋一共多少点？ / What is White's total? / Quel est le total de Blanc ? | 5 子 + 上面一行。 / 5 stones plus the top row. / 5 pierres plus la rangée du haut. | 5 + 5 = 10。 / 5 + 5 = 10. / 5 + 5 = 10. |
| r4 | `r-area-9` | count score area B, R4 (9×9) | 45 | 9×9：黑棋一共多少点？ / 9×9: what is Black's total? / 9×9 : quel est le total de Noir ? | 一排 9 子，下面 4 排各 9 点。 / One row of 9 stones and 4 rows of 9 points below. / Une rangée de 9 pierres et 4 rangées de 9 points en dessous. | 9 + 36 = 45。 / 9 + 36 = 45. / 9 + 36 = 45. |
| r5 | `r-winner-9` | choice, R4, `prove` winner komi 7.5 | Black | 白棋 36 点，9×9 贴目 7.5。谁赢？ / White has 36. On 9×9 komi is 7.5. Who wins? / Blanc a 36. Au 9×9, le komi est de 7,5. Qui gagne ? | 36 加 7.5 是多少？ / What is 36 + 7.5? / Que font 36 + 7,5 ? | 黑棋 45，白棋 43.5：黑棋胜 1.5 点。 / Black 45, White 43.5: Black wins by 1.5. / Noir 45, Blanc 43,5 : Noir gagne de 1,5. |
| r6 | `r-dead` | mark dead, N, `dead: [c1, c5]`, whyKeys as u14 e5 (reuse the keys of `u14-end`) | c1, c5 | 点出所有死子。 / Tap all dead stones. / Touchez toutes les pierres mortes. | 每片地里各有一颗孤子。 / One lone stone in each area. / Une pierre seule dans chaque zone. | c1、c5 是死子，两道墙是活的。 / c1 and c5 are dead; the walls are alive. / c1 et c5 sont mortes ; les murs sont vivants. |
| r7 | `r-winner-n` | choice, N, `prove` winner komi 0.5 dead [c1,c5] | White | c1、c5 是死子，贴目 0.5。谁赢？ / c1 and c5 are dead. Komi is 0.5. Who wins? / c1 et c5 sont mortes. Le komi est de 0,5. Qui gagne ? | 先拿掉死子，再各数一遍。 / Take the dead stones off first, then count both sides. / Retirez d'abord les pierres mortes, puis comptez les deux camps. | 白棋 15.5，黑棋 10：白棋胜 5.5 点。 / White 15.5, Black 10: White wins by 5.5. / Blanc 15,5, Noir 10 : Blanc gagne de 5,5. |
r2 options: as `who-owns` (own keys `lesson.u14-review.o.*`, whys: black → 它也挨着白子 d4。/ It also touches the white stone d4. / Il touche aussi la pierre blanche d4.; white → 它也挨着黑子 c3、d2。/ It also touches the black stones c3 and d2. / Il touche aussi les pierres noires c3 et d2.).
r5 wrong option White: 36 + 7.5 = 43.5，比黑棋的 45 少。 / 36 + 7.5 = 43.5, less than Black's 45. / 36 + 7,5 = 43,5, moins que les 45 de Noir.; r7 wrong option Black: 黑棋只有 10 点，白棋有 15.5。 / Black has only 10; White has 15.5. / Noir n'a que 10 ; Blanc a 15,5.

## 8. Terms and pinyin (first use)
zh-CN never shows pinyin; en/fr show it in the first text using the term.
| Term | pinyin | First text | Meaning |
|---|---|---|---|
| 地 | dì | `unit.12.title`, `u12-territory.s1` | territory |
| 单官 | dānguān | `u12-territory.s3` | neutral point (dame) |
| 数子 | shùzǐ | `unit.13.title`, `u13-counting.s1` | area counting (Chinese rules) |
| 贴目 | tiēmù | `u13-counting.s3` | komi |
| 终局 | zhōngjú | `unit.14.title`, `u14-end.s1` | end of the game |
| 弃权 | qìquán | `u14-end.s1` | pass |
| 死子 | sǐzǐ | `u14-end.s2` | dead stone |
fr terms: territoire, points neutres, aire (数子), komi, passer, pierre morte.

## 9. Framework gaps and developer notes
1. **Schema + validator** (§5.6, AC 16–21): `MarkExercise`, `ScoreAnswer`, `ChoiceProof`, highlight kinds, `dead` marker; `getSolution`,
   `solutionPoints` for `mark`; engine adapter exposes `score()` (already pure).
2. **`MarkRunner`**: base it on `TapPointRunner` (`mode: 'all'`, `judgeTapAll`, `FLASH_MS`, `tapAllFeedback`) — the selection, flash and hint
   machinery is the same; new are the territory/dead overlays, the stone-tap rules (AC 24, 31–32) and the engine-fact lines (AC 26, 33).
3. **Board overlay.** `GoBoard` needs a "territory square" layer (black/white square, under stones) and a "dead" stone style (45 % opacity +
   cross); both use existing tokens only. Scratch dots reuse the `liberty`-style small ring in `textSecondary`.
4. **`CountRunner` entry mode** (AC 39–46): extract the chips into `CountChips` and add `CountEntry`; keep the chip screen byte-identical for
   old answers. The wrong-answer classifier is a pure function `classifyScoreAnswer(board, answer, typed)` in `src/exercises/` with unit tests.
5. **`MARK_DEAD_NOT_PROVEN`**: `forcedCapture` has a 3 000-node cap; the 2×5 pocket in `K`-like positions may need more. If the search
   cannot prove a position within 20 000 nodes, switch the validator rule to the *structural* check "the marked group has ≤ 3 liberties and
   every neighbouring stone is of one colour" and keep the exhaustive proof as a QA test (AC 13b). Tell the PO in §12b if you do.
6. **Explanation steps do not play pass moves.** `u14-end` s1 is therefore text + the static board K0; if the player later gets a pass move
   this step can show it (not needed now).
7. **Map titles / planned units:** add `unit.13.title`, `unit.14.title`; `PLANNED_UNITS` becomes `[]`; check the "More units coming soon" footer and
   any test that asserts "Unit 12 is planned".
8. **CURRICULUM.md**: tick the exercise-type list (`mark`) and rows 12–14 once the item is done (Main session).
9. Tests that count the exercise types (`EXERCISE_TYPES`) and the registry guard "every shipped exercise has a runner" are extended.

## 10. Correctness check (done by the designer, by hand)
I recomputed every region with orthogonal neighbours only: (a) **Territory regions.** Each answer set above is a connected empty region
whose boundary stones are all of one colour: T1 (a/b columns border c-column B stones; e column borders d-column W stones), A (a column
borders b), C (a1 a2 b1 b2 c1 d1 e1 border B only; row 5 and e4 border W only), C2 (row 5, d4, e4 border W only; row 1 and a2
border B only), P3 (a column borders b only, e column borders d only, c column borders both: neutral), D (the seven points border a3 b3 c3
c2 d2 e2 only; d3 and e3 touch c3/d2/e2 (B) and d4/e4 (W): neutral; row 5 borders row 4 W only), R1 (B region a1–a4 b1–b4 c1–c3 = 11, W
region row 7 + e6 + f/g columns = 20), R3 (B rows 1–2 + a3 b3 c3 = 17, W rows 6–7 + f5 g5 = 16), R4 (rows 1–4 / rows 7–9). (b) **Areas and
totals** add to the board size: T1 5+5+10+5 = 25; C 6+6+7+6 = 25; D 6+5+7+5+2 = 25; R1 8+10+11+20 = 49; R3 8+8+17+16 = 49; R4 18+36+27 = 81;
K 5+5+10+5 (c1 stone counted as the removed point) = 25. (c) **Legality:** no group lacks a liberty in any position (the W group in C has
row 5 and e4; the B group in D has a1 a2 b1 b2 c1 d1 e1 d3 e3; N's B wall keeps a1 b1 d1 e1, W's wall rows 4–5). (d) **Komi results:** P3 10 vs
10.5, D 13 vs 10.5, R3 25 vs 24.5, R4 45 vs 43.5, N 10 vs 15.5. (e) **Why the choices are not accidents:** e4 / r2 point out a point that
touches both colours directly (c3: b3 X, d3 O; d3: c3 X, d2 X, d4 O). (f) **Dead and alive claims (not provable by hand, therefore AC 13):**
a lone stone inside a 1×5 pocket (K c1) or a 2×5 pocket (N c5) bordered by a solid, connected wall of five stones cannot make two eyes;
the 1×5 pocket of the owner's wall (row 1 under B in K/N) stays alive against an intruder who moves first (I traced the line W b1, B d1, W cannot
play a1 or e1 without suicide, B a1 captures); the walls W row 3 in N and W row 4 in K2 have a 2×5 / 1×5 pocket and are alive. QA must prove
these with the exhaustive search; if any proof fails, the position — not the test — is wrong, and I will redesign it. (g) **Seki, unsettled
borders and capturing races do not occur.** If the real engine disagrees with any number of §7.0, the table is wrong, not the engine.

## 11. Out of scope
Japanese territory scoring and prisoner counting; seki; neutral points that have to be filled (dame filling) — mentioned nowhere;
counting by "moving stones" (fast-count methods); disputes about alive/dead on wiggly real positions (M6 uses the engine's `score()` with
agreed dead stones); automatic dead-stone detection; handicap and komi 6.5/7; decimal entry in the count pad; a pass button in the
explanation player; timers, rating and streaks; hints that list all missing points; an AI tutor (M7); any new colour, sound or art;
13×13 and 19×19 boards; the settings screen for komi (M6).

## 12. Open decisions for the product owner (with my default)
1. **Is Unit 14 part of this item?** Default: **yes** — the `mark` type already exists after Unit 12, dead stones need only a different
   tap rule, and M6 (full games) needs "remove dead stones then count". Alternative: split Unit 14 (and the checkpoint) into its own
   roadmap item "M5 item 5 — End of game"; this item then ships 14 exercises and 6 steps, and Review 4 becomes a Review of Units 12–13.
2. **New exercise type `mark`, or extend `tap-point`?** Default: **new type** (clean validator rules and engine-proved answers); the runner
   reuses the tap-point machinery.
3. **Neutral points (单官) taught in Unit 12.** Default: **yes, step 3**, because otherwise the territory exercises would teach a wrong
   picture ("everything empty is mine"). Alternative: move neutral points to Unit 13 and keep Unit 12 to walls without contact.
4. **Komi handling.** Default: **no decimal entry**: the count pad is integers only and komi is decided by "who wins?" choices proved by the
   engine; 0.5 on 5×5/7×7, 7.5 on 9×9. Alternative: a `.5` key on the pad (extra scope).
5. **One colour per territory exercise** ("tap Black's territory") vs both colours in one exercise (tap cycles empty → black square → white
   square). Default: **one colour** (simpler to explain, one concept at a time); both colours can come in M6.
6. **Pass term:** default **弃权 qìquán** (what most apps show). Alternative: the traditional 虚着 xūzhāo.
7. **Scratch dots in count exercises** (AC 45). Default: **yes** — they make 45 points on 9×9 bearable and cost little. Alternative: none; then
   the 9×9 count could be removed from the review.
8. **Tidy positions** (straight walls, mirrored corners) rather than realistic ones. Default: **tidy** until M6; the price is that the
   9×9 count can be done by multiplying rows. Alternative: one wiggly 9×9 in the review (needs hand proof of every region).
9. **Tap marks at once (no touch-up commit).** Default: **tap toggles immediately** (reversible, differs from stone placement).
10. **Wrong-mark feedback gives classes of error and offending points, never the list of missing points.** Default: **yes**.
11. **`PLANNED_UNITS`** after this item: default **`[]`** and the existing "More units coming soon" footer. Alternative: show Unit 15 "First games"
    as planned (needs `unit.15.title`).
12. **Dead-stone proof.** Default: the validator proves the dead groups with the bounded search (raising the cap for this rule); the
    "walls are alive" claims are a QA exhaustive test. Alternative: structural rule only (developer's call, §9.5).
13. **HTML mockup before development?** Default: **no** (ASCII wireframes are enough for a dozen new elements: squares, dimmed stones, pad).
    Say yes if you want to see the territory squares and the pad in colour first.

## 12a. PO decisions
2026-10-21: the PO approved the spec as written and accepted every default in §12 (decisions 1–13),
including Unit 14 in this item and no HTML mockup.
2026-10-21 (after the developer's engine check): positions C and C2 have a dead "squared four" corner. PO
decision: replace them with 5×5 straight-wall positions (clearly alive, engine-proved), same exercise count.

## 12b. Developer deviations and engine check
**Engine re-proof (`__tests__/m5-territory-counting.test.ts`).** Every number of the §7.0 table, the dame of D (d3, e3), K with c1 kept
(B 5 / 0 / 5) and the komi results of §10 d equal the engine (`score()`); areas + dame add up to the board in every position. No
hand-computed number was wrong, so no content number changed. Dead stones (AC 13a): the bounded capture search (defender `run`) captures
K c1, K2 c5 and N c1 in 2 attacker moves and N c5 in 4 (≤ 33 nodes). Walls alive (AC 13b, exhaustive `canForceCapture`, the dead stones'
owner moves first): B row 2 in K and N and W row 4 in K2 survive 9 plies (the fastest capture would need 7), W row 3 in N survives 11
plies (fastest 9).

**Go-rule fix (closed, PO decision 2026-10-21).** The first C and C2 held a dead group: the corner eye spaces (a1 a2 b1 b2 /
d4 d5 e4 e5) were a *squared four* with no outside liberty (engine: the other side captured within 7 plies). Replaced by straight-wall
stairs: C = B a3 b3 c3 c2 d2 e2, W a4 b4 c4 d4 d3 e3 (B 6 / 7 / 13, W 6 / 6 / 12); C2 = B a3 b3 b2 c2 d2 e2, W a4 b4 c4 c3 d3 e3
(B 6 / 6 / 12, W 6 / 7 / 13). Same three exercises and ids (u12 e2 `mark-b-corner`, u12 e3 `mark-w-corner`, u13 e4 `area-w`); new answers
7 points, 7 points and 12; e2 hint and the e2 / e3 / u13 e4 explain texts changed in zh-CN, en and fr; AC 9, 10, 28 and §7 updated (AC 28:
"5 still to find"). The test proves both walls of T1, A, C, C2, P3 and D alive for 11 plies with the other side moving first.

**Deviations**
1. Schema: the choice outcome type is `ProofOutcome` (`Outcome` already names the exercise result `clean | solved | revealed`).
2. `MARK_TERRITORY_DEAD` is structural: error when a group touches no territory point of its own colour (no eye space at all, so it would
   have to be removed). It does not read life and death (the content test proves every territory position alive instead).
3. `MARK_DEAD_NOT_PROVEN` uses `forcedCapture` with 8 attacker moves (`SEARCH_MAX_MOVES`) and a 20 000-node cap; no structural fallback
   was needed (§9.5). Extra uses of codes: `MARK_EMPTY_ANSWER` also for an empty `dead` list, `CHOICE_PROVE_OPTIONS` also for an
   `outcome` without `prove`, `SCORE_BAD_DEAD` also for `prove.dead`.
4. `fb.count.score.withDame` matches "asked value + number of neutral points" (equals "area + neutral points" for area questions).
5. A revealed score count shows `fb.count.score.reveal` in place of `fb.revealed`, then the explain line.
6. Count entry: *Check* / *Next* sit in the entry row (no bottom button), keys are `practice-key-0…9` (old chips keep `practice-chip-N`).
   Territory squares are not drawn under a dimmed dead stone (as u14 s3).
7. Mark screens: the counter counts marked stones for dead marks (a 5-stone wall shows 5); a wrong dead Check shows one line for the
   refused groups (the first group's `whyKeys` text, else `fb.mark.extra.alive`), then the missing line. *Clear* is a 44 px pressable
   inside the 36 px status row.
8. New keys not in §5.4: `board.a11y.highlight.territoryB|territoryW|scratch`, `board.a11y.marker.dead`; option keys
   `lesson.u14-end.e1.o.end|again`, `e2.o.no|yes`, `lesson.u14-review.o.winB|winW` (r5 / r7). New token `opacity.dead` = 0.45.
9. u12 s2 and u13 s2/s3 keep the black squares of the previous step (the "+" of §7).
10. `__tests__/qa/i18n-content.test.ts` now counts `whyKeys` values as used keys.
11. Choice with two options: one wrong tap reveals the answer (M3 rule), so its `whyKey` was never shown (found by the web check, AC 47 /
    §13.9). A revealed choice now keeps the last wrong option's reason above "Here is the answer" and the explain line (all choices).
12. Web check: react-native-web renders no per-point accessible layer here, so the `aria-label` check of §13.12 found nothing to read;
    the announcements are covered by Jest (AC 37).

## 13. Web check (360×740, `npm run verify:web:m5e`, screenshots in `docs/screenshots/M5/24-*` …)
Release build as in `verify:web:m5d`. Run in zh-CN, en and fr where marked (fr = longest texts). The check must cover:
1. `24-` map: Units 12, 13, 14 playable (no "coming soon"), Unit 14 with two rows, fr titles do not squeeze the badge.
2. `25-` explanation u12 s3 (P3): black squares, white squares, five neutral circles; text card above the board (layout rule §5.6 of the previous spec).
3. `26-` mark e2 (C): two marks placed, counter "Marked: 2", Clear visible; `27-` after *Check* with a1,a2 only (missing line, marks kept).
4. `28-` mark e5 (P3) after marking c3: flash + `fb.mark.extra.dame` text with "c3" (before the flash ends: capture the card text).
5. `29-` mark revealed after 3 mistakes (solution squares, *Next* only); `30-` hint state (ring on one point).
6. `31-` dead e3 (K): the whole group dimmed with cross; `32-` dead e5 (N): wall tapped → `whyKeys` text, wall unmarked, c1 still dimmed.
7. `33-` count entry 7×7 (R3) with typed "25" and a few scratch dots; `34-` count 9×9 (R4), zh-CN, en and fr: **no scroll**, display + ⌫ + Check
   on one row, keys ≥ 44 px (measure with `getBoundingClientRect`).
8. `35-` count wrong: `stonesOnly` line (D, typed 6 for area) and the `deadKept` line (K, typed 5); `36-` count revealed with
   "6 stones + 7 points = 13." and the territory squares drawn.
9. `37-` choice winner (P3 or R4) with the wrong option's `whyKey`; `38-` explanation u14 s3 with the dead marker.
10. Measurements recorded in the script output: hit areas (keys, Clear, Check, Next ≥ 44 × 44), board 328 × 328, mark exercise total height
    ≤ 660, count-entry total height ≤ 724, contrast of black/white territory squares against the board ≥ 3:1, no horizontal overflow.
11. Regression screenshots: a chip-style `count` (u02) and a `tap-point` exercise still look as before; the old `u11` Unit map row is unchanged.
12. Keyboard/screen-reader smoke test on web: marks announce through `aria-label`s (react-native-web always reports a screen reader on;
    note as in STATUS "Known follow-ups").
Not verifiable on web and listed for the PO's iPhone check: finger tap accuracy on 7×7 count (41 px cells for the scratch dots), the
pad feel, system font scaling. Checklist file: `docs/specs/M5-territory-iphone-checklist.md` (to be written by the developer).
