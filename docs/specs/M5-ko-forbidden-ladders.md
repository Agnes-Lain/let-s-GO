# M5 item 1 — Forbidden points, Ko, Ladder (Units 7–9, zh-CN + en + fr)

Covers the first M5 roadmap item only ("Ko, forbidden points, ladders/nets"). SGF import, eyes and life & death,
territory and counting are separate later items. Mockup for approval: `docs/specs/M5-mockup.html`.
Status: **draft for product-owner approval** (no code written). Builds on `docs/specs/M3-lesson-framework.md` and
`docs/specs/M4-content-units-1-5.md` (same file layout, key naming, text limits, star rules).

## 0. In plain words (for the product owner)
- Three new units after Capture Go: **Unit 7 禁入点 Forbidden points** (you may not play where your stone would
  have no liberty, unless the move captures), **Unit 8 打劫 Ko** (you may not retake a single stone at once; play
  elsewhere first, which is called a ko threat), **Unit 9 征子 Ladder** (chasing a stone to the edge, and the
  stone that breaks a ladder). Each has a 3-slide explanation, 7 small exercises, and after Unit 9 there is a
  **review set** (8 exercises) that mixes Units 7–9 with older ideas.
- **Two big questions are yours to answer** (details in §3 and §12):
  1. *Ladders:* build the new "play the whole ladder move by move" screen now (Option A), or teach ladders with
     one-move questions plus animated explanations and add the new screen later with life & death (Option B,
     my recommendation). I made a mockup of the new screen so you can see what Option A would look like.
  2. *Nets:* the curriculum says "ladder and net". I could not find a net position that I can prove correct
     without a computer search, and nets are a second concept. I recommend a later lesson (§3, decision 2).
  Also: the curriculum writes the net as 枪 qiāng; the usual Go word is **枷 jiā** (net, geta). Please confirm.
- With Option B no new screen is needed. The only technical addition is a small field `prelude` that lets an
  exercise start *after* a few moves have been played (needed so that the engine knows a ko is in force). Ko
  exercises cannot be built honestly without it.
- **Every position was checked by hand** (stones, liberties, captures, legality); §10 lists how. I had no way to
  run the validator in this session, so the acceptance criteria make QA prove each claim with the real engine.
- Questions for you are collected at the end (§12), each with my default.

## 1. Goal
A beginner who finishes Units 7–9 knows which points they may not play (禁入点 jìnrùdiǎn) and when a capture makes
such a point legal, recognises a ko (打劫 dǎjié) and knows to play elsewhere (a ko threat) before retaking, and can
tell whether a ladder (征子 zhēngzi) captures or fails because of a stone in its path — in zh-CN, en or fr.

## 2. User stories
- As a beginner, I want to know why the board refuses a move, so that a refusal never feels like a bug.
- As a beginner, I want to see that a point that "looks forbidden" is allowed when it captures, so that I do not
  avoid good captures.
- As a beginner, I want ko explained with a tiny board and one clear picture of the closed point, so that I
  understand why I cannot retake at once.
- As a beginner, I want to learn what a ko threat is without having to read a whole ko fight.
- As a beginner, I want to watch a ladder run to the edge, then see one fail, so that I can predict the result.
- As a beginner, I want every wrong answer to tell me a fact about the position (liberties, what was captured).
- As a French- or Chinese-reading learner, I want Chinese terms with pinyin in en/fr and clean hanzi in zh-CN.
- As the product owner, I want the course to stay calm: one idea per unit, no new screen unless I approved it.

## 3. Scope, curriculum mapping and the key decisions

| Unit | Lesson id | Steps | Exercises | `CURRICULUM.md` source |
|---|---|---|---|---|
| 7 禁入点 | `u07-forbidden` | 3 | 7 | "Is this move legal?" |
| 8 打劫 | `u08-ko` | 3 | 7 | "Spot the ko; find a ko threat (simple)" |
| 9 征子 | `u09-ladder` | 3 | 7 | "Does the ladder work?" (net: see decision 2) |
| 9 checkpoint | `u09-review` (`kind: checkpoint`) | 0 | 8 | mixes Units 3–5 and 7–9 |

Total: 9 explanation steps, 29 exercises. Types used: tap-point, play-move, choice, count (no new type with
Option B). Boards: 5×5 for the idea, 7×7 where the learner must find something among stones or where a ladder needs
room. No 9×9 yet.

Deviations from `CURRICULUM.md` (on purpose):
- Unit 9 teaches the **ladder only**; the net moves to a later lesson (decision 2). Curriculum row 9 should read
  "征子 Ladder" for now.
- One checkpoint after Unit 9 (same pattern as `u05-review`); Units 7 and 8 end with their practice set.
- The ko lesson contains a *light* ko-threat idea (one scripted step and two one-move exercises) instead of a
  real ko fight (decision 3).

### KEY DECISION 1 — ladders need several moves: pull the `sequence` runner forward, or not?
A ladder is a chain of ataris: Black c4, White d3, Black e3, White d4, Black d5, White e4, Black e5 (§7.3). Both
options below were checked against it.

**Option A — build a light `sequence` runner now (the learner plays the whole ladder).**
- *Exercises:* two "play the ladder" exercises replace `u09-ladder` e3 and e4 and add one at the end (5×5 ladder,
  4 learner moves; 7×7 corner ladder, 4 learner moves; appendix §13). The learner plays Black; White answers by
  itself after ~0.6 s ("extend on the only liberty"). A wrong first move shows White's extension and the fact
  "White now has 3 liberties: the ladder broke", then *Try again*.
- *UI (new, see mockup section B):* progress pips "Move 2 of 4" in the top bar, a "White is answering…" line
  while input is locked, otherwise the M3 frame. Hint after 2 mistakes or by button; answer replayed after 3.
- *Effort:* new exercise type in the schema and validator (the validator must prove the main line and every
  accepted alternative with a bounded search), a runner with a small state machine, reveal animation, a11y
  announcements, tests, web check, plus this mockup. Roughly **two to three times the code work of Option B**,
  and it fixes a design for `sequence` before the SGF import and tsumego items (M5 items 2–3) exist. Those items
  need a *tree* of replies, not a single rule-based reply, so part of it may be redone.
- *Learning value:* highest. The learner feels the chase and discovers "I run out of room" or "the stone in the way".

**Option B — one-move exercises plus animated explanations (recommended).**
- *Exercises (§7.3):* count the liberties after White extends; choose the first atari (A or B); give the next atari
  in the middle of a ladder (any of two moves); finish the ladder with the capture; "does the ladder work?" yes/no
  on a 7×7 board with a stone in the path; tap the stone that breaks the ladder; yes/no on a corner ladder. All
  use existing runners. The whole chase is shown by the explanation player (steps play 3–4 moves with *Replay*).
