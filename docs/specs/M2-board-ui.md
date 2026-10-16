# M2 — Board UI (`src/board`)

Covers all three M2 roadmap items: the `<GoBoard>` component (SVG, star points, coordinates),
touch preview + commit, last-move marker, capture animation, stone sound, and web verification
at 360×740. Visual mockup for approval: `docs/specs/M2-mockup.html`.

## 0. In plain words (for the product owner)
- M2 builds **the Go board you will see in every lesson and game**: a bamboo board with lines, star
  points (星位 xīngwèi) and letters/numbers on the edges (A–T without I, 1 at the bottom).
- **Placing a stone works like this:** put your finger down → a see-through "ghost" stone appears
  where the stone would go → slide to fix the spot → lift your finger to play. Slide off the board
  to cancel. This protects beginners from mis-taps, because on a 9×9 board each point is smaller than
  a fingertip.
- On 9×9 and bigger boards, while your finger is down, two thin lines (a cross) and a small label
  such as "E5" show exactly where the stone will land, above your finger where you can see it.
- If a move is not allowed (point taken, suicide, ko), a soft dashed red ring appears and the screen
  explains *why* with the rules engine's reason, e.g. "Forbidden point (禁入点 jìnrùdiǎn): your stone
  would have no liberties and captures nothing." Never just "wrong".
- The last stone played gets a small dot. Captured stones fade away gently (0.3 s). A soft wooden
  "tock" plays when a stone lands (can be switched off).
- The board can draw lesson marks: circle, triangle, square, cross, letters A/B, highlighted
  liberties (气 qì) and a pulsing hint ring — everything M3 lessons need.
- The board knows **no rules**: the rules engine (M1) decides what is legal; the board only draws and
  reports touches. That keeps rules in one well-tested place.
- You can try it on your iPhone: Settings → "棋盘演示（开发用） / Board demo (dev)" (only in the
  developer build you open with Expo Go). It has free play on every size and small scenarios
  (capture, ko, forbidden point, marks).

## 1. Goal
A learner can see any position clearly on a calm bamboo board and place a stone precisely with one
finger, getting immediate, gentle visual and sound feedback — the foundation every lesson (M3+) and
game (M4+) is built on.

## 2. User stories
- As a beginner, I want to see where my stone will land **before** it lands, so a slip of my finger
  doesn't cost me the exercise.
- As a beginner, I want to cancel a move by sliding off the board, so I can change my mind.
- As a beginner, when a move is refused I want a soft signal and a reason in my language, so I learn
  the rule instead of feeling punished.
- As a beginner, I want the last move marked, so I can see what the opponent just did.
- As a beginner, I want captured stones to disappear visibly (not blink out), so I understand what
  was captured.
- As a learner who studies with other Go material, I want standard coordinates (A–T without I,
  1 at the bottom) so lessons and books match.
- As a learner using VoiceOver/TalkBack, I want each point read as "D4, black stone" and moves
  announced, so I can follow the board.
- As a learner sensitive to motion, I want animations replaced by instant changes when "Reduce
  motion" is on.
- As a learner in a quiet place, I want stone sounds to respect my phone's silent switch and a mute
  option.
- As the content author (M3), I want to mark points (circle, triangle, square, cross, letters,
  liberties, hint) from lesson JSON without touching board code.
- As the product owner, I want a demo screen in Expo Go to try the board before lessons exist.

## 3. Component API (`src/board/index.ts`)
Pure-presentational: **no game logic, no game state**. The parent owns the `GameState` and calls the
engine; the board only draws props and reports touches. `src/board` may import engine **types** and
the pure helpers `toVertex` / `parseVertex`; it never calls `play`, `checkMove` or `legalMoves`
itself.

```ts
import type { BoardSize, CheckResult, Color, IllegalReason, Point, Vertex } from '@/engine';

export type HighlightKind = 'liberty' | 'hint' | 'success' | 'error';
export interface Highlight { kind: HighlightKind; points: readonly Point[] }

export type Marker =
  | { kind: 'circle' | 'triangle' | 'square' | 'cross'; point: Point }
  | { kind: 'label'; point: Point; text: string };          // 1–2 characters: 'A', 'B', '1'

export interface CaptureEvent {
  id: number;                 // changes once per move (e.g. move number); same id = no replay
  color: Color;               // color of the captured stones
  points: readonly Point[];   // = MoveFacts.captured.flat()
}

export interface GoBoardProps {
  size: BoardSize;                                   // 5 | 7 | 9 | 13 | 19
  stones: readonly (Color | null)[];                 // = GameState.board.cells (index y*size+x)
  width?: number;                                    // px; default: parent width (onLayout). Always square.
  showCoordinates?: boolean;                         // default true
  interactive?: boolean;                             // default false (display-only boards in explanations)
  disabled?: boolean;                                // default false; interactive but locked (bot thinking, answer shown)
  playerColor?: Color;                               // ghost-stone color; default 'B'
  checkPoint?: (p: Point) => CheckResult;            // e.g. p => checkMove(state, p). Default: occupied → illegal 'occupied'
  onPlay?: (p: Point) => void;                       // touch-up on a legal point
  onIllegal?: (p: Point, reason: IllegalReason) => void; // touch-up on an illegal point
  lastMove?: Point | null;
  lastCapture?: CaptureEvent | null;
  highlights?: readonly Highlight[];
  markers?: readonly Marker[];
  sound?: boolean;                                   // default true (M3/M6 settings store will feed this)
  testID?: string;                                   // default 'go-board'
}

export function GoBoard(props: GoBoardProps): JSX.Element;

// Pure helpers (src/board/geometry.ts, no React/RN imports, unit-tested):
export function columnLabels(size: BoardSize): string[];   // ['A',…] without 'I'
export function rowLabels(size: BoardSize): string[];      // top → bottom: ['9',…,'1']
export function starPoints(size: BoardSize): Vertex[];     // sorted by column, then row
export function boardGeometry(size: BoardSize, width: number, showCoordinates: boolean): BoardGeometry;
export function pointFromLocation(g: BoardGeometry, x: number, y: number): Point | null; // null = off-board
export function pointToLocation(g: BoardGeometry, p: Point): { x: number; y: number };
export function vertexLabel(p: Point, size: BoardSize): string;   // 'D4' (uppercase of toVertex)
export function stonesFromSetup(size: BoardSize, setup: { B?: Vertex[]; W?: Vertex[] }): (Color | null)[];

export interface BoardGeometry {
  size: BoardSize; width: number; cell: number;
  origin: number;            // px from board edge to the first line (same on all four sides)
  stoneRadius: number; starRadius: number; lastMoveRadius: number; labelFontSize: number;
  labelOffset: number;       // outer line → label centre, = (origin + stoneRadius)/2
}
```

