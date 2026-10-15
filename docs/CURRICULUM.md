# Curriculum — from zero to a full game

Each **unit** = short explanation (2–4 animated board screens) → **practice set** (5–10 exercises)
→ **checkpoint** that mixes the new rule with earlier ones. Stars (1–3) per set; next unit unlocks at 1 star.

Board sizes grow with the learner: 5×5 → 7×7 → 9×9 (13×13 / 19×19 introduced only at the end).

| # | Unit | Rule / concept | Practice exercises |
|---|---|---|---|
| 1 | 棋盘与棋子 Board & stones | Stones go on intersections; black first; alternate; stones don't move | Tap the correct point; place stones at named points |
| 2 | 气 Liberties | Empty adjacent points (not diagonal) | Count liberties of a stone / group; tap all liberties |
| 3 | 连接 Connection | Orthogonally adjacent stones form one group sharing liberties | Is this one group or two? Connect two stones |
| 4 | 提子 Capture | Remove a group with zero liberties | Capture in one move; find the capturing point |
| 5 | 叫吃 Atari & escape | One liberty left; escape by extending or capturing | Escape atari; put opponent in atari |
| 6 | **吃子棋 Capture Go** (checkpoint) | First to capture N stones wins | Mini-games vs bot on 5×5 / 7×7 |
| 7 | 禁入点 Forbidden points | No suicide — unless the move captures | Is this move legal? |
| 8 | 打劫 Ko | Can't immediately recapture a single stone | Spot the ko; find a ko threat (simple) |
| 9 | 征子 & 枪 Ladder & net | Basic capturing techniques | Does the ladder work? Capture with a net |
| 10 | 眼 Eyes | Real vs false eye | Identify real eyes |
| 11 | 死活 Life & death | Two eyes = alive | Make two eyes / prevent two eyes (1-move tsumego) |
| 12 | 地 Territory | Surrounding empty points | Mark the territory of each side |
| 13 | 数子 Counting (Chinese rules) | Area scoring: stones + territory; komi | Count a finished 7×7 / 9×9 position |
| 14 | 终局 End of game | Pass, dead stones, final count | Decide when the game is over; remove dead stones |
| 15 | **First full games** | Everything combined | 9×9 vs bot (levels 1–3), then handicap games |
| 16 | 布局入门 Opening basics (optional) | Corners → sides → center | Choose the best first moves |

## Exercise types (implemented in `src/exercises/`)
- `tap-point` — tap one/many correct intersections (liberties, territory, legal moves)
- `play-move` — make a move that achieves a goal (capture, escape, connect); checked by engine predicates
- `sequence` — multi-move tsumego with scripted opponent responses (SGF-based)
- `choice` — multiple-choice questions on a board diagram (alive/dead? legal?)
- `count` — enter a number (liberties, score)
- `play-bot` — mini-game vs bot with a win condition (`captureN`, `score`)

## Lesson JSON (sketch)
```json
{
  "id": "u04-capture",
  "unit": 4,
  "title": { "zh": "提子", "en": "Capture", "fr": "Capture" },
  "explain": [ { "board": "5x5", "setup": "...", "text": "lesson.u04.step1", "highlight": ["c3"] } ],
  "exercises": [
    { "type": "play-move", "size": 5, "setup": { "B": ["c3"], "W": ["c2","b3","d3"] },
      "toPlay": "W", "goal": { "kind": "capture", "min": 1 }, "hint": "lesson.u04.ex1.hint" }
  ]
}
```
