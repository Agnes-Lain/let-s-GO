# M1 — Rules engine (`src/engine`)

## 0. In plain words (for the product owner)
The engine is the app's referee. It doesn't show anything on screen. It knows the board, where the
stones are, whose turn it is, which moves are allowed and why not, what gets captured, and who won.
Every later piece uses it: lessons ("tap all the liberties"), exercise checks ("did you capture?"),
feedback ("禁入点: this stone would have no liberties"), the bot, and later the AI tutor. If the
engine is wrong, the app teaches a wrong rule, so every rule here gets a test with a small board diagram.

**Decisions you need to make** (recommendations in §9):
1. Coordinates: `c3` = column c from the **left**, row 3 from the **bottom**; the letter `i` is skipped.
2. Default komi (贴目 tiēmù) per board size: 0.5 on 5×5 and 7×7, 7.5 on 9×9/13×13/19×19.
3. SGF (game-record files) import: **move it to M5**, where tsumego needs it.
4. Add a small "move facts" report (what was captured, who is in atari) to M1: **yes**.
5. Delivery in **3 PRs**, each with the board diagrams in the PR description so you can check them.

## 1. Goal
The app has a correct, tested, pure TypeScript Go referee for Chinese rules on 5×5 to 19×19 boards.
Lessons, exercises and the bot can use it to place stones, explain illegal moves, count captures and
score a finished game.

## 2. User stories
- As a **learner**, I am never told a wrong rule: an allowed move is never rejected, a forbidden
  move is never accepted, and a capture is never missed.
- As a **learner**, when a move is forbidden I am told *why* (occupied / 禁入点 / 打劫), not just "no".
- As a **lesson author**, I write positions as `{ "B": ["c3"], "W": ["c2"] }` with the same
  coordinates shown on the board.
- As an **exercise runner** (M3), I can ask "is this point legal?", "what did this move capture?",
  "how many liberties does this group have?" and "is this group in atari?".
- As a **counting exercise** (units 12–14), I get each side's stones, territory, the dame and the result,
  after marking dead stones.
- As the **bot** (M4/M6), I can list all legal moves and play thousands of moves quickly without
  side effects.
- As the **AI tutor** (M7), I get facts computed by the engine and never have to guess the board.
- As **QA**, I can write a board as ASCII art in a test and compare boards as text.

