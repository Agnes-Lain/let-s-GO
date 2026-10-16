# M3 — Lesson framework (`src/lessons`, `src/exercises`, `src/store`, `app/`)

Covers all five M3 roadmap items: lesson JSON schema + validator + loader; explanation player;
exercise runners (tap-point, play-move, choice, count); progress store (stars, unlocks); home /
unit map screen. Visual mockup for approval: `docs/specs/M3-mockup.html`.
Status: **draft for product-owner approval** (no code written).

## 0. In plain words (for the product owner)
- M3 builds **the machine that runs every lesson**. After M3 you can open the app on your iPhone,
  tap a lesson on the map, read 3 short board "slides", do 6 small exercises, and get 1–3 stars.
  Real Unit 1–5 content comes in M4; M3 ships **one small sample lesson** (§9) so the whole
  machine can be tried. In your Expo Go build the sample appears as the first node on the map; the
  public release hides it.
- **A lesson is a data file (JSON)**, not code. A checker (the "validator") reads each file and
  refuses mistakes *before* a learner sees them: a stone on a point that does not exist, an exercise
  with no right answer, a missing French sentence. The checker even **plays the exercise itself** with
  the rules engine to prove it can be solved.
- **Explanation = a few board slides.** Each slide has one sentence and a board; some slides play a
  move for you (a stone appears, captured stones fade away). Back / Next / Replay. No quiz in it.
- **Four kinds of exercise**, all on a small board with the same calm look:
  1. *tap-point* — "tap the last liberty (气 qì)". One tap, or "tap all of them" then Check.
  2. *play-move* — "capture the white stone". You place a stone; the rules engine judges it.
  3. *choice* — "can Black capture it in one move?" 2–4 answer buttons.
  4. *count* — "how many liberties?" You pick a number 0–9 and press Check.
- **Gentle failure, never "wrong!"**: 1st mistake → a short reason computed from the real position
  ("Nothing was captured — a group is captured when its last liberty is filled"). 2nd mistake → the
  hint appears by itself. 3rd mistake → the app **shows the answer** and moves on. You can always
  open the hint yourself; that only costs the "first try" bonus.
- **Stars (1–3) per lesson**: 3★ = at least 80 % right on the first try; 2★ = at least 80 % right in
  the end; 1★ = at least half right in the end. Finishing with 1★ **unlocks the next unit**.
  Stars never go down when you replay.
- **Progress is saved on the phone** (no account). Leaving a lesson half-way does not save anything
  (a set takes 3–5 minutes). See open question 1: the storage library named in the roadmap (MMKV)
  probably does **not** run in the App Store Expo Go that you test with.
- **Home becomes the map**: a vertical path of unit cards — done (stars), available, locked,
  "coming soon" — and one big *Continue* button.

## 1. Goal
A learner can open the app, walk through a complete lesson (explanation → practice set → stars),
see progress and the next unlock on a map, and an author can add a lesson by dropping in one
validated JSON file plus its texts — with no screen code.

## 2. User stories
- As a beginner, I want each lesson to show the idea on a small board with one sentence at a time,
  so that I never face a wall of text.
- As a beginner, I want to replay what happened on a slide (a stone being captured), so that I can
  see it again without leaving the lesson.
- As a beginner, I want the practice to tell me **why** a move did not work, in my language, so that
  I learn the rule instead of just being told "wrong".
- As a beginner, I want a hint when I am stuck, and the answer after three tries, so that I never
  get trapped on one exercise.
- As a beginner, I want to see my stars and which unit comes next, so that I feel progress and know
  what to do next without thinking.
- As a beginner, I want a locked unit to explain that I must finish the previous one, so that I do not
  think the app is broken.
- As a returning learner, I want a *Continue* button on the home screen, so that I resume in one tap.
- As a learner who replays a lesson, I want my best stars kept, so that practising never "loses"
  progress.
- As a learner using VoiceOver/TalkBack or Reduce Motion, I want every step, feedback message and
  star result announced and animations replaced by instant changes.
- As the content author (M4), I want a validator that tells me exactly which line of my JSON is wrong
  (and proves each exercise is solvable), so that I can write Units 1–5 quickly and safely.
- As the product owner, I want the sample lesson on my iPhone to try every exercise type before
  real content exists.

## 3. Delivery order (each item = one PR)
The roadmap lists the progress store 4th; the store is pure logic that the runners' result screen
needs, so it is built **second**. Roadmap ticks stay in roadmap order.

| PR | Roadmap item | Contents | ACs |
|---|---|---|---|
| 1 | Lesson JSON schema + validator + loader | `src/lessons/*` (types, validator, goal checks, solutions, registry, loader, stars/unlock pure functions), sample lesson, i18n keys for the sample | 1–30 |
| 2 | Progress store (stars, unlocks) | `src/store/progress.ts`, storage adapter, persistence | 31–44 |
| 3 | Explanation player | `app/lesson/[id].tsx` + `src/lessons/ExplainPlayer` | 45–58 |
| 4 | Exercise runners | `app/practice/[id].tsx`, `src/exercises/*` (shell, 4 runners, feedback, complete screen). May be split: 4a shell + tap-point + complete screen, 4b play-move, 4c choice + count | 59–96 |
| 5 | Home / unit map screen | `app/index.tsx`, unit-card components, Continue, locked/soon states, web verification | 97–112 |
| all | Quality | lint / typecheck / tests / i18n parity | 113–116 |

## 4. Lesson model

### 4.1 Where things live
```
src/lessons/
  schema.ts        types below (no runtime deps)
  validate.ts      validateLesson(), validateCatalog()  — pure, uses src/engine only
  goals.ts         goalMet(), getSolution()             — pure, uses src/engine only
  stars.ts         STAR_RULES, computeStars()           — pure
  unlock.ts        isUnlocked(), nextNode()             — pure
  registry.ts      static imports of content/*.json (Metro needs static requires)
  loader.ts        loadLesson(), listLessons(), getUnits()
  content/u00-sample.json
```
`src/lessons` may import `@/engine` and nothing from React / React Native / Expo.
`src/exercises` (runners) may import React, `@/board`, `@/lessons`, `@/engine`.

### 4.2 TypeScript types (`src/lessons/schema.ts`)
```ts
import type { Color, Vertex } from '@/engine';

/** M3 supports 5, 7 and 9. 13 / 19 are added by the milestone that first needs them. */
export type LessonSize = 5 | 7 | 9;
/** An i18n key; the text must exist in zh-CN, en and fr. */
export type TextKey = string;

export interface Setup { B?: Vertex[]; W?: Vertex[] }          // lowercase vertices: 'c3'
export interface PositionDef { size: LessonSize; setup: Setup }

export type HighlightDef = { kind: 'liberty' | 'hint' | 'success' | 'error'; points: Vertex[] };
export type MarkerDef =
  | { kind: 'circle' | 'triangle' | 'square' | 'cross'; at: Vertex }
  | { kind: 'label'; at: Vertex; text: string };               // 1–2 characters
export interface MoveDef { color: Color; at: Vertex }

export interface Lesson {
  schema: 1;
  /** 'u' + 2-digit unit + '-' + slug, e.g. 'u04-capture'. Must start with 'u'+String(unit).padStart(2,'0'). */
  id: string;
  /** 0 = developer sample (hidden in production builds). 1–16 = curriculum units. */
  unit: number;
  /** 'lesson' = explain + practice set; 'checkpoint' = practice set only, mixes earlier concepts. */
  kind: 'lesson' | 'checkpoint';
  titleKey: TextKey;
  /** Show coordinates (A–T, 1–n) on every board of this lesson. Default false (PO decision M2 §12.3:
   *  only the very first lesson sets true). */
  coordinates?: boolean;
  /** 'lesson': 2–4 steps. 'checkpoint': omitted or []. */
  explain?: ExplainStep[];
  /** 5–10 exercises, played in the authored order (no shuffling in M3). */
  exercises: Exercise[];
}

export interface ExplainStep {
  /** Required on the first step. Omitted = continue from the END position of the previous step. */
  board?: PositionDef;
  /** Played automatically, in order, ~500 ms apart, when the step is entered (and on Replay).
   *  Each move must be legal; colours need not alternate. */
  moves?: MoveDef[];
  /** Drawn on the step's START position; hidden once the first move starts playing. */
  highlights?: HighlightDef[];
  /** Drawn on the board for the whole step. */
  markers?: MarkerDef[];
  textKey: TextKey;                    // one or two sentences
}

interface ExerciseBase extends PositionDef {
  /** Unique within the lesson: [a-z0-9-]+ . Used for testIDs and results. */
  id: string;
  promptKey: TextKey;                  // the question / task, one sentence
  hintKey?: TextKey;
  /** Points that pulse (amber ring) when the hint is shown. Must be a subset of the solution points. */
  hintPoints?: Vertex[];
  /** Shown after a correct answer and when the answer is revealed ("why"). */
  explainKey?: TextKey;
  markers?: MarkerDef[];               // permanent marks on the exercise board
}

export interface TapPointExercise extends ExerciseBase {
  type: 'tap-point';
  /** 'one': the first tap is judged at once; any point in the answer is correct.
   *  'all': the learner toggles points, then presses Check; the set must equal the answer. */
  mode: 'one' | 'all';
  answer: { points: Vertex[] } | { libertiesOf: Vertex };   // libertiesOf = engine-computed liberties of that group
}

export type Goal =
  | { kind: 'point'; points: Vertex[] }                // the move must be one of these points
  | { kind: 'capture'; min?: number }                  // captures ≥ min stones (default 1)
  | { kind: 'atari' }                                  // afterwards ≥ 1 opponent group has exactly 1 liberty
  | { kind: 'connect'; a: Vertex; b: Vertex }          // afterwards stones a and b are in one group
  | { kind: 'save'; target: Vertex };                  // afterwards the group containing target has ≥ 2 liberties

export interface PlayMoveExercise extends ExerciseBase {
  type: 'play-move';
  toPlay: Color;
  goal: Goal;
}

export interface ChoiceOption { textKey: TextKey; correct?: boolean; whyKey?: TextKey }
export interface ChoiceExercise extends ExerciseBase {
  type: 'choice';
  options: ChoiceOption[];             // 2–4, exactly one with correct: true; shown in authored order
}

export interface CountExercise extends ExerciseBase {
  type: 'count';
  answer: number | { libertiesOf: Vertex };  // integer 0–9
}

export type Exercise = TapPointExercise | PlayMoveExercise | ChoiceExercise | CountExercise;
```
`sequence` and `play-bot` are **not** part of M3 (M5 / M4). The validator rejects unknown
`type`s with `UNKNOWN_TYPE`, so adding a runner later is a deliberate change.