- *UI:* none. No mockup needed for this option (the mockup's section A shows existing screens only).
- *Effort:* the `prelude` field (shared with Unit 8) plus content. The `sequence` runner is then designed once,
  with SGF import and tsumego, in the later M5 item; the two ladder "play it out" exercises of §13 are ready to be
  added then at no design cost.
- *Trade-offs:* yes/no questions can be guessed (50%); I reduce that with a reason for every wrong option, the
  reveal after one wrong answer, and the stepwise exercises 1–4. The learner never plays more than one chase move
  in a row.

**Recommendation: Option B.** The calm, small PR keeps the next two M5 items free to design `sequence` properly.
If playtesting shows that learners do not grasp ladders, add §13 then.

### KEY DECISION 2 — nets (枷 jiā)
A net captures without ataring ("surround and suffocate"). I tried to build a net position small enough for the
board sizes in this course and found that every candidate either (a) is simply a ladder, (b) lets White escape, or
(c) needs a long tree of White replies that I cannot guarantee by hand. The validator proves that a move is *legal*
and that a goal such as "capture" is met *by the move*; it cannot prove "White cannot escape". Nets also are a
second new idea, against the one-concept-per-lesson principle. **Recommendation:** move the net to a later lesson
("Unit 9b") that is built with a small search helper (the same one tsumego will need), and keep Unit 9 = ladder.
Alternatives are in §12 (decision 2).

### KEY DECISION 3 — ko threat ("find a ko threat")
It fits beginners **in a light form**: they already know atari. Unit 8 keeps (a) one scripted step (S3: a threat,
the answer, the retake), (b) one one-move exercise "put a black group in atari elsewhere" (e6), (c) one "what may
White do now?" question (e7). A real ko fight (several threats, ko value) is **deferred**. If you prefer to defer
the whole threat idea, drop S3, e6 and e7 and replace them with two more spotting exercises (§12, decision 3).

## 4. Acceptance criteria
Coordinates: letter = column (no "i"), number = row, row 1 at the bottom. "Content test" is
`src/lessons/content.test.ts`. A "line" is a list of moves replayed from the exercise/step setup with the real
engine. QA turns each criterion into a test.

**A. Files and validity**
1. Given the repo after this item, then `src/lessons/content/` additionally has `u07-forbidden.json`,
   `u08-ko.json`, `u09-ladder.json`, `u09-review.json`, each named after its `id`, all in `LESSON_FILES`.
2. When the content test runs, then every file passes `validateLesson` with `hasText` over zh-CN, en and fr, and
   `validateCatalog` returns `{ ok: true }` (one lesson for each of Units 1–9, plus the existing checkpoints and
   `u09-review` as the Unit 9 checkpoint).
3. Then step and exercise counts are 3/3/3/0 steps and 7/7/7/8 exercises, with the ids of §7.
4. Then `getSolution` of every exercise equals the "Right answer" column of §7 (one parametrised test; play-move
   and tap-point solutions compared as sets).
5. Then every text key used (`titleKey`, `textKey`, `promptKey`, `hintKey`, `explainKey`, options' `textKey`/`whyKey`)
   exists in zh-CN, en and fr within the limits (zh-CN ≤ 70, en/fr ≤ 160 characters; step texts ≤ 135 in en/fr).
6. Then the i18n parity test passes (identical key sets) and no existing key is removed; keys `unit.7.title` …
   `unit.10.title` exist in all three languages.
7. Then every `tap-point`, `play-move`, `count` exercise has a `hintKey`; every exercise has a `hintKey` or an
   `explainKey`; every wrong `choice` option has a `whyKey`; `hintPoints` are among the solution points.
8. Then the four files have `"coordinates": true` (texts name points such as c3; decision 5).

**B. Framework change: `prelude`**
9. Given an exercise with `prelude: [{color, at}, …]`, when it starts, then the board, the side to move and the ko
   ban are those after playing the moves from `setup` with the engine. Example `u08-ko` e1: Black b4 c3 d4 c5,
   White b3 c2 d3 on 5×5, White to move, `koPoint` = c4.
10. Given a prelude move that is illegal (fixture), then `validateLesson` fails with code `PRELUDE_ILLEGAL` and the
    path of the move.
11. Given a `play-move` whose `toPlay` differs from the side to move after the prelude (fixture), then it fails with
    `PRELUDE_TURN`. `choice`, `tap-point`, `count` do not need `toPlay`.
12. Given a prelude whose last move captured, then the captured stones are already gone when the exercise appears
    (no animation) and the last prelude move shows the normal last-move mark.
13. Given a wrong move and *Try again* (u08 e6), then the board returns to the state after the prelude, ko ban
    included.
14. Given an explanation step, then `prelude` is not allowed there (`UNKNOWN_FIELD`); steps keep using `moves`.

**C. Rules truth of the content (engine facts)**
15. Unit 7 legality: for u07 e3, e4, e7 and u09-review e2 the labelled point A is tested with `checkMove` for
    Black. e3 and review e2 are legal and capture; e4 and e7 are illegal with reason `suicide`. The correct option of
    each exercise matches.
16. Unit 7 forbidden sets: for u07 e1, e2, e6 and u09-review e1 the answer equals exactly the set of empty points
    where `checkMove` for Black is illegal with reason `suicide`; no other empty point is forbidden.
17. u07 e5: Black e5 captures 2 stones and is the only capturing move. Step 2: Black a1 captures a2 and b1. Step 3:
    White e1 captures c1 and d1, and Black e1 would be `suicide`.
18. Unit 8 ko: after the prelude of e1 the engine's `checkMove(W, c4)` is illegal with reason `ko`; for e2 and
    review e3 the labelled point (a3 / e3) is `ko`; for e4 c4 is `suicide` (not `ko`) and Black's c2-c3 group has 4
    liberties; for e5 (prelude B c3, W e5, B a5) and e7 (prelude B c3, W g6, B f7) White c4 is legal and captures c3.
19. u08 e3 solution is {c3}; after it, `koPoint` = c4 and `checkMove(W, c4)` = `ko`. u08 e6 solutions are {g6, f7}.
20. Unit 8 step 3 line (B c3, W g6, B f7, W c4) replays without an illegal move and the last move captures c3.
21. Ladder line L1 (5×5, setup B b3 c2 d2, W c3): B c4, W d3, B e3, W d4, B d5, W e4, B e5. Replay: each Black
    move leaves the white group with exactly 1 liberty; each White move leaves it with exactly 2 liberties, except
    White e4, which leaves 1; the last move captures 4 stones (c3 d3 d4 e4).
22. The same is verified for the three mirrored/shifted lines: review e7 (mirror, B c4 W b3 B a3 W b4 B b5 W a4
    B a5), u09 e7 (shifted by +2/+2 on 7×7: B e6 W f5 B g5 W f6 B f7 W g6 B g7) and the failing lines below.
23. Failing ladders: u09 e2 option B: after B d3, W c4 the white group has liberties exactly {b4, d4, c5}. u09 step 3 /
    e5 / e6 / review e8: the white group ends with exactly 3 liberties, so Black cannot atari again: step 3 and
    e5 {f4, f5, e6} (after W e4); e6 {e6, f6, g5} (after B f4, W e5 joining f5); review e8 {b4, b5, c6} (the
    mirror, after W c4; corrected by the developer, engine-checked).
24. u09 e1 answer 2; e3 solutions {a3, b4}; e4 solution {e5}; e5 "No"; e6 answer f5 (the stone ahead on the path);
    e7 "Yes".
25. *Recommended, not required:* a test-only brute-force search (not shipped) confirms for u09 e2 (A), e3 and e7
    that Black captures against every White reply within 12 plies. Do not add search code to `src/`.

**D. Play behaviour**
26. Given play-move u08 e6, when the learner taps c4 (ko point), then the move is refused, the feedback shows
    `engine.illegal.ko`, the board does not change and the attempt counter does not change.
27. Given u07 e5 (play-move) and a tap on any legal non-capturing point, then the message is `fb.pm.noCapture`.
28. Given a choice exercise, when a wrong option is chosen, then its `whyKey` text is the feedback; with 2 options
    the answer is revealed after the first wrong choice, with 3 after the second (M4 policy).
29. Given a wrong tap in a `tap-point` exercise, then `fb.tapOne.wrong` (one) or the partial/extra messages (all).
30. Given 3 mistakes in a play-move exercise (u08 e6, u09 e3), then the answer is revealed with `explainKey`,
    the exercise counts as `revealed` and *Next* appears (M3 behaviour unchanged).

**E. Stars and unlocks**
31. Star thresholds are the M4 ones: 7 exercises → 6 first-try = 3★, ≥ 6 solved = 2★, ≥ 4 solved = 1★; 8 exercises
    (review) → 7 / 7 / 4.
32. Given a fresh store with 1★ on Unit 6, then Unit 7 is `available`; with 1★ on 7 → 8 available; on 8 → 9
    available; with 1★ on 9, `u09-review` is `available` and never gates; Unit 10 is `soon`.
33. Given production mode, `getUnits()` returns Units 1–9 with a lesson, Unit 9 with a checkpoint, Unit 10 with
    `lesson: null`; `PLANNED_UNITS` is `[10]`; Units 11–16 are not listed.
34. Result screen of `u08-ko` (≥ 1★) → primary button *Next lesson* → `u09-ladder`; `u09-ladder` → `u09-review`;
    `u09-review` → *Back to map*.
35. Given all playable nodes (Units 1–9 and their checkpoints) have ≥ 1★, then *Continue* is hidden and
    `home.allDone` is shown.

**F. Text rules**
36. No zh-CN text contains pinyin; en and fr give the pinyin of 禁入点, 打劫, 劫材, 征子 at first use (§8).
37. No leaf/petal/confetti graphics, only theme tokens are used (no new colour).

**G. Layout (web check at 360×740; en, fr, zh-CN)**
38. The longest step text of each lesson shows fully in the 4-line card, in each language.
39. 7×7 boards with coordinates: every intersection's tap target is ≥ 44 px, or the developer reports the real
    size and drops the coordinate margin before shrinking cells.
40. The feedback sentence of AC 26 is fully visible without scrolling; screenshots saved under
    `docs/screenshots/M5/` (step 1 and one exercise of every lesson, plus AC 26).
41. Labels A and B on empty points (u09 e2, review e7) are readable on the bamboo board and not hidden by the
    last-move mark.

**H. Only if Option A is chosen (otherwise skip)** — see §13 for the replacement list.
42. A `sequence` exercise accepts only Black moves for which the bounded search proves capture; plays White's reply
    after ≥ 400 ms; locks input meanwhile; on a wrong move shows the engine fact (liberties after White's
    extension) and *Try again*; after 3 mistakes replays the main line.

## 5. Screen flow and UI
No new screens or components with Option B. Everything runs on M3/M4: unit map, explanation player (steps with
`moves`, `highlights`, `markers`, *Replay*), exercise frame, result screen. Changes (developer notes):
- `registry.ts`: add four imports. `loader.ts`: `PLANNED_UNITS = [10]`.
- `unit.7.title` … `unit.10.title` (map titles) and `lesson.<id>.…` keys of §7 are new. Map title style as before
  ("Forbidden points · 禁入点 jìnrùdiǎn").
- Schema: `ExerciseBase.prelude?: MoveDef[]`; validator codes `PRELUDE_ILLEGAL`, `PRELUDE_TURN` (AC 9–14);
  `startState`/`exerciseGame` apply it; the runners already use the engine state, so they need no other change.
  The board's last-move mark for the last prelude move comes from the engine history. Every validator check that
  looks at the position (answer points, `hintPoints`, markers, "already true", `getSolution`) uses the state
  **after** the prelude, not the raw `setup` (e.g. u08 e1's answer c4 is occupied in the setup and empty after it).
- Tests that assumed "only Units 1–6 exist" (map/loader tests) are updated.
- Closed points: the explanation step uses the existing `cross` marker for the ko point (rouge, see mockup A1).
  In exercises the closed point is **not** drawn; tapping it shows the engine sentence (mockup A2). This keeps ko
  a thing the learner finds, and keeps the board calm.
- Unit 7 teaches by *refusal*: the existing engine sentence `engine.illegal.suicide` already names 禁入点 jìnrùdiǎn.

Screens (unchanged layout, 360×740, tap targets ≥ 44 px): explanation step = text card + board + Replay + Back/Next;
exercise = prompt card + board (+ option buttons for choice) + feedback card + hint button. States: empty
(prompt), hint (amber rings on `hintPoints`), wrong (dashed rouge ring on the played stone for play-move, reason in
the feedback card), success (green ring, short "tock"), failure after 3 (answer ring + `explainKey`), loading none.

## 6. Game design notes
**Curve per lesson** (M3 §5.4): exercise 1 almost certain; 2–3 a small twist; 4–5 the real test (a trap that looks
like the rule but is not); 6–7 the same idea in a new shape. Traps always come after the plain case:
- Unit 7: e1–e2 plain pockets → e3 "forbidden-looking but captures" → e4 twin of e3 *without* a capture → e5 act on
  the exception → e6 find all three on 7×7 → e7 the same rule for a group.
- Unit 8: e1–e2 spot the closed point (centre, edge) → e3 start a ko yourself → e4 *ko or forbidden?* (the hardest) →
  e5–e7 how the ban ends and what a threat does.
- Unit 9: e1 count → e2 which atari → e3–e4 keep chasing, finish → e5–e6 the stone in the path (yes/no, then find
  it) → e7 a corner ladder that works.

**Length:** 3 steps (~20 s) + 7 exercises (~25 s) ≈ 3 minutes per unit; the review ≈ 4 minutes.

**Stars:** M3 constants (AC 31). **Hints:** Hint button always visible (costs first-try); opens by itself after the
2nd mistake; answer shown after the 3rd (choice with 2 options: after the 1st; 3 options: after the 2nd).
Choice exercises have no pulse; their `whyKey` is the hint.

**Feedback / reward:** as M3 (stone "tock", capture fade, green ring, stars one by one, no special sound for the
ko refusal). Refusals (suicide, ko, occupied) are information, not mistakes: no try is lost.

**After 3 failures:** answer ring + `explainKey`, outcome `revealed`, *Next*. Unit 7–9 sets never block: 1★ needs
only 4 solved of 7.

**Order inside a unit:** "see → name → vary": a plain position, the rule named, then a twist or a trap.

## 7. Content (lesson JSON + texts)
Schema: `src/lessons/schema.ts` plus the `prelude` field of §5. Texts live in `src/i18n/{zh-CN,en,fr}.json` under
`lesson.<id>.…`; `s<n>` = step, `e<n>.prompt/hint/explain` = exercise texts, `e<n>.o<k>` / `e<n>.w<k>` = option text /
reason. Labels A/B are drawn on empty points by `markers` of kind `label`. zh-CN never shows pinyin.

### 7.1 Unit 7 — 禁入点 Forbidden points  (`src/lessons/content/u07-forbidden.json`)
Concept: a stone may not be played where it (with its group) would have no liberty, unless the move captures.
Steps: 3. Exercises: 7.

Diagrams (X = Black, O = White, `.` empty, `*` the point in question; row 5 at the top):
```
S1 (5x5)        S2 (5x5)        S3 (5x5)           e4 (5x5)        e7 (5x5)
  a b c d e       a b c d e       a b c d e          a b c d e       a b c d e
5 . . . . .     5 . . . . .     5 . . . . .        5 . . . . .     5 . . . . .
4 . . O . .     4 . . . . .     4 . . . . .        4 . . . . .     4 . . . . .
3 . O * O .     3 X . . . .     3 . . . . .        3 . . . . .     3 . . . . .
2 . . O . .     2 O X . . .     2 . . O O O        2 . . . X O     2 O O O . .
1 . . . . .     1 * O X . .     1 . O X X *        1 . . . O *     1 * X X O .
(c3: no liberty) (a1 captures    (e1: last liberty   (e1: O d1 has    (a1: last liberty
                  a2, b1)         of c1-d1)           c1, O e2 has e3)  of b1-c1)
```
Checked: S1 c3 neighbours are four White stones, each White stone keeps ≥ 2 liberties → illegal. S2 White a2 has only
liberty a1 (a3, b2 Black) and White b1 only a1 (c1, b2 Black); Black a1 captures both and gets liberties a2, b1.
S3 Black c1-d1 have only liberty e1 (b1, c2, d2 White); White e1 has liberty via e2 (friendly), captures both.
e4: Black e1 has no liberty; White d1 keeps c1, White e2 keeps e3 → nothing captured → illegal. e7: group b1-c1 has
only liberty a1 (d1, b2, c2 White); White a2-b2-c2 keeps liberties a3 b3 c3 d2 → nothing captured → illegal.

| # | id | Type | Tests | Right answer (hand-checked; AC 15–17) |
|---|---|---|---|---|
| 1 | forbidden-center | tap-point one | pocket c3, W c2 b3 d3 c4 | c3 |
| 2 | forbidden-corner | tap-point one | corner a1, W a2 b1 | a1 |
| 3 | capture-exception | choice (2) | c3 next to 4 W stones, c4 in atari | "Yes, it captures" |
| 4 | trap-corner | choice (2) | e1, W d1 e2 each with a spare liberty | "No" |
| 5 | capture-corner | play-move capture min 2 | B e3 d4 c5, W e4 d5 | e5 |
| 6 | tap-all-forbidden | tap-point all, 7×7 | three pockets | a1, d4, g7 |
| 7 | group-last-liberty | choice (2) | b1-c1 filling a1 | "No" |

```json
{
  "schema":1,"id":"u07-forbidden","unit":7,"kind":"lesson","titleKey":"lesson.u07-forbidden.title","coordinates":true,
  "explain":[
    {"board":{"size":5,"setup":{"W":["c2","b3","d3","c4"]}},"markers":[{"kind":"cross","at":"c3"}],"textKey":"lesson.u07-forbidden.s1"},
    {"board":{"size":5,"setup":{"B":["a3","b2","c1"],"W":["a2","b1"]}},"moves":[{"color":"B","at":"a1"}],"highlights":[{"kind":"hint","points":["a1"]}],"textKey":"lesson.u07-forbidden.s2"},
    {"board":{"size":5,"setup":{"B":["c1","d1"],"W":["b1","c2","d2","e2"]}},"moves":[{"color":"W","at":"e1"}],"highlights":[{"kind":"hint","points":["e1"]}],"textKey":"lesson.u07-forbidden.s3"}
  ],
  "exercises":[
    {"id":"forbidden-center","type":"tap-point","size":5,"setup":{"W":["c2","b3","d3","c4"]},"mode":"one","answer":{"points":["c3"]},"promptKey":"lesson.u07-forbidden.e1.prompt","hintKey":"lesson.u07-forbidden.e1.hint","hintPoints":["c3"],"explainKey":"lesson.u07-forbidden.e1.explain"},
    {"id":"forbidden-corner","type":"tap-point","size":5,"setup":{"W":["a2","b1"]},"mode":"one","answer":{"points":["a1"]},"promptKey":"lesson.u07-forbidden.e2.prompt","hintKey":"lesson.u07-forbidden.e2.hint","hintPoints":["a1"],"explainKey":"lesson.u07-forbidden.e2.explain"},
    {"id":"capture-exception","type":"choice","size":5,"setup":{"B":["b4","d4","c5"],"W":["c2","b3","d3","c4"]},"options":[{"textKey":"lesson.u07-forbidden.e3.o1","correct":true},{"textKey":"lesson.u07-forbidden.e3.o2","whyKey":"lesson.u07-forbidden.e3.w2"}],"markers":[{"kind":"label","at":"c3","text":"A"}],"promptKey":"lesson.u07-forbidden.e3.prompt","explainKey":"lesson.u07-forbidden.e3.explain"},
    {"id":"trap-corner","type":"choice","size":5,"setup":{"B":["d2"],"W":["e2","d1"]},"options":[{"textKey":"lesson.u07-forbidden.e4.o1","whyKey":"lesson.u07-forbidden.e4.w1"},{"textKey":"lesson.u07-forbidden.e4.o2","correct":true}],"markers":[{"kind":"label","at":"e1","text":"A"}],"promptKey":"lesson.u07-forbidden.e4.prompt","explainKey":"lesson.u07-forbidden.e4.explain"},
    {"id":"capture-corner","type":"play-move","size":5,"setup":{"B":["e3","d4","c5"],"W":["e4","d5"]},"toPlay":"B","goal":{"kind":"capture","min":2},"promptKey":"lesson.u07-forbidden.e5.prompt","hintKey":"lesson.u07-forbidden.e5.hint","hintPoints":["e5"],"explainKey":"lesson.u07-forbidden.e5.explain"},
    {"id":"tap-all-forbidden","type":"tap-point","size":7,"setup":{"W":["a2","b1","g6","f7","d3","c4","e4","d5"]},"mode":"all","answer":{"points":["a1","d4","g7"]},"promptKey":"lesson.u07-forbidden.e6.prompt","hintKey":"lesson.u07-forbidden.e6.hint","explainKey":"lesson.u07-forbidden.e6.explain"},
    {"id":"group-last-liberty","type":"choice","size":5,"setup":{"B":["b1","c1"],"W":["d1","a2","b2","c2"]},"options":[{"textKey":"lesson.u07-forbidden.e7.o1","whyKey":"lesson.u07-forbidden.e7.w1"},{"textKey":"lesson.u07-forbidden.e7.o2","correct":true}],"markers":[{"kind":"label","at":"a1","text":"A"}],"promptKey":"lesson.u07-forbidden.e7.prompt","explainKey":"lesson.u07-forbidden.e7.explain"}
  ]
}
```

**Texts** (prefix `lesson.u07-forbidden.`)

| Key | zh-CN | en | fr |
|---|---|---|---|
| title | 禁入点 | Forbidden points | Points interdits |
| s1 | 黑棋下在 c3，这颗子一口气都没有。这样的点叫禁入点，不能下。 | Black playing on c3 would leave the stone with no liberty. That point is forbidden (禁入点 jìnrùdiǎn): you can't play there. | Une pierre noire en c3 n'aurait aucune liberté. C'est un point interdit (禁入点 jìnrùdiǎn) : on ne peut pas y jouer. |
| s2 | 有一个例外：能提子的着法可以下。黑 a1 提掉两颗白子，就有气了。 | One exception: a move that captures is allowed. At a1 Black takes the last liberty of both white stones and removes them. | Exception : un coup qui capture est permis. En a1, les Noirs prennent la dernière liberté des deux pierres blanches. |
| s3 | 整块棋也一样：e1 是这两颗黑子的最后一口气，黑棋不能下，白棋下在 e1 就能提掉它们。 | The rule holds for groups. e1 is the only liberty of the two black stones: Black may not play it, but White may and captures them. | Idem pour un groupe : e1 est la seule liberté des deux pierres noires. Noir ne peut pas y jouer ; Blanc oui, et il les capture. |
| e1.prompt | 轮到黑棋。点出黑棋不能下的点。 | Black to play. Tap the point where Black may not play. | Aux Noirs. Touchez le point où les Noirs ne peuvent pas jouer. |
| e1.hint | 找一个四周都是白子的空点。 | Look for an empty point with a white stone on every side. | Cherchez un point vide entouré de pierres blanches. |
| e1.explain | c3 四面都是白子，黑子下进去没有气，也提不了子。 | c3 is surrounded by White: a stone there would have no liberty and capture nothing. | c3 est entouré de pierres blanches : une pierre y serait sans liberté et ne capturerait rien. |
| e2.prompt | 轮到黑棋。点出黑棋不能下的点。 | Black to play. Tap the point where Black may not play. | Aux Noirs. Touchez le point où les Noirs ne peuvent pas jouer. |
| e2.hint | 角上的点只有两个邻点。 | A corner point has only two neighbours. | Un point de coin n'a que deux voisins. |
| e2.explain | a1 的两个邻点 a2、b1 都是白子，黑棋下在那里没有气。 | Both neighbours of a1, a2 and b1, are White: a stone there would have no liberty. | Les deux voisins de a1, a2 et b1, sont blancs : une pierre y serait sans liberté. |
| e3.prompt | 黑棋可以下在 A 吗？ | Can Black play on A? | Les Noirs peuvent-ils jouer en A ? |
| e3.o1 | 可以，能提子 | Yes, it captures | Oui, cela capture |
| e3.o2 | 不可以，没有气 | No, it has no liberty | Non, aucune liberté |
| e3.w2 | c3 填掉了 c4 的最后一口气，c4 被提走，c3 就有气了。 | Black takes the last liberty of c4, so c4 is captured and c3 gets a liberty. | c3 prend la dernière liberté de c4 : c4 est capturée et c3 gagne une liberté. |
| e3.explain | 能提子的着法不算禁入。 | A move that captures is not forbidden. | Un coup qui capture n'est pas interdit. |
| e4.prompt | 黑棋可以下在 A 吗？ | Can Black play on A? | Les Noirs peuvent-ils jouer en A ? |
| e4.o1 | 可以 | Yes | Oui |
| e4.w1 | 旁边的白子还各有一口气（c1 和 e3），提不了子，e1 没有气。 | The white stones still have liberties (c1 and e3), so nothing is captured and e1 would have no liberty. | Les pierres blanches ont encore des libertés (c1 et e3) : rien n'est capturé et e1 n'aurait aucune liberté. |
| e4.o2 | 不可以 | No | Non |
| e4.explain | 没有提子，也没有气，所以是禁入点。 | Nothing is captured and the stone has no liberty: a forbidden point. | Rien n'est capturé et la pierre n'a pas de liberté : point interdit. |
| e5.prompt | 一次提走两颗白子。 | Capture both white stones with one move. | Capturez les deux pierres blanches d'un coup. |
| e5.hint | 两颗白子共同的最后一口气在哪里？ | Where is the one liberty both white stones share? | Où est la seule liberté que partagent les deux pierres blanches ? |
| e5.explain | e5 看起来像禁入点，但它提走了两颗白子。 | e5 looks forbidden, but it captures both white stones. | e5 semble interdit, mais capture les deux pierres blanches. |
| e6.prompt | 点出黑棋所有不能下的点，然后按“确认”。 | Tap every point where Black may not play, then press Check. | Touchez tous les points où les Noirs ne peuvent pas jouer, puis Vérifier. |
| e6.hint | 有三个：每个都被白子完全围住。 | There are three, each one enclosed by White stones. | Il y en a trois, chacun entouré de pierres blanches. |
| e6.explain | a1、d4、g7 四周都是白子，而且白子都还有气。 | a1, d4 and g7 are enclosed by White stones that all still have liberties. | a1, d4 et g7 sont entourés de pierres blanches qui ont toutes encore des libertés. |
| e7.prompt | 黑棋可以下在 A 吗？ | Can Black play on A? | Les Noirs peuvent-ils jouer en A ? |
| e7.o1 | 可以 | Yes | Oui |
| e7.w1 | a1 是这两颗黑子的最后一口气，填上去整块都没有气，也提不了白子。 | a1 is the last liberty of the black stones: filling it leaves the whole group with none, and no white stone is captured. | a1 est la dernière liberté des pierres noires : la remplir ne leur en laisse aucune, et aucune pierre blanche n'est capturée. |
| e7.o2 | 不可以 | No | Non |
| e7.explain | 整块黑棋只剩 a1 一口气，自己填掉就是禁入。 | The black group has one liberty, a1; filling it yourself is forbidden. | Le groupe noir n'a qu'une liberté, a1 : la remplir soi-même est interdit. |

### 7.2 Unit 8 — 打劫 Ko  (`src/lessons/content/u08-ko.json`)
Concept: after a single stone is captured by a single stone that has one liberty, the captured side may not retake
at once; it plays elsewhere first. A move elsewhere that must be answered is a ko threat (劫材). Steps: 3.
Exercises: 7. Uses `prelude` for the exercises that need the ban in force.

Diagrams (5×5 unless stated; `*` = ko point):
```
KO-A before        KO-A after B c3     KO-edge before     KO-edge after B b3   7x7 threat position (before B c3)
  a b c d e          a b c d e           a b c d e          a b c d e            a b c d e f g
5 . . X . .        5 . . X . .         5 . . . . .        5 . . . . .        7 . . . . . . .
4 . X O X .        4 . X * X .         4 X O . . .        4 X O . . .        6 . . . . O X .
3 . O . O .        3 . O X O .         3 O . O . .        3 * X O . .        5 . . X . . O .
2 . . O . .        2 . . O . .         2 X O . . .        2 X O . . .        4 . X O X . . .
1 . . . . .        1 . . . . .         1 . . . . .        1 . . . . .        3 . O . O . . .
 (c3 empty;                              (Black b3 empty)                    2 . . O . . . .
  B plays c3)                                                                  1 . . . . . . .
```
Checked: KO-A: White c4 has only liberty c3 (b4 d4 c5 Black). Black c3 captures it; the played stone is single, has
one liberty (c4) and exactly one stone was captured → engine `koPoint` = c4. White b3, c2, d3 keep ≥ 2 liberties.
White c4 now would capture c3 (its only liberty c4) → forbidden by ko. KO-edge: White a3 has only liberty b3
(a2, a4 Black); Black b3 captures it, has one liberty (a3), koPoint = a3; Black a2 / a4 keep a1 / a5 plus a3.
7×7: Black f6 has liberties g6, f7 (e6, f5 White); White g6 or f7 ataris it; Black f7 extends to a group with
liberties e7, g7 (so it is safe); the ko ban is gone after two other moves.

| # | id | Type | Tests | Right answer |
|---|---|---|---|---|
| 1 | tap-ko | tap-point one (prelude B c3) | the closed point after a capture | c4 |
| 2 | retake-edge | choice (2) (prelude B b3, edge ko) | may White retake at A=a3? | "No, it is a ko" |
| 3 | start-ko | play-move capture | start a ko yourself | c3 |
| 4 | ko-or-forbidden | choice (2) (prelude B c3, capturer connected) | why can't White play c4? | "Forbidden point" |
| 5 | elsewhere-first | choice (2) (prelude B c3, W e5, B a5) | ban lasts one turn | "Yes" |
| 6 | find-threat | play-move atari, 7×7 (prelude B c3) | ko threat | g6 or f7 |
| 7 | after-threat | choice (3) (prelude B c3, W g6, B f7) | what may White do | "Retake on c4" |

```json
{
  "schema":1,"id":"u08-ko","unit":8,"kind":"lesson","titleKey":"lesson.u08-ko.title","coordinates":true,
  "explain":[
    {"board":{"size":5,"setup":{"B":["b4","d4","c5"],"W":["c4","c2","b3","d3"]}},"moves":[{"color":"B","at":"c3"}],"highlights":[{"kind":"hint","points":["c3"]}],"textKey":"lesson.u08-ko.s1"},
    {"markers":[{"kind":"cross","at":"c4"}],"textKey":"lesson.u08-ko.s2"},
    {"board":{"size":7,"setup":{"B":["b4","d4","c5","f6"],"W":["c4","c2","b3","d3","e6","f5"]}},"moves":[{"color":"B","at":"c3"},{"color":"W","at":"g6"},{"color":"B","at":"f7"},{"color":"W","at":"c4"}],"textKey":"lesson.u08-ko.s3"}
  ],
  "exercises":[
    {"id":"tap-ko","type":"tap-point","size":5,"setup":{"B":["b4","d4","c5"],"W":["c4","c2","b3","d3"]},"prelude":[{"color":"B","at":"c3"}],"mode":"one","answer":{"points":["c4"]},"markers":[{"kind":"triangle","at":"c3"}],"promptKey":"lesson.u08-ko.e1.prompt","hintKey":"lesson.u08-ko.e1.hint","hintPoints":["c4"],"explainKey":"lesson.u08-ko.e1.explain"},
    {"id":"retake-edge","type":"choice","size":5,"setup":{"B":["a2","a4"],"W":["a3","b2","b4","c3"]},"prelude":[{"color":"B","at":"b3"}],"options":[{"textKey":"lesson.u08-ko.e2.o1","whyKey":"lesson.u08-ko.e2.w1"},{"textKey":"lesson.u08-ko.e2.o2","correct":true}],"markers":[{"kind":"triangle","at":"b3"},{"kind":"label","at":"a3","text":"A"}],"promptKey":"lesson.u08-ko.e2.prompt","explainKey":"lesson.u08-ko.e2.explain"},
    {"id":"start-ko","type":"play-move","size":5,"setup":{"B":["b4","d4","c5"],"W":["c4","c2","b3","d3"]},"toPlay":"B","goal":{"kind":"capture"},"promptKey":"lesson.u08-ko.e3.prompt","hintKey":"lesson.u08-ko.e3.hint","hintPoints":["c3"],"explainKey":"lesson.u08-ko.e3.explain"},
    {"id":"ko-or-forbidden","type":"choice","size":5,"setup":{"B":["b4","d4","c5","c2"],"W":["c4","b3","d3"]},"prelude":[{"color":"B","at":"c3"}],"options":[{"textKey":"lesson.u08-ko.e4.o1","whyKey":"lesson.u08-ko.e4.w1"},{"textKey":"lesson.u08-ko.e4.o2","correct":true}],"markers":[{"kind":"triangle","at":"c3"},{"kind":"label","at":"c4","text":"A"}],"promptKey":"lesson.u08-ko.e4.prompt","explainKey":"lesson.u08-ko.e4.explain"},
    {"id":"elsewhere-first","type":"choice","size":5,"setup":{"B":["b4","d4","c5"],"W":["c4","c2","b3","d3"]},"prelude":[{"color":"B","at":"c3"},{"color":"W","at":"e5"},{"color":"B","at":"a5"}],"options":[{"textKey":"lesson.u08-ko.e5.o1","correct":true},{"textKey":"lesson.u08-ko.e5.o2","whyKey":"lesson.u08-ko.e5.w2"}],"markers":[{"kind":"label","at":"c4","text":"A"}],"promptKey":"lesson.u08-ko.e5.prompt","explainKey":"lesson.u08-ko.e5.explain"},
    {"id":"find-threat","type":"play-move","size":7,"setup":{"B":["b4","d4","c5","f6"],"W":["c4","c2","b3","d3","e6","f5"]},"prelude":[{"color":"B","at":"c3"}],"toPlay":"W","goal":{"kind":"atari"},"promptKey":"lesson.u08-ko.e6.prompt","hintKey":"lesson.u08-ko.e6.hint","hintPoints":["g6","f7"],"explainKey":"lesson.u08-ko.e6.explain"},
    {"id":"after-threat","type":"choice","size":7,"setup":{"B":["b4","d4","c5","f6"],"W":["c4","c2","b3","d3","e6","f5"]},"prelude":[{"color":"B","at":"c3"},{"color":"W","at":"g6"},{"color":"B","at":"f7"}],"options":[{"textKey":"lesson.u08-ko.e7.o1","correct":true},{"textKey":"lesson.u08-ko.e7.o2","whyKey":"lesson.u08-ko.e7.w2"},{"textKey":"lesson.u08-ko.e7.o3","whyKey":"lesson.u08-ko.e7.w3"}],"promptKey":"lesson.u08-ko.e7.prompt","explainKey":"lesson.u08-ko.e7.explain"}
  ]
}
```
Check of the other facts used: e3 — in KO-A (before) only c3 captures (c4 is the only White stone with one
liberty), so the solution set is {c3}. e4 — after B c3 the group c2-c3 has 4 liberties (b2, d2, c1, c4), White c4
would have no liberty and no Black group would be captured (b4: a4 b5; d4: e4 d5; c5: b5 d5; c2-c3: b2 d2 c1) →
`suicide`, not `ko`. e6 — only g6 and f7 put a Black group (f6) down to one liberty; White c4 is refused; no other
White move ataris a group (b4 has a4 b5 c4, d4 has e4 d5 c4, c5 has b5 d5 c4). e7 — after the prelude the group f6-f7
has liberties e7, g7; White c4 is legal and captures c3.

**Texts** (prefix `lesson.u08-ko.`)

| Key | zh-CN | en | fr |
|---|---|---|---|
| title | 打劫 | Ko | Ko |
| s1 | 黑棋下在 c3，提掉 c4。现在黑 c3 只剩 c4 一口气。 | Black plays c3 and captures c4. Now the stone on c3 has only one liberty: c4. | Les Noirs jouent c3 et capturent c4. La pierre c3 n'a plus qu'une liberté : c4. |
| s2 | 马上提回 c4 会让局面无限重复。这叫打劫：不能立刻提回，要先下别处。 | Retaking on c4 at once could repeat forever. This is ko (打劫 dǎjié): you may not retake right away. Play elsewhere first. | Reprendre en c4 tout de suite pourrait durer toujours. C'est le ko (打劫 dǎjié) : pas de reprise immédiate. Jouez d'abord ailleurs. |
| s3 | 白棋在别处叫吃 f6，这是劫材。黑棋应了一手，局面变了，白棋就可以提回 c4。 | White ataris f6: a ko threat (劫材 jiécái). Black answers, the position has changed, and White may retake on c4. | Les Blancs mettent f6 en atari : une menace de ko (劫材 jiécái). Les Noirs répondent ; les Blancs peuvent reprendre en c4. |
| e1.prompt | 黑棋刚提了子（有标记的黑子）。点出白棋现在不能下的点。 | Black just captured (marked stone). Tap the point White may not play right now. | Les Noirs viennent de capturer (pierre marquée). Touchez le point que les Blancs ne peuvent pas jouer maintenant. |
| e1.hint | 白棋提回去就会重复原来的局面。 | Retaking there would repeat the earlier position. | Reprendre là répéterait la position précédente. |
| e1.explain | c4 是劫：白棋要先下别处。 | c4 is the ko point: White must play elsewhere first. | c4 est le point de ko : les Blancs doivent d'abord jouer ailleurs. |
| e2.prompt | 黑棋刚下了 b3 提子。白棋现在可以下在 A 吗？ | Black just captured by playing b3. May White play on A right now? | Les Noirs viennent de capturer en b3. Les Blancs peuvent-ils jouer en A maintenant ? |
| e2.o1 | 可以 | Yes | Oui |
| e2.w1 | A 会提掉 b3，使局面回到黑棋下之前的样子，打劫规则不允许。 | A would capture b3 and bring back the position from before Black's move. Ko forbids that. | A capturerait b3 et rétablirait la position d'avant le coup noir. Le ko l'interdit. |
| e2.o2 | 不可以，这是劫 | No, it is a ko | Non, c'est un ko |
| e2.explain | 要先在别处下一手，才能提回 a3。 | White must play elsewhere first, then may retake on a3. | Les Blancs doivent d'abord jouer ailleurs, puis ils pourront reprendre en a3. |
| e3.prompt | 轮到黑棋。提走白子，开始一个劫。 | Black to play. Capture a white stone to start a ko. | Aux Noirs. Capturez une pierre blanche pour commencer un ko. |
| e3.hint | 哪颗白子只剩一口气？ | Which white stone has only one liberty? | Quelle pierre blanche n'a plus qu'une liberté ? |
| e3.explain | c3 提掉 c4 后只有一口气，白棋不能马上提回，这就是劫。 | After taking c4, Black's c3 has one liberty and White cannot retake at once: a ko. | Après la capture de c4, c3 n'a qu'une liberté et Blanc ne peut pas reprendre aussitôt : c'est un ko. |
| e4.prompt | 黑棋刚下 c3 提子。白棋为什么不能下 A？ | Black just captured on c3. Why can't White play A? | Les Noirs viennent de capturer en c3. Pourquoi les Blancs ne peuvent-ils pas jouer en A ? |
| e4.o1 | 因为打劫 | Because of ko | À cause du ko |
| e4.w1 | 不是劫：黑 c2、c3 连成一块，有 4 口气，白棋提不了。 | Not a ko: Black's c2-c3 group has 4 liberties, so a white stone there could not capture it. | Pas un ko : le groupe noir c2-c3 a 4 libertés, une pierre blanche ne pourrait pas le capturer. |
| e4.o2 | 因为是禁入点 | Because it is a forbidden point | Parce que c'est un point interdit |
| e4.explain | 白子下在 A 没有气，又提不了黑子，是禁入点，不是劫。 | A white stone on A would have no liberty and capture nothing: a forbidden point, not a ko. | Une pierre blanche en A n'aurait pas de liberté et ne capturerait rien : point interdit, pas un ko. |
| e5.prompt | 黑 c3 提子后，白棋下了 e5，黑棋下了 a5。现在白棋可以下 A 吗？ | Black captured on c3, then White played e5 and Black played a5. May White play on A now? | Les Noirs ont capturé en c3, puis Blanc a joué e5 et Noir a5. Les Blancs peuvent-ils jouer en A maintenant ? |
| e5.o1 | 可以 | Yes | Oui |
| e5.o2 | 不可以，仍是劫 | No, it is still a ko | Non, c'est encore un ko |
| e5.w2 | 劫只在紧接着的一手内不能提回；双方都下过别处，局面已经不同。 | The ban lasts one turn only. Both sides have played elsewhere, so the position is different. | L'interdiction ne dure qu'un tour. Les deux camps ont joué ailleurs : la position est différente. |
| e5.explain | 下过别处之后，白棋可以提回 c4。 | After moves elsewhere, White may retake on c4. | Après des coups ailleurs, les Blancs peuvent reprendre en c4. |
| e6.prompt | 白棋不能马上提回 c4。在别处下一手，叫吃黑棋。 | White can't retake c4 yet. Play a move elsewhere that puts a black group in atari. | Les Blancs ne peuvent pas reprendre en c4. Jouez ailleurs un coup qui met un groupe noir en atari. |
| e6.hint | 黑 f6 只剩两口气：g6 和 f7。 | The black stone on f6 has two liberties: g6 and f7. | La pierre noire f6 a deux libertés : g6 et f7. |
| e6.explain | 黑棋必须应，否则 f6 被提。局面变了，白棋就能提回 c4。 | Black must answer or lose f6. Then the position has changed and White may retake on c4. | Les Noirs doivent répondre ou perdre f6. La position change et les Blancs peuvent reprendre en c4. |
| e7.prompt | 白棋 g6 叫吃，黑棋 f7 应了。现在白棋可以怎么下？ | White played g6 (atari) and Black answered f7. What may White do now? | Les Blancs ont joué g6 (atari) et les Noirs ont répondu f7. Que peuvent faire les Blancs ? |
| e7.o1 | 提回 c4 | Retake on c4 | Reprendre en c4 |
| e7.o2 | 再等一手 | Wait one more turn | Attendre encore un tour |
| e7.w2 | 不用等，黑棋应了之后局面已经变了。 | No need: after Black's answer the position has changed. | Inutile : après la réponse noire, la position a changé. |
| e7.o3 | 下 g7 提黑棋 | Capture the black stones with g7 | Capturer les pierres noires en g7 |
| e7.w3 | f6、f7 还有 e7 和 g7 两口气，提不了。 | The black stones f6-f7 still have two liberties, e7 and g7. | Les pierres noires f6-f7 ont encore deux libertés, e7 et g7. |
| e7.explain | 劫材让黑棋应了一手，白棋就可以提回。 | The ko threat forced an answer, so White may retake. | La menace de ko a forcé une réponse : les Blancs peuvent reprendre. |

### 7.3 Unit 9 — 征子 Ladder  (`src/lessons/content/u09-ladder.json`)
Concept: Black ataris, White extends, Black ataris again; White runs in a staircase toward the edge. It captures
if nothing stops the staircase; a white stone waiting in its path (a ladder breaker) lets White escape. Steps: 3.
Exercises: 7.

Diagrams (L1, 5×5, setup B b3 c2 d2, W c3; sequence numbers show the move order):
```
start          after 1-3         end (move 7 captures c3 d3 d4 e4)    breaker (7x7, mid-ladder, then W e4)
  a b c d e      a b c d e         a b c d e                           a b c d e f g
5 . . . . .    5 . . . . .       5 . . . X X                         7 . . . . . . .
4 . . . . .    4 . . 1 . .       4 . . 1 . .                         6 . . . . . . .
3 . X O . .    3 . X O 2 3       3 . X . . 3                         5 . . . X O . .
2 . . X X .    2 . . X X .       2 . . X X .                         4 . . X O * . .   (* = White e4)
1 . . . . .    1 . . . . .       1 . . . . .                         3 . X O O X . .
 1 B c4  2 W d3  3 B e3  4 W d4  5 B d5  6 W e4  7 B e5              2 . . X X . . .
                                                                     1 . . . . . . .
```
Checked, move by move: B c4 leaves c3 with liberty d3 only; W d3 gives {c3,d3} liberties e3, d4 (b3 c2 c4 d2 Black);
B e3 leaves d4; W d4 gives {c3,d3,d4} liberties e4, d5 (c4 Black); B d5 leaves e4; W e4 gives liberty e5 only
(e3 Black); B e5 captures c3 d3 d4 e4. Every Black chaser keeps ≥ 1 liberty at the moment White moves (e3 has e2 and
e4; d5 has c5 and e5). Instead of c4, B d3 (atari) lets W c4: group {c3,c4} liberties b4, d4, c5 = 3. On 7×7 with a
White stone on e5: after B c4 W d3 B e3 W d4 B d5, White e4 joins e5: group c3 d3 d4 e4 e5 has liberties f4, f5, e6 = 3,
and the alternative atari B e4 (instead of d5) lets White d5 join e5 with ≥ 4 liberties.

| # | id | Type | Tests | Right answer (hand-checked; AC 21–24) |
|---|---|---|---|---|
| 1 | liberties-after | count (5×5) | B c4, W d3 extended: liberties of c3-d3 | 2 |
| 2 | first-atari | choice (2) | A=c4 or B=d3 as the first atari | A |
| 3 | chase-on | play-move atari (mirror L1, after 1 step) | next atari of the ladder | a3 or b4 |
| 4 | finish | play-move capture | capture the group at the edge | e5 |
| 5 | ladder-breaker | choice (2), 7×7 | White stone on e5 | "No, White escapes" |
| 6 | find-breaker | tap-point one, 7×7 | which stone helps White: f5 or b6 | f5 |
| 7 | corner-ladder | choice (2), 7×7 | L1 shifted to the top-right corner | "Yes, it captures" |

Exercise 3 uses the horizontal mirror of L1 (setup B d3 c2 b2 c4, W c3 b3, i.e. Black c4 and White b3 already
played): the white group b3-c3 has liberties a3 and b4; both ataris are mirrors of the checked L1 lines (d4 ↔ b4,
e3 ↔ a3) and end with a capture at the edge. Exercise 7 is L1 moved by +2 columns and +2 rows: its edges are the board edge of the 7×7, so the
checked sequence is identical (B e6, W f5, B g5, W f6, B f7, W g6, B g7 captures e5 f5 f6 g6).

```json
{
  "schema":1,"id":"u09-ladder","unit":9,"kind":"lesson","titleKey":"lesson.u09-ladder.title","coordinates":true,
  "explain":[
    {"board":{"size":5,"setup":{"B":["b3","c2","d2"],"W":["c3"]}},"moves":[{"color":"B","at":"c4"},{"color":"W","at":"d3"},{"color":"B","at":"e3"}],"highlights":[{"kind":"liberty","points":["c4","d3"]}],"textKey":"lesson.u09-ladder.s1"},
    {"moves":[{"color":"W","at":"d4"},{"color":"B","at":"d5"},{"color":"W","at":"e4"},{"color":"B","at":"e5"}],"textKey":"lesson.u09-ladder.s2"},
    {"board":{"size":7,"setup":{"B":["b3","c2","d2","c4","e3","d5"],"W":["c3","d3","d4","e5"]}},"moves":[{"color":"W","at":"e4"}],"markers":[{"kind":"triangle","at":"e5"}],"textKey":"lesson.u09-ladder.s3"}
  ],
  "exercises":[
    {"id":"liberties-after","type":"count","size":5,"setup":{"B":["b3","c2","d2","c4"],"W":["c3","d3"]},"answer":{"libertiesOf":"c3"},"promptKey":"lesson.u09-ladder.e1.prompt","hintKey":"lesson.u09-ladder.e1.hint","explainKey":"lesson.u09-ladder.e1.explain"},
    {"id":"first-atari","type":"choice","size":5,"setup":{"B":["b3","c2","d2"],"W":["c3"]},"options":[{"textKey":"lesson.u09-ladder.e2.o1","correct":true},{"textKey":"lesson.u09-ladder.e2.o2","whyKey":"lesson.u09-ladder.e2.w2"}],"markers":[{"kind":"label","at":"c4","text":"A"},{"kind":"label","at":"d3","text":"B"}],"promptKey":"lesson.u09-ladder.e2.prompt","explainKey":"lesson.u09-ladder.e2.explain"},
    {"id":"chase-on","type":"play-move","size":5,"setup":{"B":["d3","c2","b2","c4"],"W":["c3","b3"]},"toPlay":"B","goal":{"kind":"atari"},"promptKey":"lesson.u09-ladder.e3.prompt","hintKey":"lesson.u09-ladder.e3.hint","hintPoints":["a3","b4"],"explainKey":"lesson.u09-ladder.e3.explain"},
    {"id":"finish","type":"play-move","size":5,"setup":{"B":["b3","c2","d2","c4","e3","d5"],"W":["c3","d3","d4","e4"]},"toPlay":"B","goal":{"kind":"capture"},"promptKey":"lesson.u09-ladder.e4.prompt","hintKey":"lesson.u09-ladder.e4.hint","hintPoints":["e5"],"explainKey":"lesson.u09-ladder.e4.explain"},
    {"id":"ladder-breaker","type":"choice","size":7,"setup":{"B":["b3","c2","d2"],"W":["c3","e5"]},"options":[{"textKey":"lesson.u09-ladder.e5.o1","whyKey":"lesson.u09-ladder.e5.w1"},{"textKey":"lesson.u09-ladder.e5.o2","correct":true}],"promptKey":"lesson.u09-ladder.e5.prompt","explainKey":"lesson.u09-ladder.e5.explain"},
    {"id":"find-breaker","type":"tap-point","size":7,"setup":{"B":["b3","c2","d2"],"W":["c3","f5","b6"]},"mode":"one","answer":{"points":["f5"]},"promptKey":"lesson.u09-ladder.e6.prompt","hintKey":"lesson.u09-ladder.e6.hint","hintPoints":["f5"],"explainKey":"lesson.u09-ladder.e6.explain"},
    {"id":"corner-ladder","type":"choice","size":7,"setup":{"B":["d5","e4","f4"],"W":["e5"]},"options":[{"textKey":"lesson.u09-ladder.e7.o1","correct":true},{"textKey":"lesson.u09-ladder.e7.o2","whyKey":"lesson.u09-ladder.e7.w2"}],"promptKey":"lesson.u09-ladder.e7.prompt","explainKey":"lesson.u09-ladder.e7.explain"}
  ]
}
```
Notes: exercise 4 leaves Black e3 with one liberty (e2) after White's e4; that does not matter because Black captures
first. Exercise 6: with a stone on f5 the chase reaches W e4 (libs f4, e5), B f4, W e5 joins f5 (libs e6, f6, g5 = 3);
b6 touches nothing on the path. Exercise 5/7 prompts are written so that they say "keeps chasing", i.e. the claim
is about the staircase chase.

**Texts** (prefix `lesson.u09-ladder.`)

| Key | zh-CN | en | fr |
|---|---|---|---|
| title | 征子 | Ladder | L'échelle |
| s1 | 黑棋叫吃，白棋长出，黑棋再叫吃……这样一路追打叫征子。 | Black ataris, White extends, Black ataris again… Chasing like this is a ladder (征子 zhēngzi). | Les Noirs mettent en atari, les Blancs prolongent, les Noirs remettent en atari… Cette poursuite est une échelle (征子 zhēngzi). |
| s2 | 追到棋盘边，白棋无处可逃，黑棋提掉全部四颗白子。 | The chase ends at the edge: White has nowhere to run and Black captures all four stones. | La poursuite s'arrête au bord : les Blancs n'ont plus de place et les Noirs capturent les quatre pierres. |
| s3 | 前方如果有一颗白子，白棋长出就和它连上，有 3 口气，征子失败。 | If a white stone waits ahead, White's extension joins it. The group gets 3 liberties and the ladder fails. | Si une pierre blanche attend plus loin, la prolongation la rejoint : 3 libertés, et l'échelle échoue. |
| e1.prompt | 黑棋叫吃后，白棋长到 d3。这块白棋现在有几口气？ | Black ataried and White extended to d3. How many liberties does the white group have now? | Les Noirs ont mis en atari et les Blancs ont prolongé en d3. Combien de libertés a le groupe blanc ? |
| e1.hint | 数 c3、d3 周围的空点。 | Count the empty points next to c3 and d3. | Comptez les points vides autour de c3 et d3. |
| e1.explain | 只有 e3 和 d4 两口气：黑棋还能再叫吃。 | Only e3 and d4: Black can atari again. | Seulement e3 et d4 : les Noirs peuvent remettre en atari. |
| e2.prompt | 要把白棋一路追打，黑棋先叫吃在哪里？ | To chase the white stone in a ladder, where should Black atari first? | Pour poursuivre la pierre blanche en échelle, où les Noirs doivent-ils d'abord mettre en atari ? |
| e2.o1 | A | A | A |
| e2.o2 | B | B | B |
| e2.w2 | B 之后白棋长到 c4，有 3 口气，追不下去了。 | After B, White extends to c4 and has 3 liberties: the chase stops. | Après B, les Blancs prolongent en c4 et ont 3 libertés : la poursuite s'arrête. |
| e2.explain | A 把白棋赶向棋盘边，一路叫吃。 | A drives White toward the edge, atari after atari. | A pousse les Blancs vers le bord, atari après atari. |
| e3.prompt | 继续追：再叫吃一次。 | Keep chasing: put the white group in atari again. | Continuez la poursuite : remettez le groupe blanc en atari. |
| e3.hint | 白棋这块有两口气，下在其中一口。 | The white group has two liberties. Play on one of them. | Le groupe blanc a deux libertés. Jouez sur l'une d'elles. |
| e3.explain | 又叫吃了。白棋只能继续长，离边越来越近。 | Atari again. White must keep extending, closer to the edge. | Atari de nouveau. Les Blancs doivent continuer à prolonger, de plus en plus près du bord. |
| e4.prompt | 白棋逃到了边上。提掉整块白棋。 | White has run to the edge. Capture the whole white group. | Les Blancs ont fui jusqu'au bord. Capturez tout le groupe blanc. |
| e4.hint | 这块白棋只剩一口气。 | The white group has only one liberty. | Le groupe blanc n'a plus qu'une liberté. |
| e4.explain | e5 提走四颗白子：征子成功。 | e5 captures four stones: the ladder works. | e5 capture quatre pierres : l'échelle réussit. |
| e5.prompt | 黑棋 c4 叫吃，一路追打。能提掉白棋吗？ | Black ataris at c4 and keeps chasing. Will the ladder capture White? | Les Noirs mettent en atari en c4 et poursuivent. L'échelle va-t-elle capturer les Blancs ? |
| e5.o1 | 能提掉 | Yes, it captures | Oui, elle capture |
| e5.w1 | 白 e5 在前方等着：白棋长到 e4 就和它连上，有 3 口气。 | The white stone on e5 waits ahead: at e4 White joins it and has 3 liberties. | La pierre blanche e5 attend plus loin : en e4, les Blancs la rejoignent et ont 3 libertés. |
| e5.o2 | 不能，白棋逃脱 | No, White escapes | Non, les Blancs s'échappent |
| e5.explain | 前方的白子让征子失败了。 | The white stone ahead breaks the ladder. | La pierre blanche plus loin fait échouer l'échelle. |
| e6.prompt | 这个征子会失败。点出让白棋逃脱的那颗白子。 | This ladder will fail. Tap the white stone that lets White escape. | Cette échelle va échouer. Touchez la pierre blanche qui permet la fuite. |
| e6.hint | 看白棋逃跑的路线，哪颗白子在路上？ | Follow White's running path: which white stone is on it? | Suivez le chemin de fuite des Blancs : quelle pierre blanche s'y trouve ? |
| e6.explain | 白 f5 在路上：白棋长出后会连上它，征子失败。 | The white stone on f5 is on the path: White joins it and the ladder fails. | La pierre blanche f5 est sur le chemin : les Blancs la rejoignent et l'échelle échoue. |
| e7.prompt | 黑棋 e6 叫吃，一路追打。能提掉白棋吗？ | Black ataris at e6 and keeps chasing. Will the ladder capture White? | Les Noirs mettent en atari en e6 et poursuivent. L'échelle va-t-elle capturer les Blancs ? |
| e7.o1 | 能提掉 | Yes, it captures | Oui, elle capture |
| e7.o2 | 不能，白棋逃脱 | No, White escapes | Non, les Blancs s'échappent |
| e7.w2 | 前方没有白子接应：一路追到右上角，白棋没气了。 | Nothing waits ahead: the chase runs into the corner and White runs out of liberties. | Rien n'attend plus loin : la poursuite arrive au coin et les Blancs n'ont plus de libertés. |
| e7.explain | 征子追到边上，白棋被提。 | The ladder runs to the edge and White is captured. | L'échelle arrive au bord et les Blancs sont capturés. |

### 7.4 Unit 9 checkpoint — 综合复习（二）Review 2  (`src/lessons/content/u09-review.json`)
Checkpoint (`kind: "checkpoint"`, no steps). Unlocked by 1★ on `u09-ladder`; gates nothing. No new idea: two
exercises each for Units 7 and 8, one each for Units 3, 4, 5, and two for Unit 9.

| # | id | Type | Revisits | Right answer |
|---|---|---|---|---|
| 1 | r-forbidden | tap-point one | Unit 7 | b3 |
| 2 | r-capture-legal | choice (2) | Unit 7 | "Yes, it captures" |
| 3 | r-ko-retake | choice (2) (prelude, mirrored edge ko) | Unit 8 | "No, it is a ko" |
| 4 | r-count-group | count | Units 2–3 | 5 |
| 5 | r-atari | play-move atari | Unit 5 | d4 or e3 |
| 6 | r-capture | play-move capture | Unit 4 | b3 |
| 7 | r-ladder-first | choice (2) (mirror of u09 e2) | Unit 9 | A |
| 8 | r-ladder-breaker | choice (2), 7×7 (mirror of u09 e5) | Unit 9 | "No, White escapes" |

Checked: r1 — b3 neighbours a3 c3 b2 b4 White, each with spare liberties. r2 — Black a5 takes the last liberty of
White a4 (a3 b4 Black) and b5 (b4 c5 Black), captures 2. r3 — mirror image (a↔e, b↔d) of `u08-ko` e2; koPoint e3.
r4 — group c3-d3 has liberties b3 c2 d2 e3 d4 (c4 White). r5 — White d3 has liberties e3, d4 only. r6 — White b2 has
only b3. r7 — mirror of u09 e2 (A c4 works, B b3 lets White c4 reach b4 d4 c5). r8 — mirror of u09 e5 on 7×7
(x → 8 − x): the joining stone is c5, the group after White c4 has liberties b4, b5, c6 = 3 (corrected by the
developer: the hand check said d4, d5, c6).

```json
{
  "schema":1,"id":"u09-review","unit":9,"kind":"checkpoint","titleKey":"lesson.u09-review.title","coordinates":true,
  "exercises":[
    {"id":"r-forbidden","type":"tap-point","size":5,"setup":{"W":["b2","a3","c3","b4"]},"mode":"one","answer":{"points":["b3"]},"promptKey":"lesson.u09-review.e1.prompt","hintKey":"lesson.u09-review.e1.hint","hintPoints":["b3"],"explainKey":"lesson.u09-review.e1.explain"},
    {"id":"r-capture-legal","type":"choice","size":5,"setup":{"B":["a3","b4","c5"],"W":["a4","b5"]},"options":[{"textKey":"lesson.u09-review.e2.o1","correct":true},{"textKey":"lesson.u09-review.e2.o2","whyKey":"lesson.u09-review.e2.w2"}],"markers":[{"kind":"label","at":"a5","text":"A"}],"promptKey":"lesson.u09-review.e2.prompt","explainKey":"lesson.u09-review.e2.explain"},
    {"id":"r-ko-retake","type":"choice","size":5,"setup":{"B":["e2","e4"],"W":["e3","d2","d4","c3"]},"prelude":[{"color":"B","at":"d3"}],"options":[{"textKey":"lesson.u09-review.e3.o1","whyKey":"lesson.u09-review.e3.w1"},{"textKey":"lesson.u09-review.e3.o2","correct":true}],"markers":[{"kind":"triangle","at":"d3"},{"kind":"label","at":"e3","text":"A"}],"promptKey":"lesson.u09-review.e3.prompt","explainKey":"lesson.u09-review.e3.explain"},
    {"id":"r-count-group","type":"count","size":5,"setup":{"B":["c3","d3"],"W":["c4"]},"answer":{"libertiesOf":"c3"},"markers":[{"kind":"triangle","at":"c3"}],"promptKey":"lesson.u09-review.e4.prompt","hintKey":"lesson.u09-review.e4.hint"},
    {"id":"r-atari","type":"play-move","size":5,"setup":{"B":["c3","d2"],"W":["d3"]},"toPlay":"B","goal":{"kind":"atari"},"promptKey":"lesson.u09-review.e5.prompt","hintKey":"lesson.u09-review.e5.hint","hintPoints":["e3","d4"],"explainKey":"lesson.u09-review.e5.explain"},
    {"id":"r-capture","type":"play-move","size":5,"setup":{"B":["a2","b1","c2"],"W":["b2"]},"toPlay":"B","goal":{"kind":"capture"},"promptKey":"lesson.u09-review.e6.prompt","hintKey":"lesson.u09-review.e6.hint","hintPoints":["b3"],"explainKey":"lesson.u09-review.e6.explain"},
    {"id":"r-ladder-first","type":"choice","size":5,"setup":{"B":["d3","c2","b2"],"W":["c3"]},"options":[{"textKey":"lesson.u09-review.e7.o1","correct":true},{"textKey":"lesson.u09-review.e7.o2","whyKey":"lesson.u09-review.e7.w2"}],"markers":[{"kind":"label","at":"c4","text":"A"},{"kind":"label","at":"b3","text":"B"}],"promptKey":"lesson.u09-review.e7.prompt","explainKey":"lesson.u09-review.e7.explain"},
    {"id":"r-ladder-breaker","type":"choice","size":7,"setup":{"B":["f3","e2","d2"],"W":["e3","c5"]},"options":[{"textKey":"lesson.u09-review.e8.o1","whyKey":"lesson.u09-review.e8.w1"},{"textKey":"lesson.u09-review.e8.o2","correct":true}],"promptKey":"lesson.u09-review.e8.prompt","explainKey":"lesson.u09-review.e8.explain"}
  ]
}
```

**Texts** (prefix `lesson.u09-review.`)

| Key | zh-CN | en | fr |
|---|---|---|---|
| title | 综合复习（二） | Review 2 | Révision 2 |
| e1.prompt | 轮到黑棋。点出黑棋不能下的点。 | Black to play. Tap the point where Black may not play. | Aux Noirs. Touchez le point où les Noirs ne peuvent pas jouer. |
| e1.hint | 找一个四周都是白子的空点。 | Look for an empty point with a white stone on every side. | Cherchez un point vide entouré de pierres blanches. |
| e1.explain | b3 四面是白子，黑棋下进去没有气。 | b3 is surrounded by White: a black stone there would have no liberty. | b3 est entouré de pierres blanches : une pierre noire n'y aurait pas de liberté. |
| e2.prompt | 黑棋可以下在 A 吗？ | Can Black play on A? | Les Noirs peuvent-ils jouer en A ? |
| e2.o1 | 可以，能提子 | Yes, it captures | Oui, cela capture |
| e2.o2 | 不可以，没有气 | No, it has no liberty | Non, aucune liberté |
| e2.w2 | a5 填掉 a4 和 b5 的最后一口气，两颗白子被提走。 | a5 takes the last liberty of a4 and b5: both white stones are captured. | a5 prend la dernière liberté de a4 et de b5 : les deux pierres blanches sont capturées. |
| e2.explain | 能提子的着法不算禁入。 | A move that captures is not forbidden. | Un coup qui capture n'est pas interdit. |
| e3.prompt | 黑棋刚下 d3 提子。白棋现在可以下 A 吗？ | Black just captured by playing d3. May White play on A right now? | Les Noirs viennent de capturer en d3. Les Blancs peuvent-ils jouer en A maintenant ? |
| e3.o1 | 可以 | Yes | Oui |
| e3.w1 | A 会提掉 d3，使局面回到黑棋下之前的样子，打劫规则不允许。 | A would capture d3 and bring back the position from before Black's move. Ko forbids that. | A capturerait d3 et rétablirait la position d'avant le coup noir. Le ko l'interdit. |
| e3.o2 | 不可以，这是劫 | No, it is a ko | Non, c'est un ko |
| e3.explain | 要先在别处下一手，才能提回 e3。 | White must play elsewhere first, then may retake on e3. | Les Blancs doivent d'abord jouer ailleurs, puis ils pourront reprendre en e3. |
| e4.prompt | 标记的黑棋这一块有几口气？ | How many liberties does the marked black group have? | Combien de libertés a le groupe noir marqué ? |
| e4.hint | 两颗黑子共用气，每个空点只数一次。 | The two stones share liberties; count each empty point once. | Les deux pierres partagent leurs libertés ; comptez chaque point vide une fois. |
| e5.prompt | 让白子叫吃。 | Put the white stone in atari. | Mettez la pierre blanche en atari. |
| e5.hint | 白子有两口气，填掉其中一口。 | It has two liberties. Fill one of them. | Elle a deux libertés. Remplissez-en une. |
| e5.explain | 白子只剩一口气，下一手就能被提走。 | The stone has one liberty left and can be captured next. | Il ne reste qu'une liberté : la pierre peut être capturée au prochain coup. |
| e6.prompt | 提走白子。 | Capture the white stone. | Capturez la pierre blanche. |
| e6.hint | 它还剩哪一口气？ | Which liberty does it have left? | Quelle liberté lui reste-t-il ? |
| e6.explain | 白子的最后一口气 b3 被填上，白子被提。 | Black fills b3, the last liberty, and the white stone is captured. | Les Noirs remplissent b3, la dernière liberté, et la pierre blanche est capturée. |
| e7.prompt | 要把白棋一路追打，黑棋先叫吃在哪里？ | To chase the white stone in a ladder, where should Black atari first? | Pour poursuivre la pierre blanche en échelle, où les Noirs doivent-ils d'abord mettre en atari ? |
| e7.o1 | A | A | A |
| e7.o2 | B | B | B |
| e7.w2 | B 之后白棋长到 c4，有 3 口气，追不下去了。 | After B, White extends to c4 and has 3 liberties: the chase stops. | Après B, les Blancs prolongent en c4 et ont 3 libertés : la poursuite s'arrête. |
| e7.explain | A 把白棋赶向棋盘边，一路叫吃。 | A drives White toward the edge, atari after atari. | A pousse les Blancs vers le bord, atari après atari. |
| e8.prompt | 黑棋 e4 叫吃，一路追打。能提掉白棋吗？ | Black ataris at e4 and keeps chasing. Will the ladder capture White? | Les Noirs mettent en atari en e4 et poursuivent. L'échelle va-t-elle capturer les Blancs ? |
| e8.o1 | 能提掉 | Yes, it captures | Oui, elle capture |
| e8.w1 | 白 c5 在前方等着：白棋长到 c4 就和它连上，有 3 口气。 | The white stone on c5 waits ahead: at c4 White joins it and has 3 liberties. | La pierre blanche c5 attend plus loin : en c4, les Blancs la rejoignent et ont 3 libertés. |
| e8.o2 | 不能，白棋逃脱 | No, White escapes | Non, les Blancs s'échappent |
| e8.explain | 前方的白子让征子失败了。 | The white stone ahead breaks the ladder. | La pierre blanche plus loin fait échouer l'échelle. |

Map titles (new keys): `unit.7.title` zh 禁入点 / en "Forbidden points · 禁入点 jìnrùdiǎn" / fr "Points interdits · 禁入点
jìnrùdiǎn"; `unit.8.title` 打劫 / "Ko · 打劫 dǎjié" / "Ko · 打劫 dǎjié"; `unit.9.title` 征子 / "Ladder · 征子 zhēngzi" /
"L'échelle · 征子 zhēngzi"; `unit.10.title` (planned, "coming soon") 眼 / "Eyes · 眼 yǎn" / "Les yeux · 眼 yǎn".

## 8. Terms and pinyin (first use)
zh-CN texts never show pinyin (as in M4). en and fr show it in the first text that uses the term:

| Term | pinyin | First text | Meaning |
|---|---|---|---|
| 禁入点 | jìnrùdiǎn | `u07-forbidden.s1` (also `engine.illegal.suicide`) | forbidden point |
| 打劫 | dǎjié | `u08-ko.s2` (also `engine.illegal.ko`) | ko |
| 劫材 | jiécái | `u08-ko.s3` | ko threat |
| 征子 | zhēngzi | `u09-ladder.s1` | ladder |

"Ladder breaker" has no Chinese term in the texts (the zh-CN text just says "前方的白子"); introducing a sixth term
for one sentence would add load. 枷 jiā (net) is **not** introduced in this item.

## 9. Framework gaps
1. **`prelude` (needed, small).** `PositionDef.setup` can only place stones, so an exercise cannot start with a ko
   ban in force, and the engine would let White retake. Fix: optional `ExerciseBase.prelude: MoveDef[]` (§5, AC 9–14).
   Alternatives rejected: a `koPoint` field in `setup` (a ko ban that no history explains would be a lie and could
   not be validated); drawing a ko lesson with choice questions only (the learner could never *try* the move, the best
   teacher).
2. **No machine proof of "White cannot escape".** The validator proves legality and one-move goals. Ladder claims
   are verified by replaying fixed lines (AC 21–24) and optionally by a test-only search (AC 25). A shipped solver
   belongs to the tsumego item.
3. **Generic wrong-move text for `play-move` with `point` goals** ("That is not the point asked for") is weak. This
   content avoids `point` goals: it uses `capture`, `atari` and `choice` with a reason per wrong option.
4. **Explanation markers last the whole step**, so the ko cross is placed in its own step (S2) that continues from the
   previous end position (no `board`), after the capture has been played.
5. Not a gap: tapping occupied points in `tap-point` (u09 e6) works since M3 §12; `label` markers on empty points
   are used by M4.

## 10. Correctness check (done by the designer)
Done **by hand**; no code could be run in this session (no shell tool), so the real validator and engine have not
yet confirmed anything. For every position: neighbours are orthogonal only; no group without a liberty at the start
(except where a prelude/move creates it by capturing); stated liberties counted point by point; the answer is
legal; for each `play-move` I listed all moves that meet the goal (solution sets in §7); for each `tap-point` I
checked that no other empty point meets the condition; for each `choice` I checked the truth of the correct option
and of the reason in each wrong option. Ko: the engine marks `koPoint` only when exactly one stone is captured and
the capturing stone is alone with exactly one liberty (`src/engine/play.ts`); all ko positions satisfy it (KO-A,
KO-edge, mirror), and e4 deliberately does not (the capturing group has 4 liberties). The ladder lines were
replayed move by move (§7.3). Tricky ones: Unit 7 e3 and Unit 8 s1 share the shape "Black c3 captures c4 and is left
with one liberty"; in Unit 7 that is only a legal capture, in Unit 8 it is a ko. `u09-ladder` e4 leaves Black e3
in atari after White e4 (harmless, Black captures first). **Please let QA run AC 15–25 before development is
declared done; if any one fails, the position (not the test) is wrong.**

## 11. Out of scope
Net (枷) and double atari / snapback; a real ko fight (multiple threats, ko value, superko — the engine has simple
ko only); the `sequence` runner (Option B) and SGF import; life and death; 9×9 and larger boards; any new colour,
sound or art; settings (pinyin toggle, mute) → M6; resume mid-set; random order; changes to M4 content (the M4 note
that texts name points like d3 although coordinates are off is raised as decision 5, no M4 file is touched).

## 12. Open decisions for the product owner (with my default)
1. **Ladders: Option A (build the light `sequence` runner now) or Option B (one-move exercises + animations)?**
   Default: **B**. The mockup (section B) shows what A would look like; if you pick A the developer also builds
   §13 and the spec is re-issued with AC 42 expanded.
2. **Nets (枷 jiā, written 枪 in the curriculum).** Default: **defer the net to a later lesson** (needs a search
   helper so that its claims are machine-proven) and keep Unit 9 = ladder. Alternatives: (b) build the helper in this
   item and add a net lesson (more scope and I would still have to author and prove the position); (c) replace the
   net by **double atari 双叫吃 shuāng jiàochī**, which is one move, fully hand-verifiable, and teaches a technique
   beginners use at once (I can add it as `u09b` with 5–6 exercises). Please also confirm that the correct term is
   枷 and that `docs/CURRICULUM.md` row 9 may be reworded.
3. **Ko threat.** Default: **light version** (S3, e6, e7). Alternative: defer it entirely (Unit 8 = 2 steps, 5
   exercises).
4. **`prelude` field** (§9) — approve this small addition to the lesson format. Default: yes; without it Unit 8
   cannot have an honest ko exercise.
5. **Coordinates on** (letters and numbers on the board) for Units 7–9 and the review, because the texts name points
   (c3, e1, f6). Default: yes (`"coordinates": true`). Note for later: M4 units 2–5 also name points while coordinates
   are off; consider turning them on there.
6. **One checkpoint** (`u09-review`, 8 exercises) after Unit 9 instead of one per unit. Default: yes (as M4).
7. **Wording.** Confirm the Chinese terms 禁入点, 打劫, 劫材, 征子 and the French "échelle", "menace de ko", "point
   interdit". Default: as written.
8. **"Show me" replay after a ladder yes/no answer** (a small button that replays the chase). Default: no; the
   explanation steps already have *Replay*, and a new button is new UI.
9. **Map:** Unit 10 appears as "coming soon" (replacing Unit 7 in that role). Default: yes.

## 12a. PO decisions (2026-10-20)
All §12 defaults accepted by the product owner:
1. Ladders: **Option B** (one-move exercises + animated explanation). No `sequence` runner in this item; §13 stays for later.
2. Nets: **deferred**; Unit 9 is ladders only. Term corrected to 枷 jiā (reword `CURRICULUM.md` row 9).
3. Ko threat: **light version** (step 3, exercises e6/e7).
4–9. `prelude` field approved; coordinates on for Units 7–9 + review; one checkpoint `u09-review`; terms as in §8; no "Show me" button; Unit 10 "coming soon".
10. AC 39 (2026-10-20): 7×7 boards with coordinates have 41 px cells at 360 px (u07 e6, u08 e6, u09 e6). PO: **keep 41 px for now** (same as u01-board); revisit after the iPhone check.

## 12b. Developer engine check (2026-10-20)
Every position of §7 was replayed with the real engine and validator (`__tests__/m5-units-7-9.test.ts`):
all four files validate, every "Right answer" matches `getSolution`, every legality / ko / suicide claim and every
ladder line of AC 15–24 holds. The test-only search (AC 25) proves u09 e2 (A), e3 (a3 and b4), e7 and review e7
within 12 plies; a 7×7 ladder that runs to the far edge (u09 e6 without f5) needs 16 plies. One text correction,
no JSON change: review e8's group after White c4 has liberties **b4, b5, c6** (not d4, d5, c6; AC 23 and §7.4).

## 13. Appendix — what Option A would add (only if chosen)
Exercise type (sketch, schema version 1 additive):
```json
{"id":"ladder-play","type":"sequence","size":5,"setup":{"B":["b3","c2","d2"],"W":["c3"]},"toPlay":"B",
 "target":"c3","opponent":"extend","line":["c4","d3","e3","d4","d5","e4","e5"],
 "promptKey":"…","hintKey":"…","explainKey":"…"}
```
`opponent: "extend"` = White always plays on the only liberty of the group in atari. A Black move is accepted if,
against that reply, a bounded search proves the target is captured; the first wrong move gets the fact "White now has
N liberties". Planned exercises: `ladder-play` (above, replaces e3 + e4), `ladder-play-corner` (L1 shifted +2/+2 on
7×7, replaces e7), and a third at the end of the review (mirror). Everything else in this spec is unchanged.