## 3. Public API sketch (TypeScript signatures only, exported from `src/engine/index.ts`)
```ts
export type Color = 'B' | 'W';
export type BoardSize = 5 | 7 | 9 | 13 | 19;
/** x: 0 = column a (left). y: 0 = row 1 (bottom). */
export interface Point { readonly x: number; readonly y: number }
/** Lesson/JSON notation, lowercase: 'c3', 'j9', 't19'. Letters a–t without 'i'. */
export type Vertex = string;
export interface Board { readonly size: BoardSize; readonly cells: readonly (Color | null)[] } // index y*size+x

export interface GameOptions {
  komi?: number;                         // default: defaultKomi(size)
  setup?: { B?: Vertex[]; W?: Vertex[] };// initial stones (lessons, handicap later)
  toPlay?: Color;                        // default 'B'
}
export type Move =
  | { readonly type: 'play'; readonly color: Color; readonly point: Point }
  | { readonly type: 'pass'; readonly color: Color };
export interface GameState {
  readonly board: Board;
  readonly toPlay: Color;
  readonly komi: number;
  readonly koPoint: Point | null;           // forbidden for `toPlay` on this turn only
  readonly captures: { readonly B: number; readonly W: number }; // stones captured BY each color
  readonly consecutivePasses: number;
  readonly isOver: boolean;                 // true after two consecutive passes
  readonly moves: readonly Move[];          // history (not including setup)
}
export type IllegalReason = 'off-board' | 'occupied' | 'suicide' | 'ko' | 'game-over';
export interface Group { color: Color; stones: Point[]; liberties: Point[] } // both sorted, see AC 9
export interface MoveFacts {
  color: Color; point: Point;
  captured: Point[][];            // one array per captured group; [] if none
  playedGroup: Group;             // group containing the new stone, after captures
  opponentAtari: Group[];         // opponent groups touching the new stone that now have exactly 1 liberty
  selfAtari: boolean;             // playedGroup has exactly 1 liberty
  koPoint: Point | null;          // ko point created by this move, if any
}
export type PlayResult =
  | { ok: true; state: GameState; facts: MoveFacts }
  | { ok: false; reason: IllegalReason };
export type PassResult = { ok: true; state: GameState } | { ok: false; reason: 'game-over' };
export interface ScoreSide { stones: number; territory: number; komi: number; total: number }
export interface ScoreResult {
  black: ScoreSide; white: ScoreSide;    // black.komi is always 0
  dame: Point[];                         // empty points owned by nobody
  deadStones: Point[];                   // after expanding to whole groups
  ownership: readonly (Color | null)[];  // per cell, after removing dead stones
  winner: Color | null;                  // null = draw
  margin: number;                        // >= 0
  result: string;                        // 'B+5.5' | 'W+1.5' | 'Draw'
}
export type EngineErrorCode = 'invalid-size' | 'invalid-vertex' | 'invalid-setup'
  | 'invalid-komi' | 'invalid-ascii' | 'invalid-dead-stone';
export class EngineError extends Error { readonly code: EngineErrorCode }

// Coordinates
export function parseVertex(v: Vertex, size: BoardSize): Point;   // throws invalid-vertex
export function toVertex(p: Point, size: BoardSize): Vertex;
// Game
export function defaultKomi(size: BoardSize): number;
export function createGame(size: number, opts?: GameOptions): GameState; // throws invalid-size/-setup/-komi
export function play(state: GameState, at: Point | Vertex): PlayResult;  // plays for state.toPlay
export function pass(state: GameState): PassResult;
export function checkMove(state: GameState, at: Point | Vertex): { legal: true } | { legal: false; reason: IllegalReason };
export function legalMoves(state: GameState): Point[];                   // excludes pass
// Board queries
export function groupAt(board: Board, at: Point | Vertex): Group | null; // null on empty point
export function liberties(board: Board, at: Point | Vertex): Point[] | null;
export function isAtari(board: Board, at: Point | Vertex): boolean;      // false on empty point
// Scoring (any position, not only finished games)
export function score(board: Board, opts: { komi: number; deadStones?: (Point | Vertex)[] }): ScoreResult;
// ASCII helpers (tests, debugging, lesson authoring)
export function parseBoard(ascii: string): { board: Board; marked: Point[]; points: Point[] };
export function printBoard(board: Board, opts?: { coords?: boolean; marked?: Point[]; points?: Point[] }): string;
```
**Illegal moves are results, not exceptions** (they are normal while learning). Exceptions
(`EngineError` with a `code`) are only for programmer/content mistakes: bad size, bad vertex,
impossible setup — the M3 lesson validator turns them into clear content errors.

### Purity and immutability
- No React/RN/Expo, timers, `Math.random`, `Date`, I/O or global mutable state in `src/engine`.
- Every function returns new objects; inputs are never modified. Same input ⇒ same output.
- Order of returned point lists is deterministic: sorted by x, then y (`a1, a2, b1, …`).

### Coordinates (decision)
Columns are letters from the **left** (`a`…`t`, skipping `i`, so 19×19 ends at `t`); rows are numbers
from the **bottom** (1…size). Lowercase in JSON, input is case-insensitive. Why: it is the convention of
printed Go diagrams, GTP, OGS/KGS/野狐 displays, so a learner who meets other Go material sees the same
names; skipping `i` avoids confusion with `j`/`1`. The CURRICULUM example (`c3` surrounded by `c2, b3,
d3`) reads correctly. SGF uses its own letter pairs from the top-left; the M5 importer converts them.

### ASCII board format
```
5 . . . . .        one row per line, top row (highest number) first
4 . . X . .        '.' empty  'X' black  'O' white
3 . X O * .        '*' empty point of interest  -> returned in `points`
2 . . . . .        'x' / 'o' a stone that is marked (e.g. dead) -> stone + `marked`
1 . . . . .        optional row numbers on the left, optional letter line at the bottom
  a b c d e        cells separated by one space (or none); blank lines ignored
```
Square, size 5/7/9/13/19, only these characters, or `EngineError('invalid-ascii')`.
`printBoard` writes exactly this layout (with `coords: true`, row numbers right-aligned).

## 4. Acceptance criteria
All diagrams are 5×5 unless stated; rows not shown are empty. "B"/"X" = black, "W"/"O" = white.