Typical wiring (M3 runner / dev screen):
```tsx
<GoBoard size={state.board.size} stones={state.board.cells} interactive
  playerColor={state.toPlay} checkPoint={p => checkMove(state, p)}
  onPlay={p => { const r = play(state, p); if (r.ok) setState(r.state, r.facts); }}
  onIllegal={(p, reason) => showMessage(t(`engine.illegal.${reason === 'game-over' ? 'gameOver' : reason}`))}
  lastMove={lastFacts?.point ?? null}
  lastCapture={lastFacts && lastFacts.captured.length ? { id: state.moves.length,
    color: lastFacts.color === 'B' ? 'W' : 'B', points: lastFacts.captured.flat() } : null} />
```

## 4. Visual design & geometry

### 4.1 Size and fit on a 360 px phone
- Board width = `min(available width, available height, 480)`; on a 360×740 screen with 16 px side
  padding the board is **328 × 328 px**. Square, corner radius `radius.sm` (8), soft shadow
  (`board.line` at 18 % opacity, 2 px blur — iOS shadow / Android elevation 2).
- Margin from board edge to the outer line: **0.6 cell** without coordinates (room for edge stones);
  **1.0 cell** with coordinates for 5/7/9, **1.2 cell** for 13/19 (two-digit row numbers need room).
  `cell = width / (size − 1 + 2·margin)`.

| Size | Cell @328, coords | Cell @328, no coords | Meets 44 px? | Touch strategy |
|---|---|---|---|---|
| 5×5 | 54.7 | 63.1 | yes | ghost preview |
| 7×7 | 41.0 | 45.6 | almost / yes | ghost + crosshair + tag when cell < 44 |
| 9×9 | 32.8 | 35.7 | no | ghost + crosshair + tag, drag to adjust |
| 13×13 | 22.8 | 24.8 | no | same; recommended view-only in MVP |
| 19×19 | 16.1 | 17.1 | no | same; recommended view-only in MVP |

**Tap-target strategy (cells < 44 px).** The whole board is *one* touch surface (328 px, far above
44 px); nothing commits on touch-down. The ghost snaps to the nearest intersection; the learner drags
to correct and lifts to commit. Because a fingertip (~45 px) covers a 9×9 point, while the cell is
< 44 px the board also draws a **crosshair** (row + column lines in `accent`, 1.5 px, 55 % opacity,
above the grid and below stones), highlights the matching **edge coordinate labels** (`accent`,
bold) and shows a **coordinate tag** (pill, `surface` fill, 1 px `border`, text `accent`
`typography.label`, e.g. "E5") centred on the column, `max(2.25·cell, 56 px)` **above** the point.
If the tag would leave the board at the top, it is placed beside the point at the same height and
offset (to the left if the column index ≥ size/2, else to the right). No loupe/magnifier in M2.

### 4.2 Layers (bottom → top)
1. **Bamboo** (竹制棋盘): 12 vertical strips across the width alternating `board.bambooStripLight` /
   `board.bambooStripDark` (light first) on `board.bamboo`; one 1.5 px horizontal node mark per strip
   in `board.bambooNode` at fixed heights (deterministic table, so screenshots are stable — no
   `Math.random`).
2. **Grid**: `board.line`, inner lines 1 px, outer border 1.5 px. Exactly `size` lines each way.
3. **Star points** (星位), radius `clamp(2.5, 0.09·cell, 4)` px, `board.line`:
   5×5 c3 · 7×7 d4 · 9×9 c3 c7 e5 g3 g7 · 13×13 d4 d10 g7 k4 k10 ·
   19×19 d4 d10 d16 k4 k10 k16 q4 q10 q16.