### 4.3 Derived data (computed, never authored)
`getSolution(exercise)` (pure, in `goals.ts`) returns what the runner needs for checking and for the
"show the answer" moment:

| Exercise | Solution |
|---|---|
| tap-point | `{ points }` (resolves `libertiesOf` with the engine) |
| play-move | `{ points }` = **every legal move** of `toPlay` that meets the goal (engine `play` + `goalMet`) |
| choice | `{ index }` of the correct option |
| count | `{ value }` (resolves `libertiesOf`; counts distinct liberties of the group) |

`goalMet(goal, before: GameState, result: PlayResult & {ok:true}): boolean` uses `MoveFacts`
(`captured`, `opponentAtari`, `playedGroup`) and `groupAt` / `liberties`. "Group of `target` after the
move" for `save` and `connect` reads the board in `result.state`.

### 4.4 Validation rules and error messages
`validateLesson(input: unknown, ctx?: ValidationContext): { ok: true; lesson: Lesson } | { ok: false; errors: LessonError[] }`
```ts
export interface ValidationContext { hasText?: (key: string, lang: 'zh-CN' | 'en' | 'fr') => boolean }
export interface LessonError { code: string; path: string; message: string }   // path like 'exercises[2].goal'
```
- Reports **all** errors (up to 50), not just the first. Messages are English, aimed at authors
  (not translated). `{…}` below are filled in. Without `ctx.hasText` the text-key rules are skipped
  (schema-only mode); the content test (AC 28) always passes the real i18n resources.
- Unknown properties anywhere are an error (typo protection).

| Code | When | Message |
|---|---|---|
| `NOT_OBJECT` | input is not a plain object | `lesson must be a JSON object` |
| `UNKNOWN_FIELD` | property not in the schema | `unknown field "{name}" (typo?)` |
| `MISSING_FIELD` | required property absent | `"{name}" is required` |
| `BAD_TYPE` | wrong JS type | `"{name}" must be {expected}` |
| `BAD_SCHEMA` | `schema !== 1` | `unsupported schema version {n}; expected 1` |
| `BAD_ID` | id fails `^u\d{2}-[a-z0-9]+(-[a-z0-9]+)*$` | `id "{id}" must look like "u04-capture"` |
| `ID_UNIT_MISMATCH` | id prefix ≠ unit | `id "{id}" must start with "{u04}" to match unit {unit}` |
| `BAD_UNIT` | unit not an integer 0–16 | `unit must be an integer from 0 to 16` |
| `BAD_KIND` | kind not lesson/checkpoint | `kind must be "lesson" or "checkpoint"` |
| `BAD_STEP_COUNT` | lesson ≠ 2–4 steps; checkpoint ≠ 0 | `explain must have 2 to 4 steps, found {n}` / `a checkpoint has no explain steps` |
| `BAD_EXERCISE_COUNT` | not 5–10 | `exercises must have 5 to 10 items, found {n}` |
| `STEP_NO_BOARD` | first step has no `board` | `the first explain step needs a "board"` |
| `UNKNOWN_TYPE` | exercise.type not one of the 4 | `unknown exercise type "{type}"` |
| `DUPLICATE_ID` | two exercises share an id | `exercise id "{id}" is used twice` |
| `BAD_SIZE` | size not 5, 7, 9 | `board size {n} is not supported (use 5, 7 or 9)` |
| `BAD_VERTEX` | not a valid point of that board (`parseVertex`) | `"{v}" is not a point on a {n}×{n} board (columns a–{last}, no "i"; rows 1–{n})` |
| `SETUP_OVERLAP` | a vertex listed twice | `"{v}" appears more than once in the setup` |
| `SETUP_DEAD_GROUP` | a setup group has 0 liberties | `the stones around "{v}" have no liberties in the starting position` |
| `MOVE_ILLEGAL` | explain move not legal when played | `move {color} {v} is illegal here: {engine reason}` |
| `BAD_LABEL` | label text empty or > 2 chars | `label text must be 1–2 characters` |
| `MISSING_TEXT` | key missing / empty in a language | `text "{key}" is missing in: {zh-CN, fr}` |
| `EMPTY_ANSWER` | tap-point has no answer points | `answer has no points` |
| `TARGET_NOT_STONE` | `libertiesOf` / `connect` / `save` target is not a stone | `"{v}" must be a stone` |
| `NO_SOLUTION` | no legal move meets the goal | `no legal move for {color} meets goal "{kind}"` |
| `ALREADY_TRUE` | goal already true before any move (`connect` already one group; `save` target already ≥ 2 liberties) | `goal "{kind}" is already true in the starting position` |
| `GOAL_POINT_ILLEGAL` | goal `point` lists a point where `toPlay` has no legal move | `goal point "{v}" is not a legal move` |
| `GOAL_SAME_COLOR` | `connect` stones differ in colour / `save` target is not `toPlay`'s colour | `"{a}" and "{b}" must be the same colour` / `"{v}" must be a {color} stone` |
| `BAD_HINT` | `hintPoints` not a subset of the solution points | `hintPoints must be among the solution points {list}` |
| `BAD_OPTION_COUNT` | choice has < 2 or > 4 options | `a choice needs 2 to 4 options, found {n}` |
| `BAD_CORRECT_COUNT` | not exactly one `correct: true` | `exactly one option must have "correct": true, found {n}` |
| `BAD_COUNT_ANSWER` | count answer not an integer 0–9 (also after resolving `libertiesOf`) | `count answer must be an integer from 0 to 9, got {n}` |

`validateCatalog(lessons: Lesson[])` adds:

| Code | When | Message |
|---|---|---|
| `DUPLICATE_LESSON` | two lessons share an id | `lesson id "{id}" is used twice` |
| `UNIT_LESSON_COUNT` | a unit has ≠ 1 `lesson` or > 1 `checkpoint` | `unit {n} must have exactly one lesson and at most one checkpoint` |
| `CHECKPOINT_ORDER` | checkpoint whose unit has no `lesson` | `checkpoint "{id}" needs a lesson in unit {n}` |

Content-quality rule (checked by the content test, not by the runtime validator, because it is a
style rule): every step/prompt/hint/explain/why text is ≤ 160 characters in en and fr and ≤ 70
characters in zh-CN (the 120 px text card fits 4 lines at 16/24).

### 4.5 Loader (`loader.ts`)
```ts
type LoadResult =
  | { ok: true; lesson: Lesson }
  | { ok: false; reason: 'not-found' | 'invalid'; errors?: LessonError[] };
loadLesson(id: string): LoadResult;                       // validates once per id, caches; never throws
listLessons(opts?: { includeDev?: boolean }): Lesson[];   // sorted by unit, then lesson before checkpoint; unit 0 only if includeDev
getUnits(opts?: { includeDev?: boolean }): UnitEntry[];   // see 4.6
```
`includeDev` defaults to `__DEV__` (the Expo Go build). In a production build `unit: 0` lessons are
neither listed nor loadable (`not-found`).

### 4.6 Units and the map data
```ts
interface UnitEntry {
  unit: number;                       // 0..16
  titleKey: TextKey;                  // from the lesson, or 'unit.N.title' for a planned unit
  lesson: Lesson | null;              // null = planned, no content yet → "coming soon"
  checkpoint: Lesson | null;
}
```
Planned units shown as "coming soon" in M3: **1–6** (`unit.1.title` … `unit.6.title`). Units 7–16 are
not listed; a caption says more are coming (existing `home.moreSoon`). When M4 adds a real
`u01-…` lesson, unit 1 stops being "coming soon" automatically.

## 5. Star, hint and unlock rules

### 5.1 Exercise outcomes
| Outcome | Meaning |
|---|---|
| `clean` | solved on the first attempt and the Hint button was never pressed |
| `solved` | solved eventually (a wrong attempt, or the hint was used), without the answer being shown |
| `revealed` | 3 failed attempts → the app showed the answer |

Attempt policy (all four exercise types; N = number of exercises):
1. **1st wrong attempt** → gentle message with the reason (§7.3); the learner may try again.
2. **2nd wrong attempt** → message again **and** the hint opens by itself (hint text + amber pulse
   on `hintPoints`, 3 cycles) if the exercise has a `hintKey`.
3. **3rd wrong attempt** → the answer is shown: `success` ring on every solution point (for count:
   the liberties are ringed and the number is shown), `explainKey` text, outcome `revealed`, one
   button *Next*. No red, no sound.
- `choice` allows `min(3, options − 1)` attempts: with 2 options one wrong tap reveals; with 3
  options 2 wrong taps reveal. (Otherwise the last option would be won by elimination.)
- **Not counted as attempts**: touches on illegal points (occupied, suicide, ko) in play-move — the
  engine message appears, the board does not change; and tap-all *Check* with nothing selected
  (button is disabled).
- **Hint button** (always visible, top bar): first tap opens the hint (text + pulse). It can never
  produce `clean` afterwards. It does not count as an attempt. Second tap does nothing.
- A **correct** attempt stops the exercise at once: `clean` if no wrong attempt and no hint,
  otherwise `solved`.

### 5.2 Stars per lesson (`stars.ts`, constants in one place so the PO can tune them)
```ts
export const STAR_RULES = { threeClean: 0.8, twoSolved: 0.8, oneSolved: 0.5 } as const;
// clean = count('clean'), solved = count('clean') + count('solved'), N = outcomes.length
// 3★ if clean  * 5 >= N * 4          (≥ 80 % first-try)
// 2★ if solved * 5 >= N * 4          (≥ 80 % in the end)
// 1★ if solved * 2 >= N              (≥ 50 % in the end)
// else 0★
```
Examples for N = 6: 6 clean → 3★ · 5 clean + 1 revealed → 3★ · 4 clean + 2 solved → 2★ ·
4 clean + 1 solved + 1 revealed → 2★ (5 of 6 solved) · 3 clean + 3 revealed → 1★ (3 of 6) ·
2 clean + 2 solved + 2 revealed → 1★ · 1 clean + 1 solved + 4 revealed → 0★. For N = 5: 4 clean =
3★ (4×5 ≥ 5×4). The integer comparison avoids float error. The full table is AC 31.
0★ is not "failure": the screen offers *Review the lesson* (gentle) and the next unit stays locked.

