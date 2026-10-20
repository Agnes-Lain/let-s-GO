# SGF fixtures (M5 item 2)

Self-authored test fixtures, dedicated to the public domain (CC0 1.0). Used only by tests.

- `f1-capture-in-one.sgf` — spec F1 (5×5, Black captures c3 at c2; wrong: a1).
- `f2-ladder.sgf` — spec F2 (5×5 ladder, 7 plies; wrong: d3, W c4).
- `content-src/` — a sample `.src.json` lesson for the import pipeline test.

Convention: the first child of each node is the correct line; extra variations at the first
move are wrong answers. `C` comments are author notes and never shipped.