4. **Coordinate labels** (if shown): letters along the bottom, numbers along the left, centred in the
   margin **clear of edge stones**: the label centre is `labelOffset = (origin + stoneRadius)/2` from the
   outer line (midway between an edge stone's rim and the board edge), so no stone covers a label; `board.line` at 80 % opacity (≥ 5:1 contrast on the darkest strip), font size
   `clamp(10, 0.36·cell, 13)` px, weight 500. No labels on top/right (calm, matches diagrams).
5. **Liberty highlights** (on empty points): circle r = 0.22·cell, fill `accent` 18 %, stroke `accent`
   1.5 px.
6. **Crosshair** (during preview, cell < 44 px).
7. **Stones**: r = 0.47·cell, flat fill; black `stone.black`; white `stone.white` + 1 px
   `stone.whiteEdge`. Fading captured stones live here too.
8. **Last-move dot**: filled circle r = `clamp(3, 0.16·cell, 6)` px in the opposite stone color
   (`stone.white` on black, `stone.black` on white). Filled dot, not a ring, so it can't be confused
   with the lesson "circle" marker. Hidden if a marker is on the same point.
9. **Markers**: stroke 2 px, no fill; color `stone.white` on a black stone, `board.line` on a white
   stone or empty point. circle r 0.25·cell · triangle side 0.55·cell (centroid on the point) ·
   square 0.44·cell · cross (two diagonals, 0.4·cell) · label: on an empty point a `board.bamboo` disc
   r 0.32·cell hides the grid lines, then text (weight 600, `max(10, 0.42·cell)` px); max 2 chars.
10. **Rings**: `hint` (`color.hint`), `success` (`color.success`), `error` (`color.error`):
    r 0.5·cell, stroke 2.5 px, no fill. Hint pulses (scale 1 → 1.15, opacity 1 → 0.5, 1200 ms,
    3 cycles, then static).
11. **Preview**: ghost stone (player color, 50 % opacity) or **illegal ring** (dashed `color.error`
    2 px, dash 4/3 px, fill `color.error` 10 %, r 0.44·cell) + coordinate tag.

Only tokens from `src/theme/tokens.ts`. New **non-color** tokens added in M2:
```ts
export const motion = { stonePlace: 120, capture: 300, illegalFade: 700, hintPulse: 1200, hintPulseCycles: 3 } as const;
export const opacity = { ghost: 0.5, libertyFill: 0.18, label: 0.8, crosshair: 0.55, illegalFill: 0.1 } as const;
```

### 4.3 Interaction
| Phase | What happens |
|---|---|
| Touch-down inside the grid (± 0.5 cell beyond the outer lines) | Ghost at nearest intersection. If `checkPoint` says illegal → illegal ring instead of ghost (no message yet). Crosshair + tag if cell < 44. |
| Drag | Ghost/ring follows, snapping to intersections. Leaving the grid (> 0.5 cell beyond the outer lines) hides it; coming back shows it again. |
| Touch-up on legal point | `onPlay(point)` once. Preview removed. The board does **not** draw the stone itself — it appears when the parent passes new `stones`. |
| Touch-up on illegal point | `onIllegal(point, reason)` once; the illegal ring stays and fades out over 700 ms (`motion.illegalFade`). No sound, no shake. Parent shows the engine message. |
| Touch-up off-board / responder terminated | Cancel: nothing called, preview removed. |
| `disabled` | No preview, no callbacks. `interactive=false`: no touch surface at all. |

Implementation notes for the developer:
- Use React Native's built-in **responder system** on a single transparent overlay `View`
  (`testID="board-touch"`) above the SVG, with no touchable children, so `nativeEvent.locationX/Y`
  are board-relative. `onResponderTerminationRequest` returns `false` (a parent ScrollView must not
  steal a drag). Track only the first touch; extra fingers are ignored. RN-web maps mouse events to
  the same handlers.
- Keep static layers (bamboo, grid, stars, labels) and stones memoised; only the preview layer
  re-renders during a drag (19×19 must stay smooth).
- Default `checkPoint` (when the prop is absent): occupied → `{ legal: false, reason: 'occupied' }`,
  else legal. `off-board` can never be produced by the board.

### 4.4 Motion, sound, reduced motion
- **Stone placed** (lastMove changes to a point that was empty in the previous `stones` and is
  occupied now): stone scales 0.9 → 1, opacity 0.6 → 1, 120 ms ease-out. A bot move passed via props
  animates and sounds the same way. Undo (lastMove moves to a point that was already occupied) does
  not.
- **Capture** (new `lastCapture.id`): each captured stone is drawn from `lastCapture` (it is already
  gone from `stones`) and fades to 0 while shrinking to 0.8, 300 ms ease-in-out, starting together
  with the placement. A newer capture finishes the previous one instantly. Same `id` never replays.
  Suggestion: animate overlay `Animated.View`s with the native driver (RN core `Animated`; no
  Reanimated needed).
- **Reduce motion** (`AccessibilityInfo.isReduceMotionEnabled()` + `reduceMotionChanged` listener;
  RN-web reads `prefers-reduced-motion`): no placement scale, captured stones removed instantly, hint
  ring static, illegal ring shown 700 ms then removed without fading.
- **Sound** — `src/board/sound.ts` exposes `playStoneSound()`; the board calls it on the same
  "stone placed" rule when `sound !== false`. Asset `assets/sounds/stone.mp3`: one soft wooden "tock"
  of a stone on bamboo, mono, ≤ 150 ms, ≤ 30 KB, peak about −6 dBFS, played at volume 0.6, license
  **CC0** (or recorded by us) documented in `assets/sounds/LICENSE.md`. Audio mode
  `playsInSilentMode: false` (respects the iPhone silent switch). The player is created once and
  reused (`seekTo(0)` then `play()`). Every failure (web autoplay policy, missing codec, Jest) is
  caught and ignored — sound never throws and never logs an error. No capture sound, no illegal-move
  sound in M2.

### 4.5 Accessibility
- Board container: `accessibilityLabel` = `board.a11y.label` ("9 by 9 Go board. Black stones: 3,
  white stones: 2").
- When a screen reader is on (`AccessibilityInfo.isScreenReaderEnabled()` + listener), the board
  renders one invisible accessible element per intersection (`testID="board-point-<vertex>"`, e.g.
  `board-point-d4`), label built from parts joined with `board.a11y.separator`:
  vertex + content (+ "last move") (+ marker) (+ highlight), e.g. "D4, black stone, last move",
  "C2, empty, label A", "B3, empty, liberty". If interactive and not disabled: role `button`, hint
  `board.a11y.playHint`; activation (double-tap) calls `checkPoint` and then `onPlay` or `onIllegal`
  directly (no preview). When off, these elements are not rendered (performance on 19×19).
- On a placement (rule in 4.4) with a screen reader on, the board announces `board.a11y.played.B|W`,
  plus separator + `board.a11y.captured` when `lastCapture` has a new id in the same update.
- Color is never the only signal: illegal ring is dashed + the parent's message; hint ring pulses.

## 5. Screen flow & UI — dev/demo screen `app/dev/board.tsx` (route `/dev/board`)
Entry: Settings shows an extra row `dev.board.open` **only when `__DEV__`** (Expo Go dev server) →
`router.push('/dev/board')`. The route itself always exists, so QA can open `/dev/board` on the web
export.

```
360 × 740
┌──────────────────────────────────────┐
│ 9:41                                 │ status / safe area
│ ‹ Back       Board demo     [A1] [♪] │ 52  top bar; A1 = coordinates toggle, ♪ = sound toggle (44×44 each)
│ ┌────┬────┬────┬─────┬─────┐         │ 44  size segmented control (5 segments ≥ 64 px wide)
│ │5×5 │7×7 │9×9 │13×13│19×19│         │
│ └────┴────┴────┴─────┴─────┘         │
│ ┌──────────────────────────────────┐ │
│ │                                  │ │
│ │        bamboo board 328×328      │ │ 328
│ │                                  │ │
│ └──────────────────────────────────┘ │
│ ● Black to play   Captures B 0 · W 0 │ 28  turn row (mini stone + text / caption)
│ ┌──────────────────────────────────┐ │ 72  message area (reserved for 3 lines, no layout jump)
│ │ ● Forbidden point (禁入点 …)      │ │     shown only after an illegal touch-up
│ └──────────────────────────────────┘ │
│ (Free)(Capture)(Ko)(Forbidden)(Mar…  │ 44  scenario chips, horizontal scroll
│ [   Undo   ]        [   Reset   ]    │ 44  actions
└──────────────────────────────────────┘
```
States:
- **Initial**: 9×9, scenario Free, black to play, captures 0/0, coordinates on, sound on, Undo
  disabled, message area empty.
- **Preview**: ghost/illegal ring on the board (see 4.3).
- **Success** (legal move): stone appears with sound and last-move dot; turn row flips; message
  cleared.
- **Illegal**: message card (`surface`, 1 px `border`, 8 px `color.error` dot, body text
  `textPrimary`) with `engine.illegal.<reason>`; announced to screen readers; cleared by the next
  legal move, a scenario/size change, Undo or Reset.
- **Empty / loading**: none (board is synchronous). Before the board's first layout the area keeps
  its square size (no jump).
- Board width = `min(window width − 32, window height − safe-area insets − 340, 480)` → 328 at
  360×740 (340 = all other rows incl. the 72 px message area); the screen does not scroll. On a
  375×667 iPhone SE the board becomes ≈ 307 px.

Scenarios (setup stones, not moves; selecting one sets its size and clears history):

| Chip | Size | To play | Setup | Try |
|---|---|---|---|---|
| Free | chosen size | B | empty | play freely, both colors alternate |
| Capture | 5×5 | B | B c2 b3 d3 · W c3 | B c4 captures c3 |
| Ko | 5×5 | B | B c4 b3 c2 · W d4 e3 d2 c3 | B d3 captures, W c3 at once → ko message |
| Forbidden | 5×5 | W | B a2 b1 c3 · W d3 c4 | W a1 → suicide message |
| Marks | 7×7 | B | B c5 d4 · W e3 e4 | static markers shown (§6.4), free play continues |

```
Capture (B to play)   Ko (B to play)        Forbidden (W to play)   Marks (7×7)
5 . . . . .           5 . . . . .           5 . . . . .             7 . . . . . . .
4 . . * . .           4 . . X O .           4 . . O . .             6 . . . . . x .   x  cross f6
3 . X O X .           3 . X O * O           3 . . X O .             5 . . X . . . .   c5 circle
2 . . X . .           2 . . X O .           2 X . . . .             4 . . . X O . .
1 . . . . .           1 . . . . .           1 * X . . .             3 . . . h O . .   h hint d3, e3 triangle
  a b c d e             a b c d e             a b c d e             2 . s A . . B .   s square b2, labels A c2 / B f2
                                                                    1 . . . . . . .
                                                                      a b c d e f g
```

## 6. Acceptance criteria
Unless stated: `width = 328`, `showCoordinates = true`; RNTL tests; touch events are fired on
`board-touch` as `responderGrant` / `responderMove` / `responderRelease` / `responderTerminate` with
`nativeEvent: { locationX, locationY }`; `onPlay`/`onIllegal` are `jest.fn()`. Numbers compared with
`toBeCloseTo(v, 2)`. PR numbers refer to §10.

### A. Geometry (pure, `src/board/geometry.ts`) — PR 1
1. **When** `columnLabels(5)`, **then** `['A','B','C','D','E']`; `columnLabels(9)` →
   `A B C D E F G H J`; `columnLabels(13)` → `A B C D E F G H J K L M N`; `columnLabels(19)` →
   `A B C D E F G H J K L M N O P Q R S T`. No result ever contains `'I'`.
2. **When** `rowLabels(9)`, **then** `['9','8','7','6','5','4','3','2','1']` (top → bottom);
   `rowLabels(19)[0]` is `'19'`.
3. **When** `starPoints(s)`, **then**: 5 → `['c3']`; 7 → `['d4']`; 9 → `['c3','c7','e5','g3','g7']`;
   13 → `['d4','d10','g7','k4','k10']`; 19 → `['d4','d10','d16','k4','k10','k16','q4','q10','q16']`.
4. **When** `boardGeometry(size, 328, coords)`, **then** `cell` and `origin` are:

   | size | coords | cell | origin |
   |---|---|---|---|
   | 5 | true | 54.67 | 54.67 |
   | 5 | false | 63.08 | 37.85 |
   | 7 | true | 41.00 | 41.00 |
   | 7 | false | 45.56 | 27.33 |
   | 9 | true | 32.80 | 32.80 |
   | 9 | false | 35.65 | 21.39 |
   | 13 | true | 22.78 | 27.33 |
   | 13 | false | 24.85 | 14.91 |
   | 19 | true | 16.08 | 19.29 |
   | 19 | false | 17.08 | 10.25 |

   and `stoneRadius = 0.47·cell` (9/true → 15.42).
5. **Given** `boardGeometry(9,328,true)`, **then** `starRadius` 2.95, `lastMoveRadius` 5.25,
   `labelFontSize` 11.81. **For every size with coordinates**, `labelOffset > stoneRadius + labelFontSize/2` and `labelOffset + labelFontSize/2 < origin` (labels never touch edge stones and stay on the board); `boardGeometry` also returns `labelOffset` (add it to the `BoardGeometry` interface in §3). **Given** `(5,328,true)` → 4, 6, 13. **Given** `(19,328,true)` → 2.5, 3, 10.
6. **Given** `g = boardGeometry(9,328,true)`, **when** `pointFromLocation(g, x, y)`, **then**:
   (32.8, 32.8) → `{x:0,y:8}` (a9); (295.2, 295.2) → `{x:8,y:0}` (j1); (164,164) → `{x:4,y:4}` (e5);
   (182,182) → `{x:5,y:3}` (f4); (20,164) → `{x:0,y:4}` (a5, within half a cell); (10,164) → `null`;
   (164,320) → `null`; (−5,100) → `null`. And `pointToLocation(g, {x:4,y:4})` → `{x:164,y:164}`.
7. **When** `vertexLabel({x:3,y:3}, 9)`, **then** `'D4'`; `vertexLabel({x:8,y:8}, 9)` → `'J9'`;
   `vertexLabel({x:18,y:18}, 19)` → `'T19'`.
8. **When** `stonesFromSetup(5, { B:['c3'], W:['c4'] })`, **then** an array of 25 with `'B'` at index
   12, `'W'` at index 17, all others `null`. An invalid vertex throws the engine's
   `EngineError('invalid-vertex')`.

### B. Static rendering — PR 1
9. **Given** `size 9`, empty stones, **when** rendered, **then** star elements `board-star-c3`,
   `-c7`, `-e5`, `-g3`, `-g7` exist (5 total, radius 2.95); labels `board-label-col-A` … `-J`
   (9, no `-I`) and `board-label-row-1` … `-9` exist; the root has width and height 328.
10. **Given** `showCoordinates={false}`, **then** no `board-label-*` element exists and stones use
    `cell` 35.65.
11. **Given** `size 9`, `stones = stonesFromSetup(9, {B:['e5','c4'], W:['c6']})`, **then** exactly 3
    `board-stone-*` elements: `board-stone-e5` and `board-stone-c4` fill `stone.black`;
    `board-stone-c6` fill `stone.white` with stroke `stone.whiteEdge`; r = 15.42.
12. **Given** `stones.length !== size*size`, **then** the board renders without stones, does not crash,
    and logs one dev warning.
13. **Given** `interactive` false (default), **then** no `board-touch` element exists.
14. **Given** sizes 5, 7, 13, 19, **then** each renders `size` horizontal and `size` vertical grid
    lines (`board-grid` path/lines count) and the star points of AC 3.
15. **Given** no `width` prop inside a parent 300 px wide, **then** after layout the board is 300×300.

### C. Markers & highlights — PR 1
16. **Given** 9×9 with B e5, W c3, markers `[{kind:'circle', point:e5}, {kind:'triangle',
    point:c3}, {kind:'square', point:d4}, {kind:'cross', point:f6}]`, **then**
    `board-marker-circle-e5` stroke `stone.white`; `board-marker-triangle-c3`,
    `board-marker-square-d4`, `board-marker-cross-f6` stroke `board.line`; all stroke width 2, no
    fill.
17. **Given** marker `{kind:'label', point:c2, text:'A'}` on an empty point, **then**
    `board-marker-label-c2` shows text "A" above a mask disc filled `board.bamboo`, r = 0.32·cell.
    **Given** text `'ABC'`, **then** "AB" is shown and one dev warning is logged.
18. **Given** highlight `{kind:'liberty', points:[b3,c2]}`, **then** `board-highlight-liberty-b3` and
    `-c2` exist: circle r 0.22·cell, fill `color.accent` at opacity 0.18, stroke `color.accent` 1.5,
    rendered **below** the stone layer.
19. **Given** highlights `success` on d4 and `error` on e5, **then** rings r 0.5·cell, stroke 2.5,
    colors `color.success` / `color.error`, rendered **above** stones.
20. **Given** highlight `hint` on d3 with reduce motion off, **then** `board-highlight-hint-d3` (stroke
    `color.hint`) pulses 3 cycles of 1200 ms and is static afterwards (fake timers, 3600 ms).
    **Given** reduce motion on, **then** it is static from the start.

### D. Touch preview & commit — PR 2 (9×9 empty, `interactive`, `playerColor 'B'` unless stated)
21. **When** `responderGrant` at (164,164), **then** `board-ghost` is at e5 (cx 164, cy 164), fill
    `stone.black`, opacity 0.5; `onPlay` and `onIllegal` not called.
22. **When** then `responderRelease` at (164,164), **then** `onPlay` called once with `{x:4,y:4}`,
    `board-ghost` is gone, and no `board-stone-e5` exists (stones prop unchanged).
23. **When** grant (164,164) → move (197,164) → **then** ghost at f5; → move (197,131) → ghost at f6;
    → release (197,131) → `onPlay({x:5,y:5})` once.
24. **When** grant (164,164) → move (164,330), **then** no `board-ghost`; **when** release at
    (164,330), **then** neither callback is called.
25. **When** grant (164,164) → move (164,330) → move (164,164), **then** the ghost is at e5 again;
    release → `onPlay({x:4,y:4})`.
26. **When** grant (164,164) → `responderTerminate`, **then** no ghost and no callbacks.
27. **Given** `playerColor 'W'`, **when** grant (164,164), **then** the ghost fill is `stone.white`,
    stroke `stone.whiteEdge`, opacity 0.5.
28. **Given** 5×5 with `stonesFromSetup(5, {B:['a2','b1','c3'], W:['d3','c4']})`, state with
    `toPlay 'W'`, `playerColor 'W'`, `checkPoint = p => checkMove(state, p)`, **when** grant at
    (54.67, 273.33) [a1], **then** `board-illegal-ring` is at a1 and no `board-ghost` exists;
    **when** release there, **then** `onIllegal` is called once with `({x:0,y:0}, 'suicide')` and
    `onPlay` is not called; the ring is still present at 600 ms and gone at 700 ms.
29. **Given** 9×9 with B e5 and **no** `checkPoint`, **when** grant + release at (164,164), **then**
    `onIllegal({x:4,y:4}, 'occupied')` once; the illegal ring is drawn around the stone.
30. **Given** `disabled`, **when** grant + release at (164,164), **then** no ghost and no callbacks.
31. **Given** 9×9 (cell 32.8 < 44), **when** grant at (164,164), **then** `board-crosshair` exists,
    `board-coord-tag` shows "E5" centred at (164, 90.2), and `board-label-col-E` / `board-label-row-5`
    have fill `color.accent`. **When** grant at e9 (164, 32.8), **then** the tag is centred at
    (237.8, 32.8) (beside, to the right, since column 4 < 4.5).
32. **Given** 5×5 (cell 54.67 ≥ 44), **when** grant at c3 (164,164), **then** neither
    `board-crosshair` nor `board-coord-tag` exists.

### E. Last move, animation, sound — PR 2 (last move) / PR 3 (animation, sound)
33. **Given** 9×9 with B e5 and `lastMove {x:4,y:4}`, **then** `board-last-move` is a filled circle at
    e5, fill `stone.white`, r 5.25. **Given** W at e5, **then** fill `stone.black`. **Given**
    `lastMove` null, or pointing at an empty point, **then** no `board-last-move`.
34. **Given** a marker on the `lastMove` point, **then** no `board-last-move` is drawn.
35. **Given** a board rendered with `lastMove` e5 (B), **then** `playStoneSound` (mocked) is **not**
    called on mount. **When** re-rendered with B added at d4 and `lastMove` d4, **then** it is called
    once. **When** re-rendered with only `highlights` changed, **then** not called again.
36. **Given** `sound={false}`, **when** a new stone + `lastMove` arrive, **then** `playStoneSound` is
    not called. **When** an illegal touch-up happens, **then** it is not called.
37. **When** re-rendered as an undo (d4 removed, `lastMove` back to e5 which was already occupied),
    **then** `playStoneSound` is not called and no placement animation runs.
38. **Given** reduce motion off, **when** re-rendered with W c3 removed from `stones` and
    `lastCapture {id:1, color:'W', points:[c3]}`, **then** `board-capture-c3` (fill `stone.white`)
    exists immediately and is gone after 300 ms. **When** re-rendered again with the same id, **then**
    no `board-capture-*` appears. **When** a new id arrives during an animation, **then** the old
    fading stones disappear at once and the new ones animate.
39. **Given** reduce motion on, **when** the capture of AC 38 arrives, **then** no `board-capture-*`
    element is ever rendered and the placed stone has no scale animation.
40. **Given** `AccessibilityInfo` emits `reduceMotionChanged(true)` while mounted, **then** the next
    capture follows AC 39 without remounting.
41. **Given** `expo-audio`'s player `play()` throws or rejects, **when** `playStoneSound()` is called,
    **then** it resolves without throwing and logs nothing. The audio mode is set once with
    `playsInSilentMode: false`. `assets/sounds/stone.mp3` exists, ≤ 30 KB, and
    `assets/sounds/LICENSE.md` names its source and license (CC0 or own recording).

### F. Accessibility — PR 2
42. **Given** 9×9 with B e5, W c3, **then** the root's `accessibilityLabel` is
    "9 by 9 Go board. Black stones: 1, white stones: 1" (en); zh-CN "9路棋盘。黑子 1，白子 1";
    fr "Goban 9×9. Pierres noires : 1, pierres blanches : 1".
43. **Given** screen reader enabled (mock `isScreenReaderEnabled → true`), **then** 81
    `board-point-*` elements exist; `board-point-e5` label is "E5, black stone" (en) / "E5，黑子"
    (zh-CN) / "E5, pierre noire" (fr); with `lastMove` e5 → "E5, black stone, last move"; an empty
    c2 with label marker A → "C2, empty, label A"; an empty b3 with liberty highlight →
    "B3, empty, liberty".
44. **Given** screen reader enabled and `interactive`, **then** each point has role `button` and hint
    "Double-tap to play here"; **when** `board-point-d4` is activated, **then** `onPlay({x:3,y:3})` is
    called (or `onIllegal` with the `checkPoint` reason). **Given** screen reader disabled, **then**
    no `board-point-*` exists.
45. **Given** screen reader enabled, **when** a placement of B at d4 arrives with
    `lastCapture {id:2, color:'W', points:[d5]}`, **then** `announceForAccessibility` is called once
    with "Black played D4, Stones captured: 1" (en).

### G. Dev/demo screen `app/dev/board.tsx` — PR 1 (static parts) / PR 2 (interactive)
46. **Given** `__DEV__` true, **then** Settings shows a row "Board demo (dev)" (≥ 44 px high) that
    navigates to `/dev/board`; **given** `__DEV__` false, **then** the row is absent.
47. **When** `/dev/board` opens at 360×740, **then**: 9×9 board 328 px wide, scenario "Free" selected,
    "Black to play", "Captures B 0 · W 0", coordinates on, sound on, Undo disabled, no message.
48. **When** the size control "5×5" is pressed, **then** an empty 5×5 board appears, scenario Free,
    Black to play. Each segment, chip, toggle and button is ≥ 44×44 px.
49. **Given** Free 9×9, **when** the learner taps e5 (down + up), **then** a black stone is at e5 with
    the last-move dot, the turn row reads "White to play", Undo is enabled.
50. **Given** scenario Capture, **when** B taps c4, **then** c3 fades out, the turn row reads
    "White to play" and "Captures B 1 · W 0".
51. **Given** scenario Ko, **when** B taps d3, **then** W c3 is captured; **when** W then taps c3,
    **then** the message area shows "Ko (打劫 dǎjié): you can't take back right away. Play elsewhere
    first." and nothing changes on the board; **when** W plays a1 and B plays a5, **then** W c3 is
    legal and captures d3 ("Captures B 1 · W 1").
52. **Given** scenario Forbidden, **when** W taps a1, **then** the message area shows "Forbidden point
    (禁入点 jìnrùdiǎn): your stone would have no liberties and captures nothing.", the board is
    unchanged, and it is still "White to play".
53. **Given** scenario Marks, **then** the 7×7 board shows exactly: circle c5, triangle e3, square b2,
    cross f6, label A c2, label B f2, hint ring d3 (pulsing 3×).
54. **When** Undo is pressed after AC 50, **then** the Capture start position returns (W c3 back,
    Black to play, captures 0, no last-move dot). **When** Reset is pressed, **then** the current
    scenario restarts.
55. **When** the A1 toggle is pressed, **then** coordinates disappear (board keeps 328 px, cells grow);
    **when** the ♪ toggle is pressed, **then** `sound` becomes false. Both expose
    `accessibilityState.checked` and an i18n label.
56. **Given** any message is shown, **when** a legal move, Undo, Reset, size or scenario change
    happens, **then** the message disappears.

### H. Web verification at 360×740 — PR 4
57. **Given** `npx expo export --platform web` served statically and Playwright Chromium
    (`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`) at viewport 360×740, DPR 2, **when**
    `/dev/board` opens, **then** the board's bounding box is x = 16 ± 1, width = 328 ± 1, fully in the
    viewport, and `document.scrollingElement.scrollWidth ≤ 360`.
58. **When** the mouse is pressed at the centre of e5 (computed from the bounding box and AC 6
    geometry), **then** a ghost is visible (screenshot `02-preview-e5.png`); **when** released,
    **then** a black stone with last-move dot is at e5 (`03-played-e5.png`).
59. Screenshots saved to `docs/screenshots/M2/`: `01-empty-9x9`, `02-preview-e5`, `03-played-e5`,
    `04-capture` (Capture scenario, 400 ms after clicking c4), `05-forbidden` (message visible),
    `06-19x19-preview` (mouse held at k10), `07-markers`, `08-zh-CN-empty-9x9` (locale zh-CN),
    `09-fr-forbidden` — all at 360×740.
60. **During** the whole run, Playwright records **zero** console errors (including from audio).
61. Manual check by the product owner on iPhone (Expo Go): checklist in the PR — ghost visible above
    finger on 9×9, sound respects the silent switch, VoiceOver reads "D4, black stone".

### I. Quality — every PR
62. `npm run lint`, `npm run typecheck`, `npm test` pass; `src/board/geometry.ts` imports no
    React/RN; no file in `src/board` calls `play`, `checkMove` or `legalMoves` (QA grep).
63. zh-CN, en and fr contain identical key sets including all keys of §7; no hard-coded user-facing
    string in `app/dev/board.tsx` or `src/board`.

## 7. Copy keys (all three languages)
Engine messages are copied verbatim from M1 §5 (M1 deferred them; the dev screen needs them now).
No plural forms are used, so key sets stay identical across languages.

| Key | zh-CN | en | fr |
|---|---|---|---|
| engine.illegal.occupied | 这里已经有棋子了。 | There is already a stone here. | Il y a déjà une pierre ici. |
| engine.illegal.suicide | 禁入点（jìnrùdiǎn）：下在这里没有气，也提不掉对方的子。 | Forbidden point (禁入点 jìnrùdiǎn): your stone would have no liberties and captures nothing. | Point interdit (禁入点 jìnrùdiǎn) : votre pierre n'aurait aucune liberté et ne capture rien. |
| engine.illegal.ko | 打劫（dǎjié）：不能马上提回，先在别处下一手。 | Ko (打劫 dǎjié): you can't take back right away. Play elsewhere first. | Ko (打劫 dǎjié) : impossible de reprendre tout de suite. Jouez d'abord ailleurs. |
| engine.illegal.gameOver | 对局已经结束了。 | The game is over. | La partie est terminée. |
| board.a11y.label | {{size}}路棋盘。黑子 {{black}}，白子 {{white}} | {{size}} by {{size}} Go board. Black stones: {{black}}, white stones: {{white}} | Goban {{size}}×{{size}}. Pierres noires : {{black}}, pierres blanches : {{white}} |
| board.a11y.separator | ， | `, ` | `, ` |
| board.a11y.point.empty | {{vertex}}，空 | {{vertex}}, empty | {{vertex}}, vide |
| board.a11y.point.black | {{vertex}}，黑子 | {{vertex}}, black stone | {{vertex}}, pierre noire |
| board.a11y.point.white | {{vertex}}，白子 | {{vertex}}, white stone | {{vertex}}, pierre blanche |
| board.a11y.lastMove | 最后一手 | last move | dernier coup |
| board.a11y.marker.circle | 圆圈标记 | circle mark | marque cercle |
| board.a11y.marker.triangle | 三角标记 | triangle mark | marque triangle |
| board.a11y.marker.square | 方块标记 | square mark | marque carré |
| board.a11y.marker.cross | 叉号标记 | cross mark | marque croix |
| board.a11y.marker.label | 标记 {{text}} | label {{text}} | repère {{text}} |
| board.a11y.highlight.liberty | 气 | liberty | liberté |
| board.a11y.highlight.hint | 提示 | hint | indice |
| board.a11y.highlight.success | 正确 | correct | correct |
| board.a11y.highlight.error | 错误 | mistake | erreur |
| board.a11y.playHint | 双击在这里落子 | Double-tap to play here | Touchez deux fois pour jouer ici |
| board.a11y.played.B | 黑棋下在 {{vertex}} | Black played {{vertex}} | Noir joue {{vertex}} |
| board.a11y.played.W | 白棋下在 {{vertex}} | White played {{vertex}} | Blanc joue {{vertex}} |
| board.a11y.captured | 提子 {{count}} 颗 | Stones captured: {{count}} | Pierres capturées : {{count}} |
| dev.board.open | 棋盘演示（开发用） | Board demo (dev) | Démo du goban (dév.) |
| dev.board.title | 棋盘演示 | Board demo | Démo du goban |
| dev.board.sizeOption | {{size}}路 | {{size}}×{{size}} | {{size}}×{{size}} |
| dev.board.sizeA11y | {{size}}路棋盘 | {{size}} by {{size}} board | Goban {{size}}×{{size}} |
| dev.board.toPlay.B | 轮到黑棋 | Black to play | Aux Noirs de jouer |
| dev.board.toPlay.W | 轮到白棋 | White to play | Aux Blancs de jouer |
| dev.board.captures | 提子 黑 {{black}} · 白 {{white}} | Captures B {{black}} · W {{white}} | Prises N {{black}} · B {{white}} |
| dev.board.scenario.free | 自由 | Free | Libre |
| dev.board.scenario.capture | 提子 | Capture | Capture |
| dev.board.scenario.ko | 打劫 | Ko | Ko |
| dev.board.scenario.forbidden | 禁入点 | Forbidden | Interdit |
| dev.board.scenario.markers | 标记 | Marks | Marques |
| dev.board.undo | 悔棋 | Undo | Annuler |
| dev.board.reset | 重来 | Reset | Recommencer |
| dev.board.coordinates | 显示坐标 | Show coordinates | Afficher les coordonnées |
| dev.board.sound | 落子声音 | Stone sound | Son des pierres |

Vertex labels ("E5") and size digits are not translated. Pinyin is not added to dev-screen chips (a
developer tool, not lesson content); the engine messages already carry term + pinyin.

## 8. Game-design notes
- **The board is the instrument, not the game**: no stars, exercises or failure counting in M2. It
  provides the feedback moments M3 builds on: placement (tock + 120 ms settle), capture (300 ms fade —
  the small "reward" moment), illegal (silent dashed ring + reason), hint (amber pulse, 3 cycles,
  then calm). M3 decides when to show hints (e.g. after 2 failures) and what happens after 3 failures
  (show the answer with a `success` ring) using these props.
- **~80 % success starts with precision**: preview-before-commit removes the main source of
  "unfair" failures on small screens (fat-finger mis-taps). Units 1–8 use 5×5/7×7 where points are
  ≈ 41–63 px; 9×9 relies on the crosshair + tag.
- **Calm feel**: no bounce, no confetti, no red flashes, no error sound. Animations ≤ 300 ms
  (illegal fade 700 ms because it is a quiet afterglow). Flat stones, low-saturation tokens, lots of
  bamboo.
- **One obvious action** on the demo screen: the board. Everything else is small and secondary.
- Coordinates on by default in the component; in lessons they appear only in the first lesson
  (PO decision §12.3) and are turned off afterwards via an M3 JSON flag.

## 9. New dependency
- **`expo-audio`** (SDK 57 version, `EXPO_OFFLINE=1 npx expo install expo-audio`): official Expo
  audio module, supported by App Store Expo Go 57, works on web (HTML audio), replaces deprecated
  `expo-av`. Needs a Jest mock (`__mocks__/expo-audio.ts`).
- **Not added:** `react-native-gesture-handler` / `react-native-reanimated` — the RN responder system
  and core `Animated` cover one-finger drag and three short animations, work identically on web, and
  avoid native/Babel config. Haptics (`expo-haptics`) deferred.

## 10. Suggested PRs
1. **PR 1 — static board** (roadmap item 1): `geometry.ts` + tests, `<GoBoard>` rendering (bamboo,
   grid, stars, coordinates, stones, markers, highlights incl. hint pulse), tokens `motion`/`opacity`,
   `stonesFromSetup`, dev screen with size control + scenario boards (display-only), Settings dev row,
   i18n keys. ACs 1–20, 46–48, 53, 62–63.
2. **PR 2 — touch & feedback** (item 2, part 1): responder overlay, ghost, drag, cancel, illegal ring,
   crosshair + tag, last-move dot, accessibility per point + announcements, dev screen interactive
   (play, scenarios, undo/reset, toggles, message). ACs 21–34, 42–45, 49–52, 54–56.
3. **PR 3 — motion & sound** (item 2, part 2): placement + capture animation, reduced motion,
   `expo-audio`, `sound.ts`, asset + license. ACs 35–41.
4. **PR 4 — web verification** (item 3): Playwright run at 360×740, screenshots in
   `docs/screenshots/M2/`, web-only fixes, STATUS update. ACs 57–61.
Each PR description shows the scenario diagrams with ✓ for the PO.

## 11. Out of scope
Pinch-zoom/pan or magnifier loupe for 13×13/19×19; hover preview with a mouse on web; haptics;
"tap twice to confirm" setting; territory/ownership marks and dead-stone marking (M5); move numbers on
stones; explanation step playback (M3); persisted settings/mute store (M3/M6 — M2 only has the
`sound` prop); capture or reward sounds (M3); dark mode; tablet/landscape layouts beyond the 480 px
cap; alternative board skins; pass/resign buttons; the bot.

## 12. Product-owner decisions (approved 2026-10-16)
1. 7×7 star points: **center only** (d4).
2. Last-move marker: **small filled dot**.
3. Coordinates: the component keeps `showCoordinates` default `true` (demo screen), but in lessons
   coordinates are **shown only in the first lesson**; all later lessons set them off (M3 JSON flag).
4. Stone sound: the developer **picks a free CC0 sound first**; the PO may replace it later.

## 13. Correctness check
I checked every position in this spec and in `M2-mockup.html` by hand, listing each stone's
orthogonal neighbours:
- **Capture** (5×5): W c3 touches c4 (empty), b3, d3, c2 (B) → 1 liberty; B c4 removes it; B c4 then
  has c5, b4, d4 and c3 → legal capture, 1 stone, no ko (c4 keeps 4 liberties).
- **Ko** (5×5): W c3 touches c4, b3, c2 (B) and d3 (empty) → 1 liberty. B d3 touches c3, d4, e3, d2
  (all W); capturing c3 leaves d3 with exactly one liberty (c3) → single stone takes single stone =
  ko, so W c3 at once is `ko`. W d4 (d5, e4), W e3 (e4, e2), W d2 (d1, e2) all keep 2 liberties, so B d3
  captures only c3. After W a1 and B a5 (both on empty points with free neighbours), W c3 captures d3
  (its only liberty was c3) and keeps liberty d3 → legal.
- **Forbidden** (5×5): W a1 touches a2, b1 (B). B a2 keeps a3, b2; B b1 keeps c1, b2 → nothing is
  captured and a1 would have 0 liberties → `suicide`. W c4 (c5, b4, d4), W d3 (d4, e3, d2) and B c3
  (b3, c2) all have liberties — legal position.
- **Marks** (7×7): B c5 4 liberties; B d4 has d5, c4, d3; W {e3, e4} has e5, f4, f3, e2, d3 → legal.
- **Mockup mid-game** (9×9, B e5 c4 f3 g6 f6 · W c6 g4 d7 f5, 5 vs 4 → White to play): W f5 has g5, f4
  (2); B {f6, g6} has e6, f7, h6, g7, g5; every other stone has ≥ 3 liberties. Ghost W g5 joins f5 and
  g4 into a group with f4, h5, h4, g3 → legal.
- **Mockup liberties** (5×5, B c3 d3, W c4): black group liberties b3, c2, d4, e3, d2 = 5.
- **Mockup 19×19** (B q16 d4 f17 · W d16 q4, White to play): every stone has 4 liberties; ghost W q6 is
  empty and legal.
- Geometry numbers in AC 4–6 and 31 recomputed from `cell = 328 / (size − 1 + 2·margin)`.