### 5.3 Unlocks (derived, never stored — content grows in M4/M5)
- A **unit** is unlocked if it is the first listed unit, or the previous *listed unit that has a
  lesson* has ≥ 1★ on its `lesson`. Planned units without content are never unlocked ("coming soon").
- A **checkpoint** is unlocked when its unit's `lesson` has ≥ 1★. A checkpoint does **not** gate the
  next unit (open question 4).
- Stars are the best ever; a replay never lowers them. A replay is always allowed on an unlocked node.
- `unit: 0` (sample) is always unlocked in dev builds and does not gate Unit 1.

### 5.4 Game-design notes
- **Curve**: exercise 1 is a near-certain win (≈ 95 %: the answer is on the board), exercises 2–3
  add one small twist, 4–5 are the real test of the concept, the last one is the same concept in a
  new shape. Target ≈ 80 % first-try success (the 3★ line). Checkpoints (M4) mix the new concept with
  earlier ones; the framework only needs `kind: 'checkpoint'` and no explain steps.
- **Session length 3–5 minutes**: 2–4 explanation steps (~20 s each) + 5–10 exercises (~25 s each).
- **Reward moments** (calm, ≤ 300 ms each): stone "tock" (already in `<GoBoard>`), capture fade, green
  success ring + *Correct!*, stars appear one by one 250 ms apart with a soft "tock" each (the M2
  stone sound at the same volume; silent if sound is off), unit-unlocked line. **No** confetti, no
  bounce, no red flash, no error sound.
- **Feedback rule** (M1/M2 principle): every wrong answer states a *fact about the position* produced
  from `MoveFacts` / liberties, never just "wrong". Copy is in §7.3.
- **After 3 failures** the answer is shown and the learner moves on — nobody is stuck.

## 6. Screen flow & UI (360 × 740, tap targets ≥ 44 px)

```
Home (map) ──tap available unit──▶ /lesson/[id]  (explanation, steps 1…n)
   ▲                                    │ last step "Start practice"
   │ ✕ / Back to map                    ▼
   └──────────────────────────────── /practice/[id]  exercises 1…N ──▶ result (stars) ──┬─▶ Next lesson (/lesson/[next])
                                                                                          ├─▶ Review the lesson (0★) (/lesson/[id])
                                                                                          └─▶ Back to map
```
The result screen is a state of `/practice/[id]`, not a separate route. Android hardware back and
the iOS swipe-back behave like ✕ (§6.5). Existing placeholder routes `app/lesson/[id].tsx` and
`app/practice/[id].tsx` are replaced; the M0 placeholder strings may be removed.

### 6.1 Home / unit map `app/index.tsx`
Keeps the existing header (gear → Settings, logo stones, name, subtitle) and mist/mountain backdrop.
```
┌──────────────────────────────────────┐
│ 9:41                                 │
│                               [ ⚙ ]  │ 52  top bar (existing)
│          ●○   Let's GO               │     logo 72×56 → shrinks to 56×44 on this screen
│  Learn Go (围棋 wéiqí) from zero …    │
│ ┌──────────────────────────────────┐ │
│ │ ▶  Continue                      │ │ 56  primary card (accent bg): "Continue" + unit title
│ │    Unit 3 · Connection           │ │     hidden if nothing is left to continue
│ └──────────────────────────────────┘ │
│  Learning path                       │ 28  section title
│  ●─┌────────────────────────────┐    │
│  │ │ Unit 1 · Board & stones    │    │ 72  node card: stone-dot (44) + caption + title + stars
│  │ │ ★ ★ ★                  ›   │    │     (done: black stone, ★ amber)
│  ●─└────────────────────────────┘    │
│  │ ┌────────────────────────────┐    │
│  ○─│ Unit 2 · Liberties   ★ ★ ☆ │    │     (white stone with teal ring = available)
│  │ └────────────────────────────┘    │
│  ◌─  Unit 3 · Connection    🔒    │     locked: grey outline stone, 50 % opacity, lock icon
│  ◌─  Unit 6 · Capture Go  [Soon]  │     coming soon: grey, badge (existing token color.badge)
│      More units coming soon          │
└──────────────────────────────────────┘
```
Node states:
| State | Stone dot | Right side | Pressable |
|---|---|---|---|
| done (≥ 1★) | black stone | ★ row (amber `hint` color filled / `border` empty) + chevron | yes → `/lesson/[id]` |
| available (0★, unlocked) | white stone, 2 px `accent` ring | chevron | yes |
| locked | white stone outline `border`, 50 % opacity | lock icon | yes → shows snackbar `home.locked.hint`, no navigation |
| coming soon | same as locked | badge `home.unit.comingSoon` | no (not a button) |
| checkpoint | small stone (28) on the same path, indented, caption `home.checkpoint.label` | like the above | like the above |
A thin vertical `border`-colored line connects the dots. Dev sample node is labelled
`home.sample.label` (caption) and is only rendered when `__DEV__`.
- **Loading** (storage not read yet): node cards render as neutral skeleton bars (no locked/available
  flash), < 100 ms normally. **Empty**: nothing else — a fresh install is just "all 0★".
- The list scrolls; nothing else on the screen scrolls horizontally.

### 6.2 Explanation player `app/lesson/[id].tsx`
```
┌──────────────────────────────────────┐
│ 9:41                                 │
│ [✕]        ● ○ ○          [Skip ›]   │ 52  close · step dots · "Skip to practice" (only if ≥1★)
│ ┌──────────────────────────────────┐ │
│ │                                  │ │
│ │        bamboo board 328×328      │ │ 328 display-only (not interactive)
│ │                                  │ │
│ └──────────────────────────────────┘ │
│ ┌──────────────────────────────────┐ │ 120 text card (4 lines at 16/24 + padding), surface, 1 px border
│ │ The empty points next to a stone │ │
│ │ are its liberties (气 qì). This  │ │
│ │ white stone has just one.        │ │
│ └──────────────────────────────────┘ │
│  [ ↻ Replay ]  (only if step has moves, 44 px, text button, right-aligned)
│ [   ‹ Back   ]   [   Next ›   ]     │ 48  Back secondary (hidden on step 1), Next primary
└──────────────────────────────────────┘
```
- On entering a step the board shows the step's start position (+ highlights); if `moves` exist they
  play after 500 ms, one every 500 ms, using the board's own stone-place and capture animation and
  sound; highlights fade out when the first move starts.
- *Back* shows the previous step's **final** position without animation. *Replay* restarts the
  current step from its start position.
- Last step: *Next* is replaced by *Start practice* → `/practice/[id]`.
- *Skip* shows only when the lesson already has ≥ 1★ (never hides teaching from a first-timer).
- ✕ returns to the map immediately (nothing to lose).

### 6.3 Exercise runner `app/practice/[id].tsx` — common shell
```
┌──────────────────────────────────────┐
│ 9:41                                 │
│ [✕]  ▬▬▬ ▬▬▬ ▭▭▭ ▭▭▭ ▭▭▭ ▭▭▭  [Hint] │ 52  close · N progress segments · hint button (44×44 min)
│ ┌──────────────────────────────────┐ │ 72  prompt card (surface), up to 3 lines
│ │ Capture the white stone.         │ │
│ └──────────────────────────────────┘ │
│ ┌──────────────────────────────────┐ │
│ │        bamboo board 328×328      │ │ 328 interactive per type (§6.4)
│ └──────────────────────────────────┘ │
│ ┌──────────────────────────────────┐ │ 72  feedback card, space always reserved (no jump)
│ │ ● Nothing was captured. …        │ │     dot color: error / success / hint
│ └──────────────────────────────────┘ │
│ [      Try again / Check / Next    ] │ 48  ONE primary button; absent when nothing to confirm
└──────────────────────────────────────┘
```
Progress segments: done = `accent`, current = `accent` outline, upcoming = `border`; segment color
is **not** changed to red/green by outcome (calm). Board width follows M2's rule
(`min(window width − 32, free height, 480)` → 328 here; ≈ 300 on a 375×667 SE; for `count` the chip rows
may reduce it to ≈ 296 at 360×740 — the screen does not scroll).

The feedback card states:
| State | Dot | Text | Primary button |
|---|---|---|---|
| neutral (start) | — | empty | none (or *Check* for tap-all / count, disabled until input) |
| correct | `success` | `fb.correct` + optional `explainKey` | *Next* (*Finish* on the last exercise) |
| wrong | `error` | reason (§7.3) | *Try again* (play-move: board locked until pressed); none for tap-one/choice (just tap again) |
| hint | `hint` | `hintKey` text | unchanged |
| revealed | `success` | `fb.revealed` + `explainKey` | *Next* |

### 6.4 Per-type behaviour
**tap-point, mode `one`**: touch-down shows a **ring** (not a stone) on the nearest point, touch-up
commits; every intersection is tappable, including occupied ones. Judged at once.
**tap-point, mode `all`**: tap toggles a point (selected = `liberty` highlight). *Check* (disabled
while nothing is selected) judges the set. Wrong → points that are **not** in the answer flash an
`error` ring (700 ms) and are deselected; correctly selected points stay selected; message says how
many were found.
**play-move**: normal `<GoBoard interactive playerColor={toPlay}>` ghost-then-commit. A legal move is
played with the engine; the stone, sound and any capture animation happen; then `goalMet` decides.
Wrong → the position stays visible with a dashed `error` ring on the played stone, board locked, the
message + *Try again* (resets the board to the setup). Illegal → engine message (`engine.illegal.*`),
no change, no attempt used.
**choice**: board display-only with the exercise's markers (A, B …), shrunk to ≈ 240 px (≥ 220) to
make room for the options. Options are full-width buttons (min 48 px high, 8 px apart) under the
board; the 72 px feedback card sits under the options. A wrong option becomes disabled/greyed with
its `whyKey` shown in the feedback card; the correct one gets a `success` outline.
**count**: board display-only; below it two rows of number chips 0–9 (5 per row, ≥ 56×44 each) and
*Check*. Selecting a chip highlights it; *Check* judges. On reveal, the group's liberties are ringed
(`success`) and the right chip is outlined.

