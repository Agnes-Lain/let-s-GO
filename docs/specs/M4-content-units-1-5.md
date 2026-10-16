# M4 — Units 1–5 content (zh-CN + en + fr)

Covers the first M4 roadmap item only. The beginner bot and the Capture Go mini-game (Unit 6) are a
separate later PR. Visual mockup for approval: `docs/specs/M4-mockup.html`.
Status: **draft for product-owner approval** (no code written). Builds on `docs/specs/M3-lesson-framework.md`.

## 0. In plain words (for the product owner)
- M4 turns the empty map into a real course: **Units 1–5**, each a 3–4 slide explanation plus 7–8
  small exercises, in 中文, English and Français. After Unit 5 there is a short **review set**.
- No new screens and no new kinds of exercise. Everything runs on the M3 machine; only the map
  changes a little (Units 1–5 become playable, Unit 6 stays "coming soon", the sample lesson stays
  hidden in the public app).
- **Every exercise was checked twice**: by hand (the positions are tiny) and by the real validator and
  rules engine, which proved each one can be solved and listed every correct answer (§10).
- Two small map follow-ups from M3 are answered with a proposal: the French "Bientôt disponible" badge
  moves **under** the title, and Chinese unit titles stay **without pinyin** (§5).
- Questions for you are collected at the end (§12).

## 1. Goal
A beginner who finishes Units 1–5 can place stones, count liberties (气 qì), recognise a group, capture
stones, and put a stone in atari (叫吃 jiàochī) or save one — in zh-CN, en or fr — ready for Capture Go.

## 2. User stories
- As a beginner, I want Unit 1 to show me where stones go (the crossings) and who plays first, so that I
  can start a game without fear of "doing it wrong".
- As a beginner, I want each unit to teach exactly one idea with a tiny board, so that I understand it in
  under two minutes.
- As a beginner, I want the first exercise of each unit to be almost impossible to miss, and the last to
  need real thought, so that I feel progress without frustration.
- As a beginner, I want every Go word shown with its pinyin the first time (in English and French), so that
  I can learn the Chinese terms as I go.
- As a Chinese-reading learner, I want unit titles and lessons in clean hanzi without pinyin clutter.
- As a French- or English-speaking learner, I want long titles and the "coming soon" badge to be readable on
  a 360 px phone.
- As a returning learner, I want a short review after Unit 5 that mixes what I learned, so that I know I am
  ready for the first game.
- As the product owner, I want the course to unlock one unit at a time with 1 star, so that nobody skips ahead.

## 3. Scope and curriculum mapping
| Unit | Lesson id | Steps | Exercises | Source (`docs/CURRICULUM.md`) |
|---|---|---|---|---|
| 1 棋盘与棋子 | `u01-board` | 3 | 7 | tap the correct point; place stones at named points |
| 2 气 | `u02-liberties` | 4 | 8 | count liberties; tap all liberties |
| 3 连接 | `u03-connection` | 3 | 7 | one group or two; connect two stones |
| 4 提子 | `u04-capture` | 4 | 8 | capture in one move; find the capturing point |
| 5 叫吃与逃跑 | `u05-atari` | 4 | 8 | escape atari; put the opponent in atari |
| 5 checkpoint | `u05-review` (`kind: checkpoint`) | 0 | 8 | mixes Units 2–5 |

Total: 18 explanation steps, 46 exercises. Types used: tap-point, play-move, choice, count (no new type).
Board sizes: 5×5 almost everywhere; 7×7 in 7 exercises (finding things among distractors); no 9×9 yet.

Deviations from `CURRICULUM.md` (small, on purpose):
- **Unit 2 counts liberties of single stones only.** "Group" is taught in Unit 3, so counting a group's
  liberties is the Unit 3 count exercise and the review (otherwise Unit 2 would use an idea it has not
  taught). 
- **One checkpoint, after Unit 5**, not one per unit (decision 3 in §12). Units 1–4 end with their practice set.
- The word **atari is not used in Unit 4** ("one liberty left" instead); it is introduced in Unit 5.

## 4. Acceptance criteria
Board coordinates: letter = column (a–e, no "i"), number = row, row 1 at the bottom. "Content test" means
the existing `src/lessons/content.test.ts` (validator with the real texts + length limits).

**A. Files and validity**
1. Given the repo after M4, then `src/lessons/content/` has exactly `u00-sample.json` plus `u01-board.json`,
   `u02-liberties.json`, `u03-connection.json`, `u04-capture.json`, `u05-atari.json`, `u05-review.json`,
   each named after its `id`, and all are in `LESSON_FILES` in `registry.ts`.
2. When the content test runs, then every file passes `validateLesson` with `hasText` over zh-CN, en and fr, and
   `validateCatalog` returns `{ ok: true }` (one lesson per unit 1–5, one checkpoint for unit 5).
3. Then the step and exercise counts are exactly those of §3 (3/4/3/4/4 steps; 7/8/7/8/8/8 exercises) and the
   exercise ids are those of §7.
4. Then `getSolution` of every exercise returns exactly the solution in the tables of §7 (QA turns the 46
   rows into one parametrised test; play-move solution sets are compared as sets).
5. Then every text key used by the six lessons (`titleKey`, `textKey`, `promptKey`, `hintKey`, `explainKey`,
   options' `textKey`/`whyKey`) exists in zh-CN, en and fr and is within the length limits (zh-CN ≤ 70,
   en/fr ≤ 160 characters). Texts for steps are ≤ 135 characters in en/fr so that they fit the 4-line card
   on a 360 px phone (checked in AC 22).
6. Then the i18n parity test still passes (identical key sets), and no key from M3 is removed.

**B. Text rules**
7. Then no zh-CN lesson text contains pinyin (no letters with tone marks), and en and fr texts introduce each new term
   with its pinyin on first use in the lesson, as listed in §8.
8. Then `u01-board` has `coordinates: true`, and the other five lessons have no `coordinates` (or false).
9. Then every `tap-point`, `play-move` and `count` exercise has a `hintKey`, and every exercise has either a
   `hintKey` or an `explainKey` (the 9 choice exercises without a hint have an `explainKey` and a `whyKey` on each
   wrong option). `hintPoints`, where present, are among the solution points.

**C. Playing through (engine + stores, no UI)**
10. Given a fresh progress store, when the learner finishes `u01-board` with every exercise `clean`, then it
    stores 3★ and `u02-liberties` becomes unlocked (same for 2→3, 3→4, 4→5, and for `u05-review` becoming
    unlocked after `u05-atari`).
11. Given any of the six lessons and N exercises, when `computeStars` runs with the thresholds of §6, then
    N = 7: 6 clean → 3★; 5 clean + 2 solved → 2★; 4 solved + 3 revealed → 1★; 3 solved → 0★. N = 8: 7 clean → 3★;
    6 clean + 2 solved → 2★; 4 solved + 4 revealed → 1★; 3 solved → 0★.
12. Given a play-move exercise, when the learner plays a legal move that is not a solution, then the feedback
    message is the M3 key for the goal (`fb.pm.wrongPoint` for `point`, `fb.pm.noCapture` or
    `fb.pm.captureTooFew` for `capture`, `fb.pm.noAtari`, `fb.pm.notConnected`, `fb.pm.stillAtari`), and
    `fb.pm.selfAtari` is appended when the move leaves the player's own stone with one liberty.

**D. Unit map**
13. Given production mode (`includeDev: false`), then `getUnits()` returns units 1–5 with `lesson !== null`,
    unit 5 with a `checkpoint`, and unit 6 with `lesson: null`; `PLANNED_UNITS` is `[6]`; units 7–16 are not listed.
14. Given a fresh install, then the map rows are: Unit 1 `available`, Units 2–5 `locked`, Unit 5 checkpoint
    `locked`, Unit 6 `soon`, and *Continue* opens `/lesson/u01-board`.
15. Given 1★ on Unit N (N = 1…4), then Unit N+1 is `available`; given 0★, it stays `locked`; given 1★ on
    Unit 5, then the Unit 5 checkpoint is `available` and Unit 6 stays `soon`. The checkpoint never gates anything.
16. Given production mode, then the dev sample (`u00-sample`) is not on the map and `loadLesson('u00-sample')` is
    `not-found`; given `__DEV__` or `EXPO_PUBLIC_DEV_LESSONS=1`, then it is shown first and does not gate Unit 1.
17. Given all of Units 1–5 and the checkpoint have ≥ 1★, then *Continue* is hidden and `home.allDone` is shown.
18. Given the result screen of `u05-atari` with ≥ 1★, then the primary button is *Next lesson* → `u05-review`;
    given the result of `u05-review`, then the primary button is *Back to map* (Unit 6 is not playable).

**E. Layout (web check at 360×740, fr and zh-CN and en)**
19. Given language fr and Unit 6 "soon", then the badge "Bientôt disponible" is on its own line **under** the
    title, the title is fully visible (up to two lines), and the card grows in height instead of clipping text.
20. Given language fr, when the map shows "Atari et fuite · 叫吃 jiàochī", then nothing is cut off and nothing
    scrolls horizontally; the same for en "Board & stones · 棋盘 qípán".
21. Given language zh-CN, then unit titles are hanzi only (`unit.N.title` unchanged: 棋盘与棋子, 气, 连接, 提子, 叫吃与逃跑,
    吃子棋) and the checkpoint row reads 综合复习.
22. Given each lesson's longest step text in each language, then the text card shows all of it without ellipsis
    (screenshot per lesson under `docs/screenshots/M4/`).