### A. Board model & coordinates (PR 1)
1. **When** `createGame(s)` for s in 5, 7, 9, 13, 19, **then** the board is empty, `toPlay` is `B`,
   `consecutivePasses` 0, `isOver` false, captures `{B:0,W:0}`, `koPoint` null.
   **When** s is 0, 4, 6, 8, 21 or 9.5, **then** it throws `EngineError` code `invalid-size`.
2. **Given** 9×9, **then** `parseVertex('a1')` = {x:0,y:0}, `'j9'` = {x:8,y:8}, `'h1'` = {x:7,y:0},
   `'j1'` = {x:8,y:0}, `'C3'` = {x:2,y:2}; `toVertex({x:8,y:8})` = `'j9'`.
   **Given** 19×19, `parseVertex('t19')` = {x:18,y:18}.
3. **Given** 9×9, **when** `parseVertex` gets `'i3'`, `'k1'`, `'a10'`, `'a0'`, `''` or `'3c'`, **then**
   it throws `invalid-vertex`. **Given** 5×5, `'f1'` and `'c6'` throw `invalid-vertex`.
4. **Given** `createGame(5, {setup:{B:['c3'], W:['c2','b3','d3']}, toPlay:'W'})`, **then**
   `printBoard(state.board, {coords:true})` equals:
   ```
   5 . . . . .
   4 . . . . .
   3 . O X O .
   2 . . O . .
   1 . . . . .
     a b c d e
   ```
5. **Given** any board B, `parseBoard(printBoard(B)).board` deep-equals B; **given** a canonical string S
   (as in AC 4, with or without coords), `printBoard(parseBoard(S).board, …)` returns S. Markers
   `*`, `x`, `o` round-trip via `points`/`marked`.
6. **When** `parseBoard` gets a non-square grid, a 6×6 grid or a character like `#`, **then** it throws
   `invalid-ascii`. **When** `createGame` setup lists one point twice, a point in both B and W, or
   creates a group with 0 liberties (e.g. B `a1` with W `a2`,`b1`), **then** it throws `invalid-setup`. Komi that is not a finite multiple of 0.5 throws `invalid-komi`.

### B. Groups & liberties (PR 1)
7. **Given** single B stones on separate 5×5 boards, **then** `liberties` length is: `c3` → 4
   (b3, c2, c4, d3); `c1` (edge) → 3 (b1, c2, d1); `a1` (corner) → 2 (a2, b1).
8. **Given**
   ```
   3 . . X O .
   2 . X X . .
   1 . . . . .
     a b c d e
   ```
   **then** `groupAt('c3')` stones = [b2, c2, c3], liberties = [a2, b1, b3, c1, c4, d2] (6 — `b3` touches
   two stones but counts once; `d3` is white). `liberties('d3')` = [d2, d4, e3] (3).
9. **Given** B at `b2` and `c3` only (diagonal), **then** they are two groups: `groupAt('b2')` stones =
   [b2] with liberties [a2, b1, b3, c2]; `groupAt('c3')` stones = [c3] with [b3, c2, c4, d3].
   Lists are sorted by column, then row.
10. **Given** an empty point, **then** `groupAt` and `liberties` return null and `isAtari` false.
    **Given** AC 4's board, `isAtari('c3')` is true; `isAtari('c2')` is false.

### C. Legality & captures (PR 2)
11. **Turn order.** From an empty 5×5: B `c3` → `toPlay` W; W `d3` → `toPlay` B; `moves` has 2
    entries. An illegal attempt returns `{ok:false}` and the caller's state is unchanged (same toPlay).
12. **Occupied.** **Given** B at `c3`, W to play, **when** W plays `c3`, **then** `{ok:false, reason:'occupied'}`.
    **When** a Point with x=5 is played on 5×5, **then** `reason:'off-board'`.
13. **Capture in the center.** **Given** AC 4 (W to play), **when** W plays `c4`, **then** ok, `c3` is
    empty, `facts.captured` = [[c3]], `captures.W` = 1.
14. **Capture on the edge.** **Given** B `c1`, W `b1`,`d1`, W to play, **when** W plays `c2`, **then**
    `c1` is removed, captured [[c1]].
15. **Capture in the corner.** **Given** B `a1`, W `b1`, W to play, **when** W plays `a2`, **then**
    `a1` is removed, captured [[a1]].