### 6.5 Leaving mid-way
✕, Android back and the iOS back gesture open a small bottom sheet: title `practice.leave.title`,
body `practice.leave.body`, buttons *Keep going* (primary) and *Leave* (secondary, returns to the map
and records nothing). The explanation player has no such sheet.

### 6.6 Result screen (state of `/practice/[id]`)
```
┌──────────────────────────────────────┐
│ 9:41                                 │
│                                      │
│              ★   ★   ★               │ 3 × 56 px stars, amber `hint` color; empty = `border`
│             Calm and precise         │ title (display 28)
│       6 of 6 right the first time    │ summary (body)
│   ┌──────────────────────────────┐   │
│   │ Unit 2 unlocked              │   │ 44, badge style; only when a unit newly unlocks
│   └──────────────────────────────┘   │
│                                      │
│ [        Next lesson  ›          ]   │ 48 primary
│ [       Practice again           ]   │ 48 secondary
│ [        Back to map             ]   │ 44 text button
└──────────────────────────────────────┘
```
- 0★ variant: no stars filled, title `complete.title.0`, body `complete.body.0`, primary *Review the
  lesson* (→ `/lesson/[id]`), secondary *Try again*, text *Back to map*.
- Primary is *Next lesson* when an unlocked next node exists (the next unit's lesson, or this unit's
  checkpoint), else *Back to map*.
- If this run scored fewer stars than the learner's best, add a caption `complete.best`.
- The result is recorded in the store **once**, when the last exercise is finished (not when the
  screen re-renders).

### 6.7 Error / missing states
`/lesson/xyz` or an invalid / dev-only lesson, and a locked lesson opened by URL: a calm screen with
title `error.lesson.title`, body `error.lesson.body` (or `error.locked.body` for locked), one button
*Back to map*. Never a crash or red screen.

## 7. Copy keys (zh-CN / en / fr)
All text through i18n; zh-CN, en and fr must have **identical key sets**; no hard-coded user-facing
string in `app/` or `src/exercises`. No plural forms (interpolated numbers only).
Chinese term + pinyin on first use (done in the unit titles and the sample texts).

### 7.1 UI keys
| Key | zh-CN | en | fr |
|---|---|---|---|
| home.continue | 继续学习 | Continue | Continuer |
| home.start | 开始学习 | Start learning | Commencer |
| home.unit.label | 第 {{n}} 单元 | Unit {{n}} | Unité {{n}} |
| home.checkpoint.label | 阶段检测 | Checkpoint | Point d'étape |
| home.sample.label | 示例（开发用） | Sample (developer) | Exemple (développeur) |
| home.locked.hint | 先完成上一单元，这里就会打开。 | Finish the previous unit to open this one. | Terminez l'unité précédente pour ouvrir celle-ci. |
| home.node.a11y.available | {{label}}，{{title}}，未开始 | {{label}}, {{title}}, not started | {{label}}, {{title}}, pas commencé |
| home.node.a11y.done | {{label}}，{{title}}，{{stars}} 颗星（共 3 颗） | {{label}}, {{title}}, {{stars}} of 3 stars | {{label}}, {{title}}, {{stars}} étoiles sur 3 |
| home.node.a11y.locked | {{label}}，{{title}}，未解锁 | {{label}}, {{title}}, locked | {{label}}, {{title}}, verrouillé |
| home.node.a11y.soon | {{label}}，{{title}}，即将推出 | {{label}}, {{title}}, coming soon | {{label}}, {{title}}, bientôt disponible |
| home.allDone | 目前的内容都学完了，更多单元即将推出。 | You've finished everything available. More units soon! | Vous avez tout terminé pour l'instant. D'autres unités arrivent ! |
| unit.1.title | 棋盘与棋子 | Board & stones · 棋盘 qípán | Plateau et pierres · 棋盘 qípán |
| unit.2.title | 气 | Liberties · 气 qì | Libertés · 气 qì |
| unit.3.title | 连接 | Connection · 连接 liánjiē | Connexion · 连接 liánjiē |
| unit.4.title | 提子 | Capture · 提子 tízǐ | Capture · 提子 tízǐ |
| unit.5.title | 叫吃与逃跑 | Atari & escape · 叫吃 jiàochī | Atari et fuite · 叫吃 jiàochī |
| unit.6.title | 吃子棋 | Capture Go · 吃子棋 chīzǐqí | Jeu de capture · 吃子棋 chīzǐqí |
| lesson.close | 关闭 | Close | Fermer |
| lesson.next | 下一步 | Next | Suivant |
| lesson.back | 上一步 | Back | Précédent |
| lesson.replay | 重播 | Replay | Rejouer |
| lesson.skip | 跳到练习 | Skip to practice | Aller aux exercices |
| lesson.startPractice | 开始练习 | Start practice | Commencer les exercices |
| lesson.step.a11y | 第 {{current}} 步，共 {{total}} 步 | Step {{current}} of {{total}} | Étape {{current}} sur {{total}} |
| practice.progress.a11y | 第 {{current}} 题，共 {{total}} 题 | Exercise {{current}} of {{total}} | Exercice {{current}} sur {{total}} |
| practice.hint | 提示 | Hint | Indice |
| practice.check | 确认 | Check | Vérifier |
| practice.next | 下一题 | Next | Suivant |
| practice.finish | 完成 | Finish | Terminer |
| practice.tryAgain | 再试一次 | Try again | Réessayer |
| practice.leave.title | 要离开练习吗？ | Leave practice? | Quitter les exercices ? |
| practice.leave.body | 离开后，这一组练习的进度不会保存。 | Your progress in this set won't be saved. | Votre progression dans cette série ne sera pas enregistrée. |
| practice.leave.stay | 继续练习 | Keep going | Continuer |
| practice.leave.confirm | 离开 | Leave | Quitter |
| practice.count.chip.a11y | 选择数字 {{n}} | Choose {{n}} | Choisir {{n}} |
| complete.title.3 | 沉着精准 | Calm and precise | Calme et précis |
| complete.title.2 | 做得好 | Well done | Bien joué |
| complete.title.1 | 过关了，良好的开始 | Passed — a good start | Réussi — un bon début |
| complete.title.0 | 还差一点 | Not quite yet | Pas tout à fait |
| complete.summary | 一次就答对 {{clean}} 题（共 {{total}} 题） | {{clean}} of {{total}} right the first time | {{clean}} sur {{total}} du premier coup |
| complete.body.0 | 你自己答对了 {{solved}} 题（共 {{total}} 题）。回头看看讲解，再来一次吧。 | You solved {{solved}} of {{total}} on your own. A look back at the lesson will help. | Vous avez trouvé {{solved}} sur {{total}} seul. Relire la leçon vous aidera. |
| complete.stars.a11y | 获得 {{stars}} 颗星（共 3 颗） | {{stars}} of 3 stars | {{stars}} étoiles sur 3 |
| complete.best | 最好成绩：{{stars}} 颗星 | Best: {{stars}} of 3 stars | Meilleur : {{stars}} étoiles sur 3 |
| complete.unlocked | 第 {{n}} 单元已解锁 | Unit {{n}} unlocked | Unité {{n}} débloquée |
| complete.next | 下一课 | Next lesson | Leçon suivante |
| complete.again | 再练一次 | Practice again | S'entraîner encore |
| complete.review | 回顾讲解 | Review the lesson | Revoir la leçon |
| complete.map | 回到学习路径 | Back to map | Retour à la carte |
| error.lesson.title | 这一课打不开 | This lesson can't be opened | Cette leçon ne s'ouvre pas |
| error.lesson.body | 课程文件有问题，请更新应用。 | Something is wrong with the lesson file. Please update the app. | Le fichier de la leçon est incorrect. Mettez l'application à jour. |
| error.locked.body | 先完成上一单元才能打开这一课。 | Finish the previous unit to open this lesson. | Terminez l'unité précédente pour ouvrir cette leçon. |

Existing keys kept: `home.subtitle`, `home.path.title`, `home.unit.comingSoon`, `home.moreSoon`,
`common.back`, `engine.illegal.*`. **Removed/renamed**: `home.unit1.title` → `unit.1.title`;
`placeholder.lesson.*`, `placeholder.practice.*` and `placeholder.comingSoon` may be deleted if
`/dev` or not-found no longer use them (developer checks `i18n.test.ts` and the QA tests).

### 7.2 Feedback keys (engine facts → sentence)
| Key | zh-CN | en | fr |
|---|---|---|---|
| fb.correct | 答对了！ | Correct! | Bien joué ! |
| fb.revealed | 答案在这里，看一看再继续。 | Here is the answer. Take a look, then continue. | Voici la réponse. Regardez, puis continuez. |
| fb.tapOne.wrong | 不是这个点，再看一看。 | Not that point. Look again. | Pas ce point. Regardez encore. |
| fb.tapAll.partial | 找到了 {{found}} 个，共 {{total}} 个。再找找看。 | {{found}} of {{total}} found. Keep looking. | {{found}} trouvé(s) sur {{total}}. Cherchez encore. |
| fb.tapAll.extra | 红圈里的点不对，已为你取消。 | The points in red are not right — they were removed. | Les points en rouge ne conviennent pas : ils ont été retirés. |
| fb.pm.noCapture | 没有提到子。对方的棋子被填满最后一口气才会被提走。 | Nothing was captured. A group is captured only when its last liberty is filled. | Rien n'a été capturé. Un groupe n'est capturé que lorsque sa dernière liberté est remplie. |
| fb.pm.captureTooFew | 只提到了 {{n}} 子，这一题要提更多。 | Only {{n}} captured — this exercise needs more. | Seulement {{n}} capturé(s) : il en faut davantage ici. |
| fb.pm.noAtari | 还没有让白棋只剩一口气。 | No enemy group is down to one liberty yet. | Aucun groupe adverse n'est réduit à une seule liberté. |
| fb.pm.notConnected | 这两颗棋子仍然是分开的两块。 | The two stones are still separate groups. | Les deux pierres forment toujours deux groupes séparés. |
| fb.pm.stillAtari | 这块棋仍然只有一口气，还是会被提。 | The group still has only one liberty, so it can still be captured. | Le groupe n'a toujours qu'une liberté : il peut encore être capturé. |
| fb.pm.wrongPoint | 不是题目要的点。 | That is not the point asked for. | Ce n'est pas le point demandé. |
| fb.pm.selfAtari | 小心：你刚下的棋也只剩一口气了。 | Careful: your new stone has only one liberty left too. | Attention : votre pierre n'a plus qu'une liberté elle aussi. |
| fb.choice.wrong | 不太对。 | Not quite. | Pas tout à fait. |
| fb.count.wrong | 不太对。只数紧挨着的空点（上下左右，斜角不算），每个点只数一次。 | Not quite. Count only empty points directly next to the group (not diagonal), each once. | Pas tout à fait. Comptez les points vides directement voisins du groupe (pas en diagonale), chacun une fois. |

