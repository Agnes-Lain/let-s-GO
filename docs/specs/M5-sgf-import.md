# M5 item 2 — SGF import for problem sets

Status: APPROVED by PO (2026-10-20), all §11 defaults accepted.

## 1. Goal
An author can write a tsumego (life-and-death) problem as a standard SGF file, run one command, and get lesson JSON that the
existing validator accepts and the `sequence` runner (M5 item 3) can play.

## 2. User stories
- As a **content author**, I want to draw a problem in any SGF editor (Sabaki, CGoban, 野狐 export) so that I do not hand-type
  coordinates.
- As an author, I want a wrong first move to be a variation in the same file so that all of one problem lives in one file.
- As an author, I want a malformed or unsupported file to fail with `file:line:col` and a plain reason so that I fix it in
  seconds.
- As an author, I want all learner-facing text to stay in the three i18n files so that SGF never ships untranslated text.
- As a **developer**, I want the importer to be pure TS that is tested with ASCII boards so that it follows engine rules.
- As a **beginner**, I want problems to be correct (legal, solvable, zero surprises) so that the validator must reject a bad
  file before it can reach me.

## 3. Decisions (defaults; PO approves in §11)
| # | Decision | Default and why |
|---|---|---|
| D1 | Parser location | `src/sgf/` (pure TS, relative imports + `import type` from `@/engine`; no React/RN/fs). Own parser (~150 lines), as M1 §8 recommends; `@sabaki/sgf` stays the fallback if a real file needs more. No new dependency. |
| D2 | Build-time or runtime | **Build-time.** `.sgf` is converted to lesson JSON in `src/lessons/content/` and the generated JSON is committed. The app never parses SGF, so no parse errors or cost at runtime, and the existing validator and loader are unchanged. A drift test fails if committed JSON differs from a fresh conversion. |
| D3 | SGF `C` comments and i18n | `C` is an **author note and is never shipped**. All text keys are written in a small hand-authored source file next to the SGF (§5). Reason: one SGF cannot hold zh-CN, en and fr, and rule 5 requires all three. |
| D4 | `sequence` data model | **This item adds the type, schema, and validator rules** (needed as the converter's target and so "proved solvable" can be tested) but **no runner and no shipped lesson**. Item 3 adds the runner and content. |
| D5 | Board sizes | Parser accepts square 1–19; converter accepts 5, 7, 9 (`LessonSize`). 13/19 come with the milestone that adds them to `LessonSize`. |
| D6 | Samples | Self-authored, dedicated CC0, used only as test fixtures. No third-party problem collections (licences unclear). |

## 4. SGF subset
Format FF[4] (FF[1-3] read leniently). One game tree per file.

| Property | Handling |
|---|---|
| `SZ` | Required, square only (`SZ[5]`; `SZ[5:5]` ok, `SZ[5:7]` error). Missing means 19 (SGF default), which D5 then rejects. |
| `GM` | Absent or `1`; else error. |
| `AB` `AW` | Root node only. Single points and compressed rectangles (`AB[aa:cc]`). Overlaps, off-board points: error. |
| `PL` | `B` or `W`: side to play. If absent, the colour of the first move. |
| `B` `W` | Moves. A node has exactly one. Pass (`[]` or `[tt]` on boards ≤19) is an error in v1. |
| `C` | Parsed, kept in the parse result, ignored by the converter (D3). |
| `FF CA AP GN GC ST DT PW PB KM RU SO US PC EV RO RE TE HA` etc. | Metadata, ignored silently. |
| Anything else (`AE`, `TR`, `SQ`, `LB`, `MN`, ...) | **Warning** `UNSUPPORTED_PROPERTY` (file converts); but `AE`, setup properties outside the root, and `KO`/`MN` that would change the position are **errors**. |

Structure: the first child at each node is the **correct line**. At the **first move only**, extra variations are **wrong
answers** (each one is a line: the learner's move plus optional scripted replies). A variation anywhere deeper is an error
`NESTED_VARIATION` (tsumego with several correct branches is out of scope, §10). SGF has no "right/wrong" flag; ordering is the
convention, and the importer documents it.

Coordinates: SGF `xy` are two letters `a..s` from the **top-left** (`aa` = top-left). Engine: column letters from the left skipping
`i`, row numbers from the **bottom** (M1, "Coordinates"). Conversion for board size N: column = engine letter at index x;
row = N − y. 5×5: `aa` = a5, `ee` = e1, `cc` = c3, `bc` = b3, `cb` = c4, `cd` = c2. For N ≤ 8 the skipped `i` never occurs;
the 9×9 table must be tested (`ii` = j1 on 9×9, since `i` is skipped).

## 5. Pipeline and files
```
content-src/u10-example.src.json   hand-authored lesson (text keys, goals) with "sgf" references
content-src/u10-example/e1.sgf     the problem
        |  npm run import:sgf        (I/O only in scripts/; logic in src/sgf/, pure)
        v
src/lessons/content/u10-example.json   generated, committed, never hand-edited (header field "generatedFrom")
```
`.src.json` is the normal lesson JSON except that an exercise of `"type": "sequence"` carries `"sgf": "e1.sgf"` instead of
`size/setup/toPlay/line/wrong`, which the importer fills in. Optional per-exercise `"whyKeys": {"d3": "<textKey>"}` attaches a
`whyKey` to the wrong branch whose first move is `d3`. `promptKey`, `hintKey`, `explainKey`, `goal`, `id` come from the `.src.json`
(default key pattern in the doc comment: `lesson.<lessonId>.<exerciseId>.prompt|hint|explain`, as in the existing content).
`content-src/` is outside the loader's import path, so unfinished sources never ship. The script formats its output with
Prettier (already a dev dependency) so `format:check` passes; the drift test compares parsed JSON. Script runner: same
no-new-dependency pattern as `tune:bot` (own Jest/ts config) unless Node 22 type stripping works with the relative imports.

### Public API (`src/sgf/index.ts`)
```ts
parseSgf(text: string): { ok: true; tree: SgfNode; warnings: SgfIssue[] } | { ok: false; errors: SgfIssue[] }
convertSgf(tree: SgfNode, opts?): { ok: true; problem: SgfProblem; warnings } | { ok: false; errors }
sgfPoint(xy: string, size: number): Vertex | null          // 'cd' on 5 -> 'c2'
expandLessonSource(src: LessonSource, readSgf: (path: string) => string): { ok: true; lesson: unknown } | { ok: false; errors }
interface SgfIssue { code: string; message: string; line: number; col: number; file?: string }   // 1-based
interface SgfProblem { size: LessonSize; setup: Setup; toPlay: Color; line: MoveDef[]; wrong: { line: MoveDef[] }[] }
```
Error codes (stable, tested): `SGF_EMPTY`, `SGF_SYNTAX`, `SGF_UNTERMINATED_VALUE`, `SGF_UNBALANCED_PARENS`, `SGF_MULTIPLE_GAMES`,
`SGF_BAD_GAME`, `SGF_BAD_SIZE`, `SGF_BAD_POINT`, `SGF_SETUP_OVERLAP`, `SGF_SETUP_NOT_ROOT`, `SGF_BAD_PLAYER`, `SGF_NO_MOVES`,
`SGF_PASS_UNSUPPORTED`, `SGF_NOT_ALTERNATING`, `SGF_NESTED_VARIATION`, `SGF_DUPLICATE_BRANCH`, `SGF_UNSUPPORTED_PROPERTY` (warning).
CLI line format: `path/e1.sgf:1:34 error SGF_BAD_POINT: AB[zz] is outside a 5x5 board`. Exit code 1 on any error; warnings print and exit 0.

## 6. `sequence` exercise (schema, additive; `schema: 1` stays)
```ts
interface SequenceExercise extends ExerciseBase {       // size, setup, prelude, promptKey, hintKey, explainKey ...
  type: 'sequence';
  toPlay: Color;
  goal: { kind: 'line' } | { kind: 'capture'; target: Vertex };
  line: MoveDef[];                                      // correct line; even indexes = learner, odd = scripted replies
  wrong?: { line: MoveDef[]; whyKey?: TextKey }[];      // line[0] = a learner mistake; rest = scripted refutation
}
```
`goal.kind 'line'`: the engine cannot judge "alive", so the authored line is the truth (proved legal only). `capture`: the engine
proves the target group is captured by the end of `line`. `hintPoints` allowed (subset of `line[0].at`).
Validator rules (extend `validate.ts`, codes added to the existing set): see AC 21–29. The runner and its star/hint policy belong to item 3.

## 7. Fixtures (self-authored, CC0; diagrams checked by hand, tests re-check with the engine)
**F1 — capture in one (5×5, Black to play).** `(;GM[1]FF[4]SZ[5]PL[B]AB[bc][dc][cb]AW[cc](;B[cd])(;B[ae]))`
```
5 . . . . .       Black b3 d3 c4, White c3 (libs: c2 only).
4 . . X . .       Correct: B c2 captures c3.  Wrong: B a1 (c3 still has c2).
3 . X O X .
2 . . * . .
1 . . . . .
  a b c d e
```
**F2 — ladder line (5×5, Black to play, 7 plies; the line of M5 §13, re-walked).**
`(;GM[1]FF[4]SZ[5]PL[B]AB[bc][cd][dd]AW[cc](;B[cb];W[dc];B[ec];W[db];B[da];W[eb];B[ea])(;B[dc];W[cb]))`
(setup Black b3 c2 d2, White c3)
Main line: B c4, W d3, B e3, W d4, B d5, W e4, B e5. Walk: start W c3 libs c4,d3; B c4 atari (d3); W d3 libs e3,d4; B e3 atari (d4);
W d4 libs d5,e4; B d5 atari (e4); W e4 libs e5; B e5 captures c3 d3 d4 e4 and is legal. Wrong: B d3 (legal), W c4 (legal).
Final goal in the `.src.json`: `{"kind":"capture","target":"c3"}`.
**F3 — 9×9 coordinate table.** On 9×9: `aa` = a9, `ai` = a1, `hh` = h2, `ii` = j1 (the engine skips `i`); test all 81 points once.
**F4 — bad files**, one per error code, each with the expected `line:col` (table in the test file).

## 8. Acceptance criteria
Parser (`src/sgf/parse.ts`)
1. Given F1, when parsed, then root has `SZ=5`, `AB=[bc,dc,cb]`, `AW=[cc]`, and two children, each with one `B`.
2. Given `C[a \] b\\c]`, then the value is `a ] b\c`; given a soft line break (`\` + newline) it is removed; given non-ASCII (`C[黑先]`) it is kept.
3. Given whitespace/newlines between nodes and properties, and a lowercase letter inside an identifier (`FF[4]`, `Ab[..]` legacy), then parsing succeeds.
4. Given `AB[aa:cc]` then the expanded list is the 9 points `aa..cc`; given `AB[cc:aa]` or an off-board corner then `SGF_BAD_POINT`.
5. Given empty/whitespace input, then `SGF_EMPTY` at 1:1.
6. Given `(;SZ[5]AB[bc]` (no closing paren), then `SGF_UNBALANCED_PARENS` pointing at the unmatched `(`; given `AB[bc` then `SGF_UNTERMINATED_VALUE` at the `[`.
7. Given two top-level `(...)(...)`, then `SGF_MULTIPLE_GAMES` at the second tree.
8. Every error carries `line` and `col`, 1-based, counted in characters; a multi-line file reports the right line (test with errors on line 3).
9. Given garbage (`hello`) or a 1 MB random string, then a `SGF_SYNTAX` error, no throw, and it finishes < 1 s.

Converter (`src/sgf/convert.ts`)
10. Given F1, then `{size:5, setup:{B:[b3,c4,d3],W:[c3]}, toPlay:'B', line:[{B,c2}], wrong:[{line:[{B,a1}]}]}` (vertex lists sorted like the engine).
11. Given F2, then `line` has 7 moves `c4 d3 e3 d4 d5 e4 e5` coloured B,W,B,W,B,W,B and `wrong[0].line = [B d3, W c4]`.
12. Coordinates: on 5×5 `aa=a5 ee=e1 cc=c3 bc=b3 cb=c4 cd=c2`; on 7×7 `gg=g1`; on 9×9 `hh=h2`, `ii=j1`, `ai=a1`, and all 81 points round-trip with `parseVertex`/`vertexToString`.
13. Given no `PL`, then `toPlay` = colour of the first move; given `PL[W]` and a first move `B[..]`, then `SGF_BAD_PLAYER`; given neither `PL` nor moves, `SGF_NO_MOVES`.
14. Given `SZ[19]`, `SZ[4]`, `SZ[5:7]`, or no `SZ`, then `SGF_BAD_SIZE` (message names the supported sizes 5, 7, 9).
15. Given `AB[bc]AW[bc]` or the same point twice, then `SGF_SETUP_OVERLAP`; given `AB` in a non-root node, `SGF_SETUP_NOT_ROOT`; given `AE`, an error.
16. Given a pass (`B[]`, `W[tt]` on 5×5) in a line, then `SGF_PASS_UNSUPPORTED`; given two `B` moves in a row, `SGF_NOT_ALTERNATING`.
17. Given a variation after the second move, then `SGF_NESTED_VARIATION` at that node; given two branches with the same first move, `SGF_DUPLICATE_BRANCH`.
18. Given `TR[bb]` or `GN[x]`, then `TR` gives warning `SGF_UNSUPPORTED_PROPERTY`, `GN` gives nothing, and both still convert. `C` never appears in the output.

Expansion, script, validator
19. Given a `.src.json` with a `sequence` exercise and `sgf`, then `expandLessonSource` returns a lesson whose exercise has the converted fields plus the keys and goal from the source, and no `sgf` field; given a missing file or SGF error, the error includes the file path and `line:col`.
20. The command `npm run import:sgf` writes `src/lessons/content/<id>.json` for every `content-src/*.src.json`, exits 1 with `file:line:col` lines on any error, and writes nothing for a lesson that has an error. Re-running gives byte-identical output. Drift test: committed generated JSON equals a fresh conversion (skipped cleanly when `content-src/` has no files).
21. `validateLesson` accepts F1 and F2 as `sequence` exercises (replacing the test that expects `unknown exercise type "sequence"`).
22. Given `line[0].color !== toPlay`, or colours not alternating, then error `SEQ_BAD_ORDER` with the path `exercises[i].line[k]`.
23. Given a move that is illegal when replayed by the engine (occupied, suicide, ko) in `line` or any `wrong[].line`, then `SEQ_ILLEGAL_MOVE` with the engine's reason.
24. Given `goal {kind:'capture', target:'c3'}` and F1 with `line` replaced by `[B a1]`, then `SEQ_GOAL_NOT_MET`; given F1 and F2 as written, the check passes. Given a target that is not a stone of the opponent of `toPlay`, then `SEQ_BAD_TARGET`.
25. Given a wrong line whose first move equals `line[0].at`, or two wrong lines with the same first move, then `SEQ_DUPLICATE_BRANCH`.
26. Given `hintPoints` containing a point other than `line[0].at`, then the usual hint-not-in-solution error; given a missing text key in any language, the usual missing-text error (same `hasText` mechanism).
27. Given an exercise that also has `prelude`, then the `line` is checked from the position after the prelude.
28. Types: `EXERCISE_TYPES` includes `'sequence'`; the lesson-wide count rule (5–10 exercises) applies unchanged.
29. Safety: a test asserts that no lesson in the shipped registry contains a `sequence` exercise yet (the app has no runner), so no screen can meet one.

Quality
30. `src/sgf/` imports nothing from `react`, `react-native`, `expo`, `fs`, `path` (extend the existing purity test); `npm run lint`, `typecheck`, `format:check`, `test` green. No new dependency.

## 9. Test plan pointers
`src/sgf/parse.test.ts` (AC 1–9), `convert.test.ts` (10–18, boards drawn in ASCII in comments and checked with `parseBoard`
and `play`), `expand.test.ts` (19), `__tests__/sgf-pipeline.test.ts` (20), `src/lessons/validate.sequence.test.ts` (21–28),
`src/lessons/purity.test.ts` (30), registry guard in `src/lessons/content.test.ts` (29). Fixtures in `__tests__/fixtures/sgf/*.sgf`.
Test-first: write the failing tests from F1–F4 before the parser. No UI, so no 360×740 screenshots or copy keys in this item; i18n
files do not change. Designer review: confirm the two fixtures and the error messages are understandable to a non-programmer author.

## 10. Out of scope
The `sequence` runner and its UI (stars, hints, "after 3 failures"; item 3); real tsumego content and the Unit 10/11 lessons;
several correct branches or deeper variations; pass moves; `AE`/markers/labels (`TR`, `LB`) as board marks; SGF export; runtime
or in-app import by the learner; 13×13/19×19; `@sabaki/sgf`; using `C` as shipped text; ko/superko-aware tsumego; automatic
life-and-death judgement; automatic zh-CN/fr translation; importing third-party problem collections.

## 11. Open decisions for PO (defaults in bold)
1. Parser: **own, in `src/sgf/`** vs `@sabaki/sgf`.
2. Conversion: **build-time script, JSON committed** vs runtime parsing.
3. `C` comments: **author notes only, text keys in `.src.json`** vs a `C[key:lesson.…]` convention.
4. This item adds the `sequence` **schema + validator, no runner** vs schema only vs leave all to item 3.
5. Sizes: **5, 7, 9 only** (matching `LessonSize`).
6. Nested variations: **hard error** vs warn and ignore.
7. Unknown properties: **warn (error only when the position would change)** vs always error.
8. Goal `line` (authored truth) is allowed for "alive" problems: **yes**, until a life-and-death helper exists.
9. Samples: **self-authored fixtures only**; real Unit 10/11 problems are authored in item 3.

**PO decision (2026-10-20):** approved — all defaults above (bold) accepted.