16. **Capture a 2-stone group.** **Given** B `b1`,`c1`; W `a1`,`b2`,`d1`; W to play, **when** W plays
    `c2`, **then** captured [[b1, c1]], `captures.W` = 2.
17. **One move captures two groups.**
    ```
    2 . O . O .
    1 O X . X O      W to play c1
      a b c d e
    ```
    **When** W plays `c1`, **then** captured = [[b1], [d1]], `captures.W` = 2, `c1` has liberties
    [b1, c2, d1], `koPoint` null (two stones captured, not a ko).
18. **Suicide, single stone.** **Given** W `a2`,`b1`, B to play, **when** B plays `a1`, **then**
    `{ok:false, reason:'suicide'}`. **Given** W `b3`,`c2`,`c4`,`d3`, **when** B plays `c3`, **then**
    `reason:'suicide'`.
19. **Suicide, group.**
    ```
    2 O O . . .
    1 X . O . .      B to play b1
      a b c d e
    ```
    **When** B plays `b1`, **then** `reason:'suicide'` (group a1+b1 would have 0 liberties; W a2+b2 keeps
    a3, b3, c2; W c1 keeps c2, d1). `checkMove` returns the same reason without playing.
20. **Looks like suicide but captures (legal).**
    ```
    3 X . . . .
    2 O X . . .
    1 . O X . .      B to play a1
      a b c d e
    ```
    **When** B plays `a1`, **then** ok: captured = [[a2], [b1]] (each had only `a1`), `captures.B` = 2,
    `facts.playedGroup.liberties` = [a2, b1], `koPoint` null.
21. **Ko.**
    ```
    4 . . X O .
    3 . X O . O
    2 . . X O .      B to play d3
      a b c d e
    ```
    **When** B plays `d3`, **then** W `c3` is captured, `koPoint` = c3, `facts.selfAtari` true.
    **When** W then plays `c3`, **then** `reason:'ko'` (board unchanged, still W to play).
    `legalMoves` excludes c3.
22. **Ko, after a move elsewhere.** Continuing AC 21: W `a1`, B `e1`, **then** W `c3` is legal,
    captures [[d3]] and sets `koPoint` = d3 (now forbidden for B). Separately: after B `d3`, if W
    passes and B plays `a5`, W `c3` is legal (the ko ban lasts exactly one turn).
23. **Snapback (legal, not ko).**
    ```
    3 X X X . .
    2 O O O X .
    1 O . . X .      B to play b1
      a b c d e
    ```
    B `b1` (throw-in): legal, nothing captured, `facts.selfAtari` true, `facts.opponentAtari` = the W
    group a1,a2,b2,c2 (only liberty c1). W `c1`: captures [[b1]], `koPoint` null (the capturing stone
    joins a 5-stone group). B `b1` again: legal (not a ko), captures [[a1, a2, b2, c1, c2]],
    `captures.B` = 5, and b1 then has liberties [a1, b2, c1].
24. **Purity.** **Given** a deep-frozen `GameState`, **when** `play`, `pass`, `checkMove`,
    `legalMoves`, `score` run on it, **then** nothing throws and the input deep-equals a copy taken
    before. Calling `play` twice with the same input gives deep-equal results.
25. **ESLint** passes with no React/RN/Expo imports under `src/engine/` (M0 rule), and no
    `Math.random`/`Date` usage (grep check in QA).

### D. Pass, end of game, scoring (PR 3)
26. **Given** a new game, **when** B passes, **then** `toPlay` W, `consecutivePasses` 1, not over.
    **When** W then plays `c3`, `consecutivePasses` resets to 0. **When** B passes and W passes,
    **then** `isOver` true; then `play` returns `reason:'game-over'` and `pass` returns `{ok:false}`.
27. **Default komi**: `defaultKomi` 5 → 0.5, 7 → 0.5, 9 → 7.5, 13 → 7.5, 19 → 7.5; `createGame(9)`
    has komi 7.5; `createGame(9,{komi:5.5})` has 5.5.