Message assembly for play-move: `fb.pm.<goal-specific>`; if `facts.selfAtari` is true on a wrong move,
append `fb.pm.selfAtari` as a second line; for `capture` with 0 < captured < min use
`fb.pm.captureTooFew`. An exercise may override nothing — extra explanation belongs in `explainKey`.

## 8. Accessibility & motion
- Each step / feedback message / star result is announced (`AccessibilityInfo.announceForAccessibility`);
  focus moves to the text card on step change and to the feedback card after an answer.
- Buttons have roles and labels; progress segments are one element with `practice.progress.a11y`;
  stars are one element with `complete.stars.a11y` (the glyphs are decorative).
- Tap targets ≥ 44 px (chips 56×44, options ≥ 48 px high). Prompt text never colour-only: feedback
  has dot + words.
- Reduce Motion: no automatic move playback delay (final position shown, Replay still works as an
  instant redraw), stars appear at once, no pulses (the hint ring is static).
- Board a11y is the M2 per-point labelling; display-only boards expose the summary label only.

## 9. Sample lesson (`src/lessons/content/u00-sample.json`)
Exercises every step form (own board / inherited board / moves / highlights / markers), all four
exercise types, both tap-point modes, `libertiesOf`, goals `capture` and `connect`, `hintPoints`,
`why` texts, 5×5 and 7×7. Goals `atari`, `save`, `point` and sizes 9 are covered by validator
**fixtures** in tests (ACs 14, 16, 17, 74–78), not by shipped content. Sample uses `coordinates: false`.

```json
{
  "schema": 1,
  "id": "u00-sample",
  "unit": 0,
  "kind": "lesson",
  "titleKey": "lesson.u00-sample.title",
  "coordinates": false,
  "explain": [
    {
      "board": { "size": 5, "setup": { "B": ["c2", "b3", "d3"], "W": ["c3"] } },
      "highlights": [{ "kind": "liberty", "points": ["c4"] }],
      "markers": [{ "kind": "triangle", "at": "c3" }],
      "textKey": "lesson.u00-sample.s1"
    },
    {
      "moves": [{ "color": "B", "at": "c4" }],
      "textKey": "lesson.u00-sample.s2"
    },
    {
      "board": { "size": 5, "setup": { "B": ["a3", "b4", "c4", "b2", "c2"], "W": ["b3", "c3"] } },
      "highlights": [{ "kind": "liberty", "points": ["d3"] }],
      "moves": [{ "color": "B", "at": "d3" }],
      "textKey": "lesson.u00-sample.s3"
    }
  ],
  "exercises": [
    {
      "id": "tap-last-liberty", "type": "tap-point", "mode": "one",
      "size": 5, "setup": { "B": ["c2", "b3", "d3"], "W": ["c3"] },
      "answer": { "points": ["c4"] },
      "promptKey": "lesson.u00-sample.e1.prompt",
      "hintKey": "lesson.u00-sample.e1.hint", "hintPoints": ["c4"]
    },
    {
      "id": "tap-all-liberties", "type": "tap-point", "mode": "all",
      "size": 5, "setup": { "B": ["c1"] },
      "answer": { "libertiesOf": "c1" },
      "promptKey": "lesson.u00-sample.e2.prompt",
      "hintKey": "lesson.u00-sample.e2.hint"
    },
    {
      "id": "capture-edge-stone", "type": "play-move", "toPlay": "B",
      "size": 5, "setup": { "B": ["e4", "e2"], "W": ["e3"] },
      "goal": { "kind": "capture" },
      "promptKey": "lesson.u00-sample.e3.prompt",
      "hintKey": "lesson.u00-sample.e3.hint", "hintPoints": ["d3"],
      "explainKey": "lesson.u00-sample.e3.explain"
    },
    {
      "id": "connect-two", "type": "play-move", "toPlay": "B",
      "size": 5, "setup": { "B": ["b3", "d3"], "W": ["c4", "c2"] },
      "goal": { "kind": "connect", "a": "b3", "b": "d3" },
      "promptKey": "lesson.u00-sample.e4.prompt",
      "hintKey": "lesson.u00-sample.e4.hint", "hintPoints": ["c3"]
    },
    {
      "id": "one-move-capture", "type": "choice",
      "size": 5, "setup": { "B": ["b3", "c2"], "W": ["c3"] },
      "markers": [{ "kind": "label", "at": "c4", "text": "A" }, { "kind": "label", "at": "d3", "text": "B" }],
      "promptKey": "lesson.u00-sample.e5.prompt",
      "options": [
        { "textKey": "lesson.u00-sample.e5.o1", "whyKey": "lesson.u00-sample.e5.w1" },
        { "textKey": "lesson.u00-sample.e5.o2", "whyKey": "lesson.u00-sample.e5.w2" },
        { "textKey": "lesson.u00-sample.e5.o3", "correct": true }
      ],
      "explainKey": "lesson.u00-sample.e5.explain"
    },
    {
      "id": "count-group-liberties", "type": "count",
      "size": 7, "setup": { "B": ["d4", "e4"], "W": ["d5"] },
      "markers": [{ "kind": "triangle", "at": "d4" }],
      "answer": { "libertiesOf": "d4" },
      "promptKey": "lesson.u00-sample.e6.prompt",
      "hintKey": "lesson.u00-sample.e6.hint"
    }
  ]
}
```

Sample texts (all go into the three i18n files; ≤ 160 chars en/fr, ≤ 70 zh):
| Key | zh-CN | en | fr |
|---|---|---|---|
| lesson.u00-sample.title | 示例：提子 | Sample: Capture | Exemple : capture |
| …s1 | 棋子旁边的空点叫“气”（qì）。这颗白子只剩一口气。 | The empty points next to a stone are its liberties (气 qì). This white stone has just one. | Les points vides à côté d'une pierre sont ses libertés (气 qì). Cette pierre blanche n'en a plus qu'une. |
| …s2 | 黑棋下在最后一口气上，白子被提走（提子 tízǐ）。 | Black fills the last liberty. The white stone is captured (提子 tízǐ) and removed. | Noir joue sur la dernière liberté. La pierre blanche est capturée (提子 tízǐ) et retirée. |
| …s3 | 相连的棋子是一块，共用气。填满最后一口气，整块都被提走。 | Stones that touch form a group and share their liberties. Fill the last one and the whole group is captured. | Les pierres qui se touchent forment un groupe et partagent leurs libertés. Remplissez la dernière : tout le groupe est capturé. |
| …e1.prompt | 点出白子仅剩的一口气。 | Tap the last liberty of the white stone. | Touchez la dernière liberté de la pierre blanche. |
| …e1.hint | 看看白子四周的四个点，只有一个是空的。 | Look at the four points around the white stone: only one is empty. | Regardez les quatre points autour de la pierre blanche : un seul est vide. |
| …e2.prompt | 点出黑子所有的气，再按“确认”。 | Tap all the liberties of the black stone, then press Check. | Touchez toutes les libertés de la pierre noire, puis appuyez sur Vérifier. |
| …e2.hint | 只数上下左右相邻的点，斜角不算。 | Only the points straight up, down, left and right count — not diagonals. | Seuls comptent les points juste au-dessus, en dessous, à gauche et à droite, pas les diagonales. |
| …e3.prompt | 提掉这颗白子。 | Capture the white stone. | Capturez la pierre blanche. |
| …e3.hint | 它只剩一口气，把它填上。 | It has one liberty left. Fill it. | Il lui reste une liberté. Remplissez-la. |
| …e3.explain | 白子没有气了，所以被提走。 | The stone had no liberties left, so it was captured. | La pierre n'avait plus de liberté : elle est capturée. |
| …e4.prompt | 把两颗黑子连成一块。 | Connect the two black stones into one group. | Reliez les deux pierres noires en un seul groupe. |
| …e4.hint | 哪个点同时挨着两颗黑子？ | Which point touches both black stones? | Quel point touche les deux pierres noires ? |
| …e5.prompt | 黑棋一步能提掉这颗白子吗？ | Can Black capture the white stone with one move? | Noir peut-il capturer la pierre blanche en un coup ? |
| …e5.o1 | 能，下在 A | Yes, at A | Oui, en A |
| …e5.o2 | 能，下在 B | Yes, at B | Oui, en B |
| …e5.o3 | 不能，它还有两口气 | No, it has two liberties | Non, elle a deux libertés |
| …e5.w1 | 下在 A 以后，白子在 B 处还有一口气。 | After A the stone still has a liberty at B. | Après A, la pierre garde une liberté en B. |
| …e5.w2 | 下在 B 以后，白子在 A 处还有一口气。 | After B the stone still has a liberty at A. | Après B, la pierre garde une liberté en A. |
| …e5.explain | 一步只能填一口气，这里要填两口。 | One move fills only one liberty; here two must be filled. | Un coup ne remplit qu'une liberté ; ici il faut en remplir deux. |
| …e6.prompt | 有标记的黑棋共有几口气？ | How many liberties does the marked black group have? | Combien de libertés le groupe noir marqué a-t-il ? |
| …e6.hint | 数一数挨着这两颗黑子的空点，每个点只数一次。 | Count the empty points touching either black stone, each only once. | Comptez les points vides qui touchent l'une ou l'autre pierre noire, chacun une fois. |