23. Given the choice exercises with labels on stones (`u02-liberties` #5, `u03-connection` #3), then the labels
    are readable on black stones (light text) and on white stones (dark text).

## 5. Unit map and UI changes
Everything else in M3 §6 is unchanged. Mockup: `docs/specs/M4-mockup.html`, section A.

**Changes (developer notes)**
- `registry.ts`: add the six imports to `LESSON_FILES`. `loader.ts`: `PLANNED_UNITS = [6]`.
- `unit.1.title` … `unit.6.title` exist already (M3 §7.1) and are kept. New texts: `lesson.<id>.…` keys of §7
  (lesson title keys give the checkpoint row its name: "Review / 综合复习 / Révision").
- Tests that assumed units 1–6 are all "coming soon" (map and loader tests, QA's M3 tests) are updated; the
  sample stays in `LESSON_FILES`, hidden in production.
- Row layout (decision 1): in a "coming soon" row the badge is no longer on the right; it sits under the
  title on its own line. The card has `minHeight: 72` instead of a fixed height so a two-line title fits.

**Decision 1 — fr "Bientôt disponible" squeezes titles.** Proposal: badge under the title, text unchanged,
title may wrap to two lines. Why: it fixes every language and every future long title; shortening to
"Bientôt" would fix only the one string and would still squeeze "Jeu de capture · 吃子棋 chīzǐqí" next to a
chevron. Only Unit 6 (and later planned units) show the badge, so the map stays calm.

**Decision 2 — pinyin on zh-CN unit titles.** Proposal: **no pinyin** in zh-CN titles or lesson texts. Readers of
Chinese read the hanzi; the pinyin hints exist for en/fr learners, who keep "Liberties · 气 qì". If the PO wants
pinyin for learners of Chinese who use the zh-CN interface, it would be a setting later (M6), not clutter in the
titles.

## 6. Game design notes
**Curve per lesson** (M3 §5.4): exercise 1 almost certain; 2–3 one small twist; 4–5 the real test; the last
the same concept in a new shape. Distractor positions (a stone that looks capturable but is not, a diagonal
"connection", a decoy stone with two liberties) appear from exercise 4 on, never first. 7×7 boards appear only
in exercises that ask "find it" among several stones.

**Length**: 3–4 steps (~20 s each) + 7–8 exercises (~25 s each) ≈ 3 minutes per unit.

**Star thresholds**: keep the M3 constants (`STAR_RULES = 0.8 / 0.8 / 0.5`, one place in `stars.ts`).

| Set size | 3★ needs | 2★ needs | 1★ needs (unlocks next unit) |
|---|---|---|---|
| 7 exercises (Units 1, 3) | ≥ 6 first-try | ≥ 6 solved | ≥ 4 solved |
| 8 exercises (Units 2, 4, 5, review) | ≥ 7 first-try | ≥ 7 solved | ≥ 4 solved |

A learner who gets only half right still opens the next unit. Sets of 7–8 mean one slip still gives 3★ at
7 exercises but not at 8; if testers find 8 too strict, lower `threeClean` to 0.75 (one constant).

**Hint policy** (unchanged): Hint button always visible (costs first-try); opens by itself after the 2nd
mistake; answer shown after the 3rd (choice with 2 options: after 1; with 3: after 2). Choice exercises have no
pulse; their `whyKey` text is the hint. Every wrong choice option has a `whyKey` that states a fact.

**Feedback / reward**: as M3 (stone "tock", capture fade, green ring, stars one by one).

**Order inside a unit**: steps follow strict "see → name → vary" (a plain position, the rule named, then an
edge/corner or a trap). Exercises are authored in the fixed order of §7; no shuffling in M4.

## 7. Content (lesson JSON + texts)
Schema: `src/lessons/schema.ts` (schema 1). Texts live in `src/i18n/{zh-CN,en,fr}.json` under the keys shown
(prefix `lesson.<id>.`). `s<n>` = explanation step, `e<n>.prompt/hint/explain` = exercise texts, `e<n>.o<k>` /
`e<n>.w<k>` = option text / reason. `lesson.<id>.title` is the lesson title.

### 7.1 Unit 1 — 棋盘与棋子 Board and stones  (`src/lessons/content/u01-board.json`)

Concept: stones go on crossings; Black first; alternate; stones do not move. `coordinates: true` (letters/numbers drawn on every board of this lesson). Steps: 3. Exercises: 7.

| # | id | Type | Tests | Right answer (engine-verified) |
|---|---|---|---|---|
| 1 | tap-marked | tap-point one | find a crossing | d2 (triangle) |
| 2 | tap-named | tap-point one | read coordinates | c4 |
| 3 | play-black | play-move point | place a stone by name | d2 |
| 4 | whose-turn | choice (3) | alternation | White |
| 5 | play-white | play-move point, White | place a white stone | b3 |
| 6 | stones-stay | choice (3) | stones never move | "It stays on c3" |
| 7 | tap-whites | tap-point all, 7×7 | tell colours apart | d4, b2, f6 |

Correctness: no stone in this unit has zero liberties; no capture can occur (every setup stone keeps its liberties).

```json
{
  "schema":1,"id":"u01-board","unit":1,"kind":"lesson","titleKey":"lesson.u01-board.title","coordinates":true,
  "explain": [
    {"board":{"size":5,"setup":{}},"markers":[{"kind":"circle","at":"c3"}],"textKey":"lesson.u01-board.s1"},
    {"moves":[{"color":"B","at":"c3"},{"color":"W","at":"d3"},{"color":"B","at":"c2"}],"textKey":"lesson.u01-board.s2"},
    {"moves":[{"color":"W","at":"b3"}],"markers":[{"kind":"triangle","at":"c3"}],"textKey":"lesson.u01-board.s3"}
  ],
  "exercises": [
    {"id":"tap-marked","type":"tap-point","size":5,"setup":{},"mode":"one","answer":{"points":["d2"]},"markers":[{"kind":"triangle","at":"d2"}],"promptKey":"lesson.u01-board.e1.prompt","hintKey":"lesson.u01-board.e1.hint","hintPoints":["d2"]},
    {"id":"tap-named","type":"tap-point","size":5,"setup":{},"mode":"one","answer":{"points":["c4"]},"promptKey":"lesson.u01-board.e2.prompt","hintKey":"lesson.u01-board.e2.hint","hintPoints":["c4"]},
    {"id":"play-black","type":"play-move","size":5,"setup":{},"toPlay":"B","goal":{"kind":"point","points":["d2"]},"promptKey":"lesson.u01-board.e3.prompt","hintKey":"lesson.u01-board.e3.hint","hintPoints":["d2"]},
    {"id":"whose-turn","type":"choice","size":5,"setup":{"B":["c3"]},"options":[{"textKey":"lesson.u01-board.e4.o1","correct":true},{"textKey":"lesson.u01-board.e4.o2","whyKey":"lesson.u01-board.e4.w2"},{"textKey":"lesson.u01-board.e4.o3","whyKey":"lesson.u01-board.e4.w3"}],"promptKey":"lesson.u01-board.e4.prompt","explainKey":"lesson.u01-board.e4.explain"},
    {"id":"play-white","type":"play-move","size":5,"setup":{"B":["c3"]},"toPlay":"W","goal":{"kind":"point","points":["b3"]},"promptKey":"lesson.u01-board.e5.prompt","hintKey":"lesson.u01-board.e5.hint","hintPoints":["b3"]},
    {"id":"stones-stay","type":"choice","size":5,"setup":{"B":["c3"],"W":["d3"]},"options":[{"textKey":"lesson.u01-board.e6.o1","correct":true},{"textKey":"lesson.u01-board.e6.o2","whyKey":"lesson.u01-board.e6.w2"},{"textKey":"lesson.u01-board.e6.o3","whyKey":"lesson.u01-board.e6.w3"}],"promptKey":"lesson.u01-board.e6.prompt","explainKey":"lesson.u01-board.e6.explain"},
    {"id":"tap-whites","type":"tap-point","size":7,"setup":{"B":["c3","e5","f2"],"W":["d4","b2","f6"]},"mode":"all","answer":{"points":["d4","b2","f6"]},"promptKey":"lesson.u01-board.e7.prompt","hintKey":"lesson.u01-board.e7.hint"}
  ]
}
```

**Texts**

| Key (after `lesson.u01-board.`) | zh-CN | en | fr |
|---|---|---|---|
| title | 棋盘与棋子 | Board and stones | Plateau et pierres |
| s1 | 围棋下在线与线的交叉点上，不是格子里。字母表示列，数字表示行：c3 就是 c 列第 3 行。 | Stones go on the crossing points (交叉点 jiāochādiǎn) of the board (棋盘 qípán), not in squares. Letters = columns, numbers = rows: c3. | Les pierres vont sur les intersections (交叉点 jiāochādiǎn) du plateau (棋盘 qípán), pas dans les cases. Lettre = colonne, chiffre = ligne. |
| s2 | 先下的是黑棋，然后白棋，双方轮流，每次下一子。 | Black (黑 hēi) always plays first, then White (白 bái). The players take turns, one stone each time. | Les Noirs (黑 hēi) jouent toujours en premier, puis les Blancs (白 bái). On joue chacun son tour, une pierre à la fois. |
| s3 | 棋子一旦落下就不会移动，要一直留在原处，直到被提走（以后会学）。 | A stone (棋子 qízǐ) never moves once it is placed. It stays there until it is captured, which you will learn soon. | Une pierre (棋子 qízǐ) ne bouge plus une fois posée. Elle reste là jusqu'à sa capture, que vous apprendrez bientôt. |
| e1.prompt | 点一下三角形标出的交叉点。 | Tap the crossing marked with a triangle. | Touchez l'intersection marquée d'un triangle. |
| e1.hint | 要点在线与线相交的地方。 | Tap exactly where two lines cross. | Touchez là où deux lignes se croisent. |
| e2.prompt | 点一下 c4。 | Tap the point c4. | Touchez le point c4. |
| e2.hint | c 是第三列（从左数），4 是第四行（从下数）。 | c is the third column from the left, 4 the fourth row from the bottom. | c est la troisième colonne depuis la gauche, 4 la quatrième ligne depuis le bas. |
| e3.prompt | 轮到黑棋。把黑子下在 d2。 | Black plays first. Place a black stone on d2. | Les Noirs jouent en premier. Posez une pierre noire en d2. |
| e3.hint | d 列，第 2 行。 | Column d, row 2. | Colonne d, ligne 2. |
| e4.o1 | 白棋 | White | Les Blancs |
| e4.o2 | 黑棋 | Black | Les Noirs |
| e4.w2 | 黑棋刚下过，要轮流。 | Black just played; the turn passes. | Les Noirs viennent de jouer ; le tour passe. |
| e4.o3 | 谁都可以 | Either one | L'un ou l'autre |
| e4.w3 | 不是谁都可以，要轮流。 | No: the players must alternate. | Non : on doit alterner. |
| e4.prompt | 黑棋刚下了一子。现在轮到谁？ | Black has just played. Whose turn is it now? | Les Noirs viennent de jouer. À qui le tour ? |
| e4.explain | 双方轮流下棋，所以黑棋之后是白棋。 | The players alternate, so White follows Black. | On joue à tour de rôle : les Blancs suivent les Noirs. |
| e5.prompt | 轮到白棋。把白子下在 b3。 | It is White's turn. Place a white stone on b3. | C'est aux Blancs. Posez une pierre blanche en b3. |
| e5.hint | b 列，第 3 行，在黑子左边。 | Column b, row 3, just left of the black stone. | Colonne b, ligne 3, juste à gauche de la pierre noire. |
| e6.o1 | 它一直留在 c3 | It stays on c3 | Elle reste en c3 |
| e6.o2 | 每回合可以走一步 | It may move one step per turn | Elle peut avancer d'un pas par tour |
| e6.w2 | 棋子落下后不能移动。 | A stone cannot move after it is placed. | Une pierre ne peut plus bouger une fois posée. |
| e6.o3 | 它可以被拿回去 | It can be taken back | On peut la reprendre |
| e6.w3 | 不能把已下的子拿回去。 | You cannot take a placed stone back. | On ne reprend pas une pierre posée. |
| e6.prompt | 黑子在 c3。之后棋局继续，它会怎样？ | The black stone is on c3. As the game goes on, what happens to it? | La pierre noire est en c3. Que lui arrive-t-il pendant la partie ? |
| e6.explain | 落下的棋子不会移动，它一直留在 c3。 | A placed stone does not move; it stays on c3. | Une pierre posée ne bouge pas ; elle reste en c3. |
| e7.prompt | 点出所有白子，然后按“确认”。 | Tap all the white stones, then press Check. | Touchez toutes les pierres blanches, puis appuyez sur Vérifier. |
| e7.hint | 白子是浅色的，共三颗。 | White stones are the light ones; there are three. | Les pierres blanches sont les claires ; il y en a trois. |

### 7.2 Unit 2 — 气 Liberties  (`src/lessons/content/u02-liberties.json`)

Concept: liberties = empty orthogonal neighbours; fewer on edges/corners; enemy stones remove them; diagonals never count. Single stones only (group counting is Unit 3, see §2 deviation). Steps: 4. Exercises: 8.

| # | id | Type | Tests | Right answer (engine-verified) |
|---|---|---|---|---|
| 1 | tap-center | tap-point all | all 4 liberties of B d3 | c3, d2, d4, e3 |
| 2 | count-edge | count | edge stone B e3 | 3 |
| 3 | tap-corner | tap-point all | corner stone B a1 | a2, b1 |
| 4 | count-enemy | count | B c3, W c4 + b3 | 2 (c2, d3) |
| 5 | fewest | choice (3), 7×7, labels on stones | compare 4 / 3 / 2 liberties | C (g1 corner) |
| 6 | last-liberty | tap-point one | B c3 with W c4, b3, d3 | c2 |
| 7 | take-liberty | play-move point, White | fill a liberty of B c3 (W c4 present) | c2, b3 or d3 |
| 8 | count-diagonal | count | B c3, W b2 + d4 diagonal | 4 |

```json
{
  "schema":1,"id":"u02-liberties","unit":2,"kind":"lesson","titleKey":"lesson.u02-liberties.title",
  "explain": [
    {"board":{"size":5,"setup":{"B":["c3"]}},"highlights":[{"kind":"liberty","points":["c2","c4","b3","d3"]}],"textKey":"lesson.u02-liberties.s1"},
    {"board":{"size":5,"setup":{"B":["a3"]}},"highlights":[{"kind":"liberty","points":["a2","a4","b3"]}],"textKey":"lesson.u02-liberties.s2"},
    {"board":{"size":5,"setup":{"B":["a1"]}},"highlights":[{"kind":"liberty","points":["a2","b1"]}],"markers":[{"kind":"cross","at":"b2"}],"textKey":"lesson.u02-liberties.s3"},
    {"board":{"size":5,"setup":{"B":["c3"]}},"moves":[{"color":"W","at":"c4"}],"highlights":[{"kind":"liberty","points":["c2","c4","b3","d3"]}],"textKey":"lesson.u02-liberties.s4"}
  ],
  "exercises": [
    {"id":"tap-center","type":"tap-point","size":5,"setup":{"B":["d3"]},"mode":"all","answer":{"libertiesOf":"d3"},"promptKey":"lesson.u02-liberties.e1.prompt","hintKey":"lesson.u02-liberties.e1.hint"},
    {"id":"count-edge","type":"count","size":5,"setup":{"B":["e3"]},"answer":{"libertiesOf":"e3"},"promptKey":"lesson.u02-liberties.e2.prompt","hintKey":"lesson.u02-liberties.e2.hint"},
    {"id":"tap-corner","type":"tap-point","size":5,"setup":{"B":["a1"]},"mode":"all","answer":{"libertiesOf":"a1"},"promptKey":"lesson.u02-liberties.e3.prompt","hintKey":"lesson.u02-liberties.e3.hint"},
    {"id":"count-enemy","type":"count","size":5,"setup":{"B":["c3"],"W":["c4","b3"]},"answer":{"libertiesOf":"c3"},"promptKey":"lesson.u02-liberties.e4.prompt","hintKey":"lesson.u02-liberties.e4.hint"},
    {"id":"fewest","type":"choice","size":7,"setup":{"B":["c5","a3","g1"]},"options":[{"textKey":"lesson.u02-liberties.e5.o1","whyKey":"lesson.u02-liberties.e5.w1"},{"textKey":"lesson.u02-liberties.e5.o2","whyKey":"lesson.u02-liberties.e5.w2"},{"textKey":"lesson.u02-liberties.e5.o3","correct":true}],"markers":[{"kind":"label","at":"c5","text":"A"},{"kind":"label","at":"a3","text":"B"},{"kind":"label","at":"g1","text":"C"}],"promptKey":"lesson.u02-liberties.e5.prompt","explainKey":"lesson.u02-liberties.e5.explain"},
    {"id":"last-liberty","type":"tap-point","size":5,"setup":{"B":["c3"],"W":["c4","b3","d3"]},"mode":"one","answer":{"points":["c2"]},"promptKey":"lesson.u02-liberties.e6.prompt","hintKey":"lesson.u02-liberties.e6.hint","hintPoints":["c2"]},
    {"id":"take-liberty","type":"play-move","size":5,"setup":{"B":["c3"],"W":["c4"]},"toPlay":"W","goal":{"kind":"point","points":["c2","b3","d3"]},"promptKey":"lesson.u02-liberties.e7.prompt","hintKey":"lesson.u02-liberties.e7.hint","hintPoints":["c2","b3","d3"]},
    {"id":"count-diagonal","type":"count","size":5,"setup":{"B":["c3"],"W":["b2","d4"]},"answer":{"libertiesOf":"c3"},"promptKey":"lesson.u02-liberties.e8.prompt","hintKey":"lesson.u02-liberties.e8.hint","explainKey":"lesson.u02-liberties.e8.explain"}
  ]
}
```

**Texts**

| Key (after `lesson.u02-liberties.`) | zh-CN | en | fr |
|---|---|---|---|
| title | 气 | Liberties | Libertés |
| s1 | 棋子上下左右紧挨着的空点叫“气”。这颗黑子有 4 口气。 | The empty points right next to a stone (up, down, left, right) are its liberties (气 qì). This stone has 4. | Les points vides juste à côté d'une pierre (haut, bas, gauche, droite) sont ses libertés (气 qì). Cette pierre en a 4. |
| s2 | 在边上少一个邻点，只有 3 口气。 | On an edge there is one neighbour less: only 3 liberties. | Sur un bord il y a un voisin de moins : seulement 3 libertés. |
| s3 | 在角上只有 2 口气。斜角的点（打叉）不算气。 | In a corner there are only 2. Diagonal points (crossed) never count. | Dans un coin, seulement 2. Les points en diagonale (barrés) ne comptent jamais. |
| s4 | 对方的棋子会占掉一口气：白子下在 c4，黑子只剩 3 口气。 | An enemy stone takes a liberty away: after White plays c4, this stone has only 3. | Une pierre adverse enlève une liberté : après c4 des Blancs, cette pierre n'en a plus que 3. |
| e1.prompt | 点出黑子所有的气，然后按“确认”。 | Tap all the liberties of the black stone, then press Check. | Touchez toutes les libertés de la pierre noire, puis Vérifier. |
| e1.hint | 数上、下、左、右四个点。 | Look at the four points: up, down, left, right. | Regardez les quatre points : haut, bas, gauche, droite. |
| e2.prompt | 这颗黑子有几口气？ | How many liberties does the black stone have? | Combien de libertés a la pierre noire ? |
| e2.hint | 它在边上，少一个邻点。 | It is on the edge, so it has one neighbour less. | Elle est sur le bord : un voisin de moins. |
| e3.prompt | 点出角上黑子所有的气，然后按“确认”。 | Tap all the liberties of the corner stone, then press Check. | Touchez toutes les libertés de la pierre du coin, puis Vérifier. |
| e3.hint | 斜角的点不是气。 | The diagonal point is not a liberty. | Le point en diagonale n'est pas une liberté. |
| e4.prompt | 这颗黑子还剩几口气？ | How many liberties does the black stone have left? | Combien de libertés reste-t-il à la pierre noire ? |
| e4.hint | 只数空着的邻点，白子占着的不算。 | Count only empty neighbours; points with a white stone do not count. | Ne comptez que les voisins vides ; les points occupés par une pierre blanche ne comptent pas. |
| e5.o1 | A | A | A |
| e5.w1 | A 在中间，有 4 口气。 | A is in the open: 4 liberties. | A est au large : 4 libertés. |
| e5.o2 | B | B | B |
| e5.w2 | B 在边上，有 3 口气。 | B is on an edge: 3 liberties. | B est sur un bord : 3 libertés. |
| e5.o3 | C | C | C |
| e5.prompt | 哪颗黑子的气最少？ | Which black stone has the fewest liberties? | Quelle pierre noire a le moins de libertés ? |
| e5.explain | A 有 4 口气，B 有 3 口，C 在角上只有 2 口。 | A has 4 liberties, B has 3, and C in the corner has only 2. | A a 4 libertés, B en a 3, et C, dans le coin, n'en a que 2. |
| e6.prompt | 点出黑子仅剩的那口气。 | Tap the last liberty of the black stone. | Touchez la dernière liberté de la pierre noire. |
| e6.hint | 三个邻点被白子占了，只剩一个空点。 | Three neighbours hold white stones; one is empty. | Trois voisins portent des pierres blanches ; un seul est vide. |
| e7.prompt | 轮到白棋。在黑子旁边下一子，占掉它的一口气。 | White to play. Place a stone next to the black stone to take one of its liberties. | Aux Blancs. Posez une pierre à côté de la pierre noire pour lui enlever une liberté. |
| e7.hint | 选黑子上、下、左、右的空点。 | Choose an empty point up, down, left or right of it. | Choisissez un point vide en haut, bas, gauche ou droite. |
| e8.prompt | 这颗黑子有几口气？ | How many liberties does the black stone have? | Combien de libertés a la pierre noire ? |
| e8.hint | 斜角的白子不占气。 | Diagonal white stones take no liberty. | Les pierres blanches en diagonale n'enlèvent rien. |
| e8.explain | 斜角的棋子不影响气，所以仍是 4 口气。 | Diagonal stones do not matter, so it still has 4 liberties. | Les diagonales ne comptent pas : il reste 4 libertés. |

### 7.3 Unit 3 — 连接 Connection  (`src/lessons/content/u03-connection.json`)

Concept: orthogonally adjacent stones form one group and share liberties; diagonals do not connect; a move can connect. Steps: 3. Exercises: 7.

| # | id | Type | Tests | Right answer (engine-verified) |
|---|---|---|---|---|
| 1 | one-or-two-a | choice (2) | vertical pair | One group |
| 2 | one-or-two-b | choice (2) | diagonal pair c2, d3 | Two groups |
| 3 | which-pair | choice (3), 7×7 | A gap (b6, d6), B diagonal (b3, c2), C adjacent (f5, f4) | Pair C |
| 4 | count-group | count | B c3 d3, W c4: c2, b3, d2, d4, e3 | 5 |
| 5 | connect-gap | play-move connect | B c2 / c4, W b3 / d3 | c3 (only move) |
| 6 | connect-diagonal | play-move connect | B b2 / c3, W c2 | b3 (only move; c2 is taken) |
| 7 | tap-group | tap-point all | group of marked c3 = c3, c2, d2; b4 is only diagonal | c3, c2, d2 |

```json
{
  "schema":1,"id":"u03-connection","unit":3,"kind":"lesson","titleKey":"lesson.u03-connection.title",
  "explain": [
    {"board":{"size":5,"setup":{"B":["c3","d3"]}},"highlights":[{"kind":"liberty","points":["c2","c4","b3","d2","d4","e3"]}],"textKey":"lesson.u03-connection.s1"},
    {"board":{"size":5,"setup":{"B":["c3","d4"]}},"highlights":[{"kind":"hint","points":["c4","d3"]}],"textKey":"lesson.u03-connection.s2"},
    {"moves":[{"color":"B","at":"d3"}],"textKey":"lesson.u03-connection.s3"}
  ],
  "exercises": [
    {"id":"one-or-two-a","type":"choice","size":5,"setup":{"B":["b2","b3"]},"options":[{"textKey":"lesson.u03-connection.e1.o1","correct":true},{"textKey":"lesson.u03-connection.e1.o2","whyKey":"lesson.u03-connection.e1.w2"}],"promptKey":"lesson.u03-connection.e1.prompt","explainKey":"lesson.u03-connection.e1.explain"},
    {"id":"one-or-two-b","type":"choice","size":5,"setup":{"B":["c2","d3"]},"options":[{"textKey":"lesson.u03-connection.e2.o1","whyKey":"lesson.u03-connection.e2.w1"},{"textKey":"lesson.u03-connection.e2.o2","correct":true}],"promptKey":"lesson.u03-connection.e2.prompt","explainKey":"lesson.u03-connection.e2.explain"},
    {"id":"which-pair","type":"choice","size":7,"setup":{"B":["b6","d6","b3","c2","f5","f4"]},"options":[{"textKey":"lesson.u03-connection.e3.o1","whyKey":"lesson.u03-connection.e3.w1"},{"textKey":"lesson.u03-connection.e3.o2","whyKey":"lesson.u03-connection.e3.w2"},{"textKey":"lesson.u03-connection.e3.o3","correct":true}],"markers":[{"kind":"label","at":"b6","text":"A"},{"kind":"label","at":"b3","text":"B"},{"kind":"label","at":"f5","text":"C"}],"promptKey":"lesson.u03-connection.e3.prompt","hintKey":"lesson.u03-connection.e3.hint","explainKey":"lesson.u03-connection.e3.explain"},
    {"id":"count-group","type":"count","size":5,"setup":{"B":["c3","d3"],"W":["c4"]},"answer":{"libertiesOf":"c3"},"markers":[{"kind":"triangle","at":"c3"}],"promptKey":"lesson.u03-connection.e4.prompt","hintKey":"lesson.u03-connection.e4.hint","explainKey":"lesson.u03-connection.e4.explain"},
    {"id":"connect-gap","type":"play-move","size":5,"setup":{"B":["c2","c4"],"W":["b3","d3"]},"toPlay":"B","goal":{"kind":"connect","a":"c2","b":"c4"},"promptKey":"lesson.u03-connection.e5.prompt","hintKey":"lesson.u03-connection.e5.hint","hintPoints":["c3"],"explainKey":"lesson.u03-connection.e5.explain"},
    {"id":"connect-diagonal","type":"play-move","size":5,"setup":{"B":["b2","c3"],"W":["c2"]},"toPlay":"B","goal":{"kind":"connect","a":"b2","b":"c3"},"promptKey":"lesson.u03-connection.e6.prompt","hintKey":"lesson.u03-connection.e6.hint","hintPoints":["b3"]},
    {"id":"tap-group","type":"tap-point","size":5,"setup":{"B":["c3","c2","d2","b4"],"W":["d3","b3"]},"mode":"all","answer":{"points":["c3","c2","d2"]},"markers":[{"kind":"triangle","at":"c3"}],"promptKey":"lesson.u03-connection.e7.prompt","hintKey":"lesson.u03-connection.e7.hint","explainKey":"lesson.u03-connection.e7.explain"}
  ]
}
```

**Texts**

| Key (after `lesson.u03-connection.`) | zh-CN | en | fr |
|---|---|---|---|
| title | 连接 | Connection | Connexion |
| s1 | 上下左右相邻的棋子相连，成为一块棋。它们共用气：这里共有 6 口。 | Stones touching up, down, left or right are connected (连接 liánjiē): one group (一块棋 yíkuàiqí) sharing its liberties, 6 here. | Des pierres voisines (haut, bas, gauche, droite) sont connectées (连接 liánjiē) : un groupe (一块棋 yíkuàiqí) aux libertés communes, 6 ici. |
| s2 | 斜角相邻不算连接：这是两颗独立的棋子，各有 4 口气。 | Diagonal neighbours are not connected: these are two separate stones, with 4 liberties each. | Deux pierres en diagonale ne sont pas connectées : ce sont deux pierres séparées, avec 4 libertés chacune. |
| s3 | 在 d3 落子，两颗棋子就连成了一块。 | Play on d3 and the two stones become one group. | Jouez en d3 et les deux pierres forment un seul groupe. |
| e1.o1 | 一块 | One group | Un groupe |
| e1.o2 | 两块 | Two groups | Deux groupes |
| e1.w2 | 它们紧挨着，已经相连了。 | They touch, so they are already connected. | Elles se touchent : elles sont déjà connectées. |
| e1.prompt | 这两颗黑子是一块棋，还是两块？ | Are these two black stones one group or two? | Ces deux pierres noires forment-elles un groupe ou deux ? |
| e1.explain | 它们上下相邻，所以是一块棋。 | They touch top to bottom, so they are one group. | Elles se touchent de haut en bas : un seul groupe. |
| e2.o1 | 一块 | One group | Un groupe |
| e2.w1 | 斜角相邻不算相连。 | Diagonal contact is not a connection. | Le contact en diagonale n'est pas une connexion. |
| e2.o2 | 两块 | Two groups | Deux groupes |
| e2.prompt | 这两颗黑子是一块棋，还是两块？ | Are these two black stones one group or two? | Ces deux pierres noires forment-elles un groupe ou deux ? |
| e2.explain | 它们只在斜角相碰，所以是两块。 | They only touch diagonally, so they are two groups. | Elles ne se touchent qu'en diagonale : deux groupes. |
| e3.o1 | A 对 | Pair A | Paire A |
| e3.w1 | A 中间隔着一个空点。 | Pair A has an empty point between its stones. | La paire A a un point vide entre ses pierres. |
| e3.o2 | B 对 | Pair B | Paire B |
| e3.w2 | B 只在斜角相碰。 | Pair B touches only diagonally. | La paire B se touche seulement en diagonale. |
| e3.o3 | C 对 | Pair C | Paire C |
| e3.prompt | 哪一对黑子是一块棋？ | Which pair of black stones is one group? | Quelle paire de pierres noires forme un groupe ? |
| e3.hint | 看哪两颗上下或左右紧挨着。 | Look for the two that touch side to side or top to bottom. | Cherchez les deux qui se touchent côte à côte ou l'une au-dessus de l'autre. |
| e3.explain | 只有 C 这一对上下相邻。 | Only pair C touches top to bottom. | Seule la paire C se touche. |
| e4.prompt | 标记的黑棋这一块共有几口气？ | How many liberties does the marked black group have? | Combien de libertés a le groupe noir marqué ? |
| e4.hint | 数两颗黑子旁边的空点，每个点只数一次。 | Count the empty points touching either stone, each only once. | Comptez les points vides touchant l'une ou l'autre pierre, une seule fois chacun. |
| e4.explain | 连接的棋子共用气，所以数整块的气：5 口。 | Connected stones share liberties, so count the whole group: 5. | Des pierres connectées partagent leurs libertés : on compte tout le groupe, soit 5. |
| e5.prompt | 轮到黑棋。把两颗黑子连成一块。 | Black to play. Connect the two black stones into one group. | Aux Noirs. Connectez les deux pierres noires en un groupe. |
| e5.hint | 哪个点同时挨着两颗黑子？ | Which point touches both black stones? | Quel point touche les deux pierres noires ? |
| e5.explain | c3 同时挨着两颗黑子，连成了一块。 | c3 touches both stones, so they became one group. | c3 touche les deux pierres : elles forment un groupe. |
| e6.prompt | 轮到黑棋。把两颗斜角的黑子连起来。 | Black to play. Connect the two diagonal black stones. | Aux Noirs. Connectez les deux pierres noires en diagonale. |
| e6.hint | c2 已被白子占了，试试另一个共同的邻点。 | c2 is taken by White; try the other point that touches both. | c2 est pris par les Blancs ; essayez l'autre point qui touche les deux. |
| e7.prompt | 点出与标记黑子在同一块的所有黑子，然后按“确认”。 | Tap every black stone in the same group as the marked stone, then press Check. | Touchez toutes les pierres noires du même groupe que la pierre marquée, puis Vérifier. |
| e7.hint | 只沿上下左右走，不要走斜线。 | Follow only up, down, left, right; never diagonals. | Suivez seulement haut, bas, gauche, droite ; jamais les diagonales. |
| e7.explain | b4 只在斜角碰到 c3，不属于这一块。 | b4 touches c3 only diagonally, so it is not in the group. | b4 ne touche c3 qu'en diagonale : il n'est pas dans le groupe. |

### 7.4 Unit 4 — 提子 Capture  (`src/lessons/content/u04-capture.json`)

Concept: a group with no liberties is captured and removed (one stone, edge/corner, whole group). The word atari is NOT used here (Unit 5). Steps: 4. Exercises: 8.

| # | id | Type | Tests | Right answer (engine-verified) |
|---|---|---|---|---|
| 1 | capture-one | play-move capture | W b3 with B b2, b4, c3 | a3 |
| 2 | capture-edge | play-move capture | W c1 with B b1, d1 | c2 |
| 3 | capture-corner | play-move capture | W a1, B b1 | a2 |
| 4 | capture-or-not | choice (2) | B plays a3 vs W b3 (c3 still empty) | "No, it still has a liberty" |
| 5 | capture-group | play-move capture, min 2 | W b2 b3 enclosed except c3 | c3 |
| 6 | tap-capture | tap-point one | W c4 (1 liberty) vs decoy corner W e1 (2 liberties) | c3 |
| 7 | find-capture | play-move capture, 7×7 | W d4 (1 liberty) vs decoy W b6 (3) | d5 |
| 8 | count-captured | count | W group d2 d3 d4, last liberty e3 (label A) | 3 |

```json
{
  "schema":1,"id":"u04-capture","unit":4,"kind":"lesson","titleKey":"lesson.u04-capture.title",
  "explain": [
    {"board":{"size":5,"setup":{"B":["c2","b3","d3"],"W":["c3"]}},"highlights":[{"kind":"liberty","points":["c4"]}],"textKey":"lesson.u04-capture.s1"},
    {"moves":[{"color":"B","at":"c4"}],"textKey":"lesson.u04-capture.s2"},
    {"board":{"size":5,"setup":{"B":["b1"],"W":["a1"]}},"moves":[{"color":"B","at":"a2"}],"textKey":"lesson.u04-capture.s3"},
    {"board":{"size":5,"setup":{"B":["b2","b3","d2","d3","c1"],"W":["c2","c3"]}},"moves":[{"color":"B","at":"c4"}],"textKey":"lesson.u04-capture.s4"}
  ],
  "exercises": [
    {"id":"capture-one","type":"play-move","size":5,"setup":{"B":["b2","b4","c3"],"W":["b3"]},"toPlay":"B","goal":{"kind":"capture"},"promptKey":"lesson.u04-capture.e1.prompt","hintKey":"lesson.u04-capture.e1.hint","hintPoints":["a3"],"explainKey":"lesson.u04-capture.e1.explain"},
    {"id":"capture-edge","type":"play-move","size":5,"setup":{"B":["b1","d1"],"W":["c1"]},"toPlay":"B","goal":{"kind":"capture"},"promptKey":"lesson.u04-capture.e2.prompt","hintKey":"lesson.u04-capture.e2.hint","hintPoints":["c2"]},
    {"id":"capture-corner","type":"play-move","size":5,"setup":{"B":["b1"],"W":["a1"]},"toPlay":"B","goal":{"kind":"capture"},"promptKey":"lesson.u04-capture.e3.prompt","hintKey":"lesson.u04-capture.e3.hint","hintPoints":["a2"]},
    {"id":"capture-or-not","type":"choice","size":5,"setup":{"B":["b2","b4"],"W":["b3"]},"options":[{"textKey":"lesson.u04-capture.e4.o1","whyKey":"lesson.u04-capture.e4.w1"},{"textKey":"lesson.u04-capture.e4.o2","correct":true}],"markers":[{"kind":"label","at":"a3","text":"A"}],"promptKey":"lesson.u04-capture.e4.prompt","explainKey":"lesson.u04-capture.e4.explain"},
    {"id":"capture-group","type":"play-move","size":5,"setup":{"B":["a2","a3","b1","b4","c2"],"W":["b2","b3"]},"toPlay":"B","goal":{"kind":"capture","min":2},"promptKey":"lesson.u04-capture.e5.prompt","hintKey":"lesson.u04-capture.e5.hint","hintPoints":["c3"],"explainKey":"lesson.u04-capture.e5.explain"},
    {"id":"tap-capture","type":"tap-point","size":5,"setup":{"B":["b4","d4","c5"],"W":["c4","e1"]},"mode":"one","answer":{"points":["c3"]},"promptKey":"lesson.u04-capture.e6.prompt","hintKey":"lesson.u04-capture.e6.hint","hintPoints":["c3"],"explainKey":"lesson.u04-capture.e6.explain"},
    {"id":"find-capture","type":"play-move","size":7,"setup":{"B":["c4","e4","d3","b5"],"W":["d4","b6"]},"toPlay":"B","goal":{"kind":"capture"},"promptKey":"lesson.u04-capture.e7.prompt","hintKey":"lesson.u04-capture.e7.hint","hintPoints":["d5"],"explainKey":"lesson.u04-capture.e7.explain"},
    {"id":"count-captured","type":"count","size":5,"setup":{"B":["c2","c3","c4","d1","d5","e2","e4"],"W":["d2","d3","d4"]},"answer":3,"markers":[{"kind":"label","at":"e3","text":"A"}],"promptKey":"lesson.u04-capture.e8.prompt","hintKey":"lesson.u04-capture.e8.hint","explainKey":"lesson.u04-capture.e8.explain"}
  ]
}
```

**Texts**

| Key (after `lesson.u04-capture.`) | zh-CN | en | fr |
|---|---|---|---|
| title | 提子 | Capture | Capture |
| s1 | 这颗白子只剩 1 口气，在 c4。 | This white stone has just one liberty left, on c4. | Cette pierre blanche n'a plus qu'une liberté, en c4. |
| s2 | 黑棋填上最后一口气。没有气的棋子会被提走。 | Black fills the last liberty. A stone with no liberties is captured (提子 tízǐ) and removed from the board. | Les Noirs remplissent la dernière liberté. Une pierre sans liberté est capturée (提子 tízǐ) et retirée du plateau. |
| s3 | 在角上更容易：只要 2 颗黑子就能提走白子。 | In a corner it is easier: two black stones are enough. | Dans un coin c'est plus facile : deux pierres noires suffisent. |
| s4 | 一块棋被提时，整块棋一起被提走，不管有几颗。 | When a group is captured, all its stones come off together, however many there are. | Quand un groupe est capturé, toutes ses pierres partent ensemble, quel qu'en soit le nombre. |
| e1.prompt | 提走这颗白子。 | Capture the white stone. | Capturez la pierre blanche. |
| e1.hint | 它只剩一口气，把它填上。 | It has one liberty left. Fill it. | Il lui reste une liberté. Remplissez-la. |
| e1.explain | 白子没有气了，所以被提走。 | The stone had no liberties left, so it was captured. | La pierre n'avait plus de liberté : elle est capturée. |
| e2.prompt | 提走边上的这颗白子。 | Capture the white stone on the edge. | Capturez la pierre blanche du bord. |
| e2.hint | c1 左右已有黑子，只剩上面一个点。 | Black is already left and right of c1; only the point above is open. | Les Noirs sont déjà à gauche et à droite de c1 ; seul le point au-dessus est libre. |
| e3.prompt | 提走角上的这颗白子。 | Capture the white stone in the corner. | Capturez la pierre blanche du coin. |
| e3.hint | 角上的棋子只有两口气，已经被占了一口。 | A corner stone has two liberties; one is already taken. | Une pierre de coin a deux libertés ; une est déjà prise. |
| e4.o1 | 被提走了 | Yes, it is captured | Oui, elle est capturée |
| e4.w1 | 白子在 c3 还有一口气。 | The white stone still has a liberty on c3. | La pierre blanche a encore une liberté en c3. |
| e4.o2 | 没有，还有一口气 | No, it still has a liberty | Non, elle a encore une liberté |
| e4.prompt | 黑棋下在 A，白子被提走了吗？ | Black plays on A. Is the white stone captured? | Les Noirs jouent en A. La pierre blanche est-elle capturée ? |
| e4.explain | c3 还是空的，白子仍有一口气，没有被提走。 | c3 is still empty, so the white stone keeps one liberty and is not captured. | c3 est encore vide : la pierre garde une liberté et n'est pas capturée. |
| e5.prompt | 一次提走两颗白子。 | Capture both white stones with one move. | Capturez les deux pierres blanches d'un coup. |
| e5.hint | 两颗白子连在一起，共用的最后一口气在哪？ | The two white stones are one group. Where is its last liberty? | Les deux pierres blanches forment un groupe. Où est sa dernière liberté ? |
| e5.explain | 填上共用的最后一口气，整块白棋一起被提走。 | Filling the shared last liberty captured the whole group. | La dernière liberté commune remplie, tout le groupe est capturé. |
| e6.prompt | 点出黑棋可以提子的那个点。 | Tap the point where Black can capture a stone. | Touchez le point où les Noirs peuvent capturer une pierre. |
| e6.hint | 找出只剩一口气的白子。 | Find the white stone with only one liberty. | Trouvez la pierre blanche qui n'a qu'une liberté. |
| e6.explain | 角上的白子还有两口气，c4 的白子只剩 c3。 | The corner stone has two liberties; the stone on c4 has only c3. | La pierre du coin a deux libertés ; celle de c4 n'a plus que c3. |
| e7.prompt | 找到能提子的一手，黑棋先走。 | Black to play. Find the move that captures. | Aux Noirs. Trouvez le coup qui capture. |
| e7.hint | 哪颗白子只剩一口气？ | Which white stone has only one liberty? | Quelle pierre blanche n'a qu'une liberté ? |
| e7.explain | d5 是 d4 的最后一口气，b6 还有 3 口气。 | d5 was the last liberty of d4; b6 still has 3. | d5 était la dernière liberté de d4 ; b6 en garde 3. |
| e8.prompt | 黑棋下在 A，会提走几颗白子？ | Black plays on A. How many white stones are captured? | Les Noirs jouent en A. Combien de pierres blanches sont capturées ? |
| e8.hint | 白棋这一块的最后一口气就是 A。 | A is the last liberty of the whole white group. | A est la dernière liberté de tout le groupe blanc. |
| e8.explain | 三颗白子连成一块，A 是它们的最后一口气。 | The three white stones are one group and A is its last liberty. | Les trois pierres blanches forment un groupe et A est sa dernière liberté. |

### 7.5 Unit 5 — 叫吃与逃跑 Atari and escape  (`src/lessons/content/u05-atari.json`)

Concept: atari = one liberty left; escape by extending (长 zhǎng) or by capturing the attacker; always count liberties after extending. Steps: 4. Exercises: 8.

| # | id | Type | Tests | Right answer (engine-verified) |
|---|---|---|---|---|
| 1 | make-atari | play-move atari | W c3, B c2 b3 (liberties c4, d3) | c4 or d3 |
| 2 | which-atari | choice (3), 7×7 | A has 2 liberties, B has 1 | B |
| 3 | last-liberty-b | tap-point one | B d3 with W c3 e3 d4 | d2 |
| 4 | escape-extend | play-move save | B c3, W c4 b3 d3 | c2 (group then has 3 liberties) |
| 5 | escape-edge | play-move save | B a3, W a2 b3 | a4 (2 liberties) |
| 6 | escape-trap | choice (2) | extend at c4 between W b4 / d4 | "No, still one liberty" (c5) |
| 7 | atari-group | play-move atari | W b1 c1 with B d1, b2 (liberties a1, c2) | a1 or c2 |
| 8 | rescue-capture | play-move capture | B c3 in atari; W d3 has only e3 | e3 |

```json
{
  "schema":1,"id":"u05-atari","unit":5,"kind":"lesson","titleKey":"lesson.u05-atari.title",
  "explain": [
    {"board":{"size":5,"setup":{"B":["c2","b3"],"W":["c3"]}},"moves":[{"color":"B","at":"d3"}],"highlights":[{"kind":"liberty","points":["c4","d3"]}],"textKey":"lesson.u05-atari.s1"},
    {"board":{"size":5,"setup":{"B":["c3"],"W":["c2","b3","d3"]}},"moves":[{"color":"B","at":"c4"}],"highlights":[{"kind":"liberty","points":["c4"]}],"textKey":"lesson.u05-atari.s2"},
    {"board":{"size":5,"setup":{"B":["c3"],"W":["c2","b3","d3","b4","d4"]}},"moves":[{"color":"B","at":"c4"}],"textKey":"lesson.u05-atari.s3"},
    {"board":{"size":5,"setup":{"B":["c3","b2","b4"],"W":["b3","c2","d3"]}},"moves":[{"color":"B","at":"a3"}],"highlights":[{"kind":"hint","points":["a3"]}],"textKey":"lesson.u05-atari.s4"}
  ],
  "exercises": [
    {"id":"make-atari","type":"play-move","size":5,"setup":{"B":["c2","b3"],"W":["c3"]},"toPlay":"B","goal":{"kind":"atari"},"promptKey":"lesson.u05-atari.e1.prompt","hintKey":"lesson.u05-atari.e1.hint","hintPoints":["c4","d3"],"explainKey":"lesson.u05-atari.e1.explain"},
    {"id":"which-atari","type":"choice","size":7,"setup":{"B":["a5","b6","d3","f3","e2"],"W":["b5","e3"]},"options":[{"textKey":"lesson.u05-atari.e2.o1","whyKey":"lesson.u05-atari.e2.w1"},{"textKey":"lesson.u05-atari.e2.o2","correct":true},{"textKey":"lesson.u05-atari.e2.o3","whyKey":"lesson.u05-atari.e2.w3"}],"markers":[{"kind":"label","at":"b5","text":"A"},{"kind":"label","at":"e3","text":"B"}],"promptKey":"lesson.u05-atari.e2.prompt","explainKey":"lesson.u05-atari.e2.explain"},
    {"id":"last-liberty-b","type":"tap-point","size":5,"setup":{"B":["d3"],"W":["c3","e3","d4"]},"mode":"one","answer":{"points":["d2"]},"promptKey":"lesson.u05-atari.e3.prompt","hintKey":"lesson.u05-atari.e3.hint","hintPoints":["d2"]},
    {"id":"escape-extend","type":"play-move","size":5,"setup":{"B":["c3"],"W":["c4","b3","d3"]},"toPlay":"B","goal":{"kind":"save","target":"c3"},"promptKey":"lesson.u05-atari.e4.prompt","hintKey":"lesson.u05-atari.e4.hint","hintPoints":["c2"],"explainKey":"lesson.u05-atari.e4.explain"},
    {"id":"escape-edge","type":"play-move","size":5,"setup":{"B":["a3"],"W":["a2","b3"]},"toPlay":"B","goal":{"kind":"save","target":"a3"},"promptKey":"lesson.u05-atari.e5.prompt","hintKey":"lesson.u05-atari.e5.hint","hintPoints":["a4"]},
    {"id":"escape-trap","type":"choice","size":5,"setup":{"B":["c3"],"W":["c2","b3","d3","b4","d4"]},"options":[{"textKey":"lesson.u05-atari.e6.o1","whyKey":"lesson.u05-atari.e6.w1"},{"textKey":"lesson.u05-atari.e6.o2","correct":true}],"markers":[{"kind":"label","at":"c4","text":"A"}],"promptKey":"lesson.u05-atari.e6.prompt","explainKey":"lesson.u05-atari.e6.explain"},
    {"id":"atari-group","type":"play-move","size":5,"setup":{"B":["d1","b2"],"W":["b1","c1"]},"toPlay":"B","goal":{"kind":"atari"},"promptKey":"lesson.u05-atari.e7.prompt","hintKey":"lesson.u05-atari.e7.hint","hintPoints":["a1","c2"],"explainKey":"lesson.u05-atari.e7.explain"},
    {"id":"rescue-capture","type":"play-move","size":5,"setup":{"B":["c3","d2","d4"],"W":["b3","c2","d3"]},"toPlay":"B","goal":{"kind":"capture"},"promptKey":"lesson.u05-atari.e8.prompt","hintKey":"lesson.u05-atari.e8.hint","hintPoints":["e3"],"explainKey":"lesson.u05-atari.e8.explain"}
  ]
}
```

**Texts**

| Key (after `lesson.u05-atari.`) | zh-CN | en | fr |
|---|---|---|---|
| title | 叫吃与逃跑 | Atari and escape | Atari et fuite |
| s1 | 黑棋下在 d3，白子只剩一口气。这叫叫吃：下一手就能提子。 | Black plays d3 and White has one liberty left. This warning is atari (叫吃 jiàochī): next turn Black can capture. | Les Noirs jouent d3 : il reste une liberté aux Blancs. C'est un atari (叫吃 jiàochī) : au prochain tour, ils peuvent capturer. |
| s2 | 被叫吃了怎么办？可以“长”：在唯一的气上接一子，现在有 3 口气。 | Your stone is in atari. You can extend (长 zhǎng): add a stone on the free liberty. Now the group has 3 liberties. | Votre pierre est en atari. Vous pouvez prolonger (长 zhǎng) : posez une pierre sur la liberté libre. Le groupe a 3 libertés. |
| s3 | 先数气！这里长出去后只剩 1 口气（c5），还是被叫吃，逃不掉。 | Count first! Here the extension leaves only one liberty (c5): still in atari, no escape. | Comptez d'abord ! Ici le prolongement ne laisse qu'une liberté (c5) : toujours en atari, pas d'échappée. |
| s4 | 另一个办法：提走叫吃你的白子。黑棋提掉 b3，c3 就多了一口气。 | Another way: capture the stone that attacks yours. Black takes b3 and c3 gets a new liberty. | Autre solution : capturer la pierre qui vous attaque. Les Noirs prennent b3 et c3 gagne une liberté. |
| e1.prompt | 让白子叫吃：只留给它一口气。 | Put the white stone in atari: leave it just one liberty. | Mettez la pierre blanche en atari : ne lui laissez qu'une liberté. |
| e1.hint | 白子有两口气，填掉其中一口。 | It has two liberties. Fill one of them. | Elle a deux libertés. Remplissez-en une. |
| e1.explain | 白子只剩一口气，下一手就能被提走。 | The stone has one liberty left and can be captured next. | Il ne reste qu'une liberté : la pierre peut être capturée au prochain coup. |
| e2.o1 | A | A | A |
| e2.w1 | A 还有 b4 和 c5 两口气。 | A still has b4 and c5. | A a encore b4 et c5. |
| e2.o2 | B | B | B |
| e2.o3 | 都没有 | Neither | Aucune |
| e2.w3 | B 只剩一口气，已被叫吃。 | B has one liberty: it is in atari. | B n'a qu'une liberté : elle est en atari. |
| e2.prompt | 哪颗白子被叫吃了？ | Which white stone is in atari? | Quelle pierre blanche est en atari ? |
| e2.explain | B 只剩 e4 一口气；A 还有 2 口气。 | B has only e4 left; A still has two liberties. | B n'a plus que e4 ; A a encore deux libertés. |
| e3.prompt | 黑子被叫吃了。点出它仅剩的一口气。 | The black stone is in atari. Tap its last liberty. | La pierre noire est en atari. Touchez sa dernière liberté. |
| e3.hint | 三个邻点有白子，找剩下的空点。 | Three neighbours hold white stones; find the empty one. | Trois voisins portent des pierres blanches ; trouvez le point vide. |
| e4.prompt | 黑子被叫吃了。长出去，让它逃脱。 | The black stone is in atari. Extend to make it escape. | La pierre noire est en atari. Prolongez pour la sauver. |
| e4.hint | 在它唯一的气上落子。 | Play on its only liberty. | Jouez sur son unique liberté. |
| e4.explain | 长出去后这块棋有 3 口气，安全了。 | After extending, the group has 3 liberties and is safe. | Après le prolongement, le groupe a 3 libertés : il est sauvé. |
| e5.prompt | 边上的黑子被叫吃了。让它逃脱。 | The black stone on the edge is in atari. Make it escape. | La pierre noire du bord est en atari. Sauvez-la. |
| e5.hint | 它只能往 a4 的方向长。 | It can only extend towards a4. | Elle ne peut que prolonger vers a4. |
| e6.o1 | 逃脱了，有两口以上的气 | Yes, it has two or more liberties | Oui, au moins deux libertés |
| e6.w1 | 数一数：只剩 c5 一口气。 | Count: only c5 is left. | Comptez : il ne reste que c5. |
| e6.o2 | 没有，还是只有一口气 | No, it still has one liberty | Non, toujours une seule liberté |
| e6.prompt | 黑棋长在 A。黑棋逃脱了吗？ | Black extends on A. Has the black group escaped? | Les Noirs prolongent en A. Le groupe noir est-il sauvé ? |
| e6.explain | 长在 c4 后只剩 c5 一口气，仍被叫吃。 | After c4 only c5 is left, so it is still in atari. | Après c4, seule c5 reste : toujours en atari. |
| e7.prompt | 让白棋这一块叫吃。 | Put the white group in atari. | Mettez le groupe blanc en atari. |
| e7.hint | 白棋这一块有两口气，填掉其中一口。 | The white group has two liberties. Fill one. | Le groupe blanc a deux libertés. Remplissez-en une. |
| e7.explain | 连在一起的白子共用气，现在只剩一口。 | The connected stones share liberties; only one is left. | Les pierres connectées partagent leurs libertés ; il n'en reste qu'une. |
| e8.prompt | 黑 c3 被叫吃了。提走一颗白子来救它。 | Black's c3 is in atari. Rescue it by capturing a white stone. | c3 des Noirs est en atari. Sauvez-la en capturant une pierre blanche. |
| e8.hint | 哪颗白子也只剩一口气？ | Which white stone has only one liberty? | Quelle pierre blanche n'a plus qu'une liberté ? |
| e8.explain | 提走 d3 后，c3 又有了气，逃脱了。 | After capturing d3, c3 has liberties again and is safe. | d3 capturée, c3 retrouve des libertés : elle est sauvée. |

### 7.6 Unit 5 checkpoint — 综合复习 Review  (`src/lessons/content/u05-review.json`)

Checkpoint (`kind: "checkpoint"`, no explain steps): one exercise or two per earlier unit, no new idea. Unlocked by 1★ on `u05-atari`; it does not gate anything. Exercises: 8.

| # | id | Type | Revisits | Right answer (engine-verified) |
|---|---|---|---|---|
| 1 | r-liberties | count | Unit 2 | 2 (B b1, W c1) |
| 2 | r-groups | count, 7×7 | Unit 3 (diagonal trap c6 / d5) | 3 |
| 3 | r-connect | play-move connect | Unit 3 | d3 |
| 4 | r-capture-group | play-move capture, min 2, 7×7 | Unit 4 | e5 |
| 5 | r-atari | play-move atari, 7×7 | Unit 5 | c5 or d3 |
| 6 | r-escape | play-move save | Unit 5 | e4 |
| 7 | r-tap-group-libs | tap-point all | Units 2 + 3 | b3, c2, c4, d2, e3 |
| 8 | r-which-capture | choice (3) | Unit 4 | A (d2) |

```json
{
  "schema":1,"id":"u05-review","unit":5,"kind":"checkpoint","titleKey":"lesson.u05-review.title",
  "exercises": [
    {"id":"r-liberties","type":"count","size":5,"setup":{"B":["b1"],"W":["c1"]},"answer":{"libertiesOf":"b1"},"promptKey":"lesson.u05-review.e1.prompt","hintKey":"lesson.u05-review.e1.hint"},
    {"id":"r-groups","type":"count","size":7,"setup":{"B":["b6","c6","d5","e5","b3","b2"]},"answer":3,"promptKey":"lesson.u05-review.e2.prompt","hintKey":"lesson.u05-review.e2.hint","explainKey":"lesson.u05-review.e2.explain"},
    {"id":"r-connect","type":"play-move","size":5,"setup":{"B":["d2","d4"],"W":["c3","e3"]},"toPlay":"B","goal":{"kind":"connect","a":"d2","b":"d4"},"promptKey":"lesson.u05-review.e3.prompt","hintKey":"lesson.u05-review.e3.hint","hintPoints":["d3"]},
    {"id":"r-capture-group","type":"play-move","size":7,"setup":{"B":["c4","f4","d3","e3","d5"],"W":["d4","e4"]},"toPlay":"B","goal":{"kind":"capture","min":2},"promptKey":"lesson.u05-review.e4.prompt","hintKey":"lesson.u05-review.e4.hint","hintPoints":["e5"]},
    {"id":"r-atari","type":"play-move","size":7,"setup":{"B":["b3","b4","d4","c2"],"W":["c3","c4"]},"toPlay":"B","goal":{"kind":"atari"},"promptKey":"lesson.u05-review.e5.prompt","hintKey":"lesson.u05-review.e5.hint","hintPoints":["d3","c5"]},
    {"id":"r-escape","type":"play-move","size":5,"setup":{"B":["e3"],"W":["e2","d3"]},"toPlay":"B","goal":{"kind":"save","target":"e3"},"promptKey":"lesson.u05-review.e6.prompt","hintKey":"lesson.u05-review.e6.hint","hintPoints":["e4"]},
    {"id":"r-tap-group-libs","type":"tap-point","size":5,"setup":{"B":["c3","d3"],"W":["d4"]},"mode":"all","answer":{"libertiesOf":"c3"},"markers":[{"kind":"triangle","at":"c3"}],"promptKey":"lesson.u05-review.e7.prompt","hintKey":"lesson.u05-review.e7.hint"},
    {"id":"r-which-capture","type":"choice","size":5,"setup":{"B":["b3","e3","c4","d4","c2"],"W":["c3","d3"]},"options":[{"textKey":"lesson.u05-review.e8.o1","correct":true},{"textKey":"lesson.u05-review.e8.o2","whyKey":"lesson.u05-review.e8.w2"},{"textKey":"lesson.u05-review.e8.o3","whyKey":"lesson.u05-review.e8.w3"}],"markers":[{"kind":"label","at":"d2","text":"A"},{"kind":"label","at":"a5","text":"B"},{"kind":"label","at":"e5","text":"C"}],"promptKey":"lesson.u05-review.e8.prompt","explainKey":"lesson.u05-review.e8.explain"}
  ]
}
```

**Texts**

| Key (after `lesson.u05-review.`) | zh-CN | en | fr |
|---|---|---|---|
| title | 综合复习 | Review | Révision |
| e1.prompt | 这颗黑子有几口气？ | How many liberties does the black stone have? | Combien de libertés a la pierre noire ? |
| e1.hint | 只数空着的邻点。 | Count only the empty neighbours. | Ne comptez que les voisins vides. |
| e2.prompt | 棋盘上有几块黑棋？ | How many separate black groups are on the board? | Combien de groupes noirs séparés y a-t-il ? |
| e2.hint | 斜角相碰不算相连。 | Diagonal contact is not a connection. | Le contact en diagonale n'est pas une connexion. |
| e2.explain | c6 与 d5 只是斜角相碰，所以共有 3 块。 | c6 and d5 touch only diagonally, so there are 3 groups. | c6 et d5 ne se touchent qu'en diagonale : 3 groupes. |
| e3.prompt | 轮到黑棋。把两颗黑子连起来。 | Black to play. Connect the two black stones. | Aux Noirs. Connectez les deux pierres noires. |
| e3.hint | 哪个点在两颗黑子之间？ | Which point lies between the two black stones? | Quel point se trouve entre les deux pierres noires ? |
| e4.prompt | 一次提走两颗白子。 | Capture both white stones with one move. | Capturez les deux pierres blanches d'un coup. |
| e4.hint | 找出白棋这一块唯一的空邻点。 | Find the only empty point next to the white group. | Trouvez le seul point vide à côté du groupe blanc. |
| e5.prompt | 让白棋这一块叫吃。 | Put the white group in atari. | Mettez le groupe blanc en atari. |
| e5.hint | 白棋这一块有两口气，填掉其中一口。 | The white group has two liberties. Fill one. | Le groupe blanc a deux libertés. Remplissez-en une. |
| e6.prompt | 边上的黑子被叫吃了。让它逃脱。 | The black stone on the edge is in atari. Make it escape. | La pierre noire du bord est en atari. Sauvez-la. |
| e6.hint | 在它唯一的气上长出去。 | Extend on its only liberty. | Prolongez sur son unique liberté. |
| e7.prompt | 点出标记黑棋这一块所有的气，然后按“确认”。 | Tap all the liberties of the marked black group, then press Check. | Touchez toutes les libertés du groupe noir marqué, puis Vérifier. |
| e7.hint | 两颗黑子共用气，每个点只选一次。 | The two stones share liberties; tap each point once. | Les deux pierres partagent leurs libertés ; touchez chaque point une fois. |
| e8.o1 | A | A | A |
| e8.o2 | B | B | B |
| e8.w2 | B 离白棋很远，没有减少它的气。 | B is far from the group and takes no liberty. | B est loin du groupe et ne lui enlève rien. |
| e8.o3 | C | C | C |
| e8.w3 | C 离白棋很远，没有减少它的气。 | C is far from the group and takes no liberty. | C est loin du groupe et ne lui enlève rien. |
| e8.prompt | 黑棋下在哪一点可以提走白棋？ | Where can Black play to capture the white stones? | Où les Noirs peuvent-ils jouer pour capturer les pierres blanches ? |
| e8.explain | 白棋这一块的最后一口气在 d2。 | The last liberty of the white group is d2. | La dernière liberté du groupe blanc est d2. |


## 8. Terms and pinyin (first use)
zh-CN texts never show pinyin (decision 2). en and fr show it in the first text that uses the term:
| Term | pinyin | First text | Meaning |
|---|---|---|---|
| 棋盘 | qípán | `u01-board.s1` | board |
| 交叉点 | jiāochādiǎn | `u01-board.s1` | crossing point |
| 黑 / 白 | hēi / bái | `u01-board.s2` | Black / White |
| 棋子 | qízǐ | `u01-board.s3` | stone |
| 气 | qì | `u02-liberties.s1` | liberty |
| 连接 | liánjiē | `u03-connection.s1` | connected |
| 一块棋 | yíkuàiqí | `u03-connection.s1` | group |
| 提子 | tízǐ | `u04-capture.s2` | capture |
| 叫吃 | jiàochī | `u05-atari.s1` | atari |
| 长 | zhǎng | `u05-atari.s2` | extend |

## 9. Framework gaps
**None that block this content.** Everything above validates against the M3 schema and runs on the M3
runners, including labels on stones, `count` with a plain number answer (groups, captured stones),
`play-move` with `goal: point` (place a stone by name) and `tap-point` on occupied points (needs the M3 §12
`pointer="ring"`, already built). Smallest changes the developer must still make are listed in §5 (registry,
`PLANNED_UNITS`, badge layout, test updates). Two things are *not* gaps but worth knowing:
- `coordinates` is per lesson, so all of Unit 1's boards show letters and numbers (intended).
- Explanation `highlights` are drawn only on a step's starting position and vanish when the first move plays;
  the steps are written for that (the new liberty or the captured stones are described in the text).

## 10. Correctness check (done by the designer)
Every position uses orthogonal neighbours only and was checked by hand for: no group without liberties at the
start; the stated liberties; legality of the answer; that no other move meets the goal. In addition, the six
files and all texts were run through the real `validateLesson` / `validateCatalog` and `getSolution` (a throwaway
test, not committed): **all valid, and every solution set equals the tables in §7** (e.g. Unit 3 #5 has the single
solution c3; Unit 5 #1 has c4 and d3; Unit 5 #7 has a1 and c2). The same run confirmed that the text limits hold.
Notes on tricky ones: Unit 5 #7 — Black a1 leaves its own stone with one liberty (a2) but the goal is only
"atari", so it is accepted and `fb.pm.selfAtari` is not shown for correct moves; Unit 5 #6 is a pure reading
question (c4 then leaves only c5); Unit 4 #8 is a count of captured stones (3) with the label A on the last liberty e3.

## 11. Out of scope
Beginner bot, Capture Go mini-game and Unit 6 content (next PR); checkpoints for Units 1–4; 9×9 and larger
boards; any new exercise type, schema field or board feature; sound or art beyond M3; Units 7+; settings (pinyin
toggle, mute) → M6; resume mid-set; random order.

## 12. Decisions for the PO
See the end of the report in the chat for the plain-language list; summary:
1. Badge under the title for "Bientôt disponible" (recommended) vs shorter text.
2. No pinyin on zh-CN titles (recommended).
3. One review checkpoint after Unit 5 only (recommended) vs one per unit vs none.
4. Group-liberty counting moves from Unit 2 to Unit 3 (recommended).
5. Keep the M3 star thresholds (recommended).
6. Keep the dev sample in the code, hidden in the public app (recommended).
7. Chinese terms chosen for "group" (一块棋) and "extend" (长): confirm.