28. **Scoring with a dead stone and dame.**
    ```
    5 . . X O .
    4 o . X O .      'o' at a4 = white stone marked dead
    3 . . X . O      d3 touches black and white -> dame
    2 . . X O .
    1 . . X O .
      a b c d e
    ```
    **When** `score(board, {komi:7.5, deadStones:['a4']})`, **then** black = stones 5 + territory 10
    (a1–a5, b1–b5) = 15; white = stones 5 + territory 4 (e5, e4, e2, e1) + komi 7.5 = 16.5;
    dame = [d3]; result `W+1.5`. With `komi:0.5` → `B+5.5`. With `komi:6` → winner null, `Draw`.
29. **Same board, dead stone not marked** (`deadStones: []`, komi 7.5): the 9 empty points on the left
    touch both colors → dame; black 5 + 0 = 5; white 6 + 4 + 7.5 = 17.5; dame has 10 points; `W+12.5`.
30. **Dead-stone input.** Marking any one stone of a group marks the whole group (`deadStones`
    returns all of it). Marking an empty point throws `invalid-dead-stone`. Prisoner counts
    (`captures`) never change the score (area scoring).
31. **Empty board** 9×9, komi 7.5: every point is dame, black 0, white 7.5, `W+7.5`.

### E. Performance (PR 2, non-blocking guideline for the bot)
32. **Given** 9×9, **when** a test plays 1,000 turns, each time choosing `legalMoves(s)[(7·i) mod n]`
    (pass if n = 0, new game when over), **then** it finishes in under 1 s on CI.