### 9.1 Correctness check (done by hand, orthogonal neighbours only)
- **Step 1 / e1** (5×5, B c2 b3 d3 · W c3): W c3 touches c4 (empty), b3, d3, c2 (B) → exactly 1
  liberty, c4. B c2 has c1, b2, d2; B b3 has a3, b4, b2; B d3 has e3, d4, d2 → all alive. B c4 is
  legal (c5, b4, d4, and c3 once captured) and captures 1 stone.
- **Step 3** (5×5, B a3 b4 c4 b2 c2 · W b3 c3): W group {b3, c3}: b3 touches a3 B, b4 B, b2 B;
  c3 touches c4 B, c2 B, d3 empty → one liberty, d3. B d3 captures both stones. B stones keep
  liberties (a3: a4, a2; b4: a4, b5; c4: c5, d4; b2: a2, b1; c2: c1, d2). No ko.
- **e2** (B c1 alone): neighbours b1, d1, c2 → 3 liberties (nothing below row 1). All three are
  empty and tappable.
- **e3** (B e4 e2 · W e3): W e3 touches e4 B, e2 B, d3 empty → 1 liberty. B d3 is the only capturing
  move; it keeps liberties d4, d2, c3 and e3 after the capture. B c3, for example, is legal and
  captures nothing (used in AC 73).
- **e4** (B b3 d3 · W c4 c2): the only point touching both black stones is c3; B c3 has b3/d3 as
  friends so the joint group {b3, c3, d3} has liberties a3, b4, b2, e3, d4, d2 → legal. W c4 (c5,
  b4, d4) and W c2 (c1, b2, d2) are alive. B b4 (legal) joins only b3 → not connected (AC 75).
- **e5** (B b3 c2 · W c3): W c3 touches c4, d3 (empty), b3, c2 (B) → 2 liberties; one move can fill
  only one → "No" is correct. B A=c4 and B B=d3 are both legal and capture nothing.
- **e6** (7×7, B d4 e4 · W d5): d4 touches d5 W, d3, c4, e4 → d3, c4; e4 touches e5, e3, f4, d4 →
  e5, e3, f4. Distinct liberties {d3, c4, e5, e3, f4} = 5. W d5 has d6, c5, e5 → alive.
- **AC 74 fixture** (5×5, B e4 e2 · W e3 d5): B e5 joins e4 into {e4, e5}; e4 touches d4 (empty),
  e3 W; e5 touches d5 W → one liberty, d4 → `selfAtari`, and no capture (W e3 keeps d3; W d5 keeps
  d4 and c5). The move is legal.

## 10. Acceptance criteria
Coordinates: `c3` = column c, row 3 (row 1 at the bottom). "Given the sample" = §9.

### A. Schema, validator, loader — PR 1
1. Given the sample JSON and a `hasText` that knows every key (en/fr/zh), When `validateLesson`,
   Then `{ ok: true }` and `lesson.exercises.length === 6`, `lesson.explain.length === 3`.
2. Given `null`, `[]` or `"x"`, When validated, Then exactly one error `NOT_OBJECT` with path `""`.
3. Given the sample plus a top-level `"foo": 1` and an exercise with `"hnt": "x"`, Then errors
   `UNKNOWN_FIELD` at `foo` and `exercises[0].hnt`; the lesson is not ok.
4. Given `schema: 2` → `BAD_SCHEMA`. Given `id: "Capture"` → `BAD_ID`. Given `id: "u05-x"`,
   `unit: 4` → `ID_UNIT_MISMATCH`. Given `unit: 17` → `BAD_UNIT`; `unit: 0` and `id: "u00-sample"` are valid.
5. Given 1 explain step (lesson) → `BAD_STEP_COUNT` message `explain must have 2 to 4 steps, found 1`;
   5 steps → same code; a `checkpoint` with 1 step → `BAD_STEP_COUNT`; a checkpoint with no `explain` is valid.
6. Given 4 exercises, or 11 → `BAD_EXERCISE_COUNT` (`exercises must have 5 to 10 items, found 4`).
7. Given explain step 1 without `board` → `STEP_NO_BOARD` at `explain[0]`; step 2 without `board` is valid.
8. Given `size: 11` or `13` → `BAD_SIZE`. Given `"f6"` on a 5×5 board, `"i3"`, `"a0"`, `"k3"` on 9×9
   → `BAD_VERTEX` each, path pointing at the vertex (e.g. `exercises[0].setup.B[1]`).
9. Given `B: ["c3"], W: ["c3"]` → `SETUP_OVERLAP`. Given 5×5 `W: ["a1"], B: ["a2","b1"]` →
   `SETUP_DEAD_GROUP` (the white stone has no liberties).
10. Given a step board 5×5 B c2 b3 d3 · W c3 with `moves: [{W, c3}]` → `MOVE_ILLEGAL` containing
    "occupied"; with `moves: [{B, c4}]` → valid.
11. Given a text key missing in `fr` only → `MISSING_TEXT` with message listing `fr`; empty string
    counts as missing; key missing in all three lists all three. Without `ctx` the rule is skipped.
12. tap-point with `answer: { points: [] }` → `EMPTY_ANSWER`; `libertiesOf: "a1"` on an empty point →
    `TARGET_NOT_STONE`.
13. Given the e3 exercise (5×5 B e4 e2 · W e3, toPlay B, goal capture): valid, `getSolution` →
    `{ points: ["d3"] }`. With `min: 2` → `NO_SOLUTION` (`no legal move for B meets goal "capture"`).
14. Goal `atari` — Given 5×5 B c2 · W c3 (W c3 has 3 liberties), toPlay B: legal moves b3 or d3 or c4 do
    **not** make it atari → `NO_SOLUTION`. Given B c2 d3 · W c3, toPlay B → solutions are `b3` and `c4`
    (after either, W c3 has exactly 1 liberty).
    Check: W c3 touches c4, b3 (empty), c2 B, d3 B → 2 liberties; B b3 leaves c4; B c4 leaves b3; ✓.
15. Goal `connect` — Given the e4 exercise: valid, solution `["c3"]`. Given `a: "b3", b: "d3"` where
    both are already one group (B b3 c3 d3) → `ALREADY_TRUE`. Given a = black stone, b = white stone →
    `GOAL_SAME_COLOR`.
16. Goal `save` — Given 5×5 B c3 · W c4 b3 d3 (B c3 has liberty c2 only), toPlay B, `target: "c3"`:
    solutions = `["c2"]`  (B c2 joins c3: group liberties c1, b2, d2 ≥ 2). Given B c3 with 3 liberties
    → `ALREADY_TRUE`. Given target a white stone with toPlay B → `GOAL_SAME_COLOR`.
    Check: B c3 touches c4 W, b3 W, d3 W, c2 empty → 1 liberty; B c2 → group {c3, c2} liberties
    c1, b2, d2 (3) ✓; W stones c4 (c5, b4, d4), b3 (a3, b4, b2), d3 (e3, d4, d2) alive.
17. Goal `point` with `points: ["c3","d3"]` on 5×5 B c3 · W e3 (c3 occupied), toPlay B →
    `GOAL_POINT_ILLEGAL` (`goal point "c3" is not a legal move`); with `["d3"]` only → valid, solution
    `["d3"]`; `points: []` → `EMPTY_ANSWER`.
18. `hintPoints: ["b3"]` on the e3 exercise → `BAD_HINT` (`hintPoints must be among the solution points d3`).
19. choice with 1 option → `BAD_OPTION_COUNT`; with two `correct: true` or none → `BAD_CORRECT_COUNT`.
20. count `answer: 10`, `-1`, `2.5` → `BAD_COUNT_ANSWER`; `libertiesOf` resolving to 5 (e6) is valid
    and `getSolution` → `{ value: 5 }`.
21. Two exercises with the same `id` → `DUPLICATE_ID`.
22. `type: "sequence"` → `UNKNOWN_TYPE` (`unknown exercise type "sequence"`).
23. A lesson with 3 independent mistakes returns 3 errors (not just the first), each with
    non-empty `code`, `path`, `message`; at most 50 errors are returned.
24. `validateCatalog`: two lessons with the same id → `DUPLICATE_LESSON`; unit with two `lesson`s →
    `UNIT_LESSON_COUNT`; a `checkpoint` whose unit has no `lesson` → `CHECKPOINT_ORDER`.
25. `loadLesson("u00-sample")` (dev) → `{ ok: true }`; `loadLesson("nope")` → `{ ok: false,
    reason: "not-found" }`; a registry entry that fails validation → `{ ok: false, reason: "invalid",
    errors }` and **never throws**; second call returns the cached object.
26. In a non-dev context (`includeDev: false`) `listLessons()` does not contain `u00-sample` and
    `loadLesson("u00-sample")` → `not-found`; with `includeDev: true` it is listed first.
27. `getUnits({ includeDev: false })` returns units 1–6 each with `lesson: null` (until M4) and
    `titleKey: "unit.N.title"`; adding a valid unit-1 lesson to the registry in a test makes unit 1
    carry it.
28. **Content test**: every JSON in `src/lessons/content` passes `validateLesson` with the real
    i18n resources, `validateCatalog` passes, and every referenced text is ≤ 160 chars (en, fr) and
    ≤ 70 chars (zh-CN).
29. `src/lessons/**` (except `registry.ts` JSON imports) imports no `react`, `react-native` or `expo*`
    (QA grep, like the engine purity test).
30. `goalMet` unit tests: capture min 1 with 1 captured → true; min 2 with 1 captured → false;
    atari with `opponentAtari.length === 1` → true; connect a/b joined → true; save target with 2
    liberties after the move → true, with 1 → false; point not in list → false.

### B. Progress store — PR 2
31. `computeStars` table (outcomes → stars). C = clean, S = solved, R = revealed:
    N=6: `CCCCCC`→3 · `CCCCCR`→3 (clean 5/6) · `CCCCSS`→2 (clean 4/6, solved 6/6) · `CCCCSR`→2
    (solved 5/6) · `CCCSSR`→2 (solved 5/6) · `CCSSRR`→1 (solved 4/6) · `CCCRRR`→1 (solved 3/6 = 50 %) ·
    `CSRRRR`→0 (solved 2/6) · `RRRRRR`→0.
    N=5: `CCCCR`→3 (clean 4/5) · `CCCSR`→2 (solved 4/5) · `CCSRR`→1 (solved 3/5) · `CSRRR`→0 (2/5) ·
    `CRRRR`→0. Empty outcome list → 0★. Order of outcomes does not matter.
32. Given a fresh store, When `record("u00-sample", CCCCCC)`, Then `lessons["u00-sample"]` =
    `{ stars: 3, plays: 1, bestClean: 6, bestSolved: 6, total: 6, lastPlayedAt: <ISO> }` and the
    return value is `{ stars: 3, previousStars: 0, unlockedUnit: null }` (no next unit exists yet).
33. Given 3★ saved, When `record` with outcomes worth 1★, Then stored `stars` stays 3, `plays` is 2,
    `bestClean`/`bestSolved` keep the best values, and the return is `{ stars: 1, previousStars: 3 }`
    (stars of *this run* are returned so the result screen can say "Best: 3").
34. Given a catalog with units 1 and 2 (both with lessons) and 0★ on unit 1, When unit 1 is
    recorded with 1★, Then the return has `unlockedUnit: 2`; recording unit 1 again with 2★ returns
    `unlockedUnit: null` (already unlocked); recording with 0★ returns `unlockedUnit: null`.
35. Persistence: Given `record` was called, When a new store instance is created over the **same
    storage**, Then it holds the same data (storage key `progress`, value
    `{"v":1,"lessons":{…}}`).
36. Corrupt storage value (`"{not json"`), or `v: 2`, or `lessons` not an object → store starts empty,
    does not throw, and does not overwrite the bad value until the first `record`.
37. `reset()` empties the store and the storage key.
38. `hydrated` is `false` until the storage has been read, then `true`; with a synchronous adapter it is
    `true` immediately. Selectors never return `undefined` for a lesson: `starsOf(id)` → 0 if unknown.
39. `isUnlocked(units, progress, unit)` — catalog units 1, 2, 3 (lessons), progress `{}`: 1 unlocked,
    2 and 3 locked. Progress u1 = 1★ → 2 unlocked, 3 locked. Progress u1 = 0★ (played) → 2 locked.
    u1 = 3★, u2 = 0 → 3 locked.
40. Unit 4 planned (no lesson) after unit 3: never unlocked even if unit 3 has 3★.
41. Checkpoint of unit 2 is unlocked iff unit 2's lesson has ≥ 1★, and does not affect unit 3's lock
    state (u2 lesson 1★, checkpoint 0★ → unit 3 unlocked).
42. `unit: 0` sample is unlocked in dev regardless of progress and its stars never lock unit 1.
43. `nextNode(units, progress)` (used by *Continue*): first unlocked node with 0★ in map order
    (lesson, then its checkpoint, then next unit); returns `null` when none is left.
44. The storage adapter has the interface `{ getItem(k): string | null | Promise<…>; setItem; removeItem }`;
    tests use an in-memory adapter; the store file imports no native module directly.

### C. Explanation player — PR 3 (route `/lesson/u00-sample`, 360×740)
45. Given the sample, When the screen opens, Then it shows step 1 of 3: the step dots (3, first active),
    a 5×5 board with B c2 b3 d3 and W c3, a `liberty` highlight on c4, a triangle on c3, the text of
    `lesson.u00-sample.s1`, **no Back button**, and a *Next* button.
46. When *Next* is pressed on step 1, Then step 2 shows the same stones; after ≈ 500 ms B c4 appears
    (stone sound) and W c3 is captured (300 ms fade); the board ends with B c2 b3 d3 c4 and no white
    stone; the liberty highlight and triangle are not shown on step 2.
47. When *Next* is pressed on step 2, Then step 3 shows its **own** board (B a3 b4 c4 b2 c2 · W b3 c3,
    highlight d3); after ≈ 500 ms B d3 is played and both white stones are removed together.
48. On step 3 the primary button reads *Start practice* (`lesson.startPractice`); pressing it
    navigates to `/practice/u00-sample`.
49. When *Back* is pressed on step 3, Then step 2's **final** position is shown without animation; on
    step 2 *Back* → step 1.
50. When *Replay* (visible only on steps with `moves`) is pressed on step 2, Then the board resets to
    the start position and the moves play again; the step does not change.
51. With Reduce Motion on, entering step 2 shows the final position at once (no 500 ms delay, no
    fade); *Replay* redraws instantly.
52. The board is display-only: touching points does nothing and no ghost stone appears. Coordinates are
    hidden for the sample (`coordinates: false`) and shown when a fixture lesson has `true`.
53. ✕ returns to home at once without a confirmation. *Skip to practice* is visible only when the
    lesson has ≥ 1★ and navigates to `/practice/u00-sample`.
54. Each step change announces the step text and `lesson.step.a11y` to screen readers; the dots are one
    accessibility element ("Step 2 of 3").
55. `/lesson/unknown-id` → error screen (`error.lesson.title`, button *Back to map*), no crash. A
    lesson that fails validation → same screen.
56. A locked lesson opened by URL (unit 2 with unit 1 at 0★) → locked screen with `error.locked.body`.
57. The first step's board never jumps: the board area keeps 328×328 (at 360×740) during
    animation; the text card keeps a fixed 120 px height (long texts scroll inside it, never move the
    buttons).
58. No hard-coded user-facing string in `app/lesson/[id].tsx` and `src/lessons` UI components.

### D. Exercise runners — PR 4 (route `/practice/u00-sample`)
**Shell**
59. Given the sample, When opened, Then 6 progress segments (segment 1 current), prompt of exercise 1,
    a 5×5 board, a *Hint* button, an empty 72 px feedback area and **no** primary button.
60. Exercises run in authored order; *Next* appears only after a correct answer or a reveal;
    on exercise 6 it reads *Finish*.
61. *Hint* (e1): tapping shows the `e1.hint` text with an amber dot, and a pulsing `hint` ring on c4
    (3 cycles then static). A second tap does nothing. After using the hint, a correct answer gives
    outcome `solved` (not `clean`).
62. Attempt policy (e3, B to play): tap c3 (legal, captures nothing) → wrong #1: message, no hint
    yet; press *Try again*, tap c3 again → wrong #2: message **and** the hint opens by itself with an
    amber pulse on d3; *Try again*, c3 a third time → wrong #3: the answer is revealed (AC 79),
    outcome `revealed`.
63. Illegal touches never count: in e3 touching e3 (occupied) shows `engine.illegal.occupied`, the board
    is unchanged and the attempt counter stays 0.
64. A correct answer: feedback card with green dot and `fb.correct` (+ `explainKey` if present),
    *Next* enabled, board locked.
65. ✕ / Android back / iOS back gesture → leave sheet (`practice.leave.*`); *Keep going* closes it
    and changes nothing; *Leave* returns to home and records nothing in the store.
66. Finishing exercise 6 calls `record` exactly once with the six outcomes, then shows the result
    screen. Re-rendering or rotating does not record again.
67. The feedback card keeps its 72 px slot (no layout jump) whether empty, one line or three lines.

**tap-point**
68. e1 (mode one): touch-down on c4 shows a **ring** (no stone), touch-up commits → correct. Touch c3
    (occupied) → wrong #1 `fb.tapOne.wrong`; touching occupied points is allowed.
69. e2 (mode all, B c1): *Check* disabled at start. Tap b1 → b1 gets the `liberty` highlight; tap b1
    again → deselected. Select b1, d1, c2 and press *Check* → correct, outcome `clean`.
70. e2: select b1 and c3, *Check* → wrong #1; message `fb.tapAll.partial` with found 1 of 3 **and**
    `fb.tapAll.extra`; c3 flashes a red ring (700 ms) and is deselected; b1 stays selected.
71. e2: three wrong checks → reveal: `success` rings on b1, d1, c2 and the `explainKey` text (if any).

**play-move**
72. e3: tap d3 → B stone placed (sound), W e3 fades (capture animation), green feedback, *Next*.
73. e3: tap c3 (legal, B c3 has c4, b3, d3, c2) → stone placed, dashed `error` ring on it, board locked,
    message `fb.pm.noCapture`, primary button *Try again*; pressing it restores the exact setup
    (B e4 e2 · W e3) and unlocks the board.
74. Fixture (5×5, B e4 e2 · W e3 d5, toPlay B, goal capture): tap e5 → message `fb.pm.noCapture`
    followed by a second line `fb.pm.selfAtari` (B {e4,e5} has only d4).
75. e4 (connect): tap c3 → correct. Tap b4 → wrong, `fb.pm.notConnected`. Tap c4 (occupied) →
    `engine.illegal.occupied`, not counted.
76. Fixture goal `atari` (5×5 B c2 d3 · W c3, toPlay B): tap e1 (empty, far) → `fb.pm.noAtari`; tap
    c4 → correct.
77. Fixture goal `save` (5×5 B c3 · W c4 b3 d3, toPlay B, target c3): tap e5 → `fb.pm.stillAtari`;
    tap c2 → correct.
78. Fixture goal `point` (points `["c3"]`): tap d3 → `fb.pm.wrongPoint`; tap c3 → correct.
79. Revealed play-move (e3 after 3 wrong attempts): the board resets to the setup, a `success` ring
    appears on d3 (all solution points), feedback `fb.revealed` + `e3.explain`, *Next*. The answer is
    shown, **not played**.

**choice**
80. e5 (3 options, A = c4, B = d3 shown as labels on the board): options appear in authored order,
    each ≥ 48 px high. Tap option 3 → correct, outcome `clean`; `e5.explain` shown.