## 5. Illegal-move messages (copy keys; added to i18n in M3, listed now so codes match)
| Code | Key | zh-CN | en | fr |
|---|---|---|---|---|
| occupied | engine.illegal.occupied | 这里已经有棋子了。 | There is already a stone here. | Il y a déjà une pierre ici. |
| suicide | engine.illegal.suicide | 禁入点（jìnrùdiǎn）：下在这里没有气，也提不掉对方的子。 | Forbidden point (禁入点 jìnrùdiǎn): your stone would have no liberties and captures nothing. | Point interdit (禁入点 jìnrùdiǎn) : votre pierre n'aurait aucune liberté et ne capture rien. |
| ko | engine.illegal.ko | 打劫（dǎjié）：不能马上提回，先在别处下一手。 | Ko (打劫 dǎjié): you can't take back right away. Play elsewhere first. | Ko (打劫 dǎjié) : impossible de reprendre tout de suite. Jouez d'abord ailleurs. |
| game-over | engine.illegal.gameOver | 对局已经结束了。 | The game is over. | La partie est terminée. |
| off-board | — | (never shown: the board UI can't produce it) | | |

## 6. Game-design notes (what units 1–14 need)
| Unit | Needs from the engine | In M1? |
|---|---|---|
| 1 Board & stones | coordinates, `play`, turn order | yes |
| 2 气 Liberties | `liberties()` for "tap all liberties", count | yes |
| 3 连接 Connection | `groupAt()` (one group or two?) | yes |
| 4 提子 Capture | `facts.captured` for goal `capture min N` | yes |
| 5 叫吃 Atari | `isAtari`, `facts.opponentAtari`, escape = own group > 1 liberty after move | yes |
| 6 吃子棋 Capture Go | `captures.B/W` totals; win condition lives in the runner | yes |
| 7 禁入点 | `checkMove` → `suicide`; AC 20 shape for "legal because it captures" | yes |
| 8 打劫 Ko | `ko` reason, `koPoint` to highlight | yes |
| 9 Ladder & net | ladder reader ("does it work?") | **no** — M5, or answers stored in lesson JSON |
| 10–11 Eyes, life & death | eye detection not needed (answers in JSON); multi-move problems need SGF | **no** — M5 |
| 12 地 Territory | `score().ownership` to check tapped territory | yes |
| 13 数子 Counting | `score()` breakdown: stones + territory + komi | yes |
| 14 终局 End of game | two passes, `deadStones` marking, result text | yes |

- Learners succeed when the engine is *strict but explicit*: every rejection has a code that maps to
  a gentle sentence; every capture is listed so the UI can animate exactly those stones.
- `MoveFacts` (recommended **yes**, scope as in §3) gives M3 its feedback sentences ("你提掉了 2 颗子",
  "this group is now in atari") and is the seed of M7's `describePosition`. Out of M1: "missed
  capture/escape point" analysis and whole-board descriptions (M7).
- Small-board komi 0.5 is a tie-breaker only: 5×5/7×7 are for exercises, and the theoretically fair
  komi (25 on 5×5, 9 on 7×7) would confuse beginners. Counting lessons can set any komi in JSON.
- No move limit in the engine; the bot/runner (M4/M6) caps game length, since simple ko allows rare
  repeating cycles (triple ko).

## 7. Out of scope
UI and rendering (M2); i18n strings in the app (M3); automatic life/death judgement, eye detection,
ladder reading; positional superko; handicap placement rules (setup stones suffice); undo (callers
keep old states — free with immutability); resignation and time control; Japanese scoring;
SGF import/export (deferred, §8); the bot.

## 8. SGF import — recommendation: defer to M5
Only tsumego (`sequence` runner, units 10–11, M5) needs SGF; units 1–9 are written directly in
lesson JSON. Deferring keeps M1 small and lets M5 choose with real problem files in hand. Scope then:
`SZ`, `AB`/`AW`, `PL`, `B`/`W` moves, `C` comments, main line + first-level variations (wrong answers).
Dependency: `@sabaki/sgf` (listed in TECH_STACK) is mature but brings Node-oriented encoding helpers;
a ~150-line own parser for that subset avoids a dependency in a pure module. Recommendation: own parser
in M5, with `@sabaki/sgf` as fallback if real files need more. ROADMAP: move the item to M5.

## 9. Delivery plan & decisions
**Recommendation: 3 PRs** (CLAUDE.md says one item per PR; items 1 and 2 are tiny and inseparable —
liberties are the first thing you'd check on a board):
1. PR 1 — board, coordinates, ASCII, groups & liberties (AC 1–10).
2. PR 2 — legality, captures, ko, move facts, performance (AC 11–25, 32).
3. PR 3 — pass, game end, scoring (AC 26–31).
Each PR description lists its ACs with the ASCII diagrams and "test passes ✓", so the product owner
reviews Go correctness, not code. One big PR would be ~1,500 lines of tests and code: too much to review.

**Product-owner decisions (approved):** D1 coordinates bottom-left, no `i`. D2 komi defaults as AC 27
(0.5 on 5×5/7×7, 7.5 on 9×9 and larger). D3 SGF → M5. D4 `MoveFacts` in M1. D5 3 PRs. D6 marking one
stone dead marks its whole group. D7 illegal moves return results; content errors throw `EngineError`.
D8 simple ko: the ban lasts exactly one turn, and a pass counts as that turn. D9 the engine returns
`Draw` / `B+x` / `W+x`; the UI translates (e.g. 和棋) in M3.

## 10. Correctness check
I checked every diagram by hand, point by point:
- AC 7: listed every orthogonal neighbour inside the 5×5 board (4/3/2).
- AC 8: union of neighbours of b2, c2, c3 minus stones = {a2,b1,b3,c1,c4,d2}; d3 is W so excluded; W d3 → {d2,d4,e3}.
- AC 13–16: each captured group's liberties before the move were exactly the played point; the
  capturing stone keeps ≥1 liberty, so none is suicide. AC 16: {b1,c1} touched a1,b2,d1 (W) and c2 only.
- AC 17: b1 (a1,b2 W) and d1 (e1,d2 W) each had only c1; W a1 keeps a2, e1 keeps e2; two stones captured → no ko.
- AC 18–19: no adjacent W group loses its last liberty (listed in AC 19), so the moves are suicide.
- AC 20: W a2 (a3,b2 are B) and W b1 (b2,c1 are B) each had only a1; after capture a1 has a2,b1;
  2 stones captured → no ko. B a3/b2/c1 all keep liberties.
- AC 21–22: W c3 had only d3; B d3 then has only c3 (d4, e3, d2 are W, each keeps ≥2 liberties) →
  single stone capturing a single stone = ko. a1/e1/a5 are quiet moves away from the shape.
- AC 23: W group {a1,a2,b2,c2} had liberties {b1,c1}; B b1 has only c1 and captures nothing; W c1
  captures b1 (B {d1,d2} keeps e1,e2,d3) and the W group of 5 then has only b1; B b1 captures 5.
- AC 28–29: counted all 25 points: 15 + 9 + 1 dame = 25 (marked); 5 + 10 + 10 dame = 25 (unmarked).
  Every stone in the diagram has ≥1 liberty, so it is a legal position.