81. e5: tap option 1 → option 1 greyed/disabled with text `e5.w1` (wrong #1); tap option 3 → correct,
    outcome `solved`.
82. e5: tap option 1 then option 2 → 2 attempts are the maximum (`min(3, 3−1)`), so the answer is
    revealed: option 3 outlined `success`, `fb.revealed`, outcome `revealed`.
83. Fixture with 2 options: one wrong tap reveals at once.
84. The board in choice exercises is display-only (touching it does nothing) and shrinks to ≥ 220 px
    so that options (≥ 48 px) and the 72 px feedback card fit at 360×740 without scrolling.

**count**
85. e6: 10 chips (0–9) in two rows of 5, each ≥ 56×44; *Check* disabled until a chip is selected.
    Select 5, *Check* → correct, outcome `clean`.
86. e6: select 4, *Check* → wrong #1, message `fb.count.wrong`; the chip stays selected until another
    is chosen; changing the chip clears the message.
87. e6: after the 2nd wrong the hint opens; after the 3rd wrong the 5 liberties (d3, c4, e5, e3, f4)
    are ringed in `success`, chip 5 is outlined, outcome `revealed`.
88. The board for count may shrink to fit (chips + Check + feedback) — it stays square, ≥ 280 px at
    360×740, and nothing scrolls.

**Result screen**
89. Outcomes CCCCCC → 3 filled stars, title `complete.title.3`, summary "6 of 6 right the first time",
    primary button *Back to map* (no next node in M3's sample catalog), store has 3★.
90. Stars appear one after another 250 ms apart with the stone sound each; with Reduce Motion or
    sound off they appear instantly / silently.
91. Outcomes CCCCSS → 2★ (summary "4 of 6 …"); CCCSRR → 1★; CSRRRR → 0★ with the 0★ layout: no filled
    star, `complete.body.0` ("You solved 2 of 6 on your own…"), primary *Review the lesson* →
    `/lesson/u00-sample`, secondary *Try again* → `/practice/u00-sample` restarted at exercise 1.
92. In a catalog with unit 2 present and unit 1 going 0★ → 1★, the result screen shows the badge
    `complete.unlocked` ("Unit 2 unlocked") and the primary button is *Next lesson* →
    `/lesson/<unit-2 lesson id>`.
93. When this run's stars < stored best (e.g. 1★ run, best 3★) the caption `complete.best` ("Best: 3
    of 3 stars") is shown.
94. The result screen announces `complete.stars.a11y` once; the stars glyphs are not read individually.
95. *Practice again* / *Try again* start a fresh run (new outcomes list), the old run is not
    recorded twice.
96. No hard-coded user-facing string in `app/practice/[id].tsx` or `src/exercises`; the runners never
    call `play`/`checkMove`/`legalMoves` outside `src/lessons/goals.ts` and a single
    `src/exercises/engineAdapter.ts` (QA grep); `<GoBoard>` remains rule-free.

### E. Home / unit map — PR 5
97. Fresh install, dev build, no progress: header (gear, logo, name, subtitle) as in M0; a *Continue*
    card (`home.start` on first run) pointing at the sample; section title `home.path.title`; node
    "Sample (developer)" **available**; below it "Unit 1 … 6" as *coming soon* with the badge; caption
    `home.moreSoon`.
98. Production build (`__DEV__` false): no sample node, no *Continue* card (nothing to continue), unit
    1–6 coming soon.
99. After `record("u00-sample", CCCCSS)` (2★): the sample node shows ★★☆ with a black stone dot and the
    chevron; *Continue* card is hidden when nothing is left (`nextNode` null) and `home.allDone`
    appears instead.
100. With a fixture catalog (units 1–3 with lessons) and progress u1 = 3★, u2 = 0★: node 1 done ★★★,
     node 2 available (white stone, teal ring), node 3 locked (lock icon, 50 % opacity), *Continue* →
     unit 2 and its caption reads "Unit 2 · Liberties · 气 qì".
101. Tapping an available or done node navigates to `/lesson/<id>`. Tapping a **locked** node does not
     navigate; a snackbar with `home.locked.hint` appears for ~2.5 s and is announced.
102. A *coming soon* node is not a button (no press feedback, not focusable as button) and shows
     `home.unit.comingSoon`.
103. A checkpoint fixture (unit 2 has one): rendered as a smaller indented node under the unit with
     caption `home.checkpoint.label`; locked until unit 2's lesson has ≥ 1★.
104. Accessibility labels follow `home.node.a11y.*` with `{{label}}` = "Unit 2" and `{{title}}` the
     unit title (e.g. "Unit 2, Liberties · 气 qì, 3 of 3 stars").
105. Until the store is hydrated the nodes show skeleton bars (no locked/available flash); after
     hydration the correct states appear without layout shift (every node card is 72 px high).
106. Tap targets: gear ≥ 44×44; every node card ≥ 72 px high and full width; *Continue* ≥ 56 px.
107. At 360×740 the screen scrolls vertically only; no horizontal scroll; the *Continue* card and
     first two nodes are visible without scrolling.
108. The Settings gear and language switching still work; changing the language re-renders unit titles
     and node labels.
109. The M0 placeholder routes show the real player/runner for valid lesson ids (ACs 45, 59).
110. **Web verification** (QA, like M2 PR 4): `expo export --platform web` served and driven with
     Playwright at 360×740: open home → tap sample → step through 3 steps → start practice → solve
     all six exercises (selectors by `testID`/role) → result screen. Screenshots in
     `docs/screenshots/M3/` (home, explain step 2, each of the four runners, result).
111. The web run completes with no console errors; progress persists across a page reload (storage
     adapter works on web).
112. `STATUS.md` updated at the end of M3 (what was done, the storage decision, iPhone checklist for
     M3 `docs/specs/M3-iphone-checklist.md`).

### F. Quality — every PR
113. `npm run lint`, `npm run typecheck`, `npm test` pass; `src/lessons` pure (AC 29).
114. zh-CN, en and fr contain identical key sets including all keys of §7 and §9 (existing
     `i18n.test.ts` covers this).
115. No new dependency without a note in the PR description; the only expected one is the storage
     library (§11 question 1).
116. Each PR description shows the positions used by its ACs as ASCII diagrams with ✓ for the PO
     (CLAUDE.md / STATUS preference), e.g. the e3 and e4 diagrams of §9.1.

## 11. Open questions for the product owner (with my recommendation)
1. **Storage library — MMKV vs what works in your Expo Go.** The roadmap and TECH_STACK say MMKV
   (`react-native-mmkv`). My understanding is that MMKV contains native code that the App Store
   Expo Go does **not** include, so the app would crash on your iPhone until we make a custom
   development build (EAS Build, M6). *Recommendation:* put storage behind a tiny adapter and use
   **`@react-native-async-storage/async-storage`** now (works in Expo Go and on web; the store shows
   skeleton bars for a split second until it is read); swap to MMKV at the EAS build in M6 (one
   file). The developer verifies the claim in a 15-minute spike first; if MMKV does run in Expo Go 57,
   use MMKV as planned.
2. **Where do lesson texts live?** Option A (recommended): in the three i18n files under keys
   `lesson.<id>.…` — one place for translations, the existing parity test and CLAUDE.md rule 5 apply,
   the lesson JSON stays purely about boards. Option B: inline `{zh, en, fr}` inside each lesson JSON
   (easier to read as one file, but a second translation system). *Recommendation:* A.
3. **Star thresholds.** 3★ = ≥ 80 % first-try; 2★ = ≥ 80 % in the end; 1★ = ≥ 50 % in the end
   (unlocks next unit). Stricter or kinder? *Recommendation:* keep; the numbers are constants in one
   file and are easy to tune after you try real content in M4.
4. **Does the checkpoint block the next unit?** CURRICULUM draws "explain → practice → checkpoint"
   per unit. *Recommendation:* the checkpoint is unlocked by the unit's lesson but does **not** block
   Unit N+1 in M3 (a failed mixed review should not stop a beginner). Revisit in M4 once real
   checkpoints exist.
5. **Hint policy.** Always-visible Hint button (costs the "first try" bonus, never an attempt); the hint
   opens by itself after the 2nd mistake; the answer is shown after the 3rd (and after 1–2 for
   choice questions). *Recommendation:* keep exactly this; it follows "~80 % success, nobody stuck".
6. **Sample lesson visibility.** Shown on the map only in developer builds (your Expo Go); hidden in the
   public release; replaced by real Unit 1 in M4. *Recommendation:* yes.
7. **Leaving mid-set.** Nothing is saved and a small confirmation appears. Alternative: resume where you
   left off. *Recommendation:* no resume in M3 (sets take 3–5 minutes); reconsider if M4 sets feel long.
8. **Skipping teaching.** *Skip to practice* appears only after the lesson already has a star; a
   learner who already knows Go cannot jump over units in M3. *Recommendation:* keep strict; the
   "I already play Go" shortcut belongs to onboarding in M6 (placement quiz).
9. **Star sound and mute.** The result screen reuses the soft stone "tock" for each star. There is no
   settings store/mute switch yet (M6), so the sound is always on unless the phone is silent.
   *Recommendation:* acceptable for M3.
10. **Hardware/gesture back inside a practice set** triggers the leave sheet (not an immediate exit).
    *Recommendation:* yes.

## 12. Dependencies on earlier milestones (small `<GoBoard>` additions, requested here)
M2's board is used as-is except for **one small addition needed by tap-point**: a prop
`pointer?: 'stone' | 'ring'` (default `'stone'`). With `'ring'` the touch-down preview is a thin
`accent` ring instead of a ghost stone and `checkPoint` may accept occupied points. The developer
adds it in PR 4a with a test; everything else (highlights, markers, `lastCapture`, `disabled`,
`interactive`, hint pulse) already exists. Exercise ids and goals use only engine helpers
`play`, `checkMove`, `legalMoves`, `groupAt`, `liberties`, `createGame`, `parseVertex`,
`stonesFromSetup` — no engine change is needed.

## 13. Out of scope
`sequence` (multi-move tsumego) and `play-bot` runners (M5 / M4); SGF import; 13×13 / 19×19 lessons;
random order or exercise pools; spaced repetition / re-queuing revealed exercises; saving a
half-finished set; settings screen additions (mute, reset progress, language already exists); sound
other than the existing stone tock; haptics; streaks, daily goals, XP, leaderboards; accounts and
sync (M8); the AI tutor (M7); the real Unit 1–5 content and the Capture Go mini-game (M4); onboarding
and placement quiz (M6); dark mode; tablet layouts beyond the 480 px board cap; number input larger
than 9 (M5 scoring will need a keypad).
